const json = (data, init = 200) =>
  new Response(JSON.stringify(data), {
    status: init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });

async function ensurePublicInbox(env) {
  const db = env.BF_DB;

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS public_inbox (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'message',
      name TEXT,
      email TEXT,
      phone TEXT,
      contact TEXT,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      source TEXT,
      event_slug TEXT,
      attendee_count INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();

  try {
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_public_inbox_org_created ON public_inbox(org_id, created_at DESC)`).run();
  } catch {}
  try {
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_public_inbox_org_status ON public_inbox(org_id, status)`).run();
  } catch {}

  const cols = await db.prepare(`PRAGMA table_info(public_inbox)`).all();
  const names = new Set((cols.results || []).map(c => c.name));

  const missing = [
    ["kind", "ALTER TABLE public_inbox ADD COLUMN kind TEXT NOT NULL DEFAULT 'message'"],
    ["name", "ALTER TABLE public_inbox ADD COLUMN name TEXT"],
    ["email", "ALTER TABLE public_inbox ADD COLUMN email TEXT"],
    ["phone", "ALTER TABLE public_inbox ADD COLUMN phone TEXT"],
    ["contact", "ALTER TABLE public_inbox ADD COLUMN contact TEXT"],
    ["details", "ALTER TABLE public_inbox ADD COLUMN details TEXT"],
    ["status", "ALTER TABLE public_inbox ADD COLUMN status TEXT NOT NULL DEFAULT 'new'"],
    ["source", "ALTER TABLE public_inbox ADD COLUMN source TEXT"],
    ["event_slug", "ALTER TABLE public_inbox ADD COLUMN event_slug TEXT"],
    ["attendee_count", "ALTER TABLE public_inbox ADD COLUMN attendee_count INTEGER"],
    ["updated_at", "ALTER TABLE public_inbox ADD COLUMN updated_at INTEGER"],
  ];

  for (const [name, sql] of missing) {
    if (!names.has(name)) {
      try { await db.prepare(sql).run(); } catch {}
    }
  }
}

function now() {
  return Date.now();
}

function makeId() {
  return crypto.randomUUID();
}

export async function onRequestOptions() {
  return json({ ok: true });
}

export async function onRequestGet(context) {
  const { env, params } = context;
  const orgId = params.orgId;

  if (!orgId) return json({ ok: false, error: "ORG_REQUIRED" }, 400);

  await ensurePublicInbox(env);

  const r = await env.BF_DB.prepare(`
    SELECT id, org_id, kind, name, email, phone, contact, details, status, source, event_slug, attendee_count, created_at, updated_at
    FROM public_inbox
    WHERE org_id = ?
    ORDER BY created_at DESC
    LIMIT 200
  `).bind(orgId).all();

  return json({ ok: true, items: r.results || [] });
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const orgId = params.orgId;

  if (!orgId) return json({ ok: false, error: "ORG_REQUIRED" }, 400);

  await ensurePublicInbox(env);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "BAD_JSON" }, 400);
  }

  const t = now();
  const item = {
    id: makeId(),
    org_id: orgId,
    kind: String(body.kind || "message").trim() || "message",
    name: body.name == null ? "" : String(body.name),
    email: body.email == null ? "" : String(body.email),
    phone: body.phone == null ? "" : String(body.phone),
    contact: body.contact == null ? "" : String(body.contact),
    details: body.details == null ? "" : String(body.details),
    status: String(body.status || "new").trim() || "new",
    source: body.source == null ? "" : String(body.source),
    event_slug: body.event_slug == null ? "" : String(body.event_slug),
    attendee_count: Number(body.attendee_count || 1) || 1,
    created_at: t,
    updated_at: t,
  };

  if (!item.name && !item.email && !item.phone && !item.details) {
    return json({ ok: false, error: "EMPTY_SUBMISSION" }, 400);
  }

  await env.BF_DB.prepare(`
    INSERT INTO public_inbox (
      id, org_id, kind, name, email, phone, contact, details, status, source, event_slug, attendee_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    item.id,
    item.org_id,
    item.kind,
    item.name,
    item.email,
    item.phone,
    item.contact || item.email || item.phone || "",
    item.details,
    item.status,
    item.source,
    item.event_slug,
    item.attendee_count,
    item.created_at,
    item.updated_at
  ).run();

  return json({ ok: true, item }, 201);
}
