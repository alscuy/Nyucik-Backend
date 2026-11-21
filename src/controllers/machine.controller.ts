import { Response } from "express";
import { pool, query, queryOne } from "../config/database";
import { success, fail } from "../utils/response";
import { uploadImage, FOLDERS } from "../utils/cloudinary.util";
import { washingMachineSchema, dryingMachineSchema, machineStatusSchema } from "../validators";
import { AuthRequest } from "../middlewares/auth.middleware";

// ---------------- MESIN CUCI ----------------

export const listWashingMachines = async (_req: AuthRequest, res: Response) => {
  const rows = await query("SELECT * FROM washing_machines ORDER BY code ASC");
  rows.forEach((row: any) => {
    row.capacity_kg = Number(row.capacity_kg);
    row.price_per_use = Number(row.price_per_use);
  });
  return success(res, rows, "Data mesin cuci berhasil diambil");
};

export const getWashingMachine = async (req: AuthRequest, res: Response) => {
  const machine: any = await queryOne("SELECT * FROM washing_machines WHERE id = ?", [req.params.id]);
  if (!machine) return fail(res, "Mesin cuci tidak ditemukan", 404);
  machine.capacity_kg = Number(machine.capacity_kg);
  machine.price_per_use = Number(machine.price_per_use);
  return success(res, machine, "Detail mesin cuci berhasil diambil");
};

export const createWashingMachine = async (req: AuthRequest, res: Response) => {
  try {
    const data = washingMachineSchema.parse(req.body);
    const exist = await queryOne("SELECT id FROM washing_machines WHERE code = ?", [data.code]);
    if (exist) return fail(res, `Kode mesin ${data.code} sudah dipakai`, 409);

    let photoUrl: string | null = null;
    if (req.file) photoUrl = (await uploadImage(req.file.buffer, FOLDERS.machines)).url;

    const result: any = await pool.query(
      `INSERT INTO washing_machines (code, capacity_kg, price_per_use, status, description, photo_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.code, data.capacity_kg, data.price_per_use, data.status, data.description, photoUrl]
    );
    const machine: any = await queryOne("SELECT * FROM washing_machines WHERE id = ?", [
      result[0].insertId,
    ]);
    machine.capacity_kg = Number(machine.capacity_kg);
    machine.price_per_use = Number(machine.price_per_use);
    return success(res, machine, "Mesin cuci berhasil ditambahkan", 201);
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((issue: any) => issue.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

export const updateWashingMachine = async (req: AuthRequest, res: Response) => {
  try {
    const machine: any = await queryOne("SELECT id FROM washing_machines WHERE id = ?", [req.params.id]);
    if (!machine) return fail(res, "Mesin cuci tidak ditemukan", 404);

    const data = washingMachineSchema.partial().parse(req.body);
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
    await pool.query(`UPDATE washing_machines SET ${fields.join(", ")} WHERE id = ?`, values);

    const updated: any = await queryOne("SELECT * FROM washing_machines WHERE id = ?", [req.params.id]);
    updated.capacity_kg = Number(updated.capacity_kg);
    updated.price_per_use = Number(updated.price_per_use);
    return success(res, updated, "Mesin cuci berhasil diperbarui");
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((issue: any) => issue.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

export const updateWashingStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = machineStatusSchema.parse(req.body);
    const machine: any = await queryOne("SELECT id FROM washing_machines WHERE id = ?", [req.params.id]);
    if (!machine) return fail(res, "Mesin cuci tidak ditemukan", 404);

    await pool.query("UPDATE washing_machines SET status = ? WHERE id = ?", [status, req.params.id]);
    return success(res, { id: Number(req.params.id), status }, "Status mesin cuci diperbarui");
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((issue: any) => issue.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

export const deleteWashingMachine = async (req: AuthRequest, res: Response) => {
  const machine: any = await queryOne("SELECT id FROM washing_machines WHERE id = ?", [req.params.id]);
  if (!machine) return fail(res, "Mesin cuci tidak ditemukan", 404);
  await pool.query("DELETE FROM washing_machines WHERE id = ?", [req.params.id]);
  return success(res, null, "Mesin cuci berhasil dihapus");
};

// ---------------- MESIN PENGERING ----------------

export const listDryingMachines = async (_req: AuthRequest, res: Response) => {
  const rows = await query("SELECT * FROM drying_machines ORDER BY code ASC");
  rows.forEach((row: any) => {
    row.price_per_use = Number(row.price_per_use);
    row.duration_minutes = Number(row.duration_minutes);
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
    if (err.name === "ZodError") return fail(res, err.errors.map((issue: any) => issue.message).join(", "), 400);
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
    if (err.name === "ZodError") return fail(res, err.errors.map((issue: any) => issue.message).join(", "), 400);
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
    if (err.name === "ZodError") return fail(res, err.errors.map((issue: any) => issue.message).join(", "), 400);
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
