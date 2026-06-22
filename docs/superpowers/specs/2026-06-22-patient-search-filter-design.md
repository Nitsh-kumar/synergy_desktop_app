# Phase 4 Design — Patient Search and Filter

**Date:** 2026-06-22  
**Phase:** Phase 4 — Patient Management  
**Status:** Approved for implementation planning  
**Scope:** First Phase 4 slice only

## 1. Goal

Improve the existing Patients tab so clinic staff can quickly find patients without scrolling the full table.

This slice adds instant patient filtering in the Patients tab only. It does not change the database schema, add new IPC endpoints, or expand into patient editing, patient profiles, pagination, OPD/IPD selector search, billing, prescriptions, template upload, reports, backup/restore, or AI features.

## 2. User Outcome

The doctor or clinic staff member can:

- type into a search field and immediately narrow the patient list
- filter the list by patient type (`All`, `OPD`, `IPD`)
- combine text search and type filter
- clearly see when there are no matches
- clear the filters and return to the full list quickly

The experience stays local-first, desktop-first, and consistent with the current single-window React + Electron workflow.

## 3. Scope Boundaries

### In Scope

- Patients tab filter bar
- Instant text filtering
- Type dropdown filtering
- Combined filtering behavior
- No-match empty state
- Clear-filters affordance

### Out of Scope

- Editing patient details
- Patient profile page or modal
- Pagination or virtual scrolling
- Search in OPD/IPD selectors
- Database-side search queries
- Schema changes or new tables
- Any future-phase features

## 4. UX Design

Add a compact filter bar above the patient table in the Patients tab.

### Controls

1. **Search input**
   - Filters instantly as the user types
   - Matches patient `name` and `condition`
   - Case-insensitive
   - Leading/trailing whitespace does not affect results

2. **Type dropdown**
   - Options: `All`, `OPD`, `IPD`
   - Defaults to `All`

3. **Clear filters action**
   - Visible when any filter is active
   - Resets search text and type selection

### Display Rules

- If there are no patients in the system, keep the existing empty state and do not show the filter bar
- If there are no patients in the system, keep the existing empty state
- If patients exist but the active filters produce zero matches, replace the table area with a dedicated no-match state
- The no-match state should explain that filters returned no results and provide a quick way to clear them
- The table structure, bulk selection, and delete actions remain in place for visible rows
- When filters do return matches, render the filtered table normally in place of the no-match state

## 5. Architecture and Data Flow

This slice stays entirely in the renderer.

### Why

The app already loads the full patient list through the safe Electron preload API, and the current product context is a single-doctor local desktop app. For this scope, renderer-side filtering is the simplest and safest approach.

### Data Flow

1. App loads patients once from `window.electronAPI.patients.getAll()`
2. Patients are stored in existing renderer state
3. New filter state is kept in the Patients tab flow
4. A derived filtered list is computed from:
   - full patient list
   - search text
   - selected patient type
5. The UI renders the derived list instead of the raw list

### Boundaries

- **Database layer:** unchanged
- **Electron main process / IPC / preload:** unchanged
- **Renderer:** owns the new filtering behavior and display logic

The filtered view applies only to the Patients tab patient-directory surface:

- patient table rows
- patient-row selection state
- bulk delete behavior
- patient CSV export behavior

Other existing consumers of the loaded `patients` array, including dashboard counts and OPD/IPD patient selectors, continue using the full list unchanged in this slice.

This preserves the Phase 3 security boundary: the renderer never gains direct database access and no raw SQL or file APIs are introduced.

## 6. Expected Code Shape

Follow the current app structure instead of introducing a large refactor.

Likely touch points:

- `src/App.jsx`
  - add local filter state
  - compute filtered patients
  - render filter controls
  - render no-match state
  - keep existing add/delete flows working

- `src/App.css`
  - style the filter bar and no-match state using the current visual language

No database or Electron files should need changes for this slice.

## 7. Behavioral Rules

### Search Matching

- Match against `patient.name`
- Match against `patient.condition`
- Ignore case
- Treat missing `condition` safely as empty text

### Type Matching

- `All` shows both `OPD` and `IPD`
- `OPD` shows only `OPD`
- `IPD` shows only `IPD`

### Combined Filtering

A patient row is shown only when:

- it matches the selected type filter, and
- it matches the text search in name or condition

## 8. Edge Cases

- Empty search + `All` type = full patient list
- Search text with no matching names or conditions = no-match state
- Patients with blank `condition` fields must still be searchable by name
- Search input with extra spaces should behave the same as trimmed input
- Filtering must not mutate or reorder the stored patient source list unexpectedly beyond the filtered display

## 9. Selection and Bulk Delete Behavior

Existing bulk selection behavior needs special care.

### Design Rule

Bulk actions should continue to apply only to the explicitly selected patient IDs that remain visible in the current filtered result set. Filtering should not silently expand selection to hidden rows.

### Implementation Direction

- Keep selection keyed by patient ID, as it is today
- Ensure the visible checkbox state is based on the filtered list being shown
- Ensure “select all” applies to the currently visible filtered rows, not the entire hidden dataset
- When a filter change hides previously selected rows, clear those hidden selections automatically
- The bulk delete count should always reflect only the currently visible selected rows

This avoids surprising destructive behavior after filters are introduced.

## 10. CSV Export Behavior

The existing Export CSV action should respect the active filters.

- With no active filters, export the full patient list as it works today
- With active filters, export only the currently visible filtered rows
- If filters are active and zero rows are visible, disable Export CSV until the visible result set is non-empty
- The exported columns remain the current patient export columns unless a later Phase 4 slice changes them explicitly
- The export action should not include hidden non-matching rows

## 11. Error Handling

This slice should not introduce new persistence or IPC failure modes.

- Existing app startup / Electron API failure behavior stays unchanged
- Filter interactions must be purely client-side and should never throw user-visible technical errors
- The design should prefer safe defaults when optional fields such as `condition` are missing

## 12. Verification

### Manual Checks

1. Add several patients with mixed `OPD` / `IPD` types and different conditions
2. Search by partial patient name
3. Search by partial condition text
4. Filter by `OPD`
5. Filter by `IPD`
6. Combine text search with type filter
7. Clear filters and confirm the full list returns
8. Trigger a no-match state and confirm the recovery path is obvious
9. Verify row selection and bulk delete still behave correctly under filters
10. Apply filters and confirm Export CSV contains only the currently visible rows
11. Clear filters and confirm Export CSV returns to exporting the full patient list

### Required Commands

- `npm run build`
- `npm run lint`

### Done Criteria

This slice is done when the Patients tab can instantly filter by name/condition and type, selection/delete/export all stay consistent with the visible filtered result set, and the rest of the app remains behaviorally unchanged.

## 13. Why This Slice First

This is the lowest-risk, highest-value opening step for Phase 4:

- it improves day-to-day usability immediately
- it does not weaken the Phase 3 database hardening work
- it avoids premature database search APIs
- it creates a better patient-directory surface for later editing and profile work

## 14. Next Likely Phase 4 Slices

After this slice, the most natural follow-up options are:

1. edit patient details
2. patient profile with session history
3. pagination or virtual scrolling if the list grows large

Those should be planned separately and must not be folded into this implementation spec.
