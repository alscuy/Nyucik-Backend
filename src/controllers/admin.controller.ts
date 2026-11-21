import { Response } from "express";
import { query, queryOne, todayWib } from "../config/database";
import { success, fail } from "../utils/response";
import { AuthRequest } from "../middlewares/auth.middleware";

export const dashboard = async (_req: AuthRequest, res: Response) => {
  const today = todayWib();
  const [users]: any[] = await query("SELECT COUNT(*) AS total FROM users WHERE role = 'USER'");
  const [machinesAvail]: any[] = await query(
    "SELECT COUNT(*) AS total FROM washing_machines WHERE status = 'AVAILABLE'"
  );
  const [dryersAvail]: any[] = await query(
    "SELECT COUNT(*) AS total FROM drying_machines WHERE status = 'AVAILABLE'"
  );
  const [bookingsToday]: any[] = await query(
    "SELECT COUNT(*) AS total FROM bookings WHERE booking_date = ? AND status <> 'CANCELLED'",
    [today]
  );
  const [revenueBooking]: any[] = await query(
    "SELECT COALESCE(SUM(total_price), 0) AS total FROM bookings WHERE status IN ('CONFIRMED','IN_PROGRESS','COMPLETED')"
  );
  const [revenueProduct]: any[] = await query(
    "SELECT COALESCE(SUM(total_price), 0) AS total FROM product_orders"
  );

  const booking = Number(revenueBooking.total);
  const product = Number(revenueProduct.total);

  return success(
    res,
    {
      total_users: Number(users.total),
      washing_machines_available: Number(machinesAvail.total),
      drying_machines_available: Number(dryersAvail.total),
      bookings_today: Number(bookingsToday.total),
      revenue: { booking, product, total: booking + product },
    },
    "Dashboard berhasil diambil"
  );
};

export const listUsers = async (_req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT id, full_name, email, phone, role, is_verified, photo_url, balance, created_at
     FROM users ORDER BY created_at DESC`
  );
  rows.forEach((row: any) => {
    row.balance = Number(row.balance);
  });
  return success(res, rows, "Data semua user berhasil diambil");
};

export const getUserDetail = async (req: AuthRequest, res: Response) => {
  const user: any = await queryOne(
    `SELECT id, full_name, email, phone, role, is_verified, photo_url, balance, created_at
     FROM users WHERE id = ?`,
    [req.params.id]
  );
  if (!user) return fail(res, "User tidak ditemukan", 404);
  user.balance = Number(user.balance);

  const bookings = await query(
    `SELECT b.id, b.machine_type, w.code AS washing_code, d.code AS drying_code,
            b.booking_date, b.start_time, b.total_price, b.status, b.paid_at, b.started_at,
            b.finished_at, b.created_at
     FROM bookings b
     LEFT JOIN washing_machines w ON w.id = b.washing_machine_id
     LEFT JOIN drying_machines d ON d.id = b.drying_machine_id
     WHERE b.user_id = ? ORDER BY b.created_at DESC`,
    [req.params.id]
  );
  bookings.forEach((booking: any) => {
    booking.total_price = Number(booking.total_price);
    booking.is_paid =
      ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(booking.status) && booking.paid_at !== null;
  });

  const topUpRows = await query(
    "SELECT id, reference, amount, status, paid_at, created_at FROM top_ups WHERE user_id = ? ORDER BY created_at DESC",
    [req.params.id]
  );
  topUpRows.forEach((topUp: any) => {
    topUp.amount = Number(topUp.amount);
  });

  const transactions = await query(
    "SELECT id, type, amount, balance_before, balance_after, description, created_at FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC",
    [req.params.id]
  );
  transactions.forEach((transaction: any) => {
    transaction.amount = Number(transaction.amount);
    transaction.balance_before = Number(transaction.balance_before);
    transaction.balance_after = Number(transaction.balance_after);
  });

  return success(res, { user, bookings, topUps: topUpRows, transactions }, "Detail user berhasil diambil");
};

/// Daftar pemasukan (laundry + produk) untuk halaman detail omzet.
export const revenueDetail = async (_req: AuthRequest, res: Response) => {
  const bookings = await query(
    `SELECT b.id, b.machine_type, b.total_price, b.status, b.created_at,
            u.full_name, w.code AS washing_code, d.code AS drying_code
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     LEFT JOIN washing_machines w ON w.id = b.washing_machine_id
     LEFT JOIN drying_machines d ON d.id = b.drying_machine_id
     WHERE b.status IN ('CONFIRMED','IN_PROGRESS','COMPLETED')
     ORDER BY b.created_at DESC`
  );
  bookings.forEach((booking: any) => {
    booking.total_price = Number(booking.total_price);
    booking.machine_code = booking.washing_code ?? booking.drying_code ?? "-";
  });

  const products = await query(
    `SELECT po.id, p.name AS product_name, po.quantity, po.total_price, po.status, po.created_at,
            u.full_name
     FROM product_orders po
     JOIN products p ON p.id = po.product_id
     JOIN users u ON u.id = po.user_id
     ORDER BY po.created_at DESC`
  );
  products.forEach((product: any) => {
    product.total_price = Number(product.total_price);
  });

  return success(res, { bookings, products }, "Detail omzet berhasil diambil");
};
