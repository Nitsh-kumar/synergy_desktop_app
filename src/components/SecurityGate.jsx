import { useState } from 'react';
import {
  isValidPin,
  mapSecurityError,
  validateSetupInput,
  getNextStateOnSetup,
  getNextStateOnUnlock,
} from '../lib/securityHelpers.js';
import './SecurityGate.css';

const api = window.electronAPI || null;

export default function SecurityGate({ state, onUnlocked }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handlePinChange = (val, setter) => {
    if (/^\d*$/.test(val)) {
      setter(val);
      if (error) setError('');
    }
  };

  if (state === 'RECOVERY_REQUIRED') {
    return (
      <div className="security-gate">
        <div className="security-card warning">
          <h2>Access Restricted</h2>
          <p>Synergy cannot verify the local security configuration.</p>
          <p>Patient data remains protected.</p>
          <p>A controlled recovery procedure is required.</p>
        </div>
      </div>
    );
  }

  const handleSetup = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');

    const validationError = validateSetupInput(pin, confirmPin);
    if (validationError) {
      if (validationError === 'INVALID_PIN_FORMAT') {
        setError(mapSecurityError('INVALID_PIN_FORMAT'));
      } else if (validationError === 'PIN_MISMATCH') {
        setError('PIN confirmation mismatch. Please match both PIN inputs.');
      } else {
        setError(mapSecurityError(validationError));
      }
      return;
    }

    if (!api) {
      setError('Electron API not found.');
      return;
    }

    try {
      setBusy(true);
      const res = await api.security.setup(pin);
      const nextState = getNextStateOnSetup(res);
      if (nextState === 'UNLOCKED') {
        setPin('');
        setConfirmPin('');
        onUnlocked();
      } else {
        setError(mapSecurityError(res.error?.code || 'INVALID_STATE'));
      }
    } catch (err) {
      console.error('[SecurityGate] PIN setup failed:', err);
      setError(mapSecurityError('INTERNAL_ERROR'));
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');

    if (!isValidPin(pin)) {
      setError(mapSecurityError('INVALID_PIN_FORMAT'));
      return;
    }

    if (!api) {
      setError('Electron API not found.');
      return;
    }

    try {
      setBusy(true);
      const res = await api.security.unlock(pin);
      const nextState = getNextStateOnUnlock(res);
      if (nextState === 'UNLOCKED') {
        setPin('');
        onUnlocked();
      } else {
        setPin(''); // clear pin on unsuccessful unlock
        setError(mapSecurityError(res.error?.code || 'INVALID_CREDENTIAL'));
      }
    } catch (err) {
      console.error('[SecurityGate] PIN unlock failed:', err);
      setPin('');
      setError(mapSecurityError('INTERNAL_ERROR'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="security-gate">
      <div className="security-card">
        {state === 'SETUP_REQUIRED' ? (
          <>
            <h2>Create App PIN</h2>
            <form onSubmit={handleSetup}>
              <div className="form-group">
                <label htmlFor="pin-input">New PIN (6 digits)</label>
                <input
                  id="pin-input"
                  type="password"
                  autoComplete="new-password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => handlePinChange(e.target.value, setPin)}
                  disabled={busy}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirm-pin-input">Confirm PIN</label>
                <input
                  id="confirm-pin-input"
                  type="password"
                  autoComplete="new-password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => handlePinChange(e.target.value, setConfirmPin)}
                  disabled={busy}
                  required
                />
              </div>
              {error && <p className="error-text">{error}</p>}
              <button type="submit" disabled={busy}>
                {busy ? 'Setting up...' : 'Submit'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2>Unlock Synergy</h2>
            <form onSubmit={handleUnlock}>
              <div className="form-group">
                <label htmlFor="unlock-pin-input">Enter PIN</label>
                <input
                  id="unlock-pin-input"
                  type="password"
                  autoComplete="current-password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => handlePinChange(e.target.value, setPin)}
                  disabled={busy}
                  required
                />
              </div>
              {error && <p className="error-text">{error}</p>}
              <button type="submit" disabled={busy}>
                {busy ? 'Unlocking...' : 'Unlock'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
