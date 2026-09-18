function getBucket(env) {
  return env?.DPG_SHARES_R2 || env?.SHARES_R2 || env?.R2 || env?.BF_R2 || null;
}

function bad(status, msg) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function parseRange(rangeHeader, size) {
  const m = String(rangeHeader || "").match(/^bytes=(\d*)-(\d*)$/i);
  if (!m) return null;

  const rawStart = m[1];
  const rawEnd = m[2];

  if (rawStart === "" && rawEnd === "") return null;

  if (rawStart === "") {
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    const start = Math.max(0, size - suffix);
    return { start, end: size - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd === "" ? size - 1 : Number(rawEnd);

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < start || start >= size) return null;

  return { start, end: Math.min(end, size - 1) };
}

export async function onRequestGet({ env, request, params }) {
  const key = decodeURIComponent(String(params.key || "").trim());
  if (!key) return bad(400, "MISSING_KEY");

  const bucket = getBucket(env);
  if (!bucket) return bad(500, "MISSING_R2_BINDING");

  const head = await bucket.head(key);
  if (!head) return bad(404, "FILE_NOT_FOUND");

  const size = Number(head.size || 0);
  const contentType =
    head.httpMetadata?.contentType ||
    "application/octet-stream";

  const rangeHeader = request.headers.get("range");
  const parsed = parseRange(rangeHeader, size);

  if (rangeHeader && !parsed) {
    return new Response(null, {
      status: 416,
      headers: {
        "accept-ranges": "bytes",
        "content-range": `bytes */${size}`,
      },
    });
  }

  if (parsed) {
    const length = parsed.end - parsed.start + 1;
    const obj = await bucket.get(key, {
      range: { offset: parsed.start, length },
    });

    return new Response(obj.body, {
      status: 206,
      headers: {
        "content-type": contentType,
        "content-length": String(length),
        "content-range": `bytes ${parsed.start}-${parsed.end}/${size}`,
        "accept-ranges": "bytes",
        "content-disposition": `inline; filename="${key.split("/").pop() || "file"}"`,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }

  const obj = await bucket.get(key);
  if (!obj) return bad(404, "FILE_NOT_FOUND");

  return new Response(obj.body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-length": String(size),
      "accept-ranges": "bytes",
      "content-disposition": `inline; filename="${key.split("/").pop() || "file"}"`,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
