# Panduan Integrasi Database PostgreSQL Rapkumer

Dokumen ini adalah panduan lengkap untuk menggunakan, mengonfigurasi, memigrasikan data, dan memelihara dukungan database **PostgreSQL** pada Rapkumer di branch `smansage`.

---

## 1. Ikhtisar Arsitektur "Anti-Conflict"

Rapkumer di branch `smansage` dirancang dengan arsitektur **Zero-Merge-Conflict**. Artinya, seluruh kode bawaan developer asli (upstream) yang berbasis SQLite **tidak diubah secara invasif**, sehingga ketika developer asli merilis fitur atau pembaruan baru, Anda dapat melakukan `git pull` / `git merge` dengan mulus tanpa konflik kode.

### Bagaimana ini bekerja?

1. **Skema Asli Tetap Murni SQLite (`schema.ts`)**:
   - Upstream mengubah `src/lib/server/db/schema.ts` $\rightarrow$ Git tidak akan mengalami conflict.
   - Skrip `scripts/sync-pg-schema.mjs` (`pnpm db:pg:sync`) secara otomatis membaca `schema.ts` dan menghasilkan `src/lib/server/db/schema.pg.ts`.
2. **~25 File `ensure-*.ts` Tetap Utuh**:
   - File DDL bawaan upstream (`INTEGER PRIMARY KEY AUTOINCREMENT`, `BLOB`, dll) tidak disentuh.
   - `src/lib/server/db/ensure-helper.ts` memiliki _Runtime DDL Translator_ yang secara transparan menerjemahkan DDL SQLite menjadi sintaks PostgreSQL (`SERIAL PRIMARY KEY`, `BYTEA`) saat aplikasi terhubung ke Postgres.
3. **Collation `nocase` Otomatis**:
   - Query pencarian di route upstream yang memuat `COLLATE NOCASE` tetap valid di PostgreSQL karena koneksi database secara otomatis mendaftarkan collation ICU `nocase` saat inisialisasi.

---

## 2. Konfigurasi Lingkungan (`.env`)

Aplikasi mendeteksi protokol pada variabel `DB_URL`:

- Jika diawali `postgres://` atau `postgresql://` $\rightarrow$ otomatis menggunakan **PostgreSQL**.
- Jika diawali `file:` atau tidak diatur $\rightarrow$ tetap menggunakan **SQLite** (`data/database.sqlite3`).

### Contoh Konfigurasi `.env`:

#### A. PostgreSQL Lokal / Docker

```env
DB_URL="postgresql://postgres:postgres@localhost:5432/rapkumer"
PG_MAX_CONNECTIONS=20
```

#### B. VPS / Server Sekolah (Ubuntu / Debian)

```env
DB_URL="postgresql://rapkumer_user:rahasia123@192.168.1.100:5432/rapkumer_db"
PG_MAX_CONNECTIONS=30
```

#### C. Cloud Database (Supabase / Neon / AWS RDS)

```env
DB_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require"
PG_MAX_CONNECTIONS=15
```

---

## 3. SOP Memindahkan Data (Migrasi SQLite $\rightarrow$ PostgreSQL)

Jika Anda sudah memiliki database SQLite lama (misal `data/database.sqlite3`) dengan data guru, murid, dan nilai yang ingin dipindahkan ke PostgreSQL:

### Langkah 1: Pastikan Database PostgreSQL Sudah Dibuat

Buat database kosong di PostgreSQL (misalnya bernama `rapkumer`):

```sql
CREATE DATABASE rapkumer;
```

### Langkah 2: Jalankan Skrip Migrasi

Jalankan perintah berikut di terminal:

```sh
pnpm db:migrate:to-pg
```

_Skrip akan otomatis membaca `DB_URL` dari file `.env`._

Atau Anda dapat menyertakan URL PostgreSQL langsung via argumen CLI:

```sh
pnpm db:migrate:to-pg -- --pg "postgresql://user:password@localhost:5432/rapkumer"
```

Jika berkas SQLite berada di lokasi khusus:

```sh
pnpm db:migrate:to-pg -- --sqlite "/path/to/database.sqlite3" --pg "postgresql://user:password@localhost:5432/rapkumer"
```

### Apa yang Dilakukan oleh Skrip Migrasi?

1. Menguji koneksi dan mendaftarkan collation `nocase`.
2. Menonaktifkan pemeriksaan foreign key sementara (`session_replication_role = 'replica'`) agar transfer data tidak gagal karena urutan referensi.
3. Mentransfer data per tabel secara berurutan dan mengonversi tipe data (boolean 0/1 ke true/false, bytea, JSON).
4. **Mereset Sequence ID**: Menjalankan `setval()` pada semua tabel agar penambahan murid/nilai baru di masa mendatang tidak menghasilkan duplikasi ID primary key.
5. Mengaktifkan kembali foreign key (`session_replication_role = 'origin'`).

---

## 4. SOP Saat Ada Update dari Developer Asli (Upstream Sync)

Ketika developer asli merilis update (misalnya ada perbaikan bug, penambahan kolom rapor, atau penyesuaian regulasi Dapodik):

```sh
# 1. Tarik pembaruan dari repositori upstream
git pull origin smansage
# atau jika Anda menambahkan remote upstream:
# git pull upstream main

# 2. Pasang dependensi baru (jika ada)
pnpm install

# 3. Sinkronkan skema PostgreSQL
pnpm db:pg:sync

# 4. Validasi TypeScript & kode
pnpm check

# 5. Jalankan aplikasi
pnpm dev
# atau untuk build produksi:
# pnpm build && pnpm start
```

> **Catatan**: Saat aplikasi dijalankan (`pnpm dev` atau `pnpm start`), fitur startup bootstrapping (`runStartupEnsures()`) akan otomatis mendeteksi dan membuat tabel/kolom baru di database PostgreSQL Anda!

---

## 5. Ringkasan Perintah CLI (Cheat Sheet)

| Perintah                | Fungsi                                                                                             |
| :---------------------- | :------------------------------------------------------------------------------------------------- |
| `pnpm db:pg:sync`       | Membaca `schema.ts` dan menghasilkan `schema.pg.ts` untuk PostgreSQL.                              |
| `pnpm db:migrate:to-pg` | Mentransfer seluruh data dari database SQLite ke PostgreSQL.                                       |
| `pnpm db:studio`        | Membuka Drizzle Studio di browser (otomatis mengenali dialect SQLite atau Postgres dari `DB_URL`). |
| `pnpm check`            | Memeriksa validitas tipe TypeScript di seluruh aplikasi.                                           |

---

## 6. Fitur Backup & Reset di Web UI

- **Backup Database (`/pengaturan/database`)**:
  - Pada **SQLite**: Menghasilkan unduhan file `.sqlite3`.
  - Pada **PostgreSQL**: Menghasilkan unduhan file `.json` terstruktur berisi seluruh data tabel.
- **Reset Database (`/pengaturan/database`)**:
  - Pada **SQLite**: Membuat backup sebelum reset dan mengosongkan file SQLite.
  - Pada **PostgreSQL**: Menjalankan `DROP TABLE ... CASCADE` pada seluruh tabel lalu menginisialisasi ulang skema dan akun Admin default secara aman.
