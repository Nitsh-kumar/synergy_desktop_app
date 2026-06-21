# docs/PRIVACY_RULES.md — Synergy App Privacy Rules

Last updated: 2026-06-21
Status: Active — enforced from Phase 10 (Groq AI integration) onward.
        Rules in §1–§3 apply from Phase 0 onward.

---

## 1. Data Storage Rules (All Phases)

- All patient data is stored **locally only**, on the doctor's machine.
- Data is never transmitted to any external server, cloud service, or third party
  unless explicitly documented and approved for a specific phase.
- The SQLite database file is located in the Electron `userData` directory and
  is never inside the project source folder.

---

## 2. Secret Management Rules (All Phases)

- API keys, tokens, and passwords must NEVER be written into source code files.
- Store secrets in a local `.env` file only. The `.env` file is in `.gitignore`
  and must never be committed.
- The `.env.example` file contains only empty placeholder variable names — never
  real values.
- If a secret is ever discovered in source code, it must be removed immediately,
  the secret must be revoked/rotated, and the developer must be notified.
- Never log or print API keys in console output, log files, or documentation.

---

## 3. Access Control (All Phases)

- The Electron renderer process must never directly access:
  - The filesystem (`fs` module)
  - The SQLite database
  - `process.env` (environment variables)
  - Node.js built-in modules
- All sensitive operations go through the IPC bridge in `preload.cjs`.
- The IPC bridge exposes only named, pre-validated functions — never raw `ipcRenderer`.

---

## 4. Groq AI Privacy Rules (Phase 10 onward)

### What May Be Sent to Groq

| Data Type | May Send? | Notes |
|-----------|-----------|-------|
| Anonymized clinical notes | ✅ YES | e.g., "Patient presents with lumbar pain, ROM restricted" |
| Session type | ✅ YES | e.g., "Physiotherapy", "Manual Therapy" |
| General condition description | ✅ YES | Only if it does not identify the patient |
| Patient name | ❌ NO | Never |
| Patient phone number | ❌ NO | Never |
| Patient address | ❌ NO | Never |
| Patient ID | ❌ NO | Never |
| Billing amounts | ❌ NO | Never |
| Session fee | ❌ NO | Never |
| Any identifier that could link data to a specific person | ❌ NO | Never |

### Anonymization Requirement
Before sending any text to Groq, the application must strip or replace:
- Patient names (replace with "the patient" or omit)
- Phone numbers, addresses, or IDs
- Dates of birth or age if too specific
- Any other personally identifiable information (PII)

### AI Output Rules
- AI-generated output from Groq is a **draft only**.
- It must be clearly marked as "AI Draft — Pending Doctor Review" in the UI.
- The doctor must **explicitly approve** the output before it is:
  - Saved to the database
  - Printed
  - Included in a prescription or bill
- The app must never auto-save AI-generated content without doctor action.

### Groq API Key Rules
- The Groq API key must be stored in `.env` as `GROQ_API_KEY`.
- It must never be hardcoded in any source file.
- It must never be logged to the console or written to any log file.
- It must never be exposed to the renderer process through `window.electronAPI`.

---

## 5. Future Data Export Rules

- CSV export (currently implemented for patients) exports data to the doctor's local machine only.
- No export function should automatically upload data to any external service.
- If a backup feature is added (Phase 12), the backup file must be stored locally
  or in a location explicitly chosen by the doctor.

---

## 6. Compliance Note

This app is intended for a single-doctor private clinic and handles medical/clinical data.
The doctor is responsible for ensuring that local data handling complies with applicable
regional health data privacy regulations (such as the Digital Personal Data Protection
Act in India or equivalent local requirements).
