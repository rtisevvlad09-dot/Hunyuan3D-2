// ===== МОДАЛЬНЫЕ ОКНА И ТЕМА =====
// js/core/modal.js
// v2.0 — с accessibility, trap focus, confirm/prompt

window.App = window.App || {};

/* ---------- Модальные окна ---------- */
App.Modal = {
  _overlay: null,
  _isOpen: false,
  _focusTrap: null,
  _lastFocus: null,

  init() {
    this._overlay = App.$('#modalOverlay');
    if (!this._overlay) return;

    // Закрытие по клику на overlay
    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay) {
        this.close();
      }
    });

    // Закрытие по Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._isOpen) {
        this.close();
      }
    });
  },

  open(title, bodyHtml, options = {}) {
    if (!this._overlay) {
      this._overlay = App.$('#modalOverlay');
    }
    if (!this._overlay) return;

    // Сохраняем текущий фокус
    this._lastFocus = document.activeElement;

    // Устанавливаем заголовок (с защитой от XSS)
    const titleEl = App.$('#mTitle');
    if (titleEl) {
      titleEl.textContent = title || 'Заголовок';
    }

    // Устанавливаем тело модалки
    const bodyEl = App.$('#mBody');
    if (bodyEl) {
      // Если передан DOM элемент, вставляем его
      if (bodyHtml instanceof HTMLElement) {
        bodyEl.innerHTML = '';
        bodyEl.appendChild(bodyHtml);
      } else if (typeof bodyHtml === 'string') {
        bodyEl.innerHTML = bodyHtml;
      } else {
        bodyEl.innerHTML = '';
      }
    }

    // Закрываем кнопку закрытия если нужно
    const closeBtn = App.$('#modalClose');
    if (closeBtn) {
      closeBtn.style.display = options.hideClose ? 'none' : 'block';
      closeBtn.onclick = () => this.close();
    }

    // Открываем модалку
    this._overlay.classList.add('on');
    this._isOpen = true;

    // Блокируем скролл body
    document.body.style.overflow = 'hidden';

    // Trap focus
    this._setupFocusTrap();

    // Фокус на первый input если есть
    setTimeout(() => {
      const firstInput = bodyEl?.querySelector('input, select, textarea, button');
      if (firstInput && !options.noAutoFocus) {
        firstInput.focus();
      }
    }, 100);

    // Callback при открытии
    if (typeof options.onOpen === 'function') {
      options.onOpen();
    }
  },

  close() {
    if (!this._overlay || !this._isOpen) return;

    this._overlay.classList.remove('on');
    this._isOpen = false;

    // Разблокируем скролл
    document.body.style.overflow = '';

    // Убираем trap focus
    this._removeFocusTrap();

    // Возвращаем фокус
    if (this._lastFocus && typeof this._lastFocus.focus === 'function') {
      this._lastFocus.focus();
    }

    // Callback при закрытии
    if (typeof this._onCloseCallback === 'function') {
      this._onCloseCallback();
      this._onCloseCallback = null;
    }
  },

  body() {
    return App.$('#mBody');
  },

  _setupFocusTrap() {
    if (!this._overlay) return;

    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    const focusableElements = this._overlay.querySelectorAll(focusableSelectors);
    if (focusableElements.length === 0) return;

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    this._focusTrap = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    this._overlay.addEventListener('keydown', this._focusTrap);
  },

  _removeFocusTrap() {
    if (this._overlay && this._focusTrap) {
      this._overlay.removeEventListener('keydown', this._focusTrap);
      this._focusTrap = null;
    }
  },

  /* ---------- Утилиты для модалок ---------- */

  // Простое уведомление
  alert(msg, title = 'Информация') {
    return new Promise((resolve) => {
      const html = `
        <div style="text-align:center;padding:20px">
          <p style="font-size:16px;margin-bottom:20px">${App.esc(msg)}</p>
          <button class="btn" id="modalAlertOk">OK</button>
        </div>
      `;
      this.open(title, html);

      const okBtn = App.$('#modalAlertOk');
      if (okBtn) {
        okBtn.onclick = () => {
          this.close();
          resolve();
        };
      }
    });
  },

  // Подтверждение действия
  confirm(msg, title = 'Подтверждение', options = {}) {
    return new Promise((resolve) => {
      const html = `
        <div style="padding:20px">
          <p style="font-size:15px;margin-bottom:24px">${App.esc(msg)}</p>
          <div style="display:flex;gap:12px;justify-content:flex-end">
            <button class="btn g" id="modalConfirmCancel">${options.cancelText || 'Отмена'}</button>
            <button class="btn ${options.danger ? 'd' : ''}" id="modalConfirmOk">
              ${options.okText || 'Подтвердить'}
            </button>
          </div>
        </div>
      `;
      this.open(title, html);

      const okBtn = App.$('#modalConfirmOk');
      const cancelBtn = App.$('#modalConfirmCancel');

      if (okBtn) {
        okBtn.onclick = () => {
          this.close();
          resolve(true);
        };
      }

      if (cancelBtn) {
        cancelBtn.onclick = () => {
          this.close();
          resolve(false);
        };
      }

      this._onCloseCallback = () => resolve(false);
    });
  },

  // Ввод данных
  prompt(msg, title = 'Введите значение', defaultValue = '') {
    return new Promise((resolve) => {
      const html = `
        <div style="padding:20px">
          <p style="font-size:15px;margin-bottom:16px">${App.esc(msg)}</p>
          <input type="text" class="inp" id="modalPromptInput" value="${App.esc(defaultValue)}" style="margin-bottom:20px">
          <div style="display:flex;gap:12px;justify-content:flex-end">
            <button class="btn g" id="modalPromptCancel">Отмена</button>
            <button class="btn" id="modalPromptOk">OK</button>
          </div>
        </div>
      `;
      this.open(title, html);

      const input = App.$('#modalPromptInput');
      const okBtn = App.$('#modalPromptOk');
      const cancelBtn = App.$('#modalPromptCancel');

      if (input) {
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.close();
            resolve(input.value);
          }
        });
      }

      if (okBtn) {
        okBtn.onclick = () => {
          this.close();
          resolve(input ? input.value : '');
        };
      }

      if (cancelBtn) {
        cancelBtn.onclick = () => {
          this.close();
          resolve(null);
        };
      }

      this._onCloseCallback = () => resolve(null);
    });
  },

  // Установка callback при закрытии
  onClose(callback) {
    this._onCloseCallback = callback;
  }
};

/* ---------- Тема ---------- */
App.Theme = {
  init() {
    const saved = App.ls.get('flo_theme');
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');

    document.documentElement.dataset.theme = theme;

    const themeBtn = App.$('#themeBtn');
    if (themeBtn) {
      themeBtn.textContent = theme === 'dark' ? '☀️' : '🌓';
      themeBtn.title = theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему';
    }
  },

  toggle() {
    const cur = document.documentElement.dataset.theme || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';

    document.documentElement.dataset.theme = next;
    App.ls.set('flo_theme', next);

    const themeBtn = App.$('#themeBtn');
    if (themeBtn) {
      themeBtn.textContent = next === 'dark' ? '☀️' : '🌓';
      themeBtn.title = next === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему';
    }

    // Перерисовываем аналитику если она открыта (графики Chart.js зависят от темы)
    if (App.state && App.state.page === 'analytics' && typeof App.renderAnalytics === 'function') {
      App.renderAnalytics();
    }
  },

  get() {
    return document.documentElement.dataset.theme || 'light';
  },

  isDark() {
    return this.get() === 'dark';
  }
};

/* ---------- Автоинициализация ---------- */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    App.Modal.init();
    App.Theme.init();
  });
} else {
  App.Modal.init();
  App.Theme.init();
}

console.log('✅ modal.js загружен');