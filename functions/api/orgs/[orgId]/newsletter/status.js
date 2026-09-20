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

  try {
    await db.prepare("ALTER TABLE newsletter_subscribers ADD COLUMN confirmed_at INTEGER").run();
  } catch (error) {
    const message = String(error?.message || "");
    if (!message.includes("duplicate column") && !message.includes("already exists")) throw error;
  }
  try {
    await db.prepare("ALTER TABLE newsletter_subscribers ADD COLUMN confirmation_error TEXT NOT NULL DEFAULT ''").run();
  } catch (error) {
    const message = String(error?.message || "");
    if (!message.includes("duplicate column") && !message.includes("already exists")) throw error;
  }

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

    const [settings, confirmedCount, pendingCount, lastPendingError] = await Promise.all([
      db.prepare(
        "SELECT enabled, list_address, mailing_address FROM newsletter_settings WHERE org_id=? LIMIT 1"
      ).bind(orgId).first(),
      db.prepare(
        "SELECT COUNT(*) AS count FROM newsletter_subscribers WHERE org_id=? AND confirmed_at IS NOT NULL"
      ).bind(orgId).first(),
      db.prepare(
        "SELECT COUNT(*) AS count FROM newsletter_subscribers WHERE org_id=? AND confirmed_at IS NULL"
      ).bind(orgId).first(),
      db.prepare(
        "SELECT confirmation_error FROM newsletter_subscribers WHERE org_id=? AND confirmed_at IS NULL AND confirmation_error <> '' ORDER BY created_at DESC LIMIT 1"
      ).bind(orgId).first(),
    ]);

    const from = String(env?.NEWSLETTER_FROM || env?.RESEND_FROM || "Dual Power West <hello@dualpowerwest.org>").trim();

    return ok({
      resendConfigured: !!String(env?.RESEND_API_KEY || "").trim(),
      from,
      replyTo: String(settings?.list_address || "").trim(),
      mailingAddressConfigured: !!String(settings?.mailing_address || "").trim(),
      subscriberCount: Number(confirmedCount?.count || 0),
      pendingCount: Number(pendingCount?.count || 0),
      lastConfirmationError: String(lastPendingError?.confirmation_error || ""),
    });
  } catch (error) {
    console.error("NEWSLETTER_STATUS_FAILED", error);
    return err(500, "NEWSLETTER_STATUS_FAILED");
  }
}
