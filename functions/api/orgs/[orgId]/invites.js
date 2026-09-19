import { ok, bad } from "../../_lib/http.js";
import { requireOrgRole, getDb } from "../../_lib/auth.js";

export async function onRequestGet(ctx) {
  return onRequest(ctx);
}

export async function onRequestPost(ctx) {
  return onRequest(ctx);
}

const ROLE_RANK = {
  viewer: 1,
  member: 1,
  participant: 1,
  organizer: 2,
  admin: 3,
  owner: 4,
};

function normalizeRole(role) {
  const r = String(role || "").toLowerCase();
  if (r === "viewer" || r === "member") return "participant";
  return r;
}

function canInvite(inviterRole, targetRole) {
  const inviter = normalizeRole(inviterRole);
  const target = normalizeRole(targetRole);
  if (inviter === "organizer") return target === "participant";
  if (inviter === "admin") return target === "participant" || target === "organizer";
  if (inviter === "owner") return target === "participant" || target === "organizer" || target === "admin";
  return false;
}

function randCode(len = 20) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function toInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

async function ensureInvitesTable(db) {
  await db
    .prepare(
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
    )
    .run();
  await db
    .prepare("CREATE INDEX IF NOT EXISTS idx_invites_org ON invites (org_id)")
    .run();
}

export async function onRequest(ctx) {
  if (!ctx.env?.JWT_SECRET) return bad(500, "JWT_SECRET_MISSING");
  const { request, env, params } = ctx;

  const db = getDb(env);
  if (!db) return bad(500, "NO_DB_BINDING");

  const orgId = params.orgId;
  const roleCheck = await requireOrgRole({ env, request, orgId, minRole: "organizer" });
  if (!roleCheck.ok) return roleCheck.resp;

  const actorRole = normalizeRole(roleCheck.role);
  const actorId = String(roleCheck.user?.sub || roleCheck.user?.userId || roleCheck.user?.id || "");

  try {
    await ensureInvitesTable(db);

    if (request.method === "GET") {
      const organizerOnly = actorRole === "organizer";
      const rows = organizerOnly
        ? await db
            .prepare(
              `SELECT code, role, uses, max_uses, expires_at, created_at, created_by
               FROM invites
               WHERE org_id = ? AND created_by = ?
               ORDER BY created_at DESC
               LIMIT 50`
            )
            .bind(orgId, actorId)
            .all()
        : await db
            .prepare(
              `SELECT code, role, uses, max_uses, expires_at, created_at, created_by
               FROM invites
               WHERE org_id = ?
               ORDER BY created_at DESC
               LIMIT 50`
            )
            .bind(orgId)
            .all();

      return ok({
        invites: (rows.results || []).map((r) => ({
          code: r.code,
          role: normalizeRole(r.role || "participant"),
          uses: toInt(r.uses, 0),
          max_uses: toInt(r.max_uses, 1),
          expires_at: r.expires_at ? Number(r.expires_at) : null,
          created_at: r.created_at ? Number(r.created_at) : null,
          created_by: r.created_by || null,
        })),
        permissions: {
          actor_role: actorRole,
          can_invite: actorRole !== "participant",
          allowed_roles:
            actorRole === "owner"
              ? ["participant", "organizer", "admin"]
              : actorRole === "admin"
                ? ["participant", "organizer"]
                : ["participant"],
        },
      });
    }

    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const role = normalizeRole(body.role || "participant");
      if (!ROLE_RANK[role] || role === "owner") return bad(400, "INVALID_ROLE");
      if (!canInvite(actorRole, role)) return bad(403, "INSUFFICIENT_ROLE_FOR_INVITE");

      const maxUses = Math.min(Math.max(toInt(body.maxUses ?? body.max_uses, 1) || 1, 1), 20);
      const expiresInDays = Math.min(Math.max(toInt(body.expiresInDays, 7) || 7, 1), 30);

      const now = Date.now();
      const expiresAt = now + expiresInDays * 24 * 60 * 60 * 1000;

      let code = null;
      for (let i = 0; i < 5; i++) {
        const candidate = randCode(20);
        const existing = await db
          .prepare("SELECT code FROM invites WHERE code = ? LIMIT 1")
          .bind(candidate)
          .first();
        if (!existing) {
          code = candidate;
          break;
        }
      }
      if (!code) return bad(500, "INVITE_CODE_COLLISION");

      await db
        .prepare(
          `INSERT INTO invites (org_id, code, role, uses, max_uses, expires_at, created_by, created_at)
           VALUES (?, ?, ?, 0, ?, ?, ?, ?)`
        )
        .bind(orgId, code, role, maxUses, expiresAt, actorId, now)
        .run();

      return ok({
        invite: {
          code,
          role,
          uses: 0,
          max_uses: maxUses,
          expires_at: expiresAt,
          created_at: now,
        },
      });
    }

    if (request.method === "DELETE") {
      const body = await request.json().catch(() => ({}));
      const code = String(body.code || "").trim().toUpperCase();
      if (!code) return bad(400, "MISSING_CODE");

      const invite = await db
        .prepare("SELECT code, created_by FROM invites WHERE org_id = ? AND code = ? LIMIT 1")
        .bind(orgId, code)
        .first();
      if (!invite) return bad(404, "INVITE_NOT_FOUND");

      if (actorRole === "organizer" && String(invite.created_by || "") !== actorId) {
        return bad(403, "INSUFFICIENT_ROLE");
      }

      await db
        .prepare("DELETE FROM invites WHERE org_id = ? AND code = ?")
        .bind(orgId, code)
        .run();

      return ok({ deleted: true, code });
    }

    return bad(405, "METHOD_NOT_ALLOWED");
  } catch (e) {
    return bad(500, e?.message || "INVITES_ERROR");
  }
}
