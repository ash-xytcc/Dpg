import { ok, err } from "../_lib/http.js";
import { getDB } from "../_bf.js";
import { ensureZkSchema } from "../_lib/zk.js";
import { rateLimit } from "../_lib/rateLimit.js";
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

function unsubscribeUrl(request, token) {
  const url = new URL("/api/public/newsletter-unsubscribe", request.url);
  url.searchParams.set("token", String(token || ""));
  return url.toString();
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
  try {
    await db.prepare("ALTER TABLE newsletter_subscribers ADD COLUMN unsubscribe_token TEXT").run();
  } catch (error) {
    const message = String(error?.message || "");
    if (!message.includes("duplicate column") && !message.includes("already exists")) throw error;
  }

  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscribers_org_email
    ON newsletter_subscribers(org_id, email)`).run();
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscribers_unsubscribe
    ON newsletter_subscribers(unsubscribe_token) WHERE unsubscribe_token IS NOT NULL`).run();
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

    const ip = String(request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown")
      .split(",")[0].trim().slice(0, 120);
    const [ipLimit, emailLimit] = await Promise.all([
      rateLimit({ env, key: `newsletter-signup-ip:${ip}`, limit: 20, windowSec: 60 * 60 }),
      rateLimit({ env, key: `newsletter-signup-email:${email}`, limit: 5, windowSec: 60 * 60 }),
    ]);
    if (!ipLimit.ok || !emailLimit.ok) {
      return err(429, "RATE_LIMIT", {
        retry_after: Math.max(ipLimit.retry_after || 0, emailLimit.retry_after || 0),
      });
    }

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

    const unsubscribeToken = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    await db.prepare(`
      INSERT INTO newsletter_subscribers (id, org_id, email, name, source, created_at, unsubscribe_token)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, orgId, email, name || null, source, Date.now(), unsubscribeToken).run();

    let emailSent = false;
    let emailError = "";
    try {
      let replyTo = "";
      try {
        const settings = await db.prepare(
          "SELECT list_address FROM newsletter_settings WHERE org_id=? LIMIT 1"
        ).bind(orgId).first();
        replyTo = String(settings?.list_address || "").trim();
      } catch {}

      await sendNewsletterSignupConfirmation(env, {
        email,
        name,
        replyTo,
        unsubscribeUrl: unsubscribeUrl(request, unsubscribeToken),
      });
      emailSent = true;
    } catch (error) {
      emailError = String(error?.code || error?.message || "EMAIL_SEND_FAILED").slice(0, 300);
      console.error("NEWSLETTER_SIGNUP_CONFIRMATION_FAILED", emailError);
    }

    return ok({
      subscribed: true,
      alreadyExists: false,
      emailSent,
      emailError,
    });
  } catch (error) {
    console.error("NEWSLETTER_SUBSCRIBE_FAILED", error);
    return err(500, "NEWSLETTER_SUBSCRIBE_FAILED");
  }
}
