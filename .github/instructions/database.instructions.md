---
applyTo: "**/*{schema,migration,models,repositories,db,database}*.*"
---

# Database Instructions

Use SQLite as the database.

## Database Design Rules

Prefer normalized, simple tables:
- patients
- visits
- therapy_plans
- prescriptions
- bills
- bill_items
- templates
- settings
- users/auth if password protection is enabled

## Required Database Practices

- Use primary keys.
- Use created_at and updated_at where useful.
- Use foreign keys for related records.
- Use indexes for patient search fields.
- Use migrations for schema changes when possible.
- Do not destroy existing data.
- Do not store secrets in SQLite unless properly protected.
- Do not store raw LLM prompts containing patient identity.

## Patient Search

Support efficient search by:
- patient name
- phone number
- patient ID if used
- recent visits

## Data Safety

Before changing schema:
1. Inspect existing schema.
2. Check existing migrations.
3. Create forward migration.
4. Avoid destructive changes.
5. Mention migration risk in final summary.