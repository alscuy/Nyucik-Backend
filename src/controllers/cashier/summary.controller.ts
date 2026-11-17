import { Response } from "express";
import { query, todayWib } from "../../config/database";
import { success } from "../../utils/response";
import { AuthRequest } from "../../middlewares/auth.middleware";

export const cashierSummary = async (_req: AuthRequest, res: Response) => {
  const today = todayWib();
  const [incomeToday]: any[] = await query(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM wallet_transactions WHERE type = 'PAYMENT' AND DATE(created_at) = ?",
    [today]
  );
  const [incomeAll]: any[] = await query(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM wallet_transactions WHERE type = 'PAYMENT'"
  );
  const [expenseToday]: any[] = await query(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE expense_date = ?",
    [today]
  );
  const [expenseAll]: any[] = await query("SELECT COALESCE(SUM(amount), 0) AS total FROM expenses");

  const income = Number(incomeAll.total);
  const expense = Number(expenseAll.total);
  return success(
    res,
    {
      today: { income: Number(incomeToday.total), expense: Number(expenseToday.total) },
      total: { income, expense, net: income - expense },
    },
    "Ringkasan kas berhasil diambil"
  );
};
