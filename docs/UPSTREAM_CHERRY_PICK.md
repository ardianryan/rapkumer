# Panduan Cherry-Picking Upstream (Aman PostgreSQL & Fitur Sekolah)

Panduan ini mengatur alur kerja saat mengambil pembaruan dari repositori `upstream` (`sira313/rapkumer`) ke branch aktif lokal (`zitadel` / `smansage`) tanpa merusak fitur khusus sekolah maupun dukungan database **PostgreSQL**.

---

## 1. Prinsip Utama

1. **Lokal adalah sumber utama**: fitur khusus sekolah (Rapor Sisipan/STS, AKAS, Zitadel SSO, ScholarGate, R2 Storage, isolasi akses mapel `auth_user_pembelajaran`, visibilitas menu) serta dukungan PostgreSQL ([POSTGRES.md](./POSTGRES.md)) selalu diprioritaskan saat menyelesaikan konflik.
2. **Gunakan `cherry-pick` melalui branch staging**: hindari `git merge` langsung ke `zitadel` jika hanya ingin memilih perbaikan penting. Selalu uji di branch sementara terlebih dahulu.
3. **Catat status sinkronisasi**: posisi terakhir, commit yang diambil, dan commit yang sengaja dilewati dicatat pada `.upstream-sync.json` melalui skrip `pnpm upstream:check`.

---

## 2. Kriteria Seleksi Commit Upstream

| Kategori                           | Contoh Pembaruan                                                         | Keputusan                           |
| :--------------------------------- | :----------------------------------------------------------------------- | :---------------------------------- |
| **Keamanan & Otorisasi**           | Perbaikan CSRF, cek akses kelas/sekolah, validasi upload                 | **Wajib ambil** (`PRIORITAS`)       |
| **Bugfix Inti**                    | Perbaikan Dapodik, cetak PDF/rapor/piagam, hitung absen/sumatif          | **Wajib ambil** (`PRIORITAS`)       |
| **Fitur UI / Fungsional Baru**     | Mobile Dock, peningkatan form/tabel yang relevan dengan sekolah          | **Ambil + adaptasi lokal**          |
| **Skema / Migrasi DB**             | Perubahan `schema.ts` atau penambahan `ensure-*.ts`                      | **Ambil + uji PG** (`CEK_POSTGRES`) |
| **Installer Windows & Bump Versi** | `installer/rapkumer.iss`, `prepare-windows.mjs`, `chore: update version` | **Lewati** (`SKIP_KANDIDAT`)        |
| **SQLite-Only Maintenance**        | Perubahan impor `.sqlite3` di `api/database/import/+server.ts`           | **Lewati / pertahankan blokir PG**  |

---

## 3. Alur Eksekusi Langkah demi Langkah

### Langkah 1: Periksa Commit Baru dari Upstream

```sh
pnpm upstream:check
```

Skrip akan mengambil commit terbaru dari `upstream/main` sejak baseline di `.upstream-sync.json` dan memberi label otomatis (`PRIORITAS`, `REVIEW_KONFLIK`, `CEK_POSTGRES`, `SKIP_KANDIDAT`).

### Langkah 2: Buat Branch Staging dari `zitadel`

```sh
git checkout zitadel
git checkout -b sync/upstream-v2.1.10
```

### Langkah 3: Cherry-Pick Commit Terpilih

```sh
git cherry-pick -x <sha1> <sha2>
```

Flag `-x` menyertakan referensi commit asli upstream pada pesan commit agar riwayat tetap mudah dilacak.

### Langkah 4: Catat Commit yang Diambil atau Dilewati

```sh
# Untuk commit yang berhasil di-cherry-pick:
pnpm upstream:check -- --mark-picked <sha>

# Untuk commit yang sengaja dilewati:
pnpm upstream:check -- --mark-skipped <sha> --reason "Installer Windows saja"
```

Jika seluruh rilis upstream (misal `v2.1.10`) sudah selesai ditinjau, perbarui baseline:

```sh
pnpm upstream:check -- --set-baseline v2.1.10
```

---

## 4. Matriks File Rawan Konflik Lokal

Saat `git cherry-pick` menyentuh berkas di bawah ini, **jangan gunakan `git checkout --theirs`**. Gabungkan perubahan upstream secara selektif sambil mempertahankan logika lokal:

| Berkas                                                                      | Alasan Kustomisasi Lokal yang Wajib Dipertahankan                                                                                              |
| :-------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks.server.ts`                                                       | Scheduler AKAS (`startAkasDailyScheduler`), `unhandledRejection` handler, dukungan reverse proxy (`X-Forwarded-Host`), dan rute publik/Zitadel |
| `src/lib/server/db/index.ts`                                                | Dual-driver SQLite + PostgreSQL (`postgres-js`), registrasi collation `nocase`, dan translator SQL                                             |
| `src/lib/server/db/schema.ts`                                               | Tabel tambahan sekolah (Rapor Sisipan, AKAS, ScholarGate, `auth_user_pembelajaran`, Modul Ajar)                                                |
| `src/lib/components/menu.ts` & `menu-access.ts`                             | Menu khusus lokal serta filter `hiddenMenuPaths` per sekolah                                                                                   |
| `src/lib/components/mobile-dock.svelte`                                     | Pengiriman `hiddenMenuPaths` ke konteks akses menu                                                                                             |
| `src/routes/cetak/rapor/preview-data.ts`                                    | Penyembunyian mapel tanpa kode (`!effectiveKode`), status `belum_dipetakan`, dan `resolveFaseKelas`                                            |
| `src/routes/(informasi-umum)/murid/form/[[id]]/+page.server.ts`             | Dukungan unggah foto ke Cloudflare R2 (`isR2Configured()`)                                                                                     |
| `src/routes/(input-nilai)/asesmen-sumatif/formulir-asesmen/+page.server.ts` | Nilai `cheatUnlocked: true` secara langsung tanpa `tableFeatureUnlock`                                                                         |
| `src/routes/api/database/import/+server.ts`                                 | Penolakan impor `.sqlite3` ketika koneksi aktif menggunakan PostgreSQL                                                                         |

---

## 5. Checklist Wajib Pasca-Cherry-Pick (PostgreSQL & Kualitas)

Sebelum menggabungkan branch staging ke `zitadel` / `smansage`, pastikan seluruh poin berikut lulus:

1. **Sinkronkan Skema PostgreSQL** (wajib jika `schema.ts` berubah):
   ```sh
   pnpm db:pg:sync
   ```
2. **Periksa `ensure-*.ts` Baru atau Berubah**:
   - Pastikan tidak ada query `PRAGMA` atau sintaks DDL SQLite mentah yang belum ditangani di `src/lib/server/db/sql-translate.ts` dan `ensure-helper.ts`.
3. **Periksa Background Task**:
   - Jika upstream menambah scheduler/timer baru, pastikan dibungkus dengan `withDatabaseBackground(...)`.
4. **Validasi Linter & Typecheck**:
   ```sh
   pnpm lint && pnpm check
   ```
5. **Merge ke Branch Utama Lokal**:
   ```sh
   git checkout zitadel
   git merge --no-ff sync/upstream-v2.1.10
   git branch -d sync/upstream-v2.1.10
   ```
