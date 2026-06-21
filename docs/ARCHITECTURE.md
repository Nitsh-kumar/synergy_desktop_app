# docs/ARCHITECTURE.md — Synergy App Architecture

Last updated: 2026-06-22
Status: Active — Phase 3 complete

---

## 1. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Renderer (UI) | React | 19.x |
| Build tool | Vite | 8.x |
| Desktop shell | Electron | 42.x |
| Database | SQLite via `better-sqlite3` | 12.x |
| Language | JavaScript (JSX) | ES2020+ |
| Styling | Vanilla CSS (CSS variables, dark mode) | — |
| Packaging (future) | electron-builder | — |

---

## 2. Process Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Electron Main Process (main.cjs)                        │
│  • Creates BrowserWindow                                  │
│  • Owns SQLite database (via database.cjs)                │
│  • Handles all ipcMain.handle() calls                    │
│  • Validates ALL inputs before DB operations             │
│  • Node.js APIs available here                           │
└────────────────────┬────────────────────────────────────┘
                     │ IPC (ipcMain / ipcRenderer)
                     │ All calls validated in main
┌────────────────────▼────────────────────────────────────┐
│  Electron Preload (preload.cjs)                          │
│  • Runs in renderer context but has limited Node access  │
│  • Uses contextBridge.exposeInMainWorld('electronAPI')   │
│  • Exposes ONLY named, safe IPC wrapper functions        │
│  • Does NOT expose ipcRenderer directly                  │
│  • Does NOT expose fs, shell, process, or database       │
└────────────────────┬────────────────────────────────────┘
                     │ window.electronAPI (safe bridge)
┌────────────────────▼────────────────────────────────────┐
│  React Renderer (src/)                                   │
│  • React 19 + Vite                                       │
│  • No Node.js, no fs, no SQLite access                  │
│  • Communicates ONLY through window.electronAPI          │
│  • Runs in Chromium sandbox (isolated from OS)           │
└─────────────────────────────────────────────────────────┘
```

---

## 3. File Structure

```
synergy app/
├── main.cjs              # Electron main process (root — see deviation note)
├── preload.cjs           # Electron preload (root — see deviation note)
├── database.cjs          # SQLite data layer (main process only)
├── package.json          # Scripts, dependencies
├── vite.config.js        # Vite build config (base: './' for Electron)
├── .env.example          # Safe placeholder for secrets (committed)
├── .env                  # Real secrets (gitignored, never committed)
├── AGENTS.md             # AI agent and developer rules
├── docs/                 # Project documentation
│   ├── PROJECT_REQUIREMENTS.md
│   ├── ARCHITECTURE.md   (this file)
│   ├── PRIVACY_RULES.md
│   └── IMPLEMENTATION_ROADMAP.md
├── src/                  # React renderer
│   ├── main.jsx          # React entry point
│   ├── App.jsx           # Single-component app (all UI)
│   ├── App.css           # Component styles
│   └── index.css         # Global styles and CSS variables
├── public/               # Static assets
└── dist/                 # Vite build output (gitignored)
```

### File Location Deviation
> The Electron main and preload files are located in the **project root** as `main.cjs` and
> `preload.cjs` rather than in an `electron/` subfolder. This is because `package.json`
> uses `"type": "module"` (ES module mode for Vite), and the `.cjs` extension allows
> these files to use CommonJS `require()` as needed by Electron without conflict.
> The `package.json` `"main"` field points to `main.cjs` at the root.
> This structure is intentional and should not be changed without testing the full build.

---

## 4. Electron Security Configuration

All security settings are set in `main.cjs` inside `BrowserWindow({ webPreferences: {} })`.

| Setting | Value | Reason |
|---------|-------|--------|
| `contextIsolation` | `true` | Prevents renderer from accessing Node.js globals |
| `nodeIntegration` | `false` | Renderer cannot use Node.js `require()` |
| `preload` | `preload.cjs` | Only the preload bridge is exposed to renderer |
| `sandbox` | `true` | Preload uses only contextBridge + ipcRenderer — both available in sandboxed mode. DB is in main process only. |

### sandbox: true — Phase 3 Resolution
`sandbox` was set to `false` in Phase 2 with an incorrect comment ("required for better-sqlite3 in preload").
The database runs only in `main.cjs` — the preload script only uses `contextBridge` and `ipcRenderer`,
both of which are fully available in sandboxed mode. **`sandbox: true` was set in Phase 3.**

---

## 5. Migration System

Added in Phase 3. Tracked in the `schema_migrations` table.

- Migrations are defined in the `MIGRATIONS` array in `database.cjs`.
- Each migration runs exactly once (checked by ID against `schema_migrations`).
- Each migration executes inside a `db.transaction()` — atomic, no partial state on failure.
- All migration SQL uses `CREATE TABLE IF NOT EXISTS` — idempotent on existing databases.

See `docs/DATABASE_SCHEMA.md` for the full migration strategy and how to add future migrations.

---

## 6. IPC API Surface

The preload exposes `window.electronAPI` to the renderer with these namespaces:

```
window.electronAPI
  ├── ping()                          → 'pong' (connection test)
  ├── healthCheck()                   → { ok, patientCount, journalMode, foreignKeys }
  ├── patients
  │   ├── getAll()
  │   ├── add(patient)
  │   ├── delete(id)
  │   └── deleteMany(ids)
  ├── sessions
  │   ├── getAll()
  │   ├── getByPatient(patientId)
  │   ├── add(session)
  │   └── delete(id)
  ├── ipd
  │   ├── getAll()
  │   ├── add(plan)
  │   └── delete(id)
  └── config
      ├── get(key)
      └── set(key, value)
```

All IPC handlers in `main.cjs` validate inputs before touching the database.

---

## 7. Database

- **Engine**: `better-sqlite3` (synchronous SQLite, main process only)
- **Location**: `app.getPath('userData')` — e.g., `%APPDATA%\synergy-app\synergy.db` on Windows
- **Schema**: see `docs/DATABASE_SCHEMA.md` for full column/FK/index details
  - `schema_migrations` — migration tracking (added Phase 3)
  - `patients` — id, name, phone, address, condition, type (OPD/IPD), dateAdded
  - `sessions` — id, patientId, type, notes, cost, date (FK → patients, CASCADE)
  - `ipd_plans` — id, patientId, title, totalSessions, startDate, notes (FK → patients, CASCADE)
  - `config` — key, value (general app settings key-value store)
- **Pragmas**: `journal_mode = WAL`, `foreign_keys = ON`, `busy_timeout = 5000`
- **Migrations**: `MIGRATIONS[]` array in `database.cjs`, tracked in `schema_migrations` table

---

## 8. Known Phase Boundary Deviation

> **SQLite was added before Phase 3.**
>
> `database.cjs` (full schema + CRUD), all IPC handlers in `main.cjs`, and the renderer's
> `window.electronAPI` calls in `src/App.jsx` were implemented during Phase 2 rather than
> Phase 3 as specified in the roadmap. The app is currently fully SQLite-backed; there is
> no useState-only fallback mode.
>
> **Consequence for Phase 3**: Phase 3 will harden, test, and document the existing
> SQLite implementation rather than building it from scratch.
>
> **This deviation must not be used as justification for adding other future-phase
> features (billing, prescriptions, Groq AI) before their planned phases.**

---

## 9. Build and Development

### Development
```bash
npm run dev             # Start Vite dev server at http://localhost:5173
npm run electron:dev    # Start Vite + Electron together (uses concurrently + wait-on)
```

### Production Build
```bash
npm run build           # Vite production build → dist/
npm run electron:build  # Vite build + electron-builder Windows package
```

### Lint
```bash
npm run lint            # ESLint v9 flat config
```

### Key vite.config.js setting
`base: './'` — required so that Electron can load the built `dist/index.html` using
relative paths. Without this, asset paths would break in the packaged app.
