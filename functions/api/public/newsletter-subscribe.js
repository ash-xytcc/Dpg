import { ok, err } from "../_lib/http.js";
import { getDB } from "../_bf.js";
import { ensureZkSchema } from "../_lib/zk.js";
import { guardPublicForm } from "../_lib/publicFormGuard.js";
import { sendNewsletterSignupConfirmation } from "../_lib/email.js";

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}

async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

async function tryAlter(db, sql) {
  try { await db.prepare(sql).run(); }
  catch (error) {
    const message = String(error?.message || "");
    if (!message.includes("duplicate column") && !message.includes("already exists")) throw error;
  }
}

function confirmationUrl(request, token) {
  const url = new URL("/api/public/newsletter-confirm", request.url);
  url.searchParams.set("token", String(token || ""));
  return url.toString();
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

  // Existing rows predate double opt-in. Preserve them as active so legitimate
  // subscribers are not silently dropped during the migration.
  await db.prepare(`
    UPDATE newsletter_subscribers
       SET confirmed_at = COALESCE(confirmed_at, created_at)
     WHERE confirmed_at IS NULL
       AND confirmation_token IS NULL
  `).run();
}

async function resolveDpgOrgId(db, requested) {
  const raw = String(requested || "dpg").trim() || "dpg";
  if (raw !== "dpg") return raw;

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

function randomToken() {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
}

export async function onRequestPost({ env, request }) {
  try {
    const db = getDB(env);
    if (!db) return err(500, "DB_NOT_CONFIGURED");

    await ensureSubscriberTable(db);

    const body = await readJson(request);
    const orgId = await resolveDpgOrgId(db, body?.orgId);
    const email = normalizeEmail(body?.email);
    const name = String(body?.name || "").trim().slice(0, 160);
    const source = String(body?.source || "public_home").trim().slice(0, 80) || "public_home";

    if (!validEmail(email)) return err(400, "INVALID_EMAIL");

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
      if (guard.silent) {
        return ok({ subscribed: false, pendingConfirmation: true, confirmationSent: true });
      }
      return err(guard.status || 400, guard.code || "FORM_REJECTED", {
        ...(guard.retry_after ? { retry_after: guard.retry_after } : {}),
      });
    }

    await migrateLegacyDpgSubscribers(db, orgId);

    const existing = await db.prepare(`
      SELECT id, confirmed_at, confirmation_token, unsubscribe_token, confirmation_sent_at
        FROM newsletter_subscribers
       WHERE org_id = ? AND email = ?
       LIMIT 1
    `).bind(orgId, email).first();

    if (existing?.confirmed_at) {
      return ok({
        subscribed: true,
        alreadyExists: true,
        pendingConfirmation: false,
      });
    }

    const confirmationToken = String(existing?.confirmation_token || randomToken());
    const unsubscribeToken = String(existing?.unsubscribe_token || randomToken());
    const timestamp = Date.now();
    const id = String(existing?.id || crypto.randomUUID());

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

    let replyTo = "";
    try {
      const settings = await db.prepare(
        "SELECT list_address FROM newsletter_settings WHERE org_id=? LIMIT 1"
      ).bind(orgId).first();
      replyTo = String(settings?.list_address || "").trim();
    } catch {}

    let confirmationSent = false;
    let emailError = "";
    try {
      await sendNewsletterSignupConfirmation(env, {
        email,
        name,
        replyTo,
        confirmationUrl: confirmationUrl(request, confirmationToken),
      });
      confirmationSent = true;
      await db.prepare(
        "UPDATE newsletter_subscribers SET confirmation_sent_at=?, confirmation_error='' WHERE org_id=? AND id=?"
      ).bind(Date.now(), orgId, id).run();
    } catch (error) {
      emailError = String(error?.code || error?.message || "EMAIL_SEND_FAILED").slice(0, 300);
      await db.prepare(
        "UPDATE newsletter_subscribers SET confirmation_error=? WHERE org_id=? AND id=?"
      ).bind(emailError, orgId, id).run();
      console.error("NEWSLETTER_CONFIRMATION_FAILED", emailError);
    }

    return ok({
      subscribed: false,
      alreadyExists: !!existing?.id,
      pendingConfirmation: true,
      confirmationSent,
      emailError,
    });
  } catch (error) {
    console.error("NEWSLETTER_SUBSCRIBE_FAILED", error);
    return err(500, "NEWSLETTER_SUBSCRIBE_FAILED");
  }
}
