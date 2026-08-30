// ===== ВОЗВРАТЫ =====
// js/modules/returns.js
// v2.0 — с возвратом товаров, обновлением клиента, частичным возвратом

window.App = window.App || {};

/* ---------- Причины возврата ---------- */
const RETURN_REASONS = [
  { id: 'quality',     label: '😞 Низкое качество' },
  { id: 'wrong',       label: '❌ Не тот товар' },
  { id: 'damaged',     label: '💔 Повреждение' },
  { id: 'changed',     label: '🤷 Клиент передумал' },
  { id: 'late',        label: '⏰ Поздняя доставка' },
  { id: 'other',       label: '📝 Другая причина' }
];

/* ---------- Периоды ---------- */
const RETURN_PERIODS = [
  { id: 'week',    label: 'Неделя',    days: 7 },
  { id: 'month',   label: 'Месяц',     days: 30 },
  { id: 'quarter', label: 'Квартал',   days: 90 },
  { id: 'year',    label: 'Год',       days: 365 },
  { id: 'all',     label: 'Всё время', days: -1 }
];

/* ---------- Утилиты ---------- */
function getDateRange(periodId) {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const period = RETURN_PERIODS.find(p => p.id === periodId) || RETURN_PERIODS[1];

  if (period.days === -1) return { from: 0, to: now.getTime() };

  const from = new Date();
  from.setDate(from.getDate() - period.days);
  from.setHours(0, 0, 0, 0);
  return { from: from.getTime(), to: now.getTime() };
}

/* ---------- Основной рендер ---------- */
App.renderReturns = async function() {
  if (!App.Auth.can('owner', 'admin')) {
    App.$('#view').innerHTML = '<div class="card" style="text-align:center;padding:40px">Нет доступа</div>';
    return;
  }

  App.setLoading?.(true);

  try {
    if (!App.state.returnsPeriod) App.state.returnsPeriod = 'month';
    if (!App.state.returnsReason) App.state.returnsReason = 'all';

    const [returns, orders] = await Promise.all([
      App.repo('returns').all(),
      App.repo('orders').all()
    ]);

    const ordersMap = new Map(orders.map(o => [o.id, o]));
    const range = getDateRange(App.state.returnsPeriod);

    let filtered = returns.filter(r =>
      r.ts >= range.from && r.ts <= range.to
    );

    if (App.state.returnsReason !== 'all') {
      filtered = filtered.filter(r => r.reason === App.state.returnsReason);
    }

    const search = (App.getSearch('returns') || '').toLowerCase();
    if (search) {
      filtered = filtered.filter(r => {
        const o = ordersMap.get(r.orderId);
        if (!o) return false;
        return (o.clientName || '').toLowerCase().includes(search) ||
               String(o.id).toLowerCase().includes(search) ||
               (r.reasonText || '').toLowerCase().includes(search);
      });
    }

    filtered.sort((a, b) => (b.ts || 0) - (a.ts || 0));

    const { items: rows, page: p, pages } = App.paginate(filtered, 'returns');

    const totalAmount = filtered.reduce((s, r) => s + (r.amount || 0), 0);
    const restockCount = filtered.filter(r => r.restockItems).length;
    const byReason = {};
    for (const r of filtered) {
      const reasonLabel = RETURN_REASONS.find(x => x.id === r.reason)?.label || 'Другое';
      byReason[reasonLabel] = (byReason[reasonLabel] || 0) + (r.amount || 0);
    }

    let h = `
      <div class="g">
        <div class="card stat" style="background:linear-gradient(135deg,#fce7f3,#fbcfe8)">
          <div class="big">${App.fmtMoney(totalAmount)}</div>
          <div class="sm">Сумма возвратов</div>
        </div>
        <div class="card stat">
          <div class="big">${filtered.length}</div>
          <div class="sm">Всего возвратов</div>
        </div>
        <div class="card stat">
          <div class="big">✅ ${restockCount}</div>
          <div class="sm">С возвратом на склад</div>
        </div>
        <div class="card stat">
          <div class="big">${filtered.length > 0 ? App.fmtMoney(totalAmount / filtered.length) : App.fmtMoney(0)}</div>
          <div class="sm">Средний возврат</div>
        </div>
      </div>

      <div class="tools">
        <input class="inp search" placeholder="Поиск по клиенту, № заказа, причине..."
               value="${App.esc(App.getSearch('returns'))}" data-search="returns">
        <select class="inp" data-filter="period" style="width:auto;min-width:130px">
          ${RETURN_PERIODS.map(p =>
            `<option value="${p.id}" ${App.state.returnsPeriod === p.id ? 'selected' : ''}>${p.label}</option>`
          ).join('')}
        </select>
        <select class="inp" data-filter="reason" style="width:auto;min-width:150px">
          <option value="all">Все причины</option>
          ${RETURN_REASONS.map(r =>
            `<option value="${r.id}" ${App.state.returnsReason === r.id ? 'selected' : ''}>${r.label}</option>`
          ).join('')}
        </select>
        <button class="btn" data-action="new">+ Возврат</button>
        <button class="btn g" data-action="export">📤 CSV</button>
      </div>

      <div class="twrap"><table><thead><tr>
        <th>Дата</th><th>Заказ</th><th>Клиент</th><th>Сумма</th>
        <th>Причина</th><th>Склад</th><th></th>
      </tr></thead><tbody>
    `;

    if (!rows.length) {
      h += `
        <tr>
          <td colspan="7" style="text-align:center;padding:40px">
            <div style="font-size:48px;margin-bottom:10px">↩️</div>
            <div style="color:var(--t3)">Возвратов не найдено</div>
            <div class="hint" style="margin-top:8px">Оформите первый возврат, нажав кнопку выше</div>
          </td>
        </tr>
      `;
    }

    for (const r of rows) {
      const o = ordersMap.get(r.orderId);
      const reasonInfo = RETURN_REASONS.find(x => x.id === r.reason);

      h += `
        <tr>
          <td>${App.fmtDate(r.ts)}</td>
          <td>
            <strong data-action="viewOrder" data-id="${r.orderId}" style="cursor:pointer">
              #${App.esc(String(r.orderId || '').slice(-6))}
            </strong>
          </td>
          <td>${o ? App.esc(o.clientName) : '<span class="hint">заказ удалён</span>'}</td>
          <td><strong style="color:#be185d">${App.fmtMoney(r.amount)}</strong></td>
          <td>
            <span class="badge binfo">${reasonInfo ? reasonInfo.label : 'Другое'}</span>
            ${r.reasonText ? `<div class="hint">${App.esc(r.reasonText).slice(0, 50)}</div>` : ''}
          </td>
          <td>${r.restockItems ? '<span class="badge bok">✅ Возвращены</span>' : '<span class="badge bmu">—</span>'}</td>
          <td style="white-space:nowrap">
            <button class="ab" style="background:#e0e7ff;color:#3730a3" data-action="view" data-id="${r.id}">👁️</button>
            <button class="ab" style="background:#fee2e2;color:#991b1b" data-action="delete" data-id="${r.id}">🗑️</button>
          </td>
        </tr>
      `;
    }

    h += `</tbody></table></div>` + App.pagHTML(p, pages);

    App.$('#view').innerHTML = h;
    App.setLoading?.(false);

    _attachReturnsListeners();

  } catch (e) {
    console.error('renderReturns error:', e);
    App.$('#view').innerHTML = `<div class="card" style="text-align:center;padding:40px;color:var(--bad)">
      Ошибка: ${App.esc(e.message)}
    </div>`;
    App.setLoading?.(false);
  }
};

/* ---------- Event delegation ---------- */
function _attachReturnsListeners() {
  const view = App.$('#view');
  if (!view || view.dataset.returnsListeners) return;
  view.dataset.returnsListeners = '1';

  let searchTimer;
  view.addEventListener('input', (e) => {
    if (e.target.matches('[data-search="returns"]')) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        App.debouncedSearch('returns', e.target.value, () => {
          App.state._forceRerender = true;
          App.renderReturns();
        });
      }, 200);
    }
  });

  view.addEventListener('change', (e) => {
    if (e.target.matches('[data-filter="period"]')) {
      App.state.returnsPeriod = e.target.value;
      App.setPage('returns', 1);
      App.state._forceRerender = true;
      App.renderReturns();
    } else if (e.target.matches('[data-filter="reason"]')) {
      App.state.returnsReason = e.target.value;
      App.setPage('returns', 1);
      App.state._forceRerender = true;
      App.renderReturns();
    }
  });

  view.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      switch (action) {
        case 'new':       App.editReturn(null); break;
        case 'view':      await App.showReturnDetails(id); break;
        case 'delete':    await App.deleteReturn(id); break;
        case 'viewOrder': await App.showOrderDetails?.(id) || App.navigateTo('orders'); break;
        case 'export':    await App.exportReturnsCSV(); break;
      }
      return;
    }

    const pgBtn = e.target.closest('[data-pg]');
    if (pgBtn) {
      App.setPage('returns', parseInt(pgBtn.dataset.pg));
      App.state._forceRerender = true;
      App.renderReturns();
    }
  });
}

/* ---------- Детальный просмотр возврата ---------- */
App.showReturnDetails = async function(id) {
  const r = await App.repo('returns').byId(id);
  if (!r) {
    App.Toast.er('Возврат не найден');
    return;
  }

  const order = await App.repo('orders').byId(r.orderId);
  const flowers = await App.repo('flowers').all();
  const flowersMap = new Map(flowers.map(f => [f.id, f]));
  const reasonInfo = RETURN_REASONS.find(x => x.id === r.reason);

  let itemsHtml = '';
  if (r.items && r.items.length > 0) {
    itemsHtml = '<div style="margin-top:12px"><strong>Возвращённые товары:</strong>';
    for (const it of r.items) {
      const f = flowersMap.get(it.flowerId);
      itemsHtml += `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--b)">
          <span>${f ? f.emoji : '🌸'} ${App.esc(it.name || f?.name || '?')} × ${it.quantity}</span>
          <span>${App.fmtMoney((it.price || 0) * it.quantity)}</span>
        </div>
      `;
    }
    itemsHtml += '</div>';
  }

  const h = `
    <div style="padding:10px">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px">
        <div>
          <div style="font-size:20px;font-weight:800">Возврат от ${App.fmtDate(r.ts)}</div>
          <div class="hint">Создан: ${App.fmtDateTime(r.ts)}</div>
        </div>
        <div style="font-size:24px;font-weight:800;color:#be185d">${App.fmtMoney(r.amount)}</div>
      </div>

      <div class="card" style="padding:12px;margin-bottom:16px">
        <div class="lbl">Заказ</div>
        <div style="font-weight:600">
          #${App.esc(String(r.orderId || '').slice(-6))}
          ${order ? ` — ${App.esc(order.clientName)}` : ' (заказ удалён)'}
        </div>
        ${order ? `<div class="hint">Сумма заказа: ${App.fmtMoney(order.finalAmount)}</div>` : ''}
      </div>

      <div class="card" style="padding:12px;margin-bottom:16px">
        <div class="lbl">Причина</div>
        <div style="font-weight:600">${reasonInfo ? reasonInfo.label : 'Другое'}</div>
        ${r.reasonText ? `<div class="hint" style="margin-top:6px">${App.esc(r.reasonText)}</div>` : ''}
      </div>

      <div class="card" style="padding:12px;margin-bottom:16px">
        <div class="lbl">Возврат на склад</div>
        <div style="font-weight:600">${r.restockItems ? '✅ Товары возвращены' : '❌ Не возвращены'}</div>
      </div>

      ${itemsHtml}

      <div style="display:flex;gap:8px;margin-top:20px">
        <button class="btn g" id="closeReturnDetails">Закрыть</button>
      </div>
    </div>
  `;

  App.Modal.open('↩️ Детали возврата', h);

  setTimeout(() => {
    const closeBtn = document.getElementById('closeReturnDetails');
    if (closeBtn) closeBtn.onclick = () => App.Modal.close();
  }, 50);
};

/* ---------- Создание возврата ---------- */
App._returnModalOpen = false;

App.editReturn = async function(id) {
  if (!App.Auth.can('owner', 'admin')) {
    App.Toast.er('Нет доступа');
    return;
  }

  if (App._returnModalOpen) {
    App.Toast.wn('Окно уже открыто');
    return;
  }

  App._returnModalOpen = true;

  try {
    const orders = await App.repo('orders').all();
    const completedOrders = orders.filter(o => o.status === 'completed');

    // Исключаем заказы, которые уже полностью возвращены
    const allReturns = await App.repo('returns').all();
    const returnedOrderIds = new Set();
    for (const r of allReturns) {
      if (r.orderId && r.amount >= (orders.find(o => o.id === r.orderId)?.finalAmount || 0)) {
        returnedOrderIds.add(r.orderId);
      }
    }

    const availableOrders = completedOrders.filter(o => !returnedOrderIds.has(o.id));

    if (availableOrders.length === 0) {
      App.Toast.wn('Нет доступных заказов для возврата');
      App._returnModalOpen = false;
      return;
    }

    const orderOpts = availableOrders
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .slice(0, 100) // Ограничиваем для производительности
      .map(o => `
        <option value="${o.id}">
          #${App.esc(String(o.id).slice(-6))} — ${App.esc(o.clientName)} — ${App.fmtMoney(o.finalAmount)} — ${App.fmtDate(o.ts)}
        </option>
      `).join('');

    const h = `
      <form id="returnForm">
        <div style="margin-bottom:14px">
          <label class="lbl">Выполненный заказ *</label>
          <select class="inp" name="orderId" required>
            <option value="">-- выберите заказ --</option>
            ${orderOpts}
          </select>
        </div>

        <div id="orderDetails" style="display:none;margin-bottom:16px;padding:12px;background:var(--in);border-radius:8px"></div>

        <div class="row">
          <div>
            <label class="lbl">Сумма возврата (₽) *</label>
            <input type="number" class="inp" name="amount" min="1" step="0.01" required>
          </div>
          <div>
            <label class="lbl">Причина *</label>
            <select class="inp" name="reason" required>
              <option value="">-- выберите --</option>
              ${RETURN_REASONS.map(r =>
                `<option value="${r.id}">${r.label}</option>`
              ).join('')}
            </select>
          </div>
        </div>

        <div style="margin-top:12px">
          <label class="lbl">Комментарий</label>
          <textarea class="inp" name="reasonText" rows="2"
                    placeholder="Подробное описание причины..."></textarea>
        </div>

        <label class="chk" style="margin-top:12px">
          <input type="checkbox" name="restockItems" checked>
          Вернуть товары на склад
        </label>

        <div id="returnWarning" style="display:none;margin-top:12px;padding:10px;background:#fee2e2;color:#991b1b;border-radius:8px;font-size:13px"></div>

        <div style="display:flex;gap:10px;margin-top:20px">
          <button type="submit" class="btn" style="flex:1">↩️ Оформить возврат</button>
          <button type="button" class="btn g" style="flex:1" id="cancelBtn">Отмена</button>
        </div>
      </form>
    `;

    App.Modal.open('Новый возврат', h);
    App.Modal.onClose(() => {
      App._returnModalOpen = false;
    });

    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) cancelBtn.onclick = () => App.Modal.close();

    const orderSelect = document.querySelector('[name="orderId"]');
    const amountInput = document.querySelector('[name="amount"]');
    const orderDetails = document.getElementById('orderDetails');
    const warning = document.getElementById('returnWarning');

    let selectedOrder = null;

    if (orderSelect) {
      orderSelect.addEventListener('change', async () => {
        const orderId = orderSelect.value;
        if (!orderId) {
          orderDetails.style.display = 'none';
          selectedOrder = null;
          return;
        }

        selectedOrder = await App.repo('orders').byId(orderId);
        if (!selectedOrder) return;

        // Показываем детали заказа
        const flowers = await App.repo('flowers').all();
        const flowersMap = new Map(flowers.map(f => [f.id, f]));

        let itemsHtml = '';
        for (const it of (selectedOrder.items || [])) {
          if (it.type === 'bouquet') {
            itemsHtml += `<div>💐 ${App.esc(it.name)} × ${it.quantity || 1} — ${App.fmtMoney((it.price || 0) * (it.quantity || 1))}</div>`;
          } else {
            const f = flowersMap.get(it.flowerId);
            itemsHtml += `<div>${f ? f.emoji : '🌸'} ${App.esc(it.name || f?.name || '?')} × ${it.quantity} — ${App.fmtMoney((it.price || 0) * it.quantity)}</div>`;
          }
        }

        orderDetails.innerHTML = `
          <div style="font-weight:600;margin-bottom:8px">Клиент: ${App.esc(selectedOrder.clientName)}</div>
          <div style="margin-bottom:8px">Сумма заказа: <strong>${App.fmtMoney(selectedOrder.finalAmount)}</strong></div>
          <div style="font-size:12px;color:var(--t3)">${itemsHtml}</div>
        `;
        orderDetails.style.display = 'block';

        // Автозаполнение суммы
        if (amountInput) {
          amountInput.value = selectedOrder.finalAmount;
          amountInput.max = selectedOrder.finalAmount;
        }
      });
    }

    // Валидация суммы
    if (amountInput) {
      amountInput.addEventListener('input', () => {
        if (!selectedOrder) return;
        const amount = parseFloat(amountInput.value) || 0;

        if (amount > selectedOrder.finalAmount) {
          warning.style.display = 'block';
          warning.textContent = `⚠️ Сумма возврата (${App.fmtMoney(amount)}) превышает сумму заказа (${App.fmtMoney(selectedOrder.finalAmount)})`;
        } else {
          warning.style.display = 'none';
        }
      });
    }

    const form = document.getElementById('returnForm');
    if (form) {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        await _saveReturn(form, selectedOrder);
      });
    }

  } catch (e) {
    console.error('editReturn error:', e);
    App.Toast.er('Ошибка: ' + e.message);
    App._returnModalOpen = false;
  }
};

/* ---------- Сохранение возврата ---------- */
async function _saveReturn(form, order) {
  try {
    if (!order) {
      App.Toast.er('Выберите заказ');
      return;
    }

    const amount = parseFloat(form.amount.value) || 0;
    const reason = form.reason.value;
    const reasonText = form.reasonText.value.trim();
    const restockItems = form.restockItems.checked;

    if (!amount || amount <= 0) {
      App.Toast.er('Укажите сумму возврата');
      return;
    }

    if (amount > order.finalAmount) {
      App.Toast.er('Сумма возврата не может превышать сумму заказа');
      return;
    }

    if (!reason) {
      App.Toast.er('Выберите причину');
      return;
    }

    const confirmed = await App.Modal.confirm(
      `Оформить возврат на ${App.fmtMoney(amount)} по заказу #${String(order.id).slice(-6)}?`
    );
    if (!confirmed) return;

    // Создаём возврат
    const returnData = {
      id: App.uid(),
      orderId: order.id,
      amount,
      reason,
      reasonText,
      restockItems,
      items: restockItems ? JSON.parse(JSON.stringify(order.items || [])) : [],
      ts: Date.now(),
      createdById: App.Auth.user.id,
      createdAt: Date.now()
    };

    await App.repo('returns').save(returnData);

    // Возврат товаров на склад
    if (restockItems && order.items && order.items.length > 0) {
      const changes = _computeReturnStockChanges(order.items);
      if (changes.length > 0) {
        for (const change of changes) {
          const fl = await App.repo('flowers').byId(change.flowerId);
          if (fl) {
            await App.repo('flowers').update(fl.id, {
              stock: (fl.stock || 0) + change.delta,
              updatedAt: Date.now()
            });
            await App.recordStockMovement(fl.id, change.delta, `return:${returnData.id}`);
          }
        }
      }
    }

    // Обновление статистики клиента
    if (order.clientId) {
      try {
        const client = await App.repo('clients').byId(order.clientId);
        if (client) {
          const newTotalSpent = Math.max(0, (client.totalSpent || 0) - amount);
          const newOrders = Math.max(0, (client.orders || 0) - 1);

          await App.repo('clients').update(order.clientId, {
            totalSpent: newTotalSpent,
            orders: newOrders
          });
        }
      } catch (e) {
        console.warn('Client update error:', e);
      }
    }

    if (App.Audit) {
      await App.Audit.log(App.AUDIT_ACTIONS.ORDER_REFUNDED, {
        orderId: order.id,
        returnId: returnData.id,
        amount,
        reason,
        restockItems
      }, 'returns', returnData.id);
    }

    App.Toast.ok('Возврат оформлен');
    App.Modal.close();
    App.rerender();

  } catch (e) {
    console.error('saveReturn error:', e);
    App.Toast.er('Ошибка: ' + e.message);
  }
}

/* ---------- Вычисление изменений остатков для возврата ---------- */
function _computeReturnStockChanges(items) {
  const changes = [];
  const seen = new Map();

  for (const it of (items || [])) {
    if (it.type === 'flower') {
      seen.set(it.flowerId, (seen.get(it.flowerId) || 0) + (it.quantity || 0));
    } else if (it.type === 'bouquet') {
      for (const c of (it.components || [])) {
        seen.set(c.flowerId, (seen.get(c.flowerId) || 0) + (c.quantity || 0) * (it.quantity || 1));
      }
    }
  }

  for (const [flowerId, delta] of seen) {
    if (delta > 0) {
      changes.push({ flowerId, delta });
    }
  }

  return changes;
}

/* ---------- Удаление возврата ---------- */
App.deleteReturn = async function(id) {
  if (!App.Auth.can('owner', 'admin')) {
    App.Toast.er('Нет доступа');
    return;
  }

  try {
    const r = await App.repo('returns').byId(id);
    if (!r) {
      App.Toast.er('Возврат не найден');
      return;
    }

    const confirmed = await App.Modal.confirm(
      `Удалить возврат на ${App.fmtMoney(r.amount)}?`,
      'Удаление возврата',
      { danger: true, okText: 'Удалить' }
    );
    if (!confirmed) return;

    // Если товары были возвращены на склад — откатываем
    if (r.restockItems && r.items && r.items.length > 0) {
      const changes = _computeReturnStockChanges(r.items);
      for (const change of changes) {
        const fl = await App.repo('flowers').byId(change.flowerId);
        if (fl) {
          const newStock = Math.max(0, (fl.stock || 0) - change.delta);
          await App.repo('flowers').update(fl.id, {
            stock: newStock,
            updatedAt: Date.now()
          });
          await App.recordStockMovement(fl.id, -change.delta, `return_delete:${id}`);
        }
      }
    }

    // Восстанавливаем статистику клиента
    const order = await App.repo('orders').byId(r.orderId);
    if (order?.clientId) {
      try {
        const client = await App.repo('clients').byId(order.clientId);
        if (client) {
          await App.repo('clients').update(order.clientId, {
            totalSpent: (client.totalSpent || 0) + (r.amount || 0),
            orders: (client.orders || 0) + 1
          });
        }
      } catch { /* ignore */ }
    }

    await App.repo('returns').remove(id);

    if (App.Audit) {
      await App.Audit.log(App.AUDIT_ACTIONS.DELETE, {
        returnId: id,
        amount: r.amount
      }, 'returns', id);
    }

    App.Toast.ok('Возврат удалён');
    App.rerender();
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- Экспорт в CSV ---------- */
App.exportReturnsCSV = async function() {
  try {
    const [returns, orders] = await Promise.all([
      App.repo('returns').all(),
      App.repo('orders').all()
    ]);

    const ordersMap = new Map(orders.map(o => [o.id, o]));
    const range = getDateRange(App.state.returnsPeriod);
    const filtered = returns.filter(r => r.ts >= range.from && r.ts <= range.to);

    if (!filtered.length) {
      App.Toast.wn('Нет данных для экспорта');
      return;
    }

    const headers = [
      'Дата', '№ заказа', 'Клиент', 'Сумма возврата', 'Сумма заказа',
      'Причина', 'Комментарий', 'Возврат на склад'
    ];

    const rows = filtered
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .map(r => {
        const o = ordersMap.get(r.orderId);
        const reasonInfo = RETURN_REASONS.find(x => x.id === r.reason);

        return [
          App.fmtDateTime(r.ts),
          String(r.orderId || '').slice(-6),
          o?.clientName || '',
          r.amount || 0,
          o?.finalAmount || 0,
          reasonInfo?.label || 'Другое',
          r.reasonText || '',
          r.restockItems ? 'Да' : 'Нет'
        ];
      });

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const periodLabel = RETURN_PERIODS.find(p => p.id === App.state.returnsPeriod)?.label || '';
    a.download = `returns_${periodLabel}_${App.toLocalDateString(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    App.Toast.ok(`Экспортировано ${filtered.length} возвратов`);

    if (App.Audit) {
      await App.Audit.logExport('returns', filtered.length, { period: periodLabel });
    }
  } catch (e) {
    App.Toast.er('Ошибка экспорта: ' + e.message);
  }
};

console.log('✅ returns.js загружен');