import { Response } from "express";
import { query, queryOne } from "../../config/database";
import { success, fail } from "../../utils/response";
import { AuthRequest } from "../../middlewares/auth.middleware";

export const listUsers = async (_req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT id, full_name, email, phone, role, is_verified, photo_url, balance, created_at
     FROM users ORDER BY created_at DESC`
  );
  rows.forEach((r: any) => {
    r.balance = Number(r.balance);
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
  bookings.forEach((b: any) => {
    b.total_price = Number(b.total_price);
    b.is_paid = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(b.status) && b.paid_at !== null;
  });

  const topups = await query(
    "SELECT id, reference, amount, status, paid_at, created_at FROM top_ups WHERE user_id = ? ORDER BY created_at DESC",
    [req.params.id]
  );
  topups.forEach((t: any) => {
    t.amount = Number(t.amount);
  });

  const transactions = await query(
    "SELECT id, type, amount, balance_before, balance_after, description, created_at FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC",
    [req.params.id]
  );
  transactions.forEach((t: any) => {
    t.amount = Number(t.amount);
    t.balance_before = Number(t.balance_before);
    t.balance_after = Number(t.balance_after);
  });

  return success(res, { user, bookings, topups, transactions }, "Detail user berhasil diambil");
};
