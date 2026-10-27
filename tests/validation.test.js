import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAuth, validateProfile, normalizeEmail } from '../src/validation.js';

const account = {
  name: 'Алина',
  email: 'ALINA@example.com ',
  password: 'Good-password-8',
  confirmPassword: 'Good-password-8',
};
test('registration accepts a valid account and normalizes email', () => {
  assert.deepEqual(validateAuth(account, 'register'), {});
  assert.equal(normalizeEmail(account.email), 'alina@example.com');
});
test('registration rejects whitespace names, malformed email and mismatched passwords', () => {
  const result = validateAuth(
    { ...account, name: '  ', email: 'a@', confirmPassword: 'no' },
    'register',
  );
  assert.deepEqual(Object.keys(result).sort(), ['confirmPassword', 'email', 'name']);
});
test('password limits are inclusive; whitespace in passwords is preserved', () => {
  for (const size of [8, 128])
    assert.equal(
      validateAuth({ ...account, password: ' '.repeat(size) }, 'login').password,
      undefined,
    );
  for (const size of [7, 129])
    assert.ok(validateAuth({ ...account, password: 'a'.repeat(size) }, 'login').password);
});
test('server validators reject non-string payloads and invalid zones', () => {
  assert.equal(Object.keys(validateAuth({ email: {}, password: 123 }, 'login')).length, 2);
  assert.deepEqual(Object.keys(validateProfile({ name: [], timezone: 'Planet/Mars' })).sort(), [
    'name',
    'timezone',
  ]);
  assert.deepEqual(validateProfile({ name: '  Алина  ', timezone: 'Asia/Bishkek' }), {});
  assert.ok(validateProfile({ name: 'а'.repeat(101), timezone: 'UTC' }).name);
  assert.ok(validateProfile({ name: 'Алина', timezone: '+06:00' }).timezone);
});
