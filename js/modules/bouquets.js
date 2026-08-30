// ===== БУКЕТЫ =====
// js/modules/bouquets.js
// v2.0 — с маржой, тегами, дублированием, правильной резервацией

window.App = window.App || {};

/* ---------- Константы ---------- */
const BOUQUET_TAGS = [
  { id: 'wedding',   label: '💒 Свадебный',    color: '#fce7f3' },
  { id: 'funeral',   label: '🕊️ Траурный',     color: '#e5e7eb' },
  { id: 'birthday',  label: '🎂 День рождения', color: '#fef3c7' },
  { id: 'corporate', label: '🏢 Корпоративный', color: '#dbeafe' },
  { id: 'romantic',  label: '❤️ Романтичный',   color: '#fee2e2' },
  { id: 'seasonal',  label: '🌸 Сезонный',      color: '#d1fae5' }
];

const COMPLEXITY = [
  { id: 1, label: '⭐ Простой',   time: '5-10 мин' },
  { id: 2, label: '⭐⭐ Средний',  time: '15-20 мин' },
  { id: 3, label: '⭐⭐⭐ Сложный', time: '30+ мин' }
];

/* ---------- Вспомогательные функции ---------- */
function buildFlowersMap(flowers) {
  const map = new Map();
  for (const f of flowers) {
    map.set(f.id, f);
  }
  return map;
}

function computeBouquetCost(bouquet, flowersMap) {
  return (bouquet.components || []).reduce((sum, c) => {
    const f = flowersMap.get(c.flowerId);
    return sum + (f ? (f.purchasePrice || 0) * c.quantity : 0);
  }, 0);
}

function computeBouquetMargin(shopPrice, cost) {
  if (!shopPrice || shopPrice <= 0) return 0;
  if (cost <= 0) return 100;
  return ((shopPrice - cost) / shopPrice) * 100;
}

async function checkComponentsAvailability(bouquet, flowersMap) {
  const components = bouquet.components || [];
  const result = {
    allAvailable: true,
    unavailable: [],
    lowStock: []
  };

  for (const c of components) {
    const f = flowersMap.get(c.flowerId);
    if (!f || f.active === false) {
      result.allAvailable = false;
      result.unavailable.push({ flowerId: c.flowerId, reason: 'не найден' });
      continue;
    }

    const reserved = await App.getReservedQty(c.flowerId);
    const available = (f.stock || 0) - reserved;

    if (available < c.quantity) {
      result.allAvailable = false;
      result.unavailable.push({
        flowerId: c.flowerId,
        flowerName: f.name,
        needed: c.quantity,
        available: Math.max(0, available)
      });
    } else if (available - c.quantity <= 2) {
      result.lowStock.push({
        flowerId: c.flowerId,
        flowerName: f.name,
        remaining: available - c.quantity
      });
    }
  }

  return result;
}

/* ---------- Основной рендер ---------- */
App.renderBouquets = async function() {
  if (!App.Auth.can('owner', 'admin')) {
    App.$('#view').innerHTML = '<div class="card" style="text-align:center;padding:40px">Нет доступа</div>';
    return;
  }

  App.setLoading?.(true);

  try {
    const [bouquets, flowers] = await Promise.all([
      App.repo('bouquets').all(),
      App.repo('flowers').all()
    ]);

    const flowersMap = buildFlowersMap(flowers);
    const search = (App.getSearch('bouquets') || '').toLowerCase();
    const tagFilter = App.state.bouquetTagFilter || 'all';
    const showActiveOnly = App.state.bouquetActiveOnly !== false;

    let filtered = bouquets;

    // Фильтр по активности
    if (showActiveOnly) {
      filtered = filtered.filter(b => b.active !== false);
    }

    // Фильтр по тегам
    if (tagFilter !== 'all') {
      filtered = filtered.filter(b => (b.tags || []).includes(tagFilter));
    }

    // Поиск
    if (search) {
      filtered = filtered.filter(b => {
        if (b.name.toLowerCase().includes(search)) return true;
        if ((b.description || '').toLowerCase().includes(search)) return true;
        // Поиск по компонентам
        return (b.components || []).some(c => {
          const f = flowersMap.get(c.flowerId);
          return f && f.name.toLowerCase().includes(search);
        });
      });
    }

    // Сортировка
    filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const { items: rows, page: p, pages } = App.paginate(filtered, 'bouquets');

    // Предварительный расчёт себестоимости и доступности
    const bouquetData = await Promise.all(rows.map(async (b) => {
      const cost = computeBouquetCost(b, flowersMap);
      const margin = computeBouquetMargin(b.shopPrice, cost);
      const availability = await checkComponentsAvailability(b, flowersMap);

      const componentsText = (b.components || []).map(c => {
        const f = flowersMap.get(c.flowerId);
        return f ? `${f.emoji || '🌸'} ${f.name}×${c.quantity}` : '❓';
      }).join(', ');

      return { b, cost, margin, availability, componentsText };
    }));

    let h = `
      <div class="tools">
        <input class="inp search" placeholder="Поиск по названию или составу..."
               value="${App.esc(App.getSearch('bouquets'))}" data-search="bouquets">
        <select class="inp" id="tagFilter" style="width:auto;min-width:150px">
          <option value="all">Все теги</option>
          ${BOUQUET_TAGS.map(t =>
            `<option value="${t.id}" ${tagFilter === t.id ? 'selected' : ''}>${t.label}</option>`
          ).join('')}
        </select>
        <label class="chk" style="margin:0">
          <input type="checkbox" id="activeOnly" ${showActiveOnly ? 'checked' : ''}> Только активные
        </label>
        <button class="btn" data-action="new">+ Букет</button>
        <button class="btn g" data-action="export">📤 CSV</button>
      </div>
      <div class="g">
    `;

    if (!bouquetData.length) {
      h += `
        <div style="grid-column:1/-1;text-align:center;padding:40px">
          <div style="font-size:48px;margin-bottom:10px">💐</div>
          <div style="color:var(--t3);font-size:16px">Букеты не найдены</div>
          <div class="hint" style="margin-top:8px">Создайте первый букет, нажав кнопку выше</div>
        </div>
      `;
    }

    for (const { b, cost, margin, availability, componentsText } of bouquetData) {
      const isActive = b.active !== false;
      const canAssemble = availability.allAvailable;
      const isUnprofitable = margin < 0;
      const lowMargin = margin >= 0 && margin < 20;

      let statusBadge = '';
      if (!isActive) {
        statusBadge = '<span class="badge bmu">неактивен</span>';
      } else if (isUnprofitable) {
        statusBadge = '<span class="badge bda">⚠️ убыточный</span>';
      } else if (!canAssemble) {
        statusBadge = `<span class="badge bwa">нет компонентов (${availability.unavailable.length})</span>`;
      } else {
        statusBadge = '<span class="badge bok">✓ в наличии</span>';
      }

      const marginColor = isUnprofitable ? 'var(--bad)'
                        : lowMargin ? 'var(--warn)'
                        : 'var(--good)';

      const tags = (b.tags || []).map(t => {
        const tagInfo = BOUQUET_TAGS.find(x => x.id === t);
        return tagInfo
          ? `<span class="badge" style="background:${tagInfo.color};color:#1f1f1f;font-size:10px">${tagInfo.label}</span>`
          : '';
      }).join(' ');

      const complexityLabel = COMPLEXITY.find(c => c.id === b.complexity)?.label || '';

      h += `
        <div class="card" style="padding:16px;${!isActive ? 'opacity:.6' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
            <div style="font-size:40px">${App.esc(b.emoji || '💐')}</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">${statusBadge}</div>
          </div>
          <div style="font-weight:700;font-size:15px;margin-bottom:4px">${App.esc(b.name)}</div>
          ${b.description ? `<div class="hint" style="margin-bottom:6px">${App.esc(b.description).slice(0, 80)}${b.description.length > 80 ? '...' : ''}</div>` : ''}
          <div style="margin-bottom:6px">${tags}</div>
          ${complexityLabel ? `<div class="hint">Сложность: ${complexityLabel}</div>` : ''}
          <div class="hint" style="margin-top:6px;line-height:1.5">${App.esc(componentsText)}</div>
          <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--b);display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
            <div>💰 Цена: <strong>${App.fmtMoney(b.shopPrice)}</strong></div>
            <div>📦 Себест: <strong>${App.fmtMoney(cost)}</strong></div>
            <div style="grid-column:1/-1">📊 Маржа: <strong style="color:${marginColor}">${margin.toFixed(1)}%</strong></div>
          </div>
          ${availability.lowStock.length > 0
            ? `<div class="hint" style="margin-top:6px;color:var(--warn)">⚠️ После сборки останется мало: ${availability.lowStock.map(l => l.flowerName).join(', ')}</div>`
            : ''}
          <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
            <button class="ab" style="background:#dbeafe;color:#1e40af" data-action="edit" data-id="${b.id}">✏️</button>
            <button class="ab" style="background:#fef3c7;color:#92400e" data-action="duplicate" data-id="${b.id}" title="Дублировать">📋</button>
            <button class="ab" style="background:#e8daef;color:#6c3483" data-action="toggle" data-id="${b.id}" title="${isActive ? 'Деактивировать' : 'Активировать'}">${isActive ? '🚫' : '✅'}</button>
            <button class="ab" style="background:#fee2e2;color:#991b1b" data-action="delete" data-id="${b.id}">🗑️</button>
          </div>
        </div>
      `;
    }

    h += '</div>' + App.pagHTML(p, pages);
    App.$('#view').innerHTML = h;

    App.setLoading?.(false);

    // Event delegation
    App._attachBouquetsListeners();

  } catch (e) {
    console.error('renderBouquets error:', e);
    App.$('#view').innerHTML = `<div class="card" style="text-align:center;padding:40px;color:var(--bad)">
      Ошибка загрузки: ${App.esc(e.message)}
    </div>`;
    App.setLoading?.(false);
  }
};

/* ---------- Event delegation (один раз) ---------- */
App._attachBouquetsListeners = function() {
  const view = App.$('#view');
  if (!view || view.dataset.bouquetsListeners) return;
  view.dataset.bouquetsListeners = '1';

  // Поиск с debounce
  let searchTimer;
  view.addEventListener('input', (e) => {
    if (e.target.matches('[data-search="bouquets"]')) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        App.debouncedSearch('bouquets', e.target.value, () => {
          App.state._forceRerender = true;
          App.renderBouquets();
        });
      }, 200);
    }
  });

  // Клик по кнопкам
  view.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    switch (action) {
      case 'new':
        App.editBouquet(null);
        break;
      case 'edit':
        App.editBouquet(id);
        break;
      case 'duplicate':
        await App.duplicateBouquet(id);
        break;
      case 'toggle':
        await App.toggleBouquetActive(id);
        break;
      case 'delete':
        await App.deleteBouquet(id);
        break;
      case 'export':
        await App.exportBouquetsCSV();
        break;
    }
  });

  // Фильтр по тегам
  view.addEventListener('change', (e) => {
    if (e.target.id === 'tagFilter') {
      App.state.bouquetTagFilter = e.target.value;
      App.state._forceRerender = true;
      App.renderBouquets();
    } else if (e.target.id === 'activeOnly') {
      App.state.bouquetActiveOnly = e.target.checked;
      App.state._forceRerender = true;
      App.renderBouquets();
    }
  });

  // Пагинация
  view.addEventListener('click', (e) => {
    const pgBtn = e.target.closest('[data-pg]');
    if (pgBtn) {
      App.setPage('bouquets', parseInt(pgBtn.dataset.pg));
      App.state._forceRerender = true;
      App.renderBouquets();
    }
  });
};

/* ---------- Редактирование букета ---------- */
App._bouquetModalOpen = false;

App.editBouquet = async function(id) {
  if (!App.Auth.isAdmin()) {
    App.Toast.er('Нет доступа');
    return;
  }

  if (App._bouquetModalOpen) {
    App.Toast.wn('Окно уже открыто');
    return;
  }

  App._bouquetModalOpen = true;

  try {
    const b = id ? await App.repo('bouquets').byId(id) : null;
    const flowers = await App.repo('flowers').all();
    const activeFlowers = flowers.filter(f =>
      f.active !== false && !App.BOUQUET_EXCLUDE_CATS.includes(f.category)
    );

    App._bouquetDraft = {
      id: id || null,
      name: b ? b.name : '',
      emoji: b ? b.emoji : '💐',
      description: b ? (b.description || '') : '',
      shopPrice: b ? b.shopPrice : 0,
      tags: b ? (b.tags || []) : [],
      complexity: b ? (b.complexity || 1) : 1,
      active: b ? (b.active !== false) : true,
      comps: b ? JSON.parse(JSON.stringify(b.components || [])) : [],
      flowers: activeFlowers
    };

    const h = `
      <form id="bqForm">
        <div class="row">
          <div>
            <label class="lbl">Название *</label>
            <input class="inp" name="name" value="${App.esc(App._bouquetDraft.name)}" required maxlength="60">
          </div>
          <div>
            <label class="lbl">Эмодзи</label>
            <input class="inp" name="emoji" value="${App.esc(App._bouquetDraft.emoji)}" maxlength="4">
          </div>
        </div>

        <div style="margin-top:12px">
          <label class="lbl">Описание / Инструкция для флориста</label>
          <textarea class="inp" name="description" rows="2" maxlength="300">${App.esc(App._bouquetDraft.description)}</textarea>
        </div>

        <div class="row" style="margin-top:12px">
          <div>
            <label class="lbl">Цена продажи *</label>
            <input type="number" class="inp" name="shopPrice" min="1" step="10"
                   value="${App._bouquetDraft.shopPrice}" required>
          </div>
          <div>
            <label class="lbl">Сложность сборки</label>
            <select class="inp" name="complexity">
              ${COMPLEXITY.map(c =>
                `<option value="${c.id}" ${App._bouquetDraft.complexity === c.id ? 'selected' : ''}>${c.label} (${c.time})</option>`
              ).join('')}
            </select>
          </div>
        </div>

        <div style="margin-top:12px">
          <label class="lbl">Теги</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${BOUQUET_TAGS.map(t => `
              <label class="chk" style="background:${t.color};padding:4px 10px;border-radius:8px;margin:0">
                <input type="checkbox" name="tag" value="${t.id}"
                       ${App._bouquetDraft.tags.includes(t.id) ? 'checked' : ''}>
                ${t.label}
              </label>
            `).join('')}
          </div>
        </div>

        <div style="margin-top:16px">
          <label class="lbl">Состав</label>
          <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
            <select class="inp" id="bAddFl" style="flex:1;min-width:150px">
              <option value="">-- выберите товар --</option>
              ${activeFlowers.map(f =>
                `<option value="${f.id}">${f.emoji || '🌸'} ${App.esc(f.name)} (ост: ${f.stock})</option>`
              ).join('')}
            </select>
            <input type="number" class="inp" id="bAddQ" value="1" min="1" max="99" style="width:90px">
            <button type="button" class="btn s" id="addBLineBtn">+</button>
          </div>
          <div class="cart" id="bItems" style="min-height:60px"></div>
          <div style="display:flex;justify-content:space-between;margin-top:10px;padding:10px;background:var(--in);border-radius:8px">
            <div>Себестоимость: <strong id="bCost">${App.fmtMoney(0)}</strong></div>
            <div>Маржа: <strong id="bMargin">0%</strong></div>
          </div>
        </div>

        <div id="bWarning" style="display:none;margin-top:10px;padding:10px;background:#fee2e2;color:#991b1b;border-radius:8px;font-size:13px"></div>

        <label class="chk" style="margin-top:12px">
          <input type="checkbox" name="active" ${App._bouquetDraft.active ? 'checked' : ''}> Активен
        </label>

        <div style="display:flex;gap:10px;margin-top:20px">
          <button type="submit" class="btn" style="flex:1">💾 Сохранить</button>
          <button type="button" class="btn g" style="flex:1" id="cancelBtn">Отмена</button>
        </div>
      </form>
    `;

    App.Modal.open(id ? 'Редактирование букета' : 'Новый букет', h);
    App.Modal.onClose(() => {
      App._bouquetModalOpen = false;
      App._bouquetDraft = null;
    });

    _renderBouquetComponents();
    _attachBouquetFormListeners();

  } catch (e) {
    console.error('editBouquet error:', e);
    App.Toast.er('Ошибка: ' + e.message);
    App._bouquetModalOpen = false;
  }
};

/* ---------- Рендер компонентов ---------- */
function _renderBouquetComponents() {
  const el = document.getElementById('bItems');
  if (!el || !App._bouquetDraft) return;

  if (!App._bouquetDraft.comps.length) {
    el.innerHTML = '<div class="hint" style="text-align:center;padding:10px">Добавьте цветы из списка выше</div>';
  } else {
    el.innerHTML = App._bouquetDraft.comps.map((c, i) => {
      const f = App._bouquetDraft.flowers.find(x => x.id === c.flowerId);
      return `
        <div class="cart-r">
          <span>${f ? (f.emoji || '🌸') : '❓'} ${f ? App.esc(f.name) : '—'} × <strong>${c.quantity}</strong></span>
          <div style="display:flex;gap:4px">
            <button type="button" class="ab" style="background:#dbeafe;color:#1e40af" data-qty-minus="${i}">−</button>
            <button type="button" class="ab" style="background:#dbeafe;color:#1e40af" data-qty-plus="${i}">+</button>
            <button type="button" class="ab" style="background:#fee2e2;color:#991b1b" data-rm="${i}">✕</button>
          </div>
        </div>
      `;
    }).join('');

    el.querySelectorAll('[data-rm]').forEach(btn => {
      btn.addEventListener('click', function() {
        App._bouquetDraft.comps.splice(parseInt(this.dataset.rm), 1);
        _renderBouquetComponents();
      });
    });

    el.querySelectorAll('[data-qty-minus]').forEach(btn => {
      btn.addEventListener('click', function() {
        const i = parseInt(this.dataset.qtyMinus);
        if (App._bouquetDraft.comps[i].quantity > 1) {
          App._bouquetDraft.comps[i].quantity--;
          _renderBouquetComponents();
        }
      });
    });

    el.querySelectorAll('[data-qty-plus]').forEach(btn => {
      btn.addEventListener('click', function() {
        const i = parseInt(this.dataset.qtyPlus);
        App._bouquetDraft.comps[i].quantity++;
        _renderBouquetComponents();
      });
    });
  }

  _updateBouquetTotals();
}

/* ---------- Обновление итогов ---------- */
function _updateBouquetTotals() {
  if (!App._bouquetDraft) return;

  const cost = App._bouquetDraft.comps.reduce((sum, c) => {
    const f = App._bouquetDraft.flowers.find(x => x.id === c.flowerId);
    return sum + (f ? (f.purchasePrice || 0) * c.quantity : 0);
  }, 0);

  const shopPriceInput = document.querySelector('[name="shopPrice"]');
  const shopPrice = shopPriceInput ? parseFloat(shopPriceInput.value) || 0 : 0;
  const margin = computeBouquetMargin(shopPrice, cost);

  const costEl = document.getElementById('bCost');
  const marginEl = document.getElementById('bMargin');
  const warningEl = document.getElementById('bWarning');

  if (costEl) costEl.textContent = App.fmtMoney(cost);

  if (marginEl) {
    marginEl.textContent = margin.toFixed(1) + '%';
    marginEl.style.color = margin < 0 ? 'var(--bad)'
                          : margin < 20 ? 'var(--warn)'
                          : 'var(--good)';
  }

  if (warningEl) {
    if (margin < 0) {
      warningEl.style.display = 'block';
      warningEl.textContent = `⚠️ Букет продаётся дешевле себестоимости на ${App.fmtMoney(Math.abs(shopPrice - cost))}!`;
    } else if (margin < 20) {
      warningEl.style.display = 'block';
      warningEl.style.background = '#fef3c7';
      warningEl.style.color = '#92400e';
      warningEl.textContent = `⚠️ Низкая маржа (${margin.toFixed(1)}%). Рекомендуется минимум 30%.`;
    } else {
      warningEl.style.display = 'none';
    }
  }
}

/* ---------- Listeners формы ---------- */
function _attachBouquetFormListeners() {
  const addBtn = document.getElementById('addBLineBtn');
  const form = document.getElementById('bqForm');
  const cancelBtn = document.getElementById('cancelBtn');
  const priceInput = form?.querySelector('[name="shopPrice"]');

  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const fid = document.getElementById('bAddFl')?.value;
      const q = parseInt(document.getElementById('bAddQ')?.value || 1);

      if (!fid) {
        App.Toast.wn('Выберите товар');
        return;
      }

      if (q < 1 || q > 99) {
        App.Toast.wn('Количество должно быть от 1 до 99');
        return;
      }

      const f = App._bouquetDraft.flowers.find(x => x.id === fid);
      if (!f) return;

      // Проверка доступности с учётом резерва
      const reserved = await App.getReservedQty(fid);
      const available = (f.stock || 0) - reserved;
      const currentQty = App._bouquetDraft.comps
        .filter(c => c.flowerId === fid)
        .reduce((s, c) => s + c.quantity, 0);

      if (currentQty + q > f.stock) {
        App.Toast.er(`Недостаточно товара. В наличии: ${f.stock}, в резерве: ${reserved}`);
        return;
      }

      if (currentQty + q > available * 2) {
        // Мягкое предупреждение если используем больше чем в 2 раза превышает свободный остаток
        App.Toast.wn(`Внимание: используется ${currentQty + q} из ${f.stock} доступных`);
      }

      const existing = App._bouquetDraft.comps.find(c => c.flowerId === fid);
      if (existing) {
        existing.quantity += q;
      } else {
        App._bouquetDraft.comps.push({ flowerId: fid, quantity: q });
      }

      document.getElementById('bAddFl').value = '';
      document.getElementById('bAddQ').value = 1;
      _renderBouquetComponents();
    });
  }

  if (priceInput) {
    priceInput.addEventListener('input', _updateBouquetTotals);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      App._bouquetDraft = null;
      App.Modal.close();
    });
  }

  if (form) {
    form.addEventListener('submit', _saveBouquet);
  }
}

/* ---------- Сохранение букета ---------- */
async function _saveBouquet(e) {
  e.preventDefault();

  try {
    const form = e.target;

    if (!App._bouquetDraft) return false;
    if (!App._bouquetDraft.comps.length) {
      App.Toast.er('Добавьте хотя бы один компонент');
      return false;
    }

    const name = form.name.value.trim();
    if (!name) {
      App.Toast.er('Введите название');
      return false;
    }

    const shopPrice = parseFloat(form.shopPrice.value) || 0;
    if (shopPrice <= 0) {
      App.Toast.er('Цена должна быть больше нуля');
      return false;
    }

    // Проверка уникальности названия
    const allBouquets = await App.repo('bouquets').all();
    const duplicate = allBouquets.find(x =>
      x.name.toLowerCase() === name.toLowerCase() &&
      x.id !== App._bouquetDraft.id
    );

    if (duplicate) {
      App.Toast.er('Букет с таким названием уже существует');
      return false;
    }

    // Собираем теги
    const tags = Array.from(form.querySelectorAll('[name="tag"]:checked'))
      .map(cb => cb.value);

    const isNew = !App._bouquetDraft.id;
    const data = {
      id: App._bouquetDraft.id || App.uid(),
      name,
      emoji: form.emoji.value.trim() || '💐',
      description: form.description.value.trim(),
      shopPrice,
      complexity: parseInt(form.complexity.value) || 1,
      tags,
      active: form.active.checked,
      components: JSON.parse(JSON.stringify(App._bouquetDraft.comps)),
      createdAt: isNew ? Date.now() : (App._bouquetDraft.createdAt || Date.now()),
      updatedAt: Date.now()
    };

    await App.repo('bouquets').save(data);

    // Аудит
    if (App.Audit) {
      await App.Audit.log(
        isNew ? App.AUDIT_ACTIONS.CREATE : App.AUDIT_ACTIONS.UPDATE,
        { name: data.name, price: data.shopPrice },
        'bouquets',
        data.id
      );
    }

    App._bouquetDraft = null;
    App.Modal.close();
    App.rerender();
    App.Toast.ok(isNew ? 'Букет создан' : 'Букет обновлён');

  } catch (err) {
    console.error('saveBouquet error:', err);
    App.Toast.er('Ошибка сохранения: ' + err.message);
  }

  return false;
}

/* ---------- Дублирование букета ---------- */
App.duplicateBouquet = async function(id) {
  try {
    const original = await App.repo('bouquets').byId(id);
    if (!original) {
      App.Toast.er('Букет не найден');
      return;
    }

    const copy = {
      ...original,
      id: App.uid(),
      name: original.name + ' (копия)',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await App.repo('bouquets').save(copy);

    if (App.Audit) {
      await App.Audit.log(App.AUDIT_ACTIONS.CREATE,
        { name: copy.name, copiedFrom: id },
        'bouquets', copy.id);
    }

    App.Toast.ok('Букет продублирован');
    App.rerender();
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- Переключение активности ---------- */
App.toggleBouquetActive = async function(id) {
  try {
    const b = await App.repo('bouquets').byId(id);
    if (!b) return;

    const newActive = b.active === false;
    await App.repo('bouquets').update(id, {
      active: newActive,
      updatedAt: Date.now()
    });

    if (App.Audit) {
      await App.Audit.log(App.AUDIT_ACTIONS.UPDATE,
        { name: b.name, active: newActive },
        'bouquets', id);
    }

    App.Toast.ok(newActive ? 'Букет активирован' : 'Букет деактивирован');
    App.rerender();
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- Удаление ---------- */
App.deleteBouquet = async function(id) {
  if (!App.Auth.isAdmin()) return;

  try {
    const b = await App.repo('bouquets').byId(id);
    if (!b) return;

    const confirmed = await App.Modal.confirm(
      `Удалить букет "${b.name}"? Это действие нельзя отменить.`
    );

    if (!confirmed) return;

    await App.repo('bouquets').remove(id);

    if (App.Audit) {
      await App.Audit.log(App.AUDIT_ACTIONS.DELETE,
        { name: b.name },
        'bouquets', id);
    }

    App.Toast.ok('Букет удалён');
    App.rerender();
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- Экспорт в CSV ---------- */
App.exportBouquetsCSV = async function() {
  try {
    const bouquets = await App.repo('bouquets').all();
    const flowers = await App.repo('flowers').all();
    const flowersMap = buildFlowersMap(flowers);

    const headers = [
      'Название', 'Эмодзи', 'Описание', 'Цена', 'Себестоимость',
      'Маржа %', 'Теги', 'Сложность', 'Активен', 'Компоненты'
    ];

    const rows = bouquets.map(b => {
      const cost = computeBouquetCost(b, flowersMap);
      const margin = computeBouquetMargin(b.shopPrice, cost);
      const tags = (b.tags || []).map(t => {
        const tagInfo = BOUQUET_TAGS.find(x => x.id === t);
        return tagInfo ? tagInfo.label : t;
      }).join('; ');
      const complexity = COMPLEXITY.find(c => c.id === b.complexity)?.label || '';
      const components = (b.components || []).map(c => {
        const f = flowersMap.get(c.flowerId);
        return f ? `${f.name}×${c.quantity}` : '';
      }).filter(Boolean).join('; ');

      return [
        b.name,
        b.emoji || '',
        b.description || '',
        b.shopPrice,
        cost.toFixed(0),
        margin.toFixed(1),
        tags,
        complexity,
        b.active !== false ? 'Да' : 'Нет',
        components
      ];
    });

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bouquets_${App.toLocalDateString(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    App.Toast.ok(`Экспортировано ${bouquets.length} букетов`);

    if (App.Audit) {
      await App.Audit.logExport('bouquets', bouquets.length);
    }
  } catch (e) {
    App.Toast.er('Ошибка экспорта: ' + e.message);
  }
};

console.log('✅ bouquets.js загружен');