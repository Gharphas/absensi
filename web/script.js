// Inisialisasi & Global State
let employees = [];
let attendanceData = [];
let currentTab = 'dashboard';

// State Kamera WebCam
let mediaStream = null;
let currentCapturedPhoto = null;
let isCameraActive = false;

document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initNavigation();
  initFilterDate();
  initCamera();
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

// 4. WEBCAM / KAMERA SELFIE
function initCamera() {
  const btnToggle = document.getElementById('btnToggleCamera');
  const btnRetake = document.getElementById('btnRetakePhoto');

  btnToggle.addEventListener('click', toggleCamera);
  btnRetake.addEventListener('click', retakePhoto);
}

async function toggleCamera() {
  if (isCameraActive) {
    stopCamera();
  } else {
    await startCamera();
  }
}

async function startCamera() {
  const video = document.getElementById('videoPreview');
  const placeholder = document.getElementById('cameraPlaceholder');
  const overlay = document.getElementById('cameraOverlay');
  const badge = document.getElementById('cameraStatusBadge');
  const btnToggle = document.getElementById('btnToggleCamera');
  const photoSnapshot = document.getElementById('photoSnapshot');
  const btnRetake = document.getElementById('btnRetakePhoto');

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      },
      audio: false
    });

    video.srcObject = mediaStream;
    video.style.display = 'block';
    photoSnapshot.style.display = 'none';
    placeholder.style.display = 'none';
    overlay.style.display = 'flex';
    btnRetake.style.display = 'none';

    badge.textContent = '🟢 Kamera Aktif';
    badge.className = 'camera-badge active';
    btnToggle.innerHTML = '<span>⏹️ Matikan Kamera</span>';
    isCameraActive = true;
    currentCapturedPhoto = null;
  } catch (err) {
    showToast('Izin kamera ditolak atau kamera tidak ditemukan: ' + err.message, 'error');
  }
}

function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  const video = document.getElementById('videoPreview');
  const placeholder = document.getElementById('cameraPlaceholder');
  const overlay = document.getElementById('cameraOverlay');
  const badge = document.getElementById('cameraStatusBadge');
  const btnToggle = document.getElementById('btnToggleCamera');
  const photoSnapshot = document.getElementById('photoSnapshot');
  const btnRetake = document.getElementById('btnRetakePhoto');

  video.srcObject = null;
  video.style.display = 'none';
  overlay.style.display = 'none';

  if (!currentCapturedPhoto) {
    placeholder.style.display = 'flex';
    photoSnapshot.style.display = 'none';
    badge.textContent = 'Kamera Non-Aktif';
    badge.className = 'camera-badge';
  }
  btnToggle.innerHTML = '<span>📷 Nyalakan Kamera</span>';
  btnRetake.style.display = currentCapturedPhoto ? 'inline-flex' : 'none';
  isCameraActive = false;
}

function captureSnapshot() {
  // Jika sudah pernah capture dan kamera mati, gunakan foto yang tersimpan
  if (!isCameraActive && currentCapturedPhoto) {
    return currentCapturedPhoto;
  }

  // Jika kamera tidak aktif sama sekali
  if (!isCameraActive) {
    return null;
  }

  const video = document.getElementById('videoPreview');
  const canvas = document.getElementById('cameraCanvas');
  const photoSnapshot = document.getElementById('photoSnapshot');
  const overlay = document.getElementById('cameraOverlay');
  const badge = document.getElementById('cameraStatusBadge');
  const btnRetake = document.getElementById('btnRetakePhoto');

  // Skala resolusi kompak untuk performa & hemat penyimpanan
  const width = 480;
  const height = video.videoHeight ? Math.round((video.videoHeight / video.videoWidth) * width) : 360;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  // Cerminkan foto agar natural seperti di cermin preview
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, width, height);

  // Kompresi JPEG Base64
  currentCapturedPhoto = canvas.toDataURL('image/jpeg', 0.82);

  // Tampilkan hasil snapshot
  photoSnapshot.src = currentCapturedPhoto;
  photoSnapshot.style.display = 'block';
  video.style.display = 'none';
  overlay.style.display = 'none';

  badge.textContent = '📸 Foto Terambil';
  badge.className = 'camera-badge captured';
  btnRetake.style.display = 'inline-flex';

  // Hentikan stream kamera aktif agar hemat baterai
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  isCameraActive = false;
  document.getElementById('btnToggleCamera').innerHTML = '<span>📷 Nyalakan Kamera</span>';

  return currentCapturedPhoto;
}

function retakePhoto() {
  currentCapturedPhoto = null;
  startCamera();
}

function resetCameraUI() {
  currentCapturedPhoto = null;
  stopCamera();
  document.getElementById('photoSnapshot').style.display = 'none';
  document.getElementById('cameraPlaceholder').style.display = 'flex';
  document.getElementById('btnRetakePhoto').style.display = 'none';
  document.getElementById('cameraStatusBadge').textContent = 'Kamera Non-Aktif';
  document.getElementById('cameraStatusBadge').className = 'camera-badge';
}

// 5. LOAD EMPLOYEES
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

// 6. LOAD ATTENDANCE
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
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px; color: #94a3b8;">Belum ada rekaman absensi untuk kriteria ini.</td></tr>';
    return;
  }

  filtered.forEach((row, i) => {
    const tr = document.createElement('tr');
    let badgeClass = 'badge-hadir';
    if (row.status === 'Terlambat') badgeClass = 'badge-terlambat';
    else if (row.status === 'Izin') badgeClass = 'badge-izin';
    else if (row.status === 'Sakit') badgeClass = 'badge-sakit';

    const photoSrc = row.photo_in || row.photo_out;
    const photoThumb = photoSrc 
      ? `<img class="table-photo-thumb" src="${photoSrc}" alt="Foto ${row.name}" title="Klik untuk melihat foto selfie" onclick="viewPhoto('${row.id}', 'in')" />`
      : `<span class="table-photo-empty" title="Tidak ada foto">👤</span>`;

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${photoThumb}</td>
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

// 7. VIEW PHOTO MODAL
window.viewPhoto = function(attendanceId, type) {
  const item = attendanceData.find(a => String(a.id) === String(attendanceId));
  if (!item) return;

  const photoSrc = type === 'out' && item.photo_out ? item.photo_out : item.photo_in;
  if (!photoSrc) {
    showToast('Foto tidak tersedia', 'info');
    return;
  }

  const modal = document.getElementById('photoModal');
  const img = document.getElementById('photoModalImg');
  const meta = document.getElementById('photoModalMeta');
  const title = document.getElementById('photoModalTitle');

  title.textContent = `Bukti Selfie: ${item.name}`;
  img.src = photoSrc;
  meta.innerHTML = `
    <strong>${item.name}</strong> (${item.nip})<br>
    Divisi: <b>${item.department}</b> | Status: <b>${item.status}</b><br>
    Jam Presensi: <b>${item.check_in || item.check_out || '-'}</b>
  `;
  modal.classList.add('show');
};

// 8. EVENT LISTENERS
function setupEventListeners() {
  // Modal Foto Close
  document.getElementById('btnClosePhotoModal').addEventListener('click', () => {
    document.getElementById('photoModal').classList.remove('show');
  });
  document.getElementById('photoModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('photoModal')) {
      document.getElementById('photoModal').classList.remove('show');
    }
  });

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

    // Ambil foto selfie dari kamera jika aktif / sudah di-capture
    const photoData = captureSnapshot();

    try {
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: empId,
          status: type,
          notes: notes,
          photo: photoData
        })
      });
      const result = await res.json();
      if (result.success) {
        showToast(result.message, 'success');
        document.getElementById('absenNotes').value = '';
        resetCameraUI();
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

    // Ambil foto selfie kepulangan
    const photoData = captureSnapshot();

    try {
      const res = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          employee_id: empId,
          photo: photoData
        })
      });
      const result = await res.json();
      if (result.success) {
        showToast(result.message, 'success');
        resetCameraUI();
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
  const openModal = () => {
    const nextNum = employees.length + 1;
    const suggestedNIP = `EMP${String(nextNum).padStart(3, '0')}`;
    const nipInput = document.getElementById('empNIP');
    if (!nipInput.value) {
      nipInput.placeholder = `Otomatis: ${suggestedNIP}`;
    }
    modal.classList.add('show');
    document.getElementById('empName').focus();
  };

  const closeModal = () => {
    modal.classList.remove('show');
  };

  const btnOpenModal = document.getElementById('btnOpenModalEmployee');
  if (btnOpenModal) btnOpenModal.addEventListener('click', openModal);

  const btnQuickAdd = document.getElementById('btnQuickAddEmployee');
  if (btnQuickAdd) btnQuickAdd.addEventListener('click', openModal);

  document.getElementById('btnCloseModal').addEventListener('click', closeModal);
  document.getElementById('btnCancelModal').addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Submit Tambah Karyawan
  document.getElementById('addEmployeeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSave = document.getElementById('btnSaveEmployee');
    const originalText = btnSave.innerHTML;
    
    const nip = document.getElementById('empNIP').value.trim();
    const name = document.getElementById('empName').value.trim();
    const role = document.getElementById('empRole').value.trim();
    const department = document.getElementById('empDept').value;

    if (!name) {
      showToast('Nama karyawan wajib diisi!', 'error');
      document.getElementById('empName').focus();
      return;
    }

    try {
      btnSave.disabled = true;
      btnSave.innerHTML = '⏳ Menyimpan...';

      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nip, name, role, department })
      });
      const result = await res.json();
      if (result.success) {
        showToast(result.message, 'success');
        closeModal();
        document.getElementById('addEmployeeForm').reset();
        await loadEmployees();
        
        if (result.data && result.data.id) {
          const select = document.getElementById('selectEmployee');
          if (select) select.value = result.data.id;
        }

        await loadAttendance();
      } else {
        showToast(result.message, 'error');
      }
    } catch (err) {
      showToast('Gagal menambah karyawan: ' + err.message, 'error');
    } finally {
      btnSave.disabled = false;
      btnSave.innerHTML = originalText;
    }
  });

  // Export CSV
  document.getElementById('btnExportCSV').addEventListener('click', exportToCSV);
}

// 9. EXPORT CSV
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

// 10. TOAST NOTIFICATION
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
