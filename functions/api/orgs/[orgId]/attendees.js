import { ok, err } from "../../_lib/http.js";
import { requireOrgRole } from "../../_lib/auth.js";
import { getDB } from "../../_bf.js";
import { ensureZkSchema } from "../../_lib/zk.js";

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

export async function onRequestGet({ env, request, params }) {
  const orgId = String(params.orgId || "").trim();
  if (!orgId) return err(400, "MISSING_ORG_ID");

  const auth = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!auth.ok) return auth.resp;

  const db = getDB(env);
  if (!db) return err(500, "DB_NOT_CONFIGURED");

  await ensureZkSchema(db);
  await ensureAttendeesTable(db);

  const rows = await db
    .prepare(`SELECT
      id,
      org_id,
      name,
      email,
      status,
      volunteer,
      session_lead,
      access_notes,
      notes,
      source,
      created_at,
      updated_at
     FROM attendees
     WHERE org_id = ?
     ORDER BY updated_at DESC, created_at DESC`)
    .bind(orgId)
    .all();

  return ok({
    attendees: Array.isArray(rows?.results) ? rows.results.map((row) => ({
      id: row.id,
      name: row.name || "",
      email: row.email || "",
      status: row.status || "captured",
      volunteer: !!row.volunteer,
      sessionLead: !!row.session_lead,
      access: row.access_notes || "",
      notes: row.notes || "",
      source: row.source || "public_rsvp",
      createdAt: row.created_at || 0,
      updatedAt: row.updated_at || 0,
    })) : [],
  });
}

export async function onRequestPatch({ env, request, params }) {
  const orgId = String(params.orgId || "").trim();
  if (!orgId) return err(400, "MISSING_ORG_ID");

  const auth = await requireOrgRole({ env, request, orgId, minRole: "editor" });
  if (!auth.ok) return auth.resp;

  const db = getDB(env);
  if (!db) return err(500, "DB_NOT_CONFIGURED");

  await ensureZkSchema(db);
  await ensureAttendeesTable(db);

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const id = String(body?.id || "").trim();
  const status = String(body?.status || "").trim();

  if (!id) return err(400, "MISSING_ATTENDEE_ID");
  if (!status) return err(400, "MISSING_STATUS");

  const allowed = new Set(["captured", "confirmed", "form_started", "form_complete", "needs_followup", "reviewed"]);
  if (!allowed.has(status)) return err(400, "INVALID_STATUS");

  const existing = await db
    .prepare(`SELECT id FROM attendees WHERE org_id = ? AND id = ? LIMIT 1`)
    .bind(orgId, id)
    .first();

  if (!existing?.id) return err(404, "ATTENDEE_NOT_FOUND");

  const now = Date.now();

  await db
    .prepare(`UPDATE attendees SET status = ?, updated_at = ? WHERE org_id = ? AND id = ?`)
    .bind(status, now, orgId, id)
    .run();

  const row = await db
    .prepare(`SELECT
      id,
      org_id,
      name,
      email,
      status,
      volunteer,
      session_lead,
      access_notes,
      notes,
      source,
      created_at,
      updated_at
     FROM attendees
     WHERE org_id = ? AND id = ? LIMIT 1`)
    .bind(orgId, id)
    .first();

  return ok({
    attendee: row ? {
      id: row.id,
      name: row.name || "",
      email: row.email || "",
      status: row.status || "captured",
      volunteer: !!row.volunteer,
      sessionLead: !!row.session_lead,
      access: row.access_notes || "",
      notes: row.notes || "",
      source: row.source || "public_rsvp",
      createdAt: row.created_at || 0,
      updatedAt: row.updated_at || 0,
    } : null,
  });
}

