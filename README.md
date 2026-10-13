# Synergy — Clinic Desktop Application

A local Windows desktop application for a physiotherapy clinic, built with React, Vite, Electron, and SQLite.

The source contains patient records, OPD session workflows, and therapy-plan data. Here, **IPD means a therapy attendance plan**, not hospital admission.

**Status:** development snapshot with unresolved source dependencies. Do not treat this revision as a validated clinical release.

## Architecture

| Layer | Responsibility |
| --- | --- |
| React renderer | Clinic interface |
| Electron preload | Exposes selected IPC methods |
| Electron main | Coordinates desktop operations and database access |
| SQLite / better-sqlite3 | Local persistence |
| electron-builder | Intended Windows packaging |

See [architecture](docs/ARCHITECTURE.md), [database schema](docs/DATABASE_SCHEMA.md), and [privacy rules](docs/PRIVACY_RULES.md).

## Current source blockers

The reviewed tree does not include modules referenced by the application:

- `lib/securityService.cjs`
- `lib/securityIpc.cjs`
- `src/lib/patientCsv.js`
- `src/lib/patientFilters.js`
- `src/lib/userErrors.js`

These must be recovered or implemented before claiming the desktop flow runs. Existing security interfaces also need consistency checks.

## Development commands

Read [AGENTS.md](AGENTS.md) before implementation. Use Windows and a Node.js release compatible with the Electron/Vite/native SQLite dependencies.

```bash
npm ci
npm run dev
npm run electron:dev
```

`dev` starts only the browser renderer. Clinic data operations require Electron's preload/IPC bridge; browser preview is not a functioning desktop database session.

```bash
npm run lint
npm run build
npm run electron:build
```

Packaging includes a build step. Do not run it as proof of readiness before restoring missing modules and validating native dependencies.

## Tests and phase status

Tests are present under [tests](tests), but `package.json` declares no test script. The older roadmap records Phase 3 as complete and Phase 4 as next; that historical record is not a fresh verification of this revision.

Prescriptions, billing templates, Groq assistance, backup/restore, and distribution are later roadmap goals. This documentation pass adds none of those features.

## Data handling

Keep patient data local and out of logs, screenshots, source control, and external AI services. Use synthetic records for development. Validate access control, migrations, backup/restore, and recovery before clinical use.

The roadmap records a past token exposure. Confirm that issued token was revoked; removing the source file alone is insufficient.

See [project status](docs/PROJECT_STATUS.md) and the [implementation roadmap](docs/IMPLEMENTATION_ROADMAP.md).

## Validation

This documentation was checked against repository files on 13 October 2026. Builds, application runs, and test suites were not executed during this documentation pass. Commands below describe the intended local workflow, not a verified deployment.
