import { ok, err } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";
import { getDB } from "../../../_bf.js";
import { sendNewsletterBatch } from "../../../_lib/email.js";

function clean(value, max) {
  return String(value || "").trim().slice(0, max);
}

function htmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function tryAlter(db, sql) {
  try { await db.prepare(sql).run(); }
  catch (error) {
    const message = String(error?.message || "");
    if (!message.includes("duplicate column") && !message.includes("already exists")) throw error;
  }
}

async function ensureNewsletterTables(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT NULL,
    source TEXT NULL,
    created_at INTEGER NOT NULL
  )`).run();
  await tryAlter(db, "ALTER TABLE newsletter_subscribers ADD COLUMN unsubscribe_token TEXT");
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscribers_org_email
    ON newsletter_subscribers(org_id, email)`).run();
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscribers_unsubscribe
    ON newsletter_subscribers(unsubscribe_token) WHERE unsubscribe_token IS NOT NULL`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS newsletter_settings (
    org_id TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 0,
    list_address TEXT,
    blurb TEXT,
    mailing_address TEXT,
    updated_at INTEGER NOT NULL DEFAULT 0
  )`).run();
  await tryAlter(db, "ALTER TABLE newsletter_settings ADD COLUMN mailing_address TEXT");
}

function unsubscribeUrl(request, token) {
  const url = new URL("/api/public/newsletter-unsubscribe", request.url);
  url.searchParams.set("token", token);
  return url.toString();
}

function messageHtml(body, mailingAddress, unsubscribe) {
  const main = htmlEscape(body).replace(/\r?\n/g, "<br>");
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#171717;max-width:680px;margin:auto">
    <div>${main}</div>
    <hr style="margin:32px 0 18px;border:0;border-top:1px solid #ddd">
    <div style="font-size:12px;color:#666">
      <p>You are receiving this because you signed up for Dual Power West updates at dualpowerwest.org.</p>
      <p>Dual Power West · ${htmlEscape(mailingAddress)}</p>
      <p><a href="${htmlEscape(unsubscribe)}">Unsubscribe from these emails</a></p>
    </div>
  </div>`;
}

function messageText(body, mailingAddress, unsubscribe) {
  return [
    body,
    "",
    "---",
    "You are receiving this because you signed up for Dual Power West updates at dualpowerwest.org.",
    `Dual Power West · ${mailingAddress}`,
    `Unsubscribe: ${unsubscribe}`,
  ].join("\n");
}

export async function onRequestPost({ env, request, params }) {
  try {
    const orgId = clean(params?.orgId, 200);
    if (!orgId) return err(400, "BAD_ORG_ID");

    const gate = await requireOrgRole({ env, request, orgId, minRole: "admin" });
    if (!gate.ok) return gate.resp;

    if (!String(env?.RESEND_API_KEY || "").trim()) return err(503, "RESEND_NOT_CONFIGURED");

    const db = getDB(env);
    if (!db) return err(500, "DB_NOT_CONFIGURED");
    await ensureNewsletterTables(db);

    const body = await request.json().catch(() => ({}));
    const subject = clean(body?.subject, 200);
    const text = clean(body?.body, 50000);
    const campaignId = clean(body?.campaignId, 120) || crypto.randomUUID();

    if (!subject) return err(400, "NEWSLETTER_SUBJECT_REQUIRED");
    if (!text) return err(400, "NEWSLETTER_BODY_REQUIRED");

    const settings = await db.prepare(
      "SELECT mailing_address, list_address FROM newsletter_settings WHERE org_id=? LIMIT 1"
    ).bind(orgId).first();
    const mailingAddress = clean(settings?.mailing_address, 500);
    const replyTo = clean(settings?.list_address, 320);
    if (!mailingAddress) return err(400, "NEWSLETTER_MAILING_ADDRESS_REQUIRED");

    const result = await db.prepare(`
      SELECT id, email, name, unsubscribe_token
        FROM newsletter_subscribers
       WHERE org_id=?
       ORDER BY created_at ASC
       LIMIT 5000
    `).bind(orgId).all();
    const subscribers = Array.isArray(result?.results) ? result.results : [];
    if (!subscribers.length) return err(400, "NO_NEWSLETTER_SUBSCRIBERS");

    const updates = [];
    for (const subscriber of subscribers) {
      if (!subscriber.unsubscribe_token) {
        subscriber.unsubscribe_token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
        updates.push(
          db.prepare("UPDATE newsletter_subscribers SET unsubscribe_token=? WHERE org_id=? AND id=?")
            .bind(subscriber.unsubscribe_token, orgId, subscriber.id)
        );
      }
    }
    if (updates.length) await db.batch(updates);

    let sent = 0;
    const providerIds = [];
    for (let offset = 0, batchIndex = 0; offset < subscribers.length; offset += 100, batchIndex += 1) {
      const chunk = subscribers.slice(offset, offset + 100);
      const messages = chunk.map((subscriber) => {
        const unsub = unsubscribeUrl(request, subscriber.unsubscribe_token);
        return {
          to: subscriber.email,
          subject,
          text: messageText(text, mailingAddress, unsub),
          html: messageHtml(text, mailingAddress, unsub),
          replyTo,
        };
      });

      const response = await sendNewsletterBatch(env, {
        messages,
        idempotencyKey: `newsletter/${orgId}/${campaignId}/${batchIndex}`,
      });
      sent += chunk.length;
      providerIds.push(...(response?.ids || []));
    }

    return ok({
      sent,
      subscriberCount: subscribers.length,
      campaignId,
      providerIds,
    });
  } catch (error) {
    const code = clean(error?.code || error?.message || "NEWSLETTER_SEND_FAILED", 300);
    console.error("NEWSLETTER_SEND_FAILED", code);
    return err(502, code);
  }
}
