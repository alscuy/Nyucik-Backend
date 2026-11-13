import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const run = async () => {
  const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf-8");

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl:
      process.env.DB_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
    multipleStatements: true,
  });

  try {
    await conn.query(sql);
    console.log("✅ Migrasi selesai: semua tabel berhasil dibuat (nyucik)");
  } catch (err) {
    console.error("❌ Migrasi gagal:", err);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
};

run();
