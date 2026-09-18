import { ok, err } from "../_lib/http.js";
import { getDB } from "../_bf.js";
import { ensureZkSchema } from "../_lib/zk.js";

function clean(v) {
  return String(v || "").trim();
}

function normalizeEmail(v) {
  return clean(v).toLowerCase();
}

function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
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
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  )`).run();

  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_attendees_org_email
    ON attendees(org_id, email)`).run();
}

export async function onRequestPost({ env, request }) {
  const db = getDB(env);
  if (!db) return err(500, "DB_NOT_CONFIGURED");

  await ensureZkSchema(db);
  await ensureAttendeesTable(db);

  const body = await readJson(request);
  const orgId = clean(body?.orgId || "dpg") || "dpg";
  const name = clean(body?.name);
  const email = normalizeEmail(body?.email);
  const accessNotes = clean(body?.accessNotes);
  const notes = clean(body?.notes);
  const volunteer = body?.volunteer ? 1 : 0;
  const sessionLead = body?.sessionLead ? 1 : 0;
  const source = clean(body?.source || "public_rsvp") || "public_rsvp";

  if (!name) return err(400, "NAME_REQUIRED");
  if (!validEmail(email)) return err(400, "INVALID_EMAIL");

  const now = Date.now();

  const existing = await db
    .prepare(`SELECT id, status FROM attendees WHERE org_id = ? AND email = ? LIMIT 1`)
    .bind(orgId, email)
    .first();

  if (existing?.id) {
    await db
      .prepare(`UPDATE attendees
        SET name = ?, volunteer = ?, session_lead = ?, access_notes = ?, notes = ?, status = 'captured', updated_at = ?
        WHERE id = ?`)
      .bind(name, volunteer, sessionLead, accessNotes, notes, now, existing.id)
      .run();

    return ok({ submitted: true, alreadyExists: true, attendeeId: existing.id });
  }

  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${orgId}_${now}_${Math.random().toString(36).slice(2, 10)}`;

  await db
    .prepare(`INSERT INTO attendees (
      id, org_id, name, email, status, volunteer, session_lead, access_notes, notes, source, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'captured', ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, orgId, name, email, volunteer, sessionLead, accessNotes, notes, source, now, now)
    .run();

  return ok({ submitted: true, alreadyExists: false, attendeeId: id });
}
