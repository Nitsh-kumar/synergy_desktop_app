import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_PATIENT_FORM,
  createPatientEditBaseline,
  isPatientFormDirty,
  shouldConfirmDiscardPatientForm,
  isMissingPatientRecordError,
  applyPatientEditResult,
} from '../../src/lib/patientEditing.js';

// ── fixtures ──────────────────────────────────────────────────────────────────

const patient1 = {
  id: 'patient-1',
  name: 'Anita Sharma',
  phone: '9876543210',
  condition: 'Lower Back Pain',
  type: 'OPD',
  dateAdded: '2026-06-23T10:00:00.000Z',
};

const patient2 = {
  id: 'patient-2',
  name: 'Rahul Mehta',
  phone: '9988776655',
  condition: 'Shoulder Stiffness',
  type: 'IPD',
  dateAdded: '2026-06-22T10:00:00.000Z',
};

const baseState = {
  patients: [patient1, patient2],
  sessions: [
    { id: 's-1', patientId: 'patient-1', patientName: 'Anita Sharma', type: 'Consultation', cost: 500 },
    { id: 's-2', patientId: 'patient-2', patientName: 'Rahul Mehta', type: 'Physiotherapy', cost: 700 },
  ],
  ipdPlans: [
    { id: 'ipd-1', patientId: 'patient-1', patientName: 'Anita Sharma', title: 'Lumbar Rehab' },
    { id: 'ipd-2', patientId: 'patient-2', patientName: 'Rahul Mehta', title: 'Shoulder Rehab' },
  ],
  sessionPatientId: 'patient-1',
  ipdPatientId: 'patient-1',
};

// ── createPatientEditBaseline ─────────────────────────────────────────────────

test('createPatientEditBaseline returns EMPTY_PATIENT_FORM for null (add-mode baseline clean)', () => {
  const result = createPatientEditBaseline(null);
  assert.deepEqual(result, EMPTY_PATIENT_FORM);
});

test('createPatientEditBaseline called with no argument returns EMPTY_PATIENT_FORM', () => {
  assert.deepEqual(createPatientEditBaseline(), EMPTY_PATIENT_FORM);
});

test('createPatientEditBaseline maps patient fields to strings (edit-mode baseline clean)', () => {
  const result = createPatientEditBaseline(patient1);
  assert.equal(result.name, 'Anita Sharma');
  assert.equal(result.phone, '9876543210');
  assert.equal(result.condition, 'Lower Back Pain');
  assert.equal(result.type, 'OPD');
});

test('createPatientEditBaseline normalizes null phone and undefined condition to empty string', () => {
  const patient = { id: 'x', name: 'Test', phone: null, condition: undefined, type: 'IPD' };
  const result = createPatientEditBaseline(patient);
  assert.equal(result.phone, '');
  assert.equal(result.condition, '');
});

// ── isPatientFormDirty ────────────────────────────────────────────────────────

test('isPatientFormDirty returns false for add-mode baseline with all-empty form (add-mode baseline clean)', () => {
  const baseline = createPatientEditBaseline(null);
  const form = { name: '', phone: '', condition: '', type: 'OPD' };
  assert.equal(isPatientFormDirty(form, baseline), false);
});

test('isPatientFormDirty returns false for edit-mode baseline with matching values (edit-mode baseline clean)', () => {
  const baseline = createPatientEditBaseline(patient1);
  const form = { name: 'Anita Sharma', phone: '9876543210', condition: 'Lower Back Pain', type: 'OPD' };
  assert.equal(isPatientFormDirty(form, baseline), false);
});

test('isPatientFormDirty returns false for whitespace-only inputs against empty baseline (whitespace-only dirty input case)', () => {
  const baseline = createPatientEditBaseline(null);
  const form = { name: '   ', phone: '  ', condition: '\t', type: 'OPD' };
  assert.equal(isPatientFormDirty(form, baseline), false);
});

test('isPatientFormDirty returns true when only type differs (type-only dirtiness)', () => {
  const baseline = createPatientEditBaseline(null);
  const form = { name: '', phone: '', condition: '', type: 'IPD' };
  assert.equal(isPatientFormDirty(form, baseline), true);
});

test('isPatientFormDirty returns true when name differs', () => {
  const baseline = createPatientEditBaseline(patient1);
  const form = { name: 'Changed Name', phone: '9876543210', condition: 'Lower Back Pain', type: 'OPD' };
  assert.equal(isPatientFormDirty(form, baseline), true);
});

test('isPatientFormDirty returns true when phone differs', () => {
  const baseline = createPatientEditBaseline(patient1);
  const form = { name: 'Anita Sharma', phone: '0000000000', condition: 'Lower Back Pain', type: 'OPD' };
  assert.equal(isPatientFormDirty(form, baseline), true);
});

test('isPatientFormDirty returns true when condition differs', () => {
  const baseline = createPatientEditBaseline(patient1);
  const form = { name: 'Anita Sharma', phone: '9876543210', condition: 'New Condition', type: 'OPD' };
  assert.equal(isPatientFormDirty(form, baseline), true);
});

// ── shouldConfirmDiscardPatientForm ───────────────────────────────────────────

test('shouldConfirmDiscardPatientForm returns false when form is clean', () => {
  const baseline = createPatientEditBaseline(null);
  const form = { ...EMPTY_PATIENT_FORM };
  assert.equal(shouldConfirmDiscardPatientForm(form, baseline), false);
});

test('shouldConfirmDiscardPatientForm returns true when form is dirty', () => {
  const baseline = createPatientEditBaseline(null);
  const form = { name: 'Someone', phone: '', condition: '', type: 'OPD' };
  assert.equal(shouldConfirmDiscardPatientForm(form, baseline), true);
});

// ── isMissingPatientRecordError ───────────────────────────────────────────────

test('isMissingPatientRecordError returns true for exact message match', () => {
  const err = new Error('Invalid patient: record no longer exists');
  assert.equal(isMissingPatientRecordError(err), true);
});

test('isMissingPatientRecordError returns true for Electron-wrapped IPC message (substring match)', () => {
  const err = new Error('IPC handler error: Invalid patient: record no longer exists (at patients:update)');
  assert.equal(isMissingPatientRecordError(err), true);
});

test('isMissingPatientRecordError returns false for a different validation error', () => {
  const err = new Error('Invalid patient: name is required');
  assert.equal(isMissingPatientRecordError(err), false);
});

test('isMissingPatientRecordError returns false for null', () => {
  assert.equal(isMissingPatientRecordError(null), false);
});

test('isMissingPatientRecordError returns false for an unrelated string', () => {
  assert.equal(isMissingPatientRecordError('some unrelated error'), false);
});

// ── applyPatientEditResult ────────────────────────────────────────────────────

test('applyPatientEditResult replaces the full patient row (not just name changes)', () => {
  const updatedPatient = {
    ...patient1,
    name: 'Anita S.',
    phone: '1111111111',
    condition: 'Updated Condition',
    type: 'OPD',
  };
  const result = applyPatientEditResult({ ...baseState, updatedPatient });
  assert.deepEqual(result.patients.find((p) => p.id === 'patient-1'), updatedPatient);
});

test('applyPatientEditResult does not change unrelated patient rows', () => {
  const updatedPatient = { ...patient1, name: 'Anita S.' };
  const result = applyPatientEditResult({ ...baseState, updatedPatient });
  assert.deepEqual(result.patients.find((p) => p.id === 'patient-2'), patient2);
});

test('applyPatientEditResult updates session display names on rename', () => {
  const updatedPatient = { ...patient1, name: 'Anita S.' };
  const result = applyPatientEditResult({ ...baseState, updatedPatient });
  assert.equal(result.sessions.find((s) => s.id === 's-1').patientName, 'Anita S.');
  assert.equal(result.sessions.find((s) => s.id === 's-2').patientName, 'Rahul Mehta');
});

test('applyPatientEditResult updates IPD plan display names on rename', () => {
  const updatedPatient = { ...patient1, name: 'Anita S.' };
  const result = applyPatientEditResult({ ...baseState, updatedPatient });
  assert.equal(result.ipdPlans.find((i) => i.id === 'ipd-1').patientName, 'Anita S.');
  assert.equal(result.ipdPlans.find((i) => i.id === 'ipd-2').patientName, 'Rahul Mehta');
});

test('applyPatientEditResult returns same sessions/ipdPlans references when name is unchanged', () => {
  const updatedPatient = { ...patient1, phone: '0000000000' };
  const result = applyPatientEditResult({ ...baseState, updatedPatient });
  assert.strictEqual(result.sessions, baseState.sessions);
  assert.strictEqual(result.ipdPlans, baseState.ipdPlans);
});

test('applyPatientEditResult clears sessionPatientId when OPD patient changes to IPD', () => {
  const updatedPatient = { ...patient1, type: 'IPD' };
  const result = applyPatientEditResult({ ...baseState, updatedPatient });
  assert.equal(result.sessionPatientId, '');
});

test('applyPatientEditResult preserves sessionPatientId when OPD patient remains OPD', () => {
  const updatedPatient = { ...patient1, name: 'Anita S.' };
  const result = applyPatientEditResult({ ...baseState, updatedPatient });
  assert.equal(result.sessionPatientId, 'patient-1');
});

test('applyPatientEditResult leaves ipdPatientId unchanged regardless of type change', () => {
  const updatedPatient = { ...patient1, type: 'IPD' };
  const result = applyPatientEditResult({ ...baseState, updatedPatient });
  assert.equal(result.ipdPatientId, 'patient-1');
});

test('applyPatientEditResult returns original state unchanged if updated patient not found locally', () => {
  const updatedPatient = { id: 'patient-999', name: 'Ghost', phone: '', condition: '', type: 'OPD' };
  const result = applyPatientEditResult({ ...baseState, updatedPatient });
  assert.strictEqual(result.patients, baseState.patients);
  assert.strictEqual(result.sessions, baseState.sessions);
  assert.strictEqual(result.ipdPlans, baseState.ipdPlans);
  assert.equal(result.sessionPatientId, baseState.sessionPatientId);
  assert.equal(result.ipdPatientId, baseState.ipdPatientId);
});
