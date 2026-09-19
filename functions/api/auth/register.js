import { json, bad, now, uuid } from "../_lib/http.js";
import { issueAccessToken, randomToken, sha256Hex, cookieHeadersForAuth } from "../_lib/session.js";

const PBKDF2_ITERS = 100000;
const INVITE_ROLE_MAP = {
  viewer: "participant",
  member: "participant",
  participant: "participant",
  organizer: "organizer",
  admin: "admin",
};

async function hashPass(pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pass),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERS, hash: "SHA-256" },
    key,
    256
  );
  const out = new Uint8Array(16 + 32);
  out.set(salt, 0);
  out.set(new Uint8Array(bits), 16);
  return btoa(String.fromCharCode(...out));
}

async function ensureInvitesTable(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS invites (
      code TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      role TEXT NOT NULL,
      uses INTEGER NOT NULL DEFAULT 0,
      max_uses INTEGER NOT NULL DEFAULT 1,
      expires_at INTEGER,
      created_at INTEGER NOT NULL,
      created_by TEXT NOT NULL
    )`
  ).run();
}

export async function onRequestPost({ env, request }) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const password = String(body.password || "");
    const inviteCode = String(body.inviteCode || body.invite_code || "").trim().toUpperCase();

    if (!email || !password || !inviteCode) return bad(400, "INVITE_REQUIRED");
    if (!env.BF_DB) return bad(500, "BF_DB_MISSING");
    if (!env.JWT_SECRET) return bad(500, "JWT_SECRET_MISSING");

    const db = env.BF_DB;
    await ensureInvitesTable(db);

    const invite = await db
      .prepare("SELECT * FROM invites WHERE code = ? LIMIT 1")
      .bind(inviteCode)
      .first();

    if (!invite) return bad(400, "INVALID_INVITE");
    if (invite.expires_at && Date.now() > Number(invite.expires_at)) return bad(400, "INVITE_EXPIRED");
    if (Number(invite.max_uses || 0) > 0 && Number(invite.uses || 0) >= Number(invite.max_uses)) {
      return bad(400, "INVITE_EXHAUSTED");
    }

    const role = INVITE_ROLE_MAP[String(invite.role || "").toLowerCase()];
    if (!role) return bad(400, "INVALID_INVITE_ROLE");

    const org = await db
      .prepare("SELECT id, name FROM orgs WHERE id = ? LIMIT 1")
      .bind(String(invite.org_id))
      .first();
    if (!org) return bad(400, "INVITE_ORG_MISSING");

    const exists = await db.prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first();
    if (exists) return bad(409, "EMAIL_EXISTS");

    const userId = uuid();
    const t = now();
    const passwordHash = await hashPass(password);

    try {
      await db.batch([
        db.prepare(
          "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?,?,?,?,?)"
        ).bind(userId, email, name || "", passwordHash, t),
        db.prepare(
          "INSERT INTO org_memberships (org_id, user_id, role, created_at) VALUES (?,?,?,?)"
        ).bind(String(invite.org_id), userId, role, t),
        db.prepare("UPDATE invites SET uses = uses + 1 WHERE code = ?")
          .bind(inviteCode),
      ]);
    } catch (e) {
      console.error("REGISTER_BATCH_FAILED", e);
      const msg = e?.message ? String(e.message) : "REGISTER_FAILED";
      return bad(500, msg);
    }

    const user = { id: userId, email, name: name || "" };
    const accessToken = await issueAccessToken(env, user, 60 * 15);
    const refreshToken = randomToken(32);
    const refreshHash = await sha256Hex(refreshToken);
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;

    await db.prepare(
      "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), userId, refreshHash, expiresAt).run();

    const isProd = (env?.ENV || env?.NODE_ENV || "").toLowerCase() === "production";
    const setCookies = cookieHeadersForAuth({ accessToken, refreshToken, isProd });

    const resp = json({
      ok: true,
      user,
      org: { id: org.id, name: org.name, role },
    });
    for (const c of setCookies) resp.headers.append("set-cookie", c);
    return resp;
  } catch (e) {
    console.error("REGISTER_THROW", e);
    const msg = e?.message ? String(e.message) : "REGISTER_FAILED";
    return bad(500, msg);
  }
}
