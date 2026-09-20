import http from "node:http";

const HOST = String(process.env.RESEND_RELAY_HOST || "0.0.0.0").trim() || "0.0.0.0";
const PORT = Number(process.env.RESEND_RELAY_PORT || 8790);
const MAX_BODY = 2 * 1024 * 1024;

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  res.end(body);
}

async function readBody(req) {
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return sendJson(res, 200, { ok: true, relay: "ready" });
    }

    if (req.method !== "POST" || (req.url !== "/emails" && req.url !== "/emails/batch")) {
      return sendJson(res, 404, { message: "NOT_FOUND" });
    }

    const apiKey = String(req.headers["x-dpg-resend-key"] || "").trim();
    if (!apiKey) {
      return sendJson(res, 503, { message: "RESEND_NOT_CONFIGURED" });
    }

    const raw = await readBody(req);
    const payload = raw ? JSON.parse(raw) : {};
    const target = req.url === "/emails/batch"
      ? "https://api.resend.com/emails/batch"
      : "https://api.resend.com/emails";

    const headers = {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    };
    const idempotencyKey = String(req.headers["idempotency-key"] || "").trim();
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey.slice(0, 256);

    const upstream = await fetch(target, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    res.writeHead(upstream.status, {
      "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(text);
  } catch (error) {
    sendJson(res, 502, {
      message: String(error?.message || error || "RESEND_RELAY_FAILED").slice(0, 500),
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`DPG Resend relay listening on http://${HOST}:${PORT}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
