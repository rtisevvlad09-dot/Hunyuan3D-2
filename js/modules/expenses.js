// ===== РАСХОДЫ =====
// js/modules/expenses.js
// v2.0 — с фильтрами, сводкой, графиком, редактированием

window.App = window.App || {};

/* ---------- Периоды для фильтра ---------- */
const EXPENSE_PERIODS = [
  { id: 'week',    label: 'Неделя',   days: 7 },
  { id: 'month',   label: 'Месяц',    days: 30 },
  { id: 'quarter', label: 'Квартал',  days: 90 },
  { id: 'year',    label: 'Год',      days: 365 },
  { id: 'all',     label: 'Всё время', days: -1 }
];

/* ---------- Иконки категорий ---------- */
const CATEGORY_ICONS = {
  'Налоги': '🏛️',
  'Аренда': '🏢',
  'Коммунальные': '💡',
  'Хостинг': '🌐',
  'Реклама': '📣',
  'Упаковка': '📦',
  'Гелий': '🎈',
  'Зарплата': '💼',
  'Транспорт': '🚚',
  'Прочее': '📝'
};

/* ---------- Утилиты ---------- */
function getDateRange(periodId) {
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  const period = EXPENSE_PERIODS.find(p => p.id === periodId) || EXPENSE_PERIODS[1];

  if (period.days === -1) {
    return { from: 0, to: now.getTime() };
  }

  const from = new Date();
  from.setDate(from.getDate() - period.days);
  from.setHours(0, 0, 0, 0);

  return { from: from.getTime(), to: now.getTime() };
}

function getPreviousRange(periodId) {
  const { from, to } = getDateRange(periodId);
  const duration = to - from;
  return { from: from - duration, to: from - 1 };
}

function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || '📝';
}

/* ---------- Основной рендер ---------- */
App.renderExpenses = async function() {
  if (!App.Auth.can('owner', 'admin')) {
    App.$('#view').innerHTML = '<div class="card" style="text-align:center;padding:40px">Нет доступа</div>';
    return;
  }

  App.setLoading?.(true);

  try {
    // Инициализация состояния
    if (!App.state.expensesPeriod) App.state.expensesPeriod = 'month';
    if (!App.state.expensesCategory) App.state.expensesCategory = 'all';
    if (!App.state.expensesSort) App.state.expensesSort = 'date';

    const all = await App.repo('expenses').all();
    const range = getDateRange(App.state.expensesPeriod);
    const prevRange = getPreviousRange(App.state.expensesPeriod);

    // Фильтрация по периоду
    let periodExpenses = all.filter(e =>
      e.ts >= range.from && e.ts <= range.to
    );
    const prevExpenses = all.filter(e =>
      e.ts >= prevRange.from && e.ts <= prevRange.to
    );

    // Фильтр по категории
    if (App.state.expensesCategory !== 'all') {
      periodExpenses = periodExpenses.filter(e => e.category === App.state.expensesCategory);
    }

    // Поиск
    const search = (App.getSearch('expenses') || '').toLowerCase();
    if (search) {
      periodExpenses = periodExpenses.filter(e =>
        (e.category || '').toLowerCase().includes(search) ||
        (e.description || '').toLowerCase().includes(search)
      );
    }

    // Сортировка
    if (App.state.expensesSort === 'amount') {
      periodExpenses.sort((a, b) => (b.amount || 0) - (a.amount || 0));
    } else if (App.state.expensesSort === 'category') {
      periodExpenses.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
    } else {
      periodExpenses.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    }

    const { items: rows, page: p, pages } = App.paginate(periodExpenses, 'expenses');

    // Общая сумма за период
    const total = periodExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const prevTotal = prevExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const changePercent = prevTotal > 0
      ? ((total - prevTotal) / prevTotal * 100)
      : (total > 0 ? 100 : 0);

    // Сводка по категориям
    const byCategory = {};
    for (const e of periodExpenses) {
      const cat = e.category || 'Прочее';
      byCategory[cat] = (byCategory[cat] || 0) + (e.amount || 0);
    }
    const categoryStats = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1]);

    // Все категории (для фильтра)
    const allCategories = [...new Set(all.map(e => e.category).filter(Boolean))].sort();

    // Тренд
    const trendIcon = changePercent > 0 ? '↑' : changePercent < 0 ? '↓' : '—';
    const trendColor = changePercent > 0 ? 'var(--bad)' : changePercent < 0 ? 'var(--good)' : 'var(--t3)';
    const trendText = changePercent !== 0
      ? `${trendIcon} ${Math.abs(changePercent).toFixed(1)}% vs прошлый период`
      : 'Без изменений';

    let h = `
      <div class="tools">
        <input class="inp search" placeholder="Поиск по категории или описанию..."
               value="${App.esc(App.getSearch('expenses'))}" data-search="expenses">
        <select class="inp" data-filter="period" style="width:auto;min-width:130px">
          ${EXPENSE_PERIODS.map(p =>
            `<option value="${p.id}" ${App.state.expensesPeriod === p.id ? 'selected' : ''}>${p.label}</option>`
          ).join('')}
        </select>
        <select class="inp" data-filter="category" style="width:auto;min-width:150px">
          <option value="all">Все категории</option>
          ${allCategories.map(c =>
            `<option value="${App.esc(c)}" ${App.state.expensesCategory === c ? 'selected' : ''}>${getCategoryIcon(c)} ${App.esc(c)}</option>`
          ).join('')}
        </select>
        <select class="inp" data-sort="expenses" style="width:auto;min-width:140px">
          <option value="date" ${App.state.expensesSort === 'date' ? 'selected' : ''}>По дате</option>
          <option value="amount" ${App.state.expensesSort === 'amount' ? 'selected' : ''}>По сумме</option>
          <option value="category" ${App.state.expensesSort === 'category' ? 'selected' : ''}>По категории</option>
        </select>
        <button class="btn" data-action="new">+ Расход</button>
        <button class="btn g" data-action="export">📤 CSV</button>
      </div>

      <div class="g">
        <div class="card stat" style="background:linear-gradient(135deg,#fee2e2,#fecaca)">
          <div class="big">${App.fmtMoney(total)}</div>
          <div class="sm">Расходы за период</div>
          <div style="margin-top:6px;color:${trendColor};font-size:11px;font-weight:600">${trendText}</div>
        </div>
        <div class="card stat">
          <div class="big">${periodExpenses.length}</div>
          <div class="sm">Операций</div>
        </div>
        <div class="card stat">
          <div class="big">${periodExpenses.length > 0 ? App.fmtMoney(total / periodExpenses.length) : App.fmtMoney(0)}</div>
          <div class="sm">Средний расход</div>
        </div>
        <div class="card stat">
          <div class="big">${categoryStats.length}</div>
          <div class="sm">Категорий</div>
        </div>
      </div>
    `;

    // Сводка по категориям (если есть данные)
    if (categoryStats.length > 0) {
      h += `
        <div class="card" style="margin-bottom:14px">
          <h4 style="margin-bottom:12px">📊 Расходы по категориям</h4>
          <div style="display:grid;gap:8px">
      `;

      for (const [cat, sum] of categoryStats) {
        const pct = total > 0 ? (sum / total * 100) : 0;
        h += `
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:120px;font-size:13px">${getCategoryIcon(cat)} ${App.esc(cat)}</div>
            <div style="flex:1;background:var(--in);border-radius:4px;height:8px;overflow:hidden">
              <div style="background:var(--bad);height:100%;width:${pct}%;border-radius:4px"></div>
            </div>
            <div style="width:100px;text-align:right;font-size:12px">
              <strong>${App.fmtMoney(sum)}</strong>
              <span class="hint"> (${pct.toFixed(1)}%)</span>
            </div>
          </div>
        `;
      }

      h += '</div></div>';
    }

    // Таблица расходов
    h += `
      <div class="twrap"><table><thead><tr>
        <th>Дата</th><th>Категория</th><th>Описание</th><th>Сумма</th><th></th>
      </tr></thead><tbody>
    `;

    if (!rows.length) {
      h += `
        <tr>
          <td colspan="5" style="text-align:center;padding:40px">
            <div style="font-size:48px;margin-bottom:10px">💸</div>
            <div style="color:var(--t3)">Расходов не найдено</div>
            <div class="hint" style="margin-top:8px">
              ${search || App.state.expensesCategory !== 'all'
                ? 'Попробуйте изменить фильтры'
                : 'Добавьте первый расход, нажав кнопку выше'}
            </div>
          </td>
        </tr>
      `;
    }

    for (const e of rows) {
      h += `
        <tr>
          <td>${App.fmtDate(e.ts)}</td>
          <td>
            <span class="badge binfo">
              ${getCategoryIcon(e.category)} ${App.esc(e.category || 'Прочее')}
            </span>
          </td>
          <td>${App.esc(e.description || '—')}</td>
          <td><strong style="color:var(--bad)">${App.fmtMoney(e.amount)}</strong></td>
          <td style="white-space:nowrap">
            <button class="ab" style="background:#dbeafe;color:#1e40af" data-action="duplicate" data-id="${e.id}" title="Повторить">📋</button>
            <button class="ab" style="background:#fef3c7;color:#92400e" data-action="edit" data-id="${e.id}">✏️</button>
            <button class="ab" style="background:#fee2e2;color:#991b1b" data-action="delete" data-id="${e.id}">🗑️</button>
          </td>
        </tr>
      `;
    }

    h += `</tbody></table></div>` + App.pagHTML(p, pages);

    App.$('#view').innerHTML = h;
    App.setLoading?.(false);

    _attachExpensesListeners();

  } catch (e) {
    console.error('renderExpenses error:', e);
    App.$('#view').innerHTML = `<div class="card" style="text-align:center;padding:40px;color:var(--bad)">
      Ошибка: ${App.esc(e.message)}
    </div>`;
    App.setLoading?.(false);
  }
};

/* ---------- Event delegation ---------- */
function _attachExpensesListeners() {
  const view = App.$('#view');
  if (!view || view.dataset.expensesListeners) return;
  view.dataset.expensesListeners = '1';

  let searchTimer;
  view.addEventListener('input', (e) => {
    if (e.target.matches('[data-search="expenses"]')) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        App.debouncedSearch('expenses', e.target.value, () => {
          App.state._forceRerender = true;
          App.renderExpenses();
        });
      }, 200);
    }
  });

  view.addEventListener('change', (e) => {
    if (e.target.matches('[data-filter="period"]')) {
      App.state.expensesPeriod = e.target.value;
      App.setPage('expenses', 1);
      App.state._forceRerender = true;
      App.renderExpenses();
    } else if (e.target.matches('[data-filter="category"]')) {
      App.state.expensesCategory = e.target.value;
      App.setPage('expenses', 1);
      App.state._forceRerender = true;
      App.renderExpenses();
    } else if (e.target.matches('[data-sort="expenses"]')) {
      App.state.expensesSort = e.target.value;
      App.state._forceRerender = true;
      App.renderExpenses();
    }
  });

  view.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      switch (action) {
        case 'new':
          App.editExpense(null);
          break;
        case 'edit':
          App.editExpense(id);
          break;
        case 'duplicate':
          await App.duplicateExpense(id);
          break;
        case 'delete':
          await App.deleteExpense(id);
          break;
        case 'export':
          await App.exportExpensesCSV();
          break;
      }
      return;
    }

    const pgBtn = e.target.closest('[data-pg]');
    if (pgBtn) {
      App.setPage('expenses', parseInt(pgBtn.dataset.pg));
      App.state._forceRerender = true;
      App.renderExpenses();
    }
  });
}

/* ---------- Создание/редактирование ---------- */
App._expenseModalOpen = false;

App.editExpense = async function(id) {
  if (!App.Auth.isAdmin()) {
    App.Toast.er('Нет доступа');
    return;
  }

  if (App._expenseModalOpen) {
    App.Toast.wn('Окно уже открыто');
    return;
  }

  App._expenseModalOpen = true;

  try {
    const e = id ? await App.repo('expenses').byId(id) : null;
    const isNew = !e;

    // Все существующие категории + стандартные
    const existingCats = [...new Set((await App.repo('expenses').all()).map(x => x.category).filter(Boolean))];
    const allCats = [...new Set([...App.EXPENSE_CATS, ...existingCats])].sort();

    const h = `
      <form id="expenseForm">
        <div class="row">
          <div>
            <label class="lbl">Категория *</label>
            <select class="inp" name="category" required>
              <option value="">-- выберите --</option>
              ${allCats.map(c =>
                `<option value="${App.esc(c)}" ${e && e.category === c ? 'selected' : ''}>
                  ${getCategoryIcon(c)} ${App.esc(c)}
                </option>`
              ).join('')}
            </select>
            <input class="inp" name="customCategory" placeholder="Или введите новую..."
                   style="margin-top:6px;display:none" data-custom-cat>
            <button type="button" class="btn g" style="margin-top:6px;padding:4px 10px;font-size:12px"
                    id="toggleCustomCat">+ Новая категория</button>
          </div>
          <div>
            <label class="lbl">Сумма (₽) *</label>
            <input type="number" class="inp" name="amount" min="0.01" step="0.01"
                   value="${e ? e.amount : ''}" required>
          </div>
        </div>
        <div class="row" style="margin-top:12px">
          <div>
            <label class="lbl">Дата *</label>
            <input type="date" class="inp" name="date"
                   value="${e ? App.toLocalDateString(e.ts) : App.toLocalDateString(new Date())}" required>
          </div>
          <div>
            <label class="lbl">Описание</label>
            <input class="inp" name="description" maxlength="200"
                   value="${App.esc(e ? e.description || '' : '')}"
                   placeholder="Комментарий к расходу">
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px">
          <button type="submit" class="btn" style="flex:1">💾 Сохранить</button>
          <button type="button" class="btn g" style="flex:1" id="cancelBtn">Отмена</button>
        </div>
      </form>
    `;

    App.Modal.open(isNew ? 'Новый расход' : 'Редактирование расхода', h);
    App.Modal.onClose(() => {
      App._expenseModalOpen = false;
    });

    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) cancelBtn.onclick = () => App.Modal.close();

    // Переключение на свою категорию
    const toggleBtn = document.getElementById('toggleCustomCat');
    const customInput = App.Modal.body().querySelector('[data-custom-cat]');
    const categorySelect = App.Modal.body().querySelector('[name="category"]');

    if (toggleBtn && customInput) {
      toggleBtn.onclick = () => {
        if (customInput.style.display === 'none') {
          customInput.style.display = 'block';
          categorySelect.value = '';
          categorySelect.disabled = true;
          customInput.focus();
          toggleBtn.textContent = '← Выбрать из списка';
        } else {
          customInput.style.display = 'none';
          customInput.value = '';
          categorySelect.disabled = false;
          toggleBtn.textContent = '+ Новая категория';
        }
      };
    }

    const form = document.getElementById('expenseForm');
    if (form) {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        await _saveExpense(id);
      });
    }

  } catch (e) {
    console.error('editExpense error:', e);
    App.Toast.er('Ошибка: ' + e.message);
    App._expenseModalOpen = false;
  }
};

async function _saveExpense(id) {
  try {
    const f = document.getElementById('expenseForm');
    if (!f) return;

    const customCatInput = f.querySelector('[data-custom-cat]');
    const categorySelect = f.querySelector('[name="category"]');

    let category = customCatInput.style.display !== 'none' && customCatInput.value.trim()
      ? customCatInput.value.trim()
      : categorySelect.value;

    if (!category) {
      App.Toast.er('Выберите или введите категорию');
      return;
    }

    const amount = parseFloat(f.amount.value);
    if (!amount || amount <= 0) {
      App.Toast.er('Сумма должна быть больше нуля');
      return;
    }

    const dateValue = f.date.value;
    const ts = App.parseLocalDate(dateValue);
    if (!ts) {
      App.Toast.er('Укажите корректную дату');
      return;
    }

    const description = f.description.value.trim();
    const isNew = !id;

    if (isNew) {
      await App.repo('expenses').save({
        id: App.uid(),
        category,
        amount,
        ts,
        description,
        createdById: App.Auth.user.id,
        createdAt: Date.now()
      });
    } else {
      const existing = await App.repo('expenses').byId(id);
      if (!existing) {
        App.Toast.er('Расход не найден');
        return;
      }
      await App.repo('expenses').save({
        ...existing,
        category,
        amount,
        ts,
        description,
        updatedAt: Date.now()
      });
    }

    if (App.Audit) {
      await App.Audit.log(
        isNew ? App.AUDIT_ACTIONS.EXPENSE_ADDED : App.AUDIT_ACTIONS.UPDATE,
        { category, amount, description },
        'expenses',
        id || category
      );
    }

    App.Toast.ok(isNew ? 'Расход добавлен' : 'Расход обновлён');
    App.Modal.close();
    App.rerender();

  } catch (e) {
    console.error('saveExpense error:', e);
    App.Toast.er('Ошибка: ' + e.message);
  }
}

/* ---------- Дублирование ---------- */
App.duplicateExpense = async function(id) {
  try {
    const original = await App.repo('expenses').byId(id);
    if (!original) {
      App.Toast.er('Расход не найден');
      return;
    }

    // Предзаполняем форму
    const copy = {
      ...original,
      id: null, // будет создан новый
      ts: Date.now(),
      description: (original.description || '') + ' (копия)'
    };

    // Сохраняем во временный буфер и открываем модалку редактирования
    // Хак: создаём через editExpense с предустановленными данными
    App._expenseDraft = copy;

    // Открываем новую модалку с данными из копии
    const e = copy;
    const existingCats = [...new Set((await App.repo('expenses').all()).map(x => x.category).filter(Boolean))];
    const allCats = [...new Set([...App.EXPENSE_CATS, ...existingCats])].sort();

    const h = `
      <form id="expenseForm">
        <div class="row">
          <div>
            <label class="lbl">Категория *</label>
            <select class="inp" name="category" required>
              <option value="">-- выберите --</option>
              ${allCats.map(c =>
                `<option value="${App.esc(c)}" ${e.category === c ? 'selected' : ''}>
                  ${getCategoryIcon(c)} ${App.esc(c)}
                </option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label class="lbl">Сумма (₽) *</label>
            <input type="number" class="inp" name="amount" min="0.01" step="0.01"
                   value="${e.amount}" required>
          </div>
        </div>
        <div class="row" style="margin-top:12px">
          <div>
            <label class="lbl">Дата *</label>
            <input type="date" class="inp" name="date"
                   value="${App.toLocalDateString(new Date())}" required>
          </div>
          <div>
            <label class="lbl">Описание</label>
            <input class="inp" name="description" maxlength="200"
                   value="${App.esc(e.description || '')}">
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px">
          <button type="submit" class="btn" style="flex:1">💾 Создать копию</button>
          <button type="button" class="btn g" style="flex:1" id="cancelBtn">Отмена</button>
        </div>
      </form>
    `;

    App.Modal.open('Повторить расход', h);

    document.getElementById('cancelBtn').onclick = () => App.Modal.close();
    document.getElementById('expenseForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      await _saveExpense(null);
    });

  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- Удаление ---------- */
App.deleteExpense = async function(id) {
  if (!App.Auth.isAdmin()) return;

  try {
    const expense = await App.repo('expenses').byId(id);
    if (!expense) return;

    const confirmed = await App.Modal.confirm(
      `Удалить расход "${expense.category}" на ${App.fmtMoney(expense.amount)}?`
    );

    if (!confirmed) return;

    await App.repo('expenses').remove(id);

    if (App.Audit) {
      await App.Audit.log(App.AUDIT_ACTIONS.DELETE,
        { category: expense.category, amount: expense.amount },
        'expenses', id);
    }

    App.Toast.ok('Расход удалён');
    App.rerender();
  } catch (e) {
    App.Toast.er('Ошибка: ' + e.message);
  }
};

/* ---------- Экспорт в CSV ---------- */
App.exportExpensesCSV = async function() {
  try {
    const all = await App.repo('expenses').all();
    const range = getDateRange(App.state.expensesPeriod);
    const expenses = all.filter(e => e.ts >= range.from && e.ts <= range.to);

    if (expenses.length === 0) {
      App.Toast.wn('Нет данных для экспорта');
      return;
    }

    const headers = ['Дата', 'Категория', 'Сумма', 'Описание'];
    const rows = expenses
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .map(e => [
        App.fmtDate(e.ts),
        e.category || '',
        e.amount || 0,
        e.description || ''
      ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const periodLabel = EXPENSE_PERIODS.find(p => p.id === App.state.expensesPeriod)?.label || '';
    a.download = `expenses_${periodLabel}_${App.toLocalDateString(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    App.Toast.ok(`Экспортировано ${expenses.length} расходов`);

    if (App.Audit) {
      await App.Audit.logExport('expenses', expenses.length, { period: periodLabel });
    }
  } catch (e) {
    App.Toast.er('Ошибка экспорта: ' + e.message);
  }
};

console.log('✅ expenses.js загружен');