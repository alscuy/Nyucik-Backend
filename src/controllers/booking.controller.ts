import { Response } from "express";
import { pool, query, queryOne, todayWib, withTransaction } from "../config/database";
import { success, fail } from "../utils/response";
import { uploadImage, FOLDERS } from "../utils/cloudinary.util";
import { createBookingSchema, updateStatusSchema } from "../validators";
import { AuthRequest } from "../middlewares/auth.middleware";
import {
  DURATION_MINUTES,
  addMinutesToTime,
  finishDueLaundry,
  machineInfo,
  nowWibTime,
  refundBooking,
} from "../services/booking.service";
import { storeIsOpen } from "../services/store.service";

const SELECT_BOOKING = `SELECT b.*, w.code AS washing_code, d.code AS drying_code
  FROM bookings b
  LEFT JOIN washing_machines w ON w.id = b.washing_machine_id
  LEFT JOIN drying_machines d ON d.id = b.drying_machine_id`;

export const createBooking = async (req: AuthRequest, res: Response) => {
  try {
    const data = createBookingSchema.parse(req.body);

    if (!(await storeIsOpen())) {
      return fail(res, "Toko sedang tutup. Laundry belum bisa dipesan sekarang.", 409);
    }

    const { machineColumn, table } = machineInfo(data);
    const machine: any = await queryOne(`SELECT * FROM ${table} WHERE id = ?`, [data.machine_id]);

    if (!machine) return fail(res, "Mesin tidak ditemukan", 404);
    if (machine.status !== "AVAILABLE") {
      return fail(res, `Mesin ${machine.code} sedang ${machine.status}, pilih mesin lain`, 409);
    }

    const active: any = await queryOne(
      `SELECT id FROM bookings
       WHERE ${machineColumn} = ? AND status IN ('PENDING','CONFIRMED','IN_PROGRESS') LIMIT 1`,
      [data.machine_id]
    );
    if (active) {
      return fail(res, `Mesin ${machine.code} sedang dipakai, pilih mesin lain`, 409);
    }

    if (!req.file) {
      return fail(
        res,
        data.machine_type === "WASHING"
          ? "Foto cucian yang mau dicuci wajib diupload (field: photo)"
          : "Foto cucian yang mau dikeringkan wajib diupload (field: photo)",
        400
      );
    }
    const photoBeforeUrl = (await uploadImage(req.file.buffer, FOLDERS.photoBefore)).url;

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
      `Laundry berhasil dibuat. Silakan bayar pakai saldo.`,
      201
    );
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((issue: any) => issue.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

export const getMyBookings = async (req: AuthRequest, res: Response) => {
  await finishDueLaundry();
  const rows = await query(
    `${SELECT_BOOKING} WHERE b.user_id = ? ORDER BY b.created_at DESC`,
    [req.user!.id]
  );
  rows.forEach((row: any) => {
    row.total_price = Number(row.total_price);
  });
  return success(res, rows, "Riwayat laundry berhasil diambil");
};

export const getBookingDetail = async (req: AuthRequest, res: Response) => {
  await finishDueLaundry();
  const booking: any = await queryOne(
    `SELECT b.*, u.full_name, u.phone FROM bookings b JOIN users u ON u.id = b.user_id WHERE b.id = ?`,
    [req.params.id]
  );
  if (!booking) return fail(res, "Laundry tidak ditemukan", 404);
  if (booking.user_id !== req.user!.id && req.user!.role !== "ADMIN") {
    return fail(res, "Laundry ini bukan milikmu", 403);
  }
  booking.total_price = Number(booking.total_price);
  return success(res, booking, "Detail laundry berhasil diambil");
};

export const getAllBookings = async (_req: AuthRequest, res: Response) => {
  await finishDueLaundry();
  const rows = await query(
    `SELECT b.*, u.full_name, u.email FROM bookings b JOIN users u ON u.id = b.user_id
     ORDER BY b.created_at DESC`
  );
  rows.forEach((row: any) => {
    row.total_price = Number(row.total_price);
  });
  return success(res, rows, "Semua laundry berhasil diambil");
};

export const payBooking = async (req: AuthRequest, res: Response) => {
  const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
  if (!booking) return fail(res, "Laundry tidak ditemukan", 404);
  if (booking.user_id !== req.user!.id) return fail(res, "Laundry ini bukan milikmu", 403);
  if (booking.status !== "PENDING") {
    return fail(res, `Laundry sudah berstatus ${booking.status}, tidak bisa dibayar lagi`, 409);
  }

  const { machineColumn, table } = machineInfo(booking);
  try {
    const data = await withTransaction(async (conn) => {
      const [userRows]: any = await conn.query(
        "SELECT balance FROM users WHERE id = ? FOR UPDATE",
        [req.user!.id]
      );
      const before = Number(userRows[0].balance);
      const amount = Number(booking.total_price);
      if (before < amount) {
        throw new Error(`Saldo tidak cukup. Saldo: Rp${before}, total: Rp${amount}. Top up dulu.`);
      }
      const after = before - amount;

      await conn.query("UPDATE users SET balance = ? WHERE id = ?", [after, req.user!.id]);
      await conn.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
         VALUES (?, 'PAYMENT', ?, ?, ?, 'BOOKING', ?, ?)`,
        [req.user!.id, amount, before, after, booking.id, `Bayar laundry #${booking.id}`]
      );
      await conn.query(
        "UPDATE bookings SET status = 'CONFIRMED', paid_at = NOW() WHERE id = ?",
        [booking.id]
      );
      await conn.query(`UPDATE ${table} SET status = 'BOOKED' WHERE id = ?`, [booking[machineColumn]]);

      return {
        booking_id: booking.id,
        status: "CONFIRMED",
        paid: amount,
        balance_before: before,
        balance_after: after,
      };
    });

    return success(res, data, "Laundry berhasil dibayar, siap dimulai");
  } catch (err: any) {
    if (err instanceof Error) return fail(res, err.message, 400);
    console.error(err);
    return fail(res);
  }
};

export const cancelBooking = async (req: AuthRequest, res: Response) => {
  const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
  if (!booking) return fail(res, "Laundry tidak ditemukan", 404);
  if (booking.user_id !== req.user!.id && req.user!.role !== "ADMIN") {
    return fail(res, "Laundry ini bukan milikmu", 403);
  }
  if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
    return fail(res, `Laundry berstatus ${booking.status}, tidak bisa dibatalkan`, 409);
  }

  const { machineColumn, table } = machineInfo(booking);
  const data = await withTransaction(async (conn) => {
    const refund = await refundBooking(conn, booking, `Refund pembatalan laundry #${booking.id}`);
    await conn.query("UPDATE bookings SET status = 'CANCELLED' WHERE id = ?", [booking.id]);
    await conn.query(`UPDATE ${table} SET status = 'AVAILABLE' WHERE id = ?`, [booking[machineColumn]]);
    return { booking_id: booking.id, status: "CANCELLED", refunded: refund };
  });

  return success(res, data, "Laundry berhasil dibatalkan");
};

export const startLaundry = async (req: AuthRequest, res: Response) => {
  const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
  if (!booking) return fail(res, "Laundry tidak ditemukan", 404);
  if (booking.user_id !== req.user!.id && req.user!.role === "USER") {
    return fail(res, "Laundry ini bukan milikmu", 403);
  }
  if (booking.status !== "CONFIRMED") {
    return fail(res, "Laundry hanya bisa dimulai setelah dibayar", 409);
  }
  if (!req.file) return fail(res, "Foto wajib diupload (field: photo)", 400);

  const image = await uploadImage(req.file.buffer, FOLDERS.photoStart);
  const startTime = nowWibTime();
  const endTime = addMinutesToTime(startTime, DURATION_MINUTES);
  const { machineColumn, table } = machineInfo(booking);

  await withTransaction(async (conn) => {
    await conn.query(
      `UPDATE bookings
       SET photo_arrived_url = ?, status = 'IN_PROGRESS', started_at = NOW(), finished_at = NULL,
           booking_date = ?, start_time = ?, end_time = ?
       WHERE id = ?`,
      [image.url, todayWib(), startTime, endTime, booking.id]
    );
    await conn.query(`UPDATE ${table} SET status = 'IN_USE' WHERE id = ?`, [booking[machineColumn]]);
  });

  return success(
    res,
    {
      booking_id: booking.id,
      photo_arrived_url: image.url,
      status: "IN_PROGRESS",
      started_at: new Date().toISOString(),
      duration_minutes: DURATION_MINUTES,
    },
    "Laundry dimulai, mesin berjalan 25 menit"
  );
};

export const updateBookingStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = updateStatusSchema.parse(req.body);
    const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
    if (!booking) return fail(res, "Laundry tidak ditemukan", 404);

    const { machineColumn, table } = machineInfo(booking);
    const fields: string[] = ["status = ?"];
    const params: any[] = [status];
    if (status === "IN_PROGRESS" && !booking.started_at) {
      fields.push("started_at = NOW()");
    }
    if (status === "COMPLETED") {
      fields.push("finished_at = NOW()");
    }
    await pool.query(`UPDATE bookings SET ${fields.join(", ")} WHERE id = ?`, [...params, booking.id]);

    if (["COMPLETED", "CANCELLED"].includes(status)) {
      await pool.query(`UPDATE ${table} SET status = 'AVAILABLE' WHERE id = ?`, [booking[machineColumn]]);
    } else if (status === "IN_PROGRESS") {
      await pool.query(`UPDATE ${table} SET status = 'IN_USE' WHERE id = ?`, [booking[machineColumn]]);
    }
    return success(res, { booking_id: booking.id, status }, "Status laundry diperbarui");
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((issue: any) => issue.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

export const deleteBooking = async (req: AuthRequest, res: Response) => {
  const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
  if (!booking) return fail(res, "Laundry tidak ditemukan", 404);

  const { machineColumn, table } = machineInfo(booking);
  const data = await withTransaction(async (conn) => {
    const refund = await refundBooking(conn, booking, `Refund hapus laundry #${booking.id} oleh admin`);
    await conn.query("DELETE FROM bookings WHERE id = ?", [booking.id]);
    await conn.query(`UPDATE ${table} SET status = 'AVAILABLE' WHERE id = ?`, [booking[machineColumn]]);
    return { booking_id: booking.id, deleted: true, refunded: refund };
  });

  return success(res, data, "Laundry berhasil dihapus permanen oleh admin");
};
