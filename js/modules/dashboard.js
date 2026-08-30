/* =========================================================
 *  js/modules/dashboard.js
 *  Главный дашборд — Apple-style дизайн
 *  v3.0 — с анимациями, живыми метриками, приветствием
 * ========================================================= */

window.App = window.App || {};

App.renderDashboard = async function() {
  App.setLoading?.(true);

  try {
    // Загружаем все данные параллельно
    const [orders, flowers, clients, shifts, writeoffs, expenses] = await Promise.all([
      App.repo('orders').all(),
      App.repo('flowers').all(),
      App.repo('clients').all(),
      App.repo('shifts').all(),
      App.repo('writeoffs').all(),
      App.repo('expenses').all()
    ]);

    // ===== КЛЮЧЕВЫЕ МЕТРИКИ =====
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();
    const yesterdayTs = todayTs - App.MS_PER_DAY;
    const weekAgoTs = todayTs - 7 * App.MS_PER_DAY;

    // Выручка
    const todayOrders = orders.filter(o => o.ts >= todayTs && o.status === 'completed');
    const yesterdayOrders = orders.filter(o => o.ts >= yesterdayTs && o.ts < todayTs && o.status === 'completed');
    const weekOrders = orders.filter(o => o.ts >= weekAgoTs && o.status === 'completed');

    const todayRevenue = todayOrders.reduce((s, o) => s + (o.finalAmount || 0), 0);
    const yesterdayRevenue = yesterdayOrders.reduce((s, o) => s + (o.finalAmount || 0), 0);
    const weekRevenue = weekOrders.reduce((s, o) => s + (o.finalAmount || 0), 0);

    // Тренд (сравнение с вчера)
    const trend = yesterdayRevenue > 0
      ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
      : 0;

    // Активные заказы
    const activeOrders = orders.filter(o => o.status === 'new' || o.status === 'processing');

    // Низкие остатки
    const lowStock = flowers.filter(f => (f.stock || 0) < 10 && f.active !== false);

    // Активная смена
    const activeShift = shifts.find(s => s.status === 'open');

    // Потери от списаний за неделю
    const weekWriteoffs = writeoffs.filter(w => w.ts >= weekAgoTs && w.status === 'approved');
    const weekLoss = weekWriteoffs.reduce((s, w) => {
      const f = flowers.find(x => x.id === w.flowerId);
      return s + (f ? (f.purchasePrice || 0) * (w.quantity || 0) : 0);
    }, 0);

    // ===== ПРИВЕТСТВИЕ =====
    const hour = new Date().getHours();
    let greeting, greetingEmoji;
    if (hour < 6) { greeting = 'Доброй ночи'; greetingEmoji = '🌙'; }
    else if (hour < 12) { greeting = 'Доброе утро'; greetingEmoji = '☀️'; }
    else if (hour < 18) { greeting = 'Добрый день'; greetingEmoji = '🌤️'; }
    else { greeting = 'Добрый вечер'; greetingEmoji = '🌆'; }

    const userName = App.Auth.user?.name || 'Гость';
    const firstName = userName.split(' ')[0];

    // ===== РЕНДЕР =====
    let h = `
      <!-- Приветствие -->
      <div class="welcome-banner glass" style="
        padding: 28px 32px;
        border-radius: var(--r-lg);
        margin-bottom: 24px;
        background: var(--p-gradient-2);
        color: white;
        position: relative;
        overflow: hidden;
      ">
        <div style="position:absolute;top:-50px;right:-50px;font-size:200px;opacity:0.1;line-height:1">
          ${greetingEmoji}
        </div>
        <div style="position:relative;z-index:1">
          <div style="font-size:14px;opacity:0.9;margin-bottom:4px;font-weight:500">
            ${greetingEmoji} ${greeting},
          </div>
          <h1 style="color:white;font-size:32px;margin-bottom:8px;font-weight:800;letter-spacing:-0.03em">
            ${App.esc(firstName)}
          </h1>
          <div style="opacity:0.95;font-size:15px">
            Сегодня ${App.fmtDate(new Date())} ·
            ${todayOrders.length} ${_pluralize(todayOrders.length, 'заказ', 'заказа', 'заказов')}
          </div>
          ${activeShift ? `
            <div style="display:inline-flex;align-items:center;gap:6px;margin-top:12px;padding:6px 14px;background:rgba(255,255,255,0.2);border-radius:999px;font-size:13px;backdrop-filter:blur(10px)">
              <span style="width:8px;height:8px;background:#4ade80;border-radius:50%;box-shadow:0 0 8px #4ade80;animation:pulse 2s infinite"></span>
              На смене · ${_formatShiftDuration(activeShift.startedAt)}
            </div>
          ` : `
            <button class="btn" style="margin-top:12px;background:rgba(255,255,255,0.2);color:white;backdrop-filter:blur(10px)"
                    onclick="App.navigateTo('shifts')">
              ⏰ Открыть смену
            </button>
          `}
        </div>
      </div>

      <!-- Ключевые метрики -->
      <div class="g stagger" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-bottom:24px">
        <div class="metric-card shine" data-action="orders" style="cursor:pointer">
          <div class="metric-icon" style="background:var(--info-bg);color:var(--info-text)">
            💰
          </div>
          <div class="metric-info">
            <div class="metric-label">Выручка сегодня</div>
            <div class="metric-value">${App.fmtMoney(todayRevenue)}</div>
            <div class="metric-trend ${trend >= 0 ? 'up' : 'down'}">
              ${trend >= 0 ? '↗' : '↘'} ${Math.abs(trend)}% ${trend >= 0 ? 'рост' : 'падение'}
            </div>
          </div>
        </div>

        <div class="metric-card shine" data-action="orders" style="cursor:pointer">
          <div class="metric-icon" style="background:var(--pur-bg);color:var(--pur-text)">
            📦
          </div>
          <div class="metric-info">
            <div class="metric-label">Активные заказы</div>
            <div class="metric-value">${activeOrders.length}</div>
            <div class="metric-sub">За неделю: ${weekOrders.length}</div>
          </div>
        </div>

        <div class="metric-card shine" data-action="flowers" style="cursor:pointer">
          <div class="metric-icon" style="background:${lowStock.length > 0 ? 'var(--bad-bg)' : 'var(--good-bg)'};color:${lowStock.length > 0 ? 'var(--bad-text)' : 'var(--good-text)'}">
            ${lowStock.length > 0 ? '⚠️' : '🌸'}
          </div>
          <div class="metric-info">
            <div class="metric-label">Низкие остатки</div>
            <div class="metric-value">${lowStock.length}</div>
            <div class="metric-sub">Всего: ${flowers.filter(f => f.active !== false).length} товаров</div>
          </div>
        </div>

        <div class="metric-card shine" data-action="clients" style="cursor:pointer">
          <div class="metric-icon" style="background:var(--good-bg);color:var(--good-text)">
            👥
          </div>
          <div class="metric-info">
            <div class="metric-label">Клиенты</div>
            <div class="metric-value">${clients.length}</div>
            <div class="metric-sub">В базе CRM</div>
          </div>
        </div>
      </div>

      <!-- Две колонки: быстрые действия + последние заказы -->
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:20px;margin-bottom:24px">
        <!-- Быстрые действия -->
        <div class="card glass" style="padding:20px">
          <h3 style="margin-bottom:16px;font-size:16px;display:flex;align-items:center;gap:8px">
            ⚡ Быстрые действия
          </h3>
          <div class="quick-actions">
            <button class="quick-action-btn" data-action="newOrder">
              <span class="qa-icon" style="background:var(--p-gradient-2);color:white">📦</span>
              <div class="qa-label">Новый заказ</div>
              <div class="qa-hint">Ctrl+N</div>
            </button>
            <button class="quick-action-btn" data-action="newClient">
              <span class="qa-icon" style="background:var(--good);color:white">👤</span>
              <div class="qa-label">Добавить клиента</div>
            </button>
            <button class="quick-action-btn" data-action="newFlower">
              <span class="qa-icon" style="background:var(--info);color:white">🌸</span>
              <div class="qa-label">Новый товар</div>
            </button>
            <button class="quick-action-btn" data-action="newSupply">
              <span class="qa-icon" style="background:var(--pur);color:white">📥</span>
              <div class="qa-label">Поставка</div>
            </button>
            <button class="quick-action-btn" data-action="calendar">
              <span class="qa-icon" style="background:var(--warn);color:white">📅</span>
              <div class="qa-label">Календарь</div>
            </button>
            <button class="quick-action-btn" data-action="analytics">
              <span class="qa-icon" style="background:var(--bad);color:white">📊</span>
              <div class="qa-label">Аналитика</div>
            </button>
          </div>
        </div>

        <!-- Последние заказы -->
        <div class="card glass" style="padding:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="font-size:16px;display:flex;align-items:center;gap:8px;margin:0">
              🕐 Последние заказы
            </h3>
            <button class="btn g" style="padding:6px 12px;font-size:12px"
                    onclick="App.navigateTo('orders')">
              Все →
            </button>
          </div>
          <div class="recent-orders-list">
    `;

    // Последние 5 заказов
    const recentOrders = [...orders]
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .slice(0, 5);

    if (recentOrders.length === 0) {
      h += `
        <div class="empty-state-mini">
          <div style="font-size:48px;margin-bottom:8px">📭</div>
          <div style="color:var(--t3);font-size:14px">Заказов ещё нет</div>
          <button class="btn" style="margin-top:12px;padding:8px 16px;font-size:13px"
                  data-action="newOrder">
            Создать первый заказ
          </button>
        </div>
      `;
    } else {
      for (const o of recentOrders) {
        const client = clients.find(c => c.id === o.clientId);
        const statusInfo = _getOrderStatus(o.status);

        h += `
          <div class="recent-order-row" onclick="App.navigateTo('orders')">
            <div class="ro-main">
              <div class="ro-title">
                <strong>${App.esc(client?.name || 'Без клиента')}</strong>
                <span class="badge ${statusInfo.badge}" style="font-size:10px">
                  ${statusInfo.icon} ${statusInfo.label}
                </span>
              </div>
              <div class="ro-sub">
                ${(o.items || []).length} поз. · ${App.relTime(o.ts)}
              </div>
            </div>
            <div class="ro-amount">
              ${App.fmtMoney(o.finalAmount || 0)}
            </div>
          </div>
        `;
      }
    }

    h += `
          </div>
        </div>
      </div>

      <!-- Нижняя секция: графики и уведомления -->
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px">
        <!-- График продаж за неделю -->
        <div class="card glass" style="padding:24px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
            <div>
              <h3 style="font-size:16px;margin:0 0 4px">Выручка за неделю</h3>
              <div class="hint">Всего: <strong class="text-gradient">${App.fmtMoney(weekRevenue)}</strong></div>
            </div>
            <div style="display:flex;gap:6px">
              <span class="badge binfo">7 дней</span>
            </div>
          </div>
          <div style="height:240px;position:relative">
            <canvas id="weekChart"></canvas>
          </div>
        </div>

        <!-- Панель уведомлений -->
        <div class="card glass" style="padding:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="font-size:16px;display:flex;align-items:center;gap:8px;margin:0">
              🔔 Уведомления
            </h3>
            <span class="badge ${lowStock.length > 0 ? 'bda' : 'bok'}">
              ${lowStock.length}
            </span>
          </div>
          <div class="alerts-list">
    `;

    // Уведомления
    if (lowStock.length > 0) {
      h += `
        <div class="alert-item warn">
          <div class="alert-icon">⚠️</div>
          <div class="alert-content">
            <div class="alert-title">Низкие остатки</div>
            <div class="alert-text">
              ${lowStock.slice(0, 3).map(f => App.esc(f.name)).join(', ')}
              ${lowStock.length > 3 ? ` и ещё ${lowStock.length - 3}` : ''}
            </div>
          </div>
        </div>
      `;
    }

    if (activeOrders.length > 0) {
      h += `
        <div class="alert-item info">
          <div class="alert-icon">📦</div>
          <div class="alert-content">
            <div class="alert-title">Активные заказы</div>
            <div class="alert-text">${activeOrders.length} ${_pluralize(activeOrders.length, 'заказ в работе', 'заказа в работе', 'заказов в работе')}</div>
          </div>
        </div>
      `;
    }

    if (weekLoss > 0) {
      h += `
        <div class="alert-item danger">
          <div class="alert-icon">📉</div>
          <div class="alert-content">
            <div class="alert-title">Потери за неделю</div>
            <div class="alert-text">${App.fmtMoney(weekLoss)} от списаний</div>
          </div>
        </div>
      `;
    }

    if (todayRevenue === 0 && todayOrders.length === 0) {
      h += `
        <div class="alert-item success">
          <div class="alert-icon">🌟</div>
          <div class="alert-content">
            <div class="alert-title">Новый день!</div>
            <div class="alert-text">Создайте первый заказ сегодня</div>
          </div>
        </div>
      `;
    }

    if (lowStock.length === 0 && activeOrders.length === 0 && weekLoss === 0) {
      h += `
        <div class="empty-state-mini">
          <div style="font-size:48px;margin-bottom:8px">✨</div>
          <div style="color:var(--t3);font-size:13px">Всё отлично, уведомлений нет</div>
        </div>
      `;
    }

    h += `
          </div>
        </div>
      </div>
    `;

    App.$('#view').innerHTML = h;
    App.setLoading?.(false);

    // ===== АНИМАЦИЯ ЧИСЕЛ =====
    _animateCounters();

    // ===== ОБРАБОТЧИКИ =====
    _attachDashboardListeners(recentOrders, lowStock);

    // ===== ГРАФИК =====
    _renderWeekChart(orders, weekAgoTs);

  } catch (err) {
    console.error('Dashboard error:', err);
    App.$('#view').innerHTML = `
      <div class="card" style="color:var(--bad);padding:40px;text-align:center">
        <div style="font-size:64px;margin-bottom:16px">⚠️</div>
        <h2>Ошибка загрузки дашборда</h2>
        <p class="hint">${App.esc(err.message || 'Неизвестная ошибка')}</p>
      </div>
    `;
    App.setLoading?.(false);
  }
};

/* =========================================================
 *  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
 * ========================================================= */

function _pluralize(n, one, few, many) {
  n = Math.abs(n) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}

function _formatShiftDuration(startedAt) {
  if (!startedAt) return '';
  const ms = Date.now() - startedAt;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  return `${minutes} мин`;
}

function _getOrderStatus(status) {
  const map = {
    'new':        { label: 'Новый',      badge: 'binfo', icon: '🆕' },
    'processing': { label: 'В работе',   badge: 'bwa',   icon: '⚙️' },
    'ready':      { label: 'Готов',      badge: 'bpur',  icon: '✅' },
    'completed':  { label: 'Выполнен',   badge: 'bok',   icon: '🎉' },
    'cancelled':  { label: 'Отменён',    badge: 'bda',   icon: '❌' },
    'delivered':  { label: 'Доставлен',  badge: 'bok',   icon: '🚚' }
  };
  return map[status] || { label: status || '—', badge: 'bmu', icon: '📋' };
}

/* ---------- Анимация чисел ---------- */
function _animateCounters() {
  const counters = document.querySelectorAll('.metric-value');
  counters.forEach(el => {
    const text = el.textContent;
    // Если это деньги — анимируем число
    if (text.includes('₽') || text.includes('$') || text.includes('€')) {
      const num = parseInt(text.replace(/[^\d]/g, '')) || 0;
      if (num === 0) return;

      const duration = 1000;
      const start = performance.now();
      const symbol = text.match(/[^\d\s]/g)?.[0] || '';

      const step = (timestamp) => {
        const progress = Math.min((timestamp - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        const current = Math.floor(num * eased);
        el.textContent = App.fmtMoney(current);
        if (progress < 1) requestAnimationFrame(step);
      };

      requestAnimationFrame(step);
    }
  });
}

/* ---------- График за неделю ---------- */
function _renderWeekChart(orders, weekAgoTs) {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js не загружен');
    return;
  }

  const canvas = document.getElementById('weekChart');
  if (!canvas) return;

  // Группируем по дням
  const days = [];
  const values = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(today);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dayRevenue = orders
      .filter(o =>
        o.ts >= dayStart.getTime() &&
        o.ts < dayEnd.getTime() &&
        o.status === 'completed'
      )
      .reduce((s, o) => s + (o.finalAmount || 0), 0);

    days.push(App.MONTHS_SHORT[dayStart.getMonth()] + ' ' + dayStart.getDate());
    values.push(dayRevenue);
  }

  const ctx = canvas.getContext('2d');

  // Градиент
  const gradient = ctx.createLinearGradient(0, 0, 0, 240);
  gradient.addColorStop(0, 'rgba(88, 86, 214, 0.3)');
  gradient.addColorStop(1, 'rgba(88, 86, 214, 0)');

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: days,
      datasets: [{
        label: 'Выручка',
        data: values,
        borderColor: '#5856D6',
        backgroundColor: gradient,
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBackgroundColor: '#5856D6',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#5856D6',
        pointHoverBorderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(29, 29, 31, 0.95)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 12,
          cornerRadius: 12,
          titleFont: { size: 13, weight: '600' },
          bodyFont: { size: 14, weight: '700' },
          displayColors: false,
          callbacks: {
            label: (ctx) => App.fmtMoney(ctx.parsed.y)
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#86868B',
            font: { size: 11, weight: '500' }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(120, 120, 128, 0.08)',
            drawBorder: false
          },
          ticks: {
            color: '#86868B',
            font: { size: 11, weight: '500' },
            callback: (v) => App.numShort(v)
          }
        }
      },
      animation: {
        duration: 1200,
        easing: 'easeOutQuart'
      }
    }
  });

  App._chartInstances = App._chartInstances || [];
  App._chartInstances.push(chart);
}

/* ---------- Обработчики ---------- */
function _attachDashboardListeners(recentOrders, lowStock) {
  const view = App.$('#view');
  if (!view) return;

  // Клик по метрикам
  view.querySelectorAll('.metric-card[data-action]').forEach(card => {
    card.addEventListener('click', () => {
      const action = card.dataset.action;
      if (action === 'orders') App.navigateTo('orders');
      else if (action === 'flowers') App.navigateTo('flowers');
      else if (action === 'clients') App.navigateTo('clients');
    });
  });

  // Быстрые действия
  view.querySelectorAll('.quick-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;

      switch (action) {
        case 'newOrder':
          App.navigateTo('orders');
          setTimeout(() => {
            if (typeof App.editOrder === 'function') App.editOrder(null);
          }, 200);
          break;
        case 'newClient':
          App.navigateTo('clients');
          setTimeout(() => {
            if (typeof App.editClient === 'function') App.editClient(null);
          }, 200);
          break;
        case 'newFlower':
          App.navigateTo('flowers');
          setTimeout(() => {
            if (typeof App.editFlower === 'function') App.editFlower(null);
          }, 200);
          break;
        case 'newSupply':
          App.navigateTo('supplies');
          setTimeout(() => {
            if (typeof App.editSupply === 'function') App.editSupply(null);
          }, 200);
          break;
        case 'calendar':
          App.navigateTo('calendar');
          break;
        case 'analytics':
          App.navigateTo('analytics');
          break;
      }
    });
  });
}

console.log('dashboard.js loaded (v3.0 Apple-style)');