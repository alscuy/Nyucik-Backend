import { Response } from "express";
import { query, todayWib } from "../../config/database";
import { success } from "../../utils/response";
import { AuthRequest } from "../../middlewares/auth.middleware";

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
      revenue: {
        booking,
        product,
        total: booking + product,
      },
    },
    "Dashboard berhasil diambil"
  );
};
