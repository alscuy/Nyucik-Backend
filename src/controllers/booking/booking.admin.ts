import { Response } from "express";
import { queryOne, pool, withTransaction } from "../../config/database";
import { success, fail } from "../../utils/response";
import { updateStatusSchema } from "../../validators";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { machineInfo, refundBooking } from "../../services/booking.service";

export const updateBookingStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = updateStatusSchema.parse(req.body);
    const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
    if (!booking) return fail(res, "Laundry tidak ditemukan", 404);

    const { col, table } = machineInfo(booking);
    const fields: string[] = ["status = ?"];
    const params: any[] = [status];
    if (status === "IN_PROGRESS" && !booking.started_at) {
      fields.push("started_at = NOW()");
    }
    if (status === "COMPLETED") {
      fields.push("finished_at = NOW()");
    }
    await pool.query(`UPDATE bookings SET ${fields.join(", ")} WHERE id = ?`, [...params, booking.id]);

    if (["COMPLETED", "CANCELLED"].includes(status)) {
      await pool.query(`UPDATE ${table} SET status = 'AVAILABLE' WHERE id = ?`, [booking[col]]);
    } else if (status === "IN_PROGRESS") {
      await pool.query(`UPDATE ${table} SET status = 'IN_USE' WHERE id = ?`, [booking[col]]);
    }
    return success(res, { booking_id: booking.id, status }, "Status laundry diperbarui");
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((issue: any) => issue.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

export const deleteBooking = async (req: AuthRequest, res: Response) => {
  const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
  if (!booking) return fail(res, "Laundry tidak ditemukan", 404);

  const { col, table } = machineInfo(booking);
  const data = await withTransaction(async (conn) => {
    const refund = await refundBooking(conn, booking, `Refund hapus laundry #${booking.id} oleh admin`);
    await conn.query("DELETE FROM bookings WHERE id = ?", [booking.id]);
    await conn.query(`UPDATE ${table} SET status = 'AVAILABLE' WHERE id = ?`, [booking[col]]);
    return { booking_id: booking.id, deleted: true, refunded: refund };
  });

  return success(res, data, "Laundry berhasil dihapus permanen oleh admin");
};
