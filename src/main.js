import 'bootstrap/dist/css/bootstrap.min.css';
import '@fontsource/golos-text/cyrillic-400.css';
import '@fontsource/golos-text/cyrillic-500.css';
import '@fontsource/golos-text/cyrillic-600.css';
import '@fontsource/golos-text/latin-400.css';
import '@fontsource/golos-text/latin-500.css';
import '@fontsource/golos-text/latin-600.css';
import './style.css';
import {
  createIcons,
  CalendarDays,
  MoreHorizontal,
  BookOpen,
  Check,
  Sparkle,
  CircleCheck,
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  LockKeyhole,
  UserRoundPlus,
  Hand,
  LayoutDashboard,
  UserRound,
  ListChecks,
  Bell,
  Sprout,
  LogOut,
  Circle,
  Mail,
  Globe2,
  Clock3,
  MapPin,
  ShieldCheck,
} from 'lucide';
import { request } from './api.js';
import { validateAuth, validateProfile } from './validation.js';
import { authView, homeView, profileView, icon, timezoneLabel } from './views.js';

const icons = {
  CalendarDays,
  MoreHorizontal,
  BookOpen,
  Check,
  Sparkle,
  CircleCheck,
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  LockKeyhole,
  UserRoundPlus,
  Hand,
  LayoutDashboard,
  UserRound,
  ListChecks,
  Bell,
  Sprout,
  LogOut,
  Circle,
  Mail,
  Globe2,
  Clock3,
  MapPin,
  ShieldCheck,
};
const root = document.querySelector('#app');
let user = null;
let route = '';
let clock;
let toastTimer;
let busy = false;
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('semester-auth') : null;
const drawIcons = () =>
  createIcons({ icons, attrs: { 'stroke-width': 1.7, 'aria-hidden': 'true' } });
const formData = (form) => Object.fromEntries(new FormData(form));
const dirty = () => {
  const form = document.querySelector('#profile-form');
  return !!(
    form &&
    user &&
    (form.elements.name.value.trim() !== user.name ||
      form.elements.timezone.value !== user.timezone)
  );
};
function setErrors(form, errors = {}, message = '') {
  form.querySelectorAll('.field-error').forEach((element) => {
    element.textContent = '';
  });
  form
    .querySelectorAll('[aria-invalid]')
    .forEach((element) => element.removeAttribute('aria-invalid'));
  for (const [name, text] of Object.entries(errors)) {
    const element = form.elements.namedItem(name);
    if (element) {
      element.setAttribute('aria-invalid', 'true');
      form.querySelector(`#${name}-error`).textContent = text;
    }
  }
  const alert = form.querySelector('.form-alert');
  alert.textContent = message;
  alert.hidden = !message;
  form.querySelector('[aria-invalid]')?.focus();
}
function setBusy(form, value) {
  busy = value;
  form.setAttribute('aria-busy', String(value));
  const submit = form.querySelector('[type=submit]');
  submit.disabled = value;
  if (value) {
    submit.dataset.content = submit.innerHTML;
    submit.textContent = 'Сохраняем…';
  } else if (submit.dataset.content) {
    submit.innerHTML = submit.dataset.content;
    drawIcons();
  }
}
function showToast(message) {
  const toast = document.querySelector('.toast-message');
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 5000);
}
function updateClock() {
  const output = document.querySelector('#local-clock');
  if (!output) return;
  const timezone = document.querySelector('#timezone').value;
  output.textContent = new Intl.DateTimeFormat('ru', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
  document.querySelector('#local-date').textContent = new Intl.DateTimeFormat('ru', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  document.querySelector('#clock-timezone').textContent = timezoneLabel(timezone);
}
function updateDirtyState() {
  const form = document.querySelector('#profile-form');
  if (!form) return;
  const changed = dirty();
  form.querySelector('[type=submit]').disabled = busy || !changed;
  form.querySelector('[data-action=reset-profile]').disabled = busy || !changed;
  document.querySelector('#save-hint').textContent = changed
    ? 'Есть несохранённые изменения'
    : 'Все изменения сохранены';
  updateClock();
}
function render() {
  clearInterval(clock);
  root.innerHTML = user
    ? route === 'profile'
      ? profileView(user)
      : homeView(user)
    : authView(route === 'register' ? 'register' : 'login');
  document.title = `${user ? (route === 'profile' ? 'Мой профиль' : 'Обзор') : route === 'register' ? 'Регистрация' : 'Вход'} — Семестр`;
  drawIcons();
  if (route === 'profile' && user) {
    updateClock();
    clock = setInterval(updateClock, 10000);
  }
}
function navigate() {
  const requested = location.hash.replace('#/', '') || (user ? 'home' : 'login');
  route = user
    ? ['home', 'profile'].includes(requested)
      ? requested
      : 'home'
    : requested === 'register'
      ? 'register'
      : 'login';
  if (location.hash !== `#/${route}`) history.replaceState(null, '', `#/${route}`);
  render();
  window.scrollTo(0, 0);
}
function go(page) {
  history.pushState(null, '', `#/${page}`);
  navigate();
}

root.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy) return;
  const form = event.target;
  const values = formData(form);
  const auth = form.id === 'auth-form';
  const errors = auth ? validateAuth(values, form.dataset.mode) : validateProfile(values);
  setErrors(form, errors);
  if (Object.keys(errors).length) return;
  setBusy(form, true);
  try {
    const data = await request(auth ? `/auth/${form.dataset.mode}` : '/profile', {
      method: auth ? 'POST' : 'PATCH',
      body: values,
    });
    user = data.user;
    busy = false;
    if (auth) {
      channel?.postMessage('signed-in');
      go('home');
      showToast(
        form.dataset.mode === 'register'
          ? 'Аккаунт создан. Добро пожаловать в Семестр!'
          : 'С возвращением!',
      );
    } else {
      render();
      showToast('Изменения профиля сохранены.');
    }
  } catch (error) {
    if (!auth && error.status === 401) {
      user = null;
      busy = false;
      go('login');
      setErrors(document.querySelector('form'), {}, 'Сессия завершена. Войдите в аккаунт ещё раз.');
      return;
    }
    setErrors(form, error.errors, error.message);
    setBusy(form, false);
    if (!auth) updateDirtyState();
  }
});

root.addEventListener('input', (event) => {
  const field = event.target;
  if (field.name && field.form) {
    field.removeAttribute('aria-invalid');
    const message = field.form.querySelector(`#${field.name}-error`);
    if (message) message.textContent = '';
  }
  updateDirtyState();
});
root.addEventListener('change', updateDirtyState);
root.addEventListener('click', async (event) => {
  const toggle = event.target.closest('[data-toggle-password]');
  if (toggle) {
    const field = document.getElementById(toggle.dataset.togglePassword);
    const visible = field.type === 'password';
    field.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute(
      'aria-label',
      `${visible ? 'Скрыть' : 'Показать'} ${field.name === 'confirmPassword' ? 'повтор пароля' : 'пароль'}`,
    );
    toggle.innerHTML = icon(visible ? 'eye-off' : 'eye');
    drawIcons();
  }
  const reset = event.target.closest('[data-action=reset-profile]');
  if (reset && !busy) {
    render();
    document.querySelector('#name').focus();
  }
  const logout = event.target.closest('[data-action=logout]');
  if (logout && !busy) {
    if (dirty() && !window.confirm('Изменения профиля не сохранены. Выйти без сохранения?')) return;
    busy = true;
    logout.disabled = true;
    try {
      await request('/auth/logout', { method: 'POST', body: {} });
      user = null;
      channel?.postMessage('signed-out');
      go('login');
    } catch (error) {
      showToast(error.message);
      logout.disabled = false;
    } finally {
      busy = false;
    }
  }
  const link = event.target.closest('a[href^="#/"]');
  if (link) {
    event.preventDefault();
    if (busy) return;
    if (dirty() && !window.confirm('Изменения профиля не сохранены. Перейти без сохранения?'))
      return;
    go(link.getAttribute('href').slice(2));
  }
});
window.addEventListener('hashchange', () => {
  if (dirty() && !window.confirm('Перейти без сохранения изменений?')) {
    history.replaceState(null, '', `#/${route}`);
    return;
  }
  navigate();
});
window.addEventListener('beforeunload', (event) => {
  if (dirty()) {
    event.preventDefault();
    event.returnValue = '';
  }
});
async function refreshSession() {
  if (busy) return;
  try {
    const data = await request('/auth/session');
    if (user && (!data.user || user.id !== data.user.id)) {
      user = null;
      go('login');
    }
  } catch {
    /* Keep the current form intact during a temporary network failure. */
  }
}
channel?.addEventListener('message', refreshSession);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshSession();
});
try {
  user = (await request('/auth/session')).user;
  navigate();
} catch (error) {
  navigate();
  setErrors(document.querySelector('form'), {}, error.message);
}
