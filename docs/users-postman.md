# 📱 POSTMAN TESTING — USER (Nyucik)

Semua request dijalankan sebagai **USER**. Simpan dulu environment di Postman:

| Variable | Value |
|---|---|
| `base_url` | `http://localhost:3000/api/v1` |
| `token` | (diisi setelah login) |

Response konsisten: `{ "success": true/false, "message": "...", "data": {...} }`

---

## 1. AUTH

### 1.1 Register
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
✅ **201**
```json
{
  "success": true,
  "message": "Kode OTP (6 digit) telah dikirim ke email kamu. Berlaku 5 menit.",
  "data": { "email": "budi@mail.com", "otp_expired_in": "5 menit" }
}
```
❌ `409 Email sudah terdaftar` · `400 Konfirmasi password tidak sama...` · `400 Nomor telepon harus format 08...`

### 1.2 Verify OTP
`POST {{base_url}}/auth/verify-otp`
```json
{ "email": "budi@mail.com", "otp": "483920" }
```
✅ **200** → `Verifikasi berhasil! Akun kamu aktif, silakan login.`
❌ `400 Kode OTP salah` · `410 OTP sudah kedaluwarsa` · `429 Terlalu banyak percobaan salah`

### 1.3 Resend OTP (jeda 5 menit antar kirim)
`POST {{base_url}}/auth/resend-otp`
```json
{ "email": "budi@mail.com" }
```
✅ **200** → `OTP baru telah dikirim ke email kamu.` (OTP lama otomatis mati)
❌ `429 Tunggu X menit lagi sebelum meminta OTP baru` · `400 Endpoint ini hanya untuk kirim ulang OTP...` (kalau field `otp` ikut dikirim)

### 1.4 Login
`POST {{base_url}}/auth/login`
```json
{ "email": "budi@mail.com", "password": "rahasia123" }
```
✅ **200**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { "id": 3, "full_name": "Budi Santoso", "role": "USER", "balance": 0 }
  }
}
```
→ Simpan `token` ke variable `{{token}}`.
❌ `403 Email belum diverifikasi` · `401 Email atau password salah`

### 1.5 Logout
`POST {{base_url}}/auth/logout` (Bearer)
✅ **200** → `Logout berhasil. Hapus token di sisi aplikasi.`

---

## 2. PROFIL (semua pakai Bearer {{token}})

### 2.1 Lihat profil
`GET {{base_url}}/users/me`
✅ **200** → `data`: id, full_name, email, phone, role, photo_url, balance, is_verified, created_at

### 2.2 Edit profil (form-data, foto optional)
`PATCH {{base_url}}/users/me` → Body **form-data**:
| Key | Type | Value |
|---|---|---|
| `full_name` | Text | `Budi Santoso Jr` |
| `photo` | File | foto.jpg |

✅ **200** → data profil terbaru
❌ `409 Email sudah dipakai user lain`

### 2.3 Ganti password
`PATCH {{base_url}}/users/me/password`
```json
{ "old_password": "rahasia123", "new_password": "rahasia456", "confirm_password": "rahasia456" }
```
✅ **200** → `Password berhasil diubah`
❌ `400 Password lama salah`

### 2.4 Riwayat transaksi (booking + pembelian)
`GET {{base_url}}/users/me/transactions`
✅ **200** → `{ "bookings": [...], "product_orders": [...] }`

### 2.5 Riwayat booking (dengan foto)
`GET {{base_url}}/users/me/bookings`
✅ **200** → array booking milik user

---

## 3. WALLET

### 3.1 Cek saldo
`GET {{base_url}}/wallet/balance`
✅ **200** → `{ "balance": 50000 }`

### 3.2 Top up (QRIS)
`POST {{base_url}}/wallet/topup`
```json
{ "amount": 50000 }
```
✅ **201** → `data`: reference, amount, qris (SANDBOX-QRIS...), status: PENDING
❌ `400 Minimal top up Rp10.000` · `400 Maksimal top up Rp2.000.000`

> Saldo baru bertambah setelah webhook valid (lihat admin-postman). Tombol "sudah bayar" gak ada — biar gak bisa fake bayar.

### 3.3 Riwayat top up
`GET {{base_url}}/wallet/topups`
✅ **200** → array: reference, amount, status, qr_string, paid_at

### 3.4 Riwayat perubahan saldo
`GET {{base_url}}/wallet/transactions`
✅ **200** → array: TOPUP / PAYMENT / REFUND + balance_before & balance_after

---

## 4. MESIN (hanya bisa LIHAT — setting khusus admin)

### 4.1 Daftar mesin cuci
`GET {{base_url}}/machines/washing-machines`
✅ **200** → array: id, code, capacity_kg, price_per_kg, status, description, photo_url

### 4.2 Detail mesin cuci
`GET {{base_url}}/machines/washing-machines/1`
✅ **200** / ❌ `404 Mesin cuci tidak ditemukan`

### 4.3 Daftar mesin pengering
`GET {{base_url}}/machines/drying-machines`
✅ **200** → id, code, price_per_use, duration_minutes, status, photo_url

> 🧪 **Tes 403** (bukti user gak bisa setting mesin):
> `POST {{base_url}}/machines/washing-machines` (Bearer user, body apa saja)
> ❌ **403** → `Endpoint ini khusus admin`

---

## 5. BOOKING ⭐

### 5.1 Buat booking + FOTO cucian
`POST {{base_url}}/bookings` → Body **form-data**:

| Key | Type | Value |
|---|---|---|
| `machine_type` | Text | `WASHING` |
| `machine_id` | Text | `1` |
| `booking_date` | Text | `2026-11-20` |
| `start_time` | Text | `10:00` |
| `weight_kg` | Text | `5` |
| `photo` | **File** | cucian.jpg |

✅ **201**
```json
{
  "success": true,
  "data": {
    "id": 1, "machine_type": "WASHING", "total_price": 7500,
    "status": "PENDING",
    "photo_before_url": "https://res.cloudinary.com/.../nyucik/bookings/before/....jpg"
  }
}
```
Harga dihitung backend: 5 kg × Rp1.500 (mesin 10kg) = **Rp7.500**.
Booking pengering gak perlu `weight_kg` & foto optional:
`machine_type=DRYING, machine_id=1, booking_date, start_time` → total = `price_per_use`.

❌ Semua error case yang diharapkan:
| Test | Hasil |
|---|---|
| weight 12 kg di mesin 10kg | `400 Berat maksimal mesin A1 adalah 10 kg` |
| start_time 16:00 | `400 Jam operasional hanya pukul 10.00 - 15.00` |
| booking 30 menit lagi | `400 Booking harus dilakukan minimal 1 jam sebelum waktu penggunaan` |
| slot bentrok (mesin sama, jam sama) | `409 Mesin A1 sudah dibooking di jam tersebut` |
| tanpa foto (mesin cuci) | `400 Foto cucian yang mau dicuci wajib diupload (field: photo)` |
| mesin status MAINTENANCE | `409 Mesin A5 sedang MAINTENANCE, pilih mesin lain` |

### 5.2 Bayar booking pakai saldo
`POST {{base_url}}/bookings/1/pay`
✅ **200**
```json
{ "success": true, "data": { "booking_id": 1, "status": "CONFIRMED", "paid": 7500, "balance_before": 50000, "balance_after": 42500 } }
```
❌ `400 Saldo tidak cukup... Top up dulu.` · `409 Booking sudah berstatus CONFIRMED`

### 5.3 Foto bukti sudah sampai di tempat ⭐
`POST {{base_url}}/bookings/1/arrival-photo` → form-data: `photo` = File
✅ **200**
```json
{ "success": true, "data": { "booking_id": 1, "photo_arrived_url": "https://res.cloudinary.com/.../nyucik/bookings/arrived/....jpg", "status": "IN_PROGRESS" } }
```
→ foto masuk folder `nyucik/bookings/arrived` (beda folder dengan foto saat booking) ✅
❌ `409 Upload foto hanya untuk booking yang sudah dibayar`

### 5.4 Batalkan booking
`POST {{base_url}}/bookings/1/cancel`
✅ **200** → `data: { booking_id, status: CANCELLED, refunded: 7500 }` (refund masuk saldo kalau sudah bayar)
❌ `400 Pembatalan hanya bisa minimal 1 jam sebelum waktu penggunaan` · `409 Booking berstatus IN_PROGRESS...`

### 5.5 Detail booking milik sendiri
`GET {{base_url}}/bookings/1`
✅ **200** → detail lengkap + foto sebelum/sampai
❌ `403 Booking ini bukan milikmu` (coba akses booking user lain)

---

## 6. PRODUK

### 6.1 Katalog
`GET {{base_url}}/products`
✅ **200** → array produk aktif: id, name, price, stock, photo_url

### 6.2 Detail produk
`GET {{base_url}}/products/1` → ✅ / ❌ `404 Produk tidak ditemukan`

### 6.3 Beli produk (pakai saldo)
`POST {{base_url}}/products/orders`
```json
{ "product_id": 1, "quantity": 2 }
```
✅ **201**
```json
{ "success": true, "data": { "order_id": 1, "product": "Deterjen Bubuk 500gr", "quantity": 2, "total_price": 24000, "balance_after": 18500 } }
```
❌ `400 Stok tidak cukup. Sisa stok: X` (stok gak akan minus) · `400 Saldo tidak cukup`

### 6.4 Riwayat pembelian
`GET {{base_url}}/products/orders/my`
✅ **200** → array order + product_name + total_price

> 🧪 **Tes 403** CRUD produk pakai token user:
> `POST {{base_url}}/products` → ❌ **403** `Endpoint ini khusus admin`

---

## 7. PENGUMUMAN & PEGAWAI

### 7.1 Pengumuman aktif (halaman utama)
`GET {{base_url}}/announcements`
✅ **200** → array: title, content, image_url, start_date, end_date

### 7.2 Daftar pegawai (ready/tidak)
`GET {{base_url}}/employees`
✅ **200** → array: name, position, phone, is_ready

---

## ✅ CHECKLIST TESTING USER

- [ ] Register → OTP email → verify → login dapat token
- [ ] Profil lihat/edit + foto profil masuk Cloudinary `nyucik/profiles`
- [ ] Top up QRIS → saldo nambah setelah webhook valid
- [ ] Booking + foto cucian masuk `nyucik/bookings/before`
- [ ] Pay booking → status CONFIRMED, saldo berkurang
- [ ] Arrival photo masuk `nyucik/bookings/arrived` → status IN_PROGRESS
- [ ] Cancel → refund masuk wallet_transactions
- [ ] Beli produk → stok & saldo berkurang, tidak bisa minus
- [ ] Semua POST/PATCH/DELETE mesin & produk pakai token user → 403
