import { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import { buildPatientCsv } from './lib/patientCsv.js';
import {
  DEFAULT_PATIENT_FILTERS,
  areAllVisiblePatientsSelected,
  filterPatients,
  getVisibleSelectedPatientIds,
  pruneSelectionToVisible,
} from './lib/patientFilters.js';
import { getUserErrorMessage } from './lib/userErrors.js';
import {
  EMPTY_PATIENT_FORM,
  createPatientEditBaseline,
  shouldConfirmDiscardPatientForm,
  isMissingPatientRecordError,
  applyPatientEditResult,
} from './lib/patientEditing.js';
import PatientFormPanel from './components/PatientFormPanel.jsx';

// ─────────────────────────────────────────────
// Helper: use Electron IPC if available, otherwise warn
// ─────────────────────────────────────────────
const api = window.electronAPI || null;

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function logAppError(context, error) {
  console.error(`[Synergy] ${context}`, error);
}

// ─────────────────────────────────────────────
// Main App Component
// ─────────────────────────────────────────────
function App() {
  const [patients, setPatients]       = useState([]);
  const [sessions, setSessions]       = useState([]);
  const [ipdPlans, setIpdPlans]       = useState([]);
  const [activeTab, setActiveTab]     = useState('dashboard'); // dashboard | opd | ipd
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  // Patient form state
  const [patientName, setPatientName]           = useState('');
  const [patientPhone, setPatientPhone]         = useState('');
  const [patientCondition, setPatientCondition] = useState('');
  const [patientType, setPatientType]           = useState('OPD');

  // OPD session form state
  const [sessionPatientId, setSessionPatientId] = useState('');
  const [sessionCost, setSessionCost]           = useState('');
  const [sessionType, setSessionType]           = useState('Consultation');
  const [sessionNotes, setSessionNotes]         = useState('');

  // IPD plan form state
  const [ipdPatientId, setIpdPatientId]         = useState('');
  const [ipdTitle, setIpdTitle]                 = useState('');
  const [ipdTotalSessions, setIpdTotalSessions] = useState('');
  const [ipdStartDate, setIpdStartDate]         = useState('');
  const [ipdNotes, setIpdNotes]                 = useState('');

  // Patient edit mode
  const [editingPatientId, setEditingPatientId]       = useState(null);
  const [patientFormBaseline, setPatientFormBaseline] = useState(EMPTY_PATIENT_FORM);

  // Selection for batch delete
  const [selectedPatientIds, setSelectedPatientIds] = useState(new Set());
  const [patientFilters, setPatientFilters] = useState(DEFAULT_PATIENT_FILTERS);

  // ─────────────────────────────────────────────
  // Load all data from DB on mount
  // ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!api) {
      setError('Electron API not found. Please run the app via Electron.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [p, s, i] = await Promise.all([
        api.patients.getAll(),
        api.sessions.getAll(),
        api.ipd.getAll(),
      ]);
      setPatients(p);
      setSessions(s);
      setIpdPlans(i);
    } catch (err) {
      logAppError('Failed to load clinic data', err);
      setError(getUserErrorMessage(err, 'Could not load clinic data. Please restart Synergy and try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─────────────────────────────────────────────
  // Derived KPIs
  // ─────────────────────────────────────────────
  const totalPatients   = patients.length;
  const totalRevenue    = sessions.reduce((sum, s) => sum + Number(s.cost), 0);
  const totalSessions   = sessions.length;
  const activeIpdPlans  = ipdPlans.length;

  const filteredPatients = useMemo(
    () => filterPatients(patients, patientFilters),
    [patients, patientFilters]
  );
  const visibleSelectedPatientIds = useMemo(
    () => getVisibleSelectedPatientIds(selectedPatientIds, filteredPatients),
    [selectedPatientIds, filteredPatients]
  );
  const visibleSelectedPatientCount = visibleSelectedPatientIds.length;
  const allVisiblePatientsSelected = useMemo(
    () => areAllVisiblePatientsSelected(selectedPatientIds, filteredPatients),
    [selectedPatientIds, filteredPatients]
  );
  const hasActivePatientFilters =
    patientFilters.searchText.trim().length > 0 ||
    patientFilters.patientType !== DEFAULT_PATIENT_FILTERS.patientType;

  useEffect(() => {
    setSelectedPatientIds((previousSelection) => {
      const nextSelection = pruneSelectionToVisible(previousSelection, filteredPatients);

      return nextSelection.size === previousSelection.size ? previousSelection : nextSelection;
    });
  }, [filteredPatients]);

  // ─────────────────────────────────────────────
  // Patient form helpers
  // ─────────────────────────────────────────────
  const resetPatientForm = () => {
    setPatientName('');
    setPatientPhone('');
    setPatientCondition('');
    setPatientType('OPD');
    setEditingPatientId(null);
    setPatientFormBaseline(EMPTY_PATIENT_FORM);
  };

  const handleBeginEditPatient = (patient) => {
    const currentFormValues = {
      name: patientName,
      phone: patientPhone,
      condition: patientCondition,
      type: patientType,
    };
    if (shouldConfirmDiscardPatientForm(currentFormValues, patientFormBaseline)) {
      if (!window.confirm('You have unsaved changes. Discard and edit this patient?')) return;
    }
    const baseline = createPatientEditBaseline(patient);
    setPatientName(baseline.name);
    setPatientPhone(baseline.phone);
    setPatientCondition(baseline.condition);
    setPatientType(baseline.type);
    setEditingPatientId(patient.id);
    setPatientFormBaseline(baseline);
  };

  const handleCancelEdit = () => {
    const currentFormValues = {
      name: patientName,
      phone: patientPhone,
      condition: patientCondition,
      type: patientType,
    };
    if (shouldConfirmDiscardPatientForm(currentFormValues, patientFormBaseline)) {
      if (!window.confirm('Discard unsaved changes?')) return;
    }
    resetPatientForm();
  };

  // ─────────────────────────────────────────────
  // Patient Handlers
  // ─────────────────────────────────────────────
  const handleAddPatient = async (e) => {
    e.preventDefault();
    if (!patientName.trim()) return;
    try {
      const created = await api.patients.add({
        name: patientName,
        phone: patientPhone,
        condition: patientCondition,
        type: patientType,
      });
      setPatients(prev => [created, ...prev]);
      resetPatientForm();
    } catch (err) {
      logAppError('Failed to add patient', err);
      alert(getUserErrorMessage(err, 'Could not add patient. Please try again.'));
    }
  };

  const handleUpdatePatient = async (e) => {
    e.preventDefault();
    if (!patientName.trim() || !editingPatientId) return;
    try {
      const updated = await api.patients.update({
        id: editingPatientId,
        name: patientName,
        phone: patientPhone,
        condition: patientCondition,
        type: patientType,
      });
      const result = applyPatientEditResult({
        patients,
        sessions,
        ipdPlans,
        sessionPatientId,
        ipdPatientId,
        updatedPatient: updated,
      });
      setPatients(result.patients);
      setSessions(result.sessions);
      setIpdPlans(result.ipdPlans);
      setSessionPatientId(result.sessionPatientId);
      resetPatientForm();
    } catch (err) {
      logAppError('Failed to update patient', err);
      if (isMissingPatientRecordError(err)) {
        alert(getUserErrorMessage(err, 'Could not update patient. The record no longer exists.'));
        resetPatientForm();
        await loadData();
        // patientFilters is NOT reset; selection pruning runs via the filteredPatients effect
      } else {
        // Stay in edit mode and preserve entered values so the user can retry
        alert(getUserErrorMessage(err, 'Could not update patient. Please try again.'));
      }
    }
  };

  const toggleSelectPatient = (id) => {
    setSelectedPatientIds((previousSelection) => {
      const nextSelection = new Set(previousSelection);
      nextSelection.has(id) ? nextSelection.delete(id) : nextSelection.add(id);
      return nextSelection;
    });
  };

  const toggleSelectAll = () => {
    if (filteredPatients.length === 0) return;

    setSelectedPatientIds((previousSelection) => {
      const nextSelection = new Set(previousSelection);

      if (areAllVisiblePatientsSelected(previousSelection, filteredPatients)) {
        filteredPatients.forEach((patient) => nextSelection.delete(patient.id));
        return nextSelection;
      }

      filteredPatients.forEach((patient) => nextSelection.add(patient.id));
      return nextSelection;
    });
  };

  const handleBulkDelete = async () => {
    if (visibleSelectedPatientCount === 0) return;
    if (!window.confirm(`Delete ${visibleSelectedPatientCount} patient(s) and all their records?`)) return;

    const patientIdsToDelete = visibleSelectedPatientIds;
    const patientIdsToDeleteSet = new Set(patientIdsToDelete);

    try {
      await api.patients.deleteMany(patientIdsToDelete);
      setPatients(prev => prev.filter(p => !patientIdsToDeleteSet.has(p.id)));
      setSessions(prev => prev.filter(s => !patientIdsToDeleteSet.has(s.patientId)));
      setIpdPlans(prev => prev.filter(i => !patientIdsToDeleteSet.has(i.patientId)));
      setSelectedPatientIds(prev => new Set([...prev].filter((id) => !patientIdsToDeleteSet.has(id))));
    } catch (err) {
      logAppError('Failed to delete patients', err);
      alert(getUserErrorMessage(err, 'Could not delete the selected patients. Please try again.'));
    }
  };

  // ─────────────────────────────────────────────
  // OPD Session Handlers
  // ─────────────────────────────────────────────
  const handleRecordSession = async (e) => {
    e.preventDefault();
    if (!sessionPatientId || !sessionCost) return;
    try {
      const created = await api.sessions.add({
        patientId: sessionPatientId,
        type: sessionType,
        notes: sessionNotes,
        cost: parseFloat(sessionCost) || 0,
      });
      // Attach patientName for display
      const patient = patients.find(p => p.id === sessionPatientId);
      setSessions(prev => [{ ...created, patientName: patient?.name || '' }, ...prev]);
      setSessionPatientId('');
      setSessionCost('');
      setSessionType('Consultation');
      setSessionNotes('');
    } catch (err) {
      logAppError('Failed to record session', err);
      alert(getUserErrorMessage(err, 'Could not record the session. Please try again.'));
    }
  };

  const handleDeleteSession = async (id) => {
    if (!window.confirm('Delete this session?')) return;
    try {
      await api.sessions.delete(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      logAppError('Failed to delete session', err);
      alert(getUserErrorMessage(err, 'Could not delete the session. Please try again.'));
    }
  };

  // ─────────────────────────────────────────────
  // IPD Plan Handlers
  // ─────────────────────────────────────────────
  const handleAddIpdPlan = async (e) => {
    e.preventDefault();
    if (!ipdPatientId || !ipdTitle || !ipdTotalSessions) return;
    try {
      const created = await api.ipd.add({
        patientId: ipdPatientId,
        title: ipdTitle,
        totalSessions: parseInt(ipdTotalSessions, 10),
        startDate: ipdStartDate,
        notes: ipdNotes,
      });
      const patient = patients.find(p => p.id === ipdPatientId);
      setIpdPlans(prev => [{ ...created, patientName: patient?.name || '' }, ...prev]);
      setIpdPatientId('');
      setIpdTitle('');
      setIpdTotalSessions('');
      setIpdStartDate('');
      setIpdNotes('');
    } catch (err) {
      logAppError('Failed to add IPD plan', err);
      alert(getUserErrorMessage(err, 'Could not create the therapy plan. Please try again.'));
    }
  };

  const handleDeleteIpdPlan = async (id) => {
    if (!window.confirm('Delete this therapy plan?')) return;
    try {
      await api.ipd.delete(id);
      setIpdPlans(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      logAppError('Failed to delete IPD plan', err);
      alert(getUserErrorMessage(err, 'Could not delete the therapy plan. Please try again.'));
    }
  };

  // ─────────────────────────────────────────────
  // CSV Export (patients only)
  // ─────────────────────────────────────────────
  const handleExportCSV = () => {
    if (filteredPatients.length === 0) return;
    try {
      const csvContent = buildPatientCsv(filteredPatients);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `patients_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      logAppError('Failed to export patients CSV', err);
      alert(getUserErrorMessage(err, 'Could not export patient data. Please try again.'));
    }
  };

  const handlePatientFilterChange = (field, value) => {
    setPatientFilters((previousFilters) => ({
      ...previousFilters,
      [field]: value,
    }));
  };

  const clearPatientFilters = () => {
    setPatientFilters(DEFAULT_PATIENT_FILTERS);
  };

  // ─────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="splash">
        <div className="splash-inner">
          <div className="spinner" />
          <p>Loading Synergy...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="splash">
        <div className="splash-inner error">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Synergy</h1>
          <p>Physiotherapy Center Management</p>
        </div>
        <nav className="tab-nav">
          <button className={activeTab === 'dashboard' ? 'tab active' : 'tab'} onClick={() => setActiveTab('dashboard')}>
            📊 Dashboard
          </button>
          <button className={activeTab === 'opd' ? 'tab active' : 'tab'} onClick={() => setActiveTab('opd')}>
            🩺 OPD
          </button>
          <button className={activeTab === 'ipd' ? 'tab active' : 'tab'} onClick={() => setActiveTab('ipd')}>
            📋 IPD Plans
          </button>
          <button className={activeTab === 'patients' ? 'tab active' : 'tab'} onClick={() => setActiveTab('patients')}>
            👤 Patients
          </button>
        </nav>
      </header>

      {/* ── DASHBOARD TAB ── */}
      {activeTab === 'dashboard' && (
        <>
          <section className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Total Patients</span>
                <div className="kpi-icon">👤</div>
              </div>
              <div className="kpi-value-container">
                <span className="kpi-value">{totalPatients}</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Total Revenue</span>
                <div className="kpi-icon success">💰</div>
              </div>
              <div className="kpi-value-container">
                <span className="kpi-value">{formatCurrency(totalRevenue)}</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">OPD Sessions</span>
                <div className="kpi-icon warning">📅</div>
              </div>
              <div className="kpi-value-container">
                <span className="kpi-value">{totalSessions}</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Active IPD Plans</span>
                <div className="kpi-icon danger">⭐</div>
              </div>
              <div className="kpi-value-container">
                <span className="kpi-value">{activeIpdPlans}</span>
              </div>
            </div>
          </section>

          {/* Recent sessions summary */}
          <section className="list-container">
            <h2>Recent OPD Sessions</h2>
            {sessions.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.slice(0, 10).map(s => (
                    <tr key={s.id}>
                      <td>{s.patientName}</td>
                      <td>{s.type}</td>
                      <td>{formatDate(s.date)}</td>
                      <td>{formatCurrency(s.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">No sessions recorded yet. Go to OPD tab to record a session.</div>
            )}
          </section>
        </>
      )}

      {/* ── OPD TAB ── */}
      {activeTab === 'opd' && (
        <>
          <section className="action-panels">
            <div className="action-panel">
              <h2><span className="icon">💰</span> Record OPD Session</h2>
              <form onSubmit={handleRecordSession} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div className="form-group">
                  <label>Select Patient</label>
                  <select value={sessionPatientId} onChange={(e) => setSessionPatientId(e.target.value)} required>
                    <option value="" disabled>Select a patient...</option>
                    {patients.filter(p => p.type === 'OPD').map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                    {patients.filter(p => p.type === 'OPD').length === 0 && (
                      <option disabled>No OPD patients yet</option>
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label>Session Type</label>
                  <select value={sessionType} onChange={(e) => setSessionType(e.target.value)}>
                    <option value="Consultation">Consultation</option>
                    <option value="Physiotherapy">Physiotherapy</option>
                    <option value="Electrotherapy">Electrotherapy</option>
                    <option value="Manual Therapy">Manual Therapy</option>
                    <option value="Exercise Therapy">Exercise Therapy</option>
                    <option value="Follow-up">Follow-up</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Session Fee (₹)</label>
                  <input type="number" min="0" step="1" placeholder="0" value={sessionCost} onChange={(e) => setSessionCost(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Clinical Notes (optional)</label>
                  <input type="text" placeholder="Brief notes about the session..." value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} />
                </div>
                <button type="submit">Record Session</button>
              </form>
            </div>
          </section>

          <section className="list-container">
            <h2>All OPD Sessions</h2>
            {sessions.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Fee</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id}>
                      <td>{s.patientName}</td>
                      <td>{s.type}</td>
                      <td>{formatDate(s.date)}</td>
                      <td>{formatCurrency(s.cost)}</td>
                      <td>
                        <button className="btn-danger btn-sm" onClick={() => handleDeleteSession(s.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">No OPD sessions recorded yet.</div>
            )}
          </section>
        </>
      )}

      {/* ── IPD PLANS TAB ── */}
      {activeTab === 'ipd' && (
        <>
          <section className="action-panels">
            <div className="action-panel">
              <h2><span className="icon">📋</span> Create IPD Therapy Plan</h2>
              <form onSubmit={handleAddIpdPlan} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div className="form-group">
                  <label>Select Patient</label>
                  <select value={ipdPatientId} onChange={(e) => setIpdPatientId(e.target.value)} required>
                    <option value="" disabled>Select a patient...</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                    ))}
                    {patients.length === 0 && <option disabled>No patients yet</option>}
                  </select>
                </div>
                <div className="form-group">
                  <label>Plan Title</label>
                  <input type="text" placeholder="e.g. Lumbar Spine Rehabilitation" value={ipdTitle} onChange={(e) => setIpdTitle(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Number of Therapy Sessions</label>
                  <input type="number" min="1" step="1" placeholder="e.g. 10" value={ipdTotalSessions} onChange={(e) => setIpdTotalSessions(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" value={ipdStartDate} onChange={(e) => setIpdStartDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Plan Notes (optional)</label>
                  <input type="text" placeholder="Goals, precautions, equipment..." value={ipdNotes} onChange={(e) => setIpdNotes(e.target.value)} />
                </div>
                <button type="submit">Create Therapy Plan</button>
              </form>
            </div>
          </section>

          <section className="list-container">
            <h2>Active Therapy Plans</h2>
            {ipdPlans.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Plan</th>
                    <th>Sessions</th>
                    <th>Start Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ipdPlans.map(i => (
                    <tr key={i.id}>
                      <td>{i.patientName}</td>
                      <td>{i.title}</td>
                      <td>{i.totalSessions}</td>
                      <td>{formatDate(i.startDate)}</td>
                      <td>
                        <button className="btn-danger btn-sm" onClick={() => handleDeleteIpdPlan(i.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">No therapy plans created yet.</div>
            )}
          </section>
        </>
      )}

      {/* ── PATIENTS TAB ── */}
      {activeTab === 'patients' && (
        <>
          <PatientFormPanel
            isEditMode={editingPatientId !== null}
            name={patientName}
            phone={patientPhone}
            condition={patientCondition}
            type={patientType}
            onChangeName={setPatientName}
            onChangePhone={setPatientPhone}
            onChangeCondition={setPatientCondition}
            onChangeType={setPatientType}
            onSubmit={editingPatientId ? handleUpdatePatient : handleAddPatient}
            onCancelEdit={handleCancelEdit}
          />

          <section className="list-container">
            <div className="list-header patient-directory-header">
              <div>
                <h2>Patient Directory</h2>
                {patients.length > 0 && (
                  <p className="patient-directory-count">
                    Showing {filteredPatients.length} of {patients.length} patients
                  </p>
                )}
              </div>
              <div className="batch-actions patient-directory-actions">
                {visibleSelectedPatientCount > 0 && (
                  <button onClick={handleBulkDelete} className="btn-danger">
                    Delete Selected ({visibleSelectedPatientCount})
                  </button>
                )}
                <button
                  onClick={handleExportCSV}
                  className="btn-secondary"
                  disabled={filteredPatients.length === 0}
                >
                  Export Visible CSV
                </button>
              </div>
            </div>

            {patients.length > 0 && (
              <>
                <div className="patient-filter-bar">
                  <div className="patient-filter-field patient-filter-search">
                    <label htmlFor="patient-search">Search Patients</label>
                    <input
                      id="patient-search"
                      type="search"
                      placeholder="Search by name, phone, or condition"
                      value={patientFilters.searchText}
                      onChange={(e) => handlePatientFilterChange('searchText', e.target.value)}
                    />
                  </div>
                  <div className="patient-filter-field patient-filter-type">
                    <label htmlFor="patient-type-filter">Patient Type</label>
                    <select
                      id="patient-type-filter"
                      value={patientFilters.patientType}
                      onChange={(e) => handlePatientFilterChange('patientType', e.target.value)}
                    >
                      <option value="ALL">All</option>
                      <option value="OPD">OPD</option>
                      <option value="IPD">IPD</option>
                    </select>
                  </div>
                  {hasActivePatientFilters && (
                    <button type="button" onClick={clearPatientFilters} className="btn-secondary patient-filter-clear">
                      Clear Filters
                    </button>
                  )}
                </div>
                <p className="patient-export-note">CSV export uses the currently visible patients.</p>
              </>
            )}

            {patients.length === 0 ? (
              <div className="empty-state">
                No patients in the directory. Add a patient to begin.
              </div>
            ) : filteredPatients.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={allVisiblePatientsSelected}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>Patient Name</th>
                    <th>Phone</th>
                    <th>Condition</th>
                    <th>Type</th>
                    <th>Date Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map(p => (
                    <tr key={p.id} className={selectedPatientIds.has(p.id) ? 'selected' : ''}>
                      <td>
                        <input type="checkbox" checked={selectedPatientIds.has(p.id)} onChange={() => toggleSelectPatient(p.id)} />
                      </td>
                      <td>{p.name}</td>
                      <td>{p.phone || '—'}</td>
                      <td>{p.condition || '—'}</td>
                      <td><span className={`badge badge-${p.type?.toLowerCase()}`}>{p.type}</span></td>
                      <td>{formatDate(p.dateAdded)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => handleBeginEditPatient(p)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <p>No patients match your filters.</p>
                {hasActivePatientFilters && (
                  <button type="button" onClick={clearPatientFilters} className="btn-secondary empty-state-action">
                    Clear Filters
                  </button>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default App;
