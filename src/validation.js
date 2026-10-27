export const DEFAULT_TIMEZONE = 'Asia/Bishkek';
const TIMEZONES = new Set(['UTC', ...Intl.supportedValuesOf('timeZone')]);
export const length = (value) => [...value].length;
export const normalizeEmail = (email) =>
  typeof email === 'string' ? email.trim().toLowerCase() : '';
export function validTimezone(value) {
  return typeof value === 'string' && TIMEZONES.has(value);
}
export function validateProfile(data) {
  const errors = {};
  if (typeof data.name !== 'string' || !data.name.trim() || length(data.name.trim()) > 100)
    errors.name = 'Введите имя от 1 до 100 символов.';
  if (!validTimezone(data.timezone)) errors.timezone = 'Выберите существующий часовой пояс.';
  return errors;
}
export function validateAuth(data, mode) {
  const errors = {};
  const email = normalizeEmail(data.email);
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = 'Введите корректную электронную почту.';
  if (typeof data.password !== 'string' || length(data.password) < 8 || length(data.password) > 128)
    errors.password = 'Пароль должен содержать от 8 до 128 символов.';
  if (mode === 'register') {
    Object.assign(errors, validateProfile({ name: data.name, timezone: DEFAULT_TIMEZONE }));
    if (data.confirmPassword !== data.password) errors.confirmPassword = 'Пароли не совпадают.';
  }
  return errors;
}
