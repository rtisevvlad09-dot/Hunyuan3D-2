// ===== ЗАКАЗЫ =====
// js/modules/orders.js
// v2.0 — с транзакциями, фильтрами, просмотром, правильным clientId

window.App = window.App || {};

/* ---------- Статусы заказов ---------- */
const ORDER_STATUSES = [
  { id: 'new',         label: 'Новый',        badge: 'binfo',  icon: '🆕' },
  { id: 'assembling',  label: 'В сборке',     badge: 'bwa',    icon: '🔨' },
  { id: 'ready',       label: 'Готов',        badge: 'bpur',   icon: '✅' },
  { id: 'delivering',  label: 'В доставке',   badge: 'bpur',   icon: '🚚' },
  { id: 'completed',   label: 'Выполнен',     badge: 'bok',    icon: '🎉' },
  { id: 'cancelled',   label: 'Отменён',      badge: 'bda',    icon: '❌' }
];

/* ---------- Утилиты ---------- */
function getStatusInfo(status) {
  return ORDER_STATUSES.find(s => s.id === status) || ORDER_STATUSES[0];
}

/* ---------- Транзакция изменения остатков ---------- */
// Атомарно применяет изменения остатков. Если что-то падает — откатывает.
async function _applyStockChanges(changes, reason, orderId) {
  // changes: [{ flowerId, delta, type, itemName }]
  // Возвращает { ok, error }

  const applied = []; // Что уже применили (для отката)

  try {
    for (const change of changes) {
      const fl = await App.repo('flowers').byId(change.flowerId);
      if (!fl) {
        throw new Error(`Товар ${change.flowerId} не найден`);
      }

      const newStock = (fl.stock || 0) + change.delta;
      if (newStock < 0) {
        throw new Error(`Недостаточно «${fl.name}» (нужно ${Math.abs(change.delta)}, есть ${fl.stock})`);
      }

      const oldStock = fl.stock;
      await App.repo('flowers').update(fl.id, {
        stock: newStock,
        sales: Math.max(0, (fl.sales || 0) + (change.delta < 0 ? -change.delta : 0)),
        updatedAt: Date.now()
      });

      await App.recordStockMovement(fl.id, change.delta, `${reason}: ${orderId || ''}`);

      applied.push({ flowerId: fl.id, oldStock, newStock });
    }

    return { ok: true };
  } catch (e) {
    // Откат
    console.warn('⚠️ Stock transaction failed, rolling back...', e);
    for (const a of applied.reverse()) {
      try {
        await App.repo('flowers').update(a.flowerId, { stock: a.oldStock });
      } catch (rollbackErr) {
        console.error('❌ CRITICAL: Rollback failed!', rollbackErr);
      }
    }
    return { ok: false, error: e.message };
  }
}

/* ---------- Расчёт изменений остатков для заказа ---------- */
function _computeOrderStockChanges(items, multiplier = -1) {
  // multiplier = -1 для списания, +1 для возврата
  const changes = [];
  const seen = new Map(); // flowerId -> delta

  for (const it of (items || [])) {
    if (it.type === 'flower') {
      const delta = multiplier * (it.quantity || 0);
      seen.set(it.flowerId, (seen.get(it.flowerId) || 0) + delta);
    } else if (it.type === 'bouquet') {
      for (const c of (it.components || [])) {
        const delta = multiplier * (c.quantity || 0) * (it.quantity || 1);
        seen.set(c.flowerId, (seen.get(c.flowerId) || 0) + delta);
      }
    }
  }

  for (const [flowerId, delta] of seen) {
    if (delta !== 0) {
      changes.push({ flowerId, delta });
    }
  }

  return changes;
}

/* ---------- Основной рендер ---------- */
App.renderOrders = async function() {
  if (!App.Auth.can('employee', 'admin', 'owner')) {
    App.$('#view').innerHTML = '<div class="card" style="text-align:center;padding:40px">Нет доступа</div>';
    return;
  }

  App.setLoading?.(true);

  try {
    // Инициализация состояния
    if (!App.state.ordersStatus) App.state.ordersStatus = 'all';
    if (!App.state.ordersDelivery) App.state.ordersDelivery = 'all';
    if (!App.state.ordersSort) App.state.ordersSort = 'date';

    let all = await App.repo('orders').all();

    // Фильтр по правам
    if (!App.Auth.isAdmin()) {
      all = all.filter(o => o.createdById === App.Auth.user.id);
    }

    // Фильтр по статусу
    if (App.state.ordersStatus !== 'all') {
      all = all.filter(o => o.status === App.state.ordersStatus);
    }

    // Фильтр по доставке
    if (App.state.ordersDelivery !== 'all') {
      all = all.filter(o => o.deliveryType === App.state.ordersDelivery);
    }

    // Поиск
    const search = (App.getSearch('orders') || '').toLowerCase();
    if (search) {
      all = all.filter(o =>
        (o.clientName || '').toLowerCase().includes(search) ||
        (o.clientPhone || '').includes(search) ||
        String(o.id).toLowerCase().includes(search) ||
        (o.comment || '').toLowerCase().includes(search)
      );
    }

    // Сортировка
    if (App.state.ordersSort === 'amount') {
      all.sort((a, b) => (b.finalAmount || 0) - (a.finalAmount || 0));
    } else if (App.state.ordersSort === 'delivery') {
      all.sort((a, b) => {
        const da = a.deliveryDate ? new Date(a.deliveryDate).getTime() : 0;
        const db = b.deliveryDate ? new Date(b.deliveryDate).getTime() : 0;
        return da - db;
      });
    } else {
      all.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    }

    const { items: rows, page: p, pages } = App.paginate(all, 'orders');

    // Сводка
    const allForStats = await App.repo('orders').all();
    const activeOrders = allForStats.filter(o =>
      !['completed', 'cancelled'].includes(o.status)
    );
    const todayOrders = allForStats.filter(o => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return (o.ts || 0) >= today.getTime();
    });
    const todayRevenue = todayOrders
      .filter(o => o.status === 'completed')
      .reduce((s, o) => s + (o.finalAmount || 0), 0);

    let h = `
      <div class="g">
        <div class="card stat">
          <div class="big">📦 ${activeOrders.length}</div>
          <div class="sm">Активных заказов</div>
        </div>
        <div class="card stat">
          <div class="big">🧾 ${todayOrders.length}</div>
          <div class="sm">Заказов сегодня</div>
        </div>
        <div class="card stat">
          <div class="big">💰 ${App.fmtMoney(todayRevenue)}</div>
          <div class="sm">Выручка сегодня</div>
        </div>
        <div class="card stat">
          <div class="big">📊 ${allForStats.length}</div>
          <div class="sm">Всего заказов</div>
        </div>
      </div>

      <div class="tools">
        <input class="inp search" placeholder="Поиск по клиенту, телефону, №, комментарию..."
               value="${App.esc(App.getSearch('orders'))}" data-search="orders">
        <select class="inp" data-filter="status" style="width:auto;min-width:140px">
          <option value="all">Все статусы</option>
          ${ORDER_STATUSES.map(s =>
            `<option value="${s.id}" ${App.state.ordersStatus === s.id ? 'selected' : ''}>${s.icon} ${s.label}</option>`
          ).join('')}
        </select>
        <select class="inp" data-filter="delivery" style="width:auto;min-width:140px">
          <option value="all">Любая доставка</option>
          <option value="none" ${App.state.ordersDelivery === 'none' ? 'selected' : ''}>🏪 Самовывоз</option>
          <option value="courier" ${App.state.ordersDelivery === 'courier' ? 'selected' : ''}>🚚 Курьер</option>
          <option value="employee" ${App.state.ordersDelivery === 'employee' ? 'selected' : ''}>👤 Сотрудник</option>
        </select>
        <select class="inp" data-sort="orders" style="width:auto;min-width:130px">
          <option value="date" ${App.state.ordersSort === 'date' ? 'selected' : ''}>По дате</option>
          <option value="amount" ${App.state.ordersSort === 'amount' ? 'selected' : ''}>По сумме</option>
          <option value="delivery" ${App.state.ordersSort === 'delivery' ? 'selected' : ''}>По доставке</option>
        </select>
        <button class="btn" data-action="new">+ 🧾 Новый заказ</button>
        <button class="btn g" data-action="export">📤 CSV</button>
      </div>

      <div class="twrap"><table><thead><tr>
        <th>№</th><th>Клиент</th><th>Состав</th><th>Сумма</th><th>Доставка</th>
        <th>Статус</th><th style="min-width:200px"></th>
      </tr></thead><tbody>
    `;

    if (!rows.length) {
      h += `
        <tr>
          <td colspan="7" style="text-align:center;padding:40px">
            <div style="font-size:48px;margin-bottom:10px">📦</div>
            <div style="color:var(--t3)">Заказов не найдено</div>
            <div class="hint" style="margin-top:8px">
              ${search || App.state.ordersStatus !== 'all'
                ? 'Попробуйте изменить фильтры'
                : 'Создайте первый заказ, нажав кнопку выше'}
            </div>
          </td>
        </tr>
      `;
    }

    for (const o of rows) {
      const statusInfo = getStatusInfo(o.status);
      const canManage = App.Auth.canManageOrder(o);
      const canEdit = canManage && !['completed', 'cancelled'].includes(o.status);

      // Состав заказа (кратко)
      const itemsCount = (o.items || []).reduce((s, it) => s + (it.quantity || 1), 0);
      const itemsPreview = (o.items || []).slice(0, 2).map(it => {
        if (it.type === 'bouquet') return `💐 ${App.esc(it.name)}`;
        return App.esc(it.name || 'товар');
      }).join(', ');
      const moreCount = (o.items || []).length - 2;

      // Доставка
      let deliveryHtml;
      if (o.deliveryType === 'courier') {
        deliveryHtml = `<span class="badge bpur">🚚 ${App.fmtMoney(o.deliveryCost || 0)}</span>`;
        if (o.deliveryDate) {
          deliveryHtml += `<div class="hint">${App.fmtDate(o.deliveryDate)} ${o.deliveryTime || ''}</div>`;
        }
      } else if (o.deliveryType === 'employee') {
        deliveryHtml = `<span class="badge bwa">👤 ${App.fmtMoney(o.deliveryCost || 0)}</span>`;
        if (o.deliveryDate) {
          deliveryHtml += `<div class="hint">${App.fmtDate(o.deliveryDate)} ${o.deliveryTime || ''}</div>`;
        }
      } else {
        deliveryHtml = '<span class="badge bmu">🏪 Самовывоз</span>';
      }

      h += `
        <tr>
          <td>
            <strong data-action="view" data-id="${o.id}" style="cursor:pointer">
              #${App.esc(String(o.id).slice(-6))}
            </strong>
            ${o.fiscalized ? ' 🧾' : ''}
            <div class="hint">${App.relTime(o.ts)}</div>
          </td>
          <td>
            <strong>${App.esc(o.clientName || 'Разовая продажа')}</strong>
            ${o.clientPhone ? `<div class="hint">${App.esc(o.clientPhone)}</div>` : ''}
          </td>
          <td style="font-size:12px">
            ${itemsPreview}${moreCount > 0 ? ` <span class="hint">+${moreCount}</span>` : ''}
            <div class="hint">${itemsCount} поз.</div>
          </td>
          <td>
            <div>${App.fmtMoney(o.amount || 0)}</div>
            ${o.discount > 0 ? `<div class="hint" style="color:var(--bad)">-${App.fmtMoney(o.discount)}</div>` : ''}
            <strong style="color:var(--good)">${App.fmtMoney(o.finalAmount || 0)}</strong>
          </td>
          <td>${deliveryHtml}</td>
          <td>
            <span class="badge ${statusInfo.badge}">
              ${statusInfo.icon} ${statusInfo.label}
            </span>
          </td>
          <td style="white-space:nowrap">
            <button class="ab" style="background:#e0e7ff;color:#3730a3" data-action="view" data-id="${o.id}" title="Просмотр">👁️</button>
            ${canEdit ? `
              <button class="ab" style="background:#dbeafe;color:#1e40af" data-action="edit" data-id="${o.id}">✏️</button>
              <button class="ab" style="background:#d1fae5;color:#065f46" data-action="complete" data-id="${o.id}" title="Завершить">✅</button>
              <button class="ab" style="background:#fee2e2;color:#991b1b" data-action="cancel" data-id="${o.id}" title="Отменить">🛑</button>
            ` : ''}
            <button class="ab" style="background:#fef3c7;color:#92400e" data-action="print" data-id="${o.id}" title="Печать">🖨️</button>
            ${App.Auth.isAdmin() && o.status !== 'completed'
              ? `<button class="ab" style="background:#fce7f3;color:#be185d" data-action="delete" data-id="${o.id}" title="Удалить">🗑️</button>`
              : ''}
          </td>
        </tr>
      `;
    }

    h += `</tbody></table></div>` + App.pagHTML(p, pages);

    App.$('#view').innerHTML = h;
    App.setLoading?.(false);

    _attachOrdersListeners();

  } catch (e) {
    console.error('renderOrders error:', e);
    App.$('#view').innerHTML = `<div class="card" style="text-align:center;padding:40px;color:var(--bad)">
      Ошибка: ${App.esc(e.message)}
    </div>`;
    App.setLoading?.(false);
  }
};

/* ---------- Event delegation ---------- */
function _attachOrdersListeners() {
  const view = App.$('#view');
  if (!view || view.dataset.ordersListeners) return;
  view.dataset.ordersListeners = '1';

  let searchTimer;
  view.addEventListener('input', (e) => {
    if (e.target.matches('[data-search="orders"]')) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        App.debouncedSearch('orders', e.target.value, () => {
          App.state._forceRerender = true;
          App.renderOrders();
        });
      }, 200);
    }
  });

  view.addEventListener('change', (e) => {
    if (e.target.matches('[data-filter="status"]')) {
      App.state.ordersStatus = e.target.value;
      App.setPage('orders', 1);
      App.state._forceRerender = true;
      App.renderOrders();
    } else if (e.target.matches('[data-filter="delivery"]')) {
      App.state.ordersDelivery = e.target.value;
      App.setPage('orders', 1);
      App.state._forceRerender = true;
      App.renderOrders();
    } else if (e.target.matches('[data-sort="orders"]')) {
      App.state.ordersSort = e.target.value;
      App.state._forceRerender = true;
      App.renderOrders();
    }
  });

  view.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) {
      const pgBtn = e.target.closest('[data-pg]');
      if (pgBtn) {
        App.setPage('orders', parseInt(pgBtn.dataset.pg));
        App.state._forceRerender = true;
        App.renderOrders();
      }
      return;
    }

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    switch (action) {
      case 'new':       App.editOrder(null); break;
      case 'edit':      App.editOrder(id); break;
      case 'view':      await App.showOrderDetails(id); break;
      case 'complete':  await App.completeOrder(id); break;
      case 'cancel':    await App.cancelOrder(id); break;
      case 'delete':    await App.deleteOrder(id); break;
      case 'print':     await App.printOrder(id); break;
      case 'export':    await App.exportOrdersCSV(); break;
    }
  });
}

/* ---------- Просмотр деталей заказа ---------- */
App.showOrderDetails = async function(id) {
  const o = await App.repo('orders').byId(id);
  if (!o) {
    App.Toast.er('Заказ не найден');
    return;
  }

  const flowers = await App.repo('flowers').all();
  const flowersMap = new Map(flowers.map(f => [f.id, f]));
  const statusInfo = getStatusInfo(o.status);
  const canManage = App.Auth.canManageOrder(o);
  const canEdit = canManage && !['completed', 'cancelled'].includes(o.status);

  // Состав заказа
  let itemsHtml = '';
  for (const it of (o.items || [])) {
    if (it.type === 'bouquet') {
      itemsHtml += `
        <div style="padding:8px;background:var(--in);border-radius:8px;margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;font-weight:600">
            <span>💐 ${App.esc(it.name)} × ${it.quantity || 1}</span>
            <span>${App.fmtMoney((it.price || 0) * (it.quantity || 1))}</span>
          </div>
          <div style="font-size:12px;color:var(--t3);margin-top:4px">
            ${(it.components || []).map(c => {
              const f = flowersMap.get(c.flowerId);
              return `${f ? f.emoji : '🌸'} ${f ? App.esc(f.name) : '?'} × ${c.quantity}`;
            }).join(' • ')}
          </div>
        </div>
      `;
    } else {
      const f = flowersMap.get(it.flowerId);
      itemsHtml += `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--b)">
          <span>${f ? f.emoji : '🌸'} ${App.esc(it.name || f?.name || '?')} × ${it.quantity}</span>
          <span><strong>${App.fmtMoney((it.price || 0) * (it.quantity || 1))}</strong></span>
        </div>
      `;
    }
  }

  const h = `
    <div style="padding:10px">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px">
        <div>
          <div style="font-size:22px;font-weight:800">Заказ #${App.esc(String(o.id).slice(-6))}</div>
          <div class="hint">Создан: ${App.fmtDateTime(o.ts)} • ${App.esc(o.createdBy || '—')}</div>
        </div>
        <span class="badge ${statusInfo.badge}" style="font-size:14px;padding:6px 14px">
          ${statusInfo.icon} ${statusInfo.label}
        </span>
      </div>

      <div class="row" style="margin-bottom:16px">
        <div class="card" style="padding:12px;margin:0">
          <div class="lbl">Клиент</div>
          <div style="font-weight:600">${App.esc(o.clientName || 'Разовая продажа')}</div>
          ${o.clientPhone ? `<div class="hint">📱 ${App.esc(o.clientPhone)}</div>` : ''}
        </div>
        <div class="card" style="padding:12px;margin:0">
          <div class="lbl">Оплата</div>
          <div style="font-weight:600">
            ${o.paymentMethod === 'card' ? '💳 Карта' : o.paymentMethod === 'cash' ? '💵 Наличные' : '🌐 Онлайн'}
          </div>
          ${o.fiscalized ? '<div class="hint">🧾 Фискализирован</div>' : ''}
        </div>
      </div>

      <div class="card" style="padding:12px;margin-bottom:16px">
        <div class="lbl">Состав заказа</div>
        ${itemsHtml || '<div class="hint">Пусто</div>'}
        <div style="margin-top:12px;padding-top:12px;border-top:2px solid var(--b)">
          <div style="display:flex;justify-content:space-between">
            <span>Сумма:</span><span>${App.fmtMoney(o.amount || 0)}</span>
          </div>
          ${o.discount > 0 ? `
            <div style="display:flex;justify-content:space-between;color:var(--bad)">
              <span>Скидка:</span><span>-${App.fmtMoney(o.discount)}</span>
            </div>
          ` : ''}
          ${o.deliveryCost > 0 ? `
            <div style="display:flex;justify-content:space-between">
              <span>Доставка:</span><span>${App.fmtMoney(o.deliveryCost)}</span>
            </div>
          ` : ''}
          <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;margin-top:8px;color:var(--good)">
            <span>Итого:</span><span>${App.fmtMoney(o.finalAmount || 0)}</span>
          </div>
        </div>
      </div>

      ${o.deliveryType !== 'none' ? `
        <div class="card" style="padding:12px;margin-bottom:16px">
          <div class="lbl">Доставка</div>
          <div style="font-weight:600">
            ${o.deliveryType === 'courier' ? '🚚 Курьер' : '👤 Сотрудник'}
            ${o.deliveryCost ? ` • ${App.fmtMoney(o.deliveryCost)}` : ''}
          </div>
          ${o.deliveryDate ? `
            <div class="hint">📅 ${App.fmtDate(o.deliveryDate)} ${o.deliveryTime || ''}</div>
          ` : ''}
          ${o.deliveryAddress ? `<div class="hint">📍 ${App.esc(o.deliveryAddress)}</div>` : ''}
        </div>
      ` : ''}

      ${o.comment ? `
        <div class="card" style="padding:12px;margin-bottom:16px">
          <div class="lbl">Комментарий</div>
          <div>${App.esc(o.comment)}</div>
        </div>
      ` : ''}

      ${o.status === 'completed' && o.completedAt ? `
        <div class="hint">✅ Выполнен: ${App.fmtDateTime(o.completedAt)}</div>
      ` : ''}
      ${o.status === 'cancelled' && o.cancelledAt ? `
        <div class="hint">❌ Отменён: ${App.fmtDateTime(o.cancelledAt)}</div>
      ` : ''}

      <div style="display:flex;gap:8px;margin-top:20px;flex-wrap:wrap">
        ${canEdit ? `<button class="btn" data-action="edit" data-id="${o.id}">✏️ Редактировать</button>` : ''}
        <button class="btn g" data-action="print" data-id="${o.id}">🖨️ Печать</button>
        <button class="btn g" id="closeOrderDetails">Закрыть</button>
      </div>
    </div>
  `;

  App.Modal.open(`📦 Заказ #${String(o.id).slice(-6)}`, h);

  setTimeout(() => {
    const closeBtn = document.getElementById('closeOrderDetails');
    if (closeBtn) closeBtn.onclick = () => App.Modal.close();

    App.Modal.body().querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        App.Modal.close();

        if (action === 'edit') App.editOrder(id);
        else if (action === 'print') await App.printOrder(id);
      });
    });
  }, 50);
};

/* ---------- Создание/редактирование ---------- */
App.editOrder = async function(id) {
  if (App._savingOrder) {
    App.Toast.wn('Идёт сохранение...');
    return;
  }
  if (!App.Auth.can('employee', 'admin', 'owner')) {
    App.Toast.er('Нет доступа');
    return;
  }

  if (App._orderModalOpen) {
    App.Toast.wn('Окно заказа уже открыто');
    return;
  }

  App._orderModalOpen = true;

  try {
    const [flowers, clients] = await Promise.all([
      App.repo('flowers').all(),
      App.repo('clients').all()
    ]);

    const flowersMap = new Map(flowers.map(f => [f.id, f]));
    const clientsMap = new Map(clients.map(c => [c.id, c]));

    const o = id ? await App.repo('orders').byId(id) : null;

    if (o) {
      if (['completed', 'cancelled'].includes(o.status)) {
        App.Toast.er('Запрещено редактировать завершённый/отменённый заказ');
        App._orderModalOpen = false;
        return;
      }
      if (!App.Auth.canManageOrder(o)) {
        App.Toast.er('Нет прав на этот заказ');
        App._orderModalOpen = false;
        return;
      }
    }

    App._orderDraft = o
      ? JSON.parse(JSON.stringify(o))
      : { items: [], status: 'new' };

    App._orderDraft._flowersMap = flowersMap;
    App._orderDraft._clientsMap = clientsMap;

    const activeFlowers = flowers.filter(f =>
      f.active !== false && !App.BOUQUET_EXCLUDE_CATS.includes(f.category)
    );

    const flowerOpts = activeFlowers.map(f =>
      `<option value="${f.id}">${f.emoji || '🌸'} ${App.esc(f.name)} (${f.stock} шт)</option>`
    ).join('');

    const clientOpts = clients.map(c =>
      `<option value="${c.id}" ${o && o.clientId === c.id ? 'selected' : ''}>${App.esc(c.name)} — ${App.esc(c.phone)}</option>`
    ).join('');

    const h = `
      <form id="orderForm">
        <div class="row">
          <div>
            <label class="lbl">Клиент</label>
            <select class="inp" name="clientId">
              <option value="">— Разовая продажа —</option>
              ${clientOpts}
            </select>
            <button type="button" class="btn g" style="margin-top:6px;padding:4px 10px;font-size:12px" id="quickClientBtn">+ Быстрый клиент</button>
          </div>
          <div>
            <label class="lbl">Способ оплаты</label>
            <select class="inp" name="paymentMethod">
              <option value="card" ${o?.paymentMethod === 'card' ? 'selected' : ''}>💳 Карта</option>
              <option value="cash" ${!o || o.paymentMethod === 'cash' ? 'selected' : ''}>💵 Наличные</option>
              <option value="online" ${o?.paymentMethod === 'online' ? 'selected' : ''}>🌐 Онлайн</option>
            </select>
          </div>
        </div>

        <div style="margin-top:16px">
          <label class="lbl">Состав заказа</label>
          <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
            <select class="inp" id="addFlowerSel" style="flex:1;min-width:150px">
              <option value="">-- товар --</option>
              ${flowerOpts}
            </select>
            <input type="number" class="inp" id="addFlowerQty" value="1" min="1" style="width:80px">
            <button type="button" class="btn s" id="addFlowerBtn">+</button>
            <button type="button" class="btn" id="addBouquetBtn">💐 Букет</button>
          </div>
          <div class="cart" id="orderItemsList" style="min-height:60px"></div>
        </div>

        <div class="sumrow" style="margin-top:12px">
          <span>Сумма: <strong id="oSum">${App.fmtMoney(0)}</strong></span>
          <span>Скидка: <strong id="oDisc" style="color:var(--bad)">${App.fmtMoney(0)}</strong></span>
          <span>Итого: <strong style="color:var(--good);font-size:20px" id="oTot">${App.fmtMoney(0)}</strong></span>
        </div>

        <div class="row" style="margin-top:16px">
          <div>
            <label class="lbl">Доставка</label>
            <select class="inp" name="deliveryType">
              <option value="none" ${!o || o.deliveryType === 'none' ? 'selected' : ''}>🏪 Самовывоз</option>
              <option value="courier" ${o?.deliveryType === 'courier' ? 'selected' : ''}>🚚 Курьер</option>
              <option value="employee" ${o?.deliveryType === 'employee' ? 'selected' : ''}>👤 Сотрудник</option>
            </select>
          </div>
          <div>
            <label class="lbl">Стоимость доставки</label>
            <input type="number" class="inp" name="deliveryCost" min="0" step="50"
                   value="${o?.deliveryCost || 0}">
          </div>
        </div>

        <div class="row" style="margin-top:12px">
          <div>
            <label class="lbl">Дата доставки</label>
            <input type="date" class="inp" name="deliveryDate"
                   value="${o?.deliveryDate || ''}">
          </div>
          <div>
            <label class="lbl">Время доставки</label>
            <input type="time" class="inp" name="deliveryTime"
                   value="${o?.deliveryTime || ''}">
          </div>
        </div>

        <div style="margin-top:12px">
          <label class="lbl">Адрес доставки</label>
          <input class="inp" name="deliveryAddress"
                 value="${App.esc(o?.deliveryAddress || '')}"
                 placeholder="Улица, дом, квартира">
        </div>

        <div style="margin-top:12px">
          <label class="lbl">Комментарий</label>
          <textarea class="inp" name="comment" rows="2"
                    placeholder="Особенности заказа, пожелания...">${App.esc(o?.comment || '')}</textarea>
        </div>

        <label class="chk" style="margin-top:12px">
          <input type="checkbox" name="consent"
                 ${o?.consent?.given ? 'checked disabled' : ''} required>
          Согласен(а) на обработку персональных данных (152‑ФЗ)
          ${o?.consent?.given
            ? `<span class="hint"> (дано ${App.fmtDate(o.consent.date)})</span>`
            : ''}
        </label>

        <div style="display:flex;gap:10px;margin-top:20px">
          <button type="submit" class="btn" style="flex:1" id="saveOrderBtn">💾 Сохранить</button>
          <button type="button" class="btn g" style="flex:1" id="cancelOrderBtn">Отмена</button>
        </div>
      </form>
    `;

    App.Modal.open(id ? `Редактирование #${String(id).slice(-6)}` : 'Новый заказ', h);
    App.Modal.onClose(() => {
      App._orderModalOpen = false;
      App._orderDraft = null;
    });

    _attachOrderFormListeners(id);
    _renderOrderItems();

  } catch (e) {
    console.error('editOrder error:', e);
    App.Toast.er('Ошибка: ' + e.message);
    App._orderModalOpen = false;
  }
};

/* ---------- Рендер состава заказа ---------- */
function _renderOrderItems() {
  const el = document.getElementById('orderItemsList');
  if (!el || !App._orderDraft) return;

  const flowersMap = App._orderDraft._flowersMap || new Map();

  if (!App._orderDraft.items || App._orderDraft.items.length === 0) {
    el.innerHTML = '<div class="hint" style="text-align:center;padding:10px">Добавьте товары или букеты</div>';
    _updateOrderTotals();
    return;
  }

  let html = '';
  for (let i = 0; i < App._orderDraft.items.length; i++) {
    const it = App._orderDraft.items[i];

    if (it.type === 'bouquet') {
      html += `
        <div class="cart-r" style="flex-direction:column;align-items:stretch;gap:4px">
          <div style="display:flex;justify-content:space-between;width:100%">
            <span>💐 <strong>${App.esc(it.name)}</strong> × ${it.quantity || 1}</span>
            <div style="display:flex;gap:4px">
              <span style="color:var(--good)">${App.fmtMoney((it.price || 0) * (it.quantity || 1))}</span>
              <button type="button" class="ab" style="background:#fee2e2;color:#991b1b" data-rm="${i}">✕</button>
            </div>
          </div>
          <div style="font-size:11px;color:var(--t3);padding-left:12px">
            ${(it.components || []).map(c => {
              const f = flowersMap.get(c.flowerId);
              return `${f ? f.emoji : '🌸'} ${f ? App.esc(f.name) : '?'} × ${c.quantity}`;
            }).join(' • ')}
          </div>
        </div>
      `;
    } else {
      const f = flowersMap.get(it.flowerId);
      html += `
        <div class="cart-r">
          <span>${f ? f.emoji : '🌸'} ${App.esc(it.name || f?.name || '?')} × ${it.quantity}</span>
          <div style="display:flex;gap:4px;align-items:center">
            <span style="color:var(--good)">${App.fmtMoney((it.price || 0) * it.quantity)}</span>
            <button type="button" class="ab" style="background:#dbeafe;color:#1e40af" data-qty-minus="${i}">−</button>
            <button type="button" class="ab" style="background:#dbeafe;color:#1e40af" data-qty-plus="${i}">+</button>
            <button type="button" class="ab" style="background:#fee2e2;color:#991b1b" data-rm="${i}">✕</button>
          </div>
        </div>
      `;
    }
  }

  el.innerHTML = html;

  el.querySelectorAll('[data-rm]').forEach(btn => {
    btn.addEventListener('click', function() {
      App._orderDraft.items.splice(parseInt(this.dataset.rm), 1);
      _renderOrderItems();
    });
  });

  el.querySelectorAll('[data-qty-minus]').forEach(btn => {
    btn.addEventListener('click', function() {
      const i = parseInt(this.dataset.qtyMinus);
      if (App._orderDraft.items[i].quantity > 1) {
        App._orderDraft.items[i].quantity--;
        _renderOrderItems();
      }
    });
  });

  el.querySelectorAll('[data-qty-plus]').forEach(btn => {
    btn.addEventListener('click', function() {
      const i = parseInt(this.dataset.qtyPlus);
      App._orderDraft.items[i].quantity++;
      _renderOrderItems();
    });
  });

  _updateOrderTotals();
}

/* ---------- Обновление итогов ---------- */
function _updateOrderTotals() {
  if (!App._orderDraft) return;

  const flowersMap = App._orderDraft._flowersMap || new Map();
  const clientsMap = App._orderDraft._clientsMap || new Map();

  const amount = App._orderDraft.items.reduce((s, it) => {
    return s + (it.price || 0) * (it.quantity || 1);
  }, 0);

  // Скидка по клиенту
  let discount = 0;
  const clientSelect = document.querySelector('#orderForm [name=clientId]');
  if (clientSelect && clientSelect.value) {
    const client = clientsMap.get(clientSelect.value);
    if (client && client.loyaltyProgram !== false) {
      discount = client.discountType === 'percent'
        ? Math.round(amount * (client.discountValue || 0) / 100)
        : (client.discountValue || 0);
      if (discount > amount) discount = amount;
    }
  }

  const deliveryInput = document.querySelector('#orderForm [name=deliveryCost]');
  const deliveryCost = parseFloat(deliveryInput?.value) || 0;
  const finalAmount = Math.max(0, amount - discount + deliveryCost);

  const sumEl = document.getElementById('oSum');
  const discEl = document.getElementById('oDisc');
  const totEl = document.getElementById('oTot');

  if (sumEl) sumEl.textContent = App.fmtMoney(amount);
  if (discEl) discEl.textContent = App.fmtMoney(discount);
  if (totEl) totEl.textContent = App.fmtMoney(finalAmount);
}

/* ---------- Listeners формы ---------- */
function _attachOrderFormListeners(orderId) {
  const form = document.getElementById('orderForm');
  const addFlowerBtn = document.getElementById('addFlowerBtn');
  const addBouquetBtn = document.getElementById('addBouquetBtn');
  const cancelBtn = document.getElementById('cancelOrderBtn');
  const quickClientBtn = document.getElementById('quickClientBtn');

  if (addFlowerBtn) {
    addFlowerBtn.addEventListener('click', async () => {
      const fid = document.getElementById('addFlowerSel')?.value;
      const qty = parseInt(document.getElementById('addFlowerQty')?.value) || 1;

      if (!fid) {
        App.Toast.wn('Выберите товар');
        return;
      }
      if (qty <= 0) {
        App.Toast.er('Количество должно быть больше нуля');
        return;
      }

      const flowersMap = App._orderDraft._flowersMap;
      const f = flowersMap.get(fid);
      if (!f) return;

      // Проверка доступности с учётом резерва (async!)
      const reserved = await App.getReservedQty(fid);
      const available = (f.stock || 0) - reserved;

      // Если редактируем заказ — учитываем что этот товар уже в заказе
      let alreadyInOrder = 0;
      if (orderId) {
        for (const it of App._orderDraft.items) {
          if (it.type === 'flower' && it.flowerId === fid) {
            alreadyInOrder += it.quantity;
          } else if (it.type === 'bouquet') {
            for (const c of (it.components || [])) {
              if (c.flowerId === fid) alreadyInOrder += c.quantity * (it.quantity || 1);
            }
          }
        }
      }

      const currentInDraft = App._orderDraft.items
        .filter(it => it.type === 'flower' && it.flowerId === fid)
        .reduce((s, it) => s + it.quantity, 0);

      if (currentInDraft + qty - alreadyInOrder > available) {
        App.Toast.er(`Недостаточно товара. Свободно: ${Math.max(0, available)}`);
        return;
      }

      const existing = App._orderDraft.items.find(it =>
        it.type === 'flower' && it.flowerId === fid
      );
      if (existing) {
        existing.quantity += qty;
      } else {
        App._orderDraft.items.push({
          type: 'flower',
          flowerId: fid,
          name: f.name,
          price: f.shopPrice,
          quantity: qty
        });
      }

      document.getElementById('addFlowerSel').value = '';
      document.getElementById('addFlowerQty').value = '1';
      _renderOrderItems();
    });
  }

  if (addBouquetBtn) {
    addBouquetBtn.addEventListener('click', () => {
      App._openBouquetBuilderInOrder();
    });
  }

  if (quickClientBtn) {
    quickClientBtn.onclick = async () => {
      const name = await App.Modal.prompt('ФИО клиента:', 'Быстрый клиент');
      if (!name) return;
      const phone = await App.Modal.prompt('Телефон:', 'Быстрый клиент', '+7 ');
      if (!phone || !App.isValidPhone(phone)) {
        App.Toast.er('Некорректный телефон');
        return;
      }

      const newClient = {
        id: App.uid(),
        name: name.trim(),
        phone,
        loyaltyProgram: true,
        discountType: 'percent',
        discountValue: 0,
        orders: 0,
        totalSpent: 0,
        createdById: App.Auth.user.id,
        createdAt: Date.now()
      };

      await App.repo('clients').save(newClient);
      App._orderDraft._clientsMap.set(newClient.id, newClient);

      // Обновляем select
      const select = document.querySelector('#orderForm [name=clientId]');
      const option = document.createElement('option');
      option.value = newClient.id;
      option.textContent = `${newClient.name} — ${newClient.phone}`;
      option.selected = true;
      select.appendChild(option);

      _updateOrderTotals();
      App.Toast.ok('Клиент создан');
    };
  }

  if (cancelBtn) {
    cancelBtn.onclick = () => App.Modal.close();
  }

  if (form) {
    form.addEventListener('change', (e) => {
      if (['clientId', 'deliveryCost', 'deliveryType'].includes(e.target.name)) {
        _updateOrderTotals();
      }
    });

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      await _saveOrder(orderId);
    });
  }
}

/* ---------- Конструктор букетов внутри заказа ---------- */
App._openBouquetBuilderInOrder = function() {
  const flowers = Array.from(App._orderDraft._flowersMap.values())
    .filter(f => f.active !== false && !App.BOUQUET_EXCLUDE_CATS.includes(f.category));

  let comps = [];

  const h = `
    <form id="bqForm">
      <div class="row">
        <div>
          <label class="lbl">Название букета *</label>
          <input class="inp" name="bqName" required placeholder="Например: Весенний микс">
        </div>
        <div>
          <label class="lbl">Цена продажи *</label>
          <input type="number" class="inp" name="bqPrice" min="1" required>
        </div>
      </div>
      <div style="margin-top:12px">
        <label class="lbl">Количество букетов</label>
        <input type="number" class="inp" name="bqQty" value="1" min="1">
      </div>
      <div style="margin-top:16px">
        <label class="lbl">Компоненты</label>
        <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
          <select class="inp" id="bqFlower" style="flex:1;min-width:150px">
            <option value="">-- цветок --</option>
            ${flowers.map(f =>
              `<option value="${f.id}">${f.emoji || '🌸'} ${App.esc(f.name)} (${f.stock} шт)</option>`
            ).join('')}
          </select>
          <input type="number" class="inp" id="bqQtyInput" value="1" min="1" style="width:80px">
          <button type="button" class="btn s" id="addBqComp">+</button>
        </div>
        <div class="cart" id="bqList" style="min-height:40px"></div>
        <div class="hint" style="margin-top:6px">Себестоимость: <strong id="bqCost">${App.fmtMoney(0)}</strong></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button type="submit" class="btn" style="flex:1">Добавить в заказ</button>
        <button type="button" class="btn g" style="flex:1" id="cancelBq">Отмена</button>
      </div>
    </form>
  `;

  App.Modal.open('💐 Создать букет для заказа', h);

  function renderComps() {
    const el = document.getElementById('bqList');
    if (!el) return;

    if (!comps.length) {
      el.innerHTML = '<div class="hint" style="text-align:center">Добавьте цветы</div>';
    } else {
      el.innerHTML = comps.map((c, i) => {
        const f = flowers.find(x => x.id === c.flowerId);
        return `
          <div class="cart-r">
            <span>${f ? f.emoji : '🌸'} ${App.esc(f?.name || '?')} × ${c.quantity}</span>
            <button type="button" class="ab" style="background:#fee2e2;color:#991b1b" data-rm="${i}">✕</button>
          </div>
        `;
      }).join('');

      el.querySelectorAll('[data-rm]').forEach(btn => {
        btn.addEventListener('click', function() {
          comps.splice(parseInt(this.dataset.rm), 1);
          renderComps();
        });
      });
    }

    // Себестоимость
    const cost = comps.reduce((s, c) => {
      const f = flowers.find(x => x.id === c.flowerId);
      return s + (f?.purchasePrice || 0) * c.quantity;
    }, 0);
    const costEl = document.getElementById('bqCost');
    if (costEl) costEl.textContent = App.fmtMoney(cost);
  }

  renderComps();

  document.getElementById('addBqComp').onclick = async () => {
    const fid = document.getElementById('bqFlower').value;
    const qty = parseInt(document.getElementById('bqQtyInput').value) || 1;

    if (!fid || qty <= 0) {
      App.Toast.wn('Выберите цветок и количество');
      return;
    }

    const f = flowers.find(x => x.id === fid);
    if (!f) return;

    const reserved = await App.getReservedQty(fid);
    const available = (f.stock || 0) - reserved;
    const currentQty = comps.filter(c => c.flowerId === fid).reduce((s, c) => s + c.quantity, 0);

    if (currentQty + qty > available) {
      App.Toast.er(`Недостаточно товара. Свободно: ${Math.max(0, available)}`);
      return;
    }

    const existing = comps.find(c => c.flowerId === fid);
    if (existing) {
      existing.quantity += qty;
    } else {
      comps.push({ flowerId: fid, quantity: qty });
    }

    document.getElementById('bqFlower').value = '';
    document.getElementById('bqQtyInput').value = '1';
    renderComps();
  };

  document.getElementById('cancelBq').onclick = () => App.Modal.close();

  document.getElementById('bqForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.bqName.value.trim();
    const price = parseFloat(e.target.bqPrice.value);
    const qty = parseInt(e.target.bqQty.value) || 1;

    if (!name || !price || !comps.length) {
      App.Toast.er('Заполните все поля');
      return;
    }

    // Проверка общей доступности с учётом количества букетов
    for (const c of comps) {
      const f = flowers.find(x => x.id === c.flowerId);
      if (!f) continue;

      const reserved = await App.getReservedQty(c.flowerId);
      const available = (f.stock || 0) - reserved;
      const needed = c.quantity * qty;

      if (needed > available) {
        App.Toast.er(`Недостаточно «${f.name}». Нужно ${needed}, свободно ${available}`);
        return;
      }
    }

    const compDetails = comps.map(c => {
      const f = flowers.find(x => x.id === c.flowerId);
      return {
        flowerId: c.flowerId,
        name: f?.name || '?',
        quantity: c.quantity
      };
    });

    App._orderDraft.items.push({
      type: 'bouquet',
      name,
      price,
      quantity: qty,
      components: compDetails
    });

    App.Modal.close();
    _renderOrderItems();
  });
};

/* ---------- Сохранение заказа ---------- */
async function _saveOrder(id) {
  if (App._savingOrder) return;
  App._savingOrder = true;

  const saveBtn = document.getElementById('saveOrderBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Сохранение...';
  }

  try {
    const form = document.getElementById('orderForm');
    if (!form) throw new Error('Форма не найдена');
    if (!App._orderDraft) throw new Error('Нет черновика заказа');

    const clientId = form.clientId.value || null; // НЕ parseInt! это строка
    const paymentMethod = form.paymentMethod.value;
    const deliveryType = form.deliveryType.value;
    const deliveryCost = parseFloat(form.deliveryCost.value) || 0;
    const deliveryDate = form.deliveryDate.value || null;
    const deliveryTime = form.deliveryTime.value || null;
    const deliveryAddress = form.deliveryAddress.value.trim();
    const comment = form.comment.value.trim();

    // Итоги
    const amount = App._orderDraft.items.reduce((s, it) =>
      s + (it.price || 0) * (it.quantity || 1), 0
    );

    let discount = 0;
    const clientsMap = App._orderDraft._clientsMap;
    const client = clientId ? clientsMap.get(clientId) : null;

    if (client && client.loyaltyProgram !== false) {
      discount = client.discountType === 'percent'
        ? Math.round(amount * (client.discountValue || 0) / 100)
        : (client.discountValue || 0);
      if (discount > amount) discount = amount;
    }

    const finalAmount = Math.max(0, amount - discount + deliveryCost);

    if (finalAmount <= 0 && App._orderDraft.items.length > 0) {
      App.Toast.er('Сумма заказа должна быть положительной');
      return;
    }

    if (App._orderDraft.items.length === 0) {
      App.Toast.er('Добавьте хотя бы один товар');
      return;
    }

    // Согласие (сохраняем первоначальное если уже было)
    let consent = id ? (await App.repo('orders').byId(id))?.consent : null;
    if (form.consent.checked && (!consent || !consent.given)) {
      consent = {
        given: true,
        date: new Date().toISOString(),
        text: 'Согласие на обработку ПДн'
      };
    }

    // Валидация остатков (с учётом уже зарезервированных для этого заказа при редактировании)
    const requiredMap = new Map();
    for (const it of App._orderDraft.items) {
      if (it.type === 'flower') {
        requiredMap.set(it.flowerId, (requiredMap.get(it.flowerId) || 0) + it.quantity);
      } else if (it.type === 'bouquet') {
        for (const c of (it.components || [])) {
          requiredMap.set(c.flowerId, (requiredMap.get(c.flowerId) || 0) + c.quantity * (it.quantity || 1));
        }
      }
    }

    // При редактировании вычитаем то, что уже было в старом заказе
    if (id) {
      const old = await App.repo('orders').byId(id);
      if (old?.items) {
        for (const it of old.items) {
          if (it.type === 'flower') {
            requiredMap.set(it.flowerId, (requiredMap.get(it.flowerId) || 0) - it.quantity);
          } else if (it.type === 'bouquet') {
            for (const c of (it.components || [])) {
              requiredMap.set(c.flowerId, (requiredMap.get(c.flowerId) || 0) - c.quantity * (it.quantity || 1));
            }
          }
        }
      }
    }

    // Проверка что всего хватает
    for (const [flowerId, netNeed] of requiredMap) {
      if (netNeed <= 0) continue;
      const fl = App._orderDraft._flowersMap.get(flowerId);
      if (!fl) {
        throw new Error(`Товар ${flowerId} не найден`);
      }
      const reserved = await App.getReservedQty(flowerId);
      const available = (fl.stock || 0) - reserved;
      if (netNeed > available) {
        throw new Error(`Недостаточно «${fl.name}». Нужно ${netNeed}, свободно ${Math.max(0, available)}`);
      }
    }

    // Формируем данные заказа
    const orderData = {
      clientId: clientId || null,
      clientName: client ? client.name : 'Разовая продажа',
      clientPhone: client ? client.phone : '',
      items: JSON.parse(JSON.stringify(App._orderDraft.items)),
      amount,
      discount,
      deliveryType,
      deliveryCost,
      deliveryDate,
      deliveryTime,
      deliveryAddress,
      paymentMethod,
      finalAmount,
      comment,
      consent,
      status: App._orderDraft.status || 'new'
    };

    // Транзакция остатков
    let orderId;
    if (id) {
      const existing = await App.repo('orders').byId(id);
      if (!existing) throw new Error('Заказ не найден');

      // Возврат старых остатков
      const returnChanges = _computeOrderStockChanges(existing.items, 1);
      if (returnChanges.length > 0) {
        const res = await _applyStockChanges(returnChanges, 'order_edit_return', id);
        if (!res.ok) throw new Error('Ошибка возврата остатков: ' + res.error);
      }

      // Списание новых остатков
      const newChanges = _computeOrderStockChanges(orderData.items, -1);
      if (newChanges.length > 0) {
        const res = await _applyStockChanges(newChanges, 'order_edit_apply', id);
        if (!res.ok) {
          // Откат возврата
          const rollback = _computeOrderStockChanges(existing.items, -1);
          await _applyStockChanges(rollback, 'order_edit_rollback', id);
          throw new Error('Ошибка списания: ' + res.error);
        }
      }

      await App.repo('orders').save({
        ...existing,
        ...orderData,
        updatedAt: Date.now()
      });
      orderId = id;
    } else {
      orderId = App.uid();

      // Списание остатков
      const changes = _computeOrderStockChanges(orderData.items, -1);
      if (changes.length > 0) {
        const res = await _applyStockChanges(changes, 'order_create', orderId);
        if (!res.ok) throw new Error('Ошибка списания: ' + res.error);
      }

      await App.repo('orders').save({
        id: orderId,
        ...orderData,
        ts: Date.now(),
        createdById: App.Auth.user.id,
        createdBy: App.Auth.user.name,
        createdAt: Date.now()
      });
    }

    if (App.Audit) {
      await App.Audit.log(
        id ? App.AUDIT_ACTIONS.ORDER_UPDATED : App.AUDIT_ACTIONS.ORDER_CREATED,
        {
          orderId,
          total: finalAmount,
          itemsCount: orderData.items.length,
          clientName: orderData.clientName
        },
        'orders',
        orderId
      );
    }

    // Уведомления клиенту
    if (deliveryType !== 'none') {
      if (client?.email) {
        App.ExtServices?.sendEmail?.(
          client.email,
          'Ваш заказ оформлен',
          `Заказ #${String(orderId).slice(-6)} на сумму ${App.fmtMoney(finalAmount)}`
        ).catch(() => {});
      }
      if (client?.phone) {
        App.ExtServices?.sendSMS?.(
          client.phone,
          `Заказ #${String(orderId).slice(-6)} принят. Сумма: ${App.fmtMoney(finalAmount)}`
        ).catch(() => {});
      }
    }

    App.Toast.ok(id ? 'Заказ обновлён' : 'Заказ создан');
    App.Modal.close();
    App.rerender();

  } catch (err) {
    console.error('saveOrder error:', err);
    App.Toast.er('Ошибка: ' + err.message);
  } finally {
    App._savingOrder = false;
  }
}

/* ---------- Завершение заказа ---------- */
App.completeOrder = async function(id) {
  try {
    const o = await App.repo('orders').byId(id);
    if (!o) {
      App.Toast.er('Заказ не найден');
      return;
    }
    if (!App.Auth.canManageOrder(o)) {
      App.Toast.er('Нет прав на этот заказ');
      return;
    }
    if (o.status === 'completed') {
      App.Toast.wn('Заказ уже выполнен');
      return;
    }
    if (o.status === 'cancelled') {
      App.Toast.er('Нельзя выполнить отменённый заказ');
      return;
    }

    const confirmed = await App.Modal.confirm(
      `Пометить заказ #${String(id).slice(-6)} как выполненный?`
    );
    if (!confirmed) return;

    await App.repo('orders').update(id, {
      status: 'completed',
      completedAt: Date.now()
    });

    // Обновление статистики клиента
    if (o.clientId) {
      try {
        const client = await App.repo('clients').byId(o.clientId);
        if (client) {
          await App.repo('clients').update(o.clientId, {
            orders: (client.orders || 0) + 1,
            totalSpent: (client.totalSpent || 0) + (o.finalAmount || 0),
            lastOrderDate: Date.now()
          });
        }
      } catch { /* ignore */ }
    }

    // Фискализация
    try {
      const result = await App.ExtServices?.fiscalize?.(o);
      if (result?.ok) {
        await App.repo('orders').update(id, { fiscalized: true });
      }
    } catch (e) {
      console.warn('Fiscalize error:', e);
    }

    if (App.Audit) {
      await App.Audit.log(App.AUDIT_ACTIONS.ORDER_COMPLETED, { orderId: id }, 'orders', id);
    }

    App.Toast.ok('Заказ выполнен');
    App.rerender();
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- Отмена заказа ---------- */
App.cancelOrder = async function(id) {
  try {
    const o = await App.repo('orders').byId(id);
    if (!o) {
      App.Toast.er('Заказ не найден');
      return;
    }
    if (!App.Auth.canManageOrder(o)) {
      App.Toast.er('Нет прав на этот заказ');
      return;
    }
    if (o.status === 'cancelled') {
      App.Toast.wn('Заказ уже отменён');
      return;
    }
    if (o.status === 'completed') {
      App.Toast.er('Нельзя отменить выполненный заказ. Создайте возврат.');
      return;
    }

    const confirmed = await App.Modal.confirm(
      `Отменить заказ #${String(id).slice(-6)}? Товары вернутся на склад.`
    );
    if (!confirmed) return;

    // Возврат остатков
    const changes = _computeOrderStockChanges(o.items, 1);
    if (changes.length > 0) {
      const res = await _applyStockChanges(changes, 'order_cancel', id);
      if (!res.ok) {
        App.Toast.er('Ошибка возврата: ' + res.error);
        return;
      }
    }

    await App.repo('orders').update(id, {
      status: 'cancelled',
      cancelledAt: Date.now()
    });

    if (App.Audit) {
      await App.Audit.log(App.AUDIT_ACTIONS.ORDER_CANCELLED, { orderId: id }, 'orders', id);
    }

    App.Toast.ok('Заказ отменён, товары возвращены');
    App.rerender();
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- Удаление заказа ---------- */
App.deleteOrder = async function(id) {
  if (!App.Auth.isAdmin()) {
    App.Toast.er('Только администратор может удалять заказы');
    return;
  }

  try {
    const o = await App.repo('orders').byId(id);
    if (!o) {
      App.Toast.er('Заказ не найден');
      return;
    }
    if (o.status === 'completed') {
      App.Toast.er('Нельзя удалить выполненный заказ. Создайте возврат.');
      return;
    }

    // Проверка возвратов
    const returns = await App.repo('returns').all();
    if (returns.some(r => r.orderId === id)) {
      App.Toast.er('Нельзя удалить заказ с возвратами');
      return;
    }

    const confirmed = await App.Modal.confirm(
      `Удалить заказ #${String(id).slice(-6)}? Это действие необратимо.`,
      'Удаление заказа',
      { danger: true, okText: 'Удалить' }
    );
    if (!confirmed) return;

    // Возврат остатков если заказ не был отменён
    if (o.status !== 'cancelled') {
      const changes = _computeOrderStockChanges(o.items, 1);
      if (changes.length > 0) {
        const res = await _applyStockChanges(changes, 'order_delete', id);
        if (!res.ok) {
          App.Toast.er('Ошибка возврата: ' + res.error);
          return;
        }
      }
    }

    await App.repo('orders').remove(id);

    if (App.Audit) {
      await App.Audit.log(App.AUDIT_ACTIONS.DELETE, { orderId: id }, 'orders', id);
    }

    App.Toast.ok('Заказ удалён');
    App.rerender();
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- Печать заказа ---------- */
App.printOrder = async function(id) {
  try {
    const o = await App.repo('orders').byId(id);
    if (!o) {
      App.Toast.er('Заказ не найден');
      return;
    }

    const flowers = await App.repo('flowers').all();
    const flowersMap = new Map(flowers.map(f => [f.id, f]));

    let qrImg = '';
    if (typeof qrcode !== 'undefined') {
      try {
        const qr = qrcode(4, 'M');
        qr.addData(`Заказ #${String(o.id).slice(-6)}\nСумма: ${o.finalAmount}\nКлиент: ${o.clientName}`);
        qr.make();
        qrImg = qr.createDataURL(4);
      } catch (e) {
        console.warn('QR error:', e);
      }
    }

    // Состав
    let itemsHtml = '';
    for (const it of (o.items || [])) {
      if (it.type === 'bouquet') {
        itemsHtml += `
          <tr>
            <td>💐 ${App.esc(it.name)} × ${it.quantity || 1}</td>
            <td style="text-align:right">${App.fmtMoney((it.price || 0) * (it.quantity || 1))}</td>
          </tr>
          <tr>
            <td colspan="2" style="font-size:10px;color:#666;padding-left:20px">
              ${(it.components || []).map(c => {
                const f = flowersMap.get(c.flowerId);
                return `${f ? f.name : '?'} × ${c.quantity}`;
              }).join(', ')}
            </td>
          </tr>
        `;
      } else {
        itemsHtml += `
          <tr>
            <td>${App.esc(it.name || 'Товар')} × ${it.quantity}</td>
            <td style="text-align:right">${App.fmtMoney((it.price || 0) * it.quantity)}</td>
          </tr>
        `;
      }
    }

    const printContainer = App.$('#priceTagPrint');
    if (!printContainer) {
      App.Toast.er('Контейнер печати не найден');
      return;
    }

    printContainer.innerHTML = `
      <div style="font-family:sans-serif;padding:20px;max-width:600px;margin:0 auto">
        <div style="text-align:center;border-bottom:2px solid #6C5CE7;padding-bottom:10px;margin-bottom:20px">
          <h1 style="margin:0;color:#6C5CE7">🌸 FLO.RISTA</h1>
          <div style="font-size:14px;color:#666">Заказ #${String(o.id).slice(-6)}</div>
        </div>

        <div style="margin-bottom:20px">
          <p><strong>Клиент:</strong> ${App.esc(o.clientName || 'Разовая продажа')}</p>
          ${o.clientPhone ? `<p><strong>Телефон:</strong> ${App.esc(o.clientPhone)}</p>` : ''}
          <p><strong>Дата:</strong> ${App.fmtDateTime(o.ts)}</p>
          <p><strong>Оплата:</strong> ${o.paymentMethod === 'card' ? '💳 Карта' : o.paymentMethod === 'cash' ? '💵 Наличные' : '🌐 Онлайн'}</p>
        </div>

        ${o.deliveryType !== 'none' ? `
          <div style="margin-bottom:20px;padding:10px;background:#f0f0f0;border-radius:6px">
            <strong>Доставка:</strong> ${o.deliveryType === 'courier' ? '🚚 Курьер' : '👤 Сотрудник'}
            ${o.deliveryDate ? `<br>📅 ${App.fmtDate(o.deliveryDate)} ${o.deliveryTime || ''}` : ''}
            ${o.deliveryAddress ? `<br>📍 ${App.esc(o.deliveryAddress)}` : ''}
          </div>
        ` : ''}

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <thead>
            <tr style="border-bottom:2px solid #6C5CE7">
              <th style="text-align:left;padding:6px">Товар</th>
              <th style="text-align:right;padding:6px">Сумма</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div style="border-top:1px solid #ccc;padding-top:10px">
          <div style="display:flex;justify-content:space-between">
            <span>Сумма:</span><span>${App.fmtMoney(o.amount || 0)}</span>
          </div>
          ${o.discount > 0 ? `
            <div style="display:flex;justify-content:space-between;color:#e74c3c">
              <span>Скидка:</span><span>-${App.fmtMoney(o.discount)}</span>
            </div>
          ` : ''}
          ${o.deliveryCost > 0 ? `
            <div style="display:flex;justify-content:space-between">
              <span>Доставка:</span><span>${App.fmtMoney(o.deliveryCost)}</span>
            </div>
          ` : ''}
          <div style="display:flex;justify-content:space-between;font-size:20px;font-weight:bold;margin-top:10px;padding-top:10px;border-top:2px solid #6C5CE7">
            <span>ИТОГО:</span><span>${App.fmtMoney(o.finalAmount || 0)}</span>
          </div>
        </div>

        ${o.comment ? `
          <div style="margin-top:20px;padding:10px;background:#fffbeb;border-radius:6px">
            <strong>Комментарий:</strong><br>${App.esc(o.comment)}
          </div>
        ` : ''}

        ${qrImg ? `
          <div style="text-align:center;margin-top:20px">
            <img src="${qrImg}" style="width:100px">
          </div>
        ` : ''}

        <div style="text-align:center;margin-top:20px;font-size:11px;color:#666">
          Спасибо за покупку! 🌸
        </div>
      </div>
    `;

    window.print();
  } catch (e) {
    App.Toast.er('Ошибка печати: ' + e.message);
  }
};

/* ---------- Экспорт в CSV ---------- */
App.exportOrdersCSV = async function() {
  try {
    let orders = await App.repo('orders').all();

    if (!App.Auth.isAdmin()) {
      orders = orders.filter(o => o.createdById === App.Auth.user.id);
    }

    if (!orders.length) {
      App.Toast.wn('Нет заказов для экспорта');
      return;
    }

    const headers = [
      '№', 'Дата', 'Клиент', 'Телефон', 'Состав', 'Сумма',
      'Скидка', 'Доставка', 'Итого', 'Оплата', 'Статус', 'Создал'
    ];

    const rows = orders
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .map(o => {
        const itemsText = (o.items || []).map(it => {
          if (it.type === 'bouquet') return `💐 ${it.name} × ${it.quantity || 1}`;
          return `${it.name || '?'} × ${it.quantity}`;
        }).join('; ');

        const statusInfo = getStatusInfo(o.status);

        return [
          String(o.id).slice(-6),
          App.fmtDateTime(o.ts),
          o.clientName || 'Разовая',
          o.clientPhone || '',
          itemsText,
          o.amount || 0,
          o.discount || 0,
          o.deliveryCost || 0,
          o.finalAmount || 0,
          o.paymentMethod === 'card' ? 'Карта' : o.paymentMethod === 'cash' ? 'Наличные' : 'Онлайн',
          statusInfo.label,
          o.createdBy || ''
        ];
      });

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${App.toLocalDateString(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    App.Toast.ok(`Экспортировано ${orders.length} заказов`);

    if (App.Audit) {
      await App.Audit.logExport('orders', orders.length);
    }
  } catch (e) {
    App.Toast.er('Ошибка экспорта: ' + e.message);
  }
};

console.log('✅ orders.js загружен');