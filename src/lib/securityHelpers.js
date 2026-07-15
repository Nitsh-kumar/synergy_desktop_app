export function isValidPin(pin) {
  if (typeof pin !== 'string') return false;
  return /^\d{6}$/.test(pin);
}

export function mapSecurityError(code) {
  switch (code) {
    case 'INVALID_PIN_FORMAT':
      return 'Enter a six-digit PIN.';
    case 'INVALID_CREDENTIAL':
      return 'Incorrect PIN. Please try again.';
    case 'INVALID_STATE':
      return 'This action is not available right now.';
    case 'SECURITY_UNAVAILABLE':
      return 'Security settings could not be accessed.';
    case 'RECOVERY_REQUIRED':
      return 'A controlled recovery procedure is required.';
    case 'INVALID_REQUEST':
      return 'The submitted PIN was not valid.';
    default:
      return 'Synergy could not complete the security check.';
  }
}

export function canLoadData(state) {
  return state === 'UNLOCKED';
}

export function validateSetupInput(pin, confirmPin) {
  if (!isValidPin(pin)) {
    return 'INVALID_PIN_FORMAT';
  }
  if (pin !== confirmPin) {
    return 'PIN_MISMATCH';
  }
  return null;
}

export function getNextStateOnSetup(response) {
  if (response && response.ok && response.state === 'UNLOCKED') {
    return 'UNLOCKED';
  }
  return response?.state || 'SETUP_REQUIRED';
}

export function getNextStateOnUnlock(response) {
  if (response && response.ok && response.state === 'UNLOCKED') {
    return 'UNLOCKED';
  }
  return response?.state || 'LOCKED';
}

