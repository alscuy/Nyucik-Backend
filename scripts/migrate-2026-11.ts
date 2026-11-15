/**
 * Migrasi sekali-jalan (2026-11):
 *  1. Tabel expenses (pengeluaran operasional) — baru.
 *  2. Durasi slot fix 25 menit: default kolom drying.duration_minutes = 25
 *     + semua nilai existing diset 25.
 * Jalankan: npx ts-node scripts/migrate-2026-11.ts
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
    await conn.query(`CREATE TABLE IF NOT EXISTS expenses (
      id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      title        VARCHAR(150) NOT NULL,
      amount       DECIMAL(14,2) NOT NULL,
      expense_date DATE NOT NULL,
      description  TEXT NULL,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await conn.query(
      "ALTER TABLE drying_machines MODIFY duration_minutes INT NOT NULL DEFAULT 25"
    );
    const [res]: any = await conn.query(
      "UPDATE drying_machines SET duration_minutes = 25"
    );
    console.log("✅ Migrasi sukses. Baris pengering di-set 25 menit:", res.affectedRows);
  } finally {
    await conn.end();
  }
};

run().catch((e) => {
  console.error("❌ Migrasi gagal:", e);
  process.exitCode = 1;
});
