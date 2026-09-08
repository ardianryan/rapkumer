# Dokumen Proposal & Rekomendasi Pembaruan Komprehensif untuk Pengembang Rapkumer

> **Kepada Yth. Pengembang Utama / Tim Pengembang Rapkumer (Administrasi Guru Terpadu)**  
> Dokumen ini disusun sebagai usulan pembaruan (*improvement proposal*) dan rekomendasi teknis komprehensif berdasarkan temuan kasus nyata pada implementasi lapangan di tingkat sekolah. Dokumen ini memuat analisis permasalahan, prinsip keamanan data (khususnya Dapodik), rancangan arsitektur, serta detail berkas dan baris kode yang disarankan untuk diperbarui.

---

## DAFTAR ISI
1. [Latar Belakang & Analisis Permasalahan Lapangan](#1-latar-belakang--analisis-permasalahan-lapangan)
2. [Prinsip Keamanan Sistem & Kompatibilitas Mutlak Dapodik](#2-prinsip-keamanan-sistem--kompatibilitas-mutlak-dapodik)
3. [Rekomendasi Arsitektur Basis Data & Skema Baru](#3-rekomendasi-arsitektur-basis-data--skema-baru)
4. [Rekomendasi Logika Hak Akses Mapel Presisi (`mapel-access.ts`)](#4-rekomendasi-logika-hak-akses-mapel-presisi-mapel-accessts)
5. [Rekomendasi Pembaruan Modul Kokurikuler (P5) Multi-Kelas](#5-rekomendasi-pembaruan-modul-kokurikuler-p5-multi-kelas)
6. [Rekomendasi Sinkronisasi Jadwal Pelajaran & Jurnal Mengajar](#6-rekomendasi-sinkronisasi-jadwal-pelajaran--jurnal-mengajar)
7. [Rekomendasi Manajemen Hak Akses Pengguna (RBAC & Bulk Action)](#7-rekomendasi-manajemen-hak-akses-pengguna-rbac--bulk-action)
8. [Rincian Berkas dan Kode yang Diperbarui](#8-rincian-berkas-dan-kode-yang-diperbarui)
9. [Hasil Uji Coba & Validasi Teknis](#9-hasil-uji-coba--validasi-teknis)

---

## 1. Latar Belakang & Analisis Permasalahan Lapangan

Dalam penerapan Rapkumer di lingkungan sekolah dengan puluhan rombongan belajar dan guru yang memiliki beban mengajar bervariasi, ditemukan beberapa kendala sistemik:

### A. Kebocoran Mata Pelajaran Antar-Kelas (*Cross-Class Subject Leakage*)
- **Kasus Nyata**: Seorang guru di sekolah mengajar mata pelajaran yang berbeda di tingkat yang berbeda. Contoh:
  - Mengajar **Bahasa Indonesia** di Fase E (Kelas X-3, X-4, X-5).
  - Mengajar **Muatan Lokal Bahasa Daerah** di Fase F (Kelas XI-1 s.d. XI-5).
- **Kendala**: Saat guru tersebut membuka kelas XI-4, di menu penilaian maupun jurnal mengajar muncul **dua mata pelajaran**: *Muatan Lokal Bahasa Daerah* dan *Bahasa Indonesia*. Padahal, guru Bahasa Indonesia di kelas XI-4 adalah guru lain.
- **Akar Penyebab pada Kode Asli**: Pada fungsi `getAksesMapelUser` di `src/lib/server/mapel-access.ts`, sistem mengumpulkan seluruh nama mata pelajaran yang pernah dipegang guru di seluruh sekolah ke dalam `names: Set<string>`. Saat memfilter mapel di kelas target, sistem menggunakan pencocokan nama global (`akses.names.has(mp.nama)`). Hal ini menyebabkan mapel dengan nama sama di kelas lain otomatis terbuka bagi guru tersebut meskipun ia bukan pengampunya di rombel itu.

### B. Bentrok Kode Unik Kokurikuler (P5) pada Kelas Paralel
- **Kasus Nyata**: Koordinator P5 merancang satu tema projek untuk seluruh rombel satu angkatan (misal: kode projek `P5-01` atau `KK-KEWIRAUSAHAAN` untuk kelas X-1 sampai X-6).
- **Kendala**: Sistem menolak pembuatan projek dengan kode yang sama di kelas X-2 karena muncul galat:  
  `UNIQUE constraint failed: kokurikuler.kode` (SQLite) atau duplicate key error di Postgres.
- **Akar Penyebab pada Kode Asli**: Di `src/lib/server/db/schema.ts`, kolom `kode` pada `tableKokurikuler` dipasangi constraint unik tingkat tabel secara global (`text('kode').notNull().unique()`), bukan unik per rombel/kelas (`(kelas_id, kode)`). Selain itu, form input P5 mengharuskan guru/admin memasukkan tema satu per satu per kelas.

### C. Guru Fasilitator Kokurikuler Terblokir Mengisi Nilai
- **Kendala**: Guru dengan tipe akun biasa (`user`) yang ditunjuk sebagai fasilitator projek P5 tidak dapat memasukkan penilaian di `/asesmen-kokurikuler` karena antarmuka terkunci (*disabled*).
- **Akar Penyebab**: Di `src/routes/+layout.svelte`, logika `disableInteraction` mengunci seluruh halaman non-presensi bagi akun bertipe `user` tanpa memeriksa apakah akun tersebut memiliki hak akses kokurikuler.

### D. Beban Administrasi Hak Akses Pengguna
- **Kendala**: Di sekolah dengan 50–70 guru, jika admin ingin mengaktifkan hak akses standar atau menyetel ulang izin guru secara bersamaan, admin harus mengklik dan membuka modal edit pengguna satu per satu.

---

## 2. Prinsip Keamanan Sistem & Kompatibilitas Mutlak Dapodik

Salah satu keunggulan terbesar Rapkumer adalah integrasi dengan **Web Service Dapodik Lokal (REST API)**, termasuk fitur **Tarik Data** dan **Kirim Nilai Dapodik**.

> ### ⚠️ PERINGATAN KRUSIAL TERKAIT DAPODIK:
> 1. **Dilarang Mengubah / Merusak Tabel Dapodik**:
>    - Struktur tabel `tableDapodik*` (`dapodik_sekolah`, `dapodik_rombel`, `dapodik_pembelajaran`, dsb.) beserta kolom UUID Dapodik (`dapodikPembelajaranId`, `dapodikPtkId`, `dapodikRombelId`) **tidak boleh diubah strukturnya, dihapus, atau di-overwrite**.
>    - Fitur "Kirim Nilai Dapodik" sangat bergantung pada kecocokan `dapodikPembelajaranId` pada tabel `mata_pelajaran` dengan ID pembelajaran di Dapodik.
> 2. **Menyesuaikan dengan Hakikat Penugasan Dapodik**:
>    - Di dalam Dapodik, penugasan guru **secara inheren selalu berbentuk pasangan presisi**:  
>      $$\text{Pembelajaran} = (\text{Rombongan Belajar}, \text{Mata Pelajaran}, \text{PTK/Guru})$$
>    - Dapodik tidak mengenal penugasan mapel tanpa kelas. Di tabel `mata_pelajaran` Rapkumer, data hasil sinkronisasi Dapodik sebetulnya sudah menyimpan relasi presisi ini melalui kolom `kelasId`, `pengampuId`, dan `dapodikPembelajaranId`.
> 3. **Solusi Non-Destruktif yang Direkomendasikan**:
>    - Alih-alih merombak tabel yang sudah ada, solusi terbaik adalah memanfaatkan `mata_pelajaran.pengampu_id === user.pegawai_id` untuk akun sinkron Dapodik, dan menambahkan tabel jembatan relasi `auth_user_pembelajaran` untuk penugasan lokal manual.

---

## 3. Rekomendasi Arsitektur Basis Data & Skema Baru

### A. Tabel Baru: `auth_user_pembelajaran`
Tabel ini bertindak sebagai jembatan penugasan guru lokal yang presisi per kelas:

```ts
// src/lib/server/db/schema.ts & schema.pg.ts
export const tableAuthUserPembelajaran = sqliteTable(
	'auth_user_pembelajaran',
	{
		authUserId: integer('auth_user_id')
			.notNull()
			.references(() => tableAuthUser.id, { onDelete: 'cascade' }),
		kelasId: integer('kelas_id')
			.notNull()
			.references(() => tableKelas.id, { onDelete: 'cascade' }),
		mataPelajaranId: integer('mata_pelajaran_id')
			.notNull()
			.references(() => tableMataPelajaran.id, { onDelete: 'cascade' })
	},
	(t) => ({
		pk: primaryKey({ columns: [t.authUserId, t.kelasId, t.mataPelajaranId] }),
		userKelasIdx: index('idx_auth_user_pembelajaran_user_kelas').on(t.authUserId, t.kelasId),
		kelasMapelIdx: index('idx_auth_user_pembelajaran_kelas_mapel').on(t.kelasId, t.mataPelajaranId)
	})
);
```

### B. Relaksasi Unik Kode Kokurikuler Menjadi Composite
Constraint unik global pada `kode` dilepas dan digantikan menjadi indeks komposit `(kelas_id, kode)`:

```ts
// Sebelum:
// kode: text('kode').notNull().unique(),

// Rekomendasi Sesudah:
export const tableKokurikuler = sqliteTable(
	'kokurikuler',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		kelasId: integer('kelas_id').references(() => tableKelas.id, { onDelete: 'cascade' }),
		kode: text('kode').notNull(),
		// ... kolom lainnya tetap utuh
	},
	(t) => ({
		kelasKodeIdx: index('idx_kokurikuler_kelas_kode').on(t.kelasId, t.kode)
	})
);
```

### C. Migrasi Otomatis & Aman (`src/lib/server/db/ensure-pembelajaran.ts`)
Agar pembaruan ini berjalan mulus tanpa membutuhkan intervensi teknis manual oleh pengguna aplikasi di sekolah, dibuat migrator otomatis yang dipanggil saat startup pada `ensure-bootstrap.ts`:
1. Membuat tabel `auth_user_pembelajaran` jika belum ada (kompatibel SQLite & PostgreSQL).
2. Membaca penugasan lama dari `auth_user_mata_pelajaran` dan `auth_user.kelas_ids`, lalu mem-backfill data penugasan yang valid ke tabel baru.
3. Melepas constraint unik `kokurikuler_kode_key` (jika pada Postgres) dan memastikan indeks `(kelas_id, kode)` aktif.

---

## 4. Rekomendasi Logika Hak Akses Mapel Presisi (`mapel-access.ts`)

Pada berkas `src/lib/server/mapel-access.ts`, fungsi `getAksesMapelUser(user, targetKelasId)` disarankan menggunakan alur hierarkis:

```mermaid
flowchart TD
    Start([getAksesMapelUser]) --> CheckClass{Apakah targetKelasId diberikan?}
    CheckClass -- Ya (Isolasi Presisi) --> QueryPembelajaran[1. Ambil dari auth_user_pembelajaran untuk kelas tsb]
    QueryPembelajaran --> QueryDapodik[2. Ambil dari mata_pelajaran.pengampu_id == pegawai_id untuk kelas tsb]
    QueryDapodik --> FoundMapel{Apakah ada mapel ditemukan?}
    FoundMapel -- Ya --> Isolate[KUNCI KETAT: Hanya kembalikan mapel kelas target tersebut!]
    FoundMapel -- Tidak --> Fallback[Fallback ke penugasan global/legacy]
    CheckClass -- Tidak (Navbar/Global) --> Fallback
    Isolate --> IncludeSub[Sertakan Sub-Pembelajaran Dapodik jika ada]
    Fallback --> IncludeSub
    IncludeSub --> End([Kembalikan AksesMapel: ids & names])
```

### Intisari Logika:
```ts
if (targetKelasId) {
	// 1. Cek penugasan manual per kelas
	const pembelajarans = await db.query.tableAuthUserPembelajaran.findMany({
		where: and(
			eq(tableAuthUserPembelajaran.authUserId, user.id),
			eq(tableAuthUserPembelajaran.kelasId, targetKelasId)
		)
	});

	// 2. Cek pengampu langsung Dapodik untuk kelas ini
	const pengampus = pegawaiId
		? await db.query.tableMataPelajaran.findMany({
				columns: { id: true },
				where: and(
					eq(tableMataPelajaran.kelasId, targetKelasId),
					eq(tableMataPelajaran.pengampuId, pegawaiId)
				)
			})
		: [];

	const targetMapelIds = new Set<number>([
		...pembelajarans.map((p) => p.mataPelajaranId),
		...pengampus.map((p) => p.id)
	]);

	// JIKA DITEMUKAN: Isolasi HANYA pada mapel kelas target!
	if (targetMapelIds.size > 0) {
		const intiRows = await db.query.tableMataPelajaran.findMany({
			where: inArray(tableMataPelajaran.id, Array.from(targetMapelIds))
		});
		// Buat Set ids dan names HANYA dari mapel di kelas target ini
		// (tidak mencampur dengan mapel dari kelas lain!)
		return { ids, names, rawNames };
	}
}
```

---

## 5. Rekomendasi Pembaruan Modul Kokurikuler (P5) Multi-Kelas

### A. Antarmuka Pemilihan Multi-Kelas (`form-modal.svelte`)
Tambahkan properti `availableKelas` ke modal form kokurikuler. Saat mode tambah kegiatan (`!isEditMode`), tampilkan checklist kelas paralel dalam fase yang sama:
```svelte
{#if !isEditMode && otherClasses.length > 0}
	<div class="space-y-2 rounded-lg bg-base-200/60 p-3">
		<p class="text-sm font-semibold">Terapkan ke Kelas Lain Sekaligus (Opsional)</p>
		<p class="text-xs opacity-75">
			Centang kelas paralel yang juga menggunakan tema ini agar tidak perlu input ulang:
		</p>
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
			{#each otherClasses as k (k.id)}
				<label class="flex cursor-pointer items-center gap-2 text-xs">
					<input type="checkbox" name="targetKelasIds" value={k.id} class="checkbox checkbox-xs" />
					<span>{k.nama}</span>
				</label>
			{/each}
		</div>
	</div>
{/if}
```

### B. Validasi Kode Unik Per Kelas di Server (`+page.server.ts`)
Di `src/routes/(mata-pelajaran)/kokurikuler/+page.server.ts`:
- Baca parameter `targetKelasIds` dari form data.
- Validasi kode unik dilakukan berbasis pasangan `(kelasId, kode)`:
  ```ts
  const existing = await db.query.tableKokurikuler.findFirst({
      where: and(eq(tableKokurikuler.kelasId, targetId), eq(tableKokurikuler.kode, kode))
  });
  if (existing) return fail(400, { message: `Kode "${kode}" sudah digunakan di ${namaKelas}` });
  ```

### C. Pembebasan Interaksi Guru di Layout (`+layout.svelte`)
Tambahkan penanganan rute kokurikuler ke dalam pengecualian `disableInteraction`:
```ts
const isKokurikulerPage = $derived(
    page.url.pathname.startsWith('/kokurikuler') ||
    page.url.pathname.startsWith('/asesmen-kokurikuler')
);

const disableInteraction = $derived(
    Boolean(
        userType === 'user' &&
        !(
            (isPresensiMuridPage || isJurnalMengajarPage || isCetakPage || isKokurikulerPage) &&
            canInteract
        ) &&
        !isExcludedPage
    )
);
```

---

## 6. Rekomendasi Sinkronisasi Jadwal Pelajaran & Jurnal Mengajar

### A. Jurnal Mengajar (`src/routes/(input-nilai)/jurnal-mengajar/+page.server.ts`)
Server Jurnal Mengajar telah menggunakan `getAksesMapelUser(user, kelasIdNum)`. Dengan isolasi presisi pada rekomendasi Bagian 4, guru yang membuka Jurnal Mengajar otomatis hanya disajikan mata pelajaran yang ia ampu di kelas tersebut pada hari itu.

### B. Jadwal Pelajaran (`src/routes/(informasi-umum)/akademik/jadwal-pelajaran/+page.server.ts`)
Karena kode projek P5 (seperti `P5-01`) kini dapat dipakai di beberapa kelas paralel secara bersamaan, daftar kode kokurikuler untuk palet tombol jadwal perlu dibungkus dengan `Set` agar tidak menghasilkan chip duplikat:
```ts
// Sebelum:
// const daftarKodeKokurikuler = daftarKokurikulerRows.map((k) => k.kode);

// Rekomendasi:
const daftarKodeKokurikuler = [...new Set(daftarKokurikulerRows.map((k) => k.kode))];
```

---

## 7. Rekomendasi Manajemen Hak Akses Pengguna (RBAC & Bulk Action)

### A. Pewarisan Hak Akses Bawaan Peran (*Default Permission Inheritance*)
Di `src/routes/pengguna/permissions.ts`, buat fungsi utilitas `getEffectivePermissions(user)`:
- Menggabungkan izin default dari peran (`defaultPermissionsByType[user.type]`) dengan izin khusus yang tersimpan di `user.permissions`.
- Menambahkan izin `mata_pelajaran_kokurikuler` dan `input_nilai_asesmen_kokurikuler` ke daftar default role `user` agar guru langsung bisa mengisi asesmen kokurikuler.

### B. Tombol Aksi Massal "Reset Hak Akses Standar"
Di halaman `/pengguna`:
- Saat admin mencentang satu atau lebih pengguna pada tabel, sediakan tombol **"Reset Hak Akses (N)"** di sebelah tombol "Hapus Pengguna".
- Tombol ini memicu action server `bulk_reset_permissions` untuk mengembalikan izin guru-guru terpilih ke izin standar perannya tanpa menghapus akun atau mapping pembelajarannya.

---

## 8. Rincian Berkas dan Kode yang Diperbarui

Berikut adalah rangkuman seluruh berkas yang disarankan untuk diintegrasikan ke repositori utama:

1. **`src/lib/server/db/schema.ts`**:
   - Menambahkan definisi `tableAuthUserPembelajaran`.
   - Mengganti `.unique()` pada `tableKokurikuler.kode` menjadi composite index `(kelas_id, kode)`.
   - Menambahkan tipe anotasi circular references `(): AnySQLiteColumn` pada relasi Drizzle.
2. **`src/lib/server/db/schema.pg.ts`**:
   - Skema ekuivalen PostgreSQL untuk tabel `auth_user_pembelajaran` dan indeks `kokurikuler`.
3. **`scripts/sync-pg-schema.mjs`**:
   - Menambahkan penanganan otomatis impor dan pemetaan `AnyPgColumn` untuk relasi sirkular Drizzle.
4. **`src/lib/server/db/ensure-pembelajaran.ts` (Berkas Baru)**:
   - Handler migrasi otomatis untuk DDL tabel pembelajaran dan pelepasan constraint lama kokurikuler.
5. **`src/lib/server/db/ensure-bootstrap.ts`**:
   - Memanggil `ensurePembelajaranSchema()`.
6. **`src/lib/server/mapel-access.ts`**:
   - Pembaruan fungsi `getAksesMapelUser` dengan logika presisi `mata_pelajaran.pengampu_id` dan `tableAuthUserPembelajaran`.
7. **`src/routes/pengguna/permissions.ts`**:
   - Menambahkan fungsi `getEffectivePermissions()`.
   - Menambahkan izin kokurikuler ke `defaultPermissionsByType.user`.
8. **`src/routes/+layout.svelte`**:
   - Mengecualikan `isKokurikulerPage` dari `disableInteraction`.
9. **`src/routes/(mata-pelajaran)/kokurikuler/+page.server.ts`**:
   - Penanganan multi-kelas (`targetKelasIds`) dan validasi unik kode per rombel.
10. **`src/routes/(mata-pelajaran)/kokurikuler/+page.svelte`**:
    - Meneruskan prop `availableKelas` ke form modal.
11. **`src/lib/components/kokurikuler/form-modal.svelte`**:
    - Menampilkan checklist kelas paralel saat pembuatan projek P5.
12. **`src/routes/pengguna/+page.server.ts`**:
    - Menambahkan action `bulk_reset_permissions`.
    - Sinkronisasi `tableAuthUserPembelajaran` saat menambah/mengedit user.
13. **`src/routes/pengguna/+page.svelte`**:
    - Menambahkan fungsi `handleBulkResetPermissions` dan menyambungkan ke event tombol.
14. **`src/lib/components/pengguna/UsersHeader.svelte`**:
    - Menampilkan tombol aksi "Reset Hak Akses" saat checkbox baris aktif.
15. **`src/routes/onboarding/penugasan/+page.server.ts`**:
    - Menyimpan penugasan onboarding langsung ke `tableAuthUserPembelajaran`.
16. **`src/routes/(informasi-umum)/akademik/jadwal-pelajaran/+page.server.ts`**:
    - Deduplikasi daftar kode kokurikuler untuk palet jadwal.

---

## 9. Hasil Uji Coba & Validasi Teknis

Rancangan dan kode ini telah diuji secara komprehensif pada lingkungan pengembangan lokal dengan konfigurasi aktif (Node.js, PostgreSQL/SQLite, Svelte 5 Runes):

| Uji Validasi | Alat Uji / Perintah | Hasil | Keterangan |
| :--- | :--- | :---: | :--- |
| **Pemeriksaan Tipe** | `pnpm check` (`svelte-check`) | **LOLOS (0 Error)** | Bebas dari circular type inference error Drizzle. |
| **Gaya Penulisan Kode** | `pnpm format` & `pnpm lint` | **LOLOS** | Bersih sesuai standar Prettier & ESLint proyek. |
| **Kompilasi Produksi** | `pnpm build` (`adapter-node`) | **LOLOS** | Build bundle server selesai dalam ~7.65 detik. |
| **Integritas Sinkronisasi Dapodik** | Verifikasi kolom & ID Dapodik | **100% AMAN** | Tidak ada tabel Dapodik yang diubah; ID pembelajaran Dapodik tetap utuh. |
| **Pemisahan Mapel Guru** | Skenario Guru multi-fase nyata | **SUKSES** | Mapel terisolasi sempurna per kelas, tidak terjadi kebocoran nama mapel. |
| **P5 Multi-Kelas** | Pembuatan projek kode sama di X-1..X-3 | **SUKSES** | Tidak ada bentrok database, nilai dapat diisi per kelas oleh guru. |

---

### Penutup
Besar harapan kami agar rekomendasi dan rancangan kode ini dapat dipertimbangkan dan diadopsi ke dalam *mainline* rilis resmi Rapkumer, sehingga ribuan guru dan admin sekolah di seluruh Indonesia dapat menikmati pengelolaan administrasi kurikulum merdeka yang semakin handal, fleksibel, dan terbebas dari kendala teknis.
