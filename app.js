/* ================================================================
   app.js — ShiftFlow 2.0  Full Application Logic
   ================================================================ */
'use strict';

// ============================================================
// CONSTANTS & UTILITIES
// ============================================================
const MONTHS_BG = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'];
const DAYS_BG = ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота'];
const DAYS_SHORT = ['Нед', 'Пон', 'Вт', 'Ср', 'Чет', 'Пет', 'Съб'];

const SHIFT_TYPE_MAP = {
  regular: { label: 'Обичайна', cls: 'shift-reg', icon: '🔵' },
  '6h': { label: '6 часа', cls: 'shift-6h', icon: '🟢' },
  '12h': { label: '12 часа', cls: 'shift-12h', icon: '🟠' },
  weekend: { label: 'Уикенд', cls: 'shift-wknd', icon: '🟣' },
  overtime: { label: 'Извънреден', cls: 'shift-ot', icon: '🔴' },
};

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDateBG(s) {
  const d = new Date(s + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_BG[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtDayBG(s) {
  const d = new Date(s + 'T00:00:00');
  return `${DAYS_BG[d.getDay()]}, ${d.getDate()} ${MONTHS_BG[d.getMonth()]}`;
}
function fmtMonth(y, m) { return `${MONTHS_BG[m]} ${y}`; }
function getMonthRange(y, m) {
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`;
  return { from, to };
}
function getWeekRange(base) {
  const d = new Date(base);
  const day = d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { from: fmtDate(mon), to: fmtDate(sun), monday: mon, sunday: sun };
}
function initials(name) { return (name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(); }
function isWeekend(dateStr) { const d = new Date(dateStr + 'T00:00:00').getDay(); return d === 0 || d === 6; }

// Animated counter
function animateCounter(el, target, suffix = '') {
  if (!el) return;
  const start = parseFloat(el.textContent) || 0;
  const duration = 600;
  const startTime = performance.now();
  const step = (now) => {
    const pct = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - pct, 3);
    const val = start + (target - start) * ease;
    el.textContent = Number.isInteger(target) ? Math.round(val) + suffix : val.toFixed(1) + suffix;
    if (pct < 1) requestAnimationFrame(step);
    else el.textContent = target + suffix;
  };
  requestAnimationFrame(step);
}

// ============================================================
// SHARED HELPERS
// ============================================================
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast ${type}`;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.add('hidden'), 3200);
}
function openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }
function logout() { Auth.logout(); }

function toggleTheme() {
  document.body.classList.toggle('light');
  const isLight = document.body.classList.contains('light');
  localStorage.setItem('sf_theme', isLight ? 'light' : 'dark');
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = isLight ? '☀️' : '🌙';
  const tog = document.getElementById('theme-toggle');
  if (tog) tog.checked = isLight;
}
function toggleThemeSwitch(checkbox) {
  document.body.classList.toggle('light', checkbox.checked);
  localStorage.setItem('sf_theme', checkbox.checked ? 'light' : 'dark');
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = checkbox.checked ? '☀️' : '🌙';
}
function applyTheme() {
  const isLight = localStorage.getItem('sf_theme') === 'light';
  if (isLight) document.body.classList.add('light');
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = isLight ? '☀️' : '🌙';
  const tog = document.getElementById('theme-toggle');
  if (tog) tog.checked = isLight;
}

// Close modal on backdrop click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.add('hidden');
});

// Tab switching
function switchTab(name) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  const sec = document.getElementById('tab-' + name);
  if (sec) sec.classList.add('active');
  // Lazy refresh on tab switch
  if (name === 'emp-schedule') renderEmpSchedule();
  if (name === 'profile') renderProfile();
  if (name === 'reports') renderReports();
}

// Status pill
function statusPill(status) {
  const map = {
    present: ['present', '✓ Дошъл'],
    absent: ['absent', '✗ Отсъства'],
    penalty: ['penalty', '⚠ Наказание'],
    partial: ['penalty', '◑ Частично'],
    pending: ['pending', '— Неотбелязан'],
  };
  const [cls, label] = map[status] || map.pending;
  return `<span class="status-pill ${cls}">${label}</span>`;
}

// Shift type badge
function shiftBadge(type) {
  const info = SHIFT_TYPE_MAP[type] || SHIFT_TYPE_MAP.regular;
  return `<span class="shift-badge ${info.cls}">${info.icon} ${info.label}</span>`;
}

// ============================================================
// LOGIN
// ============================================================
async function handleLogin() {
  const username = document.getElementById('username')?.value.trim();
  const password = document.getElementById('password')?.value.trim();
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  const btnText = document.getElementById('login-btn-text');
  const spinner = document.getElementById('login-spinner');

  if (!username || !password) {
    errEl.textContent = 'Въведи потребителско име и парола.';
    errEl.classList.remove('hidden'); return;
  }
  errEl.classList.add('hidden');
  btnText.textContent = 'Влизане...';
  spinner?.classList.remove('hidden');
  btn.disabled = true;

  try {
    const user = await Auth.login(username, password);
    window.location.href = user.role === 'manager' ? 'manager.html' : 'employee.html';
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
    btnText.textContent = 'Вход';
    spinner?.classList.add('hidden');
    btn.disabled = false;
  }
}

// ============================================================
// ============================================================
//   MANAGER DASHBOARD
// ============================================================
// ============================================================

let mgr = {
  employees: [],
  weekBase: new Date(),
  viewDate: fmtDate(new Date()),
  shiftTypeFilter: 'all',
  reportYear: new Date().getFullYear(),
  reportMonth: new Date().getMonth(),
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
};

function initManagerDashboard() {
  applyTheme();
  const user = Auth.requireRole('manager');
  if (!user) return;
  document.getElementById('nav-username').textContent = user.name || user.username;
  mgr.employees = DB.getEmployees();

  // Set date picker to today
  const dp = document.getElementById('view-date-picker');
  if (dp) dp.value = mgr.viewDate;

  renderTodayView();
  renderScheduleTab();
  renderMgrCalendar();
  renderEmployeesTab();
  renderPenaltiesTab();
  populateManagerSelects();
}

// ---- TODAY VIEW ----
function onDatePickerChange(val) {
  mgr.viewDate = val;
  const d = new Date(val + 'T00:00:00');
  document.getElementById('today-date-label').textContent = fmtDayBG(val);
  renderTodayView();
}

function renderTodayView() {
  const dateStr = mgr.viewDate;
  document.getElementById('today-date-label').textContent = fmtDayBG(dateStr);

  const scheduled = DB.getSchedulesByDate(dateStr).sort((a, b) => {
    const na = DB.getEmployee(a.employee_id)?.name || '';
    const nb = DB.getEmployee(b.employee_id)?.name || '';
    return na.localeCompare(nb);
  });

  const shifts = DB.getShiftsByDate(dateStr);
  const shiftMap = {};
  shifts.forEach(s => shiftMap[s.employee_id] = s);

  let arrived = 0, noshow = 0, pending = 0;
  const list = document.getElementById('today-list');
  list.innerHTML = '';

  if (scheduled.length === 0) {
    list.innerHTML = '<div class="empty-state">Няма насрочени служители за тази дата.<br>Добави ги от таба „График".</div>';
  }

  scheduled.forEach(sched => {
    const emp = DB.getEmployee(sched.employee_id);
    if (!emp) return;
    const shift = shiftMap[emp.id];
    const status = shift ? shift.status : 'pending';
    if (status === 'present') arrived++;
    else if (status === 'absent' || status === 'partial') noshow++;
    else pending++;

    const row = document.createElement('div');
    row.className = 'table-row';
    row.innerHTML = `
      <div class="emp-name">${emp.name}</div>
      <div>${shiftBadge(sched.shift_type || 'regular')}</div>
      <div class="emp-hours">${sched.planned_hours}ч</div>
      <div>${statusPill(status)}</div>
      <div class="row-actions">${buildTodayActions(emp.id, sched, shift)}</div>
    `;
    list.appendChild(row);
  });

  document.getElementById('stat-scheduled').textContent = scheduled.length;
  document.getElementById('stat-arrived').textContent = arrived;
  document.getElementById('stat-noshow').textContent = noshow;
  document.getElementById('stat-pending').textContent = pending;
}

function buildTodayActions(empId, sched, shift) {
  if (shift && (shift.status === 'present' || shift.status === 'partial')) {
    return `<button class="btn btn-outline" onclick="openEditHours('${shift.id}','${empId}','${shift.worked_hours}','${shift.status}','${shift.note || ''}')">✏️ Редактирай</button>`;
  }
  return `
    <button class="btn btn-success" onclick="markArrived('${empId}','${sched.planned_hours}')">✓ Дошъл</button>
    <button class="btn btn-warn"    onclick="markNoShow('${empId}')">✗ Отсъства</button>
    <button class="btn btn-outline" onclick="openEditHours('${shift ? shift.id : ''}','${empId}','${sched.planned_hours}','present','')">✏️</button>
  `;
}

function markArrived(empId, hours) {
  DB.upsertShift({ employee_id: empId, date: mgr.viewDate, worked_hours: parseFloat(hours), status: 'present', note: '' });
  showToast('Отбелязан като „Дошъл" ✓');
  renderTodayView();
}
function markNoShow(empId) {
  DB.upsertShift({ employee_id: empId, date: mgr.viewDate, worked_hours: 0, status: 'absent', note: 'Не се е явил' });
  showToast('Отбелязан като „Отсъства"', 'error');
  renderTodayView();
}

function openEditHours(shiftId, empId, hours, status, note) {
  const emp = DB.getEmployee(empId);
  document.getElementById('edit-emp-name').value = emp ? emp.name : empId;
  document.getElementById('edit-hours').value = hours;
  document.getElementById('edit-status').value = status === 'pending' ? 'present' : status;
  document.getElementById('edit-note').value = note || '';
  document.getElementById('edit-shift-id').value = shiftId;
  document.getElementById('edit-shift-id').dataset.empId = empId;
  openModal('modal-edit-hours');
}

function saveEditedHours() {
  const shiftId = document.getElementById('edit-shift-id').value;
  const empId = document.getElementById('edit-shift-id').dataset.empId;
  const hours = parseFloat(document.getElementById('edit-hours').value);
  const status = document.getElementById('edit-status').value;
  const note = document.getElementById('edit-note').value.trim();

  if (isNaN(hours) || hours < 0) { showToast('Невалидни часове', 'error'); return; }

  if (shiftId) {
    DB.updateShift(shiftId, { worked_hours: hours, status, note });
  } else {
    DB.upsertShift({ employee_id: empId, date: mgr.viewDate, worked_hours: hours, status, note });
  }
  closeModal('modal-edit-hours');
  showToast('Смяната е записана ✓');
  renderTodayView();
}

// ---- SCHEDULE TAB ----
function changeMgrCalMonth(dir) {
  mgr.calMonth += dir;
  if (mgr.calMonth < 0) { mgr.calMonth = 11; mgr.calYear--; }
  if (mgr.calMonth > 11) { mgr.calMonth = 0; mgr.calYear++; }
  renderMgrCalendar();
}

function openAddScheduleForDate(dateStr) {
  document.getElementById('sched-date').value = dateStr;
  openModal('modal-add-schedule');
}

function renderMgrCalendar() {
  const { calYear: y, calMonth: m } = mgr;
  const monthLbl = document.getElementById('mgr-cal-month-label');
  if (monthLbl) monthLbl.textContent = fmtMonth(y, m);

  const { from, to } = getMonthRange(y, m);
  const scheds = DB.getSchedules(from, to);

  const schedMap = {};
  scheds.forEach(s => {
    if (!schedMap[s.date]) schedMap[s.date] = [];
    schedMap[s.date].push(s);
  });

  const grid = document.getElementById('mgr-cal-grid');
  if (!grid) return;
  grid.innerHTML = '';

  let startOff = new Date(y, m, 1).getDay() - 1;
  if (startOff < 0) startOff = 6;
  for (let i = 0; i < startOff; i++) {
    const e = document.createElement('div'); e.className = 'cal-day empty'; grid.appendChild(e);
  }

  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayStr = fmtDate(new Date());

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayScheds = schedMap[dateStr] || [];
    const isToday = (dateStr === todayStr);
    const weekend = isWeekend(dateStr);

    let cls = 'cal-day';
    if (isToday) cls += ' today';
    if (weekend) cls += ' weekend';
    if (dayScheds.length > 0) cls += ' scheduled'; // Manager calendar highlights days with shifts

    const el = document.createElement('div');
    el.className = cls;

    let dotsHtml = '';
    if (dayScheds.length > 0) {
      dotsHtml = `<div style="font-size:0.7rem;color:var(--text-faint);text-align:center;margin-top:2px;">${dayScheds.length} см.</div>`;
    }

    el.innerHTML = `
      <span>${day}</span>
      ${dotsHtml}
    `;

    // Instead of day detail, we will directly open the add schedule form
    el.onclick = () => openAddScheduleForDate(dateStr);
    grid.appendChild(el);
  }
}

function renderScheduleTab() {
  const { from, to, monday, sunday } = getWeekRange(mgr.weekBase);
  const monL = `${monday.getDate()} ${MONTHS_BG[monday.getMonth()]}`;
  const sunL = `${sunday.getDate()} ${MONTHS_BG[sunday.getMonth()]}`;
  document.getElementById('week-label').textContent = `${monL} — ${sunL}`;

  let schedules = DB.getSchedules(from, to);
  if (mgr.shiftTypeFilter !== 'all') {
    schedules = schedules.filter(s => (s.shift_type || 'regular') === mgr.shiftTypeFilter);
  }

  const grid = document.getElementById('schedule-grid');
  grid.innerHTML = '';
  const todayStr = fmtDate(new Date());

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const dateStr = fmtDate(d);
    const dayScheds = schedules.filter(s => s.date === dateStr)
      .sort((a, b) => (DB.getEmployee(a.employee_id)?.name || '').localeCompare(DB.getEmployee(b.employee_id)?.name || ''));

    const group = document.createElement('div');
    group.className = 'sched-day-group';
    const isToday = dateStr === todayStr;
    group.innerHTML = `<div class="sched-day-title${isToday ? ' today-label' : ''}">${DAYS_BG[d.getDay()]} ${d.getDate()} ${MONTHS_BG[d.getMonth()]}${isToday ? ' — Днес' : ''}</div>`;

    if (dayScheds.length === 0) {
      group.innerHTML += `<div style="font-size:0.72rem;color:var(--text-faint);padding:4px 6px;">Почивен ден</div>`;
    }
    dayScheds.forEach(s => {
      const emp = DB.getEmployee(s.employee_id);
      const row = document.createElement('div');
      row.className = 'sched-row';
      row.innerHTML = `
        <span class="sched-emp-name">${emp ? emp.name : '—'}</span>
        <div class="sched-meta">
          ${shiftBadge(s.shift_type || 'regular')}
          ${s.note ? `<span class="sched-note">${s.note}</span>` : ''}
          <span class="sched-hours-badge">${s.planned_hours}ч</span>
          <button class="icon-btn" style="font-size:0.8rem" onclick="deleteScheduleEntry('${s.id}')" title="Изтрий">🗑</button>
        </div>
      `;
      group.appendChild(row);
    });
    grid.appendChild(group);
  }
}

function changeWeek(dir) {
  mgr.weekBase.setDate(mgr.weekBase.getDate() + dir * 7);
  renderScheduleTab();
}

function filterShiftType(type, btn) {
  mgr.shiftTypeFilter = type;
  document.querySelectorAll('.shift-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderScheduleTab();
}

function selectShiftType(type, btn) {
  document.querySelectorAll('.stype-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('sched-type').value = type;
  // Auto-set hours based on type
  const hoursMap = { regular: 8, '6h': 6, '12h': 12, weekend: 8, overtime: 10 };
  if (hoursMap[type]) document.getElementById('sched-hours').value = hoursMap[type];
}

function addSchedule() {
  const empId = document.getElementById('sched-emp').value;
  const date = document.getElementById('sched-date').value;
  const hours = parseFloat(document.getElementById('sched-hours').value);
  const type = document.getElementById('sched-type').value || 'regular';
  const note = document.getElementById('sched-note').value.trim();

  if (!empId || !date || isNaN(hours) || hours <= 0) { showToast('Попълни всички полета', 'error'); return; }

  DB.addSchedule({ employee_id: empId, date, planned_hours: hours, shift_type: type, note });
  closeModal('modal-add-schedule');
  showToast('Добавено в графика ✓');
  document.getElementById('sched-hours').value = '';
  document.getElementById('sched-note').value = '';
  renderScheduleTab();
  renderTodayView();
  renderMgrCalendar();
}

function deleteScheduleEntry(id) {
  DB.deleteSchedule(id);
  showToast('Изтрито от графика');
  renderScheduleTab();
  renderTodayView();
  renderMgrCalendar();
}

function setHours(h) { document.getElementById('sched-hours').value = h; }

// ---- EMPLOYEES TAB ----
function renderEmployeesTab() {
  const emps = DB.getEmployees().sort((a, b) => a.name.localeCompare(b.name));
  const grid = document.getElementById('employees-grid');
  grid.innerHTML = '';

  if (emps.length === 0) {
    grid.innerHTML = '<div class="empty-state">Няма служители. Добави първия.</div>'; return;
  }

  const { from, to } = getMonthRange(new Date().getFullYear(), new Date().getMonth());

  emps.forEach(emp => {
    const shifts = DB.getShifts(emp.id, from, to);
    const totalH = shifts.reduce((s, sh) => s + parseFloat(sh.worked_hours || 0), 0);
    const penSum = DB.getPenalties(emp.id).filter(p => p.date >= from && p.date <= to)
      .reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const salary = Math.max(0, totalH * parseFloat(emp.hourly_rate || 0) - penSum);

    const card = document.createElement('div');
    card.className = 'emp-card glass-card';
    card.innerHTML = `
      <div class="emp-card-header">
        <div class="emp-avatar">${initials(emp.name)}</div>
        <div>
          <div class="emp-card-name">${emp.name}</div>
          <div class="emp-card-user">@${emp.username}</div>
        </div>
      </div>
      <div class="emp-card-stats">
        <div class="emp-stat"><span class="emp-stat-val">${totalH}ч</span><span class="emp-stat-lbl">Часове</span></div>
        <div class="emp-stat"><span class="emp-stat-val">${salary.toFixed(0)} лв.</span><span class="emp-stat-lbl">Заплата</span></div>
        <div class="emp-stat"><span class="emp-stat-val">${emp.hourly_rate} лв.</span><span class="emp-stat-lbl">на час</span></div>
      </div>
    `;
    card.onclick = () => openEmpDetail(emp.id);
    grid.appendChild(card);
  });
}

function openEmpDetail(empId) {
  const emp = DB.getEmployee(empId);
  if (!emp) return;
  const { from, to } = getMonthRange(new Date().getFullYear(), new Date().getMonth());
  const shifts = DB.getShifts(empId, from, to);
  const pens = DB.getPenalties(empId).filter(p => p.date >= from && p.date <= to);
  const totalH = shifts.reduce((s, sh) => s + parseFloat(sh.worked_hours || 0), 0);
  const penSum = pens.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const salary = Math.max(0, totalH * parseFloat(emp.hourly_rate || 0) - penSum);

  document.getElementById('emp-detail-title').textContent = emp.name;
  document.getElementById('emp-detail-content').innerHTML = `
    <div class="profile-stats-grid" style="margin-bottom:1rem;">
      <div class="p-stat"><span class="p-val">${totalH}</span><span class="p-lbl">Часа</span></div>
      <div class="p-stat"><span class="p-val green">${salary.toFixed(0)} лв.</span><span class="p-lbl">Заплата</span></div>
      <div class="p-stat"><span class="p-val red">${penSum.toFixed(0)} лв.</span><span class="p-lbl">Наказания</span></div>
      <div class="p-stat"><span class="p-val">${emp.hourly_rate} лв.</span><span class="p-lbl">на час</span></div>
    </div>
    <div class="card-title" style="margin-bottom:0.5rem;">Смени тази седмица</div>
    <div class="shifts-list">
      ${shifts.length ? shifts.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(s => `
        <div class="shift-item">
          <div class="shift-left"><span class="shift-date">${fmtDateBG(s.date)}</span></div>
          <div class="shift-right"><span class="shift-hours">${s.worked_hours}ч</span>${statusPill(s.status)}</div>
        </div>`).join('') : '<div class="empty-state">Няма данни</div>'}
    </div>
  `;
  openModal('modal-emp-detail');
}

function createEmployee() {
  const name = document.getElementById('new-emp-name').value.trim();
  const username = document.getElementById('new-emp-username').value.trim();
  const password = document.getElementById('new-emp-password').value.trim();
  const rate = parseFloat(document.getElementById('new-emp-rate').value);
  if (!name || !username || !password) { showToast('Попълни всички полета', 'error'); return; }
  try {
    DB.createEmployee({ name, username, password, hourly_rate: rate || 0 });
    mgr.employees = DB.getEmployees();
    closeModal('modal-add-employee');
    showToast(`Служителят ${name} е създаден ✓`);
    ['new-emp-name', 'new-emp-username', 'new-emp-password', 'new-emp-rate'].forEach(id => document.getElementById(id).value = '');
    renderEmployeesTab();
    populateManagerSelects();
  } catch (err) { showToast(err.message, 'error'); }
}

// ---- PENALTIES TAB ----
function renderPenaltiesTab() {
  const filterEmpId = document.getElementById('pen-filter-emp')?.value || '';
  let pens = DB.getPenalties(filterEmpId || null).sort((a, b) => b.date.localeCompare(a.date));
  const list = document.getElementById('penalties-list');
  list.innerHTML = '';

  if (pens.length === 0) { list.innerHTML = '<div class="empty-state">Няма добавени наказания.</div>'; return; }

  pens.forEach(p => {
    const emp = DB.getEmployee(p.employee_id);
    const row = document.createElement('div');
    row.className = 'penalty-row';
    row.innerHTML = `
      <div class="penalty-info">
        <div class="penalty-emp">${emp ? emp.name : '—'}</div>
        <div class="penalty-note">${p.note || '—'}</div>
        <div class="penalty-date">${fmtDateBG(p.date)}</div>
      </div>
      <div class="penalty-right">
        <span class="penalty-amount">-${p.amount} лв.</span>
        <button class="btn btn-outline btn-xs" onclick="removePenalty('${p.id}')">🗑 Изтрий</button>
      </div>
    `;
    list.appendChild(row);
  });
}

function addPenalty() {
  const empId = document.getElementById('pen-emp').value;
  const amount = parseFloat(document.getElementById('pen-amount').value);
  const date = document.getElementById('pen-date').value;
  const note = document.getElementById('pen-note').value.trim();
  if (!empId || isNaN(amount) || !date) { showToast('Попълни всички полета', 'error'); return; }
  DB.addPenalty({ employee_id: empId, amount, date, note });
  closeModal('modal-add-penalty');
  showToast('Наказанието е добавено');
  document.getElementById('pen-amount').value = '';
  document.getElementById('pen-note').value = '';
  renderPenaltiesTab();
}

function removePenalty(id) {
  DB.deletePenalty(id);
  showToast('Наказанието е премахнато');
  renderPenaltiesTab();
}

// ---- REPORTS TAB ----
function renderReports() {
  const { from, to } = getMonthRange(mgr.reportYear, mgr.reportMonth);
  document.getElementById('report-month-label').textContent = fmtMonth(mgr.reportYear, mgr.reportMonth);

  const emps = DB.getEmployees();
  let totalH = 0, totalSalary = 0, totalPens = 0;
  const tableBody = document.getElementById('report-table');
  tableBody.innerHTML = '';

  emps.forEach(emp => {
    const shifts = DB.getShifts(emp.id, from, to);
    const pens = DB.getPenalties(emp.id).filter(p => p.date >= from && p.date <= to);
    const h = shifts.reduce((s, sh) => s + parseFloat(sh.worked_hours || 0), 0);
    const days = shifts.filter(s => s.worked_hours > 0).length;
    const penSum = pens.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const sal = Math.max(0, h * parseFloat(emp.hourly_rate || 0) - penSum);

    totalH += h;
    totalSalary += sal;
    totalPens += penSum;

    if (h === 0 && penSum === 0) return; // skip inactive

    const row = document.createElement('div');
    row.className = 'table-row';
    row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr 1fr';
    row.innerHTML = `
      <div class="emp-name">${emp.name}</div>
      <div class="emp-hours">${h}ч</div>
      <div class="emp-hours">${days}</div>
      <div style="color:var(--red);font-family:monospace">${penSum > 0 ? '-' + penSum + ' лв.' : '—'}</div>
      <div class="emp-hours green">${sal.toFixed(0)} лв.</div>
    `;
    tableBody.appendChild(row);
  });

  if (tableBody.innerHTML === '') {
    tableBody.innerHTML = '<div class="empty-state">Няма данни за избрания месец.</div>';
  }

  document.getElementById('rep-employees').textContent = emps.filter(e => {
    const s = DB.getShifts(e.id, from, to); return s.length > 0;
  }).length;
  document.getElementById('rep-hours').textContent = totalH + 'ч';
  document.getElementById('rep-salary').textContent = totalSalary.toFixed(0) + ' лв.';
  document.getElementById('rep-penalties').textContent = totalPens.toFixed(0) + ' лв.';
}

function changeReportMonth(dir) {
  mgr.reportMonth += dir;
  if (mgr.reportMonth < 0) { mgr.reportMonth = 11; mgr.reportYear--; }
  if (mgr.reportMonth > 11) { mgr.reportMonth = 0; mgr.reportYear++; }
  renderReports();
}

// ---- EXPORT ----
function buildExportData() {
  const { from, to } = getMonthRange(mgr.reportYear, mgr.reportMonth);
  const rows = [];
  DB.getEmployees().forEach(emp => {
    DB.getShifts(emp.id, from, to).forEach(s => {
      const pens = DB.getPenalties(emp.id).filter(p => p.date === s.date);
      const penSum = pens.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      rows.push({
        'Служител': emp.name,
        'Потребителско': emp.username,
        'Дата': s.date,
        'Часове': s.worked_hours,
        'Статус': s.status,
        'Наказания (лв.)': penSum || '',
        'Причина': pens.map(p => p.note).join('; '),
        'Бележка': s.note || '',
        'Заплата (лв.)': (s.worked_hours * parseFloat(emp.hourly_rate || 0)).toFixed(2),
      });
    });
  });
  return rows;
}

function exportCSV() {
  const rows = buildExportData();
  if (!rows.length) { showToast('Няма данни за избрания месец', 'error'); return; }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${r[h]}"`).join(','))].join('\n');
  downloadFile(csv, `ShiftFlow_${mgr.reportYear}-${String(mgr.reportMonth + 1).padStart(2, '0')}.csv`, 'text/csv;charset=utf-8;');
  showToast('CSV изтеглен ✓');
}

function exportExcel() {
  const rows = buildExportData();
  if (!rows.length) { showToast('Няма данни за избрания месец', 'error'); return; }
  const headers = Object.keys(rows[0]);
  // Build simple HTML table as .xls (opens in Excel)
  let html = `<html><head><meta charset="UTF-8"></head><body><table>
    <tr>${headers.map(h => `<th style="background:#1a1a2e;color:#63b3ed;font-weight:bold">${h}</th>`).join('')}</tr>
    ${rows.map(r => `<tr>${headers.map(h => `<td>${r[h]}</td>`).join('')}</tr>`).join('')}
  </table></body></html>`;
  downloadFile(html, `ShiftFlow_${mgr.reportYear}-${String(mgr.reportMonth + 1).padStart(2, '0')}.xls`, 'application/vnd.ms-excel');
  showToast('Excel изтеглен ✓');
}

function exportPDF() {
  const rows = buildExportData();
  if (!rows.length) { showToast('Няма данни за избрания месец', 'error'); return; }
  const headers = Object.keys(rows[0]);
  const monthLabel = fmtMonth(mgr.reportYear, mgr.reportMonth);

  // Summarize per employee
  const empSummary = {};
  DB.getEmployees().forEach(e => { empSummary[e.id] = { name: e.name, hours: 0, salary: 0, pens: 0, rate: e.hourly_rate }; });
  rows.forEach(r => {
    const e = Object.values(empSummary).find(x => x.name === r['Служител']);
    if (e) { e.hours += parseFloat(r['Часове'] || 0); e.salary += parseFloat(r['Заплата (лв.)'] || 0); e.pens += parseFloat(r['Наказания (лв.)'] || 0); }
  });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>ShiftFlow — ${monthLabel}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; font-family:'Segoe UI',Arial,sans-serif; }
    body { background:#0d1117; color:#e2e8f0; padding:2rem; }
    h1 { color:#63b3ed; font-size:1.8rem; margin-bottom:0.25rem; }
    .sub { color:#8892a4; margin-bottom:2rem; font-size:0.9rem; }
    table { width:100%; border-collapse:collapse; margin-bottom:2rem; }
    th { background:#161b22; color:#63b3ed; padding:10px 12px; text-align:left; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.5px; }
    td { padding:9px 12px; border-bottom:1px solid rgba(99,179,237,0.1); font-size:0.85rem; }
    tr:hover td { background:rgba(99,179,237,0.05); }
    .green { color:#68d391; } .red { color:#fc8181; }
    @media print { body { background:white; color:black; } th { background:#eee; color:#333; } }
  </style>
  </head><body>
  <h1>⏱ ShiftFlow — Отчет</h1>
  <div class="sub">${monthLabel} · Генериран: ${new Date().toLocaleDateString('bg-BG')}</div>
  <table>
    <tr><th>Служител</th><th>Часове</th><th>Ставка</th><th>Наказания</th><th>Нето заплата</th></tr>
    ${Object.values(empSummary).filter(e => e.hours > 0).map(e => `
      <tr>
        <td><strong>${e.name}</strong></td>
        <td>${e.hours}ч</td>
        <td>${e.rate} лв./ч</td>
        <td class="red">${e.pens > 0 ? '-' + e.pens.toFixed(0) + ' лв.' : '—'}</td>
        <td class="green">${Math.max(0, e.salary - e.pens).toFixed(0)} лв.</td>
      </tr>`).join('')}
  </table>
  <table>
    <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
    ${rows.slice(0, 50).map(r => `<tr>${headers.map(h => `<td>${r[h] || ''}</td>`).join('')}</tr>`).join('')}
  </table>
  <script>window.onload=()=>window.print();</script>
  </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  showToast('PDF отворен за печат ✓');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ---- SELECTS SETUP ----
function populateManagerSelects() {
  const emps = DB.getEmployees().sort((a, b) => a.name.localeCompare(b.name));
  ['sched-emp', 'pen-emp', 'pen-filter-emp'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const isFilter = id === 'pen-filter-emp';
    sel.innerHTML = isFilter ? '<option value="">Всички служители</option>' : '<option value="">— Избери —</option>';
    emps.forEach(e => sel.innerHTML += `<option value="${e.id}">${e.name}</option>`);
  });
  const today = fmtDate(new Date());
  ['sched-date', 'pen-date'].forEach(id => { const el = document.getElementById(id); if (el) el.value = today; });
}

// ============================================================
// ============================================================
//   EMPLOYEE DASHBOARD
// ============================================================
// ============================================================

let emp = {
  user: null,
  dashYear: new Date().getFullYear(), dashMonth: new Date().getMonth(),
  calYear: new Date().getFullYear(), calMonth: new Date().getMonth(),
  schedYear: new Date().getFullYear(), schedMonth: new Date().getMonth(),
  histYear: new Date().getFullYear(), histMonth: new Date().getMonth(),
};

function initEmployeeDashboard() {
  applyTheme();
  const user = Auth.requireRole('employee');
  if (!user) return;
  emp.user = user;
  document.getElementById('nav-username').textContent = user.name || user.username;

  // Load notifications setting
  const notifEl = document.getElementById('notif-toggle');
  if (notifEl) {
    notifEl.checked = localStorage.getItem('sf_notif') === '1';
    const row = document.getElementById('notif-time-row');
    if (row) row.style.display = notifEl.checked ? 'flex' : 'none';
  }
  const notifTime = document.getElementById('notif-time');
  if (notifTime) notifTime.value = localStorage.getItem('sf_notif_time') || '20:00';

  renderEmpDashboard();
  renderEmpCalendar();
  renderEmpHistory();
  renderProfile();
}

// ---- DASHBOARD ----
function renderEmpDashboard() {
  const { dashYear: y, dashMonth: m } = emp;
  document.getElementById('month-label').textContent = fmtMonth(y, m);

  const { from, to } = getMonthRange(y, m);
  const shifts = DB.getShifts(emp.user.id, from, to);
  const pens = DB.getPenalties(emp.user.id).filter(p => p.date >= from && p.date <= to);

  const totalH = shifts.reduce((s, sh) => s + parseFloat(sh.worked_hours || 0), 0);
  const rate = parseFloat(emp.user.hourly_rate || 0);
  const penSum = pens.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const salary = Math.max(0, totalH * rate - penSum);
  const workedDays = shifts.filter(s => s.worked_hours > 0).length;
  const avg = workedDays > 0 ? (totalH / workedDays) : 0;

  animateCounter(document.getElementById('kpi-hours'), totalH, '');
  animateCounter(document.getElementById('kpi-salary'), Math.round(salary), '');
  animateCounter(document.getElementById('kpi-avg'), parseFloat(avg.toFixed(1)), '');
  animateCounter(document.getElementById('kpi-penalties'), Math.round(penSum), '');
  document.getElementById('kpi-rate-sub').textContent = `при ${rate} лв./час`;
  document.getElementById('kpi-penalty-count').textContent = pens.length + ' броя';

  // Progress
  const goal = parseInt(localStorage.getItem(`sf_goal_${emp.user.id}`) || '160');
  const pct = goal > 0 ? Math.min(100, Math.round(totalH / goal * 100)) : 0;
  const remain = Math.max(0, goal - totalH);
  document.getElementById('progress-label').textContent = `${totalH} / ${goal} ч`;
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-pct').textContent = pct + '%';
  document.getElementById('progress-remain').textContent = remain > 0 ? `${remain} ч оставащи` : '🎉 Целта е постигната!';
  document.getElementById('goal-display').textContent = goal + ' ч';

  // This week shifts
  const { from: wFrom, to: wTo } = getWeekRange(new Date());
  const weekShifts = DB.getShifts(emp.user.id, wFrom, wTo);
  const weekTotal = weekShifts.reduce((s, sh) => s + parseFloat(sh.worked_hours || 0), 0);
  const weekEl = document.getElementById('week-shifts');
  const weekBadge = document.getElementById('week-total-badge');
  if (weekBadge) weekBadge.textContent = weekTotal + ' ч';

  weekEl.innerHTML = '';
  if (weekShifts.length === 0) {
    weekEl.innerHTML = '<div class="empty-state">Няма смени тази седмица.</div>';
  } else {
    weekShifts.sort((a, b) => b.date.localeCompare(a.date)).forEach(s => {
      const div = document.createElement('div');
      div.className = 'shift-item';
      div.innerHTML = `
        <div class="shift-left">
          <span class="shift-date">${fmtDateBG(s.date)}</span>
          ${s.note ? `<span class="shift-note">${s.note}</span>` : ''}
        </div>
        <div class="shift-right">
          <span class="shift-hours">${s.worked_hours}ч</span>
          ${statusPill(s.status)}
        </div>`;
      weekEl.appendChild(div);
    });
  }

  // Upcoming schedule (next 7 days)
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
  const upcomingScheds = DB.getSchedulesForEmployee(emp.user.id, fmtDate(tomorrow), fmtDate(nextWeek))
    .sort((a, b) => a.date.localeCompare(b.date));
  const upEl = document.getElementById('upcoming-shifts');
  upEl.innerHTML = '';
  if (upcomingScheds.length === 0) {
    upEl.innerHTML = '<div class="empty-state">Няма планирани смени за следващата седмица.</div>';
  } else {
    upcomingScheds.forEach(s => {
      const div = document.createElement('div');
      div.className = 'shift-item';
      div.innerHTML = `
        <div class="shift-left">
          <span class="shift-date">${fmtDateBG(s.date)}</span>
          <span class="shift-name">${(SHIFT_TYPE_MAP[s.shift_type || 'regular'] || {}).label || 'Обичайна'} смяна</span>
        </div>
        <div class="shift-right">
          <span class="shift-hours">${s.planned_hours}ч</span>
          ${shiftBadge(s.shift_type || 'regular')}
        </div>`;
      upEl.appendChild(div);
    });
  }
}

function changeMonth(dir) {
  emp.dashMonth += dir;
  if (emp.dashMonth < 0) { emp.dashMonth = 11; emp.dashYear--; }
  if (emp.dashMonth > 11) { emp.dashMonth = 0; emp.dashYear++; }
  renderEmpDashboard();
}

// ---- CALENDAR ----
function renderEmpCalendar() {
  const { calYear: y, calMonth: m } = emp;
  document.getElementById('cal-month-label').textContent = fmtMonth(y, m);

  const { from, to } = getMonthRange(y, m);
  const shifts = DB.getShifts(emp.user.id, from, to);
  const pens = DB.getPenalties(emp.user.id).filter(p => p.date >= from && p.date <= to);
  const scheds = DB.getSchedulesForEmployee(emp.user.id, from, to);

  const shiftMap = {}; shifts.forEach(s => shiftMap[s.date] = s);
  const penMap = {}; pens.forEach(p => { if (!penMap[p.date]) penMap[p.date] = []; penMap[p.date].push(p); });
  const schedMap = {}; scheds.forEach(s => schedMap[s.date] = s);

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  // Monday-first offset
  let startOff = new Date(y, m, 1).getDay() - 1;
  if (startOff < 0) startOff = 6;
  for (let i = 0; i < startOff; i++) { const e = document.createElement('div'); e.className = 'cal-day empty'; grid.appendChild(e); }

  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayStr = fmtDate(new Date());

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const shift = shiftMap[dateStr];
    const penList = penMap[dateStr];
    const sched = schedMap[dateStr];
    const isToday = dateStr === todayStr;
    const weekend = isWeekend(dateStr);

    let cls = 'cal-day';
    if (isToday) cls += ' today';
    if (weekend) cls += ' weekend';
    if (penList) cls += ' penalized';
    else if (shift) {
      if (shift.worked_hours === 0) cls += ' absent';
      else if (sched && shift.worked_hours < sched.planned_hours * 0.75) cls += ' partial';
      else cls += ' worked';
    } else if (sched && dateStr > todayStr) cls += ' scheduled';

    const el = document.createElement('div');
    el.className = cls;
    el.innerHTML = `
      <span>${day}</span>
      ${shift ? `<span class="cal-hours">${shift.worked_hours}ч</span>` :
        sched ? `<span class="cal-hours">${sched.planned_hours}ч</span>` : ''}
    `;
    el.onclick = () => showCalDayDetail(dateStr, shift, penList, sched);
    grid.appendChild(el);
  }
}

function showCalDayDetail(dateStr, shift, pens, sched) {
  const detail = document.getElementById('day-detail');
  const title = document.getElementById('day-detail-title');
  const content = document.getElementById('day-detail-content');
  title.textContent = fmtDayBG(dateStr);

  let html = '';
  if (sched) {
    html += `<div class="shift-item"><span>Планирана смяна</span><div>${shiftBadge(sched.shift_type || 'regular')} <span class="shift-hours">${sched.planned_hours}ч</span></div></div>`;
  }
  if (shift) {
    html += `<div class="shift-item"><span>Отработено</span><span class="shift-hours">${shift.worked_hours}ч</span></div>`;
    html += `<div class="shift-item"><span>Статус</span>${statusPill(shift.status)}</div>`;
    if (shift.note) html += `<div class="shift-item"><span>Бележка</span><span style="color:var(--text-muted);font-size:0.82rem">${shift.note}</span></div>`;
  } else if (!sched) {
    html += '<p style="color:var(--text-faint);font-size:0.82rem;padding:0.5rem 0">Почивен ден.</p>';
  }
  if (pens?.length) {
    pens.forEach(p => {
      html += `<div class="shift-item" style="border-color:rgba(252,129,129,0.3)">
        <div><span style="font-size:0.82rem">⚠️ ${p.note || 'Наказание'}</span></div>
        <span class="penalty-amount">-${p.amount} лв.</span>
      </div>`;
    });
  }

  content.innerHTML = html || '<p style="color:var(--text-faint);font-size:0.82rem">Няма данни.</p>';
  detail.classList.remove('hidden');
}

function changeCalMonth(dir) {
  emp.calMonth += dir;
  if (emp.calMonth < 0) { emp.calMonth = 11; emp.calYear--; }
  if (emp.calMonth > 11) { emp.calMonth = 0; emp.calYear++; }
  document.getElementById('day-detail')?.classList.add('hidden');
  renderEmpCalendar();
}

// ---- EMPLOYEE SCHEDULE TAB ----
function renderEmpSchedule() {
  const { schedYear: y, schedMonth: m } = emp;
  document.getElementById('sched-month-label').textContent = fmtMonth(y, m);

  const { from, to } = getMonthRange(y, m);
  const scheds = DB.getSchedulesForEmployee(emp.user.id, from, to).sort((a, b) => a.date.localeCompare(b.date));
  const shifts = DB.getShifts(emp.user.id, from, to);
  const shiftMap = {}; shifts.forEach(s => shiftMap[s.date] = s);

  const totalDays = scheds.length;
  const totalHours = scheds.reduce((s, sc) => s + parseFloat(sc.planned_hours || 0), 0);
  const workedDays = scheds.filter(sc => shiftMap[sc.date]?.worked_hours > 0).length;

  document.getElementById('sched-total-days').textContent = totalDays;
  document.getElementById('sched-total-hours').textContent = totalHours;
  document.getElementById('sched-worked-days').textContent = workedDays;

  const container = document.getElementById('emp-schedule-list');
  container.innerHTML = '';

  if (scheds.length === 0) {
    container.innerHTML = '<div class="glass-card"><div class="empty-state">Няма планирани смени за този месец.</div></div>';
    return;
  }

  // Group by week
  const weeks = {};
  scheds.forEach(sc => {
    const { from: wF } = getWeekRange(new Date(sc.date + 'T00:00:00'));
    if (!weeks[wF]) weeks[wF] = [];
    weeks[wF].push(sc);
  });

  Object.entries(weeks).forEach(([weekFrom, daySched]) => {
    const card = document.createElement('div');
    card.className = 'glass-card section-card';

    const weekTo = new Date(weekFrom + 'T00:00:00');
    weekTo.setDate(weekTo.getDate() + 6);
    card.innerHTML = `<div class="card-title-row"><span class="card-title">${fmtDateBG(weekFrom)} — ${fmtDateBG(fmtDate(weekTo))}</span></div>`;

    daySched.forEach(sc => {
      const shift = shiftMap[sc.date];
      const isToday = sc.date === fmtDate(new Date());
      const worked = shift?.worked_hours || 0;
      const done = shift && worked > 0;
      const missed = shift && worked === 0;

      const row = document.createElement('div');
      row.className = 'month-sched-day';
      if (isToday) row.style.background = 'rgba(99,179,237,0.07)';
      row.innerHTML = `
        <span class="msd-date">${fmtDayBG(sc.date).split(',')[0]}, ${new Date(sc.date + 'T00:00:00').getDate()} ${MONTHS_BG[new Date(sc.date + 'T00:00:00').getMonth()]}</span>
        <div class="msd-info">
          <div class="msd-title">${(SHIFT_TYPE_MAP[sc.shift_type || 'regular'] || {}).label || 'Обичайна'} смяна ${isToday ? '<span style="color:var(--accent);font-size:0.7rem">(Днес)</span>' : ''}</div>
          ${sc.note ? `<div class="msd-sub">${sc.note}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
          <span class="msd-hours${done ? ' msd-done' : missed ? ' msd-missed' : ''}">${done ? worked + 'ч отраб.' : missed ? 'Отсъства' : sc.planned_hours + 'ч план.'}</span>
          ${done ? statusPill('present') : missed ? statusPill('absent') : ''}
        </div>
      `;
      card.appendChild(row);
    });
    container.appendChild(card);
  });
}

function changeSchedMonth(dir) {
  emp.schedMonth += dir;
  if (emp.schedMonth < 0) { emp.schedMonth = 11; emp.schedYear--; }
  if (emp.schedMonth > 11) { emp.schedMonth = 0; emp.schedYear++; }
  renderEmpSchedule();
}

// ---- HISTORY TAB ----
function renderEmpHistory() {
  const { histYear: y, histMonth: m } = emp;
  document.getElementById('hist-month-label').textContent = fmtMonth(y, m);

  const { from, to } = getMonthRange(y, m);
  const shifts = DB.getShifts(emp.user.id, from, to);
  const pens = DB.getPenalties(emp.user.id).filter(p => p.date >= from && p.date <= to);

  const totalH = shifts.reduce((s, sh) => s + parseFloat(sh.worked_hours || 0), 0);
  const penSum = pens.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const rate = parseFloat(emp.user.hourly_rate || 0);
  const salary = totalH * rate;
  const net = Math.max(0, salary - penSum);

  document.getElementById('hist-total-hours').textContent = totalH + 'ч';
  document.getElementById('hist-salary').textContent = salary.toFixed(0) + ' лв.';
  document.getElementById('hist-penalties').textContent = penSum.toFixed(0) + ' лв.';
  document.getElementById('hist-net').textContent = net.toFixed(0) + ' лв.';

  const list = document.getElementById('history-list');
  list.innerHTML = '';

  if (shifts.length === 0 && pens.length === 0) {
    list.innerHTML = '<div class="empty-state">Няма данни за избрания месец.</div>'; return;
  }

  const items = [
    ...shifts.map(s => ({ ...s, _type: 'shift' })),
    ...pens.map(p => ({ ...p, _type: 'penalty' })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'shift-item';
    if (item._type === 'shift') {
      div.innerHTML = `
        <div class="shift-left">
          <span class="shift-date">${fmtDateBG(item.date)}</span>
          ${item.note ? `<span class="shift-note">${item.note}</span>` : ''}
        </div>
        <div class="shift-right">
          <span class="shift-hours">${item.worked_hours}ч</span>
          ${statusPill(item.status)}
        </div>`;
    } else {
      div.style.borderColor = 'rgba(252,129,129,0.25)';
      div.innerHTML = `
        <div class="shift-left">
          <span class="shift-date">${fmtDateBG(item.date)}</span>
          <span class="shift-note" style="color:var(--red)">⚠️ ${item.note || 'Наказание'}</span>
        </div>
        <span class="penalty-amount">-${item.amount} лв.</span>`;
    }
    list.appendChild(div);
  });
}

function changeHistMonth(dir) {
  emp.histMonth += dir;
  if (emp.histMonth < 0) { emp.histMonth = 11; emp.histYear--; }
  if (emp.histMonth > 11) { emp.histMonth = 0; emp.histYear++; }
  renderEmpHistory();
}

// ---- PROFILE TAB ----
function renderProfile() {
  if (!emp.user) return;
  const { from, to } = getMonthRange(new Date().getFullYear(), new Date().getMonth());
  const shifts = DB.getShifts(emp.user.id, from, to);
  const pens = DB.getPenalties(emp.user.id).filter(p => p.date >= from && p.date <= to);
  const totalH = shifts.reduce((s, sh) => s + parseFloat(sh.worked_hours || 0), 0);
  const rate = parseFloat(emp.user.hourly_rate || 0);
  const penSum = pens.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const salary = Math.max(0, totalH * rate - penSum);

  document.getElementById('profile-avatar').textContent = initials(emp.user.name);
  document.getElementById('profile-name').textContent = emp.user.name;
  document.getElementById('profile-username').textContent = '@' + emp.user.username;

  document.getElementById('prof-hours').textContent = totalH;
  document.getElementById('prof-salary').textContent = salary.toFixed(0) + ' лв.';
  document.getElementById('prof-penalties').textContent = penSum.toFixed(0) + ' лв.';
  document.getElementById('prof-days').textContent = shifts.filter(s => s.worked_hours > 0).length;
  document.getElementById('prof-rate').textContent = rate + ' лв./ч';

  const goal = parseInt(localStorage.getItem(`sf_goal_${emp.user.id}`) || '160');
  document.getElementById('goal-display').textContent = goal + ' ч';
}

// ---- GOAL ----
function saveGoal() {
  const val = parseInt(document.getElementById('goal-input').value);
  if (!val || val < 1) { showToast('Невалидна цел', 'error'); return; }
  localStorage.setItem(`sf_goal_${emp.user.id}`, val);
  closeModal('modal-set-goal');
  showToast('Целта е запазена ✓');
  renderEmpDashboard();
  renderProfile();
}

// ---- NOTIFICATIONS ----
function toggleNotifications(checkbox) {
  localStorage.setItem('sf_notif', checkbox.checked ? '1' : '0');
  const row = document.getElementById('notif-time-row');
  if (row) row.style.display = checkbox.checked ? 'flex' : 'none';
  if (checkbox.checked) {
    showToast('Известията са включени 🔔', 'info');
    scheduleNotification();
  } else {
    showToast('Известията са изключени');
  }
}

function scheduleNotification() {
  if (!('Notification' in window)) return;
  Notification.requestPermission().then(perm => {
    if (perm === 'granted') showToast('Достъпът до известия е разрешен ✓', 'info');
  });
}

// ============================================================
// PWA
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
}
window.addEventListener('offline', () => {
  if (!document.getElementById('offline-banner')) {
    const b = document.createElement('div');
    b.className = 'offline-banner'; b.id = 'offline-banner';
    b.textContent = '📡 Офлайн режим — данните се запазват локално';
    document.body.prepend(b);
  }
});
window.addEventListener('online', () => document.getElementById('offline-banner')?.remove());
