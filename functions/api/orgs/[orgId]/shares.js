import { ok, err, readJSON } from "../../_lib/http.js";
import { requireOrgRole } from "../../_lib/auth.js";
import { cleanShareInput, createShare, deleteShare, listOrgShares, updateShare } from "../../_lib/dpgShares.js";


export async function onRequestGet({ env, request, params }) {
  const orgId = String(params.orgId || "").trim();
  if (!orgId) return err(400, "MISSING_ORG_ID");

  const auth = await requireOrgRole({ env, request, orgId, minRole: "admin" });
  if (!auth.ok) return auth.resp;

  const shares = await listOrgShares(env, orgId, 100);
  return ok({ shares });
}

export async function onRequestPost({ env, request, params }) {
  const orgId = String(params.orgId || "").trim();
  if (!orgId) return err(400, "MISSING_ORG_ID");

  const auth = await requireOrgRole({ env, request, orgId, minRole: "admin" });
  if (!auth.ok) return auth.resp;

  const body = await readJSON(request);
  const input = cleanShareInput(body);

  if (!input.title) return err(400, "TITLE_REQUIRED");
  if (!input.videoUrl) return err(400, "VIDEO_URL_REQUIRED");

  const share = await createShare(env, orgId, auth.user?.sub || "", input);
  return ok({ share });
}


export async function onRequestPatch({ env, request, params }) {
  const orgId = String(params.orgId || "").trim();
  if (!orgId) return err(400, "MISSING_ORG_ID");

  const auth = await requireOrgRole({ env, request, orgId, minRole: "admin" });
  if (!auth.ok) return auth.resp;

  const body = await readJSON(request);
  const shareId = String(body?.id || "").trim();
  if (!shareId) return err(400, "MISSING_SHARE_ID");

  const input = cleanShareInput(body);
  const share = await updateShare(env, orgId, shareId, input);
  return ok({ share });
}


export async function onRequestDelete({ env, request, params }) {
  const orgId = String(params.orgId || "").trim();
  if (!orgId) return err(400, "MISSING_ORG_ID");

  const auth = await requireOrgRole({ env, request, orgId, minRole: "admin" });
  if (!auth.ok) return auth.resp;

  const body = await readJSON(request);
  const shareId = String(body?.id || "").trim();
  if (!shareId) return err(400, "MISSING_SHARE_ID");

  const deleteAssets = !!body?.deleteAssets;
  const share = await deleteShare(env, orgId, shareId, { deleteAssets });
  return ok({ deleted: true, share });
}
