# docs/PROJECT_REQUIREMENTS.md — Synergy App Project Requirements

Last updated: 2026-06-21
Status: Active — Phase 2 complete (Electron shell stabilized)

---

## 1. App Purpose

Synergy is a **Windows desktop application** for internal use by a single physiotherapy clinic.
It is used by a **single doctor** to manage patient records, OPD sessions, and IPD therapy plans.

---

## 2. Target Platform

| Attribute | Value |
|-----------|-------|
| Platform | Windows desktop |
| Distribution | Local install, not a web app |
| Internet requirement | Not required for core functionality (offline-first) |
| Cloud sync | Not planned unless explicitly requested |
| Users | Single doctor (one user, no multi-user login) |

---

## 3. Data Architecture

- **Local-first / offline-first**: All data is stored locally on the doctor's machine.
- **Database**: SQLite, stored in the Electron `userData` directory (never inside the source folder).
- **No cloud database**: No Firebase, Supabase, PostgreSQL, or any remote DB.
- **No cloud sync**: Data does not leave the machine unless the doctor explicitly exports it.

---

## 4. Clinical Domain Definitions

### OPD — Outpatient / Regular Consultation
- OPD stands for **Outpatient Department** in this clinic context.
- It means a **regular patient visit or consultation**.
- The patient comes for a single appointment and goes home the same day.
- OPD does NOT imply hospital admission.

### IPD — Therapy Plan / Treatment Course
- IPD stands for **Inpatient Department** in this clinic context, but it is **not used to mean hospital admission**.
- In Synergy, IPD means a **structured therapy plan or treatment course** spanning multiple sessions over a period of time.
- Examples: "Lumbar Spine Rehabilitation — 12 sessions over 4 weeks".
- IPD patients are managed under an IPD plan that tracks total planned sessions and start date.

---

## 5. Feature Scope (Phase-Controlled)

Only features that have been approved for the current and completed phases should exist in the codebase.

### Currently Implemented (Phases 0–2, with Phase 3 early addition)
- Patient directory (add, view, delete, export CSV)
- OPD session recording (type, fee, notes, date)
- IPD therapy plan creation (title, total sessions, start date, notes)
- KPI dashboard (total patients, revenue, sessions, active IPD plans)
- SQLite persistence via Electron IPC (added early — see ARCHITECTURE.md)

### Future Features (Not Yet Implemented)
- Prescription PDF generation using uploaded letterhead template (Phase 8)
- Billing using uploaded bill template PDF (Phase 9)
- Groq API integration for clinical note drafting (Phase 10)
- Reports and analytics (Phase 11)
- Backup and restore (Phase 12)
- Windows packaging for distribution (Phase 13)

---

## 6. Template Upload Requirements (Future — Phase 7)

- **Prescription letterhead**: The doctor will upload a PDF file that serves as the printed letterhead.
  The app will overlay generated text onto this template for printing.
- **Bill template**: The doctor will upload a separate PDF file for billing.
  These are separate files and must not be combined.
- Templates are uploaded by the doctor from within the app settings.
- Templates are stored locally.

---

## 7. Groq AI Integration Requirements (Future — Phase 10)

- Groq API will be used only for **drafting anonymized clinical notes**.
- The AI does not make decisions. It only provides draft text for the doctor to review.
- **Privacy constraint**: Only anonymized clinical text may be sent to Groq.
  Patient name, phone, address, billing amounts, and any direct identifier must NEVER be sent.
- The doctor must review and approve all AI output before it is saved or printed.
- The Groq API key must be stored in `.env` only, never in source code.

---

## 8. Non-Requirements (Explicitly Out of Scope)

The following are NOT planned and must NOT be added without explicit approval:

- Multi-user login or role-based access
- Cloud database or cloud sync
- Web app version or browser access
- Telemedicine or video features
- Insurance billing or e-claims
- Automated scheduling or appointment booking
- Hospital admission management (IPD here means therapy plans, not admission)
