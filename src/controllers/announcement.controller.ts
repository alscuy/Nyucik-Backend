import { Response } from "express";
import { pool, query, queryOne, todayWib } from "../config/database";
import { success, fail } from "../utils/response";
import { notFound } from "../utils/http-error";
import { uploadImage, FOLDERS } from "../utils/cloudinary.util";
import { announcementSchemaBase, announcementSchema } from "../validators";
import { AuthRequest } from "../middlewares/auth.middleware";

export const listAnnouncements = async (_req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT id, title, content, image_url, start_date, end_date, is_active, created_at
     FROM announcements
     WHERE is_active = 1 AND ? BETWEEN start_date AND end_date
     ORDER BY start_date DESC`,
    [todayWib()]
  );
  return success(res, rows, "Pengumuman berhasil diambil");
};

export const listAllAnnouncements = async (_req: AuthRequest, res: Response) => {
  const rows = await query("SELECT * FROM announcements ORDER BY start_date DESC");
  return success(res, rows, "Semua pengumuman berhasil diambil");
};

export const createAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const data = announcementSchema.parse(req.body);

    let photoUrl: string | null = null;
    if (req.file) photoUrl = (await uploadImage(req.file.buffer, FOLDERS.announcements)).url;

    const result: any = await pool.query(
      `INSERT INTO announcements (title, content, image_url, start_date, end_date, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.title, data.content, photoUrl, data.start_date, data.end_date, data.is_active]
    );
    const announcement: any = await queryOne("SELECT * FROM announcements WHERE id = ?", [result[0].insertId]);
    return success(res, announcement, "Pengumuman berhasil dibuat", 201);
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((issue: any) => issue.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

export const updateAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const existing: any = await queryOne("SELECT * FROM announcements WHERE id = ?", [req.params.id]);
    if (!existing) return notFound("Pengumuman tidak ditemukan");

    const data = announcementSchemaBase.partial().parse(req.body);

    let photoUrl: string | null = null;
    if (req.file) photoUrl = (await uploadImage(req.file.buffer, FOLDERS.announcements)).url;

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
    if (photoUrl) { fields.push("image_url = ?"); values.push(photoUrl); }
    if (fields.length === 0) return fail(res, "Tidak ada data yang diubah", 400);

    values.push(req.params.id);
    await pool.query(`UPDATE announcements SET ${fields.join(", ")} WHERE id = ?`, values);

    const updated: any = await queryOne("SELECT * FROM announcements WHERE id = ?", [req.params.id]);
    return success(res, updated, "Pengumuman berhasil diperbarui");
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((issue: any) => issue.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

export const deleteAnnouncement = async (req: AuthRequest, res: Response) => {
  const existing: any = await queryOne("SELECT id FROM announcements WHERE id = ?", [req.params.id]);
  if (!existing) return notFound("Pengumuman tidak ditemukan");
  await pool.query("DELETE FROM announcements WHERE id = ?", [req.params.id]);
  return success(res, null, "Pengumuman berhasil dihapus");
};
