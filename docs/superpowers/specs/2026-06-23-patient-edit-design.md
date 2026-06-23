# Phase 4 Design — Patient Edit

**Date:** 2026-06-23  
**Phase:** Phase 4 — Patient Management  
**Status:** Approved for implementation planning  
**Scope:** Second Phase 4 slice only

## 1. Goal

Add practical patient editing to the existing Patients tab so clinic staff can correct patient details without leaving the current screen.

This slice adds only patient detail editing for the existing patient fields. It does not add patient profile/history, OPD/IPD workflow changes, pagination, billing, AI, template upload, backup, authentication, packaging, or unrelated UI refactors.

## 2. User Outcome

The doctor or clinic staff member can:

- click an **Edit** action on a patient row
- load that patient into the existing patient form
- update the current patient fields:
  - name
  - phone
  - condition
  - type
- save changes and see the directory update immediately
- cancel editing and return the form to normal add-patient mode

## 3. Scope Boundaries

### In Scope

- edit existing patient fields only
- reuse the current Patients tab form in add/edit modes
- row-level Edit action in the patient table
- validated save flow
- cancel-edit flow
- renderer wiring for edit mode
- patient update plumbing through preload, IPC, and database layers
- tests for update behavior

### Out of Scope

- patient profile or history
- address editing as new UI scope
- schema changes or new tables
- `updated_at` migration in this slice
- OPD/IPD selector enhancements
- bulk edit
- inline table editing
- modal editing

## 4. UX Design

The existing **Add New Patient** panel becomes a shared **add/edit** form.

### Edit Entry Point

- Each patient row gets an **Edit** button
- Clicking **Edit** loads that patient into the shared form

### Edit Mode

When a patient is being edited:

- the form heading changes from **Add New Patient** to **Edit Patient**
- the primary action changes from **Add Patient** to **Save Changes**
- a secondary **Cancel** action appears
- the form fields are prefilled with the selected patient data

### Cancel Behavior

- **Cancel** exits edit mode
- the form fields are cleared
- the form returns to normal add-patient mode

### Save Behavior

- Saving updates the patient record in place
- After save, the form returns to normal add-patient mode
- Current patient filters remain active

## 5. Architecture and Data Flow

This slice spans the renderer, preload bridge, Electron main process, and SQLite data layer.

### Why

Unlike P1-A search/filter, patient editing requires a write path. The current app has patient create and delete plumbing but no patient update path, so a small end-to-end addition is required.

### Data Flow

1. User clicks **Edit** in the Patients table
2. Renderer stores the current editing patient id and form values
3. User changes values in the shared form
4. Renderer calls a new preload method for patient update
5. `main.cjs` validates the payload and invokes the database update function
6. `database.cjs` updates the existing patient row in SQLite
7. Renderer updates the local `patients` state with the saved patient
8. The table re-renders under the current filters

### Update Contract

The new update path should use this contract:

- **Renderer request payload:**  
  `{ id, name, phone, condition, type }`
- **Validation rules:**  
  apply these exact rules on update:
  - `id` must be a non-empty string
  - `name` must be a trimmed non-empty string
  - `phone` is optional and, when provided, is trimmed and stored as text
  - `condition` is optional and, when provided, is trimmed and stored as text
  - empty optional `phone` or `condition` values are stored as `null`
  - `type` is required and must be either `OPD` or `IPD`
  - no new phone-format validation is introduced in this slice
- **Database write:**  
  update only the existing patient row with the matching `id`
- **Successful response shape:**  
  the updated patient object with the existing persisted fields, including original `dateAdded`
- **Failure behavior:**  
  throw user-safe validation or not-found errors through the existing IPC error path
- **Safe not-found/update message contract:**  
  use the existing validation-style user-safe pattern, for example `Invalid patient: record no longer exists`

### Boundaries

- **Database layer:** add one patient update function only
- **Electron main process / IPC / preload:** add one validated patient update path only
- **Renderer:** manage edit mode, form reuse, and local state update

No schema migration is included in this slice. The existing patient fields are updated in place.

## 6. Expected Code Shape

Likely touch points:

- `src/App.jsx`
  - add edit-mode state
  - reuse patient form for add/edit
  - add row-level Edit action
  - keep current filter/export/delete behavior intact

- `src/App.css`
  - add minimal styling for edit-mode actions if needed

- `preload.cjs`
  - expose `patients.update(...)`

- `main.cjs`
  - add validated `patients:update` IPC handler

- `database.cjs`
  - add patient update function

- tests
  - database and/or IPC-safe behavior coverage for patient update
  - renderer-adjacent helper coverage if any new pure helpers are extracted

## 7. Behavioral Rules

### Editable Fields

- `name` — required
- `phone` — optional
- `condition` — optional
- `type` — required, `OPD` or `IPD`

### Type Changes

- Patient type may be changed even if the patient already has OPD sessions or IPD therapy plans

### Related Display Refresh

- If the edited patient name changes, already-loaded OPD session rows and IPD plan rows in renderer state should update their display name immediately after a successful save
- No additional database writes are needed for this; this is a renderer-state consistency update only

### Dependent Form Selection Refresh

- If the edited patient type changes from `OPD` to `IPD`, clear `sessionPatientId` when it currently points at that patient, because the OPD session form only lists OPD patients
- Do not clear `ipdPatientId` only because of patient type changes, because the current IPD plan form accepts all patients
- This keeps those forms aligned with their current eligibility rules without changing their broader behavior

### Filter Interaction

- The current search/type filters stay active during edit mode
- After save, if the updated patient no longer matches the active filters, that row may disappear from the visible table

### Selection Interaction

- Existing filtered selection behavior from P1-A remains intact
- Entering or saving edit mode must not silently expand bulk selection
- Any action that would discard or replace shared-form values must ask for confirmation first when the form is dirty
- The shared patient form is **dirty** when any current field value differs from its current mode baseline:
  - **add mode baseline:** empty `name`, empty `phone`, empty `condition`, default `type` of `OPD`
  - **edit mode baseline:** the currently loaded patient snapshot from when edit mode was entered
- This includes:
  - entering edit mode from a partially filled add form
  - switching from one edited patient to another
  - canceling edit mode with unsaved edits
  - any other renderer action in this slice that would replace the shared form state
- The confirmation mechanism for this slice should stay simple and consistent with current app patterns by using `window.confirm(...)`

## 8. Validation and Error Handling

- Reuse the current patient validation standard:
  - non-empty name required
  - valid type required
- Optional text fields should be trimmed and stored safely as null when empty, consistent with current add behavior
- Errors should continue using the existing user-safe alert/error-message pattern
- No raw internal database or IPC errors should be shown to the user
- If save fails because of validation, IPC, or database errors, edit mode stays open, the entered values are preserved, and the user can retry
- If save fails because the patient no longer exists, show a user-safe not-found error, exit edit mode, and reload clinic data
- When clinic data is reloaded after a not-found save failure:
  - keep the active patient search/type filters
  - keep bulk selection scoped by the existing P1-A prune-to-visible behavior
  - recompute visible rows from the refreshed patient list
- Not-found/update failures should use the same safe validation-style message contract so they surface cleanly through the current `getUserErrorMessage(...)` behavior without expanding the error system in this slice

## 9. Edge Cases

- Editing a patient with blank phone or condition should not break the form
- Canceling edit mode should not leave stale form values behind
- Editing while filters are active should not reset the filter state
- Editing a visible row into a non-matching state should remove it from the current filtered table after save
- Repeatedly switching between different rows’ **Edit** buttons should always load the latest selected patient data
- Repeatedly switching between rows with unsaved changes should require explicit confirmation before discarding the active edits
- Starting edit mode from a partially filled add form should require explicit confirmation before replacing the current form values
- Changing patient type from `OPD` to `IPD` should clear `sessionPatientId` if it still points at that patient; `ipdPatientId` should remain unchanged because the current IPD plan form accepts all patients

## 10. Testing

### Automated Tests

- add/update database tests for patient update behavior
- verify required-field validation still applies on update
- verify optional fields can be cleared safely
- verify update changes persist and are returned correctly
- verify not-found update behavior surfaces the safe validation-style message contract
- verify any new dirty-form helper logic used for confirmation/discard behavior
- verify successful rename updates already-loaded OPD/IPD display names in renderer state helpers if extracted
- verify OPD form selection is cleared when an edited patient changes from `OPD` to `IPD`

### Manual Checks

1. Add a patient
2. Edit the patient name
3. Edit the phone number
4. Edit the condition
5. Change type between `OPD` and `IPD`
6. Cancel an in-progress edit and confirm add mode returns cleanly
7. Edit while search/type filters are active
8. Start editing from a dirty add form and confirm discard warning appears
9. Switch from one edited patient to another with unsaved changes and confirm discard warning appears
10. Edit a patient that is currently selected in the OPD session form and confirm invalid OPD selection is cleared after type change to `IPD`
11. Confirm existing add, delete, export, OPD, and IPD flows still work

### Required Commands

- `npm run lint`
- `npm test`
- `npm run build`

## 11. Done Criteria

This slice is done when clinic staff can edit existing patients from the Patients tab using the shared form, save or cancel predictably, and the end-to-end update path works without introducing schema changes or breaking current patient-directory behavior.

## 12. Next Likely Phase 4 Slices

After this slice, the most natural follow-up options are:

1. patient profile with session history
2. pagination or virtual scrolling for large patient lists

Those should be planned separately and must not be folded into this implementation spec.
