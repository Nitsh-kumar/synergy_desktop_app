'use strict';

const { SECURITY_STATES } = require('./securityService.cjs');

function requireUnlocked(securityService, handler) {
  if (typeof securityService?.getState !== 'function') {
    throw new Error('securityService is required');
  }
  if (typeof handler !== 'function') {
    throw new Error('handler must be a function');
  }
  return async (event, ...args) => {
    if (securityService.getState() !== SECURITY_STATES.UNLOCKED) {
      const err = new Error('The application is locked.');
      err.code = 'APP_LOCKED';
      throw err;
    }
    return handler(event, ...args);
  };
}

module.exports = { requireUnlocked };
