import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const run = async () => {
  const seedPath = path.join(__dirname, "..", "db", "seed.sql");
  const sql = fs.readFileSync(seedPath, "utf-8");

  // Connect TANPA memilih database dulu (seed.sql sudah berisi USE nyucik_db)
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl:
      process.env.DB_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
    multipleStatements: true,
  });

  try {
    await conn.query(sql);
    console.log("✅ Seed selesai! Akun testing:");
    console.log("   ADMIN -> admin@nyucik.com / admin123");
    console.log("   USER  -> user@nyucik.com  / user123");
  } catch (err) {
    console.error("❌ Seed gagal:", err);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
};

run();
