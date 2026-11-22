# Nyucik API — Panduan Test User di Postman

Dokumen ini berisi semua endpoint yang bisa dilakukan oleh **role USER**.
Semua request di bawah ini memakai token hasil login user.

---

## 0. Persiapan Postman

### Base URL

```
http://localhost:3000/api/v1
```

Kalau backend sudah deploy, ganti dengan URL backend, misalnya:

```
https://nyucik-backend.vercel.app/api/v1
```

Token JWT default berlaku **1 hari** (`JWT_EXPIRES_IN` di `.env`).
Kalau dapat `401`, login ulang untuk mengambil token baru.

### Collection Variable

Buat environment/collection variable berikut:

| Variable     | Isi                                  |
|--------------|--------------------------------------|
| `base_url`   | `http://localhost:3000/api/v1`       |
| `user_token` | token hasil login user               |

### Header Umum

Untuk endpoint yang butuh login:

```
Authorization: Bearer {{user_token}}
```

Untuk request JSON:

```
Content-Type: application/json
```

Untuk upload foto, **jangan** set `Content-Type` manual. Pakai
**Body → form-data**, lalu pilih tipe **File** pada field `photo`.

### Format Response

Semua response backend memakai format:

```json
{
  "success": true,
  "message": "Pesan dari server",
  "data": {}
}
```

Kalau gagal:

```json
{
  "success": false,
  "message": "Pesan error"
}
```

### Simpan Token Otomatis

Di tab **Tests** request login, tambahkan script:

```js
const body = pm.response.json();
if (body.success) {
  pm.collectionVariables.set("user_token", body.data.token);
}
```

---

## Cheat Sheet — Cara Isi Postman per Endpoint

Tabel ini merangkum **semua endpoint user** dan cara mengisinya di
Postman. Detail body dan response ada di bagian bawah.

Keterangan kolom:

- **Auth `User`** = tab Authorization → Bearer Token → `{{user_token}}`.
- **Auth `-`** = tidak perlu token.
- **raw JSON** = Body → raw → JSON.
- **form-data** = Body → form-data.
- **`id=1`** = isi Path Variables di tab Params.
- **`-`** = tidak ada body/params.

| Method | URL | Auth | Body / Params | Contoh isi |
|--------|-----|------|---------------|------------|
| POST | `{{base_url}}/auth/register` | - | raw JSON | `{"full_name":"Budi Test","email":"budi.test@example.com","phone":"081234567890","password":"rahasia123","confirm_password":"rahasia123"}` |
| POST | `{{base_url}}/auth/verify-otp` | - | raw JSON | `{"email":"budi.test@example.com","otp":"123456"}` |
| POST | `{{base_url}}/auth/resend-otp` | - | raw JSON | `{"email":"budi.test@example.com"}` |
| POST | `{{base_url}}/auth/login` | - | raw JSON | `{"email":"budi.test@example.com","password":"rahasia123"}` |
| POST | `{{base_url}}/auth/logout` | User | - | - |
| GET | `{{base_url}}/users/me` | User | - | - |
| PATCH | `{{base_url}}/users/me` | User | form-data | `full_name=Budi Test Baru; phone=081234567891; photo=[file gambar]` |
| PATCH | `{{base_url}}/users/me/password` | User | raw JSON | `{"old_password":"rahasia123","new_password":"rahasia456","confirm_password":"rahasia456"}` |
| GET | `{{base_url}}/users/me/transactions` | User | - | - |
| GET | `{{base_url}}/users/me/bookings` | User | - | - |
| GET | `{{base_url}}/wallet/balance` | User | - | - |
| GET | `{{base_url}}/wallet/transactions` | User | - | - |
| POST | `{{base_url}}/wallet/topup` | User | raw JSON | `{"amount":50000}` |
| GET | `{{base_url}}/wallet/topups` | User | - | - |
| POST | `{{base_url}}/wallet/topups/:id/check` | User | path `id` | `id=1` |
| POST | `{{base_url}}/wallet/topups/:id/simulate` | User | path `id` | `id=1` |
| POST | `{{base_url}}/wallet/topups/:id/cancel` | User | path `id` | `id=1` |
| GET | `{{base_url}}/machines/washing-machines` | User | - | - |
| GET | `{{base_url}}/machines/washing-machines/:id` | User | path `id` | `id=1` |
| GET | `{{base_url}}/machines/drying-machines` | User | - | - |
| GET | `{{base_url}}/machines/drying-machines/:id` | User | path `id` | `id=1` |
| POST | `{{base_url}}/bookings` | User | form-data | `machine_type=WASHING; machine_id=1; photo=[file gambar]` |
| GET | `{{base_url}}/bookings/my` | User | - | - |
| GET | `{{base_url}}/bookings/:id` | User | path `id` | `id=1` |
| POST | `{{base_url}}/bookings/:id/pay` | User | path `id` | `id=1` |
| POST | `{{base_url}}/bookings/:id/cancel` | User | path `id` | `id=1` |
| POST | `{{base_url}}/bookings/:id/start` | User | form-data | `photo=[file gambar]` |
| GET | `{{base_url}}/products` | User | - | - |
| GET | `{{base_url}}/products/:id` | User | path `id` | `id=1` |
| POST | `{{base_url}}/products/orders` | User | raw JSON | `{"product_id":1,"quantity":2}` |
| GET | `{{base_url}}/products/orders/my` | User | - | - |
| POST | `{{base_url}}/products/orders/:id/complete` | User | path `id` | `id=1` |
| GET | `{{base_url}}/announcements` | User | - | - |
| GET | `{{base_url}}/employees` | User | - | - |
| GET | `{{base_url}}/store/status` | - | - | - |

Contoh mengisi form-data di Postman:

```
Key            Type    Value
machine_type   Text    WASHING
machine_id     Text    1
photo          File    [pilih gambar dari komputer]
```

Untuk semua field `photo`, pilih **Type = File**, bukan Text.

Untuk endpoint yang punya `:id`, tulis URL apa adanya (misalnya
`{{base_url}}/wallet/topups/:id/check`), lalu buka tab **Params →
Path Variables** dan isi `id = 1`.

---

## 1. Alur Test User yang Disarankan

Urutan test paling aman:

1. Register user baru.
2. Ambil OTP (dari email atau `debug_otp` kalau `SEND_OTP_IN_RESPONSE=true`).
3. Verifikasi OTP.
4. Login dan simpan token.
5. Lihat profil.
6. Lihat mesin cuci & mesin pengering.
7. Cek status toko.
8. Top up saldo.
9. Simulasi/cek pembayaran top up.
10. Buat booking laundry.
11. Bayar booking.
12. Mulai laundry.
13. Lihat riwayat laundry.
14. Beli produk.
15. Konfirmasi produk diterima.
16. Lihat riwayat transaksi.
17. Ubah profil / password.
18. Logout.

---

## 2. Auth

### 2.1 Register

**POST** `{{base_url}}/auth/register`

Auth: tidak perlu token.

Body JSON:

```json
{
  "full_name": "Budi Test",
  "email": "budi.test@example.com",
  "phone": "081234567890",
  "password": "rahasia123",
  "confirm_password": "rahasia123"
}
```

Aturan:

- `full_name` minimal 3 karakter.
- `phone` harus diawali `08`, total 9–14 digit.
- `password` minimal 6 karakter.
- `confirm_password` harus sama.

Response sukses `201`:

```json
{
  "success": true,
  "message": "Kode OTP (6 digit) telah dikirim ke email kamu. Berlaku 5 menit.",
  "data": {
    "email": "budi.test@example.com",
    "otp_expired_in": "5 menit",
    "note": "Akun aktif setelah verifikasi OTP di /api/v1/auth/verify-otp"
  }
}
```

Kalau `SEND_OTP_IN_RESPONSE=true` di `.env`, response juga berisi
`debug_otp`. Ini memudahkan test tanpa buka email.

---

### 2.2 Verifikasi OTP

**POST** `{{base_url}}/auth/verify-otp`

Auth: tidak perlu token.

Body JSON:

```json
{
  "email": "budi.test@example.com",
  "otp": "123456"
}
```

Aturan:

- OTP harus 6 digit angka.
- OTP berlaku 5 menit.
- Maksimal 5 kali percobaan salah.

Response sukses:

```json
{
  "success": true,
  "message": "Verifikasi berhasil! Akun kamu aktif, silakan login.",
  "data": {
    "email": "budi.test@example.com"
  }
}
```

---

### 2.3 Kirim Ulang OTP

**POST** `{{base_url}}/auth/resend-otp`

Auth: tidak perlu token.

Body JSON:

```json
{
  "email": "budi.test@example.com"
}
```

Catatan:

- Hanya untuk akun yang belum terverifikasi.
- Bisa request ulang setelah 5 menit dari pengiriman terakhir.

---

### 2.4 Login

**POST** `{{base_url}}/auth/login`

Auth: tidak perlu token.

Body JSON:

```json
{
  "email": "budi.test@example.com",
  "password": "rahasia123"
}
```

Response sukses:

```json
{
  "success": true,
  "message": "Login berhasil",
  "data": {
    "token": "eyJhbGciOi...",
    "user": {
      "id": 2,
      "full_name": "Budi Test",
      "email": "budi.test@example.com",
      "phone": "081234567890",
      "role": "USER",
      "photo_url": null,
      "balance": 0
    }
  }
}
```

Simpan `data.token` ke variable `user_token`.

Kalau akun belum verifikasi, response `403`:

```json
{
  "success": false,
  "message": "Email belum diverifikasi. Cek email untuk OTP."
}
```

---

### 2.5 Logout

**POST** `{{base_url}}/auth/logout`

Auth: Bearer `{{user_token}}`.

Body: tidak ada.

Catatan:

- Token JWT tidak disimpan di server.
- Setelah logout, hapus token dari Postman/aplikasi.

---

## 3. Profil User

### 3.1 Lihat Profil

**GET** `{{base_url}}/users/me`

Auth: Bearer `{{user_token}}`.

Response `data`:

```json
{
  "id": 2,
  "full_name": "Budi Test",
  "email": "budi.test@example.com",
  "phone": "081234567890",
  "role": "USER",
  "photo_url": null,
  "balance": 100000,
  "is_verified": 1,
  "created_at": "2026-11-22T10:00:00.000Z"
}
```

---

### 3.2 Ubah Profil

**PATCH** `{{base_url}}/users/me`

Auth: Bearer `{{user_token}}`.

Body: **form-data**.

| Field       | Tipe | Wajib | Keterangan                         |
|-------------|------|-------|------------------------------------|
| `full_name` | Text | Tidak | Minimal 3 karakter                |
| `email`     | Text | Tidak | Harus email valid & belum dipakai  |
| `phone`     | Text | Tidak | Format `08...`                     |
| `photo`     | File | Tidak | JPG/PNG/WEBP, maksimal 3 MB        |

Contoh isi form-data:

```
full_name : Budi Test Baru
phone     : 081234567891
photo     : [pilih file gambar]
```

Kalau tidak ada field yang diisi, response `400`:

```json
{
  "success": false,
  "message": "Tidak ada data yang diubah"
}
```

---

### 3.3 Ubah Password

**PATCH** `{{base_url}}/users/me/password`

Auth: Bearer `{{user_token}}`.

Body JSON:

```json
{
  "old_password": "rahasia123",
  "new_password": "rahasia456",
  "confirm_password": "rahasia456"
}
```

Aturan:

- `new_password` minimal 6 karakter.
- `confirm_password` harus sama dengan `new_password`.

---

### 3.4 Riwayat Transaksi Gabungan

**GET** `{{base_url}}/users/me/transactions`

Auth: Bearer `{{user_token}}`.

Response `data` berisi:

```json
{
  "bookings": [],
  "product_orders": []
}
```

- `bookings` = semua laundry milik user.
- `product_orders` = semua pembelian produk milik user.

---

### 3.5 Riwayat Laundry Saja

**GET** `{{base_url}}/users/me/bookings`

Auth: Bearer `{{user_token}}`.

Response `data` berupa array booking.

---

## 4. Saldo & Top Up

### 4.1 Lihat Saldo

**GET** `{{base_url}}/wallet/balance`

Auth: Bearer `{{user_token}}`.

Response:

```json
{
  "success": true,
  "message": "Saldo berhasil diambil",
  "data": {
    "balance": 100000
  }
}
```

---

### 4.2 Riwayat Saldo

**GET** `{{base_url}}/wallet/transactions`

Auth: Bearer `{{user_token}}`.

Response `data` berupa array transaksi saldo:

```json
[
  {
    "id": 1,
    "type": "TOPUP",
    "amount": 50000,
    "balance_before": 50000,
    "balance_after": 100000,
    "reference_type": "TOPUP",
    "reference_id": 1,
    "description": "Top up saldo via QRIS KiPay (NYUCIK-TOPUP-...)",
    "created_at": "2026-11-22T10:00:00.000Z"
  }
]
```

Nilai `type` yang mungkin:

- `TOPUP`
- `PAYMENT`
- `REFUND`

---

### 4.3 Buat Top Up QRIS

**POST** `{{base_url}}/wallet/topup`

Auth: Bearer `{{user_token}}`.

Body JSON:

```json
{
  "amount": 50000
}
```

Aturan:

- Minimal `10000`.
- Maksimal `10000000`.
- Nominal akan ditambah kode unik dari KiPay.

Response sukses `201`:

```json
{
  "success": true,
  "message": "QRIS dibuat. Bayar sebelum 10:15 WIB.",
  "data": {
    "id": 1,
    "top_up_id": 1,
    "reference": "TRX-...",
    "amount": 50123,
    "original_amount": 50000,
    "unique_code": 123,
    "fee_amount": 0,
    "fee_bearer": "customer",
    "provider": "KIPAY",
    "mode": "sandbox",
    "qris": "000201010212...",
    "qr_string": "000201010212...",
    "payment_url": "https://api.kipay.biz.id/pay/...",
    "expires_at": "2026-11-22 10:15:00",
    "status": "PENDING"
  }
}
```

Simpan `data.top_up_id` untuk request cek/simulasi/batal.

Kalau KiPay belum dikonfigurasi, response `503`:

```json
{
  "success": false,
  "message": "Pembayaran QRIS belum dikonfigurasi di server"
}
```

---

### 4.4 Riwayat Top Up

**GET** `{{base_url}}/wallet/topups`

Auth: Bearer `{{user_token}}`.

Response `data` berupa array:

```json
[
  {
    "id": 1,
    "reference": "TRX-...",
    "amount": 50123,
    "status": "PENDING",
    "qr_string": "000201010212...",
    "provider": "KIPAY",
    "payment_url": "https://api.kipay.biz.id/pay/...",
    "unique_code": 123,
    "expires_at": "2026-11-22 10:15:00",
    "paid_at": null,
    "created_at": "2026-11-22T10:00:00.000Z"
  }
]
```

Status top up:

- `PENDING`
- `PAID`
- `EXPIRED`
- `FAILED`
- `CANCELLED`

---

### 4.5 Cek Pembayaran Top Up

**POST** `{{base_url}}/wallet/topups/:id/check`

Auth: Bearer `{{user_token}}`.

Path parameter:

| Parameter | Keterangan        |
|-----------|-------------------|
| `id`      | ID top up / `top_up_id` |

Body: tidak ada.

Alias: endpoint yang sama juga tersedia di
`POST /wallet/topups/:id/pay`.

Response kalau sudah dibayar:

```json
{
  "success": true,
  "message": "Pembayaran berhasil, saldo bertambah",
  "data": {
    "top_up_id": 1,
    "status": "PAID",
    "balance": 150123
  }
}
```

Response kalau belum dibayar (`409`):

```json
{
  "success": false,
  "message": "Pembayaran belum masuk (pending). Selesaikan pembayaran QRIS lalu tekan Cek Pembayaran lagi."
}
```

Response kalau kedaluwarsa (`409`):

```json
{
  "success": false,
  "message": "QRIS sudah kedaluwarsa. Buat QRIS baru untuk top up."
}
```

---

### 4.6 Simulasi Pembayaran (Sandbox)

**POST** `{{base_url}}/wallet/topups/:id/simulate`

Auth: Bearer `{{user_token}}`.

Body: tidak ada.

Catatan:

- Hanya untuk project KiPay sandbox.
- Menandai transaksi lunas, lalu saldo langsung masuk.
- Di project production, endpoint ini akan ditolak oleh KiPay.

Response sukses:

```json
{
  "success": true,
  "message": "Pembayaran simulasi berhasil, saldo bertambah",
  "data": {
    "top_up_id": 1,
    "status": "PAID",
    "balance": 150123
  }
}
```

---

### 4.7 Batalkan Top Up

**POST** `{{base_url}}/wallet/topups/:id/cancel`

Auth: Bearer `{{user_token}}`.

Body: tidak ada.

Aturan:

- Hanya top up berstatus `PENDING` yang bisa dibatalkan.
- Top up `PAID` tidak bisa dibatalkan.
- Saldo tidak berubah karena belum pernah masuk.

Response sukses:

```json
{
  "success": true,
  "message": "Top up dibatalkan",
  "data": {
    "top_up_id": 1,
    "status": "CANCELLED"
  }
}
```

---

## 5. Mesin

### 5.1 Daftar Mesin Cuci

**GET** `{{base_url}}/machines/washing-machines`

Auth: Bearer `{{user_token}}`.

Response `data`:

```json
[
  {
    "id": 1,
    "code": "W-01",
    "capacity_kg": 5,
    "price_per_use": 15000,
    "status": "AVAILABLE",
    "description": "Mesin cuci 5 kg",
    "photo_url": "https://..."
  }
]
```

Status mesin:

- `AVAILABLE`
- `BOOKED`
- `IN_USE`
- `MAINTENANCE`

---

### 5.2 Detail Mesin Cuci

**GET** `{{base_url}}/machines/washing-machines/:id`

Auth: Bearer `{{user_token}}`.

---

### 5.3 Daftar Mesin Pengering

**GET** `{{base_url}}/machines/drying-machines`

Auth: Bearer `{{user_token}}`.

Response `data`:

```json
[
  {
    "id": 1,
    "code": "D-01",
    "price_per_use": 10000,
    "duration_minutes": 25,
    "status": "AVAILABLE",
    "description": "Pengering 25 menit",
    "photo_url": "https://..."
  }
]
```

---

### 5.4 Detail Mesin Pengering

**GET** `{{base_url}}/machines/drying-machines/:id`

Auth: Bearer `{{user_token}}`.

---

## 6. Laundry / Booking

### 6.1 Buat Booking Laundry

**POST** `{{base_url}}/bookings`

Auth: Bearer `{{user_token}}`.

Body: **form-data**.

| Field          | Tipe | Wajib | Keterangan                    |
|----------------|------|-------|-------------------------------|
| `machine_type` | Text | Ya    | `WASHING` atau `DRYING`       |
| `machine_id`   | Text | Ya    | ID mesin                      |
| `photo`        | File | Ya    | Foto cucian sebelum dicuci    |

Contoh:

```
machine_type : WASHING
machine_id   : 1
photo        : [pilih file gambar]
```

Aturan:

- Toko harus sedang buka.
- Mesin harus `AVAILABLE`.
- Mesin tidak boleh sedang dipakai booking aktif.
- Foto wajib diupload.
- Harga diambil otomatis dari `price_per_use` mesin.
- Booking baru berstatus `PENDING` dan belum memotong saldo.

Response sukses `201`:

```json
{
  "success": true,
  "message": "Laundry berhasil dibuat. Silakan bayar pakai saldo.",
  "data": {
    "id": 1,
    "user_id": 2,
    "machine_type": "WASHING",
    "washing_machine_id": 1,
    "drying_machine_id": null,
    "booking_date": "2026-11-22",
    "start_time": "10:00:00",
    "end_time": "10:25:00",
    "total_price": 15000,
    "status": "PENDING",
    "photo_before_url": "https://...",
    "machine_code": "W-01",
    "duration_minutes": 25
  }
}
```

Kalau toko tutup (`409`):

```json
{
  "success": false,
  "message": "Toko sedang tutup. Laundry belum bisa dipesan sekarang."
}
```

---

### 6.2 Riwayat Laundry Saya

**GET** `{{base_url}}/bookings/my`

Auth: Bearer `{{user_token}}`.

Response `data` berupa array booking milik user.

---

### 6.3 Detail Booking

**GET** `{{base_url}}/bookings/:id`

Auth: Bearer `{{user_token}}`.

Catatan:

- User hanya bisa melihat booking miliknya.
- Admin bisa melihat semua booking.

---

### 6.4 Bayar Booking

**POST** `{{base_url}}/bookings/:id/pay`

Auth: Bearer `{{user_token}}`.

Body: tidak ada.

Aturan:

- Hanya booking milik user.
- Status harus `PENDING`.
- Saldo harus cukup.
- Saldo langsung terpotong.
- Status booking menjadi `CONFIRMED`.
- Status mesin menjadi `BOOKED`.

Response sukses:

```json
{
  "success": true,
  "message": "Laundry berhasil dibayar, siap dimulai",
  "data": {
    "booking_id": 1,
    "status": "CONFIRMED",
    "paid": 15000,
    "balance_before": 100000,
    "balance_after": 85000
  }
}
```

Kalau saldo kurang (`400`):

```json
{
  "success": false,
  "message": "Saldo tidak cukup. Saldo: Rp5000, total: Rp15000. Top up dulu."
}
```

---

### 6.5 Batalkan Booking

**POST** `{{base_url}}/bookings/:id/cancel`

Auth: Bearer `{{user_token}}`.

Body: tidak ada.

Aturan:

- Booking milik user (admin juga boleh membatalkan semua booking).
- Status harus `PENDING` atau `CONFIRMED`.
- Kalau status `CONFIRMED` (sudah dibayar), saldo otomatis dikembalikan (refund).
- Status menjadi `CANCELLED`.
- Mesin kembali `AVAILABLE`.

Response sukses:

```json
{
  "success": true,
  "message": "Laundry berhasil dibatalkan",
  "data": {
    "booking_id": 1,
    "status": "CANCELLED",
    "refunded": 15000
  }
}
```

---

### 6.6 Mulai Laundry

**POST** `{{base_url}}/bookings/:id/start`

Auth: Bearer `{{user_token}}`.

Body: **form-data**.

| Field   | Tipe | Wajib | Keterangan                         |
|---------|------|-------|------------------------------------|
| `photo` | File | Ya    | Foto cucian saat mulai dimasukkan  |

Aturan:

- Status booking harus `CONFIRMED` (sudah dibayar).
- Foto wajib.
- Status menjadi `IN_PROGRESS`.
- Mesin menjadi `IN_USE`.
- Durasi mesin 25 menit.

Response sukses:

```json
{
  "success": true,
  "message": "Laundry dimulai, mesin berjalan 25 menit",
  "data": {
    "booking_id": 1,
    "photo_arrived_url": "https://...",
    "status": "IN_PROGRESS",
    "started_at": "2026-11-22T03:00:00.000Z",
    "duration_minutes": 25
  }
}
```

---

## 7. Produk

### 7.1 Katalog Produk Aktif

**GET** `{{base_url}}/products`

Auth: Bearer `{{user_token}}`.

Response `data`:

```json
[
  {
    "id": 1,
    "name": "Deterjen 1 kg",
    "description": "Deterjen bubuk",
    "price": 15000,
    "stock": 10,
    "photo_url": "https://..."
  }
]
```

---

### 7.2 Detail Produk

**GET** `{{base_url}}/products/:id`

Auth: Bearer `{{user_token}}`.

---

### 7.3 Beli Produk

**POST** `{{base_url}}/products/orders`

Auth: Bearer `{{user_token}}`.

Body JSON:

```json
{
  "product_id": 1,
  "quantity": 2
}
```

Aturan:

- Toko harus sedang buka.
- Stok harus cukup.
- Saldo harus cukup.
- Saldo langsung terpotong.
- Stok langsung berkurang.
- Status pesanan awal `PENDING`.

Response sukses `201`:

```json
{
  "success": true,
  "message": "Pembelian berhasil, silakan tunjukkan ke petugas",
  "data": {
    "order_id": 1,
    "product": "Deterjen 1 kg",
    "quantity": 2,
    "total_price": 30000,
    "status": "PENDING",
    "balance_after": 70000
  }
}
```

Kalau toko tutup (`409`):

```json
{
  "success": false,
  "message": "Toko sedang tutup. Pembelian belum bisa dilakukan sekarang."
}
```

---

### 7.4 Riwayat Pesanan Produk

**GET** `{{base_url}}/products/orders/my`

Auth: Bearer `{{user_token}}`.

Response `data`:

```json
[
  {
    "id": 1,
    "product_id": 1,
    "product_name": "Deterjen 1 kg",
    "photo_url": "https://...",
    "quantity": 2,
    "total_price": 30000,
    "status": "PENDING",
    "created_at": "2026-11-22T10:00:00.000Z"
  }
]
```

---

### 7.5 Konfirmasi Produk Diterima

**POST** `{{base_url}}/products/orders/:id/complete`

Auth: Bearer `{{user_token}}`.

Body: tidak ada.

Aturan:

- Hanya pesanan milik user.
- Status menjadi `COMPLETED`.

Response:

```json
{
  "success": true,
  "message": "Pesanan dikonfirmasi selesai. Terima kasih!",
  "data": {
    "id": 1,
    "status": "COMPLETED"
  }
}
```

---

## 8. Pengumuman

### 8.1 Lihat Pengumuman Aktif

**GET** `{{base_url}}/announcements`

Auth: Bearer `{{user_token}}`.

Response hanya berisi pengumuman yang:

- `is_active = 1`
- tanggal hari ini berada di antara `start_date` dan `end_date`

Response `data`:

```json
[
  {
    "id": 1,
    "title": "Promo Cuci",
    "content": "Diskon 10% hari ini.",
    "image_url": "https://...",
    "start_date": "2026-11-22",
    "end_date": "2026-11-30",
    "is_active": 1,
    "created_at": "2026-11-22T10:00:00.000Z"
  }
]
```

---

## 9. Petugas

### 9.1 Lihat Daftar Petugas

**GET** `{{base_url}}/employees`

Auth: Bearer `{{user_token}}`.

Response `data`:

```json
[
  {
    "id": 1,
    "name": "Andi",
    "position": "Operator",
    "phone": "081234567890",
    "is_ready": 1
  }
]
```

Urutan: petugas siap (`is_ready = 1`) tampil lebih dulu.

---

## 10. Status Toko

### 10.1 Cek Status Toko

**GET** `{{base_url}}/store/status`

Auth: tidak perlu token (bisa juga pakai token).

Response:

```json
{
  "success": true,
  "message": "Status toko berhasil diambil",
  "data": {
    "is_open": true,
    "manual_open": true,
    "has_staff": true,
    "reason": null
  }
}
```

Arti field:

| Field         | Arti                                                |
|---------------|-----------------------------------------------------|
| `is_open`     | Status final toko (buka dan ada petugas siap)       |
| `manual_open` | Status buka/tutup dari admin                        |
| `has_staff`   | Ada petugas dengan `is_ready = 1`                   |
| `reason`      | Alasan toko tutup, `null` kalau toko buka           |

Kalau `has_staff = false`, toko otomatis dianggap tutup walaupun
`manual_open = true`.

---

## 11. Yang Tidak Bisa Dilakukan User

Endpoint berikut hanya untuk admin. Kalau dipakai dengan token user,
response `403`:

- `GET /admin/dashboard`
- `GET /admin/users`
- `GET /admin/users/:id`
- `GET /admin/revenue`
- `POST /machines/washing-machines`
- `PATCH /machines/washing-machines/:id`
- `PATCH /machines/washing-machines/:id/status`
- `DELETE /machines/washing-machines/:id`
- `POST /machines/drying-machines`
- `PATCH /machines/drying-machines/:id`
- `PATCH /machines/drying-machines/:id/status`
- `DELETE /machines/drying-machines/:id`
- `GET /announcements/admin/all`
- `POST /announcements`
- `PATCH /announcements/:id`
- `DELETE /announcements/:id`
- `POST /employees`
- `PATCH /employees/:id`
- `DELETE /employees/:id`
- `GET /products/admin/all`
- `POST /products`
- `PATCH /products/:id`
- `DELETE /products/:id`
- `GET /bookings` (semua booking)
- `PATCH /bookings/:id/status`
- `DELETE /bookings/:id`
- `PATCH /store/status`

Catatan: `POST /products/orders` **boleh** untuk user karena itu
pembelian produk, bukan menambah produk.

Response `403`:

```json
{
  "success": false,
  "message": "Kamu tidak punya akses ke endpoint ini"
}
```

---

## 12. Kode Error yang Sering Muncul

| Status | Arti                                                     |
|--------|----------------------------------------------------------|
| `400`  | Body/field tidak valid                                   |
| `401`  | Token tidak ada, salah, atau kedaluwarsa                 |
| `403`  | Token valid tapi role tidak punya akses                  |
| `404`  | Data tidak ditemukan                                     |
| `409`  | Konflik: toko tutup, saldo kurang, status tidak sesuai   |
| `429`  | Terlalu banyak percobaan OTP / kirim ulang terlalu cepat |
| `502`  | Gagal komunikasi dengan KiPay                            |
| `503`  | KiPay belum dikonfigurasi                                |

---

## 13. Checklist Test User

- [ ] Register berhasil dan OTP terkirim.
- [ ] Verifikasi OTP berhasil.
- [ ] Login berhasil dan token tersimpan.
- [ ] `GET /users/me` menampilkan profil.
- [ ] `PATCH /users/me` bisa ubah nama/telepon/foto.
- [ ] `PATCH /users/me/password` berhasil.
- [ ] `GET /wallet/balance` menampilkan saldo.
- [ ] Top up berhasil membuat QRIS.
- [ ] Cek pembayaran top up berhasil menambah saldo.
- [ ] Simulasi top up berhasil di sandbox.
- [ ] Batal top up mengubah status menjadi `CANCELLED`.
- [ ] Daftar mesin cuci dan pengering tampil.
- [ ] Booking laundry berhasil dibuat.
- [ ] Booking berhasil dibayar dengan saldo.
- [ ] Booking berhasil dimulai dengan foto.
- [ ] Riwayat laundry tampil.
- [ ] Booking bisa dibatalkan dan saldo kembali.
- [ ] Katalog produk tampil.
- [ ] Pembelian produk berhasil memotong saldo.
- [ ] Pesanan produk bisa dikonfirmasi selesai.
- [ ] Pengumuman aktif tampil.
- [ ] Daftar petugas tampil.
- [ ] Status toko tampil.
- [ ] Endpoint admin ditolak dengan `403`.
- [ ] Logout berhasil.
