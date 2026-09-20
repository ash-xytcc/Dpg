import { ok, err } from "../_lib/http.js";
import { getDB } from "../_bf.js";
import { ensureZkSchema } from "../_lib/zk.js";
import { rateLimit } from "../_lib/rateLimit.js";

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

async function resolveOrgId(db, env, requested) {
  const raw = clean(requested, 160);

  if (raw && raw !== "dpg") {
    const exact = await db.prepare("SELECT id FROM orgs WHERE id = ? LIMIT 1").bind(raw).first();
    if (exact?.id) return String(exact.id);
  }

  // Older public DPG pages used the literal id "dpg". Preserve it only if it
  // actually exists; otherwise resolve the single real DPG organization.
  const legacy = await db.prepare("SELECT id FROM orgs WHERE id = 'dpg' LIMIT 1").first();
  if (legacy?.id) return String(legacy.id);

  try {
    const mapped = await env?.BF_PUBLIC?.get?.("slug:dpg");
    if (mapped) {
      const row = await db.prepare("SELECT id FROM orgs WHERE id = ? LIMIT 1").bind(String(mapped)).first();
      if (row?.id) return String(row.id);
    }
  } catch {}

  const named = await db.prepare(
    "SELECT id FROM orgs WHERE lower(name) LIKE '%dual power%' ORDER BY created_at ASC LIMIT 2"
  ).all();
  const namedRows = Array.isArray(named?.results) ? named.results : [];
  if (namedRows.length === 1 && namedRows[0]?.id) return String(namedRows[0].id);

  const all = await db.prepare("SELECT id FROM orgs ORDER BY created_at ASC LIMIT 2").all();
  const rows = Array.isArray(all?.results) ? all.results : [];
  return rows.length === 1 && rows[0]?.id ? String(rows[0].id) : "";
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

  const orgId = await resolveOrgId(db, env, body?.orgId || "dpg");
  if (!orgId) return err(404, "RSVP_ORG_NOT_FOUND");

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
  const rl = await rateLimit({
    env,
    key: `public-rsvp:${ip}:${email}`,
    limit: 8,
    windowSec: 60 * 60,
  });
  if (!rl.ok) return err(429, "RATE_LIMIT", { retry_after: rl.retry_after });

  const timestamp = Date.now();
  const existing = await db
    .prepare("SELECT id FROM attendees WHERE org_id = ? AND email = ? LIMIT 1")
    .bind(orgId, email)
    .first();

  if (existing?.id) {
    await db.prepare(`UPDATE attendees
      SET name = ?, volunteer = ?, session_lead = ?, access_notes = ?, notes = ?,
          status = 'captured', source = ?, updated_at = ?
      WHERE org_id = ? AND id = ?`)
      .bind(name, volunteer, sessionLead, accessNotes, notes, source, timestamp, orgId, existing.id)
      .run();

    return ok({ submitted: true, alreadyExists: true, attendeeId: existing.id });
  }

  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO attendees (
    id, org_id, name, email, status, volunteer, session_lead, access_notes, notes, source, created_at, updated_at
  ) VALUES (?, ?, ?, ?, 'captured', ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, orgId, name, email, volunteer, sessionLead, accessNotes, notes, source, timestamp, timestamp)
    .run();

  return ok({ submitted: true, alreadyExists: false, attendeeId: id });
}
