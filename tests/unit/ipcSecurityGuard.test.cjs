'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { requireUnlocked } = require('../../lib/ipcSecurityGuard.cjs');
const { SECURITY_STATES } = require('../../lib/securityService.cjs');

function makeMockSecurityService(state) {
  let currentState = state;
  return {
    getState() {
      return currentState;
    },
    setState(s) {
      currentState = s;
    }
  };
}

test('requireUnlocked behavior under different security states', async (t) => {
  await t.test('UNLOCKED state executes the handler and passes arguments', async () => {
    const securityService = makeMockSecurityService(SECURITY_STATES.UNLOCKED);
    let handlerCalled = false;
    const handler = async (event, a, b) => {
      handlerCalled = true;
      assert.equal(a, 1);
      assert.equal(b, 2);
      return 'success';
    };
    
    const wrapped = requireUnlocked(securityService, handler);
    const res = await wrapped({}, 1, 2);
    assert.ok(handlerCalled);
    assert.equal(res, 'success');
  });

  await t.test('UNLOCKED state preserves synchronous results', async () => {
    const securityService = makeMockSecurityService(SECURITY_STATES.UNLOCKED);
    const handler = () => 'sync-success';
    const wrapped = requireUnlocked(securityService, handler);
    const res = await wrapped({});
    assert.equal(res, 'sync-success');
  });

  await t.test('UNLOCKED state propagates handler errors unchanged', async () => {
    const securityService = makeMockSecurityService(SECURITY_STATES.UNLOCKED);
    const handler = () => {
      throw new Error('Database integrity error');
    };
    const wrapped = requireUnlocked(securityService, handler);
    await assert.rejects(
      () => wrapped({}),
      { message: 'Database integrity error' }
    );
  });

  await t.test('LOCKED state rejects the call without calling handler', async () => {
    const securityService = makeMockSecurityService(SECURITY_STATES.LOCKED);
    let handlerCalled = false;
    const handler = () => {
      handlerCalled = true;
    };
    const wrapped = requireUnlocked(securityService, handler);
    
    await assert.rejects(
      () => wrapped({}),
      (err) => {
        assert.equal(err.code, 'APP_LOCKED');
        assert.equal(err.message, 'The application is locked.');
        // Ensure no credential material is returned in the error object
        assert.equal(err.hash, undefined);
        assert.equal(err.salt, undefined);
        return true;
      }
    );
    assert.ok(!handlerCalled);
  });

  await t.test('SETUP_REQUIRED state rejects the call without calling handler', async () => {
    const securityService = makeMockSecurityService(SECURITY_STATES.SETUP_REQUIRED);
    let handlerCalled = false;
    const handler = () => {
      handlerCalled = true;
    };
    const wrapped = requireUnlocked(securityService, handler);
    
    await assert.rejects(
      () => wrapped({}),
      (err) => {
        assert.equal(err.code, 'APP_LOCKED');
        assert.equal(err.message, 'The application is locked.');
        return true;
      }
    );
    assert.ok(!handlerCalled);
  });

  await t.test('RECOVERY_REQUIRED state rejects the call without calling handler', async () => {
    const securityService = makeMockSecurityService(SECURITY_STATES.RECOVERY_REQUIRED);
    let handlerCalled = false;
    const handler = () => {
      handlerCalled = true;
    };
    const wrapped = requireUnlocked(securityService, handler);
    
    await assert.rejects(
      () => wrapped({}),
      (err) => {
        assert.equal(err.code, 'APP_LOCKED');
        assert.equal(err.message, 'The application is locked.');
        return true;
      }
    );
    assert.ok(!handlerCalled);
  });

  await t.test('Guard does not change the security state', async () => {
    const securityService = makeMockSecurityService(SECURITY_STATES.LOCKED);
    const wrapped = requireUnlocked(securityService, () => {});
    await assert.rejects(() => wrapped({}));
    assert.equal(securityService.getState(), SECURITY_STATES.LOCKED);
  });
});
