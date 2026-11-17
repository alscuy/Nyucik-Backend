import { Response } from "express";
import { query, queryOne, withTransaction } from "../../config/database";
import { success, fail } from "../../utils/response";
import { AuthRequest } from "../../middlewares/auth.middleware";

export const listUnpaidBookings = async (_req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT b.id, b.user_id, u.full_name, u.phone, b.machine_type,
            b.booking_date, b.start_time, b.end_time,
            b.total_price, b.status, b.created_at,
            w.code AS washing_code, d.code AS drying_code
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     LEFT JOIN washing_machines w ON w.id = b.washing_machine_id
     LEFT JOIN drying_machines d ON d.id = b.drying_machine_id
     WHERE b.status = 'PENDING'
     ORDER BY b.created_at ASC`
  );
  rows.forEach((row: any) => {
    row.total_price = Number(row.total_price);
  });
  return success(res, rows, "Laundry yang belum dibayar berhasil diambil");
};

export const acceptCashPayment = async (req: AuthRequest, res: Response) => {
  const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
  if (!booking) return fail(res, "Laundry tidak ditemukan", 404);

  const machineColumn =
    booking.machine_type === "WASHING" ? "washing_machine_id" : "drying_machine_id";
  const machineTable = booking.machine_type === "WASHING" ? "washing_machines" : "drying_machines";
  const price = Number(booking.total_price);

  if (booking.status !== "PENDING") {
    return fail(res, `Laundry sudah berstatus ${booking.status}`, 409);
  }

  try {
    await withTransaction(async (conn) => {
      const [locked]: any = await conn.query(
        "SELECT status FROM bookings WHERE id = ? FOR UPDATE",
        [booking.id]
      );
      if (locked[0].status !== "PENDING") {
        throw new Error("Laundry sudah dibayar oleh kasir lain");
      }

      await conn.query(
        "UPDATE bookings SET status = 'CONFIRMED', paid_at = NOW() WHERE id = ?",
        [booking.id]
      );
      await conn.query(`UPDATE ${machineTable} SET status = 'BOOKED' WHERE id = ?`, [booking[machineColumn]]);
      await conn.query(
        `INSERT INTO wallet_transactions
         (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
         SELECT user_id, 'PAYMENT', ?, balance, balance, 'BOOKING', ?, 'Bayar tunai di kasir'
         FROM users WHERE id = ?`,
        [price, booking.id, booking.user_id]
      );
    });
  } catch (err: any) {
    return fail(res, err?.message || "Gagal menerima pembayaran", 409);
  }

  return success(
    res,
    { booking_id: booking.id, status: "CONFIRMED", paid: price },
    "Pembayaran diterima kasir, laundry siap dimulai"
  );
};
