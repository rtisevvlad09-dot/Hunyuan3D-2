/* =========================================================
 *  js/core/utils.js
 *  Базовые утилиты. Никаких зависимостей.
 *  v2.4 — с исправленной маской телефона
 * ========================================================= */

const U = (() => {

  /* ---------- Безопасный доступ к localStorage ---------- */
  const ls = {
    get(key, def = null) {
      try { return localStorage.getItem(key) ?? def; }
      catch { return def; }
    },
    set(key, val) {
      try { localStorage.setItem(key, val); } catch { /* ignore */ }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    },
    clear() {
      try { localStorage.clear(); } catch { /* ignore */ }
    },
    getJSON(key, def = null) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : def;
      } catch { return def; }
    },
    setJSON(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); }
      catch { /* ignore */ }
    }
  };

  /* ---------- ID с осмысленными префиксами ---------- */
  const uid = (prefix = 'id') =>
    `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  /* ---------- Деньги с поддержкой валюты ---------- */
  const money = (n, currency = null) => {
    const v = Number(n) || 0;
    const cur = currency || ls.get('flo_currency') || 'RUB';
    const symbols = { RUB: '₽', USD: '$', EUR: '€', GBP: '£', KZT: '₸', UAH: '₴', BYN: 'Br' };

    try {
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: cur,
        maximumFractionDigits: 0
      }).format(v);
    } catch {
      return `${v.toLocaleString('ru-RU')} ${symbols[cur] || cur}`;
    }
  };

  const num = (n, decimals = 0) => {
    const v = Number(n) || 0;
    try {
      return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(v);
    } catch {
      return v.toLocaleString('ru-RU');
    }
  };

  const numShort = (n) => {
    const v = Number(n) || 0;
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'М';
    if (abs >= 1_000) return (v / 1_000).toFixed(1) + 'К';
    return String(v);
  };

  /* ---------- Даты ---------- */
  const pad = (n) => String(n).padStart(2, '0');

  const toSafeDate = (d) => {
    if (!d) return null;
    const dt = d instanceof Date ? d : new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
  };

  const formatDate = (d) => {
    const dt = toSafeDate(d);
    if (!dt) return '—';
    return `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${dt.getFullYear()}`;
  };

  const formatDateTime = (d) => {
    const dt = toSafeDate(d);
    if (!dt) return '—';
    return `${formatDate(dt)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  };

  const formatTime = (d) => {
    const dt = toSafeDate(d);
    if (!dt) return '—';
    return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  };

  const relTime = (d) => {
    const dt = toSafeDate(d);
    if (!dt) return '—';
    const diff = Date.now() - dt.getTime();
    if (diff < 0) return 'в будущем';
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'только что';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} мин назад`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} ч назад`;
    const days = Math.floor(hr / 24);
    if (days === 1) return 'вчера';
    if (days < 7) return `${days} дн назад`;
    return formatDate(dt);
  };

  const fmtDateRange = (from, to) => {
    const a = toSafeDate(from), b = toSafeDate(to);
    if (!a || !b) return '—';
    if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
      return `${a.getDate()}–${b.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
    }
    return `${formatDate(a)} — ${formatDate(b)}`;
  };

  const parseLocalDate = (str) => {
    if (!str) return null;
    if (typeof str === 'number') return str > 0 ? str : null;
    const parts = String(str).split('-').map(Number);
    if (parts.length < 3 || !parts[0]) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
  };

  const toLocalDateString = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const toLocalDate = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    return isNaN(d.getTime()) ? null : d;
  };

  /* ---------- HTML / XSS ---------- */
  const escapeHtml = (s) => {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/`/g, '&#96;');
  };

  const safeJSON = (str, def = null) => {
    if (!str) return def;
    try { return JSON.parse(str); }
    catch { return def; }
  };

  /* ---------- Debounce / Throttle ---------- */
  const debounce = (fn, ms = 300) => {
    let t;
    const debounced = (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
    debounced.cancel = () => clearTimeout(t);
    return debounced;
  };

  const throttle = (fn, ms = 200) => {
    let last = 0;
    return (...args) => {
      const now = Date.now();
      if (now - last >= ms) {
        last = now;
        fn.apply(null, args);
      }
    };
  };

  const debouncedSearch = (key, value, callback, ms = 200) => {
    if (!window.App) return;
    App.state.search = App.state.search || {};
    App.state.search[key] = value;

    if (!App._searchTimers) App._searchTimers = {};
    clearTimeout(App._searchTimers[key]);

    App._searchTimers[key] = setTimeout(() => {
      if (typeof callback === 'function') callback();
    }, ms);
  };

  /* ---------- Объекты ---------- */
  const clone = (o) => {
    try { return JSON.parse(JSON.stringify(o)); }
    catch { return o; }
  };

  /* =========================================================
   *  ТЕЛЕФОН — ИСПРАВЛЕННАЯ МАСКА
   * ========================================================= */
  const parsePhone = (s) => (s || '').replace(/\D/g, '');

  const formatPhone = (raw) => {
    let digits = parsePhone(raw);

    if (digits.startsWith('8')) {
      digits = '7' + digits.slice(1);
    }

    if (digits && !digits.startsWith('7')) {
      digits = '7' + digits;
    }

    digits = digits.slice(0, 11);

    if (!digits) return '';

    let result = '+7';
    if (digits.length > 1) result += ' (' + digits.slice(1, 4);
    if (digits.length >= 4) result += ') ' + digits.slice(4, 7);
    if (digits.length >= 7) result += '-' + digits.slice(7, 9);
    if (digits.length >= 9) result += '-' + digits.slice(9, 11);

    return result;
  };

  const _countDigitsBefore = (value, position) => {
    let count = 0;
    for (let i = 0; i < position && i < value.length; i++) {
      if (/\d/.test(value[i])) count++;
    }
    return count;
  };

  const _findPositionAfterDigits = (value, digitsCount) => {
    let count = 0;
    for (let i = 0; i < value.length; i++) {
      if (/\d/.test(value[i])) {
        count++;
        if (count === digitsCount) return i + 1;
      }
    }
    return value.length;
  };

  const applyPhoneMask = (input) => {
    if (!input || input.dataset.masked) return;
    input.dataset.masked = '1';

    let isFormatting = false;

    const handleInput = (e) => {
      if (isFormatting) return;
      isFormatting = true;

      const inputEl = e.target;
      const oldValue = inputEl.value;
      const cursorPos = inputEl.selectionStart || 0;

      const digitsBeforeCursor = _countDigitsBefore(oldValue, cursorPos);
      const newValue = formatPhone(oldValue);

      if (newValue !== oldValue) {
        inputEl.value = newValue;

        let newCursorPos;

        if (newValue.length === 0) {
          newCursorPos = 0;
        } else if (digitsBeforeCursor === 0) {
          newCursorPos = 0;
        } else {
          newCursorPos = _findPositionAfterDigits(newValue, digitsBeforeCursor);
        }

        try {
          inputEl.setSelectionRange(newCursorPos, newCursorPos);
        } catch (err) {
          // ignore
        }
      }

      isFormatting = false;
    };

    const handleKeyDown = (e) => {
      const inputEl = e.target;

      if (e.key === 'Backspace') {
        const selStart = inputEl.selectionStart;
        const selEnd = inputEl.selectionEnd;

        if (selStart === selEnd && selStart <= 3) {
          const digits = inputEl.value.replace(/\D/g, '');
          if (digits.length <= 1) {
            e.preventDefault();
            inputEl.value = '';
          }
        }
      }
    };

    const handlePaste = (e) => {
      e.preventDefault();
      const pastedText = (e.clipboardData || window.clipboardData).getData('text');
      const formatted = formatPhone(pastedText);

      const inputEl = e.target;
      inputEl.value = formatted;

      try {
        inputEl.setSelectionRange(formatted.length, formatted.length);
      } catch (err) {
        // ignore
      }
    };

    // ИСПРАВЛЕННЫЙ handleFocus - НЕ перезаписывает введённое
    const handleFocus = (e) => {
      const inputEl = e.target;
      // Добавляем +7 только если поле СОВСЕМ пустое
      if (!inputEl.value || inputEl.value.trim() === '') {
        inputEl.value = '+7 ';
        try {
          inputEl.setSelectionRange(3, 3);
        } catch (err) {
          // ignore
        }
      }
    };

    // ИСПРАВЛЕННЫЙ handleBlur - НЕ очищает неполный номер
    const handleBlur = (e) => {
      const inputEl = e.target;
      const digits = inputEl.value.replace(/\D/g, '');

      // Очищаем ТОЛЬКО если цифр НЕТ или только одна "7" без номера
      if (digits.length === 0) {
        inputEl.value = '';
      } else if (digits.length === 1 && (digits === '7' || digits === '8')) {
        // Только "+7" без других цифр — очищаем
        inputEl.value = '';
      }
      // Если есть хотя бы 2 цифры — НЕ очищаем, оставляем как есть
    };

    input.addEventListener('input', handleInput);
    input.addEventListener('keydown', handleKeyDown);
    input.addEventListener('paste', handlePaste);
    input.addEventListener('focus', handleFocus);
    input.addEventListener('blur', handleBlur);
  };

  /* ---------- Валидация ---------- */
  const isPhoneValid = (p) => parsePhone(p).length === 11;

  const isEmailValid = (e) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());

  const checkPasswordStrength = (pw) => {
    if (!pw) return { score: 0, label: 'Пустой', color: '#9ca3af' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-ZА-Я]/.test(pw)) score++;
    if (/[a-zа-я]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-zА-Яа-я0-9]/.test(pw)) score++;

    const labels = [
      'Очень слабый', 'Слабый', 'Средний', 'Хороший', 'Сильный', 'Отличный'
    ];
    const colors = [
      '#9ca3af', '#ef4444', '#f59e0b', '#eab308', '#10b981', '#059669'
    ];

    const idx = Math.min(score, 5);
    return { score, label: labels[idx], color: colors[idx] };
  };

  const hash = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) + h) + s.charCodeAt(i);
      h |= 0;
    }
    return (h >>> 0).toString(16);
  };

  /* ========== КРИПТОГРАФИЯ ========== */
  const cryptoAvailable = !!(window.crypto?.subtle);

  const digest = async (password, saltB64) => {
    if (!cryptoAvailable) throw new Error('Web Crypto API недоступен');
    const enc = new TextEncoder();
    const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(password),
      { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      key, 256
    );
    return btoa(String.fromCharCode(...new Uint8Array(bits)));
  };

  const genSalt = async () => {
    if (!cryptoAvailable) throw new Error('Web Crypto API недоступен');
    const arr = crypto.getRandomValues(new Uint8Array(16));
    return btoa(String.fromCharCode(...arr));
  };

  const genBackupCodes = (n = 6) => {
    const arr = [];
    for (let i = 0; i < n; i++) {
      const bytes = crypto.getRandomValues(new Uint8Array(4));
      arr.push(Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase());
    }
    return arr;
  };

  const genPassword = (len = 12) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';

    if (!cryptoAvailable) {
      let pw = '';
      for (let i = 0; i < len; i++) {
        pw += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return pw;
    }

    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => chars[b % chars.length]).join('');
  };

  /* ---------- Обработка изображений ---------- */
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsDataURL(file);
  });

  const _getExifOrientation = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const view = new DataView(e.target.result);
        if (view.getUint16(0, false) !== 0xFFD8) return resolve(1);
        let offset = 2;
        const len = view.byteLength;
        while (offset < len) {
          const marker = view.getUint16(offset, false);
          offset += 2;
          if (marker === 0xFFE1) {
            if (view.getUint32(offset += 2, false) !== 0x45786966) return resolve(1);
            const little = view.getUint16(offset += 6, false) === 0x4949;
            offset += view.getUint32(offset + 4, little);
            const tags = view.getUint16(offset, little);
            offset += 2;
            for (let i = 0; i < tags; i++) {
              if (view.getUint16(offset + (i * 12), little) === 0x0112) {
                return resolve(view.getUint16(offset + (i * 12) + 8, little));
              }
            }
          } else if ((marker & 0xFF00) !== 0xFF00) break;
          else offset += view.getUint16(offset, false);
        }
        resolve(1);
      } catch (err) {
        resolve(1);
      }
    };
    reader.onerror = () => resolve(1);
    reader.readAsArrayBuffer(file.slice(0, 64 * 1024));
  });

  const processImage = (file, maxWidth = 800, quality = 0.8) =>
    new Promise(async (resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Файл должен быть изображением'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('Файл слишком большой (макс. 5 МБ)'));
        return;
      }

      try {
        const orientation = await _getExifOrientation(file);
        const reader = new FileReader();

        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;

            if (w > maxWidth) {
              h = Math.round(h * maxWidth / w);
              w = maxWidth;
            }

            const swap = orientation > 4;
            canvas.width = swap ? h : w;
            canvas.height = swap ? w : h;

            const ctx = canvas.getContext('2d');

            switch (orientation) {
              case 2: ctx.transform(-1, 0, 0, 1, w, 0); break;
              case 3: ctx.transform(-1, 0, 0, -1, w, h); break;
              case 4: ctx.transform(1, 0, 0, -1, 0, h); break;
              case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
              case 6: ctx.transform(0, 1, -1, 0, h, 0); break;
              case 7: ctx.transform(0, -1, -1, 0, h, w); break;
              case 8: ctx.transform(0, -1, 1, 0, 0, w); break;
            }

            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', quality));
          };
          img.onerror = () => reject(new Error('Не удалось загрузить изображение'));
          img.src = e.target.result;
        };

        reader.onerror = () => reject(new Error('Ошибка чтения файла'));
        reader.readAsDataURL(file);
      } catch (err) {
        reject(err);
      }
    });

  /* ---------- Toasts ---------- */
  const toast = (msg, type = 'in', ms = 3500) => {
    const box = document.getElementById('toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icons = { ok: '✅', er: '❌', wn: '⚠️', in: 'ℹ️' };
    el.innerHTML = `<span>${icons[type] || ''}</span><span>${escapeHtml(msg)}</span>`;
    box.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(40px)';
      el.style.transition = '.3s';
      setTimeout(() => { if (el.parentNode) el.remove(); }, 300);
    }, ms);
  };

  const Toast = {
    ok: (m) => toast(m, 'ok', 2800),
    er: (m) => toast(m, 'er', 4500),
    wn: (m) => toast(m, 'wn', 3500),
    in: (m) => toast(m, 'in', 2500),
    show: toast
  };

  /* ---------- Confirm / Prompt ---------- */
  const confirm = (msg, title = 'Подтверждение', opts = {}) => {
    if (window.App?.Modal?.confirm) {
      return window.App.Modal.confirm(msg, title, opts);
    }
    return Promise.resolve(window.confirm(msg));
  };

  const prompt = (msg, title = 'Введите значение', def = '') => {
    if (window.App?.Modal?.prompt) {
      return window.App.Modal.prompt(msg, title, def);
    }
    return Promise.resolve(window.prompt(msg, def));
  };

  /* ---------- Массивы ---------- */
  const groupBy = (arr, fn) => {
    const res = {};
    for (const x of arr) {
      const k = typeof fn === 'function' ? fn(x) : x[fn];
      (res[k] = res[k] || []).push(x);
    }
    return res;
  };

  const sumBy = (arr, fn) =>
    arr.reduce((s, x) => s + (typeof fn === 'function' ? fn(x) : (x[fn] || 0)), 0);

  const uniq = (arr) => [...new Set(arr)];

  const chunk = (arr, size) => {
    const res = [];
    for (let i = 0; i < arr.length; i += size) {
      res.push(arr.slice(i, i + size));
    }
    return res;
  };

  /* ---------- DOM helpers ---------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const BOOL_ATTRS = new Set([
    'disabled', 'checked', 'readonly', 'required', 'multiple',
    'selected', 'autofocus', 'hidden', 'open', 'defer', 'async'
  ]);

  const el = (tag, attrs = {}, ...children) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class' || k === 'className') {
        if (v) n.className = v;
      } else if (k === 'style' && typeof v === 'object') {
        Object.assign(n.style, v);
      } else if (k === 'on' && typeof v === 'object') {
        for (const [ev, h] of Object.entries(v)) {
          if (typeof h === 'function') n.addEventListener(ev, h);
        }
      } else if (k.startsWith('on') && typeof v === 'function') {
        n.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (BOOL_ATTRS.has(k) && v === true) {
        n[k] = true;
        n.setAttribute(k, '');
      } else {
        n.setAttribute(k, String(v));
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false || c === true) continue;
      n.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return n;
  };

  /* ---------- Тёмная тема ---------- */
  const initTheme = () => {
    const saved = ls.get('flo_theme');
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    return theme;
  };

  const toggleTheme = () => {
    const cur = document.documentElement.dataset.theme || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    ls.set('flo_theme', next);
    return next;
  };

  /* ---------- Loading state ---------- */
  const setLoading = (isLoading) => {
    let loader = document.getElementById('globalLoader');
    if (isLoading) {
      if (!loader) {
        loader = document.createElement('div');
        loader.id = 'globalLoader';
        loader.style.cssText = `
          position:fixed;top:0;left:0;right:0;height:3px;background:transparent;
          z-index:9999;pointer-events:none;
        `;
        loader.innerHTML = `
          <div style="height:100%;width:30%;background:linear-gradient(90deg,#6C5CE7,#a29bfe);
                      animation:loaderSlide 1.5s infinite ease-in-out;border-radius:2px"></div>
        `;
        document.body.appendChild(loader);

        if (!document.getElementById('loaderStyle')) {
          const style = document.createElement('style');
          style.id = 'loaderStyle';
          style.textContent = `
            @keyframes loaderSlide {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(400%); }
            }
          `;
          document.head.appendChild(style);
        }
      }
      loader.style.display = 'block';
    } else if (loader) {
      loader.style.display = 'none';
    }
  };

  /* ---------- Константы ---------- */
  const MS_PER_DAY = 86400000;

  const MONTHS = [
    'Январь','Февраль','Март','Апрель','Май','Июнь',
    'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'
  ];

  const MONTHS_SHORT = [
    'Янв','Фев','Мар','Апр','Май','Июн',
    'Июл','Авг','Сен','Окт','Ноя','Дек'
  ];

  const DAYS_OF_WEEK = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

  const EXPENSE_CATS = [
    'Налоги','Аренда','Коммунальные','Хостинг',
    'Реклама','Упаковка','Гелий','Прочее'
  ];

  const ROLES = {
    owner: 'Владелец',
    admin: 'Администратор',
    employee: 'Сотрудник'
  };

  /* ---------- Автоинициализация масок ---------- */
  let _mo;
  const watchInputs = () => {
    if (_mo || !document.body) return;
    _mo = new MutationObserver(() => {
      $$('input.phone:not([data-masked])').forEach(applyPhoneMask);
    });
    _mo.observe(document.body, { childList: true, subtree: true });
  };

  const initMasks = () => {
    $$('input.phone').forEach(applyPhoneMask);
  };

  /* ---------- Автозапуск ---------- */
  const boot = () => {
    initTheme();
    initMasks();
    watchInputs();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* ---------- Public API ---------- */
  return {
    ls,
    uid, money, num, numShort,
    formatDate, formatDateTime, formatTime, relTime, fmtDateRange,
    parseLocalDate, toLocalDateString, toLocalDate,
    escapeHtml, safeJSON,
    debounce, throttle, debouncedSearch,
    clone, hash,
    parsePhone, formatPhone, applyPhoneMask,
    isPhoneValid, isEmailValid, checkPasswordStrength,
    digest, genSalt, genBackupCodes, genPassword,
    fileToBase64, processImage,
    toast, Toast, confirm, prompt,
    groupBy, sumBy, uniq, chunk,
    $, $$, el,
    initTheme, toggleTheme,
    setLoading,
    initMasks, watchInputs,
    MS_PER_DAY, MONTHS, MONTHS_SHORT, DAYS_OF_WEEK, EXPENSE_CATS, ROLES
  };

})();

window.U = U;

/* =========================================================
 *  SHIM для обратной совместимости
 * ========================================================= */
window.App = window.App || {};

App.$ = U.$;
App.$$ = U.$$;
App.el = U.el;

App.uid = (prefix) => U.uid(prefix || 'id');

App.esc = U.escapeHtml;
App.safeJSON = U.safeJSON;

App.fmtMoney = U.money;
App.num = U.num;
App.numShort = U.numShort;

App.fmtDate = U.formatDate;
App.fmtTime = U.formatTime;
App.fmtDateTime = U.formatDateTime;
App.relTime = U.relTime;
App.fmtDateRange = U.fmtDateRange;
App.parseLocalDate = U.parseLocalDate;
App.toLocalDateString = U.toLocalDateString;
App.toLocalDate = U.toLocalDate;

App.normPhone = U.parsePhone;
App.formatPhone = U.formatPhone;
App.applyPhoneMask = U.applyPhoneMask;
App.isValidPhone = U.isPhoneValid;
App.isValidEmail = U.isEmailValid;

App.phoneMask = function(e) {
  if (e && e.target) {
    U.applyPhoneMask(e.target);
    if (e.target.value) {
      e.target.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
};

App.checkPasswordStrength = U.checkPasswordStrength;

App.digest = U.digest;
App.genSalt = U.genSalt;
App.genBackupCodes = U.genBackupCodes;
App.genPassword = U.genPassword;

App.fileToBase64 = U.fileToBase64;
App.processImage = U.processImage;

App.Toast = U.Toast;
App.confirm = U.confirm;
App.prompt = U.prompt;

App.groupBy = U.groupBy;
App.sumBy = U.sumBy;
App.uniq = U.uniq;
App.chunk = U.chunk;

App.clone = U.clone;
App.hash = U.hash;

App.debounce = U.debounce;
App.throttle = U.throttle;
App.debouncedSearch = U.debouncedSearch;

App.ls = U.ls;

App.initTheme = U.initTheme;
App.toggleTheme = U.toggleTheme;

App.setLoading = U.setLoading;

App.MS_PER_DAY = U.MS_PER_DAY;
App.MONTHS = U.MONTHS;
App.MONTHS_SHORT = U.MONTHS_SHORT;
App.DAYS_OF_WEEK = U.DAYS_OF_WEEK;
App.EXPENSE_CATS = U.EXPENSE_CATS;
App.ROLES = U.ROLES;
App.PER_PAGE = 20;

App.CAT_OPTS = {
  'Срезанные':['Розы','Тюльпаны','Пионы','Лилии','Хризантемы','Орхидеи','Гвоздики','Подсолнухи','Зелень','Прочие срезанные'],
  'Комнатные':['Цветущие','Декор-лиственные','Суккуленты','В горшках','Прочие комнатные'],
  'Вазы':['Стекло','Керамика','Хрусталь','Напольные','Декор','Прочие вазы'],
  'Шары':['Латекс','Фольга','Хром','Конфетти','Наборы','Прочие шары'],
  'Открытки':['Открытки','Прочие открытки'],
  'Прочее':['Упаковка','Ленты','Корзины','Губки','Декор','Прочие товары']
};

App.BOUQUET_EXCLUDE_CATS = [
  'Стекло','Керамика','Хрусталь','Напольные','Декор','Латекс',
  'Фольга','Хром','Конфетти','Наборы','Открытки','Упаковка',
  'Ленты','Корзины','Губки'
];

App.getCategoryHTML = function(selected) {
  return Object.entries(App.CAT_OPTS).map(([k, subs]) =>
    `<optgroup label="${U.escapeHtml(k)}">${subs.map(s =>
      `<option value="${U.escapeHtml(s)}" ${selected === s ? 'selected' : ''}>${U.escapeHtml(s)}</option>`
    ).join('')}</optgroup>`
  ).join('');
};

App.state = App.state || {
  page: 'dashboard',
  pages: {},
  search: {},
  calDate: new Date(),
  analyticsTab: 'profit'
};

App._searchTimers = App._searchTimers || {};

App.setPage = function(k, v) { App.state.pages[k] = v || 1; };
App.getPage = function(k) { return App.state.pages[k] || 1; };
App.setSearch = function(k, v) { App.state.search[k] = v; App.setPage(k, 1); };
App.getSearch = function(k) { return App.state.search[k] || ''; };

App.paginate = function(items, pageKey) {
  let p = App.getPage(pageKey);
  const pages = Math.max(1, Math.ceil(items.length / App.PER_PAGE));
  if (p > pages) { p = 1; App.setPage(pageKey, 1); }
  return {
    items: items.slice((p - 1) * App.PER_PAGE, p * App.PER_PAGE),
    page: p,
    pages: pages,
    total: items.length
  };
};

App.pagHTML = function(page, pages) {
  if (pages <= 1) return '';
  let h = '<div style="display:flex;gap:6px;justify-content:center;margin-top:16px;flex-wrap:wrap;align-items:center">';
  h += `<button class="btn g" ${page === 1 ? 'disabled' : ''} data-pg="${page - 1}">‹</button>`;
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || (i >= page - 2 && i <= page + 2)) {
      h += `<button class="btn ${i === page ? '' : 'g'}" data-pg="${i}">${i}</button>`;
    } else if (i === page - 3 || i === page + 3) {
      h += '<span style="padding:8px;color:var(--t3)">…</span>';
    }
  }
  h += `<button class="btn g" ${page === pages ? 'disabled' : ''} data-pg="${page + 1}">›</button></div>`;
  return h;
};

App.navigateTo = App.navigateTo || function(page) {
  App.state.page = page;
  if (typeof App.renderNav === 'function') App.renderNav();
  if (typeof App.renderView === 'function') App.renderView();
};

App.rerender = App.rerender || function() {
  if (typeof App.renderView === 'function') App.renderView();
};

App._chartInstances = App._chartInstances || [];

App.destroyAllCharts = App.destroyAllCharts || function() {
  (App._chartInstances || []).forEach(c => {
    if (c) try { c.destroy(); } catch (e) { /* ignore */ }
  });
  App._chartInstances = [];
};

App._approveLock = App._approveLock || new Set();
App._savingOrder = App._savingOrder || false;

App.getSetting = App.getSetting || async function(k, def) {
  try {
    const s = await App.DB.get('settings', k);
    return s ? s.value : def;
  } catch {
    return def;
  }
};

App.setSetting = App.setSetting || async function(k, val) {
  try {
    await App.DB.put('settings', { id: k, value: val });
  } catch { /* ignore */ }
};

App._reservedCache = App._reservedCache || {};
App._reservedCacheTs = App._reservedCacheTs || 0;

App.getReservedQty = App.getReservedQty || async function(flowerId) {
  const now = Date.now();
  if (now - App._reservedCacheTs > 30000) {
    App._reservedCache = {};
    App._reservedCacheTs = now;

    try {
      const orders = await App.DB.all('orders');
      for (const o of orders) {
        if (o.status === 'completed' || o.status === 'cancelled') continue;
        for (const it of (o.items || [])) {
          if (it.type === 'flower') {
            App._reservedCache[it.flowerId] = (App._reservedCache[it.flowerId] || 0) + (it.quantity || 0);
          } else if (it.type === 'bouquet') {
            for (const c of (it.components || [])) {
              App._reservedCache[c.flowerId] = (App._reservedCache[c.flowerId] || 0) + (c.quantity || 0) * (it.quantity || 1);
            }
          }
        }
      }
    } catch (e) {
      console.warn('getReservedQty cache error:', e);
    }
  }

  return App._reservedCache[flowerId] || 0;
};

App.recordStockMovement = App.recordStockMovement || async function(flowerId, delta, reason) {
  try {
    if (!App.DB?.db) return;
    await App.DB.put('stock_movements', {
      id: U.uid('mv'),
      flowerId,
      delta,
      reason: reason || '',
      userId: App.Auth?.user?.id || null,
      ts: Date.now()
    });
  } catch (e) {
    console.warn('recordStockMovement error:', e);
  }
};

(async () => {
  try {
    console.log('🔍 Самодиагностика крипто-функций...');

    if (!window.crypto?.subtle) {
      console.error('❌ Web Crypto API НЕДОСТУПЕН!');
      return;
    }
    console.log('✅ crypto.subtle доступен');

    const salt = await U.genSalt();
    console.log('✅ genSalt работает:', salt.length, 'символов');

    const hash = await U.digest('test', salt);
    console.log('✅ digest работает:', hash.length, 'символов');

    console.log('🎉 Все крипто-функции работают!');
  } catch (e) {
    console.error('❌ Крипто-диагностика провалена:', e);
  }
})();

console.log('✅ utils.js загружен (v2.4 с исправленной маской)');