import { bad } from "./http.js";
import { verifyJwt } from "./jwt.js";

// Bindings can be named differently across environments.
// Try a few common ones so we don't explode into a Cloudflare 500 HTML page.
export function getDb(env) {
  return env?.BF_DB || env?.DB || env?.db || null;
}

export async function requireUser({ env, request }) {
  const h = request.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/);
  // Support both Bearer auth AND cookie sessions (httpOnly).
  // This allows a gradual migration away from localStorage tokens.
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = {};
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    cookies[k] = decodeURIComponent(rest.join("=") || "");
  }

  const url = new URL(request.url);
  const queryToken = url.searchParams.get("bf_token") || "";
  const token = (m && m[1]) || cookies.bf_at || cookies.bf_auth_token || cookies.bf_token || queryToken || "";
  if (!token) return { ok: false, resp: bad(401, "UNAUTHORIZED") };

  const payload = await verifyJwt(env.JWT_SECRET, token);
  if (!payload) return { ok: false, resp: bad(401, "UNAUTHORIZED") };

  return { ok: true, user: payload };
}

const ORG_ROLE_RANK = {
  participant: 1,
  organizer: 2,
  admin: 3,
  owner: 4,
};

// Legacy roles are normalized at the authorization boundary so older
// memberships keep their historical capabilities without weakening the new
// participant/organizer split.
export function normalizeOrgRole(role) {
  const raw = String(role || "").trim().toLowerCase();
  if (raw === "viewer") return "participant";
  if (raw === "member" || raw === "editor") return "organizer";
  if (Object.prototype.hasOwnProperty.call(ORG_ROLE_RANK, raw)) return raw;
  return null;
}

export async function requireOrgRole({ env, request, orgId, minRole }) {
  const u = await requireUser({ env, request });
  if (!u.ok) return u;

  const requestedRole = normalizeOrgRole(minRole || "participant");
  if (!requestedRole) {
    return { ok: false, resp: bad(500, "INVALID_ROLE_POLICY") };
  }

  const db = getDb(env);
  if (!db) return { ok: false, resp: bad(500, "NO_DB_BINDING") };

  const row = await db.prepare(
    "SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?"
  ).bind(orgId, u.user.sub).first();

  if (!row) return { ok: false, resp: bad(403, "NOT_A_MEMBER") };

  const memberRole = normalizeOrgRole(row.role);
  if (!memberRole || ORG_ROLE_RANK[memberRole] < ORG_ROLE_RANK[requestedRole]) {
    return { ok: false, resp: bad(403, "INSUFFICIENT_ROLE") };
  }

  return { ok: true, user: u.user, role: memberRole };
}

// Back-compat alias: earlier endpoints used `requireAuth`.
// Pages Functions bundling fails if an imported name is missing.
export async function requireAuth(arg1, arg2) {
  // Support both:
  //   requireAuth({ env, request })
  //   requireAuth(request, env)
  if (arg2 && arg1?.headers) {
    return requireUser({ request: arg1, env: arg2 });
  }
  return requireUser(arg1);
}

// Convenience helper used by some endpoints.
// Returns a user id string or null.
export async function getUserIdFromRequest(request, env) {
  const u = await requireUser({ env, request });
  if (!u.ok) return null;
  const id = u.user?.sub || u.user?.userId || u.user?.uid || null;
  return id ? String(id) : null;
}
