# Project Instructions for GitHub Copilot

You are working on a Windows desktop application for a physiotherapy and rehabilitation center.

The application is for internal use by one doctor/clinic. It manages OPD/IPD-style therapy visits, patients, prescriptions, bills, clinical notes, uploaded templates, and AI-assisted clinical documentation.

## Core Product Context

- This is a desktop app for Windows.
- SQLite is sufficient for the database.
- The app is primarily for internal clinic use.
- There is only one doctor/admin user.
- Password protection may be used if required.
- IPD means therapy attendance duration or number of therapy days, not hospital admission.
- The doctor can upload a PDF letterhead template for prescriptions.
- The doctor can upload a separate bill template.
- LLM features should use the Groq API.
- Only anonymized clinical notes may be sent to the LLM.
- Never send patient name, phone number, address, ID, or other personally identifiable information to the LLM.

## Working Style

Before editing code:
1. Read the relevant files first.
2. Understand current architecture before suggesting changes.
3. Make the smallest safe change that satisfies the task.
4. Do not rewrite unrelated files.
5. Do not invent features not requested.
6. Do not assume missing requirements. Add a TODO or ask for clarification when truly blocked.
7. Prefer boring, maintainable code over clever abstractions.

## Code Quality Rules

- Keep frontend, backend, database, and AI logic separated.
- Use clear names for functions, models, services, and components.
- Avoid large monolithic files.
- Add input validation at the UI and backend levels.
- Handle errors gracefully with user-friendly messages.
- Never expose secrets in frontend code, logs, database, or committed files.
- Never log patient-sensitive information.
- Preserve existing behavior unless the task explicitly changes it.

## Before Completing Any Task

Copilot must report:
- Files changed.
- Why each file was changed.
- How to run or test the change.
- Any risk, migration, or follow-up needed.

## Knowledge Base / Graphify Rule

If Graphify or another knowledge base exists:
- First inspect the knowledge base for architecture summaries.
- Then read only the files directly relevant to the current task.
- Do not repeatedly scan the entire repository unless architecture is unknown or the task requires it.
- After every meaningful code change, update the knowledge base with:
  - changed files
  - new or modified flows
  - new database tables or fields
  - new API endpoints
  - new frontend screens/components
  - new validation/security rules




Also read and follow the root-level `AGENTS.md` file before making changes. If there is a conflict, prefer the more specific instruction file for the current folder, then `AGENTS.md`, then this file.