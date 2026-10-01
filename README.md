# Deteksi SQL Injection Real-Time — N-Gram + Random Forest pada Log Aktivitas Database

Prototipe tugas akhir: toko online **TokoAman** (aktor Admin & User) yang seluruh aktivitas
database-nya dicatat PostgreSQL, di-*stream* oleh log collector, lalu setiap nilai input
diklasifikasikan **Normal / SQLi** oleh model *character n-gram TF-IDF + Random Forest*.
Hasil deteksi beserta **pengguna pelakunya** tampil real-time di dashboard admin.

```
User/Admin ─► React (nginx) ─► FastAPI (ORM, bound params) ─► PostgreSQL
                                   │  /* app:uid=..;sid=..;rid=..;ip=..;ep=.. */   │ jsonlog: statement + parameters
                                   │                                               ▼
                                   │                          collector (tail -F) ─► normalize ─► n-gram TF-IDF ─► Random Forest
                                   │                                                                                   │
        Admin Dashboard ◄─ WebSocket ◄─ LISTEN attack_events ◄──── NOTIFY ◄──── attack_logs (INSERT, role detector) ◄─┘
```

## Menjalankan

Prasyarat: Docker Desktop.

```bash
cp .env.example .env          # ganti semua secret
docker compose up -d --build  # db, backend, collector, frontend
```

| URL | Isi |
|---|---|
| http://localhost:8080 | Toko + dashboard admin (`/admin`) |
| http://localhost:8000/docs | OpenAPI backend |

Akun demo (dibuat oleh `backend/app/seed.py`):

| Peran | Email | Password |
|---|---|---|
| Admin | nilai `ADMIN_EMAIL` di `.env` (default `admin@tokoaman.id`) | `ADMIN_PASSWORD` (default `Admin12345!`) |
| User | `budi@example.com`, `siti@example.com`, `rizky@example.com`, `dewi@example.com`, `mallory@example.com` | `Password123!` |

Coba: login sebagai `mallory@example.com`, cari `kaos' UNION SELECT password_hash FROM users--`,
lalu buka dashboard admin di tab lain — baris SQLi muncul seketika dengan nama pelaku.

## Struktur repositori

| Folder | Isi |
|---|---|
| `detector/` | Paket bersama: preprocessing (FR-13), fitur n-gram (FR-14), inferensi + severity (FR-15/16/19), baseline rule-based |
| `ml/` | Dataset, skrip eksperimen, laporan (`ml/reports/`), model `ml/artifacts/model.joblib` |
| `backend/` | FastAPI + SQLAlchemy + Alembic: e-commerce, auth JWT/argon2, RBAC, API monitoring, WebSocket |
| `db/` | Image PostgreSQL 16 dengan logging `jsonlog` + role `shop`/`detector` |
| `collector/` | Layanan streaming log → deteksi → `attack_logs` + `NOTIFY` |
| `frontend/` | React + Vite + Tailwind + Recharts |
| `lab/` | **Lab terisolasi**: target rentan + sqlmap di jaringan Docker `internal` |

## Keputusan desain (ringkas)

1. **Sumber data = log query PostgreSQL asli** (`log_statement=all`, `log_destination=jsonlog`).
   Aplikasi memakai *bound parameters*, sehingga payload pengguna muncul di field `detail`
   (`parameters: $1 = '…'`) terpisah dari teks SQL. Collector mengklasifikasikan **nilai
   parameter**, bukan seluruh query — itulah bagian yang dikendalikan penyerang, dan bentuknya
   sama dengan dataset payload publik.
2. **Tagging pelaku (FR-10)**: hook `before_cursor_execute` SQLAlchemy menambahkan komentar
   `/* app:uid=…;sid=…;rid=…;ip=…;ep=… */` dari `ContextVar` per request. Semua field
   disanitasi (tidak bisa menutup komentar atau menyisipkan `%`). `rid` dipakai collector untuk
   menghitung satu nilai satu kali per request. Login gagal / anonim → `uid=-` dan nilai yang
   diketik disimpan sebagai `attempted_username` + IP (FR-12).
3. **Mencegah feedback loop**: collector menulis memakai role `detector` dengan
   `ALTER ROLE detector SET log_statement='none'` dan hak minimum (INSERT `attack_logs`,
   SELECT kolom `id,name,email` dari `users` saja).
4. **Real-time push**: collector `NOTIFY attack_events` → backend `LISTEN` (psycopg async) →
   broadcast WebSocket ke admin. Tanpa Redis/broker tambahan.
5. **Preprocessing**: URL-decode berulang, HTML-unescape, Unicode NFKC, lowercase, hapus komentar
   blok (isi komentar versi MySQL dipertahankan), komentar baris → token `sqlcomment`,
   angka → `0`, normalisasi spasi.
6. **Deduplikasi sebelum split** (pada teks ter-normalisasi) untuk mencegah *data leakage*;
   teks yang muncul dengan dua label dibuang.
7. shadcn/ui tidak dipakai — beberapa komponen Tailwind sudah cukup (menghindari over-engineering).

## Hasil eksperimen

Dataset (setelah dedup): **33.303** sampel (SQLi 27,7%) dari HttpParams (Morzeux), PayloadsAllTheThings,
FuzzDB, dan data normal e-commerce sintetis. Split stratified 80/20, CV 5-fold pada data latih.
Detail: `ml/reports/` (`dataset_stats.json`, `stage1_features.csv`, `stage2_rf_tuning.csv`, `test_results.json`, `lab_results.json`).

**Seleksi fitur (CV, RF default)** — terbaik: *char n-gram (1,3) + TF-IDF* (F1 0,9980, FPR 0,0001).
Word n-gram (1,1) TF-IDF hampir setara (F1 0,9975); char (2,5)/(2,4) justru lebih buruk (FPR ≈0,0023).
Tuning RF: `n_estimators=100, max_depth=None, min_samples_leaf=1` terbaik.

| Model | Test publik F1 | Test publik FPR | ROC-AUC | **Lab F1** | **Lab FPR** | Latensi mean / p95 |
|---|---|---|---|---|---|---|
| **Random Forest** | 0,9984 | 0,000 | 0,9992 | **0,9965** | **0,0274** | 7,4 / 10,3 ms |
| Multinomial NB | 0,9965 | 0,001 | 0,9996 | 0,9965 | 0,0137 | 0,7 / 1,0 ms |
| Logistic Regression | 0,9965 | 0,000 | 0,9994 | 0,9941 | 0,0205 | 0,6 / 0,8 ms |
| Linear SVM | 0,9981 | 0,000 | 0,9995 | 0,9969 | 0,0137 | 2,0 / 2,8 ms |
| Rule-based | 0,9776 | 0,010 | – | 0,9873 | 0,0205 | – |

*Lab* = 3.430 payload sqlmap hasil lab terisolasi + 146 input normal tulisan tangan; 149 sampel yang
teksnya sudah ada di data latih dibuang. Latensi diukur di laptop pengembang (single query,
termasuk preprocessing). Uji pipeline penuh di Docker: latensi model ~10–25 ms dan
**delay log→tersimpan ~40–90 ms**, jauh di bawah target awal 1 detik (NFR-01).

**Temuan untuk Bab Pembahasan**

- Skor test publik ≈ sempurna karena data normal & serangan publik sangat mudah dipisahkan;
  **test lab adalah ukuran yang lebih jujur** (FPR RF naik ke 2,7%).
- False positive di lab: teks normal dengan `#` / `--` (mis. "Order #INV/…", "Barang ok -- recommended")
  dan angka dalam kurung ("(0721) 773456"). Penyebabnya token `sqlcomment` dan pola `(0`.
- False negative: *probe* heuristik sqlmap seperti `kaos'prButw<'">)ZZKNSw` (p≈0,4) — string
  pemecah sintaks, bukan eksploit utuh.
- RF tidak unggul jelas atas Linear SVM/NB pada data ini, dan ~3–10× lebih lambat — tetap
  memenuhi target real-time. Ini hasil yang layak dilaporkan apa adanya.
- Model **tidak** di-tuning ulang memakai data lab agar data lab tetap *held-out*.

## Keterbatasan

- Hanya input yang **sampai ke database** yang terlihat. Input yang ditolak validasi FastAPI
  (mis. `product_id` bukan angka, email register bukan format email) tidak pernah masuk log.
- Data normal sebagian sintetis; label beberapa sampel publik bising (kata tunggal seperti
  `distinct`, `replace` berlabel SQLi).
- `log_statement=all` menambah beban I/O database; untuk produksi perlu sampling atau
  pemfilteran per role/database.
- IP diambil dari `X-Forwarded-For` yang di-*set* nginx; port backend 8000 hanya diikat ke `127.0.0.1`.

## Pengujian

```bash
python -m venv .venv && .venv/Scripts/pip install -e detector -e collector -r backend/requirements-dev.txt pandas
.venv/Scripts/python -m pytest ml/tests collector/tests      # 37 tes pipeline deteksi
cd backend && ../.venv/Scripts/python -m pytest tests        # 13 tes API, RBAC, tagging (SQLite)
```

## Reproduksi eksperimen

```bash
python ml/scripts/download_data.py
python ml/scripts/generate_normal.py
python ml/scripts/build_dataset.py
python ml/scripts/train.py                     # ~3 menit; tulis ml/artifacts/model.joblib
docker compose -f lab/docker-compose.yml up --build --abort-on-container-exit   # lab terisolasi
python lab/scripts/build_lab_dataset.py
cd ml/scripts && python evaluate_lab.py
```

Setelah melatih ulang, rebuild collector: `docker compose up -d --build collector`
(versi scikit-learn di `collector/requirements.txt` harus sama dengan versi saat training).

## Pekerjaan lanjutan (di luar scope)

Analisis bypass WAF, integrasi ModSecurity/OWASP CRS, scoring severity lanjutan, serangan non-SQLi,
retraining otomatis dari data false positive (`/api/monitor/false-positives.csv` sudah tersedia).
