# docs/DATABASE_SCHEMA.md — Synergy App Database Schema

Last updated: 2026-06-22
Status: Active — Phase 3 complete

---

## 1. Database Overview

| Property | Value |
|----------|-------|
| Engine | SQLite via `better-sqlite3` v12.x |
| Access mode | Synchronous (main process only) |
| Location | `app.getPath('userData')` → `%APPDATA%\synergy-app\synergy.db` on Windows |
| Journal mode | WAL (Write-Ahead Logging) — better concurrent read performance |
| Foreign keys | ON — referential integrity enforced at DB level |
| Busy timeout | 5000 ms — prevents silent hangs on locked DB |
| Initialized by | `database.cjs` → `initDatabase(userDataPath)` called from `main.cjs` |

The database file is **never** created inside the project `src/`, `dist/`, or install directory.

---

## 2. Migration Strategy

Migrations are tracked in the `schema_migrations` table. Each migration:

- Has a unique `id` (e.g., `001_initial_schema`)
- Runs exactly once (checked against `schema_migrations` before execution)
- Executes inside a `db.transaction()` — atomic, no half-applied state on failure
- Uses `CREATE TABLE IF NOT EXISTS` — safe on both fresh installs and existing databases

### How to add a future migration

Add a new entry to the `MIGRATIONS` array in `database.cjs`:

```js
{
  id: '002_add_patient_dob',
  sql: `ALTER TABLE patients ADD COLUMN dob TEXT;`,
}
```

The new migration will run automatically on the next app start. Never edit or delete existing migrations.

---

## 3. Tables

### 3.1 `schema_migrations`

Tracks which migrations have been applied.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Migration identifier (e.g., `001_initial_schema`) |
| `applied_at` | TEXT | NOT NULL | ISO 8601 timestamp when the migration ran |

---

### 3.2 `patients`

Stores all patient registrations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | `Date.now()-random` string ID |
| `name` | TEXT | NOT NULL | Patient's full name |
| `phone` | TEXT | nullable | Contact phone number |
| `address` | TEXT | nullable | Patient address |
| `condition` | TEXT | nullable | Primary diagnosis/condition |
| `type` | TEXT | NOT NULL, DEFAULT `'OPD'` | `'OPD'` or `'IPD'` |
| `dateAdded` | TEXT | NOT NULL | ISO 8601 timestamp when patient was registered |

**Primary key:** `id`  
**Foreign keys:** none  
**Indexes:** none (Phase 4 should add index on `name` for search performance)  
**Cascade:** sessions and ipd_plans are deleted when a patient is deleted

**Note on ID format:** IDs are generated as `Date.now()-random` (e.g., `1719000000000-abc1234`). This is sufficient for a single-user local app. Do not change the ID format without a data migration.

---

### 3.3 `sessions`

Records individual OPD (outpatient) visits or therapy sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | `Date.now()-random` string ID |
| `patientId` | TEXT | NOT NULL, FK → `patients.id` | Links session to a patient |
| `type` | TEXT | NOT NULL | Session type (e.g., `'Consultation'`, `'Physiotherapy'`) |
| `notes` | TEXT | nullable | Clinical notes for this session |
| `cost` | REAL | NOT NULL, DEFAULT `0` | Session fee in INR |
| `date` | TEXT | NOT NULL | ISO 8601 timestamp when session was recorded |

**Primary key:** `id`  
**Foreign keys:** `patientId` → `patients(id)` ON DELETE CASCADE  
**Indexes:** none (Phase 5 should add index on `patientId` and `date`)

---

### 3.4 `ipd_plans`

Records IPD-style therapy plans (duration/attendance plans — NOT hospital admission).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | `Date.now()-random` string ID |
| `patientId` | TEXT | NOT NULL, FK → `patients.id` | Links plan to a patient |
| `title` | TEXT | NOT NULL | Plan name/description |
| `totalSessions` | INTEGER | NOT NULL, DEFAULT `1` | Total number of therapy sessions planned |
| `startDate` | TEXT | nullable | ISO 8601 planned start date |
| `notes` | TEXT | nullable | Additional notes for the plan |

**Primary key:** `id`  
**Foreign keys:** `patientId` → `patients(id)` ON DELETE CASCADE  
**Indexes:** none (Phase 6 should add index on `patientId`)

---

### 3.5 `config`

General key-value store for application settings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `key` | TEXT | PRIMARY KEY | Setting name (e.g., `'clinicName'`, `'schemaVersion'`) |
| `value` | TEXT | nullable | Setting value (always stored as string) |

**Primary key:** `key`  
**Foreign keys:** none  
**Indexes:** none (primary key lookup is sufficient)

---

## 4. IPC Access Pattern

The renderer **cannot** access the database directly. All access goes through:

```
React renderer (src/)
  └─ window.electronAPI.{method}()          [contextBridge — preload.cjs]
       └─ ipcRenderer.invoke('channel', ...) [preload.cjs]
            └─ ipcMain.handle('channel', ...) [main.cjs]
                 └─ db.{function}(...)        [database.cjs]
```

### Exposed API surface (`window.electronAPI`)

| Method | IPC Channel | DB Operation |
|--------|------------|--------------|
| `ping()` | `ping` | none |
| `healthCheck()` | `db:healthCheck` | read-only status query |
| `patients.getAll()` | `patients:getAll` | SELECT all patients |
| `patients.add(patient)` | `patients:add` | INSERT patient |
| `patients.delete(id)` | `patients:delete` | DELETE patient (cascades) |
| `patients.deleteMany(ids)` | `patients:deleteMany` | DELETE multiple patients (transaction) |
| `sessions.getAll()` | `sessions:getAll` | SELECT all sessions JOIN patients |
| `sessions.getByPatient(id)` | `sessions:getByPatient` | SELECT sessions for one patient |
| `sessions.add(session)` | `sessions:add` | INSERT session |
| `sessions.delete(id)` | `sessions:delete` | DELETE session |
| `ipd.getAll()` | `ipd:getAll` | SELECT all plans JOIN patients |
| `ipd.add(plan)` | `ipd:add` | INSERT plan |
| `ipd.delete(id)` | `ipd:delete` | DELETE plan |
| `config.get(key)` | `config:get` | SELECT config value |
| `config.set(key, value)` | `config:set` | INSERT OR REPLACE config |

**No raw SQL endpoint is exposed. No `fs`, `shell`, `process`, or direct DB object is exposed.**

---

## 5. Safety Checklist

| Property | Status |
|----------|--------|
| `PRAGMA foreign_keys = ON` | ✅ Set on every DB open |
| `PRAGMA journal_mode = WAL` | ✅ Set on every DB open |
| `PRAGMA busy_timeout = 5000` | ✅ Set on every DB open (added Phase 3) |
| Parameterized SQL | ✅ All queries use `db.prepare()` with `?` or named bindings |
| No string concatenation for values | ✅ Verified in all CRUD functions |
| Transactions for multi-step writes | ✅ `deletePatients` uses transaction; migrations use transaction |
| DB in userData path | ✅ `app.getPath('userData')` used exclusively |
| No DB access in renderer | ✅ contextBridge + IPC only |
| Graceful init failure | ✅ Error dialog + `app.quit()` (added Phase 3) |
| Migration system | ✅ `schema_migrations` table + `MIGRATIONS[]` array (added Phase 3) |

---

## 6. Known Risks and Limitations

### ID Generation
Current IDs use `Date.now()-random`. Under high-frequency inserts (multiple records per millisecond), a collision is theoretically possible, but is not realistic for a single-doctor local app. Future phases may replace this with `crypto.randomUUID()` if needed — requires a migration to update existing rows.

### No `updated_at` timestamps
`patients`, `sessions`, and `ipd_plans` do not have `updated_at` fields. Edit operations are not yet implemented (Phase 4+). When editing is added, an `updated_at` column should be added via a new migration.

### No search indexes
No indexes exist on frequently searched columns (e.g., `patients.name`, `sessions.patientId`). For small datasets (<1000 patients), this is not a problem. Phase 4 should add:
```sql
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
CREATE INDEX IF NOT EXISTS idx_sessions_patient ON sessions(patientId);
CREATE INDEX IF NOT EXISTS idx_ipd_plans_patient ON ipd_plans(patientId);
```

### `better-sqlite3` native module packaging
`better-sqlite3` is a native Node.js addon (compiled C++). When packaging with `electron-builder` for distribution:
- The prebuilt binary for the target Electron version must be included.
- `electron-builder` with `npmRebuild: true` (default) handles this for the host architecture.
- Cross-compilation (building a Windows installer on macOS/Linux) requires additional configuration.
- Test the packaged app on a clean Windows machine before distributing (Phase 13).

---

## 7. Phase 3 Test Results

| Test | Result |
|------|--------|
| `npm run build` | ✅ Pass |
| `npm run lint` | ✅ Pass |
| DB location verified at userData path | ✅ Confirmed in code — `app.getPath('userData')` |
| `PRAGMA foreign_keys = ON` | ✅ Set in code |
| `PRAGMA journal_mode = WAL` | ✅ Set in code |
| `PRAGMA busy_timeout = 5000` | ✅ Added Phase 3 |
| Migration system (`schema_migrations` table) | ✅ Added Phase 3 |
| Health check IPC (`db:healthCheck`) | ✅ Added Phase 3 |
| Graceful init failure (dialog + quit) | ✅ Added Phase 3 |
| `sandbox: true` | ✅ Set Phase 3 (preload uses only contextBridge + ipcRenderer) |
| Parameterized SQL review | ✅ All queries verified |
| No raw SQL IPC endpoint | ✅ Confirmed |
| No fs/process/DB exposed to renderer | ✅ Confirmed |
