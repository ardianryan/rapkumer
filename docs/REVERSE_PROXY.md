# Panduan Reverse Proxy & Docker untuk Rapkumer

Dokumen ini memuat panduan lengkap menjalankan Rapkumer di belakang **Reverse Proxy** (Nginx, Caddy, Cloudflare Tunnel, Traefik) dan menggunakan **Docker Container**.

---

## 1. Menjalankan dengan Docker

### Membangun dan Menjalankan Container

```bash
# Salin konfigurasi environment jika belum ada
cp .env.example .env

# Sesuaikan nilai pada .env (DB_URL, ZITADEL, ORIGIN)
nano .env

# Jalankan dengan Docker Compose
docker compose up -d --build
```

Container akan otomatis:

1. Membangun aplikasi menggunakan multi-stage build Node 22.
2. Memasang Chromium untuk rendering cetak rapor PagedJS/Puppeteer.
3. Menjalankan proses di port `3000` dengan user non-root `rapkumer` dan supervisor `dumb-init`.
4. Menyimpan data persisten (uploads, database, sounds, ttd) di folder `./data`.

---

## 2. Variabel Lingkungan Kunci untuk Reverse Proxy

| Variabel                        | Deskripsi                                      | Contoh Nilai                    |
| :------------------------------ | :--------------------------------------------- | :------------------------------ |
| `ORIGIN`                        | Domain publik lengkap protokol HTTPS Anda      | `https://rapor.smansage.sch.id` |
| `RAPKUMER_CSRF_TRUSTED_ORIGINS` | Daftar domain yang diizinkan untuk CSRF        | `https://rapor.smansage.sch.id` |
| `HOST_HEADER`                   | Header host dari proxy                         | `x-forwarded-host`              |
| `PROTOCOL_HEADER`               | Header protokol dari proxy                     | `x-forwarded-proto`             |
| `ADDRESS_HEADER`                | Header IP klien asli                           | `x-forwarded-for`               |
| `XFF_DEPTH`                     | Kedalaman proxy di depan aplikasi              | `1`                             |
| `BODY_SIZE_LIMIT`               | Batas payload upload (rapor, bulk foto, excel) | `50M`                           |

---

## 3. Konfigurasi Nginx Reverse Proxy

Simpan konfigurasi ini pada `/etc/nginx/sites-available/rapkumer` (atau direktori vhost Nginx Anda):

```nginx
server {
    listen 80;
    server_name rapor.smansage.sch.id;

    # Redirect seluruh HTTP ke HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name rapor.smansage.sch.id;

    # SSL Certificate (Certbot / Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/rapor.smansage.sch.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rapor.smansage.sch.id/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Ukuran upload untuk data murid & import Excel
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Header penting untuk Reverse Proxy & SvelteKit CSRF
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # Dukungan WebSocket & HMR
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeout untuk cetak PDF massal
        proxy_connect_timeout 90s;
        proxy_send_timeout 90s;
        proxy_read_timeout 90s;
    }
}
```

---

## 4. Konfigurasi Caddy Server

Jika menggunakan Caddy, cukup tambahkan 3 baris ini ke `Caddyfile`:

```caddy
rapor.smansage.sch.id {
    request_body {
        max_size 50MB
    }
    reverse_proxy 127.0.0.1:3000
}
```

_(Caddy secara otomatis mengelola sertifikat SSL dan meneruskan seluruh header `X-Forwarded-*` secara standar)._

---

## 5. Konfigurasi Cloudflare Tunnel

Jika menggunakan `cloudflared`:

1. Buat Public Hostname mengarah ke Service: `http://localhost:3000`.
2. Di `.env` Rapkumer, set:
   ```env
   ORIGIN=https://rapor.smansage.sch.id
   RAPKUMER_CSRF_TRUSTED_ORIGINS=https://rapor.smansage.sch.id
   ```
3. Rapkumer akan langsung mendeteksi header `cf-connecting-ip`, `x-forwarded-proto`, dan origin secara otomatis.
