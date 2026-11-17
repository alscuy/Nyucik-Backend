import { Response } from "express";
import { query, queryOne } from "../../config/database";
import { success, fail } from "../../utils/response";
import { AuthRequest } from "../../middlewares/auth.middleware";

export const listUsers = async (_req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT id, full_name, email, phone, role, is_verified, photo_url, balance, created_at
     FROM users ORDER BY created_at DESC`
  );
  rows.forEach((row: any) => {
    row.balance = Number(row.balance);
  });
  return success(res, rows, "Data semua user berhasil diambil");
};

export const getUserDetail = async (req: AuthRequest, res: Response) => {
  const user: any = await queryOne(
    `SELECT id, full_name, email, phone, role, is_verified, photo_url, balance, created_at
     FROM users WHERE id = ?`,
    [req.params.id]
  );
  if (!user) return fail(res, "User tidak ditemukan", 404);
  user.balance = Number(user.balance);

  const bookings = await query(
    `SELECT b.id, b.machine_type, w.code AS washing_code, d.code AS drying_code,
            b.booking_date, b.start_time, b.total_price, b.status, b.paid_at, b.started_at,
            b.finished_at, b.created_at
     FROM bookings b
     LEFT JOIN washing_machines w ON w.id = b.washing_machine_id
     LEFT JOIN drying_machines d ON d.id = b.drying_machine_id
     WHERE b.user_id = ? ORDER BY b.created_at DESC`,
    [req.params.id]
  );
  bookings.forEach((booking: any) => {
    booking.total_price = Number(booking.total_price);
    booking.is_paid =
      ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(booking.status) && booking.paid_at !== null;
  });

  const topUpRows = await query(
    "SELECT id, reference, amount, status, paid_at, created_at FROM top_ups WHERE user_id = ? ORDER BY created_at DESC",
    [req.params.id]
  );
  topUpRows.forEach((topUp: any) => {
    topUp.amount = Number(topUp.amount);
  });

  const transactions = await query(
    "SELECT id, type, amount, balance_before, balance_after, description, created_at FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC",
    [req.params.id]
  );
  transactions.forEach((transaction: any) => {
    transaction.amount = Number(transaction.amount);
    transaction.balance_before = Number(transaction.balance_before);
    transaction.balance_after = Number(transaction.balance_after);
  });

  return success(res, { user, bookings, topUps: topUpRows, transactions }, "Detail user berhasil diambil");
};
