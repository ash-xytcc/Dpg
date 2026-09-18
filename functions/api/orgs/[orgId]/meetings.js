import { json, bad, now, uuid } from "../../_lib/http.js";
import { requireOrgRole } from "../../_lib/auth.js";
import { logActivity } from "../../_lib/activity.js";
import { ensureLocalCompatSchema } from "../../_lib/localCompat.js";

async function ensureMeetingsZkColumns() {
  return;
}

async function getOrgCryptoKeyVersion(db, orgId) {
  try {
    const r = await db.prepare("SELECT key_version FROM org_crypto WHERE org_id = ?").bind(orgId).first();
    return Number(r?.key_version) || 1;
  } catch (e) {
    const msg = String(e?.message || "");
    if (!msg.includes("no such column: key_version")) return 1;
    try {
      const r = await db.prepare("SELECT version AS key_version FROM org_crypto WHERE org_id = ?").bind(orgId).first();
      return Number(r?.key_version) || 1;
    } catch {
      return 1;
    }
  }
}

async function ensureMeetingsPublicColumn(db) {
  try {
    await db
      .prepare("ALTER TABLE meetings ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0")
      .run();
  } catch {
    // ignore (already exists)
  }
}

async function ensureMeetingsCompat(db) {
  await safeRun(db, `CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    starts_at INTEGER,
    ends_at INTEGER,
    location TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  )`);
  const alters = [
    "ALTER TABLE meetings ADD COLUMN agenda TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE meetings ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE meetings ADD COLUMN encrypted_notes TEXT",
    "ALTER TABLE meetings ADD COLUMN encrypted_blob TEXT",
    "ALTER TABLE meetings ADD COLUMN key_version INTEGER",
  ];
  for (const sql of alters) await safeRun(db, sql);
}

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!a.ok) return a.resp;

  await ensureLocalCompatSchema(env.BF_DB);
  await ensureLocalCompatSchema(env.BF_DB);
  await ensureLocalCompatSchema(env.BF_DB);
  await ensureMeetingsPublicColumn(env.BF_DB);
	await ensureMeetingsZkColumns(env.BF_DB);

  const res = await env.BF_DB.prepare(
    `SELECT id, title, starts_at, ends_at, location, agenda, notes, is_public, encrypted_notes, encrypted_blob, key_version, created_at, updated_at
     FROM meetings
     WHERE org_id = ?
     ORDER BY starts_at DESC, created_at DESC`
  )
    .bind(orgId)
    .all();

  return json({ ok: true, meetings: res.results || [] });
}

export async function onRequestPost({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!a.ok) return a.resp;

  const body = await request.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  if (!title) return bad(400, "MISSING_TITLE");

  const id = uuid();
  const t = now();
  const startsAt = Number.isFinite(Number(body.starts_at)) ? Number(body.starts_at) : t;
  const endsAt = Number.isFinite(Number(body.ends_at)) ? Number(body.ends_at) : startsAt;

  await ensureMeetingsCompat(env.BF_DB);

  let keyVersion = null;
  if (body.encrypted_blob) keyVersion = await getOrgCryptoKeyVersion(env.BF_DB, orgId);

  await env.BF_DB.prepare(
    `INSERT INTO meetings (
      id, org_id, title, starts_at, ends_at, location, agenda, notes, is_public, encrypted_notes, encrypted_blob, key_version, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      id,
      orgId,
      title,
      startsAt,
      endsAt,
      String(body.location || ""),
      String(body.agenda || ""),
      String(body.notes || ""),
      body.is_public ? 1 : 0,
      body.encrypted_notes ?? null,
      body.encrypted_blob ?? null,
      keyVersion,
      t,
      t
    )
    .run();

  try {
    await logActivity(env, {
      orgId,
      kind: "meeting.create",
      message: `Created meeting ${title}`,
      actorUserId: a.user?.sub || null,
    });
  } catch {}

  return json({ ok: true, id });
}
