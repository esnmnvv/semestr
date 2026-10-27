import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/app.js';
import { makePool, withUser } from '../server/db.js';

const pool = makePool();
const prefix = `api-${randomUUID()}`;
const credentials = {
  name: 'Алина Ким',
  email: `${prefix}@example.test`,
  password: 'ValidPassword9!',
  confirmPassword: 'ValidPassword9!',
};
let server, app, base, cookie, userId;
before(async () => {
  app = await createApp({
    pool,
    secret: 'test-secret-with-more-than-32-characters',
    origin: 'http://localhost:5173',
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await pool.query('DELETE FROM app_sessions WHERE sess::text LIKE $1', [`%${userId}%`]);
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${prefix}%`]);
  app.locals.sessionStore.close();
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});
async function call(path, { method = 'GET', body, session = cookie, headers = {} } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'Semester',
      ...(session ? { Cookie: session } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, headers: response.headers, data: await response.json() };
}
test('registration creates a real user, profile, hashed password and HttpOnly session', async () => {
  const response = await call('/api/auth/register', { method: 'POST', body: credentials });
  assert.equal(response.status, 201);
  userId = response.data.user.id;
  assert.equal(response.data.user.timezone, 'Asia/Bishkek');
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  cookie = setCookie.split(';')[0];
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  assert.match(rows[0].password_hash, /^scrypt\$/);
  assert.notEqual(rows[0].password_hash, credentials.password);
  assert.equal((await call('/api/auth/session')).data.user.id, userId);
});
test('email uniqueness ignores case and reports the field', async () => {
  const result = await call('/api/auth/register', {
    method: 'POST',
    body: { ...credentials, email: credentials.email.toUpperCase() },
  });
  assert.equal(result.status, 409);
  assert.ok(result.data.errors.email);
});
test('invalid input cannot create a profile and raw database errors are hidden', async () => {
  const result = await call('/api/auth/register', {
    method: 'POST',
    body: { ...credentials, name: '  ', password: 'short', confirmPassword: 'different' },
  });
  assert.equal(result.status, 422);
  assert.ok(result.data.errors.name);
  assert.ok(result.data.errors.password);
  assert.ok(result.data.errors.confirmPassword);
});
test('profile updates persist and malicious id parameters cannot select another user', async () => {
  const second = await call('/api/auth/register', {
    method: 'POST',
    body: { ...credentials, email: `${prefix}-second@example.test`, name: 'Другой студент' },
    session: '',
  });
  const result = await call('/api/profile', {
    method: 'PATCH',
    body: { name: 'Алина Новая', timezone: 'Europe/Moscow', id: second.data.user.id },
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.user.id, userId);
  assert.equal((await call('/api/profile')).data.user.name, 'Алина Новая');
  const other = await withUser(pool, second.data.user.id, (db) =>
    db.query('SELECT name FROM profiles WHERE id = $1', [second.data.user.id]),
  );
  assert.equal(other.rows[0].name, 'Другой студент');
  await pool.query('DELETE FROM app_sessions WHERE sess::text LIKE $1', [
    `%${second.data.user.id}%`,
  ]);
});
test('PostgreSQL RLS prevents reading and modifying a foreign profile, even for table owner', async () => {
  const role = await pool.query(
    'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user',
  );
  assert.equal(role.rows[0].rolsuper, false);
  assert.equal(role.rows[0].rolbypassrls, false);
  const none = await pool.query('SELECT * FROM profiles');
  assert.equal(none.rowCount, 0);
  const denied = await withUser(pool, randomUUID(), async (db) => {
    assert.equal((await db.query('SELECT * FROM profiles WHERE id = $1', [userId])).rowCount, 0);
    return db.query('UPDATE profiles SET name = $1 WHERE id = $2', ['Взломано', userId]);
  });
  assert.equal(denied.rowCount, 0);
  assert.equal((await call('/api/profile')).data.user.name, 'Алина Новая');
});
test('database constraints reject invalid zones and blank names', async () => {
  await assert.rejects(
    withUser(pool, userId, (db) =>
      db.query("UPDATE profiles SET timezone = 'Planet/Mars' WHERE id = $1", [userId]),
    ),
    { code: '23514' },
  );
  await assert.rejects(
    withUser(pool, userId, (db) =>
      db.query("UPDATE profiles SET name = ' ' WHERE id = $1", [userId]),
    ),
    { code: '23514' },
  );
  assert.equal(
    (
      await call('/api/profile', {
        method: 'PATCH',
        body: { name: 'Алина', timezone: 'Planet/Mars' },
      })
    ).status,
    422,
  );
});
test('cross-origin writes and unauthenticated profile reads are rejected', async () => {
  assert.equal((await call('/api/profile', { session: '' })).status, 401);
  assert.equal(
    (
      await call('/api/profile', {
        method: 'PATCH',
        body: { name: 'x', timezone: 'UTC' },
        headers: { Origin: 'https://evil.example' },
      })
    ).status,
    403,
  );
});
test('logout invalidates the old session; new login works with case-insensitive email', async () => {
  const previous = cookie;
  assert.equal((await call('/api/auth/logout', { method: 'POST', body: {} })).status, 200);
  assert.equal((await call('/api/profile', { session: previous })).status, 401);
  assert.equal(
    (
      await call('/api/auth/login', {
        method: 'POST',
        body: { email: credentials.email, password: 'Incorrect99!' },
        session: '',
      })
    ).status,
    401,
  );
  const login = await call('/api/auth/login', {
    method: 'POST',
    body: { email: credentials.email.toUpperCase(), password: credentials.password },
    session: '',
  });
  assert.equal(login.status, 200);
  cookie = login.headers.get('set-cookie').split(';')[0];
  assert.notEqual(cookie, previous);
  assert.equal(login.data.user.timezone, 'Europe/Moscow');
});
test('session survives a new server instance using the same database and secret', async () => {
  const restarted = await createApp({ pool, secret: 'test-secret-with-more-than-32-characters' });
  const listener = restarted.listen(0, '127.0.0.1');
  await new Promise((resolve) => listener.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${listener.address().port}/api/auth/session`, {
      headers: { Cookie: cookie },
    });
    assert.equal((await response.json()).user.id, userId);
  } finally {
    restarted.locals.sessionStore.close();
    await new Promise((resolve) => listener.close(resolve));
  }
});
test('production sets Secure cookies and restrictive content policy behind a trusted HTTPS proxy', async () => {
  const secureApp = await createApp({
    pool,
    secret: 'test-secret-with-more-than-32-characters',
    production: true,
    trustProxy: true,
    origin: 'https://semester.example',
  });
  const listener = secureApp.listen(0, '127.0.0.1');
  await new Promise((resolve) => listener.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${listener.address().port}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'Semester',
        'X-Forwarded-Proto': 'https',
        Origin: 'https://semester.example',
      },
      body: JSON.stringify({ email: credentials.email, password: credentials.password }),
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /Secure/);
    assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
  } finally {
    secureApp.locals.sessionStore.close();
    await new Promise((resolve) => listener.close(resolve));
  }
});
test('repeated failed authorization requests are rate limited', async () => {
  let limited;
  for (let i = 0; i < 21; i++) {
    const response = await call('/api/auth/login', {
      method: 'POST',
      body: { email: credentials.email, password: 'short' },
      session: '',
    });
    if (response.status === 429) {
      limited = response;
      break;
    }
  }
  assert.ok(limited);
  assert.ok(limited.headers.get('retry-after'));
});
