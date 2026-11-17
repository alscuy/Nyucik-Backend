import { Response } from "express";
import { pool, queryOne, todayWib } from "../../config/database";
import { success, fail } from "../../utils/response";
import { uploadImage, FOLDERS } from "../../utils/cloudinary.util";
import { createBookingSchema } from "../../validators";
import { AuthRequest } from "../../middlewares/auth.middleware";
import {
  DURATION_MINUTES,
  addMinutesToTime,
  machineInfo,
  nowWibTime,
} from "../../services/booking.service";

export const createBooking = async (req: AuthRequest, res: Response) => {
  try {
    const data = createBookingSchema.parse(req.body);
    const { col, table } = machineInfo(data);
    const machine: any = await queryOne(`SELECT * FROM ${table} WHERE id = ?`, [data.machine_id]);

    if (!machine) return fail(res, "Mesin tidak ditemukan", 404);
    if (machine.status !== "AVAILABLE") {
      return fail(res, `Mesin ${machine.code} sedang ${machine.status}, pilih mesin lain`, 409);
    }

    const active: any = await queryOne(
      `SELECT id FROM bookings
       WHERE ${col} = ? AND status IN ('PENDING','CONFIRMED','IN_PROGRESS') LIMIT 1`,
      [data.machine_id]
    );
    if (active) {
      return fail(res, `Mesin ${machine.code} sedang dipakai, pilih mesin lain`, 409);
    }

    let photoBeforeUrl: string | null = null;
    if (req.file) {
      photoBeforeUrl = (await uploadImage(req.file.buffer, FOLDERS.photoBefore)).url;
    } else if (data.machine_type === "WASHING") {
      return fail(res, "Foto cucian yang mau dicuci wajib diupload (field: photo)", 400);
    }

    const startTime = nowWibTime();
    const endTime = addMinutesToTime(startTime, DURATION_MINUTES);
    const totalPrice = Number(machine.price_per_use);

    const result: any = await pool.query(
      `INSERT INTO bookings
       (user_id, machine_type, washing_machine_id, drying_machine_id, booking_date,
        start_time, end_time, total_price, status, photo_before_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [
        req.user!.id,
        data.machine_type,
        data.machine_type === "WASHING" ? data.machine_id : null,
        data.machine_type === "DRYING" ? data.machine_id : null,
        todayWib(),
        startTime,
        endTime,
        totalPrice,
        photoBeforeUrl,
      ]
    );

    const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [result[0].insertId]);
    booking.total_price = Number(booking.total_price);
    return success(
      res,
      { ...booking, machine_code: machine.code, duration_minutes: DURATION_MINUTES },
      `Laundry berhasil dibuat. Bayar pakai saldo: POST /api/v1/bookings/${booking.id}/pay`,
      201
    );
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((issue: any) => issue.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};
