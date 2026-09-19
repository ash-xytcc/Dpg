import { bad } from "../_lib/http.js";
import { requireUser } from "../_lib/auth.js";

// dualpowerwest.org is a single, invite-only DPG instance. Creating arbitrary
// additional organizations would let any invited account mint a new owner
// workspace, defeating the instance membership model.
export async function onRequestPost({ request, env }) {
  if (!env.JWT_SECRET) return bad(500, "JWT_SECRET_MISSING");

  const user = await requireUser({ env, request });
  if (!user.ok) return user.resp;

  return bad(403, "ORG_CREATION_DISABLED");
}
