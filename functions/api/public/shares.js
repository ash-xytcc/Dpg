import { ok, err } from "../_lib/http.js";
import { listPublicShares } from "../_lib/dpgShares.js";

export async function onRequestGet({ env, request }) {
  try {
    const url = new URL(request.url);
    const orgId = String(url.searchParams.get("org") || "dpg").trim() || "dpg";
    const limit = Math.max(1, Math.min(24, Number(url.searchParams.get("limit") || 12) || 12));
    const data = await listPublicShares(env, orgId, limit);
    return ok({
      orgId,
      items: data.items,
      featured: data.featured,
    });
  } catch (e) {
    return err(500, String(e?.message || e || "FAILED_TO_LIST_SHARES"));
  }
}
