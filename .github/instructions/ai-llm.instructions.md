---
applyTo: "**/*{ai,llm,groq,prompt,clinical,note}*.*"
---

# AI / LLM Instructions

Use Groq API for LLM features.

## Hard Privacy Rule

Only anonymized clinical notes may be sent to the LLM.

Before sending data to Groq, remove:
- patient name
- phone number
- email
- address
- patient ID
- bill number
- exact dates of birth
- any direct identifier

Use neutral labels like:
- Patient
- Therapist
- Visit date
- Complaint
- Treatment plan

## AI Feature Scope

AI may help with:
- improving clinical note wording
- summarizing therapy progress
- creating draft exercise instructions
- generating draft prescription text
- converting rough notes into structured notes

AI must not:
- make final medical decisions
- diagnose independently
- replace doctor review
- generate treatment plans without doctor approval
- expose private patient information

## Prompt Design Rules

- Keep prompts structured.
- Include only necessary clinical context.
- Ask for concise, editable drafts.
- Mark AI output as draft.
- Require doctor review before saving final prescription text.

## Error Handling

When Groq API fails:
- show a friendly message
- do not block manual prescription creation
- do not retry aggressively
- do not leak API errors or keys

## Secrets

- Read Groq API key from environment/config only.
- Never hardcode keys.
- Never log keys.
- Never expose keys to frontend.