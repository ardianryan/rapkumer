# Panduan Konfigurasi Cloudflare R2 / S3 Storage (Rapkumer)

Rapkumer mendukung penyimpanan objek berbasis **Cloudflare R2** (atau S3-compatible storage lainnya seperti AWS S3, MinIO, Wasabi) untuk menangani semua file upload:

- Foto murid (upload mandiri, bulk zip upload, cetak biodata PDF).
- Dinas luar & SPPD (surat undangan PDF, bukti foto kegiatan, dokumen bukti SPPD PDF, cetak PDF bukti).
- Tanda tangan / Paraf guru & buku tamu (transparent PNG).
- File materi/lampiran umum lainnya.
  _(Catatan: Logo sekolah tetap disimpan langsung di database sebagai BLOB sesuai arsitektur Rapkumer)._

---

## 1. Variabel Lingkungan (`.env`)

Tambahkan variabel berikut ke file `.env`:

```env
# ==============================================================================
# Cloudflare R2 / S3 Object Storage
# ==============================================================================
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_BUCKET_NAME=your-bucket-name
R2_FOLDER_PATH=uploads
R2_PUBLIC_URL=https://r2.yourdomain.com
R2_REGION=auto
R2_USE_PATH_STYLE_ENDPOINT=true
```

### Penjelasan Variabel:

- `R2_ACCESS_KEY_ID`: Access Key ID dari Cloudflare R2 API Token.
- `R2_SECRET_ACCESS_KEY`: Secret Access Key dari Cloudflare R2 API Token.
- `R2_ENDPOINT`: S3 API Endpoint dari bucket R2 Anda (`https://<account-id>.r2.cloudflarestorage.com`).
- `R2_BUCKET_NAME`: Nama bucket Cloudflare R2 Anda.
- `R2_FOLDER_PATH`: Subfolder / prefix opsional di dalam bucket (misalnya `uploads`). Jika diisi, semua file akan otomatis diletakkan di dalam folder ini.
- `R2_PUBLIC_URL`: Domain publik / Custom Domain R2 untuk mengakses file secara langsung melalui CDN (`https://r2.yourdomain.com`).
- `R2_REGION`: Region S3 (default `auto` untuk Cloudflare R2).
- `R2_USE_PATH_STYLE_ENDPOINT`: `true` untuk path-style access.

---

## 2. Pengaturan CORS pada Cloudflare R2 Bucket (Wajib untuk Presigned URL)

Agar browser pengguna dapat mengunggah file langsung ke Cloudflare R2 menggunakan **Presigned URL** tanpa terhalang kebijakan browser:

1. Buka dashboard Cloudflare: **R2** > Pilih bucket Anda.
2. Masuk ke tab **Settings** > scroll ke bagian **CORS Policy**.
3. Klik **Add CORS Policy** dan masukkan konfigurasi JSON berikut:

```json
[
	{
		"AllowedOrigins": [
			"https://rapor.sekolah.sch.id",
			"http://localhost:3000",
			"http://localhost:5173"
		],
		"AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
		"AllowedHeaders": ["*"],
		"ExposeHeaders": ["ETag"],
		"MaxAgeSeconds": 3600
	}
]
```

_(Ganti `https://rapor.smansage.sch.id` dengan domain Rapkumer Anda)._

---

## 3. Cara Kerja Upload (Dual Mode: Presigned & Server-side)

1. **Presigned Upload Direct (Cepat & Ringan Server)**
   - Klien meminta presigned upload URL ke server melalui endpoint `POST /api/upload/presign`.
   - Server mengembalikan `{ presignedUrl, publicUrl, key }`.
   - Browser mengunggah payload langsung ke Cloudflare R2 melalui HTTP `PUT`. Bandwidth server Rapkumer / Reverse Proxy tidak terbebani sama sekali!

2. **Server-side Upload (Fallback Otomatis)**
   - Jika file diunggah melalui formulir standar atau bulk upload (misalnya upload ZIP foto massal pada `/api/murid-bulk-photo`), server akan menerima buffer dan mengirimkannya langsung ke R2 menggunakan `@aws-sdk/client-s3`.
   - Database hanya menyimpan URL publik CDN R2 (`https://static-r2-apac.ppti.me/...`).

3. **Fallback Lokal (Jika R2 Kosong / Nonaktif)**
   - Jika variabel `R2_*` tidak disetel di `.env`, Rapkumer secara otomatis beralih ke penyimpanan disk lokal (`./data/uploads`, `./data/dinas-luar`, `./data/ttd`).
