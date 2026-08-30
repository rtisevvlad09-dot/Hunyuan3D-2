/* =========================================================
 *  js/modules/staff.js
 *  Управление персоналом + настройка прав доступа
 *  v3.0 — с системой permissions
 * ========================================================= */

window.App = window.App || {};

App.renderStaff = async function() {
  if (!App.Auth.can('owner', 'admin')) {
    App.$('#view').innerHTML = '<div class="card" style="text-align:center;padding:40px">Нет доступа</div>';
    return;
  }

  App.setLoading?.(true);

  try {
    var users = await App.repo('users').all();
    var visible = App.Auth.isAdmin()
      ? users
      : users.filter(function(u) { return u.id === App.Auth.user.id; });

    var totalActive = users.filter(function(u) { return u.active !== false; }).length;
    var totalWith2FA = users.filter(function(u) { return u.tfaEnabled; }).length;
    var totalEmployees = users.filter(function(u) { return u.role === 'employee'; }).length;

    var h = `
      <div class="g stagger">
        <div class="card stat shine magnetic">
          <div class="big">${users.length}</div>
          <div class="sm">Всего</div>
        </div>
        <div class="card stat shine magnetic">
          <div class="big">${totalActive}</div>
          <div class="sm">Активных</div>
        </div>
        <div class="card stat shine magnetic">
          <div class="big">${totalEmployees}</div>
          <div class="sm">Сотрудников</div>
        </div>
        <div class="card stat shine magnetic">
          <div class="big">${totalWith2FA}</div>
          <div class="sm">С 2FA</div>
        </div>
      </div>

      <div class="tools">
        <input class="inp search" placeholder="Поиск сотрудника..."
               value="${App.esc(App.getSearch('staff'))}" data-search="staff">
        <button class="btn glow" data-action="new">+ Сотрудник</button>
        <button class="btn g" data-action="export">📤 CSV</button>
      </div>

      <div class="twrap"><table><thead><tr>
        <th>Сотрудник</th><th>Роль</th><th>Телефон</th>
        <th>Доступ</th><th>Статус</th><th></th>
      </tr></thead><tbody>
    `;

    if (!visible.length) {
      h += '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--t3)">Нет сотрудников</td></tr>';
    }

    for (var i = 0; i < visible.length; i++) {
      var u = visible[i];
      var isSelf = u.id === App.Auth.user.id;
      var isOwner = u.role === 'owner';
      var isActive = u.active !== false;

      // Подсчёт доступных модулей
      var perms = u.permissions || {};
      var accessCount = 0;
      if (u.role === 'owner' || u.role === 'admin') {
        accessCount = App.MODULES.length;
      } else {
        accessCount = App.MODULES.filter(function(m) { return perms[m.id]; }).length;
      }

      h += `<tr style="${!isActive ? 'opacity:.6' : ''}">
        <td>
          <strong>${u.emoji || '👤'} ${App.esc(u.name)}</strong>
          ${u.position ? '<div class="hint">' + App.esc(u.position) + '</div>' : ''}
        </td>
        <td><span class="badge binfo">${App.ROLES[u.role] || u.role}</span></td>
        <td>${App.esc(u.phone)}</td>
        <td>
          <span class="badge ${u.role === 'employee' ? 'bwa' : 'bok'}">${accessCount} / ${App.MODULES.length}</span>
        </td>
        <td>
          <div style="display:flex;gap:3px;flex-wrap:wrap">
            ${isActive ? '<span class="badge bok">Активен</span>' : '<span class="badge bda">Заблок.</span>'}
            ${u.tfaEnabled ? '<span class="badge binfo">🔐 2FA</span>' : ''}
          </div>
        </td>
        <td style="white-space:nowrap">
          <button class="ab" style="background:#e0e7ff;color:#3730a3" data-action="view" data-id="${u.id}" title="Статистика">📊</button>
          ${!isSelf && !isOwner ? `
            <button class="ab" style="background:#dbeafe;color:#1e40af" data-action="edit" data-id="${u.id}" title="Редактировать">✏️</button>
            ${u.role === 'employee' ? `
              <button class="ab" style="background:#d1fae5;color:#065f46" data-action="permissions" data-id="${u.id}" title="Права доступа">🔐</button>
            ` : ''}
            <button class="ab" style="background:#fef3c7;color:#92400e" data-action="toggle" data-id="${u.id}" title="${isActive ? 'Заблокировать' : 'Разблокировать'}">
              ${isActive ? '🚫' : '✅'}
            </button>
            <button class="ab" style="background:#e8daef;color:#6c3483" data-action="resetPw" data-id="${u.id}" title="Сброс пароля">🔑</button>
            <button class="ab" style="background:#fee2e2;color:#991b1b" data-action="delete" data-id="${u.id}" title="Удалить">🗑️</button>
          ` : ''}
        </td>
      </tr>`;
    }

    h += '</tbody></table></div>';

    App.$('#view').innerHTML = h;
    App.setLoading?.(false);

    _attachStaffListeners();

  } catch (e) {
    console.error('renderStaff error:', e);
    App.$('#view').innerHTML = '<div class="card" style="color:var(--bad)">Ошибка: ' + App.esc(e.message) + '</div>';
    App.setLoading?.(false);
  }
};

function _attachStaffListeners() {
  var view = App.$('#view');
  if (!view || view.dataset.staffListeners) return;
  view.dataset.staffListeners = '1';

  var searchTimer;
  view.addEventListener('input', function(e) {
    if (e.target.matches('[data-search="staff"]')) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function() {
        App.setSearch('staff', e.target.value);
        App.renderStaff();
      }, 200);
    }
  });

  view.addEventListener('click', async function(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;

    var action = btn.dataset.action;
    var id = btn.dataset.id;

    switch (action) {
      case 'new':         App.editStaff(null); break;
      case 'edit':        App.editStaff(id); break;
      case 'view':        await App.showStaffStats(id); break;
      case 'toggle':      await App.toggleStaffActive(id); break;
      case 'delete':      await App.deleteStaff(id); break;
      case 'resetPw':     await App.resetStaffPassword(id); break;
      case 'permissions': await App.editStaffPermissions(id); break;
      case 'export':      await App.exportStaffCSV(); break;
    }
  });
}

/* ---------- Статистика сотрудника ---------- */
App.showStaffStats = async function(id) {
  var u = await App.repo('users').byId(id);
  if (!u) return;

  var orders = await App.repo('orders').all();
  var shifts = await App.repo('shifts').all();

  var userOrders = orders.filter(function(o) { return o.createdById === u.id && o.status === 'completed'; });
  var userShifts = shifts.filter(function(s) { return s.employeeId === u.id && s.status === 'closed'; });

  var revenue = userOrders.reduce(function(s, o) { return s + (o.finalAmount || 0); }, 0);
  var hours = userShifts.reduce(function(s, sh) { return s + (sh.hours || 0); }, 0);

  App.Modal.open('📊 Статистика сотрудника', `
    <div style="padding:10px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--b)">
        <div style="font-size:48px">${u.emoji || '👤'}</div>
        <div>
          <div style="font-size:20px;font-weight:800">${App.esc(u.name)}</div>
          <div class="hint">${App.ROLES[u.role]} • ${App.esc(u.phone)}</div>
        </div>
      </div>
      <div class="g">
        <div class="card stat"><div class="big">${userOrders.length}</div><div class="sm">Заказов</div></div>
        <div class="card stat"><div class="big">${App.fmtMoney(revenue)}</div><div class="sm">Выручка</div></div>
        <div class="card stat"><div class="big">${userShifts.length}</div><div class="sm">Смен</div></div>
        <div class="card stat"><div class="big">${hours.toFixed(1)} ч</div><div class="sm">Часов</div></div>
      </div>
      <button class="btn g" style="width:100%;margin-top:16px" onclick="App.Modal.close()">Закрыть</button>
    </div>
  `);
};

/* ---------- Создание / Редактирование ---------- */
App.editStaff = async function(id) {
  if (!App.Auth.isAdmin()) return;

  var u = id ? await App.repo('users').byId(id) : null;
  if (u && u.role === 'owner' && u.id !== App.Auth.user.id) {
    App.Toast.er('Нельзя редактировать другого владельца');
    return;
  }

  var isNew = !u;

  App.Modal.open(isNew ? '👤 Новый сотрудник' : '✏️ Редактирование', `
    <form id="staffForm">
      <div class="row">
        <div>
          <label class="lbl">ФИО *</label>
          <input class="inp" name="name" value="${App.esc(u ? u.name : '')}" required>
        </div>
        <div>
          <label class="lbl">Телефон *</label>
          <input class="inp phone" name="phone" value="${App.esc(u ? u.phone : '')}" required>
        </div>
      </div>
      <div class="row" style="margin-top:12px">
        <div>
          <label class="lbl">Должность</label>
          <input class="inp" name="position" value="${App.esc(u ? u.position : '')}" placeholder="Флорист, Кассир...">
        </div>
        <div>
          <label class="lbl">Эмодзи</label>
          <input class="inp" name="emoji" value="${App.esc(u ? u.emoji : '👤')}" maxlength="4">
        </div>
      </div>
      <div class="row" style="margin-top:12px">
        <div>
          <label class="lbl">Роль *</label>
          <select class="inp" name="role">
            <option value="employee" ${u && u.role === 'employee' ? 'selected' : ''}>👤 Сотрудник</option>
            <option value="admin" ${u && u.role === 'admin' ? 'selected' : ''}>👑 Администратор</option>
            ${App.Auth.user.role === 'owner' ? '<option value="owner"' + (u && u.role === 'owner' ? ' selected' : '') + '>🏆 Владелец</option>' : ''}
          </select>
        </div>
        <div>
          <label class="lbl">Пароль ${isNew ? '*' : '(сменить)'}</label>
          <input type="password" class="inp" name="password"
                 ${isNew ? 'required minlength="8"' : 'placeholder="Оставьте пустым"'}>
        </div>
      </div>
      <h4 style="margin:20px 0 12px">💰 Оплата труда</h4>
      <div class="row">
        <div>
          <label class="lbl">Ставка за смену (₽)</label>
          <input type="number" class="inp" name="shiftCost" min="0" value="${u ? u.shiftCost : 0}">
        </div>
        <div>
          <label class="lbl">Почасовая ставка (₽)</label>
          <input type="number" class="inp" name="hourlyRate" min="0" value="${u ? u.hourlyRate : 0}">
        </div>
      </div>
      <div class="row" style="margin-top:12px">
        <div>
          <label class="lbl">Комиссия (%)</label>
          <input type="number" class="inp" name="commissionRate" min="0" max="100" step="0.5"
                 value="${u ? u.commissionRate : 0}">
        </div>
        <div>
          <label class="lbl">Порог комиссии (₽)</label>
          <input type="number" class="inp" name="commissionThreshold" min="0"
                 value="${u ? u.commissionThreshold : 0}">
        </div>
      </div>
      <label class="chk" style="margin-top:16px">
        <input type="checkbox" name="active" ${!u || u.active !== false ? 'checked' : ''}>
        Активен (может входить в систему)
      </label>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button type="submit" class="btn glow" style="flex:1">💾 Сохранить</button>
        <button type="button" class="btn g" style="flex:1" onclick="App.Modal.close()">Отмена</button>
      </div>
    </form>
  `);

  var phoneInp = App.Modal.body().querySelector('input.phone');
  if (phoneInp) App.applyPhoneMask(phoneInp);

  document.getElementById('staffForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var f = e.target;

    var data = {
      name: f.name.value.trim(),
      phone: f.phone.value.trim(),
      position: f.position.value.trim(),
      emoji: f.emoji.value.trim() || '👤',
      role: f.role.value,
      shiftCost: parseFloat(f.shiftCost.value) || 0,
      hourlyRate: parseFloat(f.hourlyRate.value) || 0,
      commissionRate: parseFloat(f.commissionRate.value) || 0,
      commissionThreshold: parseFloat(f.commissionThreshold.value) || 0,
      active: f.active.checked,
      updatedAt: Date.now()
    };

    try {
      var savedUser;

      if (isNew) {
        var salt = await App.genSalt();
        var hash = await App.digest(f.password.value, salt);

        // Права по умолчанию
        var defaultPermissions = {};
        App.MODULES.forEach(function(m) {
          defaultPermissions[m.id] = m.default;
        });

        savedUser = {
          id: App.uid('usr'),
          name: data.name,
          phone: data.phone,
          position: data.position,
          emoji: data.emoji,
          role: data.role,
          shiftCost: data.shiftCost,
          hourlyRate: data.hourlyRate,
          commissionRate: data.commissionRate,
          commissionThreshold: data.commissionThreshold,
          active: data.active,
          salt: salt,
          hash: hash,
          permissions: defaultPermissions,
          tfaEnabled: false,
          backupCodesHash: [],
          createdAt: Date.now()
        };

        await App.repo('users').save(savedUser);
        App.Toast.ok('Сотрудник создан! Настройте права доступа.');
      } else {
        if (f.password.value) {
          var salt2 = await App.genSalt();
          data.salt = salt2;
          data.hash = await App.digest(f.password.value, salt2);
        }
        savedUser = Object.assign({}, u, data);
        await App.repo('users').save(savedUser);
        App.Toast.ok('Сохранено');
      }

      App.Modal.close();
      App.state._forceRerender = true;
      App.renderStaff();

      // Для нового сотрудника — сразу настройка прав
      if (isNew && savedUser.role === 'employee') {
        setTimeout(function() {
          App.editStaffPermissions(savedUser.id);
        }, 300);
      }
    } catch (err) {
      console.error('saveStaff error:', err);
      App.Toast.er('Ошибка: ' + err.message);
    }
  });
};

/* ---------- Настройка прав доступа ---------- */
App.editStaffPermissions = async function(id) {
  var u = await App.repo('users').byId(id);
  if (!u) return;

  if (u.role === 'owner') {
    App.Toast.wn('У владельца есть доступ ко всем модулям');
    return;
  }

  if (u.role === 'admin') {
    App.Toast.wn('У администратора есть доступ ко всем модулям');
    return;
  }

  var perms = u.permissions || {};

  // Группировка модулей
  var groups = {
    'Основные': ['dashboard', 'orders', 'clients', 'calendar', 'shifts'],
    'Склад и товары': ['flowers', 'bouquets', 'supplies', 'writeoffs', 'returns'],
    'Аналитика и управление': ['expenses', 'analytics', 'staff', 'settings']
  };

  var html = `
    <div style="padding:10px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--b)">
        <div style="font-size:40px">${u.emoji || '👤'}</div>
        <div>
          <div style="font-size:18px;font-weight:700">${App.esc(u.name)}</div>
          <div class="hint">Настройка доступных модулей</div>
        </div>
      </div>

      <form id="permissionsForm">
  `;

  var groupKeys = Object.keys(groups);
  for (var gi = 0; gi < groupKeys.length; gi++) {
    var groupName = groupKeys[gi];
    var moduleIds = groups[groupName];

    html += `
      <div style="margin-bottom:20px">
        <h4 style="margin-bottom:12px;color:var(--t2)">${groupName}</h4>
        <div style="display:grid;gap:8px">
    `;

    for (var mi = 0; mi < moduleIds.length; mi++) {
      var moduleId = moduleIds[mi];
      var module = null;
      for (var k = 0; k < App.MODULES.length; k++) {
        if (App.MODULES[k].id === moduleId) {
          module = App.MODULES[k];
          break;
        }
      }
      if (!module) continue;

      var isChecked = perms[moduleId] === true;

      html += `
        <label class="chk" style="padding:12px;background:var(--in);border-radius:10px;margin:0;transition:all .2s;cursor:pointer">
          <input type="checkbox" name="perm_${moduleId}" ${isChecked ? 'checked' : ''}
                 style="width:20px;height:20px">
          <div style="flex:1">
            <div style="font-weight:600;font-size:14px">${module.label}</div>
            <div class="hint" style="margin-top:2px">${module.desc}</div>
          </div>
        </label>
      `;
    }

    html += `
        </div>
      </div>
    `;
  }

  html += `
      </form>

      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        <button class="btn g" onclick="_selectAllPerms(true)" style="flex:1">✅ Выбрать все</button>
        <button class="btn g" onclick="_selectAllPerms(false)" style="flex:1">❌ Снять все</button>
      </div>

      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn glow" style="flex:1" onclick="_savePermissions('${u.id}')">💾 Сохранить</button>
        <button class="btn g" style="flex:1" onclick="App.Modal.close()">Закрыть</button>
      </div>
    </div>
  `;

  App.Modal.open('🔐 Права доступа', html);
};

// Глобальные хелперы для модалки прав
window._selectAllPerms = function(select) {
  var checkboxes = document.querySelectorAll('#permissionsForm input[type="checkbox"]');
  for (var i = 0; i < checkboxes.length; i++) {
    checkboxes[i].checked = select;
  }
};

window._savePermissions = async function(userId) {
  var u = await App.repo('users').byId(userId);
  if (!u) return;

  var permissions = {};
  for (var i = 0; i < App.MODULES.length; i++) {
    var m = App.MODULES[i];
    var cb = document.querySelector('input[name="perm_' + m.id + '"]');
    permissions[m.id] = cb ? cb.checked : false;
  }

  var updated = Object.assign({}, u, {
    permissions: permissions,
    updatedAt: Date.now()
  });

  await App.repo('users').save(updated);

  var count = 0;
  var keys = Object.keys(permissions);
  for (var j = 0; j < keys.length; j++) {
    if (permissions[keys[j]]) count++;
  }

  App.Toast.ok('Сохранено: ' + count + ' / ' + App.MODULES.length + ' модулей');
  App.Modal.close();

  App.state._forceRerender = true;
  App.renderStaff();
};

/* ---------- Блокировка / Разблокировка ---------- */
App.toggleStaffActive = async function(id) {
  var u = await App.repo('users').byId(id);
  if (!u || u.id === App.Auth.user.id) return;

  var confirmed = await App.confirm(
    u.active === false
      ? 'Разблокировать ' + u.name + '?'
      : 'Заблокировать ' + u.name + '?'
  );
  if (!confirmed) return;

  await App.repo('users').update(id, { active: u.active === false });
  App.Toast.ok(u.active === false ? 'Разблокирован' : 'Заблокирован');
  App.state._forceRerender = true;
  App.renderStaff();
};

/* ---------- Удаление ---------- */
App.deleteStaff = async function(id) {
  var u = await App.repo('users').byId(id);
  if (!u) return;

  if (u.id === App.Auth.user.id) {
    App.Toast.er('Нельзя удалить себя');
    return;
  }
  if (u.role === 'owner') {
    App.Toast.er('Нельзя удалить владельца');
    return;
  }

  // Проверка зависимостей
  var orders = await App.repo('orders').all();
  var shifts = await App.repo('shifts').all();

  var hasOrders = orders.some(function(o) { return o.createdById === id; });
  var hasShifts = shifts.some(function(s) { return s.employeeId === id; });

  if (hasOrders || hasShifts) {
    App.Toast.er('Нельзя удалить: есть заказы или смены. Сначала заблокируйте.');
    return;
  }

  var confirmed = await App.confirm('Удалить сотрудника ' + u.name + '? Это необратимо.');
  if (!confirmed) return;

  await App.repo('users').remove(id);
  App.Toast.ok('Удалён');
  App.state._forceRerender = true;
  App.renderStaff();
};

/* ---------- Сброс пароля ---------- */
App.resetStaffPassword = async function(id) {
  var u = await App.repo('users').byId(id);
  if (!u) return;

  var confirmed = await App.confirm('Сбросить пароль для ' + u.name + '?');
  if (!confirmed) return;

  var tempPw = App.genPassword ? App.genPassword(12) : Math.random().toString(36).slice(-10);
  var salt = await App.genSalt();
  var hash = await App.digest(tempPw, salt);

  await App.repo('users').update(id, { salt: salt, hash: hash });

  App.Modal.open('🔑 Новый пароль', `
    <div style="padding:10px;text-align:center">
      <p>Временный пароль для <strong>${App.esc(u.name)}</strong>:</p>
      <div style="font-family:monospace;font-size:18px;padding:12px;background:var(--in);border-radius:8px;margin:12px 0;letter-spacing:1px">
        ${tempPw}
      </div>
      <p class="hint">Передайте пароль лично сотруднику</p>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:16px">
        <button class="btn g" onclick="navigator.clipboard.writeText('${tempPw}');App.Toast.ok('Скопировано')">📋 Копировать</button>
        <button class="btn" onclick="App.Modal.close()">Закрыть</button>
      </div>
    </div>
  `);
};

/* ---------- Экспорт в CSV ---------- */
App.exportStaffCSV = async function() {
  var users = await App.repo('users').all();
  var headers = ['ФИО','Роль','Телефон','Должность','Доступно модулей','Активен','2FA'];

  var rows = users.map(function(u) {
    var perms = u.permissions || {};
    var accessCount;

    if (u.role === 'owner' || u.role === 'admin') {
      accessCount = App.MODULES.length;
    } else {
      accessCount = App.MODULES.filter(function(m) { return perms[m.id]; }).length;
    }

    return [
      u.name,
      App.ROLES[u.role] || u.role,
      u.phone,
      u.position || '',
      accessCount,
      u.active !== false ? 'Да' : 'Нет',
      u.tfaEnabled ? 'Да' : 'Нет'
    ];
  });

  var csv = [headers].concat(rows)
    .map(function(r) {
      return r.map(function(c) {
        return '"' + String(c).replace(/"/g, '""') + '"';
      }).join(',');
    })
    .join('\n');

  var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'staff_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  App.Toast.ok('Экспортировано ' + users.length);
};

console.log('staff.js loaded (v3.0 with permissions)');