// ===== КАЛЕНДАРЬ =====
// js/modules/calendar.js
// v2.0 — с недельным видом, легендой, фильтрами, быстрыми действиями

window.App = window.App || {};

/* ---------- Константы ---------- */
const CAL_VIEWS = [
  { id: 'month', label: '📅 Месяц' },
  { id: 'week',  label: '📆 Неделя' }
];

const EVENT_TYPES = [
  { id: 'orders', label: '📦 Заказы',  color: '#3b82f6' },
  { id: 'shifts', label: '⏰ Смены',   color: '#f59e0b' },
  { id: 'done',   label: '✅ Завершённые', color: '#10b981' }
];

const DELIVERY_ICONS = {
  employee: '👤 Самовывоз',
  courier: '🚚 Курьер',
  pickup: '🏪 Самовывоз',
  delivery: '🚚 Доставка'
};

/* ---------- Утилиты ---------- */
function toDayKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 24 * 60; // В конец списка
  const [h, m] = String(timeStr).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Понедельник = начало
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ---------- Основной рендер ---------- */
App.renderCalendar = async function() {
  if (!App.Auth.can('owner', 'admin', 'employee')) {
    App.$('#view').innerHTML = '<div class="card" style="text-align:center;padding:40px">Нет доступа</div>';
    return;
  }

  App.setLoading?.(true);

  try {
    // Инициализация состояния
    if (!(App.state.calDate instanceof Date) || isNaN(App.state.calDate)) {
      App.state.calDate = new Date();
    }
    if (!App.state.calView) App.state.calView = 'month';
    if (!App.state.calFilters) {
      App.state.calFilters = { orders: true, shifts: true, done: true };
    }

    const y = App.state.calDate.getFullYear();
    const m = App.state.calDate.getMonth();

    const [orders, shifts, users] = await Promise.all([
      App.repo('orders').all(),
      App.repo('shifts').all(),
      App.repo('users').all()
    ]);

    const usersMap = new Map(users.map(u => [u.id, u]));

    // Фильтрация для не-админов
    const filteredOrders = App.Auth.isAdmin()
      ? orders
      : orders.filter(o => o.createdById === App.Auth.user.id);

    const filteredShifts = App.Auth.isAdmin()
      ? shifts
      : shifts.filter(s => s.employeeId === App.Auth.user.id);

    // Предварительная группировка по дням (Map) — устраняет N+1
    const ordersByDay = new Map();
    const shiftsByDay = new Map();

    for (const o of filteredOrders) {
      if (!o.deliveryDate || o.status === 'cancelled') continue;
      const dateObj = new Date(App.parseLocalDate(o.deliveryDate));
      if (isNaN(dateObj)) continue;

      const key = toDayKey(dateObj);
      if (!ordersByDay.has(key)) ordersByDay.set(key, []);
      ordersByDay.get(key).push(o);
    }

    // Сортировка по времени внутри дня
    for (const [, dayOrders] of ordersByDay) {
      dayOrders.sort((a, b) =>
        parseTimeToMinutes(a.deliveryTime) - parseTimeToMinutes(b.deliveryTime)
      );
    }

    for (const s of filteredShifts) {
      if (!s.date) continue;
      const dateObj = new Date(App.parseLocalDate(s.date));
      if (isNaN(dateObj)) continue;

      const key = toDayKey(dateObj);
      if (!shiftsByDay.has(key)) shiftsByDay.set(key, []);
      shiftsByDay.get(key).push(s);
    }

    // Проверка конфликтов смен (один сотрудник, 2 смены в день)
    for (const [, dayShifts] of shiftsByDay) {
      const byEmployee = new Map();
      for (const s of dayShifts) {
        if (!s.employeeId) continue;
        if (!byEmployee.has(s.employeeId)) byEmployee.set(s.employeeId, []);
        byEmployee.get(s.employeeId).push(s);
      }
      for (const [empId, empShifts] of byEmployee) {
        if (empShifts.length > 1) {
          for (const s of empShifts) {
            s._conflict = true;
          }
        }
      }
    }

    // Рендер UI
    let h = `
      <div class="tools">
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn g" data-cal-action="prev">‹</button>
          <button class="btn g" data-cal-action="today">Сегодня</button>
          <button class="btn g" data-cal-action="next">›</button>
          <div style="font-size:20px;font-weight:800;margin-left:8px">
            ${App.MONTHS[m]} ${y}
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <div class="a-tabs" style="margin:0;padding:2px">
            ${CAL_VIEWS.map(v =>
              `<button class="a-tab ${App.state.calView === v.id ? 'on' : ''}" data-cal-view="${v.id}">${v.label}</button>`
            ).join('')}
          </div>
          ${EVENT_TYPES.map(t => `
            <label class="chk" style="margin:0;padding:4px 10px;background:${t.color}20;border-radius:8px">
              <input type="checkbox" data-cal-filter="${t.id}"
                     ${App.state.calFilters[t.id] ? 'checked' : ''}>
              ${t.label}
            </label>
          `).join('')}
          <button class="btn g" data-cal-action="export" title="Экспорт расписания">📤</button>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;font-size:12px">
        <span class="badge binfo">📦 Заказ</span>
        <span class="badge" style="background:#fef3c7;color:#92400e">⏰ Смена</span>
        <span class="badge bok">✓ Завершён</span>
        <span class="badge bwa">⚠️ Конфликт смен</span>
      </div>
    `;

    // Рендер календаря в зависимости от view
    if (App.state.calView === 'month') {
      h += renderMonthView(y, m, ordersByDay, shiftsByDay);
    } else {
      h += renderWeekView(App.state.calDate, ordersByDay, shiftsByDay);
    }

    h += '<div id="calDet"></div>';

    App.$('#view').innerHTML = h;
    App.setLoading?.(false);

    // Event delegation
    _attachCalendarListeners();

  } catch (e) {
    console.error('renderCalendar error:', e);
    App.$('#view').innerHTML = `<div class="card" style="text-align:center;padding:40px;color:var(--bad)">
      Ошибка: ${App.esc(e.message)}
    </div>`;
    App.setLoading?.(false);
  }
};

/* ---------- Месячный вид ---------- */
function renderMonthView(y, m, ordersByDay, shiftsByDay) {
  const first = new Date(y, m, 1);
  let start = first.getDay();
  if (start === 0) start = 7;
  start--;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last = new Date(y, m + 1, 0);

  let h = '<div class="cal">';

  ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach((d, i) => {
    const isWeekend = i >= 5;
    h += `<div class="cal-h" style="${isWeekend ? 'color:var(--bad)' : ''}">${d}</div>`;
  });

  const prevLast = new Date(y, m, 0).getDate();
  for (let i = start - 1; i >= 0; i--) {
    h += `<div class="cal-d off"><div class="n">${prevLast - i}</div></div>`;
  }

  let totalOrders = 0;
  let totalShifts = 0;
  let completedOrders = 0;

  for (let d = 1; d <= last.getDate(); d++) {
    const cur = new Date(y, m, d);
    const key = toDayKey(cur);
    const isToday = isSameDay(cur, today);
    const isWeekend = cur.getDay() === 0 || cur.getDay() === 6;

    const dayOrders = ordersByDay.get(key) || [];
    const dayShifts = shiftsByDay.get(key) || [];

    const activeCount = App.state.calFilters.orders
      ? dayOrders.filter(o => o.status !== 'completed').length
      : 0;
    const doneCount = App.state.calFilters.done
      ? dayOrders.filter(o => o.status === 'completed').length
      : 0;
    const shiftCount = App.state.calFilters.shifts ? dayShifts.length : 0;
    const hasConflict = dayShifts.some(s => s._conflict);

    totalOrders += dayOrders.length;
    totalShifts += dayShifts.length;
    completedOrders += dayOrders.filter(o => o.status === 'completed').length;

    const hasData = activeCount > 0 || doneCount > 0 || shiftCount > 0;
    let cls = 'cal-d';
    if (isToday) cls += ' today';
    if (hasData) cls += ' has';
    if (isWeekend) cls += ' weekend';

    let tags = '';
    if (activeCount) tags += `<span class="tag order">📦${activeCount}</span>`;
    if (doneCount) tags += `<span class="tag done">✓${doneCount}</span>`;
    if (shiftCount) tags += `<span class="tag shift" style="${hasConflict ? 'background:#fef3c7;color:#92400e' : ''}">⏰${shiftCount}${hasConflict ? '⚠️' : ''}</span>`;

    h += `<div class="${cls}" data-cal-day="${y}-${m}-${d}">
      <div class="n">${d}</div>
      <div class="tags">${tags}</div>
    </div>`;
  }

  const total = start + last.getDate();
  const rem = (7 - (total % 7)) % 7;
  for (let d = 1; d <= rem; d++) {
    h += `<div class="cal-d off"><div class="n">${d}</div></div>`;
  }

  h += '</div>';

  // Сводка за месяц
  h += `
    <div class="card" style="margin-top:14px;display:flex;gap:20px;flex-wrap:wrap;justify-content:space-around">
      <div style="text-align:center">
        <div style="font-size:24px;font-weight:800">${totalOrders}</div>
        <div class="hint">Заказов за месяц</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:24px;font-weight:800;color:var(--good)">${completedOrders}</div>
        <div class="hint">Завершено</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:24px;font-weight:800">${totalShifts}</div>
        <div class="hint">Смен</div>
      </div>
    </div>
  `;

  return h;
}

/* ---------- Недельный вид ---------- */
function renderWeekView(date, ordersByDay, shiftsByDay) {
  const weekStart = getWeekStart(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let h = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:10px">';

  for (let i = 0; i < 7; i++) {
    const cur = new Date(weekStart);
    cur.setDate(cur.getDate() + i);
    const key = toDayKey(cur);
    const isToday = isSameDay(cur, today);
    const isWeekend = i >= 5;

    const dayOrders = ordersByDay.get(key) || [];
    const dayShifts = shiftsByDay.get(key) || [];

    h += `
      <div class="card" style="padding:10px;min-height:200px;${isToday ? 'border:2px solid var(--p)' : ''}">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <strong>${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][i]}</strong>
          <span style="color:${isWeekend ? 'var(--bad)' : 'var(--t3)'}">${cur.getDate()}.${String(cur.getMonth() + 1).padStart(2, '0')}</span>
        </div>
    `;

    if (App.state.calFilters.shifts) {
      for (const s of dayShifts) {
        const conflictStyle = s._conflict ? 'background:#fef3c7;' : '';
        h += `
          <div style="font-size:11px;padding:4px 6px;background:#fef3c780;border-radius:6px;margin-bottom:4px;${conflictStyle}">
            ⏰ ${s.startTime || ''}${s.endTime ? ' — ' + s.endTime : ''}
            ${s._conflict ? ' ⚠️' : ''}
          </div>
        `;
      }
    }

    if (App.state.calFilters.orders || App.state.calFilters.done) {
      for (const o of dayOrders) {
        const isDone = o.status === 'completed';
        if (isDone && !App.state.calFilters.done) continue;
        if (!isDone && !App.state.calFilters.orders) continue;

        const bgColor = isDone ? '#d1fae580' : '#dbeafe80';
        const icon = DELIVERY_ICONS[o.deliveryType] || '📦';

        h += `
          <div data-cal-order="${o.id}" style="font-size:11px;padding:4px 6px;background:${bgColor};border-radius:6px;margin-bottom:4px;cursor:pointer">
            📦 ${o.deliveryTime || '—'} • ${App.esc(o.clientName || 'Без имени')}
            <div style="font-size:10px;color:var(--t3)">${App.fmtMoney(o.finalAmount)} ${icon}</div>
          </div>
        `;
      }
    }

    if (!dayOrders.length && !dayShifts.length) {
      h += '<div class="hint" style="text-align:center;padding:20px">—</div>';
    }

    h += '</div>';
  }

  h += '</div>';
  return h;
}

/* ---------- Event delegation ---------- */
function _attachCalendarListeners() {
  const view = App.$('#view');
  if (!view || view.dataset.calListeners) return;
  view.dataset.calListeners = '1';

  view.addEventListener('click', async (e) => {
    // Навигация
    const actionBtn = e.target.closest('[data-cal-action]');
    if (actionBtn) {
      const action = actionBtn.dataset.calAction;
      if (action === 'prev') {
        if (App.state.calView === 'week') {
          App.state.calDate.setDate(App.state.calDate.getDate() - 7);
        } else {
          App.state.calDate.setMonth(App.state.calDate.getMonth() - 1);
        }
      } else if (action === 'next') {
        if (App.state.calView === 'week') {
          App.state.calDate.setDate(App.state.calDate.getDate() + 7);
        } else {
          App.state.calDate.setMonth(App.state.calDate.getMonth() + 1);
        }
      } else if (action === 'today') {
        App.state.calDate = new Date();
      } else if (action === 'export') {
        await exportCalendar();
      }
      App.state._forceRerender = true;
      App.renderCalendar();
      return;
    }

    // Переключение view
    const viewBtn = e.target.closest('[data-cal-view]');
    if (viewBtn) {
      App.state.calView = viewBtn.dataset.calView;
      App.state._forceRerender = true;
      App.renderCalendar();
      return;
    }

    // Клик по дню (месячный вид)
    const dayEl = e.target.closest('[data-cal-day]');
    if (dayEl) {
      const [yy, mm, dd] = dayEl.dataset.calDay.split('-').map(Number);
      showDayDetails(new Date(yy, mm, dd));
      return;
    }

    // Клик по заказу (недельный вид)
    const orderEl = e.target.closest('[data-cal-order]');
    if (orderEl) {
      const orderId = orderEl.dataset.calOrder;
      if (typeof App.showOrderDetails === 'function') {
        App.showOrderDetails(orderId);
      } else if (typeof App.navigateTo === 'function') {
        App.navigateTo('orders');
      }
      return;
    }
  });

  // Фильтры
  view.addEventListener('change', (e) => {
    const filter = e.target.dataset.calFilter;
    if (filter) {
      App.state.calFilters[filter] = e.target.checked;
      App.state._forceRerender = true;
      App.renderCalendar();
    }
  });
}

/* ---------- Детали дня ---------- */
async function showDayDetails(date) {
  const detEl = App.$('#calDet');
  if (!detEl) return;

  const key = toDayKey(date);
  const dd = date.getDate();
  const mm = date.getMonth();
  const yy = date.getFullYear();

  const [orders, shifts, users] = await Promise.all([
    App.repo('orders').all(),
    App.repo('shifts').all(),
    App.repo('users').all()
  ]);

  const usersMap = new Map(users.map(u => [u.id, u]));

  const dayOrders = orders
    .filter(o => {
      if (!o.deliveryDate || o.status === 'cancelled') return false;
      const od = new Date(App.parseLocalDate(o.deliveryDate));
      return isSameDay(od, date);
    })
    .sort((a, b) => parseTimeToMinutes(a.deliveryTime) - parseTimeToMinutes(b.deliveryTime));

  const dayShifts = shifts.filter(s => {
    if (!s.date) return false;
    const sd = new Date(App.parseLocalDate(s.date));
    return isSameDay(sd, date);
  });

  let dh = `
    <div class="cal-det">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h4 style="margin:0">📅 ${dd} ${App.MONTHS[mm]} ${yy}</h4>
        <div style="display:flex;gap:6px">
          <button class="btn" data-quick-action="order" style="padding:6px 12px;font-size:12px">+ Заказ</button>
          <button class="btn g" data-quick-action="shift" style="padding:6px 12px;font-size:12px">+ Смена</button>
        </div>
      </div>
  `;

  if (!dayOrders.length && !dayShifts.length) {
    dh += '<p class="hint" style="text-align:center;padding:20px">Нет событий на этот день</p>';
  } else {
    if (dayShifts.length) {
      dh += `<div style="margin-bottom:16px">
        <strong>⏰ Смены (${dayShifts.length})</strong>`;

      for (const s of dayShifts) {
        const u = usersMap.get(s.employeeId);
        const conflictBadge = s._conflict
          ? '<span class="badge bwa" style="margin-left:6px">⚠️ конфликт</span>'
          : '';

        dh += `
          <div class="cal-item">
            <span>
              ${u ? App.esc(u.name) : '—'}
              ${conflictBadge}
            </span>
            <span>
              <span class="badge ${s.status === 'open' ? 'bok' : 'bmu'}">
                ${s.status === 'open' ? 'Открыта' : 'Закрыта'}
              </span>
              ${s.startTime ? App.fmtTime(s.startTime) : ''}
              ${s.endTime ? ' — ' + App.fmtTime(s.endTime) : ''}
              ${s.hours ? ` (${s.hours.toFixed(1)}ч)` : ''}
            </span>
          </div>
        `;
      }
      dh += '</div>';
    }

    if (dayOrders.length) {
      dh += `<div><strong>📦 Доставки (${dayOrders.length})</strong>`;

      for (const o of dayOrders) {
        const statusLabel = o.status === 'completed'
          ? '<span class="badge bok">✓ Завершён</span>'
          : o.status === 'new'
          ? '<span class="badge binfo">Новый</span>'
          : '<span class="badge bwa">В работе</span>';

        const deliveryLabel = DELIVERY_ICONS[o.deliveryType] || '📦';

        dh += `
          <div class="cal-item" data-cal-order="${o.id}" style="cursor:pointer">
            <span>
              <strong>#${App.esc(String(o.id).slice(-6))}</strong> —
              ${App.esc(o.clientName || 'Без имени')}
              ${statusLabel}
            </span>
            <span>
              ⏰ ${o.deliveryTime || '—'} •
              ${App.fmtMoney(o.finalAmount)} •
              ${deliveryLabel}
            </span>
          </div>
        `;
      }
      dh += '</div>';
    }
  }

  dh += '</div>';
  detEl.innerHTML = dh;

  // Быстрые действия
  detEl.querySelectorAll('[data-quick-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.quickAction;
      const dateStr = App.toLocalDateString(date);

      if (action === 'order') {
        if (typeof App.editOrder === 'function') {
          App._orderDraft = { deliveryDate: dateStr };
          App.editOrder(null);
        } else {
          App.navigateTo('orders');
        }
      } else if (action === 'shift') {
        if (typeof App.editShift === 'function') {
          App.editShift(null, dateStr);
        } else {
          App.navigateTo('shifts');
        }
      }
    });
  });

  // Клик по заказу
  detEl.querySelectorAll('[data-cal-order]').forEach(el => {
    el.addEventListener('click', () => {
      const orderId = el.dataset.calOrder;
      if (typeof App.showOrderDetails === 'function') {
        App.showOrderDetails(orderId);
      } else {
        App.navigateTo('orders');
      }
    });
  });
}

/* ---------- Экспорт расписания ---------- */
async function exportCalendar() {
  try {
    const y = App.state.calDate.getFullYear();
    const m = App.state.calDate.getMonth();
    const monthName = App.MONTHS[m];

    const [orders, shifts, users] = await Promise.all([
      App.repo('orders').all(),
      App.repo('shifts').all(),
      App.repo('users').all()
    ]);

    const usersMap = new Map(users.map(u => [u.id, u]));

    const filteredOrders = orders.filter(o => {
      if (!o.deliveryDate || o.status === 'cancelled') return false;
      const od = new Date(App.parseLocalDate(o.deliveryDate));
      return od.getMonth() === m && od.getFullYear() === y;
    });

    const filteredShifts = shifts.filter(s => {
      if (!s.date) return false;
      const sd = new Date(App.parseLocalDate(s.date));
      return sd.getMonth() === m && sd.getFullYear() === y;
    });

    const report = {
      period: `${monthName} ${y}`,
      generatedAt: new Date().toISOString(),
      summary: {
        totalOrders: filteredOrders.length,
        completedOrders: filteredOrders.filter(o => o.status === 'completed').length,
        totalShifts: filteredShifts.length,
        totalRevenue: filteredOrders
          .filter(o => o.status === 'completed')
          .reduce((s, o) => s + (o.finalAmount || 0), 0)
      },
      orders: filteredOrders.map(o => ({
        id: String(o.id).slice(-6),
        date: o.deliveryDate,
        time: o.deliveryTime || '',
        client: o.clientName || '',
        status: o.status,
        amount: o.finalAmount || 0,
        deliveryType: o.deliveryType || ''
      })),
      shifts: filteredShifts.map(s => ({
        date: s.date,
        employee: usersMap.get(s.employeeId)?.name || '',
        status: s.status,
        startTime: s.startTime || '',
        endTime: s.endTime || '',
        hours: s.hours || 0
      }))
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calendar_${monthName}_${y}.json`;
    a.click();
    URL.revokeObjectURL(url);

    App.Toast.ok(`Экспортировано расписание за ${monthName}`);

    if (App.Audit) {
      await App.Audit.logExport('calendar', 1, { period: `${monthName} ${y}` });
    }
  } catch (e) {
    App.Toast.er('Ошибка экспорта: ' + e.message);
  }
}

console.log('✅ calendar.js загружен');