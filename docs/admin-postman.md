# 🛠 POSTMAN TESTING — ADMIN (Nyucik)

Semua request dijalankan sebagai **ADMIN**. Login dulu pakai akun admin.

| Variable | Value |
|---|---|
| `base_url` | `http://localhost:3000/api/v1` |
| `admin_token` | (diisi setelah login admin) |

> 🔑 Akun admin: `admin@nyucik.com` / `admin123`
> ⚠️ Semua endpoint di bawah wajib Bearer `{{admin_token}}`. Kalau pakai token user biasa → **403 Endpoint ini khusus admin**.

---

## 0. LOGIN ADMIN

`POST {{base_url}}/auth/login`
```json
{ "email": "admin@nyucik.com", "password": "admin123" }
```
✅ **200** → `data.token` + `data.user.role = "ADMIN"` → simpan ke `{{admin_token}}`

🧪 **Tes 403** (pakai token USER): `GET {{base_url}}/admin/dashboard` → ❌ **403**

---

## 1. DASHBOARD & LAPORAN

### 1.1 Dashboard
`GET {{base_url}}/admin/dashboard`
✅ **200**
```json
{
  "success": true,
  "data": {
    "total_users": 2,
    "washing_machines_available": 0,
    "drying_machines_available": 0,
    "bookings_today": 0,
    "revenue": { "booking": 0, "product": 0, "total": 0 }
  }
}
```

### 1.2 Semua user
`GET {{base_url}}/admin/users`
✅ **200** → array user: full_name, email, role, is_verified, balance, photo_url

### 1.3 Semua transaksi saldo
`GET {{base_url}}/admin/transactions`
✅ **200** → array wallet_transactions + nama & email user-nya

### 1.4 Riwayat pembayaran (top up)
`GET {{base_url}}/admin/payments`
✅ **200** → array top_ups: reference, amount, status, dana_ref, paid_at

### 1.5 Laporan pendapatan per bulan
`GET {{base_url}}/admin/revenue`
✅ **200** → `{ "booking": [{ "month": "2026-11", ... }], "product": [...] }`

---

## 2. KELOLA MESIN CUCI

### 2.1 Tambah mesin cuci + FOTO (data isi sendiri lewat sini)
`POST {{base_url}}/machines/washing-machines` → Body **form-data**:

| Key | Type | Value |
|---|---|---|
| `code` | Text | `A1` |
| `capacity_kg` | Text | `10` |
| `price_per_kg` | Text | `1500` |
| `description` | Text | `Mesin cuci 10 kg` |
| `photo` | **File** | mesin-a1.jpg |

✅ **201**
```json
{
  "success": true,
  "message": "Mesin cuci berhasil ditambahkan",
  "data": { "id": 1, "code": "A1", "capacity_kg": 10, "price_per_kg": 1500,
            "status": "AVAILABLE", "photo_url": "https://res.cloudinary.com/.../nyucik/machines/....jpg" }
}
```
❌ `409 Kode mesin A1 sudah dipakai` · `400` (field kosong / harga invalid)

Contoh variasi harga: mesin 10kg → `price_per_kg = 1500` · mesin 15kg → `price_per_kg = 1000`

### 2.2 Update mesin cuci (ubah harga / foto / deskripsi)
`PATCH {{base_url}}/machines/washing-machines/1` → form-data (field bebas, kombinasi):
| Key | Type | Value |
|---|---|---|
| `price_per_kg` | Text | `2000` |
| `photo` | File | foto-baru.jpg |

✅ **200** → data mesin terupdate

### 2.3 Ganti status mesin
`PATCH {{base_url}}/machines/washing-machines/1/status`
```json
{ "status": "MAINTENANCE" }
```
✅ **200** → `{ "id": 1, "status": "MAINTENANCE" }`
❌ `400 Status mesin tidak valid` (selain AVAILABLE/BOOKED/IN_USE/MAINTENANCE)

### 2.4 Hapus mesin cuci
`DELETE {{base_url}}/machines/washing-machines/1`
✅ **200** → `Mesin cuci berhasil dihapus` / ❌ `404 Mesin cuci tidak ditemukan`

---

## 3. KELOLA MESIN PENGERING

### 3.1 Tambah mesin pengering + foto
`POST {{base_url}}/machines/drying-machines` → form-data:
| Key | Type | Value |
|---|---|---|
| `code` | Text | `B1` |
| `price_per_use` | Text | `3000` |
| `duration_minutes` | Text | `60` |
| `description` | Text | `Pengering 60 menit` |
| `photo` | **File** | mesin-b1.jpg |

✅ **201** → data mesin + photo_url

### 3.2 Update / 3.3 status / 3.4 hapus
`PATCH {{base_url}}/machines/drying-machines/:id` · `PATCH {{base_url}}/machines/drying-machines/:id/status` · `DELETE {{base_url}}/machines/drying-machines/:id`
✅ sama seperti mesin cuci

---

## 4. KELOLA PRODUK

### 4.1 Tambah produk + foto
`POST {{base_url}}/products` → form-data:
| Key | Type | Value |
|---|---|---|
| `name` | Text | `Deterjen Bubuk 500gr` |
| `price` | Text | `12000` |
| `stock` | Text | `50` |
| `description` | Text | `Deterjen bubuk berkualitas` |
| `photo` | **File** | deterjen.jpg |

✅ **201** → data produk + photo_url (folder Cloudinary: `nyucik/products`)

### 4.2 Semua produk (termasuk tidak aktif)
`GET {{base_url}}/products/admin/all`
✅ **200** → array semua produk + is_active

### 4.3 Update produk (harga / stok / foto)
`PATCH {{base_url}}/products/1` → form-data: `stock = 75` (+ `photo` File kalau mau)
✅ **200** → data terupdate

### 4.4 Hapus produk
`DELETE {{base_url}}/products/1`
✅ **200** / ❌ `404 Produk tidak ditemukan`

---

## 5. KELOLA PENGUMUMAN

### 5.1 Buat pengumuman + gambar
`POST {{base_url}}/announcements` → form-data:
| Key | Type | Value |
|---|---|---|
| `title` | Text | `Mesin A3 Sedang Rusak` |
| `content` | Text | `Mohon gunakan mesin lain sementara waktu` |
| `start_date` | Text | `2026-11-20` |
| `end_date` | Text | `2026-11-27` |
| `photo` | **File** | pengumuman.jpg |

✅ **201** → data pengumuman (folder: `nyucik/announcements`)
❌ `400 Tanggal berakhir harus sama atau setelah tanggal mulai`

### 5.2 Semua pengumuman
`GET {{base_url}}/announcements/admin/all` → ✅ **200** (termasuk yang sudah lewat tanggal / nonaktif)

### 5.3 Update / hapus
`PATCH {{base_url}}/announcements/:id` (form-data/text JSON) · `DELETE {{base_url}}/announcements/:id`
✅ **200**

---

## 6. KELOLA PEGAWAI

### 6.1 Tambah pegawai
`POST {{base_url}}/employees`
```json
{ "name": "Siti Rahma", "position": "Operator Laundry", "phone": "081211100001", "is_ready": true }
```
✅ **201** → data pegawai

### 6.2 Update (ubah status ready)
`PATCH {{base_url}}/employees/1`
```json
{ "is_ready": false }
```
✅ **200** → data pegawai

### 6.3 Hapus
`DELETE {{base_url}}/employees/1` → ✅ **200**

### 6.4 Daftar pegawai
`GET {{base_url}}/employees` → ✅ **200** (admin juga bisa lihat)

---

## 7. KELOLA BOOKING USER

### 7.1 Lihat semua booking
`GET {{base_url}}/bookings`
✅ **200** → array semua booking + nama/email user + kode mesin + foto sebelum/sampai

### 7.2 Ubah status booking
`PATCH {{base_url}}/bookings/1/status`
```json
{ "status": "COMPLETED" }
```
✅ **200** → `{ "booking_id": 1, "status": "COMPLETED" }`
→ Mesin otomatis kembali `AVAILABLE` kalau status COMPLETED/CANCELLED.
❌ `400 Status booking tidak valid`

---

## 8. SIMULASI WEBHOOK PEMBAYARAN (test top up saldo)

`POST {{base_url}}/payments/webhook` — **tanpa login**, tapi wajib signature:

**Headers:**
| Key | Value |
|---|---|
| `X-Signature` | HMAC-SHA256(rawBody, `DANA_WEBHOOK_SECRET` dari .env) |

**Body:**
```json
{ "reference": "TOPUP-XXXXXXXXXXXX", "status": "PAID", "amount": 50000 }
```
✅ **200** → `Pembayaran valid, saldo pengguna bertambah`
→ cek `GET /admin/payments`: status jadi `PAID` · saldo user bertambah · ada wallet_transaction TOPUP

❌ Hasil error yang diharapkan:
| Test | Hasil |
|---|---|
| Tanpa / salah `X-Signature` | `401 Signature webhook tidak valid` |
| `amount` ≠ nominal top up | `400 Nominal pembayaran tidak sesuai transaksi` |
| Webhook dikirim 2x | tetap `200`, saldo **gak nambah 2x** (idempotent) |
| Reference tidak ada | `404 Transaksi top up tidak ditemukan` |

Cara generate signature cepet (jalankan di terminal, sesuaikan body & secret):
```bash
node -e "const c=require('crypto');const body=JSON.stringify({reference:'TOPUP-XXXX',status:'PAID',amount:50000});console.log(body);console.log(c.createHmac('sha256','nyucik_webhook_secret_sandbox').update(body).digest('hex'));"
```
→ output baris 1 = body (paste persis di Postman raw), baris 2 = isi header `X-Signature`.

---

## ✅ CHECKLIST TESTING ADMIN

- [ ] Login admin → role ADMIN
- [ ] Endpoint admin ditolak 403 saat pakai token user
- [ ] Tambah mesin cuci + pengering + foto → masuk Cloudinary `nyucik/machines`
- [ ] Ubah harga/foto/status mesin → data DB & response ikut berubah
- [ ] Tambah produk + foto → masuk `nyucik/products`
- [ ] Buat pengumuman + gambar → masuk `nyucik/announcements`, tampil di halaman user
- [ ] Kelola pegawai (tambah / set ready / hapus)
- [ ] Lihat semua booking & ubah status → mesin balik AVAILABLE saat selesai
- [ ] Dashboard & revenue angkanya nyambung sama transaksi nyata
- [ ] Webhook: signature salah ditolak, nominal beda ditolak, 2x tetap idempotent
