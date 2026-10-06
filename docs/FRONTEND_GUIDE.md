# Panduan & Aturan Standar Perombakan Frontend Rapkumer

Dokumen ini berisi panduan teknis, aturan arsitektur, dan SOP bagi pengembang yang ingin merombak tampilan antarmuka (UI/UX) Rapkumer di SMA Negeri 1 Gedeg agar tetap aman, performan, serta tidak merusak fungsionalitas backend maupun database.

---

## 1. Spesifikasi Tech Stack Frontend

| Teknologi         | Versi / Standar            | Aturan Khusus                                                                                                                                   |
| :---------------- | :------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**     | SvelteKit 2 + **Svelte 5** | **Wajib Svelte 5 Runes** (`$state`, `$derived`, `$props`, `$effect`). Dilarang menggunakan sintaks Svelte 3/4 (`export let`, `$:`, `on:click`). |
| **Styling**       | **TailwindCSS 4**          | Tanpa `tailwind.config.js`. Dikonfigurasi langsung di `src/app.css` via `@import "tailwindcss";`.                                               |
| **UI Components** | **DaisyUI 5**              | Diimpor via plugin di CSS: `@plugin "daisyui";`.                                                                                                |
| **Ikon**          | SVG Generator Otomatis     | Letakkan berkas SVG di `src/lib/icons/`, gunakan komponen `<Icon name="..." />`.                                                                |
| **Formatting**    | Prettier                   | Tab (bukan spasi), tanda petik tunggal (`'`), lebar baris 100 karakter.                                                                         |

---

## 2. Aturan Emas Svelte 5 (Runes)

Rapkumer dibangun sepenuhnya menggunakan Svelte 5. Saat merombak atau membuat komponen baru:

### ✅ Yang Benar (Svelte 5 Runes):

```svelte
<script lang="ts">
	// 1. Props
	let {
		title,
		count = 0,
		onSave
	}: { title: string; count?: number; onSave: () => void } = $props();

	// 2. State reaktif
	let searchQuery = $state('');
	let isOpen = $state(false);

	// 3. Computed / Derived
	const isFilled = $derived(searchQuery.trim().length > 0);

	// 4. Efek samping
	$effect(() => {
		console.log('Query berubah:', searchQuery);
	});
</script>

<!-- 5. Event Listener standar Svelte 5 -->
<button type="button" onclick={() => (isOpen = true)}>Buka</button>
<input type="text" bind:value={searchQuery} />
```

### ❌ Dilarang (Sintaks Svelte 3/4 Lama):

```svelte
<script>
	export let title; // ❌ JANGAN gunakan 'export let'
	let count = 0;
	$: isFilled = count > 0; // ❌ JANGAN gunakan '$:' untuk reaktivitas
</script>

<!-- ❌ JANGAN gunakan directive 'on:' -->
<button on:click={handleClick}>Klik</button>
```

---

## 3. Kontrak Form & Komunikasi Backend

Backend SvelteKit memproses data melalui **Form Actions** di `+page.server.ts`.

### Aturan Field Input:

1. **Atribut `name` Tidak Boleh Sembarangan Diubah**:
   - Jika halaman awal memiliki `<input name="nama_lengkap" />`, backend membaca `data.get('nama_lengkap')`. Mengubah nama atribut ini akan menyebabkan data tidak tersimpan ke database.
2. **Form Enhancement**:
   - Utamakan menggunakan `use:enhance` bawaan SvelteKit atau komponen wrapper `form-enhance.svelte` dengan utilitas `flatten`/`unflatten`/`populateForm` dari `$lib/utils.ts`.
3. **Tombol Disabled dengan Tooltip**:
   - Sesuai konvensi proyek, jika tombol disabled memiliki tooltip info, tambahkan atribut `aria-disabled="true"` di samping `disabled`.

---

## 4. Hirarki Komponen & Direktori

Pemisahan tanggung jawab kode harus dijaga:

```
src/
├── app.css                         # Pusat kustomisasi tema Tailwind 4 & DaisyUI 5
├── lib/
│   ├── components/                 # SEMUA KOMPONEN PRESENTASI DI SINI
│   │   ├── common/                 # Komponen umum (Card, Modal, Button, Badge)
│   │   ├── layout/                 # Navbar, Sidebar, Header
│   │   └── domain-spesifik/        # Komponen per fitur (presensi, nilai, dll)
│   ├── icons/                      # Berkas SVG asli untuk ikon
│   └── utils.ts                    # Helper cookie, formatting, modalRoute
└── routes/
    ├── +layout.svelte              # Root shell layout UI
    └── (fitur)/
        ├── +page.svelte            # Hanya bertindak sebagai orkestrator / view
        └── +page.server.ts         # BACKEND: Jangan letakkan logika UI di sini!
```

> **Catatan Penting**:
> Jangan menuliskan ratusan baris markup UI langsung di dalam file `src/routes/**/+page.svelte`. Pecah menjadi komponen kecil di `src/lib/components/`.

---

## 5. Sistem Ikon

Jangan melakukan `import svg from '$lib/icons/icon.svg?raw'`.

1. Masukkan file `.svg` baru ke `src/lib/icons/nama-ikon.svg`.
2. Jalankan skrip generator:
   ```bash
   node scripts/icon.js
   ```
3. Gunakan di Svelte markup:
   ```svelte
   <script>
   	import Icon from '$lib/components/icon.svelte';
   </script>

   <Icon name="nama-ikon" class="h-5 w-5 text-primary" />
   ```

---

## 6. Hak Akses Tampilan (Role & Permission Guards)

Rapkumer memiliki 4 tipe akun: `admin`, `wali_kelas`, `wali_asuh`, dan `user` (guru mapel).

Ketika Anda mendesain ulang antarmuka, perhatikan logika visibilitas tombol aksi:

1. **Role `user` (Guru Mata Pelajaran)**:
   - Bersifat **read-only** (`disableInteraction`) pada modul umum:
     - `/murid`
     - `/kokurikuler` & `/asesmen-kokurikuler`
     - `/ekstrakurikuler` & `/nilai-ekstrakurikuler`
     - `/keasramaan` & `/asesmen-keasramaan`
     - `/catatan-wali-kelas`
     - `/keputusan`
     - `/cetak`
   - Tombol Tambah, Edit, dan Hapus pada modul di atas **wajib disembunyikan atau di-disable** untuk tipe `user`.
2. **Pengecualian Modul Absensi (`/absen`)**:
   - Guru mapel diizinkan melihat semua mode dan menggunakan fitur **"Isi Sekaligus"** (per-mapel), namun tombol edit/hapus presensi individual tetap dikunci via helper `canUserEditAbsen`.

---

## 7. Zona Sensitif (PERINGATAN KERAS)

> [!CAUTION]
> **Hati-hati pada Modul Cetak Rapor (`/cetak/` & `src/lib/server/pdf/templates/`)**
>
> Halaman cetak rapor, piagam, buku induk, dan keasramaan menggunakan engine **PagedJS** dan **Puppeteer headless**.
>
> - Menggunakan satuan cetak presisi fisik (`mm`, `cm`, `in`).
> - Layout CSS terikat dengan aturan `@page`, page break (`break-before: page`, `break-inside: avoid`), dan margin print.
> - **Jangan merombak CSS di modul ini** kecuali Anda memahami spesifikasi W3C CSS Paged Media Module, karena dapat menyebabkan halaman terpotong, margin bergeser, atau blank page pada PDF.

---

## 8. Strategi Merombak UI Tanpa Menimbulkan Konflik Git

Jika Anda ingin merombak tampilan secara radikal tetapi tetap ingin bisa melakukan `git pull` dari repositori pembuat asli (upstream):

### Tingkat 1: Rombak Visual via CSS / Tema (Risiko Konflik: 0%)

Ubah palet warna, tipografi, rounded border, dan gaya visual utama di `src/app.css` melalui konfigurasi tema DaisyUI:

```css
@import 'tailwindcss';
@plugin 'daisyui' {
	themes:
		light --default,
		dark --prefersdark;
}

@layer base {
	:root {
		--font-sans: 'Inter', sans-serif;
	}
}
```

_Mengubah file CSS tidak akan pernah menimpa file rute `+page.svelte` upstream._

### Tingkat 2: Membuat Sub-Komponen Custom (Risiko Konflik: Sangat Rendah)

Buat file komponen baru di dalam subfolder `src/lib/components/custom/` atau `src/lib/components/sman1gedeg/`.

### Tingkat 3: Rombak File `+page.svelte` Rute Bawaan (Risiko Konflik: Sedang)

Jika merombak langsung file rute:

- Tetap gunakan prop `let { data } = $props();` yang sama.
- Pastikan semua form tetap memiliki `method="POST"` dan atribut input `name="..."` yang utuh.
- Saat ada update dari upstream, Git hanya akan menandai konflik pada baris markup yang Anda ubah, yang mudah diselesaikan.

---

## 9. Checklist Verifikasi Sebelum Commit

Setelah melakukan perombakan frontend, jalankan perintah verifikasi:

```bash
# 1. Format kode sesuai standar repo
pnpm format

# 2. Cek linter ESLint
pnpm lint

# 3. Cek type-safety SvelteKit
pnpm check
```

Jika ketiga perintah di atas keluar dengan status bersih (hijau / tanpa error), maka kode frontend aman untuk digunakan.
