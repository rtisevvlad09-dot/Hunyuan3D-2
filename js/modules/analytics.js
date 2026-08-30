// ===== АНАЛИТИКА =====
// js/modules/analytics.js
// v2.0 — с фильтрами дат, сравнением периодов, экспортом, drill-down

/* ---------- Периоды для фильтра ---------- */
const PERIODS = [
  { id: 'today', label: 'Сегодня', days: 0 },
  { id: 'week', label: 'Неделя', days: 7 },
  { id: 'month', label: 'Месяц', days: 30 },
  { id: 'quarter', label: 'Квартал', days: 90 },
  { id: 'year', label: 'Год', days: 365 },
  { id: 'all', label: 'Всё время', days: -1 }
];

/* ---------- Вкладки ---------- */
const ANALYTICS_TABS = [
  { id: 'profit',   label: '💰 Прибыль',    icon: '💰' },
  { id: 'charts',   label: '📊 Графики',    icon: '📊' },
  { id: 'abc',      label: '🔤 ABC-анализ', icon: '🔤' },
  { id: 'expenses', label: '💸 Расходы',    icon: '💸' },
  { id: 'staff',    label: '👥 Сотрудники', icon: '👥' },
  { id: 'products', label: '🌸 Товары',     icon: '🌸' }
];

/* ---------- Кэш вычислений ---------- */
let _analyticsCache = {
  period: null,
  data: null,
  computedAt: 0
};

/* ---------- Утилиты для работы с датами ---------- */
const dateUtils = {
  getDateRange(periodId) {
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    const period = PERIODS.find(p => p.id === periodId) || PERIODS[2];

    if (period.days === -1) {
      return { from: 0, to: now.getTime() };
    }

    if (period.days === 0) {
      // Сегодня
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return { from: today.getTime(), to: now.getTime() };
    }

    const from = new Date();
    from.setDate(from.getDate() - period.days);
    from.setHours(0, 0, 0, 0);

    return { from: from.getTime(), to: now.getTime() };
  },

  getPreviousRange(periodId) {
    const { from, to } = this.getDateRange(periodId);
    const duration = to - from;
    return { from: from - duration, to: from - 1 };
  },

  isInRange(ts, from, to) {
    return ts >= from && ts <= to;
  }
};

/* ---------- Вычисление метрик (с кэшированием) ---------- */
async function computeMetrics(periodId) {
  const cacheKey = periodId;
  const cacheAge = Date.now() - _analyticsCache.computedAt;

  // Используем кэш если он свежий (< 30 секунд)
  if (_analyticsCache.period === cacheKey && cacheAge < 30000) {
    return _analyticsCache.data;
  }

  App.setLoading?.(true);

  try {
    const range = dateUtils.getDateRange(periodId);
    const prevRange = dateUtils.getPreviousRange(periodId);

    // Загружаем все нужные данные
    const [orders, flowers, expenses, users, shifts, returns] = await Promise.all([
      App.repo('orders').all(),
      App.repo('flowers').all(),
      App.repo('expenses').all(),
      App.repo('users').all(),
      App.repo('shifts').all(),
      App.repo('returns').all()
    ]);

    // Быстрые Map для поиска
    const flowersMap = new Map(flowers.map(f => [f.id, f]));
    const usersMap = new Map(users.map(u => [u.id, u]));

    // Фильтруем заказы по периоду
    const periodOrders = orders.filter(o =>
      o.status === 'completed' && dateUtils.isInRange(o.ts, range.from, range.to)
    );
    const prevOrders = orders.filter(o =>
      o.status === 'completed' && dateUtils.isInRange(o.ts, prevRange.from, prevRange.to)
    );

    // Возвраты
    const periodReturns = returns.filter(r =>
      dateUtils.isInRange(r.ts, range.from, range.to)
    );
    const prevReturns = returns.filter(r =>
      dateUtils.isInRange(r.ts, prevRange.from, prevRange.to)
    );

    // Расходы
    const periodExpenses = expenses.filter(e =>
      dateUtils.isInRange(e.ts, range.from, range.to)
    );
    const prevExpenses = expenses.filter(e =>
      dateUtils.isInRange(e.ts, prevRange.from, prevRange.to)
    );

    // Считаем метрики
    const metrics = {
      // Выручка
      revenue: periodOrders.reduce((s, o) => s + (o.finalAmount || 0), 0),
      prevRevenue: prevOrders.reduce((s, o) => s + (o.finalAmount || 0), 0),

      // Возвраты
      returns: periodReturns.reduce((s, r) => s + (r.amount || 0), 0),
      prevReturns: prevReturns.reduce((s, r) => s + (r.amount || 0), 0),

      // Чистая выручка
      netRevenue: 0,
      prevNetRevenue: 0,

      // Себестоимость
      cogs: 0,
      prevCogs: 0,

      // Расходы
      expenses: periodExpenses.reduce((s, e) => s + (e.amount || 0), 0),
      prevExpenses: prevExpenses.reduce((s, e) => s + (e.amount || 0), 0),

      // Прибыль
      profit: 0,
      prevProfit: 0,
      margin: 0,

      // Количество заказов
      ordersCount: periodOrders.length,
      prevOrdersCount: prevOrders.length,
      avgCheck: 0,
      prevAvgCheck: 0,

      // По категориям
      categorySales: {},
      categoryProfit: {},

      // По товарам (для ABC)
      productStats: new Map(),

      // По сотрудникам
      staffStats: new Map(),

      // По дням (для графиков)
      revenueByDay: {},
      ordersByDay: {},

      // Raw данные для drill-down
      periodOrders,
      periodExpenses,
      periodReturns
    };

    // Чистая выручка
    metrics.netRevenue = metrics.revenue - metrics.returns;
    metrics.prevNetRevenue = metrics.prevRevenue - metrics.prevReturns;

    // Средний чек
    metrics.avgCheck = metrics.ordersCount > 0
      ? metrics.netRevenue / metrics.ordersCount
      : 0;
    metrics.prevAvgCheck = metrics.prevOrdersCount > 0
      ? metrics.prevNetRevenue / metrics.prevOrdersCount
      : 0;

    // Себестоимость + статистика по товарам
    for (const o of periodOrders) {
      for (const it of (o.items || [])) {
        if (it.type === 'bouquet') {
          // Для букета считаем компоненты
          for (const c of (it.components || [])) {
            const fl = flowersMap.get(c.flowerId);
            if (!fl) continue;

            const qty = c.quantity * (it.quantity || 1);
            const cost = (fl.purchasePrice || 0) * qty;
            const revenue = (fl.shopPrice || 0) * qty;

            metrics.cogs += cost;

            // Статистика по товару
            const stat = metrics.productStats.get(fl.id) || {
              flower: fl,
              revenue: 0,
              cost: 0,
              count: 0,
              profit: 0
            };
            stat.revenue += revenue;
            stat.cost += cost;
            stat.count += qty;
            stat.profit += (revenue - cost);
            metrics.productStats.set(fl.id, stat);

            // По категориям
            const topCat = getTopCategory(fl.category);
            metrics.categorySales[topCat] = (metrics.categorySales[topCat] || 0) + revenue;
            metrics.categoryProfit[topCat] = (metrics.categoryProfit[topCat] || 0) + (revenue - cost);
          }
        } else {
          const fl = flowersMap.get(it.flowerId);
          if (!fl) continue;

          const qty = it.quantity || 1;
          const revenue = (it.price || fl.shopPrice || 0) * qty;
          const cost = (fl.purchasePrice || 0) * qty;

          metrics.cogs += cost;

          const stat = metrics.productStats.get(fl.id) || {
            flower: fl,
            revenue: 0,
            cost: 0,
            count: 0,
            profit: 0
          };
          stat.revenue += revenue;
          stat.cost += cost;
          stat.count += qty;
          stat.profit += (revenue - cost);
          metrics.productStats.set(fl.id, stat);

          const topCat = getTopCategory(fl.category);
          metrics.categorySales[topCat] = (metrics.categorySales[topCat] || 0) + revenue;
          metrics.categoryProfit[topCat] = (metrics.categoryProfit[topCat] || 0) + (revenue - cost);
        }
      }
    }

    // Предыдущая себестоимость
    for (const o of prevOrders) {
      for (const it of (o.items || [])) {
        if (it.type === 'bouquet') {
          for (const c of (it.components || [])) {
            const fl = flowersMap.get(c.flowerId);
            if (fl) {
              metrics.prevCogs += (fl.purchasePrice || 0) * c.quantity * (it.quantity || 1);
            }
          }
        } else {
          const fl = flowersMap.get(it.flowerId);
          if (fl) {
            metrics.prevCogs += (fl.purchasePrice || 0) * (it.quantity || 1);
          }
        }
      }
    }

    // Прибыль и маржа
    metrics.profit = metrics.netRevenue - metrics.cogs - metrics.expenses;
    metrics.prevProfit = metrics.prevNetRevenue - metrics.prevCogs - metrics.prevExpenses;
    metrics.margin = metrics.netRevenue > 0
      ? (metrics.profit / metrics.netRevenue) * 100
      : 0;

    // Статистика по сотрудникам
    for (const u of users) {
      const userOrders = periodOrders.filter(o => o.createdById === u.id);
      const userShifts = shifts.filter(s =>
        s.userId === u.id &&
        s.status === 'closed' &&
        dateUtils.isInRange(s.closedAt || s.ts, range.from, range.to)
      );

      const userRevenue = userOrders.reduce((s, o) => s + (o.finalAmount || 0), 0);
      const userHours = userShifts.reduce((s, x) => s + (x.hours || 0), 0);

      metrics.staffStats.set(u.id, {
        user: u,
        orders: userOrders.length,
        revenue: userRevenue,
        shifts: userShifts.length,
        hours: userHours,
        avgCheck: userOrders.length > 0 ? userRevenue / userOrders.length : 0
      });
    }

    // По дням (для графиков)
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      const dayTs = d.getTime();
      const nextDayTs = dayTs + 86400000;

      metrics.revenueByDay[key] = orders
        .filter(o => o.status === 'completed' && o.ts >= dayTs && o.ts < nextDayTs)
        .reduce((s, o) => s + (o.finalAmount || 0), 0);

      metrics.ordersByDay[key] = orders
        .filter(o => o.status === 'completed' && o.ts >= dayTs && o.ts < nextDayTs)
        .length;
    }

    // Кэшируем результат
    _analyticsCache = {
      period: cacheKey,
      data: metrics,
      computedAt: Date.now()
    };

    return metrics;
  } finally {
    App.setLoading?.(false);
  }
}

/* ---------- Получить top-категорию ---------- */
function getTopCategory(subcategory) {
  for (const [top, subs] of Object.entries(App.CAT_OPTS || {})) {
    if (subs.includes(subcategory)) return top;
  }
  return 'Прочее';
}

/* ---------- Процент изменения ---------- */
function getChangePercent(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/* ---------- Рендер индикатора изменения ---------- */
function renderChange(current, previous, isMoney = true) {
  const pct = getChangePercent(current, previous);
  if (Math.abs(pct) < 0.1) {
    return '<span style="color:var(--t3);font-size:11px">— без изменений</span>';
  }

  const isUp = pct > 0;
  const arrow = isUp ? '↑' : '↓';
  const color = isUp ? 'var(--good)' : 'var(--bad)';
  const text = isMoney
    ? `${arrow} ${App.fmtMoney(Math.abs(current - previous))} (${Math.abs(pct).toFixed(1)}%)`
    : `${arrow} ${Math.abs(pct).toFixed(1)}%`;

  return `<span style="color:${color};font-size:11px;font-weight:600">${text}</span>`;
}

/* ---------- Основной рендер ---------- */
App.renderAnalytics = async function() {
  if (!App.Auth?.can('owner', 'admin')) {
    App.$('#view').innerHTML = '<div class="card" style="text-align:center;padding:40px">Нет доступа</div>';
    return;
  }

  App.destroyAllCharts();

  // Инициализация периода если не выбран
  if (!App.state.analyticsPeriod) {
    App.state.analyticsPeriod = 'month';
  }
  if (!App.state.analyticsTab) {
    App.state.analyticsTab = 'profit';
  }

  const h = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div class="a-tabs" style="margin:0">
        ${ANALYTICS_TABS.map(t =>
          `<button class="a-tab ${App.state.analyticsTab === t.id ? 'on' : ''}" data-tab="${t.id}">${t.label}</button>`
        ).join('')}
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <select class="inp" id="periodSelect" style="width:auto;padding:8px 12px">
          ${PERIODS.map(p =>
            `<option value="${p.id}" ${App.state.analyticsPeriod === p.id ? 'selected' : ''}>${p.label}</option>`
          ).join('')}
        </select>
        <button class="btn g" id="exportBtn" title="Экспорт отчёта">📤</button>
      </div>
    </div>
    <div id="aBody"></div>
  `;

  App.$('#view').innerHTML = h;

  // Event delegation (один раз)
  const view = App.$('#view');
  if (!view.dataset.analyticsListeners) {
    view.dataset.analyticsListeners = '1';

    view.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('[data-tab]');
      if (tabBtn) {
        App.destroyAllCharts();
        App.state.analyticsTab = tabBtn.dataset.tab;
        App.renderAnalytics();
        return;
      }
    });

    view.addEventListener('change', (e) => {
      if (e.target.id === 'periodSelect') {
        _analyticsCache = { period: null, data: null, computedAt: 0 }; // Сброс кэша
        App.state.analyticsPeriod = e.target.value;
        App.renderAnalytics();
      }
    });
  }

  const exportBtn = App.$('#exportBtn');
  if (exportBtn) {
    exportBtn.onclick = () => exportAnalytics();
  }

  await App.renderAnalyticsBody();
};

/* ---------- Рендер тела аналитики ---------- */
App.renderAnalyticsBody = async function() {
  const body = App.$('#aBody');
  if (!body) return;

  body.innerHTML = '<div class="card" style="text-align:center;padding:40px">Загрузка...</div>';

  try {
    const metrics = await computeMetrics(App.state.analyticsPeriod);

    // Индикатор последнего обновления
    const updatedAt = new Date(_analyticsCache.computedAt);
    const updateInfo = `<div style="text-align:right;font-size:11px;color:var(--t3);margin-bottom:10px">
      Обновлено: ${App.fmtTime(updatedAt)}
    </div>`;

    let h = updateInfo;

    switch (App.state.analyticsTab) {
      case 'profit':   h += renderProfitTab(metrics); break;
      case 'charts':   h += await renderChartsTab(metrics); return; // charts сам вставляет HTML
      case 'abc':      h += renderABCTab(metrics); break;
      case 'expenses': h += renderExpensesTab(metrics); break;
      case 'staff':    h += renderStaffTab(metrics); break;
      case 'products': h += renderProductsTab(metrics); break;
      default:         h += renderProfitTab(metrics);
    }

    body.innerHTML = h;
  } catch (e) {
    console.error('Analytics error:', e);
    body.innerHTML = `<div class="card" style="text-align:center;padding:40px;color:var(--bad)">
      Ошибка загрузки: ${App.esc(e.message)}
    </div>`;
  }
};

/* ---------- Вкладка: Прибыль ---------- */
function renderProfitTab(m) {
  return `
    <div class="g">
      <div class="card stat">
        <div class="big">💰 ${App.fmtMoney(m.revenue)}</div>
        <div class="sm">Выручка</div>
        <div style="margin-top:6px">${renderChange(m.revenue, m.prevRevenue)}</div>
      </div>
      <div class="card stat">
        <div class="big">↩️ ${App.fmtMoney(m.returns)}</div>
        <div class="sm">Возвраты</div>
        <div style="margin-top:6px">${renderChange(m.returns, m.prevReturns)}</div>
      </div>
      <div class="card stat">
        <div class="big">📦 ${App.fmtMoney(m.cogs)}</div>
        <div class="sm">Себестоимость</div>
        <div style="margin-top:6px">${renderChange(m.cogs, m.prevCogs)}</div>
      </div>
      <div class="card stat">
        <div class="big">💸 ${App.fmtMoney(m.expenses)}</div>
        <div class="sm">Расходы</div>
        <div style="margin-top:6px">${renderChange(m.expenses, m.prevExpenses)}</div>
      </div>
    </div>
    <div class="g">
      <div class="card stat" style="background:${m.profit >= 0
        ? 'linear-gradient(135deg,#d1fae5,#a7f3d0)'
        : 'linear-gradient(135deg,#fee2e2,#fecaca)'}">
        <div class="big">${m.profit >= 0 ? '📈' : '📉'} ${App.fmtMoney(m.profit)}</div>
        <div class="sm">Чистая прибыль • Маржа ${m.margin.toFixed(1)}%</div>
        <div style="margin-top:6px">${renderChange(m.profit, m.prevProfit)}</div>
      </div>
      <div class="card stat">
        <div class="big">🧾 ${m.ordersCount}</div>
        <div class="sm">Заказов</div>
        <div style="margin-top:6px">${renderChange(m.ordersCount, m.prevOrdersCount, false)}</div>
      </div>
      <div class="card stat">
        <div class="big">💵 ${App.fmtMoney(m.avgCheck)}</div>
        <div class="sm">Средний чек</div>
        <div style="margin-top:6px">${renderChange(m.avgCheck, m.prevAvgCheck)}</div>
      </div>
      <div class="card stat">
        <div class="big">💎 ${App.fmtMoney(m.netRevenue)}</div>
        <div class="sm">Чистая выручка</div>
        <div style="margin-top:6px">${renderChange(m.netRevenue, m.prevNetRevenue)}</div>
      </div>
    </div>
  `;
}

/* ---------- Вкладка: Графики ---------- */
async function renderChartsTab(m) {
  const body = App.$('#aBody');

  if (typeof Chart === 'undefined') {
    body.innerHTML = '<div class="card" style="text-align:center;padding:40px">Chart.js не загружен</div>';
    return;
  }

  body.innerHTML = `
    <div class="chart-box">
      <h4>Выручка за последние 30 дней</h4>
      <canvas id="revChart" height="100"></canvas>
    </div>
    <div class="chart-box">
      <h4>Продажи по категориям</h4>
      <canvas id="catChart" height="100"></canvas>
    </div>
  `;

  const isDark = document.documentElement.dataset.theme === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.06)';
  const textColor = isDark ? '#b0b0c8' : '#4a4a6a';

  // График выручки
  const ctx1 = document.getElementById('revChart');
  if (ctx1) {
    const labels = Object.keys(m.revenueByDay);
    const data = Object.values(m.revenueByDay);

    App._chartInstances.push(new Chart(ctx1, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Выручка, ₽',
          data,
          borderColor: '#6C5CE7',
          backgroundColor: 'rgba(108,92,231,.15)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: textColor } },
          tooltip: {
            callbacks: {
              label: (ctx) => 'Выручка: ' + App.fmtMoney(ctx.parsed.y)
            }
          }
        },
        scales: {
          x: { ticks: { color: textColor, maxRotation: 45 }, grid: { color: gridColor } },
          y: {
            ticks: {
              color: textColor,
              callback: (v) => App.num(v) + ' ₽'
            },
            grid: { color: gridColor }
          }
        }
      }
    }));
  }

  // График по категориям
  const ctx2 = document.getElementById('catChart');
  if (ctx2) {
    const labels = Object.keys(m.categorySales);
    const data = Object.values(m.categorySales);

    if (labels.length === 0) {
      body.innerHTML += '<div class="card" style="text-align:center;color:var(--t3)">Нет данных по категориям</div>';
    } else {
      const colors = ['#6C5CE7', '#00B894', '#FDCB6E', '#FF6B6B', '#0984E3', '#E17055', '#A29BFE', '#74B9FF'];

      App._chartInstances.push(new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{ data, backgroundColor: colors }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: textColor, padding: 15 }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const value = ctx.parsed;
                  const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                  return `${ctx.label}: ${App.fmtMoney(value)} (${pct}%)`;
                }
              }
            }
          }
        }
      }));
    }
  }
}

/* ---------- Вкладка: ABC-анализ ---------- */
function renderABCTab(m) {
  const items = Array.from(m.productStats.values())
    .filter(s => s.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  if (items.length === 0) {
    return `
      <div class="card" style="text-align:center;padding:40px">
        <div style="font-size:48px;margin-bottom:10px">📊</div>
        <div style="color:var(--t3)">Нет данных о продажах за выбранный период</div>
        <div class="hint" style="margin-top:10px">Попробуйте выбрать больший период</div>
      </div>
    `;
  }

  const totalRev = items.reduce((s, i) => s + i.revenue, 0);
  const totalProfit = items.reduce((s, i) => s + i.profit, 0);
  let cumulative = 0;

  const rows = items.map(i => {
    cumulative += i.revenue;
    const pct = totalRev > 0 ? cumulative / totalRev : 0;
    const cls = pct <= 0.8 ? 'abc-a' : pct <= 0.95 ? 'abc-b' : 'abc-c';
    const letter = pct <= 0.8 ? 'A' : pct <= 0.95 ? 'B' : 'C';
    const marginPct = i.revenue > 0 ? ((i.profit / i.revenue) * 100).toFixed(1) : 0;

    return `<tr>
      <td>${i.flower.emoji || '🌸'} ${App.esc(i.flower.name)}</td>
      <td>${i.count}</td>
      <td><strong>${App.fmtMoney(i.revenue)}</strong></td>
      <td>${App.fmtMoney(i.profit)}</td>
      <td>${marginPct}%</td>
      <td>${(totalRev > 0 ? ((i.revenue / totalRev) * 100).toFixed(1) : 0)}%</td>
      <td><span class="badge ${cls}">${letter}</span></td>
    </tr>`;
  }).join('');

  return `
    <div class="card" style="margin-bottom:14px">
      <p class="hint">
        <strong>A</strong> — топ 80% выручки (самые важные) •
        <strong>B</strong> — следующие 15% •
        <strong>C</strong> — остальные 5%
      </p>
      <p class="hint" style="margin-top:6px">
        Общая выручка: <strong>${App.fmtMoney(totalRev)}</strong> •
        Прибыль: <strong>${App.fmtMoney(totalProfit)}</strong>
      </p>
    </div>
    <div class="twrap">
      <table>
        <thead>
          <tr>
            <th>Товар</th>
            <th>Продано</th>
            <th>Выручка</th>
            <th>Прибыль</th>
            <th>Маржа</th>
            <th>Доля</th>
            <th>Группа</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/* ---------- Вкладка: Расходы ---------- */
function renderExpensesTab(m) {
  const catTotals = {};
  for (const e of m.periodExpenses) {
    catTotals[e.category] = (catTotals[e.category] || 0) + (e.amount || 0);
  }

  const totalExp = m.expenses;
  const entries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    return `
      <div class="card" style="text-align:center;padding:40px">
        <div style="font-size:48px;margin-bottom:10px">💸</div>
        <div style="color:var(--t3)">Нет расходов за выбранный период</div>
        <button class="btn" style="margin-top:10px" onclick="App.navigateTo('expenses')">Добавить расход</button>
      </div>
    `;
  }

  const rows = entries.map(([cat, sum]) => `
    <tr>
      <td>${App.esc(cat)}</td>
      <td><strong>${App.fmtMoney(sum)}</strong></td>
      <td>${totalExp > 0 ? ((sum / totalExp) * 100).toFixed(1) : 0}%</td>
      <td>
        <div style="background:var(--in);border-radius:4px;height:6px;width:100px">
          <div style="background:var(--p);border-radius:4px;height:100%;width:${totalExp > 0 ? ((sum / totalExp) * 100) : 0}%"></div>
        </div>
      </td>
    </tr>
  `).join('');

  return `
    <div class="card" style="margin-bottom:14px">
      <div class="big" style="font-size:20px">💸 Всего расходов: ${App.fmtMoney(totalExp)}</div>
      <div style="margin-top:6px">${renderChange(totalExp, m.prevExpenses)}</div>
    </div>
    <div class="twrap">
      <table>
        <thead>
          <tr>
            <th>Категория</th>
            <th>Сумма</th>
            <th>Доля</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/* ---------- Вкладка: Сотрудники ---------- */
function renderStaffTab(m) {
  const stats = Array.from(m.staffStats.values())
    .filter(s => s.orders > 0 || s.shifts > 0)
    .sort((a, b) => b.revenue - a.revenue);

  if (stats.length === 0) {
    return `
      <div class="card" style="text-align:center;padding:40px">
        <div style="font-size:48px;margin-bottom:10px">👥</div>
        <div style="color:var(--t3)">Нет данных о работе сотрудников</div>
      </div>
    `;
  }

  const rows = stats.map(s => `
    <tr>
      <td>${s.user.emoji || '👤'} <strong>${App.esc(s.user.name)}</strong></td>
      <td>${s.orders}</td>
      <td><strong>${App.fmtMoney(s.revenue)}</strong></td>
      <td>${App.fmtMoney(s.avgCheck)}</td>
      <td>${s.shifts}</td>
      <td>${s.hours.toFixed(1)}</td>
    </tr>
  `).join('');

  return `
    <div class="twrap">
      <table>
        <thead>
          <tr>
            <th>Сотрудник</th>
            <th>Заказов</th>
            <th>Выручка</th>
            <th>Ср. чек</th>
            <th>Смен</th>
            <th>Часов</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/* ---------- Вкладка: Товары ---------- */
function renderProductsTab(m) {
  const items = Array.from(m.productStats.values())
    .filter(s => s.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  if (items.length === 0) {
    return `
      <div class="card" style="text-align:center;padding:40px">
        <div style="font-size:48px;margin-bottom:10px">🌸</div>
        <div style="color:var(--t3)">Нет продаж за выбранный период</div>
      </div>
    `;
  }

  const rows = items.map(s => `
    <tr>
      <td>${s.flower.emoji || '🌸'} ${App.esc(s.flower.name)}</td>
      <td><strong>${s.count}</strong></td>
      <td>${App.fmtMoney(s.flower.shopPrice)}</td>
      <td><strong>${App.fmtMoney(s.revenue)}</strong></td>
      <td>${App.fmtMoney(s.profit)}</td>
    </tr>
  `).join('');

  return `
    <div class="card" style="margin-bottom:14px">
      <p class="hint">Топ-30 товаров по количеству продаж</p>
    </div>
    <div class="twrap">
      <table>
        <thead>
          <tr>
            <th>Товар</th>
            <th>Продано, шт</th>
            <th>Цена</th>
            <th>Выручка</th>
            <th>Прибыль</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/* ---------- Экспорт аналитики ---------- */
async function exportAnalytics() {
  try {
    const metrics = await computeMetrics(App.state.analyticsPeriod);
    const periodLabel = PERIODS.find(p => p.id === App.state.analyticsPeriod)?.label || 'Период';

    const report = {
      generatedAt: new Date().toISOString(),
      period: periodLabel,
      summary: {
        revenue: metrics.revenue,
        returns: metrics.returns,
        netRevenue: metrics.netRevenue,
        cogs: metrics.cogs,
        expenses: metrics.expenses,
        profit: metrics.profit,
        margin: metrics.margin,
        ordersCount: metrics.ordersCount,
        avgCheck: metrics.avgCheck
      },
      categorySales: metrics.categorySales,
      topProducts: Array.from(metrics.productStats.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 50)
        .map(s => ({
          name: s.flower.name,
          count: s.count,
          revenue: s.revenue,
          profit: s.profit
        })),
      staffStats: Array.from(metrics.staffStats.values()).map(s => ({
        name: s.user.name,
        orders: s.orders,
        revenue: s.revenue,
        shifts: s.shifts,
        hours: s.hours
      }))
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_${App.toLocalDateString(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);

    App.Toast.ok('Отчёт экспортирован');

    if (App.Audit) {
      await App.Audit.logExport('analytics', 1, { period: periodLabel });
    }
  } catch (e) {
    App.Toast.er('Ошибка экспорта: ' + e.message);
  }
}

console.log('✅ analytics.js загружен');