import { useState, useEffect, useCallback } from 'react';
import './App.css';

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

  // Selection for batch delete
  const [selectedPatientIds, setSelectedPatientIds] = useState(new Set());

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
      setError(`Failed to load data: ${err.message}`);
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
      setPatientName('');
      setPatientPhone('');
      setPatientCondition('');
      setPatientType('OPD');
    } catch (err) {
      alert(`Error adding patient: ${err.message}`);
    }
  };

  const toggleSelectPatient = (id) => {
    const next = new Set(selectedPatientIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedPatientIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedPatientIds.size === patients.length && patients.length > 0) {
      setSelectedPatientIds(new Set());
    } else {
      setSelectedPatientIds(new Set(patients.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPatientIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedPatientIds.size} patient(s) and all their records?`)) return;
    try {
      await api.patients.deleteMany([...selectedPatientIds]);
      setPatients(prev => prev.filter(p => !selectedPatientIds.has(p.id)));
      setSessions(prev => prev.filter(s => !selectedPatientIds.has(s.patientId)));
      setIpdPlans(prev => prev.filter(i => !selectedPatientIds.has(i.patientId)));
      setSelectedPatientIds(new Set());
    } catch (err) {
      alert(`Error deleting patients: ${err.message}`);
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
      alert(`Error recording session: ${err.message}`);
    }
  };

  const handleDeleteSession = async (id) => {
    if (!window.confirm('Delete this session?')) return;
    try {
      await api.sessions.delete(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      alert(`Error deleting session: ${err.message}`);
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
      alert(`Error adding IPD plan: ${err.message}`);
    }
  };

  const handleDeleteIpdPlan = async (id) => {
    if (!window.confirm('Delete this therapy plan?')) return;
    try {
      await api.ipd.delete(id);
      setIpdPlans(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      alert(`Error deleting IPD plan: ${err.message}`);
    }
  };

  // ─────────────────────────────────────────────
  // CSV Export (patients only)
  // ─────────────────────────────────────────────
  const handleExportCSV = () => {
    if (patients.length === 0) return;
    const headers = ['id', 'name', 'phone', 'condition', 'type', 'dateAdded'];
    const rows = patients.map(p =>
      [p.id, `"${p.name}"`, `"${p.phone || ''}"`, `"${p.condition || ''}"`, p.type, p.dateAdded].join(',')
    );
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `patients_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
          <section className="action-panels">
            <div className="action-panel">
              <h2><span className="icon">👤</span> Add New Patient</h2>
              <form onSubmit={handleAddPatient} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div className="form-group">
                  <label>Patient Full Name</label>
                  <input type="text" placeholder="e.g. Rajesh Kumar" value={patientName} onChange={(e) => setPatientName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="tel" placeholder="e.g. 98765 43210" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Condition / Reason for Visit</label>
                  <input type="text" placeholder="e.g. Lower Back Pain" value={patientCondition} onChange={(e) => setPatientCondition(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Patient Type</label>
                  <select value={patientType} onChange={(e) => setPatientType(e.target.value)}>
                    <option value="OPD">OPD — Regular Consultation</option>
                    <option value="IPD">IPD — Therapy Plan</option>
                  </select>
                </div>
                <button type="submit">Add Patient</button>
              </form>
            </div>
          </section>

          <section className="list-container">
            <div className="list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>Patient Directory</h2>
              <div className="batch-actions" style={{ display: 'flex', gap: '1rem' }}>
                {selectedPatientIds.size > 0 && (
                  <button onClick={handleBulkDelete} className="btn-danger">
                    Delete Selected ({selectedPatientIds.size})
                  </button>
                )}
                <button onClick={handleExportCSV} className="btn-secondary">Export CSV</button>
              </div>
            </div>

            {patients.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={selectedPatientIds.size === patients.length && patients.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>Patient Name</th>
                    <th>Phone</th>
                    <th>Condition</th>
                    <th>Type</th>
                    <th>Date Added</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map(p => (
                    <tr key={p.id} className={selectedPatientIds.has(p.id) ? 'selected' : ''}>
                      <td>
                        <input type="checkbox" checked={selectedPatientIds.has(p.id)} onChange={() => toggleSelectPatient(p.id)} />
                      </td>
                      <td>{p.name}</td>
                      <td>{p.phone || '—'}</td>
                      <td>{p.condition || '—'}</td>
                      <td><span className={`badge badge-${p.type?.toLowerCase()}`}>{p.type}</span></td>
                      <td>{formatDate(p.dateAdded)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                No patients in the directory. Add a patient to begin.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default App;
