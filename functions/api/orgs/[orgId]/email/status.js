import { ok, err } from "../../../_lib/http.js";
import { requireOrgRole } from "../../../_lib/auth.js";
import { emailRuntimeStatus } from "../../../_lib/email.js";

export async function onRequestGet({ env, request, params }) {
  const orgId = String(params?.orgId || "").trim();
  if (!orgId) return err(400, "MISSING_ORG_ID");

  const auth = await requireOrgRole({ env, request, orgId, minRole: "organizer" });
  if (!auth.ok) return auth.resp;

  const email = emailRuntimeStatus(env);
  const relay = String(env?.RESEND_RELAY_URL || "").trim().replace(/\/+$/, "");

  if (relay) {
    try {
      const response = await fetch(relay + "/health", {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      email.relayReady = !!(response.ok && data?.ok);
      email.relayError = email.relayReady
        ? ""
        : String(data?.message || ("RELAY_HTTP_" + response.status)).slice(0, 300);
    } catch (error) {
      email.relayReady = false;
      email.relayError = String(error?.message || error || "RELAY_UNREACHABLE").slice(0, 300);
    }
  } else {
    email.relayReady = false;
    email.relayError = "RELAY_NOT_CONFIGURED";
  }

  email.resendConfigured = !!email.resendConfigured && !!email.relayReady;
  return ok({ email });
}
