# Patient Search and Filter Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add instant patient search and type filtering to the Patients tab while keeping the Phase 3 SQLite/Electron safety boundary unchanged and making selection, bulk delete, and CSV export behave only on the visible filtered result set.

**Architecture:** Keep all database, IPC, and preload code unchanged. Extract two small pure renderer-side helper modules: one for patient-directory filtering/selection math and one for CSV serialization. Then keep `src/App.jsx` focused on state/handlers by moving the Patients-tab directory markup into a dedicated `PatientDirectorySection` component.

**Tech Stack:** React 19, Vite 8, Electron preload API (`window.electronAPI`), vanilla CSS, Node built-in test runner (`node:test`), ESLint

---

## File Map

- Create: `src/patientDirectoryFilters.js`
  - Pure patient-directory filter and selection helpers only.
- Create: `src/patientDirectoryFilters.test.js`
  - `node:test` coverage for search/type filtering, filter-state detection, selection pruning, and visible-selection math.
- Create: `src/patientDirectoryCsv.js`
  - Pure CSV serialization for already-visible patient rows only.
- Create: `src/patientDirectoryCsv.test.js`
  - `node:test` coverage for CSV headers, null handling, and CSV escaping.
- Create: `src/PatientDirectorySection.jsx`
  - Presentational Patients-tab directory component: filter bar, actions, table, and no-match state.
- Modify: `src/App.jsx:27-80`
  - Add Patients-tab filter state plus derived visible-row state.
- Modify: `src/App.jsx:117-143`
  - Make patient selection and bulk delete respect visible filtered rows only.
- Modify: `src/App.jsx:219-235`
  - Make Export CSV use visible filtered rows and disable when none are visible.
- Modify: `src/App.jsx:511-592`
  - Replace inline Patients-tab directory markup with the focused `PatientDirectorySection` component.
- Modify: `src/App.css:161-232`
  - Add patient filter bar and no-match styling only.

## Constraints to Preserve

- Do **not** modify `database.cjs`, `main.cjs`, or `preload.cjs`.
- Do **not** add new IPC channels or database queries.
- Do **not** change dashboard counts or OPD/IPD patient selectors in this slice.
- Do **not** add editing, profiles, pagination, billing, prescriptions, template upload, reports, backup/restore, or AI work.
- Keep filter state renderer-only and session-only.
- Treat missing `condition` and `phone` values safely.

## Preflight

- [ ] Run `npm run build`
- [ ] Run `npm run lint`
- [ ] Confirm both commands pass before changing code
- [ ] Record the current base commit SHA for later scope review with `git rev-parse HEAD | Set-Content .git\phase4-patient-search-base.txt`

## Test Strategy Note

The repo does not currently have a React component test harness. Apply TDD to pure logic by extracting helper modules and covering them with `node:test`. Verify JSX wiring with helper tests, `npm run build`, `npm run lint`, and the manual Electron checklist.

## Chunk 1: Helper modules

### Task 1: Add patient-directory filter and selection tests

**Files:**
- Create: `src/patientDirectoryFilters.test.js`
- Reference: `docs/superpowers/specs/2026-06-22-patient-search-filter-design.md`

- [ ] **Step 1: Write the failing filter/selection test file**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterPatients,
  getVisibleSelectedPatientIds,
  hasActivePatientFilters,
  pruneSelectionToVisible,
  areAllVisiblePatientsSelected,
} from './patientDirectoryFilters.js';

const patients = [
  { id: 'p1', name: 'Rajesh Kumar', condition: 'Lower Back Pain', type: 'OPD' },
  { id: 'p2', name: 'Anita Shah', condition: 'Neck Stiffness', type: 'IPD' },
  { id: 'p3', name: 'Ravi Nair', condition: null, type: 'OPD' },
];

test('filterPatients matches trimmed case-insensitive substrings in name and condition', () => {
  assert.deepEqual(
    filterPatients(patients, { searchText: '  back ', type: 'All' }).map((patient) => patient.id),
    ['p1'],
  );
});

test('filterPatients supports OPD-only and IPD-only filter states', () => {
  assert.deepEqual(
    filterPatients(patients, { searchText: '', type: 'OPD' }).map((patient) => patient.id),
    ['p1', 'p3'],
  );

  assert.deepEqual(
    filterPatients(patients, { searchText: '', type: 'IPD' }).map((patient) => patient.id),
    ['p2'],
  );
});

test('filterPatients treats whitespace-only search as empty input', () => {
  assert.deepEqual(
    filterPatients(patients, { searchText: '   ', type: 'All' }).map((patient) => patient.id),
    ['p1', 'p2', 'p3'],
  );
});

test('filterPatients returns an empty array when nothing matches', () => {
  assert.deepEqual(filterPatients(patients, { searchText: 'shoulder', type: 'IPD' }), []);
});

test('filterPatients preserves source order and does not mutate the input array', () => {
  const before = patients.map((patient) => patient.id);
  const result = filterPatients(patients, { searchText: 'ra', type: 'OPD' });

  assert.deepEqual(result.map((patient) => patient.id), ['p1', 'p3']);
  assert.deepEqual(patients.map((patient) => patient.id), before);
});

test('hasActivePatientFilters only returns true for non-default state', () => {
  assert.equal(hasActivePatientFilters({ searchText: '', type: 'All' }), false);
  assert.equal(hasActivePatientFilters({ searchText: '   ', type: 'All' }), false);
  assert.equal(hasActivePatientFilters({ searchText: '', type: 'OPD' }), true);
  assert.equal(hasActivePatientFilters({ searchText: 'ra', type: 'All' }), true);
});

test('pruneSelectionToVisible removes hidden ids without mutating the incoming Set', () => {
  const selected = new Set(['p1', 'p2']);
  const next = pruneSelectionToVisible(selected, [{ id: 'p1' }]);

  assert.deepEqual([...next], ['p1']);
  assert.deepEqual([...selected], ['p1', 'p2']);
});

test('getVisibleSelectedPatientIds returns only visible selected ids in visible order', () => {
  const visible = [{ id: 'p3' }, { id: 'p1' }];
  const ids = getVisibleSelectedPatientIds(new Set(['p1', 'p2', 'p3']), visible);
  assert.deepEqual(ids, ['p3', 'p1']);
});

test('areAllVisiblePatientsSelected is true only when every visible row is selected', () => {
  assert.equal(areAllVisiblePatientsSelected(new Set(['p1', 'p3']), [{ id: 'p1' }, { id: 'p3' }]), true);
  assert.equal(areAllVisiblePatientsSelected(new Set(['p1']), [{ id: 'p1' }, { id: 'p3' }]), false);
});
```

- [ ] **Step 2: Run the filter test file to verify it fails**

Run: `node --test src/patientDirectoryFilters.test.js`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND` or missing export errors because `src/patientDirectoryFilters.js` does not exist yet.

- [ ] **Step 3: Implement the minimal pure filter module**

Create `src/patientDirectoryFilters.js`:

```js
function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

export function hasActivePatientFilters({ searchText, type }) {
  return normalizeText(searchText).length > 0 || type !== 'All';
}

export function filterPatients(patients, { searchText, type }) {
  const query = normalizeText(searchText);

  return patients.filter((patient) => {
    const matchesType = type === 'All' || patient.type === type;
    const name = normalizeText(patient.name);
    const condition = normalizeText(patient.condition);
    const matchesText = query.length === 0 || name.includes(query) || condition.includes(query);

    return matchesType && matchesText;
  });
}

export function pruneSelectionToVisible(selectedIds, visiblePatients) {
  const visibleIds = new Set(visiblePatients.map((patient) => patient.id));
  return new Set([...selectedIds].filter((id) => visibleIds.has(id)));
}

export function getVisibleSelectedPatientIds(selectedIds, visiblePatients) {
  return visiblePatients
    .map((patient) => patient.id)
    .filter((id) => selectedIds.has(id));
}

export function areAllVisiblePatientsSelected(selectedIds, visiblePatients) {
  return visiblePatients.length > 0 && getVisibleSelectedPatientIds(selectedIds, visiblePatients).length === visiblePatients.length;
}
```

- [ ] **Step 4: Run the filter tests and lint**

Run:

```bash
node --test src/patientDirectoryFilters.test.js
npm run lint
```

Expected:

- `node --test` PASS with 9 tests green
- `npm run lint` PASS

- [ ] **Step 5: Commit the filter helper module**

```bash
git add src/patientDirectoryFilters.js src/patientDirectoryFilters.test.js
git commit -m "feat: add patient directory filter helpers"
```

### Task 2: Add CSV serialization tests and implementation

**Files:**
- Create: `src/patientDirectoryCsv.test.js`
- Create: `src/patientDirectoryCsv.js`

- [ ] **Step 1: Write the failing CSV test file**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPatientCsv } from './patientDirectoryCsv.js';

const visiblePatients = [
  { id: 'p2', name: 'Anita Shah', phone: '', condition: 'Neck Stiffness', type: 'IPD', dateAdded: '2026-06-21T10:00:00.000Z' },
  { id: 'p4', name: 'A "B", C', phone: null, condition: 'Post-op, Stage "2"', type: 'OPD', dateAdded: '2026-06-23T10:00:00.000Z' },
];

test('buildPatientCsv writes the current patient export columns in order', () => {
  const csv = buildPatientCsv(visiblePatients);
  assert.equal(csv.split('\n')[0], 'id,name,phone,condition,type,dateAdded');
});

test('buildPatientCsv includes only the provided visible rows', () => {
  const csv = buildPatientCsv([visiblePatients[0]]);
  assert.match(csv, /Anita Shah/);
  assert.doesNotMatch(csv, /A ""B"", C/);
});

test('buildPatientCsv safely serializes empty and null values', () => {
  const csv = buildPatientCsv([visiblePatients[1]]);
  assert.match(csv, /"","Post-op, Stage ""2""",OPD/);
});

test('buildPatientCsv escapes commas and quotes inside CSV cells', () => {
  const csv = buildPatientCsv([visiblePatients[1]]);
  assert.match(csv, /"A ""B"", C"/);
  assert.match(csv, /"Post-op, Stage ""2"""/);
});
```

- [ ] **Step 2: Run the CSV test file to verify it fails**

Run: `node --test src/patientDirectoryCsv.test.js`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND` because `src/patientDirectoryCsv.js` does not exist yet.

- [ ] **Step 3: Implement the minimal CSV module**

Create `src/patientDirectoryCsv.js`:

```js
function escapeCsvValue(value) {
  return `"${String(value || '').replaceAll('"', '""')}"`;
}

export function buildPatientCsv(patients) {
  const headers = ['id', 'name', 'phone', 'condition', 'type', 'dateAdded'];
  const rows = patients.map((patient) =>
    [
      patient.id,
      escapeCsvValue(patient.name),
      escapeCsvValue(patient.phone),
      escapeCsvValue(patient.condition),
      patient.type,
      patient.dateAdded,
    ].join(','),
  );

  return [headers.join(','), ...rows].join('\n');
}
```

- [ ] **Step 4: Run the CSV tests and lint**

Run:

```bash
node --test src/patientDirectoryCsv.test.js
npm run lint
```

Expected:

- `node --test` PASS with 4 tests green
- `npm run lint` PASS

- [ ] **Step 5: Commit the CSV helper module**

```bash
git add src/patientDirectoryCsv.js src/patientDirectoryCsv.test.js
git commit -m "feat: add patient directory csv helper"
```

## Chunk 2: App.jsx integration

**Prerequisite:** Chunk 1 is complete and both helper modules exist with passing tests.

### Task 3: Add filter state and derived visible-row state

**Files:**
- Modify: `src/App.jsx:27-80`
- Modify: `src/App.jsx:240-260`
- Reference: `src/patientDirectoryFilters.js`

- [ ] **Step 1: Extend the existing imports with the new helper modules**

Add:

```js
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  areAllVisiblePatientsSelected,
  filterPatients,
  getVisibleSelectedPatientIds,
  hasActivePatientFilters,
  pruneSelectionToVisible,
} from './patientDirectoryFilters.js';
import { buildPatientCsv } from './patientDirectoryCsv.js';
```

- [ ] **Step 2: Add Patients-tab filter state and a shared reset handler**

Add near the existing patient state:

```js
const [patientSearchText, setPatientSearchText] = useState('');
const [patientDirectoryTypeFilter, setPatientDirectoryTypeFilter] = useState('All');

const clearPatientFilters = useCallback(() => {
  setPatientSearchText('');
  setPatientDirectoryTypeFilter('All');
}, []);
```

- [ ] **Step 3: Derive visible patients and visible selection metadata**

Add derived values before render:

```js
const visiblePatients = useMemo(() => filterPatients(patients, {
  searchText: patientSearchText,
  type: patientDirectoryTypeFilter,
}), [patients, patientSearchText, patientDirectoryTypeFilter]);

const filtersActive = hasActivePatientFilters({
  searchText: patientSearchText,
  type: patientDirectoryTypeFilter,
});

const visibleSelectedPatientIds = getVisibleSelectedPatientIds(selectedPatientIds, visiblePatients);
const allVisiblePatientsSelected = areAllVisiblePatientsSelected(selectedPatientIds, visiblePatients);
```

- [ ] **Step 4: Clear hidden selections automatically when filters change**

Add:

```js
useEffect(() => {
  setSelectedPatientIds((current) => {
    const next = pruneSelectionToVisible(current, visiblePatients);
    return next.size === current.size ? current : next;
  });
}, [visiblePatients]);
```

- [ ] **Step 5: Re-run the helper tests after wiring the derived state**

Run:

```bash
node --test src/patientDirectoryFilters.test.js
node --test src/patientDirectoryCsv.test.js
```

Expected: both helper test commands PASS.

- [ ] **Step 6: Continue directly to Task 4 without committing yet**

`src/App.jsx` will still have temporary unused values until Task 5 renders the filter bar and uses every derived field.

### Task 4: Align selection, bulk delete, and CSV export with visible rows

**Files:**
- Modify: `src/App.jsx:117-143`
- Modify: `src/App.jsx:219-235`

- [ ] **Step 1: Update “select all” to operate on visible rows only**

Use:

```js
if (allVisiblePatientsSelected) {
  setSelectedPatientIds(new Set());
} else {
  setSelectedPatientIds(new Set(visiblePatients.map((patient) => patient.id)));
}
```

- [ ] **Step 2: Update bulk delete to use only visible selected ids**

Before calling the API:

```js
const idsToDelete = visibleSelectedPatientIds;
if (idsToDelete.length === 0) return;
const idsToDeleteSet = new Set(idsToDelete);
```

Use `idsToDelete` in:

- the confirm text
- `api.patients.deleteMany(idsToDelete)`
- local cleanup with exact replacements:

```js
setPatients((prev) => prev.filter((patient) => !idsToDeleteSet.has(patient.id)));
setSessions((prev) => prev.filter((session) => !idsToDeleteSet.has(session.patientId)));
setIpdPlans((prev) => prev.filter((plan) => !idsToDeleteSet.has(plan.patientId)));
```

- [ ] **Step 3: Update CSV export to use visible rows and disable zero-result export**

Inside `handleExportCSV`:

```js
if (visiblePatients.length === 0) return;

const csvContent = buildPatientCsv(visiblePatients);
```

Do not call the CSV helper when no rows are visible.

- [ ] **Step 4: Re-run helper tests and build**

Run:

```bash
node --test src/patientDirectoryFilters.test.js
node --test src/patientDirectoryCsv.test.js
npm run build
```

Expected: all three commands PASS.

- [ ] **Step 5: Continue directly to Task 5 without committing yet**

`filtersActive` is first consumed by the filter-bar UI in Task 5, so the first full lint pass belongs there.

### Task 5: Render the Patients-tab filter bar and no-match state

**Files:**
- Create: `src/PatientDirectorySection.jsx`
- Modify: `src/App.jsx:511-592`

- [ ] **Step 1: Create `PatientDirectorySection.jsx` for the patient-directory UI**

Create a focused presentational component that receives state and handlers from `App.jsx`.

The component should:

- render the Patient Directory header and batch actions
- place the filter bar immediately below the header and above the table/no-match region
- render visible rows only
- render a patient-specific no-match state

Use structure like:

```jsx
export default function PatientDirectorySection(props) {
  const {
    patients,
    visiblePatients,
    filtersActive,
    patientSearchText,
    patientDirectoryTypeFilter,
    setPatientSearchText,
    setPatientDirectoryTypeFilter,
    clearPatientFilters,
    selectedPatientIds,
    visibleSelectedPatientIds,
    allVisiblePatientsSelected,
    toggleSelectPatient,
    toggleSelectAll,
    handleBulkDelete,
    handleExportCSV,
    formatDate,
  } = props;

  return (
    <section className="list-container patient-directory-section">
      <div className="list-header">
        <h2>Patient Directory</h2>
        <div className="batch-actions">
          {visibleSelectedPatientIds.length > 0 && (
            <button onClick={handleBulkDelete} className="btn-danger">
              Delete Selected ({visibleSelectedPatientIds.length})
            </button>
          )}
          <button onClick={handleExportCSV} className="btn-secondary" disabled={visiblePatients.length === 0}>
            Export CSV
          </button>
        </div>
      </div>

      {patients.length > 0 && (
        <div className="patient-filter-bar">
          <div className="patient-filter-field">
            <label htmlFor="patient-search">Search Patients</label>
            <input
              id="patient-search"
              type="search"
              placeholder="Name or condition"
              value={patientSearchText}
              onChange={(event) => setPatientSearchText(event.target.value)}
            />
          </div>

          <div className="patient-filter-field">
            <label htmlFor="patient-type-filter">Patient Type</label>
            <select
              id="patient-type-filter"
              value={patientDirectoryTypeFilter}
              onChange={(event) => setPatientDirectoryTypeFilter(event.target.value)}
            >
              <option value="All">All Patients</option>
              <option value="OPD">OPD</option>
              <option value="IPD">IPD</option>
            </select>
          </div>

          {filtersActive && (
            <button type="button" className="btn-secondary" onClick={clearPatientFilters}>
              Clear Filters
            </button>
          )}
        </div>
      )}

      {patients.length === 0 ? (
        <div className="empty-state">
          No patients in the directory. Add a patient to begin.
        </div>
      ) : visiblePatients.length === 0 ? (
        <div className="empty-state patient-directory-no-match">
          <p>No patients match the current filters.</p>
          <button type="button" className="btn-secondary" onClick={clearPatientFilters}>
            Clear Filters
          </button>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input type="checkbox" checked={allVisiblePatientsSelected} onChange={toggleSelectAll} />
              </th>
              <th>Patient Name</th>
              <th>Phone</th>
              <th>Condition</th>
              <th>Type</th>
              <th>Date Added</th>
            </tr>
          </thead>
          <tbody>
            {visiblePatients.map((patient) => (
              <tr key={patient.id} className={selectedPatientIds.has(patient.id) ? 'selected' : ''}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedPatientIds.has(patient.id)}
                    onChange={() => toggleSelectPatient(patient.id)}
                  />
                </td>
                <td>{patient.name}</td>
                <td>{patient.phone || '—'}</td>
                <td>{patient.condition || '—'}</td>
                <td><span className={`badge badge-${patient.type?.toLowerCase()}`}>{patient.type}</span></td>
                <td>{formatDate(patient.dateAdded)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Import the new component and replace the inline Patients-tab directory block in `App.jsx`**

Pass the full prop set explicitly:

```jsx
import PatientDirectorySection from './PatientDirectorySection.jsx';

<PatientDirectorySection
  patients={patients}
  visiblePatients={visiblePatients}
  filtersActive={filtersActive}
  patientSearchText={patientSearchText}
  patientDirectoryTypeFilter={patientDirectoryTypeFilter}
  setPatientSearchText={setPatientSearchText}
  setPatientDirectoryTypeFilter={setPatientDirectoryTypeFilter}
  clearPatientFilters={clearPatientFilters}
  selectedPatientIds={selectedPatientIds}
  visibleSelectedPatientIds={visibleSelectedPatientIds}
  allVisiblePatientsSelected={allVisiblePatientsSelected}
  toggleSelectPatient={toggleSelectPatient}
  toggleSelectAll={toggleSelectAll}
  handleBulkDelete={handleBulkDelete}
  handleExportCSV={handleExportCSV}
  formatDate={formatDate}
/>
```

- [ ] **Step 3: Build the component behaviors exactly to the spec**

Inside `PatientDirectorySection.jsx`, ensure:

- when `patients.length === 0`, show the existing "No patients in the directory. Add a patient to begin." empty state and no filter bar
- when `patients.length > 0 && visiblePatients.length === 0`, show only the no-match branch with `className="empty-state patient-directory-no-match"`
- when `visiblePatients.length > 0`, show the filtered table branch
- the bulk-delete button only renders when `visibleSelectedPatientIds.length > 0`
- Export CSV is disabled when `visiblePatients.length === 0`
- the row loop uses `visiblePatients.map(...)`
- the header checkbox uses `allVisiblePatientsSelected`
- the no-match state uses `className="empty-state patient-directory-no-match"`
- the no-match clear button calls `clearPatientFilters`
- the filter bar labels stay visible (`Search Patients`, `Patient Type`)

- [ ] **Step 4: Run build and lint after the JSX changes**

Run:

```bash
node --test src/patientDirectoryFilters.test.js
node --test src/patientDirectoryCsv.test.js
npm run build
npm run lint
```

Expected: all four commands PASS.

- [ ] **Step 5: Run a quick UI smoke check in Electron**

Run: `npm run electron:dev`

Expected:

- Vite starts successfully
- Electron opens the desktop window
- the Patients tab renders without runtime errors

Then verify before committing:

1. create mixed OPD/IPD patients with varied conditions for the check
2. the filter bar appears only when at least one patient exists
3. a partial **name** search narrows rows immediately
4. a partial **condition** search narrows rows immediately
5. the `OPD` filter shows only OPD rows
6. the `IPD` filter shows only IPD rows
7. combined text + type filters work together
8. Clear Filters restores the full visible list
9. switching away from Patients and back keeps the current filter state during the same app session
10. a no-match search hides the table and shows the clear-filters recovery path
11. the bulk-delete button only appears when visible rows are selected
12. selecting rows and then changing filters clears any newly hidden selections
13. execute a filtered bulk delete and confirm only the currently visible selected patients are removed, along with their related sessions/IPD plans
14. with filters active, export CSV and confirm only the visible filtered rows are exported
15. clear filters, export again, and confirm the full patient list is exported
16. Export CSV is disabled when zero visible rows remain
17. stop the dev processes cleanly with `Ctrl+C` after the smoke check completes

- [ ] **Step 6: Commit the completed App.jsx integration**

```bash
git add src/App.jsx src/PatientDirectorySection.jsx
git commit -m "feat: add patient directory filter UI"
```

## Chunk 3: Styling and verification

### Task 6: Style the filter bar and no-match state

**Files:**
- Modify: `src/App.css:161-232`

- [ ] **Step 1: Add the patient-directory header and filter layout selectors**

Add all of these selectors:

```css
.patient-directory-section .list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.patient-directory-section .batch-actions {
  display: flex;
  gap: 1rem;
}

.patient-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
  align-items: center;
}

.patient-filter-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.patient-filter-field label {
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.patient-filter-bar input,
.patient-filter-bar select {
  min-width: 220px;
}
```

- [ ] **Step 2: Add patient-directory-scoped disabled and no-match styles**

Add all of these selectors:

```css
.patient-directory-section .batch-actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.patient-directory-no-match {
  text-align: center;
}

.patient-directory-no-match p {
  margin-bottom: 0.75rem;
}

.patient-directory-no-match button {
  margin-top: 1rem;
}
```

- [ ] **Step 3: Verify the new selectors stay patient-directory-scoped**

Confirm every new rule added for this feature is prefixed with one of:

- `.patient-directory-section`
- `.patient-filter-bar`
- `.patient-filter-field`
- `.patient-directory-no-match`

- [ ] **Step 4: Run build and lint**

Run:

```bash
npm run build
npm run lint
```

Expected: both commands PASS.

- [ ] **Step 5: Commit the styling**

```bash
git add src/App.css
git commit -m "style: add patient filter states"
```

### Task 7: Final verification and scope check

**Files:**
- Verify only: `src/App.jsx`, `src/App.css`, `src/PatientDirectorySection.jsx`, `src/patientDirectoryFilters.js`, `src/patientDirectoryFilters.test.js`, `src/patientDirectoryCsv.js`, `src/patientDirectoryCsv.test.js`

- [ ] **Step 1: Run the full verification command set**

Run:

```bash
node --test src/patientDirectoryFilters.test.js
node --test src/patientDirectoryCsv.test.js
npm run build
npm run lint
```

Expected: all four commands PASS.

- [ ] **Step 2: Prepare a fresh disposable app-data state**

If `%APPDATA%\synergy-app\synergy.db` contains any real or valuable local data, copy it aside before continuing. Use only disposable test data for the remaining destructive checks.

Backup commands:

```powershell
$backup = Join-Path $env:APPDATA ("synergy-app-phase4-manual-backup-" + (Get-Date -Format yyyyMMddHHmmss))
Set-Content .git\phase4-patient-db-backup-path.txt $backup
Copy-Item "$env:APPDATA\synergy-app" $backup -Recurse -Force
Remove-Item "$env:APPDATA\synergy-app\synergy.db*" -Force -ErrorAction SilentlyContinue
New-Item "$env:APPDATA\synergy-app" -ItemType Directory -Force | Out-Null
```

- [ ] **Step 3: Launch Electron for manual verification**

Run `npm run electron:dev` in a separate terminal and keep it running through Steps 4–19.  
Expected: Vite starts, Electron opens, and the Patients tab loads without runtime errors.

- [ ] **Step 4: Verify the zero-patient state**

Confirm on the disposable fresh patient directory:

1. the existing empty state is shown
2. the filter bar is not shown

- [ ] **Step 5: Seed the fixed disposable patient matrix**

Create these patients in this order and keep a note of the visible row order shown by the UI after seeding:

1. `Rajesh Kumar` — `OPD` — condition `Lower Back Pain` (control patient)
2. `Anita Shah` — `IPD` — condition `Neck Stiffness`
3. `Ravi Nair` — `OPD` — blank condition
4. `Meera Das` — `OPD` — condition `Post Surgery` (delete target)

- [ ] **Step 6: Verify trimmed, case-insensitive name search**

Search for `  RA  ` and confirm the visible matches are exactly `Rajesh Kumar` and `Ravi Nair`.

- [ ] **Step 7: Verify condition search**

Search for `  neck  ` and confirm the visible match is exactly `Anita Shah`. Then search for `back` and confirm the visible match is exactly `Rajesh Kumar`. Also confirm `Ravi Nair` remains searchable by name even though condition is blank.

- [ ] **Step 8: Verify type filters**

Confirm:

1. the `OPD` filter shows only OPD rows
2. the `IPD` filter shows only IPD rows
3. combined text + type filters work together

- [ ] **Step 9: Verify clear-filter behavior and no-match recovery**

Confirm:

1. Clear Filters appears when filters are active
2. Clear Filters resets both controls
3. a no-match search disables Export CSV
4. the no-match state shows the text `No patients match the current filters.`
5. the no-match clear action restores the full list
6. Export CSV becomes enabled again once visible matches return
7. clearing filters restores the baseline visible row order recorded in Step 5
8. keyboard tab focus can reach the search input, type filter, and Clear Filters button in order

- [ ] **Step 10: Create related records for one disposable patient**

Before delete testing, create:

1. one OPD session for `Meera Das` with type `Consultation` and fee `500`
2. one IPD plan for `Meera Das` with title `Rehab Plan` and total sessions `5`
3. record the pre-delete counts visible in the Patients tab, OPD views, and IPD Plans view

- [ ] **Step 11: Verify hidden-selection pruning**

Set the type filter to `OPD`, click Select All, and confirm `Delete Selected (3)` is shown for `Rajesh Kumar`, `Ravi Nair`, and `Meera Das`. Then add the search text `Raj` and confirm only `Rajesh Kumar` remains selected and the count drops to `Delete Selected (1)`.

- [ ] **Step 12: Verify select-all behavior**

Confirm:

1. clearing the search while staying on the `OPD` filter restores the three visible OPD patients
2. Select All only selects those three currently visible OPD rows
3. the **Delete Selected (3)** count reflects only the visible selected rows

- [ ] **Step 13: Verify filtered CSV export**

Set the filter to show only `IPD` patients, record `$exportStartedAt = Get-Date`, export CSV, then run:

```powershell
Get-ChildItem "$env:USERPROFILE\Downloads\patients_export_*.csv" |
  Where-Object { $_.LastWriteTime -gt $exportStartedAt } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
```

Open the returned file and confirm:

1. the header row is `id,name,phone,condition,type,dateAdded`
2. there is exactly one data row
3. that row is `Anita Shah`

- [ ] **Step 14: Verify full-list CSV export after clearing filters**

Clear filters, record `$secondExportStartedAt = Get-Date`, export again, then run:

```powershell
Get-ChildItem "$env:USERPROFILE\Downloads\patients_export_*.csv" |
  Where-Object { $_.LastWriteTime -gt $secondExportStartedAt } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
```

Open the returned file and confirm:

1. the same header row is preserved
2. there are four data rows before delete testing
3. the rows include `Rajesh Kumar`, `Anita Shah`, `Ravi Nair`, and `Meera Das`

- [ ] **Step 15: Verify filtered bulk delete**

Use bulk delete and confirm only the currently visible selected patients are deleted, along with their related sessions/IPD plans.

Verification points:

1. the patient row disappears from the Patients tab
2. linked OPD session rows no longer appear in the OPD views
3. linked therapy-plan rows no longer appear in the IPD Plans view
4. `Rajesh Kumar`, `Anita Shah`, and `Ravi Nair` remain untouched
5. the Patients tab count drops by exactly one compared with the pre-delete baseline

- [ ] **Step 16: Verify in-session tab persistence**

Switch to another tab and back; confirm the current filters persist during the same app session.

- [ ] **Step 17: Verify restart reset and non-patient regressions**

Confirm:

1. before relaunching, set a Patients-tab filter and confirm the OPD session selector still shows only OPD patients, independent of the Patients-tab filter
2. before relaunching, confirm the IPD plan selector still follows its existing patient-selection rule, independent of the Patients-tab filter
3. stop the current `npm run electron:dev` process with `Ctrl+C`, relaunch `npm run electron:dev`, and confirm the filters reset to default state (`search=""`, type=`All`, full list visible)
4. after the delete, the dashboard patient total reflects the three remaining patients
5. OPD/IPD selectors still use the remaining full patient dataset according to their existing rules

- [ ] **Step 18: Stop Electron before git-based scope checks**

Stop `npm run electron:dev` with `Ctrl+C` so the working tree and shell state are clean before final git review.

- [ ] **Step 19: Restore the backed-up local database if you created one**

Run only if you created a backup in Step 3:

```powershell
Remove-Item "$env:APPDATA\synergy-app" -Recurse -Force
$backup = Get-Content .git\phase4-patient-db-backup-path.txt
Copy-Item $backup "$env:APPDATA\synergy-app" -Recurse -Force
```

### Task 8: Scope review and completion

- [ ] **Step 1: Review the final file scope**

If `.git\phase4-patient-search-base.txt` is missing, stop and recreate it by running `git rev-parse HEAD | Set-Content .git\phase4-patient-search-base.txt` from the branch start point before trusting the diff output.

Run:

```bash
$base = Get-Content .git\phase4-patient-search-base.txt
git --no-pager diff --name-only $base..HEAD
git --no-pager diff --stat $base..HEAD
git --no-pager status --short
```

Expected:

- only `src/App.jsx`, `src/App.css`, `src/PatientDirectorySection.jsx`, `src/patientDirectoryFilters.js`, `src/patientDirectoryFilters.test.js`, `src/patientDirectoryCsv.js`, and `src/patientDirectoryCsv.test.js` appear in the feature diff
- no DB, IPC, or preload files appear in the feature diff
- any remaining uncommitted changes are limited to those same planned files

- [ ] **Step 2: Create the final feature commit if needed**

If the prior task commits were skipped or squashed during execution:

```bash
git add src/App.jsx src/App.css src/PatientDirectorySection.jsx src/patientDirectoryFilters.js src/patientDirectoryFilters.test.js src/patientDirectoryCsv.js src/patientDirectoryCsv.test.js
git commit -m "feat: add patient directory search and filters"
```

- [ ] **Step 3: Mark the plan complete**

Track execution progress outside the repo plan file, or revert any temporary checkbox edits to this plan before the final scope review. Confirm `git --no-pager status --short` is empty before declaring the work complete. Do not create extra repo notes for implementation tracking.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-22-patient-search-filter-plan.md`. Ready to execute?
