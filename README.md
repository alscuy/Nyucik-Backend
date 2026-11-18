# Nyucik Backend

REST API **Nyucik** — aplikasi self-service laundry: pesan mesin cuci/pengering,
beli produk, saldo, dan top up QRIS.

## Teknologi

- Node.js + Express.js + TypeScript
- MySQL (Aiven) — SSL required
- JWT (1 token, expired 1d), Bcrypt, OTP email via Nodemailer
- Cloudinary (foto laundry, mesin, produk, pengumuman, profil)
- QRIS DANA MPM (partner API) + simulator fallback (tanpa payment gateway)
- Zod (validasi), Helmet, CORS

## Setup

```bash
npm install
cp .env.example .env   # isi kredensial (DB Aiven, Cloudinary, Email, QRIS)
npm run migrate        # buat semua tabel
npm run seed           # isi data awal + akun testing
npm run dev
```

## Akun Testing

| Role  | Email             | Password  |
|-------|-------------------|-----------|
| ADMIN | admin@nyucik.com  | admin123  |
| USER  | user@nyucik.com   | user123   |

## Endpoint Utama

Base URL: `http://localhost:3000/api/v1`

| Modul | Endpoint |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/verify-otp`, `POST /auth/resend-otp`, `POST /auth/login`, `POST /auth/logout` |
| Profil | `GET/PATCH /users/me`, `PATCH /users/me/password`, `GET /users/me/transactions` |
| Saldo | `GET /wallet/balance`, `GET /wallet/transactions` |
| Top up | `POST /wallet/topup`, `GET /wallet/topups`, `POST /wallet/topups/:id/pay` |
| Mesin | `GET/POST/PATCH/DELETE /machines/washing-machines`, `GET/POST/PATCH/DELETE /machines/drying-machines` |
| Laundry | `POST /bookings`, `GET /bookings/my`, `GET /bookings/:id`, `POST /bookings/:id/pay`, `POST /bookings/:id/start`, `POST /bookings/:id/cancel` |
| Produk | `GET /products`, `POST /products/orders`, `GET /products/orders/my`, `POST /products/orders/:id/complete` |
| Pengumuman | `GET /announcements`, `GET /announcements/admin/all`, `POST/PATCH/DELETE /announcements` |
| Petugas | `GET /employees`, `POST/PATCH/DELETE /employees` |
| Admin | `GET /admin/dashboard`, `GET /admin/users`, `GET /admin/users/:id`, `GET /admin/transactions` |

## Top Up QRIS

Top up punya empat mode, dipakai berurutan sesuai konfigurasi:

1. **Saya Bayar (hosted invoice QRIS)** — aktif kalau `SAYABAYAR_API_KEY`
   terisi. Backend membuat invoice QRIS, aplikasi membuka `payment_url`, lalu
   halaman Saya Bayar menampilkan QRIS merchant sendiri. Setelah membayar,
   tombol **Sudah Bayar** memanggil `GET /invoices/:id` + `POST /confirm`.
   Webhook `invoice.paid` juga menambah saldo otomatis.
2. **DANA MPM (uang beneran, terverifikasi)** — aktif kalau `DANA_CLIENT_ID`,
   `DANA_PARTNER_ID`, `DANA_MERCHANT_ID`, dan `DANA_PRIVATE_KEY` terisi. Alur:
   - `POST /wallet/topup` memanggil `qr-mpm-generate` dan mengembalikan `qrContent`.
   - User scan QR di DANA/OVO/GoPay/bank, lalu tekan **Sudah Bayar**.
   - Backend memanggil `debit/status`; kalau status `00`, saldo langsung masuk.
   - DANA juga bisa mengirim notifikasi ke `POST /wallet/dana/notification`;
     backend tetap mengecek ulang status ke DANA sebelum menambah saldo.
3. **QRIS toko (uang beneran, tanpa API)** — aktif kalau `QRIS_STATIC_PAYLOAD`
   diisi payload QRIS statis milik sendiri (mis. QRIS DANA pribadi yang auto
   accept). Backend menyisipkan nominal ke payload sehingga pembeli membayar
   pas. Uang masuk ke rekening QRIS toko, lalu tombol **Sudah Bayar** menambah
   saldo. Tidak ada verifikasi otomatis, jadi mode ini cocok untuk demo/outlet
   kecil dengan nominal terbatas.
4. **Simulator** — dipakai kalau semua konfigurasi di atas kosong. Tombol
   **Simulasi Pembayaran** langsung menambah saldo (untuk demo).

Isi `.env`:

```env
SAYABAYAR_BASE_URL=https://api.sayabayar.com/v1
SAYABAYAR_API_KEY=sk_live_...
SAYABAYAR_WEBHOOK_SECRET=whsec_...

DANA_ENV=sandbox
DANA_CLIENT_ID=...
DANA_PARTNER_ID=...
DANA_CHANNEL_ID=95221
DANA_MERCHANT_ID=...
DANA_STORE_ID=
DANA_ORIGIN=https://nyucik-backend.vercel.app
DANA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Alternatif tanpa API: payload QRIS statis milik sendiri
QRIS_STATIC_PAYLOAD=00020101021126...
```

`DANA_ORIGIN` harus sama dengan origin yang didaftarkan saat onboarding partner.
Set `DANA_ENV=production` untuk uang nyata.

### Webhook Saya Bayar

Daftarkan URL ini di dashboard Saya Bayar:

```text
https://nyucik-backend.vercel.app/api/v1/wallet/sayabayar/notification
```

Backend memakai raw body + HMAC-SHA256 (`X-Webhook-Signature`) dengan
`SAYABAYAR_WEBHOOK_SECRET`. Event yang ditangani: `invoice.paid`,
`invoice.expired`, dan `invoice.cancelled`. Saldo hanya ditambah setelah status
invoice dicek ulang ke API.

Uji manual:

```bash
npx ts-node scripts/test-sayabayar.ts 10000
npx ts-node scripts/test-sayabayar.ts check <id>
npx ts-node scripts/test-sayabayar.ts confirm <id>
```

## Deploy

- API: Vercel (`api/index.ts` + `vercel.json`), `npx vercel --prod --yes`
- Database: Aiven MySQL, isi kredensial di environment Vercel
