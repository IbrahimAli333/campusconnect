const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/lib/notifications.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
const preferenceKey = 'campusconnect.push_enabled';

function setup({ preference = '1', permissions = { granted: true }, platform = 'ios' } = {}) {
  const values = new Map([[preferenceKey, preference]]);
  const calls = [];
  const state = { failUnregister: false, failStore: false, failRegister: false, tokenReads: 0 };
  const modules = {
    'expo-constants': { default: { expoConfig: { extra: { eas: { projectId: 'test-project' } } } } },
    'expo-notifications': {
      IosAuthorizationStatus: { PROVISIONAL: 3 },
      getPermissionsAsync: async () => permissions,
      requestPermissionsAsync: async () => permissions,
      setNotificationHandler() {},
      getExpoPushTokenAsync: async () => { state.tokenReads++; return { data: 'test-push-token' }; },
    },
    'expo-secure-store': {
      getItemAsync: async (key) => values.get(key) ?? null,
      setItemAsync: async (key, value) => {
        calls.push(`store:${value}`);
        if (state.failStore) throw new Error('storage unavailable');
        values.set(key, value);
      },
    },
    'react-native': { Platform: { OS: platform } },
    './api/network': {
      registerPushToken: async () => {
        calls.push('register');
        if (state.registrationWait) await state.registrationWait;
        if (state.failRegister) throw new Error('offline');
      },
      unregisterPushToken: async () => {
        calls.push('unregister');
        if (state.failUnregister) throw new Error('offline');
      },
    },
  };
  const context = { exports: {}, require: (name) => {
    assert.ok(modules[name], `unexpected import ${name}`);
    return modules[name];
  }, console: { warn() {} } };
  vm.runInNewContext(source, context);
  return { api: context.exports, state, calls, values };
}

test('offline opt-out keeps preference on and token available for retry', async () => {
  const { api, state, calls } = setup();
  await api.registerForPushNotifications('auth');
  state.failUnregister = true;
  assert.equal(await api.setPushNotificationsEnabled('auth', false), 'failed');
  assert.equal(await api.getPushPreference(), true);
  assert.equal(state.tokenReads, 1);
  await api.registerForPushNotifications('auth');
  assert.equal(calls.filter(x => x === 'register').length, 1);
  state.failUnregister = false;
  assert.equal(await api.setPushNotificationsEnabled('auth', false), 'disabled');
  assert.equal(state.tokenReads, 1);
  assert.equal(await api.getPushPreference(), false);
  assert.deepEqual(calls, ['register', 'unregister', 'unregister', 'store:0']);
});

test('opt-out waits for in-flight startup registration, then prevents re-registration', async () => {
  const { api, state, calls } = setup();
  let finishRegistration;
  state.registrationWait = new Promise(resolve => { finishRegistration = resolve; });
  const registration = api.registerForPushNotifications('auth');
  while (!calls.includes('register')) await new Promise(resolve => setImmediate(resolve));
  const optOut = api.setPushNotificationsEnabled('auth', false);
  assert.deepEqual(calls, ['register']);
  finishRegistration();
  await registration;
  assert.equal(await optOut, 'disabled');
  await api.registerForPushNotifications('auth', 'az');
  assert.deepEqual(calls, ['register', 'unregister', 'store:0']);
});

test('persistence failure does not claim disabled and retry retains token', async () => {
  const { api, state } = setup();
  await api.registerForPushNotifications('auth');
  state.failStore = true;
  assert.equal(await api.setPushNotificationsEnabled('auth', false), 'failed');
  assert.equal(await api.getPushPreference(), true);
  state.failStore = false;
  assert.equal(await api.setPushNotificationsEnabled('auth', false), 'disabled');
  assert.equal(state.tokenReads, 1);
});

test('cold opt-out retrieves and unregisters provisional iOS token', async () => {
  const { api, state, calls } = setup({ permissions: { granted: false, ios: { status: 3 } } });
  assert.equal(await api.setPushNotificationsEnabled('auth', false), 'disabled');
  assert.equal(state.tokenReads, 1);
  assert.deepEqual(calls, ['unregister', 'store:0']);
});

test('failed opt-in restores prior off preference; retry reports actual success', async () => {
  const { api, state, calls } = setup({ preference: '0' });
  state.failRegister = true;
  assert.equal(await api.setPushNotificationsEnabled('auth', true), 'failed');
  assert.equal(await api.getPushPreference(), false);
  await api.registerForPushNotifications('auth');
  assert.equal(calls.filter(x => x === 'register').length, 1);
  state.failRegister = false;
  assert.equal(await api.setPushNotificationsEnabled('auth', true), 'enabled');
  assert.equal(await api.getPushPreference(), true);
});

test('failed logout retains a retry token', async () => {
  const { api, state, calls } = setup();
  await api.registerForPushNotifications('auth');
  state.failUnregister = true;
  await api.unregisterPushNotifications('auth');
  state.failUnregister = false;
  await api.unregisterPushNotifications('auth');
  assert.deepEqual(calls, ['register', 'unregister', 'unregister']);
});

test('web never registers or persists a push preference', async () => {
  const { api, calls } = setup({ platform: 'web' });
  await api.registerForPushNotifications('auth');
  assert.equal(await api.setPushNotificationsEnabled('auth', false), 'failed');
  assert.deepEqual(calls, []);
});
