import { Response } from "express";
import bcrypt from "bcryptjs";
import { pool, query, queryOne } from "../config/database";
import { success, fail } from "../utils/response";
import { uploadImage, FOLDERS } from "../utils/cloudinary.util";
import { updateProfileSchema, changePasswordSchema } from "../validators";
import { AuthRequest } from "../middlewares/auth.middleware";
import { finishDueLaundry } from "../services/booking.service";

export const getProfile = async (req: AuthRequest, res: Response) => {
  const user: any = await queryOne(
    "SELECT id, full_name, email, phone, role, photo_url, balance, is_verified, created_at FROM users WHERE id = ?",
    [req.user!.id]
  );
  if (!user) return fail(res, "User tidak ditemukan", 404);
  user.balance = Number(user.balance);
  return success(res, user, "Profil berhasil diambil");
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const data = updateProfileSchema.parse(req.body);

    if (data.email) {
      const exist = await queryOne(
        "SELECT id FROM users WHERE email = ? AND id <> ?",
        [data.email, req.user!.id]
      );
      if (exist) {
        return fail(res, "Email sudah dipakai user lain", 409);
      }
    }

    let photoUrl: string | undefined;
    if (req.file) {
      const img = await uploadImage(req.file.buffer, FOLDERS.profiles);
      photoUrl = img.url;
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.full_name) { fields.push("full_name = ?"); values.push(data.full_name); }
    if (data.email) { fields.push("email = ?"); values.push(data.email); }
    if (data.phone) { fields.push("phone = ?"); values.push(data.phone); }
    if (photoUrl) { fields.push("photo_url = ?"); values.push(photoUrl); }

    if (fields.length === 0) return fail(res, "Tidak ada data yang diubah", 400);

    values.push(req.user!.id);
    await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);

    const updated: any = await queryOne(
      "SELECT id, full_name, email, phone, role, photo_url, balance FROM users WHERE id = ?",
      [req.user!.id]
    );
    updated.balance = Number(updated.balance);

    return success(res, updated, "Profil berhasil diperbarui");
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return fail(res, (err as any).errors.map((e: any) => e.message).join(", "), 400);
    }
    console.error(err);
    return fail(res);
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const data = changePasswordSchema.parse(req.body);
    const user: any = await queryOne("SELECT password FROM users WHERE id = ?", [req.user!.id]);

    const match = await bcrypt.compare(data.old_password, user.password);
    if (!match) return fail(res, "Password lama salah", 400);

    const hashed = await bcrypt.hash(data.new_password, 10);
    await pool.query("UPDATE users SET password = ? WHERE id = ?", [hashed, req.user!.id]);

    return success(res, null, "Password berhasil diubah");
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return fail(res, (err as any).errors.map((e: any) => e.message).join(", "), 400);
    }
    console.error(err);
    return fail(res);
  }
};

export const myTransactions = async (req: AuthRequest, res: Response) => {
  await finishDueLaundry();
  const bookings = await query(
    `SELECT b.*, w.code AS washing_code, d.code AS drying_code
     FROM bookings b
     LEFT JOIN washing_machines w ON w.id = b.washing_machine_id
     LEFT JOIN drying_machines d ON d.id = b.drying_machine_id
     WHERE b.user_id = ? ORDER BY b.created_at DESC`,
    [req.user!.id]
  );
  bookings.forEach((booking: any) => {
    booking.total_price = Number(booking.total_price);
  });
  const orders = await query(
    `SELECT po.id, 'PRODUCT' AS type, po.product_id, po.quantity,
            po.total_price, po.status, po.created_at, p.name AS product_name, p.photo_url
     FROM product_orders po JOIN products p ON p.id = po.product_id
     WHERE po.user_id = ? ORDER BY po.created_at DESC`,
    [req.user!.id]
  );

  return success(res, { bookings, product_orders: orders }, "Riwayat transaksi berhasil diambil");
};

export const myBookings = async (req: AuthRequest, res: Response) => {
  await finishDueLaundry();
  const rows = await query(
    `SELECT b.*, w.code AS washing_code, d.code AS drying_code
     FROM bookings b
     LEFT JOIN washing_machines w ON w.id = b.washing_machine_id
     LEFT JOIN drying_machines d ON d.id = b.drying_machine_id
     WHERE b.user_id = ?
     ORDER BY b.created_at DESC`,
    [req.user!.id]
  );
  rows.forEach((row: any) => { row.total_price = Number(row.total_price); });
  return success(res, rows, "Riwayat laundry berhasil diambil");
};
