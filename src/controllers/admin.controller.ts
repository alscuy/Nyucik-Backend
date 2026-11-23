import { Response } from "express";
import { pool, query, queryOne, todayWib } from "../config/database";
import { success, fail } from "../utils/response";
import { notFound } from "../utils/http-error";
import { expenseSchema } from "../validators";
import { AuthRequest } from "../middlewares/auth.middleware";

export const dashboard = async (_req: AuthRequest, res: Response) => {
  const today = todayWib();
  const [users]: any[] = await query("SELECT COUNT(*) AS total FROM users WHERE role = 'USER'");
  const [machinesAvail]: any[] = await query(
    "SELECT COUNT(*) AS total FROM washing_machines WHERE status = 'AVAILABLE'"
  );
  const [dryersAvail]: any[] = await query(
    "SELECT COUNT(*) AS total FROM drying_machines WHERE status = 'AVAILABLE'"
  );
  const [bookingsToday]: any[] = await query(
    "SELECT COUNT(*) AS total FROM bookings WHERE booking_date = ? AND status <> 'CANCELLED'",
    [today]
  );
  const [revenueBooking]: any[] = await query(
    "SELECT COALESCE(SUM(total_price), 0) AS total FROM bookings WHERE status IN ('CONFIRMED','IN_PROGRESS','COMPLETED')"
  );
  const [revenueProduct]: any[] = await query(
    "SELECT COALESCE(SUM(total_price), 0) AS total FROM product_orders"
  );

  const booking = Number(revenueBooking.total);
  const product = Number(revenueProduct.total);

  return success(
    res,
    {
      total_users: Number(users.total),
      washing_machines_available: Number(machinesAvail.total),
      drying_machines_available: Number(dryersAvail.total),
      bookings_today: Number(bookingsToday.total),
      revenue: { booking, product, total: booking + product },
    },
    "Dashboard berhasil diambil"
  );
};

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

const toNumber = (value: unknown): number => Number(value ?? 0);

const dateKey = (value: unknown): string => String(value ?? "").slice(0, 10);

type DateRange = { start?: string; end?: string; error?: string };

/// Baca filter ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD (opsional).
const readDateRange = (req: AuthRequest): DateRange => {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  const start =
    typeof req.query.start_date === "string" && req.query.start_date
      ? req.query.start_date
      : undefined;
  const end =
    typeof req.query.end_date === "string" && req.query.end_date
      ? req.query.end_date
      : undefined;

  if (start && !pattern.test(start))
    return { error: "start_date harus format YYYY-MM-DD" };
  if (end && !pattern.test(end))
    return { error: "end_date harus format YYYY-MM-DD" };
  if (start && end && start > end)
    return { error: "start_date harus sama atau sebelum end_date" };

  return { start, end };
};

/// Daftar pemasukan (laundry + produk), pengeluaran, dan rekap per tanggal.
export const revenueDetail = async (req: AuthRequest, res: Response) => {
  const range = readDateRange(req);
  if (range.error) return fail(res, range.error, 400);

  const bookingWhere = [
    "b.status IN ('CONFIRMED','IN_PROGRESS','COMPLETED')",
  ];
  const bookingParams: unknown[] = [];
  if (range.start) {
    bookingWhere.push("DATE(COALESCE(b.paid_at, b.created_at)) >= ?");
    bookingParams.push(range.start);
  }
  if (range.end) {
    bookingWhere.push("DATE(COALESCE(b.paid_at, b.created_at)) <= ?");
    bookingParams.push(range.end);
  }

  const bookings = await query(
    `SELECT b.id, b.machine_type, b.total_price, b.status, b.created_at, b.paid_at,
            u.full_name, w.code AS washing_code, d.code AS drying_code
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     LEFT JOIN washing_machines w ON w.id = b.washing_machine_id
     LEFT JOIN drying_machines d ON d.id = b.drying_machine_id
     WHERE ${bookingWhere.join(" AND ")}
     ORDER BY b.created_at DESC`,
    bookingParams
  );
  bookings.forEach((booking: any) => {
    booking.total_price = toNumber(booking.total_price);
    booking.machine_code = booking.washing_code ?? booking.drying_code ?? "-";
    booking.income_date = dateKey(booking.paid_at ?? booking.created_at);
  });

  const productWhere: string[] = [];
  const productParams: unknown[] = [];
  if (range.start) {
    productWhere.push("DATE(po.created_at) >= ?");
    productParams.push(range.start);
  }
  if (range.end) {
    productWhere.push("DATE(po.created_at) <= ?");
    productParams.push(range.end);
  }

  const products = await query(
    `SELECT po.id, p.name AS product_name, po.quantity, po.total_price, po.status, po.created_at,
            u.full_name
     FROM product_orders po
     JOIN products p ON p.id = po.product_id
     JOIN users u ON u.id = po.user_id
     ${productWhere.length ? `WHERE ${productWhere.join(" AND ")}` : ""}
     ORDER BY po.created_at DESC`,
    productParams
  );
  products.forEach((product: any) => {
    product.total_price = toNumber(product.total_price);
  });

  const expenseWhere: string[] = [];
  const expenseParams: unknown[] = [];
  if (range.start) {
    expenseWhere.push("expense_date >= ?");
    expenseParams.push(range.start);
  }
  if (range.end) {
    expenseWhere.push("expense_date <= ?");
    expenseParams.push(range.end);
  }

  const expenses = await query(
    `SELECT id, title, amount, expense_date, note, created_at, updated_at
     FROM expenses
     ${expenseWhere.length ? `WHERE ${expenseWhere.join(" AND ")}` : ""}
     ORDER BY expense_date DESC, id DESC`,
    expenseParams
  );
  expenses.forEach((expense: any) => {
    expense.amount = toNumber(expense.amount);
  });

  const incomeMap = new Map<
    string,
    { date: string; booking: number; product: number; total: number }
  >();
  const addIncome = (
    value: unknown,
    field: "booking" | "product",
    amount: number
  ) => {
    const date = dateKey(value);
    if (!date) return;
    const current =
      incomeMap.get(date) ?? { date, booking: 0, product: 0, total: 0 };
    current[field] += amount;
    current.total += amount;
    incomeMap.set(date, current);
  };
  bookings.forEach((booking: any) =>
    addIncome(booking.income_date, "booking", booking.total_price)
  );
  products.forEach((product: any) =>
    addIncome(product.created_at, "product", product.total_price)
  );
  const incomeByDate = Array.from(incomeMap.values()).sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  const expenseMap = new Map<string, number>();
  expenses.forEach((expense: any) => {
    const date = dateKey(expense.expense_date ?? expense.created_at);
    if (!date) return;
    expenseMap.set(date, (expenseMap.get(date) ?? 0) + expense.amount);
  });
  const expenseByDate = Array.from(expenseMap.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const incomeBooking = bookings.reduce(
    (sum: number, booking: any) => sum + booking.total_price,
    0
  );
  const incomeProduct = products.reduce(
    (sum: number, product: any) => sum + product.total_price,
    0
  );
  const incomeTotal = incomeBooking + incomeProduct;
  const expenseTotal = expenses.reduce(
    (sum: number, expense: any) => sum + expense.amount,
    0
  );
  const net = incomeTotal - expenseTotal;

  return success(
    res,
    {
      bookings,
      products,
      expenses,
      income_by_date: incomeByDate,
      expense_by_date: expenseByDate,
      range: {
        start_date: range.start ?? null,
        end_date: range.end ?? null,
      },
      summary: {
        income_booking: incomeBooking,
        income_product: incomeProduct,
        income_total: incomeTotal,
        expense_total: expenseTotal,
        net,
        profit: Math.max(0, net),
        loss: Math.max(0, -net),
      },
    },
    "Detail omzet berhasil diambil"
  );
};

export const listExpenses = async (req: AuthRequest, res: Response) => {
  const range = readDateRange(req);
  if (range.error) return fail(res, range.error, 400);

  const where: string[] = [];
  const params: unknown[] = [];
  if (range.start) {
    where.push("expense_date >= ?");
    params.push(range.start);
  }
  if (range.end) {
    where.push("expense_date <= ?");
    params.push(range.end);
  }

  const rows = await query(
    `SELECT id, title, amount, expense_date, note, created_at, updated_at
     FROM expenses
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY expense_date DESC, id DESC`,
    params
  );
  rows.forEach((row: any) => {
    row.amount = toNumber(row.amount);
  });
  return success(res, rows, "Data pengeluaran berhasil diambil");
};

export const createExpense = async (req: AuthRequest, res: Response) => {
  try {
    const data = expenseSchema.parse(req.body);
    const result: any = await pool.query(
      `INSERT INTO expenses (title, amount, expense_date, note) VALUES (?, ?, ?, ?)`,
      [data.title, data.amount, data.expense_date, data.note ?? null]
    );
    const expense: any = await queryOne(
      "SELECT * FROM expenses WHERE id = ?",
      [result[0].insertId]
    );
    if (expense) expense.amount = toNumber(expense.amount);
    return success(res, expense, "Pengeluaran berhasil ditambahkan", 201);
  } catch (err: any) {
    if (err.name === "ZodError")
      return fail(
        res,
        err.errors.map((issue: any) => issue.message).join(", "),
        400
      );
    console.error(err);
    return fail(res);
  }
};

export const updateExpense = async (req: AuthRequest, res: Response) => {
  try {
    const existing: any = await queryOne(
      "SELECT id FROM expenses WHERE id = ?",
      [req.params.id]
    );
    if (!existing) return notFound("Pengeluaran tidak ditemukan");

    const data = expenseSchema.partial().parse(req.body);

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    if (fields.length === 0)
      return fail(res, "Tidak ada data yang diubah", 400);

    values.push(req.params.id);
    await pool.query(
      `UPDATE expenses SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    const updated: any = await queryOne(
      "SELECT * FROM expenses WHERE id = ?",
      [req.params.id]
    );
    if (updated) updated.amount = toNumber(updated.amount);
    return success(res, updated, "Pengeluaran berhasil diperbarui");
  } catch (err: any) {
    if (err.name === "ZodError")
      return fail(
        res,
        err.errors.map((issue: any) => issue.message).join(", "),
        400
      );
    console.error(err);
    return fail(res);
  }
};

export const deleteExpense = async (req: AuthRequest, res: Response) => {
  const existing: any = await queryOne(
    "SELECT id FROM expenses WHERE id = ?",
    [req.params.id]
  );
  if (!existing) return notFound("Pengeluaran tidak ditemukan");
  await pool.query("DELETE FROM expenses WHERE id = ?", [req.params.id]);
  return success(res, null, "Pengeluaran berhasil dihapus");
};
