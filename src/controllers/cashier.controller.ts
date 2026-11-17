import { Response } from "express";
import { query, queryOne, todayWib, withTransaction } from "../config/database";
import { success, fail } from "../utils/response";
import { notFound, badRequest } from "../utils/httpError";
import { AuthRequest } from "../middlewares/auth.middleware";

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
     ORDER BY b.booking_date ASC, b.start_time ASC`
  );
  rows.forEach((r: any) => { r.total_price = Number(r.total_price); });
  return success(res, rows, "Booking yang belum dibayar berhasil diambil");
};

export const acceptCashPayment = async (req: AuthRequest, res: Response) => {
  const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
  if (!booking) return notFound("Booking tidak ditemukan");

  const col = booking.machine_type === "WASHING" ? "washing_machine_id" : "drying_machine_id";
  const machineTable = booking.machine_type === "WASHING" ? "washing_machines" : "drying_machines";

  const price = Number(booking.total_price);
  if (booking.status !== "PENDING") {
    return fail(res, `Booking sudah berstatus ${booking.status}`, 409);
  }

  await withTransaction(async (conn) => {
    const [locked]: any = await conn.query(
      "SELECT status FROM bookings WHERE id = ? FOR UPDATE", [booking.id]);
    if (locked[0].status !== "PENDING") {
      throw badRequest("Booking sudah dibayar oleh kasir lain");
    }

    await conn.query(
      "UPDATE bookings SET status = 'CONFIRMED', paid_at = NOW() WHERE id = ?", [booking.id]);
    await conn.query(
      `UPDATE ${machineTable} SET status = 'BOOKED' WHERE id = ?`, [booking[col]]);

    await conn.query(
      `INSERT INTO wallet_transactions
       (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
       SELECT user_id, 'PAYMENT', ?, balance, balance, 'BOOKING', ?, 'Bayar tunai di kasir'
       FROM users WHERE id = ?`,
      [price, booking.id, booking.user_id]);
  });

  return success(res, { booking_id: booking.id, status: "CONFIRMED", paid: price },
    "Pembayaran diterima kasir, booking dikonfirmasi");
};

export const listPendingTopUps = async (_req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT t.id, t.user_id, u.full_name, u.email, t.reference, t.amount,
            t.status, t.proof_url, t.created_at
     FROM top_ups t JOIN users u ON u.id = t.user_id
     WHERE t.status = 'WAITING_CONFIRM'
     ORDER BY t.created_at ASC`
  );
  rows.forEach((r: any) => { r.amount = Number(r.amount); });
  return success(res, rows, "Bukti top up yang menunggu verifikasi berhasil diambil");
};

export const cashierSummary = async (_req: AuthRequest, res: Response) => {
  const today = todayWib();
  const [incomeToday]: any[] = await query(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM wallet_transactions WHERE type = 'PAYMENT' AND DATE(created_at) = ?", [today]);
  const [incomeAll]: any[] = await query(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM wallet_transactions WHERE type = 'PAYMENT'");
  const [expenseToday]: any[] = await query(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE expense_date = ?", [today]);
  const [expenseAll]: any[] = await query(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM expenses");

  const income = Number(incomeAll.total);
  const expense = Number(expenseAll.total);
  return success(res, {
    today: { income: Number(incomeToday.total), expense: Number(expenseToday.total) },
    total: { income, expense, net: income - expense },
  }, "Ringkasan kas berhasil diambil");
};
