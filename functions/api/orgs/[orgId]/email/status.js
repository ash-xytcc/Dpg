import { ok, err } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";
import { emailRuntimeStatus } from "../../../_lib/email.js";

export async function onRequestGet({ env, request, params }) {
  const orgId = String(params?.orgId || "").trim();
  if (!orgId) return err(400, "MISSING_ORG_ID");

  const auth = await requireOrgRole({ env, request, orgId, minRole: "organizer" });
  if (!auth.ok) return auth.resp;

  return ok({ email: emailRuntimeStatus(env) });
}
