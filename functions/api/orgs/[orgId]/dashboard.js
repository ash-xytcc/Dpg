import { json } from "../../_lib/http.js";
import { requireOrgRole } from "../../_lib/auth.js";
import { ensureLocalCompatSchema } from "../../_lib/localCompat.js";

async function safeRun(env, sql, binds = []) {
  try {
    const stmt = env.BF_DB.prepare(sql);
    if (Array.isArray(binds) && binds.length) return await stmt.bind(...binds).run();
    return await stmt.run();
  } catch (e) {
    console.warn("dashboard safeRun failed", e);
    return null;
  }
}

async function safeFirst(env, sql, binds = [], fallback = null) {
  try {
    const stmt = env.BF_DB.prepare(sql);
    const res = Array.isArray(binds) ? await stmt.bind(...binds).first() : await stmt.first();
    return res ?? fallback;
  } catch (e) {
    console.warn("dashboard safeFirst failed", e);
    return fallback;
  }
}

async function safeAll(env, sql, binds = [], fallback = []) {
  try {
    const stmt = env.BF_DB.prepare(sql);
    const res = Array.isArray(binds) ? await stmt.bind(...binds).all() : await stmt.all();
    return Array.isArray(res?.results) ? res.results : fallback;
  } catch (e) {
    console.warn("dashboard safeAll failed", e);
    return fallback;
  }
}

async function ensureDashboardLocalCompatibility(env) {
  // Minimal local-safe tables/columns so dashboard queries do not explode on bootstrap databases.
  await safeRun(env, `CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    qty REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  )`);
  await safeRun(env, `CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    starts_at INTEGER,
    ends_at INTEGER,
    location TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  )`);
  await safeRun(env, `CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0
  )`);
  await safeRun(env, `CREATE TABLE IF NOT EXISTS attendees (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'captured',
    volunteer INTEGER NOT NULL DEFAULT 0,
    session_lead INTEGER NOT NULL DEFAULT 0,
    access_notes TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'public_rsvp',
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  )`);
  await safeRun(env, `CREATE TABLE IF NOT EXISTS pledges (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    qty REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  )`);
  await safeRun(env, `CREATE TABLE IF NOT EXISTS public_intakes (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    contact TEXT NOT NULL DEFAULT '',
    details TEXT NOT NULL DEFAULT '',
    extra TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new',
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  )`);
  await safeRun(env, `CREATE TABLE IF NOT EXISTS activity (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    actor_user_id TEXT,
    created_at INTEGER NOT NULL DEFAULT 0
  )`);

  const alterStatements = [
    "ALTER TABLE people ADD COLUMN encrypted_blob TEXT",
    "ALTER TABLE people ADD COLUMN key_version INTEGER",
    "ALTER TABLE needs ADD COLUMN encrypted_blob TEXT",
    "ALTER TABLE needs ADD COLUMN key_version INTEGER",
    "ALTER TABLE inventory ADD COLUMN encrypted_blob TEXT",
    "ALTER TABLE inventory ADD COLUMN key_version INTEGER",
    "ALTER TABLE inventory ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE meetings ADD COLUMN encrypted_blob TEXT",
    "ALTER TABLE meetings ADD COLUMN key_version INTEGER",
    "ALTER TABLE meetings ADD COLUMN agenda TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE newsletter_subscribers ADD COLUMN encrypted_blob TEXT",
    "ALTER TABLE newsletter_subscribers ADD COLUMN key_version INTEGER",
    "ALTER TABLE pledges ADD COLUMN encrypted_blob TEXT",
    "ALTER TABLE pledges ADD COLUMN key_version INTEGER",
  ];
  for (const sql of alterStatements) await safeRun(env, sql);

  await safeRun(
    env,
    `CREATE TABLE IF NOT EXISTS inventory_pars (
      org_id TEXT NOT NULL,
      inventory_id TEXT NOT NULL,
      par REAL,
      updated_at INTEGER,
      PRIMARY KEY (org_id, inventory_id)
    )`
  );
}

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const a = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!a.ok) return a.resp;

  await ensureLocalCompatSchema(env.BF_DB);

  // The dashboard should never hard-crash because one table is missing
  // (migrations happen, humans forget things, etc.).

  const peopleCount = await safeFirst(
    env,
    "SELECT COUNT(*) as c FROM people WHERE org_id = ?",
    [orgId],
    { c: 0 }
  );

  const needsOpenCount = await safeFirst(
    env,
    "SELECT COUNT(*) as c FROM needs WHERE org_id = ? AND status = 'open'",
    [orgId],
    { c: 0 }
  );

  const needsAllCount = await safeFirst(
    env,
    "SELECT COUNT(*) as c FROM needs WHERE org_id = ?",
    [orgId],
    { c: 0 }
  );

  const inventoryCount = await safeFirst(
    env,
    "SELECT COUNT(*) as c FROM inventory WHERE org_id = ?",
    [orgId],
    { c: 0 }
  );

  const nowMs = Date.now();
  const meetingsUpcomingCount = await safeFirst(
    env,
    "SELECT COUNT(*) as c FROM meetings WHERE org_id = ? AND starts_at IS NOT NULL AND starts_at >= ?",
    [orgId, nowMs],
    { c: 0 }
  );

  const nextMeeting = await safeFirst(
    env,
    "SELECT id, title, starts_at, encrypted_blob, key_version FROM meetings WHERE org_id = ? AND starts_at IS NOT NULL AND starts_at >= ? ORDER BY starts_at ASC LIMIT 1",
    [orgId, nowMs],
    null
  );

  const people = await safeAll(
    env,
    "SELECT id, name, encrypted_blob, key_version FROM people WHERE org_id = ? ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 5",
    [orgId],
    []
  );

  const needs = await safeAll(
    env,
    "SELECT id, title, status, encrypted_blob, key_version FROM needs WHERE org_id = ? ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 5",
    [orgId],
    []
  );

  const inventory = await safeAll(
    env,
    `SELECT i.id, i.name, i.qty, i.unit, i.category, i.encrypted_blob, i.key_version, ip.par
     FROM inventory i
     LEFT JOIN inventory_pars ip
       ON ip.org_id = i.org_id AND ip.inventory_id = i.id
     WHERE i.org_id = ?
     ORDER BY COALESCE(i.updated_at, i.created_at) DESC LIMIT 5`,
    [orgId],
    []
  );

  const attendeesCount = await safeFirst(
    env,
    "SELECT COUNT(*) as c FROM attendees WHERE org_id = ?",
    [orgId],
    { c: 0 }
  );

  const newsletterCount = await safeFirst(
    env,
    "SELECT COUNT(*) as c FROM newsletter_subscribers WHERE org_id = ?",
    [orgId],
    { c: 0 }
  );

  const pledgesCount = await safeFirst(
    env,
    "SELECT COUNT(*) as c FROM pledges WHERE org_id = ?",
    [orgId],
    { c: 0 }
  );

  const newsletter = await safeAll(
    env,
    "SELECT id, name, email, created_at, encrypted_blob, key_version FROM newsletter_subscribers WHERE org_id = ? ORDER BY created_at DESC LIMIT 5",
    [orgId],
    []
  );

  const pledges = await safeAll(
    env,
    "SELECT id, title, qty, unit, created_at, encrypted_blob, key_version FROM pledges WHERE org_id = ? ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 5",
    [orgId],
    []
  );

  const publicInboxCount = await safeFirst(
    env,
    `SELECT COUNT(*) as c FROM public_intakes WHERE org_id = ? AND kind IN ('get_help', 'offer_resources', 'volunteer') AND COALESCE(status, 'new') != 'closed'`,
    [orgId],
    { c: 0 }
  );

  const publicInbox = await safeAll(
    env,
    `SELECT id, kind, name, contact, details, extra, status, created_at, updated_at
     FROM public_intakes
     WHERE org_id = ? AND kind IN ('get_help', 'offer_resources', 'volunteer')
     ORDER BY created_at DESC LIMIT 5`,
    [orgId],
    []
  );

  const activity = await safeAll(
    env,
    "SELECT id, kind, message, actor_user_id, created_at FROM activity WHERE org_id = ? ORDER BY created_at DESC LIMIT 25",
    [orgId],
    []
  );

  return json({
    ok: true,
    counts: {
      people: peopleCount?.c || 0,
      needsOpen: needsOpenCount?.c || 0,
      needsAll: needsAllCount?.c || 0,
      inventory: inventoryCount?.c || 0,
      meetingsUpcoming: meetingsUpcomingCount?.c || 0,
      attendees: attendeesCount?.c || 0,
      rsvps: attendeesCount?.c || 0,
      newsletter: newsletterCount?.c || 0,
      pledges: pledgesCount?.c || 0,
      publicInbox: publicInboxCount?.c || 0,
    },
    nextMeeting: nextMeeting || null,
    people,
    needs,
    inventory,
    newsletter,
    pledges,
    publicInbox,
    activity,
  });
}
