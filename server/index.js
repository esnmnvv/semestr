import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makePool } from './db.js';
import { createApp } from './app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const production = process.env.NODE_ENV === 'production';
const pool = makePool();
pool.on('error', () => console.error('Database connection interrupted'));
const role = await pool.query(
  'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user',
);
if (role.rows[0].rolsuper || role.rows[0].rolbypassrls) {
  await pool.end();
  throw new Error('The application requires a PostgreSQL role without SUPERUSER or BYPASSRLS.');
}
const app = await createApp({ pool, production, trustProxy: process.env.TRUST_PROXY === '1' });
let vite;
if (production) {
  app.use(express.static(path.join(root, 'dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'dist/index.html')));
} else {
  const { createServer } = await import('vite');
  vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 5173);
const server = app.listen(port, '127.0.0.1', () =>
  console.log(`Семестр: http://localhost:${port}`),
);
async function shutdown() {
  server.close();
  await vite?.close();
  app.locals.sessionStore.close();
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
