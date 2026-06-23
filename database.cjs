/**
 * database.cjs — Synergy App SQLite data layer
 * Runs in the Electron main process ONLY.
 * DB file is stored in the Electron userData directory (never inside the source folder).
 */

const Database = require('better-sqlite3');
const path = require('path');

let db;
let _dbPath;

// ─────────────────────────────────────────────
//  Migration definitions
//  Each entry runs exactly once (tracked in schema_migrations).
//  SQL must use CREATE TABLE IF NOT EXISTS so it is safe on existing databases.
// ─────────────────────────────────────────────

const MIGRATIONS = [
  {
    id: '001_initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS patients (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        phone      TEXT,
        address    TEXT,
        condition  TEXT,
        type       TEXT NOT NULL DEFAULT 'OPD',
        dateAdded  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id          TEXT PRIMARY KEY,
        patientId   TEXT NOT NULL,
        type        TEXT NOT NULL,
        notes       TEXT,
        cost        REAL NOT NULL DEFAULT 0,
        date        TEXT NOT NULL,
        FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ipd_plans (
        id            TEXT PRIMARY KEY,
        patientId     TEXT NOT NULL,
        title         TEXT NOT NULL,
        totalSessions INTEGER NOT NULL DEFAULT 1,
        startDate     TEXT,
        notes         TEXT,
        FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS config (
        key   TEXT PRIMARY KEY,
        value TEXT
      );
    `,
  },
];

/**
 * Run all pending migrations. Each migration executes in a transaction
 * so a failure leaves the database unchanged rather than half-applied.
 */
function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(
    db.prepare('SELECT id FROM schema_migrations').all().map(r => r.id)
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;

    db.transaction(() => {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(
        migration.id,
        new Date().toISOString()
      );
    })();

    console.log('[DB] Applied migration:', migration.id);
  }
}

/**
 * Initialize the SQLite database.
 * @param {string} userDataPath — from app.getPath('userData')
 */
function initDatabase(userDataPath) {
  closeDatabase();

  _dbPath = path.join(userDataPath, 'synergy.db');
  db = new Database(_dbPath);

  // WAL mode: better read performance, safe concurrent access
  db.pragma('journal_mode = WAL');
  // Enforce referential integrity
  db.pragma('foreign_keys = ON');
  // Prevent silent hangs when the DB file is locked
  db.pragma('busy_timeout = 5000');

  runMigrations();

  console.log('[DB] Initialized at:', _dbPath);
  return _dbPath;
}

function closeDatabase() {
  if (!db) return false;

  db.close();
  db = undefined;
  _dbPath = undefined;
  return true;
}

/**
 * Return a safe read-only status object for health-check IPC.
 * Never throws — returns { ok: false, error } on failure.
 */
function healthCheck() {
  try {
    const row = db.prepare('SELECT COUNT(*) as count FROM patients').get();
    return {
      ok: true,
      patientCount: row.count,
      journalMode: db.pragma('journal_mode', { simple: true }),
      foreignKeys:  db.pragma('foreign_keys',  { simple: true }),
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─────────────────────────────────────────────
//  PATIENTS
// ─────────────────────────────────────────────

function getAllPatients() {
  return db.prepare('SELECT * FROM patients ORDER BY dateAdded DESC').all();
}

function addPatient({ id, name, phone, address, condition, type, dateAdded }) {
  const stmt = db.prepare(`
    INSERT INTO patients (id, name, phone, address, condition, type, dateAdded)
    VALUES (@id, @name, @phone, @address, @condition, @type, @dateAdded)
  `);
  stmt.run({ id, name, phone: phone || null, address: address || null, condition: condition || null, type: type || 'OPD', dateAdded });
  return { id, name, phone, address, condition, type, dateAdded };
}

function updatePatient({ id, name, phone, condition, type }) {
  const result = db.transaction(() => {
    const info = db.prepare(`
      UPDATE patients
         SET name = @name, phone = @phone, condition = @condition, type = @type
       WHERE id = @id
    `).run({ id, name, phone: phone ?? null, condition: condition ?? null, type });

    if (info.changes === 0) return null;
    return db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
  })();

  return result;
}

function deletePatient(id) {
  db.prepare('DELETE FROM patients WHERE id = ?').run(id);
}

function deletePatients(ids) {
  const del = db.prepare('DELETE FROM patients WHERE id = ?');
  const tx = db.transaction((idList) => {
    for (const id of idList) del.run(id);
  });
  tx(ids);
}

// ─────────────────────────────────────────────
//  SESSIONS
// ─────────────────────────────────────────────

function getAllSessions() {
  return db.prepare(`
    SELECT s.*, p.name as patientName
    FROM sessions s
    JOIN patients p ON s.patientId = p.id
    ORDER BY s.date DESC
  `).all();
}

function getSessionsByPatient(patientId) {
  return db.prepare('SELECT * FROM sessions WHERE patientId = ? ORDER BY date DESC').all(patientId);
}

function addSession({ id, patientId, type, notes, cost, date }) {
  db.prepare(`
    INSERT INTO sessions (id, patientId, type, notes, cost, date)
    VALUES (@id, @patientId, @type, @notes, @cost, @date)
  `).run({ id, patientId, type, notes: notes || null, cost: cost || 0, date });
  return { id, patientId, type, notes, cost, date };
}

function deleteSession(id) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

// ─────────────────────────────────────────────
//  IPD PLANS
// ─────────────────────────────────────────────

function getAllIpdPlans() {
  return db.prepare(`
    SELECT i.*, p.name as patientName
    FROM ipd_plans i
    JOIN patients p ON i.patientId = p.id
    ORDER BY i.startDate DESC
  `).all();
}

function addIpdPlan({ id, patientId, title, totalSessions, startDate, notes }) {
  db.prepare(`
    INSERT INTO ipd_plans (id, patientId, title, totalSessions, startDate, notes)
    VALUES (@id, @patientId, @title, @totalSessions, @startDate, @notes)
  `).run({ id, patientId, title, totalSessions: totalSessions || 1, startDate: startDate || null, notes: notes || null });
  return { id, patientId, title, totalSessions, startDate, notes };
}

function deleteIpdPlan(id) {
  db.prepare('DELETE FROM ipd_plans WHERE id = ?').run(id);
}

// ─────────────────────────────────────────────
//  CONFIG (key/value store for app settings)
// ─────────────────────────────────────────────

function getConfig(key) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setConfig(key, value) {
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, String(value));
}

module.exports = {
  initDatabase,
  closeDatabase,
  healthCheck,
  // patients
  getAllPatients,
  addPatient,
  updatePatient,
  deletePatient,
  deletePatients,
  // sessions
  getAllSessions,
  getSessionsByPatient,
  addSession,
  deleteSession,
  // ipd plans
  getAllIpdPlans,
  addIpdPlan,
  deleteIpdPlan,
  // config
  getConfig,
  setConfig,
};
