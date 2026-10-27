import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { makePool } from '../server/db.js';

const pool = makePool();
try {
  const role = await pool.query(
    'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user',
  );
  if (role.rows[0].rolsuper || role.rows[0].rolbypassrls)
    throw new Error('Use a non-superuser role without BYPASSRLS for the application.');
  const directory = fileURLToPath(new URL('../db/migrations/', import.meta.url));
  for (const file of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
    await pool.query(await readFile(`${directory}/${file}`, 'utf8'));
    console.log(`Применено: ${file}`);
  }
} finally {
  await pool.end();
}
