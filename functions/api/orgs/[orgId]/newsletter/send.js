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

  await db.prepare(`CREATE TABLE IF NOT EXISTS newsletter_sends (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    campaign_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    recipient_count INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'sending',
    error TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    completed_at INTEGER
  )`).run();
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_sends_org_campaign
    ON newsletter_sends(org_id, campaign_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_newsletter_sends_org_created
    ON newsletter_sends(org_id, created_at DESC)`).run();
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

async function authorize({ env, request, params }) {
  const orgId = clean(params?.orgId, 200);
  if (!orgId) return { resp: err(400, "BAD_ORG_ID") };

  const gate = await requireOrgRole({ env, request, orgId, minRole: "admin" });
  if (!gate.ok) return { resp: gate.resp };

  const db = getDB(env);
  if (!db) return { resp: err(500, "DB_NOT_CONFIGURED") };
  await ensureNewsletterTables(db);

  return { orgId, db };
}

export async function onRequestGet(ctx) {
  try {
    const state = await authorize(ctx);
    if (state.resp) return state.resp;

    const rows = await state.db.prepare(`
      SELECT campaign_id, subject, recipient_count, sent_count, status, error, created_at, completed_at
        FROM newsletter_sends
       WHERE org_id=?
       ORDER BY created_at DESC
       LIMIT 20
    `).bind(state.orgId).all();

    return ok({ sends: Array.isArray(rows?.results) ? rows.results : [] });
  } catch (error) {
    console.error("NEWSLETTER_HISTORY_FAILED", error);
    return err(500, "NEWSLETTER_HISTORY_FAILED");
  }
}

export async function onRequestPost(ctx) {
  let sendDb = null;
  let sendOrgId = "";
  let sendCampaignId = "";

  try {
    const { env, request } = ctx;
    const state = await authorize(ctx);
    if (state.resp) return state.resp;
    const { orgId, db } = state;
    sendDb = db;
    sendOrgId = orgId;

    if (!String(env?.RESEND_API_KEY || "").trim()) return err(503, "RESEND_NOT_CONFIGURED");

    const body = await request.json().catch(() => ({}));
    const subject = clean(body?.subject, 200);
    const text = clean(body?.body, 50000);
    const campaignId = clean(body?.campaignId, 120) || crypto.randomUUID();
    sendCampaignId = campaignId;

    if (!subject) return err(400, "NEWSLETTER_SUBJECT_REQUIRED");
    if (!text) return err(400, "NEWSLETTER_BODY_REQUIRED");

    const prior = await db.prepare(
      "SELECT sent_count, recipient_count, status FROM newsletter_sends WHERE org_id=? AND campaign_id=? LIMIT 1"
    ).bind(orgId, campaignId).first();

    if (prior?.status === "sent") {
      return ok({
        sent: Number(prior.sent_count || 0),
        subscriberCount: Number(prior.recipient_count || 0),
        campaignId,
        alreadySent: true,
      });
    }

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

    const now = Date.now();
    const sendId = `${orgId}:${campaignId}`;
    await db.prepare(`
      INSERT INTO newsletter_sends
        (id, org_id, campaign_id, subject, recipient_count, sent_count, status, error, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, 0, 'sending', '', ?, NULL)
      ON CONFLICT(org_id, campaign_id) DO UPDATE SET
        subject=excluded.subject,
        recipient_count=excluded.recipient_count,
        status='sending',
        error=''
    `).bind(sendId, orgId, campaignId, subject, subscribers.length, now).run();

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
          headers: {
            "List-Unsubscribe": `<${unsub}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        };
      });

      const response = await sendNewsletterBatch(env, {
        messages,
        idempotencyKey: `newsletter/${orgId}/${campaignId}/${batchIndex}`,
      });
      sent += chunk.length;
      providerIds.push(...(response?.ids || []));

      await db.prepare(
        "UPDATE newsletter_sends SET sent_count=?, status='sending', error='' WHERE org_id=? AND campaign_id=?"
      ).bind(sent, orgId, campaignId).run();
    }

    const completedAt = Date.now();
    await db.prepare(
      "UPDATE newsletter_sends SET sent_count=?, status='sent', error='', completed_at=? WHERE org_id=? AND campaign_id=?"
    ).bind(sent, completedAt, orgId, campaignId).run();

    return ok({
      sent,
      subscriberCount: subscribers.length,
      campaignId,
      providerIds,
    });
  } catch (error) {
    const code = clean(error?.code || error?.message || "NEWSLETTER_SEND_FAILED", 300);
    if (sendDb && sendOrgId && sendCampaignId) {
      try {
        await sendDb.prepare(
          "UPDATE newsletter_sends SET status='failed', error=? WHERE org_id=? AND campaign_id=?"
        ).bind(code, sendOrgId, sendCampaignId).run();
      } catch {}
    }
    console.error("NEWSLETTER_SEND_FAILED", code);
    return err(502, code);
  }
}
