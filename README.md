# 🏢 Sistem Absensi Data Karyawan (Fullstack Python + Web)

Aplikasi manajemen absensi karyawan modern berbasis web yang dibangun dengan kombinasi:
- **Backend**: Python (Native `http.server` & `sqlite3` — zero external dependency, langsung jalan tanpa install package tambahan!)
- **Frontend**: HTML5, CSS3 (Modern Glassmorphism & Responsive Dashboard), Vanilla JavaScript (ES6+ REST API client)
- **Database**: SQLite3 (`absensi.db` otomatis di-generate)

---

## 🚀 Fitur Utama

1. **⚡ Presensi Cepat (Check-In & Check-Out)**:
   - Pilih karyawan dari dropdown
   - Dukungan tipe presensi: **Hadir**, **Izin**, atau **Sakit**
   - Kolom catatan untuk keterangan dinas luar / surat sakit
   - Jam masuk lewat dari **08:30** otomatis ditandai **Terlambat**
   - Pencatatan jam pulang (Check-Out) secara otomatis
2. **📊 Dashboard Metrik & Statistik Real-Time**:
   - Total Karyawan Aktif
   - Jumlah Hadir Tepat Waktu
   - Jumlah Terlambat
   - Jumlah Izin / Sakit
   - Karyawan Belum Absen
3. **🕒 Jam Digital & Ucapan Waktu Real-Time**:
   - Live clock akurat per detik
   - Ucapan dinamis (Pagi, Siang, Sore, Malam)
4. **📋 Tabel Rekap Kehadiran Harian**:
   - Filter berdasarkan tanggal
   - Pencarian instan (live search berdasarkan Nama, NIP, atau Divisi)
   - Badge status warna-warni (Hadir, Terlambat, Izin, Sakit)
5. **👥 Master Data Karyawan**:
   - Daftar seluruh karyawan
   - Modal popup untuk menambahkan karyawan baru
6. **📥 Export Laporan CSV**:
   - Download rekap data absensi per tanggal dalam format file `.csv` yang langsung bisa dibuka di Microsoft Excel / Google Sheets
7. **🔔 Notifikasi Toast Interaktif**:
   - Pemberitahuan sukses / error yang halus dan elegan

---

## 📁 Struktur Folder

```text
d:\Pythonproject\absensi\
│
├── server.py              # Backend REST API & Static File Server (Python + SQLite)
├── absensi.db             # File database SQLite (dibuat otomatis saat server start)
├── README.md              # Dokumentasi & panduan
│
└── web\
    ├── index.html         # Struktur tampilan antarmuka (Dashboard & Karyawan)
    ├── style.css          # Desain modern, responsive, & clean UI
    └── script.js          # Logika frontend, interaksi API, real-time clock, & export CSV
```

---

## ▶️ Cara Menjalankan

1. Buka Terminal / PowerShell di folder project:
   ```powershell
   cd d:\Pythonproject\absensi
   python server.py
   ```

2. Buka browser (Chrome, Edge, Firefox), lalu akses alamat:
   ```text
   http://localhost:5000
   ```

3. Server sudah otomatis menyertakan 5 data karyawan demo:
   - `EMP001` - Ahmad Fauzi (IT)
   - `EMP002` - Siti Nurhaliza (Design)
   - `EMP003` - Budi Santoso (Finance)
   - `EMP004` - Dewi Lestari (HRD)
   - `EMP005` - Rian Pratama (Marketing)

Anda bisa langsung menambah karyawan baru atau melakukan absensi masuk dan keluar.
