import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const sslConfig =
  process.env.DB_SSL === "true"
    ? { rejectUnauthorized: false }
    : undefined;

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: sslConfig,
  decimalNumbers: true,
  // Semua DATE/DATETIME/TIME keluar sebagai string & ditulis pakai zona WIB
  // (MySQL Aiven pakai UTC, jadi dipaksa +07:00 biar gak selisih 7 jam)
  dateStrings: true,
  timezone: "+07:00",
});

export const testConnection = async () => {
  try {
    const conn = await pool.getConnection();
    console.log("✅ Database connected (nyucik)");
    conn.release();
  } catch (err) {
    console.error("❌ Database connection failed:", err);
    process.exit(1);
  }
};

/** Jalankan query biasa, return rows */
export const query = async (sql: string, params?: unknown[]): Promise<any[]> => {
  const [rows] = await pool.query(sql, params);
  return rows as any[];
};

/** Ambil 1 row atau null */
export const queryOne = async (
  sql: string,
  params?: unknown[]
): Promise<any | null> => {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
};

/** Ubah string DATETIME MySQL ("2026-11-13 21:40:00") jadi Date zona WIB */
export const parseWib = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  return new Date(`${String(value).replace(" ", "T")}+07:00`);
};

/** Tanggal hari ini versi WIB, format YYYY-MM-DD */
export const todayWib = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

/** Database transaction: rollback otomatis kalau ada error */
export const withTransaction = async <T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
