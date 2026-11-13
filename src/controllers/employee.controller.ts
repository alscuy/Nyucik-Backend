import { Response } from "express";
import { pool, query, queryOne } from "../config/database";
import { success, fail } from "../utils/response";
import { notFound } from "../utils/httpError";
import { employeeSchema } from "../validators";
import { AuthRequest } from "../middlewares/auth.middleware";

/** GET /api/v1/employees - daftar pegawai (status ready / tidak ready) */
export const listEmployees = async (_req: AuthRequest, res: Response) => {
  const rows = await query("SELECT * FROM employees ORDER BY is_ready DESC, name ASC");
  return success(res, rows, "Data pegawai berhasil diambil");
};

/** POST /api/v1/employees (admin) */
export const createEmployee = async (req: AuthRequest, res: Response) => {
  try {
    const data = employeeSchema.parse(req.body);
    const result: any = await pool.query(
      `INSERT INTO employees (name, position, phone, is_ready) VALUES (?, ?, ?, ?)`,
      [data.name, data.position, data.phone, data.is_ready]
    );
    const employee: any = await queryOne("SELECT * FROM employees WHERE id = ?", [result[0].insertId]);
    return success(res, employee, "Pegawai berhasil ditambahkan", 201);
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

/** PATCH /api/v1/employees/:id (admin) - ubah data / set ready atau tidak */
export const updateEmployee = async (req: AuthRequest, res: Response) => {
  try {
    const existing: any = await queryOne("SELECT * FROM employees WHERE id = ?", [req.params.id]);
    if (!existing) return notFound("Pegawai tidak ditemukan");

    const data = employeeSchema.partial().parse(req.body);

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
    if (fields.length === 0) return fail(res, "Tidak ada data yang diubah", 400);

    values.push(req.params.id);
    await pool.query(`UPDATE employees SET ${fields.join(", ")} WHERE id = ?`, values);

    const updated: any = await queryOne("SELECT * FROM employees WHERE id = ?", [req.params.id]);
    return success(res, updated, "Data pegawai berhasil diperbarui");
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

/** DELETE /api/v1/employees/:id (admin) */
export const deleteEmployee = async (req: AuthRequest, res: Response) => {
  const existing: any = await queryOne("SELECT id FROM employees WHERE id = ?", [req.params.id]);
  if (!existing) return notFound("Pegawai tidak ditemukan");
  await pool.query("DELETE FROM employees WHERE id = ?", [req.params.id]);
  return success(res, null, "Pegawai berhasil dihapus");
};
