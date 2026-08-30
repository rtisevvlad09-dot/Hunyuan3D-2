/* =========================================================
 *  js/app.js
 *  Главный файл приложения
 *  v3.6 — с универсальным переключателем языка на всех экранах
 * ========================================================= */

window.addEventListener('error', (e) => {
  console.error('❌ Global error:', e.error);
  if (App?.Toast?.er) {
    App.Toast.er('Ошибка: ' + (e.message || 'неизвестная'));
  }
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('❌ Unhandled promise rejection:', e.reason);
  if (App?.Toast?.er) {
    App.Toast.er('Асинхронная ошибка: ' + (e.reason?.message || 'неизвестная'));
  }
});

function _checkModules() {
  const required = {
    'App.DB': typeof App.DB !== 'undefined',
    'App.Auth': typeof App.Auth !== 'undefined',
    'App.Modal': typeof App.Modal !== 'undefined',
    'App.state': typeof App.state !== 'undefined',
    'App.repo': typeof App.repo === 'function',
    'App.I18n': typeof App.I18n !== 'undefined',
    'App.Audit': typeof App.Audit !== 'undefined',
    'App.Notify': typeof App.Notify !== 'undefined',
    'App.SyncManager': typeof App.SyncManager !== 'undefined',
    'App.ExtServices': typeof App.ExtServices !== 'undefined',
    'App.renderDashboard': typeof App.renderDashboard === 'function',
    'App.renderOrders': typeof App.renderOrders === 'function',
    'App.renderFlowers': typeof App.renderFlowers === 'function',
    'App.renderClients': typeof App.renderClients === 'function',
    'App.renderSettings': typeof App.renderSettings === 'function'
  };

  const missing = Object.entries(required)
    .filter(([_, loaded]) => !loaded)
    .map(([name]) => name);

  if (missing.length > 0) {
    console.error('❌ Не загружены модули:', missing);
    return { ok: false, missing };
  }
  return { ok: true };
}

/* =========================================================
 *  ГЛОБАЛЬНАЯ ФУНКЦИЯ ПРИМЕНЕНИЯ ПЕРЕВОДОВ
 * ========================================================= */
App.applyTranslations = function() {
  if (!App.I18n) return;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translation = App.t(key);
    if (translation !== key) {
      // Для input/textarea обновляем placeholder, для остальных — textContent
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = translation;
      } else {
        el.textContent = translation;
      }
    }
  });

  document.title = App.t('app.name') + ' — ' + App.t('app.tagline');
};

/* =========================================================
 *  ОБНОВЛЕНИЕ ЛЕЙБЛОВ НАВИГАЦИИ
 * ========================================================= */
App.updateNavLabels = function() {
  if (!App.NAV || !App.I18n) return;
  App.NAV.forEach(item => {
    const translation = App.t('nav.' + item.id);
    if (translation !== 'nav.' + item.id) {
      item.label = translation;
    }
  });
};

/* =========================================================
 *  УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ДЛЯ ПЕРЕКЛЮЧАТЕЛЯ ЯЗЫКА
 *  Работает на ВСЕХ экранах (setup, login, app)
 * ========================================================= */
function _setupLanguageButtons() {
  const langPanel = document.getElementById('langPanel');
  const langList = document.getElementById('langList');

  if (!langPanel || !langList) {
    console.warn('⚠️ langPanel не найден');
    return;
  }

  // Все 3 кнопки которые могут открывать панель языка
  const buttons = [
    document.getElementById('langBtn'),       // в хедере
    document.getElementById('loginLangBtn'),  // на экране входа
    document.getElementById('setupLangBtn')   // на экране настройки
  ];

  const closePanel = () => {
    langPanel.classList.add('hidden');
    langPanel.classList.remove('on');
  };

  const openPanel = (triggerBtn) => {
    // Рендерим список языков
    const langs = App.I18n.getLanguageOptions();
    langList.innerHTML = langs.map(l => `
      <div class="lang-option ${l.active ? 'active' : ''}" data-lang="${l.code}">
        <span class="flag">${l.flag}</span>
        <div class="info">
          <div class="name">${l.name}</div>
          <div class="native">${l.native}</div>
        </div>
        ${l.active ? '<span class="check">✓</span>' : ''}
      </div>
    `).join('');

    // Умное позиционирование относительно кнопки-триггера
    if (triggerBtn) {
      const rect = triggerBtn.getBoundingClientRect();
      const panelWidth = 280;
      const panelMaxHeight = 500;

      // Определяем, на каком экране мы
      const onAppScreen = document.getElementById('scr-app')?.classList.contains('active');

      if (onAppScreen) {
        // На экране приложения — под кнопкой справа
        langPanel.style.position = 'fixed';
        langPanel.style.top = (rect.bottom + 8) + 'px';
        langPanel.style.right = '20px';
        langPanel.style.left = 'auto';
        langPanel.style.transform = 'none';
      } else {
        // На экранах login/setup — центрируем под кнопкой
        let left = rect.left + rect.width / 2 - panelWidth / 2;

        // Не выходим за границы экрана
        if (left < 16) left = 16;
        if (left + panelWidth > window.innerWidth - 16) {
          left = window.innerWidth - panelWidth - 16;
        }

        const top = rect.bottom + 8;

        // Если не помещается снизу — показываем сверху кнопки
        let finalTop = top;
        if (top + panelMaxHeight > window.innerHeight) {
          finalTop = Math.max(16, rect.top - panelMaxHeight - 8);
        }

        langPanel.style.position = 'fixed';
        langPanel.style.top = finalTop + 'px';
        langPanel.style.left = left + 'px';
        langPanel.style.right = 'auto';
        langPanel.style.transform = 'none';
      }
    }

    // Показываем панель
    langPanel.classList.remove('hidden');
    langPanel.classList.add('on');

    // Обработчики выбора языка
    langList.querySelectorAll('.lang-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const lang = opt.dataset.lang;
        App.I18n.setLanguage(lang);
        closePanel();
        App.applyTranslations();
      });
    });
  };

  // Навешиваем обработчики на все кнопки
  buttons.forEach(btn => {
    if (!btn) return;
    if (btn.dataset.langAttached) return;
    btn.dataset.langAttached = '1';

    btn.addEventListener('click', (e) => {
      e.stopPropagation();

      if (langPanel.classList.contains('hidden')) {
        openPanel(btn);
      } else {
        closePanel();
      }
    });
  });

  // Закрытие при клике вне панели
  document.addEventListener('click', (e) => {
    if (langPanel.classList.contains('hidden')) return;

    const clickedInsidePanel = langPanel.contains(e.target);
    const clickedButton = buttons.some(btn => btn && btn.contains(e.target));

    if (!clickedInsidePanel && !clickedButton) {
      closePanel();
    }
  });

  // Закрытие при Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !langPanel.classList.contains('hidden')) {
      closePanel();
    }
  });

  console.log('✅ Переключатели языка навешены на все экраны');
}

/* =========================================================
 *  ГЛАВНАЯ ИНИЦИАЛИЗАЦИЯ
 * ========================================================= */
async function init() {
  const startTime = performance.now();

  try {
    console.log('🚀 FLO.RISTA Pro — инициализация...');

    if (!window.crypto?.subtle) {
      _showFatalError(
        'Web Crypto API недоступен',
        'Откройте приложение через локальный сервер (не файл).'
      );
      return;
    }

    if (!window.indexedDB) {
      _showFatalError(
        'IndexedDB недоступен',
        'Используйте современный браузер.'
      );
      return;
    }

    const modulesCheck = _checkModules();
    if (!modulesCheck.ok) {
      _showFatalError(
        'Ошибка загрузки модулей',
        'Не загружены: ' + modulesCheck.missing.join(', ')
      );
      return;
    }

    console.log('📦 Открытие базы данных...');
    await App.DB.open();
    console.log('✅ База данных открыта');

    // Инициализация мультиязычности
    if (App.I18n?.init) {
      App.I18n.init();
    }

    // НАВЕШИВАЕМ ОБРАБОТЧИКИ ЯЗЫКА НА ВСЕ ЭКРАНЫ
    _setupLanguageButtons();

    if (App.Theme?.init) {
      App.Theme.init();
    } else if (App.initTheme) {
      App.initTheme();
    }

    if (App.handleInitialHash) App.handleInitialHash();
    if (App.initNavListeners) App.initNavListeners();

    if (App.Notify?.init) {
      await App.Notify.init();
    } else if (App.Notify?.refreshBadge) {
      await App.Notify.refreshBadge();
    }

    if (App.SyncManager?.init) {
      App.SyncManager.init().catch(e =>
        console.warn('⚠️ SyncManager init error:', e)
      );
    }

    _setupHotkeys();
    _setupVisibilityHandler();

    const users = await App.DB.all('users');

    if (users.length === 0) {
      console.log('🆕 Первый запуск — показ формы создания владельца');
      App.showScreen('scr-setup');
      App.applyTranslations();
      setTimeout(() => _setupSetupForm(), 100);
    } else {
      const restored = await App.Auth.restore();

      if (restored) {
        console.log('✅ Сессия восстановлена:', App.Auth.user.name);
        App.showScreen('scr-app');
        _setupHeaderButtons();

        if (App.handleInitialHash) App.handleInitialHash();
        if (App.ensurePageAccessible) App.ensurePageAccessible();

        App.renderNav();
        App.renderView();
      } else {
        console.log('🔐 Показ формы входа');
        App.showScreen('scr-login');
        App.applyTranslations();
        setTimeout(() => _setupLoginForm(), 100);
      }
    }

    const elapsed = (performance.now() - startTime).toFixed(0);
    console.log(`✅ FLO.RISTA Pro запущен за ${elapsed}ms`);
    console.log('%c🌸 FLO.RISTA Pro', 'color:#6C5CE7;font-size:16px;font-weight:bold');
    console.log('%cГотов к работе!', 'color:#10b981;font-size:12px');

  } catch (err) {
    console.error('❌ Критическая ошибка инициализации:', err);
    _showFatalError(
      'Ошибка запуска приложения',
      err.message || 'Неизвестная ошибка.'
    );
  }
}

function _showFatalError(title, message) {
  const errorScreen = document.getElementById('scr-error') || document.body;

  errorScreen.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:#fee2e2">
      <div style="max-width:500px;background:white;padding:40px;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,.1);text-align:center">
        <div style="font-size:64px;margin-bottom:20px">⚠️</div>
        <h1 style="color:#991b1b;margin-bottom:12px">${title}</h1>
        <p style="color:#666;line-height:1.6;margin-bottom:20px">${message}</p>
        <button onclick="location.reload()"
                style="padding:12px 30px;background:#6C5CE7;color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer">
          🔄 Перезагрузить
        </button>
      </div>
    </div>
  `;

  if (errorScreen.id === 'scr-error') {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    errorScreen.classList.add('active');
  }
}

function _setupSetupForm() {
  console.log('🔧 Настройка формы создания владельца...');

  const form = document.getElementById('setupForm');
  if (!form) {
    console.error('❌ setupForm НЕ НАЙДЕН в DOM');
    return;
  }

  if (form.dataset.setupAttached === '1') {
    console.log('ℹ️ Обработчик уже навешан');
    return;
  }

  form.dataset.setupAttached = '1';

  const phoneInput = form.querySelector('input[name="phone"]');
  if (phoneInput && App.applyPhoneMask) {
    App.applyPhoneMask(phoneInput);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent || App.t('setup.button');

    const name = form.name?.value?.trim() || '';
    const phone = form.phone?.value?.trim() || '';
    const pw = form.pw?.value || '';
    const pw2 = form.pw2?.value || '';
    const secQuestion = form.secQuestion?.value?.trim() || '';
    const secAnswer = form.secAnswer?.value?.trim() || '';

    if (!name) {
      App.Toast.er('Введите ФИО');
      form.name?.focus();
      return;
    }

    if (!phone) {
      App.Toast.er(App.t('login.error_empty_phone'));
      form.phone?.focus();
      return;
    }

    const normPhone = App.normPhone(phone);
    if (normPhone.length !== 11) {
      App.Toast.er('Телефон: 11 цифр (сейчас: ' + normPhone.length + ')');
      form.phone?.focus();
      return;
    }

    if (!pw || pw.length < 8) {
      App.Toast.er('Пароль должен быть не менее 8 символов');
      form.pw?.focus();
      return;
    }

    if (pw !== pw2) {
      App.Toast.er('Пароли не совпадают');
      form.pw2?.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> ...';
    }

    try {
      const users = await App.DB.all('users');

      if (users.length > 0) {
        App.Toast.wn('Владелец уже существует. Выполните вход.');
        App.showScreen('scr-login');
        App.applyTranslations();
        _setupLoginForm();
        return;
      }

      const user = await App.Auth.register({
        name, phone, password: pw,
        secQuestion, secAnswer
      });

      if (!user) throw new Error('App.Auth.register вернул null');

      console.log('✅ Владелец создан:', user.id, user.name);

      if (App.Audit?.log) {
        try {
          await App.Audit.log('system.first_setup', {
            userName: user.name,
            userId: user.id
          });
        } catch (e) {}
      }

      App.showScreen('scr-app');
      _setupHeaderButtons();
      App.renderNav();
      App.renderView();
      App.Toast.ok(App.t('setup.success'));
      form.reset();

    } catch (err) {
      console.error('❌ Setup error:', err);
      App.Toast.er('Ошибка: ' + (err.message || 'неизвестная'));
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
}

function _setupLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) {
    console.error('❌ loginForm не найден');
    return;
  }

  if (form.dataset.loginAttached) return;
  form.dataset.loginAttached = '1';

  const phoneInput = form.querySelector('input[name="phone"]');
  if (phoneInput && App.applyPhoneMask) {
    App.applyPhoneMask(phoneInput);
  }

  if (!phoneInput.value) {
    setTimeout(() => phoneInput.focus(), 100);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent || App.t('login.button');

    const phone = phoneInput?.value?.trim() || '';
    const password = form.querySelector('input[name="pw"]')?.value || '';

    if (!phone) {
      App.Toast.er(App.t('login.error_empty_phone'));
      phoneInput?.focus();
      return;
    }

    if (!password) {
      App.Toast.er(App.t('login.error_empty_password'));
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> ...';
      }

      const tfaInput = form.querySelector('[name="tfa"]');
      const res = await App.Auth.login(
        phone,
        password,
        tfaInput ? tfaInput.value : '',
        form.querySelector('[name="remember"]')?.checked || false
      );

      if (res === true) {
        const tfaBlock = document.getElementById('tfaBlock');
        if (tfaBlock) tfaBlock.style.display = 'none';

        App.showScreen('scr-app');
        _setupHeaderButtons();

        if (App.handleInitialHash) App.handleInitialHash();
        if (App.ensurePageAccessible) App.ensurePageAccessible();

        App.renderNav();
        App.renderView();
        App.Toast.ok(App.t('login.welcome', { name: App.Auth.user.name }));

        form.reset();
      } else if (res === 'need_tfa') {
        const tfaBlock = document.getElementById('tfaBlock');
        if (tfaBlock) {
          tfaBlock.style.display = 'block';
          const tfaInputEl = tfaBlock.querySelector('input');
          if (tfaInputEl) tfaInputEl.focus();
        }
        App.Toast.wn('Введите код 2FA');
      }
    } catch (err) {
      console.error('Login error:', err);
      App.Toast.er('Ошибка входа: ' + (err.message || 'неизвестная'));
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
}

function _setupHeaderButtons() {
  console.log('🔧 Настройка кнопок хедера...');

  // ВЫХОД
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn && !logoutBtn.dataset.attached) {
    logoutBtn.dataset.attached = '1';
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        if (App.Audit?.logLogout) {
          try { await App.Audit.logLogout(); } catch (e) {}
        }

        App.Auth.user = null;
        try { App.ls.remove('flo_session'); } catch (e) {}
        try { sessionStorage.removeItem('flo_session'); } catch (e) {}

        App.showScreen('scr-login');
        App.applyTranslations();

        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
          loginForm.reset();
          loginForm.dataset.loginAttached = '';
        }

        const tfaBlock = document.getElementById('tfaBlock');
        if (tfaBlock) tfaBlock.style.display = 'none';

        App.Toast.in(App.t('logout.message'));
        _setupLoginForm();
      } catch (err) {
        console.error('Logout error:', err);
        App.Auth.user = null;
        try { App.ls.remove('flo_session'); } catch (e) {}
        try { sessionStorage.removeItem('flo_session'); } catch (e) {}
        App.showScreen('scr-login');
        App.applyTranslations();
      }
    });
  }

  // ТЕМА
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn && !themeBtn.dataset.attached) {
    themeBtn.dataset.attached = '1';
    themeBtn.addEventListener('click', () => {
      if (App.Theme?.toggle) App.Theme.toggle();
      else if (App.toggleTheme) App.toggleTheme();
    });
  }

  // ЭКСПОРТ
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn && !exportBtn.dataset.attached) {
    exportBtn.dataset.attached = '1';
    exportBtn.addEventListener('click', async () => {
      try {
        if (typeof App.exportAllData === 'function') {
          await App.exportAllData();
        } else {
          App.Toast.wn('Функция экспорта недоступна');
        }
      } catch (err) {
        App.Toast.er('Ошибка: ' + err.message);
      }
    });
  }

  // СИНХРОНИЗАЦИЯ
  const syncBtn = document.getElementById('syncBtn');
  if (syncBtn && !syncBtn.dataset.attached) {
    syncBtn.dataset.attached = '1';
    syncBtn.addEventListener('click', async () => {
      try {
        if (App.SyncManager?.manualSync) {
          await App.SyncManager.manualSync();
        } else {
          App.Toast.wn('Синхронизация не настроена');
        }
      } catch (err) {
        App.Toast.er('Ошибка: ' + err.message);
      }
    });
  }

  // УВЕДОМЛЕНИЯ
  const notifBtn = document.getElementById('notifBtn');
  if (notifBtn && !notifBtn.dataset.attached && !App.Notify?._btnAttached) {
    notifBtn.dataset.attached = '1';
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (App.Notify?.togglePanel) App.Notify.togglePanel();
    });
  }
}

function _setupHotkeys() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('modal');
      const notifPanel = document.getElementById('notifPanel');

      if (modal?.classList.contains('on')) {
        App.Modal.close();
      } else if (notifPanel?.classList.contains('on')) {
        App.Notify?.closePanel?.();
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.querySelector('.inp.search');
      if (searchInput) searchInput.focus();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      const syncBtn = document.getElementById('syncBtn');
      if (syncBtn) syncBtn.click();
    }

    if (e.altKey && e.key >= '1' && e.key <= '9') {
      if (!App.Auth || !App.Auth.user) return;

      const tagName = (e.target.tagName || '').toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return;

      const idx = parseInt(e.key) - 1;
      const available = App.NAV.filter(n =>
        n.r.indexOf(App.Auth.user.role) !== -1 && App.Auth.canAccess(n.id)
      );

      if (available[idx]) {
        e.preventDefault();
        App.navigateTo(available[idx].id);
      }
    }
  });
}

function _setupVisibilityHandler() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && App.Auth?.user) {
      App.Notify?.refreshBadge?.();

      if (App.SyncManager?.online && !App.SyncManager.syncing) {
        setTimeout(() => {
          App.SyncManager.fullSync?.().catch(() => {});
        }, 500);
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}