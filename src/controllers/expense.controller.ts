import { Response } from "express";
import { pool, query } from "../config/database";
import { success, fail } from "../utils/response";
import { notFound } from "../utils/httpError";
import { expenseSchema } from "../validators";
import { AuthRequest } from "../middlewares/auth.middleware";

/**
 * Pengeluaran laundry (biaya operasional: sabun, listrik, perawatan, dll).
 * Dipakai dashboard "Pemasukan & Pengeluaran" admin.
 * Laporan pendapatan (booking + produk) tetap dari admin.controller.
 */

/** GET /api/v1/expenses — semua pengeluaran urut terbaru + total */
export const listExpenses = async (_req: AuthRequest, res: Response) => {
  const rows = await query(
    "SELECT * FROM expenses ORDER BY expense_date DESC, id DESC"
  );
  const list = rows as any[];
  list.forEach((r) => { r.amount = Number(r.amount); });
  const total = list.reduce((a, r) => a + Number(r.amount), 0);
  return success(res, { items: list, total }, "Data pengeluaran berhasil diambil");
};

/** POST /api/v1/expenses (admin) */
export const createExpense = async (req: AuthRequest, res: Response) => {
  try {
    const data = expenseSchema.parse(req.body);
    const result: any = await pool.query(
      `INSERT INTO expenses (title, amount, expense_date, description)
       VALUES (?, ?, ?, ?)`,
      [data.title, data.amount, data.expense_date, data.description ?? null]
    );
    return success(res, { id: result[0].insertId, ...data }, "Pengeluaran dicatat", 201);
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

/** PATCH /api/v1/expenses/:id (admin) — ubah dinamis */
export const updateExpense = async (req: AuthRequest, res: Response) => {
  try {
    const exist: any = await query(
      "SELECT id FROM expenses WHERE id = ?",
      [req.params.id]
    );
    if (exist.length === 0) return notFound("Pengeluaran tidak ditemukan");

    const data = expenseSchema.partial().parse(req.body);
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
    if (fields.length === 0) return fail(res, "Tidak ada data yang diubah", 400);

    values.push(req.params.id);
    await pool.query(`UPDATE expenses SET ${fields.join(", ")} WHERE id = ?`, values);
    return success(res, null, "Pengeluaran diperbarui");
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

/** DELETE /api/v1/expenses/:id (admin) */
export const deleteExpense = async (req: AuthRequest, res: Response) => {
  const exist: any = await query("SELECT id FROM expenses WHERE id = ?", [req.params.id]);
  if (exist.length === 0) return notFound("Pengeluaran tidak ditemukan");
  await pool.query("DELETE FROM expenses WHERE id = ?", [req.params.id]);
  return success(res, null, "Pengeluaran dihapus");
};
