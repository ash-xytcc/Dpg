import { rateLimit } from "./rateLimit.js";

function clean(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

export function publicClientIp(request) {
  return clean(
    request?.headers?.get("cf-connecting-ip") ||
    request?.headers?.get("x-forwarded-for")?.split(",")[0] ||
    "unknown",
    120
  );
}

function requestHost(request) {
  try { return new URL(request.url).host.toLowerCase(); } catch { return ""; }
}

function originHost(request) {
  const raw = clean(request?.headers?.get("origin"), 500);
  if (!raw) return "";
  try { return new URL(raw).host.toLowerCase(); } catch { return "__invalid__"; }
}

async function verifyTurnstile({ env, token, ip }) {
  const secret = clean(env?.TURNSTILE_SECRET_KEY, 500);
  if (!secret) return { ok: true, configured: false };

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret,
      response: clean(token, 4096),
      ...(ip && ip !== "unknown" ? { remoteip: ip } : {}),
    }),
  });

  const data = await response.json().catch(() => ({}));
  return {
    ok: !!data?.success,
    configured: true,
    errors: Array.isArray(data?.["error-codes"]) ? data["error-codes"] : [],
  };
}

export async function guardPublicForm({
  env,
  request,
  body,
  purpose,
  ipLimit = 12,
  emailLimit = 3,
  windowSec = 60 * 60,
  email = "",
} = {}) {
  const ip = publicClientIp(request);
  const host = requestHost(request);
  const origin = originHost(request);

  // Browser submissions should be same-origin. We allow a missing Origin for
  // compatibility, but reject an explicitly different origin.
  if (origin && origin !== "__invalid__" && host && origin !== host) {
    return { ok: false, code: "FORM_ORIGIN_REJECTED", status: 403 };
  }
  if (origin === "__invalid__") {
    return { ok: false, code: "FORM_ORIGIN_REJECTED", status: 403 };
  }

  // Honeypot. Humans never see this field. Return a success-looking response
  // from callers so generic bots do not learn which field caught them.
  const honeypot = clean(body?.website || body?.company_website || body?.fax_number, 1000);
  if (honeypot) {
    return { ok: false, code: "BOT_HONEYPOT", status: 200, silent: true };
  }

  // Our forms include a client-side start timestamp. Very fast submissions and
  // requests that never loaded the form UI are disproportionately automated.
  const startedAt = Number(body?._formStartedAt || 0);
  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    return { ok: false, code: "FORM_SESSION_REQUIRED", status: 400 };
  }
  const elapsed = Date.now() - startedAt;
  if (elapsed < 1200 || elapsed > 24 * 60 * 60 * 1000) {
    return { ok: false, code: "FORM_TIMING_REJECTED", status: 400 };
  }

  const keys = [
    rateLimit({ env, key: `${purpose}:ip:${ip}`, limit: ipLimit, windowSec }),
  ];
  if (email) {
    keys.push(rateLimit({
      env,
      key: `${purpose}:email:${clean(email, 320).toLowerCase()}`,
      limit: emailLimit,
      windowSec: 24 * 60 * 60,
    }));
  }

  const limits = await Promise.all(keys);
  const blocked = limits.find((item) => !item?.ok);
  if (blocked) {
    return {
      ok: false,
      code: "RATE_LIMIT",
      status: 429,
      retry_after: Number(blocked.retry_after || 0),
    };
  }

  const turnstile = await verifyTurnstile({
    env,
    token: body?.turnstileToken || body?.["cf-turnstile-response"] || "",
    ip,
  });
  if (!turnstile.ok) {
    return {
      ok: false,
      code: "TURNSTILE_REQUIRED",
      status: 403,
      details: turnstile.errors,
    };
  }

  return { ok: true, ip, turnstileConfigured: turnstile.configured };
}
