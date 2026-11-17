import { Response } from "express";
import { query } from "../../config/database";
import { success } from "../../utils/response";
import { AuthRequest } from "../../middlewares/auth.middleware";

export const listTransactions = async (_req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT wt.*, u.full_name, u.email
     FROM wallet_transactions wt JOIN users u ON u.id = wt.user_id
     ORDER BY wt.created_at DESC`
  );
  rows.forEach((row: any) => {
    row.amount = Number(row.amount);
    row.balance_before = Number(row.balance_before);
    row.balance_after = Number(row.balance_after);
  });
  return success(res, rows, "Semua transaksi berhasil diambil");
};

export const listPayments = async (_req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT t.*, u.full_name, u.email
     FROM top_ups t JOIN users u ON u.id = t.user_id
     ORDER BY t.created_at DESC`
  );
  rows.forEach((row: any) => {
    row.amount = Number(row.amount);
  });
  return success(res, rows, "Riwayat pembayaran berhasil diambil");
};
