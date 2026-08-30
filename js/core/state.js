/* =========================================================
 *  js/core/state.js
 *  Состояние приложения, навигация, роутинг
 *  v3.0 — с системой прав доступа
 * ========================================================= */

window.App = window.App || {};

/* =========================================================
 *  ГЛОБАЛЬНОЕ СОСТОЯНИЕ
 * ========================================================= */
App.state = App.state || {
  page: 'dashboard',           // Текущая страница
  pages: {},                   // Пагинация для каждой страницы
  search: {},                  // Поисковые запросы
  calDate: new Date(),         // Дата в календаре
  analyticsTab: 'profit',      // Активная вкладка аналитики
  _forceRerender: false        // Флаг принудительного ререндера
};

/* =========================================================
 *  ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ (черновики, блокировки)
 * ========================================================= */
App._orderDraft = App._orderDraft || null;      // Черновик заказа
App._bouquetDraft = App._bouquetDraft || null;  // Черновик букета
App._savingOrder = App._savingOrder || false;   // Блокировка сохранения
App._approveLock = App._approveLock || new Set(); // Блокировки одобрений
App._chartInstances = App._chartInstances || []; // Экземпляры графиков
App._searchTimers = App._searchTimers || {};     // Таймеры поиска

/* =========================================================
 *  НАВИГАЦИЯ — все модули системы
 *  Поля:
 *    id    — идентификатор модуля
 *    label — отображаемое название
 *    r     — роли, которым доступен модуль (базовый уровень)
 * ========================================================= */
App.NAV = [
  { id: 'dashboard',  label: '📊 Дашборд',   r: ['owner', 'admin', 'employee'] },
  { id: 'orders',     label: '📦 Заказы',    r: ['owner', 'admin', 'employee'] },
  { id: 'flowers',    label: '🌸 Товары',    r: ['owner', 'admin'] },
  { id: 'bouquets',   label: '💐 Букеты',    r: ['owner', 'admin'] },
  { id: 'clients',    label: '👥 Клиенты',   r: ['owner', 'admin', 'employee'] },
  { id: 'calendar',   label: '📅 Календарь', r: ['owner', 'admin', 'employee'] },
  { id: 'shifts',     label: '⏰ Смены',     r: ['owner', 'admin', 'employee'] },
  { id: 'writeoffs',  label: '📉 Списания',  r: ['owner', 'admin', 'employee'] },
  { id: 'expenses',   label: '💸 Расходы',   r: ['owner', 'admin'] },
  { id: 'supplies',   label: '📥 Поставки',  r: ['owner', 'admin'] },
  { id: 'returns',    label: '↩️ Возвраты',  r: ['owner', 'admin'] },
  { id: 'analytics',  label: '📈 Аналитика', r: ['owner', 'admin'] },
  { id: 'staff',      label: '👥 Персонал',  r: ['owner', 'admin'] },
  { id: 'settings',   label: '⚙️ Настройки', r: ['owner', 'admin'] }
];

/* =========================================================
 *  ПОКАЗ ЭКРАНОВ (setup / login / app / error)
 * ========================================================= */
App.showScreen = function(id) {
  var screens = document.querySelectorAll('.screen');
  for (var i = 0; i < screens.length; i++) {
    screens[i].classList.remove('active');
  }

  var target = App.$('#' + id);
  if (target) {
    target.classList.add('active');
  } else {
    console.error('Screen not found:', id);
  }

  window.scrollTo(0, 0);
};

/* =========================================================
 *  РЕНДЕР НАВИГАЦИИ
 *  Учитывает: роль пользователя + индивидуальные права
 * ========================================================= */
App.renderNav = function() {
  if (!App.Auth || !App.Auth.user) {
    console.warn('renderNav: пользователь не авторизован');
    return;
  }

  var navEl = App.$('#nav');
  var unameEl = App.$('#uname');

  if (!navEl) {
    console.warn('renderNav: #nav не найден');
    return;
  }

  // Фильтруем модули по роли И по индивидуальным правам
  var allowed = App.NAV.filter(function(n) {
    // Шаг 1: проверка базовой роли
    if (n.r.indexOf(App.Auth.user.role) === -1) {
      return false;
    }

    // Шаг 2: для сотрудников проверяем персональные права
    if (App.Auth.user.role === 'employee') {
      return App.Auth.canAccess(n.id);
    }

    // Владелец и админ имеют полный доступ
    return true;
  });

  // Генерация навигации
  navEl.innerHTML = allowed.map(function(n) {
    var cls = App.state.page === n.id ? 'on' : '';
    return '<a class="' + cls + '" data-page="' + n.id + '" title="' + n.label + '">' + n.label + '</a>';
  }).join('');

  // Отображение имени пользователя
  if (unameEl) {
    var roleName = App.ROLES[App.Auth.user.role] || App.Auth.user.role;
    unameEl.textContent = App.Auth.user.name + ' (' + roleName + ')';
  }

  // Обработчики кликов по навигации
  var links = navEl.querySelectorAll('a');
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener('click', function(e) {
      e.preventDefault();
      var pageId = this.dataset.page;

      if (App.state.page === pageId) return;

      App.state.page = pageId;
      App.renderNav();
      App.renderView();

      // Обновляем hash в URL (для истории браузера)
      try {
        history.pushState({ page: pageId }, '', '#' + pageId);
      } catch (err) {
        // ignore
      }
    });
  }
};

/* =========================================================
 *  РЕНДЕР ТЕКУЩЕЙ СТРАНИЦЫ
 *  С проверкой прав доступа (единая точка контроля)
 * ========================================================= */
App.renderView = function() {
  // Уничтожаем старые графики
  App.destroyAllCharts();

  // Проверка авторизации
  if (!App.Auth || !App.Auth.user) {
    console.warn('renderView: пользователь не авторизован');
    return;
  }

  // Проверка прав доступа к модулю
  if (!App.Auth.canAccess(App.state.page)) {
    App.$('#view').innerHTML = `
      <div class="card" style="text-align:center;padding:80px 40px">
        <div style="font-size:80px;margin-bottom:20px;filter:grayscale(50%)">🔐</div>
        <h2 style="margin-bottom:12px">Нет доступа</h2>
        <p class="hint" style="font-size:15px;line-height:1.7">
          У вас нет прав для просмотра модуля «${App.esc(App.state.page)}».<br>
          Обратитесь к администратору для настройки доступа.
        </p>
        <button class="btn" style="margin-top:24px" onclick="App.goToFirstAvailable()">
          ← Перейти к доступным модулям
        </button>
      </div>
    `;
    return;
  }

  // Карта модулей
  var map = {
    dashboard: App.renderDashboard,
    orders: App.renderOrders,
    flowers: App.renderFlowers,
    bouquets: App.renderBouquets,
    clients: App.renderClients,
    calendar: App.renderCalendar,
    shifts: App.renderShifts,
    writeoffs: App.renderWriteoffs,
    expenses: App.renderExpenses,
    supplies: App.renderSupplies,
    returns: App.renderReturns,
    analytics: App.renderAnalytics,
    staff: App.renderStaff,
    settings: App.renderSettings
  };

  var renderFn = map[App.state.page] || App.renderDashboard;

  if (typeof renderFn !== 'function') {
    console.error('renderView: модуль не найден:', App.state.page);
    App.$('#view').innerHTML = '<div class="card" style="color:var(--bad)">Модуль не найден</div>';
    return;
  }

  try {
    renderFn();
    App.state._forceRerender = false;
  } catch (err) {
    console.error('renderView error:', err);
    App.$('#view').innerHTML = `
      <div class="card" style="text-align:center;padding:40px;color:var(--bad)">
        <h3>⚠️ Ошибка рендера</h3>
        <p class="hint" style="margin-top:8px">${App.esc(err.message || 'Неизвестная ошибка')}</p>
      </div>
    `;
  }
};

/* =========================================================
 *  ПЕРЕХОД К ПЕРВОМУ ДОСТУПНОМУ МОДУЛЮ
 *  (если текущий недоступен для сотрудника)
 * ========================================================= */
App.goToFirstAvailable = function() {
  if (!App.Auth || !App.Auth.user) return;

  // Ищем первый доступный модуль
  for (var i = 0; i < App.NAV.length; i++) {
    var nav = App.NAV[i];

    // Проверка роли
    if (nav.r.indexOf(App.Auth.user.role) === -1) continue;

    // Проверка прав
    if (App.Auth.canAccess(nav.id)) {
      App.state.page = nav.id;
      App.renderNav();
      App.renderView();
      return;
    }
  }

  // Если ничего не доступно — показываем сообщение
  App.$('#view').innerHTML = `
    <div class="card" style="text-align:center;padding:60px 40px">
      <div style="font-size:80px;margin-bottom:20px">🚫</div>
      <h2>Нет доступных модулей</h2>
      <p class="hint" style="margin-top:8px">
        Обратитесь к администратору для настройки прав доступа.
      </p>
    </div>
  `;
};

/* =========================================================
 *  ПРОВЕРКА И КОРРЕКЦИЯ ТЕКУЩЕЙ СТРАНИЦЫ
 *  Вызывается после входа — если страница недоступна,
 *  автоматически переключаемся на первую доступную
 * ========================================================= */
App.ensurePageAccessible = function() {
  if (!App.Auth || !App.Auth.user) return;

  // Проверяем текущую страницу
  var navExists = App.NAV.some(function(n) { return n.id === App.state.page; });

  if (!navExists || !App.Auth.canAccess(App.state.page)) {
    App.goToFirstAvailable();
  }
};

/* =========================================================
 *  ПАГИНАЦИЯ
 * ========================================================= */
App.setPage = function(k, v) {
  App.state.pages[k] = v || 1;
};

App.getPage = function(k) {
  return App.state.pages[k] || 1;
};

App.setSearch = function(k, v) {
  App.state.search[k] = v;
  App.setPage(k, 1); // Сбрасываем на первую страницу при поиске
};

App.getSearch = function(k) {
  return App.state.search[k] || '';
};

App.paginate = function(items, pageKey) {
  var p = App.getPage(pageKey);
  var perPage = App.PER_PAGE || 20;
  var pages = Math.max(1, Math.ceil(items.length / perPage));

  if (p > pages) {
    p = 1;
    App.setPage(pageKey, 1);
  }

  return {
    items: items.slice((p - 1) * perPage, p * perPage),
    page: p,
    pages: pages,
    total: items.length
  };
};

/* =========================================================
 *  HTML ПАГИНАЦИИ
 * ========================================================= */
App.pagHTML = function(page, pages) {
  if (pages <= 1) return '';

  var h = '<div style="display:flex;gap:6px;justify-content:center;margin-top:16px;flex-wrap:wrap;align-items:center">';

  // Кнопка "Назад"
  h += '<button class="btn g" ' + (page === 1 ? 'disabled' : '') + ' data-pg="' + (page - 1) + '">‹</button>';

  // Номера страниц с многоточием
  for (var i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || (i >= page - 2 && i <= page + 2)) {
      var cls = i === page ? '' : 'g';
      h += '<button class="btn ' + cls + '" data-pg="' + i + '">' + i + '</button>';
    } else if (i === page - 3 || i === page + 3) {
      h += '<span style="padding:8px;color:var(--t3)">…</span>';
    }
  }

  // Кнопка "Вперёд"
  h += '<button class="btn g" ' + (page === pages ? 'disabled' : '') + ' data-pg="' + (page + 1) + '">›</button>';

  h += '</div>';
  return h;
};

/* =========================================================
 *  ГРАФИКИ (Chart.js)
 * ========================================================= */
App.destroyAllCharts = function() {
  var charts = App._chartInstances || [];
  for (var i = 0; i < charts.length; i++) {
    if (charts[i]) {
      try {
        charts[i].destroy();
      } catch (e) {
        // ignore
      }
    }
  }
  App._chartInstances = [];
};

/* =========================================================
 *  НАВИГАЦИЯ (программная)
 * ========================================================= */
App.navigateTo = function(pageId) {
  // Проверка что модуль существует
  var exists = App.NAV.some(function(n) { return n.id === pageId; });
  if (!exists) {
    console.warn('navigateTo: модуль не найден:', pageId);
    return;
  }

  // Проверка прав доступа
  if (!App.Auth.canAccess(pageId)) {
    App.Toast.wn('Нет доступа к модулю');
    return;
  }

  App.state.page = pageId;
  App.renderNav();
  App.renderView();

  try {
    history.pushState({ page: pageId }, '', '#' + pageId);
  } catch (err) {
    // ignore
  }
};

App.rerender = function() {
  App.state._forceRerender = true;
  App.renderView();
};

/* =========================================================
 *  ОБРАБОТКА КНОПОК "НАЗАД/ВПЕРЁД" БРАУЗЕРА
 * ========================================================= */
window.addEventListener('popstate', function(e) {
  if (!App.Auth || !App.Auth.user) return;

  var hash = location.hash.replace('#', '');
  if (hash && hash !== App.state.page) {
    var exists = App.NAV.some(function(n) { return n.id === hash; });
    if (exists && App.Auth.canAccess(hash)) {
      App.state.page = hash;
      App.renderNav();
      App.renderView();
    }
  }
});

/* =========================================================
 *  ОБРАБОТКА ПРЯМЫХ ССЫЛОК (#orders, #flowers и т.д.)
 * ========================================================= */
App.handleInitialHash = function() {
  var hash = location.hash.replace('#', '');

  if (!hash) return;

  // Проверяем что модуль существует
  var exists = App.NAV.some(function(n) { return n.id === hash; });
  if (!exists) return;

  // Проверяем права доступа
  if (App.Auth.canAccess(hash)) {
    App.state.page = hash;
  } else {
    console.warn('Прямая ссылка на недоступный модуль:', hash);
  }
};

/* =========================================================
 *  ГОРЯЧИЕ КЛАВИШИ НАВИГАЦИИ
 * ========================================================= */
document.addEventListener('keydown', function(e) {
  // Только если авторизован и не в поле ввода
  if (!App.Auth || !App.Auth.user) return;

  var tagName = (e.target.tagName || '').toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return;

  // Alt + 1..9 — быстрые переходы
  if (e.altKey && e.key >= '1' && e.key <= '9') {
    var idx = parseInt(e.key) - 1;
    var available = App.NAV.filter(function(n) {
      return n.r.indexOf(App.Auth.user.role) !== -1 && App.Auth.canAccess(n.id);
    });

    if (available[idx]) {
      e.preventDefault();
      App.navigateTo(available[idx].id);
    }
  }
});

console.log('state.js loaded (v3.0 with permissions)');