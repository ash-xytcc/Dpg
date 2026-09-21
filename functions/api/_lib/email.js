const DEFAULT_FROM = "Dual Power West <hello@dualpowerwest.org>";
const DEFAULT_REPLY_TO = "dualpowerwest@proton.me";
const DEFAULT_FORM_URL = "https://bit.ly/dpgwestrsvp";

function htmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstName(name) {
  const value = String(name || "").trim();
  return value ? value.split(/\s+/)[0] : "friend";
}

export function rsvpFormUrl(env) {
  return String(env?.RSVP_FORM_URL || DEFAULT_FORM_URL).trim() || DEFAULT_FORM_URL;
}

export function replyToAddress(env) {
  return String(env?.DPG_REPLY_TO || DEFAULT_REPLY_TO).trim() || DEFAULT_REPLY_TO;
}

export function emailRuntimeStatus(env) {
  const from = String(env?.RESEND_FROM || DEFAULT_FROM).trim() || DEFAULT_FROM;
  const newsletterFrom = String(env?.NEWSLETTER_FROM || from).trim() || from;
  return {
    resendConfigured: !!String(env?.RESEND_API_KEY || "").trim(),
    relayConfigured: !!String(env?.RESEND_RELAY_URL || "").trim(),
    from,
    newsletterFrom,
    replyTo: replyToAddress(env),
    rsvpFormUrl: rsvpFormUrl(env),
  };
}

async function resendFetch(env, path, payload, extraHeaders = {}) {
  const relay = String(env?.RESEND_RELAY_URL || "").trim().replace(/\/+$/, "");
  const key = String(env?.RESEND_API_KEY || "").trim();

  if (!key) {
    const error = new Error("RESEND_NOT_CONFIGURED");
    error.code = "RESEND_NOT_CONFIGURED";
    throw error;
  }

  const url = relay ? relay + path : "https://api.resend.com" + path;
  const headers = {
    "Content-Type": "application/json",
    ...extraHeaders,
    ...(relay
      ? { "X-DPG-Resend-Key": key }
      : { Authorization: "Bearer " + key }),
  };

  return fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

async function sendViaResend(env, payload) {
  const response = await resendFetch(env, "/emails", {
    from: String(env?.RESEND_FROM || DEFAULT_FROM).trim() || DEFAULT_FROM,
    ...payload,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = String(data?.name || data?.message || ("RESEND_HTTP_" + response.status)).slice(0, 300);
    const error = new Error(code);
    error.code = code;
    throw error;
  }
  return { id: String(data?.id || "") };
}

export async function sendRsvpConfirmation(env, { email, name }) {
  const formUrl = rsvpFormUrl(env);
  const first = firstName(name);
  return sendViaResend(env, {
    to: [String(email || "").trim()],
    reply_to: replyToAddress(env),
    subject: "you’re in: dual power west rsvp confirmed",
    text:
      "Hi " + first + ",\n\nYour RSVP for Dual Power West is confirmed.\n\n" +
      "Please complete the full logistics form so organizers can plan camping, accommodations/accessibility, food, childcare, travel, and other needs:\n" +
      formUrl + "\n\nIf your plans change, that is okay. Keep us updated so the gathering can plan around real numbers.\n\nDual Power West",
    html:
      '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#171717;max-width:640px;margin:auto">' +
      '<h1 style="font-size:28px;margin:0 0 16px">you’re in.</h1>' +
      "<p>Hi " + htmlEscape(first) + ",</p>" +
      "<p>Your RSVP for <strong>Dual Power West</strong> is confirmed.</p>" +
      "<p>Next, please fill out the full logistics form. This is where we collect the details organizers actually need for camping, accommodations and accessibility, food, childcare, travel, and other planning.</p>" +
      '<p style="margin:28px 0"><a href="' + htmlEscape(formUrl) + '" style="display:inline-block;background:#385032;color:#fff;text-decoration:none;padding:13px 18px;border-radius:8px;font-weight:700">fill out the full logistics form →</a></p>' +
      "<p>If your plans change, that is okay. Keep us updated so the gathering can plan around real numbers.</p>" +
      "<p>Dual Power West</p></div>",
  });
}

export async function sendRsvpReminder(env, { email, name }) {
  const formUrl = rsvpFormUrl(env);
  const first = firstName(name);
  return sendViaResend(env, {
    to: [String(email || "").trim()],
    reply_to: replyToAddress(env),
    subject: "Don’t Forget DPG West",
    text:
      "Hi " + first + ",\n\nYou’re on the Dual Power West RSVP list. This is a reminder to finish the full logistics form if you have not already.\n\n" +
      "Camping, accommodations/accessibility, food, childcare, travel, and other planning details:\n" +
      formUrl + "\n\nThanks,\nDual Power West",
    html:
      '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#171717;max-width:640px;margin:auto">' +
      '<h1 style="font-size:26px;margin:0 0 16px">Don’t Forget DPG West</h1>' +
      "<p>Hi " + htmlEscape(first) + ",</p>" +
      "<p>You’re on the Dual Power West RSVP list. This is a reminder to finish the full logistics form if you have not already.</p>" +
      "<p>It covers camping, accommodations and accessibility, food, childcare, travel, and other planning details.</p>" +
      '<p style="margin:28px 0"><a href="' + htmlEscape(formUrl) + '" style="display:inline-block;background:#385032;color:#fff;text-decoration:none;padding:13px 18px;border-radius:8px;font-weight:700">complete the logistics form →</a></p>' +
      "<p>Thanks,<br>Dual Power West</p></div>",
  });
}


export async function sendNewsletterSignupConfirmation(env, { email, name, confirmationUrl, replyTo }) {
  const first = firstName(name);
  const from = String(env?.NEWSLETTER_FROM || env?.RESEND_FROM || DEFAULT_FROM).trim() || DEFAULT_FROM;
  const confirm = String(confirmationUrl || "").trim();

  const effectiveReplyTo = String(replyTo || replyToAddress(env)).trim() || replyToAddress(env);

  return sendViaResend(env, {
    from,
    to: [String(email || "").trim()],
    subject: "confirm your Dual Power West newsletter signup",
    reply_to: effectiveReplyTo,
    text:
      "Hi " + first + ",\n\n" +
      "Someone used this address to sign up for Dual Power West updates. Confirm the subscription here:\n" +
      confirm + "\n\n" +
      "If that was not you, ignore this message and you will not be added to the newsletter list.\n\n" +
      "Dual Power West",
    html:
      '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#171717;max-width:640px;margin:auto">' +
      '<h1 style="font-size:28px;margin:0 0 16px">confirm your signup.</h1>' +
      "<p>Hi " + htmlEscape(first) + ",</p>" +
      "<p>Someone used this address to sign up for <strong>Dual Power West</strong> updates.</p>" +
      '<p style="margin:28px 0"><a href="' + htmlEscape(confirm) + '" style="display:inline-block;background:#385032;color:#fff;text-decoration:none;padding:13px 18px;border-radius:8px;font-weight:700">confirm newsletter signup →</a></p>' +
      "<p>If that was not you, ignore this message. You will not be added to the newsletter list unless you confirm.</p>" +
      "<p>Dual Power West</p></div>",
  });
}

export async function sendNewsletterBatch(env, { messages, idempotencyKey }) {
  const list = Array.isArray(messages) ? messages.filter(Boolean) : [];
  if (!list.length) return { ids: [] };
  if (list.length > 100) {
    const error = new Error("NEWSLETTER_BATCH_TOO_LARGE");
    error.code = "NEWSLETTER_BATCH_TOO_LARGE";
    throw error;
  }

  const from = String(env?.NEWSLETTER_FROM || env?.RESEND_FROM || DEFAULT_FROM).trim() || DEFAULT_FROM;
  const response = await resendFetch(
    env,
    "/emails/batch",
    list.map((message) => ({
      from,
      to: [String(message?.to || "").trim()],
      subject: String(message?.subject || "").trim(),
      text: String(message?.text || ""),
      html: String(message?.html || ""),
      reply_to: String(message?.replyTo || replyToAddress(env)).trim() || replyToAddress(env),
      ...(message?.headers && typeof message.headers === "object" ? { headers: message.headers } : {}),
    })),
    idempotencyKey ? { "Idempotency-Key": String(idempotencyKey).slice(0, 256) } : {}
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = String(data?.name || data?.message || ("RESEND_HTTP_" + response.status)).slice(0, 300);
    const error = new Error(code);
    error.code = code;
    throw error;
  }

  const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  return { ids: rows.map((row) => String(row?.id || "")).filter(Boolean) };
}
