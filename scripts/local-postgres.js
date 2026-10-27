import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const local = path.join(root, '.local');
const data = path.join(local, 'postgres');
const port = Number(process.env.LOCAL_PG_PORT || 55432);
const executable = process.platform === 'win32' ? 'initdb.exe' : 'initdb';
const found = spawnSync(process.platform === 'win32' ? 'where' : 'which', [executable], {
  encoding: 'utf8',
});
const candidates = [
  process.env.PG_BIN,
  found.status === 0 ? path.dirname(found.stdout.trim().split('\n')[0]) : '',
  '/opt/homebrew/opt/postgresql@16/bin',
  '/opt/homebrew/opt/postgresql@18/bin',
  '/usr/lib/postgresql/16/bin',
  '/usr/lib/postgresql/17/bin',
];
const bin = candidates.find((dir) => dir && existsSync(path.join(dir, executable)));
if (!bin)
  throw new Error(
    'PostgreSQL not found. Install PostgreSQL 16+ and set PG_BIN to its bin directory.',
  );
function run(command, args, env = {}) {
  const result = spawnSync(path.join(bin, command), args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  return result;
}
if (process.argv[2] === 'stop') {
  if (existsSync(path.join(data, 'postmaster.pid')))
    run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
  console.log('Локальная PostgreSQL остановлена. Данные сохранены в .local/postgres.');
} else {
  mkdirSync(local, { recursive: true, mode: 0o700 });
  const passwordFile = path.join(local, 'postgres-owner-password');
  if (!existsSync(passwordFile))
    writeFileSync(passwordFile, randomBytes(32).toString('hex'), { mode: 0o600 });
  const ownerPassword = readFileSync(passwordFile, 'utf8').trim();
  if (!existsSync(path.join(data, 'PG_VERSION')))
    run('initdb', [
      '-D',
      data,
      '-U',
      'semester_admin',
      '--pwfile',
      passwordFile,
      '--auth=scram-sha-256',
      '--encoding=UTF8',
      '--locale=C',
    ]);
  const state = spawnSync(path.join(bin, 'pg_ctl'), ['-D', data, 'status'], { encoding: 'utf8' });
  if (state.status !== 0)
    run('pg_ctl', [
      '-D',
      data,
      '-l',
      path.join(local, 'postgres.log'),
      '-o',
      `-h 127.0.0.1 -p ${port} -k ${local}`,
      '-w',
      'start',
    ]);
  const admin = new pg.Client({
    host: '127.0.0.1',
    port,
    user: 'semester_admin',
    password: ownerPassword,
    database: 'postgres',
  });
  await admin.connect();
  try {
    const role = await admin.query("SELECT 1 FROM pg_roles WHERE rolname = 'semester_app'");
    if (!role.rowCount) {
      const appPassword = randomBytes(24).toString('hex');
      await admin.query(
        `CREATE ROLE semester_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${appPassword}'`,
      );
      if (!existsSync(path.join(root, '.env')))
        writeFileSync(
          path.join(root, '.env'),
          `DATABASE_URL=postgresql://semester_app:${appPassword}@127.0.0.1:${port}/semester\nSESSION_SECRET=${randomBytes(48).toString('hex')}\nPORT=5173\nAPP_ORIGIN=http://localhost:5173\n`,
          { mode: 0o600 },
        );
    }
    const database = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'semester'");
    if (!database.rowCount) await admin.query('CREATE DATABASE semester OWNER semester_app');
  } finally {
    await admin.end();
  }
  console.log(
    `Локальная PostgreSQL работает на 127.0.0.1:${port}. Выполните npm run db:migrate, затем npm run dev.`,
  );
}
