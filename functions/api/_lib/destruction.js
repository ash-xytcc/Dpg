import { getDriveBucket } from './drive.js';

const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ORG_KEY_TABLES = new Set(['org_crypto', 'org_keys', 'org_key_wrapped', 'org_key_recovery']);

function quoted(name) {
  if (!SAFE_IDENTIFIER.test(String(name || ''))) throw new Error('UNSAFE_TABLE_NAME');
  return `"${name}"`;
}

async function listTables(db) {
  const result = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  return (result?.results || []).map((row) => String(row?.name || '')).filter((name) => SAFE_IDENTIFIER.test(name));
}

async function tableColumns(db, tableName) {
  const result = await db.prepare(`PRAGMA table_info(${quoted(tableName)})`).all();
  return (result?.results || []).map((row) => ({ name: String(row?.name || ''), notNull: Number(row?.notnull || 0) === 1 }));
}

async function organizationScope(db, orgId) {
  const names = await listTables(db);
  const scope = [{ name: 'orgs', columns: await tableColumns(db, 'orgs'), where: '"id"=?', args: [orgId] }];

  for (const name of names) {
    if (name === 'orgs') continue;
    const columns = await tableColumns(db, name);
    if (columns.some((column) => column.name === 'org_id')) {
      scope.push({ name, columns, where: '"org_id"=?', args: [orgId] });
    }
  }

  for (let pass = 0; pass < names.length; pass += 1) {
    let added = false;
    for (const name of names) {
      if (scope.some((entry) => entry.name === name)) continue;
      const columns = await tableColumns(db, name);
      const keys = await db.prepare(`PRAGMA foreign_key_list(${quoted(name)})`).all();
      const predicates = [];
      const args = [];
      for (const key of keys?.results || []) {
        const parent = scope.find((entry) => entry.name === key.table);
        if (!parent || !key.to || !SAFE_IDENTIFIER.test(key.from) || !SAFE_IDENTIFIER.test(key.to)) continue;
        predicates.push(`${quoted(key.from)} IN (SELECT ${quoted(key.to)} FROM ${quoted(parent.name)} WHERE ${parent.where})`);
        args.push(...parent.args);
      }
      if (predicates.length) {
        scope.push({ name, columns, where: predicates.map((p) => `(${p})`).join(' OR '), args });
        added = true;
      }
    }
    if (!added) break;
  }
  return scope;
}

async function driveStorageKeys(db, orgId) {
  const table = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='drive_files'").first();
  if (!table?.name) return [];
  const result = await db.prepare('SELECT storage_key FROM drive_files WHERE org_id=? AND storage_key IS NOT NULL')
    .bind(orgId).all();
  return (result.results || []).map((row) => String(row.storage_key || '')).filter(Boolean);
}

export async function getOrgDestructionPreview({ db, orgId }) {
  const org = await db.prepare('SELECT id,name FROM orgs WHERE id=? LIMIT 1').bind(orgId).first();
  if (!org) return null;
  const scope = await organizationScope(db, orgId);
  const tableCounts = {};
  let totalRows = 0;
  for (const entry of scope) {
    const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${quoted(entry.name)} WHERE ${entry.where}`)
      .bind(...entry.args).first();
    const count = Number(row?.n || 0);
    if (count) tableCounts[entry.name] = count;
    totalRows += count;
  }
  let keyMaterialRows = 0;
  for (const name of ORG_KEY_TABLES) keyMaterialRows += Number(tableCounts[name] || 0);
  return {
    org: { id: org.id, name: org.name },
    memberCount: Number(tableCounts.org_memberships || 0),
    totalRows,
    driveObjectCount: (await driveStorageKeys(db, orgId)).length,
    keyMaterialRows,
    tableCounts,
    confirmationPhrase: `DESTROY ${String(org.name || '').trim()}`,
    erasure: {
      activeDataDeleted: false,
      keyMaterialDestroyed: false,
      fullHistoricalGuarantee: false,
      limitation: 'Provider backups and copies already downloaded to other devices are outside this deletion.',
    },
  };
}

async function deleteDriveObjects(env, db, orgId) {
  const bucket = getDriveBucket(env);
  const keys = await driveStorageKeys(db, orgId);
  if (!bucket) return 0;
  let deleted = 0;
  for (const key of [...new Set(keys)]) {
    try { await bucket.delete(key); deleted += 1; } catch {}
  }
  return deleted;
}

async function deletePublicConfig(env, orgId) {
  const store = env?.BF_PUBLIC;
  if (!store) return;
  try {
    const raw = await store.get(`org:${orgId}`);
    const config = raw ? JSON.parse(raw) : null;
    const slug = String(config?.slug || '').trim().toLowerCase();
    if (slug && await store.get(`slug:${slug}`) === orgId) await store.delete(`slug:${slug}`);
    await store.delete(`org:${orgId}`);
  } catch {}
}

export async function destroyOrgData({ env, db, orgId }) {
  const preview = await getOrgDestructionPreview({ db, orgId });
  if (!preview) return null;
  const scope = await organizationScope(db, orgId);
  await deletePublicConfig(env, orgId);
  const deletedDriveObjects = await deleteDriveObjects(env, db, orgId);

  const statements = [db.prepare('PRAGMA defer_foreign_keys = ON')];
  for (const entry of [...scope].reverse()) {
    statements.push(db.prepare(`DELETE FROM ${quoted(entry.name)} WHERE ${entry.where}`).bind(...entry.args));
  }
  await db.batch(statements);

  return {
    orgId,
    deletedRows: preview.totalRows,
    deletedDriveObjects,
    destroyedKeyMaterialRows: preview.keyMaterialRows,
  };
}

export async function listSoleOwnedOrgs({ db, userId }) {
  const result = await db.prepare(`SELECT o.id,o.name FROM org_memberships mine
    JOIN orgs o ON o.id=mine.org_id
    WHERE mine.user_id=? AND mine.role='owner'
      AND 1=(SELECT COUNT(*) FROM org_memberships owners WHERE owners.org_id=mine.org_id AND owners.role='owner')
    ORDER BY o.name`).bind(userId).all();
  return (result.results || []).map((row) => ({ id: row.id, name: row.name }));
}

export async function destroyAccountData({ db, userId }) {
  const blockers = await listSoleOwnedOrgs({ db, userId });
  if (blockers.length) return { ok: false, blockers };

  const tables = await listTables(db);
  const statements = [db.prepare('PRAGMA defer_foreign_keys = ON')];
  const refColumns = new Set(['actor_user_id', 'created_by', 'updated_by', 'updated_by_user_id', 'lockdown_set_by_user_id', 'lockdown_cleared_by_user_id', 'isolated_by_user_id', 'recovered_by_user_id']);

  for (const tableName of tables) {
    if (tableName === 'users') continue;
    const columns = await tableColumns(db, tableName);
    if (columns.some((column) => column.name === 'user_id')) {
      statements.push(db.prepare(`DELETE FROM ${quoted(tableName)} WHERE user_id=?`).bind(userId));
    }
    for (const column of columns) {
      if (refColumns.has(column.name) && !column.notNull) {
        statements.push(db.prepare(`UPDATE ${quoted(tableName)} SET ${quoted(column.name)}=NULL WHERE ${quoted(column.name)}=?`).bind(userId));
      }
    }
  }

  statements.push(db.prepare('DELETE FROM users WHERE id=?').bind(userId));
  await db.batch(statements);
  return { ok: true };
}
