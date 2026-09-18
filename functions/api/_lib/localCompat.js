async function safeRun(db, sql) {
  try {
    await db.prepare(sql).run();
  } catch {}
}

export async function ensureLocalCompatSchema(db) {
  // Inventory table + columns expected by current UI/API.
  await safeRun(db, `CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    qty REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    is_public INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
  )`);
  await safeRun(db, `CREATE INDEX IF NOT EXISTS idx_inventory_org ON inventory(org_id)`);
  await safeRun(db, `ALTER TABLE inventory ADD COLUMN qty REAL NOT NULL DEFAULT 0`);
  await safeRun(db, `ALTER TABLE inventory ADD COLUMN unit TEXT NOT NULL DEFAULT ''`);
  await safeRun(db, `ALTER TABLE inventory ADD COLUMN category TEXT NOT NULL DEFAULT ''`);
  await safeRun(db, `ALTER TABLE inventory ADD COLUMN location TEXT NOT NULL DEFAULT ''`);
  await safeRun(db, `ALTER TABLE inventory ADD COLUMN notes TEXT NOT NULL DEFAULT ''`);
  await safeRun(db, `ALTER TABLE inventory ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0`);
  await safeRun(db, `ALTER TABLE inventory ADD COLUMN created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)`);
  await safeRun(db, `ALTER TABLE inventory ADD COLUMN updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)`);
  await safeRun(db, `ALTER TABLE inventory ADD COLUMN encrypted_notes TEXT`);
  await safeRun(db, `ALTER TABLE inventory ADD COLUMN encrypted_blob TEXT`);
  await safeRun(db, `ALTER TABLE inventory ADD COLUMN key_version INTEGER`);

  // Meetings table + columns expected by current UI/API.
  await safeRun(db, `CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    starts_at INTEGER,
    ends_at INTEGER,
    location TEXT NOT NULL DEFAULT '',
    agenda TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    is_public INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
  )`);
  await safeRun(db, `CREATE INDEX IF NOT EXISTS idx_meetings_org ON meetings(org_id)`);
  await safeRun(db, `ALTER TABLE meetings ADD COLUMN starts_at INTEGER`);
  await safeRun(db, `ALTER TABLE meetings ADD COLUMN ends_at INTEGER`);
  await safeRun(db, `ALTER TABLE meetings ADD COLUMN location TEXT NOT NULL DEFAULT ''`);
  await safeRun(db, `ALTER TABLE meetings ADD COLUMN agenda TEXT NOT NULL DEFAULT ''`);
  await safeRun(db, `ALTER TABLE meetings ADD COLUMN notes TEXT NOT NULL DEFAULT ''`);
  await safeRun(db, `ALTER TABLE meetings ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0`);
  await safeRun(db, `ALTER TABLE meetings ADD COLUMN created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)`);
  await safeRun(db, `ALTER TABLE meetings ADD COLUMN updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)`);
  await safeRun(db, `ALTER TABLE meetings ADD COLUMN encrypted_notes TEXT`);
  await safeRun(db, `ALTER TABLE meetings ADD COLUMN encrypted_blob TEXT`);
  await safeRun(db, `ALTER TABLE meetings ADD COLUMN key_version INTEGER`);

  await safeRun(db, `CREATE TABLE IF NOT EXISTS inventory_pars (
    org_id TEXT NOT NULL,
    inventory_id TEXT NOT NULL,
    par REAL,
    updated_at INTEGER,
    PRIMARY KEY (org_id, inventory_id)
  )`);
}
