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

-- WASHING MACHINES (A1-A5: 10kg max Rp1.500/kg | A6-A10: 15kg max Rp1.000/kg)
INSERT INTO washing_machines (code, capacity_kg, price_per_kg, status, description)
VALUES
  ('A1', 10, 1500, 'AVAILABLE', 'Mesin cuci kapasitas maksimal 10 kg'),
  ('A2', 10, 1500, 'AVAILABLE', 'Mesin cuci kapasitas maksimal 10 kg'),
  ('A3', 10, 1500, 'AVAILABLE', 'Mesin cuci kapasitas maksimal 10 kg'),
  ('A4', 10, 1500, 'AVAILABLE', 'Mesin cuci kapasitas maksimal 10 kg'),
  ('A5', 10, 1500, 'MAINTENANCE', 'Mesin cuci kapasitas maksimal 10 kg - sedang perbaikan'),
  ('A6', 15, 1000, 'AVAILABLE', 'Mesin cuci kapasitas maksimal 15 kg'),
  ('A7', 15, 1000, 'AVAILABLE', 'Mesin cuci kapasitas maksimal 15 kg'),
  ('A8', 15, 1000, 'AVAILABLE', 'Mesin cuci kapasitas maksimal 15 kg'),
  ('A9', 15, 1000, 'AVAILABLE', 'Mesin cuci kapasitas maksimal 15 kg'),
  ('A10', 15, 1000, 'AVAILABLE', 'Mesin cuci kapasitas maksimal 15 kg')
ON DUPLICATE KEY UPDATE code = VALUES(code);

-- DRYING MACHINES (B1-B10)
INSERT INTO drying_machines (code, price_per_use, duration_minutes, status, description)
VALUES
  ('B1', 3000, 60, 'AVAILABLE', 'Mesin pengering 60 menit'),
  ('B2', 3000, 60, 'AVAILABLE', 'Mesin pengering 60 menit'),
  ('B3', 3000, 60, 'AVAILABLE', 'Mesin pengering 60 menit'),
  ('B4', 3000, 60, 'AVAILABLE', 'Mesin pengering 60 menit'),
  ('B5', 3000, 60, 'AVAILABLE', 'Mesin pengering 60 menit'),
  ('B6', 3000, 60, 'AVAILABLE', 'Mesin pengering 60 menit'),
  ('B7', 3000, 60, 'AVAILABLE', 'Mesin pengering 60 menit'),
  ('B8', 3000, 60, 'AVAILABLE', 'Mesin pengering 60 menit'),
  ('B9', 3000, 60, 'AVAILABLE', 'Mesin pengering 60 menit'),
  ('B10', 3000, 60, 'AVAILABLE', 'Mesin pengering 60 menit')
ON DUPLICATE KEY UPDATE code = VALUES(code);

-- PRODUCTS
INSERT INTO products (name, description, price, stock, is_active)
VALUES
  ('Deterjen Bubuk 500gr', 'Deterjen bubuk berkualitas untuk cuci mesin', 12000, 50, 1),
  ('Deterjen Cair 800ml', 'Deterjen cair antar jamur, wangi tahan lama', 18000, 40, 1),
  ('Pewangi Pakaian 500ml', 'Pewangi pakaian, bikin baju wangi seharian', 15000, 30, 1),
  ('Pelembut Pakaian 750ml', 'Softener bikin pakaian lembut dan tidak kasar', 16000, 35, 1),
  ('Sabun Cuci Tangan 250ml', 'Sabun cuci tangan untuk di laundry', 8000, 60, 1),
  ('Kantong Laundry Besar', 'Kantong untuk membawa cucian', 5000, 100, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

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
