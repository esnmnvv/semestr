import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { mkdirSync } from 'node:fs';
process.loadEnvFile('.env');
const emails = [];
const password = 'Testing-student9!';
mkdirSync('docs/screenshots', { recursive: true });
test.afterAll(async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query('SELECT id FROM users WHERE email = ANY($1)', [emails]);
  for (const { id } of rows)
    await pool.query('DELETE FROM app_sessions WHERE sess::text LIKE $1', [`%${id}%`]);
  await pool.query('DELETE FROM users WHERE email = ANY($1)', [emails]);
  await pool.end();
});
async function register(page) {
  const email = `browser-${randomUUID()}@example.test`;
  emails.push(email);
  await page.goto('/#/register');
  await page.getByLabel('Как тебя зовут').fill('Алина Ким');
  await page.getByLabel('Электронная почта', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByLabel('Повтори пароль').fill(password);
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Привет, Алина!' })).toBeVisible();
  return email;
}
test('registration, saved profile, reload, logout and login on real PostgreSQL', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const email = await register(page);
  await page.screenshot({ path: 'docs/screenshots/overview-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Настроить профиль' }).click();
  await page.getByLabel('Имя', { exact: true }).fill('Алина Новая');
  await page.getByLabel('Часовой пояс', { exact: true }).selectOption('Europe/Moscow');
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.getByRole('status')).toHaveText('Изменения профиля сохранены.');
  await page.reload();
  await expect(page.getByLabel('Имя', { exact: true })).toHaveValue('Алина Новая');
  await expect(page.getByLabel('Часовой пояс', { exact: true })).toHaveValue('Europe/Moscow');
  await page.screenshot({ path: 'docs/screenshots/profile-desktop.png', fullPage: true });
  expect(await page.evaluate(() => document.cookie)).not.toContain('semester.sid');
  await page.getByRole('button', { name: 'Выйти из аккаунта' }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name: 'С возвращением' })).toBeVisible();
  await page.goto('/#/profile');
  await expect(page.getByRole('heading', { name: 'С возвращением' })).toBeVisible();
  await page.getByLabel('Электронная почта', { exact: true }).fill(email.toUpperCase());
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти в Семестр' }).click();
  await expect(page.getByRole('heading', { name: 'Привет, Алина!' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('form errors and password visibility are accessible', async ({ page }) => {
  await page.goto('/#/register');
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await expect(page.getByLabel('Как тебя зовут')).toBeFocused();
  await expect(page.locator('#name-error')).toBeVisible();
  await page.getByLabel('Пароль', { exact: true }).fill('Short');
  await page.getByRole('button', { name: 'Показать пароль', exact: true }).click();
  await expect(page.getByLabel('Пароль', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Скрыть пароль', exact: true }).click();
  await expect(page.getByLabel('Пароль', { exact: true })).toHaveAttribute('type', 'password');
});
test('failed saving keeps fields and allows a real retry; cancel restores saved data', async ({
  page,
}) => {
  await register(page);
  await page.getByRole('link', { name: 'Мой профиль', exact: true }).click();
  await page.getByLabel('Имя', { exact: true }).fill('Алина после ошибки');
  await page.route('**/api/profile', async (route) => {
    if (route.request().method() === 'PATCH')
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Не удалось связаться с базой данных.' }),
      });
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.getByRole('alert')).toContainText('Не удалось связаться');
  await expect(page.getByLabel('Имя', { exact: true })).toHaveValue('Алина после ошибки');
  await page.unroute('**/api/profile');
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.getByRole('status')).toHaveText('Изменения профиля сохранены.');
  await page.getByLabel('Имя', { exact: true }).fill('Не сохранять');
  await page.getByRole('button', { name: 'Отменить', exact: true }).click();
  await expect(page.getByLabel('Имя', { exact: true })).toHaveValue('Алина после ошибки');
  await expect(page.getByRole('button', { name: 'Сохранить изменения' })).toBeDisabled();
});
test('all screens fit a 360px viewport and mobile can save and log out', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const noOverflow = async () =>
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  await page.goto('/#/login');
  await noOverflow();
  await page.screenshot({ path: 'docs/screenshots/login-mobile.png', fullPage: true });
  await page.goto('/#/register');
  await noOverflow();
  await page.screenshot({ path: 'docs/screenshots/register-mobile.png', fullPage: true });
  await register(page);
  await noOverflow();
  await page.getByRole('link', { name: 'Мой профиль', exact: true }).click();
  await noOverflow();
  await page.getByLabel('Имя', { exact: true }).fill('Алина');
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.getByRole('status')).toHaveText('Изменения профиля сохранены.');
  await page.screenshot({ path: 'docs/screenshots/profile-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Выйти из аккаунта' }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name: 'С возвращением' })).toBeVisible();
});
test('desktop auth screens render with local fonts and no horizontal scroll', async ({ page }) => {
  for (const mode of ['login', 'register']) {
    await page.goto(`/#/${mode}`);
    await expect(page.locator('#auth-form')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `docs/screenshots/${mode}-desktop.png`, fullPage: true });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});
