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
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function onRequestPost({ env, request }) {
  const db = getDB(env);
  if (!db) return err(500, "DB_NOT_CONFIGURED");

  await ensureZkSchema(db);

  await db
    .prepare(`CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT NULL,
      source TEXT NULL,
      created_at INTEGER NOT NULL
    )`)
    .run();

  await db
    .prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscribers_org_email
      ON newsletter_subscribers(org_id, email)`)
    .run();

  const body = await readJson(request);
  const orgId = String(body?.orgId || "dpg").trim() || "dpg";
  const email = normalizeEmail(body?.email);
  const name = String(body?.name || "").trim();
  const source = String(body?.source || "public_home").trim() || "public_home";

  if (!validEmail(email)) return err(400, "INVALID_EMAIL");

  const existing = await db
    .prepare(`SELECT id FROM newsletter_subscribers WHERE org_id = ? AND email = ? LIMIT 1`)
    .bind(orgId, email)
    .first();

  if (existing?.id) {
    return ok({ subscribed: true, alreadyExists: true });
  }

  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${orgId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  await db
    .prepare(
      `INSERT INTO newsletter_subscribers (id, org_id, email, name, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, orgId, email, name || null, source, Date.now())
    .run();

  return ok({ subscribed: true, alreadyExists: false });
}
