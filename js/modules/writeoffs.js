// ===== СПИСАНИЯ =====
// js/modules/writeoffs.js
// v2.0 — с фото доказательств, фильтрами, правильным async резервом, удалением

window.App = window.App || {};

/* ---------- Причины списания ---------- */
const WRITEOFF_REASONS = [
  { id: 'expired',  label: '⏰ Истёк срок',     color: '#fee2e2' },
  { id: 'damaged',  label: '💔 Повреждение',    color: '#fef3c7' },
  { id: 'defect',   label: '❌ Брак',           color: '#fce7f3' },
  { id: 'theft',    label: '🚨 Кража/потеря',   color: '#e5e7eb' },
  { id: 'sample',   label: '🎁 Образец/подарок', color: '#dbeafe' },
  { id: 'inventory',label: '📊 Инвентаризация', color: '#e0e7ff' },
  { id: 'other',    label: '📝 Иная причина',   color: '#f3f4f6' }
];

/* ---------- Статусы ---------- */
const WRITEOFF_STATUSES = [
  { id: 'pending',  label: 'На проверке', badge: 'bwa',  icon: '⏳' },
  { id: 'approved', label: 'Утверждено',  badge: 'bok',  icon: '✅' },
  { id: 'rejected', label: 'Отклонено',   badge: 'bda',  icon: '❌' }
];

/* ---------- Периоды ---------- */
const WRITEOFF_PERIODS = [
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
  const period = WRITEOFF_PERIODS.find(p => p.id === periodId) || WRITEOFF_PERIODS[1];
  if (period.days === -1) return { from: 0, to: now.getTime() };
  const from = new Date();
  from.setDate(from.getDate() - period.days);
  from.setHours(0, 0, 0, 0);
  return { from: from.getTime(), to: now.getTime() };
}

function getReasonInfo(id) {
  return WRITEOFF_REASONS.find(r => r.id === id) || WRITEOFF_REASONS[WRITEOFF_REASONS.length - 1];
}

function getStatusInfo(id) {
  return WRITEOFF_STATUSES.find(s => s.id === id) || WRITEOFF_STATUSES[0];
}

/* ---------- Основной рендер ---------- */
App.renderWriteoffs = async function() {
  if (!App.Auth.can('owner', 'admin', 'employee')) {
    App.$('#view').innerHTML = '<div class="card" style="text-align:center;padding:40px">Нет доступа</div>';
    return;
  }

  App.setLoading?.(true);

  try {
    // Инициализация состояния
    if (!App.state.writeoffsPeriod) App.state.writeoffsPeriod = 'month';
    if (!App.state.writeoffsStatus) App.state.writeoffsStatus = 'all';
    if (!App.state.writeoffsReason) App.state.writeoffsReason = 'all';

    const [writeoffs, flowers, users] = await Promise.all([
      App.repo('writeoffs').all(),
      App.repo('flowers').all(),
      App.repo('users').all()
    ]);

    const flowersMap = new Map(flowers.map(f => [f.id, f]));
    const usersMap = new Map(users.map(u => [u.id, u]));
    const range = getDateRange(App.state.writeoffsPeriod);

    // Фильтр по правам (сотрудники видят только свои + утверждённые всех)
    let filtered = writeoffs;
    if (!App.Auth.isAdmin()) {
      filtered = filtered.filter(w =>
        w.createdById === App.Auth.user.id || w.status === 'approved'
      );
    }

    // Фильтр по периоду
    filtered = filtered.filter(w => (w.ts || 0) >= range.from && (w.ts || 0) <= range.to);

    // Фильтр по статусу
    if (App.state.writeoffsStatus !== 'all') {
      filtered = filtered.filter(w => w.status === App.state.writeoffsStatus);
    }

    // Фильтр по причине
    if (App.state.writeoffsReason !== 'all') {
      filtered = filtered.filter(w => w.reason === App.state.writeoffsReason);
    }

    // Поиск
    const search = (App.getSearch('writeoffs') || '').toLowerCase();
    if (search) {
      filtered = filtered.filter(w => {
        const fl = flowersMap.get(w.flowerId);
        return (w.reasonText || '').toLowerCase().includes(search) ||
               (fl && fl.name.toLowerCase().includes(search)) ||
               (w.createdBy || '').toLowerCase().includes(search);
      });
    }

    // Сортировка
    filtered.sort((a, b) => (b.ts || 0) - (a.ts || 0));

    const { items: rows, page: p, pages } = App.paginate(filtered, 'writeoffs');

    // Сводка
    const approved = filtered.filter(w => w.status === 'approved');
    const totalLoss = approved.reduce((s, w) => {
      const f = flowersMap.get(w.flowerId);
      return s + (f ? (f.purchasePrice || 0) * (w.quantity || 0) : 0);
    }, 0);
    const pendingCount = filtered.filter(w => w.status === 'pending').length;
    const totalQty = approved.reduce((s, w) => s + (w.quantity || 0), 0);

    // Статистика по причинам
    const byReason = {};
    for (const w of approved) {
      const f = flowersMap.get(w.flowerId);
      const loss = f ? (f.purchasePrice || 0) * (w.quantity || 0) : 0;
      const reasonLabel = getReasonInfo(w.reason).label;
      byReason[reasonLabel] = (byReason[reasonLabel] || 0) + loss;
    }

    let h = `
      <div class="g">
        <div class="card stat" style="background:linear-gradient(135deg,#fee2e2,#fecaca)">
          <div class="big">${App.fmtMoney(totalLoss)}</div>
          <div class="sm">Потери за период</div>
        </div>
        <div class="card stat">
          <div class="big">${approved.length}</div>
          <div class="sm">Утверждено списаний</div>
        </div>
        <div class="card stat">
          <div class="big">📦 ${totalQty}</div>
          <div class="sm">Единиц списано</div>
        </div>
        <div class="card stat" ${pendingCount > 0 ? 'style="background:linear-gradient(135deg,#fef3c7,#fde68a)"' : ''}>
          <div class="big">⏳ ${pendingCount}</div>
          <div class="sm">На проверке</div>
        </div>
      </div>

      ${Object.keys(byReason).length > 0 ? `
        <div class="card" style="margin-bottom:14px">
          <h4 style="margin-bottom:10px">📊 Потери по причинам</h4>
          <div style="display:grid;gap:6px">
            ${Object.entries(byReason).sort((a, b) => b[1] - a[1]).map(([reason, sum]) => `
              <div style="display:flex;justify-content:space-between;font-size:13px">
                <span>${reason}</span>
                <strong style="color:var(--bad)">${App.fmtMoney(sum)}</strong>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="tools">
        <input class="inp search" placeholder="Поиск по товару, причине, сотруднику..."
               value="${App.esc(App.getSearch('writeoffs'))}" data-search="writeoffs">
        <select class="inp" data-filter="status" style="width:auto;min-width:140px">
          <option value="all">Все статусы</option>
          ${WRITEOFF_STATUSES.map(s =>
            `<option value="${s.id}" ${App.state.writeoffsStatus === s.id ? 'selected' : ''}>${s.icon} ${s.label}</option>`
          ).join('')}
        </select>
        <select class="inp" data-filter="reason" style="width:auto;min-width:150px">
          <option value="all">Все причины</option>
          ${WRITEOFF_REASONS.map(r =>
            `<option value="${r.id}" ${App.state.writeoffsReason === r.id ? 'selected' : ''}>${r.label}</option>`
          ).join('')}
        </select>
        <select class="inp" data-filter="period" style="width:auto;min-width:130px">
          ${WRITEOFF_PERIODS.map(p =>
            `<option value="${p.id}" ${App.state.writeoffsPeriod === p.id ? 'selected' : ''}>${p.label}</option>`
          ).join('')}
        </select>
        <button class="btn" data-action="new">+ Списание</button>
        <button class="btn g" data-action="export">📤 CSV</button>
      </div>

      <div class="twrap"><table><thead><tr>
        <th>Дата</th><th>Товар</th><th>Кол-во</th><th>Сумма</th>
        <th>Причина</th><th>Статус</th><th>Автор</th><th></th>
      </tr></thead><tbody>
    `;

    if (!rows.length) {
      h += `
        <tr>
          <td colspan="8" style="text-align:center;padding:40px">
            <div style="font-size:48px;margin-bottom:10px">📉</div>
            <div style="color:var(--t3)">Списаний не найдено</div>
            <div class="hint" style="margin-top:8px">
              ${search || App.state.writeoffsStatus !== 'all' || App.state.writeoffsReason !== 'all'
                ? 'Попробуйте изменить фильтры'
                : 'Оформите первое списание, нажав кнопку выше'}
            </div>
          </td>
        </tr>
      `;
    }

    for (const w of rows) {
      const f = flowersMap.get(w.flowerId);
      const amount = f ? (f.purchasePrice || 0) * (w.quantity || 0) : 0;
      const statusInfo = getStatusInfo(w.status);
      const reasonInfo = getReasonInfo(w.reason);
      const createdBy = usersMap.get(w.createdById);
      const approvedBy = w.approvedById ? usersMap.get(w.approvedById) : null;
      const isPending = w.status === 'pending';
      const canApprove = isPending && App.Auth.isAdmin();

      h += `
        <tr>
          <td>${App.fmtDate(w.ts)}</td>
          <td>
            ${f
              ? `<strong>${f.emoji || '🌸'} ${App.esc(f.name)}</strong>`
              : '<span class="hint">товар удалён</span>'}
          </td>
          <td>${w.quantity || 0}</td>
          <td><strong style="color:var(--bad)">${App.fmtMoney(amount)}</strong></td>
          <td>
            <span class="badge" style="background:${reasonInfo.color};color:#1f1f1f">${reasonInfo.label}</span>
            ${w.reasonText ? `<div class="hint">${App.esc(w.reasonText).slice(0, 40)}${w.reasonText.length > 40 ? '...' : ''}</div>` : ''}
          </td>
          <td>
            <span class="badge ${statusInfo.badge}">${statusInfo.icon} ${statusInfo.label}</span>
            ${w.status === 'approved' && approvedBy
              ? `<div class="hint">✅ ${App.esc(approvedBy.name)} ${App.relTime(w.approvedAt)}</div>`
              : ''}
            ${w.status === 'rejected' && approvedBy
              ? `<div class="hint">❌ ${App.esc(approvedBy.name)} ${App.relTime(w.rejectedAt)}</div>`
              : ''}
          </td>
          <td>
            <div>${createdBy ? App.esc(createdBy.name) : '—'}</div>
            ${w.photo ? '<div class="hint">📷 есть фото</div>' : ''}
          </td>
          <td style="white-space:nowrap">
            <button class="ab" style="background:#e0e7ff;color:#3730a3" data-action="view" data-id="${w.id}">👁️</button>
            ${canApprove ? `
              <button class="ab" style="background:#d1fae5;color:#065f46" data-action="approve" data-id="${w.id}">✅</button>
              <button class="ab" style="background:#fee2e2;color:#991b1b" data-action="reject" data-id="${w.id}">❌</button>
            ` : ''}
            ${isPending && (App.Auth.isAdmin() || w.createdById === App.Auth.user.id)
              ? `<button class="ab" style="background:#dbeafe;color:#1e40af" data-action="edit" data-id="${w.id}">✏️</button>`
              : ''}
            ${(App.Auth.isAdmin() || w.createdById === App.Auth.user.id) && w.status !== 'approved'
              ? `<button class="ab" style="background:#fee2e2;color:#991b1b" data-action="delete" data-id="${w.id}">🗑️</button>`
              : ''}
          </td>
        </tr>
      `;
    }

    h += `</tbody></table></div>` + App.pagHTML(p, pages);

    App.$('#view').innerHTML = h;
    App.setLoading?.(false);

    _attachWriteoffsListeners();

  } catch (e) {
    console.error('renderWriteoffs error:', e);
    App.$('#view').innerHTML = `<div class="card" style="text-align:center;padding:40px;color:var(--bad)">
      Ошибка: ${App.esc(e.message)}
    </div>`;
    App.setLoading?.(false);
  }
};

/* ---------- Event delegation ---------- */
function _attachWriteoffsListeners() {
  const view = App.$('#view');
  if (!view || view.dataset.writeoffsListeners) return;
  view.dataset.writeoffsListeners = '1';

  let searchTimer;
  view.addEventListener('input', (e) => {
    if (e.target.matches('[data-search="writeoffs"]')) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        App.debouncedSearch('writeoffs', e.target.value, () => {
          App.state._forceRerender = true;
          App.renderWriteoffs();
        });
      }, 200);
    }
  });

  view.addEventListener('change', (e) => {
    if (e.target.matches('[data-filter="status"]')) {
      App.state.writeoffsStatus = e.target.value;
      App.setPage('writeoffs', 1);
      App.state._forceRerender = true;
      App.renderWriteoffs();
    } else if (e.target.matches('[data-filter="reason"]')) {
      App.state.writeoffsReason = e.target.value;
      App.setPage('writeoffs', 1);
      App.state._forceRerender = true;
      App.renderWriteoffs();
    } else if (e.target.matches('[data-filter="period"]')) {
      App.state.writeoffsPeriod = e.target.value;
      App.setPage('writeoffs', 1);
      App.state._forceRerender = true;
      App.renderWriteoffs();
    }
  });

  view.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) {
      const pgBtn = e.target.closest('[data-pg]');
      if (pgBtn) {
        App.setPage('writeoffs', parseInt(pgBtn.dataset.pg));
        App.state._forceRerender = true;
        App.renderWriteoffs();
      }
      return;
    }

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    switch (action) {
      case 'new':     App.editWriteoff(null); break;
      case 'edit':    App.editWriteoff(id); break;
      case 'view':    await App.showWriteoffDetails(id); break;
      case 'approve': await App.approveWriteoff(id); break;
      case 'reject':  await App.rejectWriteoff(id); break;
      case 'delete':  await App.deleteWriteoff(id); break;
      case 'export':  await App.exportWriteoffsCSV(); break;
    }
  });
}

/* ---------- Детальный просмотр ---------- */
App.showWriteoffDetails = async function(id) {
  try {
    const w = await App.repo('writeoffs').byId(id);
    if (!w) {
      App.Toast.er('Списание не найдено');
      return;
    }

    const [flowers, users] = await Promise.all([
      App.repo('flowers').all(),
      App.repo('users').all()
    ]);
    const flowersMap = new Map(flowers.map(f => [f.id, f]));
    const usersMap = new Map(users.map(u => [u.id, u]));

    const fl = flowersMap.get(w.flowerId);
    const statusInfo = getStatusInfo(w.status);
    const reasonInfo = getReasonInfo(w.reason);
    const createdBy = usersMap.get(w.createdById);
    const approvedBy = w.approvedById ? usersMap.get(w.approvedById) : null;
    const amount = fl ? (fl.purchasePrice || 0) * (w.quantity || 0) : 0;

    const h = `
      <div style="padding:10px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px">
          <div>
            <div style="font-size:20px;font-weight:800">📉 Списание</div>
            <div class="hint">от ${App.fmtDateTime(w.ts)}</div>
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
               <div class="hint">Закупочная цена: ${App.fmtMoney(fl.purchasePrice || 0)}</div>`
            : '<div class="hint">Товар удалён</div>'}
        </div>

        <div class="g" style="margin-bottom:16px">
          <div class="card" style="padding:12px;margin:0;text-align:center">
            <div class="big" style="font-size:18px">${w.quantity || 0}</div>
            <div class="sm">Количество</div>
          </div>
          <div class="card" style="padding:12px;margin:0;text-align:center">
            <div class="big" style="font-size:18px;color:var(--bad)">${App.fmtMoney(amount)}</div>
            <div class="sm">Сумма потерь</div>
          </div>
        </div>

        <div class="card" style="padding:12px;margin-bottom:16px">
          <div class="lbl">Причина</div>
          <div style="font-weight:600">${reasonInfo.label}</div>
          ${w.reasonText ? `<div style="margin-top:6px;padding:8px;background:var(--in);border-radius:6px">${App.esc(w.reasonText)}</div>` : ''}
        </div>

        ${w.photo ? `
          <div class="card" style="padding:12px;margin-bottom:16px">
            <div class="lbl">📷 Фото доказательство</div>
            <img src="${w.photo}" style="max-width:100%;border-radius:8px;margin-top:8px">
          </div>
        ` : ''}

        <div class="card" style="padding:12px;margin-bottom:16px">
          <div class="lbl">Автор</div>
          <div>${createdBy ? App.esc(createdBy.name) : '—'}</div>
          <div class="hint">${App.fmtDateTime(w.ts)}</div>
        </div>

        ${w.status === 'approved' && approvedBy ? `
          <div class="card" style="padding:12px;margin-bottom:16px;background:#d1fae5">
            <div class="lbl" style="color:#065f46">✅ Утверждено</div>
            <div><strong>${App.esc(approvedBy.name)}</strong></div>
            <div class="hint">${App.fmtDateTime(w.approvedAt)}</div>
            ${w.approvalComment ? `<div style="margin-top:6px">${App.esc(w.approvalComment)}</div>` : ''}
          </div>
        ` : ''}

        ${w.status === 'rejected' && approvedBy ? `
          <div class="card" style="padding:12px;margin-bottom:16px;background:#fee2e2">
            <div class="lbl" style="color:#991b1b">❌ Отклонено</div>
            <div><strong>${App.esc(approvedBy.name)}</strong></div>
            <div class="hint">${App.fmtDateTime(w.rejectedAt)}</div>
            ${w.rejectionComment ? `<div style="margin-top:6px">${App.esc(w.rejectionComment)}</div>` : ''}
          </div>
        ` : ''}

        <div style="display:flex;gap:8px;margin-top:20px;flex-wrap:wrap">
          ${w.status === 'pending' && App.Auth.isAdmin() ? `
            <button class="btn" data-action="approve" data-id="${w.id}">✅ Утвердить</button>
            <button class="btn d" data-action="reject" data-id="${w.id}">❌ Отклонить</button>
          ` : ''}
          <button class="btn g" id="closeWriteoffDetails">Закрыть</button>
        </div>
      </div>
    `;

    App.Modal.open('📉 Детали списания', h);

    setTimeout(() => {
      document.getElementById('closeWriteoffDetails').onclick = () => App.Modal.close();
      App.Modal.body().querySelectorAll('[data-action]').forEach(btn => {
        btn.onclick = async () => {
          const action = btn.dataset.action;
          const id = btn.dataset.id;
          App.Modal.close();
          if (action === 'approve') await App.approveWriteoff(id);
          else if (action === 'reject') await App.rejectWriteoff(id);
        };
      });
    }, 50);

  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- Создание/редактирование ---------- */
App._writeoffModalOpen = false;

App.editWriteoff = async function(id) {
  if (!App.Auth.can('employee', 'admin', 'owner')) {
    App.Toast.er('Нет доступа');
    return;
  }

  if (App._writeoffModalOpen) {
    App.Toast.wn('Окно уже открыто');
    return;
  }

  App._writeoffModalOpen = true;

  try {
    const w = id ? await App.repo('writeoffs').byId(id) : null;

    if (w && w.status !== 'pending') {
      App.Toast.er('Нельзя редактировать утверждённое/отклонённое списание');
      App._writeoffModalOpen = false;
      return;
    }

    const flowers = await App.repo('flowers').all();
    const activeFlowers = flowers.filter(f => f.active !== false);

    const flowerOpts = activeFlowers.map(f =>
      `<option value="${f.id}" ${w && w.flowerId === f.id ? 'selected' : ''}>
        ${f.emoji || '🌸'} ${App.esc(f.name)} (ост: ${f.stock || 0})
      </option>`
    ).join('');

    const isNew = !w;

    const h = `
      <form id="writeoffForm">
        <div class="row">
          <div>
            <label class="lbl">Товар *</label>
            <select class="inp" name="flowerId" required>
              <option value="">-- выберите --</option>
              ${flowerOpts}
            </select>
            <div id="flowerStockInfo" class="hint" style="margin-top:4px"></div>
          </div>
          <div>
            <label class="lbl">Количество *</label>
            <input type="number" class="inp" name="quantity" min="1" value="${w ? w.quantity : ''}" required>
          </div>
        </div>

        <div style="margin-top:12px">
          <label class="lbl">Причина *</label>
          <select class="inp" name="reason" required>
            ${WRITEOFF_REASONS.map(r =>
              `<option value="${r.id}" ${w && w.reason === r.id ? 'selected' : ''}>${r.label}</option>`
            ).join('')}
          </select>
        </div>

        <div style="margin-top:12px">
          <label class="lbl">Подробное описание</label>
          <textarea class="inp" name="reasonText" rows="2" maxlength="300"
                    placeholder="Подробности: что случилось, когда обнаружено...">${App.esc(w?.reasonText || '')}</textarea>
        </div>

        <div style="margin-top:12px">
          <label class="lbl">📷 Фото (доказательство)</label>
          <input type="file" class="inp" id="writeoffPhoto" accept="image/*">
          <div id="photoPreview" style="margin-top:8px">
            ${w?.photo ? `<img src="${w.photo}" style="max-width:200px;border-radius:8px">` : ''}
          </div>
        </div>

        <div id="writeoffInfo" style="margin-top:12px;padding:10px;background:var(--in);border-radius:8px;font-size:13px">
          ${App.Auth.isAdmin()
            ? '✅ Как администратор, списание будет сразу утверждено'
            : '⏳ Списание поступит на утверждение администратору'}
        </div>

        <div style="display:flex;gap:10px;margin-top:20px">
          <button type="submit" class="btn" style="flex:1">💾 Сохранить</button>
          <button type="button" class="btn g" style="flex:1" id="cancelBtn">Отмена</button>
        </div>
      </form>
    `;

    App.Modal.open(isNew ? '📉 Новое списание' : '✏️ Редактирование', h);
    App.Modal.onClose(() => {
      App._writeoffModalOpen = false;
    });

    let photoData = w?.photo || null;

    const flowerSelect = document.querySelector('[name="flowerId"]');
    const photoInput = document.getElementById('writeoffPhoto');
    const stockInfo = document.getElementById('flowerStockInfo');

    // Обновление информации об остатке
    async function updateStockInfo() {
      const fid = flowerSelect.value;
      if (!fid) {
        stockInfo.textContent = '';
        return;
      }
      const fl = flowers.find(f => f.id === fid);
      if (!fl) return;

      const reserved = await App.getReservedQty(fid);
      const available = (fl.stock || 0) - reserved;
      stockInfo.innerHTML = `В наличии: <strong>${fl.stock || 0}</strong> • Свободно: <strong>${Math.max(0, available)}</strong> (резерв: ${reserved})`;
    }

    flowerSelect.addEventListener('change', updateStockInfo);
    updateStockInfo();

    // Фото
    photoInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        photoData = await App.processImage(file);
        const preview = document.getElementById('photoPreview');
        if (preview) preview.innerHTML = `<img src="${photoData}" style="max-width:200px;border-radius:8px">`;
      } catch (err) {
        App.Toast.er(err.message);
      }
    });

    document.getElementById('cancelBtn').onclick = () => App.Modal.close();

    document.getElementById('writeoffForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await _saveWriteoff(id, e.target, photoData);
    });

  } catch (e) {
    console.error('editWriteoff error:', e);
    App.Toast.er('Ошибка: ' + e.message);
    App._writeoffModalOpen = false;
  }
};

async function _saveWriteoff(id, form, photoData) {
  try {
    const flowerId = form.flowerId.value; // строка БЕЗ parseInt
    const quantity = parseInt(form.quantity.value) || 0;
    const reason = form.reason.value;
    const reasonText = form.reasonText.value.trim();

    if (!flowerId || quantity <= 0 || !reason) {
      App.Toast.er('Заполните все обязательные поля');
      return;
    }

    const fl = await App.repo('flowers').byId(flowerId);
    if (!fl) {
      App.Toast.er('Товар не найден');
      return;
    }

    // Проверка с учётом резерва (ПРАВИЛЬНЫЙ async вызов!)
    const reserved = await App.getReservedQty(flowerId);
    const available = (fl.stock || 0) - reserved;

    if (quantity > available) {
      App.Toast.er(`Недостаточно товара. Свободно: ${Math.max(0, available)}`);
      return;
    }

    const isAdmin = App.Auth.isAdmin();
    const status = isAdmin ? 'approved' : 'pending';
    const reserved_flag = !isAdmin; // Резервируем только для сотрудников

    const isNew = !id;

    // Обновляем остатки
    if (reserved_flag) {
      // Резервируем для сотрудника (товар списывается только после утверждения)
      await App.repo('flowers').update(flowerId, {
        stock: (fl.stock || 0) - quantity,
        updatedAt: Date.now()
      });
      await App.recordStockMovement(flowerId, -quantity, 'writeoff_reserve');
    } else {
      // Админ сразу списывает
      await App.repo('flowers').update(flowerId, {
        stock: (fl.stock || 0) - quantity,
        writeoffs: (fl.writeoffs || 0) + quantity,
        updatedAt: Date.now()
      });
      await App.recordStockMovement(flowerId, -quantity, 'writeoff_approve');
    }

    const data = {
      id: id || App.uid(),
      flowerId,
      quantity,
      reason,
      reasonText,
      photo: photoData,
      ts: isNew ? Date.now() : (await App.repo('writeoffs').byId(id))?.ts || Date.now(),
      createdById: App.Auth.user.id,
      createdBy: App.Auth.user.name,
      status,
      reserved: reserved_flag,
      ...(isNew ? { createdAt: Date.now() } : { updatedAt: Date.now() })
    };

    await App.repo('writeoffs').save(data);

    if (App.Audit) {
      await App.Audit.log(
        isNew ? App.AUDIT_ACTIONS.WRITEOFF_CREATED : App.AUDIT_ACTIONS.UPDATE,
        {
          flowerName: fl.name,
          quantity,
          reason,
          status
        },
        'writeoffs',
        data.id
      );
    }

    App.Toast.ok(isNew
      ? (isAdmin ? 'Списание утверждено' : 'Списание отправлено на проверку')
      : 'Списание обновлено');
    App.Modal.close();
    App.state._forceRerender = true;
    App.renderWriteoffs();
    App.Notify?.checkLowStock();

  } catch (e) {
    console.error('saveWriteoff error:', e);
    App.Toast.er('Ошибка: ' + e.message);
  }
}

/* ---------- Утверждение ---------- */
App.approveWriteoff = async function(id) {
  if (!App.Auth.isAdmin()) {
    App.Toast.er('Только администратор');
    return;
  }

  if (App._approveLock.has(id)) return;
  App._approveLock.add(id);

  try {
    const w = await App.repo('writeoffs').byId(id);
    if (!w || w.status !== 'pending') {
      App.Toast.wn('Списание не найдено или уже обработано');
      App._approveLock.delete(id);
      return;
    }

    // Подтверждение с комментарием
    const comment = await App.Modal.prompt(
      'Комментарий к утверждению (опционально):',
      '✅ Утверждение списания'
    );
    if (comment === null) {
      App._approveLock.delete(id);
      return;
    }

    const fl = await App.repo('flowers').byId(w.flowerId);
    if (!fl) {
      App.Toast.er('Товар не найден');
      App._approveLock.delete(id);
      return;
    }

    if (w.reserved) {
      // Товар уже зарезервирован — просто увеличиваем writeoffs
      await App.repo('flowers').update(fl.id, {
        writeoffs: (fl.writeoffs || 0) + w.quantity
      });
      await App.recordStockMovement(w.flowerId, 0, 'writeoff_approve_reserved');
    } else {
      // Маловероятно, но для безопасности
      if (w.quantity > (fl.stock || 0)) {
        App.Toast.er('Недостаточно товара для списания');
        App._approveLock.delete(id);
        return;
      }
      await App.repo('flowers').update(fl.id, {
        stock: (fl.stock || 0) - w.quantity,
        writeoffs: (fl.writeoffs || 0) + w.quantity,
        updatedAt: Date.now()
      });
      await App.recordStockMovement(w.flowerId, -w.quantity, 'writeoff_approve');
    }

    await App.repo('writeoffs').update(w.id, {
      status: 'approved',
      approvedById: App.Auth.user.id,
      approvedAt: Date.now(),
      approvalComment: comment || ''
    });

    if (App.Audit) {
      await App.Audit.log(App.AUDIT_ACTIONS.UPDATE, {
        action: 'approve_writeoff',
        flowerName: fl.name,
        quantity: w.quantity,
        comment
      }, 'writeoffs', w.id);
    }

    App.Toast.ok('Списание утверждено');
    App.state._forceRerender = true;
    App.renderWriteoffs();
    App.renderDashboard?.();
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  } finally {
    App._approveLock.delete(id);
  }
};

/* ---------- Отклонение ---------- */
App.rejectWriteoff = async function(id) {
  if (!App.Auth.isAdmin()) {
    App.Toast.er('Только администратор');
    return;
  }

  if (App._approveLock.has(id)) return;
  App._approveLock.add(id);

  try {
    const w = await App.repo('writeoffs').byId(id);
    if (!w || w.status !== 'pending') {
      App.Toast.wn('Списание не найдено или уже обработано');
      App._approveLock.delete(id);
      return;
    }

    // Комментарий обязателен при отклонении
    const comment = await App.Modal.prompt(
      'Причина отклонения (обязательно):',
      '❌ Отклонение списания'
    );
    if (!comment || !comment.trim()) {
      App.Toast.wn('Укажите причину отклонения');
      App._approveLock.delete(id);
      return;
    }

    // Возврат товара если был зарезервирован
    if (w.reserved) {
      const fl = await App.repo('flowers').byId(w.flowerId);
      if (fl) {
        await App.repo('flowers').update(fl.id, {
          stock: (fl.stock || 0) + w.quantity,
          updatedAt: Date.now()
        });
        await App.recordStockMovement(w.flowerId, w.quantity, 'writeoff_reject');
      }
    }

    await App.repo('writeoffs').update(w.id, {
      status: 'rejected',
      approvedById: App.Auth.user.id,
      rejectedAt: Date.now(),
      rejectionComment: comment.trim()
    });

    if (App.Audit) {
      await App.Audit.log(App.AUDIT_ACTIONS.UPDATE, {
        action: 'reject_writeoff',
        reason: comment
      }, 'writeoffs', w.id);
    }

    App.Toast.ok('Списание отклонено' + (w.reserved ? ', товар возвращён' : ''));
    App.state._forceRerender = true;
    App.renderWriteoffs();
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  } finally {
    App._approveLock.delete(id);
  }
};

/* ---------- Удаление ---------- */
App.deleteWriteoff = async function(id) {
  try {
    const w = await App.repo('writeoffs').byId(id);
    if (!w) {
      App.Toast.er('Списание не найдено');
      return;
    }

    if (w.status === 'approved') {
      App.Toast.er('Нельзя удалить утверждённое списание. Создайте корректировку.');
      return;
    }

    if (!App.Auth.isAdmin() && w.createdById !== App.Auth.user.id) {
      App.Toast.er('Нет прав на удаление');
      return;
    }

    const confirmed = await App.Modal.confirm(
      `Удалить списание?${w.reserved ? '\nТовар будет возвращён на склад.' : ''}`,
      'Удаление списания',
      { danger: true, okText: 'Удалить' }
    );
    if (!confirmed) return;

    // Возврат товара
    if (w.reserved) {
      const fl = await App.repo('flowers').byId(w.flowerId);
      if (fl) {
        await App.repo('flowers').update(fl.id, {
          stock: (fl.stock || 0) + w.quantity,
          updatedAt: Date.now()
        });
        await App.recordStockMovement(w.flowerId, w.quantity, 'writeoff_delete');
      }
    }

    await App.repo('writeoffs').remove(id);

    if (App.Audit) {
      await App.Audit.log(App.AUDIT_ACTIONS.DELETE, {
        writeoffId: id,
        wasReserved: w.reserved
      }, 'writeoffs', id);
    }

    App.Toast.ok('Списание удалено');
    App.state._forceRerender = true;
    App.renderWriteoffs();
    App.Notify?.checkLowStock();
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- Экспорт в CSV ---------- */
App.exportWriteoffsCSV = async function() {
  try {
    const [writeoffs, flowers, users] = await Promise.all([
      App.repo('writeoffs').all(),
      App.repo('flowers').all(),
      App.repo('users').all()
    ]);

    const flowersMap = new Map(flowers.map(f => [f.id, f]));
    const usersMap = new Map(users.map(u => [u.id, u]));
    const range = getDateRange(App.state.writeoffsPeriod);

    let filtered = writeoffs.filter(w =>
      (w.ts || 0) >= range.from && (w.ts || 0) <= range.to
    );

    if (!App.Auth.isAdmin()) {
      filtered = filtered.filter(w =>
        w.createdById === App.Auth.user.id || w.status === 'approved'
      );
    }

    if (!filtered.length) {
      App.Toast.wn('Нет данных для экспорта');
      return;
    }

    const headers = [
      'Дата', 'Товар', 'Количество', 'Цена', 'Сумма', 'Причина',
      'Описание', 'Статус', 'Автор', 'Утвердил', 'Комментарий'
    ];

    const rows = filtered
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .map(w => {
        const fl = flowersMap.get(w.flowerId);
        const createdBy = usersMap.get(w.createdById);
        const approvedBy = w.approvedById ? usersMap.get(w.approvedById) : null;
        const reasonInfo = getReasonInfo(w.reason);
        const statusInfo = getStatusInfo(w.status);
        const amount = fl ? (fl.purchasePrice || 0) * (w.quantity || 0) : 0;

        return [
          App.fmtDateTime(w.ts),
          fl?.name || '',
          w.quantity || 0,
          fl?.purchasePrice || 0,
          amount,
          reasonInfo.label,
          w.reasonText || '',
          statusInfo.label,
          createdBy?.name || '',
          approvedBy?.name || '',
          w.approvalComment || w.rejectionComment || ''
        ];
      });

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const periodLabel = WRITEOFF_PERIODS.find(p => p.id === App.state.writeoffsPeriod)?.label || '';
    a.download = `writeoffs_${periodLabel}_${App.toLocalDateString(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    App.Toast.ok(`Экспортировано ${filtered.length} списаний`);

    if (App.Audit) {
      await App.Audit.logExport('writeoffs', filtered.length, { period: periodLabel });
    }
  } catch (e) {
    App.Toast.er('Ошибка экспорта: ' + e.message);
  }
};

console.log('✅ writeoffs.js загружен');