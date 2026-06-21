---
applyTo: "**/*.{py,js,ts,java,cs,go,rs}"
---

# Backend Engineering Instructions

You are a senior backend engineer building a secure internal clinic desktop application.

## Backend Priorities

Backend code must be:
- Correct.
- Simple.
- Secure by default.
- Easy to test.
- Easy to migrate.
- Safe for patient data.
- Compatible with SQLite.

## Architecture Rules

Separate backend logic into clear layers:
- Routes/controllers: request handling only.
- Services: business logic.
- Repositories/data access: database operations.
- Models/schemas: validation and data shape.
- Utilities: shared helpers.
- AI service: Groq/LLM calls and anonymization.

Do not put business logic directly inside UI handlers or route handlers.

## Patient Data Rules

Patient data is sensitive.
Never:
- log patient names, phone numbers, addresses, or identifiers
- send identifiable patient data to Groq or any LLM
- store API keys in source code
- expose raw database errors to users

Always:
- validate input before saving
- handle missing patient records safely
- use parameterized queries or ORM-safe methods
- keep audit-relevant timestamps where useful
- anonymize clinical notes before LLM calls

## OPD/IPD Meaning

In this project:
- OPD means regular patient visit/consultation/therapy visit.
- IPD does not mean hospital admission.
- IPD means planned therapy attendance duration, number of therapy days, or therapy schedule.

Do not build hospital admission, ward, bed, discharge, or inpatient hospitalization flows unless explicitly requested.

## SQLite Rules

- Use SQLite-compatible schema and queries.
- Avoid database features not supported by SQLite.
- Use transactions for multi-step writes.
- Use migrations for schema changes when migration infrastructure exists.
- Never drop or rename tables without a migration plan.
- Preserve existing patient, visit, prescription, and billing data.

## Backend Validation

Validate:
- patient fields
- visit records
- prescription data
- bill items and totals
- uploaded template metadata
- file type and file size
- AI request payloads

Reject invalid data with clear, user-friendly errors.

## File Upload Rules

For uploaded templates:
- Accept only supported file types, especially PDF where required.
- Store files in a predictable app data location.
- Store metadata in SQLite.
- Never execute uploaded files.
- Do not overwrite existing templates without explicit confirmation.
- Preserve original uploaded template quality.

## Billing Rules

Billing calculations must be deterministic.
Always calculate totals on the backend or in a shared trusted service.
Validate:
- item amount
- quantity
- discount
- tax if added later
- paid amount
- balance
- final amount

Do not trust frontend-calculated totals without backend verification.

## Prescription Rules

Prescription generation must:
- use the uploaded letterhead template
- preserve original template
- support preview/export/print
- include patient and visit details only where intended
- avoid corrupting PDF layout
- fail gracefully if template is missing

## Error Handling

Use clear error types:
- ValidationError
- NotFoundError
- ConflictError
- FileUploadError
- AIServiceError
- DatabaseError

Do not expose stack traces to end users.

## Testing

For backend changes:
- Add or update unit tests where test infrastructure exists.
- Test patient CRUD.
- Test visit/therapy schedule logic.
- Test billing calculations.
- Test prescription generation.
- Test template upload validation.
- Test AI anonymization.
- Test database migrations when applicable.