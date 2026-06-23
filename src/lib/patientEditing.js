export const EMPTY_PATIENT_FORM = {
  name: '',
  phone: '',
  condition: '',
  type: 'OPD',
};

/**
 * Returns a form baseline for the given patient.
 * Pass null (or no argument) for add-mode baseline.
 * null/undefined fields are normalized to empty string.
 */
export function createPatientEditBaseline(patient = null) {
  if (!patient) return { ...EMPTY_PATIENT_FORM };
  return {
    name: patient.name ?? '',
    phone: patient.phone ?? '',
    condition: patient.condition ?? '',
    type: patient.type ?? 'OPD',
  };
}

/**
 * Returns true if any form field differs from the baseline.
 * Text fields are compared after trimming so whitespace-only input
 * is treated as equivalent to an empty baseline.
 */
export function isPatientFormDirty(formValues, baseline) {
  return (
    formValues.name.trim() !== baseline.name.trim() ||
    formValues.phone.trim() !== baseline.phone.trim() ||
    formValues.condition.trim() !== baseline.condition.trim() ||
    formValues.type !== baseline.type
  );
}

/**
 * Returns true when a discard confirmation should be shown before
 * replacing the current form (dirty-form guard).
 */
export function shouldConfirmDiscardPatientForm(formValues, baseline) {
  return isPatientFormDirty(formValues, baseline);
}

/**
 * Detects the Electron-wrapped "record no longer exists" error via
 * substring matching so it works regardless of IPC message wrapping.
 */
export function isMissingPatientRecordError(error) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.includes('Invalid patient: record no longer exists');
}

/**
 * Applies a successful patient update to all affected renderer state.
 *
 * - Replaces the full patient row in `patients`.
 * - Updates `patientName` on sessions/ipdPlans when the name changed.
 * - Clears `sessionPatientId` when the edited patient switches OPD → IPD.
 * - Leaves `ipdPatientId` unchanged.
 * - Returns original state unchanged (same references) if the patient
 *   is not found in the local list.
 */
export function applyPatientEditResult({
  patients,
  sessions,
  ipdPlans,
  sessionPatientId,
  ipdPatientId,
  updatedPatient,
}) {
  const existing = patients.find((p) => p.id === updatedPatient.id);
  if (!existing) {
    return { patients, sessions, ipdPlans, sessionPatientId, ipdPatientId };
  }

  const nextPatients = patients.map((p) =>
    p.id === updatedPatient.id ? updatedPatient : p,
  );

  const nameChanged = updatedPatient.name !== existing.name;
  const nextSessions = nameChanged
    ? sessions.map((s) =>
        s.patientId === updatedPatient.id
          ? { ...s, patientName: updatedPatient.name }
          : s,
      )
    : sessions;

  const nextIpdPlans = nameChanged
    ? ipdPlans.map((i) =>
        i.patientId === updatedPatient.id
          ? { ...i, patientName: updatedPatient.name }
          : i,
      )
    : ipdPlans;

  const typeChangedToIpd =
    existing.type === 'OPD' && updatedPatient.type === 'IPD';
  const nextSessionPatientId =
    typeChangedToIpd && sessionPatientId === updatedPatient.id
      ? ''
      : sessionPatientId;

  return {
    patients: nextPatients,
    sessions: nextSessions,
    ipdPlans: nextIpdPlans,
    sessionPatientId: nextSessionPatientId,
    ipdPatientId,
  };
}
