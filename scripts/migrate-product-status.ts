/**
 * Migrasi sekali-jalan: kolom status di product_orders (PENDING/COMPLETED).
 * Dipakai alur: beli produk -> tunjuk ke petugas -> user konfirmasi diterima.
 * Jalankan: npx ts-node scripts/migrate-product-status.ts
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const run = async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
  try {
    const [cols]: any = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_orders' AND COLUMN_NAME = 'status'`,
      [process.env.DB_NAME!]
    );
    if (cols.length === 0) {
      await conn.query(
        `ALTER TABLE product_orders
         ADD COLUMN status ENUM('PENDING','COMPLETED') NOT NULL DEFAULT 'PENDING' AFTER total_price`
      );
      // Order lama dianggap sudah selesai (fitur status baru belum ada saat itu)
      await conn.query("UPDATE product_orders SET status = 'COMPLETED' WHERE created_at < NOW() - INTERVAL 1 DAY");
      console.log("✅ Kolom status ditambahkan ke product_orders");
    } else {
      console.log("✅ Kolom status sudah ada, dilewati");
    }
  } finally {
    await conn.end();
  }
};

run().catch((e) => {
  console.error("❌ Migrasi gagal:", e);
  process.exitCode = 1;
});
