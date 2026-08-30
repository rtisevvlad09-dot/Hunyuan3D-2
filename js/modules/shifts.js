// ===== СМЕНЫ =====
// js/modules/shifts.js
// v2.0 — с фильтрами, живым таймером, экспортом, корректным расчётом ЗП

window.App = window.App || {};

/* ---------- Периоды для фильтра ---------- */
const SHIFT_PERIODS = [
  { id: 'today',   label: 'Сегодня',   days: 0 },
  { id: 'week',    label: 'Неделя',    days: 7 },
  { id: 'month',   label: 'Месяц',     days: 30 },
  { id: 'quarter', label: 'Квартал',   days: 90 },
  { id: 'all',     label: 'Всё время', days: -1 }
];

/* ---------- Утилиты ---------- */
function getDateRange(periodId) {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const period = SHIFT_PERIODS.find(p => p.id === periodId) || SHIFT_PERIODS[1];

  if (period.days === -1) return { from: 0, to: now.getTime() };

  if (period.days === 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return { from: today.getTime(), to: now.getTime() };
  }

  const from = new Date();
  from.setDate(from.getDate() - period.days);
  from.setHours(0, 0, 0, 0);
  return { from: from.getTime(), to: now.getTime() };
}

function formatDuration(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (hours > 0) return `${hours}ч ${minutes}м`;
  if (minutes > 0) return `${minutes}м ${seconds}с`;
  return `${seconds}с`;
}

/* ---------- Основной рендер ---------- */
App.renderShifts = async function() {
  if (!App.Auth.can('owner', 'admin', 'employee')) {
    App.$('#view').innerHTML = '<div class="card" style="text-align:center;padding:40px">Нет доступа</div>';
    return;
  }

  App.setLoading?.(true);

  try {
    // Инициализация состояния
    if (!App.state.shiftsPeriod) App.state.shiftsPeriod = 'month';
    if (!App.state.shiftsStatus) App.state.shiftsStatus = 'all';
    if (!App.state.shiftsUser) App.state.shiftsUser = 'all';

    const [shifts, users, orders, returns] = await Promise.all([
      App.repo('shifts').all(),
      App.repo('users').all(),
      App.repo('orders').all(),
      App.repo('returns').all()
    ]);

    const usersMap = new Map(users.map(u => [u.id, u]));
    const range = getDateRange(App.state.shiftsPeriod);

    // Фильтрация по правам
    let filtered = shifts;
    if (!App.Auth.isAdmin()) {
      filtered = filtered.filter(s => s.employeeId === App.Auth.user.id);
    }

    // Фильтр по сотруднику (для админа)
    if (App.Auth.isAdmin() && App.state.shiftsUser !== 'all') {
      filtered = filtered.filter(s => s.employeeId === App.state.shiftsUser);
    }

    // Фильтр по статусу
    if (App.state.shiftsStatus !== 'all') {
      filtered = filtered.filter(s => s.status === App.state.shiftsStatus);
    }

    // Фильтр по периоду (через ts)
    filtered = filtered.filter(s => {
      const ts = s.ts || (s.startTime ? new Date(s.startTime).getTime() : 0);
      return ts >= range.from && ts <= range.to;
    });

    // Сортировка
    filtered.sort((a, b) => (b.ts || 0) - (a.ts || 0));

    const { items: rows, page: p, pages } = App.paginate(filtered, 'shifts');

    // Моя открытая смена
    const myOpenShift = shifts.find(s =>
      s.employeeId === App.Auth.user.id && s.status === 'open'
    );

    // Сводка
    const closedShifts = filtered.filter(s => s.status === 'closed');
    const totalHours = closedShifts.reduce((sum, s) => sum + (s.hours || 0), 0);
    const totalShiftsCount = closedShifts.length;
    const avgHours = totalShiftsCount > 0 ? totalHours / totalShiftsCount : 0;
    const openCount = filtered.filter(s => s.status === 'open').length;

    let h = `
      <div class="g">
        <div class="card stat">
          <div class="big">${totalShiftsCount}</div>
          <div class="sm">Закрытых смен</div>
        </div>
        <div class="card stat">
          <div class="big">${totalHours.toFixed(1)} ч</div>
          <div class="sm">Всего часов</div>
        </div>
        <div class="card stat">
          <div class="big">${avgHours.toFixed(1)} ч</div>
          <div class="sm">Средняя смена</div>
        </div>
        <div class="card stat" ${openCount > 0 ? 'style="background:linear-gradient(135deg,#fef3c7,#fde68a)"' : ''}>
          <div class="big">${openCount}</div>
          <div class="sm">Открыто сейчас</div>
        </div>
      </div>

      <div class="tools">
        ${myOpenShift
          ? `<button class="btn d" data-action="closeShift">⏹ Закрыть смену <span id="myShiftTimer" style="font-size:12px"></span></button>`
          : `<button class="btn s" data-action="openShift">▶ Открыть смену</button>`
        }
        <button class="btn" data-action="salary">💰 Зарплата</button>

        ${App.Auth.isAdmin() ? `
          <select class="inp" data-filter="user" style="width:auto;min-width:150px">
            <option value="all">Все сотрудники</option>
            ${users.map(u =>
              `<option value="${u.id}" ${App.state.shiftsUser === u.id ? 'selected' : ''}>${App.esc(u.name)}</option>`
            ).join('')}
          </select>
        ` : ''}

        <select class="inp" data-filter="status" style="width:auto;min-width:130px">
          <option value="all" ${App.state.shiftsStatus === 'all' ? 'selected' : ''}>Все статусы</option>
          <option value="open" ${App.state.shiftsStatus === 'open' ? 'selected' : ''}>🟢 Открытые</option>
          <option value="closed" ${App.state.shiftsStatus === 'closed' ? 'selected' : ''}>🔴 Закрытые</option>
        </select>

        <select class="inp" data-filter="period" style="width:auto;min-width:130px">
          ${SHIFT_PERIODS.map(p =>
            `<option value="${p.id}" ${App.state.shiftsPeriod === p.id ? 'selected' : ''}>${p.label}</option>`
          ).join('')}
        </select>

        <button class="btn g" data-action="export">📤 CSV</button>
      </div>

      <div class="twrap"><table><thead><tr>
        <th>Сотрудник</th><th>Дата</th><th>Начало</th><th>Конец</th>
        <th>Часов</th><th>Статус</th><th></th>
      </tr></thead><tbody>
    `;

    if (!rows.length) {
      h += `
        <tr>
          <td colspan="7" style="text-align:center;padding:40px">
            <div style="font-size:48px;margin-bottom:10px">⏰</div>
            <div style="color:var(--t3)">Смены не найдены</div>
            <div class="hint" style="margin-top:8px">
              ${App.state.shiftsPeriod !== 'month' || App.state.shiftsStatus !== 'all'
                ? 'Попробуйте изменить фильтры'
                : 'Откройте первую смену, нажав кнопку выше'}
            </div>
          </td>
        </tr>
      `;
    }

    for (const sh of rows) {
      const u = usersMap.get(sh.employeeId);
      const isOpen = sh.status === 'open';
      const canClose = App.Auth.isAdmin() || sh.employeeId === App.Auth.user.id;

      h += `
        <tr>
          <td>
            <strong>${u ? u.emoji || '👤' : '👤'} ${App.esc(u?.name || '—')}</strong>
          </td>
          <td>${sh.date ? App.fmtDate(App.parseLocalDate(sh.date) || sh.ts) : App.fmtDate(sh.ts)}</td>
          <td>${sh.startTime ? App.fmtTime(sh.startTime) : '—'}</td>
          <td>${sh.endTime ? App.fmtTime(sh.endTime) : '—'}</td>
          <td>
            ${sh.hours ? sh.hours.toFixed(1) + ' ч' : '—'}
            ${isOpen ? `<div class="hint" data-live-timer="${sh.id}" data-start="${sh.startTime}">идёт...</div>` : ''}
          </td>
          <td>
            <span class="badge ${isOpen ? 'bok' : 'bmu'}">
              ${isOpen ? '🟢 Открыта' : '🔴 Закрыта'}
            </span>
          </td>
          <td style="white-space:nowrap">
            <button class="ab" style="background:#e0e7ff;color:#3730a3" data-action="view" data-id="${sh.id}">👁️</button>
            ${isOpen && canClose
              ? `<button class="ab" style="background:#fee2e2;color:#991b1b" data-action="close" data-id="${sh.id}">⏹</button>`
              : ''}
          </td>
        </tr>
      `;
    }

    h += `</tbody></table></div>` + App.pagHTML(p, pages);

    App.$('#view').innerHTML = h;
    App.setLoading?.(false);

    _attachShiftsListeners();

    // Запускаем живые таймеры для открытых смен
    _startLiveTimers();

  } catch (e) {
    console.error('renderShifts error:', e);
    App.$('#view').innerHTML = `<div class="card" style="text-align:center;padding:40px;color:var(--bad)">
      Ошибка: ${App.esc(e.message)}
    </div>`;
    App.setLoading?.(false);
  }
};

/* ---------- Живые таймеры ---------- */
let _timersInterval = null;

function _startLiveTimers() {
  if (_timersInterval) clearInterval(_timersInterval);

  _timersInterval = setInterval(() => {
    const timers = document.querySelectorAll('[data-live-timer]');
    if (timers.length === 0) {
      clearInterval(_timersInterval);
      _timersInterval = null;
      return;
    }

    timers.forEach(el => {
      const start = new Date(el.dataset.start).getTime();
      const elapsed = Date.now() - start;
      el.textContent = 'идёт: ' + formatDuration(elapsed);
    });

    // Таймер в кнопке закрытия
    const myTimer = document.getElementById('myShiftTimer');
    if (myTimer && App._myOpenShiftStart) {
      const elapsed = Date.now() - App._myOpenShiftStart;
      myTimer.textContent = '(' + formatDuration(elapsed) + ')';
    }
  }, 1000);
}

/* ---------- Event delegation ---------- */
function _attachShiftsListeners() {
  const view = App.$('#view');
  if (!view || view.dataset.shiftsListeners) return;
  view.dataset.shiftsListeners = '1';

  view.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) {
      // Пагинация
      const pgBtn = e.target.closest('[data-pg]');
      if (pgBtn) {
        App.setPage('shifts', parseInt(pgBtn.dataset.pg));
        App.state._forceRerender = true;
        App.renderShifts();
      }
      return;
    }

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    switch (action) {
      case 'openShift':  await App.openShift(); break;
      case 'closeShift': await App.closeShift(null); break;
      case 'close':      await App.closeShift(id); break;
      case 'view':       await App.showShiftDetails(id); break;
      case 'salary':     await App.salaryModal(); break;
      case 'export':     await App.exportShiftsCSV(); break;
    }
  });

  view.addEventListener('change', (e) => {
    if (e.target.matches('[data-filter="user"]')) {
      App.state.shiftsUser = e.target.value;
      App.setPage('shifts', 1);
      App.state._forceRerender = true;
      App.renderShifts();
    } else if (e.target.matches('[data-filter="status"]')) {
      App.state.shiftsStatus = e.target.value;
      App.setPage('shifts', 1);
      App.state._forceRerender = true;
      App.renderShifts();
    } else if (e.target.matches('[data-filter="period"]')) {
      App.state.shiftsPeriod = e.target.value;
      App.setPage('shifts', 1);
      App.state._forceRerender = true;
      App.renderShifts();
    }
  });
}

/* ---------- Открытие смены ---------- */
App.openShift = async function() {
  try {
    // Проверка на уже открытую смену
    const allShifts = await App.repo('shifts').all();
    const exists = allShifts.find(s =>
      s.employeeId === App.Auth.user.id && s.status === 'open'
    );

    if (exists) {
      const startMs = new Date(exists.startTime).getTime();
      const elapsed = Date.now() - startMs;
      const confirmed = await App.Modal.confirm(
        `У вас уже открыта смена (идёт ${formatDuration(elapsed)}). Закрыть её и открыть новую?`,
        'Открытая смена'
      );
      if (confirmed) {
        await App.closeShift(exists.id);
      } else {
        return;
      }
    }

    const now = new Date();
    const newShift = {
      id: App.uid(),
      employeeId: App.Auth.user.id,
      date: App.toLocalDateString(now),
      startTime: now.toISOString(),
      status: 'open',
      hours: 0,
      ts: Date.now(),
      createdAt: Date.now()
    };

    await App.repo('shifts').save(newShift);

    // Сохраняем время для живого таймера в кнопке
    App._myOpenShiftStart = now.getTime();

    if (App.Audit) {
      await App.Audit.log(App.AUDIT_ACTIONS.SHIFT_OPENED, {
        shiftId: newShift.id,
        userId: App.Auth.user.id
      }, 'shifts', newShift.id);
    }

    App.Toast.ok('Смена открыта');
    App.state._forceRerender = true;
    App.renderShifts();
    App.renderDashboard?.();
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- Закрытие смены ---------- */
App.closeShift = async function(id) {
  try {
    let s;
    if (id) {
      // Админ может закрывать чужие смены
      if (!App.Auth.isAdmin()) {
        App.Toast.er('Нет прав на закрытие чужой смены');
        return;
      }
      s = await App.repo('shifts').byId(id);
    } else {
      // Закрытие своей смены
      const allShifts = await App.repo('shifts').all();
      s = allShifts.find(x =>
        x.employeeId === App.Auth.user.id && x.status === 'open'
      );
    }

    if (!s) {
      App.Toast.wn('Открытая смена не найдена');
      return;
    }

    if (s.status === 'closed') {
      App.Toast.wn('Смена уже закрыта');
      return;
    }

    // Подтверждение для чужой смены
    if (s.employeeId !== App.Auth.user.id) {
      const users = await App.repo('users').all();
      const user = users.find(u => u.id === s.employeeId);
      const confirmed = await App.Modal.confirm(
        `Закрыть смену сотрудника "${user?.name || '?'}"?`
      );
      if (!confirmed) return;
    }

    const end = new Date();
    const start = new Date(s.startTime);
    const hours = +((end - start) / 3600000).toFixed(2);

    await App.repo('shifts').update(s.id, {
      endTime: end.toISOString(),
      status: 'closed',
      hours,
      closedAt: Date.now()
    });

    // Очищаем таймер своей смены
    if (s.employeeId === App.Auth.user.id) {
      App._myOpenShiftStart = null;
    }

    if (App.Audit) {
      await App.Audit.log(App.AUDIT_ACTIONS.SHIFT_CLOSED, {
        shiftId: s.id,
        userId: s.employeeId,
        hours
      }, 'shifts', s.id);
    }

    App.Toast.ok(`Смена закрыта. ${hours.toFixed(1)} ч`);
    App.state._forceRerender = true;
    App.renderShifts();
    App.renderDashboard?.();
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- Детальный просмотр смены ---------- */
App.showShiftDetails = async function(id) {
  try {
    const s = await App.repo('shifts').byId(id);
    if (!s) {
      App.Toast.er('Смена не найдена');
      return;
    }

    const [users, orders] = await Promise.all([
      App.repo('users').all(),
      App.repo('orders').all()
    ]);

    const user = users.find(u => u.id === s.employeeId);
    const isOpen = s.status === 'open';

    // Заказы за время смены
    const shiftOrders = orders.filter(o => {
      if (o.createdById !== s.employeeId) return false;
      if (!o.ts) return false;
      if (o.ts < new Date(s.startTime).getTime()) return false;
      if (s.endTime && o.ts > new Date(s.endTime).getTime()) return false;
      return true;
    });

    const shiftRevenue = shiftOrders
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + (o.finalAmount || 0), 0);

    const elapsed = isOpen
      ? Date.now() - new Date(s.startTime).getTime()
      : new Date(s.endTime).getTime() - new Date(s.startTime).getTime();

    const h = `
      <div style="padding:10px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px">
          <div>
            <div style="font-size:20px;font-weight:800">
              ${user?.emoji || '👤'} ${App.esc(user?.name || 'Сотрудник')}
            </div>
            <div class="hint">Смена от ${App.fmtDate(s.ts)}</div>
          </div>
          <span class="badge ${isOpen ? 'bok' : 'bmu'}" style="font-size:14px;padding:6px 14px">
            ${isOpen ? '🟢 Открыта' : '🔴 Закрыта'}
          </span>
        </div>

        <div class="g" style="margin-bottom:16px">
          <div class="card" style="padding:12px;margin:0;text-align:center">
            <div class="big" style="font-size:18px">${formatDuration(elapsed)}</div>
            <div class="sm">${isOpen ? 'Идёт' : 'Длительность'}</div>
          </div>
          <div class="card" style="padding:12px;margin:0;text-align:center">
            <div class="big" style="font-size:18px">${shiftOrders.length}</div>
            <div class="sm">Заказов</div>
          </div>
          <div class="card" style="padding:12px;margin:0;text-align:center">
            <div class="big" style="font-size:18px">${App.fmtMoney(shiftRevenue)}</div>
            <div class="sm">Выручка</div>
          </div>
        </div>

        <div class="card" style="padding:12px;margin-bottom:16px">
          <div class="lbl">Время работы</div>
          <div>
            <strong>Начало:</strong> ${App.fmtDateTime(s.startTime)}<br>
            ${s.endTime ? `<strong>Конец:</strong> ${App.fmtDateTime(s.endTime)}<br>` : ''}
            <strong>Часов:</strong> ${s.hours ? s.hours.toFixed(2) + ' ч' : 'в процессе'}
          </div>
        </div>

        ${user ? `
          <div class="card" style="padding:12px;margin-bottom:16px">
            <div class="lbl">Расчёт оплаты</div>
            <div>
              ${user.hourlyRate
                ? `Почасовая: ${user.hourlyRate} ₽/ч × ${(s.hours || 0).toFixed(2)} = <strong>${App.fmtMoney(Math.round((s.hours || 0) * user.hourlyRate))}</strong>`
                : `За смену: <strong>${App.fmtMoney(user.shiftCost || 0)}</strong>`}
              <br>
              <span class="hint">Комиссия: ${user.commissionRate || 0}% с выручки свыше ${App.fmtMoney(user.commissionThreshold || 0)}</span>
            </div>
          </div>
        ` : ''}

        ${shiftOrders.length > 0 ? `
          <div class="card" style="padding:12px">
            <div class="lbl">Заказы за смену</div>
            <div class="twrap" style="margin-top:8px">
              <table>
                <thead><tr><th>№</th><th>Клиент</th><th>Сумма</th><th>Статус</th></tr></thead>
                <tbody>
                  ${shiftOrders.slice(0, 10).map(o => `
                    <tr data-order-id="${o.id}" style="cursor:pointer">
                      <td>#${String(o.id).slice(-6)}</td>
                      <td>${App.esc(o.clientName || '—')}</td>
                      <td>${App.fmtMoney(o.finalAmount)}</td>
                      <td><span class="badge ${o.status === 'completed' ? 'bok' : 'bwa'}">${o.status}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        <div style="display:flex;gap:8px;margin-top:20px">
          ${isOpen && (App.Auth.isAdmin() || s.employeeId === App.Auth.user.id)
            ? `<button class="btn d" data-action="closeFromDetails" data-id="${s.id}">⏹ Закрыть смену</button>`
            : ''}
          <button class="btn g" id="closeShiftDetails">Закрыть</button>
        </div>
      </div>
    `;

    App.Modal.open('⏰ Детали смены', h);

    setTimeout(() => {
      const closeBtn = document.getElementById('closeShiftDetails');
      if (closeBtn) closeBtn.onclick = () => App.Modal.close();

      const closeAction = App.Modal.body().querySelector('[data-action="closeFromDetails"]');
      if (closeAction) {
        closeAction.onclick = async () => {
          App.Modal.close();
          await App.closeShift(closeAction.dataset.id);
        };
      }

      App.Modal.body().querySelectorAll('[data-order-id]').forEach(row => {
        row.onclick = () => {
          App.Modal.close();
          App.showOrderDetails?.(row.dataset.orderId) || App.navigateTo('orders');
        };
      });
    }, 50);

  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- Расчёт зарплаты ---------- */
App.salaryModal = async function() {
  try {
    const [users, shifts, orders, returns] = await Promise.all([
      App.repo('users').all(),
      App.repo('shifts').all(),
      App.repo('orders').all(),
      App.repo('returns').all()
    ]);

    // Для сотрудника показываем только его данные
    const visibleUsers = App.Auth.isAdmin()
      ? users
      : users.filter(u => u.id === App.Auth.user.id);

    App.Modal.open('💰 Расчёт зарплаты', `
      <div style="padding:10px">
        <form id="salForm">
          <div class="row">
            <div>
              <label class="lbl">Период</label>
              <select class="inp" name="period">
                <option value="week">Неделя</option>
                <option value="month" selected>Месяц</option>
                <option value="quarter">Квартал</option>
                <option value="year">Год</option>
              </select>
            </div>
            <div style="display:flex;align-items:flex-end;gap:6px">
              <button type="submit" class="btn" style="flex:1">📊 Рассчитать</button>
              <button type="button" class="btn g" id="exportSalaryBtn" style="padding:8px 14px" title="Экспорт">📤</button>
            </div>
          </div>
        </form>
        <div id="salRes" style="margin-top:16px"></div>
      </div>
    `);

    let lastCalculation = null;

    const form = document.getElementById('salForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        lastCalculation = _calculateSalary(visibleUsers, shifts, orders, returns, e.target.period.value);
        document.getElementById('salRes').innerHTML = lastCalculation.html;
      });
    }

    const exportBtn = document.getElementById('exportSalaryBtn');
    if (exportBtn) {
      exportBtn.onclick = () => {
        if (lastCalculation) {
          _exportSalaryCSV(lastCalculation.rows, form.period.value);
        } else {
          App.Toast.wn('Сначала рассчитайте зарплату');
        }
      };
    }

    // Автоматический расчёт при открытии
    form.dispatchEvent(new Event('submit'));

  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

function _calculateSalary(visibleUsers, shifts, orders, returns, periodId) {
  const now = new Date();
  let from = new Date();

  if (periodId === 'week') from.setDate(now.getDate() - 7);
  else if (periodId === 'month') from.setMonth(now.getMonth() - 1);
  else if (periodId === 'quarter') from.setMonth(now.getMonth() - 3);
  else if (periodId === 'year') from.setFullYear(now.getFullYear() - 1);
  from.setHours(0, 0, 0, 0);
  const fromTs = from.getTime();

  const periodLabel = SHIFT_PERIODS.find(p => p.id === periodId)?.label || periodId;

  // Группируем возвраты по orderId для корректировки выручки
  const returnsByOrder = new Map();
  for (const r of returns) {
    if (r.ts < fromTs) continue;
    if (!returnsByOrder.has(r.orderId)) returnsByOrder.set(r.orderId, 0);
    returnsByOrder.set(r.orderId, returnsByOrder.get(r.orderId) + (r.amount || 0));
  }

  const rows = [];
  let totalSalary = 0;
  let totalHoursAll = 0;
  let totalOrdersAll = 0;

  for (const u of visibleUsers) {
    const userShifts = shifts.filter(s =>
      s.employeeId === u.id &&
      s.status === 'closed' &&
      (s.ts || 0) >= fromTs
    );

    const shCount = userShifts.length;
    const hours = userShifts.reduce((sum, s) => sum + (s.hours || 0), 0);

    // Оплата смен: либо почасовая, либо фикс за смену
    let shPay = 0;
    if (u.hourlyRate > 0) {
      shPay = Math.round(hours * u.hourlyRate);
    } else {
      shPay = shCount * (u.shiftCost || 0);
    }

    // Заказы сотрудника
    const userOrders = orders.filter(o =>
      o.createdById === u.id &&
      o.status === 'completed' &&
      (o.ts || 0) >= fromTs
    );

    // Выручка с учётом возвратов
    let rev = 0;
    for (const o of userOrders) {
      const orderAmount = o.finalAmount || 0;
      const returned = returnsByOrder.get(o.id) || 0;
      rev += Math.max(0, orderAmount - returned);
    }

    // Комиссия с превышения порога
    const threshold = u.commissionThreshold || 0;
    const commRate = u.commissionRate || 0;
    const comm = rev > threshold
      ? Math.round((rev - threshold) * commRate / 100)
      : 0;

    const total = shPay + comm;

    rows.push({
      name: u.name,
      emoji: u.emoji || '👤',
      shiftsCount: shCount,
      hours,
      shPay,
      ordersCount: userOrders.length,
      revenue: rev,
      commission: comm,
      total
    });

    totalSalary += total;
    totalHoursAll += hours;
    totalOrdersAll += userOrders.length;
  }

  // HTML результат
  let html = `
    <div class="g" style="margin-bottom:16px">
      <div class="card stat" style="padding:12px">
        <div class="big" style="font-size:18px;color:var(--p)">${App.fmtMoney(totalSalary)}</div>
        <div class="sm">Итого к выплате</div>
      </div>
      <div class="card stat" style="padding:12px">
        <div class="big" style="font-size:18px">${totalHoursAll.toFixed(1)} ч</div>
        <div class="sm">Всего часов</div>
      </div>
      <div class="card stat" style="padding:12px">
        <div class="big" style="font-size:18px">${totalOrdersAll}</div>
        <div class="sm">Всего заказов</div>
      </div>
    </div>

    <div class="hint" style="margin-bottom:12px">
      Период: <strong>${periodLabel}</strong> (с ${App.fmtDate(fromTs)})
    </div>

    <div class="twrap">
      <table>
        <thead>
          <tr>
            <th>Сотрудник</th><th>Смен</th><th>Часов</th><th>Оплата смен</th>
            <th>Заказов</th><th>Выручка</th><th>Комиссия</th><th>ИТОГО</th>
          </tr>
        </thead>
        <tbody>
  `;

  if (!rows.length) {
    html += '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--t3)">Нет данных</td></tr>';
  } else {
    for (const r of rows) {
      html += `
        <tr>
          <td><strong>${r.emoji} ${App.esc(r.name)}</strong></td>
          <td>${r.shiftsCount}</td>
          <td>${r.hours.toFixed(1)}</td>
          <td>${App.fmtMoney(r.shPay)}</td>
          <td>${r.ordersCount}</td>
          <td>${App.fmtMoney(r.revenue)}</td>
          <td style="color:var(--good)">${r.commission > 0 ? '+' + App.fmtMoney(r.commission) : '—'}</td>
          <td style="color:var(--p);font-weight:800">${App.fmtMoney(r.total)}</td>
        </tr>
      `;
    }
  }

  html += '</tbody></table></div>';

  return { html, rows, periodLabel, fromTs };
}

/* ---------- Экспорт зарплаты в CSV ---------- */
function _exportSalaryCSV(rows, periodId) {
  try {
    if (!rows || !rows.length) {
      App.Toast.wn('Нет данных для экспорта');
      return;
    }

    const periodLabel = SHIFT_PERIODS.find(p => p.id === periodId)?.label || periodId;

    const headers = [
      'Сотрудник', 'Смен', 'Часов', 'Оплата смен',
      'Заказов', 'Выручка', 'Комиссия', 'Итого'
    ];

    const csvRows = rows.map(r => [
      r.name,
      r.shiftsCount,
      r.hours.toFixed(2),
      r.shPay,
      r.ordersCount,
      r.revenue,
      r.commission,
      r.total
    ]);

    const csv = [headers, ...csvRows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salary_${periodLabel}_${App.toLocalDateString(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    App.Toast.ok('Зарплата экспортирована');

    if (App.Audit) {
      App.Audit.logExport('salary', rows.length, { period: periodLabel });
    }
  } catch (e) {
    App.Toast.er('Ошибка экспорта: ' + e.message);
  }
}

/* ---------- Экспорт смен в CSV ---------- */
App.exportShiftsCSV = async function() {
  try {
    const [shifts, users] = await Promise.all([
      App.repo('shifts').all(),
      App.repo('users').all()
    ]);

    const usersMap = new Map(users.map(u => [u.id, u]));
    const range = getDateRange(App.state.shiftsPeriod);

    let filtered = shifts.filter(s => {
      const ts = s.ts || (s.startTime ? new Date(s.startTime).getTime() : 0);
      return ts >= range.from && ts <= range.to;
    });

    if (!App.Auth.isAdmin()) {
      filtered = filtered.filter(s => s.employeeId === App.Auth.user.id);
    }

    if (!filtered.length) {
      App.Toast.wn('Нет данных для экспорта');
      return;
    }

    const headers = [
      'Сотрудник', 'Дата', 'Начало', 'Конец', 'Часов', 'Статус'
    ];

    const rows = filtered
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .map(s => {
        const u = usersMap.get(s.employeeId);
        return [
          u?.name || '',
          s.date ? App.fmtDate(App.parseLocalDate(s.date) || s.ts) : App.fmtDate(s.ts),
          s.startTime ? App.fmtTime(s.startTime) : '',
          s.endTime ? App.fmtTime(s.endTime) : '',
          (s.hours || 0).toFixed(2),
          s.status === 'open' ? 'Открыта' : 'Закрыта'
        ];
      });

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const periodLabel = SHIFT_PERIODS.find(p => p.id === App.state.shiftsPeriod)?.label || '';
    a.download = `shifts_${periodLabel}_${App.toLocalDateString(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    App.Toast.ok(`Экспортировано ${filtered.length} смен`);

    if (App.Audit) {
      await App.Audit.logExport('shifts', filtered.length, { period: periodLabel });
    }
  } catch (e) {
    App.Toast.er('Ошибка экспорта: ' + e.message);
  }
};

console.log('✅ shifts.js загружен');