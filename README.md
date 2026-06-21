# Synergy App

A Windows desktop application for a physiotherapy and rehabilitation clinic.
Built with React + Vite + Electron, backed by a local SQLite database.

---

## Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + Vite 8 |
| Desktop shell | Electron 42 |
| Database | SQLite (`better-sqlite3`) — local only |
| Packaging | electron-builder |

---

## Development Commands

```bash
# Start Vite dev server only (browser preview)
npm run dev

# Start Electron app in development mode (Vite + Electron together)
npm run electron:dev

# Production build (Vite → dist/)
npm run build

# Lint
npm run lint

# Package as Windows installer
npm run electron:build
```

---

## Security

- **No secrets in source code.** API keys and tokens go in a local `.env` file only.
- Copy `.env.example` to `.env` and fill in values locally. Never commit `.env`.
- The renderer process has no direct access to Node.js, the filesystem, or SQLite.
  All sensitive operations go through the secure IPC bridge in `preload.cjs`.

---

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| Phase 0 | Repo Audit & Safety Baseline | ✅ Complete |
| Phase 1 | Documentation & Agent Rules | ✅ Complete |
| Phase 2 | Electron Desktop Shell | ✅ Complete |
| Phase 3 | SQLite Hardening & Testing | 🔲 Next |
| Phase 4–13 | Feature phases | 🔲 Planned |

See `docs/IMPLEMENTATION_ROADMAP.md` for full phase details.

