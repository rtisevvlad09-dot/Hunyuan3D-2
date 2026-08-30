// js/services/sync.js
// v2.0 — Supabase синхронизация (исправленная версия)

window.App = window.App || {};

App.SyncManager = {
  online: navigator.onLine,
  syncing: false,
  queue: [],
  _pullTs: 0,

  async init() {
    console.log('☁️ SyncManager: инициализация...');

    // Загружаем очередь из IndexedDB
    try {
      this.queue = await App.DB.all('sync_queue') || [];
    } catch (e) {
      this.queue = [];
    }

    // Слушаем онлайн/оффлайн события
    window.addEventListener('online', () => {
      this.online = true;
      this._updateStatus();
      this.fullSync().catch(() => {});
    });

    window.addEventListener('offline', () => {
      this.online = false;
      this._updateStatus();
    });

    // Периодическая проверка (каждые 60 сек)
    setInterval(() => {
      if (this.online && !this.syncing && App.Auth?.user) {
        this.fullSync().catch(() => {});
      }
    }, 60000);

    this._updateStatus();

    // Пробуем синхронизировать сразу если онлайн
    if (this.online && App.Auth?.user) {
      setTimeout(() => this.fullSync().catch(() => {}), 2000);
    }
  },

  _updateStatus() {
    const dot = document.getElementById('syncDot');
    const txt = document.getElementById('syncTxt');
    const queueCount = document.getElementById('syncQueueCount');

    if (!dot || !txt) return;

    if (this.syncing) {
      dot.className = 'sync-dot busy';
      txt.textContent = 'Синхронизация...';
    } else if (this.online) {
      dot.className = 'sync-dot on';
      txt.textContent = 'Онлайн';
    } else {
      dot.className = 'sync-dot off';
      txt.textContent = 'Оффлайн';
    }

    if (queueCount) {
      const count = this.queue.length;
      queueCount.textContent = count;
      queueCount.classList.toggle('hidden', count === 0);
    }
  },

  async enqueue(store, item, action = 'upsert') {
    // Если синхронизация не настроена — игнорируем
    const url = await App.getSetting?.('supabaseUrl');
    if (!url) return;

    const entry = {
      id: App.uid('sq'),
      store,
      action,
      item,
      ts: Date.now()
    };

    try {
      await App.DB.put('sync_queue', entry);
      this.queue.push(entry);
      this._updateStatus();

      // Если онлайн — пытаемся отправить
      if (this.online && !this.syncing) {
        this._processQueue().catch(() => {});
      }
    } catch (e) {
      console.warn('SyncManager enqueue error:', e);
    }
  },

  async fullSync() {
    if (!this.online || this.syncing || !App.Auth?.user) return;

    const url = await App.getSetting?.('supabaseUrl');
    const key = await App.getSetting?.('supabaseKey');

    if (!url || !key) return; // Supabase не настроен

    this.syncing = true;
    this._updateStatus();

    try {
      // 1. Отправляем очередь
      await this._processQueue();

      // 2. Тянем свежие данные с сервера
      await this._pull();

      this._pullTs = Date.now();
      App.ls.set('flo_last_sync', String(this._pullTs));

    } catch (e) {
      console.warn('SyncManager fullSync error:', e);
    } finally {
      this.syncing = false;
      this._updateStatus();
    }
  },

  async _processQueue() {
    if (!this.queue.length) return;

    const url = await App.getSetting?.('supabaseUrl');
    const key = await App.getSetting?.('supabaseKey');
    if (!url || !key) return;

    const toRemove = [];

    for (const entry of this.queue) {
      try {
        const endpoint = `${url}/rest/v1/${entry.store}`;
        const headers = {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Prefer': 'resolution=merge-duplicates'
        };

        if (entry.action === 'delete') {
          await fetch(`${endpoint}?id=eq.${entry.item.id}`, {
            method: 'DELETE',
            headers
          });
        } else {
          await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(entry.item)
          });
        }

        toRemove.push(entry.id);
      } catch (e) {
        console.warn(`SyncManager: не удалось отправить ${entry.store}/${entry.item?.id}:`, e);
        break; // Останавливаемся на первой ошибке
      }
    }

    // Удаляем успешно отправленные
    for (const id of toRemove) {
      try {
        await App.DB.del('sync_queue', id);
        this.queue = this.queue.filter(q => q.id !== id);
      } catch (e) {
        console.warn('SyncManager remove from queue error:', e);
      }
    }

    this._updateStatus();
  },

  async _pull() {
    const url = await App.getSetting?.('supabaseUrl');
    const key = await App.getSetting?.('supabaseKey');
    if (!url || !key) return;

    const lastPull = parseInt(App.ls.get('flo_last_pull') || '0');
    const stores = App.SYNC_STORES || ['orders', 'clients', 'flowers'];

    for (const store of stores) {
      try {
        const endpoint = `${url}/rest/v1/${store}?_syncTs=gt.${lastPull}&select=*`;
        const res = await fetch(endpoint, {
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
          }
        });

        if (!res.ok) continue;

        const items = await res.json();
        for (const item of items) {
          if (item && item.id) {
            try {
              await App.DB.put(store, item);
            } catch (e) {
              console.warn(`SyncManager pull ${store} error:`, e);
            }
          }
        }
      } catch (e) {
        console.warn(`SyncManager pull ${store} error:`, e);
      }
    }

    App.ls.set('flo_last_pull', String(Date.now()));
  },

  async manualSync() {
    App.Toast.in('Синхронизация...');
    await this.fullSync();
    App.Toast.ok('Синхронизация завершена');

    // Перерисовать текущий вид
    if (typeof App.rerender === 'function') {
      App.rerender();
    }
  },

  async reset() {
    this.queue = [];
    try {
      await App.DB.clear('sync_queue');
    } catch (e) {
      console.warn('SyncManager reset error:', e);
    }
    this._updateStatus();
    App.Toast.ok('Очередь синхронизации очищена');
  }
};

// Список хранилищ для синхронизации
App.SYNC_STORES = [
  'orders', 'clients', 'flowers', 'expenses',
  'supplies', 'returns', 'writeoffs', 'bouquets'
];

console.log('✅ sync.js загружен');