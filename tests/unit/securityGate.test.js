import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidPin,
  mapSecurityError,
  canLoadData,
  validateSetupInput,
  getNextStateOnSetup,
  getNextStateOnUnlock
} from '../../src/lib/securityHelpers.js';

// PIN Validation tests (7-11)
test('isValidPin accepts a valid six-digit string PIN', () => {
  assert.equal(isValidPin('123456'), true);
  assert.equal(isValidPin('000000'), true);
  assert.equal(isValidPin('999999'), true);
});

test('isValidPin rejects non-six-digit string PINs', () => {
  assert.equal(isValidPin('12345'), false); // 5 digits
  assert.equal(isValidPin('1234567'), false); // 7 digits
  assert.equal(isValidPin(''), false);
});

test('isValidPin rejects non-numeric string PINs', () => {
  assert.equal(isValidPin('123a56'), false); // letters
  assert.equal(isValidPin('123 56'), false); // spaces
});

test('isValidPin rejects non-string types', () => {
  assert.equal(isValidPin(123456), false);
  assert.equal(isValidPin(null), false);
  assert.equal(isValidPin(undefined), false);
});

// PIN confirmation mismatch test (12)
test('validateSetupInput rejects PIN confirmation mismatch', () => {
  assert.equal(validateSetupInput('123456', '654321'), 'PIN_MISMATCH');
  assert.equal(validateSetupInput('123456', '123456'), null);
});

// State Decisions tests (1-6)
test('canLoadData only permits data loading when UNLOCKED', () => {
  assert.equal(canLoadData('CHECKING'), false);
  assert.equal(canLoadData('SETUP_REQUIRED'), false);
  assert.equal(canLoadData('LOCKED'), false);
  assert.equal(canLoadData('RECOVERY_REQUIRED'), false);
  assert.equal(canLoadData('SECURITY_ERROR'), false);
  assert.equal(canLoadData('UNLOCKED'), true);
});

// Response Mapping tests (13-15)
test('getNextStateOnSetup transitions to UNLOCKED on success', () => {
  assert.equal(getNextStateOnSetup({ ok: true, state: 'UNLOCKED' }), 'UNLOCKED');
});

test('getNextStateOnUnlock transitions to UNLOCKED on success', () => {
  assert.equal(getNextStateOnUnlock({ ok: true, state: 'UNLOCKED' }), 'UNLOCKED');
});

test('getNextStateOnUnlock remains LOCKED on invalid credential response', () => {
  assert.equal(getNextStateOnUnlock({ ok: false, error: { code: 'INVALID_CREDENTIAL' }, state: 'LOCKED' }), 'LOCKED');
});

test('mapSecurityError maps codes correctly', () => {
  assert.equal(mapSecurityError('INVALID_PIN_FORMAT'), 'Enter a six-digit PIN.');
  assert.equal(mapSecurityError('INVALID_CREDENTIAL'), 'Incorrect PIN. Please try again.');
  assert.equal(mapSecurityError('INVALID_STATE'), 'This action is not available right now.');
  assert.equal(mapSecurityError('SECURITY_UNAVAILABLE'), 'Security settings could not be accessed.');
  assert.equal(mapSecurityError('RECOVERY_REQUIRED'), 'A controlled recovery procedure is required.');
  assert.equal(mapSecurityError('INVALID_REQUEST'), 'The submitted PIN was not valid.');
  assert.equal(mapSecurityError('UNKNOWN_CODE'), 'Synergy could not complete the security check.');
  assert.equal(mapSecurityError(null), 'Synergy could not complete the security check.');
});
