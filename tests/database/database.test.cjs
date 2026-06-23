const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const BetterSqlite3 = require('better-sqlite3');
const { createTempDir, removeTempDir } = require('../helpers/tempDir.cjs');

function loadDatabaseModule() {
  const modulePath = require.resolve('../../database.cjs');
  delete require.cache[modulePath];
  return require('../../database.cjs');
}

function createPatient(overrides = {}) {
  return {
    id: overrides.id || 'patient-1',
    name: overrides.name || 'Anita Sharma',
    phone: overrides.phone || '9876543210',
    address: overrides.address || 'Pune',
    condition: overrides.condition || 'Lower Back Pain',
    type: overrides.type || 'OPD',
    dateAdded: overrides.dateAdded || '2026-06-23T10:00:00.000Z',
  };
}

function createSession(overrides = {}) {
  return {
    id: overrides.id || 'session-1',
    patientId: overrides.patientId || 'patient-1',
    type: overrides.type || 'Consultation',
    notes: overrides.notes || 'Initial assessment completed',
    cost: overrides.cost || 500,
    date: overrides.date || '2026-06-23T11:00:00.000Z',
  };
}

function createIpdPlan(overrides = {}) {
  return {
    id: overrides.id || 'ipd-1',
    patientId: overrides.patientId || 'patient-1',
    title: overrides.title || 'Lumbar Spine Rehabilitation',
    totalSessions: overrides.totalSessions || 10,
    startDate: overrides.startDate || '2026-06-24',
    notes: overrides.notes || 'Focus on mobility and strengthening',
  };
}

async function withTestDatabase(runTest) {
  const userDataPath = createTempDir();
  const database = loadDatabaseModule();
  const dbPath = database.initDatabase(userDataPath);

  try {
    await runTest({ database, dbPath, userDataPath });
  } finally {
    database.closeDatabase();
    removeTempDir(userDataPath);
  }
}

test('initializes database and applies migrations in a temp directory', async () => {
  await withTestDatabase(async ({ dbPath }) => {
    assert.equal(path.basename(dbPath), 'synergy.db');

    const inspectionDb = new BetterSqlite3(dbPath, { readonly: true });
    const tables = inspectionDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all();
    const migrationCount = inspectionDb.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get();
    inspectionDb.close();

    assert.deepEqual(
      tables.map((table) => table.name),
      ['config', 'ipd_plans', 'patients', 'schema_migrations', 'sessions']
    );
    assert.equal(migrationCount.count, 1);
  });
});

test('re-initialization is safe and does not duplicate applied migrations', async () => {
  await withTestDatabase(async ({ database, dbPath, userDataPath }) => {
    const secondPath = database.initDatabase(userDataPath);
    assert.equal(secondPath, dbPath);

    const inspectionDb = new BetterSqlite3(dbPath, { readonly: true });
    const migrationRows = inspectionDb.prepare('SELECT id FROM schema_migrations ORDER BY id').all();
    inspectionDb.close();

    assert.deepEqual(migrationRows, [{ id: '001_initial_schema' }]);
  });
});

test('patient create and list works', async () => {
  await withTestDatabase(async ({ database }) => {
    const createdPatient = createPatient();

    database.addPatient(createdPatient);
    const patients = database.getAllPatients();

    assert.equal(patients.length, 1);
    assert.equal(patients[0].id, createdPatient.id);
    assert.equal(patients[0].name, createdPatient.name);
    assert.equal(patients[0].phone, createdPatient.phone);
  });
});

test('session create and read works', async () => {
  await withTestDatabase(async ({ database }) => {
    const patient = createPatient();
    const session = createSession();

    database.addPatient(patient);
    database.addSession(session);

    const sessions = database.getAllSessions();
    const patientSessions = database.getSessionsByPatient(patient.id);

    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].patientName, patient.name);
    assert.equal(sessions[0].notes, session.notes);
    assert.equal(patientSessions.length, 1);
    assert.equal(patientSessions[0].patientId, patient.id);
  });
});

test('ipd plan create and read works', async () => {
  await withTestDatabase(async ({ database }) => {
    const patient = createPatient({ type: 'IPD' });
    const ipdPlan = createIpdPlan({ patientId: patient.id });

    database.addPatient(patient);
    database.addIpdPlan(ipdPlan);

    const plans = database.getAllIpdPlans();

    assert.equal(plans.length, 1);
    assert.equal(plans[0].patientName, patient.name);
    assert.equal(plans[0].title, ipdPlan.title);
    assert.equal(plans[0].totalSessions, ipdPlan.totalSessions);
  });
});

test('deleting a patient cascades related sessions and ipd plans', async () => {
  await withTestDatabase(async ({ database }) => {
    const patient = createPatient({ type: 'IPD' });
    const session = createSession({ patientId: patient.id });
    const ipdPlan = createIpdPlan({ patientId: patient.id });

    database.addPatient(patient);
    database.addSession(session);
    database.addIpdPlan(ipdPlan);

    database.deletePatient(patient.id);

    assert.equal(database.getAllPatients().length, 0);
    assert.equal(database.getAllSessions().length, 0);
    assert.equal(database.getAllIpdPlans().length, 0);
  });
});

test('bulk patient delete removes all requested patients', async () => {
  await withTestDatabase(async ({ database }) => {
    const firstPatient = createPatient({ id: 'patient-1', name: 'Asha' });
    const secondPatient = createPatient({ id: 'patient-2', name: 'Meera', type: 'IPD' });

    database.addPatient(firstPatient);
    database.addPatient(secondPatient);
    database.deletePatients([firstPatient.id, secondPatient.id]);

    assert.deepEqual(database.getAllPatients(), []);
  });
});

test('health check returns database status and patient count', async () => {
  await withTestDatabase(async ({ database }) => {
    database.addPatient(createPatient());

    const health = database.healthCheck();

    assert.equal(health.ok, true);
    assert.equal(health.patientCount, 1);
    assert.equal(String(health.journalMode).toLowerCase(), 'wal');
    assert.equal(Number(health.foreignKeys), 1);
  });
});

test('updatePatient changes fields, preserves dateAdded, and keeps exactly one row', async () => {
  await withTestDatabase(async ({ database }) => {
    const original = createPatient();
    database.addPatient(original);

    const updated = database.updatePatient({
      id: original.id,
      name: 'Sunita Patel',
      phone: '9000000001',
      condition: 'Neck Pain',
      type: 'IPD',
    });

    const patients = database.getAllPatients();
    assert.equal(patients.length, 1);
    assert.equal(patients[0].name, 'Sunita Patel');
    assert.equal(patients[0].phone, '9000000001');
    assert.equal(patients[0].condition, 'Neck Pain');
    assert.equal(patients[0].type, 'IPD');
    assert.equal(patients[0].dateAdded, original.dateAdded);
    assert.deepEqual(updated, patients[0]);
  });
});

test('updatePatient returns null when the patient does not exist', async () => {
  await withTestDatabase(async ({ database }) => {
    const result = database.updatePatient({
      id: 'nonexistent-id',
      name: 'Nobody',
      phone: null,
      condition: null,
      type: 'OPD',
    });

    assert.equal(result, null);
  });
});
