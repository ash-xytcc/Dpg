import { ok, err } from "../../_lib/http.js";
import { requireOrgRole, getUserIdFromRequest } from "../../_lib/auth.js";
import { getDB } from "../../_bf.js";

async function ensureNewsletterSettingsTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS newsletter_settings (
      org_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      list_address TEXT,
      blurb TEXT,
      mailing_address TEXT,
      updated_at INTEGER NOT NULL DEFAULT 0
    )
  `).run();
  try {
    await db.prepare("ALTER TABLE newsletter_settings ADD COLUMN mailing_address TEXT").run();
  } catch (error) {
    const message = String(error?.message || "");
    if (!message.includes("duplicate column") && !message.includes("already exists")) throw error;
  }
}

async function migrateLegacyDpgSettings(db, orgId) {
  if (!orgId || orgId === "dpg") return;
  await db.prepare(`
    INSERT OR IGNORE INTO newsletter_settings
      (org_id, enabled, list_address, blurb, updated_at)
    SELECT ?, enabled, list_address, blurb, updated_at
      FROM newsletter_settings
     WHERE org_id = 'dpg'
     LIMIT 1
  `).bind(orgId).run();
}

export async function onRequest(ctx) {
  try {
    const { params, env, request } = ctx;
    const db = getDB(env);
    if (!db) return err(500, "DB_NOT_CONFIGURED");

    const orgId = String(params?.orgId || "").trim();
    if (!orgId) return err(400, "BAD_ORG_ID");

    await ensureNewsletterSettingsTable(db);
    const method = (request.method || "GET").toUpperCase();

    if (method === "GET") {
      const auth = await requireOrgRole({ env, request, orgId, minRole: "participant" });
      if (!auth.ok) return auth.resp;

      await migrateLegacyDpgSettings(db, orgId);

      const row = await db.prepare(
        "SELECT enabled, list_address, blurb, mailing_address FROM newsletter_settings WHERE org_id=? LIMIT 1"
      ).bind(orgId).first();

      return ok({
        newsletter: {
          enabled: !!(row?.enabled ?? 0),
          list_address: row?.list_address || "",
          blurb: row?.blurb || "",
          mailing_address: row?.mailing_address || "",
        },
      });
    }

    if (method === "PUT") {
      const auth = await requireOrgRole({ env, request, orgId, minRole: "admin" });
      if (!auth.ok) return auth.resp;

      const body = await request.json().catch(() => ({}));
      const enabled = body.enabled !== false;
      const listAddress = String(body.list_address || "").trim();
      const blurb = String(body.blurb || "").trim();
      const mailingAddress = String(body.mailing_address || "").trim();
      const updatedAt = Date.now();
      const updatedBy = await getUserIdFromRequest(request, env);

      await db.prepare(`
        INSERT INTO newsletter_settings (org_id, enabled, list_address, blurb, mailing_address, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(org_id) DO UPDATE SET
          enabled=excluded.enabled,
          list_address=excluded.list_address,
          blurb=excluded.blurb,
          mailing_address=excluded.mailing_address,
          updated_at=excluded.updated_at
      `).bind(orgId, enabled ? 1 : 0, listAddress, blurb, mailingAddress, updatedAt).run();

      return ok({
        newsletter: { enabled, list_address: listAddress, blurb, mailing_address: mailingAddress },
        updated_by: updatedBy || "",
      });
    }

    return err(405, "METHOD_NOT_ALLOWED");
  } catch (error) {
    console.error("NEWSLETTER_SETTINGS_FAILED", error);
    return err(500, "NEWSLETTER_SETTINGS_FAILED");
  }
}
