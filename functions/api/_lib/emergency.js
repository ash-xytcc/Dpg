import { getDb, requireOrgRole, requireUser } from './auth.js';
import { bad, now, uuid } from './http.js';

const SENSITIVE_META_KEY = /(token|secret|key|cookie|password|recovery|payload|plaintext|authorization)/i;

function sanitizeMeta(input, depth = 0) {
  if (depth > 3) return '[truncated]';
  if (input == null) return null;
  if (Array.isArray(input)) return input.slice(0, 20).map((item) => sanitizeMeta(item, depth + 1));
  if (typeof input === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(input).slice(0, 30)) {
      out[k] = SENSITIVE_META_KEY.test(k) ? '[redacted]' : sanitizeMeta(v, depth + 1);
    }
    return out;
  }
  if (typeof input === 'string' && input.length > 300) return `${input.slice(0, 300)}...[truncated]`;
  return input;
}

export async function ensureEmergencySchema(env) {
  const db = getDb(env);
  if (!db) return { ok: false, resp: bad(500, 'NO_DB_BINDING') };

  await db.prepare(`CREATE TABLE IF NOT EXISTS emergency_status (
    id TEXT PRIMARY KEY,
    is_active INTEGER NOT NULL DEFAULT 0,
    level TEXT NOT NULL DEFAULT 'normal',
    message TEXT NOT NULL DEFAULT '',
    started_at INTEGER,
    ended_at INTEGER,
    updated_by_user_id TEXT,
    updated_at INTEGER NOT NULL
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS org_emergency_state (
    org_id TEXT PRIMARY KEY,
    lockdown_enabled INTEGER NOT NULL DEFAULT 0,
    lockdown_reason TEXT NOT NULL DEFAULT '',
    lockdown_set_by_user_id TEXT,
    lockdown_set_at INTEGER,
    lockdown_cleared_by_user_id TEXT,
    lockdown_cleared_at INTEGER,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS emergency_protocol_state (
    org_id TEXT PRIMARY KEY,
    stage TEXT NOT NULL DEFAULT 'normal',
    isolated INTEGER NOT NULL DEFAULT 0,
    isolated_by_user_id TEXT,
    isolated_at INTEGER,
    recovered_by_user_id TEXT,
    recovered_at INTEGER,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS emergency_reports (
    id TEXT PRIMARY KEY,
    org_id TEXT,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    status TEXT NOT NULL DEFAULT 'recorded',
    actor_user_id TEXT,
    summary TEXT NOT NULL,
    details_json TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
  )`).run();

  await db.prepare('CREATE INDEX IF NOT EXISTS idx_emergency_reports_org_created ON emergency_reports(org_id, created_at DESC)').run();
  return { ok: true, db };
}

export async function readEmergencyStatus({ env, request, orgId = null }) {
  const user = await requireUser({ env, request });
  if (!user.ok) return user;

  const state = await ensureEmergencySchema(env);
  if (!state.ok) return state;

  const globalRow = await state.db.prepare(`SELECT id,is_active,level,message,started_at,ended_at,updated_at
    FROM emergency_status WHERE id='global'`).first();

  let orgLockdown = null;
  let orgProtocol = null;
  if (orgId) {
    const gate = await requireOrgRole({ env, request, orgId, minRole: 'participant', bypassWriteLockdown: true });
    if (!gate.ok) return gate;

    orgLockdown = await state.db.prepare(`SELECT org_id,lockdown_enabled,lockdown_reason,
      lockdown_set_by_user_id,lockdown_set_at,lockdown_cleared_by_user_id,lockdown_cleared_at,updated_at
      FROM org_emergency_state WHERE org_id=?`).bind(orgId).first();

    orgProtocol = await state.db.prepare(`SELECT org_id,stage,isolated,isolated_by_user_id,isolated_at,
      recovered_by_user_id,recovered_at,updated_at FROM emergency_protocol_state WHERE org_id=?`)
      .bind(orgId).first();
  }

  return {
    ok: true,
    user: user.user,
    status: {
      id: 'global',
      isActive: !!globalRow?.is_active,
      level: String(globalRow?.level || 'normal'),
      message: String(globalRow?.message || ''),
      startedAt: globalRow?.started_at || null,
      endedAt: globalRow?.ended_at || null,
      updatedAt: globalRow?.updated_at || null,
    },
    orgLockdown: orgLockdown ? {
      orgId: orgLockdown.org_id,
      enabled: !!orgLockdown.lockdown_enabled,
      reason: String(orgLockdown.lockdown_reason || ''),
      updatedAt: orgLockdown.updated_at || null,
    } : null,
    orgProtocol: orgProtocol ? {
      orgId: orgProtocol.org_id,
      stage: String(orgProtocol.stage || 'normal'),
      isolated: !!orgProtocol.isolated,
      isolatedAt: orgProtocol.isolated_at || null,
      updatedAt: orgProtocol.updated_at || null,
    } : {
      orgId,
      stage: 'normal',
      isolated: false,
      isolatedAt: null,
      updatedAt: null,
    },
  };
}

export async function writeEmergencyReport({ env, request, orgId, eventType, severity = 'info', status = 'recorded', summary, details = null }) {
  const user = await requireUser({ env, request });
  if (!user.ok) return user;
  if (orgId) {
    const gate = await requireOrgRole({ env, request, orgId, minRole: 'admin', bypassWriteLockdown: true });
    if (!gate.ok) return gate;
  }
  const state = await ensureEmergencySchema(env);
  if (!state.ok) return state;
  const safeSummary = String(summary || '').trim().slice(0, 500);
  if (!safeSummary) return { ok: false, resp: bad(400, 'MISSING_SUMMARY') };
  const id = uuid();
  await state.db.prepare(`INSERT INTO emergency_reports
    (id,org_id,event_type,severity,status,actor_user_id,summary,details_json,created_at)
    VALUES(?,?,?,?,?,?,?,?,?)`).bind(
      id, orgId, String(eventType || 'emergency.report'), String(severity),
      String(status), user.user?.sub || null, safeSummary,
      details ? JSON.stringify(sanitizeMeta(details)) : null, now()
    ).run();
  return { ok: true, reportId: id };
}

export async function readEmergencyReports({ env, request, orgId, limit = 25 }) {
  const gate = await requireOrgRole({ env, request, orgId, minRole: 'participant', bypassWriteLockdown: true });
  if (!gate.ok) return gate;
  const state = await ensureEmergencySchema(env);
  if (!state.ok) return state;
  const result = await state.db.prepare(`SELECT id,org_id,event_type,status,actor_user_id,summary,created_at
    FROM emergency_reports WHERE org_id=? ORDER BY created_at DESC LIMIT ?`)
    .bind(orgId, Math.max(1, Math.min(100, Number(limit) || 25))).all();
  return {
    ok: true,
    reports: (result.results || []).map((row) => ({
      id: row.id,
      orgId: row.org_id,
      eventType: row.event_type,
      outcome: row.status,
      actorUserId: row.actor_user_id || null,
      summary: row.summary,
      createdAt: Number(row.created_at) || null,
    })),
  };
}
