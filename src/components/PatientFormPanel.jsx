/**
 * PatientFormPanel — shared Add / Edit patient form.
 *
 * Renders the full patient form with all labels, placeholders, required
 * attributes, select options, and controlled value/onChange wiring.
 * The heading and submit button text adapt to add vs edit mode.
 */
function PatientFormPanel({
  isEditMode,
  name,
  phone,
  condition,
  type,
  onChangeName,
  onChangePhone,
  onChangeCondition,
  onChangeType,
  onSubmit,
  onCancelEdit,
}) {
  return (
    <section className="action-panels">
      <div className="action-panel">
        <h2>
          <span className="icon">👤</span>
          {isEditMode ? ' Edit Patient' : ' Add New Patient'}
        </h2>
        <form onSubmit={onSubmit} className="patient-form">
          <div className="form-group">
            <label>Patient Full Name</label>
            <input
              type="text"
              placeholder="e.g. Rajesh Kumar"
              value={name}
              onChange={(e) => onChangeName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input
              type="tel"
              placeholder="e.g. 98765 43210"
              value={phone}
              onChange={(e) => onChangePhone(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Condition / Reason for Visit</label>
            <input
              type="text"
              placeholder="e.g. Lower Back Pain"
              value={condition}
              onChange={(e) => onChangeCondition(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Patient Type</label>
            <select
              value={type}
              onChange={(e) => onChangeType(e.target.value)}
            >
              <option value="OPD">OPD — Regular Consultation</option>
              <option value="IPD">IPD — Therapy Plan</option>
            </select>
          </div>
          <div className="patient-form-actions">
            <button type="submit">
              {isEditMode ? 'Save Changes' : 'Add Patient'}
            </button>
            {isEditMode && (
              <button
                type="button"
                className="btn-secondary"
                onClick={onCancelEdit}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}

export default PatientFormPanel;
