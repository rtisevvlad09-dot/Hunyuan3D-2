// ===== АУДИТ ДЕЙСТВИЙ =====
// js/services/audit.js
// v2.0 — с категориями, ротацией, экспортом, защитой

window.App = window.App || {};

/* ---------- Константы действий ---------- */
App.AUDIT_ACTIONS = {
  // Аутентификация
  LOGIN_SUCCESS: 'auth.login_success',
  LOGIN_FAILED: 'auth.login_failed',
  LOGOUT: 'auth.logout',
  PASSWORD_CHANGED: 'auth.password_changed',
  PASSWORD_RESTORED: 'auth.password_restored',
  TFA_ENABLED: 'auth.tfa_enabled',
  TFA_DISABLED: 'auth.tfa_disabled',

  // CRUD операции
  CREATE: 'crud.create',
  UPDATE: 'crud.update',
  DELETE: 'crud.delete',
  BULK_CREATE: 'crud.bulk_create',
  BULK_UPDATE: 'crud.bulk_update',
  BULK_DELETE: 'crud.bulk_delete',

  // Заказы
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_COMPLETED: 'order.completed',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_REFUNDED: 'order.refunded',

  // Финансы
  SHIFT_OPENED: 'shift.opened',
  SHIFT_CLOSED: 'shift.closed',
  EXPENSE_ADDED: 'expense.added',
  WRITEOFF_CREATED: 'writeoff.created',

  // Система
  EXPORT: 'system.export',
  IMPORT: 'system.import',
  BACKUP_CREATED: 'system.backup_created',
  SETTINGS_CHANGED: 'system.settings_changed',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_BLOCKED: 'user.blocked',
  USER_UNBLOCKED: 'user.unblocked'
};

/* ---------- Категории действий ---------- */
App.AUDIT_CATEGORIES = {
  'auth': 'Аутентификация',
  'crud': 'CRUD операции',
  'order': 'Заказы',
  'shift': 'Смены',
  'expense': 'Расходы',
  'writeoff': 'Списания',
  'system': 'Система',
  'user': 'Пользователи'
};

/* ---------- Объект Audit ---------- */
App.Audit = {
  MAX_LOG_ENTRIES: 10000, // Максимум записей в логе
  RETENTION_DAYS: 90,     // Хранить логи 90 дней

  /* ---------- Базовое логирование ---------- */
  async log(action, details = {}, store = null, itemId = null) {
    if (!App.DB.db) {
      console.warn('⚠️ Audit: БД ещё не открыта');
      return null;
    }

    try {
      const entry = {
        id: App.uid(),
        ts: Date.now(),
        userId: App.Auth?.user?.id || 'system',
        userName: App.Auth?.user?.name || 'System',
        userRole: App.Auth?.user?.role || 'system',
        action,
        store,
        itemId,
        details,
        // Метаданные
        userAgent: navigator.userAgent?.slice(0, 100) || 'unknown',
        timestamp: new Date().toISOString()
      };

      await App.repo('audit_log').save(entry);

      // Ротация логов (раз в 100 записей)
      const count = await App.repo('audit_log').count();
      if (count > this.MAX_LOG_ENTRIES && count % 100 === 0) {
        await this.rotate();
      }

      return entry;
    } catch (e) {
      console.error('❌ Audit error:', e);
      return null;
    }
  },

  /* ---------- Удобные методы для CRUD ---------- */
  async logCreate(store, item, details = {}) {
    return this.log(
      App.AUDIT_ACTIONS.CREATE,
      { ...details, itemName: item.name || item.id },
      store,
      item.id
    );
  },

  async logUpdate(store, item, changes = {}, details = {}) {
    return this.log(
      App.AUDIT_ACTIONS.UPDATE,
      { ...details, itemName: item.name || item.id, changes },
      store,
      item.id
    );
  },

  async logDelete(store, item, details = {}) {
    return this.log(
      App.AUDIT_ACTIONS.DELETE,
      { ...details, itemName: item.name || item.id },
      store,
      item.id
    );
  },

  async logBulkCreate(store, items, details = {}) {
    return this.log(
      App.AUDIT_ACTIONS.BULK_CREATE,
      { ...details, count: items.length },
      store,
      null
    );
  },

  async logBulkDelete(store, ids, details = {}) {
    return this.log(
      App.AUDIT_ACTIONS.BULK_DELETE,
      { ...details, count: ids.length, ids },
      store,
      null
    );
  },

  /* ---------- Специализированные методы ---------- */
  async logLogin(phone, success) {
    return this.log(
      success ? App.AUDIT_ACTIONS.LOGIN_SUCCESS : App.AUDIT_ACTIONS.LOGIN_FAILED,
      { phone, success }
    );
  },

  async logLogout() {
    return this.log(App.AUDIT_ACTIONS.LOGOUT);
  },

  async logOrderAction(action, order, details = {}) {
    return this.log(
      action,
      { ...details, orderId: order.id, total: order.total, status: order.status },
      'orders',
      order.id
    );
  },

  async logShiftAction(action, shift, details = {}) {
    return this.log(
      action,
      { ...details, shiftId: shift.id, userId: shift.userId },
      'shifts',
      shift.id
    );
  },

  async logExport(type, count, details = {}) {
    return this.log(
      App.AUDIT_ACTIONS.EXPORT,
      { ...details, type, count }
    );
  },

  async logImport(type, count, details = {}) {
    return this.log(
      App.AUDIT_ACTIONS.IMPORT,
      { ...details, type, count }
    );
  },

  /* ---------- Получение логов с фильтрацией ---------- */
  async getLogs(filters = {}) {
    let logs = await App.repo('audit_log').all();

    // Фильтр по действию
    if (filters.action) {
      logs = logs.filter(l => l.action === filters.action);
    }

    // Фильтр по категории
    if (filters.category) {
      logs = logs.filter(l => l.action?.startsWith(filters.category + '.'));
    }

    // Фильтр по пользователю
    if (filters.userId) {
      logs = logs.filter(l => l.userId === filters.userId);
    }

    // Фильтр по store (таблице)
    if (filters.store) {
      logs = logs.filter(l => l.store === filters.store);
    }

    // Фильтр по дате (от)
    if (filters.from) {
      const fromTs = filters.from instanceof Date ? filters.from.getTime() : new Date(filters.from).getTime();
      logs = logs.filter(l => l.ts >= fromTs);
    }

    // Фильтр по дате (до)
    if (filters.to) {
      const toTs = filters.to instanceof Date ? filters.to.getTime() : new Date(filters.to).getTime();
      logs = logs.filter(l => l.ts <= toTs);
    }

    // Поиск по тексту
    if (filters.search) {
      const q = filters.search.toLowerCase();
      logs = logs.filter(l =>
        l.userName?.toLowerCase().includes(q) ||
        l.action?.toLowerCase().includes(q) ||
        JSON.stringify(l.details || {}).toLowerCase().includes(q)
      );
    }

    // Сортировка (новые сверху)
    logs.sort((a, b) => b.ts - a.ts);

    // Лимит
    if (filters.limit) {
      logs = logs.slice(0, filters.limit);
    }

    return logs;
  },

  /* ---------- Получение статистики ---------- */
  async getStats(days = 7) {
    const from = Date.now() - (days * 24 * 60 * 60 * 1000);
    const logs = await this.getLogs({ from });

    const stats = {
      total: logs.length,
      byCategory: {},
      byUser: {},
      byAction: {},
      topUsers: [],
      topActions: []
    };

    logs.forEach(l => {
      // По категории
      const cat = l.action?.split('.')[0] || 'other';
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;

      // По пользователю
      if (l.userName) {
        stats.byUser[l.userName] = (stats.byUser[l.userName] || 0) + 1;
      }

      // По действию
      stats.byAction[l.action] = (stats.byAction[l.action] || 0) + 1;
    });

    // Топ пользователей
    stats.topUsers = Object.entries(stats.byUser)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Топ действий
    stats.topActions = Object.entries(stats.byAction)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));

    return stats;
  },

  /* ---------- Ротация логов ---------- */
  async rotate() {
    try {
      const logs = await App.repo('audit_log').all();

      if (logs.length <= this.MAX_LOG_ENTRIES) return;

      // Сортируем по времени (старые сверху)
      logs.sort((a, b) => a.ts - b.ts);

      // Удаляем старые записи
      const toDelete = logs.slice(0, logs.length - this.MAX_LOG_ENTRIES);
      const idsToDelete = toDelete.map(l => l.id);

      await App.repo('audit_log').bulkRemove(idsToDelete);

      console.log(`🗑️ Audit: удалено ${idsToDelete.length} старых записей`);
    } catch (e) {
      console.error('❌ Audit rotation error:', e);
    }
  },

  /* ---------- Очистка старых логов ---------- */
  async cleanup(days = null) {
    const retentionDays = days || this.RETENTION_DAYS;
    const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    try {
      const logs = await App.repo('audit_log').all();
      const oldLogs = logs.filter(l => l.ts < cutoff);

      if (oldLogs.length === 0) {
        App.Toast.in('Нет старых записей для удаления');
        return 0;
      }

      const confirmed = await App.Modal.confirm(
        `Удалить ${oldLogs.length} записей старше ${retentionDays} дней?`
      );

      if (!confirmed) return 0;

      const idsToDelete = oldLogs.map(l => l.id);
      await App.repo('audit_log').bulkRemove(idsToDelete);

      App.Toast.ok(`Удалено ${idsToDelete.length} записей`);
      return idsToDelete.length;
    } catch (e) {
      console.error('❌ Audit cleanup error:', e);
      App.Toast.er('Ошибка очистки логов');
      return 0;
    }
  },

  /* ---------- Экспорт логов ---------- */
  async export(format = 'json', filters = {}) {
    const logs = await this.getLogs(filters);

    if (format === 'json') {
      const data = JSON.stringify(logs, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_log_${App.toLocalDateString(new Date())}.json`;
      a.click();

      URL.revokeObjectURL(url);

      await this.logExport('json', logs.length, { filters });
      App.Toast.ok(`Экспортировано ${logs.length} записей`);
    }
    else if (format === 'csv') {
      const headers = ['Дата', 'Время', 'Пользователь', 'Роль', 'Действие', 'Таблица', 'ID записи', 'Детали'];
      const rows = logs.map(l => [
        App.fmtDate(l.ts),
        App.fmtTime(l.ts),
        l.userName || '',
        App.ROLES[l.userRole] || l.userRole || '',
        this.formatAction(l.action),
        l.store || '',
        l.itemId || '',
        JSON.stringify(l.details || {})
      ]);

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_log_${App.toLocalDateString(new Date())}.csv`;
      a.click();

      URL.revokeObjectURL(url);

      await this.logExport('csv', logs.length, { filters });
      App.Toast.ok(`Экспортировано ${logs.length} записей`);
    }
  },

  /* ---------- Форматирование для UI ---------- */
  formatAction(action) {
    const labels = {
      'auth.login_success': '✅ Успешный вход',
      'auth.login_failed': '❌ Неудачный вход',
      'auth.logout': '🚪 Выход',
      'auth.password_changed': '🔑 Смена пароля',
      'auth.password_restored': '🔑 Восстановление пароля',
      'auth.tfa_enabled': '🔐 Включена 2FA',
      'auth.tfa_disabled': '🔓 Отключена 2FA',
      'crud.create': '➕ Создание',
      'crud.update': '✏️ Изменение',
      'crud.delete': '🗑️ Удаление',
      'crud.bulk_create': '➕ Массовое создание',
      'crud.bulk_update': '✏️ Массовое изменение',
      'crud.bulk_delete': '🗑️ Массовое удаление',
      'order.created': '📦 Заказ создан',
      'order.updated': '📦 Заказ изменён',
      'order.completed': '✅ Заказ завершён',
      'order.cancelled': '❌ Заказ отменён',
      'order.refunded': '↩️ Возврат по заказу',
      'shift.opened': '🔓 Смена открыта',
      'shift.closed': '🔒 Смена закрыта',
      'expense.added': '💸 Расход добавлен',
      'writeoff.created': '📉 Списание создано',
      'system.export': '📤 Экспорт',
      'system.import': '📥 Импорт',
      'system.backup_created': '💾 Бэкап создан',
      'system.settings_changed': '⚙️ Настройки изменены',
      'user.created': '👤 Пользователь создан',
      'user.updated': '👤 Пользователь изменён',
      'user.deleted': '👤 Пользователь удалён',
      'user.blocked': '🚫 Пользователь заблокирован',
      'user.unblocked': '✅ Пользователь разблокирован'
    };

    return labels[action] || action;
  },

  formatCategory(action) {
    const cat = action?.split('.')[0] || 'other';
    return App.AUDIT_CATEGORIES[cat] || 'Прочее';
  },

  /* ---------- Защита от удаления ---------- */
  async canDelete(logEntry) {
    // Только владелец может удалять логи
    if (!App.Auth.user) return false;
    if (App.Auth.user.role !== 'owner') return false;

    // Нельзя удалять логи старше 7 дней (защита от сокрытия)
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    if (logEntry.ts < weekAgo) return false;

    return true;
  }
};

console.log('✅ audit.js загружен');