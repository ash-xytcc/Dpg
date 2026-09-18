import { ok, err } from "../../_lib/http.js";
import { requireOrgRole } from "../../_lib/auth.js";

function getBucket(env) {
  return env?.DPG_SHARES_R2 || env?.SHARES_R2 || env?.R2 || env?.BF_R2 || null;
}

function sanitizeBaseName(name = "") {
  return String(name || "")
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "video";
}

function getExt(name = "", type = "") {
  const byName = String(name || "").match(/(\.[a-z0-9]+)$/i)?.[1] || "";
  if (byName) return byName.toLowerCase();

  const t = String(type || "").toLowerCase();
  if (t.includes("mp4")) return ".mp4";
  if (t.includes("webm")) return ".webm";
  if (t.includes("ogg")) return ".ogg";
  if (t.includes("quicktime")) return ".mov";
  return ".bin";
}

export async function onRequestPost({ env, request, params }) {
  const orgId = String(params.orgId || "").trim();
  if (!orgId) return err(400, "MISSING_ORG_ID");

  const auth = await requireOrgRole({ env, request, orgId, minRole: "admin" });
  if (!auth.ok) return auth.resp;

  const bucket = getBucket(env);
  if (!bucket) return err(500, "MISSING_R2_BINDING");

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  if (!file || typeof file.arrayBuffer !== "function") {
    return err(400, "FILE_REQUIRED");
  }

  const type = String(file.type || "").toLowerCase();
  if (!type.startsWith("video/")) {
    return err(400, "VIDEO_FILE_REQUIRED");
  }

  const size = Number(file.size || 0);
  if (!size || size < 1) {
    return err(400, "EMPTY_FILE");
  }

  const ext = getExt(file.name, file.type);
  const base = sanitizeBaseName(file.name);
  const key = `dpg-${orgId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}${ext}`;

  const buf = await file.arrayBuffer();
  await bucket.put(key, buf, {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
  });

  return ok({
    key,
    url: `/api/public/share-file/${encodeURIComponent(key)}`,
    filename: String(file.name || ""),
    contentType: String(file.type || ""),
    size,
  });
}
