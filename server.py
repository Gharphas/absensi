import http.server
import socketserver
import json
import sqlite3
import os
import sys
from datetime import datetime, date
from urllib.parse import urlparse, parse_qs

PORT = 5000
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_FILE = os.path.join(BASE_DIR, "absensi.db")
WEB_DIR = os.path.join(BASE_DIR, "web")

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    # Tabel Karyawan
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nip TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        department TEXT NOT NULL,
        status TEXT DEFAULT 'Aktif',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Tabel Absensi
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        check_in TEXT,
        check_out TEXT,
        status TEXT NOT NULL, -- Hadir, Izin, Sakit, Terlambat
        notes TEXT,
        photo_in TEXT,
        photo_out TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
    """)

    # Migrasi otomatis kolom foto jika tabel sudah ada sebelumnya
    cursor.execute("PRAGMA table_info(attendance)")
    existing_cols = [col[1] for col in cursor.fetchall()]
    if "photo_in" not in existing_cols:
        cursor.execute("ALTER TABLE attendance ADD COLUMN photo_in TEXT")
    if "photo_out" not in existing_cols:
        cursor.execute("ALTER TABLE attendance ADD COLUMN photo_out TEXT")

    # Seed data default jika masih kosong
    cursor.execute("SELECT COUNT(*) FROM employees")
    if cursor.fetchone()[0] == 0:
        default_employees = [
            ("EMP001", "Ahmad Fauzi", "Software Engineer", "IT"),
            ("EMP002", "Siti Nurhaliza", "UI/UX Designer", "Design"),
            ("EMP003", "Budi Santoso", "Finance Specialist", "Finance"),
            ("EMP004", "Dewi Lestari", "HR Manager", "HRD"),
            ("EMP005", "Rian Pratama", "Marketing Specialist", "Marketing")
        ]
        cursor.executemany("INSERT INTO employees (nip, name, role, department) VALUES (?, ?, ?, ?)", default_employees)

        # Seed data absensi hari ini untuk demonstrasi
        today_str = date.today().strftime("%Y-%m-%d")
        cursor.execute("SELECT id FROM employees")
        emp_ids = [row[0] for row in cursor.fetchall()]
        if emp_ids:
            cursor.execute("""
            INSERT INTO attendance (employee_id, date, check_in, check_out, status, notes)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (emp_ids[0], today_str, "08:15:00", None, "Hadir", "Tepat waktu"))
            if len(emp_ids) > 1:
                cursor.execute("""
                INSERT INTO attendance (employee_id, date, check_in, check_out, status, notes)
                VALUES (?, ?, ?, ?, ?, ?)
                """, (emp_ids[1], today_str, "09:05:00", None, "Terlambat", "Macet di tol"))

    conn.commit()
    conn.close()

# Pastikan DB selalu terinisialisasi saat server.py dimuat
init_db()

class AbsensiHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def _send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')
        if not path:
            path = "/"
        query = parse_qs(parsed.query)

        if path == "/api/employees":
            conn = sqlite3.connect(DB_FILE)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM employees ORDER BY id ASC")
            rows = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return self._send_json(200, {"success": True, "data": rows})

        elif path == "/api/attendance":
            target_date = query.get("date", [date.today().strftime("%Y-%m-%d")])[0]
            conn = sqlite3.connect(DB_FILE)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            query_sql = """
                SELECT a.id, a.employee_id, e.nip, e.name, e.department, e.role,
                       a.date, a.check_in, a.check_out, a.status, a.notes,
                       a.photo_in, a.photo_out
                FROM attendance a
                JOIN employees e ON a.employee_id = e.id
                WHERE a.date = ?
                ORDER BY a.id DESC
            """
            cursor.execute(query_sql, (target_date,))
            rows = [dict(row) for row in cursor.fetchall()]

            # Hitung rekap
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
                    SUM(CASE WHEN status = 'Terlambat' THEN 1 ELSE 0 END) as terlambat,
                    SUM(CASE WHEN status = 'Izin' THEN 1 ELSE 0 END) as izin,
                    SUM(CASE WHEN status = 'Sakit' THEN 1 ELSE 0 END) as sakit
                FROM attendance
                WHERE date = ?
            """, (target_date,))
            summary_row = dict(cursor.fetchone())
            cursor.execute("SELECT COUNT(*) FROM employees WHERE status = 'Aktif'")
            total_karyawan = cursor.fetchone()[0]
            summary_row["total_karyawan"] = total_karyawan
            summary_row["belum_hadir"] = max(0, total_karyawan - (summary_row["total"] or 0))

            conn.close()
            return self._send_json(200, {
                "success": True, 
                "date": target_date,
                "summary": summary_row,
                "data": rows
            })

        elif path == "/api/summary":
            # Ringkasan bulanan / umum
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM employees WHERE status = 'Aktif'")
            total_emp = cursor.fetchone()[0]
            conn.close()
            return self._send_json(200, {"success": True, "total_employees": total_emp})

        # Static files serving
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        try:
            payload = json.loads(body)
        except Exception:
            payload = {}

        if path == "/api/attendance/check-in":
            emp_id = payload.get("employee_id")
            notes = payload.get("notes", "")
            status_override = payload.get("status") # optional: Izin, Sakit
            photo = payload.get("photo", None) # Base64 Image
            now = datetime.now()
            today_str = now.strftime("%Y-%m-%d")
            time_str = now.strftime("%H:%M:%S")

            if not emp_id:
                return self._send_json(400, {"success": False, "message": "ID Karyawan wajib diisi"})

            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()

            # Cek apakah sudah absen hari ini
            cursor.execute("SELECT id, check_in FROM attendance WHERE employee_id = ? AND date = ?", (emp_id, today_str))
            existing = cursor.fetchone()
            if existing:
                conn.close()
                return self._send_json(400, {"success": False, "message": f"Karyawan sudah melakukan absensi hari ini (Jam: {existing[1]})"})

            # Tentukan status default jika tidak dispesifikasikan (lewat jam 08:30 = Terlambat)
            if status_override in ["Izin", "Sakit"]:
                status = status_override
                check_in_time = None
            else:
                threshold_time = "08:30:00"
                status = "Terlambat" if time_str > threshold_time else "Hadir"
                check_in_time = time_str

            cursor.execute("""
                INSERT INTO attendance (employee_id, date, check_in, status, notes, photo_in)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (emp_id, today_str, check_in_time, status, notes, photo))
            conn.commit()
            new_id = cursor.lastrowid
            conn.close()

            return self._send_json(200, {
                "success": True,
                "message": f"Absensi berhasil disimpan ({status})",
                "data": {"id": new_id, "status": status, "time": check_in_time}
            })

        elif path == "/api/attendance/check-out":
            emp_id = payload.get("employee_id")
            photo = payload.get("photo", None)
            now = datetime.now()
            today_str = now.strftime("%Y-%m-%d")
            time_str = now.strftime("%H:%M:%S")

            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, check_in, check_out FROM attendance 
                WHERE employee_id = ? AND date = ?
            """, (emp_id, today_str))
            row = cursor.fetchone()

            if not row:
                conn.close()
                return self._send_json(400, {"success": False, "message": "Karyawan belum melakukan Check-In hari ini"})

            if row[2]:
                conn.close()
                return self._send_json(400, {"success": False, "message": f"Karyawan sudah Check-Out pada {row[2]}"})

            cursor.execute("UPDATE attendance SET check_out = ?, photo_out = ? WHERE id = ?", (time_str, photo, row[0]))
            conn.commit()
            conn.close()

            return self._send_json(200, {
                "success": True,
                "message": f"Check-Out berhasil dicatat pada {time_str}"
            })

        elif path == "/api/employees":
            name = (payload.get("name") or "").strip()
            nip = (payload.get("nip") or "").strip().upper()
            role = (payload.get("role") or "Staf").strip()
            dept = (payload.get("department") or "Umum").strip()

            if not name:
                return self._send_json(400, {"success": False, "message": "Nama karyawan wajib diisi!"})

            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()

            # Jika NIP kosong, otomatis buatkan NIP unik
            if not nip:
                cursor.execute("SELECT MAX(id) FROM employees")
                max_id = cursor.fetchone()[0] or 0
                nip = f"EMP{max_id + 1:03d}"
                # Pastikan tidak tabrakan
                while True:
                    cursor.execute("SELECT id FROM employees WHERE nip = ?", (nip,))
                    if not cursor.fetchone():
                        break
                    max_id += 1
                    nip = f"EMP{max_id + 1:03d}"

            try:
                cursor.execute(
                    "INSERT INTO employees (nip, name, role, department, status) VALUES (?, ?, ?, ?, 'Aktif')",
                    (nip, name, role, dept)
                )
                conn.commit()
                emp_id = cursor.lastrowid
                conn.close()
                return self._send_json(200, {
                    "success": True, 
                    "message": f"Karyawan '{name}' ({nip}) berhasil ditambahkan!",
                    "data": {
                        "id": emp_id,
                        "nip": nip,
                        "name": name,
                        "role": role,
                        "department": dept
                    }
                })
            except sqlite3.IntegrityError:
                conn.close()
                return self._send_json(400, {"success": False, "message": f"NIP '{nip}' sudah terdaftar, gunakan NIP lain!"})
            except Exception as e:
                conn.close()
                return self._send_json(500, {"success": False, "message": f"Terjadi kesalahan database: {str(e)}"})

        return self._send_json(404, {"success": False, "message": "Endpoint tidak ditemukan"})

def main():
    init_db()
    os.chdir(os.path.dirname(__file__))
    with socketserver.ThreadingTCPServer(("", PORT), AbsensiHandler) as httpd:
        print(f"=====================================================")
        print(f"🚀 Server Absensi Karyawan berjalan di:")
        print(f"👉 http://localhost:{PORT}")
        print(f"👉 http://127.0.0.1:{PORT}")
        print(f"Tekan Ctrl+C untuk menghentikan server.")
        print(f"=====================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer dihentikan.")

if __name__ == "__main__":
    main()
