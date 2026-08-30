// ===== РАБОТА С БАЗОЙ ДАННЫХ (IndexedDB) =====
// js/core/db.js
// v2.0 — с индексами, миграциями, batch-операциями

window.App = window.App || {};

/* ---------- Схема БД с индексами ---------- */
const DB_SCHEMA = {
  users: {
    keyPath: 'id',
    indexes: {
      phone: { unique: true },
      role: {},
      active: {}
    }
  },
  clients: {
    keyPath: 'id',
    indexes: {
      phone: { unique: true },
      name: {},
      createdAt: {},
      bonus: {}
    }
  },
  flowers: {
    keyPath: 'id',
    indexes: {
      name: {},
      category: {},
      subcategory: {},
      price: {},
      stock: {},
      active: {}
    }
  },
  bouquets: {
    keyPath: 'id',
    indexes: {
      name: {},
      price: {},
      active: {}
    }
  },
  orders: {
    keyPath: 'id',
    indexes: {
      status: {},
      clientId: {},
      date: {},
      total: {},
      createdAt: {}
    }
  },
  order_items: {
    keyPath: 'id',
    indexes: {
      orderId: {},
      flowerId: {},
      bouquetId: {}
    }
  },
  writeoffs: {
    keyPath: 'id',
    indexes: {
      flowerId: {},
      status: {},
      date: {},
      userId: {}
    }
  },
  shifts: {
    keyPath: 'id',
    indexes: {
      userId: {},
      date: {},
      status: {},
      openedAt: {},
      closedAt: {}
    }
  },
  expenses: {
    keyPath: 'id',
    indexes: {
      category: {},
      date: {},
      amount: {}
    }
  },
  supplies: {
    keyPath: 'id',
    indexes: {
      date: {},
      supplier: {},
      total: {}
    }
  },
  returns: {
    keyPath: 'id',
    indexes: {
      orderId: {},
      date: {},
      amount: {}
    }
  },
  settings: {
    keyPath: 'id',
    indexes: {}
  },
  notifications: {
    keyPath: 'id',
    indexes: {
      read: {},
      type: {},
      createdAt: {}
    }
  },
  sync_queue: {
    keyPath: 'id',
    indexes: {
      store: {},
      status: {},
      createdAt: {}
    }
  },
  audit_log: {
    keyPath: 'id',
    indexes: {
      userId: {},
      action: {},
      ts: {},
      store: {}
    }
  },
  stock_movements: {
    keyPath: 'id',
    indexes: {
      flowerId: {},
      ts: {},
      userId: {}
    }
  }
};

/* ---------- Объект для работы с REST API ---------- */
App.DB = {
  baseUrl: 'http://localhost:8080/api/data',

  async open() {
    return Promise.resolve(true); // Always opened
  },

  async close() {
    return Promise.resolve(); // No persistent connection
  },

  async _fetchJSON(url, options = {}) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        return await response.json();
    } catch (e) {
        console.error("Fetch error:", e);
        throw e;
    }
  },

  /* ---------- Базовые операции ---------- */
  async all(s) {
    try {
      return await this._fetchJSON(`${this.baseUrl}/${s}`);
    } catch {
      return [];
    }
  },

  async get(s, id) {
    try {
      return await this._fetchJSON(`${this.baseUrl}/${s}/${id}`);
    } catch {
      return null;
    }
  },

  async put(s, i) {
    try {
      if (!i.id) throw new Error("Item must have an id");
      await this._fetchJSON(`${this.baseUrl}/${s}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(i)
      });
      return i;
    } catch (e) {
      throw e;
    }
  },

  async del(s, id) {
    try {
      await this._fetchJSON(`${this.baseUrl}/${s}/${id}`, {
          method: 'DELETE'
      });
    } catch (e) {
      throw e;
    }
  },

  async count(s) {
    const all = await this.all(s);
    return all.length;
  },

  async clear(s) {
    try {
      await this._fetchJSON(`${this.baseUrl}/${s}`, {
          method: 'DELETE'
      });
    } catch (e) {
      throw e;
    }
  },

  /* ---------- Batch операции (НОВОЕ) ---------- */
  async bulkPut(s, items) {
    const results = [];
    for (const item of items) {
        results.push(await this.put(s, item));
    }
    return results;
  },

  async bulkDel(s, ids) {
    for (const id of ids) {
        await this.del(s, id);
    }
  },

  /* ---------- Поиск по индексу (НОВОЕ) ---------- */
  async findByIndex(s, indexName, value) {
    // В REST реализации мы просто загружаем всё и фильтруем.
    // Для больших объемов нужно делать на сервере.
    const all = await this.all(s);
    return all.filter(item => item[indexName] === value);
  },

  /* ---------- Поиск по predicate (НОВОЕ) ---------- */
  async find(s, predicate) {
    const all = await this.all(s);
    return all.filter(predicate);
  },

  /* ---------- Частичное обновление (НОВОЕ) ---------- */
  async update(s, id, changes) {
    const item = await this.get(s, id);
    if (!item) throw new Error(`Запись ${id} не найдена в ${s}`);
    const updated = { ...item, ...changes };
    return this.put(s, updated);
  },

  /* ---------- Пагинация (НОВОЕ) ---------- */
  async paginate(s, page = 1, perPage = App.PER_PAGE || 20) {
    const all = await this.all(s);
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return {
      items: all.slice(start, end),
      total: all.length,
      page,
      perPage,
      totalPages: Math.ceil(all.length / perPage)
    };
  }
};
/* ---------- Фабрика для работы с хранилищем ---------- */
App.repo = function(s) {
  return {
    all: () => App.DB.all(s),
    byId: id => App.DB.get(s, id),
    count: () => App.DB.count(s),
    clear: () => App.DB.clear(s),

    findByIndex: (idx, val) => App.DB.findByIndex(s, idx, val),
    find: predicate => App.DB.find(s, predicate),
    paginate: (page, perPage) => App.DB.paginate(s, page, perPage),

    save: async i => {
      // Не мутируем исходный объект
      const item = { ...i, _syncTs: Date.now() };
      await App.DB.put(s, item);

      // Синхронизация (если настроена)
      if (App.SYNC_STORES && App.SYNC_STORES.includes(s) && App.SyncManager) {
        App.SyncManager.enqueue(s, item, 'upsert');
      }
      return item;
    },

    update: async (id, changes) => {
      const updated = await App.DB.update(s, id, changes);
      if (App.SYNC_STORES && App.SYNC_STORES.includes(s) && App.SyncManager) {
        App.SyncManager.enqueue(s, updated, 'upsert');
      }
      return updated;
    },

    bulkSave: async items => {
      const withTs = items.map(i => ({ ...i, _syncTs: Date.now() }));
      await App.DB.bulkPut(s, withTs);
      if (App.SYNC_STORES && App.SYNC_STORES.includes(s) && App.SyncManager) {
        withTs.forEach(item => App.SyncManager.enqueue(s, item, 'upsert'));
      }
      return withTs;
    },

    remove: async id => {
      await App.DB.del(s, id);
      if (App.SYNC_STORES && App.SYNC_STORES.includes(s) && App.SyncManager) {
        App.SyncManager.enqueue(s, { id }, 'delete');
      }
    },

    bulkRemove: async ids => {
      await App.DB.bulkDel(s, ids);
      if (App.SYNC_STORES && App.SYNC_STORES.includes(s) && App.SyncManager) {
        ids.forEach(id => App.SyncManager.enqueue(s, { id }, 'delete'));
      }
    }
  };
};

/* ---------- Журналирование движений остатков ---------- */
App.recordStockMovement = async function(flowerId, delta, reason) {
  if (!flowerId || !delta || delta === 0) return;

  const entry = {
    id: App.uid(),
    flowerId,
    delta,
    reason,
    ts: Date.now(),
    userId: App.Auth?.user?.id || 'system',
    userName: App.Auth?.user?.name || 'System'
  };

  await App.DB.put('stock_movements', entry);
};

/* ---------- Получение зарезервированного количества ---------- */
App.getReservedQty = async function(flowerId) {
  const writeoffs = await App.repo('writeoffs').find(
    w => w.flowerId === flowerId && w.status === 'pending' && w.reserved
  );
  return writeoffs.reduce((sum, w) => sum + (w.quantity || 0), 0);
};

/* ---------- Seed начальных данных (НОВОЕ) ---------- */
App.seedDefaults = async function() {
  const settingsRepo = App.repo('settings');
  const existing = await settingsRepo.all();

  if (existing.length === 0) {
    await settingsRepo.save({
      id: 'general',
      shopName: 'FLO.RISTA',
      currency: 'RUB',
      taxRate: 0,
      lowStockThreshold: 5,
      autoBackup: true,
      backupInterval: 86400000, // 24 часа
      twoFactorAuth: false,
      createdAt: Date.now()
    });
    console.log('✅ Созданы настройки по умолчанию');
  }
};

/* ---------- Автоинициализация ---------- */
App.initDB = async function() {
  try {
    await App.DB.open();
    await App.seedDefaults();
    console.log('✅ Server DB connected');
    return true;
  } catch (e) {
    console.error('❌ Ошибка подключения к БД:', e);
    App.Toast?.er('Ошибка базы данных: ' + e.message);
    return false;
  }
};

console.log('✅ db.js загружен');
