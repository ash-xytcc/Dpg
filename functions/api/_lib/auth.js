import { bad } from "./http.js";
import { verifyJwt } from "./jwt.js";
import { enforceOrgIsolationAccess, enforceOrgWriteLockdown, isWriteMethod } from "./orgLockdown.js";

export function getDb(env) {
  return env?.BF_DB || env?.DB || env?.db || null;
}

export async function requireUser({ env, request }) {
  const h = request.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/);

  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = {};
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    try { cookies[k] = decodeURIComponent(rest.join("=") || ""); }
    catch { cookies[k] = rest.join("=") || ""; }
  }

  // Session credentials are never accepted in a query string.
  const token = (m && m[1]) || cookies.bf_at || cookies.bf_auth_token || cookies.bf_token || "";
  if (!token) return { ok: false, resp: bad(401, "UNAUTHORIZED") };

  const payload = await verifyJwt(env.JWT_SECRET, token);
  if (!payload) return { ok: false, resp: bad(401, "UNAUTHORIZED") };

  const db = getDb(env);
  if (!db) return { ok: false, resp: bad(503, "AUTH_STATE_UNAVAILABLE") };
  const account = await db.prepare("SELECT id FROM users WHERE id = ?").bind(payload.sub || "").first();
  if (!account) return { ok: false, resp: bad(401, "UNAUTHORIZED") };

  return { ok: true, user: payload };
}

export async function requireOrgRole({ env, request, orgId, minRole, bypassWriteLockdown = false }) {
  const u = await requireUser({ env, request });
  if (!u.ok) return u;

  const roleRank = {
    viewer: 1,
    member: 1,
    participant: 1,
    organizer: 2,
    admin: 3,
    owner: 4,
  };
  const requested = String(minRole || "participant").toLowerCase();
  const need = roleRank[requested] || roleRank.participant;

  const db = getDb(env);
  if (!db) return { ok: false, resp: bad(500, "NO_DB_BINDING") };

  const row = await db.prepare(
    "SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?"
  ).bind(orgId, u.user.sub).first();

  if (!row) return { ok: false, resp: bad(403, "NOT_A_MEMBER") };

  const actualRole = String(row.role || "").toLowerCase();
  const actualRank = roleRank[actualRole] || 0;
  if (actualRank < need) return { ok: false, resp: bad(403, "INSUFFICIENT_ROLE") };

  if (actualRole !== "owner") {
    const isolation = await enforceOrgIsolationAccess({ env, orgId });
    if (!isolation.ok) return isolation;
  }

  if (!bypassWriteLockdown && isWriteMethod(request?.method)) {
    const lockdown = await enforceOrgWriteLockdown({ env, orgId });
    if (!lockdown.ok) return lockdown;
  }

  return { ok: true, user: u.user, role: actualRole };
}

export async function requireAuth(arg1, arg2) {
  if (arg2 && arg1?.headers) {
    return requireUser({ request: arg1, env: arg2 });
  }
  return requireUser(arg1);
}

export async function getUserIdFromRequest(request, env) {
  const u = await requireUser({ env, request });
  if (!u.ok) return null;
  const id = u.user?.sub || u.user?.userId || u.user?.uid || null;
  return id ? String(id) : null;
}
