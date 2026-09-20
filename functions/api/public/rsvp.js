import { ok, err } from "../_lib/http.js";
import { getDB } from "../_bf.js";
import { ensureZkSchema } from "../_lib/zk.js";
import { rateLimit } from "../_lib/rateLimit.js";
import { sendRsvpConfirmation } from "../_lib/email.js";

function clean(v, max = 2000) {
  return String(v || "").trim().slice(0, max);
}

function normalizeEmail(v) {
  return clean(v, 320).toLowerCase();
}

function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}

async function readJson(request) {
  const text = await request.text().catch(() => "");
  if (text.length > 32 * 1024) throw new Error("RSVP_TOO_LARGE");
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
}

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

async function resolveDpgOrgId(db, env) {
  // Prefer the real workspace UUID. The public site historically used the
  // literal "dpg" alias, which must not become a second attendee silo.
  try {
    const mapped = await env?.BF_PUBLIC?.get?.("slug:dpg");
    if (mapped && String(mapped) !== "dpg") {
      const row = await db.prepare("SELECT id FROM orgs WHERE id = ? LIMIT 1").bind(String(mapped)).first();
      if (row?.id) return String(row.id);
    }
  } catch {}

  const named = await db.prepare(
    "SELECT id FROM orgs WHERE id <> 'dpg' AND lower(name) LIKE '%dual power%' ORDER BY created_at ASC LIMIT 2"
  ).all();
  const namedRows = Array.isArray(named?.results) ? named.results : [];
  if (namedRows.length === 1 && namedRows[0]?.id) return String(namedRows[0].id);

  const all = await db.prepare("SELECT id FROM orgs WHERE id <> 'dpg' ORDER BY created_at ASC LIMIT 2").all();
  const rows = Array.isArray(all?.results) ? all.results : [];
  if (rows.length === 1 && rows[0]?.id) return String(rows[0].id);

  const legacy = await db.prepare("SELECT id FROM orgs WHERE id = 'dpg' LIMIT 1").first();
  return legacy?.id ? String(legacy.id) : "";
}

async function migrateLegacyDpgAttendees(db, orgId) {
  if (!orgId || orgId === "dpg") return;

  // Keep the target record if the same email already exists there, then move
  // any remaining historical public-RSVP rows into the real DPG workspace.
  await db.prepare(`
    DELETE FROM attendees
     WHERE org_id = 'dpg'
       AND lower(email) IN (
         SELECT lower(email) FROM attendees WHERE org_id = ?
       )
  `).bind(orgId).run();

  await db.prepare(
    "UPDATE attendees SET org_id = ? WHERE org_id = 'dpg'"
  ).bind(orgId).run();
}

async function sendConfirmationAndRecord({ env, db, orgId, attendeeId, email, name }) {
  try {
    const result = await sendRsvpConfirmation(env, { email, name });
    const sentAt = Date.now();
    await db.prepare(`UPDATE attendees
      SET status=CASE WHEN status='captured' THEN 'confirmed' ELSE status END,
          confirmation_sent_at=?, email_error='', updated_at=?
      WHERE org_id=? AND id=?`)
      .bind(sentAt, sentAt, orgId, attendeeId).run();
    return { sent: true, sentAt, providerId: result?.id || "" };
  } catch (error) {
    const message = clean(error?.code || error?.message || "EMAIL_SEND_FAILED", 300);
    await db.prepare(`UPDATE attendees SET email_error=?, updated_at=? WHERE org_id=? AND id=?`)
      .bind(message, Date.now(), orgId, attendeeId).run();
    console.error("RSVP_CONFIRMATION_EMAIL_FAILED", message);
    return { sent: false, error: message };
  }
}

export async function onRequestPost({ env, request }) {
  const db = getDB(env);
  if (!db) return err(500, "DB_NOT_CONFIGURED");

  await ensureZkSchema(db);
  await ensureAttendeesTable(db);

  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return err(413, error?.message || "RSVP_TOO_LARGE");
  }

  const orgId = await resolveDpgOrgId(db, env);
  if (!orgId) return err(404, "RSVP_ORG_NOT_FOUND");
  await migrateLegacyDpgAttendees(db, orgId);

  const name = clean(body?.name, 160);
  const email = normalizeEmail(body?.email);
  const accessNotes = clean(body?.accessNotes, 2000);
  const notes = clean(body?.notes, 4000);
  const volunteer = body?.volunteer ? 1 : 0;
  const sessionLead = body?.sessionLead ? 1 : 0;
  const source = clean(body?.source || "public_rsvp", 80) || "public_rsvp";

  if (!name) return err(400, "NAME_REQUIRED");
  if (!validEmail(email)) return err(400, "INVALID_EMAIL");

  const ip = clean(request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown", 120);
  const [ipLimit, emailLimit] = await Promise.all([
    rateLimit({ env, key: `public-rsvp-ip:${ip}`, limit: 20, windowSec: 60 * 60 }),
    rateLimit({ env, key: `public-rsvp:${ip}:${email}`, limit: 4, windowSec: 60 * 60 }),
  ]);
  if (!ipLimit.ok || !emailLimit.ok) {
    return err(429, "RATE_LIMIT", {
      retry_after: Math.max(ipLimit.retry_after || 0, emailLimit.retry_after || 0),
    });
  }

  const timestamp = Date.now();
  const existing = await db
    .prepare("SELECT id, confirmation_sent_at FROM attendees WHERE org_id = ? AND email = ? LIMIT 1")
    .bind(orgId, email)
    .first();

  if (existing?.id) {
    await db.prepare(`UPDATE attendees
      SET name=?, volunteer=?, session_lead=?, access_notes=?, notes=?, source=?, updated_at=?
      WHERE org_id=? AND id=?`)
      .bind(name, volunteer, sessionLead, accessNotes, notes, source, timestamp, orgId, existing.id)
      .run();

    const emailResult = existing.confirmation_sent_at
      ? { sent: true, sentAt: Number(existing.confirmation_sent_at), alreadySent: true }
      : await sendConfirmationAndRecord({ env, db, orgId, attendeeId: existing.id, email, name });

    return ok({
      submitted: true,
      alreadyExists: true,
      attendeeId: existing.id,
      emailSent: !!emailResult.sent,
      confirmationAlreadySent: !!emailResult.alreadySent,
      emailError: emailResult.sent ? "" : emailResult.error,
    });
  }

  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO attendees (
    id, org_id, name, email, status, volunteer, session_lead, access_notes, notes, source,
    confirmation_sent_at, reminder_sent_at, reminder_count, email_error, created_at, updated_at
  ) VALUES (?, ?, ?, ?, 'captured', ?, ?, ?, ?, ?, NULL, NULL, 0, '', ?, ?)`)
    .bind(id, orgId, name, email, volunteer, sessionLead, accessNotes, notes, source, timestamp, timestamp)
    .run();

  const emailResult = await sendConfirmationAndRecord({ env, db, orgId, attendeeId: id, email, name });
  return ok({
    submitted: true,
    alreadyExists: false,
    attendeeId: id,
    emailSent: !!emailResult.sent,
    emailError: emailResult.sent ? "" : emailResult.error,
  });
}
