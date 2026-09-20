import { err } from "../_lib/http.js";
import { getDB } from "../_bf.js";

function page(title, body, status = 200) {
  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;background:#121715;color:#f3efe8;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
  <main style="max-width:680px;margin:0 auto;padding:64px 20px">
    <h1 style="font-size:32px;margin:0 0 16px">${title}</h1>
    <p style="font-size:18px;line-height:1.6">${body}</p>
    <p><a href="/" style="color:#9ec6a4">Return to Dual Power West</a></p>
  </main>
</body>
</html>`, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function tryAlter(db, sql) {
  try { await db.prepare(sql).run(); }
  catch (error) {
    const message = String(error?.message || "");
    if (!message.includes("duplicate column") && !message.includes("already exists")) throw error;
  }
}

async function ensureSchema(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT NULL,
    source TEXT NULL,
    created_at INTEGER NOT NULL
  )`).run();
  await tryAlter(db, "ALTER TABLE newsletter_subscribers ADD COLUMN confirmation_token TEXT");
  await tryAlter(db, "ALTER TABLE newsletter_subscribers ADD COLUMN confirmed_at INTEGER");
  await tryAlter(db, "ALTER TABLE newsletter_subscribers ADD COLUMN confirmation_error TEXT NOT NULL DEFAULT ''");
}

export async function onRequestGet({ env, request }) {
  const db = getDB(env);
  if (!db) return err(500, "DB_NOT_CONFIGURED");

  try {
    await ensureSchema(db);
    const token = String(new URL(request.url).searchParams.get("token") || "").trim();
    if (!token) return page("Confirmation link is incomplete", "No subscription was changed.", 400);

    const row = await db.prepare(
      "SELECT id, confirmed_at FROM newsletter_subscribers WHERE confirmation_token=? LIMIT 1"
    ).bind(token).first();

    if (!row?.id) {
      return page("Link no longer active", "This confirmation link is invalid, expired, or has already been used.");
    }

    if (row.confirmed_at) {
      return page("Already confirmed", "This address is already subscribed to Dual Power West updates.");
    }

    await db.prepare(`
      UPDATE newsletter_subscribers
         SET confirmed_at=?, confirmation_token=NULL, confirmation_error=''
       WHERE id=? AND confirmation_token=?
    `).bind(Date.now(), row.id, token).run();

    return page("Subscription confirmed", "You are now subscribed to Dual Power West updates.");
  } catch (error) {
    console.error("NEWSLETTER_CONFIRM_FAILED", error);
    return page("Could not confirm subscription", "The confirmation could not be completed. Please try the signup form again.", 500);
  }
}
