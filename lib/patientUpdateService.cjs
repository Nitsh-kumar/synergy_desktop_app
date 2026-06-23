'use strict';

/**
 * patientUpdateService.cjs — contract helper for patient update
 *
 * Validates and normalises the update payload, delegates the write to the
 * database port, and surfaces a user-safe error when the record is gone.
 */

const VALID_TYPES = ['OPD', 'IPD'];

/**
 * @param {object} database  — object with an updatePatient(payload) method
 * @param {object} patient   — raw update payload from IPC / renderer
 * @returns {object}         — the refreshed patient row from the database
 */
function updatePatientRecord(database, patient) {
  if (!patient || typeof patient !== 'object') {
    throw new Error('Invalid patient: payload is required');
  }

  const id = typeof patient.id === 'string' ? patient.id.trim() : '';
  if (!id) {
    throw new Error('Invalid patient: id is required');
  }

  const name = typeof patient.name === 'string' ? patient.name.trim() : '';
  if (!name) {
    throw new Error('Invalid patient: name is required');
  }

  if (!patient.type || !VALID_TYPES.includes(patient.type)) {
    throw new Error('Invalid patient: type must be OPD or IPD');
  }

  const phone =
    typeof patient.phone === 'string' && patient.phone.trim().length > 0
      ? patient.phone.trim()
      : null;

  const condition =
    typeof patient.condition === 'string' && patient.condition.trim().length > 0
      ? patient.condition.trim()
      : null;

  const updated = database.updatePatient({ id, name, phone, condition, type: patient.type });

  if (updated === null) {
    throw new Error('Invalid patient: record no longer exists');
  }

  return updated;
}

module.exports = { updatePatientRecord };
