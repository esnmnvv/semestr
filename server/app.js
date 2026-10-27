import express from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword } from './password.js';
import { readProfile, withUser } from './db.js';
import {
  DEFAULT_TIMEZONE,
  normalizeEmail,
  validateAuth,
  validateProfile,
} from '../src/validation.js';

export async function createApp({
  pool,
  secret = process.env.SESSION_SECRET,
  production = false,
  origin = process.env.APP_ORIGIN,
  trustProxy = false,
} = {}) {
  if (!secret || secret.length < 32)
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: production
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'"],
              fontSrc: ["'self'"],
              imgSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
      strictTransportSecurity: production,
    }),
  );
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '12kb' }));
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    // JSON + a custom header prevents cross-origin form submissions. No CORS is enabled.
    if (!req.is('application/json') || req.get('X-Requested-With') !== 'Semester')
      return res.status(403).json({ message: 'Обновите страницу и повторите действие.' });
    const expected = origin || `${req.protocol}://${req.get('host')}`;
    if (req.get('origin') && req.get('origin') !== expected)
      return res.status(403).json({ message: 'Запрос с другого сайта отклонён.' });
    next();
  });
  const Store = pgSession(session);
  const store = new Store({
    pool,
    tableName: 'app_sessions',
    pruneSessionInterval: 900,
    errorLog: () => console.error('Session storage unavailable'),
  });
  app.locals.sessionStore = store;
  app.use(
    '/api',
    session({
      store,
      name: 'semester.sid',
      secret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: production,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Слишком много попыток. Попробуйте снова через 15 минут.' },
  });
  const dummyHash = await hashPassword(randomBytes(32).toString('hex'));
  const establishSession = async (req, id) => {
    await new Promise((resolve, reject) =>
      req.session.regenerate((error) => (error ? reject(error) : resolve())),
    );
    req.session.userId = id;
    await new Promise((resolve, reject) =>
      req.session.save((error) => (error ? reject(error) : resolve())),
    );
  };
  const requireUser = (req, res, next) => {
    if (!req.session.userId)
      return res.status(401).json({ message: 'Войдите в аккаунт, чтобы продолжить.' });
    next();
  };

  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  });
  app.get('/api/auth/session', async (req, res) => {
    const user = req.session.userId ? await readProfile(pool, req.session.userId) : null;
    res.json({ user: user || null });
  });
  app.post('/api/auth/register', authLimiter, async (req, res) => {
    const errors = validateAuth(req.body || {}, 'register');
    if (Object.keys(errors).length)
      return res.status(422).json({ message: 'Проверьте заполненные поля.', errors });
    const { name, password } = req.body;
    const email = normalizeEmail(req.body.email);
    const hash = await hashPassword(password);
    const client = await pool.connect();
    let id;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        [email, hash],
      );
      id = rows[0].id;
      await client.query("SELECT set_config('app.user_id', $1, true)", [id]);
      await client.query('INSERT INTO profiles (id, name, timezone) VALUES ($1, $2, $3)', [
        id,
        name.trim(),
        DEFAULT_TIMEZONE,
      ]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505')
        return res
          .status(409)
          .json({
            message: 'Аккаунт с такой почтой уже существует. Войдите в него.',
            errors: { email: 'Эта почта уже зарегистрирована.' },
          });
      throw error;
    } finally {
      client.release();
    }
    await establishSession(req, id);
    res.status(201).json({ user: await readProfile(pool, id) });
  });
  app.post('/api/auth/login', authLimiter, async (req, res) => {
    const errors = validateAuth(req.body || {}, 'login');
    if (Object.keys(errors).length)
      return res.status(422).json({ message: 'Проверьте заполненные поля.', errors });
    const { rows } = await pool.query('SELECT id, password_hash FROM users WHERE email = $1', [
      normalizeEmail(req.body.email),
    ]);
    const valid = await verifyPassword(req.body.password, rows[0]?.password_hash || dummyHash);
    if (!rows[0] || !valid)
      return res
        .status(401)
        .json({ message: 'Неверная почта или пароль. Проверьте данные и попробуйте ещё раз.' });
    await establishSession(req, rows[0].id);
    res.json({ user: await readProfile(pool, rows[0].id) });
  });
  app.post('/api/auth/logout', async (req, res) => {
    await new Promise((resolve, reject) =>
      req.session.destroy((error) => (error ? reject(error) : resolve())),
    );
    res.clearCookie('semester.sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: production,
      path: '/',
    });
    res.json({ ok: true });
  });
  app.get('/api/profile', requireUser, async (req, res) => {
    const user = await readProfile(pool, req.session.userId);
    if (!user) return res.status(401).json({ message: 'Войдите в аккаунт заново.' });
    res.json({ user });
  });
  app.patch('/api/profile', requireUser, async (req, res) => {
    const errors = validateProfile(req.body || {});
    if (Object.keys(errors).length)
      return res.status(422).json({ message: 'Проверьте заполненные поля.', errors });
    await withUser(pool, req.session.userId, (client) =>
      client.query('UPDATE profiles SET name = $1, timezone = $2 WHERE id = $3', [
        req.body.name.trim(),
        req.body.timezone,
        req.session.userId,
      ]),
    );
    res.json({ user: await readProfile(pool, req.session.userId) });
  });
  app.use('/api', (_req, res) => res.status(404).json({ message: 'Страница не найдена.' }));
  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.too.large' || error.type === 'entity.parse.failed')
      return res
        .status(400)
        .json({ message: 'Не удалось прочитать запрос. Проверьте введённые данные.' });
    console.error('Request failed:', error.code || error.name);
    res
      .status(503)
      .json({
        message: 'Не удалось связаться с базой данных. Ваши поля сохранены — попробуйте ещё раз.',
      });
  });
  return app;
}
