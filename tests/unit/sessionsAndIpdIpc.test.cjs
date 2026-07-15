'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Capture securityService instance passed to registerSecurityIpc
let capturedSecurityService = null;

function setupTestEnv() {
  const handlers = {};
  const mockIpcMain = {
    handle(channel, handler) {
      handlers[channel] = handler;
    }
  };

  const mockApp = {
    isPackaged: false,
    getPath() {
      return '/mock/user/data/path';
    },
    whenReady() {
      return Promise.resolve();
    },
    on() {}
  };

  const mockBrowserWindow = class {
    constructor() {}
    loadURL() { return Promise.resolve(); }
    loadFile() { return Promise.resolve(); }
    webContents = {
      openDevTools() {}
    };
    on() {}
    static getAllWindows() { return []; }
  };

  const mockDialog = {
    showErrorBox() {}
  };

  // Mock electron module
  const electronPath = require.resolve('electron');
  require.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: {
      app: mockApp,
      BrowserWindow: mockBrowserWindow,
      ipcMain: mockIpcMain,
      dialog: mockDialog
    }
  };

  // Mock database.cjs module
  const dbPath = require.resolve('../../database.cjs');
  let dbSessions = [];
  let dbIpdPlans = [];
  let addedSessions = [];
  let deletedSessions = [];
  let addedIpdPlans = [];
  let deletedIpdPlans = [];

  const mockDb = {
    initDatabase: () => '/mock/db/path',
    getConfig: (key) => {
      // Simulate that credentials exist to avoid RECOVERY_REQUIRED
      if (key === 'security.setup_completed') return 'true';
      if (key === 'security.version') return '1';
      if (key === 'security.pin_salt') return '0'.repeat(64);
      if (key === 'security.pin_hash') return '0'.repeat(128);
      return null;
    },
    getConfigValue: (key) => {
      if (key === 'security.setup_completed') return 'true';
      if (key === 'security.version') return '1';
      if (key === 'security.pin_salt') return '0'.repeat(64);
      if (key === 'security.pin_hash') return '0'.repeat(128);
      return null;
    },
    setConfig: () => {},
    deleteConfig: () => {},
    setConfigValue: () => {},
    setConfigValues: () => {},
    hasClinicData: () => true,
    healthCheck: () => {
      return { ok: true, journalMode: 'wal' };
    },

    getAllSessions: () => dbSessions,
    getSessionsByPatient: (patientId) => dbSessions.filter(s => s.patientId === patientId),
    addSession: (session) => {
      addedSessions.push(session);
      return session;
    },
    deleteSession: (id) => {
      deletedSessions.push(id);
    },

    getAllIpdPlans: () => dbIpdPlans,
    addIpdPlan: (plan) => {
      addedIpdPlans.push(plan);
      return plan;
    },
    deleteIpdPlan: (id) => {
      deletedIpdPlans.push(id);
    },

    // Reset spy helper
    resetSpies() {
      dbSessions = [];
      dbIpdPlans = [];
      addedSessions = [];
      deletedSessions = [];
      addedIpdPlans = [];
      deletedIpdPlans = [];
    },
    setSessions(s) { dbSessions = s; },
    setIpdPlans(p) { dbIpdPlans = p; },
    getAddedSessions: () => addedSessions,
    getDeletedSessions: () => deletedSessions,
    getAddedIpdPlans: () => addedIpdPlans,
    getDeletedIpdPlans: () => deletedIpdPlans,
  };
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: mockDb
  };

  // Mock registerSecurityIpc to capture securityService
  const securityIpcPath = require.resolve('../../lib/securityIpc.cjs');
  require.cache[securityIpcPath] = {
    id: securityIpcPath,
    filename: securityIpcPath,
    loaded: true,
    exports: {
      registerSecurityIpc() {
        // capturedSecurityService is captured via our securityService mock
      }
    }
  };

  // Mock securityService.cjs to add setState and intercept getState
  const realSecurityServiceModule = require('../../lib/securityService.cjs');
  const securityServicePath = require.resolve('../../lib/securityService.cjs');
  require.cache[securityServicePath] = {
    id: securityServicePath,
    filename: securityServicePath,
    loaded: true,
    exports: {
      ...realSecurityServiceModule,
      createSecurityService(opts) {
        const service = realSecurityServiceModule.createSecurityService(opts);
        let overriddenState = null;
        service.setState = (s) => {
          overriddenState = s;
        };
        const originalGetState = service.getState;
        service.getState = () => {
          return overriddenState !== null ? overriddenState : originalGetState.call(service);
        };
        capturedSecurityService = service;
        return service;
      }
    }
  };

  // Mock patientUpdateIpc
  const patientUpdateIpcPath = require.resolve('../../lib/patientUpdateIpc.cjs');
  require.cache[patientUpdateIpcPath] = {
    id: patientUpdateIpcPath,
    filename: patientUpdateIpcPath,
    loaded: true,
    exports: {
      registerPatientUpdateIpc() {}
    }
  };

  // Reload main.cjs
  const mainPath = require.resolve('../../main.cjs');
  delete require.cache[mainPath];
  require('../../main.cjs');

  return { handlers, mockDb };
}

function cleanup() {
  delete require.cache[require.resolve('electron')];
  delete require.cache[require.resolve('../../database.cjs')];
  delete require.cache[require.resolve('../../lib/securityIpc.cjs')];
  delete require.cache[require.resolve('../../lib/securityService.cjs')];
  delete require.cache[require.resolve('../../lib/patientUpdateIpc.cjs')];
  delete require.cache[require.resolve('../../main.cjs')];
  capturedSecurityService = null;
}

test('OPD Session and IPD Plan IPC protection and functionality', async (t) => {
  const { handlers, mockDb } = setupTestEnv();

  // Run the async whenReady logic inside main.cjs
  await new Promise(resolve => setTimeout(resolve, 50));

  // Now capturedSecurityService should be populated
  assert.ok(capturedSecurityService, 'capturedSecurityService should be populated');

  await t.test('sessions:getAll is protected and requires UNLOCKED state', async () => {
    // Test while locked
    capturedSecurityService.lock(); // state should be LOCKED
    await assert.rejects(
      () => handlers['sessions:getAll']({}),
      (err) => {
        assert.equal(err.code, 'APP_LOCKED');
        return true;
      }
    );

    // Test while unlocked
    // Simulate unlock manually by setting state
    capturedSecurityService.setState('UNLOCKED');
    
    mockDb.resetSpies();
    mockDb.setSessions([{ id: 's-1', patientId: 'p-1', type: 'OPD', cost: 300 }]);
    const result = await handlers['sessions:getAll']({});
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 's-1');
  });

  await t.test('sessions:getByPatient is protected and validates input', async () => {
    // Test while locked
    capturedSecurityService.setState('LOCKED');
    await assert.rejects(
      () => handlers['sessions:getByPatient']({}, 'p-1'),
      (err) => {
        assert.equal(err.code, 'APP_LOCKED');
        return true;
      }
    );

    // Test while unlocked
    capturedSecurityService.setState('UNLOCKED');
    mockDb.resetSpies();
    mockDb.setSessions([
      { id: 's-1', patientId: 'p-1', type: 'OPD', cost: 300 },
      { id: 's-2', patientId: 'p-2', type: 'OPD', cost: 300 },
    ]);

    const result = await handlers['sessions:getByPatient']({}, 'p-1');
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 's-1');

    // Test input validation
    await assert.rejects(
      () => handlers['sessions:getByPatient']({}, null),
      { message: 'Invalid patientId' }
    );
    await assert.rejects(
      () => handlers['sessions:getByPatient']({}, ''),
      { message: 'Invalid patientId' }
    );
  });

  await t.test('sessions:add is protected, validates inputs, and writes to database', async () => {
    // Test while locked
    capturedSecurityService.setState('LOCKED');
    await assert.rejects(
      () => handlers['sessions:add']({}, { patientId: 'p-1', type: 'OPD', cost: 500 }),
      (err) => {
        assert.equal(err.code, 'APP_LOCKED');
        return true;
      }
    );

    // Test while unlocked
    capturedSecurityService.setState('UNLOCKED');
    mockDb.resetSpies();

    const validSession = {
      patientId: 'p-1',
      type: '  Consultation  ',
      notes: '  Some notes  ',
      cost: '500.50'
    };

    const res = await handlers['sessions:add']({}, validSession);
    assert.ok(res.id);
    assert.equal(res.patientId, 'p-1');
    assert.equal(res.type, 'Consultation');
    assert.equal(res.notes, 'Some notes');
    assert.equal(res.cost, 500.50);
    assert.ok(res.date);

    // Verify spy
    const added = mockDb.getAddedSessions();
    assert.equal(added.length, 1);
    assert.equal(added[0].patientId, 'p-1');
    assert.equal(added[0].cost, 500.50);

    // Test validation: missing/invalid patientId
    await assert.rejects(
      () => handlers['sessions:add']({}, { type: 'OPD', cost: 300 }),
      { message: 'Invalid session: patientId is required' }
    );
    // Test validation: missing/invalid type
    await assert.rejects(
      () => handlers['sessions:add']({}, { patientId: 'p-1', cost: 300 }),
      { message: 'Invalid session: type is required' }
    );
    // Test validation: invalid cost
    await assert.rejects(
      () => handlers['sessions:add']({}, { patientId: 'p-1', type: 'OPD', cost: -10 }),
      { message: 'Invalid session cost' }
    );
    await assert.rejects(
      () => handlers['sessions:add']({}, { patientId: 'p-1', type: 'OPD', cost: 'not-a-number' }),
      { message: 'Invalid session cost' }
    );
  });

  await t.test('sessions:delete is protected, validates inputs, and deletes from database', async () => {
    // Test while locked
    capturedSecurityService.setState('LOCKED');
    await assert.rejects(
      () => handlers['sessions:delete']({}, 's-1'),
      (err) => {
        assert.equal(err.code, 'APP_LOCKED');
        return true;
      }
    );

    // Test while unlocked
    capturedSecurityService.setState('UNLOCKED');
    mockDb.resetSpies();

    const res = await handlers['sessions:delete']({}, 's-1');
    assert.deepEqual(res, { ok: true });
    assert.deepEqual(mockDb.getDeletedSessions(), ['s-1']);

    // Test validation
    await assert.rejects(
      () => handlers['sessions:delete']({}, ''),
      { message: 'Invalid session id' }
    );
  });

  await t.test('ipd:getAll is protected and requires UNLOCKED state', async () => {
    // Test while locked
    capturedSecurityService.setState('LOCKED');
    await assert.rejects(
      () => handlers['ipd:getAll']({}),
      (err) => {
        assert.equal(err.code, 'APP_LOCKED');
        return true;
      }
    );

    // Test while unlocked
    capturedSecurityService.setState('UNLOCKED');
    mockDb.resetSpies();
    mockDb.setIpdPlans([{ id: 'ipd-1', patientId: 'p-1', title: 'Plan 1', totalSessions: 10 }]);
    const result = await handlers['ipd:getAll']({});
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'ipd-1');
  });

  await t.test('ipd:add is protected, validates inputs, and writes to database', async () => {
    // Test while locked
    capturedSecurityService.setState('LOCKED');
    await assert.rejects(
      () => handlers['ipd:add']({}, { patientId: 'p-1', title: 'Plan 1', totalSessions: 10 }),
      (err) => {
        assert.equal(err.code, 'APP_LOCKED');
        return true;
      }
    );

    // Test while unlocked
    capturedSecurityService.setState('UNLOCKED');
    mockDb.resetSpies();

    const validPlan = {
      patientId: 'p-1',
      title: '   Plan Title   ',
      totalSessions: '10',
      startDate: '  2026-07-15  ',
      notes: '  Some IPD notes  '
    };

    const res = await handlers['ipd:add']({}, validPlan);
    assert.ok(res.id);
    assert.equal(res.patientId, 'p-1');
    assert.equal(res.title, 'Plan Title');
    assert.equal(res.totalSessions, 10);
    assert.equal(res.startDate, '2026-07-15');
    assert.equal(res.notes, 'Some IPD notes');

    // Verify spy
    const added = mockDb.getAddedIpdPlans();
    assert.equal(added.length, 1);
    assert.equal(added[0].title, 'Plan Title');
    assert.equal(added[0].totalSessions, 10);

    // Test validation: missing/invalid patientId
    await assert.rejects(
      () => handlers['ipd:add']({}, { title: 'Plan', totalSessions: 5 }),
      { message: 'Invalid IPD plan: patientId is required' }
    );
    // Test validation: missing/invalid title
    await assert.rejects(
      () => handlers['ipd:add']({}, { patientId: 'p-1', totalSessions: 5 }),
      { message: 'Invalid IPD plan: title is required' }
    );
    // Test validation: invalid totalSessions
    await assert.rejects(
      () => handlers['ipd:add']({}, { patientId: 'p-1', title: 'Plan', totalSessions: 0 }),
      { message: 'Invalid totalSessions: must be a positive integer' }
    );
    await assert.rejects(
      () => handlers['ipd:add']({}, { patientId: 'p-1', title: 'Plan', totalSessions: -5 }),
      { message: 'Invalid totalSessions: must be a positive integer' }
    );
    await assert.rejects(
      () => handlers['ipd:add']({}, { patientId: 'p-1', title: 'Plan', totalSessions: 'not-a-number' }),
      { message: 'Invalid totalSessions: must be a positive integer' }
    );
  });

  await t.test('ipd:delete is protected, validates inputs, and deletes from database', async () => {
    // Test while locked
    capturedSecurityService.setState('LOCKED');
    await assert.rejects(
      () => handlers['ipd:delete']({}, 'ipd-1'),
      (err) => {
        assert.equal(err.code, 'APP_LOCKED');
        return true;
      }
    );

    // Test while unlocked
    capturedSecurityService.setState('UNLOCKED');
    mockDb.resetSpies();

    const res = await handlers['ipd:delete']({}, 'ipd-1');
    assert.deepEqual(res, { ok: true });
    assert.deepEqual(mockDb.getDeletedIpdPlans(), ['ipd-1']);

    // Test validation
    await assert.rejects(
      () => handlers['ipd:delete']({}, ''),
      { message: 'Invalid IPD plan id' }
    );
  });

  await t.test('db:healthCheck is protected and requires UNLOCKED state', async () => {
    // Test while locked
    capturedSecurityService.setState('LOCKED');
    await assert.rejects(
      () => handlers['db:healthCheck']({}),
      (err) => {
        assert.equal(err.code, 'APP_LOCKED');
        return true;
      }
    );

    // Test while unlocked
    capturedSecurityService.setState('UNLOCKED');
    const res = await handlers['db:healthCheck']({});
    assert.deepEqual(res, { ok: true, journalMode: 'wal' });
  });

  cleanup();
});
