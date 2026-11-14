import { Response } from "express";
import { query, queryOne, todayWib } from "../config/database";
import { success } from "../utils/response";
import { notFound } from "../utils/httpError";
import { AuthRequest } from "../middlewares/auth.middleware";

/** GET /api/v1/admin/dashboard (admin) */
export const dashboard = async (_req: AuthRequest, res: Response) => {
  const today = todayWib();
  const [users]: any[] = await query("SELECT COUNT(*) AS total FROM users WHERE role = 'USER'");
  const [machinesAvail]: any[] = await query("SELECT COUNT(*) AS total FROM washing_machines WHERE status = 'AVAILABLE'");
  const [dryersAvail]: any[] = await query("SELECT COUNT(*) AS total FROM drying_machines WHERE status = 'AVAILABLE'");
  const [bookingsToday]: any[] = await query("SELECT COUNT(*) AS total FROM bookings WHERE booking_date = ? AND status <> 'CANCELLED'", [today]);
  const [revenueBooking]: any[] = await query("SELECT COALESCE(SUM(total_price), 0) AS total FROM bookings WHERE status IN ('CONFIRMED','IN_PROGRESS','COMPLETED')");
  const [revenueProduct]: any[] = await query("SELECT COALESCE(SUM(total_price), 0) AS total FROM product_orders");

  return success(res, {
    total_users: Number(users.total),
    washing_machines_available: Number(machinesAvail.total),
    drying_machines_available: Number(dryersAvail.total),
    bookings_today: Number(bookingsToday.total),
    revenue: {
      booking: Number(revenueBooking.total),
      product: Number(revenueProduct.total),
      total: Number(revenueBooking.total) + Number(revenueProduct.total),
    },
  }, "Dashboard berhasil diambil");
};

/** GET /api/v1/admin/users (admin) */
export const listUsers = async (_req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT id, full_name, email, phone, role, is_verified, photo_url, balance, created_at
     FROM users ORDER BY created_at DESC`
  );
  rows.forEach((r: any) => { r.balance = Number(r.balance); });
  return success(res, rows, "Data semua user berhasil diambil");
};

/** GET /api/v1/admin/transactions (admin) - semua perubahan saldo */
export const listTransactions = async (_req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT wt.*, u.full_name, u.email
     FROM wallet_transactions wt JOIN users u ON u.id = wt.user_id
     ORDER BY wt.created_at DESC`
  );
  rows.forEach((r: any) => {
    r.amount = Number(r.amount);
    r.balance_before = Number(r.balance_before);
    r.balance_after = Number(r.balance_after);
  });
  return success(res, rows, "Semua transaksi berhasil diambil");
};

/** GET /api/v1/admin/payments (admin) - riwayat pembayaran top up DANA */
export const listPayments = async (_req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT t.*, u.full_name, u.email
     FROM top_ups t JOIN users u ON u.id = t.user_id
     ORDER BY t.created_at DESC`
  );
  rows.forEach((r: any) => { r.amount = Number(r.amount); });
  return success(res, rows, "Riwayat pembayaran berhasil diambil");
};

/** GET /api/v1/admin/revenue (admin) - laporan pendapatan per bulan */
export const revenueReport = async (_req: AuthRequest, res: Response) => {
  const bookingRevenue = await query(
    `SELECT DATE_FORMAT(paid_at, '%Y-%m') AS month, SUM(total_price) AS booking_revenue, COUNT(*) AS bookings
     FROM bookings WHERE status IN ('CONFIRMED','IN_PROGRESS','COMPLETED') AND paid_at IS NOT NULL
     GROUP BY DATE_FORMAT(paid_at, '%Y-%m') ORDER BY month DESC`
  );
  const productRevenue = await query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(total_price) AS product_revenue, COUNT(*) AS orders
     FROM product_orders GROUP BY DATE_FORMAT(created_at, '%Y-%m') ORDER BY month DESC`
  );
  return success(res, { booking: bookingRevenue, product: productRevenue }, "Laporan pendapatan berhasil diambil");
};

/** GET /api/v1/admin/users/:id (admin) - profil + log user: booking (udh bayar/blm), topup, transaksi saldo */
export const getUserDetail = async (req: AuthRequest, res: Response) => {
  const user: any = await queryOne(
    `SELECT id, full_name, email, phone, role, is_verified, photo_url, balance, created_at
     FROM users WHERE id = ?`,
    [req.params.id]
  );
  if (!user) return notFound("User tidak ditemukan");
  user.balance = Number(user.balance);

  const bookings = await query(
    `SELECT b.id, b.machine_type, w.code AS washing_code, d.code AS drying_code,
            b.booking_date, b.start_time, b.total_price, b.status, b.paid_at, b.created_at
     FROM bookings b
     LEFT JOIN washing_machines w ON w.id = b.washing_machine_id
     LEFT JOIN drying_machines d ON d.id = b.drying_machine_id
     WHERE b.user_id = ? ORDER BY b.created_at DESC`,
    [req.params.id]
  );
  bookings.forEach((b: any) => {
    b.total_price = Number(b.total_price);
    b.is_paid = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(b.status) && b.paid_at !== null;
  });

  const topups = await query(
    "SELECT id, reference, amount, status, paid_at, created_at FROM top_ups WHERE user_id = ? ORDER BY created_at DESC",
    [req.params.id]
  );
  topups.forEach((t: any) => { t.amount = Number(t.amount); });

  const transactions = await query(
    "SELECT id, type, amount, balance_before, balance_after, description, created_at FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC",
    [req.params.id]
  );
  transactions.forEach((t: any) => {
    t.amount = Number(t.amount);
    t.balance_before = Number(t.balance_before);
    t.balance_after = Number(t.balance_after);
  });

  return success(res, { user, bookings, topups, transactions }, "Detail user berhasil diambil");
};

/** GET /api/v1/admin/revenue/daily (admin) - log terjual/terpakai hari ini (IDR) */
export const dailyReport = async (req: AuthRequest, res: Response) => {
  const date = (req.query.date as string) || todayWib();

  const bookingToday: any = await queryOne(
    `SELECT COUNT(*) AS count, COALESCE(SUM(total_price), 0) AS revenue
     FROM bookings
     WHERE booking_date = ? AND status IN ('CONFIRMED','IN_PROGRESS','COMPLETED')`,
    [date]
  );
  const productToday: any = await queryOne(
    `SELECT COUNT(*) AS count, COALESCE(SUM(total_price), 0) AS revenue
     FROM product_orders WHERE DATE(created_at) = ?`,
    [date]
  );
  const topupToday: any = await queryOne(
    `SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
     FROM top_ups WHERE status = 'PAID' AND DATE(paid_at) = ?`,
    [date]
  );

  const detailBooking = await query(
    `SELECT b.id, u.full_name, b.machine_type, w.code AS washing_code, d.code AS drying_code,
            b.total_price, b.status, b.paid_at
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     LEFT JOIN washing_machines w ON w.id = b.washing_machine_id
     LEFT JOIN drying_machines d ON d.id = b.drying_machine_id
     WHERE b.booking_date = ? AND b.status IN ('CONFIRMED','IN_PROGRESS','COMPLETED')
     ORDER BY b.paid_at DESC`,
    [date]
  );
  const detailProduct = await query(
    `SELECT po.id, u.full_name, p.name AS product_name, po.quantity, po.total_price, po.created_at
     FROM product_orders po
     JOIN users u ON u.id = po.user_id
     JOIN products p ON p.id = po.product_id
     WHERE DATE(po.created_at) = ?
     ORDER BY po.created_at DESC`,
    [date]
  );

  const bookingRevenue = Number(bookingToday.revenue);
  const productRevenue = Number(productToday.revenue);
  return success(res, {
    date,
    booking: { count: Number(bookingToday.count), revenue: bookingRevenue, items: detailBooking },
    product: { count: Number(productToday.count), revenue: productRevenue, items: detailProduct },
    topup_approved: { count: Number(topupToday.count), total: Number(topupToday.total) },
    total_revenue: bookingRevenue + productRevenue,
  }, "Laporan harian berhasil diambil");
};
