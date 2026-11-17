import { Response } from "express";
import { pool, query, queryOne } from "../../config/database";
import { success, fail } from "../../utils/response";
import { uploadImage, FOLDERS } from "../../utils/cloudinary.util";
import { dryingMachineSchema, machineStatusSchema } from "../../validators";
import { AuthRequest } from "../../middlewares/auth.middleware";

export const listDryingMachines = async (_req: AuthRequest, res: Response) => {
  const rows = await query("SELECT * FROM drying_machines ORDER BY code ASC");
  rows.forEach((r: any) => {
    r.price_per_use = Number(r.price_per_use);
    r.duration_minutes = Number(r.duration_minutes);
  });
  return success(res, rows, "Data mesin pengering berhasil diambil");
};

export const getDryingMachine = async (req: AuthRequest, res: Response) => {
  const machine: any = await queryOne("SELECT * FROM drying_machines WHERE id = ?", [req.params.id]);
  if (!machine) return fail(res, "Mesin pengering tidak ditemukan", 404);
  machine.price_per_use = Number(machine.price_per_use);
  machine.duration_minutes = Number(machine.duration_minutes);
  return success(res, machine, "Detail mesin pengering berhasil diambil");
};

export const createDryingMachine = async (req: AuthRequest, res: Response) => {
  try {
    const data = dryingMachineSchema.parse(req.body);
    const exist = await queryOne("SELECT id FROM drying_machines WHERE code = ?", [data.code]);
    if (exist) return fail(res, `Kode mesin ${data.code} sudah dipakai`, 409);

    let photoUrl: string | null = null;
    if (req.file) photoUrl = (await uploadImage(req.file.buffer, FOLDERS.machines)).url;

    const result: any = await pool.query(
      `INSERT INTO drying_machines (code, price_per_use, duration_minutes, status, description, photo_url)
       VALUES (?, ?, 25, ?, ?, ?)`,
      [data.code, data.price_per_use, data.status, data.description, photoUrl]
    );
    const machine: any = await queryOne("SELECT * FROM drying_machines WHERE id = ?", [
      result[0].insertId,
    ]);
    machine.price_per_use = Number(machine.price_per_use);
    machine.duration_minutes = Number(machine.duration_minutes);
    return success(res, machine, "Mesin pengering berhasil ditambahkan", 201);
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

export const updateDryingMachine = async (req: AuthRequest, res: Response) => {
  try {
    const machine: any = await queryOne("SELECT id FROM drying_machines WHERE id = ?", [req.params.id]);
    if (!machine) return fail(res, "Mesin pengering tidak ditemukan", 404);

    const data = dryingMachineSchema.partial().parse(req.body);
    let photoUrl: string | null = null;
    if (req.file) photoUrl = (await uploadImage(req.file.buffer, FOLDERS.machines)).url;

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
    if (photoUrl) {
      fields.push("photo_url = ?");
      values.push(photoUrl);
    }
    if (fields.length === 0) return fail(res, "Tidak ada data yang diubah", 400);

    values.push(req.params.id);
    await pool.query(`UPDATE drying_machines SET ${fields.join(", ")} WHERE id = ?`, values);

    const updated: any = await queryOne("SELECT * FROM drying_machines WHERE id = ?", [req.params.id]);
    updated.price_per_use = Number(updated.price_per_use);
    updated.duration_minutes = Number(updated.duration_minutes);
    return success(res, updated, "Mesin pengering berhasil diperbarui");
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

export const updateDryingStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = machineStatusSchema.parse(req.body);
    const machine: any = await queryOne("SELECT id FROM drying_machines WHERE id = ?", [req.params.id]);
    if (!machine) return fail(res, "Mesin pengering tidak ditemukan", 404);

    await pool.query("UPDATE drying_machines SET status = ? WHERE id = ?", [status, req.params.id]);
    return success(res, { id: Number(req.params.id), status }, "Status mesin pengering diperbarui");
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

export const deleteDryingMachine = async (req: AuthRequest, res: Response) => {
  const machine: any = await queryOne("SELECT id FROM drying_machines WHERE id = ?", [req.params.id]);
  if (!machine) return fail(res, "Mesin pengering tidak ditemukan", 404);
  await pool.query("DELETE FROM drying_machines WHERE id = ?", [req.params.id]);
  return success(res, null, "Mesin pengering berhasil dihapus");
};
