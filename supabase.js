/* ================================================================
   supabase.js — Supabase client + demo data layer + SQL schema
   ShiftFlow 2.0
   ================================================================ */

// ============================================================
// CONFIGURATION — Replace with your Supabase project details
// ============================================================
const SUPABASE_URL      = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const DEMO_MODE = (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_URL');

let supabaseClient = null;
if (!DEMO_MODE && window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ============================================================
// HELPERS
// ============================================================
function _fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function _daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return _fmtDate(d);
}
function _daysAhead(n) {
  const d = new Date(); d.setDate(d.getDate() + n); return _fmtDate(d);
}

// ============================================================
// DEMO DATA INITIALIZATION
// ============================================================
function initDemoData() {
  if (localStorage.getItem('sf_v2_init')) return;

  const today = _fmtDate(new Date());

  const users = [
    { id: 'mgr-1',  username: 'manager1', password: '1234', role: 'manager',  name: 'Главен Мениджър', hourly_rate: 0 },
    { id: 'emp-1',  username: 'emp1',     password: '1234', role: 'employee', name: 'Иван Петров',     hourly_rate: 9 },
    { id: 'emp-2',  username: 'emp2',     password: '1234', role: 'employee', name: 'Мария Иванова',   hourly_rate: 8.5 },
    { id: 'emp-3',  username: 'emp3',     password: '1234', role: 'employee', name: 'Георги Стоев',    hourly_rate: 10 },
    { id: 'emp-4',  username: 'emp4',     password: '1234', role: 'employee', name: 'Елена Николова',  hourly_rate: 9.5 },
  ];

  // Schedules: past 14 days + next 7 days
  const schedules = [];
  const shifts     = [];

  const empIds = ['emp-1','emp-2','emp-3','emp-4'];
  const shiftTypes = ['regular','6h','12h','weekend','overtime'];
  const hoursMap = { regular:8, '6h':6, '12h':12, weekend:8, overtime:10 };

  let schedId = 1, shiftId = 1;

  // Past 14 days — create schedule + shifts
  for (let dayOffset = 14; dayOffset >= 1; dayOffset--) {
    const dateStr = _daysAgo(dayOffset);
    const dow = new Date(dateStr + 'T00:00:00').getDay(); // 0=Sun,6=Sat
    const isWeekend = dow === 0 || dow === 6;

    empIds.forEach((empId, idx) => {
      // Not all employees work every day
      if (isWeekend && idx > 1) return;
      if (!isWeekend && Math.random() < 0.15) return; // ~15% off

      const type = isWeekend ? 'weekend' : (dayOffset % 5 === 0 ? 'overtime' : (idx % 2 === 0 ? '12h' : 'regular'));
      const planned = hoursMap[type] || 8;

      schedules.push({ id: `s${schedId++}`, employee_id: empId, date: dateStr, planned_hours: planned, shift_type: type, note: '' });

      // Worked hours (slightly varies)
      const workedH = Math.random() < 0.1 ? 0 : (planned - Math.floor(Math.random() * 2));
      const status  = workedH === 0 ? 'absent' : (workedH < planned * 0.75 ? 'partial' : 'present');
      shifts.push({ id: `sh${shiftId++}`, employee_id: empId, date: dateStr, worked_hours: Math.max(0, workedH), status, note: '' });
    });
  }

  // Today
  empIds.forEach((empId, idx) => {
    const types = ['regular','6h','12h','regular'];
    const type = types[idx] || 'regular';
    schedules.push({ id: `s${schedId++}`, employee_id: empId, date: today, planned_hours: hoursMap[type], shift_type: type, note: idx === 2 ? 'Сутринна смяна' : '' });
  });

  // Next 7 days — only schedules (no shifts yet)
  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    const dateStr = _daysAhead(dayOffset);
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    const isWeekend = dow === 0 || dow === 6;

    empIds.forEach((empId, idx) => {
      if (isWeekend && idx > 1) return;
      const type = isWeekend ? 'weekend' : (idx % 2 === 0 ? '8h' : 'regular');
      const planned = isWeekend ? 8 : 8;
      schedules.push({ id: `s${schedId++}`, employee_id: empId, date: dateStr, planned_hours: planned, shift_type: isWeekend ? 'weekend' : 'regular', note: '' });
    });
  }

  const penalties = [
    { id: 'p1', employee_id: 'emp-1', amount: 15, note: 'Закъснение 30 мин.',  date: _daysAgo(8) },
    { id: 'p2', employee_id: 'emp-2', amount: 20, note: 'Неуведомено отсъствие', date: _daysAgo(5) },
    { id: 'p3', employee_id: 'emp-3', amount: 10, note: 'Ранно напускане',      date: _daysAgo(3) },
    { id: 'p4', employee_id: 'emp-1', amount: 25, note: 'Повреда на инвентар',  date: _daysAgo(12) },
  ];

  localStorage.setItem('sf_users_v2',     JSON.stringify(users));
  localStorage.setItem('sf_schedules_v2', JSON.stringify(schedules));
  localStorage.setItem('sf_shifts_v2',    JSON.stringify(shifts));
  localStorage.setItem('sf_penalties_v2', JSON.stringify(penalties));
  localStorage.setItem('sf_v2_init', '1');
}

// ============================================================
// AUTH
// ============================================================
const Auth = {
  async login(username, password) {
    if (DEMO_MODE) {
      initDemoData();
      const users = JSON.parse(localStorage.getItem('sf_users_v2') || '[]');
      const user = users.find(u => u.username === username && u.password === password);
      if (!user) throw new Error('Грешно потребителско име или парола.');
      localStorage.setItem('sf_session', JSON.stringify({ user, expires: Date.now() + 8*3600*1000 }));
      return user;
    }
    throw new Error('Supabase не е конфигуриран.');
  },

  logout() {
    localStorage.removeItem('sf_session');
    window.location.href = 'index.html';
  },

  getUser() {
    const raw = localStorage.getItem('sf_session');
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (Date.now() > s.expires) { this.logout(); return null; }
    return s.user;
  },

  requireRole(role) {
    const user = this.getUser();
    if (!user) { window.location.href = 'index.html'; return null; }
    if (user.role !== role) {
      window.location.href = user.role === 'manager' ? 'manager.html' : 'employee.html';
      return null;
    }
    return user;
  }
};

// ============================================================
// DB LAYER (demo mode)
// ============================================================
const DB = {
  // --- USERS / EMPLOYEES ---
  getEmployees() {
    return JSON.parse(localStorage.getItem('sf_users_v2') || '[]').filter(u => u.role === 'employee');
  },
  getEmployee(id) {
    return JSON.parse(localStorage.getItem('sf_users_v2') || '[]').find(u => u.id === id);
  },
  createEmployee(emp) {
    const users = JSON.parse(localStorage.getItem('sf_users_v2') || '[]');
    if (users.find(u => u.username === emp.username)) throw new Error('Потребителското име вече съществува.');
    emp.id = 'emp-' + Date.now(); emp.role = 'employee';
    users.push(emp);
    localStorage.setItem('sf_users_v2', JSON.stringify(users));
    return emp;
  },
  updateEmployee(id, data) {
    const users = JSON.parse(localStorage.getItem('sf_users_v2') || '[]');
    const idx = users.findIndex(u => u.id === id);
    if (idx >= 0) users[idx] = { ...users[idx], ...data };
    localStorage.setItem('sf_users_v2', JSON.stringify(users));
  },

  // --- SCHEDULE ---
  getSchedules(dateFrom, dateTo) {
    return JSON.parse(localStorage.getItem('sf_schedules_v2') || '[]')
      .filter(s => (!dateFrom || s.date >= dateFrom) && (!dateTo || s.date <= dateTo));
  },
  getSchedulesByDate(date) {
    return JSON.parse(localStorage.getItem('sf_schedules_v2') || '[]').filter(s => s.date === date);
  },
  getSchedulesForEmployee(empId, dateFrom, dateTo) {
    return this.getSchedules(dateFrom, dateTo).filter(s => s.employee_id === empId);
  },
  addSchedule(sched) {
    const arr = JSON.parse(localStorage.getItem('sf_schedules_v2') || '[]');
    sched.id = 'sched-' + Date.now();
    arr.push(sched);
    localStorage.setItem('sf_schedules_v2', JSON.stringify(arr));
    return sched;
  },
  deleteSchedule(id) {
    const arr = JSON.parse(localStorage.getItem('sf_schedules_v2') || '[]').filter(s => s.id !== id);
    localStorage.setItem('sf_schedules_v2', JSON.stringify(arr));
  },

  // --- SHIFTS ---
  getShifts(empId, dateFrom, dateTo) {
    let arr = JSON.parse(localStorage.getItem('sf_shifts_v2') || '[]');
    if (empId)    arr = arr.filter(s => s.employee_id === empId);
    if (dateFrom) arr = arr.filter(s => s.date >= dateFrom);
    if (dateTo)   arr = arr.filter(s => s.date <= dateTo);
    return arr;
  },
  getShiftsByDate(date) {
    return JSON.parse(localStorage.getItem('sf_shifts_v2') || '[]').filter(s => s.date === date);
  },
  upsertShift(shift) {
    const arr = JSON.parse(localStorage.getItem('sf_shifts_v2') || '[]');
    const idx = arr.findIndex(s => s.employee_id === shift.employee_id && s.date === shift.date);
    if (idx >= 0) { arr[idx] = { ...arr[idx], ...shift }; }
    else { shift.id = 'shift-' + Date.now(); arr.push(shift); }
    localStorage.setItem('sf_shifts_v2', JSON.stringify(arr));
    return shift;
  },
  updateShift(id, data) {
    const arr = JSON.parse(localStorage.getItem('sf_shifts_v2') || '[]');
    const idx = arr.findIndex(s => s.id === id);
    if (idx >= 0) arr[idx] = { ...arr[idx], ...data };
    localStorage.setItem('sf_shifts_v2', JSON.stringify(arr));
  },

  // --- PENALTIES ---
  getPenalties(empId) {
    const arr = JSON.parse(localStorage.getItem('sf_penalties_v2') || '[]');
    return empId ? arr.filter(p => p.employee_id === empId) : arr;
  },
  addPenalty(pen) {
    const arr = JSON.parse(localStorage.getItem('sf_penalties_v2') || '[]');
    pen.id = 'pen-' + Date.now();
    arr.push(pen);
    localStorage.setItem('sf_penalties_v2', JSON.stringify(arr));
    return pen;
  },
  deletePenalty(id) {
    const arr = JSON.parse(localStorage.getItem('sf_penalties_v2') || '[]').filter(p => p.id !== id);
    localStorage.setItem('sf_penalties_v2', JSON.stringify(arr));
  },
};

/* ================================================================
   SUPABASE SQL SCHEMA — paste into Supabase SQL Editor
   ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('manager','employee')),
  name          TEXT NOT NULL,
  hourly_rate   NUMERIC(8,2) DEFAULT 0,
  restaurant_id UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE schedule (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  planned_hours NUMERIC(4,1) NOT NULL,
  shift_type    TEXT DEFAULT 'regular',
  note          TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shifts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  worked_hours  NUMERIC(4,1) DEFAULT 0,
  status        TEXT DEFAULT 'present' CHECK (status IN ('present','absent','partial','penalty')),
  note          TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

CREATE TABLE penalties (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  amount        NUMERIC(8,2) NOT NULL,
  note          TEXT DEFAULT '',
  date          DATE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE penalties ENABLE ROW LEVEL SECURITY;

-- Employee policies (own data only)
CREATE POLICY "emp_own_data"    ON users     FOR SELECT USING (id = auth.uid() OR role='manager');
CREATE POLICY "emp_own_shifts"  ON shifts    FOR SELECT USING (employee_id = auth.uid());
CREATE POLICY "emp_own_sched"   ON schedule  FOR SELECT USING (employee_id = auth.uid());
CREATE POLICY "emp_own_pens"    ON penalties FOR SELECT USING (employee_id = auth.uid());

-- Manager policies (all data)
CREATE POLICY "mgr_all_shifts"  ON shifts    FOR ALL USING (EXISTS(SELECT 1 FROM users WHERE id=auth.uid() AND role='manager'));
CREATE POLICY "mgr_all_sched"   ON schedule  FOR ALL USING (EXISTS(SELECT 1 FROM users WHERE id=auth.uid() AND role='manager'));
CREATE POLICY "mgr_all_pens"    ON penalties FOR ALL USING (EXISTS(SELECT 1 FROM users WHERE id=auth.uid() AND role='manager'));
CREATE POLICY "mgr_all_users"   ON users     FOR ALL USING (EXISTS(SELECT 1 FROM users WHERE id=auth.uid() AND role='manager'));

================================================================ */
