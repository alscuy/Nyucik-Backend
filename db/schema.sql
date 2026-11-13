-- ============================================================
-- NYUCIK - Self Service Laundry | MySQL Aiven Schema
-- Jalankan: npm run migrate
-- ============================================================

-- ---------------- USERS ----------------
CREATE TABLE IF NOT EXISTS users (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name        VARCHAR(100) NOT NULL,
  email            VARCHAR(120) NOT NULL UNIQUE,
  phone            VARCHAR(20) NOT NULL,
  password         VARCHAR(255) NOT NULL,
  role             ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER',
  is_verified      TINYINT(1) NOT NULL DEFAULT 0,
  photo_url        VARCHAR(500) NULL,
  balance          DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  otp_hash         VARCHAR(255) NULL,
  otp_expires_at   DATETIME NULL,
  otp_attempts     INT NOT NULL DEFAULT 0,
  otp_resend_count INT NOT NULL DEFAULT 0,
  otp_last_sent_at DATETIME NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role)
);

-- ---------------- WASHING MACHINES ----------------
CREATE TABLE IF NOT EXISTS washing_machines (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(10) NOT NULL UNIQUE,
  capacity_kg  INT NOT NULL,
  price_per_kg DECIMAL(10,2) NOT NULL,
  status       ENUM('AVAILABLE','BOOKED','IN_USE','MAINTENANCE') NOT NULL DEFAULT 'AVAILABLE',
  description  TEXT NULL,
  photo_url    VARCHAR(500) NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------------- DRYING MACHINES ----------------
CREATE TABLE IF NOT EXISTS drying_machines (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code             VARCHAR(10) NOT NULL UNIQUE,
  price_per_use    DECIMAL(10,2) NOT NULL,
  duration_minutes INT NOT NULL,
  status           ENUM('AVAILABLE','BOOKED','IN_USE','MAINTENANCE') NOT NULL DEFAULT 'AVAILABLE',
  description      TEXT NULL,
  photo_url        VARCHAR(500) NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------------- PRODUCTS ----------------
CREATE TABLE IF NOT EXISTS products (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  description TEXT NULL,
  price       DECIMAL(12,2) NOT NULL,
  stock       INT NOT NULL DEFAULT 0,
  photo_url   VARCHAR(500) NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_active (is_active)
);

-- ---------------- BOOKINGS ----------------
CREATE TABLE IF NOT EXISTS bookings (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id            INT UNSIGNED NOT NULL,
  machine_type       ENUM('WASHING','DRYING') NOT NULL,
  washing_machine_id INT UNSIGNED NULL,
  drying_machine_id  INT UNSIGNED NULL,
  booking_date       DATE NOT NULL,
  start_time         TIME NOT NULL,
  end_time           TIME NOT NULL,
  weight_kg          DECIMAL(6,2) NULL,
  total_price        DECIMAL(12,2) NOT NULL,
  status             ENUM('PENDING','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  photo_before_url   VARCHAR(500) NULL,
  photo_arrived_url  VARCHAR(500) NULL,
  paid_at            DATETIME NULL,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (washing_machine_id) REFERENCES washing_machines(id) ON DELETE SET NULL,
  FOREIGN KEY (drying_machine_id) REFERENCES drying_machines(id) ON DELETE SET NULL,
  UNIQUE KEY uk_wash_slot (washing_machine_id, booking_date, start_time),
  INDEX idx_dry_slot (drying_machine_id, booking_date),
  INDEX idx_bookings_user (user_id),
  INDEX idx_bookings_date (booking_date)
);

-- ---------------- PRODUCT ORDERS ----------------
CREATE TABLE IF NOT EXISTS product_orders (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  product_id  INT UNSIGNED NOT NULL,
  quantity    INT NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_orders_user (user_id)
);

-- ---------------- ANNOUNCEMENTS ----------------
CREATE TABLE IF NOT EXISTS announcements (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title      VARCHAR(150) NOT NULL,
  content    TEXT NOT NULL,
  image_url  VARCHAR(500) NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_announcements_active (is_active, start_date, end_date)
);

-- ---------------- EMPLOYEES ----------------
CREATE TABLE IF NOT EXISTS employees (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  position   VARCHAR(60) NOT NULL,
  phone      VARCHAR(20) NULL,
  is_ready   TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------------- WALLET TRANSACTIONS ----------------
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        INT UNSIGNED NOT NULL,
  type           ENUM('TOPUP','PAYMENT','REFUND') NOT NULL,
  amount         DECIMAL(14,2) NOT NULL,
  balance_before DECIMAL(14,2) NOT NULL,
  balance_after  DECIMAL(14,2) NOT NULL,
  reference_type ENUM('TOPUP','BOOKING','PRODUCT') NOT NULL,
  reference_id   INT UNSIGNED NULL,
  description    VARCHAR(255) NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_wallet_user (user_id, created_at),
  INDEX idx_wallet_ref (reference_type, reference_id)
);

-- ---------------- TOP UPS (DANA QRIS) ----------------
CREATE TABLE IF NOT EXISTS top_ups (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  reference  VARCHAR(40) NOT NULL UNIQUE,
  amount     DECIMAL(14,2) NOT NULL,
  status     ENUM('PENDING','PAID','EXPIRED','FAILED') NOT NULL DEFAULT 'PENDING',
  qr_string  TEXT NULL,
  dana_ref   VARCHAR(100) NULL UNIQUE,
  paid_at    DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_topups_user (user_id),
  INDEX idx_topups_status (status)
);
