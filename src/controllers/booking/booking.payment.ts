import { Response } from "express";
import { queryOne, withTransaction } from "../../config/database";
import { success, fail } from "../../utils/response";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { machineInfo, refundBooking } from "../../services/booking.service";

export const payBooking = async (req: AuthRequest, res: Response) => {
  const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
  if (!booking) return fail(res, "Laundry tidak ditemukan", 404);
  if (booking.user_id !== req.user!.id) return fail(res, "Laundry ini bukan milikmu", 403);
  if (booking.status !== "PENDING") {
    return fail(res, `Laundry sudah berstatus ${booking.status}, tidak bisa dibayar lagi`, 409);
  }

  const { col, table } = machineInfo(booking);
  try {
    const data = await withTransaction(async (conn) => {
      const [userRows]: any = await conn.query(
        "SELECT balance FROM users WHERE id = ? FOR UPDATE",
        [req.user!.id]
      );
      const before = Number(userRows[0].balance);
      const amount = Number(booking.total_price);
      if (before < amount) {
        throw new Error(`Saldo tidak cukup. Saldo: Rp${before}, total: Rp${amount}. Top up dulu.`);
      }
      const after = before - amount;

      await conn.query("UPDATE users SET balance = ? WHERE id = ?", [after, req.user!.id]);
      await conn.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
         VALUES (?, 'PAYMENT', ?, ?, ?, 'BOOKING', ?, ?)`,
        [req.user!.id, amount, before, after, booking.id, `Bayar laundry #${booking.id}`]
      );
      await conn.query(
        "UPDATE bookings SET status = 'CONFIRMED', paid_at = NOW() WHERE id = ?",
        [booking.id]
      );
      await conn.query(`UPDATE ${table} SET status = 'BOOKED' WHERE id = ?`, [booking[col]]);

      return {
        booking_id: booking.id,
        status: "CONFIRMED",
        paid: amount,
        balance_before: before,
        balance_after: after,
      };
    });

    return success(res, data, "Laundry berhasil dibayar, siap dimulai");
  } catch (err: any) {
    if (err instanceof Error) return fail(res, err.message, 400);
    console.error(err);
    return fail(res);
  }
};

export const cancelBooking = async (req: AuthRequest, res: Response) => {
  const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
  if (!booking) return fail(res, "Laundry tidak ditemukan", 404);
  if (booking.user_id !== req.user!.id && req.user!.role !== "ADMIN") {
    return fail(res, "Laundry ini bukan milikmu", 403);
  }
  if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
    return fail(res, `Laundry berstatus ${booking.status}, tidak bisa dibatalkan`, 409);
  }

  const { col, table } = machineInfo(booking);
  const data = await withTransaction(async (conn) => {
    const refund = await refundBooking(conn, booking, `Refund pembatalan laundry #${booking.id}`);
    await conn.query("UPDATE bookings SET status = 'CANCELLED' WHERE id = ?", [booking.id]);
    await conn.query(`UPDATE ${table} SET status = 'AVAILABLE' WHERE id = ?`, [booking[col]]);
    return { booking_id: booking.id, status: "CANCELLED", refunded: refund };
  });

  return success(res, data, "Laundry berhasil dibatalkan");
};
