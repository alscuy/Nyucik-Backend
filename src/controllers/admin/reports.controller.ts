import { Response } from "express";
import { query, queryOne, todayWib } from "../../config/database";
import { success } from "../../utils/response";
import { AuthRequest } from "../../middlewares/auth.middleware";

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
  return success(
    res,
    {
      date,
      booking: { count: Number(bookingToday.count), revenue: bookingRevenue, items: detailBooking },
      product: { count: Number(productToday.count), revenue: productRevenue, items: detailProduct },
      topup_approved: { count: Number(topupToday.count), total: Number(topupToday.total) },
      total_revenue: bookingRevenue + productRevenue,
    },
    "Laporan harian berhasil diambil"
  );
};
