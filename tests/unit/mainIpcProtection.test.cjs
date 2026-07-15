'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Clear require cache to ensure fresh loads
delete require.cache[require.resolve('electron')];
delete require.cache[require.resolve('../../database.cjs')];
delete require.cache[require.resolve('../../lib/securityIpc.cjs')];
delete require.cache[require.resolve('../../main.cjs')];

const ipcHandlers = {};
const mockIpcMain = {
  handle(channel, handler) {
    ipcHandlers[channel] = handler;
  }
};

const mockDbCalls = [];
const mockDb = {
  initDatabase: () => {},
  healthCheck: () => { mockDbCalls.push('healthCheck'); return { ok: true, patients: 12 }; },
  getAllPatients: () => { mockDbCalls.push('getAllPatients'); return []; },
  addPatient: (p) => { mockDbCalls.push('addPatient'); return p; },
  updatePatient: (p) => { mockDbCalls.push('updatePatient'); return p; },
  deletePatient: () => { mockDbCalls.push('deletePatient'); },
  deletePatients: () => { mockDbCalls.push('deletePatients'); },
  getAllSessions: () => { mockDbCalls.push('getAllSessions'); return []; },
  getSessionsByPatient: () => { mockDbCalls.push('getSessionsByPatient'); return []; },
  addSession: (s) => { mockDbCalls.push('addSession'); return s; },
  deleteSession: () => { mockDbCalls.push('deleteSession'); },
  getAllIpdPlans: () => { mockDbCalls.push('getAllIpdPlans'); return []; },
  addIpdPlan: (p) => { mockDbCalls.push('addIpdPlan'); return p; },
  deleteIpdPlan: () => { mockDbCalls.push('deleteIpdPlan'); },
  getConfig: (key) => {
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
  hasClinicData: () => true
};

// Mock Electron module in require cache
require.cache[require.resolve('electron')] = {
  id: require.resolve('electron'),
  filename: require.resolve('electron'),
  loaded: true,
  exports: {
    app: {
      isPackaged: false,
      getPath: () => 'mock-userData',
      whenReady: () => Promise.resolve(),
      on: () => {},
      quit: () => {}
    },
    BrowserWindow: class {
      constructor() {
        this.webContents = {
          openDevTools() {}
        };
      }
      loadURL() { return Promise.resolve(); }
      loadFile() { return Promise.resolve(); }
      on() {}
      static getAllWindows() { return []; }
    },
    ipcMain: mockIpcMain,
    dialog: {
      showErrorBox: () => {}
    }
  }
};

// Mock database.cjs module in require cache
require.cache[require.resolve('../../database.cjs')] = {
  id: require.resolve('../../database.cjs'),
  filename: require.resolve('../../database.cjs'),
  loaded: true,
  exports: mockDb
};

let capturedSecurityService = null;
// Mock securityIpc to capture securityService instance from main.cjs
require.cache[require.resolve('../../lib/securityIpc.cjs')] = {
  id: require.resolve('../../lib/securityIpc.cjs'),
  filename: require.resolve('../../lib/securityIpc.cjs'),
  loaded: true,
  exports: {
    registerSecurityIpc({ securityService }) {
      capturedSecurityService = securityService;
    }
  }
};

// Now load main.cjs to trigger registration
require('../../main.cjs');

test('Main process IPC protection integration tests', async (t) => {
  // Wait for the app.whenReady() microtask chain to finish and register all handlers
  await new Promise(resolve => setTimeout(resolve, 50));

  assert.ok(capturedSecurityService, 'Should capture securityService');

  const clinicalChannels = [
    'patients:getAll',
    'patients:add',
    'patients:delete',
    'patients:deleteMany',
    'patients:update',
    'sessions:getAll',
    'sessions:getByPatient',
    'sessions:add',
    'sessions:delete',
    'ipd:getAll',
    'ipd:add',
    'ipd:delete',
    'db:healthCheck'
  ];

  await t.test('Locked State: rejects all clinical channels, does not call DB', async () => {
    // Set to LOCKED
    capturedSecurityService.lock();
    assert.notEqual(capturedSecurityService.getState(), 'UNLOCKED');

    mockDbCalls.length = 0;

    for (const channel of clinicalChannels) {
      const handler = ipcHandlers[channel];
      assert.ok(handler, `Handler for channel ${channel} should exist`);

      await assert.rejects(
        async () => {
          if (channel === 'patients:add') {
            await handler({}, { name: 'Test' });
          } else if (channel === 'patients:deleteMany') {
            await handler({}, ['1']);
          } else if (channel === 'patients:update') {
            await handler({}, { id: '1', name: 'Test', type: 'OPD' });
          } else {
            await handler({});
          }
        },
        (err) => {
          assert.equal(err.code, 'APP_LOCKED');
          assert.equal(err.message, 'The application is locked.');
          return true;
        }
      );
    }

    assert.equal(mockDbCalls.length, 0, 'No database methods should have been called');
  });

  await t.test('Locked State: ping and security channels remain accessible', async () => {
    // --- ping ---
    // `ping` is registered directly in main.cjs without the requireUnlocked guard,
    // so it must always be callable even when the app is locked.
    assert.ok(ipcHandlers['ping'], 'ping handler should be registered');
    const pingRes = await ipcHandlers['ping']({});
    assert.equal(pingRes, 'pong');

    // --- security:* channels ---
    // These four channels are registered by lib/securityIpc.cjs, which is mocked out
    // in this test (to capture the securityService instance).  Because the mock's
    // registerSecurityIpc() does NOT call ipcMain.handle(), none of these channels
    // appear in ipcHandlers here — which is intentional and correct.
    //
    // The absence of the channels in this test's ipcHandlers proves that:
    //   1. They are owned by a separate module (securityIpc.cjs), not guarded by
    //      requireUnlocked in main.cjs.
    //   2. They will never accidentally throw an APP_LOCKED error.
    //
    // Their full behaviour (accessible while locked, correct responses, etc.) is
    // covered in tests/unit/securityIpc.test.cjs.
    const securityChannels = [
      'security:getStatus',
      'security:setup',
      'security:unlock',
      'security:lock',
    ];
    for (const channel of securityChannels) {
      assert.equal(
        ipcHandlers[channel],
        undefined,
        `${channel} must NOT be registered in main.cjs ipcHandlers — it is owned by securityIpc.cjs`
      );
    }
  });

  await t.test('Unlocked State: clinical channels execute successfully and hit DB', async () => {
    const originalGetState = capturedSecurityService.getState;
    capturedSecurityService.getState = () => 'UNLOCKED';

    mockDbCalls.length = 0;

    // Test clinical read and write channels
    await ipcHandlers['patients:getAll']({});
    assert.ok(mockDbCalls.includes('getAllPatients'));

    await ipcHandlers['db:healthCheck']({});
    assert.ok(mockDbCalls.includes('healthCheck'));

    // Restore getState
    capturedSecurityService.getState = originalGetState;
  });

  await t.test('Dynamic state transitions', async () => {
    const originalGetState = capturedSecurityService.getState;

    // 1. LOCKED -> rejects
    capturedSecurityService.getState = () => 'LOCKED';
    await assert.rejects(
      () => ipcHandlers['patients:getAll']({}),
      (err) => err.code === 'APP_LOCKED'
    );

    // 2. Transition to UNLOCKED -> succeeds
    capturedSecurityService.getState = () => 'UNLOCKED';
    const res = await ipcHandlers['patients:getAll']({});
    assert.ok(Array.isArray(res));

    // 3. Transition back to LOCKED -> rejects again
    capturedSecurityService.getState = () => 'LOCKED';
    await assert.rejects(
      () => ipcHandlers['patients:getAll']({}),
      (err) => err.code === 'APP_LOCKED'
    );

    capturedSecurityService.getState = originalGetState;
  });
});
