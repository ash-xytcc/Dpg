import { ok, err } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";
import { getDB } from "../../../_bf.js";
import { ensureZkSchema } from "../../../_lib/zk.js";
import { sendNewsletterSignupConfirmation } from "../../../_lib/email.js";

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes("\n") || s.includes("\r") || s.includes(",") || s.includes('"')) {
    return '"' + s.replaceAll('"', '""') + '"';
  }
  return s;
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

  // Preserve subscriptions that predate double opt-in.
  await db.prepare(`
    UPDATE newsletter_subscribers
       SET confirmed_at=COALESCE(confirmed_at, created_at)
     WHERE confirmed_at IS NULL
       AND confirmation_token IS NULL
  `).run();
}

async function migrateLegacyDpgSubscribers(db, orgId) {
  if (!orgId || orgId === "dpg") return;

  await db.prepare(`
    DELETE FROM newsletter_subscribers
     WHERE org_id='dpg'
       AND lower(email) IN (
         SELECT lower(email) FROM newsletter_subscribers WHERE org_id=?
       )
  `).bind(orgId).run();

  await db.prepare(
    "UPDATE newsletter_subscribers SET org_id=? WHERE org_id='dpg'"
  ).bind(orgId).run();
}

async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

async function prepare(ctx) {
  const { params, env, request } = ctx;
  const orgId = String(params.orgId || "");
  if (!orgId) return { resp: err(400, "BAD_ORG_ID") };

  const db = getDB(env);
  if (!db) return { resp: err(500, "DB_NOT_CONFIGURED") };

  await ensureSubscriberTable(db);

  const auth = await requireOrgRole({ env, request, orgId, minRole: "admin" });
  if (!auth.ok) return { resp: auth.resp };

  await migrateLegacyDpgSubscribers(db, orgId);
  return { db, orgId };
}

export async function onRequestGet(ctx) {
  try {
    const state = await prepare(ctx);
    if (state.resp) return state.resp;
    const { db, orgId } = state;

    const wantCsv = (new URL(ctx.request.url).searchParams.get("format") || "").toLowerCase() === "csv";

    const result = await db.prepare(`
      SELECT id, email, name, created_at, confirmed_at, confirmation_token, confirmation_sent_at, confirmation_error, encrypted_blob, key_version
        FROM newsletter_subscribers
       WHERE org_id=?
       ORDER BY created_at DESC
       LIMIT 5000
    `).bind(orgId).all();

    const rows = Array.isArray(result?.results) ? result.results : [];

    if (!wantCsv) {
      return ok({
        subscribers: rows.map((s) => {
          const hasEnc = !!s.encrypted_blob;
          return {
            id: s.id,
            email: s.email || (hasEnc ? "__encrypted__" : ""),
            name: s.name || (hasEnc ? "__encrypted__" : ""),
            created_at: s.created_at ?? null,
            confirmed_at: s.confirmed_at ?? null,
            confirmed: !!s.confirmed_at,
            confirmation_sent_at: s.confirmation_sent_at ?? null,
            confirmation_error: s.confirmation_error || "",
            encrypted_blob: s.encrypted_blob || null,
            key_version: s.key_version ?? null,
            needs_encryption: !hasEnc,
          };
        }),
      });
    }

    const csv = [
      ["email", "name", "status", "joined", "confirmed"].join(","),
      ...rows.map((s) => [
        csvEscape(s.email),
        csvEscape(s.name),
        csvEscape(s.confirmed_at ? "confirmed" : "pending"),
        csvEscape(s.created_at ? new Date(Number(s.created_at)).toISOString() : ""),
        csvEscape(s.confirmed_at ? new Date(Number(s.confirmed_at)).toISOString() : ""),
      ].join(",")),
    ].join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="subscribers-${orgId}.csv"`,
      },
    });
  } catch (error) {
    console.error("NEWSLETTER_SUBSCRIBERS_GET_FAILED", error);
    return err(500, "NEWSLETTER_SUBSCRIBERS_FAILED");
  }
}

export async function onRequestPost(ctx) {
  try {
    const state = await prepare(ctx);
    if (state.resp) return state.resp;
    const { db, orgId } = state;

    const body = await readJson(ctx.request);

    if (String(body?.action || "") === "resend_confirmation") {
      const id = String(body?.id || "").trim();
      if (!id) return err(400, "MISSING_ID");

      const row = await db.prepare(`
        SELECT id, email, name, confirmed_at, confirmation_token
          FROM newsletter_subscribers
         WHERE org_id=? AND id=?
         LIMIT 1
      `).bind(orgId, id).first();

      if (!row?.id) return err(404, "SUBSCRIBER_NOT_FOUND");
      if (row.confirmed_at) return ok({ resent: false, alreadyConfirmed: true });

      const token = String(row.confirmation_token || (
        crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "")
      ));
      if (!row.confirmation_token) {
        await db.prepare(
          "UPDATE newsletter_subscribers SET confirmation_token=? WHERE org_id=? AND id=?"
        ).bind(token, orgId, id).run();
      }

      let replyTo = "";
      try {
        const settings = await db.prepare(
          "SELECT list_address FROM newsletter_settings WHERE org_id=? LIMIT 1"
        ).bind(orgId).first();
        replyTo = String(settings?.list_address || "").trim();
      } catch {}

      const confirmUrl = new URL("/api/public/newsletter-confirm", ctx.request.url);
      confirmUrl.searchParams.set("token", token);

      try {
        await sendNewsletterSignupConfirmation(ctx.env, {
          email: row.email,
          name: row.name,
          replyTo,
          confirmationUrl: confirmUrl.toString(),
        });
        await db.prepare(
          "UPDATE newsletter_subscribers SET confirmation_sent_at=?, confirmation_error='' WHERE org_id=? AND id=?"
        ).bind(Date.now(), orgId, id).run();
        return ok({ resent: true });
      } catch (error) {
        const code = String(error?.code || error?.message || "EMAIL_SEND_FAILED").slice(0, 300);
        await db.prepare(
          "UPDATE newsletter_subscribers SET confirmation_error=? WHERE org_id=? AND id=?"
        ).bind(code, orgId, id).run();
        console.error("NEWSLETTER_CONFIRMATION_RESEND_FAILED", code);
        return err(502, code);
      }
    }

    const updates = Array.isArray(body.updates) ? body.updates : body.id ? [body] : [];
    if (!updates.length) return err(400, "MISSING_UPDATES");

    let changed = 0;
    for (const update of updates) {
      const id = String(update?.id || "").trim();
      const enc = update?.encrypted_blob ? String(update.encrypted_blob) : "";
      const kv = update?.key_version != null ? Number(update.key_version) : null;
      if (!id || !enc) continue;

      const result = await db.prepare(
        "UPDATE newsletter_subscribers SET encrypted_blob=?, key_version=COALESCE(?, key_version) WHERE org_id=? AND id=?"
      ).bind(enc, kv, orgId, id).run();
      changed += Number(result?.meta?.changes || 0);
    }

    return ok({ updated: true, changed });
  } catch (error) {
    console.error("NEWSLETTER_SUBSCRIBERS_POST_FAILED", error);
    return err(500, "NEWSLETTER_SUBSCRIBERS_FAILED");
  }
}

export async function onRequestDelete(ctx) {
  try {
    const state = await prepare(ctx);
    if (state.resp) return state.resp;
    const { db, orgId } = state;

    const body = await readJson(ctx.request);
    const id = String(body?.id || "").trim();
    if (!id) return err(400, "MISSING_ID");

    await db.prepare(
      "DELETE FROM newsletter_subscribers WHERE org_id=? AND id=?"
    ).bind(orgId, id).run();

    return ok({ deleted: true });
  } catch (error) {
    console.error("NEWSLETTER_SUBSCRIBERS_DELETE_FAILED", error);
    return err(500, "NEWSLETTER_SUBSCRIBERS_FAILED");
  }
}
