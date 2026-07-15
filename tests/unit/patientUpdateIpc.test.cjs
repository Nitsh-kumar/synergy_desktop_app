'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function loadIpc() {
  const modulePath = require.resolve('../../lib/patientUpdateIpc.cjs');
  delete require.cache[modulePath];
  return require('../../lib/patientUpdateIpc.cjs');
}

function makeIpcMain() {
  const handlers = {};
  return {
    handle(channel, fn) {
      handlers[channel] = fn;
    },
    handlers,
  };
}

const SAVED_PATIENT = {
  id: 'patient-1',
  name: 'Anita Sharma',
  phone: '9876543210',
  condition: 'Lower Back Pain',
  type: 'OPD',
  dateAdded: '2026-06-23T10:00:00.000Z',
};

function makeDb(returnValue) {
  return {
    updatePatient() {
      return returnValue;
    },
  };
}

test('registerPatientUpdateIpc registers patients:update handler', () => {
  const { registerPatientUpdateIpc } = loadIpc();
  const ipcMain = makeIpcMain();
  const db = makeDb(SAVED_PATIENT);
  const mockSecurityService = { getState: () => 'UNLOCKED' };

  registerPatientUpdateIpc(ipcMain, db, mockSecurityService);

  assert.ok(typeof ipcMain.handlers['patients:update'] === 'function');
});

test('patients:update handler returns normalised patient from database', async () => {
  const { registerPatientUpdateIpc } = loadIpc();
  const ipcMain = makeIpcMain();
  const db = makeDb(SAVED_PATIENT);
  const mockSecurityService = { getState: () => 'UNLOCKED' };

  registerPatientUpdateIpc(ipcMain, db, mockSecurityService);

  const result = await ipcMain.handlers['patients:update']({}, {
    id: 'patient-1',
    name: '  Anita Sharma  ',
    phone: '9876543210',
    condition: 'Lower Back Pain',
    type: 'OPD',
  });

  assert.deepEqual(result, SAVED_PATIENT);
});

test('patients:update handler propagates validation errors unchanged', async () => {
  const { registerPatientUpdateIpc } = loadIpc();
  const ipcMain = makeIpcMain();
  const db = makeDb(SAVED_PATIENT);
  const mockSecurityService = { getState: () => 'UNLOCKED' };

  registerPatientUpdateIpc(ipcMain, db, mockSecurityService);

  await assert.rejects(
    () => ipcMain.handlers['patients:update']({}, { id: '', name: 'Anita', type: 'OPD' }),
    /Invalid patient/
  );
});

test('patients:update handler propagates not-found error unchanged', async () => {
  const { registerPatientUpdateIpc } = loadIpc();
  const ipcMain = makeIpcMain();
  const db = makeDb(null); // simulates missing row
  const mockSecurityService = { getState: () => 'UNLOCKED' };

  registerPatientUpdateIpc(ipcMain, db, mockSecurityService);

  await assert.rejects(
    () => ipcMain.handlers['patients:update']({}, { id: 'p1', name: 'Anita', type: 'OPD' }),
    { message: 'Invalid patient: record no longer exists' }
  );
});

test('patients:update handler rejects when app is locked', async () => {
  const { registerPatientUpdateIpc } = loadIpc();
  const ipcMain = makeIpcMain();
  const db = makeDb(SAVED_PATIENT);
  const mockSecurityService = { getState: () => 'LOCKED' };

  registerPatientUpdateIpc(ipcMain, db, mockSecurityService);

  await assert.rejects(
    () => ipcMain.handlers['patients:update']({}, { id: 'patient-1', name: 'Anita', type: 'OPD' }),
    (err) => {
      assert.equal(err.code, 'APP_LOCKED');
      return true;
    }
  );
});

