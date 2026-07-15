'use strict';

/**
 * patientUpdateIpc.cjs — IPC registration for patient update
 *
 * Registers the patients:update channel on ipcMain and delegates
 * to the patientUpdateService contract helper.
 */

const { updatePatientRecord } = require('./patientUpdateService.cjs');
const { requireUnlocked } = require('./ipcSecurityGuard.cjs');

/**
 * @param {object} ipcMain          — Electron ipcMain (or compatible mock)
 * @param {object} database         — database module with updatePatient method
 * @param {object} securityService  - main security service instance
 */
function registerPatientUpdateIpc(ipcMain, database, securityService) {
  ipcMain.handle('patients:update', requireUnlocked(securityService, (event, patient) => {
    return updatePatientRecord(database, patient);
  }));
}

module.exports = { registerPatientUpdateIpc };

