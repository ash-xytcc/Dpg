import { ok, err } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";
import { getDB } from "../../../_bf.js";

async function ensureTables(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT NULL,
    source TEXT NULL,
    created_at INTEGER NOT NULL
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS newsletter_settings (
    org_id TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 0,
    list_address TEXT,
    blurb TEXT,
    mailing_address TEXT,
    updated_at INTEGER NOT NULL DEFAULT 0
  )`).run();

  try {
    await db.prepare("ALTER TABLE newsletter_settings ADD COLUMN mailing_address TEXT").run();
  } catch (error) {
    const message = String(error?.message || "");
    if (!message.includes("duplicate column") && !message.includes("already exists")) throw error;
  }
}

export async function onRequestGet({ env, request, params }) {
  try {
    const orgId = String(params?.orgId || "").trim();
    if (!orgId) return err(400, "BAD_ORG_ID");

    const auth = await requireOrgRole({ env, request, orgId, minRole: "admin" });
    if (!auth.ok) return auth.resp;

    const db = getDB(env);
    if (!db) return err(500, "DB_NOT_CONFIGURED");
    await ensureTables(db);

    const [settings, count] = await Promise.all([
      db.prepare(
        "SELECT enabled, list_address, mailing_address FROM newsletter_settings WHERE org_id=? LIMIT 1"
      ).bind(orgId).first(),
      db.prepare(
        "SELECT COUNT(*) AS count FROM newsletter_subscribers WHERE org_id=?"
      ).bind(orgId).first(),
    ]);

    const from = String(env?.NEWSLETTER_FROM || env?.RESEND_FROM || "Dual Power West <hello@dualpowerwest.org>").trim();

    return ok({
      resendConfigured: !!String(env?.RESEND_API_KEY || "").trim(),
      from,
      replyTo: String(settings?.list_address || "").trim(),
      mailingAddressConfigured: !!String(settings?.mailing_address || "").trim(),
      subscriberCount: Number(count?.count || 0),
    });
  } catch (error) {
    console.error("NEWSLETTER_STATUS_FAILED", error);
    return err(500, "NEWSLETTER_STATUS_FAILED");
  }
}
