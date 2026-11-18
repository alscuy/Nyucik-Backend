# Nyucik Backend

REST API **Nyucik** — aplikasi self-service laundry: pesan mesin cuci/pengering,
beli produk, saldo, dan top up QRIS.

## Teknologi

- Node.js + Express.js + TypeScript
- MySQL (Aiven) — SSL required
- JWT (1 token, expired 1d), Bcrypt, OTP email via Nodemailer
- Cloudinary (foto laundry, mesin, produk, pengumuman, profil)
- QRIS statis dinamis + simulasi pembayaran (tanpa payment gateway)
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
| Top up | `POST /wallet/topup`, `GET /wallet/topups`, `POST /wallet/topups/:id/simulate` |
| Mesin | `GET/POST/PATCH/DELETE /machines/washing-machines`, `GET/POST/PATCH/DELETE /machines/drying-machines` |
| Laundry | `POST /bookings`, `GET /bookings/my`, `GET /bookings/:id`, `POST /bookings/:id/pay`, `POST /bookings/:id/start`, `POST /bookings/:id/cancel` |
| Produk | `GET /products`, `POST /products/orders`, `GET /products/orders/my`, `POST /products/orders/:id/complete` |
| Pengumuman | `GET /announcements`, `GET /announcements/admin/all`, `POST/PATCH/DELETE /announcements` |
| Petugas | `GET /employees`, `POST/PATCH/DELETE /employees` |
| Admin | `GET /admin/dashboard`, `GET /admin/users`, `GET /admin/users/:id`, `GET /admin/transactions` |

## Deploy

- API: Vercel (`api/index.ts` + `vercel.json`), `npx vercel --prod --yes`
- Database: Aiven MySQL, isi kredensial di environment Vercel
