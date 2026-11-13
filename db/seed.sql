-- ============================================================
-- NYUCIK - Seed Data
-- Jalankan: npm run seed (harus setelah migrate)
-- Akun testing:
--   ADMIN -> admin@nyucik.com / admin123
--   USER  -> user@nyucik.com  / user123
-- ============================================================

USE nyucik_db;

-- USERS (password sudah di-hash bcrypt)
INSERT INTO users (full_name, email, phone, password, role, is_verified, balance)
VALUES
  ('Admin Nyucik',  'admin@nyucik.com', '081200000001', '$2a$10$hUjEKSCg22mBT0N5X6qT7OgNTeEWLEFWSrxO8ui8szm7dz02mt3H2', 'ADMIN', 1, 0.00),
  ('Budi User',     'user@nyucik.com',  '081200000002', '$2a$10$maaPb2iVyQpll5f2cGqQwu5s7H2wb0X6cKMgeg8BzOvpwp9Qo9lG2', 'USER',  1, 100000.00)
ON DUPLICATE KEY UPDATE email = VALUES(email);

-- WASHING MACHINES, DRYING MACHINES & PRODUCTS
-- (sengaja kosong: data mesin & produk ditambahkan sendiri lewat dashboard admin)
--   Mesin cuci    : POST /api/v1/machines/washing-machines  (admin)
--   Mesin pengering: POST /api/v1/machines/drying-machines  (admin)
--   Produk        : POST /api/v1/products                   (admin)
-- Harga rekomendasi: mesin 10kg -> Rp1.500/kg | mesin 15kg -> Rp1.000/kg

-- ANNOUNCEMENTS
INSERT INTO announcements (title, content, start_date, end_date, is_active)
VALUES
  ('Promo Cuci 10 kg Hemat', 'Cuci 10 kg penuh pakai mesin A1-A5 dan dapatkan potongan harga spesial minggu ini!', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 1),
  ('Mesin A5 Sedang Perbaikan', 'Mohon maaf, mesin cuci A5 sedang dalam perbaikan. Gunakan mesin lain yang tersedia.', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 14 DAY), 1)
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- EMPLOYEES
INSERT INTO employees (name, position, phone, is_ready)
VALUES
  ('Siti Rahma', 'Operator Laundry', '081211100001', 1),
  ('Andi Pratama', 'Helper Cuci', '081211100002', 1),
  ('Joko Susilo', 'Helper Kering', '081211100003', 0)
ON DUPLICATE KEY UPDATE name = VALUES(name);
