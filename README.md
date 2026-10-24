<div align="center">

# Sistem Informasi Manajemen & Administrasi Sekolah Terpadu

### Comprehensive School Management, Academic Assessment & Institutional Operations Platform

[![SvelteKit](https://img.shields.io/badge/SvelteKit_2-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)](https://svelte.dev/)
[![Svelte 5 Runes](https://img.shields.io/badge/Svelte_5-Runes-F45A20?style=for-the-badge&logo=svelte&logoColor=white)](https://svelte.dev/)
[![TailwindCSS 4](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![SQLite](https://img.shields.io/badge/SQLite_3-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Node.js](https://img.shields.io/badge/Node.js_20_LTS-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

<br />

<p align="center">
  Solusi digital terintegrasi untuk pengelolaan akademik kurikulum nasional, asesmen sumatif & formatif dinamis, pelaporan tengah semester (STS) & akhir semester, presensi otomatis, jadwal dan bel sekolah digital, administrasi kepegawaian, hingga sinkronisasi data Dapodik.
</p>

</div>

---

## 📌 Ikhtisar Platform

Platform ini dirancang untuk menjawab kebutuhan administrasi sekolah modern dalam satu ekosistem yang terpadu, cepat, dan aman. Berbeda dengan aplikasi rapor konvensional yang kaku dan hanya berfokus pada hasil akhir, sistem ini mendampingi guru dan tenaga kependidikan sepanjang siklus pembelajaran:

1. **Fleksibilitas Kurikulum & Asesmen**: Mendukung Kurikulum Merdeka secara penuh, mulai dari pemetaan Capaian Pembelajaran (CP), penyusunan Tujuan Pembelajaran (TP) berbantuan AI, penilaian formatif harian, hingga penilaian sumatif lingkup materi dan STS/SAS.
2. **Otomatisasi Operasional Sekolah**: Bell otomatis berbasis audio, penjadwalan guru dan mata pelajaran, buku tamu digital dengan penandatanganan paraf elektronik, serta modul dinas luar/SPPD terbit otomatis.
3. **Multi-Deployment Ready**: Dapat beroperasi secara mandiri (_standalone desktop_) berbasis SQLite untuk komputer lokal, maupun mode jaringan terpusat berbasis server jaringan institusi (PostgreSQL/LAN/Cloud).

---

## ✨ Fitur Unggulan

### 1. Penilaian Akademik & Rapor Komprehensif

- **Penilaian Intrakurikuler**: Pengolahan nilai formatif dan sumatif secara fleksibel, dilengkapi fitur kalkulasi rata-rata otomatis dan pembobotan proporsional.
- **Rapor Sisipan Tengah Semester (STS/PTS)**: Format rapor sisipan dinamis dengan batas sub-kolom tugas formatif ($F_1..F_n$) dan ulangan materi ($S_1..S_n$) yang dapat dikonfigurasi mandiri oleh administrator sekolah. Asesmen yang tidak dilaksanakan oleh guru mata pelajaran secara otomatis ditandai silang ($X$) demi transparansi penilaian.
- **Cetak Rapor & Dokumen Resmi**: Menghasilkan dokumen cetak berstandar percetakan (PDF resolusi tinggi via PagedJS dan Chromium Engine), meliputi Rapor Tengah Semester, Rapor Akhir Semester, Cover Rapor, Biodata Peserta Didik, Leger Nilai, hingga Piagam Penghargaan.
- **Dukungan Tipografi Khusus**: Render tipografi bilingual yang mulus untuk teks Latin dan Arab pada mata pelajaran Pendidikan Agama Islam dan Bahasa Arab.

### 2. Integrasi Data & Dapodik Desktop

- **Sinkronisasi Dapodik**: Tarik dan sinkronkan data identitas sekolah, rombongan belajar, guru PTK, data murid, hingga penugasan mengajar secara langsung.
- **Ekspor & Impor E-Rapor**: Format ekspor spreadsheet Excel yang kompatibel langsung untuk pengunggahan ke server pusat E-Rapor Kemendikdasmen.

### 3. Presensi & Kehadiran Terpadu

- **Presensi Fleksibel**: Mendukung skema presensi per-hari (masuk & pulang) maupun presensi per-mata pelajaran untuk verifikasi jam belajar efektif.
- **Sinkronisasi AKAS**: Integrasi penarikan log kehadiran digital secara instan.
- **Rekapitulasi Otomatis**: Kalkulasi persentase kehadiran harian, bulanan, dan akumulasi paruh semester yang terhubung langsung ke lembar rapor siswa.

### 4. Administrasi Guru & Tata Usaha

- **Jurnal Mengajar Harian**: Pencatatan aktivitas materi ajar, kehadiran siswa dalam kelas, serta kendala proses belajar mengajar.
- **Buku Tamu Digital**: Pencatatan tamu sekolah lengkap dengan foto identitas dan tanda tangan langsung melalui canvas layar sentuh.
- **Dinas Luar & SPPD**: Pengajuan surat tugas, bukti perjalanan dinas, dan pencetakan lembar SPPD formal.
- **Bel Sekolah Digital Terjadwal**: Otomatisasi pengingat jam masuk, istirahat, pergantian jam pelajaran, dan kepulangan dengan playlist audio kustom.

### 5. Asisten AI Capaian Pembelajaran

- Generator otomatis lingkup materi dan Tujuan Pembelajaran (TP) berbasis AI terintegrasi untuk membantu meringankan beban administratif perencanaan guru.

---

## 🛠️ Arsitektur Teknologi

| Komponen            | Teknologi                    | Deskripsi                                                                     |
| :------------------ | :--------------------------- | :---------------------------------------------------------------------------- |
| **Framework Utama** | SvelteKit 2 + Svelte 5       | Arsitektur modern berbasis Svelte 5 Runes (`$state`, `$derived`, `$props`)    |
| **User Interface**  | Tailwind CSS 4 + DaisyUI 5   | Komponen responsif, ramah aksesibilitas, dengan dukungan Dark Mode persisten  |
| **Database Engine** | SQLite (LibSQL) & PostgreSQL | Fleksibilitas SQLite untuk desktop dan PostgreSQL untuk skala jaringan/server |
| **ORM & Migrasi**   | Drizzle ORM                  | Schema type-safe dan migrasi terorkestrasi                                    |
| **PDF Rendering**   | PagedJS + Puppeteer Core     | Mesin cetak PDF standar percetakan berbasis HTML/CSS Print Media              |
| **Autentikasi**     | Session-based & Zitadel SSO  | Manajemen sesi terenkripsi dengan kontrol hak akses berbasis peran (RBAC)     |

---

## 🚀 Panduan Memulai (Quickstart)

### Prasyarat Sistem

- **Node.js**: Versi 20 LTS (direkomendasikan)
- **Package Manager**: `pnpm` (wajib, `engine-strict=true`)
- **Browser Engine**: Google Chrome atau Chromium terpasang di sistem untuk rendering cetak PDF.

### 1. Instalasi Dependensi

```bash
git clone https://github.com/ardianryan/rapkumer.git
cd rapkumer
pnpm install
```

### 2. Konfigurasi Lingkungan (.env)

Salin berkas konfigurasi sampel atau buat berkas `.env` pada direktori root:

```env
# Default database (SQLite lokal)
DB_URL="file:./data/database.sqlite3"

# Opsional: Jika menggunakan PostgreSQL terpusat
# DB_URL="postgresql://user:password@localhost:5432/school_db"

# Batas ukuran payload
BODY_SIZE_LIMIT="512K"

# Jalur executable Chrome/Chromium untuk cetak PDF (sesuaikan jika di Linux/server)
# PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"
```

### 3. Inisialisasi Database

Jalankan migrasi schema awal:

```bash
pnpm db:push
```

### 4. Menjalankan Mode Pengembangan

```bash
pnpm dev -- --port 5173
```

Aplikasi dapat diakses melalui peramban di: `http://localhost:5173`

> **Kredensial Default Administrator**: `Admin` / `Admin123` _(sangat disarankan segera diganti setelah instalasi)_.

### 5. Kompilasi & Menjalankan Mode Produksi

```bash
pnpm build
pnpm start
```

---

## 📂 Panduan Dokumentasi Teknis (`docs/`)

Dokumentasi arsitektur, panduan konfigurasi, dan alur kontribusi tersimpan rapi dalam direktori [`docs/`](docs/):

| Dokumen                                                                                   | Topik Pembahasan                                                          |
| :---------------------------------------------------------------------------------------- | :------------------------------------------------------------------------ |
| [**DEVELOPMENT.md**](docs/DEVELOPMENT.md)                                                 | Panduan standar koding, struktur proyek, dan alur kerja pengembangan      |
| [**POSTGRES.md**](docs/POSTGRES.md)                                                       | Panduan konfigurasi dan migrasi ke database terpusat PostgreSQL           |
| [**FRONTEND_GUIDE.md**](docs/FRONTEND_GUIDE.md)                                           | Pedoman desain antarmuka, sistem token warna, dan standar DaisyUI         |
| [**DAPODIK.md**](docs/DAPODIK.md)                                                         | Mekanisme sinkronisasi API dan penarikan data Dapodik Desktop             |
| [**ERAPOR.md**](docs/ERAPOR.md)                                                           | Struktur data integrasi dan spesifikasi berkas impor/ekspor E-Rapor       |
| [**PENGATURAN_IZIN_PENGGUNA.md**](docs/PENGATURAN_IZIN_PENGGUNA.md)                       | Matriks hak akses pengguna (Admin, Wali Kelas, Guru Mapel, Wali Asuh)     |
| [**INSTALLER_WORKFLOW.md**](docs/INSTALLER_WORKFLOW.md)                                   | Alur kompilasi paket instalasi mandiri Windows (InnoSetup)                |
| [**CODE_SIGNING.md**](docs/CODE_SIGNING.md)                                               | Konfigurasi tanda tangan digital dan sertifikat biner Windows             |
| [**REVERSE_PROXY.md**](docs/REVERSE_PROXY.md)                                             | Rekomendasi konfigurasi Nginx/Caddy untuk deployment jaringan sekolah     |
| [**R2_STORAGE.md**](docs/R2_STORAGE.md)                                                   | Panduan penyimpanan berkas eksternal berbasis Cloudflare S3/R2            |
| [**AUDIT.md**](docs/AUDIT.md) & [**SKILLS.md**](docs/SKILLS.md)                           | Panduan audit keamanan berkala dan pengujian penetrasi mandiri (Strix AI) |
| [**BOOTLENECK.md**](docs/BOOTLENECK.md) & [**BOOTLENECK_FIX.md**](docs/BOOTLENECK_FIX.md) | Analisis profiling performa dan solusi mitigasi beban komputasi tinggi    |
| [**UPDATE_PLAN_FOR_RAPKUMER.md**](docs/UPDATE_PLAN_FOR_RAPKUMER.md)                       | Catatan peta jalan (_roadmap_) pengembangan modul lanjutan                |

---

## 📋 Daftar Perintah CLI (Cheatsheet)

```bash
pnpm dev -- --port 5173      # Menjalankan Vite dev server + generator ikon otomatis
pnpm build                   # Mengompilasi aplikasi untuk adapter node (build/index.js)
pnpm preview                 # Menjalankan preview hasil kompilasi aplikasi
pnpm start                   # Menjalankan aplikasi produksi dengan launcher terpadu
pnpm db:push                 # Menerapkan perubahan skema basis data
pnpm db:studio               # Membuka antarmuka Drizzle Studio GUI
pnpm db:cleanup              # Membersihkan data orphan pada relasi database
pnpm db:purge                # Menghapus berkas database lokal (reset total)
pnpm check                   # Validasi tipe statis (SvelteKit sync + svelte-check)
pnpm lint                    # Memeriksa format kode (Prettier & ESLint)
pnpm format                  # Memformat seluruh berkas kode sesuai standar repositori
pnpm package:win             # Menyiapkan artefak installer sistem operasi Windows
```

---

## 🔒 Keamanan & Kebijakan Data

- **Enkripsi Sesi**: Otentikasi sesi menggunakan token aman berbasis _HTTP-Only_ cookies dan perlindungan CSRF kustom.
- **Penyimpanan Tanda Tangan**: Paraf dan tanda tangan disimpan secara terpisah dalam berkas gambar transparan terisolasi (bukan raw base64 dalam tabel) dengan perlindungan akses valid.
- **Isolasi Data**: Seluruh kueri basis data diisolasi per entitas sekolah (`sekolahId`) untuk memastikan integritas data multi-tenant tetap terjaga.

---

## 🤝 Atribusi Hulu (Upstream), Komunitas & Donasi

Sebagai bentuk integritas etika open-source dan apresiasi mendalam, platform ini berakar dan dikembangkan lebih lanjut dari proyek utama **[Rapkumer](https://github.com/apoxicam/rapkumer)** yang diprakarsai oleh tim pengembang aslinya. Repositori ini memperluas kapabilitas inti tersebut dengan dukungan server skala institusi, integrasi multi-database, dan fitur spesifik sekolah.

### Skills untuk AI Coding Agent (opencode)

Skills (instruksi untuk agent coding) disimpan di folder `.agents/skills/` dan dibaca otomatis oleh opencode. Terdapat dua kelompok:

- **Strix (security testing):** 9 skill untuk menjalankan AI pentest, memperbaiki temuan keamanan, dan menyiapkan CI scanning. Cara install/pembaruan:

  ```sh
  npx skills add usestrix/strix
  ```

  Panduan instalasi Strix CLI, konfigurasi LLM, dan perintah scan tersedia di `docs/SKILLS.md`.

- **Bahasa Indonesia:** skill `bahasa-inti` (aturan inti penulisan bahasa Indonesia) dan `bahasa-website` (penulisan UX/microcopy) — sudah termasuk di repository.

Restart ulang session opencode setelah menambah atau memperbarui skills agar dikenali.

### 🌐 Tautan Hulu (Upstream) & Diskusi Komunitas

- **Repositori Resmi Hulu**: [github.com/apoxicam/rapkumer](https://github.com/apoxicam/rapkumer)
- **Grup Telegram Komunitas Pendidik**: [t.me/rapkumer](https://t.me/rapkumer) — ruang komunikasi, tanya jawab, dan diskusi pemanfaatan teknologi pendidikan antar-guru se-Indonesia.

### ☕ Apresiasi & Donasi untuk Pengembang Hulu

Apabila sistem ini bermanfaat bagi operasional sekolah Anda dan Anda ingin mendukung keberlanjutan dedikasi tim pengembang hulu aslinya, Anda dipersilakan menyalurkan apresiasi langsung melalui tautan donasi resmi:

<br />

<div align="left">
	<a href="https://pay.apoxi.cam" target="_blank" rel="noreferrer">
		<img alt="Dukungan Pengembang Hulu via QRIS" src="https://img.shields.io/badge/Apresiasi_Pengembang_Hulu-QRIS_Apoxicam-E11D48?style=for-the-badge&logo=heart&logoColor=white" />
	</a>
	&nbsp;
	<a href="https://t.me/rapkumer" target="_blank" rel="noreferrer">
		<img alt="Komunitas Telegram Rapkumer" src="https://img.shields.io/badge/Komunitas-Telegram_Rapkumer-0088CC?style=for-the-badge&logo=telegram&logoColor=white" />
	</a>
</div>

---

## 📄 Ketentuan Lisensi

Perangkat lunak ini didistribusikan di bawah lisensi khusus non-komersial (_Custom Non-Commercial License_). Anda bebas menggunakan, memodifikasi, dan membagikan aplikasi ini untuk keperluan internal institusi pendidikan secara mandiri. Tidak diperkenankan memonetisasi atau memperjualbelikan perangkat lunak ini maupun turunannya dalam bentuk apa pun. Ketentuan selengkapnya tercantum pada berkas [LICENSE](LICENSE) dan [docs/ICON-CREDITS.md](docs/ICON-CREDITS.md).

---

<div align="center">
	<sub>Didedikasikan untuk memajukan transformasi digital administrasi pendidikan Indonesia.</sub>
</div>
