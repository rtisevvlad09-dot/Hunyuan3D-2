// ===== ПОСТАВКИ =====
// js/modules/supplies.js
// v2.0 — с поставщиками, статусами, историей цен, правильной формой

window.App = window.App || {};

/* ---------- Статусы поставок ---------- */
const SUPPLY_STATUSES = [
  { id: 'draft',    label: 'Черновик',   badge: 'bmu',  icon: '📝' },
  { id: 'ordered',  label: 'Заказана',   badge: 'binfo', icon: '📦' },
  { id: 'received', label: 'Получена',   badge: 'bok',  icon: '✅' },
  { id: 'cancelled',label: 'Отменена',   badge: 'bda',  icon: '❌' }
];

/* ---------- Периоды ---------- */
const SUPPLY_PERIODS = [
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
  const period = SUPPLY_PERIODS.find(p => p.id === periodId) || SUPPLY_PERIODS[1];

  if (period.days === -1) return { from: 0, to: now.getTime() };

  const from = new Date();
  from.setDate(from.getDate() - period.days);
  from.setHours(0, 0, 0, 0);
  return { from: from.getTime(), to: now.getTime() };
}

function getStatusInfo(status) {
  return SUPPLY_STATUSES.find(s => s.id === status) || SUPPLY_STATUSES[2];
}

/* ---------- Основной рендер ---------- */
App.renderSupplies = async function() {
  if (!App.Auth.can('owner', 'admin')) {
    App.$('#view').innerHTML = '<div class="card" style="text-align:center;padding:40px">Нет доступа</div>';
    return;
  }

  App.setLoading?.(true);

  try {
    // Инициализация состояния
    if (!App.state.suppliesPeriod) App.state.suppliesPeriod = 'month';
    if (!App.state.suppliesStatus) App.state.suppliesStatus = 'all';
    if (!App.state.suppliesSort) App.state.suppliesSort = 'date';

    const [supplies, flowers] = await Promise.all([
      App.repo('supplies').all(),
      App.repo('flowers').all()
    ]);

    const flowersMap = new Map(flowers.map(f => [f.id, f]));
    const range = getDateRange(App.state.suppliesPeriod);

    // Фильтрация по периоду
    let filtered = supplies.filter(s =>
      (s.ts || 0) >= range.from && (s.ts || 0) <= range.to
    );

    // Фильтр по статусу
    if (App.state.suppliesStatus !== 'all') {
      filtered = filtered.filter(s => (s.status || 'received') === App.state.suppliesStatus);
    }

    // Поиск (по товару, поставщику, № накладной)
    const search = (App.getSearch('supplies') || '').toLowerCase();
    if (search) {
      filtered = filtered.filter(s => {
        const fl = flowersMap.get(s.flowerId);
        return (fl && (
          (fl.name || '').toLowerCase().includes(search) ||
          (fl.category || '').toLowerCase().includes(search)
        )) ||
        (s.supplier || '').toLowerCase().includes(search) ||
        (s.invoiceNumber || '').toLowerCase().includes(search);
      });
    }

    // Сортировка
    if (App.state.suppliesSort === 'amount') {
      filtered.sort((a, b) =>
        ((b.quantity || 0) * (b.purchasePrice || 0)) - ((a.quantity || 0) * (a.purchasePrice || 0))
      );
    } else if (App.state.suppliesSort === 'quantity') {
      filtered.sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
    } else {
      filtered.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    }

    const { items: rows, page: p, pages } = App.paginate(filtered, 'supplies');

    // Сводка
    const totalAmount = filtered.reduce((s, x) => s + (x.quantity || 0) * (x.purchasePrice || 0), 0);
    const totalQty = filtered.reduce((s, x) => s + (x.quantity || 0), 0);
    const receivedCount = filtered.filter(s => (s.status || 'received') === 'received').length;
    const orderedCount = filtered.filter(s => s.status === 'ordered').length;

    // Список уникальных поставщиков для фильтра
    const suppliers = [...new Set(supplies.map(s => s.supplier).filter(Boolean))].sort();

    let h = `
      <div class="g">
        <div class="card stat" style="background:linear-gradient(135deg,#dbeafe,#bfdbfe)">
          <div class="big">${App.fmtMoney(totalAmount)}</div>
          <div class="sm">Сумма закупок</div>
        </div>
        <div class="card stat">
          <div class="big">${filtered.length}</div>
          <div class="sm">Всего поставок</div>
        </div>
        <div class="card stat">
          <div class="big">📦 ${totalQty}</div>
          <div class="sm">Единиц получено</div>
        </div>
        <div class="card stat" ${orderedCount > 0 ? 'style="background:linear-gradient(135deg,#fef3c7,#fde68a)"' : ''}>
          <div class="big">🚚 ${orderedCount}</div>
          <div class="sm">Ожидаются</div>
        </div>
      </div>

      <div class="tools">
        <input class="inp search" placeholder="Поиск по товару, поставщику, № накладной..."
               value="${App.esc(App.getSearch('supplies'))}" data-search="supplies">
        <select class="inp" data-filter="status" style="width:auto;min-width:140px">
          <option value="all">Все статусы</option>
          ${SUPPLY_STATUSES.map(s =>
            `<option value="${s.id}" ${App.state.suppliesStatus === s.id ? 'selected' : ''}>${s.icon} ${s.label}</option>`
          ).join('')}
        </select>
        <select class="inp" data-filter="period" style="width:auto;min-width:130px">
          ${SUPPLY_PERIODS.map(p =>
            `<option value="${p.id}" ${App.state.suppliesPeriod === p.id ? 'selected' : ''}>${p.label}</option>`
          ).join('')}
        </select>
        <select class="inp" data-sort="supplies" style="width:auto;min-width:130px">
          <option value="date" ${App.state.suppliesSort === 'date' ? 'selected' : ''}>По дате</option>
          <option value="amount" ${App.state.suppliesSort === 'amount' ? 'selected' : ''}>По сумме</option>
          <option value="quantity" ${App.state.suppliesSort === 'quantity' ? 'selected' : ''}>По кол-ву</option>
        </select>
        <button class="btn" data-action="new">+ Поставка</button>
        <button class="btn s" data-action="newFlower">🌸 Новый товар</button>
        <button class="btn g" data-action="export">📤 CSV</button>
      </div>

      <div class="twrap"><table><thead><tr>
        <th>Дата</th><th>Товар</th><th>Поставщик</th><th>Кол-во</th>
        <th>Цена</th><th>Сумма</th><th>Статус</th><th></th>
      </tr></thead><tbody>
    `;

    if (!rows.length) {
      h += `
        <tr>
          <td colspan="8" style="text-align:center;padding:40px">
            <div style="font-size:48px;margin-bottom:10px">📥</div>
            <div style="color:var(--t3)">Поставки не найдены</div>
            <div class="hint" style="margin-top:8px">
              ${search || App.state.suppliesStatus !== 'all'
                ? 'Попробуйте изменить фильтры'
                : 'Оформите первую поставку, нажав кнопку выше'}
            </div>
          </td>
        </tr>
      `;
    }

    for (const s of rows) {
      const fl = flowersMap.get(s.flowerId);
      const statusInfo = getStatusInfo(s.status || 'received');
      const amount = (s.quantity || 0) * (s.purchasePrice || 0);

      h += `
        <tr>
          <td>
            ${App.fmtDate(s.ts)}
            ${s.invoiceNumber ? `<div class="hint">№ ${App.esc(s.invoiceNumber)}</div>` : ''}
          </td>
          <td>
            ${fl
              ? `<strong>${fl.emoji || '🌸'} ${App.esc(fl.name)}</strong><div class="hint">${App.esc(fl.category || '')}</div>`
              : '<span class="hint">товар удалён</span>'}
          </td>
          <td>${App.esc(s.supplier || '—')}</td>
          <td>${s.quantity || 0}</td>
          <td>${App.fmtMoney(s.purchasePrice || 0)}</td>
          <td><strong>${App.fmtMoney(amount)}</strong></td>
          <td><span class="badge ${statusInfo.badge}">${statusInfo.icon} ${statusInfo.label}</span></td>
          <td style="white-space:nowrap">
            <button class="ab" style="background:#e0e7ff;color:#3730a3" data-action="view" data-id="${s.id}">👁️</button>
            ${(s.status || 'received') !== 'received'
              ? `<button class="ab" style="background:#d1fae5;color:#065f46" data-action="edit" data-id="${s.id}">✏️</button>`
              : `<button class="ab" style="background:#dbeafe;color:#1e40af" data-action="edit" data-id="${s.id}">✏️</button>`}
            <button class="ab" style="background:#fef3c7;color:#92400e" data-action="print" data-id="${s.id}" title="Печать">🖨️</button>
            <button class="ab" style="background:#fee2e2;color:#991b1b" data-action="delete" data-id="${s.id}">🗑️</button>
          </td>
        </tr>
      `;
    }

    h += `</tbody></table></div>` + App.pagHTML(p, pages);

    App.$('#view').innerHTML = h;
    App.setLoading?.(false);

    _attachSuppliesListeners();

  } catch (e) {
    console.error('renderSupplies error:', e);
    App.$('#view').innerHTML = `<div class="card" style="text-align:center;padding:40px;color:var(--bad)">
      Ошибка: ${App.esc(e.message)}
    </div>`;
    App.setLoading?.(false);
  }
};

/* ---------- Event delegation ---------- */
function _attachSuppliesListeners() {
  const view = App.$('#view');
  if (!view || view.dataset.suppliesListeners) return;
  view.dataset.suppliesListeners = '1';

  let searchTimer;
  view.addEventListener('input', (e) => {
    if (e.target.matches('[data-search="supplies"]')) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        App.debouncedSearch('supplies', e.target.value, () => {
          App.state._forceRerender = true;
          App.renderSupplies();
        });
      }, 200);
    }
  });

  view.addEventListener('change', (e) => {
    if (e.target.matches('[data-filter="status"]')) {
      App.state.suppliesStatus = e.target.value;
      App.setPage('supplies', 1);
      App.state._forceRerender = true;
      App.renderSupplies();
    } else if (e.target.matches('[data-filter="period"]')) {
      App.state.suppliesPeriod = e.target.value;
      App.setPage('supplies', 1);
      App.state._forceRerender = true;
      App.renderSupplies();
    } else if (e.target.matches('[data-sort="supplies"]')) {
      App.state.suppliesSort = e.target.value;
      App.state._forceRerender = true;
      App.renderSupplies();
    }
  });

  view.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) {
      const pgBtn = e.target.closest('[data-pg]');
      if (pgBtn) {
        App.setPage('supplies', parseInt(pgBtn.dataset.pg));
        App.state._forceRerender = true;
        App.renderSupplies();
      }
      return;
    }

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    switch (action) {
      case 'new':       App.editSupply(null); break;
      case 'newFlower': _quickNewFlower(); break;
      case 'edit':      App.editSupply(id); break;
      case 'view':      await App.showSupplyDetails(id); break;
      case 'delete':    await App.deleteSupply(id); break;
      case 'print':     await App.printSupply(id); break;
      case 'export':    await App.exportSuppliesCSV(); break;
    }
  });
}

/* ---------- Быстрое создание товара ---------- */
function _quickNewFlower() {
  App.state.page = 'flowers';
  App.state._forceRerender = true;
  App.renderNav();
  App.renderView();
  setTimeout(() => App.editFlower(null), 150);
}

/* ---------- Детальный просмотр поставки ---------- */
App.showSupplyDetails = async function(id) {
  try {
    const s = await App.repo('supplies').byId(id);
    if (!s) {
      App.Toast.er('Поставка не найдена');
      return;
    }

    const fl = await App.repo('flowers').byId(s.flowerId);
    const statusInfo = getStatusInfo(s.status || 'received');
    const amount = (s.quantity || 0) * (s.purchasePrice || 0);

    const h = `
      <div style="padding:10px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px">
          <div>
            <div style="font-size:20px;font-weight:800">📥 Поставка</div>
            <div class="hint">от ${App.fmtDateTime(s.ts)}</div>
          </div>
          <span class="badge ${statusInfo.badge}" style="font-size:14px;padding:6px 14px">
            ${statusInfo.icon} ${statusInfo.label}
          </span>
        </div>

        <div class="card" style="padding:12px;margin-bottom:16px">
          <div class="lbl">Товар</div>
          ${fl
            ? `<div style="font-size:16px;font-weight:600">${fl.emoji || '🌸'} ${App.esc(fl.name)}</div>
               <div class="hint">Категория: ${App.esc(fl.category || '—')}</div>
               <div class="hint">Текущий остаток: <strong>${fl.stock || 0}</strong></div>`
            : '<div class="hint">Товар удалён</div>'}
        </div>

        <div class="g" style="margin-bottom:16px">
          <div class="card" style="padding:12px;margin:0;text-align:center">
            <div class="big" style="font-size:18px">${s.quantity || 0}</div>
            <div class="sm">Количество</div>
          </div>
          <div class="card" style="padding:12px;margin:0;text-align:center">
            <div class="big" style="font-size:18px">${App.fmtMoney(s.purchasePrice || 0)}</div>
            <div class="sm">Цена за шт</div>
          </div>
          <div class="card" style="padding:12px;margin:0;text-align:center">
            <div class="big" style="font-size:18px;color:var(--p)">${App.fmtMoney(amount)}</div>
            <div class="sm">Итого</div>
          </div>
        </div>

        ${s.supplier || s.invoiceNumber ? `
          <div class="card" style="padding:12px;margin-bottom:16px">
            ${s.supplier ? `<div><strong>Поставщик:</strong> ${App.esc(s.supplier)}</div>` : ''}
            ${s.invoiceNumber ? `<div><strong>№ накладной:</strong> ${App.esc(s.invoiceNumber)}</div>` : ''}
          </div>
        ` : ''}

        ${s.comment ? `
          <div class="card" style="padding:12px;margin-bottom:16px">
            <div class="lbl">Комментарий</div>
            <div>${App.esc(s.comment)}</div>
          </div>
        ` : ''}

        <div style="display:flex;gap:8px;margin-top:20px">
          <button class="btn" data-action="edit" data-id="${s.id}">✏️ Редактировать</button>
          <button class="btn g" data-action="print" data-id="${s.id}">🖨️ Печать</button>
          <button class="btn g" id="closeSupplyDetails">Закрыть</button>
        </div>
      </div>
    `;

    App.Modal.open('📥 Детали поставки', h);

    setTimeout(() => {
      document.getElementById('closeSupplyDetails').onclick = () => App.Modal.close();
      App.Modal.body().querySelector('[data-action="edit"]').onclick = () => {
        App.Modal.close();
        App.editSupply(id);
      };
      App.Modal.body().querySelector('[data-action="print"]').onclick = () => {
        App.Modal.close();
        App.printSupply(id);
      };
    }, 50);

  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- Создание/редактирование ---------- */
App._supplyModalOpen = false;

App.editSupply = async function(id) {
  if (!App.Auth.isAdmin()) {
    App.Toast.er('Нет доступа');
    return;
  }

  if (App._supplyModalOpen) {
    App.Toast.wn('Окно уже открыто');
    return;
  }

  App._supplyModalOpen = true;

  try {
    const s = id ? await App.repo('supplies').byId(id) : null;
    const flowers = await App.repo('flowers').all();
    const activeFlowers = flowers.filter(f => f.active !== false);

    // Список поставщиков для автодополнения
    const allSupplies = await App.repo('supplies').all();
    const suppliers = [...new Set(allSupplies.map(x => x.supplier).filter(Boolean))].sort();

    const flowerOpts = activeFlowers.map(f =>
      `<option value="${f.id}" ${s && s.flowerId === f.id ? 'selected' : ''}>
        ${f.emoji || '🌸'} ${App.esc(f.name)} (ост: ${f.stock || 0})
      </option>`
    ).join('');

    const isNew = !s;
    const defaultStatus = isNew ? 'received' : (s.status || 'received');

    const h = `
      <form id="supplyForm">
        <div style="margin-bottom:14px">
          <label class="lbl">Товар *</label>
          <div style="display:flex;gap:8px">
            <select class="inp" name="flowerId" required style="flex:1">
              <option value="">-- выберите товар --</option>
              ${flowerOpts}
            </select>
            <button type="button" class="btn" id="addNewFlowerInSupply">+ Новый</button>
          </div>
          <div id="flowerInfo" style="display:none;margin-top:8px;padding:8px;background:var(--in);border-radius:8px;font-size:12px"></div>
        </div>

        <div id="newFlowerFormSupply" style="display:none;border:2px dashed var(--p);padding:14px;margin-bottom:14px;border-radius:10px;background:rgba(108,92,231,.04)">
          <h4 style="margin-bottom:10px">🌸 Быстрое добавление товара</h4>
          <div class="row">
            <div>
              <label class="lbl">Название *</label>
              <input class="inp" id="newFlName" maxlength="80">
            </div>
            <div>
              <label class="lbl">Категория *</label>
              <select class="inp" id="newFlCat">${App.getCategoryHTML('')}</select>
            </div>
          </div>
          <div class="row" style="margin-top:8px">
            <div>
              <label class="lbl">Эмодзи</label>
              <input class="inp" id="newFlEmoji" value="🌸" maxlength="4">
            </div>
            <div>
              <label class="lbl">Цена продажи (₽)</label>
              <input type="number" class="inp" id="newFlShop" min="0" step="0.01">
            </div>
          </div>
          <div style="margin-top:10px;display:flex;gap:8px">
            <button type="button" class="btn s" id="saveNewFlowerSupply" style="flex:1">💾 Создать товар</button>
            <button type="button" class="btn g" id="cancelNewFlowerSupply">Отмена</button>
          </div>
        </div>

        <div class="row">
          <div>
            <label class="lbl">Количество *</label>
            <input type="number" class="inp" name="quantity" min="1" step="1"
                   value="${s ? s.quantity : ''}" required>
          </div>
          <div>
            <label class="lbl">Цена за шт (₽) *</label>
            <input type="number" class="inp" name="purchasePrice" min="0" step="0.01"
                   value="${s ? s.purchasePrice : ''}" required>
          </div>
        </div>

        <div class="row" style="margin-top:12px">
          <div>
            <label class="lbl">Дата *</label>
            <input type="date" class="inp" name="date"
                   value="${s ? App.toLocalDateString(s.ts) : App.toLocalDateString(new Date())}" required>
          </div>
          <div>
            <label class="lbl">Статус</label>
            <select class="inp" name="status">
              ${SUPPLY_STATUSES.map(st =>
                `<option value="${st.id}" ${defaultStatus === st.id ? 'selected' : ''}>${st.icon} ${st.label}</option>`
              ).join('')}
            </select>
          </div>
        </div>

        <div class="row" style="margin-top:12px">
          <div>
            <label class="lbl">Поставщик</label>
            <input class="inp" name="supplier" list="suppliersList"
                   value="${App.esc(s?.supplier || '')}" placeholder="Название поставщика">
            <datalist id="suppliersList">
              ${suppliers.map(sp => `<option value="${App.esc(sp)}">`).join('')}
            </datalist>
          </div>
          <div>
            <label class="lbl">№ накладной</label>
            <input class="inp" name="invoiceNumber" maxlength="50"
                   value="${App.esc(s?.invoiceNumber || '')}" placeholder="Например: ТН-12345">
          </div>
        </div>

        <div style="margin-top:12px">
          <label class="lbl">Комментарий</label>
          <textarea class="inp" name="comment" rows="2" maxlength="300"
                    placeholder="Условия поставки, примечания...">${App.esc(s?.comment || '')}</textarea>
        </div>

        <div id="supplyTotal" style="margin-top:12px;padding:12px;background:var(--in);border-radius:8px;display:flex;justify-content:space-between;align-items:center">
          <span>Итого:</span>
          <strong style="font-size:18px;color:var(--p)" id="supplyTotalValue">${App.fmtMoney(0)}</strong>
        </div>

        <div id="supplyWarning" style="display:none;margin-top:12px;padding:10px;background:#fef3c7;color:#92400e;border-radius:8px;font-size:13px"></div>

        <label class="chk" style="margin-top:12px">
          <input type="checkbox" name="updatePrice" checked>
          Обновить закупочную цену товара
        </label>

        <div style="display:flex;gap:10px;margin-top:20px">
          <button type="submit" class="btn" style="flex:1">💾 Сохранить</button>
          <button type="button" class="btn g" style="flex:1" id="cancelSupplyBtn">Отмена</button>
        </div>
      </form>
    `;

    App.Modal.open(isNew ? '📥 Новая поставка' : '📥 Редактирование поставки', h);
    App.Modal.onClose(() => {
      App._supplyModalOpen = false;
    });

    _attachSupplyFormListeners(id, s);

  } catch (e) {
    console.error('editSupply error:', e);
    App.Toast.er('Ошибка: ' + e.message);
    App._supplyModalOpen = false;
  }
};

/* ---------- Listeners формы ---------- */
function _attachSupplyFormListeners(id, originalSupply) {
  const form = document.getElementById('supplyForm');
  const flowerSelect = form.querySelector('[name="flowerId"]');
  const quantityInput = form.querySelector('[name="quantity"]');
  const priceInput = form.querySelector('[name="purchasePrice"]');
  const addNewBtn = document.getElementById('addNewFlowerInSupply');
  const newFlowerForm = document.getElementById('newFlowerFormSupply');
  const cancelNewBtn = document.getElementById('cancelNewFlowerSupply');
  const saveNewBtn = document.getElementById('saveNewFlowerSupply');
  const cancelBtn = document.getElementById('cancelSupplyBtn');

  // Обновление итога
  function updateTotal() {
    const qty = parseInt(quantityInput.value) || 0;
    const price = parseFloat(priceInput.value) || 0;
    const totalEl = document.getElementById('supplyTotalValue');
    if (totalEl) totalEl.textContent = App.fmtMoney(qty * price);
  }

  quantityInput.addEventListener('input', updateTotal);
  priceInput.addEventListener('input', updateTotal);
  updateTotal();

  // Показ информации о товаре
  flowerSelect.addEventListener('change', async () => {
    const infoEl = document.getElementById('flowerInfo');
    const warningEl = document.getElementById('supplyWarning');
    const fid = flowerSelect.value;

    if (!fid) {
      infoEl.style.display = 'none';
      return;
    }

    const fl = await App.repo('flowers').byId(fid);
    if (!fl) return;

    // Автозаполнение цены из товара
    if (!priceInput.value && fl.purchasePrice > 0) {
      priceInput.value = fl.purchasePrice;
      updateTotal();
    }

    infoEl.innerHTML = `
      <strong>${fl.emoji || '🌸'} ${App.esc(fl.name)}</strong><br>
      Категория: ${App.esc(fl.category || '—')} •
      Остаток: <strong>${fl.stock || 0}</strong> •
      Закуп: ${App.fmtMoney(fl.purchasePrice || 0)} •
      Продажа: ${App.fmtMoney(fl.shopPrice || 0)}
    `;
    infoEl.style.display = 'block';

    // Предупреждение если цена сильно отличается
    if (fl.purchasePrice > 0 && parseFloat(priceInput.value) > 0) {
      const diff = Math.abs(parseFloat(priceInput.value) - fl.purchasePrice) / fl.purchasePrice;
      if (diff > 0.3) {
        warningEl.style.display = 'block';
        warningEl.textContent = `⚠️ Новая цена отличается от текущей (${App.fmtMoney(fl.purchasePrice)}) более чем на 30%`;
      } else {
        warningEl.style.display = 'none';
      }
    }
  });

  // Быстрое добавление товара
  addNewBtn.onclick = () => {
    newFlowerForm.style.display = 'block';
    addNewBtn.style.display = 'none';
    document.getElementById('newFlName').focus();
  };

  cancelNewBtn.onclick = () => {
    newFlowerForm.style.display = 'none';
    addNewBtn.style.display = 'inline-flex';
  };

  saveNewBtn.onclick = async () => {
    try {
      const name = document.getElementById('newFlName').value.trim();
      const cat = document.getElementById('newFlCat').value;
      const emoji = document.getElementById('newFlEmoji').value.trim() || '🌸';
      const shop = parseFloat(document.getElementById('newFlShop').value) || 0;
      const purch = parseFloat(priceInput.value) || 0;

      if (!name) {
        App.Toast.er('Введите название товара');
        return;
      }

      if (!cat) {
        App.Toast.er('Выберите категорию');
        return;
      }

      // Проверка уникальности
      const allFlowers = await App.repo('flowers').all();
      if (allFlowers.some(f => f.name.toLowerCase() === name.toLowerCase())) {
        App.Toast.er('Товар с таким названием уже существует');
        return;
      }

      const newFlower = {
        id: App.uid(),
        name,
        emoji,
        category: cat,
        purchasePrice: purch,
        shopPrice: shop,
        stock: 0, // Остаток добавится через поставку
        sales: 0,
        writeoffs: 0,
        active: true,
        unit: 'шт',
        expiryDate: null,
        photo: null,
        createdAt: Date.now()
      };

      await App.repo('flowers').save(newFlower);

      if (App.Audit) {
        await App.Audit.log(App.AUDIT_ACTIONS.CREATE,
          { name, fromSupply: true },
          'flowers', newFlower.id);
      }

      App.Toast.ok('Товар создан');

      // Обновляем select
      const updated = await App.repo('flowers').all();
      flowerSelect.innerHTML = `<option value="">-- выберите товар --</option>` +
        updated.filter(f => f.active !== false).map(f =>
          `<option value="${f.id}" ${f.id === newFlower.id ? 'selected' : ''}>
            ${f.emoji || '🌸'} ${App.esc(f.name)} (ост: ${f.stock || 0})
          </option>`
        ).join('');

      cancelNewBtn.click();

      // Показываем инфо
      flowerSelect.dispatchEvent(new Event('change'));
    } catch (e) {
      App.Toast.er('Ошибка: ' + e.message);
    }
  };

  cancelBtn.onclick = () => App.Modal.close();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await _saveSupply(id, originalSupply, form);
  });
}

/* ---------- Сохранение поставки ---------- */
async function _saveSupply(id, originalSupply, form) {
  try {
    const flowerId = form.flowerId.value; // БЕЗ parseInt — ID строковый!
    const quantity = parseInt(form.quantity.value) || 0;
    const purchasePrice = parseFloat(form.purchasePrice.value) || 0;
    const status = form.status.value;
    const supplier = form.supplier.value.trim();
    const invoiceNumber = form.invoiceNumber.value.trim();
    const comment = form.comment.value.trim();
    const updatePrice = form.updatePrice.checked;
    const dateTs = App.parseLocalDate(form.date.value);

    // Валидация
    if (!flowerId) {
      App.Toast.er('Выберите товар');
      return;
    }

    if (quantity <= 0) {
      App.Toast.er('Количество должно быть больше нуля');
      return;
    }

    if (purchasePrice < 0) {
      App.Toast.er('Цена не может быть отрицательной');
      return;
    }

    if (!dateTs) {
      App.Toast.er('Укажите корректную дату');
      return;
    }

    const fl = await App.repo('flowers').byId(flowerId);
    if (!fl) {
      App.Toast.er('Товар не найден');
      return;
    }

    const isNew = !id;

    // Логика изменения остатков
    if (isNew) {
      // Новая поставка: добавляем остаток только если статус "получена"
      if (status === 'received') {
        await App.repo('flowers').update(flowerId, {
          stock: (fl.stock || 0) + quantity,
          ...(updatePrice ? { purchasePrice } : {}),
          updatedAt: Date.now()
        });
        await App.recordStockMovement(flowerId, quantity, `supply:new`);
      }
    } else {
      // Редактирование
      const old = originalSupply;
      const oldStatus = old.status || 'received';

      // Откатываем старое влияние на остаток
      if (oldStatus === 'received') {
        await App.repo('flowers').update(old.flowerId, {
          stock: Math.max(0, (fl.id === old.flowerId ? fl.stock : (await App.repo('flowers').byId(old.flowerId))?.stock || 0) - old.quantity)
        });
        await App.recordStockMovement(old.flowerId, -old.quantity, `supply:edit_revert`);
      }

      // Применяем новое влияние
      if (status === 'received') {
        const currentFl = await App.repo('flowers').byId(flowerId);
        await App.repo('flowers').update(flowerId, {
          stock: (currentFl.stock || 0) + quantity,
          ...(updatePrice ? { purchasePrice } : {}),
          updatedAt: Date.now()
        });
        await App.recordStockMovement(flowerId, quantity, `supply:edit_apply`);
      }
    }

    // Сохраняем историю цен (если цена изменилась)
    if (updatePrice && fl.purchasePrice !== purchasePrice && fl.purchasePrice > 0) {
      const priceHistory = fl.priceHistory || [];
      priceHistory.push({
        price: fl.purchasePrice,
        changedAt: Date.now()
      });
      // Храним последние 10 цен
      if (priceHistory.length > 10) priceHistory.shift();
      await App.repo('flowers').update(flowerId, { priceHistory });
    }

    // Сохраняем поставку
    const supplyData = {
      id: id || App.uid(),
      flowerId,
      quantity,
      purchasePrice,
      status,
      supplier,
      invoiceNumber,
      comment,
      ts: dateTs,
      updatedAt: Date.now()
    };

    if (isNew) {
      supplyData.createdById = App.Auth.user.id;
      supplyData.createdAt = Date.now();
    }

    await App.repo('supplies').save(supplyData);

    if (App.Audit) {
      await App.Audit.log(
        isNew ? App.AUDIT_ACTIONS.CREATE : App.AUDIT_ACTIONS.UPDATE,
        {
          flowerName: fl.name,
          quantity,
          purchasePrice,
          supplier,
          status
        },
        'supplies',
        supplyData.id
      );
    }

    App.Toast.ok(isNew ? 'Поставка создана' : 'Поставка обновлена');
    App.Modal.close();
    App.state._forceRerender = true;
    App.renderSupplies();
    App.Notify?.checkLowStock();

  } catch (e) {
    console.error('saveSupply error:', e);
    App.Toast.er('Ошибка: ' + e.message);
  }
}

/* ---------- Удаление ---------- */
App.deleteSupply = async function(id) {
  if (!App.Auth.isAdmin()) return;

  try {
    const s = await App.repo('supplies').byId(id);
    if (!s) {
      App.Toast.er('Поставка не найдена');
      return;
    }

    const fl = await App.repo('flowers').byId(s.flowerId);
    const status = s.status || 'received';

    // Проверки
    if (fl && status === 'received') {
      // Проверяем что остаток позволяет вычесть
      if ((fl.stock || 0) < s.quantity) {
        const confirmed = await App.Modal.confirm(
          `Текущий остаток (${fl.stock}) меньше количества поставки (${s.quantity}). ` +
          `Возможно, были продажи или списания. Удалить поставку без возврата на склад?`,
          'Предупреждение',
          { danger: true, okText: 'Удалить без возврата' }
        );
        if (!confirmed) return;

        await App.repo('supplies').remove(id);

        if (App.Audit) {
          await App.Audit.log(App.AUDIT_ACTIONS.DELETE, {
            flowerName: fl.name,
            quantity: s.quantity,
            noRestock: true
          }, 'supplies', id);
        }

        App.Toast.ok('Поставка удалена (без возврата)');
        App.state._forceRerender = true;
        App.renderSupplies();
        return;
      }
    }

    const confirmed = await App.Modal.confirm(
      `Удалить поставку "${fl?.name || 'товар'}" (${s.quantity} шт)?${
        status === 'received' ? '\nТовар будет снят со склада.' : ''
      }`,
      'Удаление поставки',
      { danger: true, okText: 'Удалить' }
    );
    if (!confirmed) return;

    // Возврат (снятие) остатка если поставка была получена
    if (fl && status === 'received') {
      await App.repo('flowers').update(fl.id, {
        stock: Math.max(0, (fl.stock || 0) - s.quantity),
        updatedAt: Date.now()
      });
      await App.recordStockMovement(fl.id, -s.quantity, `supply:delete`);
    }

    await App.repo('supplies').remove(id);

    if (App.Audit) {
      await App.Audit.log(App.AUDIT_ACTIONS.DELETE, {
        flowerName: fl?.name,
        quantity: s.quantity
      }, 'supplies', id);
    }

    App.Toast.ok('Поставка удалена');
    App.state._forceRerender = true;
    App.renderSupplies();
    App.Notify?.checkLowStock();
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- Печать накладной ---------- */
App.printSupply = async function(id) {
  try {
    const s = await App.repo('supplies').byId(id);
    if (!s) {
      App.Toast.er('Поставка не найдена');
      return;
    }

    const fl = await App.repo('flowers').byId(s.flowerId);
    const statusInfo = getStatusInfo(s.status || 'received');
    const settings = await App.repo('settings').byId('general') || {};
    const amount = (s.quantity || 0) * (s.purchasePrice || 0);

    const printContainer = App.$('#priceTagPrint');
    if (!printContainer) {
      App.Toast.er('Контейнер печати не найден');
      return;
    }

    printContainer.innerHTML = `
      <div style="font-family:sans-serif;padding:20px;max-width:600px;margin:0 auto">
        <div style="text-align:center;border-bottom:2px solid #6C5CE7;padding-bottom:10px;margin-bottom:20px">
          <h1 style="margin:0;color:#6C5CE7">${settings.receiptLogo || '🌸'} ${App.esc(settings.shopName || 'FLO.RISTA')}</h1>
          <div style="font-size:14px;color:#666">Приходная накладная</div>
          ${s.invoiceNumber ? `<div style="font-size:12px;color:#666">№ ${App.esc(s.invoiceNumber)}</div>` : ''}
        </div>

        <div style="margin-bottom:20px;font-size:14px">
          <p><strong>Дата:</strong> ${App.fmtDateTime(s.ts)}</p>
          ${s.supplier ? `<p><strong>Поставщик:</strong> ${App.esc(s.supplier)}</p>` : ''}
          <p><strong>Статус:</strong> ${statusInfo.label}</p>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <thead>
            <tr style="border-bottom:2px solid #6C5CE7">
              <th style="text-align:left;padding:8px">Товар</th>
              <th style="text-align:right;padding:8px">Кол-во</th>
              <th style="text-align:right;padding:8px">Цена</th>
              <th style="text-align:right;padding:8px">Сумма</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:8px;border-bottom:1px solid #eee">
                ${fl ? `${fl.emoji || '🌸'} ${App.esc(fl.name)}` : '—'}
                ${fl?.category ? `<div style="font-size:11px;color:#666">${App.esc(fl.category)}</div>` : ''}
              </td>
              <td style="padding:8px;text-align:right;border-bottom:1px solid #eee">${s.quantity}</td>
              <td style="padding:8px;text-align:right;border-bottom:1px solid #eee">${App.fmtMoney(s.purchasePrice)}</td>
              <td style="padding:8px;text-align:right;border-bottom:1px solid #eee"><strong>${App.fmtMoney(amount)}</strong></td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding:12px 8px;text-align:right;font-size:16px"><strong>ИТОГО:</strong></td>
              <td style="padding:12px 8px;text-align:right;font-size:18px;color:#6C5CE7"><strong>${App.fmtMoney(amount)}</strong></td>
            </tr>
          </tfoot>
        </table>

        ${s.comment ? `
          <div style="margin-top:16px;padding:10px;background:#f5f5f5;border-radius:6px;font-size:12px">
            <strong>Комментарий:</strong> ${App.esc(s.comment)}
          </div>
        ` : ''}

        <div style="margin-top:40px;display:flex;justify-content:space-between;font-size:12px">
          <div>Принял: _________________</div>
          <div>Поставщик: _________________</div>
        </div>
      </div>
    `;

    window.print();
  } catch (e) {
    App.Toast.er('Ошибка печати: ' + e.message);
  }
};

/* ---------- Экспорт в CSV ---------- */
App.exportSuppliesCSV = async function() {
  try {
    const [supplies, flowers] = await Promise.all([
      App.repo('supplies').all(),
      App.repo('flowers').all()
    ]);

    const flowersMap = new Map(flowers.map(f => [f.id, f]));
    const range = getDateRange(App.state.suppliesPeriod);
    const filtered = supplies.filter(s =>
      (s.ts || 0) >= range.from && (s.ts || 0) <= range.to
    );

    if (!filtered.length) {
      App.Toast.wn('Нет данных для экспорта');
      return;
    }

    const headers = [
      'Дата', '№ накладной', 'Товар', 'Категория', 'Поставщик',
      'Количество', 'Цена', 'Сумма', 'Статус', 'Комментарий'
    ];

    const rows = filtered
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .map(s => {
        const fl = flowersMap.get(s.flowerId);
        const statusInfo = getStatusInfo(s.status || 'received');
        return [
          App.fmtDateTime(s.ts),
          s.invoiceNumber || '',
          fl?.name || '',
          fl?.category || '',
          s.supplier || '',
          s.quantity || 0,
          s.purchasePrice || 0,
          (s.quantity || 0) * (s.purchasePrice || 0),
          statusInfo.label,
          s.comment || ''
        ];
      });

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const periodLabel = SUPPLY_PERIODS.find(p => p.id === App.state.suppliesPeriod)?.label || '';
    a.download = `supplies_${periodLabel}_${App.toLocalDateString(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    App.Toast.ok(`Экспортировано ${filtered.length} поставок`);

    if (App.Audit) {
      await App.Audit.logExport('supplies', filtered.length, { period: periodLabel });
    }
  } catch (e) {
    App.Toast.er('Ошибка экспорта: ' + e.message);
  }
};

console.log('✅ supplies.js загружен');