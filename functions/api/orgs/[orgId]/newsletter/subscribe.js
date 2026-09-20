import { getDB, json, bad, readJson, normalizeEmail } from "../../../_bf.js";
import { ensureZkSchema } from "../../../_lib/zk.js";
import { guardPublicForm } from "../../../_lib/publicFormGuard.js";
import { sendNewsletterSignupConfirmation } from "../../../_lib/email.js";

function randomToken() {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
}

async function tryAlter(db, sql) {
  try { await db.prepare(sql).run(); }
  catch (error) {
    const message = String(error?.message || "");
    if (!message.includes("duplicate column") && !message.includes("already exists")) throw error;
  }
}

async function ensureSubscriberTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT NULL,
    source TEXT NULL,
    created_at INTEGER NOT NULL
  )`).run();

  await ensureZkSchema(db);
  await tryAlter(db, "ALTER TABLE newsletter_subscribers ADD COLUMN unsubscribe_token TEXT");
  await tryAlter(db, "ALTER TABLE newsletter_subscribers ADD COLUMN confirmation_token TEXT");
  await tryAlter(db, "ALTER TABLE newsletter_subscribers ADD COLUMN confirmed_at INTEGER");
  await tryAlter(db, "ALTER TABLE newsletter_subscribers ADD COLUMN confirmation_sent_at INTEGER");
  await tryAlter(db, "ALTER TABLE newsletter_subscribers ADD COLUMN confirmation_error TEXT NOT NULL DEFAULT ''");

  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscribers_org_email
    ON newsletter_subscribers(org_id, email)`).run();
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscribers_unsubscribe
    ON newsletter_subscribers(unsubscribe_token) WHERE unsubscribe_token IS NOT NULL`).run();
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscribers_confirmation
    ON newsletter_subscribers(confirmation_token) WHERE confirmation_token IS NOT NULL`).run();

  // Existing rows predate double opt-in. Preserve them as active.
  await db.prepare(`
    UPDATE newsletter_subscribers
       SET confirmed_at=COALESCE(confirmed_at, created_at)
     WHERE org_id=?
       AND confirmed_at IS NULL
       AND confirmation_token IS NULL
  `).bind(arguments.orgId).run();
}

async function readSettings(db, orgId) {
  try {
    return await db.prepare(
      "SELECT list_address FROM newsletter_settings WHERE org_id=? LIMIT 1"
    ).bind(orgId).first();
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = getDB(env);
  if (!db) return bad("DB_NOT_CONFIGURED", 500);

  const orgId = String(params?.orgId || "").trim();
  if (!orgId) return bad("BAD_ORG_ID", 400);
  if (request.method !== "POST") return bad("METHOD_NOT_ALLOWED", 405);

  await ensureSubscriberTable(db);

  const body = await readJson(request);
  if (!body) return bad("BAD_JSON", 400);

  const email = normalizeEmail(body.email);
  const name = String(body.name || "").trim().slice(0, 160);
  const source = String(body.source || "public_page").trim().slice(0, 80) || "public_page";
  if (!email || !email.includes("@")) return bad("INVALID_EMAIL", 400);

  const guard = await guardPublicForm({
    env,
    request,
    body,
    purpose: "newsletter-signup",
    ipLimit: 10,
    emailLimit: 3,
    windowSec: 60 * 60,
    email,
  });
  if (!guard.ok) {
    if (guard.silent) return json({ ok: true, subscribed: false, pendingConfirmation: true, confirmationSent: true });
    return bad(guard.code || "FORM_REJECTED", guard.status || 400);
  }

  const existing = await db.prepare(`
    SELECT id, confirmed_at, confirmation_token, unsubscribe_token
      FROM newsletter_subscribers
     WHERE org_id=? AND email=?
     LIMIT 1
  `).bind(orgId, email).first();

  if (existing?.confirmed_at) {
    return json({ ok: true, subscribed: true, alreadyExists: true, pendingConfirmation: false });
  }

  const confirmationToken = String(existing?.confirmation_token || randomToken());
  const unsubscribeToken = String(existing?.unsubscribe_token || randomToken());
  const id = String(existing?.id || crypto.randomUUID());
  const timestamp = Date.now();

  if (existing?.id) {
    await db.prepare(`
      UPDATE newsletter_subscribers
         SET name=?, source=?, confirmation_token=?, unsubscribe_token=?, confirmation_error=''
       WHERE org_id=? AND id=?
    `).bind(name || null, source, confirmationToken, unsubscribeToken, orgId, id).run();
  } else {
    await db.prepare(`
      INSERT INTO newsletter_subscribers
        (id, org_id, email, name, source, created_at, unsubscribe_token, confirmation_token, confirmed_at, confirmation_sent_at, confirmation_error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, '')
    `).bind(id, orgId, email, name || null, source, timestamp, unsubscribeToken, confirmationToken).run();
  }

  const settings = await readSettings(db, orgId);
  const replyTo = String(settings?.list_address || "").trim();
  const confirmUrl = new URL("/api/public/newsletter-confirm", request.url);
  confirmUrl.searchParams.set("token", confirmationToken);

  try {
    await sendNewsletterSignupConfirmation(env, {
      email,
      name,
      replyTo,
      confirmationUrl: confirmUrl.toString(),
    });
    await db.prepare(
      "UPDATE newsletter_subscribers SET confirmation_sent_at=?, confirmation_error='' WHERE org_id=? AND id=?"
    ).bind(Date.now(), orgId, id).run();

    return json({
      ok: true,
      subscribed: false,
      alreadyExists: !!existing?.id,
      pendingConfirmation: true,
      confirmationSent: true,
    });
  } catch (error) {
    const code = String(error?.code || error?.message || "EMAIL_SEND_FAILED").slice(0, 300);
    await db.prepare(
      "UPDATE newsletter_subscribers SET confirmation_error=? WHERE org_id=? AND id=?"
    ).bind(code, orgId, id).run();
    console.error("NEWSLETTER_CONFIRMATION_FAILED", code);
    return json({
      ok: true,
      subscribed: false,
      alreadyExists: !!existing?.id,
      pendingConfirmation: true,
      confirmationSent: false,
      emailError: code,
    });
  }
}
