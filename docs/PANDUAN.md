# 📚 PANDUAN NYUCIK BACKEND

Panduan lengkap: setup database Aiven, setting base URL, dan testing API pakai Postman.

---

## 1. CARA MASUKKIN SQL KE DATABASE AIVEN

Gak perlu copy-paste SQL manual. Script migrate & seed yang ngerjain semuanya.

### Langkah

**1) Ambil kredensial Aiven**
Login ke [console.aiven.io](https://console.aiven.io) → pilih service MySQL kamu → catat:
- `Host` (contoh: `mysql-3962f0e9-catatankuy.c.aivencloud.com`)
- `Port` (contoh: `24882`)
- `User` (`avnadmin`)
- `Password` (klik "show")

**2) Isi file `.env`**

```env
DB_HOST=mysql-xxxxx-xxxxx.c.aivencloud.com
DB_PORT=24882
DB_USER=avnadmin
DB_PASSWORD=password_aiven_kamu
DB_NAME=nyucik_db
DB_SSL=true
```

> ⚠️ `DB_SSL` **wajib true**, Aiven menolak koneksi tanpa SSL.
> ⚠️ Jangan commit `.env` ke GitHub (sudah ada di .gitignore).

**3) Jalankan migrate (buat database + semua tabel)**

```bash
npm run migrate
```

Hasil yang benar:
```
✅ Migrasi selesai: database nyucik_db & semua tabel berhasil dibuat
```

Yang terjadi di balik layar: script menjalankan `db/schema.sql` yang isinya
`CREATE DATABASE IF NOT EXISTS nyucik_db` → `USE nyucik_db` → 9 tabel dibuat:

| Tabel | Isi |
|---|---|
| `users` | akun, role, saldo, hash OTP |
| `washing_machines` | mesin cuci A1–A10 |
| `drying_machines` | mesin pengering B1–B10 |
| `products` | produk laundry |
| `bookings` | booking mesin + foto |
| `product_orders` | riwayat pembelian |
| `announcements` | pengumuman |
| `employees` | pegawai (ready/tidak) |
| `wallet_transactions` | catatan semua perubahan saldo |
| `top_ups` | transaksi top up DANA QRIS |

**4) Jalankan seed (isi data awal + akun testing)**

```bash
npm run seed
```

Hasil yang benar:
```
✅ Seed selesai! Akun testing:
   ADMIN -> admin@nyucik.com / admin123
   USER  -> user@nyucik.com  / user123
```

**5) Cek di Aiven Console**

Buka service MySQL → tab **Query** → jalankan:
```sql
USE nyucik_db;
SHOW TABLES;
SELECT full_name, email, role, balance FROM users;
```
Kalau 9 tabel muncul + 2 user muncul → database siap. 🎉

### Troubleshooting

| Error | Penyebab & Solusi |
|---|---|
| `ETIMEDOUT` / `ENOTFOUND` | Host/port salah, atau IP kena firewall Aiven. Cek kembali Service URI |
| `Access denied` | Password salah (paste ulang, biasanya ada spasi nyasar) |
| `ER_NOT_SUPPORTED_AUTH_MODE` | Tambahkan `DB_SSL=true` di .env |
| `Unknown database` | Jalankan ulang `npm run migrate` (schema bikin DB-nya sendiri) |

---

## 2. BASE URL DIMASUKKANNYA DI MANA

Base URL = alamat server backend. Ada 3 tempat:

### a) Lokal (development)
```
http://localhost:3000/api/v1
```

### b) File `.env` backend (dipakai untuk response/link)
Sudah ada di `.env`:
```env
PORT=3000
FRONTEND_URL=http://localhost:5173
```
Nanti kalau deploy, `FRONTEND_URL` diisi domain aplikasi Flutter/web kamu.

### c) Aplikasi Flutter (frontend)
Simpan base URL di satu tempat, contoh `lib/config/api_config.dart`:
```dart
class ApiConfig {
  // ganti saat backend udah deploy (nanti base url dari Vercel dikirim di sini)
  static const String baseUrl = "http://localhost:3000/api/v1";
}
```

### d) Postman — pakai Environment Variables (rekomendasi)
1. Klik ikon ⚙️ **Environments** → **Create Environment** → nama: `Nyucik`
2. Tambahkan variable:

| Variable | Initial Value |
|---|---|
| `base_url` | `http://localhost:3000/api/v1` |
| `token` | *(diisi otomatis dari login)* |

3. Setiap request tulis URL-nya: `{{base_url}}/auth/login`
4. Setelah login, set token: di script tab **Tests** request Login, tambahkan:
```js
const res = pm.response.json();
pm.environment.set("token", res.data.token);
```
5. Untuk endpoint yang butuh login: tab **Authorization** → Type: **Bearer Token** → isi `{{token}}`

Nanti base URL Vercel tinggal ganti nilai `base_url` di environment, semua request ikut berubah.

---

## 3. TESTING DENGAN POSTMAN (ALUR LENGKAP)

Semua request pakai header `Content-Type: application/json`, **kecuali** yang ada upload foto → `form-data`.

### 📋 Daftar Endpoint

| Method | Endpoint | Auth | Keterangan |
|---|---|---|---|
| POST | `/auth/register` | ❌ | daftar + OTP ke email |
| POST | `/auth/verify-otp` | ❌ | verifikasi OTP |
| POST | `/auth/resend-otp` | ❌ | kirim ulang OTP |
| POST | `/auth/login` | ❌ | dapat token |
| POST | `/auth/logout` | ✅ | keluar |
| GET | `/users/me` | ✅ | profil saya |
| PATCH | `/users/me` | ✅ | edit profil (bisa + foto) |
| PATCH | `/users/me/password` | ✅ | ganti password |
| GET | `/users/me/transactions` | ✅ | riwayat booking + pembelian |
| GET | `/wallet/balance` | ✅ | cek saldo |
| POST | `/wallet/topup` | ✅ | buat QRIS top up |
| GET | `/wallet/topups` | ✅ | riwayat top up |
| GET | `/machines/washing-machines` | ✅ | daftar mesin cuci |
| GET | `/machines/drying-machines` | ✅ | daftar mesin pengering |
| POST | `/bookings` | ✅ | **buat booking + foto cucian** |
| POST | `/bookings/:id/pay` | ✅ | bayar booking pakai saldo |
| POST | `/bookings/:id/arrival-photo` | ✅ | **foto bukti sudah sampai** |
| POST | `/bookings/:id/cancel` | ✅ | batal (refund kalau sudah bayar) |
| GET | `/bookings/my` | ✅ | booking saya |
| GET | `/products` | ✅ | katalog produk |
| POST | `/products/orders` | ✅ | beli produk pakai saldo |
| GET | `/products/orders/my` | ✅ | riwayat pembelian |
| GET | `/announcements` | ✅ | pengumuman aktif |
| GET | `/employees` | ✅ | daftar pegawai |
| POST | `/payments/webhook` | ❌ | webhook DANA (dipanggil DANA, bukan user) |
| GET | `/admin/dashboard` | ✅ ADMIN | ringkasan + pendapatan |
| GET | `/admin/users` | ✅ ADMIN | semua user |
| GET | `/admin/transactions` | ✅ ADMIN | semua transaksi saldo |
| GET | `/admin/payments` | ✅ ADMIN | riwayat pembayaran top up |
| GET | `/admin/revenue` | ✅ ADMIN | laporan pendapatan per bulan |
| POST/PATCH/DELETE | `/machines/...`, `/products/...`, `/announcements/...`, `/employees/...`, `/bookings/:id/status` | ✅ ADMIN | CRUD oleh admin |

---

### ✅ Urutan Test + Hasil yang Diharapkan

#### **TEST 1 — Register**
`POST {{base_url}}/auth/register`
```json
{
  "full_name": "Budi Santoso",
  "email": "budi@mail.com",
  "phone": "081234567890",
  "password": "rahasia123",
  "confirm_password": "rahasia123"
}
```
**Hasil (201):**
```json
{
  "success": true,
  "message": "Kode OTP (6 digit) telah dikirim ke email kamu. Berlaku 5 menit.",
  "data": { "email": "budi@mail.com", "otp_expired_in": "5 menit", "...": "..." }
}
```
→ Cek inbox email: ada kode OTP 6 digit dari "Nyucik Laundry".
> 🔧 Gak mau nunggu email? Set `SEND_OTP_IN_RESPONSE=true` di `.env` → OTP muncul di response sebagai `debug_otp`.

#### **TEST 2 — Verifikasi OTP**
`POST {{base_url}}/auth/verify-otp`
```json
{ "email": "budi@mail.com", "otp": "123456" }
```
**Hasil (200):**
```json
{ "success": true, "message": "Verifikasi berhasil! Akun kamu aktif, silakan login.", "data": { "email": "budi@mail.com" } }
```
❌ Kalau OTP salah → `400 Kode OTP salah`. ❌ Kalau lewat 5 menit → `410 OTP sudah kedaluwarsa`.

#### **TEST 3 — Login**
`POST {{base_url}}/auth/login`
```json
{ "email": "budi@mail.com", "password": "rahasia123" }
```
**Hasil (200):**
```json
{
  "success": true,
  "message": "Login berhasil",
  "data": {
    "token": "eyJhbGciOi...",
    "user": { "id": 3, "full_name": "Budi Santoso", "role": "USER", "balance": 0 }
  }
}
```
→ Copy `token` → simpan ke variable `{{token}}` di Postman.
❌ Login sebelum verifikasi → `403 Email belum diverifikasi`.

#### **TEST 4 — Cek Mesin**
`GET {{base_url}}/machines/washing-machines` (Bearer `{{token}}`)
**Hasil (200):** array mesin A1–A10:
```json
{ "success": true, "data": [
  { "id": 1, "code": "A1", "capacity_kg": 10, "price_per_kg": 1500, "status": "AVAILABLE", ... },
  { "id": 6, "code": "A6", "capacity_kg": 15, "price_per_kg": 1000, "status": "AVAILABLE", ... }
]}
```

#### **TEST 5 — Top Up Saldo (QRIS)**
`POST {{base_url}}/wallet/topup`
```json
{ "amount": 50000 }
```
**Hasil (201):**
```json
{
  "success": true,
  "data": {
    "reference": "TOPUP-A1B2C3...",
    "amount": 50000,
    "qris": "SANDBOX-QRIS|NYUCIK|TOPUP-...|50000",
    "sandbox": true,
    "status": "PENDING",
    "note": "Saldo akan bertambah otomatis setelah webhook pembayaran valid diterima."
  }
}
```
> Mode sandbox karena kredensial DANA belum diisi — struktur & alurnya sudah real.

#### **TEST 6 — Simulasi Webhook Pembayaran** *(mengisi saldo)*
`POST {{base_url}}/payments/webhook`
Headers tambahan: `X-Signature` = HMAC-SHA256 dari raw body pakai `DANA_WEBHOOK_SECRET`
```json
{ "reference": "TOPUP-A1B2C3...", "status": "PAID", "amount": 50000 }
```
**Hasil (200):**
```json
{ "success": true, "message": "Pembayaran valid, saldo pengguna bertambah" }
```
Lalu `GET /wallet/balance` → `balance: 50000` ✅
❌ Tanpa/tanda tangan salah → `401 Signature webhook tidak valid`
❌ Nominal beda → `400 Nominal pembayaran tidak sesuai transaksi`
❌ Webhook dikirim 2x → tetap `200` tapi saldo **tidak nambah 2x** (idempotent)

#### **TEST 7 — Buat Booking (dengan FOTO cucian)** ⭐
`POST {{base_url}}/bookings` → Body: **form-data**

| Key | Type | Value |
|---|---|---|
| `machine_type` | Text | `WASHING` |
| `machine_id` | Text | `1` |
| `booking_date` | Text | `2026-11-14` |
| `start_time` | Text | `10:00` |
| `weight_kg` | Text | `5` |
| `photo` | **File** | foto_cucian.jpg |

**Hasil (201):**
```json
{
  "success": true,
  "message": "Booking berhasil dibuat. Bayar pakai saldo: POST /api/v1/bookings/1/pay",
  "data": {
    "id": 1, "machine_type": "WASHING", "total_price": 7500,
    "status": "PENDING", "photo_before_url": "https://res.cloudinary.com/.../nyucik/bookings/before/....jpg"
  }
}
```
> Total = 5 kg × Rp1.500 (mesin 10kg) = **Rp7.500** — dihitung backend, gak dari frontend.
> Foto otomatis masuk folder Cloudinary `nyucik/bookings/before` ✅

❌ Hasil error yang diharapkan:
- `weight_kg = 12` di mesin 10kg → `400 Berat maksimal mesin A1 adalah 10 kg`
- `start_time = 16:00` → `400 Jam operasional hanya pukul 10.00 - 15.00`
- booking 30 menit lagi → `400 Booking harus dilakukan minimal 1 jam sebelum waktu penggunaan`
- slot bentrok → `409 Mesin A1 sudah dibooking di jam tersebut`
- tanpa foto → `400 Foto cucian yang mau dicuci wajib diupload (field: photo)`

#### **TEST 8 — Bayar Booking Pakai Saldo**
`POST {{base_url}}/bookings/1/pay`
**Hasil (200):**
```json
{
  "success": true,
  "message": "Booking berhasil dibayar & dikonfirmasi",
  "data": { "booking_id": 1, "status": "CONFIRMED", "paid": 7500, "balance_before": 50000, "balance_after": 42500 }
}
```
❌ Saldo kurang → `400 Saldo tidak cukup... Top up dulu.` ❌ Bayar 2x → `409 Booking sudah berstatus CONFIRMED`

#### **TEST 9 — Foto Bukti Sudah Sampai** ⭐
`POST {{base_url}}/bookings/1/arrival-photo` → Body: **form-data** → Key `photo` (File) = foto_cuci.jpg
**Hasil (200):**
```json
{
  "success": true,
  "message": "Foto bukti tiba berhasil diupload, cucian dimulai",
  "data": { "booking_id": 1, "photo_arrived_url": "https://res.cloudinary.com/.../nyucik/bookings/arrived/....jpg", "status": "IN_PROGRESS" }
}
```
→ Foto masuk folder **`nyucik/bookings/arrived`** (beda folder dengan foto sebelum cuci) ✅
→ Cek `GET /machines/washing-machines` → mesin A1 jadi `IN_USE`

#### **TEST 10 — Beli Produk**
`POST {{base_url}}/products/orders`
```json
{ "product_id": 1, "quantity": 2 }
```
**Hasil (201):**
```json
{ "success": true, "message": "Pembelian berhasil, stok berkurang otomatis",
  "data": { "order_id": 1, "product": "Deterjen Bubuk 500gr", "quantity": 2, "total_price": 24000, "balance_after": 18500 } }
```
❌ Stok kurang → `400 Stok tidak cukup. Sisa stok: X` (stok gak akan minus)

#### **TEST 11 — Endpoint Admin** *(login pakai admin@nyucik.com/admin123)*
`GET {{base_url}}/admin/dashboard`
**Hasil (200):**
```json
{
  "success": true,
  "data": {
    "total_users": 3,
    "washing_machines_available": 9,
    "drying_machines_available": 10,
    "bookings_today": 1,
    "revenue": { "booking": 7500, "product": 24000, "total": 31500 }
  }
}
```
❌ Pakai token user biasa → `403 Endpoint ini khusus admin` ✅

---

### 🎯 Checklist Bukti Berhasil (buat demo penguji)

- [ ] Migrate & seed sukses, 9 tabel ada di Aiven
- [ ] Register → OTP masuk email → verify → login dapat token
- [ ] Password tersimpan hash (cek di Aiven: kolom `password` bukan teks asli)
- [ ] Foto cucian masuk Cloudinary folder `nyucik/bookings/before`
- [ ] Foto tiba masuk Cloudinary folder `nyucik/bookings/arrived`
- [ ] Foto mesin/produk/pengumuman/profil masuk foldernya masing-masing
- [ ] Harga dihitung backend (coba inject total_price → diabaikan)
- [ ] Saldo cuma nambah lewat webhook valid (coba webhook 2x → saldo gak double)
- [ ] Stok gak bisa minus, saldo gak bisa minus
- [ ] Endpoint admin ditolak `403` kalau pakai role USER
