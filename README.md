  # Nyucik Backend

REST API **Nyucik** — aplikasi self-service laundry: pesan mesin cuci/pengering,
beli produk, saldo, dan top up QRIS.

## Teknologi

- Node.js + Express.js + TypeScript
- MySQL (Aiven) — SSL required
- JWT (1 token, expired 1d), Bcrypt, OTP email via Nodemailer
- Cloudinary (foto laundry, mesin, produk, pengumuman, profil)
- QRIS gateway KiPay (`api.kipay.biz.id`) — QR dinamis, cek status, simulasi sandbox
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
| Top up | `POST /wallet/topup`, `GET /wallet/topups`, `POST /wallet/topups/:id/check`, `POST /wallet/topups/:id/simulate` |
| Mesin | `GET/POST/PATCH/DELETE /machines/washing-machines`, `GET/POST/PATCH/DELETE /machines/drying-machines` |
| Laundry | `POST /bookings`, `GET /bookings/my`, `GET /bookings/:id`, `POST /bookings/:id/pay`, `POST /bookings/:id/start`, `POST /bookings/:id/cancel` |
| Produk | `GET /products`, `POST /products/orders`, `GET /products/orders/my`, `POST /products/orders/:id/complete` |
| Pengumuman | `GET /announcements`, `GET /announcements/admin/all`, `POST/PATCH/DELETE /announcements` |
| Petugas | `GET /employees`, `POST/PATCH/DELETE /employees` |
| Omzet | `GET /admin/revenue?start_date=&end_date=` (rekap pemasukan per tanggal + untung/rugi) |
| Pengeluaran | `GET/POST /admin/expenses`, `PATCH/DELETE /admin/expenses/:id` (bisa difilter tanggal) |
| Admin | `GET /admin/dashboard`, `GET /admin/users`, `GET /admin/users/:id` |

## Top Up QRIS (KiPay)

Top up memakai gateway **KiPay**:

- `POST /wallet/topup` membuat transaksi QRIS sebesar nominal + kode unik, lalu
  mengembalikan `qr_string` (payload QRIS untuk dirender di aplikasi),
  `payment_url`, `expires_at`, `unique_code`, dan `amount`. `qr_url` KiPay
  tidak dikirim ke client karena mengandung API key.
- QR berlaku sesuai `expires_at` dari KiPay (biasanya 2 jam di sandbox dan
  15 menit di production).
- `POST /wallet/topups/:id/check` membaca status transaksi langsung ke KiPay.
  Saldo masuk sebesar `amount` (nominal + kode unik) setelah status `paid`.
- `POST /wallet/topups/:id/simulate` menandai transaksi sandbox sebagai lunas
  lewat endpoint simulasi KiPay, lalu saldo langsung ditambahkan. Cocok untuk
  testing tanpa pembayaran nyata.
- Checkout laundry dan produk memakai **saldo**, bukan QRIS langsung.
- Mode transaksi mengikuti project/API key KiPay. Untuk pembayaran nyata,
  gunakan API key project **production** (prefix transaksi `QRIS`), bukan
  API key sandbox (prefix `SBX`).

Isi `.env`:

```env
KIPAY_BASE_URL=https://api.kipay.biz.id
KIPAY_API_KEY=...
KIPAY_PAYMENT_URL=https://api.kipay.biz.id/pay/...
```

## Deploy

- API: Vercel (`api/index.ts` + `vercel.json`), `npx vercel --prod --yes`
- Database: Aiven MySQL, isi kredensial di environment Vercel
