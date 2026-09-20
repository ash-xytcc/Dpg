const DEFAULT_FROM = "Dual Power West <hello@dualpowerwest.org>";
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

export function emailRuntimeStatus(env) {
  const from = String(env?.RESEND_FROM || DEFAULT_FROM).trim() || DEFAULT_FROM;
  const newsletterFrom = String(env?.NEWSLETTER_FROM || from).trim() || from;
  return {
    resendConfigured: !!String(env?.RESEND_API_KEY || "").trim(),
    from,
    newsletterFrom,
    rsvpFormUrl: rsvpFormUrl(env),
  };
}

async function sendViaResend(env, payload) {
  const key = String(env?.RESEND_API_KEY || "").trim();
  if (!key) {
    const error = new Error("RESEND_NOT_CONFIGURED");
    error.code = "RESEND_NOT_CONFIGURED";
    throw error;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: String(env?.RESEND_FROM || DEFAULT_FROM).trim() || DEFAULT_FROM,
      ...payload,
    }),
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


export async function sendNewsletterSignupConfirmation(env, { email, name, unsubscribeUrl, replyTo }) {
  const first = firstName(name);
  const from = String(env?.NEWSLETTER_FROM || env?.RESEND_FROM || DEFAULT_FROM).trim() || DEFAULT_FROM;
  const unsubscribe = String(unsubscribeUrl || "").trim();

  return sendViaResend(env, {
    from,
    to: [String(email || "").trim()],
    subject: "you’re subscribed: Dual Power West updates",
    ...(String(replyTo || "").trim() ? { reply_to: String(replyTo).trim() } : {}),
    ...(unsubscribe ? {
      headers: {
        "List-Unsubscribe": `<${unsubscribe}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    } : {}),
    text:
      "Hi " + first + ",\n\n" +
      "You’re subscribed to Dual Power West updates. We’ll use this list for gathering announcements, important logistics, and related updates.\n\n" +
      "This newsletter list is separate from RSVP.\n\n" +
      (unsubscribe ? "You can unsubscribe at any time:\n" + unsubscribe + "\n\n" : "") +
      "Dual Power West",
    html:
      '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#171717;max-width:640px;margin:auto">' +
      '<h1 style="font-size:28px;margin:0 0 16px">you’re on the list.</h1>' +
      "<p>Hi " + htmlEscape(first) + ",</p>" +
      "<p>You’re subscribed to <strong>Dual Power West</strong> updates. We’ll use this list for gathering announcements, important logistics, and related updates.</p>" +
      "<p>This newsletter list is separate from RSVP.</p>" +
      (unsubscribe
        ? '<p style="font-size:13px;color:#666;margin-top:28px">You can <a href="' + htmlEscape(unsubscribe) + '">unsubscribe at any time</a>.</p>'
        : "") +
      "<p>Dual Power West</p></div>",
  });
}


export async function sendNewsletterBatch(env, { messages, idempotencyKey }) {
  const key = String(env?.RESEND_API_KEY || "").trim();
  if (!key) {
    const error = new Error("RESEND_NOT_CONFIGURED");
    error.code = "RESEND_NOT_CONFIGURED";
    throw error;
  }

  const list = Array.isArray(messages) ? messages.filter(Boolean) : [];
  if (!list.length) return { ids: [] };
  if (list.length > 100) {
    const error = new Error("NEWSLETTER_BATCH_TOO_LARGE");
    error.code = "NEWSLETTER_BATCH_TOO_LARGE";
    throw error;
  }

  const from = String(env?.NEWSLETTER_FROM || env?.RESEND_FROM || DEFAULT_FROM).trim() || DEFAULT_FROM;
  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": String(idempotencyKey).slice(0, 256) } : {}),
    },
    body: JSON.stringify(list.map((message) => ({
      from,
      to: [String(message?.to || "").trim()],
      subject: String(message?.subject || "").trim(),
      text: String(message?.text || ""),
      html: String(message?.html || ""),
      ...(String(message?.replyTo || "").trim() ? { reply_to: String(message.replyTo).trim() } : {}),
      ...(message?.headers && typeof message.headers === "object" ? { headers: message.headers } : {}),
    }))),
  });

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
