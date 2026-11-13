import { Response } from "express";
import { pool, query, queryOne } from "../config/database";
import { success, fail } from "../utils/response";
import { notFound } from "../utils/httpError";
import { uploadImage, FOLDERS } from "../utils/cloudinary.util";
import {
  washingMachineSchema,
  dryingMachineSchema,
  machineStatusSchema,
} from "../validators";
import { AuthRequest } from "../middlewares/auth.middleware";

const MACHINE_STATUS = ["AVAILABLE", "BOOKED", "IN_USE", "MAINTENANCE"] as const;

// ==================== MESIN CUCI ====================

/** GET /api/v1/washing-machines */
export const listWashingMachines = async (_req: AuthRequest, res: Response) => {
  const rows = await query(
    "SELECT * FROM washing_machines ORDER BY code ASC"
  );
  rows.forEach((r: any) => {
    r.capacity_kg = Number(r.capacity_kg);
    r.price_per_kg = Number(r.price_per_kg);
  });
  return success(res, rows, "Data mesin cuci berhasil diambil");
};

/** GET /api/v1/washing-machines/:id */
export const getWashingMachine = async (req: AuthRequest, res: Response) => {
  const machine: any = await queryOne(
    "SELECT * FROM washing_machines WHERE id = ?",
    [req.params.id]
  );
  if (!machine) return notFound("Mesin cuci tidak ditemukan");
  machine.capacity_kg = Number(machine.capacity_kg);
  machine.price_per_kg = Number(machine.price_per_kg);
  return success(res, machine, "Detail mesin cuci berhasil diambil");
};

/** POST /api/v1/washing-machines (admin) */
export const createWashingMachine = async (req: AuthRequest, res: Response) => {
  try {
    const data = washingMachineSchema.parse(req.body);

    const exist = await queryOne(
      "SELECT id FROM washing_machines WHERE code = ?",
      [data.code]
    );
    if (exist) return fail(res, `Kode mesin ${data.code} sudah dipakai`, 409);

    let photoUrl: string | null = null;
    if (req.file) photoUrl = (await uploadImage(req.file.buffer, FOLDERS.machines)).url;

    const result: any = await pool.query(
      `INSERT INTO washing_machines (code, capacity_kg, price_per_kg, status, description, photo_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.code, data.capacity_kg, data.price_per_kg, data.status, data.description, photoUrl]
    );
    const machine: any = await queryOne("SELECT * FROM washing_machines WHERE id = ?", [result[0].insertId]);
    machine.capacity_kg = Number(machine.capacity_kg);
    machine.price_per_kg = Number(machine.price_per_kg);

    return success(res, machine, "Mesin cuci berhasil ditambahkan", 201);
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

/** PATCH /api/v1/washing-machines/:id (admin) */
export const updateWashingMachine = async (req: AuthRequest, res: Response) => {
  try {
    const machine: any = await queryOne("SELECT * FROM washing_machines WHERE id = ?", [req.params.id]);
    if (!machine) return notFound("Mesin cuci tidak ditemukan");

    const data = washingMachineSchema.partial().parse(req.body);

    let photoUrl: string | null = null;
    if (req.file) photoUrl = (await uploadImage(req.file.buffer, FOLDERS.machines)).url;

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
    if (photoUrl) { fields.push("photo_url = ?"); values.push(photoUrl); }
    if (fields.length === 0) return fail(res, "Tidak ada data yang diubah", 400);

    values.push(req.params.id);
    await pool.query(`UPDATE washing_machines SET ${fields.join(", ")} WHERE id = ?`, values);

    const updated: any = await queryOne("SELECT * FROM washing_machines WHERE id = ?", [req.params.id]);
    updated.capacity_kg = Number(updated.capacity_kg);
    updated.price_per_kg = Number(updated.price_per_kg);
    return success(res, updated, "Mesin cuci berhasil diperbarui");
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

/** PATCH /api/v1/washing-machines/:id/status (admin) */
export const updateWashingStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = machineStatusSchema.parse(req.body);
    const machine: any = await queryOne("SELECT id FROM washing_machines WHERE id = ?", [req.params.id]);
    if (!machine) return notFound("Mesin cuci tidak ditemukan");

    await pool.query("UPDATE washing_machines SET status = ? WHERE id = ?", [status, req.params.id]);
    return success(res, { id: Number(req.params.id), status }, "Status mesin cuci diperbarui");
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

/** DELETE /api/v1/washing-machines/:id (admin) */
export const deleteWashingMachine = async (req: AuthRequest, res: Response) => {
  const machine: any = await queryOne("SELECT id FROM washing_machines WHERE id = ?", [req.params.id]);
  if (!machine) return notFound("Mesin cuci tidak ditemukan");
  await pool.query("DELETE FROM washing_machines WHERE id = ?", [req.params.id]);
  return success(res, null, "Mesin cuci berhasil dihapus");
};

// ==================== MESIN PENGERING ====================

/** GET /api/v1/drying-machines */
export const listDryingMachines = async (_req: AuthRequest, res: Response) => {
  const rows = await query("SELECT * FROM drying_machines ORDER BY code ASC");
  rows.forEach((r: any) => {
    r.price_per_use = Number(r.price_per_use);
    r.duration_minutes = Number(r.duration_minutes);
  });
  return success(res, rows, "Data mesin pengering berhasil diambil");
};

/** GET /api/v1/drying-machines/:id */
export const getDryingMachine = async (req: AuthRequest, res: Response) => {
  const machine: any = await queryOne("SELECT * FROM drying_machines WHERE id = ?", [req.params.id]);
  if (!machine) return notFound("Mesin pengering tidak ditemukan");
  machine.price_per_use = Number(machine.price_per_use);
  machine.duration_minutes = Number(machine.duration_minutes);
  return success(res, machine, "Detail mesin pengering berhasil diambil");
};

/** POST /api/v1/drying-machines (admin) */
export const createDryingMachine = async (req: AuthRequest, res: Response) => {
  try {
    const data = dryingMachineSchema.parse(req.body);

    const exist = await queryOne("SELECT id FROM drying_machines WHERE code = ?", [data.code]);
    if (exist) return fail(res, `Kode mesin ${data.code} sudah dipakai`, 409);

    let photoUrl: string | null = null;
    if (req.file) photoUrl = (await uploadImage(req.file.buffer, FOLDERS.machines)).url;

    const result: any = await pool.query(
      `INSERT INTO drying_machines (code, price_per_use, duration_minutes, status, description, photo_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.code, data.price_per_use, data.duration_minutes, data.status, data.description, photoUrl]
    );
    const machine: any = await queryOne("SELECT * FROM drying_machines WHERE id = ?", [result[0].insertId]);
    machine.price_per_use = Number(machine.price_per_use);
    machine.duration_minutes = Number(machine.duration_minutes);

    return success(res, machine, "Mesin pengering berhasil ditambahkan", 201);
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

/** PATCH /api/v1/drying-machines/:id (admin) */
export const updateDryingMachine = async (req: AuthRequest, res: Response) => {
  try {
    const machine: any = await queryOne("SELECT * FROM drying_machines WHERE id = ?", [req.params.id]);
    if (!machine) return notFound("Mesin pengering tidak ditemukan");

    const data = dryingMachineSchema.partial().parse(req.body);

    let photoUrl: string | null = null;
    if (req.file) photoUrl = (await uploadImage(req.file.buffer, FOLDERS.machines)).url;

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
    if (photoUrl) { fields.push("photo_url = ?"); values.push(photoUrl); }
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

/** PATCH /api/v1/drying-machines/:id/status (admin) */
export const updateDryingStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = machineStatusSchema.parse(req.body);
    if (!MACHINE_STATUS.includes(status as any)) return fail(res, "Status mesin tidak valid", 400);
    const machine: any = await queryOne("SELECT id FROM drying_machines WHERE id = ?", [req.params.id]);
    if (!machine) return notFound("Mesin pengering tidak ditemukan");

    await pool.query("UPDATE drying_machines SET status = ? WHERE id = ?", [status, req.params.id]);
    return success(res, { id: Number(req.params.id), status }, "Status mesin pengering diperbarui");
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

/** DELETE /api/v1/drying-machines/:id (admin) */
export const deleteDryingMachine = async (req: AuthRequest, res: Response) => {
  const machine: any = await queryOne("SELECT id FROM drying_machines WHERE id = ?", [req.params.id]);
  if (!machine) return notFound("Mesin pengering tidak ditemukan");
  await pool.query("DELETE FROM drying_machines WHERE id = ?", [req.params.id]);
  return success(res, null, "Mesin pengering berhasil dihapus");
};
