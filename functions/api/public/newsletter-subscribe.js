import { ok, err } from "../_lib/http.js";
import { getDB } from "../_bf.js";
import { ensureZkSchema } from "../_lib/zk.js";

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}

async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

async function ensureSubscriberTable(db) {
  // The table must exist before ensureZkSchema can add encrypted_blob/key_version.
  await db.prepare(`CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT NULL,
    source TEXT NULL,
    created_at INTEGER NOT NULL
  )`).run();

  await ensureZkSchema(db);

  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscribers_org_email
    ON newsletter_subscribers(org_id, email)`).run();
}

async function resolveDpgOrgId(db, requested) {
  const raw = String(requested || "dpg").trim() || "dpg";
  if (raw !== "dpg") return raw;

  // DPG used the literal "dpg" as a public-site alias before the private
  // workspace switched to the real UUID-backed organization.
  const named = await db.prepare(
    "SELECT id FROM orgs WHERE lower(name) = lower(?) AND id <> 'dpg' ORDER BY created_at ASC LIMIT 1"
  ).bind("Dual Power Gathering").first();
  if (named?.id) return String(named.id);

  const rows = await db.prepare(
    "SELECT id FROM orgs WHERE id <> 'dpg' ORDER BY created_at ASC LIMIT 2"
  ).all();
  const orgs = Array.isArray(rows?.results) ? rows.results : [];
  if (orgs.length === 1 && orgs[0]?.id) return String(orgs[0].id);

  return raw;
}

async function migrateLegacyDpgSubscribers(db, orgId) {
  if (!orgId || orgId === "dpg") return;

  // The subscriber id is the table primary key, so copying a row with the same
  // id and then deleting the source would silently discard it. Move the rows
  // in place instead. First remove only true email duplicates already present
  // in the real org, then retag the remaining legacy rows.
  await db.prepare(`
    DELETE FROM newsletter_subscribers
     WHERE org_id = 'dpg'
       AND lower(email) IN (
         SELECT lower(email)
           FROM newsletter_subscribers
          WHERE org_id = ?
       )
  `).bind(orgId).run();

  await db.prepare(
    "UPDATE newsletter_subscribers SET org_id = ? WHERE org_id = 'dpg'"
  ).bind(orgId).run();
}

export async function onRequestPost({ env, request }) {
  try {
    const db = getDB(env);
    if (!db) return err(500, "DB_NOT_CONFIGURED");

    await ensureSubscriberTable(db);

    const body = await readJson(request);
    const orgId = await resolveDpgOrgId(db, body?.orgId);
    const email = normalizeEmail(body?.email);
    const name = String(body?.name || "").trim();
    const source = String(body?.source || "public_home").trim() || "public_home";

    if (!validEmail(email)) return err(400, "INVALID_EMAIL");

    await migrateLegacyDpgSubscribers(db, orgId);

    const existing = await db.prepare(
      "SELECT id FROM newsletter_subscribers WHERE org_id = ? AND email = ? LIMIT 1"
    ).bind(orgId, email).first();

    if (existing?.id) {
      return ok({ subscribed: true, alreadyExists: true });
    }

    const id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${orgId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    await db.prepare(`
      INSERT INTO newsletter_subscribers (id, org_id, email, name, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, orgId, email, name || null, source, Date.now()).run();

    return ok({ subscribed: true, alreadyExists: false });
  } catch (error) {
    console.error("NEWSLETTER_SUBSCRIBE_FAILED", error);
    return err(500, "NEWSLETTER_SUBSCRIBE_FAILED");
  }
}
