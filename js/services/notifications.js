// ===== УВЕДОМЛЕНИЯ =====
// js/services/notifications.js
// v2.0 — с Browser API, звуком, каналами, ротацией

window.App = window.App || {};

/* ---------- Типы уведомлений ---------- */
App.NOTIF_TYPES = {
  stock:   { icon: '📦', label: 'Остатки',   color: 'var(--warn)' },
  order:   { icon: '🧾', label: 'Заказы',    color: 'var(--info)' },
  sync:    { icon: '☁️', label: 'Синхронизация', color: 'var(--t3)' },
  user:    { icon: '👤', label: 'Пользователи', color: 'var(--pl)' },
  system:  { icon: '⚙️', label: 'Система',   color: 'var(--t2)' },
  shift:   { icon: '⏰', label: 'Смены',     color: 'var(--good)' },
  expense: { icon: '💸', label: 'Расходы',   color: 'var(--bad)' },
  return:  { icon: '↩️', label: 'Возвраты',  color: 'var(--warn)' },
  writeoff:{ icon: '📉', label: 'Списания',  color: 'var(--bad)' },
  bouquet: { icon: '💐', label: 'Букеты',    color: 'var(--pl)' }
};

/* ---------- Константы ---------- */
const NOTIF_CONFIG = {
  MAX_STORED: 200,          // Максимум уведомлений в БД
  MAX_IN_PANEL: 50,         // Показывать в панели
  LOW_STOCK_DEBOUNCE: 60000, // Проверка остатков не чаще раза в минуту
  ROTATION_DAYS: 30,        // Удалять прочитанные старше 30 дней
  SOUND_ENABLED_KEY: 'flo_notif_sound',
  CHANNELS_KEY: 'flo_notif_channels'
};

/* ---------- Звуковой сигнал (генерируется через Web Audio) ---------- */
const sound = {
  _ctx: null,
  _enabled: true,

  init() {
    try {
      const saved = App.ls.get(NOTIF_CONFIG.SOUND_ENABLED_KEY);
      this._enabled = saved !== 'false';
    } catch {
      this._enabled = true;
    }
  },

  setEnabled(v) {
    this._enabled = !!v;
    App.ls.set(NOTIF_CONFIG.SOUND_ENABLED_KEY, v ? 'true' : 'false');
  },

  isEnabled() {
    return this._enabled;
  },

  play(type = 'default') {
    if (!this._enabled) return;

    try {
      if (!this._ctx) {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      }

      const ctx = this._ctx;
      if (ctx.state === 'suspended') ctx.resume();

      // Разные мелодии для разных типов
      const patterns = {
        order:    [{ f: 880, d: 0.1 }, { f: 1175, d: 0.15 }],
        stock:    [{ f: 440, d: 0.2 }],
        error:    [{ f: 220, d: 0.1 }, { f: 180, d: 0.2 }],
        default:  [{ f: 660, d: 0.08 }]
      };

      const pattern = patterns[type] || patterns.default;
      let time = ctx.currentTime;

      pattern.forEach(note => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = note.f;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.1, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + note.d);
        osc.start(time);
        osc.stop(time + note.d);
        time += note.d;
      });
    } catch {
      // Web Audio может быть недоступен
    }
  }
};

/* ---------- Объект Notify ---------- */
App.Notify = {
  _lastLowStockCheck: 0,
  _panelListenerAttached: false,
  _panelOpen: false,

  /* ===== Каналы (какие типы включены) ===== */
  _getChannels() {
    try {
      const raw = App.ls.get(NOTIF_CONFIG.CHANNELS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  _saveChannels(channels) {
    App.ls.set(NOTIF_CONFIG.CHANNELS_KEY, JSON.stringify(channels));
  },

  getEnabledChannels() {
    const saved = this._getChannels();
    if (saved) return saved;
    // По умолчанию включены все
    const all = {};
    Object.keys(App.NOTIF_TYPES).forEach(k => all[k] = true);
    return all;
  },

  isChannelEnabled(type) {
    return this.getEnabledChannels()[type] !== false;
  },

  setChannelEnabled(type, enabled) {
    const ch = this.getEnabledChannels();
    ch[type] = !!enabled;
    this._saveChannels(ch);
    this.refreshBadge();
  },

  /* ===== Добавление уведомления ===== */
  async add(type, title, body, options = {}) {
    // Проверка что канал включён
    if (type && !this.isChannelEnabled(type)) {
      return null;
    }

    // Валидация типа
    if (!App.NOTIF_TYPES[type]) {
      type = 'system';
    }

    const n = {
      id: App.uid(),
      type,
      title: String(title || '').slice(0, 100),
      body: String(body || '').slice(0, 500),
      ts: Date.now(),
      read: false,
      refId: options.refId || null,      // Связанная запись (id заказа/цветка)
      action: options.action || null,    // Действие при клике
      priority: options.priority || 'normal' // low | normal | high
    };

    try {
      await App.repo('notifications').save(n);
    } catch (e) {
      console.error('❌ Notify.add error:', e);
      return null;
    }

    await this.refreshBadge();

    // Browser Notification
    if (options.browser !== false && n.priority !== 'low') {
      this._showBrowserNotification(n);
    }

    // Звук для важных уведом
    if (options.sound !== false && n.priority !== 'low') {
      const soundType = type === 'order' ? 'order'
                      : type === 'stock' ? 'stock'
                      : type === 'error' ? 'error'
                      : 'default';
      sound.play(soundType);
    }

    // Если панель открыта — обновляем её
    if (this._panelOpen) {
      this.renderPanel();
    }

    // Ротация (раз в 50 уведомлений)
    const count = await App.repo('notifications').count();
    if (count > NOTIF_CONFIG.MAX_STORED && count % 50 === 0) {
      this.rotate();
    }

    return n;
  },

  /* ===== Browser Notifications API ===== */
  async requestPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';

    try {
      const result = await Notification.requestPermission();
      return result;
    } catch {
      return 'error';
    }
  },

  _showBrowserNotification(n) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    // Не показываем если вкладка активна
    if (document.hasFocus && document.hasFocus()) return;

    try {
      const notif = new Notification(n.title, {
        body: n.body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌸</text></svg>',
        tag: n.id,
        requireInteraction: n.priority === 'high'
      });

      notif.onclick = () => {
        window.focus();
        if (n.action && typeof App.handleNotificationClick === 'function') {
          App.handleNotificationClick(n);
        }
        notif.close();
      };

      // Автозакрытие через 5 секунд (кроме high priority)
      if (n.priority !== 'high') {
        setTimeout(() => notif.close(), 5000);
      }
    } catch (e) {
      console.warn('Browser notification error:', e);
    }
  },

  /* ===== Обновление badge (счётчика) ===== */
  async refreshBadge() {
    try {
      const all = await App.repo('notifications').all();
      const enabledChannels = this.getEnabledChannels();

      // Считаем только непрочитанные по включённым каналам
      const unread = all.filter(n =>
        !n.read && enabledChannels[n.type] !== false
      );

      const count = unread.length;
      const badge = App.$('#notifBadge');

      if (badge) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.classList.toggle('hidden', count === 0);
      }

      // Обновляем title страницы (для видимости в вкладке)
      const baseTitle = 'FLO.RISTA Pro — ERP v14.2';
      document.title = count > 0 ? `(${count}) ${baseTitle}` : baseTitle;

      return count;
    } catch (e) {
      console.warn('refreshBadge error:', e);
      return 0;
    }
  },

  /* ===== Рендер панели ===== */
  async renderPanel() {
    const panel = App.$('#notifPanel');
    if (!panel) return;

    this._panelOpen = true;

    try {
      let all = await App.repo('notifications').all();

      // Сортировка: новые сверху
      all.sort((a, b) => (b.ts || 0) - (a.ts || 0));

      // Лимит
      all = all.slice(0, NOTIF_CONFIG.MAX_IN_PANEL);

      if (!all.length) {
        panel.innerHTML = `
          <div class="notif-item" style="justify-content:center;text-align:center;padding:24px">
            <div>
              <div style="font-size:36px;margin-bottom:8px">✨</div>
              <div style="color:var(--t3)">Нет уведомлений</div>
            </div>
          </div>
          <div style="text-align:right;padding:8px;border-top:1px solid var(--b)">
            <button class="btn g" data-notif-action="close">Закрыть</button>
          </div>`;
      } else {
        panel.innerHTML = `
          <div style="padding:10px 16px;border-bottom:1px solid var(--b);display:flex;justify-content:space-between;align-items:center">
            <strong style="font-size:14px">Уведомления</strong>
            <div style="display:flex;gap:6px">
              <button class="btn g" data-notif-action="markAllRead" style="padding:4px 10px;font-size:11px">✓ Прочитать все</button>
              <button class="btn g" data-notif-action="clearAll" style="padding:4px 10px;font-size:11px">🗑️ Очистить</button>
            </div>
          </div>
          ${all.map(n => this._renderItem(n)).join('')}
          <div style="text-align:right;padding:8px;border-top:1px solid var(--b)">
            <button class="btn g" data-notif-action="close">Закрыть</button>
          </div>`;
      }

      // Event delegation — ОДИН раз
      this._attachPanelListener(panel);

      // Помечаем показанные как прочитанные (с задержкой, чтобы пользователь успел увидеть)
      setTimeout(async () => {
        const unread = all.filter(n => !n.read);
        if (unread.length > 0) {
          for (const n of unread) {
            await App.repo('notifications').update(n.id, { read: true });
          }
          await this.refreshBadge();
        }
      }, 1500);

    } catch (e) {
      console.error('renderPanel error:', e);
      panel.innerHTML = '<div class="notif-item">Ошибка загрузки</div>';
    }
  },

  _renderItem(n) {
    const typeInfo = App.NOTIF_TYPES[n.type] || { icon: '🔔', label: 'Система' };
    const unreadStyle = n.read ? 'opacity:.65' : '';
    const unreadDot = n.read ? '' : '<span style="width:8px;height:8px;background:var(--p);border-radius:50%;display:inline-block;margin-left:6px"></span>';

    return `
      <div class="notif-item" style="${unreadStyle}" data-notif-id="${App.esc(n.id)}" ${n.refId ? `data-ref-id="${App.esc(n.refId)}"` : ''} ${n.action ? `data-action="${App.esc(n.action)}"` : ''}>
        <span class="ico" style="font-size:22px">${typeInfo.icon}</span>
        <div style="flex:1;min-width:0">
          <strong style="display:block;margin-bottom:2px;font-size:13px">${App.esc(n.title)}${unreadDot}</strong>
          <div style="color:var(--t2);font-size:12px;line-height:1.4">${App.esc(n.body)}</div>
          <div style="font-size:10px;color:var(--t3);margin-top:4px">${App.relTime(n.ts)}</div>
        </div>
        <button class="btn g" data-notif-action="delete" data-id="${App.esc(n.id)}" style="padding:4px 8px;font-size:11px">×</button>
      </div>`;
  },

  /* ===== Event delegation для панели ===== */
  _attachPanelListener(panel) {
    if (this._panelListenerAttached) return;
    this._panelListenerAttached = true;

    panel.addEventListener('click', async (e) => {
      const actionBtn = e.target.closest('[data-notif-action]');

      if (actionBtn) {
        e.stopPropagation();
        const action = actionBtn.dataset.notifAction;
        const id = actionBtn.dataset.id;

        if (action === 'close') {
          this.closePanel();
        } else if (action === 'delete' && id) {
          await this.delete(id);
          this.renderPanel();
        } else if (action === 'markAllRead') {
          await this.markAllAsRead();
          this.renderPanel();
        } else if (action === 'clearAll') {
          await this.clearAll();
          this.renderPanel();
        }
        return;
      }

      // Клик по самому уведомлению
      const item = e.target.closest('.notif-item[data-notif-id]');
      if (item) {
        const id = item.dataset.notifId;
        const refId = item.dataset.refId;
        const action = item.dataset.action;

        // Помечаем как прочитанное
        await this.markAsRead(id);

        // Выполняем действие если есть
        if (action && typeof App.handleNotificationClick === 'function') {
          App.handleNotificationClick({ id, refId, action });
        } else if (refId) {
          // Если нет хэндлера, но есть refId — пытаемся угадать страницу
          this._navigateToRef(refId);
        }

        this.closePanel();
      }
    });
  },

  _navigateToRef(refId) {
    // Простая эвристика: по префиксу id определяем страницу
    if (!refId) return;
    const prefix = refId.split('_')[0];
    const map = {
      ord: 'orders',
      flw: 'flowers',
      cln: 'clients',
      bqt: 'bouquets',
      shf: 'shifts',
      exp: 'expenses'
    };
    const page = map[prefix];
    if (page && typeof App.navigateTo === 'function') {
      App.navigateTo(page);
    }
  },

  closePanel() {
    const panel = App.$('#notifPanel');
    if (panel) panel.classList.remove('on');
    this._panelOpen = false;
  },

  togglePanel() {
    const panel = App.$('#notifPanel');
    if (!panel) return;

    if (panel.classList.contains('on')) {
      this.closePanel();
    } else {
      panel.classList.add('on');
      this.renderPanel();
    }
  },

  /* ===== CRUD операции ===== */
  async markAsRead(id) {
    try {
      await App.repo('notifications').update(id, { read: true });
      await this.refreshBadge();
    } catch { /* ignore */ }
  },

  async markAllAsRead() {
    try {
      const all = await App.repo('notifications').find(n => !n.read);
      for (const n of all) {
        await App.repo('notifications').update(n.id, { read: true });
      }
      await this.refreshBadge();
      App.Toast.ok('Все уведомления прочитаны');
    } catch (e) {
      App.Toast.er('Ошибка: ' + e.message);
    }
  },

  async delete(id) {
    try {
      await App.repo('notifications').remove(id);
      await this.refreshBadge();
    } catch { /* ignore */ }
  },

  async clearAll() {
    try {
      const confirmed = await App.Modal.confirm('Удалить все уведомления?');
      if (!confirmed) return;

      await App.repo('notifications').clear();
      await this.refreshBadge();
      App.Toast.ok('Все уведомления удалены');
    } catch (e) {
      App.Toast.er('Ошибка: ' + e.message);
    }
  },

  /* ===== Ротация (удаление старых прочитанных) ===== */
  async rotate() {
    try {
      const cutoff = Date.now() - (NOTIF_CONFIG.ROTATION_DAYS * 24 * 60 * 60 * 1000);
      const all = await App.repo('notifications').all();

      // Удаляем прочитанные старше 30 дней
      const toDelete = all.filter(n => n.read && n.ts < cutoff);

      if (toDelete.length === 0) return;

      const ids = toDelete.map(n => n.id);
      await App.repo('notifications').bulkRemove(ids);

      console.log(`🗑️ Notify: удалено ${ids.length} старых уведомлений`);
    } catch (e) {
      console.warn('Notify rotation error:', e);
    }
  },

  /* ===== Проверка низких остатков (с debounce) ===== */
  async checkLowStock() {
    const now = Date.now();
    if (now - this._lastLowStockCheck < NOTIF_CONFIG.LOW_STOCK_DEBOUNCE) {
      return; // Чаще раза в минуту не проверяем
    }
    this._lastLowStockCheck = now;

    try {
      const threshold = await App.getSetting('lowStockThreshold', 3);
      const flowers = await App.repo('flowers').all();
      const low = flowers.filter(f => f.active !== false && f.stock <= threshold);

      const DAY = 86400000;
      const existingNotifs = await App.repo('notifications').all();
      let added = 0;

      for (const f of low) {
        const existing = existingNotifs.find(n =>
          n.type === 'stock' && n.refId === f.id
        );

        // Создаём новое только если нет или прошло больше суток
        if (!existing || (now - (existing.lastNotify || 0)) > DAY) {
          await this.add('stock', 'Низкий остаток',
            `${f.emoji || '🌸'} ${f.name}: осталось ${f.stock} шт`,
            {
              refId: f.id,
              priority: f.stock === 0 ? 'high' : 'normal',
              browser: f.stock === 0, // Browser notification только если 0
              sound: f.stock === 0
            }
          );

          // Обновляем lastNotify в существующем
          if (existing) {
            await App.repo('notifications').update(existing.id, {
              lastNotify: now,
              body: `${f.emoji || '🌸'} ${f.name}: осталось ${f.stock} шт`
            });
          }

          added++;
        }
      }

      if (added > 0) {
        console.log(`📦 Notify: создано ${added} уведомлений о низких остатках`);
      }
    } catch (e) {
      console.error('checkLowStock error:', e);
    }
  },

  /* ===== Статистика для UI ===== */
  async getStats() {
    try {
      const all = await App.repo('notifications').all();
      const byType = {};
      let unread = 0;
      let today = 0;
      const todayTs = new Date().setHours(0, 0, 0, 0);

      all.forEach(n => {
        byType[n.type] = (byType[n.type] || 0) + 1;
        if (!n.read) unread++;
        if (n.ts >= todayTs) today++;
      });

      return {
        total: all.length,
        unread,
        today,
        byType
      };
    } catch {
      return { total: 0, unread: 0, today: 0, byType: {} };
    }
  },

  /* ===== Инициализация ===== */
  async init() {
    sound.init();

    // Запрашиваем разрешение на Browser Notifications (ненавязчиво)
    if ('Notification' in window && Notification.permission === 'default') {
      // Запросим при первом клике пользователя
      const requestOnce = async () => {
        await this.requestPermission();
        document.removeEventListener('click', requestOnce);
      };
      document.addEventListener('click', requestOnce, { once: true });
    }

    // Клик по кнопке уведомлений
    const btn = App.$('#notifBtn');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePanel();
      });
    }

    // Закрытие панели при клике вне её
    document.addEventListener('click', (e) => {
      const panel = App.$('#notifPanel');
      const btn = App.$('#notifBtn');
      if (panel && panel.classList.contains('on') &&
          !panel.contains(e.target) && !btn?.contains(e.target)) {
        this.closePanel();
      }
    });

    await this.refreshBadge();
    console.log('✅ notifications.js инициализирован');
  }
};

console.log('✅ notifications.js загружен');