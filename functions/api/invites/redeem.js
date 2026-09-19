import { json, bad } from "../_lib/http.js";
import { getDb, requireUser } from "../_lib/auth.js";

function normalizeRole(role) {
  const r = String(role || "").toLowerCase();
  if (r === "viewer" || r === "member") return "participant";
  return r;
}

export async function onRequestPost({ request, env }) {
  if (!env.JWT_SECRET) return bad(500, "JWT_SECRET_MISSING");

  const u = await requireUser({ env, request });
  if (!u.ok) return u.resp;
  const userId = u.user?.sub || u.user?.userId || u.user?.id;
  if (!userId) return bad(401, "UNAUTHORIZED");

  const db = getDb(env);
  if (!db) return bad(500, "NO_DB_BINDING");

  const body = await request.json().catch(() => ({}));
  const cleanCode = String(body.code || "").trim().toUpperCase();
  if (!cleanCode) return json({ ok: false, error: "Missing invite code" }, 400);

  try {
    const invite = await db
      .prepare("SELECT * FROM invites WHERE code = ?")
      .bind(cleanCode)
      .first();

    if (!invite) return json({ ok: false, error: "Invalid invite code" }, 400);
    if (invite.expires_at && Date.now() > Number(invite.expires_at)) {
      return json({ ok: false, error: "Invite expired" }, 400);
    }
    if (Number(invite.max_uses || 0) > 0 && Number(invite.uses || 0) >= Number(invite.max_uses)) {
      return json({ ok: false, error: "Invite exhausted" }, 400);
    }

    const role = normalizeRole(invite.role || "participant");
    if (!["participant", "organizer", "admin"].includes(role)) {
      return bad(400, "INVALID_INVITE_ROLE");
    }

    const existing = await db
      .prepare("SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?")
      .bind(invite.org_id, userId)
      .first();

    if (!existing) {
      await db.batch([
        db.prepare(
          `INSERT INTO org_memberships (org_id, user_id, role, created_at)
           VALUES (?, ?, ?, ?)`
        ).bind(invite.org_id, userId, role, Date.now()),
        db.prepare("UPDATE invites SET uses = uses + 1 WHERE code = ?")
          .bind(cleanCode),
      ]);
    }

    const org = await db
      .prepare("SELECT id, name FROM orgs WHERE id = ?")
      .bind(invite.org_id)
      .first();

    return json({
      ok: true,
      org: org ? { id: org.id, name: org.name } : { id: invite.org_id },
      membership: { role: existing ? normalizeRole(existing.role) : role },
      already_member: !!existing,
    });
  } catch (e) {
    return bad(500, e?.message || "INVITE_REDEEM_ERROR");
  }
}
