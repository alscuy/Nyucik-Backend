import { Response } from "express";
import { query } from "../config/database";
import { success } from "../utils/response";
import { AuthRequest } from "../middlewares/auth.middleware";

/** GET /api/v1/admin/dashboard (admin) */
export const dashboard = async (_req: AuthRequest, res: Response) => {
  const [users]: any[] = await query("SELECT COUNT(*) AS total FROM users WHERE role = 'USER'");
  const [machinesAvail]: any[] = await query("SELECT COUNT(*) AS total FROM washing_machines WHERE status = 'AVAILABLE'");
  const [dryersAvail]: any[] = await query("SELECT COUNT(*) AS total FROM drying_machines WHERE status = 'AVAILABLE'");
  const [bookingsToday]: any[] = await query("SELECT COUNT(*) AS total FROM bookings WHERE booking_date = CURDATE() AND status <> 'CANCELLED'");
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
