// Inisialisasi & Global State
let employees = [];
let attendanceData = [];
let currentTab = 'dashboard';

document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initNavigation();
  initFilterDate();
  loadEmployees();
  loadAttendance();
  setupEventListeners();
});

// 1. CLOCK & GREETING
function initClock() {
  const clockEl = document.getElementById('digitalClock');
  const greetingEl = document.getElementById('greetingText');
  const dateEl = document.getElementById('currentDateText');

  function update() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    clockEl.textContent = `${hours}:${minutes}:${seconds}`;

    // Update greeting
    const h = now.getHours();
    let greet = 'Selamat Malam';
    if (h >= 4 && h < 11) greet = 'Selamat Pagi';
    else if (h >= 11 && h < 15) greet = 'Selamat Siang';
    else if (h >= 15 && h < 18) greet = 'Selamat Sore';
    greetingEl.textContent = `${greet}, Admin HRD!`;

    // Date
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = now.toLocaleDateString('id-ID', options);
  }

  update();
  setInterval(update, 1000);
}

// 2. NAVIGATION
function initNavigation() {
  const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      menuItems.forEach(m => m.classList.remove('active'));
      item.classList.add('active');

      const targetTab = item.getAttribute('data-tab');
      document.querySelectorAll('.tab-pane').forEach(tab => {
        tab.classList.remove('active');
      });
      document.getElementById(`tab-${targetTab}`).classList.add('active');
      currentTab = targetTab;
    });
  });
}

// 3. FILTER DATE
function initFilterDate() {
  const dateInput = document.getElementById('filterDate');
  const today = new Date().toISOString().split('T')[0];
  dateInput.value = today;

  dateInput.addEventListener('change', () => {
    loadAttendance(dateInput.value);
  });
}

// 4. LOAD EMPLOYEES
async function loadEmployees() {
  try {
    const res = await fetch('/api/employees');
    const data = await res.json();
    if (data.success) {
      employees = data.data;
      renderEmployeeSelect();
      renderEmployeeTable();
    }
  } catch (err) {
    showToast('Gagal memuat data karyawan: ' + err.message, 'error');
  }
}

function renderEmployeeSelect() {
  const select = document.getElementById('selectEmployee');
  select.innerHTML = '<option value="">-- Pilih Karyawan --</option>';
  employees.forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp.id;
    opt.textContent = `${emp.nip} - ${emp.name} (${emp.department})`;
    select.appendChild(opt);
  });
}

function renderEmployeeTable() {
  const tbody = document.getElementById('employeeTbody');
  tbody.innerHTML = '';
  if (employees.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Belum ada data karyawan.</td></tr>';
    return;
  }

  employees.forEach((emp, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td><strong>${emp.nip}</strong></td>
      <td>${emp.name}</td>
      <td>${emp.role}</td>
      <td><span class="badge badge-dept">${emp.department}</span></td>
      <td><span class="badge badge-hadir">${emp.status || 'Aktif'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// 5. LOAD ATTENDANCE
async function loadAttendance(dateStr) {
  const targetDate = dateStr || document.getElementById('filterDate').value;
  try {
    const res = await fetch(`/api/attendance?date=${targetDate}`);
    const data = await res.json();
    if (data.success) {
      attendanceData = data.data;
      updateStats(data.summary);
      renderAttendanceTable(attendanceData);
    }
  } catch (err) {
    showToast('Gagal memuat absensi: ' + err.message, 'error');
  }
}

function updateStats(summary) {
  if (!summary) return;
  document.getElementById('statTotal').textContent = summary.total_karyawan || 0;
  document.getElementById('statHadir').textContent = summary.hadir || 0;
  document.getElementById('statTerlambat').textContent = summary.terlambat || 0;
  document.getElementById('statIzin').textContent = (summary.izin || 0) + (summary.sakit || 0);
  document.getElementById('statBelum').textContent = summary.belum_hadir || 0;
}

function renderAttendanceTable(list) {
  const tbody = document.getElementById('attendanceTbody');
  tbody.innerHTML = '';

  const query = document.getElementById('searchAttendance').value.toLowerCase();
  const filtered = list.filter(item => 
    item.name.toLowerCase().includes(query) || 
    item.nip.toLowerCase().includes(query) ||
    item.department.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px; color: #94a3b8;">Belum ada rekaman absensi untuk kriteria ini.</td></tr>';
    return;
  }

  filtered.forEach((row, i) => {
    const tr = document.createElement('tr');
    let badgeClass = 'badge-hadir';
    if (row.status === 'Terlambat') badgeClass = 'badge-terlambat';
    else if (row.status === 'Izin') badgeClass = 'badge-izin';
    else if (row.status === 'Sakit') badgeClass = 'badge-sakit';

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><strong>${row.nip}</strong></td>
      <td>${row.name}</td>
      <td><span class="badge badge-dept">${row.department}</span></td>
      <td>${row.check_in || '-'}</td>
      <td>${row.check_out || '<span style="color:#94a3b8">Belum</span>'}</td>
      <td><span class="badge ${badgeClass}">${row.status}</span></td>
      <td>${row.notes || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 6. EVENT LISTENERS
function setupEventListeners() {
  // Check-In Form Submit
  document.getElementById('attendanceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const empId = document.getElementById('selectEmployee').value;
    const type = document.querySelector('input[name="attendanceType"]:checked').value;
    const notes = document.getElementById('absenNotes').value.trim();

    if (!empId) {
      showToast('Pilih karyawan terlebih dahulu!', 'error');
      return;
    }

    try {
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: empId,
          status: type,
          notes: notes
        })
      });
      const result = await res.json();
      if (result.success) {
        showToast(result.message, 'success');
        document.getElementById('absenNotes').value = '';
        loadAttendance();
      } else {
        showToast(result.message, 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan jaringan: ' + err.message, 'error');
    }
  });

  // Check-Out Button Click
  document.getElementById('btnCheckOut').addEventListener('click', async () => {
    const empId = document.getElementById('selectEmployee').value;
    if (!empId) {
      showToast('Pilih karyawan yang akan Check-Out!', 'error');
      return;
    }

    try {
      const res = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: empId })
      });
      const result = await res.json();
      if (result.success) {
        showToast(result.message, 'success');
        loadAttendance();
      } else {
        showToast(result.message, 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan jaringan: ' + err.message, 'error');
    }
  });

  // Search Live
  document.getElementById('searchAttendance').addEventListener('input', () => {
    renderAttendanceTable(attendanceData);
  });

  // Modal Tambah Karyawan
  const modal = document.getElementById('employeeModal');
  document.getElementById('btnOpenModalEmployee').addEventListener('click', () => {
    modal.classList.add('show');
  });
  document.getElementById('btnCloseModal').addEventListener('click', () => {
    modal.classList.remove('show');
  });
  document.getElementById('btnCancelModal').addEventListener('click', () => {
    modal.classList.remove('show');
  });

  // Submit Tambah Karyawan
  document.getElementById('addEmployeeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nip = document.getElementById('empNIP').value.trim();
    const name = document.getElementById('empName').value.trim();
    const role = document.getElementById('empRole').value.trim();
    const department = document.getElementById('empDept').value;

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nip, name, role, department })
      });
      const result = await res.json();
      if (result.success) {
        showToast(result.message, 'success');
        modal.classList.remove('show');
        document.getElementById('addEmployeeForm').reset();
        await loadEmployees();
        await loadAttendance();
      } else {
        showToast(result.message, 'error');
      }
    } catch (err) {
      showToast('Gagal menambah karyawan: ' + err.message, 'error');
    }
  });

  // Export CSV
  document.getElementById('btnExportCSV').addEventListener('click', exportToCSV);
}

// 7. EXPORT CSV
function exportToCSV() {
  if (attendanceData.length === 0) {
    showToast('Tidak ada data untuk diexport', 'error');
    return;
  }

  const dateVal = document.getElementById('filterDate').value;
  let csv = 'No,NIP,Nama Karyawan,Departemen,Check-In,Check-Out,Status,Keterangan\n';

  attendanceData.forEach((row, i) => {
    const cleanNotes = (row.notes || '').replace(/,/g, ' ');
    csv += `${i + 1},${row.nip},"${row.name}","${row.department}",${row.check_in || '-'},${row.check_out || '-'},${row.status},"${cleanNotes}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `absensi_karyawan_${dateVal}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('File CSV berhasil diunduh!', 'success');
}

// 8. TOAST NOTIFICATION
let toastTimer = null;
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast show ${type}`;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = 'toast';
  }, 3200);
}
