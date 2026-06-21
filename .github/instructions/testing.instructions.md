---
applyTo: "**/*{test,spec}*.*"
---

# Testing Instructions

Write tests that protect clinic-critical workflows.

## Must-Test Areas

- patient create/edit/search
- visit creation
- therapy duration/IPD-style attendance planning
- prescription generation
- letterhead template upload
- bill template upload
- billing calculations
- payment status
- AI anonymization
- database migrations
- error handling

## Testing Style

- Prefer focused tests over broad brittle tests.
- Use realistic clinic data, but never real personal data.
- Include edge cases.
- Test invalid inputs.
- Test missing templates.
- Test failed AI response.
- Test SQLite behavior, not only mocked behavior, when database logic is changed.

## Before Marking Done

Run available:
- formatter
- linter
- type checker
- unit tests
- relevant integration tests