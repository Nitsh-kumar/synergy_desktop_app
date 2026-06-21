# docs/IMPLEMENTATION_ROADMAP.md — Synergy App Implementation Roadmap

Last updated: 2026-06-21

---

## Phase Status Overview

| Phase | Name | Status |
|-------|------|--------|
| Phase 0 | Repo Audit & Safety Baseline | ✅ Complete (stabilized 2026-06-21) |
| Phase 1 | Documentation & Agent Rules | ✅ Complete (2026-06-21) |
| Phase 2 | Electron Desktop Shell | ✅ Complete (stabilized 2026-06-21) |
| Phase 3 | SQLite Hardening & Testing | ✅ Complete (2026-06-22) |
| Phase 4 | Patient Management | 🔲 Next |
| Phase 5 | OPD Session Management | 🔲 Planned |
| Phase 6 | IPD / Therapy Plans | 🔲 Planned |
| Phase 7 | Template Upload (Letterhead & Bill) | 🔲 Planned |
| Phase 8 | Prescription PDF Generation | 🔲 Planned |
| Phase 9 | Billing | 🔲 Planned |
| Phase 10 | Groq AI Integration | 🔲 Planned |
| Phase 11 | Reports & Analytics | 🔲 Planned |
| Phase 12 | Backup & Restore | 🔲 Planned |
| Phase 13 | Windows Packaging & Distribution | 🔲 Planned |

---

## Phase Details

---

### Phase 0 — Repo Audit & Safety Baseline ✅

**Goal**: Inspect the existing codebase before making any changes.

**Completed tasks**:
- Inspected `package.json`, `vite.config.js`, `src/main.jsx`, `src/App.jsx`, `src/App.css`, `src/index.css`
- Identified current scripts, data model, and app behavior
- Confirmed `npm install`, `npm run build`, and `npm run lint` pass
- Identified existing security issues (hardcoded GitHub PAT)
- Confirmed no major feature changes were made during audit

**Stabilization tasks (completed 2026-06-21)**:
- Removed `deploy_to_github.cjs` containing the exposed GitHub PAT
- Added `.env` to `.gitignore`
- Created `.env.example`

---

### Phase 1 — Documentation & Agent Rules ✅

**Goal**: Write all project documentation and agent rules before any feature development.

**Completed**:
- `AGENTS.md` — Rules for all agents and developers
- `docs/PROJECT_REQUIREMENTS.md` — What the app must do
- `docs/ARCHITECTURE.md` — How the app is built
- `docs/PRIVACY_RULES.md` — Data and AI privacy constraints
- `docs/IMPLEMENTATION_ROADMAP.md` — This file

---

### Phase 2 — Electron Desktop Shell ✅

**Goal**: Wrap the React/Vite app in an Electron window with secure defaults.

**Completed**:
- Electron installed (v42.x)
- `main.cjs` — Electron main process with `contextIsolation: true`, `nodeIntegration: false`
- `preload.cjs` — Safe IPC bridge via `contextBridge`
- `vite.config.js` updated with `base: './'` for Electron compatibility
- `npm run build` passes
- `npm run lint` passes

**Stabilization tasks (completed 2026-06-21)**:
- Installed `electron-builder`, `concurrently`, `wait-on`
- Fixed `electron:dev` script to start Vite before Electron
- Updated `README.md`

**Known deviation**:
> SQLite (`better-sqlite3`) and full IPC handlers were added during Phase 2.
> This is a phase-boundary violation documented here and in `docs/ARCHITECTURE.md`.
> Phase 3 will test and harden this existing implementation.

---

### Phase 3 — SQLite Hardening & Testing ✅

**Goal**: Formally test, harden, and document the SQLite implementation that was added early.

**Completed (2026-06-22)**:
- [x] Added `PRAGMA busy_timeout = 5000` — prevents silent hangs on locked DB
- [x] Added migration system: `schema_migrations` table + `MIGRATIONS[]` array in `database.cjs`
- [x] Migrations are transactional and idempotent — safe on both fresh and existing installs
- [x] Added `healthCheck()` function + `db:healthCheck` IPC handler + `window.electronAPI.healthCheck()`
- [x] Added graceful DB init failure: error dialog + `app.quit()` instead of silent crash
- [x] Set `sandbox: true` in BrowserWindow — preload uses only contextBridge + ipcRenderer (both available in sandbox)
- [x] Resolved incorrect `sandbox: false` comment from Phase 2
- [x] Verified: all SQL uses parameterized queries (`db.prepare()`)
- [x] Verified: foreign keys ON, WAL mode ON, no DB access in renderer
- [x] Created `docs/DATABASE_SCHEMA.md` with full schema, IPC map, migration guide, risks
- [x] Updated `docs/ARCHITECTURE.md` with Phase 3 results
- [x] `npm run build` — ✅ pass
- [x] `npm run lint` — ✅ pass

**Phase boundary note**: SQLite was added before this phase. Phase 3 hardened/documented the existing implementation rather than building it fresh. See `docs/ARCHITECTURE.md` § Known Phase Boundary Deviation.

---

### Phase 4 — Patient Management 🔲

**Goal**: Polish and complete the patient management feature.

**Tasks** (to be refined when phase begins):
- Search and filter patients by name, type, condition
- Edit patient details
- View individual patient profile with session history
- Pagination or virtual scrolling for large patient lists

---

### Phase 5 — OPD Session Management 🔲

**Goal**: Complete the OPD session recording workflow.

**Tasks** (to be refined):
- Edit sessions
- Filter sessions by date, patient, type
- Session fee summary per patient
- Receipt/summary view

---

### Phase 6 — IPD / Therapy Plans 🔲

**Goal**: Complete the IPD therapy plan management workflow.

**Note**: IPD means therapy plan duration — NOT hospital admission.

**Tasks** (to be refined):
- Track session progress within a plan (sessions completed vs. total)
- Link OPD sessions to an IPD plan
- Mark plans as complete
- Plan history view

---

### Phase 7 — Template Upload 🔲

**Goal**: Allow the doctor to upload a prescription letterhead PDF and a bill template PDF.

**Rules**:
- Two separate upload slots — prescription letterhead and bill template
- Templates stored locally in `userData`
- No template merging or editing in-app

---

### Phase 8 — Prescription PDF Generation 🔲

**Goal**: Generate a prescription PDF by overlaying session data on the uploaded letterhead.

**Rules**:
- Uses the uploaded prescription letterhead from Phase 7
- Doctor reviews and approves before printing
- No AI involvement in Phase 8

---

### Phase 9 — Billing 🔲

**Goal**: Generate bills using the uploaded bill template PDF.

**Rules**:
- Uses the uploaded bill template from Phase 7
- Bill data comes from recorded sessions
- Doctor reviews before printing

---

### Phase 10 — Groq AI Integration 🔲

**Goal**: Add Groq API for clinical note drafting assistance.

**Rules** (strictly enforced — see `docs/PRIVACY_RULES.md`):
- Only anonymized clinical notes may be sent to Groq
- Patient name, phone, address, billing, and identifiers must NEVER be sent
- AI output is draft-only — doctor must approve before save/print
- Groq API key stored in `.env` only
- Feature is opt-in and clearly labeled as "AI Draft"

---

### Phase 11 — Reports & Analytics 🔲

**Goal**: Add summary reports for the doctor (revenue by month, sessions by type, etc.)

---

### Phase 12 — Backup & Restore 🔲

**Goal**: Allow the doctor to back up the SQLite database and restore from backup.

**Rules**:
- Backup is a local file copy only
- No automatic cloud backup unless explicitly requested

---

### Phase 13 — Windows Packaging & Distribution 🔲

**Goal**: Package the app as a Windows installer using `electron-builder`.

**Tasks**:
- Configure `electron-builder` in `package.json`
- Set app icon, name, version
- Generate NSIS installer for Windows
- Test installation on a clean Windows machine
- Code-sign the installer if possible

---

## Rules for All Phases

1. Each phase must be approved by the developer before starting.
2. A phase is not complete until `npm run build` and `npm run lint` both pass with 0 errors.
3. Do not begin a new phase until the previous phase is marked ✅ in this document.
4. Document any phase boundary violations immediately in this file and in `docs/ARCHITECTURE.md`.
