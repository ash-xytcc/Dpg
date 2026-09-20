import { err } from "../_lib/http.js";
import { getDB } from "../_bf.js";

function page(title, body) {
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
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function onRequestGet({ env, request }) {
  const db = getDB(env);
  if (!db) return err(500, "DB_NOT_CONFIGURED");

  const token = String(new URL(request.url).searchParams.get("token") || "").trim();
  if (!token) return page("Unsubscribe link is incomplete", "No subscription was changed.");

  try {
    const row = await db.prepare(
      "SELECT id FROM newsletter_subscribers WHERE unsubscribe_token=? LIMIT 1"
    ).bind(token).first();

    if (!row?.id) {
      return page("Already unsubscribed", "This address is not on the Dual Power West newsletter list.");
    }

    await db.prepare(
      "DELETE FROM newsletter_subscribers WHERE unsubscribe_token=?"
    ).bind(token).run();

    return page("Unsubscribed", "You will no longer receive Dual Power West newsletter emails.");
  } catch (error) {
    console.error("NEWSLETTER_UNSUBSCRIBE_FAILED", error);
    return page("Could not unsubscribe", "The request could not be completed. Please try the link again.");
  }
}
