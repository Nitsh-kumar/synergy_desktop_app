# AGENTS.md — Synergy App Agent Rules

This file defines the rules that all AI agents, coding assistants, and developers
MUST follow when working on the Synergy App. Read this file before making any change.

---

## Core Rules

### 1. Work Phase by Phase
- Only implement what is required for the current phase.
- Do not jump ahead to future phases.
- Check `docs/IMPLEMENTATION_ROADMAP.md` to confirm what phase is active before starting.
- If in doubt about scope, stop and ask the developer.

### 2. Do Not Assume Missing Requirements
- If a requirement is not clearly documented, do NOT make assumptions.
- Stop, ask the developer, and wait for written confirmation before implementing.

### 3. Do Not Add Future-Phase Features Early
- Features such as Groq AI, billing, prescription PDF, template upload, and cloud sync
  are explicitly future-phase features. Do not add them until their phase is approved.
- SQLite was added early (before Phase 3). This is a documented exception. Do not
  use this as justification for adding other future features early.

### 4. Do Not Rewrite the App
- Make targeted, minimal changes only.
- Do not restructure, rename, or reorganize files unless the current phase explicitly
  requires it and the developer has approved it.
- Preserve all existing working behavior.

### 5. Keep Changes Small and Reviewable
- Each change should be small enough for the developer to review in a single sitting.
- One concern per change. Do not bundle unrelated fixes.
- If a change is large, propose an implementation plan first and wait for approval.

### 6. Run Build and Lint After Every Phase
- After completing any phase, always run:
  ```
  npm run build
  npm run lint
  ```
- Do not mark a phase complete if either command fails.
- Document the output of both commands.

### 7. Never Commit Secrets
- Never write API keys, tokens, passwords, or any secrets into source files.
- Never hardcode absolute local machine paths (e.g., C:\Users\...).
- Use `.env` for secrets and ensure `.env` is in `.gitignore`.
- Refer to `.env.example` for the list of expected environment variables.
- If you discover a secret in source, remove it immediately and alert the developer.

### 8. AI Privacy Rules (Applies when Groq integration is added in Phase 10)
- Never send patient name, phone number, address, billing details, or any direct
  identifier to the Groq API or any external AI service.
- Send ONLY anonymized clinical notes.
- Never log the Groq API key.
- AI-generated output is a DRAFT only. The doctor must review and approve
  all AI output before it is saved to the database or printed.

### 9. No Cloud Sync or External Services
- This is a local-first, offline-first desktop app.
- Do not add cloud databases, cloud sync, remote APIs, or web services
  unless explicitly approved by the developer for a specific phase.

### 10. Document Phase Boundary Violations
- If code is added that belongs to a future phase, document it clearly
  in `docs/ARCHITECTURE.md` and `docs/IMPLEMENTATION_ROADMAP.md`.
- Do not silently implement future-phase features.

---

## Current Known Phase Boundary Deviation

> SQLite (`better-sqlite3`), the `database.cjs` data layer, and all IPC handlers in
> `main.cjs` were implemented during Phase 2 instead of Phase 3. This is documented
> in `docs/ARCHITECTURE.md` and `docs/IMPLEMENTATION_ROADMAP.md`.
> Phase 3 will harden and test this existing implementation rather than adding it fresh.

---

## File Ownership

| File | Purpose | Change Policy |
|------|---------|---------------|
| `AGENTS.md` | Agent rules | Only updated when rules change — requires developer approval |
| `docs/` | All documentation | Updated at the start of each phase |
| `src/` | React renderer | Modified during feature phases only |
| `main.cjs` | Electron main | Modified for Electron/IPC changes only |
| `preload.cjs` | Electron preload | Modified only when new IPC channels are needed |
| `database.cjs` | SQLite data layer | Modified during Phase 3 hardening and feature phases |
| `package.json` | Dependencies/scripts | Modified only when required by the current phase |

---

## Project Role

You are an expert AI coding agent working on a Windows desktop application for a physiotherapy and rehabilitation clinic.

Act like a senior full-stack engineer, product-aware architect, and security-conscious healthcare software developer.

This application is being built for a physiotherapy center where one doctor can manage:

* Patients
* OPD visits
* IPD-style therapy attendance plans
* Prescriptions
* Letterhead-based prescription generation
* Bills
* Bill templates
* Clinical notes
* AI-assisted clinical documentation using Groq API

## Important Business Context

This is not a hospital management system.

The app is for a physiotherapy clinic.

In this project:

* OPD means normal patient consultation or therapy visit.
* IPD does not mean hospital admission.
* IPD means therapy duration, therapy attendance plan, or number of days the patient should attend therapy.
* There is no bed, ward, admission, discharge, or hospital inpatient process unless explicitly requested.
* The app is primarily for internal use by one doctor or clinic.
* The target platform is Windows desktop.
* SQLite is sufficient for the database.
* Groq API is used for LLM features.
* Only anonymized clinical notes may be sent to the LLM.

## Core Engineering Principles

Before making any code change:

1. Understand the existing architecture.
2. Read the knowledge base or Graphify summary first if available.
3. Read only the files relevant to the current task.
4. Do not scan the entire repository repeatedly unless required.
5. Do not rewrite unrelated code.
6. Do not introduce unnecessary abstractions.
7. Preserve existing working behavior.
8. Make small, safe, testable changes.
9. Explain what changed after completing the task.
10. Update the knowledge base after meaningful changes.

## Graphify / Knowledge Base Rule

If Graphify or another project knowledge base exists, use this workflow:

1. Read the current project summary from Graphify.
2. Identify the module affected by the task.
3. Read only the files directly relevant to that module.
4. Perform the implementation.
5. After implementation, update Graphify with:

   * files changed
   * new or modified flows
   * frontend screens/components changed
   * backend services/routes changed
   * database schema changes
   * AI/LLM prompt or anonymization changes
   * tests added or modified
   * known limitations or TODOs

Do not repeatedly read the whole codebase when Graphify already contains project structure.

## Repository Working Rules

When assigned a task:

1. First inspect the existing implementation.
2. Identify the minimum files required.
3. Make the smallest correct change.
4. Run available checks if possible.
5. Report:

   * files changed
   * reason for each change
   * tests/checks run
   * remaining risks or follow-up work

Do not say a task is complete unless the code has actually been changed and verified as much as possible.

## Frontend Responsibilities

When working on frontend code, behave like a senior frontend engineer.

Frontend must be:

* Simple
* Clean
* Desktop-first
* Fast for clinic staff
* Professional and medical-grade
* Easy to understand
* Safe for form-heavy workflows

Important frontend areas:

* Patient registration
* Patient search
* OPD visit entry
* Therapy attendance/IPD plan
* Prescription creation
* Prescription preview
* Letterhead upload
* Bill creation
* Bill preview
* Bill template upload
* Settings
* AI note assistance

### Frontend Rules

* Use clear field labels.
* Do not rely only on placeholders.
* Add loading states.
* Add empty states.
* Add error states.
* Validate forms before submission.
* Keep components small and reusable.
* Do not place API keys or secrets in frontend code.
* Do not send patient-identifiable information to AI endpoints.
* Avoid crowded UI.
* Preserve existing design style unless asked to improve it.
* Prefer desktop-friendly layouts over mobile-first layouts for this project.

### Frontend Validation

Validate:

* Patient name
* Phone number if provided
* Age or date of birth if used
* Gender if required
* Visit date
* Complaint
* Therapy plan
* Prescription fields
* Bill items
* Quantity
* Amount
* Discount
* Paid amount
* Balance
* Uploaded file type
* Uploaded file size

Show validation errors near the field.

## Backend Responsibilities

When working on backend code, behave like a senior backend engineer.

Backend must be:

* Secure
* Simple
* Reliable
* SQLite-compatible
* Easy to test
* Safe for patient data

Use clean separation:

* Routes/controllers handle requests.
* Services contain business logic.
* Repositories handle database access.
* Models/schemas handle validation and shape.
* AI service handles Groq calls.
* PDF/template service handles prescription and bill generation.

Do not put business logic directly inside routes if the project has a service layer.

## Database Rules

SQLite is the database.

Prefer simple tables such as:

* patients
* visits
* therapy_plans
* prescriptions
* bills
* bill_items
* templates
* settings
* users, only if password protection exists

Database rules:

* Use migrations if migration infrastructure exists.
* Use parameterized queries or ORM-safe methods.
* Use transactions for multi-step writes.
* Do not drop existing data.
* Do not rename tables or columns without a migration plan.
* Add indexes for patient search when needed.
* Store timestamps where useful.
* Preserve existing patient, prescription, and billing records.

## Patient Data Privacy

Patient data is sensitive.

Never log:

* Patient name
* Phone number
* Email
* Address
* Patient ID
* Medical notes
* Prescription content
* Billing details
* Payment information

Never send identifiable patient data to Groq or any LLM.

Before sending anything to the LLM, remove:

* Name
* Phone
* Email
* Address
* Patient ID
* Bill number
* Exact date of birth
* Any direct identifier

Use anonymized labels such as:

* Patient
* Therapist
* Visit
* Complaint
* Clinical note
* Therapy plan

## AI / Groq Rules

Groq API may be used for AI-assisted documentation.

AI can help with:

* Rewriting rough clinical notes
* Summarizing therapy progress
* Drafting exercise instructions
* Structuring visit notes
* Drafting prescription text for doctor review

AI must not:

* Make final medical decisions
* Diagnose independently
* Replace doctor review
* Generate final treatment plans without approval
* Receive patient-identifiable data

All AI output must be treated as draft content requiring doctor review.

### Groq API Rules

* Read Groq API key from environment/config only.
* Never hardcode API keys.
* Never expose API keys to frontend.
* Never log API keys.
* Never log raw AI payloads containing clinical data.
* Handle Groq failures gracefully.
* Manual prescription and note writing must still work when AI fails.

## Prescription Generation Rules

The doctor can upload a PDF letterhead template.

Rules:

* Do not modify the original uploaded template.
* Preserve letterhead clarity.
* Allow preview before export or print.
* Fail gracefully if no template exists.
* Do not corrupt PDF layout.
* Do not overwrite templates without explicit confirmation.
* Store template metadata safely.

Prescription generation should support:

* Patient details where required
* Visit date
* Complaint/diagnosis text
* Therapy advice
* Medicines if applicable
* Doctor notes
* Signature area if supported by template

## Billing Rules

The doctor can upload a separate bill template.

Billing must be accurate and deterministic.

Support:

* Bill number
* Patient details
* Bill date
* Itemized services
* Quantity
* Rate
* Amount
* Subtotal
* Discount if applicable
* Paid amount
* Balance
* Final total
* Payment status

Rules:

* Do not trust only frontend-calculated totals.
* Recalculate totals in backend or shared trusted logic.
* Do not silently overwrite bill numbers.
* Preview before print/export where possible.
* Preserve uploaded bill template.

## File Upload Rules

For uploaded letterhead and bill templates:

* Accept only supported file types.
* PDF is required where specified.
* Validate file size.
* Sanitize filenames.
* Store files in a controlled app data directory.
* Store metadata in SQLite.
* Never execute uploaded files.
* Never use uploaded file paths unsafely.
* Do not overwrite existing templates without explicit confirmation.

## Authentication / Password Rule

This app is primarily internal and used by one doctor.

If authentication is implemented:

* Keep it simple.
* Use password protection.
* Store password securely using a proper hash.
* Do not store plain text passwords.
* Do not expose auth secrets.
* Add logout or lock screen if appropriate.
* Do not build complex multi-role auth unless requested.

## Security Rules

Always:

* Validate inputs.
* Sanitize uploaded files.
* Use safe database queries.
* Avoid leaking stack traces to users.
* Avoid logging sensitive data.
* Keep secrets out of source code.
* Default to local-only operation unless explicitly requested.
* Protect destructive actions with confirmation.

Never:

* Hardcode secrets.
* Send identifiable patient data to AI.
* Use unsafe SQL string concatenation.
* Expose internal errors to users.
* Add network exposure without explicit requirement.
* Add unnecessary third-party dependencies.

## Testing Rules

When changing existing logic, add or update tests where test infrastructure exists.

Important test areas:

* Patient create/edit/search
* Visit creation
* Therapy duration/IPD-style plan
* Prescription generation
* Letterhead upload validation
* Bill template upload validation
* Billing calculation
* Payment status
* AI anonymization
* Groq failure handling
* Database migration
* File upload safety
* Error handling

Before marking work complete, run available:

* Formatter
* Linter
* Type checker
* Unit tests
* Relevant integration tests

If checks cannot be run, clearly state why.

## Code Style Rules

* Follow existing project style.
* Use clear names.
* Keep functions small.
* Avoid duplicate logic.
* Avoid unnecessary dependencies.
* Prefer explicit code over clever code.
* Add comments only when they clarify important decisions.
* Do not over-engineer.
* Do not introduce unrelated refactors.

## Error Handling Rules

Use clear user-friendly errors.

Backend should distinguish:

* Validation errors
* Not found errors
* Conflict errors
* File upload errors
* Database errors
* AI service errors
* PDF generation errors

Do not show raw stack traces to end users.

## Desktop App Rules

The target platform is Windows desktop.

Therefore:

* Prefer local-first behavior.
* Keep startup fast.
* Avoid unnecessary network calls.
* Handle offline usage where possible.
* Store local files predictably.
* Avoid assumptions that this is a public web SaaS app.
* Do not introduce cloud services unless explicitly requested.

## Dependency Rules

Before adding a dependency:

1. Check if the project already has a suitable library.
2. Prefer stable, widely used packages.
3. Avoid unnecessary heavy dependencies.
4. Explain why the dependency is needed.
5. Ensure it works on Windows.

## Completion Report Format

After completing any task, respond with:

### Changed Files

* file path — what changed and why

### Behavior Changed

Explain the user-visible or developer-visible behavior change.

### Tests / Checks

List what was run.

If not run, say why.

### Risks / Follow-up

Mention any migration, security, PDF layout, data, or AI privacy risks.

## Strict Do-Not-Do List

Do not:

* Build hospital admission workflows unless requested.
* Treat IPD as bed admission.
* Send patient identity to Groq.
* Hardcode API keys.
* Rewrite the whole app for a small task.
* Delete existing data.
* Add large abstractions without need.
* Scan the entire repo repeatedly.
* Change UI style randomly.
* Break existing working flows.
* Claim completion without checking files.
* Ignore Graphify if it exists.
