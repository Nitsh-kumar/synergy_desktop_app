---
applyTo: "**/*"
---

# Security Instructions

This app handles sensitive patient and billing data.

## Security Rules

- Never expose secrets in code.
- Never log sensitive patient information.
- Never send identifiable patient data to LLMs.
- Validate all inputs.
- Sanitize file uploads.
- Use parameterized database queries.
- Protect destructive actions.
- Use password protection if authentication is implemented.
- Do not add network exposure unless explicitly required.
- Default to local-only operation for internal desktop use.

## Sensitive Data

Treat these as sensitive:
- patient name
- phone
- email
- address
- patient ID
- medical notes
- prescriptions
- bills
- payment information
- uploaded letterhead and bill templates

## AI Safety

Before any LLM request:
1. Anonymize.
2. Validate payload.
3. Confirm no identifiers remain.
4. Send minimal clinical context only.
5. Mark output as draft.

## File Safety

For uploaded templates:
- verify extension
- verify MIME type if possible
- limit size
- store in controlled directory
- never execute uploaded content
- never use uploaded filename directly without sanitization