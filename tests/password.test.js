import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../server/password.js';
test('scrypt salts each hash and validates only the original password', async () => {
  const password = 'Пароль с пробелами 9!';
  const one = await hashPassword(password);
  const two = await hashPassword(password);
  assert.notEqual(one, two);
  assert.equal(one.includes(password), false);
  assert.equal(await verifyPassword(password, one), true);
  assert.equal(await verifyPassword('wrong', one), false);
  assert.equal(await verifyPassword(password, 'malformed'), false);
});
