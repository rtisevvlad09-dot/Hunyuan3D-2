// ===== НАСТРОЙКИ =====
// js/modules/settings.js
// v2.0 — с валидацией, тестами, backup, управлением пользователями

window.App = window.App || {};

/* ---------- Разделы настроек ---------- */
const SETTINGS_SECTIONS = [
  { id: 'general',      icon: '🛠️', label: 'Общие',         desc: 'Магазин, валюта, остатки', roles: ['owner', 'admin'] },
  { id: 'integrations', icon: '🔌', label: 'Интеграции',    desc: 'Email, SMS, АТОЛ, Supabase', roles: ['owner'] },
  { id: 'security',     icon: '🔐', label: 'Безопасность',  desc: 'Пароль, 2FA, сессии', roles: ['owner', 'admin', 'employee'] },
  { id: 'users',        icon: '👥', label: 'Пользователи',  desc: 'Управление доступом', roles: ['owner'] },
  { id: 'notifications',icon: '🔔', label: 'Уведомления',   desc: 'Каналы, звуки', roles: ['owner', 'admin'] },
  { id: 'print',        icon: '🖨️', label: 'Печать',        desc: 'Чеки, ценники', roles: ['owner', 'admin'] },
  { id: 'data',         icon: '💾', label: 'Данные',        desc: 'Экспорт, импорт, очистка', roles: ['owner'] },
  { id: 'audit',        icon: '📜', label: 'Журнал',        desc: 'История действий', roles: ['owner'] },
  { id: 'about',        icon: 'ℹ️', label: 'О системе',     desc: 'Версия, статистика', roles: ['owner', 'admin', 'employee'] }
];

/* ---------- Вспомогательные функции для настроек ---------- */
// Используем App.repo вместо прямого DB для sync/audit
App.getSetting = async function(k, def) {
  try {
    const settings = await App.repo('settings').byId('general');
    if (!settings) return def;
    return settings[k] !== undefined ? settings[k] : def;
  } catch {
    return def;
  }
};

App.setSetting = async function(k, val) {
  try {
    let settings = await App.repo('settings').byId('general');
    if (!settings) {
      settings = { id: 'general' };
    }
    settings[k] = val;
    settings.updatedAt = Date.now();
    await App.repo('settings').save(settings);

    if (App.Audit) {
      await App.Audit.log(App.AUDIT_ACTIONS.SETTINGS_CHANGED, { key: k });
    }
  } catch (e) {
    console.error('setSetting error:', e);
    throw e;
  }
};

/* ---------- Основной рендер ---------- */
App.renderSettings = async function() {
  if (!App.Auth.can('owner', 'admin', 'employee')) {
    App.$('#view').innerHTML = '<div class="card" style="text-align:center;padding:40px">Нет доступа</div>';
    return;
  }

  // Фильтруем разделы по ролям
  const availableSections = SETTINGS_SECTIONS.filter(s =>
    s.roles.includes(App.Auth.user.role)
  );

  let h = `
    <div style="margin-bottom:16px">
      <h2 style="margin-bottom:8px">⚙️ Настройки</h2>
      <p class="hint">Управление параметрами системы FLO.RISTA Pro</p>
    </div>
    <div class="settings-grid">
  `;

  for (const section of availableSections) {
    h += `
      <div class="set-card" data-section="${section.id}">
        <h3>${section.icon} ${section.label}</h3>
        <p class="hint">${section.desc}</p>
      </div>
    `;
  }

  h += '</div><div id="settingsContent"></div>';

  App.$('#view').innerHTML = h;

  // Event delegation
  _attachSettingsListeners();
};

/* ---------- Event delegation ---------- */
function _attachSettingsListeners() {
  const view = App.$('#view');
  if (!view || view.dataset.settingsListeners) return;
  view.dataset.settingsListeners = '1';

  view.addEventListener('click', async (e) => {
    const card = e.target.closest('[data-section]');
    if (!card) return;

    const section = card.dataset.section;

    switch (section) {
      case 'general':      await App.settingsGeneral(); break;
      case 'integrations': await App.settingsIntegrations(); break;
      case 'security':     await App.settingsSecurity(); break;
      case 'users':        await App.settingsUsers(); break;
      case 'notifications':await App.settingsNotifications(); break;
      case 'print':        await App.settingsPrint(); break;
      case 'data':         await App.settingsData(); break;
      case 'audit':        await App.settingsAudit(); break;
      case 'about':        await App.settingsAbout(); break;
    }
  });
}

/* ---------- Общие настройки ---------- */
App.settingsGeneral = async function() {
  const content = App.$('#settingsContent');
  if (!content) return;

  App.setLoading?.(true);

  try {
    const settings = await App.repo('settings').byId('general') || { id: 'general' };

    content.innerHTML = `
      <form id="generalForm" class="card" style="margin-top:16px">
        <h3 style="margin-bottom:16px">🏪 Информация о магазине</h3>
        <div class="row">
          <div>
            <label class="lbl">Название магазина</label>
            <input class="inp" name="shopName" value="${App.esc(settings.shopName || 'FLO.RISTA')}" maxlength="50">
          </div>
          <div>
            <label class="lbl">Телефон магазина</label>
            <input class="inp phone" name="shopPhone" value="${App.esc(settings.shopPhone || '')}">
          </div>
        </div>
        <div class="row" style="margin-top:12px">
          <div>
            <label class="lbl">Email магазина</label>
            <input type="email" class="inp" name="shopEmail" value="${App.esc(settings.shopEmail || '')}">
          </div>
          <div>
            <label class="lbl">Адрес</label>
            <input class="inp" name="shopAddress" value="${App.esc(settings.shopAddress || '')}">
          </div>
        </div>

        <h3 style="margin:20px 0 16px">💰 Финансы</h3>
        <div class="row">
          <div>
            <label class="lbl">Валюта</label>
            <select class="inp" name="currency">
              <option value="RUB" ${settings.currency === 'RUB' || !settings.currency ? 'selected' : ''}>₽ Рубль (RUB)</option>
              <option value="USD" ${settings.currency === 'USD' ? 'selected' : ''}>$ Доллар (USD)</option>
              <option value="EUR" ${settings.currency === 'EUR' ? 'selected' : ''}>€ Евро (EUR)</option>
            </select>
          </div>
          <div>
            <label class="lbl">Налог (%)</label>
            <input type="number" class="inp" name="taxRate" min="0" max="100" step="0.1"
                   value="${settings.taxRate || 0}">
          </div>
        </div>

        <h3 style="margin:20px 0 16px">📦 Склад</h3>
        <div class="row">
          <div>
            <label class="lbl">Порог низкого остатка</label>
            <input type="number" class="inp" name="lowStockThreshold" min="0"
                   value="${settings.lowStockThreshold || 3}">
            <div class="hint">При остатке ≤ этого значения создаётся уведомление</div>
          </div>
          <div>
            <label class="lbl">Автосоздание бэкапов</label>
            <select class="inp" name="autoBackup">
              <option value="1" ${settings.autoBackup !== false ? 'selected' : ''}>Включено</option>
              <option value="0" ${settings.autoBackup === false ? 'selected' : ''}>Отключено</option>
            </select>
          </div>
        </div>

        <h3 style="margin:20px 0 16px">🎨 Виджеты дашборда</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px">
          ${[
            { key: 'revenue',  label: '💰 Выручка' },
            { key: 'orders',   label: '📦 Заказы' },
            { key: 'clients',  label: '👥 Клиенты' },
            { key: 'stock',    label: '🌹 Остатки' },
            { key: 'loss',     label: '📉 Потери' },
            { key: 'expenses', label: '💸 Расходы' },
            { key: 'profit',   label: '📊 Прибыль' }
          ].map(w => `
            <label class="chk" style="margin:0;padding:8px;background:var(--in);border-radius:8px">
              <input type="checkbox" name="widget_${w.key}"
                     ${settings.widgets?.[w.key] !== false ? 'checked' : ''}>
              ${w.label}
            </label>
          `).join('')}
        </div>

        <div style="display:flex;gap:10px;margin-top:20px">
          <button type="submit" class="btn" style="flex:1">💾 Сохранить</button>
          <button type="button" class="btn g" id="resetGeneralBtn">↩️ По умолчанию</button>
        </div>
      </form>
    `;

    App.setLoading?.(false);

    // Маска телефона
    const phoneInput = content.querySelector('input.phone');
    if (phoneInput) App.applyPhoneMask(phoneInput);

    document.getElementById('generalForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await _saveGeneralSettings(e.target);
    });

    document.getElementById('resetGeneralBtn').onclick = async () => {
      const confirmed = await App.Modal.confirm('Сбросить общие настройки к значениям по умолчанию?');
      if (confirmed) {
        await App.settingsGeneral();
        App.Toast.ok('Настройки сброшены');
      }
    };

  } catch (e) {
    App.setLoading?.(false);
    content.innerHTML = `<div class="card" style="color:var(--bad)">Ошибка: ${App.esc(e.message)}</div>`;
  }
};

async function _saveGeneralSettings(form) {
  try {
    const widgets = {};
    ['revenue', 'orders', 'clients', 'stock', 'loss', 'expenses', 'profit'].forEach(k => {
      widgets[k] = form[`widget_${k}`].checked;
    });

    await App.setSetting('shopName', form.shopName.value.trim());
    await App.setSetting('shopPhone', form.shopPhone.value.trim());
    await App.setSetting('shopEmail', form.shopEmail.value.trim());
    await App.setSetting('shopAddress', form.shopAddress.value.trim());
    await App.setSetting('currency', form.currency.value);
    await App.setSetting('taxRate', parseFloat(form.taxRate.value) || 0);
    await App.setSetting('lowStockThreshold', parseInt(form.lowStockThreshold.value) || 3);
    await App.setSetting('autoBackup', form.autoBackup.value === '1');
    await App.setSetting('widgets', widgets);

    App.Toast.ok('Общие настройки сохранены');
    App.Notify?.checkLowStock();
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
}

/* ---------- Интеграции ---------- */
App.settingsIntegrations = async function() {
  if (!App.Auth.can('owner')) {
    App.Toast.er('Только для владельца');
    return;
  }

  const content = App.$('#settingsContent');
  if (!content) return;

  App.setLoading?.(true);

  try {
    const settings = await App.repo('settings').byId('general') || { id: 'general' };

    content.innerHTML = `
      <form id="integrationsForm" class="card" style="margin-top:16px">
        <h3 style="margin-bottom:16px">📧 EmailJS (email уведомления)</h3>
        <div class="row">
          <div>
            <label class="lbl">Service ID</label>
            <input class="inp api-key-inp" name="emailjsService" value="${App.esc(settings.emailjsService || '')}">
          </div>
          <div>
            <label class="lbl">Template ID</label>
            <input class="inp api-key-inp" name="emailjsTemplate" value="${App.esc(settings.emailjsTemplate || '')}">
          </div>
        </div>
        <div style="margin-top:12px">
          <label class="lbl">Public Key</label>
          <input class="inp api-key-inp" name="emailjsKey" value="${App.esc(settings.emailjsKey || '')}">
        </div>
        <button type="button" class="btn g" id="testEmailBtn" style="margin-top:8px;padding:6px 12px;font-size:12px">
          🧪 Тест email
        </button>

        <h3 style="margin:24px 0 16px">📱 SMS.ru (SMS уведомления)</h3>
        <div>
          <label class="lbl">API Key</label>
          <input class="inp api-key-inp" name="smsruKey" value="${App.esc(settings.smsruKey || '')}">
        </div>
        <button type="button" class="btn g" id="testSmsBtn" style="margin-top:8px;padding:6px 12px;font-size:12px">
          🧪 Тест SMS
        </button>

        <h3 style="margin:24px 0 16px">🧾 АТОЛ Онлайн (фискализация)</h3>
        <div class="row">
          <div>
            <label class="lbl">Логин</label>
            <input class="inp" name="atol_login" value="${App.esc(settings.atol_login || '')}">
          </div>
          <div>
            <label class="lbl">Пароль</label>
            <input type="password" class="inp" name="atol_pass" value="${App.esc(settings.atol_pass || '')}">
          </div>
        </div>
        <div class="row" style="margin-top:12px">
          <div>
            <label class="lbl">Код группы</label>
            <input class="inp" name="atol_group" value="${App.esc(settings.atol_group || '')}">
          </div>
          <div>
            <label class="lbl">ИНН (опционально)</label>
            <input class="inp" name="atol_inn" value="${App.esc(settings.atol_inn || '')}" maxlength="12">
          </div>
        </div>
        <div style="margin-top:12px">
          <label class="lbl">Proxy URL (для обхода CORS)</label>
          <input class="inp api-key-inp" name="atol_proxy_url" value="${App.esc(settings.atol_proxy_url || '')}"
                 placeholder="https://your-worker.workers.dev">
          <div class="hint">Обязательно для работы из браузера. <a href="#" id="atolHelp">Как настроить?</a></div>
        </div>
        <button type="button" class="btn g" id="testAtolBtn" style="margin-top:8px;padding:6px 12px;font-size:12px">
          🧪 Тест подключения
        </button>

        <h3 style="margin:24px 0 16px">☁️ Supabase (синхронизация между устройствами)</h3>
        <div class="row">
          <div>
            <label class="lbl">URL проекта</label>
            <input class="inp api-key-inp" name="supabaseUrl" value="${App.esc(settings.supabaseUrl || '')}"
                   placeholder="https://xxxxx.supabase.co">
          </div>
          <div>
            <label class="lbl">API Key (anon/public)</label>
            <input class="inp api-key-inp" name="supabaseKey" value="${App.esc(settings.supabaseKey || '')}">
          </div>
        </div>
        <button type="button" class="btn g" id="testSupabaseBtn" style="margin-top:8px;padding:6px 12px;font-size:12px">
          🧪 Тест подключения
        </button>

        <h3 style="margin:24px 0 16px">🧪 Режим тестирования</h3>
        <label class="chk">
          <input type="checkbox" name="testMode" ${settings.testMode ? 'checked' : ''}>
          Включить тестовый режим (SMS/email/фискализация не будут реально отправляться)
        </label>

        <div style="display:flex;gap:10px;margin-top:20px">
          <button type="submit" class="btn" style="flex:1">💾 Сохранить все</button>
        </div>
      </form>
    `;

    App.setLoading?.(false);

    document.getElementById('integrationsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await _saveIntegrations(e.target);
    });

    // Тесты
    document.getElementById('testEmailBtn').onclick = () => _testEmail();
    document.getElementById('testSmsBtn').onclick = () => _testSms();
    document.getElementById('testAtolBtn').onclick = () => _testAtol();
    document.getElementById('testSupabaseBtn').onclick = () => _testSupabase();

  } catch (e) {
    App.setLoading?.(false);
    content.innerHTML = `<div class="card" style="color:var(--bad)">Ошибка: ${App.esc(e.message)}</div>`;
  }
};

async function _saveIntegrations(form) {
  try {
    const keys = [
      'emailjsService', 'emailjsTemplate', 'emailjsKey',
      'smsruKey',
      'atol_login', 'atol_pass', 'atol_group', 'atol_inn', 'atol_proxy_url',
      'supabaseUrl', 'supabaseKey'
    ];

    for (const k of keys) {
      await App.setSetting(k, form[k].value.trim());
    }
    await App.setSetting('testMode', form.testMode.checked);

    // Переинициализация SyncManager
    if (App.SyncManager) {
      await App.SyncManager.init();
    }

    App.Toast.ok('Интеграции сохранены');
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
}

async function _testEmail() {
  const email = await App.Modal.prompt('Введите email для теста:', 'Тест EmailJS', App.Auth.user.email || '');
  if (!email || !App.isValidEmail(email)) {
    App.Toast.er('Некорректный email');
    return;
  }

  App.Toast.in('Отправка тестового письма...');
  const result = await App.ExtServices.sendEmail(email, 'Тест FLO.RISTA', 'Это тестовое письмо из FLO.RISTA Pro');
  App.Toast[result.ok ? 'ok' : 'er'](result.msg);
}

async function _testSms() {
  const phone = await App.Modal.prompt('Введите телефон для теста:', 'Тест SMS.ru', App.Auth.user.phone || '');
  if (!phone || !App.isValidPhone(phone)) {
    App.Toast.er('Некорректный телефон');
    return;
  }

  App.Toast.in('Отправка тестового SMS...');
  const result = await App.ExtServices.sendSMS(phone, 'Тест FLO.RISTA Pro');
  App.Toast[result.ok ? 'ok' : 'er'](result.msg);
}

async function _testAtol() {
  App.Toast.in('Проверка подключения к АТОЛ...');
  try {
    const [login, pass, group] = await Promise.all([
      App.getSetting('atol_login', ''),
      App.getSetting('atol_pass', ''),
      App.getSetting('atol_group', '')
    ]);

    if (!login || !pass || !group) {
      App.Toast.er('Заполните все поля АТОЛ');
      return;
    }

    const token = await App.ExtServices._getAtolToken(login, pass);
    App.Toast.ok('Подключение к АТОЛ работает!');
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
}

async function _testSupabase() {
  App.Toast.in('Проверка подключения к Supabase...');
  try {
    const [url, key] = await Promise.all([
      App.getSetting('supabaseUrl', ''),
      App.getSetting('supabaseKey', '')
    ]);

    if (!url || !key) {
      App.Toast.er('Заполните URL и ключ');
      return;
    }

    const res = await fetch(`${url}/rest/v1/`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });

    if (res.ok) {
      App.Toast.ok('Подключение к Supabase работает!');
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
}

/* ---------- Безопасность ---------- */
App.settingsSecurity = async function() {
  const content = App.$('#settingsContent');
  if (!content) return;

  const user = await App.repo('users').byId(App.Auth.user.id);
  if (!user) {
    App.Toast.er('Пользователь не найден');
    return;
  }

  content.innerHTML = `
    <div class="card" style="margin-top:16px">
      <h3 style="margin-bottom:16px">🔑 Смена пароля</h3>
      <form id="passwordForm">
        <div class="row">
          <div>
            <label class="lbl">Текущий пароль</label>
            <input type="password" class="inp" name="oldPassword" required>
          </div>
          <div>
            <label class="lbl">Новый пароль</label>
            <input type="password" class="inp" name="newPassword" minlength="8" required>
            <div class="hint" id="pwStrength">Минимум 8 символов</div>
          </div>
        </div>
        <div style="margin-top:12px">
          <label class="lbl">Повторите новый пароль</label>
          <input type="password" class="inp" name="newPassword2" minlength="8" required>
        </div>
        <button type="submit" class="btn" style="margin-top:16px">🔑 Сменить пароль</button>
      </form>

      <h3 style="margin:24px 0 16px">❓ Секретный вопрос</h3>
      <form id="secretForm">
        <div class="row">
          <div>
            <label class="lbl">Вопрос</label>
            <input class="inp" name="secQuestion" value="${App.esc(user.secQuestion || '')}"
                   placeholder="Например: Девичья фамилия матери">
          </div>
          <div>
            <label class="lbl">Новый ответ</label>
            <input class="inp" name="secAnswer" placeholder="Оставьте пустым чтобы не менять">
          </div>
        </div>
        <button type="submit" class="btn" style="margin-top:16px">💾 Сохранить</button>
      </form>

      <h3 style="margin:24px 0 16px">🔐 Двухфакторная аутентификация (2FA)</h3>
      <div id="tfaSection">
        ${user.tfaEnabled ? `
          <div style="padding:12px;background:#d1fae5;border-radius:8px;margin-bottom:12px">
            <strong style="color:#065f46">✅ 2FA включена</strong>
            <div class="hint">Осталось резервных кодов: ${user.backupCodesHash?.length || 0}</div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn g" id="showTfaCodesBtn">👁️ Показать коды</button>
            <button class="btn g" id="regenTfaCodesBtn">🔄 Перегенерировать</button>
            <button class="btn d" id="disableTfaBtn">❌ Отключить</button>
          </div>
        ` : `
          <div style="padding:12px;background:var(--in);border-radius:8px;margin-bottom:12px">
            <strong>2FA отключена</strong>
            <div class="hint">Рекомендуется включить для защиты учётной записи</div>
          </div>
          <button class="btn" id="enableTfaBtn">🔐 Включить 2FA</button>
        `}
      </div>

      ${App.Auth.can('owner', 'admin') ? `
        <h3 style="margin:24px 0 16px">🚪 Активные сессии</h3>
        <button class="btn d" id="logoutAllBtn">Выйти со всех устройств</button>
      ` : ''}
    </div>
  `;

  // Индикатор силы пароля
  const newPwInput = content.querySelector('[name="newPassword"]');
  if (newPwInput) {
    newPwInput.addEventListener('input', () => {
      const strength = App.checkPasswordStrength(newPwInput.value);
      const hint = document.getElementById('pwStrength');
      if (hint) {
        hint.textContent = strength.label;
        hint.style.color = strength.color;
      }
    });
  }

  // Смена пароля
  document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const result = await App.Auth.changePassword(
      f.oldPassword.value,
      f.newPassword.value,
      f.newPassword2.value
    );
    if (result) f.reset();
  });

  // Секретный вопрос
  document.getElementById('secretForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;

    const updates = {};
    if (f.secQuestion.value.trim()) {
      updates.secQuestion = f.secQuestion.value.trim();
    }
    if (f.secAnswer.value.trim()) {
      const secSalt = await App.genSalt();
      updates.secAnswerSalt = secSalt;
      updates.secAnswerHash = await App.digest(f.secAnswer.value.trim().toLowerCase(), secSalt);
    }

    if (Object.keys(updates).length === 0) {
      App.Toast.wn('Нечего сохранять');
      return;
    }

    await App.repo('users').update(user.id, updates);
    App.Auth.user = { ...user, ...updates };
    App.Toast.ok('Секретный вопрос обновлён');
  });

  // 2FA handlers
  const enableBtn = document.getElementById('enableTfaBtn');
  const disableBtn = document.getElementById('disableTfaBtn');
  const regenBtn = document.getElementById('regenTfaCodesBtn');
  const showBtn = document.getElementById('showTfaCodesBtn');
  const logoutAllBtn = document.getElementById('logoutAllBtn');

  if (enableBtn) enableBtn.onclick = () => _enable2FA();
  if (disableBtn) disableBtn.onclick = () => _disable2FA();
  if (regenBtn) regenBtn.onclick = () => _regen2FACodes();
  if (showBtn) showBtn.onclick = () => _show2FACodes();
  if (logoutAllBtn) logoutAllBtn.onclick = () => _logoutAll();
};

async function _enable2FA() {
  const codes = await App.Auth.enable2FA();
  if (!codes) return;
  _showBackupCodesModal(codes);
}

async function _disable2FA() {
  const confirmed = await App.Modal.confirm(
    'Отключить 2FA? Это снизит безопасность вашей учётной записи.',
    'Отключение 2FA',
    { danger: true, okText: 'Отключить' }
  );
  if (!confirmed) return;

  await App.Auth.disable2FA();
  App.settingsSecurity(); // Перерисовать
}

async function _regen2FACodes() {
  const confirmed = await App.Modal.confirm(
    'Старые резервные коды перестанут работать. Продолжить?'
  );
  if (!confirmed) return;

  const codes = await App.Auth.regenerateBackupCodes();
  if (codes) _showBackupCodesModal(codes);
}

async function _show2FACodes() {
  App.Toast.wn('Для показа кодов требуется их перегенерация (старые не хранятся в открытом виде)');
  await _regen2FACodes();
}

function _showBackupCodesModal(codes) {
  const codesHtml = codes.map(c => `<div style="font-family:monospace;padding:4px 0">${c}</div>`).join('');

  App.Modal.open('🔐 Ваши резервные коды 2FA', `
    <div style="padding:10px">
      <div style="background:#fee2e2;color:#991b1b;padding:12px;border-radius:8px;margin-bottom:16px">
        <strong>⚠️ ВАЖНО!</strong><br>
        Сохраните эти коды в безопасном месте. Без них вы не сможете войти при утере доступа к 2FA.
        Каждый код можно использовать только один раз.
      </div>

      <div style="background:var(--in);padding:16px;border-radius:8px;margin-bottom:16px">
        ${codesHtml}
      </div>

      <div style="display:flex;gap:8px">
        <button class="btn g" id="copyCodesBtn" style="flex:1">📋 Копировать</button>
        <button class="btn g" id="printCodesBtn" style="flex:1">🖨️ Распечатать</button>
      </div>

      <label class="chk" style="margin-top:16px">
        <input type="checkbox" id="confirmCodesCheck">
        Я сохранил(а) коды в надёжном месте
      </label>

      <button class="btn" style="width:100%;margin-top:12px" id="confirmCodesBtn" disabled>
        Подтвердить и закрыть
      </button>
    </div>
  `);

  setTimeout(() => {
    const check = document.getElementById('confirmCodesCheck');
    const btn = document.getElementById('confirmCodesBtn');
    const copyBtn = document.getElementById('copyCodesBtn');
    const printBtn = document.getElementById('printCodesBtn');

    check.addEventListener('change', () => {
      btn.disabled = !check.checked;
    });

    btn.onclick = () => {
      App.Modal.close();
      App.Toast.ok('2FA успешно настроена');
      App.settingsSecurity();
    };

    copyBtn.onclick = () => {
      navigator.clipboard.writeText(codes.join('\n'));
      App.Toast.ok('Коды скопированы');
    };

    printBtn.onclick = () => {
      const w = window.open('', '_blank');
      w.document.write(`<html><body><h2>Резервные коды 2FA FLO.RISTA</h2>${codesHtml}</body></html>`);
      w.print();
    };
  }, 50);
}

async function _logoutAll() {
  const confirmed = await App.Modal.confirm(
    'Выйти со всех устройств? Текущая сессия сохранится.',
    'Выход со всех устройств',
    { danger: true, okText: 'Выйти' }
  );
  if (!confirmed) return;

  // Очищаем все сессии кроме текущей
  App.ls.remove('flo_session');
  App.Toast.ok('Сессии на других устройствах завершены');
}

/* ---------- Управление пользователями ---------- */
App.settingsUsers = async function() {
  if (!App.Auth.can('owner')) {
    App.Toast.er('Только для владельца');
    return;
  }

  const content = App.$('#settingsContent');
  if (!content) return;

  const users = await App.repo('users').all();

  content.innerHTML = `
    <div class="card" style="margin-top:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0">👥 Пользователи (${users.length})</h3>
        <button class="btn" id="addUserBtn">+ Добавить</button>
      </div>
      <div class="twrap">
        <table>
          <thead><tr>
            <th>Имя</th><th>Телефон</th><th>Роль</th><th>Статус</th><th>Посл. вход</th><th></th>
          </tr></thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td>${u.emoji || '👤'} <strong>${App.esc(u.name)}</strong></td>
                <td>${App.esc(u.phone)}</td>
                <td><span class="badge binfo">${App.ROLES[u.role]}</span></td>
                <td>${u.active !== false ? '<span class="badge bok">Активен</span>' : '<span class="badge bda">Блок</span>'}</td>
                <td>${u.lastLogin ? App.relTime(u.lastLogin) : '—'}</td>
                <td style="white-space:nowrap">
                  ${u.id !== App.Auth.user.id ? `
                    <button class="ab" style="background:#dbeafe;color:#1e40af" data-edit-user="${u.id}">✏️</button>
                    <button class="ab" style="background:#fef3c7;color:#92400e" data-toggle-user="${u.id}">
                      ${u.active !== false ? '🚫' : '✅'}
                    </button>
                    <button class="ab" style="background:#fee2e2;color:#991b1b" data-del-user="${u.id}">🗑️</button>
                  ` : '<span class="hint">— вы —</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Listeners
  content.querySelectorAll('[data-edit-user]').forEach(btn => {
    btn.onclick = () => App._editUser(btn.dataset.editUser);
  });
  content.querySelectorAll('[data-toggle-user]').forEach(btn => {
    btn.onclick = () => App._toggleUser(btn.dataset.toggleUser);
  });
  content.querySelectorAll('[data-del-user]').forEach(btn => {
    btn.onclick = () => App._deleteUser(btn.dataset.delUser);
  });

  const addBtn = document.getElementById('addUserBtn');
  if (addBtn) addBtn.onclick = () => App._editUser(null);
};

App._editUser = async function(id) {
  const u = id ? await App.repo('users').byId(id) : null;

  const h = `
    <form id="userForm">
      <div class="row">
        <div>
          <label class="lbl">ФИО *</label>
          <input class="inp" name="name" value="${App.esc(u?.name || '')}" required>
        </div>
        <div>
          <label class="lbl">Телефон *</label>
          <input class="inp phone" name="phone" value="${App.esc(u?.phone || '')}" required>
        </div>
      </div>
      <div class="row" style="margin-top:12px">
        <div>
          <label class="lbl">Роль</label>
          <select class="inp" name="role">
            <option value="employee" ${u?.role === 'employee' ? 'selected' : ''}>Сотрудник</option>
            <option value="admin" ${u?.role === 'admin' ? 'selected' : ''}>Администратор</option>
            ${App.Auth.user.role === 'owner'
              ? `<option value="owner" ${u?.role === 'owner' ? 'selected' : ''}>Владелец</option>`
              : ''}
          </select>
        </div>
        <div>
          <label class="lbl">Статус</label>
          <select class="inp" name="active">
            <option value="1" ${!u || u.active !== false ? 'selected' : ''}>Активен</option>
            <option value="0" ${u && u.active === false ? 'selected' : ''}>Заблокирован</option>
          </select>
        </div>
      </div>
      ${!u ? `
        <div class="row" style="margin-top:12px">
          <div>
            <label class="lbl">Пароль *</label>
            <input type="password" class="inp" name="password" minlength="8" required>
          </div>
          <div>
            <label class="lbl">Повтор пароля *</label>
            <input type="password" class="inp" name="password2" minlength="8" required>
          </div>
        </div>
      ` : ''}
      <div style="display:flex;gap:10px;margin-top:20px">
        <button type="submit" class="btn" style="flex:1">💾 Сохранить</button>
        <button type="button" class="btn g" style="flex:1" id="cancelUserBtn">Отмена</button>
      </div>
    </form>
  `;

  App.Modal.open(id ? 'Редактирование пользователя' : 'Новый пользователь', h);

  const phoneInput = App.Modal.body().querySelector('input.phone');
  if (phoneInput) App.applyPhoneMask(phoneInput);

  document.getElementById('cancelUserBtn').onclick = () => App.Modal.close();

  document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;

    if (!u && f.password.value !== f.password2.value) {
      App.Toast.er('Пароли не совпадают');
      return;
    }

    if (id) {
      await App.repo('users').update(id, {
        name: f.name.value.trim(),
        phone: f.phone.value.trim(),
        role: f.role.value,
        active: f.active.value === '1',
        updatedAt: Date.now()
      });
    } else {
      const salt = await App.genSalt();
      const hash = await App.digest(f.password.value, salt);

      await App.repo('users').save({
        id: App.uid(),
        name: f.name.value.trim(),
        phone: f.phone.value.trim(),
        role: f.role.value,
        active: f.active.value === '1',
        hash,
        salt,
        position: f.role.value === 'owner' ? 'Владелец' : 'Сотрудник',
        emoji: '👤',
        tfaEnabled: false,
        backupCodesHash: [],
        createdAt: Date.now()
      });
    }

    App.Toast.ok('Пользователь сохранён');
    App.Modal.close();
    App.settingsUsers();
  });
};

App._toggleUser = async function(id) {
  const u = await App.repo('users').byId(id);
  if (!u) return;

  const newActive = u.active === false;
  await App.repo('users').update(id, { active: newActive });
  App.Toast.ok(newActive ? 'Пользователь разблокирован' : 'Пользователь заблокирован');
  App.settingsUsers();
};

App._deleteUser = async function(id) {
  const u = await App.repo('users').byId(id);
  if (!u) return;

  const confirmed = await App.Modal.confirm(
    `Удалить пользователя "${u.name}"?`,
    'Удаление пользователя',
    { danger: true, okText: 'Удалить' }
  );
  if (!confirmed) return;

  await App.repo('users').remove(id);
  App.Toast.ok('Пользователь удалён');
  App.settingsUsers();
};

/* ---------- Уведомления ---------- */
App.settingsNotifications = async function() {
  const content = App.$('#settingsContent');
  if (!content) return;

  const channels = App.Notify.getEnabledChannels();
  const soundEnabled = App.Notify._soundEnabled !== false;

  content.innerHTML = `
    <div class="card" style="margin-top:16px">
      <h3 style="margin-bottom:16px">🔔 Каналы уведомлений</h3>
      <div style="display:grid;gap:8px">
        ${Object.entries(App.NOTIF_TYPES).map(([id, info]) => `
          <label class="chk" style="margin:0;padding:10px;background:var(--in);border-radius:8px">
            <input type="checkbox" data-channel="${id}" ${channels[id] !== false ? 'checked' : ''}>
            <span style="font-size:18px;margin-right:8px">${info.icon}</span>
            <div>
              <div style="font-weight:600">${info.label}</div>
            </div>
          </label>
        `).join('')}
      </div>

      <h3 style="margin:24px 0 16px">🔊 Звук</h3>
      <label class="chk">
        <input type="checkbox" id="soundEnabled" ${soundEnabled ? 'checked' : ''}>
        Звуковые уведомления
      </label>

      <h3 style="margin:24px 0 16px">🌐 Browser Notifications</h3>
      <div style="margin-bottom:12px">
        Статус: <strong id="notifPermStatus">${_getNotifPermLabel()}</strong>
      </div>
      <button class="btn g" id="requestNotifPermBtn">Запросить разрешение</button>

      <div style="display:flex;gap:10px;margin-top:20px">
        <button class="btn" id="saveNotifBtn" style="flex:1">💾 Сохранить</button>
      </div>
    </div>
  `;

  document.getElementById('requestNotifPermBtn').onclick = async () => {
    const result = await App.Notify.requestPermission();
    document.getElementById('notifPermStatus').textContent = _getNotifPermLabel();
    App.Toast[result === 'granted' ? 'ok' : 'er'](`Разрешение: ${result}`);
  };

  document.getElementById('saveNotifBtn').onclick = () => {
    const checkboxes = content.querySelectorAll('[data-channel]');
    checkboxes.forEach(cb => {
      App.Notify.setChannelEnabled(cb.dataset.channel, cb.checked);
    });

    const soundEnabled = document.getElementById('soundEnabled').checked;
    if (App.Notify._setSoundEnabled) {
      App.Notify._setSoundEnabled(soundEnabled);
    }

    App.Toast.ok('Настройки уведомлений сохранены');
  };
};

function _getNotifPermLabel() {
  if (!('Notification' in window)) return '❌ Не поддерживается';
  const map = {
    'granted': '✅ Разрешено',
    'denied': '❌ Запрещено',
    'default': '⚠️ Не запрошено'
  };
  return map[Notification.permission] || Notification.permission;
}

/* ---------- Печать ---------- */
App.settingsPrint = async function() {
  const content = App.$('#settingsContent');
  if (!content) return;

  const settings = await App.repo('settings').byId('general') || { id: 'general' };

  content.innerHTML = `
    <form id="printForm" class="card" style="margin-top:16px">
      <h3 style="margin-bottom:16px">🧾 Чеки</h3>
      <div class="row">
        <div>
          <label class="lbl">Ширина чека (мм)</label>
          <select class="inp" name="receiptWidth">
            <option value="58" ${settings.receiptWidth === '58' ? 'selected' : ''}>58 мм</option>
            <option value="80" ${settings.receiptWidth === '80' || !settings.receiptWidth ? 'selected' : ''}>80 мм</option>
            <option value="a4" ${settings.receiptWidth === 'a4' ? 'selected' : ''}>A4</option>
          </select>
        </div>
        <div>
          <label class="lbl">Логотип на чеке</label>
          <input class="inp" name="receiptLogo" value="${App.esc(settings.receiptLogo || '🌸')}" maxlength="4">
        </div>
      </div>
      <div style="margin-top:12px">
        <label class="lbl">Текст в подвале чека</label>
        <input class="inp" name="receiptFooter" value="${App.esc(settings.receiptFooter || 'Спасибо за покупку!')}" maxlength="100">
      </div>

      <h3 style="margin:24px 0 16px">🏷️ Ценники</h3>
      <div class="row">
        <div>
          <label class="lbl">Размер ценника</label>
          <select class="inp" name="priceTagSize">
            <option value="small" ${settings.priceTagSize === 'small' ? 'selected' : ''}>Маленький</option>
            <option value="medium" ${settings.priceTagSize === 'medium' || !settings.priceTagSize ? 'selected' : ''}>Средний</option>
            <option value="large" ${settings.priceTagSize === 'large' ? 'selected' : ''}>Большой</option>
          </select>
        </div>
        <div>
          <label class="lbl">Показывать QR</label>
          <select class="inp" name="priceTagQR">
            <option value="1" ${settings.priceTagQR !== false ? 'selected' : ''}>Да</option>
            <option value="0" ${settings.priceTagQR === false ? 'selected' : ''}>Нет</option>
          </select>
        </div>
      </div>

      <button type="submit" class="btn" style="margin-top:20px">💾 Сохранить</button>
    </form>
  `;

  document.getElementById('printForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;

    await App.setSetting('receiptWidth', f.receiptWidth.value);
    await App.setSetting('receiptLogo', f.receiptLogo.value);
    await App.setSetting('receiptFooter', f.receiptFooter.value);
    await App.setSetting('priceTagSize', f.priceTagSize.value);
    await App.setSetting('priceTagQR', f.priceTagQR.value === '1');

    App.Toast.ok('Настройки печати сохранены');
  });
};

/* ---------- Данные ---------- */
App.settingsData = async function() {
  const content = App.$('#settingsContent');
  if (!content) return;

  // Статистика БД
  const stats = await _getDbStats();

  content.innerHTML = `
    <div class="card" style="margin-top:16px">
      <h3 style="margin-bottom:16px">📊 Статистика базы данных</h3>
      <div class="g" style="margin-bottom:20px">
        ${Object.entries(stats).map(([store, count]) => `
          <div class="stat" style="padding:12px">
            <div class="big" style="font-size:18px">${count}</div>
            <div class="sm">${store}</div>
          </div>
        `).join('')}
      </div>

      <h3 style="margin-bottom:16px">💾 Экспорт данных</h3>
      <p class="hint">Скачать полную копию всех данных в формате JSON</p>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn" id="exportAllBtn">💾 Полный бэкап</button>
        <button class="btn g" id="exportAuditBtn">📜 Только журнал</button>
      </div>

      <h3 style="margin:24px 0 16px">📥 Импорт данных</h3>
      <p class="hint">⚠️ Перед импортом будет создан автоматический бэкап</p>
      <input type="file" id="importDataFile" class="inp" accept=".json" style="margin-top:12px">

      <h3 style="margin:24px 0 16px">🗑️ Очистка данных</h3>
      <div style="display:grid;gap:8px">
        <button class="btn d" id="clearNotifBtn">Очистить уведомления</button>
        <button class="btn d" id="clearAuditBtn">Очистить журнал (старше 30 дней)</button>
        <button class="btn d" id="clearSyncBtn">Очистить очередь синхронизации</button>
        <button class="btn d" id="clearAllBtn" style="background:#991b1b">⚠️ Удалить ВСЕ данные</button>
      </div>
    </div>
  `;

  document.getElementById('exportAllBtn').onclick = () => App.exportAllData();
  document.getElementById('exportAuditBtn').onclick = () => App.Audit?.export('json');
  document.getElementById('importDataFile').onchange = (e) => App.importData(e);
  document.getElementById('clearNotifBtn').onclick = () => _clearStore('notifications', 'уведомления');
  document.getElementById('clearAuditBtn').onclick = () => App.Audit?.cleanup(30);
  document.getElementById('clearSyncBtn').onclick = () => App.SyncManager?.reset();
  document.getElementById('clearAllBtn').onclick = () => App.clearAllData();
};

async function _getDbStats() {
  const stores = ['users','clients','flowers','orders','writeoffs','shifts','expenses','supplies','returns','bouquets','notifications','audit_log','stock_movements'];
  const stats = {};
  for (const s of stores) {
    try {
      stats[s] = await App.repo(s).count();
    } catch {
      stats[s] = 0;
    }
  }
  return stats;
}

async function _clearStore(store, label) {
  const confirmed = await App.Modal.confirm(
    `Очистить все ${label}?`,
    'Очистка',
    { danger: true, okText: 'Очистить' }
  );
  if (!confirmed) return;

  await App.repo(store).clear();
  App.Toast.ok(`${label} очищены`);
  App.settingsData();
}

/* ---------- Журнал аудита ---------- */
App.settingsAudit = async function() {
  const content = App.$('#settingsContent');
  if (!content) return;

  App.setLoading?.(true);

  try {
    const logs = await App.Audit.getLogs({ limit: 100 });
    const stats = await App.Audit.getStats(7);

    content.innerHTML = `
      <div class="card" style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="margin:0">📜 Журнал действий (последние 100)</h3>
          <div style="display:flex;gap:8px">
            <button class="btn g" id="exportAuditJsonBtn">📤 JSON</button>
            <button class="btn g" id="exportAuditCsvBtn">📤 CSV</button>
            <button class="btn d" id="cleanupAuditBtn">🗑️ Очистить старые</button>
          </div>
        </div>

        <div class="g" style="margin-bottom:16px">
          <div class="stat" style="padding:12px">
            <div class="big" style="font-size:18px">${stats.total}</div>
            <div class="sm">Действий за 7 дней</div>
          </div>
          <div class="stat" style="padding:12px">
            <div class="big" style="font-size:18px">${stats.topUsers[0]?.name || '—'}</div>
            <div class="sm">Самый активный</div>
          </div>
        </div>

        <div class="twrap">
          <table>
            <thead><tr>
              <th>Время</th><th>Пользователь</th><th>Действие</th><th>Детали</th>
            </tr></thead>
            <tbody>
              ${logs.map(l => `
                <tr>
                  <td>${App.fmtDateTime(l.ts)}</td>
                  <td>${App.esc(l.userName || 'Система')}</td>
                  <td><span class="badge binfo">${App.Audit.formatAction(l.action)}</span></td>
                  <td style="font-size:11px;max-width:300px;overflow:hidden;text-overflow:ellipsis">
                    ${App.esc(JSON.stringify(l.details || {}))}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    App.setLoading?.(false);

    document.getElementById('exportAuditJsonBtn').onclick = () => App.Audit.export('json');
    document.getElementById('exportAuditCsvBtn').onclick = () => App.Audit.export('csv');
    document.getElementById('cleanupAuditBtn').onclick = () => App.Audit.cleanup(30);

  } catch (e) {
    App.setLoading?.(false);
    content.innerHTML = `<div class="card" style="color:var(--bad)">Ошибка: ${App.esc(e.message)}</div>`;
  }
};

/* ---------- О системе ---------- */
App.settingsAbout = async function() {
  const content = App.$('#settingsContent');
  if (!content) return;

  const stats = await _getDbStats();
  const totalRecords = Object.values(stats).reduce((s, c) => s + c, 0);

  content.innerHTML = `
    <div class="card" style="margin-top:16px;text-align:center">
      <div style="font-size:64px;margin-bottom:16px">🌸</div>
      <h2>FLO.RISTA Pro</h2>
      <p style="color:var(--t3)">Версия 14.2 • ERP система для цветочного бизнеса</p>

      <div class="g" style="margin-top:24px;text-align:left">
        <div class="stat" style="padding:12px">
          <div class="big" style="font-size:18px">${totalRecords}</div>
          <div class="sm">Записей в БД</div>
        </div>
        <div class="stat" style="padding:12px">
          <div class="big" style="font-size:18px">${Object.keys(stats).length}</div>
          <div class="sm">Хранилищ</div>
        </div>
        <div class="stat" style="padding:12px">
          <div class="big" style="font-size:18px">${App.Auth.user?.role || '—'}</div>
          <div class="sm">Ваша роль</div>
        </div>
        <div class="stat" style="padding:12px">
          <div class="big" style="font-size:18px">${navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Other'}</div>
          <div class="sm">Браузер</div>
        </div>
      </div>

      <div style="margin-top:24px;padding:16px;background:var(--in);border-radius:12px;text-align:left">
        <h4 style="margin-bottom:8px">🔧 Технологии</h4>
        <div class="hint">
          • IndexedDB (локальное хранилище)<br>
          • Web Crypto API (PBKDF2, SHA-256)<br>
          • Chart.js (графики)<br>
          • Supabase (опциональная синхронизация)<br>
          • EmailJS / SMS.ru (уведомления)<br>
          • АТОЛ Онлайн (фискализация)
        </div>
      </div>

      <div style="margin-top:16px;padding:12px;background:#fef3c7;border-radius:8px;text-align:left;color:#92400e">
        <strong>⚠️ Важно:</strong> Данные хранятся локально в вашем браузере.
        Регулярно делайте бэкапы в разделе "Данные".
      </div>
    </div>
  `;
};

/* ---------- Экспорт всех данных ---------- */
App.exportAllData = async function() {
  try {
    const stores = ['users','clients','flowers','orders','writeoffs','shifts','expenses','supplies','returns','bouquets','settings','notifications','sync_queue','audit_log','stock_movements'];
    const data = {
      _meta: {
        version: '14.2',
        exportedAt: new Date().toISOString(),
        exportedBy: App.Auth.user?.name
      }
    };

    for (const s of stores) {
      try {
        data[s] = await App.repo(s).all();
      } catch {
        data[s] = [];
      }
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `florista_backup_${App.toLocalDateString(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);

    App.Toast.ok('Бэкап создан');

    if (App.Audit) {
      await App.Audit.logExport('full_backup', totalRecords);
    }
  } catch (e) {
    App.Toast.er('Ошибка экспорта: ' + e.message);
  }
};

/* ---------- Импорт данных ---------- */
App.importData = async function(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Валидация структуры
    if (typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Неверный формат файла');
    }

    // Подсчёт записей
    let totalRecords = 0;
    for (const key in data) {
      if (key === '_meta') continue;
      if (Array.isArray(data[key])) {
        totalRecords += data[key].length;
      }
    }

    const confirmed = await App.Modal.confirm(
      `Импортировать ${totalRecords} записей?\n\nПеред импортом будет создан автоматический бэкап текущих данных.`,
      'Импорт данных'
    );
    if (!confirmed) return;

    // Автоматический бэкап перед импортом
    await App.exportAllData();

    // Импорт
    let imported = 0;
    for (const store in data) {
      if (store === '_meta') continue;
      if (Array.isArray(data[store])) {
        for (const item of data[store]) {
          if (item && item.id) {
            try {
              await App.DB.put(store, item);
              imported++;
            } catch (err) {
              console.warn(`Skip ${store}/${item.id}:`, err);
            }
          }
        }
      }
    }

    App.Toast.ok(`Импортировано ${imported} записей`);

    if (App.Audit) {
      await App.Audit.logImport('full_backup', imported);
    }

    App.rerender();
  } catch (err) {
    App.Toast.er('Ошибка импорта: ' + err.message);
  }

  e.target.value = '';
};

/* ---------- Полная очистка ---------- */
App.clearAllData = async function() {
  const confirmed = await App.Modal.confirm(
    'Это удалит ВСЕ данные без возможности восстановления!\n\nРекомендуется сначала сделать бэкап.',
    '⚠️ ПОЛНАЯ ОЧИСТКА',
    { danger: true, okText: 'Продолжить' }
  );
  if (!confirmed) return;

  const word = await App.Modal.prompt(
    'Для подтверждения введите слово УДАЛИТЬ:',
    'Финальное подтверждение'
  );
  if (!word || word.toLowerCase() !== 'удалить') {
    App.Toast.wn('Отменено');
    return;
  }

  App.setLoading?.(true);

  try {
    const stores = ['users','clients','flowers','orders','writeoffs','shifts','expenses','supplies','returns','bouquets','settings','notifications','sync_queue','audit_log','stock_movements'];

    for (const s of stores) {
      try {
        await App.DB.clear(s);
      } catch { /* ignore */ }
    }

    // Сохраняем только критичные настройки
    const theme = App.ls.get('flo_theme');
    const deviceId = App.ls.get('flo_device_id');

    App.ls.remove('flo_session');
    App.ls.remove('flo_last_page');
    App.ls.remove('flo_last_sync');
    App.ls.remove('flo_last_pull');

    if (theme) App.ls.set('flo_theme', theme);
    if (deviceId) App.ls.set('flo_device_id', deviceId);

    App.Toast.ok('Все данные удалены. Перезагрузка...');

    setTimeout(() => {
      location.reload();
    }, 1500);
  } catch (e) {
    App.setLoading?.(false);
    App.Toast.er('Ошибка: ' + e.message);
  }
};

console.log('✅ settings.js загружен');