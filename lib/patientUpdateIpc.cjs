'use strict';

/**
 * patientUpdateIpc.cjs — IPC registration for patient update
 *
 * Registers the patients:update channel on ipcMain and delegates
 * to the patientUpdateService contract helper.
 */

const { updatePatientRecord } = require('./patientUpdateService.cjs');

/**
 * @param {object} ipcMain   — Electron ipcMain (or compatible mock)
 * @param {object} database  — database module with updatePatient method
 */
function registerPatientUpdateIpc(ipcMain, database) {
  ipcMain.handle('patients:update', (event, patient) => {
    return updatePatientRecord(database, patient);
  });
}

module.exports = { registerPatientUpdateIpc };
