import { json, bad, now, uuid } from "../../_lib/http.js";
import { requireOrgRole } from "../../_lib/auth.js";
import { logActivity } from "../../_lib/activity.js";
import { ensureLocalCompatSchema } from "../../_lib/localCompat.js";
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

async function ensureInventoryParsTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS inventory_pars (
      org_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      par INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      PRIMARY KEY (org_id, item_id)
    )
  `).run()
}

async function ensureInventoryCompat(db) {
  await safeRun(db, `CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    qty REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  )`);
  await safeRun(db, `CREATE TABLE IF NOT EXISTS inventory_pars (
    org_id TEXT NOT NULL,
    inventory_id TEXT NOT NULL,
    par REAL,
    updated_at INTEGER,
    PRIMARY KEY (org_id, inventory_id)
  )`);
  const alters = [
    "ALTER TABLE inventory ADD COLUMN qty REAL NOT NULL DEFAULT 0",
    "ALTER TABLE inventory ADD COLUMN unit TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE inventory ADD COLUMN category TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE inventory ADD COLUMN location TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE inventory ADD COLUMN notes TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE inventory ADD COLUMN encrypted_notes TEXT",
    "ALTER TABLE inventory ADD COLUMN encrypted_blob TEXT",
    "ALTER TABLE inventory ADD COLUMN key_version INTEGER",
    "ALTER TABLE inventory ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0",
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
  await ensureInventoryParsTable(env.BF_DB);
  const res = await env.BF_DB.prepare(
    `SELECT i.id, i.name, i.qty, i.unit, i.category, i.location, i.notes,
            i.encrypted_notes, i.encrypted_blob, i.key_version,
            i.is_public, i.created_at, i.updated_at,
            ip.par
     FROM inventory i
     LEFT JOIN inventory_pars ip
       ON ip.org_id = i.org_id AND ip.inventory_id = i.id
     WHERE i.org_id = ?
     ORDER BY i.created_at DESC`
  )
    .bind(orgId)
    .all();

  return json({ ok: true, inventory: res.results || [] });
}

export async function onRequestPost({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!a.ok) return a.resp;

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return bad(400, "MISSING_NAME");

  await ensureInventoryCompat(env.BF_DB);

  const id = uuid();
  const t = now();
  const qty = Number.isFinite(Number(body.qty)) ? Number(body.qty) : 0;
  const keyVersion = body.encrypted_blob ? await getOrgCryptoKeyVersion(env.BF_DB, orgId) : null;

  await env.BF_DB.prepare(
    `INSERT INTO inventory (
        id, org_id, name, qty, unit, category, location, notes,
        encrypted_notes, encrypted_blob, key_version,
        is_public, created_at, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      id,
      orgId,
      name,
      qty,
      String(body.unit || ""),
      String(body.category || ""),
      String(body.location || ""),
      String(body.notes || ""),
      body.encrypted_notes ?? null,
      body.encrypted_blob ?? null,
      keyVersion,
      body.is_public ? 1 : 0,
      t,
      t
    )
    .run();

  const par = body.par === undefined || body.par === null || body.par === "" ? null : Number(body.par);
  if (Number.isFinite(par) && par > 0) {
    await env.BF_DB.prepare(
      `INSERT INTO inventory_pars (org_id, inventory_id, par, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(org_id, inventory_id) DO UPDATE SET par = excluded.par, updated_at = excluded.updated_at`
    ).bind(orgId, id, par, t).run();
  }

  try {
    await logActivity(env, {
      orgId,
      kind: "inventory.create",
      message: `Created inventory item ${name}`,
      actorUserId: a.user?.sub || null,
    });
  } catch {}

  return json({ ok: true, id });
}
