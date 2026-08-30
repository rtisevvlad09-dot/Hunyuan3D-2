// ===== КЛИЕНТЫ =====
// js/modules/clients.js
// v2.0 — с автоподсчётом статистики, ABC, днями рождения, заметками

window.App = window.App || {};

/* ---------- Константы ---------- */
const CLIENT_TAGS = [
  { id: 'vip',       label: '⭐ VIP',          color: '#fef3c7', textColor: '#92400e' },
  { id: 'corporate', label: '🏢 Корпоративный', color: '#dbeafe', textColor: '#1e40af' },
  { id: 'blacklist', label: '🚫 Чёрный список', color: '#fee2e2', textColor: '#991b1b' },
  { id: 'new',       label: '🆕 Новый',        color: '#d1fae5', textColor: '#065f46' },
  { id: 'regular',   label: '🔁 Постоянный',   color: '#e0e7ff', textColor: '#3730a3' }
];

const CLIENT_SORT_OPTIONS = [
  { id: 'name',      label: 'По имени',   fn: (a, b) => a.name.localeCompare(b.name) },
  { id: 'spent',     label: 'По сумме',   fn: (a, b) => (b.totalSpent || 0) - (a.totalSpent || 0) },
  { id: 'orders',    label: 'По заказам', fn: (a, b) => (b.orders || 0) - (a.orders || 0) },
  { id: 'recent',    label: 'Недавние',   fn: (a, b) => (b.lastOrderDate || 0) - (a.lastOrderDate || 0) },
  { id: 'created',   label: 'Новые',      fn: (a, b) => (b.createdAt || 0) - (a.createdAt || 0) }
];

/* ---------- Пересчёт статистики клиента из реальных заказов ---------- */
async function recomputeClientStats(clientId) {
  const orders = await App.repo('orders').all();
  const clientOrders = orders.filter(o => o.clientId === clientId && o.status === 'completed');

  const totalSpent = clientOrders.reduce((s, o) => s + (o.finalAmount || 0), 0);
  const lastOrder = clientOrders.length > 0
    ? Math.max(...clientOrders.map(o => o.ts || 0))
    : null;

  return {
    orders: clientOrders.length,
    totalSpent,
    lastOrderDate: lastOrder
  };
}

/* ---------- Обновление статистики для всех клиентов ---------- */
async function recomputeAllClientStats() {
  const clients = await App.repo('clients').all();
  const orders = await App.repo('orders').all();

  // Группируем заказы по clientId
  const ordersByClient = new Map();
  for (const o of orders) {
    if (!o.clientId || o.status !== 'completed') continue;
    if (!ordersByClient.has(o.clientId)) ordersByClient.set(o.clientId, []);
    ordersByClient.get(o.clientId).push(o);
  }

  const updates = [];
  for (const c of clients) {
    const clientOrders = ordersByClient.get(c.id) || [];
    const totalSpent = clientOrders.reduce((s, o) => s + (o.finalAmount || 0), 0);
    const lastOrderDate = clientOrders.length > 0
      ? Math.max(...clientOrders.map(o => o.ts || 0))
      : null;

    if (c.orders !== clientOrders.length ||
        c.totalSpent !== totalSpent ||
        c.lastOrderDate !== lastOrderDate) {
      updates.push({
        id: c.id,
        orders: clientOrders.length,
        totalSpent,
        lastOrderDate
      });
    }
  }

  if (updates.length > 0) {
    for (const u of updates) {
      await App.repo('clients').update(u.id, u);
    }
    console.log(`📊 Обновлено статистика для ${updates.length} клиентов`);
  }
}

/* ---------- ABC-сегментация клиентов ---------- */
function computeABC(clients) {
  const active = clients.filter(c => (c.totalSpent || 0) > 0)
    .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));

  const totalSpent = active.reduce((s, c) => s + (c.totalSpent || 0), 0);
  if (totalSpent === 0) return new Map();

  let cumulative = 0;
  const abcMap = new Map();

  for (const c of active) {
    cumulative += c.totalSpent || 0;
    const pct = cumulative / totalSpent;
    const group = pct <= 0.8 ? 'A' : pct <= 0.95 ? 'B' : 'C';
    abcMap.set(c.id, group);
  }

  return abcMap;
}

/* ---------- Основной рендер ---------- */
App.renderClients = async function() {
  if (!App.Auth.can('owner', 'admin', 'employee')) {
    App.$('#view').innerHTML = '<div class="card" style="text-align:center;padding:40px">Нет доступа</div>';
    return;
  }

  App.setLoading?.(true);

  try {
    // Автопересчёт статистики раз в сессию
    if (!App._clientsStatsComputed) {
      await recomputeAllClientStats();
      App._clientsStatsComputed = true;
    }

    let clients = await App.repo('clients').all();

    // Фильтрация по правам
    if (!App.Auth.isAdmin()) {
      clients = clients.filter(c => c.createdById === App.Auth.user.id);
    }

    // Состояние фильтров
    if (!App.state.clientsFilter) App.state.clientsFilter = 'all';
    if (!App.state.clientsSort) App.state.clientsSort = 'recent';
    if (!App.state.clientsTagFilter) App.state.clientsTagFilter = 'all';

    const search = (App.getSearch('clients') || '').toLowerCase();
    const abcMap = computeABC(clients);

    // Фильтрация
    let filtered = clients;

    if (App.state.clientsFilter === 'vip') {
      filtered = filtered.filter(c => (c.tags || []).includes('vip'));
    } else if (App.state.clientsFilter === 'loyal') {
      filtered = filtered.filter(c => c.loyaltyProgram !== false);
    } else if (App.state.clientsFilter === 'blacklist') {
      filtered = filtered.filter(c => (c.tags || []).includes('blacklist'));
    } else if (App.state.clientsFilter === 'birthday') {
      // Дни рождения в ближайший месяц
      const now = new Date();
      filtered = filtered.filter(c => {
        if (!c.birthday) return false;
        const b = new Date(c.birthday);
        const diff = (b.getMonth() - now.getMonth() + 12) % 12;
        return diff <= 1;
      });
    }

    // Фильтр по тегам
    if (App.state.clientsTagFilter !== 'all') {
      filtered = filtered.filter(c => (c.tags || []).includes(App.state.clientsTagFilter));
    }

    // Поиск (по всем полям)
    if (search) {
      filtered = filtered.filter(c =>
        (c.name || '').toLowerCase().includes(search) ||
        (c.phone || '').includes(search) ||
        (c.email || '').toLowerCase().includes(search) ||
        (c.address || '').toLowerCase().includes(search) ||
        (c.notes || '').toLowerCase().includes(search)
      );
    }

    // Сортировка
    const sortFn = CLIENT_SORT_OPTIONS.find(s => s.id === App.state.clientsSort)?.fn
                || CLIENT_SORT_OPTIONS[0].fn;
    filtered.sort(sortFn);

    const { items: rows, page: p, pages } = App.paginate(filtered, 'clients');

    // Статистика в шапке
    const totalClients = clients.length;
    const vipCount = clients.filter(c => (c.tags || []).includes('vip')).length;
    const birthdaySoon = clients.filter(c => {
      if (!c.birthday) return false;
      const b = new Date(c.birthday);
      const now = new Date();
      const diff = (b.getMonth() - now.getMonth() + 12) % 12;
      return diff <= 1 && diff >= 0;
    }).length;

    let h = `
      <div class="g" style="margin-bottom:14px">
        <div class="card stat">
          <div class="big">👥 ${totalClients}</div>
          <div class="sm">Всего клиентов</div>
        </div>
        <div class="card stat">
          <div class="big">⭐ ${vipCount}</div>
          <div class="sm">VIP клиентов</div>
        </div>
        <div class="card stat">
          <div class="big">🎂 ${birthdaySoon}</div>
          <div class="sm">ДР в ближайший месяц</div>
        </div>
        <div class="card stat">
          <div class="big">💰 ${App.fmtMoney(clients.reduce((s, c) => s + (c.totalSpent || 0), 0))}</div>
          <div class="sm">Общая выручка</div>
        </div>
      </div>

      <div class="tools">
        <input class="inp search" placeholder="Поиск по имени, телефону, email, адресу..."
               value="${App.esc(App.getSearch('clients'))}" data-search="clients">
        <select class="inp" data-filter="clients" style="width:auto;min-width:130px">
          <option value="all" ${App.state.clientsFilter === 'all' ? 'selected' : ''}>Все</option>
          <option value="loyal" ${App.state.clientsFilter === 'loyal' ? 'selected' : ''}>С лояльностью</option>
          <option value="vip" ${App.state.clientsFilter === 'vip' ? 'selected' : ''}>⭐ VIP</option>
          <option value="birthday" ${App.state.clientsFilter === 'birthday' ? 'selected' : ''}>🎂 Скоро ДР</option>
          <option value="blacklist" ${App.state.clientsFilter === 'blacklist' ? 'selected' : ''}>🚫 Чёрный список</option>
        </select>
        <select class="inp" data-sort="clients" style="width:auto;min-width:140px">
          ${CLIENT_SORT_OPTIONS.map(s =>
            `<option value="${s.id}" ${App.state.clientsSort === s.id ? 'selected' : ''}>${s.label}</option>`
          ).join('')}
        </select>
        <button class="btn" data-action="new">+ Клиент</button>
        <button class="btn g" data-action="export">📤 CSV</button>
      </div>

      <div class="twrap"><table><thead><tr>
        <th>Клиент</th><th>Контакты</th><th>Заказов</th><th>Сумма</th>
        <th>Лояльность</th><th>ABC</th><th>Статус</th><th></th>
      </tr></thead><tbody>
    `;

    if (!rows.length) {
      h += `
        <tr>
          <td colspan="8" style="text-align:center;padding:40px">
            <div style="font-size:48px;margin-bottom:10px">👥</div>
            <div style="color:var(--t3)">Клиенты не найдены</div>
            <div class="hint" style="margin-top:8px">Создайте первого клиента</div>
          </td>
        </tr>
      `;
    }

    for (const c of rows) {
      const abc = abcMap.get(c.id);
      const abcBadge = abc
        ? `<span class="badge ${abc === 'A' ? 'abc-a' : abc === 'B' ? 'abc-b' : 'abc-c'}">${abc}</span>`
        : '<span class="badge bmu">—</span>';

      const loyaltyBadge = !c.loyaltyProgram
        ? '<span class="badge bmu">Без</span>'
        : c.discountType === 'percent'
          ? `<span class="badge bwa">🎁 ${c.discountValue}%</span>`
          : `<span class="badge binfo">🎁 ${App.fmtMoney(c.discountValue)}</span>`;

      const tags = (c.tags || []).map(t => {
        const tagInfo = CLIENT_TAGS.find(x => x.id === t);
        return tagInfo
          ? `<span class="badge" style="background:${tagInfo.color};color:${tagInfo.textColor}">${tagInfo.label}</span>`
          : '';
      }).join(' ');

      const birthday = c.birthday
        ? `<div class="hint" style="margin-top:2px">🎂 ${App.fmtDate(c.birthday)}</div>`
        : '';

      const lastOrder = c.lastOrderDate
        ? `<div class="hint" style="margin-top:2px">Посл.: ${App.relTime(c.lastOrderDate)}</div>`
        : '';

      h += `
        <tr>
          <td>
            <strong>${App.esc(c.name)}</strong>
            ${birthday}
          </td>
          <td>
            <div>📱 ${App.esc(c.phone)}</div>
            ${c.email ? `<div class="hint">✉️ ${App.esc(c.email)}</div>` : ''}
          </td>
          <td>${c.orders || 0}${lastOrder}</td>
          <td><strong>${App.fmtMoney(c.totalSpent || 0)}</strong></td>
          <td>${loyaltyBadge}</td>
          <td>${abcBadge}</td>
          <td><div style="display:flex;gap:3px;flex-wrap:wrap">${tags || '<span class="badge bmu">—</span>'}</div></td>
          <td style="white-space:nowrap">
            <button class="ab" style="background:#d1fae5;color:#065f46" data-action="call" data-id="${c.id}" title="Позвонить">📞</button>
            <button class="ab" style="background:#e0e7ff;color:#3730a3" data-action="history" data-id="${c.id}" title="История">📜</button>
            <button class="ab" style="background:#dbeafe;color:#1e40af" data-action="edit" data-id="${c.id}">✏️</button>
            ${App.Auth.isAdmin()
              ? `<button class="ab" style="background:#fee2e2;color:#991b1b" data-action="delete" data-id="${c.id}">🗑️</button>`
              : ''}
          </td>
        </tr>
      `;
    }

    h += `</tbody></table></div>` + App.pagHTML(p, pages);

    App.$('#view').innerHTML = h;
    App.setLoading?.(false);

    _attachClientsListeners();

  } catch (e) {
    console.error('renderClients error:', e);
    App.$('#view').innerHTML = `<div class="card" style="text-align:center;padding:40px;color:var(--bad)">
      Ошибка: ${App.esc(e.message)}
    </div>`;
    App.setLoading?.(false);
  }
};

/* ---------- Event delegation ---------- */
function _attachClientsListeners() {
  const view = App.$('#view');
  if (!view || view.dataset.clientsListeners) return;
  view.dataset.clientsListeners = '1';

  let searchTimer;
  view.addEventListener('input', (e) => {
    if (e.target.matches('[data-search="clients"]')) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        App.debouncedSearch('clients', e.target.value, () => {
          App.state._forceRerender = true;
          App.renderClients();
        });
      }, 200);
    }
  });

  view.addEventListener('change', (e) => {
    if (e.target.matches('[data-filter="clients"]')) {
      App.state.clientsFilter = e.target.value;
      App.setPage('clients', 1);
      App.state._forceRerender = true;
      App.renderClients();
    } else if (e.target.matches('[data-sort="clients"]')) {
      App.state.clientsSort = e.target.value;
      App.state._forceRerender = true;
      App.renderClients();
    }
  });

  view.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) {
      // Пагинация
      const pgBtn = e.target.closest('[data-pg]');
      if (pgBtn) {
        App.setPage('clients', parseInt(pgBtn.dataset.pg));
        App.state._forceRerender = true;
        App.renderClients();
      }
      return;
    }

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    switch (action) {
      case 'new':
        App.editClient(null);
        break;
      case 'edit':
        App.editClient(id);
        break;
      case 'history':
        App.clientHistory(id);
        break;
      case 'delete':
        await App.deleteClient(id);
        break;
      case 'export':
        await App.exportClientsCSV();
        break;
      case 'call':
        const client = await App.repo('clients').byId(id);
        if (client?.phone) {
          window.location.href = 'tel:' + App.normPhone(client.phone);
        }
        break;
    }
  });
}

/* ---------- Создание/редактирование клиента ---------- */
App._clientModalOpen = false;

App.editClient = async function(id) {
  if (!App.Auth.can('owner', 'admin', 'employee')) {
    App.Toast.er('Нет доступа');
    return;
  }

  if (App._clientModalOpen) {
    App.Toast.wn('Окно уже открыто');
    return;
  }

  App._clientModalOpen = true;

  try {
    const c = id ? await App.repo('clients').byId(id) : null;

    if (c && !App.Auth.isAdmin() && c.createdById !== App.Auth.user.id) {
      App.Toast.er('Нет прав на этого клиента');
      App._clientModalOpen = false;
      return;
    }

    const h = `
      <form id="clientForm">
        <div class="row">
          <div>
            <label class="lbl">ФИО *</label>
            <input class="inp" name="name" value="${App.esc(c ? c.name : '')}" required maxlength="80">
          </div>
          <div>
            <label class="lbl">Телефон *</label>
            <input class="inp phone" name="phone" value="${App.esc(c ? c.phone : '')}" required>
          </div>
        </div>

        <div class="row" style="margin-top:12px">
          <div>
            <label class="lbl">Email</label>
            <input type="email" class="inp" name="email" value="${App.esc(c ? c.email || '' : '')}">
          </div>
          <div>
            <label class="lbl">День рождения</label>
            <input type="date" class="inp" name="birthday" value="${c && c.birthday ? App.toLocalDateString(c.birthday) : ''}">
          </div>
        </div>

        <div style="margin-top:12px">
          <label class="lbl">Адрес доставки</label>
          <input class="inp" name="address" value="${App.esc(c ? c.address || '' : '')}">
        </div>

        <div style="margin-top:12px">
          <label class="lbl">Заметки о клиенте</label>
          <textarea class="inp" name="notes" rows="2" maxlength="500"
                    placeholder="Особенности, предпочтения, аллергии...">${App.esc(c ? c.notes || '' : '')}</textarea>
        </div>

        <div style="margin-top:12px">
          <label class="lbl">Метки</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${CLIENT_TAGS.map(t => `
              <label class="chk" style="background:${t.color};color:${t.textColor};padding:4px 10px;border-radius:8px;margin:0">
                <input type="checkbox" name="tag" value="${t.id}"
                       ${c && (c.tags || []).includes(t.id) ? 'checked' : ''}>
                ${t.label}
              </label>
            `).join('')}
          </div>
        </div>

        <div class="row" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--b)">
          <div>
            <label class="lbl">Лояльность</label>
            <select class="inp" name="loyaltyProgram">
              <option value="1" ${!c || c.loyaltyProgram !== false ? 'selected' : ''}>Активна</option>
              <option value="0" ${c && c.loyaltyProgram === false ? 'selected' : ''}>Не активна</option>
            </select>
          </div>
          <div>
            <label class="lbl">Тип скидки</label>
            <select class="inp" name="discountType">
              <option value="percent" ${!c || c.discountType === 'percent' ? 'selected' : ''}>Процент (%)</option>
              <option value="fixed" ${c && c.discountType === 'fixed' ? 'selected' : ''}>Фикс (₽)</option>
            </select>
          </div>
        </div>

        <div style="margin-top:12px">
          <label class="lbl">Значение скидки</label>
          <input type="number" class="inp" name="discountValue" min="0" step="0.5"
                 value="${c ? c.discountValue : 10}">
        </div>

        <label class="chk" style="margin-top:16px">
          <input type="checkbox" name="consent"
                 ${c && c.consent && c.consent.given ? 'checked disabled' : ''} required>
          Согласен(а) на обработку персональных данных (152‑ФЗ)
          ${c && c.consent && c.consent.given
            ? `<span class="hint"> (дано ${App.fmtDate(c.consent.date)})</span>`
            : ''}
        </label>

        <div style="display:flex;gap:10px;margin-top:20px">
          <button type="submit" class="btn" style="flex:1">💾 Сохранить</button>
          <button type="button" class="btn g" style="flex:1" id="cancelBtn">Отмена</button>
        </div>
      </form>
    `;

    App.Modal.open(id ? 'Редактирование клиента' : 'Новый клиент', h);
    App.Modal.onClose(() => {
      App._clientModalOpen = false;
    });

    // Маска телефона применится автоматически через MutationObserver
    // Но инициализируем для уже существующих полей
    const phoneInput = App.Modal.body().querySelector('input.phone');
    if (phoneInput) {
      App.applyPhoneMask(phoneInput);
    }

    document.getElementById('cancelBtn').onclick = () => App.Modal.close();
    document.getElementById('clientForm').addEventListener('submit', _saveClient);

  } catch (e) {
    console.error('editClient error:', e);
    App.Toast.er('Ошибка: ' + e.message);
    App._clientModalOpen = false;
  }
};

/* ---------- Сохранение клиента ---------- */
async function _saveClient(e) {
  e.preventDefault();

  try {
    const f = e.target;
    const id = f.closest('.modal')?.dataset.clientId || null;

    const name = f.name.value.trim();
    const phone = f.phone.value.trim();
    const email = f.email.value.trim();

    if (!name || name.length < 2) {
      App.Toast.er('Введите корректное имя');
      return;
    }

    if (!App.isValidPhone(phone)) {
      App.Toast.er('Некорректный телефон');
      return;
    }

    if (email && !App.isValidEmail(email)) {
      App.Toast.er('Некорректный email');
      return;
    }

    // Проверка уникальности телефона
    const allClients = await App.repo('clients').all();
    const normPhone = App.normPhone(phone);
    const duplicate = allClients.find(x =>
      App.normPhone(x.phone) === normPhone && x.id !== id
    );

    if (duplicate) {
      App.Toast.er('Телефон уже используется клиентом: ' + duplicate.name);
      return;
    }

    // Проверка уникальности email
    if (email) {
      const emailDup = allClients.find(x =>
        x.email && x.email.toLowerCase() === email.toLowerCase() && x.id !== id
      );
      if (emailDup) {
        App.Toast.er('Email уже используется клиентом: ' + emailDup.name);
        return;
      }
    }

    // Обработка согласия (не перезаписываем если уже дано)
    const existing = id ? await App.repo('clients').byId(id) : null;
    let consent = existing?.consent;
    if (f.consent.checked && (!consent || !consent.given)) {
      consent = {
        given: true,
        date: new Date().toISOString(),
        text: 'Согласие на обработку ПДн'
      };
    }

    // Собираем теги
    const tags = Array.from(f.querySelectorAll('[name="tag"]:checked')).map(cb => cb.value);

    // День рождения
    const birthday = f.birthday.value ? new Date(f.birthday.value).getTime() : null;

    const data = {
      name,
      phone,
      email: email || '',
      address: f.address.value.trim(),
      notes: f.notes.value.trim(),
      birthday,
      tags,
      loyaltyProgram: f.loyaltyProgram.value === '1',
      discountType: f.discountType.value,
      discountValue: parseFloat(f.discountValue.value) || 0,
      consent
    };

    if (id) {
      if (!existing) {
        App.Toast.er('Клиент не найден');
        return;
      }
      // Сохраняем статистику из существующей записи
      await App.repo('clients').save({
        ...existing,
        ...data,
        updatedAt: Date.now()
      });
    } else {
      const newClient = {
        id: App.uid(),
        ...data,
        orders: 0,
        totalSpent: 0,
        lastOrderDate: null,
        createdById: App.Auth.user.id,
        createdAt: Date.now()
      };
      await App.repo('clients').save(newClient);
    }

    // Аудит
    if (App.Audit) {
      await App.Audit.log(
        id ? App.AUDIT_ACTIONS.UPDATE : App.AUDIT_ACTIONS.CREATE,
        { name, phone: App.ExtServices?._maskPhone?.(normPhone) || normPhone },
        'clients',
        id || data.name
      );
    }

    App.Toast.ok(id ? 'Клиент обновлён' : 'Клиент создан');
    App.Modal.close();
    App._clientsStatsComputed = false; // Сбросим кэш статистики
    App.rerender();

  } catch (err) {
    console.error('saveClient error:', err);
    App.Toast.er('Ошибка: ' + err.message);
  }
}

/* ---------- Удаление клиента ---------- */
App.deleteClient = async function(id) {
  if (!App.Auth.isAdmin()) {
    App.Toast.er('Только администратор');
    return;
  }

  try {
    const client = await App.repo('clients').byId(id);
    if (!client) return;

    const orders = await App.repo('orders').all();
    const hasOrders = orders.some(o => o.clientId === id);

    if (hasOrders) {
      const confirmed = await App.Modal.confirm(
        `У клиента "${client.name}" есть заказы. При удалении клиента заказы останутся, но без привязки. Продолжить?`,
        'Предупреждение',
        { danger: true, okText: 'Удалить всё равно' }
      );
      if (!confirmed) return;
    } else {
      const confirmed = await App.Modal.confirm(
        `Удалить клиента "${client.name}"? Это действие нельзя отменить.`
      );
      if (!confirmed) return;
    }

    await App.repo('clients').remove(id);

    if (App.Audit) {
      await App.Audit.log(App.AUDIT_ACTIONS.DELETE,
        { name: client.name, hadOrders: hasOrders },
        'clients', id);
    }

    App.Toast.ok('Клиент удалён');
    App.rerender();
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- История покупок клиента ---------- */
App.clientHistory = async function(id) {
  const c = await App.repo('clients').byId(id);
  if (!c) {
    App.Toast.er('Клиент не найден');
    return;
  }

  if (!App.Auth.isAdmin() && c.createdById !== App.Auth.user.id) {
    App.Toast.er('Нет прав');
    return;
  }

  const orders = (await App.repo('orders').all())
    .filter(o => o.clientId === id)
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));

  const totalSpent = orders
    .filter(o => o.status === 'completed')
    .reduce((s, o) => s + (o.finalAmount || 0), 0);

  const totalDiscount = orders
    .filter(o => o.status === 'completed')
    .reduce((s, o) => s + ((o.amount || 0) - (o.finalAmount || 0)), 0);

  let h = `
    <div style="margin-bottom:16px">
      <div style="font-size:20px;font-weight:700">${App.esc(c.name)}</div>
      <div class="hint">📱 ${App.esc(c.phone)} ${c.email ? '• ✉️ ' + App.esc(c.email) : ''}</div>
      ${c.birthday ? `<div class="hint">🎂 ${App.fmtDate(c.birthday)}</div>` : ''}
      ${c.notes ? `<div class="hint" style="margin-top:6px;padding:8px;background:var(--in);border-radius:6px">📝 ${App.esc(c.notes)}</div>` : ''}
    </div>

    <div class="g" style="margin-bottom:16px">
      <div class="card stat" style="padding:12px">
        <div class="big" style="font-size:18px">${orders.length}</div>
        <div class="sm">Всего заказов</div>
      </div>
      <div class="card stat" style="padding:12px">
        <div class="big" style="font-size:18px">${App.fmtMoney(totalSpent)}</div>
        <div class="sm">Потрачено</div>
      </div>
      <div class="card stat" style="padding:12px">
        <div class="big" style="font-size:18px;color:var(--good)">${App.fmtMoney(totalDiscount)}</div>
        <div class="sm">Сэкономлено</div>
      </div>
      <div class="card stat" style="padding:12px">
        <div class="big" style="font-size:18px">${orders.length > 0 ? App.fmtMoney(totalSpent / orders.length) : App.fmtMoney(0)}</div>
        <div class="sm">Ср. чек</div>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <strong>История заказов</strong>
      <button class="btn g" id="exportHistBtn" style="padding:4px 12px;font-size:12px">📤 Экспорт</button>
    </div>

    <div class="twrap"><table><thead><tr>
      <th>Дата</th><th>№</th><th>Позиции</th><th>Сумма</th><th>Скидка</th><th>Итого</th><th>Статус</th>
    </tr></thead><tbody>
  `;

  if (!orders.length) {
    h += '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--t3)">Нет заказов</td></tr>';
  }

  for (const o of orders) {
    const itemsText = (o.items || []).slice(0, 2).map(it =>
      `${it.name || '—'} ×${it.quantity}`
    ).join(', ');
    const more = (o.items || []).length > 2 ? ` +${o.items.length - 2}` : '';

    const discount = (o.amount || 0) - (o.finalAmount || 0);
    const statusBadge = o.status === 'completed'
      ? '<span class="badge bok">Выполнен</span>'
      : o.status === 'cancelled'
      ? '<span class="badge bda">Отменён</span>'
      : '<span class="badge bwa">В работе</span>';

    h += `
      <tr data-order-id="${o.id}" style="cursor:pointer">
        <td>${App.fmtDate(o.ts)}</td>
        <td>#${App.esc(String(o.id).slice(-6))}</td>
        <td style="font-size:12px">${App.esc(itemsText)}${more}</td>
        <td>${App.fmtMoney(o.amount)}</td>
        <td style="color:var(--good)">${discount > 0 ? '-' + App.fmtMoney(discount) : '—'}</td>
        <td><strong>${App.fmtMoney(o.finalAmount)}</strong></td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }

  h += '</tbody></table></div>';

  App.Modal.open('📜 История клиента', h);

  // Клик по заказу
  setTimeout(() => {
    const tbody = App.Modal.body()?.querySelector('tbody');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const row = e.target.closest('[data-order-id]');
        if (row) {
          const orderId = row.dataset.orderId;
          App.Modal.close();
          if (typeof App.showOrderDetails === 'function') {
            App.showOrderDetails(orderId);
          } else {
            App.navigateTo('orders');
          }
        }
      });
    }
  }, 50);

  // Экспорт истории
  setTimeout(() => {
    const btn = document.getElementById('exportHistBtn');
    if (btn) {
      btn.onclick = () => exportClientHistory(c, orders);
    }
  }, 50);
};

/* ---------- Экспорт истории клиента ---------- */
async function exportClientHistory(client, orders) {
  try {
    const report = {
      client: {
        name: client.name,
        phone: client.phone,
        email: client.email || '',
        birthday: client.birthday ? App.fmtDate(client.birthday) : '',
        notes: client.notes || '',
        tags: client.tags || []
      },
      stats: {
        totalOrders: orders.length,
        completedOrders: orders.filter(o => o.status === 'completed').length,
        totalSpent: orders.filter(o => o.status === 'completed').reduce((s, o) => s + (o.finalAmount || 0), 0),
        avgCheck: orders.length > 0 ? orders.reduce((s, o) => s + (o.finalAmount || 0), 0) / orders.length : 0
      },
      orders: orders.map(o => ({
        date: App.fmtDate(o.ts),
        id: String(o.id).slice(-6),
        amount: o.amount,
        finalAmount: o.finalAmount,
        discount: (o.amount || 0) - (o.finalAmount || 0),
        status: o.status,
        items: (o.items || []).map(it => ({
          name: it.name,
          quantity: it.quantity,
          price: it.price
        }))
      })),
      generatedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client_${client.name.replace(/\s+/g, '_')}_${App.toLocalDateString(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);

    App.Toast.ok('История экспортирована');
  } catch (e) {
    App.Toast.er('Ошибка экспорта: ' + e.message);
  }
}

/* ---------- Экспорт всех клиентов в CSV ---------- */
App.exportClientsCSV = async function() {
  try {
    let clients = await App.repo('clients').all();

    if (!App.Auth.isAdmin()) {
      clients = clients.filter(c => c.createdById === App.Auth.user.id);
    }

    const abcMap = computeABC(clients);

    const headers = [
      'ФИО', 'Телефон', 'Email', 'Адрес', 'День рождения',
      'Заказов', 'Потрачено', 'Посл. заказ', 'Лояльность',
      'Тип скидки', 'Значение', 'ABC', 'Метки', 'Заметки'
    ];

    const rows = clients.map(c => {
      const tags = (c.tags || []).map(t => {
        const tagInfo = CLIENT_TAGS.find(x => x.id === t);
        return tagInfo ? tagInfo.label : t;
      }).join('; ');

      return [
        c.name,
        c.phone,
        c.email || '',
        c.address || '',
        c.birthday ? App.fmtDate(c.birthday) : '',
        c.orders || 0,
        c.totalSpent || 0,
        c.lastOrderDate ? App.fmtDate(c.lastOrderDate) : '',
        c.loyaltyProgram !== false ? 'Да' : 'Нет',
        c.discountType === 'percent' ? 'Процент' : 'Фикс',
        c.discountValue || 0,
        abcMap.get(c.id) || '',
        tags,
        c.notes || ''
      ];
    });

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clients_${App.toLocalDateString(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    App.Toast.ok(`Экспортировано ${clients.length} клиентов`);

    if (App.Audit) {
      await App.Audit.logExport('clients', clients.length);
    }
  } catch (e) {
    App.Toast.er('Ошибка экспорта: ' + e.message);
  }
};

console.log('✅ clients.js загружен');