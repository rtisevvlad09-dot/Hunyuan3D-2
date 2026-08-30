/* =========================================================
 *  js/core/auth.js
 *  Аутентификация + система прав доступа
 *  v3.2 — с исправленной нормализацией телефона при входе
 * ========================================================= */

window.App = window.App || {};

/* ---------- Все доступные модули системы ---------- */
App.MODULES = [
  { id: 'dashboard',  label: '📊 Дашборд',    default: true,  desc: 'Главная страница со статистикой' },
  { id: 'orders',     label: '📦 Заказы',     default: true,  desc: 'Создание и управление заказами' },
  { id: 'flowers',    label: '🌸 Товары',     default: false, desc: 'Каталог товаров и остатки' },
  { id: 'bouquets',   label: '💐 Букеты',     default: false, desc: 'Конструктор букетов' },
  { id: 'clients',    label: '👥 Клиенты',    default: true,  desc: 'База клиентов и CRM' },
  { id: 'calendar',   label: '📅 Календарь',  default: true,  desc: 'Календарь доставок' },
  { id: 'shifts',     label: '⏰ Смены',      default: true,  desc: 'Учёт рабочего времени' },
  { id: 'expenses',   label: '💸 Расходы',    default: false, desc: 'Учёт расходов' },
  { id: 'supplies',   label: '📥 Поставки',   default: false, desc: 'Приход товара' },
  { id: 'returns',    label: '↩️ Возвраты',   default: false, desc: 'Обработка возвратов' },
  { id: 'writeoffs',  label: '📉 Списания',   default: false, desc: 'Списание товара' },
  { id: 'analytics',  label: '📈 Аналитика',  default: false, desc: 'Отчёты и графики' },
  { id: 'staff',      label: '👥 Персонал',   default: false, desc: 'Управление сотрудниками' },
  { id: 'settings',   label: '⚙️ Настройки',  default: false, desc: 'Системные настройки' }
];

/* ---------- Умная нормализация телефона ---------- */
/* Приводит любой формат к 11 цифрам, начинающимся с 7 */
App.normalizePhoneForLogin = function(phone) {
  let digits = String(phone || '').replace(/\D/g, '');

  // Если начинается с 8 → меняем на 7
  if (digits.startsWith('8')) {
    digits = '7' + digits.slice(1);
  }

  // Если 10 цифр без 7 → добавляем 7
  if (digits.length === 10 && !digits.startsWith('7')) {
    digits = '7' + digits;
  }

  // Ограничиваем до 11 цифр
  digits = digits.slice(0, 11);

  return digits;
};

App.Auth = {
  user: null,
  _loginAttempts: {},

  /* ---------- Проверка доступа к модулю ---------- */
  canAccess: function(moduleId) {
    if (!this.user) return false;

    if (this.user.role === 'owner' || this.user.role === 'admin') {
      return true;
    }

    if (this.user.role === 'employee') {
      var perms = this.user.permissions || {};
      return perms[moduleId] === true;
    }

    return false;
  },

  /* ---------- Список доступных модулей ---------- */
  getAvailableModules: function() {
    var self = this;
    return App.MODULES.filter(function(m) {
      return self.canAccess(m.id);
    });
  },

  /* ---------- Регистрация владельца ---------- */
  async register(d) {
    console.log('Auth.register called');

    try {
      var users = await App.DB.all('users');
      if (!Array.isArray(users)) {
        App.Toast.er('Ошибка базы данных');
        return null;
      }

      // Нормализуем телефон с добавлением 7
      var normPhone = App.normalizePhoneForLogin(d.phone);
      console.log('Register phone normalized:', d.phone, '→', normPhone);

      var exists = users.find(function(x) {
        return App.normalizePhoneForLogin(x.phone) === normPhone;
      });

      if (exists) {
        App.Toast.er('Телефон уже используется');
        return null;
      }

      if (!window.crypto || !window.crypto.subtle) {
        App.Toast.er('Откройте приложение через локальный сервер');
        return null;
      }

      var salt = await App.genSalt();
      var hash = await App.digest(d.password, salt);

      if (!hash) {
        App.Toast.er('Ошибка хеширования пароля');
        return null;
      }

      var secAnswerSalt = null;
      var secAnswerHash = null;

      if (d.secAnswer && d.secAnswer.trim()) {
        try {
          secAnswerSalt = await App.genSalt();
          secAnswerHash = await App.digest(d.secAnswer.trim().toLowerCase(), secAnswerSalt);
        } catch (e) {
          console.warn('Secret hash failed:', e);
        }
      }

      var u = {
        id: App.uid('usr'),
        name: d.name,
        phone: d.phone,
        hash: hash,
        salt: salt,
        secQuestion: d.secQuestion || '',
        secAnswerSalt: secAnswerSalt,
        secAnswerHash: secAnswerHash,
        role: 'owner',
        position: 'Владелец',
        emoji: '👑',
        shiftCost: 0,
        hourlyRate: 0,
        commissionRate: 3,
        commissionThreshold: 0,
        tfaEnabled: false,
        backupCodesHash: [],
        backupCodesSalt: null,
        active: true,
        permissions: {},
        createdAt: Date.now(),
        lastLogin: null
      };

      await App.DB.put('users', u);
      this.user = u;
      App.ls.set('flo_session', u.id);
      console.log('Register SUCCESS');
      return u;

    } catch (err) {
      console.error('Register error:', err);
      App.Toast.er('Ошибка регистрации: ' + (err.message || 'неизвестная'));
      return null;
    }
  },

  /* ---------- Вход в систему (С УМНОЙ НОРМАЛИЗАЦИЕЙ) ---------- */
  async login(ph, pw, tfaCode, remember) {
    console.log('Login attempt with phone:', ph);

    // Умная нормализация: добавляем 7 если нужно
    ph = App.normalizePhoneForLogin(ph);
    console.log('Normalized phone for login:', ph);

    var now = Date.now();

    var attemptsKey = 'flo_login_attempts';
    var attemptsData = {};
    try {
      attemptsData = JSON.parse(sessionStorage.getItem(attemptsKey) || '{}');
    } catch (e) {}

    var attempts = attemptsData[ph] || { count: 0, lockUntil: 0 };
    if (now < attempts.lockUntil) {
      App.Toast.er('Слишком много попыток. Подождите ' + Math.ceil((attempts.lockUntil - now) / 1000) + ' сек');
      return false;
    }

    var users = await App.DB.all('users');
    console.log('Total users in DB:', users.length);

    // Ищем пользователя с умной нормализацией
    var u = users.find(function(x) {
      var storedPhone = App.normalizePhoneForLogin(x.phone);
      return storedPhone === ph;
    });

    if (!u) {
      console.warn('User not found. Entered phone:', ph);
      console.warn('Available phones:', users.map(x => App.normalizePhoneForLogin(x.phone)));
      App.Toast.er('Пользователь не найден. Проверьте номер телефона.');
      return false;
    }

    console.log('User found:', u.name);

    if (u.active === false) {
      App.Toast.er('Учётная запись заблокирована');
      return false;
    }

    var h = await App.digest(pw, u.salt);
    if (!h || h !== u.hash) {
      attempts.count++;
      if (attempts.count >= 5) {
        attempts.lockUntil = now + 30000;
        attempts.count = 0;
      }
      attemptsData[ph] = attempts;
      sessionStorage.setItem(attemptsKey, JSON.stringify(attemptsData));
      App.Toast.er('Неверный пароль');
      return false;
    }

    delete attemptsData[ph];
    sessionStorage.setItem(attemptsKey, JSON.stringify(attemptsData));

    if (u.tfaEnabled) {
      if (!tfaCode) {
        App.Toast.wn('Введите код 2FA');
        return 'need_tfa';
      }
      var codes = u.backupCodesHash || [];
      var inputHash = await App.digest(tfaCode.trim().toUpperCase(), u.backupCodesSalt || u.salt);
      var idx = codes.indexOf(inputHash);
      if (idx === -1) {
        App.Toast.er('Неверный код 2FA');
        return false;
      }
      codes.splice(idx, 1);
      u.backupCodesHash = codes;
      await App.DB.put('users', u);
      if (codes.length === 0) App.Toast.wn('Резервные коды закончились!');
    }

    this.user = u;
    if (remember) {
      App.ls.set('flo_session', u.id);
    } else {
      sessionStorage.setItem('flo_session', u.id);
    }

    console.log('Login SUCCESS:', u.name);
    return true;
  },

  /* ---------- Восстановление сессии ---------- */
  async restore() {
    var id = App.ls.get('flo_session') || sessionStorage.getItem('flo_session');
    if (!id) return false;

    try {
      var u = await App.DB.get('users', id);
      if (!u) {
        App.ls.remove('flo_session');
        sessionStorage.removeItem('flo_session');
        return false;
      }
      if (u.active === false) {
        App.ls.remove('flo_session');
        sessionStorage.removeItem('flo_session');
        return false;
      }
      this.user = u;
      return true;
    } catch (e) {
      console.warn('Restore error:', e);
      return false;
    }
  },

  /* ---------- Выход ---------- */
  logout: function() {
    this.user = null;

    try {
      App.ls.remove('flo_session');
    } catch (e) {}

    try {
      sessionStorage.removeItem('flo_session');
    } catch (e) {}

    App.showScreen('scr-login');

    var loginForm = App.$('#loginForm');
    if (loginForm) loginForm.reset();

    var tfaBlock = App.$('#tfaBlock');
    if (tfaBlock) tfaBlock.classList.add('hidden');

    App.Toast.in('Вы вышли из системы');
  },

  /* ---------- Проверка ролей ---------- */
  can: function() {
    if (!this.user) return false;
    var roles = Array.prototype.slice.call(arguments);
    return roles.indexOf(this.user.role) >= 0;
  },

  isAdmin: function() {
    return this.can('owner', 'admin');
  },

  canManageOrder: function(o) {
    if (!o) return false;
    if (!this.user) return false;
    return this.isAdmin() || o.createdById === this.user.id;
  },

  /* ---------- Смена пароля ---------- */
  async changePassword(oldPw, newPw, newPw2) {
    if (!this.user) return false;

    var oldHash = await App.digest(oldPw, this.user.salt);
    if (oldHash !== this.user.hash) {
      App.Toast.er('Неверный текущий пароль');
      return false;
    }

    if (newPw !== newPw2) {
      App.Toast.er('Новые пароли не совпадают');
      return false;
    }

    if (newPw.length < 8) {
      App.Toast.er('Пароль слишком короткий');
      return false;
    }

    var salt = await App.genSalt();
    var hash = await App.digest(newPw, salt);

    await App.DB.put('users', Object.assign({}, this.user, { salt: salt, hash: hash }));
    this.user.salt = salt;
    this.user.hash = hash;

    App.Toast.ok('Пароль изменён');
    return true;
  }
};

/* ---------- Глобальная функция выхода для надёжности ---------- */
App.logout = async function() {
  console.log('🚪 App.logout вызван');

  try {
    if (App.Audit?.logLogout) {
      await App.Audit.logLogout();
    }
  } catch (err) {
    console.warn('Audit error:', err);
  }

  App.Auth.logout();
};

console.log('auth.js loaded (v3.2 with smart phone normalization)');