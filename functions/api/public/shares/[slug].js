import { ok, err } from "../../_lib/http.js";
import { getPublicShareBySlug } from "../../_lib/dpgShares.js";

export async function onRequestGet({ env, request, params }) {
  try {
    const url = new URL(request.url);
    const orgId = String(url.searchParams.get("org") || "dpg").trim() || "dpg";
    const slug = String(params.slug || "").trim();
    if (!slug) return err(400, "MISSING_SLUG");

    const share = await getPublicShareBySlug(env, orgId, slug);
    if (!share) return err(404, "SHARE_NOT_FOUND");

    return ok({ orgId, share });
  } catch (e) {
    return err(500, String(e?.message || e || "FAILED_TO_GET_SHARE"));
  }
}
