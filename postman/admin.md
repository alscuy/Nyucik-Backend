# Nyucik API — Panduan Lengkap Tugas Admin di Postman

Dokumen ini berisi semua endpoint dan tugas **role ADMIN**.
Gunakan token hasil login admin, bukan token user biasa.

---

## 0. Persiapan Admin

### Base URL

```
http://localhost:3000/api/v1
```

Token JWT default berlaku **1 hari** (`JWT_EXPIRES_IN` di `.env`).
Kalau dapat `401`, login ulang sebagai admin.

### Akun Admin dari Seed

Jalankan seed terlebih dahulu:

```
npm run seed
```

Akun bawaan:

| Role  | Email              | Password   |
|-------|--------------------|------------|
| ADMIN | `admin@nyucik.com` | `admin123` |
| USER  | `user@nyucik.com`  | `user123`  |

### Kalau Belum Ada Admin

Kalau database tidak memakai seed, ubah role user lewat SQL:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'emailkamu@example.com';
```

Lalu login ulang supaya token berisi role `ADMIN`.

### Collection Variable

| Variable      | Isi                              |
|---------------|----------------------------------|
| `base_url`    | `http://localhost:3000/api/v1`   |
| `admin_token` | token hasil login admin          |
| `user_id`     | ID user yang mau dicek           |
| `booking_id`  | ID booking                       |
| `machine_id`  | ID mesin                         |
| `product_id`  | ID produk                        |
| `topup_id`    | ID top up                        |

### Header Umum

```
Authorization: Bearer {{admin_token}}
```

Untuk JSON:

```
Content-Type: application/json
```

Untuk upload foto, pakai **Body → form-data** dan field `photo`
bertipe **File**. Jangan set `Content-Type` manual.

### Simpan Token Admin Otomatis

Di tab **Tests** request login admin:

```js
const body = pm.response.json();
if (body.success) {
  pm.collectionVariables.set("admin_token", body.data.token);
}
```

---

## Cheat Sheet — Cara Isi Postman per Endpoint

Tabel ini merangkum **semua endpoint admin** dan cara mengisinya di
Postman. Detail body dan response ada di bagian bawah.

Keterangan kolom:

- **Auth `Admin`** = tab Authorization → Bearer Token → `{{admin_token}}`.
- **Auth `-`** = tidak perlu token.
- **raw JSON** = Body → raw → JSON.
- **form-data** = Body → form-data.
- **`id=1`** = isi Path Variables di tab Params.
- **`-`** = tidak ada body/params.

| Method | URL | Auth | Body / Params | Contoh isi |
|--------|-----|------|---------------|------------|
| POST | `{{base_url}}/auth/login` | - | raw JSON | `{"email":"admin@nyucik.com","password":"admin123"}` |
| POST | `{{base_url}}/auth/logout` | Admin | - | - |
| GET | `{{base_url}}/admin/dashboard` | Admin | - | - |
| GET | `{{base_url}}/store/status` | - | - | - |
| PATCH | `{{base_url}}/store/status` | Admin | raw JSON | `{"is_open":false}` |
| GET | `{{base_url}}/employees` | Admin | - | - |
| POST | `{{base_url}}/employees` | Admin | raw JSON | `{"name":"Andi","position":"Operator","phone":"081234567890","is_ready":true}` |
| PATCH | `{{base_url}}/employees/:id` | Admin | path `id` + raw JSON | `id=1`, `{"is_ready":false}` |
| DELETE | `{{base_url}}/employees/:id` | Admin | path `id` | `id=1` |
| GET | `{{base_url}}/machines/washing-machines` | Admin | - | - |
| GET | `{{base_url}}/machines/washing-machines/:id` | Admin | path `id` | `id=1` |
| POST | `{{base_url}}/machines/washing-machines` | Admin | form-data | `code=W-01; capacity_kg=5; price_per_use=15000; status=AVAILABLE; description=Mesin cuci 5 kg; photo=[file gambar]` |
| PATCH | `{{base_url}}/machines/washing-machines/:id` | Admin | path `id` + form-data | `id=1`, `price_per_use=20000; description=Harga baru` |
| PATCH | `{{base_url}}/machines/washing-machines/:id/status` | Admin | path `id` + raw JSON | `id=1`, `{"status":"MAINTENANCE"}` |
| DELETE | `{{base_url}}/machines/washing-machines/:id` | Admin | path `id` | `id=1` |
| GET | `{{base_url}}/machines/drying-machines` | Admin | - | - |
| GET | `{{base_url}}/machines/drying-machines/:id` | Admin | path `id` | `id=1` |
| POST | `{{base_url}}/machines/drying-machines` | Admin | form-data | `code=D-01; price_per_use=10000; status=AVAILABLE; description=Pengering 25 menit; photo=[file gambar]` |
| PATCH | `{{base_url}}/machines/drying-machines/:id` | Admin | path `id` + form-data | `id=1`, `price_per_use=12000` |
| PATCH | `{{base_url}}/machines/drying-machines/:id/status` | Admin | path `id` + raw JSON | `id=1`, `{"status":"MAINTENANCE"}` |
| DELETE | `{{base_url}}/machines/drying-machines/:id` | Admin | path `id` | `id=1` |
| GET | `{{base_url}}/products/admin/all` | Admin | - | - |
| POST | `{{base_url}}/products` | Admin | form-data | `name=Deterjen 1 kg; description=Deterjen bubuk; price=15000; stock=10; is_active=true; photo=[file gambar]` |
| PATCH | `{{base_url}}/products/:id` | Admin | path `id` + form-data | `id=1`, `price=16000; stock=20; is_active=false` |
| DELETE | `{{base_url}}/products/:id` | Admin | path `id` | `id=1` |
| GET | `{{base_url}}/announcements/admin/all` | Admin | - | - |
| POST | `{{base_url}}/announcements` | Admin | form-data | `title=Promo Cuci; content=Diskon 10% hari ini.; start_date=2026-11-22; end_date=2026-11-30; is_active=true; photo=[file gambar]` |
| PATCH | `{{base_url}}/announcements/:id` | Admin | path `id` + form-data | `id=1`, `is_active=false` |
| DELETE | `{{base_url}}/announcements/:id` | Admin | path `id` | `id=1` |
| GET | `{{base_url}}/bookings` | Admin | - | - |
| GET | `{{base_url}}/bookings/:id` | Admin | path `id` | `id=1` |
| POST | `{{base_url}}/bookings/:id/cancel` | Admin | path `id` | `id=1` |
| POST | `{{base_url}}/bookings/:id/start` | Admin | path `id` + form-data | `id=1`, `photo=[file gambar]` |
| PATCH | `{{base_url}}/bookings/:id/status` | Admin | path `id` + raw JSON | `id=1`, `{"status":"COMPLETED"}` |
| DELETE | `{{base_url}}/bookings/:id` | Admin | path `id` | `id=1` |
| GET | `{{base_url}}/admin/users` | Admin | - | - |
| GET | `{{base_url}}/admin/users/:id` | Admin | path `id` | `id=2` |
| GET | `{{base_url}}/admin/revenue` | Admin | - | - |
| GET | `{{base_url}}/wallet/balance` | Admin | - | - |
| GET | `{{base_url}}/wallet/transactions` | Admin | - | - |
| GET | `{{base_url}}/wallet/topups` | Admin | - | - |
| POST | `{{base_url}}/wallet/topup` | Admin | raw JSON | `{"amount":50000}` |
| POST | `{{base_url}}/wallet/topups/:id/check` | Admin | path `id` | `id=1` |
| POST | `{{base_url}}/wallet/topups/:id/simulate` | Admin | path `id` | `id=1` |
| POST | `{{base_url}}/wallet/topups/:id/cancel` | Admin | path `id` | `id=1` |

Contoh mengisi form-data tambah mesin cuci di Postman:

```
Key            Type    Value
code           Text    W-01
capacity_kg    Text    5
price_per_use  Text    15000
status         Text    AVAILABLE
description    Text    Mesin cuci 5 kg
photo          File    [pilih gambar dari komputer]
```

Untuk semua field `photo`, pilih **Type = File**, bukan Text.

Untuk endpoint yang punya `:id`, tulis URL apa adanya (misalnya
`{{base_url}}/machines/washing-machines/:id`), lalu buka tab
**Params → Path Variables** dan isi `id = 1`.

Admin juga tetap bisa memakai endpoint sisi user untuk melihat
tampilan user:

- `GET {{base_url}}/products`
- `GET {{base_url}}/products/:id`
- `GET {{base_url}}/announcements`
- `GET {{base_url}}/users/me`

---

## 1. Tugas Admin Secara Garis Besar

Admin bertanggung jawab untuk:

1. Login dan logout.
2. Melihat dashboard dan omzet.
3. Membuka atau menutup toko.
4. Mengelola petugas dan status siap petugas.
5. Mengelola mesin cuci.
6. Mengelola mesin pengering.
7. Mengelola produk.
8. Mengelola pengumuman.
9. Memantau semua booking laundry.
10. Mengubah status booking.
11. Memulai laundry atas nama user.
12. Membatalkan booking.
13. Menghapus booking.
14. Melihat semua user.
15. Melihat detail user, booking, top up, dan mutasi saldo.
16. Melihat detail pemasukan laundry dan produk.

---

## 2. Auth Admin

### 2.1 Login Admin

**POST** `{{base_url}}/auth/login`

Auth: tidak perlu token.

Body JSON:

```json
{
  "email": "admin@nyucik.com",
  "password": "admin123"
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
      "id": 1,
      "full_name": "Admin Nyucik",
      "email": "admin@nyucik.com",
      "phone": "081200000001",
      "role": "ADMIN",
      "photo_url": null,
      "balance": 0
    }
  }
}
```

Simpan `data.token` ke `admin_token`.

Pastikan `data.user.role` bernilai `ADMIN`. Kalau masih `USER`,
endpoint admin akan menghasilkan `403`.

---

### 2.2 Logout Admin

**POST** `{{base_url}}/auth/logout`

Auth: Bearer `{{admin_token}}`.

Body: tidak ada.

---

## 3. Dashboard Admin

### 3.1 Ringkasan Dashboard

**GET** `{{base_url}}/admin/dashboard`

Auth: Bearer `{{admin_token}}` (ADMIN).

Response `data`:

```json
{
  "total_users": 10,
  "washing_machines_available": 3,
  "drying_machines_available": 2,
  "bookings_today": 5,
  "revenue": {
    "booking": 250000,
    "product": 75000,
    "total": 325000
  }
}
```

Arti field:

| Field                        | Arti                                             |
|------------------------------|--------------------------------------------------|
| `total_users`                | Jumlah user dengan role `USER`                   |
| `washing_machines_available` | Mesin cuci berstatus `AVAILABLE`                 |
| `drying_machines_available`  | Mesin pengering berstatus `AVAILABLE`            |
| `bookings_today`             | Booking hari ini selain `CANCELLED`              |
| `revenue.booking`            | Total laundry `CONFIRMED`, `IN_PROGRESS`, `COMPLETED` |
| `revenue.product`            | Total semua pesanan produk                       |
| `revenue.total`              | Gabungan omzet laundry dan produk                |

---

## 4. Buka / Tutup Toko

### 4.1 Lihat Status Toko

**GET** `{{base_url}}/store/status`

Auth: tidak perlu token (bisa juga pakai token admin).

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

### 4.2 Tutup Toko

**PATCH** `{{base_url}}/store/status`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body JSON:

```json
{
  "is_open": false
}
```

Response:

```json
{
  "success": true,
  "message": "Toko ditutup",
  "data": {
    "is_open": false,
    "manual_open": false,
    "has_staff": true,
    "reason": "Toko ditutup admin"
  }
}
```

### 4.3 Buka Toko

**PATCH** `{{base_url}}/store/status`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body JSON:

```json
{
  "is_open": true
}
```

Response kalau ada petugas siap:

```json
{
  "success": true,
  "message": "Toko dibuka",
  "data": {
    "is_open": true,
    "manual_open": true,
    "has_staff": true,
    "reason": null
  }
}
```

Response kalau tidak ada petugas siap:

```json
{
  "success": true,
  "message": "Toko ditutup",
  "data": {
    "is_open": false,
    "manual_open": true,
    "has_staff": false,
    "reason": "Tidak ada petugas siap"
  }
}
```

Catatan penting:

- `is_open` adalah status final.
- Toko hanya buka kalau `manual_open = true` **dan** `has_staff = true`.
- Kalau semua petugas `is_ready = 0`, toko tetap dianggap tutup.
- Saat toko tutup, user tidak bisa membuat booking atau membeli produk.

---

## 5. Kelola Petugas

Petugas memengaruhi status toko. Minimal harus ada satu petugas
dengan `is_ready = true` supaya toko bisa buka.

### 5.1 Daftar Petugas

**GET** `{{base_url}}/employees`

Auth: Bearer `{{admin_token}}`.

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

Urutan: petugas siap lebih dulu, lalu nama A–Z.

---

### 5.2 Tambah Petugas

**POST** `{{base_url}}/employees`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body JSON:

```json
{
  "name": "Andi",
  "position": "Operator",
  "phone": "081234567890",
  "is_ready": true
}
```

Aturan:

- `name` minimal 3 karakter.
- `position` minimal 3 karakter.
- `phone` opsional.
- `is_ready` opsional, default `true`.

Response sukses `201`:

```json
{
  "success": true,
  "message": "Pegawai berhasil ditambahkan",
  "data": {
    "id": 1,
    "name": "Andi",
    "position": "Operator",
    "phone": "081234567890",
    "is_ready": 1
  }
}
```

---

### 5.3 Ubah Petugas

**PATCH** `{{base_url}}/employees/:id`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body JSON (boleh sebagian):

```json
{
  "name": "Andi Saputra",
  "position": "Operator Senior",
  "phone": "081234567891",
  "is_ready": false
}
```

Contoh menandai petugas tidak siap:

```json
{
  "is_ready": false
}
```

Kalau semua petugas tidak siap, toko otomatis tutup.

---

### 5.4 Hapus Petugas

**DELETE** `{{base_url}}/employees/:id`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body: tidak ada.

Response:

```json
{
  "success": true,
  "message": "Pegawai berhasil dihapus",
  "data": null
}
```

---

## 6. Kelola Mesin Cuci

### 6.1 Daftar Mesin Cuci

**GET** `{{base_url}}/machines/washing-machines`

Auth: Bearer `{{admin_token}}`.

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

---

### 6.2 Detail Mesin Cuci

**GET** `{{base_url}}/machines/washing-machines/:id`

Auth: Bearer `{{admin_token}}`.

---

### 6.3 Tambah Mesin Cuci

**POST** `{{base_url}}/machines/washing-machines`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body: **form-data**.

| Field          | Tipe | Wajib | Keterangan                              |
|----------------|------|-------|-----------------------------------------|
| `code`         | Text | Ya    | Kode unik mesin, contoh `W-01`          |
| `capacity_kg`  | Text | Ya    | Angka bulat positif                     |
| `price_per_use`| Text | Ya    | Angka positif                           |
| `status`       | Text | Tidak | Default `AVAILABLE`                     |
| `description`  | Text | Tidak | Deskripsi mesin                         |
| `photo`        | File | Tidak | JPG/PNG/WEBP, maksimal 3 MB             |

Contoh:

```
code          : W-01
capacity_kg   : 5
price_per_use : 15000
status        : AVAILABLE
description   : Mesin cuci 5 kg
photo         : [pilih file gambar]
```

Status yang valid:

- `AVAILABLE`
- `BOOKED`
- `IN_USE`
- `MAINTENANCE`

Response sukses `201` berisi data mesin yang baru dibuat.

Kalau kode sudah dipakai (`409`):

```json
{
  "success": false,
  "message": "Kode mesin W-01 sudah dipakai"
}
```

---

### 6.4 Ubah Mesin Cuci

**PATCH** `{{base_url}}/machines/washing-machines/:id`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body: **form-data**, boleh sebagian.

Field yang bisa diubah:

- `code`
- `capacity_kg`
- `price_per_use`
- `status`
- `description`
- `photo`

Contoh:

```
price_per_use : 20000
description   : Harga baru
```

Kalau tidak ada field yang diisi (`400`):

```json
{
  "success": false,
  "message": "Tidak ada data yang diubah"
}
```

---

### 6.5 Ubah Status Mesin Cuci

**PATCH** `{{base_url}}/machines/washing-machines/:id/status`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body JSON:

```json
{
  "status": "MAINTENANCE"
}
```

Response:

```json
{
  "success": true,
  "message": "Status mesin cuci diperbarui",
  "data": {
    "id": 1,
    "status": "MAINTENANCE"
  }
}
```

Gunakan endpoint ini untuk:

- Menandai mesin rusak → `MAINTENANCE`.
- Mengembalikan mesin ke → `AVAILABLE`.
- Koreksi status mesin.

---

### 6.6 Hapus Mesin Cuci

**DELETE** `{{base_url}}/machines/washing-machines/:id`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body: tidak ada.

Catatan:

- Hapus hanya kalau mesin memang tidak dipakai lagi.
- Booking lama yang memakai mesin ini akan kehilangan relasi mesin
  (`ON DELETE SET NULL`).

---

## 7. Kelola Mesin Pengering

### 7.1 Daftar Mesin Pengering

**GET** `{{base_url}}/machines/drying-machines`

Auth: Bearer `{{admin_token}}`.

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

Durasi mesin pengering selalu **25 menit** dan tidak bisa diubah
lewat request create/update.

---

### 7.2 Detail Mesin Pengering

**GET** `{{base_url}}/machines/drying-machines/:id`

Auth: Bearer `{{admin_token}}`.

---

### 7.3 Tambah Mesin Pengering

**POST** `{{base_url}}/machines/drying-machines`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body: **form-data**.

| Field           | Tipe | Wajib | Keterangan                  |
|-----------------|------|-------|-----------------------------|
| `code`          | Text | Ya    | Kode unik, contoh `D-01`    |
| `price_per_use` | Text | Ya    | Angka positif               |
| `status`        | Text | Tidak | Default `AVAILABLE`         |
| `description`   | Text | Tidak | Deskripsi mesin             |
| `photo`         | File | Tidak | JPG/PNG/WEBP, maksimal 3 MB |

Contoh:

```
code          : D-01
price_per_use : 10000
status        : AVAILABLE
description   : Pengering 25 menit
photo         : [pilih file gambar]
```

---

### 7.4 Ubah Mesin Pengering

**PATCH** `{{base_url}}/machines/drying-machines/:id`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body: **form-data**, boleh sebagian.

Field:

- `code`
- `price_per_use`
- `status`
- `description`
- `photo`

---

### 7.5 Ubah Status Mesin Pengering

**PATCH** `{{base_url}}/machines/drying-machines/:id/status`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body JSON:

```json
{
  "status": "MAINTENANCE"
}
```

---

### 7.6 Hapus Mesin Pengering

**DELETE** `{{base_url}}/machines/drying-machines/:id`

Auth: Bearer `{{admin_token}}` (ADMIN).

---

## 8. Kelola Produk

### 8.1 Semua Produk (Termasuk Nonaktif)

**GET** `{{base_url}}/products/admin/all`

Auth: Bearer `{{admin_token}}` (ADMIN).

Response berisi semua produk, termasuk `is_active = 0`.

---

### 8.2 Tambah Produk

**POST** `{{base_url}}/products`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body: **form-data**.

| Field         | Tipe | Wajib | Keterangan                         |
|---------------|------|-------|------------------------------------|
| `name`        | Text | Ya    | Minimal 3 karakter                 |
| `description` | Text | Tidak | Deskripsi produk                   |
| `price`       | Text | Ya    | Angka positif                      |
| `stock`       | Text | Ya    | Angka bulat, minimal 0             |
| `is_active`   | Text | Tidak | `true`/`false`, default `true`     |
| `photo`       | File | Tidak | JPG/PNG/WEBP, maksimal 3 MB        |

Contoh:

```
name        : Deterjen 1 kg
description : Deterjen bubuk
price       : 15000
stock       : 10
is_active   : true
photo       : [pilih file gambar]
```

Response sukses `201` berisi data produk.

---

### 8.3 Ubah Produk

**PATCH** `{{base_url}}/products/:id`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body: **form-data**, boleh sebagian.

Field:

- `name`
- `description`
- `price`
- `stock`
- `is_active`
- `photo`

Contoh menonaktifkan produk:

```
is_active : false
```

Produk nonaktif tidak muncul di katalog user.

---

### 8.4 Hapus Produk

**DELETE** `{{base_url}}/products/:id`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body: tidak ada.

Catatan:

- Riwayat pesanan lama yang terhubung ke produk ini juga akan ikut
  terhapus karena relasi `ON DELETE CASCADE`.
- Kalau ingin menyimpan riwayat, lebih aman gunakan `is_active = false`
  daripada hapus.

---

## 9. Kelola Pengumuman

### 9.1 Semua Pengumuman

**GET** `{{base_url}}/announcements/admin/all`

Auth: Bearer `{{admin_token}}` (ADMIN).

Response berisi semua pengumuman, termasuk yang nonaktif dan yang
sudah lewat tanggal.

---

### 9.2 Buat Pengumuman

**POST** `{{base_url}}/announcements`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body: **form-data**.

| Field        | Tipe | Wajib | Keterangan                          |
|--------------|------|-------|-------------------------------------|
| `title`      | Text | Ya    | Minimal 3 karakter                  |
| `content`    | Text | Ya    | Isi pengumuman                      |
| `start_date` | Text | Ya    | Format `YYYY-MM-DD`                 |
| `end_date`   | Text | Ya    | Format `YYYY-MM-DD`                 |
| `is_active`  | Text | Tidak | `true`/`false`, default `true`      |
| `photo`      | File | Tidak | JPG/PNG/WEBP, maksimal 3 MB         |

Contoh:

```
title      : Promo Cuci
content    : Diskon 10% hari ini.
start_date : 2026-11-22
end_date   : 2026-11-30
is_active  : true
photo      : [pilih file gambar]
```

Aturan:

- `end_date` harus sama atau setelah `start_date`.
- Pengumuman hanya tampil ke user kalau `is_active = true` dan
  hari ini berada di antara `start_date` dan `end_date`.

---

### 9.3 Ubah Pengumuman

**PATCH** `{{base_url}}/announcements/:id`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body: **form-data**, boleh sebagian.

Field:

- `title`
- `content`
- `start_date`
- `end_date`
- `is_active`
- `photo`

Contoh menonaktifkan:

```
is_active : false
```

---

### 9.4 Hapus Pengumuman

**DELETE** `{{base_url}}/announcements/:id`

Auth: Bearer `{{admin_token}}` (ADMIN).

---

## 10. Kelola Booking Laundry

### 10.1 Semua Booking

**GET** `{{base_url}}/bookings`

Auth: Bearer `{{admin_token}}` (ADMIN).

Response `data` berisi semua booking dari semua user, lengkap dengan
`full_name` dan `email` user.

---

### 10.2 Detail Booking

**GET** `{{base_url}}/bookings/:id`

Auth: Bearer `{{admin_token}}` (ADMIN).

Admin bisa melihat booking milik user mana pun.

---

### 10.3 Batalkan Booking

**POST** `{{base_url}}/bookings/:id/cancel`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body: tidak ada.

Aturan:

- Status harus `PENDING` atau `CONFIRMED`.
- Kalau sudah dibayar, saldo user otomatis dikembalikan.
- Status menjadi `CANCELLED`.
- Mesin kembali `AVAILABLE`.

Response:

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

### 10.4 Mulai Laundry atas Nama User

**POST** `{{base_url}}/bookings/:id/start`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body: **form-data**.

| Field   | Tipe | Wajib | Keterangan                        |
|---------|------|-------|-----------------------------------|
| `photo` | File | Ya    | Foto cucian saat mulai dimasukkan |

Aturan:

- Status booking harus `CONFIRMED`.
- Status menjadi `IN_PROGRESS`.
- Mesin menjadi `IN_USE`.
- Durasi 25 menit.

---

### 10.5 Ubah Status Booking

**PATCH** `{{base_url}}/bookings/:id/status`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body JSON:

```json
{
  "status": "COMPLETED"
}
```

Status yang valid:

- `PENDING`
- `CONFIRMED`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`

Efek samping:

| Status baru    | Efek                                            |
|----------------|-------------------------------------------------|
| `IN_PROGRESS`  | `started_at` diisi kalau belum ada, mesin `IN_USE` |
| `COMPLETED`    | `finished_at` diisi, mesin `AVAILABLE`          |
| `CANCELLED`    | Mesin `AVAILABLE`                               |

Catatan:

- Endpoint ini tidak otomatis refund.
- Refund hanya terjadi lewat `POST /bookings/:id/cancel` (status `PENDING`/`CONFIRMED`) atau `DELETE /bookings/:id` saat status masih `CONFIRMED`.

---

### 10.6 Hapus Booking

**DELETE** `{{base_url}}/bookings/:id`

Auth: Bearer `{{admin_token}}` (ADMIN).

Body: tidak ada.

Aturan:

- Booking dihapus permanen.
- Kalau status booking `CONFIRMED` (sudah dibayar), saldo user otomatis dikembalikan.
- Booking berstatus `IN_PROGRESS` atau `COMPLETED` tidak direfund.
- Mesin kembali `AVAILABLE`.

Response:

```json
{
  "success": true,
  "message": "Laundry berhasil dihapus permanen oleh admin",
  "data": {
    "booking_id": 1,
    "deleted": true,
    "refunded": 15000
  }
}
```

---

### 10.7 Catatan Pembayaran Booking

Admin **tidak bisa** membayar booking milik user lewat
`POST /bookings/:id/pay`, karena endpoint itu hanya untuk pemilik
booking. Kalau perlu menyelesaikan pembayaran, minta user membayar
dari aplikasi, atau gunakan alur operasional yang sudah disepakati.

---

## 11. Kelola User

### 11.1 Daftar Semua User

**GET** `{{base_url}}/admin/users`

Auth: Bearer `{{admin_token}}` (ADMIN).

Response `data`:

```json
[
  {
    "id": 2,
    "full_name": "Budi User",
    "email": "user@nyucik.com",
    "phone": "081200000002",
    "role": "USER",
    "is_verified": 1,
    "photo_url": null,
    "balance": 100000,
    "created_at": "2026-11-22T10:00:00.000Z"
  }
]
```

---

### 11.2 Detail User

**GET** `{{base_url}}/admin/users/:id`

Auth: Bearer `{{admin_token}}` (ADMIN).

Response `data`:

```json
{
  "user": {
    "id": 2,
    "full_name": "Budi User",
    "email": "user@nyucik.com",
    "phone": "081200000002",
    "role": "USER",
    "is_verified": 1,
    "photo_url": null,
    "balance": 100000,
    "created_at": "2026-11-22T10:00:00.000Z"
  },
  "bookings": [],
  "topUps": [],
  "transactions": []
}
```

Isi tambahan:

| Field          | Arti                                      |
|----------------|-------------------------------------------|
| `bookings`     | Semua booking user                        |
| `topUps`       | Semua riwayat top up user                 |
| `transactions` | Semua mutasi saldo user                   |

Gunakan endpoint ini untuk:

- Memeriksa saldo user.
- Memeriksa top up yang sudah/ belum dibayar.
- Memeriksa riwayat pemotongan saldo.
- Memeriksa status booking user.

---

## 12. Omzet / Pemasukan

### 12.1 Detail Omzet

**GET** `{{base_url}}/admin/revenue`

Auth: Bearer `{{admin_token}}` (ADMIN).

Response `data`:

```json
{
  "bookings": [
    {
      "id": 1,
      "machine_type": "WASHING",
      "total_price": 15000,
      "status": "CONFIRMED",
      "created_at": "2026-11-22T10:00:00.000Z",
      "full_name": "Budi User",
      "washing_code": "W-01",
      "drying_code": null,
      "machine_code": "W-01"
    }
  ],
  "products": [
    {
      "id": 1,
      "product_name": "Deterjen 1 kg",
      "quantity": 2,
      "total_price": 30000,
      "status": "PENDING",
      "created_at": "2026-11-22T10:00:00.000Z",
      "full_name": "Budi User"
    }
  ]
}
```

Catatan:

- `bookings` hanya berisi status `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`.
- `products` berisi semua pesanan produk.

---

## 13. Wallet Admin (Opsional)

Endpoint wallet tetap bisa dipakai admin untuk akun admin sendiri.

### 13.1 Saldo Admin

**GET** `{{base_url}}/wallet/balance`

Auth: Bearer `{{admin_token}}`.

### 13.2 Mutasi Saldo Admin

**GET** `{{base_url}}/wallet/transactions`

Auth: Bearer `{{admin_token}}`.

### 13.3 Riwayat Top Up Admin

**GET** `{{base_url}}/wallet/topups`

Auth: Bearer `{{admin_token}}`.

### 13.4 Top Up Saldo Admin

**POST** `{{base_url}}/wallet/topup`

Auth: Bearer `{{admin_token}}`.

Body JSON:

```json
{
  "amount": 50000
}
```

Endpoint cek/simulasi/batal top up sama seperti user:

- `POST /wallet/topups/:id/check`
- `POST /wallet/topups/:id/simulate`
- `POST /wallet/topups/:id/cancel`

Catatan: top up admin biasanya tidak dibutuhkan untuk tugas
operasional. Endpoint ini hanya untuk test.

---

## 14. Alur Test Admin yang Disarankan

1. Login admin, simpan `admin_token`.
2. `GET /admin/dashboard`.
3. `GET /store/status`.
4. Tambah petugas dengan `is_ready = true`.
5. `PATCH /store/status` dengan `is_open = true`.
6. Tambah mesin cuci.
7. Tambah mesin pengering.
8. Tambah produk.
9. Buat pengumuman.
10. Login sebagai user di Postman tab/collection lain.
11. User top up dan bayar booking.
12. Admin lihat `GET /bookings`.
13. Admin ubah status booking.
14. Admin lihat `GET /admin/users` dan detail user.
15. Admin lihat `GET /admin/revenue`.
16. Admin tutup toko dengan `is_open = false`.
17. Pastikan user gagal membuat booking/produk saat toko tutup.
18. Admin buka toko kembali.
19. Test hapus/ubah data yang sudah dibuat.
20. Logout admin.

---

## 15. Batasan Admin

Endpoint admin yang **tidak tersedia** di API ini:

- Membuat user baru dari dashboard admin.
- Menghapus user.
- Mengubah role user.
- Menambah/mengurangi saldo user secara langsung.
- Memverifikasi user secara manual.
- Membayar booking milik user lewat `POST /bookings/:id/pay`.

Untuk mengubah role atau saldo, lakukan langsung lewat database
(SQL) hanya kalau benar-benar diperlukan.

---

## 16. Kode Error yang Sering Muncul

| Status | Arti                                                     |
|--------|----------------------------------------------------------|
| `400`  | Body/field tidak valid                                   |
| `401`  | Token tidak ada, salah, atau kedaluwarsa                 |
| `403`  | Token valid tapi bukan admin / tidak punya akses         |
| `404`  | Data tidak ditemukan                                     |
| `409`  | Konflik: kode mesin dipakai, status tidak sesuai, dll.   |
| `500`  | Kesalahan server                                          |

Contoh `403`:

```json
{
  "success": false,
  "message": "Kamu tidak punya akses ke endpoint ini"
}
```

Contoh `401`:

```json
{
  "success": false,
  "message": "Token tidak valid atau expired"
}
```

---

## 17. Checklist Lengkap Tugas Admin

### Auth & Dashboard

- [ ] Login admin berhasil dan role `ADMIN`.
- [ ] `GET /admin/dashboard` menampilkan statistik.
- [ ] Logout berhasil.

### Toko & Petugas

- [ ] `GET /store/status` menampilkan status toko.
- [ ] Tambah petugas berhasil.
- [ ] Ubah petugas berhasil.
- [ ] Tandai petugas `is_ready = false`.
- [ ] Pastikan toko otomatis tutup saat tidak ada petugas siap.
- [ ] Tandai petugas `is_ready = true`.
- [ ] Buka toko berhasil.
- [ ] Tutup toko berhasil.
- [ ] Hapus petugas berhasil.

### Mesin Cuci

- [ ] Daftar mesin cuci tampil.
- [ ] Detail mesin cuci tampil.
- [ ] Tambah mesin cuci berhasil.
- [ ] Ubah mesin cuci berhasil.
- [ ] Ubah status mesin cuci berhasil.
- [ ] Hapus mesin cuci berhasil.
- [ ] Kode mesin duplikat ditolak `409`.

### Mesin Pengering

- [ ] Daftar mesin pengering tampil.
- [ ] Detail mesin pengering tampil.
- [ ] Tambah mesin pengering berhasil.
- [ ] Ubah mesin pengering berhasil.
- [ ] Ubah status mesin pengering berhasil.
- [ ] Hapus mesin pengering berhasil.
- [ ] Durasi mesin pengering tetap 25 menit.

### Produk

- [ ] `GET /products/admin/all` menampilkan semua produk.
- [ ] Tambah produk berhasil.
- [ ] Ubah produk berhasil.
- [ ] Nonaktifkan produk berhasil.
- [ ] Produk nonaktif tidak muncul di katalog user.
- [ ] Hapus produk berhasil.

### Pengumuman

- [ ] `GET /announcements/admin/all` menampilkan semua pengumuman.
- [ ] Buat pengumuman berhasil.
- [ ] Ubah pengumuman berhasil.
- [ ] Nonaktifkan pengumuman berhasil.
- [ ] Pengumuman aktif tampil ke user.
- [ ] Hapus pengumuman berhasil.

### Booking

- [ ] `GET /bookings` menampilkan semua booking.
- [ ] `GET /bookings/:id` menampilkan detail booking user.
- [ ] Ubah status booking berhasil.
- [ ] Mulai laundry dengan foto berhasil.
- [ ] Batalkan booking berhasil dan refund masuk.
- [ ] Hapus booking berhasil dan refund masuk.

### User & Omzet

- [ ] `GET /admin/users` menampilkan semua user.
- [ ] `GET /admin/users/:id` menampilkan booking, top up, dan mutasi saldo.
- [ ] `GET /admin/revenue` menampilkan omzet laundry dan produk.

### Wallet Admin (Opsional)

- [ ] `GET /wallet/balance` berhasil.
- [ ] `GET /wallet/transactions` berhasil.
- [ ] `GET /wallet/topups` berhasil.
- [ ] Top up admin berhasil.
