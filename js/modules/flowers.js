// ===== ТОВАРЫ (ЦВЕТЫ) =====
// js/modules/flowers.js
// v2.0 — с фильтрами, маржой, bulk-операциями, правильным резервом

window.App = window.App || {};

/* ---------- Константы фильтров ---------- */
const FLOWER_FILTERS = [
  { id: 'all',        label: '📦 Все товары' },
  { id: 'inStock',    label: '✅ В наличии' },
  { id: 'lowStock',   label: '⚠️ Заканчиваются' },
  { id: 'outOfStock', label: '❌ Нет в наличии' },
  { id: 'expiring',   label: '⏰ Скоро срок' },
  { id: 'active',     label: '🟢 Активные' },
  { id: 'inactive',   label: '🔴 Неактивные' }
];

const FLOWER_SORT_OPTIONS = [
  { id: 'name',    label: 'По названию',  fn: (a, b) => a.name.localeCompare(b.name) },
  { id: 'stock',   label: 'По остатку',   fn: (a, b) => (b.stock || 0) - (a.stock || 0) },
  { id: 'price',   label: 'По цене',      fn: (a, b) => (b.shopPrice || 0) - (a.shopPrice || 0) },
  { id: 'margin',  label: 'По марже',     fn: (a, b) => _margin(b) - _margin(a) },
  { id: 'created', label: 'Новые',        fn: (a, b) => (b.createdAt || 0) - (a.createdAt || 0) }
];

/* ---------- Утилиты ---------- */
function _margin(f) {
  if (!f.shopPrice || !f.purchasePrice || f.purchasePrice <= 0) return 0;
  return ((f.shopPrice - f.purchasePrice) / f.shopPrice) * 100;
}

function _isExpiringSoon(expiryDate, daysThreshold = 7) {
  if (!expiryDate) return false;
  const exp = new Date(expiryDate);
  if (isNaN(exp.getTime())) return false;
  const now = new Date();
  const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= daysThreshold;
}

function _isExpired(expiryDate) {
  if (!expiryDate) return false;
  const exp = new Date(expiryDate);
  if (isNaN(exp.getTime())) return false;
  return exp.getTime() < Date.now();
}

/* ---------- Основной рендер ---------- */
App.renderFlowers = async function() {
  if (!App.Auth.can('owner', 'admin')) {
    App.$('#view').innerHTML = '<div class="card" style="text-align:center;padding:40px">Нет доступа</div>';
    return;
  }

  App.setLoading?.(true);

  try {
    // Инициализация состояния
    if (!App.state.flowersFilter) App.state.flowersFilter = 'all';
    if (!App.state.flowersCategory) App.state.flowersCategory = 'all';
    if (!App.state.flowersSort) App.state.flowersSort = 'name';

    const flowers = await App.repo('flowers').all();
    const search = (App.getSearch('flowers') || '').toLowerCase();

    // Получаем резервы (async!) для всех товаров одним запросом
    const reservedMap = new Map();
    for (const f of flowers) {
      try {
        const reserved = await App.getReservedQty(f.id);
        reservedMap.set(f.id, reserved);
      } catch {
        reservedMap.set(f.id, 0);
      }
    }

    // Все категории для фильтра
    const allCategories = [...new Set(flowers.map(f => f.category).filter(Boolean))].sort();

    // Фильтрация
    let filtered = flowers;

    // Фильтр по статусу
    switch (App.state.flowersFilter) {
      case 'inStock':
        filtered = filtered.filter(f => f.active !== false && (f.stock || 0) > 0);
        break;
      case 'lowStock':
        filtered = filtered.filter(f => f.active !== false && (f.stock || 0) > 0 && (f.stock || 0) <= 5);
        break;
      case 'outOfStock':
        filtered = filtered.filter(f => f.active !== false && (f.stock || 0) === 0);
        break;
      case 'expiring':
        filtered = filtered.filter(f => f.active !== false && _isExpiringSoon(f.expiryDate));
        break;
      case 'active':
        filtered = filtered.filter(f => f.active !== false);
        break;
      case 'inactive':
        filtered = filtered.filter(f => f.active === false);
        break;
    }

    // Фильтр по категории
    if (App.state.flowersCategory !== 'all') {
      filtered = filtered.filter(f => f.category === App.state.flowersCategory);
    }

    // Поиск
    if (search) {
      filtered = filtered.filter(f =>
        (f.name || '').toLowerCase().includes(search) ||
        (f.category || '').toLowerCase().includes(search) ||
        (f.description || '').toLowerCase().includes(search)
      );
    }

    // Сортировка
    const sortFn = FLOWER_SORT_OPTIONS.find(s => s.id === App.state.flowersSort)?.fn
                || FLOWER_SORT_OPTIONS[0].fn;
    filtered.sort(sortFn);

    const { items: rows, page: p, pages } = App.paginate(filtered, 'flowers');

    // Статистика в шапке
    const totalStock = flowers.reduce((s, f) => s + (f.stock || 0), 0);
    const activeCount = flowers.filter(f => f.active !== false).length;
    const lowStockCount = flowers.filter(f => f.active !== false && (f.stock || 0) > 0 && (f.stock || 0) <= 5).length;
    const outOfStockCount = flowers.filter(f => f.active !== false && (f.stock || 0) === 0).length;
    const expiringCount = flowers.filter(f => f.active !== false && _isExpiringSoon(f.expiryDate)).length;

    let h = `
      <div class="g">
        <div class="card stat">
          <div class="big">🌸 ${flowers.length}</div>
          <div class="sm">Всего товаров (${activeCount} активных)</div>
        </div>
        <div class="card stat">
          <div class="big">📦 ${totalStock}</div>
          <div class="sm">Единиц на складе</div>
        </div>
        <div class="card stat" ${lowStockCount > 0 ? 'style="background:linear-gradient(135deg,#fef3c7,#fde68a)"' : ''}>
          <div class="big">⚠️ ${lowStockCount}</div>
          <div class="sm">Заканчиваются</div>
        </div>
        <div class="card stat" ${expiringCount > 0 ? 'style="background:linear-gradient(135deg,#fee2e2,#fecaca)"' : ''}>
          <div class="big">⏰ ${expiringCount}</div>
          <div class="sm">Скоро срок</div>
        </div>
      </div>

      <div class="tools">
        <input class="inp search" placeholder="Поиск по названию, категории..."
               value="${App.esc(App.getSearch('flowers'))}" data-search="flowers">
        <select class="inp" data-filter="status" style="width:auto;min-width:160px">
          ${FLOWER_FILTERS.map(f =>
            `<option value="${f.id}" ${App.state.flowersFilter === f.id ? 'selected' : ''}>${f.label}</option>`
          ).join('')}
        </select>
        <select class="inp" data-filter="category" style="width:auto;min-width:150px">
          <option value="all">Все категории</option>
          ${allCategories.map(c =>
            `<option value="${App.esc(c)}" ${App.state.flowersCategory === c ? 'selected' : ''}>${App.esc(c)}</option>`
          ).join('')}
        </select>
        <select class="inp" data-sort="flowers" style="width:auto;min-width:130px">
          ${FLOWER_SORT_OPTIONS.map(s =>
            `<option value="${s.id}" ${App.state.flowersSort === s.id ? 'selected' : ''}>${s.label}</option>`
          ).join('')}
        </select>
        <button class="btn" data-action="new">+ Товар</button>
        <button class="btn g" data-action="bulkPrices" title="Массовое изменение цен">💰</button>
        <button class="btn g" data-action="printList">🖨️ Прайс</button>
        <button class="btn g" data-action="export">📤 CSV</button>
      </div>

      <div class="g">
    `;

    if (!rows.length) {
      h += `
        <div style="grid-column:1/-1;text-align:center;padding:40px">
          <div style="font-size:48px;margin-bottom:10px">🌸</div>
          <div style="color:var(--t3)">Товары не найдены</div>
          <div class="hint" style="margin-top:8px">
            ${search || App.state.flowersFilter !== 'all'
              ? 'Попробуйте изменить фильтры'
              : 'Добавьте первый товар, нажав кнопку выше'}
          </div>
        </div>
      `;
    }

    for (const f of rows) {
      const reserved = reservedMap.get(f.id) || 0;
      const available = (f.stock || 0) - reserved;
      const margin = _margin(f);
      const isActive = f.active !== false;
      const isExpiring = _isExpiringSoon(f.expiryDate);
      const isExpired = _isExpired(f.expiryDate);

      let imgHtml;
      if (f.photo) {
        imgHtml = `<img src="${f.photo}" class="photo-thumb" alt="${App.esc(f.name)}" loading="lazy">`;
      } else {
        imgHtml = `<span style="font-size:40px">${App.esc(f.emoji || '🌸')}</span>`;
      }

      // Статус бейджи
      let statusBadges = '';
      if (!isActive) {
        statusBadges += '<span class="badge bmu">неактивен</span>';
      }
      if (isExpired) {
        statusBadges += '<span class="badge bda">просрочен</span>';
      } else if (isExpiring) {
        statusBadges += '<span class="badge bwa">скоро срок</span>';
      }
      if ((f.stock || 0) === 0) {
        statusBadges += '<span class="badge bda">нет в наличии</span>';
      } else if (available <= 0) {
        statusBadges += '<span class="badge bwa">весь в резерве</span>';
      } else if ((f.stock || 0) <= 5) {
        statusBadges += '<span class="badge bwa">заканчивается</span>';
      }

      const marginColor = margin < 0 ? 'var(--bad)'
                        : margin < 30 ? 'var(--warn)'
                        : 'var(--good)';

      h += `
        <div class="card" style="padding:16px;${!isActive ? 'opacity:.6' : ''}">
          <div class="flower-img-wrap">${imgHtml}</div>
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:4px">
            <div style="font-weight:700;font-size:15px">${App.esc(f.name)}</div>
          </div>
          <div class="hint" style="margin-bottom:4px">${App.esc(f.category || '—')}</div>
          ${statusBadges ? `<div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:6px">${statusBadges}</div>` : ''}
          <div class="hint" style="font-size:12px">
            Закуп: <strong>${App.fmtMoney(f.purchasePrice || 0)}</strong> •
            Продажа: <strong>${App.fmtMoney(f.shopPrice || 0)}</strong>
          </div>
          <div class="hint" style="font-size:12px">
            Маржа: <strong style="color:${marginColor}">${margin.toFixed(1)}%</strong>
          </div>
          <div class="hint" style="margin-top:6px">
            В наличии: <strong>${f.stock || 0}</strong> шт
            ${reserved > 0 ? `<span style="color:var(--bad)">(резерв: ${reserved})</span>` : ''}
            ${available < (f.stock || 0) ? ` • Свободно: <strong>${Math.max(0, available)}</strong>` : ''}
          </div>
          ${f.expiryDate ? `<div class="hint" style="font-size:11px;margin-top:4px">📅 Срок: ${App.fmtDate(f.expiryDate)}</div>` : ''}
          <div style="margin-top:10px;display:flex;gap:4px;flex-wrap:wrap">
            <button class="ab" style="background:#d1fae5;color:#065f46" data-action="adjust" data-id="${f.id}" title="Изменить остаток">📊</button>
            <button class="ab" style="background:#dbeafe;color:#1e40af" data-action="edit" data-id="${f.id}">✏️</button>
            <button class="ab" style="background:#e0e7ff;color:#3730a3" data-action="toggle" data-id="${f.id}" title="${isActive ? 'Деактивировать' : 'Активировать'}">${isActive ? '🚫' : '✅'}</button>
            <button class="ab" style="background:#fef3c7;color:#92400e" data-action="print" data-id="${f.id}">🏷️</button>
            <button class="ab" style="background:#fee2e2;color:#991b1b" data-action="delete" data-id="${f.id}">🗑️</button>
          </div>
        </div>
      `;
    }

    h += '</div>' + App.pagHTML(p, pages);

    App.$('#view').innerHTML = h;
    App.setLoading?.(false);

    _attachFlowersListeners();

  } catch (e) {
    console.error('renderFlowers error:', e);
    App.$('#view').innerHTML = `<div class="card" style="text-align:center;padding:40px;color:var(--bad)">
      Ошибка: ${App.esc(e.message)}
    </div>`;
    App.setLoading?.(false);
  }
};

/* ---------- Event delegation ---------- */
function _attachFlowersListeners() {
  const view = App.$('#view');
  if (!view || view.dataset.flowersListeners) return;
  view.dataset.flowersListeners = '1';

  let searchTimer;
  view.addEventListener('input', (e) => {
    if (e.target.matches('[data-search="flowers"]')) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        App.debouncedSearch('flowers', e.target.value, () => {
          App.state._forceRerender = true;
          App.renderFlowers();
        });
      }, 200);
    }
  });

  view.addEventListener('change', (e) => {
    if (e.target.matches('[data-filter="status"]')) {
      App.state.flowersFilter = e.target.value;
      App.setPage('flowers', 1);
      App.state._forceRerender = true;
      App.renderFlowers();
    } else if (e.target.matches('[data-filter="category"]')) {
      App.state.flowersCategory = e.target.value;
      App.setPage('flowers', 1);
      App.state._forceRerender = true;
      App.renderFlowers();
    } else if (e.target.matches('[data-sort="flowers"]')) {
      App.state.flowersSort = e.target.value;
      App.state._forceRerender = true;
      App.renderFlowers();
    }
  });

  view.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      switch (action) {
        case 'new':
          App.editFlower(null);
          break;
        case 'edit':
          App.editFlower(id);
          break;
        case 'delete':
          await App.deleteFlower(id);
          break;
        case 'print':
          await App.printPriceTag(id);
          break;
        case 'toggle':
          await App.toggleFlowerActive(id);
          break;
        case 'adjust':
          await App.adjustStock(id);
          break;
        case 'printList':
          await App.printPriceList();
          break;
        case 'export':
          await App.exportFlowersCSV();
          break;
        case 'bulkPrices':
          await App.bulkUpdatePrices();
          break;
      }
      return;
    }

    const pgBtn = e.target.closest('[data-pg]');
    if (pgBtn) {
      App.setPage('flowers', parseInt(pgBtn.dataset.pg));
      App.state._forceRerender = true;
      App.renderFlowers();
    }
  });
}

/* ---------- Создание/редактирование ---------- */
App._flowerModalOpen = false;

App.editFlower = async function(id) {
  if (!App.Auth.isAdmin()) {
    App.Toast.er('Нет доступа');
    return;
  }

  if (App._flowerModalOpen) {
    App.Toast.wn('Окно уже открыто');
    return;
  }

  App._flowerModalOpen = true;

  try {
    const f = id ? await App.repo('flowers').byId(id) : null;
    const isNew = !f;

    const h = `
      <form id="flowerForm">
        <div class="row">
          <div>
            <label class="lbl">Фото товара</label>
            <input type="file" class="inp" id="flowerPhoto" accept="image/*">
            <div id="photoPreview" style="margin-top:10px">
              ${f && f.photo ? `<img src="${f.photo}" class="photo-preview">` : ''}
            </div>
            <button type="button" class="btn g" id="removePhotoBtn"
                    style="${f && f.photo ? '' : 'display:none'};margin-top:6px">
              Удалить фото
            </button>
          </div>
          <div>
            <label class="lbl">Название *</label>
            <input class="inp" name="name" value="${App.esc(f ? f.name : '')}" required maxlength="80">
            <label class="lbl" style="margin-top:12px">Эмодзи</label>
            <input class="inp" name="emoji" value="${App.esc(f ? f.emoji : '🌸')}" maxlength="4">
          </div>
        </div>

        <div class="row" style="margin-top:12px">
          <div>
            <label class="lbl">Категория *</label>
            <select class="inp" name="category" required>
              ${App.getCategoryHTML(f ? f.category : '')}
            </select>
          </div>
          <div>
            <label class="lbl">Срок годности</label>
            <input type="date" class="inp" name="expiryDate"
                   value="${f && f.expiryDate ? App.toLocalDateString(f.expiryDate) : ''}">
          </div>
        </div>

        <div class="row" style="margin-top:12px">
          <div>
            <label class="lbl">Закупочная цена (₽) *</label>
            <input type="number" class="inp" name="purchasePrice" min="0" step="0.01"
                   value="${f ? f.purchasePrice : 0}" required>
          </div>
          <div>
            <label class="lbl">Цена продажи (₽) *</label>
            <input type="number" class="inp" name="shopPrice" min="0" step="0.01"
                   value="${f ? f.shopPrice : 0}" required>
          </div>
        </div>

        <div class="row" style="margin-top:12px">
          <div>
            <label class="lbl">Остаток (шт) *</label>
            <input type="number" class="inp" name="stock" min="0"
                   value="${f ? f.stock : 0}" required>
            ${!isNew ? `<div class="hint">Сейчас: ${f.stock} шт</div>` : ''}
          </div>
          <div>
            <label class="lbl">Единица измерения</label>
            <select class="inp" name="unit">
              <option value="шт" ${!f || f.unit === 'шт' ? 'selected' : ''}>Штуки</option>
              <option value="уп" ${f && f.unit === 'уп' ? 'selected' : ''}>Упаковки</option>
              <option value="м" ${f && f.unit === 'м' ? 'selected' : ''}>Метры</option>
              <option value="кг" ${f && f.unit === 'кг' ? 'selected' : ''}>Килограммы</option>
            </select>
          </div>
        </div>

        <div style="margin-top:12px">
          <label class="lbl">Описание</label>
          <textarea class="inp" name="description" rows="2" maxlength="500"
                    placeholder="Особенности, уход, рекомендации...">${App.esc(f ? f.description || '' : '')}</textarea>
        </div>

        <label class="chk" style="margin-top:12px">
          <input type="checkbox" name="active" ${!f || f.active !== false ? 'checked' : ''}>
          Товар активен (виден в продаже)
        </label>

        <div id="flowerMargin" style="margin-top:12px;padding:10px;background:var(--in);border-radius:8px;font-size:13px">
          Маржа: <strong id="marginValue">0%</strong>
        </div>

        <div style="display:flex;gap:10px;margin-top:20px">
          <button type="submit" class="btn" style="flex:1">💾 Сохранить</button>
          <button type="button" class="btn g" style="flex:1" id="cancelBtn">Отмена</button>
        </div>
      </form>
    `;

    App.Modal.open(isNew ? 'Новый товар' : 'Редактирование товара', h);
    App.Modal.onClose(() => {
      App._flowerModalOpen = false;
    });

    let photoData = f ? f.photo : null;

    // Обработчики
    const photoInput = document.getElementById('flowerPhoto');
    const removePhotoBtn = document.getElementById('removePhotoBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const form = document.getElementById('flowerForm');
    const purchaseInput = form.querySelector('[name="purchasePrice"]');
    const shopInput = form.querySelector('[name="shopPrice"]');

    if (photoInput) {
      photoInput.addEventListener('change', async function(ev) {
        const file = ev.target.files[0];
        if (!file) return;
        try {
          photoData = await App.processImage(file);
          const preview = document.getElementById('photoPreview');
          if (preview) preview.innerHTML = `<img src="${photoData}" class="photo-preview">`;
          if (removePhotoBtn) removePhotoBtn.style.display = 'inline-flex';
        } catch (e) {
          App.Toast.er(e.message);
          this.value = '';
        }
      });
    }

    if (removePhotoBtn) {
      removePhotoBtn.addEventListener('click', function() {
        photoData = null;
        const preview = document.getElementById('photoPreview');
        if (preview) preview.innerHTML = '';
        if (photoInput) photoInput.value = '';
        this.style.display = 'none';
      });
    }

    // Расчёт маржи в реальном времени
    function updateMargin() {
      const purchase = parseFloat(purchaseInput.value) || 0;
      const shop = parseFloat(shopInput.value) || 0;
      const marginEl = document.getElementById('marginValue');
      if (!marginEl) return;

      if (shop <= 0 || purchase <= 0) {
        marginEl.textContent = '—';
        marginEl.style.color = 'var(--t3)';
        return;
      }

      const margin = ((shop - purchase) / shop) * 100;
      marginEl.textContent = margin.toFixed(1) + '%';
      marginEl.style.color = margin < 0 ? 'var(--bad)'
                          : margin < 30 ? 'var(--warn)'
                          : 'var(--good)';
    }

    if (purchaseInput) purchaseInput.addEventListener('input', updateMargin);
    if (shopInput) shopInput.addEventListener('input', updateMargin);
    updateMargin();

    if (cancelBtn) cancelBtn.onclick = () => App.Modal.close();

    if (form) {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        await _saveFlower(id, form, photoData);
      });
    }

  } catch (e) {
    console.error('editFlower error:', e);
    App.Toast.er('Ошибка: ' + e.message);
    App._flowerModalOpen = false;
  }
};

async function _saveFlower(id, form, photoData) {
  try {
    const data = {
      name: form.name.value.trim(),
      emoji: form.emoji.value.trim() || '🌸',
      category: form.category.value,
      purchasePrice: parseFloat(form.purchasePrice.value) || 0,
      shopPrice: parseFloat(form.shopPrice.value) || 0,
      stock: parseInt(form.stock.value) || 0,
      description: form.description.value.trim(),
      expiryDate: form.expiryDate.value ? new Date(form.expiryDate.value).getTime() : null,
      photo: photoData,
      unit: form.unit.value,
      active: form.active.checked
    };

    if (!data.name || !data.category) {
      App.Toast.er('Заполните обязательные поля');
      return;
    }

    if (data.shopPrice < 0 || data.purchasePrice < 0) {
      App.Toast.er('Цены не могут быть отрицательными');
      return;
    }

    // Проверка уникальности названия
    const allFlowers = await App.repo('flowers').all();
    const duplicate = allFlowers.find(x =>
      x.name.toLowerCase() === data.name.toLowerCase() && x.id !== id
    );
    if (duplicate) {
      App.Toast.er('Товар с таким названием уже существует');
      return;
    }

    // Проверка резерва при уменьшении остатка
    if (id) {
      const reserved = await App.getReservedQty(id);
      if (data.stock < reserved) {
        App.Toast.er(`Остаток не может быть меньше зарезервированного (${reserved} шт)`);
        return;
      }
    }

    const isNew = !id;

    if (isNew) {
      const newId = App.uid();
      await App.repo('flowers').save({
        id: newId,
        ...data,
        sales: 0,
        writeoffs: 0,
        createdAt: Date.now()
      });

      if (data.stock > 0) {
        await App.recordStockMovement(newId, data.stock, 'initial_stock');
      }
    } else {
      const existing = await App.repo('flowers').byId(id);
      if (!existing) {
        App.Toast.er('Товар не найден');
        return;
      }

      const oldStock = existing.stock || 0;
      const stockDiff = data.stock - oldStock;

      await App.repo('flowers').save({
        ...existing,
        ...data,
        updatedAt: Date.now()
      });

      if (stockDiff !== 0) {
        await App.recordStockMovement(id, stockDiff, 'manual_adjustment');
      }
    }

    if (App.Audit) {
      await App.Audit.log(
        isNew ? App.AUDIT_ACTIONS.CREATE : App.AUDIT_ACTIONS.UPDATE,
        { name: data.name, price: data.shopPrice, stock: data.stock },
        'flowers',
        id || data.name
      );
    }

    App.Toast.ok(isNew ? 'Товар создан' : 'Товар обновлён');
    App.Modal.close();
    App.rerender();

    // Обновляем уведомления о низких остатках
    App.Notify?.checkLowStock();

  } catch (e) {
    console.error('saveFlower error:', e);
    App.Toast.er('Ошибка: ' + e.message);
  }
}

/* ---------- Быстрая корректировка остатка ---------- */
App.adjustStock = async function(id) {
  try {
    const f = await App.repo('flowers').byId(id);
    if (!f) {
      App.Toast.er('Товар не найден');
      return;
    }

    const h = `
      <div style="padding:10px">
        <div style="text-align:center;margin-bottom:16px">
          <div style="font-size:40px">${f.emoji || '🌸'}</div>
          <div style="font-weight:700;font-size:16px;margin-top:6px">${App.esc(f.name)}</div>
          <div class="hint">Текущий остаток: <strong>${f.stock} шт</strong></div>
        </div>

        <div class="row">
          <div>
            <label class="lbl">Операция</label>
            <select class="inp" id="adjOperation">
              <option value="add">➕ Приход</option>
              <option value="remove">➖ Расход</option>
              <option value="set">📝 Установить</option>
            </select>
          </div>
          <div>
            <label class="lbl">Количество</label>
            <input type="number" class="inp" id="adjQuantity" min="1" value="1" autofocus>
          </div>
        </div>

        <div style="margin-top:12px">
          <label class="lbl">Причина</label>
          <select class="inp" id="adjReason">
            <option value="purchase">Закупка</option>
            <option value="return">Возврат от клиента</option>
            <option value="writeoff">Списание</option>
            <option value="inventory">Инвентаризация</option>
            <option value="gift">Подарок/бонус</option>
            <option value="other">Прочее</option>
          </select>
        </div>

        <div style="margin-top:12px">
          <label class="lbl">Комментарий</label>
          <input class="inp" id="adjComment" placeholder="Необязательно">
        </div>

        <div style="display:flex;gap:10px;margin-top:20px">
          <button class="btn" style="flex:1" id="adjSave">💾 Применить</button>
          <button class="btn g" style="flex:1" id="adjCancel">Отмена</button>
        </div>
      </div>
    `;

    App.Modal.open('📊 Корректировка остатка', h);

    setTimeout(() => {
      document.getElementById('adjSave').onclick = async () => {
        const op = document.getElementById('adjOperation').value;
        const qty = parseInt(document.getElementById('adjQuantity').value) || 0;
        const reason = document.getElementById('adjReason').value;
        const comment = document.getElementById('adjComment').value.trim();

        if (qty <= 0) {
          App.Toast.er('Количество должно быть больше нуля');
          return;
        }

        let newStock = f.stock;
        let delta = 0;

        switch (op) {
          case 'add':
            newStock = f.stock + qty;
            delta = qty;
            break;
          case 'remove':
            if (qty > f.stock) {
              App.Toast.er(`Нельзя списать больше чем есть (${f.stock} шт)`);
              return;
            }
            newStock = f.stock - qty;
            delta = -qty;
            break;
          case 'set':
            newStock = qty;
            delta = qty - f.stock;
            break;
        }

        // Проверка резерва
        const reserved = await App.getReservedQty(id);
        if (newStock < reserved) {
          App.Toast.er(`Остаток (${newStock}) меньше резерва (${reserved})`);
          return;
        }

        await App.repo('flowers').update(id, {
          stock: newStock,
          updatedAt: Date.now()
        });

        await App.recordStockMovement(id, delta, `${reason}: ${comment}`);

        if (App.Audit) {
          await App.Audit.log(App.AUDIT_ACTIONS.UPDATE, {
            name: f.name,
            operation: op,
            quantity: qty,
            oldStock: f.stock,
            newStock,
            reason,
            comment
          }, 'flowers', id);
        }

        App.Toast.ok(`Остаток изменён: ${f.stock} → ${newStock}`);
        App.Modal.close();
        App.rerender();
      };

      document.getElementById('adjCancel').onclick = () => App.Modal.close();
    }, 50);

  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- Переключение активности ---------- */
App.toggleFlowerActive = async function(id) {
  try {
    const f = await App.repo('flowers').byId(id);
    if (!f) return;

    const newActive = f.active === false;
    await App.repo('flowers').update(id, {
      active: newActive,
      updatedAt: Date.now()
    });

    if (App.Audit) {
      await App.Audit.log(App.AUDIT_ACTIONS.UPDATE,
        { name: f.name, active: newActive },
        'flowers', id);
    }

    App.Toast.ok(newActive ? 'Товар активирован' : 'Товар деактивирован');
    App.rerender();
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- Удаление ---------- */
App.deleteFlower = async function(id) {
  if (!App.Auth.isAdmin()) {
    App.Toast.er('Только администратор может удалять товары');
    return;
  }

  try {
    const f = await App.repo('flowers').byId(id);
    if (!f) return;

    // Проверка использования в заказах
    const orders = await App.repo('orders').all();
    const usedInOrders = orders.some(o =>
      (o.items || []).some(it =>
        it.flowerId === id ||
        (it.components || []).some(c => c.flowerId === id)
      )
    );
    if (usedInOrders) {
      App.Toast.er('Товар используется в заказах. Сначала деактивируйте его.');
      return;
    }

    // Проверка использования в букетах
    const bouquets = await App.repo('bouquets').all();
    const inBouquets = bouquets.filter(b =>
      (b.components || []).some(c => c.flowerId === id)
    );
    if (inBouquets.length) {
      App.Toast.er(`Товар входит в ${inBouquets.length} букетов. Удалите его из них сначала.`);
      return;
    }

    // Проверка в поставках
    const supplies = await App.repo('supplies').all();
    if (supplies.some(s => s.flowerId === id)) {
      App.Toast.er('Товар используется в поставках');
      return;
    }

    // Проверка в списаниях
    const writeoffs = await App.repo('writeoffs').all();
    if (writeoffs.some(w => w.flowerId === id)) {
      App.Toast.er('Товар используется в списаниях');
      return;
    }

    // Проверка в возвратах
    const returns = await App.repo('returns').all();
    if (returns.some(r =>
      (r.items || []).some(it =>
        it.flowerId === id ||
        (it.components || []).some(c => c.flowerId === id)
      )
    )) {
      App.Toast.er('Товар используется в возвратах');
      return;
    }

    const confirmed = await App.Modal.confirm(
      `Удалить товар "${f.name}"? Это действие необратимо.`,
      'Удаление товара',
      { danger: true, okText: 'Удалить' }
    );

    if (!confirmed) return;

    await App.repo('flowers').remove(id);

    if (App.Audit) {
      await App.Audit.log(App.AUDIT_ACTIONS.DELETE,
        { name: f.name, stock: f.stock },
        'flowers', id);
    }

    App.Toast.ok('Товар удалён');
    App.rerender();
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- Печать ценника ---------- */
App.printPriceTag = async function(id) {
  try {
    const f = await App.repo('flowers').byId(id);
    if (!f) {
      App.Toast.er('Товар не найден');
      return;
    }

    let qrImg = '';
    if (typeof qrcode !== 'undefined') {
      try {
        const qr = qrcode(4, 'M');
        qr.addData(`${f.name}\n${App.fmtMoney(f.shopPrice)}`);
        qr.make();
        qrImg = qr.createDataURL(4);
      } catch (e) {
        console.warn('QR generation error:', e);
      }
    }

    const printContainer = App.$('#priceTagPrint');
    if (!printContainer) {
      App.Toast.er('Контейнер печати не найден');
      return;
    }

    printContainer.innerHTML = `
      <div class="price-tag">
        <div style="font-size:32px;margin-bottom:8px">${f.emoji || '🌸'}</div>
        <div class="pname">${App.esc(f.name)}</div>
        <div style="font-size:12px;color:#666;margin-bottom:12px">${App.esc(f.category || '')}</div>
        <div class="pprice">${App.fmtMoney(f.shopPrice)}</div>
        ${qrImg ? `<div class="qr"><img src="${qrImg}" alt="QR"></div>` : ''}
        ${f.description ? `<div style="font-size:11px;color:#666;margin-top:10px">${App.esc(f.description.slice(0, 80))}</div>` : ''}
      </div>
    `;

    window.print();
  } catch (e) {
    App.Toast.er('Ошибка печати: ' + e.message);
  }
};

/* ---------- Печать прайс-листа ---------- */
App.printPriceList = async function() {
  try {
    const flowers = await App.repo('flowers').all();
    const activeFlowers = flowers.filter(f => f.active !== false);

    if (!activeFlowers.length) {
      App.Toast.er('Нет активных товаров');
      return;
    }

    // Группируем по категориям
    const byCategory = {};
    for (const f of activeFlowers) {
      const cat = f.category || 'Прочее';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(f);
    }

    const printContainer = App.$('#priceTagPrint');
    if (!printContainer) {
      App.Toast.er('Контейнер печати не найден');
      return;
    }

    let html = `
      <div style="font-family:sans-serif;padding:20px">
        <h1 style="text-align:center;color:#6C5CE7">Прайс-лист</h1>
        <p style="text-align:center;color:#666">FLO.RISTA • ${App.fmtDate(new Date())}</p>
        <hr style="border:1px solid #6C5CE7;margin:20px 0">
    `;

    for (const [cat, items] of Object.entries(byCategory).sort()) {
      html += `<h2 style="color:#6C5CE7;margin-top:20px">${App.esc(cat)}</h2>`;
      html += `<table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead>
          <tr style="background:#f0f0f0">
            <th style="padding:8px;text-align:left;border-bottom:2px solid #6C5CE7">Товар</th>
            <th style="padding:8px;text-align:right;border-bottom:2px solid #6C5CE7">Цена</th>
          </tr>
        </thead>
        <tbody>`;

      for (const f of items.sort((a, b) => a.name.localeCompare(b.name))) {
        html += `
          <tr>
            <td style="padding:6px 8px;border-bottom:1px solid #eee">
              ${f.emoji || '🌸'} ${App.esc(f.name)}
              ${f.description ? `<div style="font-size:11px;color:#666">${App.esc(f.description.slice(0, 50))}</div>` : ''}
            </td>
            <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #eee;font-weight:bold">
              ${App.fmtMoney(f.shopPrice)}
            </td>
          </tr>
        `;
      }

      html += '</tbody></table>';
    }

    html += '</div>';
    printContainer.innerHTML = html;
    window.print();
  } catch (e) {
    App.Toast.er('Ошибка печати: ' + e.message);
  }
};

/* ---------- Массовое изменение цен ---------- */
App.bulkUpdatePrices = async function() {
  try {
    const flowers = await App.repo('flowers').all();
    const activeFlowers = flowers.filter(f => f.active !== false);

    const h = `
      <div style="padding:10px">
        <p class="hint" style="margin-bottom:16px">
          Массовое изменение цен для ${activeFlowers.length} активных товаров
        </p>

        <div class="row">
          <div>
            <label class="lbl">Операция</label>
            <select class="inp" id="bulkOperation">
              <option value="percent_add">➕ Наценка %</option>
              <option value="percent_sub">➖ Скидка %</option>
              <option value="fixed_add">➕ Добавить ₽</option>
              <option value="fixed_sub">➖ Вычесть ₽</option>
              <option value="margin">📊 Установить маржу %</option>
            </select>
          </div>
          <div>
            <label class="lbl">Значение</label>
            <input type="number" class="inp" id="bulkValue" min="0" step="0.1" value="10">
          </div>
        </div>

        <div style="margin-top:12px">
          <label class="lbl">Применить к категории</label>
          <select class="inp" id="bulkCategory">
            <option value="all">Все категории</option>
            ${[...new Set(activeFlowers.map(f => f.category).filter(Boolean))].sort().map(c =>
              `<option value="${App.esc(c)}">${App.esc(c)}</option>`
            ).join('')}
          </select>
        </div>

        <div id="bulkPreview" style="margin-top:16px;padding:12px;background:var(--in);border-radius:8px;max-height:200px;overflow-y:auto">
          <div class="hint">Предварительный просмотр появится после выбора параметров</div>
        </div>

        <div style="display:flex;gap:10px;margin-top:20px">
          <button class="btn" style="flex:1" id="bulkApply">💾 Применить</button>
          <button class="btn g" style="flex:1" id="bulkCancel">Отмена</button>
        </div>
      </div>
    `;

    App.Modal.open('💰 Массовое изменение цен', h);

    setTimeout(() => {
      const opSelect = document.getElementById('bulkOperation');
      const valueInput = document.getElementById('bulkValue');
      const catSelect = document.getElementById('bulkCategory');
      const preview = document.getElementById('bulkPreview');

      function updatePreview() {
        const op = opSelect.value;
        const value = parseFloat(valueInput.value) || 0;
        const cat = catSelect.value;

        let items = activeFlowers;
        if (cat !== 'all') {
          items = items.filter(f => f.category === cat);
        }

        if (items.length === 0) {
          preview.innerHTML = '<div class="hint">Нет товаров для изменения</div>';
          return;
        }

        let html = '<div style="font-size:12px">';
        let changedCount = 0;

        for (const f of items.slice(0, 20)) {
          let newPrice = f.shopPrice;

          switch (op) {
            case 'percent_add': newPrice = f.shopPrice * (1 + value / 100); break;
            case 'percent_sub': newPrice = f.shopPrice * (1 - value / 100); break;
            case 'fixed_add':   newPrice = f.shopPrice + value; break;
            case 'fixed_sub':   newPrice = Math.max(0, f.shopPrice - value); break;
            case 'margin':
              if (f.purchasePrice > 0) {
                newPrice = f.purchasePrice / (1 - value / 100);
              }
              break;
          }

          newPrice = Math.round(newPrice * 100) / 100;

          if (newPrice !== f.shopPrice) {
            changedCount++;
            html += `<div style="padding:4px 0;border-bottom:1px solid var(--b)">
              ${f.emoji || '🌸'} ${App.esc(f.name)}:
              <strong>${App.fmtMoney(f.shopPrice)}</strong> →
              <strong style="color:var(--p)">${App.fmtMoney(newPrice)}</strong>
            </div>`;
          }
        }

        if (items.length > 20) {
          html += `<div class="hint" style="margin-top:6px">... и ещё ${items.length - 20} товаров</div>`;
        }

        html += `<div style="margin-top:8px;font-weight:600">Изменится: ${changedCount} из ${items.length}</div>`;
        html += '</div>';
        preview.innerHTML = html;
      }

      opSelect.addEventListener('change', updatePreview);
      valueInput.addEventListener('input', updatePreview);
      catSelect.addEventListener('change', updatePreview);
      updatePreview();

      document.getElementById('bulkApply').onclick = async () => {
        const op = opSelect.value;
        const value = parseFloat(valueInput.value) || 0;
        const cat = catSelect.value;

        let items = activeFlowers;
        if (cat !== 'all') {
          items = items.filter(f => f.category === cat);
        }

        const confirmed = await App.Modal.confirm(
          `Изменить цены для ${items.length} товаров?`
        );
        if (!confirmed) return;

        let updated = 0;
        for (const f of items) {
          let newPrice = f.shopPrice;

          switch (op) {
            case 'percent_add': newPrice = f.shopPrice * (1 + value / 100); break;
            case 'percent_sub': newPrice = f.shopPrice * (1 - value / 100); break;
            case 'fixed_add':   newPrice = f.shopPrice + value; break;
            case 'fixed_sub':   newPrice = Math.max(0, f.shopPrice - value); break;
            case 'margin':
              if (f.purchasePrice > 0) {
                newPrice = f.purchasePrice / (1 - value / 100);
              }
              break;
          }

          newPrice = Math.round(newPrice * 100) / 100;

          if (newPrice !== f.shopPrice && newPrice >= 0) {
            await App.repo('flowers').update(f.id, {
              shopPrice: newPrice,
              updatedAt: Date.now()
            });
            updated++;
          }
        }

        if (App.Audit) {
          await App.Audit.log(App.AUDIT_ACTIONS.BULK_UPDATE, {
            operation: op,
            value,
            category: cat,
            updatedCount: updated
          }, 'flowers');
        }

        App.Toast.ok(`Изменено ${updated} товаров`);
        App.Modal.close();
        App.rerender();
      };

      document.getElementById('bulkCancel').onclick = () => App.Modal.close();
    }, 50);

  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- Экспорт в CSV ---------- */
App.exportFlowersCSV = async function() {
  try {
    const flowers = await App.repo('flowers').all();

    const headers = [
      'Название', 'Эмодзи', 'Категория', 'Закупочная цена',
      'Цена продажи', 'Маржа %', 'Остаток', 'Единица',
      'Срок годности', 'Описание', 'Активен'
    ];

    const rows = flowers.map(f => [
      f.name,
      f.emoji || '',
      f.category || '',
      f.purchasePrice || 0,
      f.shopPrice || 0,
      _margin(f).toFixed(1),
      f.stock || 0,
      f.unit || 'шт',
      f.expiryDate ? App.fmtDate(f.expiryDate) : '',
      f.description || '',
      f.active !== false ? 'Да' : 'Нет'
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowers_${App.toLocalDateString(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    App.Toast.ok(`Экспортировано ${flowers.length} товаров`);

    if (App.Audit) {
      await App.Audit.logExport('flowers', flowers.length);
    }
  } catch (e) {
    App.Toast.er('Ошибка экспорта: ' + e.message);
  }
};

console.log('✅ flowers.js загружен');