# Nyucik Backend

REST API backend untuk **Nyucik** — aplikasi self-service laundry (booking mesin cuci/pengering, beli produk laundry, saldo & top up DANA QRIS).

## Teknologi

- Node.js + Express.js + TypeScript
- MySQL (Aiven) — SSL required
- JWT (1 token, expired 1d), Bcrypt, OTP email via Nodemailer
- Cloudinary (foto booking sebelum/sampai, mesin, produk, pengumuman, profil)
- DANA QRIS Acquirer MPM (webhook + idempotency)
- Zod (validasi), Helmet, CORS, Rate Limiting, Swagger (dokumentasi & testing)

## Struktur Branch

- `master` → versi full/stabil
- `developer` → mode develop sebelum di-pull ke master
- `feature/*` → branching per komponen (models, middlewares, utils, controllers, dll)

## Setup

```bash
npm install
cp .env.example .env   # isi kredensial (DB Aiven, Cloudinary, Email, DANA)
npm run migrate        # buat semua tabel
npm run seed           # isi data awal + akun testing
npm run dev
```

## Akun Testing

| Role  | Email             | Password  |
|-------|-------------------|-----------|
| ADMIN | admin@nyucik.com  | admin123  |
| USER  | user@nyucik.com   | user123   |

## Dokumentasi API

Swagger UI: `http://localhost:3000/api/docs` — prefix semua endpoint: `/api/v1`
