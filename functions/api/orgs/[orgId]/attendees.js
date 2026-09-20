import { ok, err } from "../../_lib/http.js";
import { requireOrgRole } from "../../_lib/auth.js";
import { getDB } from "../../_bf.js";
import { ensureZkSchema } from "../../_lib/zk.js";
import { sendRsvpConfirmation, sendRsvpReminder } from "../../_lib/email.js";

async function tryAlter(db, sql) {
  try {
    await db.prepare(sql).run();
  } catch (error) {
    const message = String(error?.message || "");
    if (!message.includes("duplicate column") && !message.includes("already exists")) throw error;
  }
}

async function ensureAttendeesTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS attendees (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'captured',
    volunteer INTEGER NOT NULL DEFAULT 0,
    session_lead INTEGER NOT NULL DEFAULT 0,
    access_notes TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'public_rsvp',
    confirmation_sent_at INTEGER,
    reminder_sent_at INTEGER,
    reminder_count INTEGER NOT NULL DEFAULT 0,
    email_error TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  )`).run();

  await tryAlter(db, "ALTER TABLE attendees ADD COLUMN confirmation_sent_at INTEGER");
  await tryAlter(db, "ALTER TABLE attendees ADD COLUMN reminder_sent_at INTEGER");
  await tryAlter(db, "ALTER TABLE attendees ADD COLUMN reminder_count INTEGER NOT NULL DEFAULT 0");
  await tryAlter(db, "ALTER TABLE attendees ADD COLUMN email_error TEXT NOT NULL DEFAULT ''");

  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_attendees_org_email
    ON attendees(org_id, email)`).run();
}

function attendeeShape(row) {
  return row ? {
    id: row.id,
    name: row.name || "",
    email: row.email || "",
    status: row.status || "captured",
    volunteer: !!row.volunteer,
    sessionLead: !!row.session_lead,
    access: row.access_notes || "",
    notes: row.notes || "",
    source: row.source || "public_rsvp",
    confirmationSentAt: Number(row.confirmation_sent_at || 0),
    reminderSentAt: Number(row.reminder_sent_at || 0),
    reminderCount: Number(row.reminder_count || 0),
    emailError: row.email_error || "",
    createdAt: row.created_at || 0,
    updatedAt: row.updated_at || 0,
  } : null;
}

const SELECT_FIELDS = `id, org_id, name, email, status, volunteer, session_lead,
  access_notes, notes, source, confirmation_sent_at, reminder_sent_at,
  reminder_count, email_error, created_at, updated_at`;

export async function onRequestGet({ env, request, params }) {
  const orgId = String(params.orgId || "").trim();
  if (!orgId) return err(400, "MISSING_ORG_ID");

  const auth = await requireOrgRole({ env, request, orgId, minRole: "organizer" });
  if (!auth.ok) return auth.resp;

  const db = getDB(env);
  if (!db) return err(500, "DB_NOT_CONFIGURED");

  await ensureZkSchema(db);
  await ensureAttendeesTable(db);

  const rows = await db.prepare(`SELECT ${SELECT_FIELDS}
     FROM attendees
     WHERE org_id = ?
     ORDER BY updated_at DESC, created_at DESC`)
    .bind(orgId).all();

  return ok({
    attendees: Array.isArray(rows?.results) ? rows.results.map(attendeeShape) : [],
  });
}

export async function onRequestPatch({ env, request, params }) {
  const orgId = String(params.orgId || "").trim();
  if (!orgId) return err(400, "MISSING_ORG_ID");

  const auth = await requireOrgRole({ env, request, orgId, minRole: "organizer" });
  if (!auth.ok) return auth.resp;

  const db = getDB(env);
  if (!db) return err(500, "DB_NOT_CONFIGURED");

  await ensureZkSchema(db);
  await ensureAttendeesTable(db);

  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || "").trim();
  if (!id) return err(400, "MISSING_ATTENDEE_ID");

  const existing = await db.prepare(`SELECT ${SELECT_FIELDS}
    FROM attendees WHERE org_id=? AND id=? LIMIT 1`)
    .bind(orgId, id).first();
  if (!existing?.id) return err(404, "ATTENDEE_NOT_FOUND");

  if (String(body?.action || "") === "send_confirmation") {
    try {
      await sendRsvpConfirmation(env, { email: existing.email, name: existing.name });
      const timestamp = Date.now();
      await db.prepare(`UPDATE attendees
        SET status=CASE WHEN status='captured' THEN 'confirmed' ELSE status END,
            confirmation_sent_at=?, email_error='', updated_at=?
        WHERE org_id=? AND id=?`)
        .bind(timestamp, timestamp, orgId, id).run();

      const row = await db.prepare(`SELECT ${SELECT_FIELDS}
        FROM attendees WHERE org_id=? AND id=? LIMIT 1`)
        .bind(orgId, id).first();

      return ok({ confirmationSent: true, attendee: attendeeShape(row) });
    } catch (error) {
      const message = String(error?.code || error?.message || "EMAIL_SEND_FAILED").slice(0, 300);
      await db.prepare("UPDATE attendees SET email_error=?, updated_at=? WHERE org_id=? AND id=?")
        .bind(message, Date.now(), orgId, id).run();
      console.error("RSVP_CONFIRMATION_EMAIL_FAILED", message);
      return err(502, message);
    }
  }

  if (String(body?.action || "") === "send_reminder") {
    try {
      await sendRsvpReminder(env, { email: existing.email, name: existing.name });
      const timestamp = Date.now();
      await db.prepare(`UPDATE attendees
        SET reminder_sent_at=?, reminder_count=COALESCE(reminder_count,0)+1,
            email_error='', updated_at=?
        WHERE org_id=? AND id=?`)
        .bind(timestamp, timestamp, orgId, id).run();

      const row = await db.prepare(`SELECT ${SELECT_FIELDS}
        FROM attendees WHERE org_id=? AND id=? LIMIT 1`)
        .bind(orgId, id).first();

      return ok({ reminderSent: true, attendee: attendeeShape(row) });
    } catch (error) {
      const message = String(error?.code || error?.message || "EMAIL_SEND_FAILED").slice(0, 300);
      await db.prepare("UPDATE attendees SET email_error=?, updated_at=? WHERE org_id=? AND id=?")
        .bind(message, Date.now(), orgId, id).run();
      console.error("RSVP_REMINDER_EMAIL_FAILED", message);
      return err(502, message);
    }
  }

  const status = String(body?.status || "").trim();
  if (!status) return err(400, "MISSING_STATUS");

  const allowed = new Set(["captured", "confirmed", "form_started", "form_complete", "needs_followup", "reviewed"]);
  if (!allowed.has(status)) return err(400, "INVALID_STATUS");

  const timestamp = Date.now();
  await db.prepare("UPDATE attendees SET status=?, updated_at=? WHERE org_id=? AND id=?")
    .bind(status, timestamp, orgId, id).run();

  const row = await db.prepare(`SELECT ${SELECT_FIELDS}
    FROM attendees WHERE org_id=? AND id=? LIMIT 1`)
    .bind(orgId, id).first();

  return ok({ attendee: attendeeShape(row) });
}
