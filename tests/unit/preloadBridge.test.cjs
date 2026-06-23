'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function loadPreload() {
  // Mock Electron before requiring preload
  const ipcInvokeCalls = [];
  const mockIpcRenderer = {
    invoke(channel, ...args) {
      ipcInvokeCalls.push({ channel, args });
      return Promise.resolve();
    },
  };

  const exposedAPIs = {};
  const mockContextBridge = {
    exposeInMainWorld(name, api) {
      exposedAPIs[name] = api;
    },
  };

  require.cache[require.resolve('electron')] = {
    id: require.resolve('electron'),
    filename: require.resolve('electron'),
    loaded: true,
    exports: {
      contextBridge: mockContextBridge,
      ipcRenderer: mockIpcRenderer,
    },
  };

  const preloadPath = require.resolve('../../preload.cjs');
  delete require.cache[preloadPath];
  require('../../preload.cjs');

  return { exposedAPIs, ipcInvokeCalls };
}

function cleanup() {
  const electronPath = require.resolve('electron');
  delete require.cache[electronPath];
  const preloadPath = require.resolve('../../preload.cjs');
  delete require.cache[preloadPath];
}

test('patients.update invokes ipcRenderer with patients:update channel and payload', () => {
  const { exposedAPIs, ipcInvokeCalls } = loadPreload();

  const payload = { id: 'patient-1', name: 'Anita Sharma', type: 'OPD' };
  exposedAPIs.electronAPI.patients.update(payload);

  assert.equal(ipcInvokeCalls.length, 1);
  assert.equal(ipcInvokeCalls[0].channel, 'patients:update');
  assert.deepEqual(ipcInvokeCalls[0].args[0], payload);

  cleanup();
});
