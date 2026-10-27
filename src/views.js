export const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
export const icon = (name, className = '') =>
  `<i data-lucide="${name}" class="${className}" aria-hidden="true"></i>`;
export const brand = () =>
  `<a class="brand" href="#/home" aria-label="Семестр — главная"><span class="brand-mark">${icon('calendar-days')}</span><span>семестр<span class="brand-dot">.</span></span></a>`;
const errorSlot = (name) =>
  `<span class="field-error" id="${name}-error" aria-live="polite"></span>`;
const field = (name, label, type = 'text', placeholder = '', extra = '') =>
  `<div class="field"><label for="${name}">${label}</label><div class="input-wrap"><input class="form-control" id="${name}" name="${name}" type="${type}" placeholder="${placeholder}" aria-describedby="${name}-error" ${extra}>${type === 'password' ? `<button class="password-toggle" type="button" data-toggle-password="${name}" aria-label="Показать ${name === 'confirmPassword' ? 'повтор пароля' : 'пароль'}" aria-pressed="false">${icon('eye')}</button>` : ''}</div>${errorSlot(name)}</div>`;

export function weekIllustration() {
  return `<div class="week-composition" aria-hidden="true"><div class="week-sheet"><div class="sheet-heading"><div><span class="sheet-label">Моя неделя</span><strong>Учиться в своём ритме</strong></div>${icon('more-horizontal')}</div><div class="week-days"><span>пн<b>26</b></span><span class="selected-day">вт<b>27</b></span><span>ср<b>28</b></span><span>чт<b>29</b></span><span>пт<b>30</b></span></div><div class="week-lines"><div class="lesson lesson-blue">${icon('book-open')}<div><strong>Разобраться с темой</strong><span>Один шаг за раз</span></div></div><div class="lesson lesson-green">${icon('check')}<span>Сдать лабораторную</span></div><div class="quiet-line"><span>16:00</span><div></div></div><div class="quiet-line"><span>18:00</span><div></div></div></div><span class="sheet-binding binding-one"></span><span class="sheet-binding binding-two"></span></div><div class="sticky-note"><span class="note-pin"></span>${icon('sparkle')}<p>И оставить<br>время на себя.</p><span class="note-doodle">⌣</span></div><div class="done-label">${icon('circle-check')} Всё по плану</div></div>`;
}

export function authView(mode) {
  const register = mode === 'register';
  return `<div class="auth-layout"><section class="auth-story">${brand()}<div class="story-copy"><div class="story-tag"><span></span>Твоё пространство для учёбы</div><h1>Меньше хаоса.<br>Больше ясности.</h1><p>Предметы, планы и дедлайны —<br>в одном месте. А в голове — порядок.</p></div>${weekIllustration()}<div class="story-footer"><span>Всё начинается с небольшого плана.</span><span class="example-label">Пример учебной недели</span></div></section><main class="auth-main"><div class="auth-switch"><span>${register ? 'Уже есть аккаунт?' : 'Первый раз здесь?'}</span><a class="btn btn-outline" href="#/${register ? 'login' : 'register'}">${register ? 'Войти' : 'Создать аккаунт'}</a></div><div class="auth-form-wrap"><span class="form-welcome">${icon(register ? 'user-round-plus' : 'hand')}</span><h2>${register ? 'Начнём твой семестр' : 'С возвращением'}</h2><p class="form-intro">${register ? 'Создай аккаунт и освободи голову для главного.' : 'Твои планы на месте. Войди, чтобы продолжить.'}</p><form id="auth-form" data-mode="${mode}" novalidate><div class="form-alert" role="alert" hidden></div>${register ? field('name', 'Как тебя зовут', 'text', 'Например, Алина', 'autocomplete="given-name" maxlength="100" required') : ''}${field('email', 'Электронная почта', 'email', 'you@example.com', 'autocomplete="email" maxlength="254" inputmode="email" required')}${field('password', 'Пароль', 'password', register ? 'От 8 до 128 символов' : 'Введи свой пароль', `autocomplete="${register ? 'new-password' : 'current-password'}" maxlength="128" required`)}${register ? field('confirmPassword', 'Повтори пароль', 'password', 'Ещё раз, чтобы не ошибиться', 'autocomplete="new-password" maxlength="128" required') : `<div class="session-note">${icon('check')} Останемся в аккаунте на этом устройстве</div>`}<button class="btn btn-primary auth-submit" type="submit"><span>${register ? 'Создать аккаунт' : 'Войти в Семестр'}</span>${icon('arrow-right')}</button></form><div class="privacy-note">${icon('lock-keyhole')}<p>Твоё личное пространство.<br>Данные аккаунта доступны только тебе.</p></div></div><footer class="auth-footer"><span>Семестр · Планировщик студента</span><span>Сделано для спокойной учёбы</span></footer></main></div>`;
}

export function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => [...word][0])
    .join('')
    .toUpperCase();
}
export function timezoneLabel(timezone) {
  const names = {
    'Asia/Bishkek': 'Бишкек',
    'Asia/Almaty': 'Алматы',
    'Asia/Tashkent': 'Ташкент',
    'Europe/Moscow': 'Москва',
    'Europe/Kaliningrad': 'Калининград',
    'Asia/Yekaterinburg': 'Екатеринбург',
    'Asia/Novosibirsk': 'Новосибирск',
    'Asia/Vladivostok': 'Владивосток',
    'Europe/Berlin': 'Берлин',
    'Europe/London': 'Лондон',
    'America/New_York': 'Нью-Йорк',
    UTC: 'Всемирное время',
  };
  const offset = new Intl.DateTimeFormat('en', { timeZone: timezone, timeZoneName: 'shortOffset' })
    .formatToParts(new Date())
    .find((part) => part.type === 'timeZoneName')
    .value.replace('GMT', 'UTC');
  return `${names[timezone] || timezone.replaceAll('_', ' ')} (${offset})`;
}

export function shell(user, page, content) {
  const date = new Intl.DateTimeFormat('ru', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: user.timezone,
  }).format(new Date());
  return `<div class="workspace"><aside class="sidebar">${brand()}<div class="space-label">Личное пространство</div><nav aria-label="Основная навигация"><a href="#/home" class="nav-item ${page === 'home' ? 'active' : ''}" ${page === 'home' ? 'aria-current="page"' : ''}>${icon('layout-dashboard')}<span>Обзор</span></a><a href="#/profile" class="nav-item ${page === 'profile' ? 'active' : ''}" ${page === 'profile' ? 'aria-current="page"' : ''}>${icon('user-round')}<span>Мой профиль</span></a><div class="nav-divider"></div><div class="future-nav"><span>Дальше в Семестре</span><span class="soon-tag">Скоро</span></div>${[
    ['book-open', 'Предметы'],
    ['list-checks', 'Задания'],
    ['calendar-days', 'Календарь'],
    ['bell', 'Уведомления'],
  ]
    .map(
      ([glyph, text]) =>
        `<span class="nav-item unavailable" aria-disabled="true">${icon(glyph)}<span>${text}</span>${icon('lock-keyhole', 'nav-lock')}</span>`,
    )
    .join(
      '',
    )}</nav><div class="sidebar-bottom"><div class="sidebar-note">${icon('sprout')}<p>Большие результаты<br>начинаются с малого.</p></div><div class="sidebar-account"><span class="avatar avatar-small">${escape(initials(user.name))}</span><div><strong data-user-name>${escape(user.name)}</strong><span>Личный аккаунт</span></div><button type="button" class="icon-button" data-action="logout" aria-label="Выйти из аккаунта" title="Выйти из аккаунта">${icon('log-out')}</button></div></div></aside><div class="workspace-body"><header class="workspace-header"><span>Мой семестр <span class="breadcrumb-slash">/</span> <strong>${page === 'profile' ? 'Профиль' : 'Обзор'}</strong></span><div class="header-right"><span>${date}</span><a href="#/profile" class="avatar avatar-mini" aria-label="Открыть профиль">${escape(initials(user.name))}</a><button type="button" class="icon-button mobile-logout" data-action="logout" aria-label="Выйти из аккаунта">${icon('log-out')}</button></div></header><main class="workspace-main" id="main-content">${content}</main><footer class="workspace-footer"><span>Семестр — в твоём ритме.</span><span>Планировщик студента</span></footer></div></div><div class="toast-message" role="status" aria-live="polite" hidden></div>`;
}

export function homeView(user) {
  const first = escape(user.name.trim().split(/\s+/)[0]);
  return shell(
    user,
    'home',
    `<div class="page-heading"><div><h1>Привет, ${first}!</h1><p>Это твой Семестр. Давай начнём с самого важного.</p></div><span class="small-pill">${icon('circle-check')} Аккаунт создан</span></div><section class="welcome-panel"><div><span class="welcome-label">Место для твоих планов</span><h2>Хорошее начало —<br>уже половина дела.</h2><p>Твой аккаунт готов. Проверь имя и часовой пояс,<br class="desktop-break"> чтобы всё было настроено под тебя.</p><a class="btn btn-white" href="#/profile">Настроить профиль ${icon('arrow-up-right')}</a></div><div class="welcome-art" aria-hidden="true"><div class="art-page"><span>Мой семестр</span><div class="art-check">${icon('check')} Создать аккаунт</div><div>${icon('circle')} Настроить профиль</div><div class="art-line"></div><div class="art-line short"></div><span class="art-sticker">Отличный старт!</span></div></div></section><div class="home-columns"><section class="start-section"><h2>Твоё пространство готово</h2><p>Начнём с профиля. Остальное появится по мере развития проекта.</p><a class="profile-link-card" href="#/profile"><span class="icon-tile">${icon('user-round')}</span><div><h3>Мой профиль</h3><p>Имя, почта и твой часовой пояс</p></div>${icon('arrow-up-right')}</a><div class="connection-row"><span class="status-dot"></span>Ты вошёл в личный аккаунт</div></section><aside class="next-section"><span class="small-pill neutral">В следующих обновлениях</span><h2>Учёба обретёт свой ритм</h2><p>Предметы и задания, календарь дедлайнов и напоминания. Всё будет здесь, шаг за шагом.</p><div class="upcoming-icons">${icon('book-open')}${icon('list-checks')}${icon('calendar-days')}${icon('bell')}</div></aside></div>`,
  );
}

export function profileView(user) {
  const common = [
    'Asia/Bishkek',
    'Asia/Almaty',
    'Asia/Tashkent',
    'Europe/Moscow',
    'Europe/Kaliningrad',
    'Asia/Yekaterinburg',
    'Asia/Novosibirsk',
    'Asia/Vladivostok',
    'Europe/Berlin',
    'Europe/London',
    'America/New_York',
    'UTC',
  ];
  const timezones = [...new Set([...common, user.timezone, ...Intl.supportedValuesOf('timeZone')])];
  const joined = new Intl.DateTimeFormat('ru', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: user.timezone,
  }).format(new Date(user.created_at));
  return shell(
    user,
    'profile',
    `<div class="page-heading"><div><h1>Мой профиль</h1><p>Немного о тебе. Чтобы Семестр работал в твоём ритме.</p></div></div><div class="profile-columns"><section class="profile-panel"><div class="profile-identity"><span class="avatar avatar-large">${escape(initials(user.name))}</span><div><h2 data-user-name>${escape(user.name)}</h2><p>${escape(user.email)}</p></div><span class="account-label">Личный аккаунт</span></div><form id="profile-form" novalidate><div class="section-intro"><h2>Личные данные</h2><p>Так ты будешь отображаться в планировщике.</p></div><div class="form-alert" role="alert" hidden></div>${field('name', 'Имя', 'text', 'Как тебя зовут', `value="${escape(user.name)}" autocomplete="given-name" maxlength="100" required`)}<div class="field"><label for="profile-email">Электронная почта</label><div class="input-wrap">${icon('mail', 'input-prefix')}<input class="form-control with-prefix" id="profile-email" type="email" value="${escape(user.email)}" readonly aria-describedby="email-note">${icon('lock-keyhole', 'input-suffix')}</div><span class="field-help" id="email-note">Почта используется для входа в аккаунт.</span></div><div class="section-intro timezone-intro"><h2>Время и планирование</h2><p>Ориентируемся на твой часовой пояс.</p></div><div class="field"><label for="timezone">Часовой пояс</label><div class="input-wrap">${icon('globe-2', 'input-prefix')}<select class="form-select with-prefix" id="timezone" name="timezone" aria-describedby="timezone-error timezone-note">${timezones.map((zone) => `<option value="${escape(zone)}" ${zone === user.timezone ? 'selected' : ''}>${escape(timezoneLabel(zone))}</option>`).join('')}</select></div>${errorSlot('timezone')}<span class="field-help" id="timezone-note">Даты и время будут отображаться в выбранном часовом поясе.</span></div><div class="profile-form-footer"><span id="save-hint">Все изменения сохранены</span><div><button class="btn btn-text" type="button" data-action="reset-profile" disabled>Отменить</button><button class="btn btn-primary" type="submit" disabled>${icon('check')} Сохранить изменения</button></div></div></form></section><aside class="profile-aside"><section class="timezone-card"><span class="icon-tile">${icon('clock-3')}</span><h2>Твоё местное время</h2><div class="local-clock" id="local-clock"></div><p id="local-date"></p><div class="timezone-card-bottom">${icon('map-pin')}<span id="clock-timezone">${escape(timezoneLabel(user.timezone))}</span></div></section><section class="profile-tip">${icon('shield-check')}<h2>Только твоё</h2><p>Твой профиль видишь только ты. Пароль хранится в защищённом виде, а выход завершает текущую сессию.</p></section><div class="joined-note">В Семестре с ${joined}</div></aside></div>`,
  );
}
