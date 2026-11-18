import { Response } from "express";
import { queryOne, todayWib, withTransaction } from "../../config/database";
import { success, fail } from "../../utils/response";
import { uploadImage, FOLDERS } from "../../utils/cloudinary.util";
import { AuthRequest } from "../../middlewares/auth.middleware";
import {
  DURATION_MINUTES,
  addMinutesToTime,
  machineInfo,
  nowWibTime,
} from "../../services/booking.service";

export const startLaundry = async (req: AuthRequest, res: Response) => {
  const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
  if (!booking) return fail(res, "Laundry tidak ditemukan", 404);
  if (booking.user_id !== req.user!.id && req.user!.role === "USER") {
    return fail(res, "Laundry ini bukan milikmu", 403);
  }
  if (booking.status !== "CONFIRMED") {
    return fail(res, "Laundry hanya bisa dimulai setelah dibayar", 409);
  }
  if (!req.file) return fail(res, "Foto wajib diupload (field: photo)", 400);

  const image = await uploadImage(req.file.buffer, FOLDERS.photoStart);
  const startTime = nowWibTime();
  const endTime = addMinutesToTime(startTime, DURATION_MINUTES);
  const { machineColumn, table } = machineInfo(booking);

  await withTransaction(async (conn) => {
    await conn.query(
      `UPDATE bookings
       SET photo_arrived_url = ?, status = 'IN_PROGRESS', started_at = NOW(), finished_at = NULL,
           booking_date = ?, start_time = ?, end_time = ?
       WHERE id = ?`,
      [image.url, todayWib(), startTime, endTime, booking.id]
    );
    await conn.query(`UPDATE ${table} SET status = 'IN_USE' WHERE id = ?`, [booking[machineColumn]]);
  });

  return success(
    res,
    {
      booking_id: booking.id,
      photo_arrived_url: image.url,
      status: "IN_PROGRESS",
      started_at: new Date().toISOString(),
      duration_minutes: DURATION_MINUTES,
    },
    "Laundry dimulai, mesin berjalan 25 menit"
  );
};
