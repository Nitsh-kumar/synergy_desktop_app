'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function loadService() {
  const modulePath = require.resolve('../../lib/patientUpdateService.cjs');
  delete require.cache[modulePath];
  return require('../../lib/patientUpdateService.cjs');
}

function makeDb(returnValue) {
  return {
    updatePatient(payload) {
      this.lastCall = payload;
      return returnValue;
    },
    lastCall: null,
  };
}

// ── trimming ──────────────────────────────────────────────────────────────────

test('trims required fields and non-empty optional fields before writing', async () => {
  const { updatePatientRecord } = loadService();
  const db = makeDb({ id: 'p1', name: 'Anita Sharma', phone: '9876543210', condition: 'Lower Back Pain', type: 'OPD', dateAdded: '2026-06-23T10:00:00.000Z' });

  await updatePatientRecord(db, {
    id: '  p1  ',
    name: '  Anita Sharma  ',
    phone: '  9876543210  ',
    condition: '  Lower Back Pain  ',
    type: 'OPD',
  });

  assert.equal(db.lastCall.id, 'p1');
  assert.equal(db.lastCall.name, 'Anita Sharma');
  assert.equal(db.lastCall.phone, '9876543210');
  assert.equal(db.lastCall.condition, 'Lower Back Pain');
});

// ── optional field normalisation ──────────────────────────────────────────────

test('empty or whitespace-only phone becomes null', async () => {
  const { updatePatientRecord } = loadService();
  const db = makeDb({ id: 'p1', name: 'Anita Sharma', phone: null, condition: null, type: 'OPD', dateAdded: '2026-01-01T00:00:00.000Z' });

  await updatePatientRecord(db, { id: 'p1', name: 'Anita Sharma', phone: '   ', condition: '', type: 'OPD' });

  assert.equal(db.lastCall.phone, null);
  assert.equal(db.lastCall.condition, null);
});

test('undefined phone and condition become null', async () => {
  const { updatePatientRecord } = loadService();
  const db = makeDb({ id: 'p1', name: 'Anita Sharma', phone: null, condition: null, type: 'OPD', dateAdded: '2026-01-01T00:00:00.000Z' });

  await updatePatientRecord(db, { id: 'p1', name: 'Anita Sharma', type: 'OPD' });

  assert.equal(db.lastCall.phone, null);
  assert.equal(db.lastCall.condition, null);
});

// ── return value ──────────────────────────────────────────────────────────────

test('returns the full updated patient object from the database port', async () => {
  const { updatePatientRecord } = loadService();
  const saved = { id: 'p1', name: 'Anita Sharma', phone: '9876543210', condition: 'Back Pain', type: 'OPD', dateAdded: '2026-06-23T10:00:00.000Z' };
  const db = makeDb(saved);

  const result = await updatePatientRecord(db, { id: 'p1', name: 'Anita Sharma', phone: '9876543210', condition: 'Back Pain', type: 'OPD' });

  assert.deepEqual(result, saved);
});

// ── not-found ─────────────────────────────────────────────────────────────────

test('throws "Invalid patient: record no longer exists" when database returns null', () => {
  const { updatePatientRecord } = loadService();
  const db = makeDb(null);

  assert.throws(
    () => updatePatientRecord(db, { id: 'p1', name: 'Anita Sharma', type: 'OPD' }),
    (err) => {
      assert.equal(err.message, 'Invalid patient: record no longer exists');
      return true;
    }
  );
});

// ── validation – missing / null payload ──────────────────────────────────────

test('rejects missing payload', () => {
  const { updatePatientRecord } = loadService();
  const db = makeDb(null);

  assert.throws(
    () => updatePatientRecord(db, undefined),
    /Invalid patient/
  );
});

test('rejects null payload', () => {
  const { updatePatientRecord } = loadService();
  const db = makeDb(null);

  assert.throws(
    () => updatePatientRecord(db, null),
    /Invalid patient/
  );
});

// ── validation – id ───────────────────────────────────────────────────────────

test('rejects empty id', () => {
  const { updatePatientRecord } = loadService();
  const db = makeDb(null);

  assert.throws(
    () => updatePatientRecord(db, { id: '', name: 'Anita', type: 'OPD' }),
    /Invalid patient/
  );
});

test('rejects whitespace-only id', () => {
  const { updatePatientRecord } = loadService();
  const db = makeDb(null);

  assert.throws(
    () => updatePatientRecord(db, { id: '   ', name: 'Anita', type: 'OPD' }),
    /Invalid patient/
  );
});

// ── validation – name ─────────────────────────────────────────────────────────

test('rejects empty name', () => {
  const { updatePatientRecord } = loadService();
  const db = makeDb(null);

  assert.throws(
    () => updatePatientRecord(db, { id: 'p1', name: '', type: 'OPD' }),
    /Invalid patient/
  );
});

test('rejects whitespace-only name', () => {
  const { updatePatientRecord } = loadService();
  const db = makeDb(null);

  assert.throws(
    () => updatePatientRecord(db, { id: 'p1', name: '   ', type: 'OPD' }),
    /Invalid patient/
  );
});

// ── validation – type ─────────────────────────────────────────────────────────

test('rejects missing type', () => {
  const { updatePatientRecord } = loadService();
  const db = makeDb(null);

  assert.throws(
    () => updatePatientRecord(db, { id: 'p1', name: 'Anita' }),
    /Invalid patient/
  );
});

test('rejects empty type', () => {
  const { updatePatientRecord } = loadService();
  const db = makeDb(null);

  assert.throws(
    () => updatePatientRecord(db, { id: 'p1', name: 'Anita', type: '' }),
    /Invalid patient/
  );
});

test('rejects invalid type value', () => {
  const { updatePatientRecord } = loadService();
  const db = makeDb(null);

  assert.throws(
    () => updatePatientRecord(db, { id: 'p1', name: 'Anita', type: 'WALK_IN' }),
    /Invalid patient/
  );
});
