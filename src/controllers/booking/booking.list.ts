import { Response } from "express";
import { query, queryOne } from "../../config/database";
import { success, fail } from "../../utils/response";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { finishDueLaundry } from "../../services/booking.service";

const SELECT_BOOKING = `SELECT b.*, w.code AS washing_code, d.code AS drying_code
  FROM bookings b
  LEFT JOIN washing_machines w ON w.id = b.washing_machine_id
  LEFT JOIN drying_machines d ON d.id = b.drying_machine_id`;

export const getMyBookings = async (req: AuthRequest, res: Response) => {
  await finishDueLaundry();
  const rows = await query(
    `${SELECT_BOOKING} WHERE b.user_id = ? ORDER BY b.created_at DESC`,
    [req.user!.id]
  );
  rows.forEach((row: any) => {
    row.total_price = Number(row.total_price);
  });
  return success(res, rows, "Riwayat laundry berhasil diambil");
};

export const getBookingDetail = async (req: AuthRequest, res: Response) => {
  await finishDueLaundry();
  const booking: any = await queryOne(
    `SELECT b.*, u.full_name, u.phone FROM bookings b JOIN users u ON u.id = b.user_id WHERE b.id = ?`,
    [req.params.id]
  );
  if (!booking) return fail(res, "Laundry tidak ditemukan", 404);
  if (booking.user_id !== req.user!.id && req.user!.role !== "ADMIN") {
    return fail(res, "Laundry ini bukan milikmu", 403);
  }
  booking.total_price = Number(booking.total_price);
  return success(res, booking, "Detail laundry berhasil diambil");
};

export const getAllBookings = async (_req: AuthRequest, res: Response) => {
  await finishDueLaundry();
  const rows = await query(
    `SELECT b.*, u.full_name, u.email FROM bookings b JOIN users u ON u.id = b.user_id
     ORDER BY b.created_at DESC`
  );
  rows.forEach((row: any) => {
    row.total_price = Number(row.total_price);
  });
  return success(res, rows, "Semua laundry berhasil diambil");
};
