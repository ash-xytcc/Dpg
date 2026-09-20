import { err } from "../_lib/http.js";
import { getDB } from "../_bf.js";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function page(title, bodyHtml) {
  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;background:#121715;color:#f3efe8;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
  <main style="max-width:680px;margin:0 auto;padding:64px 20px">
    <h1 style="font-size:32px;margin:0 0 16px">${escapeHtml(title)}</h1>
    ${bodyHtml}
    <p style="margin-top:28px"><a href="/" style="color:#9ec6a4">Return to Dual Power West</a></p>
  </main>
</body>
</html>`, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

function tokenFromRequest(request, body = null) {
  const urlToken = String(new URL(request.url).searchParams.get("token") || "").trim();
  const bodyToken = String(body?.token || "").trim();
  return bodyToken || urlToken;
}

export async function onRequestGet({ env, request }) {
  const db = getDB(env);
  if (!db) return err(500, "DB_NOT_CONFIGURED");

  const token = tokenFromRequest(request);
  if (!token) {
    return page("Unsubscribe link is incomplete", "<p>No subscription was changed.</p>");
  }

  try {
    const row = await db.prepare(
      "SELECT id, email FROM newsletter_subscribers WHERE unsubscribe_token=? LIMIT 1"
    ).bind(token).first();

    if (!row?.id) {
      return page("Already unsubscribed", "<p>This address is not on the Dual Power West newsletter list.</p>");
    }

    const email = escapeHtml(row.email || "this address");
    return page(
      "Unsubscribe from Dual Power West?",
      `<p style="font-size:18px;line-height:1.6">This will remove <strong>${email}</strong> from the newsletter list.</p>
      <form method="post" action="/api/public/newsletter-unsubscribe" style="margin-top:24px">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        <button type="submit" style="border:0;border-radius:8px;padding:12px 18px;background:#9ec6a4;color:#121715;font-weight:700;cursor:pointer">
          Unsubscribe
        </button>
      </form>`
    );
  } catch (error) {
    console.error("NEWSLETTER_UNSUBSCRIBE_LOOKUP_FAILED", error);
    return page("Could not load subscription", "<p>Please try the unsubscribe link again.</p>");
  }
}

export async function onRequestPost({ env, request }) {
  const db = getDB(env);
  if (!db) return err(500, "DB_NOT_CONFIGURED");

  let body = {};
  let oneClick = false;
  const type = String(request.headers.get("content-type") || "").toLowerCase();
  try {
    if (type.includes("application/json")) {
      body = await request.json();
    } else {
      const form = await request.formData();
      body = {
        token: form.get("token"),
        oneClick: form.get("List-Unsubscribe"),
      };
      oneClick = String(body.oneClick || "") === "One-Click";
    }
  } catch {
    body = {};
  }

  const token = tokenFromRequest(request, body);
  if (!token) {
    return page("Unsubscribe link is incomplete", "<p>No subscription was changed.</p>");
  }

  try {
    const row = await db.prepare(
      "SELECT id FROM newsletter_subscribers WHERE unsubscribe_token=? LIMIT 1"
    ).bind(token).first();

    if (!row?.id) {
      return oneClick
        ? new Response(null, { status: 200, headers: { "cache-control": "no-store" } })
        : page("Already unsubscribed", "<p>This address is not on the Dual Power West newsletter list.</p>");
    }

    await db.prepare(
      "DELETE FROM newsletter_subscribers WHERE unsubscribe_token=?"
    ).bind(token).run();

    return oneClick
      ? new Response(null, { status: 200, headers: { "cache-control": "no-store" } })
      : page("Unsubscribed", "<p>You will no longer receive Dual Power West newsletter emails.</p>");
  } catch (error) {
    console.error("NEWSLETTER_UNSUBSCRIBE_FAILED", error);
    return page("Could not unsubscribe", "<p>The request could not be completed. Please try again.</p>");
  }
}
