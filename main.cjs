/**
 * main.cjs — Synergy App Electron main process
 *
 * Security defaults:
 *   contextIsolation: true
 *   nodeIntegration: false
 *   All IPC inputs are validated before DB operations
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const db = require('./database.cjs');
const { registerPatientUpdateIpc } = require('./lib/patientUpdateIpc.cjs');
const { createSecurityService } = require('./lib/securityService.cjs');
const { registerSecurityIpc } = require('./lib/securityIpc.cjs');
const { requireUnlocked } = require('./lib/ipcSecurityGuard.cjs');

let mainWindow;

// ─────────────────────────────────────────────
//  Utility helpers
// ─────────────────────────────────────────────

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isNonEmptyString(val) {
  return typeof val === 'string' && val.trim().length > 0;
}

function isFiniteNumber(val) {
  return typeof val === 'number' && isFinite(val);
}

// ─────────────────────────────────────────────
//  Window creation
// ─────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 880,
    minWidth: 960,
    minHeight: 600,
    title: 'Synergy — Physiotherapy Center',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      // Fallback to built files if Vite is not running
      mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    });
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─────────────────────────────────────────────
//  IPC Handlers
// ─────────────────────────────────────────────

// Connection smoke test reserved for preload and diagnostics checks.
ipcMain.handle('ping', () => 'pong');

// Reserved for future diagnostics/support screens and smoke checks.
ipcMain.handle('db:healthCheck', () => {
  return db.healthCheck();
});



// --- SESSIONS ---

ipcMain.handle('sessions:getAll', () => {
  return db.getAllSessions();
});

// Retained for the planned patient profile/history flow.
ipcMain.handle('sessions:getByPatient', (event, patientId) => {
  if (!isNonEmptyString(patientId)) throw new Error('Invalid patientId');
  return db.getSessionsByPatient(patientId);
});

ipcMain.handle('sessions:add', (event, session) => {
  if (!session || !isNonEmptyString(session.patientId)) {
    throw new Error('Invalid session: patientId is required');
  }
  if (!isNonEmptyString(session.type)) {
    throw new Error('Invalid session: type is required');
  }
  const cost = parseFloat(session.cost);
  if (!isFiniteNumber(cost) || cost < 0) {
    throw new Error('Invalid session cost');
  }
  const now = new Date().toISOString();
  return db.addSession({
    id: generateId(),
    patientId: session.patientId,
    type: session.type.trim(),
    notes: isNonEmptyString(session.notes) ? session.notes.trim() : null,
    cost,
    date: now,
  });
});

ipcMain.handle('sessions:delete', (event, id) => {
  if (!isNonEmptyString(id)) throw new Error('Invalid session id');
  db.deleteSession(id);
  return { ok: true };
});

// --- IPD PLANS ---

ipcMain.handle('ipd:getAll', () => {
  return db.getAllIpdPlans();
});

ipcMain.handle('ipd:add', (event, plan) => {
  if (!plan || !isNonEmptyString(plan.patientId)) {
    throw new Error('Invalid IPD plan: patientId is required');
  }
  if (!isNonEmptyString(plan.title)) {
    throw new Error('Invalid IPD plan: title is required');
  }
  const totalSessions = parseInt(plan.totalSessions, 10);
  if (!Number.isInteger(totalSessions) || totalSessions < 1) {
    throw new Error('Invalid totalSessions: must be a positive integer');
  }
  return db.addIpdPlan({
    id: generateId(),
    patientId: plan.patientId,
    title: plan.title.trim(),
    totalSessions,
    startDate: isNonEmptyString(plan.startDate) ? plan.startDate.trim() : null,
    notes: isNonEmptyString(plan.notes) ? plan.notes.trim() : null,
  });
});

ipcMain.handle('ipd:delete', (event, id) => {
  if (!isNonEmptyString(id)) throw new Error('Invalid IPD plan id');
  db.deleteIpdPlan(id);
  return { ok: true };
});

// --- CONFIG ---
// Reserved for future local settings and operational flags.

ipcMain.handle('config:get', (event, key) => {
  if (!isNonEmptyString(key)) throw new Error('Invalid config key');
  return db.getConfig(key);
});

ipcMain.handle('config:set', (event, key, value) => {
  if (!isNonEmptyString(key)) throw new Error('Invalid config key');
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    throw new Error('Invalid config value type');
  }
  db.setConfig(key, String(value));
  return { ok: true };
});

// ─────────────────────────────────────────────
//  App lifecycle
// ─────────────────────────────────────────────

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');

  try {
    db.initDatabase(userDataPath);
  } catch (err) {
    await dialog.showErrorBox(
      'Database Error',
      `Synergy could not initialize the database.\n\n${err.message}\n\nThe app will now close.`
    );
    app.quit();
    return;
  }

  // Construct and initialize security service
  let securityService;
  try {
    securityService = createSecurityService({
      getConfig: db.getConfig,
      setConfig: db.setConfig,
      deleteConfig: db.deleteConfig,
      getConfigValue: db.getConfigValue,
      setConfigValue: db.setConfigValue,
      setConfigValues: db.setConfigValues,
      hasClinicData: db.hasClinicData,
    });
    securityService.determineInitialState();
  } catch {
    await dialog.showErrorBox(
      'Security Initialization Error',
      'Synergy could not initialize security services. The app will now close.'
    );
    app.quit();
    return;
  }

  // Register security IPC handlers
  registerSecurityIpc({ ipcMain, securityService });

  // --- PATIENTS ---

  ipcMain.handle('patients:getAll', requireUnlocked(securityService, () => {
    return db.getAllPatients();
  }));

  ipcMain.handle('patients:add', requireUnlocked(securityService, (event, patient) => {
    if (!patient || !isNonEmptyString(patient.name)) {
      throw new Error('Invalid patient: name is required');
    }
    if (patient.type && !['OPD', 'IPD'].includes(patient.type)) {
      throw new Error('Invalid patient type: must be OPD or IPD');
    }
    const now = new Date().toISOString();
    return db.addPatient({
      id: generateId(),
      name: patient.name.trim(),
      phone: isNonEmptyString(patient.phone) ? patient.phone.trim() : null,
      address: isNonEmptyString(patient.address) ? patient.address.trim() : null,
      condition: isNonEmptyString(patient.condition) ? patient.condition.trim() : null,
      type: patient.type || 'OPD',
      dateAdded: now,
    });
  }));

  // Retained for future row-level patient actions even though the current UI uses bulk delete.
  ipcMain.handle('patients:delete', requireUnlocked(securityService, (event, id) => {
    if (!isNonEmptyString(id)) throw new Error('Invalid patient id');
    db.deletePatient(id);
    return { ok: true };
  }));

  ipcMain.handle('patients:deleteMany', requireUnlocked(securityService, (event, ids) => {
    if (!Array.isArray(ids) || ids.some(id => !isNonEmptyString(id))) {
      throw new Error('Invalid ids array');
    }
    db.deletePatients(ids);
    return { ok: true };
  }));

  registerPatientUpdateIpc(ipcMain, db, securityService);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
