---
applyTo: "**/*.{tsx,ts,jsx,js,css,scss,html}"
---

# Frontend Engineering Instructions

You are a senior frontend engineer building a professional clinic desktop application.

## Frontend Priorities

Build UI that is:
- Simple for clinic staff.
- Fast to use during patient visits.
- Clean, professional, and medical-grade.
- Reliable even with imperfect user input.
- Optimized for desktop screen sizes.
- Accessible with keyboard navigation where practical.

## UI/UX Rules

- Use clear labels, not vague placeholders.
- Do not hide important patient or billing actions behind unclear icons.
- Keep patient search, visit history, prescription generation, and billing flows quick.
- Prefer structured forms with sections:
  - Patient details
  - Visit details
  - Complaint / diagnosis
  - Therapy plan
  - Prescription
  - Billing
- Show confirmation before destructive actions.
- Show loading, empty, and error states for every data-driven screen.
- Use readable spacing and typography.
- Avoid crowded screens.

## Component Rules

- Keep components small and focused.
- Separate page-level components from reusable UI components.
- Avoid mixing API calls directly into deeply nested UI components.
- Prefer reusable form components for:
  - text input
  - date input
  - select/dropdown
  - textarea
  - patient search
  - template upload
  - PDF preview
  - billing line items

## State Management Rules

- Keep local state local.
- Use shared state only when multiple screens/components truly need it.
- Avoid duplicating server/database state in many places.
- Reset form state after successful create/update only when safe.
- Do not lose unsaved form data accidentally.

## Form Validation Rules

Validate:
- required patient fields
- phone number format if phone exists
- visit date
- prescription fields
- billing amount
- payment status
- uploaded template file type
- PDF upload size

Show validation errors near the field.

## Prescription Template UI

When working on prescription UI:
- Preserve uploaded letterhead PDF clarity.
- Do not modify the doctor’s uploaded template.
- Render prescription content on top of or along with the template only as configured.
- Allow preview before final export/print.
- Keep prescription output printable.

## Billing UI

When working on billing:
- Support itemized bill rows.
- Show subtotal, discount if present, paid amount, balance, and final total.
- Make print/export preview available.
- Do not silently overwrite bill numbers.

## API Integration Rules

- Centralize API/database calls in service files.
- Handle request failures with meaningful messages.
- Do not expose API keys in frontend code.
- Do not send raw patient identity data to AI endpoints.

## Accessibility

- Use semantic elements where possible.
- Inputs must have visible labels.
- Buttons must clearly describe their action.
- Dialogs should be keyboard-dismissable only when safe.
- Important actions should be reachable without mouse-only behavior.

## Frontend Testing

When adding or changing frontend logic:
- Add tests for important forms and calculations when test infrastructure exists.
- Test patient creation/editing.
- Test prescription preview/export flow.
- Test billing calculation.
- Test error and empty states.