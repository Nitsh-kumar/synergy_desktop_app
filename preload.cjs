/**
 * preload.cjs — Synergy App Electron preload
 *
 * Exposes ONLY the safe IPC bridge to the renderer process.
 * contextBridge prevents renderer from accessing Node.js directly.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Reserved for preload/diagnostic smoke checks.
  ping: () => ipcRenderer.invoke('ping'),

  // Reserved for future diagnostics/support screens.
  healthCheck: () => ipcRenderer.invoke('db:healthCheck'),

  // Patients
  patients: {
    getAll:     ()          => ipcRenderer.invoke('patients:getAll'),
    add:        (patient)   => ipcRenderer.invoke('patients:add', patient),
    update:     (patient)   => ipcRenderer.invoke('patients:update', patient),
    delete:     (id)        => ipcRenderer.invoke('patients:delete', id),
    deleteMany: (ids)       => ipcRenderer.invoke('patients:deleteMany', ids),
  },

  // Sessions
  sessions: {
    getAll:        ()          => ipcRenderer.invoke('sessions:getAll'),
    getByPatient:  (patientId) => ipcRenderer.invoke('sessions:getByPatient', patientId),
    add:           (session)   => ipcRenderer.invoke('sessions:add', session),
    delete:        (id)        => ipcRenderer.invoke('sessions:delete', id),
  },

  // IPD Plans
  ipd: {
    getAll:  ()     => ipcRenderer.invoke('ipd:getAll'),
    add:     (plan) => ipcRenderer.invoke('ipd:add', plan),
    delete:  (id)   => ipcRenderer.invoke('ipd:delete', id),
  },

  // Reserved for future local settings and operational flags.
  config: {
    get: (key)         => ipcRenderer.invoke('config:get', key),
    set: (key, value)  => ipcRenderer.invoke('config:set', key, value),
  },
});
