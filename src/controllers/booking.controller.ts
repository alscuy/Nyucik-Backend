import { Response } from "express";
import { pool, query, queryOne, withTransaction } from "../config/database";
import { success, fail } from "../utils/response";
import { badRequest, notFound, forbidden } from "../utils/httpError";
import { uploadImage, FOLDERS } from "../utils/cloudinary.util";
import { createBookingSchema, updateStatusSchema, updateBookingSchema } from "../validators";
import { AuthRequest } from "../middlewares/auth.middleware";

const DURATION_MINUTES = 25;
const OPEN_HOUR = 10;
const CLOSE_HOUR = 15;
const CANCEL_BEFORE_MINUTES = 30;

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const minutesToTime = (total: number): string =>
  `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;

const machineInfo = (b: { machine_type?: string }) =>
  b.machine_type === "WASHING"
    ? { col: "washing_machine_id", table: "washing_machines" }
    : { col: "drying_machine_id", table: "drying_machines" };

const price = (v: any) => Number(v);

const slotOverlap = async (col: string, machineId: number, date: string,
  startMin: number, endMin: number, exceptId?: number) => {
  const row = await queryOne(
    `SELECT id FROM bookings
     WHERE ${col} = ? AND booking_date = ? AND status <> 'CANCELLED' ${exceptId ? "AND id <> ?" : ""}
       AND start_time < ? AND end_time > ?`,
    exceptId ? [machineId, date, exceptId, minutesToTime(endMin), minutesToTime(startMin)]
             : [machineId, date, minutesToTime(endMin), minutesToTime(startMin)]
  );
  return !!row;
};

const refundBooking = async (conn: any, booking: any, note: string) => {
  if (booking.status !== "CONFIRMED") return 0;
  const [userRows]: any = await conn.query(
    "SELECT balance FROM users WHERE id = ? FOR UPDATE", [booking.user_id]);
  const before = Number(userRows[0].balance);
  const refund = Number(booking.total_price);
  const after = before + refund;

  await conn.query("UPDATE users SET balance = ? WHERE id = ?", [after, booking.user_id]);
  await conn.query(
    `INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
     VALUES (?, 'REFUND', ?, ?, ?, 'BOOKING', ?, ?)`,
    [booking.user_id, refund, before, after, booking.id, note]);
  return refund;
};

export const createBooking = async (req: AuthRequest, res: Response) => {
  try {
    const data = createBookingSchema.parse(req.body);

    const { col } = machineInfo(data);
    const table = col === "washing_machine_id" ? "washing_machines" : "drying_machines";
    const machine: any = await queryOne(`SELECT * FROM ${table} WHERE id = ?`, [data.machine_id]);
    if (!machine) return notFound("Mesin tidak ditemukan");
    if (machine.status !== "AVAILABLE") {
      return fail(res, `Mesin ${machine.code} sedang ${machine.status}, pilih mesin lain`, 409);
    }

    const dateStr = data.booking_date;
    const startMin = toMinutes(data.start_time);
    const endMin = startMin + DURATION_MINUTES;
    if (startMin < OPEN_HOUR * 60 || endMin > CLOSE_HOUR * 60) {
      return badRequest("Jam operasional hanya pukul 10.00 - 15.00");
    }

    const bookingDateTime = new Date(`${dateStr}T${data.start_time}:00+07:00`);
    if (bookingDateTime.getTime() < Date.now()) {
      return badRequest("Tidak bisa booking waktu yang sudah lewat");
    }

    if (await slotOverlap(col, data.machine_id, dateStr, startMin, endMin)) {
      return fail(res, `Mesin ${machine.code} sudah dibooking di jam tersebut`, 409);
    }

    const totalPrice = Number(machine.price_per_use);

    let photoBeforeUrl: string | null = null;
    if (req.file) {
      photoBeforeUrl = (await uploadImage(req.file.buffer, FOLDERS.bookingBefore)).url;
    } else if (data.machine_type === "WASHING") {
      return badRequest("Foto cucian yang mau dicuci wajib diupload (field: photo)");
    }

    const result: any = await pool.query(
      `INSERT INTO bookings
       (user_id, machine_type, washing_machine_id, drying_machine_id, booking_date,
        start_time, end_time, total_price, status, photo_before_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [
        req.user!.id, data.machine_type,
        data.machine_type === "WASHING" ? data.machine_id : null,
        data.machine_type === "DRYING" ? data.machine_id : null,
        dateStr, minutesToTime(startMin), minutesToTime(endMin),
        totalPrice, photoBeforeUrl,
      ]
    );

    const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [result[0].insertId]);
    booking.total_price = price(booking.total_price);
    return success(res, { ...booking, machine_code: machine.code },
      "Booking berhasil dibuat. Bayar pakai saldo: POST /api/v1/bookings/" + booking.id + "/pay", 201);
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

const SELECT_BOOKING = `SELECT b.*, w.code AS washing_code, d.code AS drying_code
  FROM bookings b
  LEFT JOIN washing_machines w ON w.id = b.washing_machine_id
  LEFT JOIN drying_machines d ON d.id = b.drying_machine_id`;

export const getMyBookings = async (req: AuthRequest, res: Response) => {
  const rows = await query(`${SELECT_BOOKING} WHERE b.user_id = ? ORDER BY b.created_at DESC`, [req.user!.id]);
  rows.forEach((r: any) => { r.total_price = price(r.total_price); });
  return success(res, rows, "Riwayat booking berhasil diambil");
};

export const getBookingDetail = async (req: AuthRequest, res: Response) => {
  const booking: any = await queryOne(
    `SELECT b.*, u.full_name, u.phone FROM bookings b JOIN users u ON u.id = b.user_id WHERE b.id = ?`,
    [req.params.id]);
  if (!booking) return notFound("Booking tidak ditemukan");
  if (booking.user_id !== req.user!.id && req.user!.role !== "ADMIN") {
    return forbidden("Booking ini bukan milikmu");
  }
  booking.total_price = price(booking.total_price);
  return success(res, booking, "Detail booking berhasil diambil");
};

export const payBooking = async (req: AuthRequest, res: Response) => {
  const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
  if (!booking) return notFound("Booking tidak ditemukan");
  if (booking.user_id !== req.user!.id) return forbidden("Booking ini bukan milikmu");
  if (booking.status !== "PENDING") {
    return fail(res, `Booking sudah berstatus ${booking.status}, tidak bisa dibayar lagi`, 409);
  }

  const { col, table } = machineInfo(booking);
  const data = await withTransaction(async (conn) => {

    const [userRows]: any = await conn.query(
      "SELECT balance FROM users WHERE id = ? FOR UPDATE", [req.user!.id]);
    const before = Number(userRows[0].balance);
    const amount = Number(booking.total_price);
    if (before < amount) {
      throw badRequest(`Saldo tidak cukup. Saldo: Rp${before}, total: Rp${amount}. Top up dulu.`);
    }
    const after = before - amount;

    await conn.query("UPDATE users SET balance = ? WHERE id = ?", [after, req.user!.id]);
    await conn.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
       VALUES (?, 'PAYMENT', ?, ?, ?, 'BOOKING', ?, ?)`,
      [req.user!.id, amount, before, after, booking.id, `Bayar booking #${booking.id}`]);
    await conn.query(
      "UPDATE bookings SET status = 'CONFIRMED', paid_at = NOW() WHERE id = ?", [booking.id]);
    await conn.query(`UPDATE ${table} SET status = 'BOOKED' WHERE id = ?`, [booking[col]]);

    return { booking_id: booking.id, status: "CONFIRMED", paid: amount, balance_before: before, balance_after: after };
  });

  return success(res, data, "Booking berhasil dibayar & dikonfirmasi");
};

export const cancelBooking = async (req: AuthRequest, res: Response) => {
  const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
  if (!booking) return notFound("Booking tidak ditemukan");
  if (booking.user_id !== req.user!.id && req.user!.role !== "ADMIN") {
    return forbidden("Booking ini bukan milikmu");
  }
  if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
    return fail(res, `Booking berstatus ${booking.status}, tidak bisa dibatalkan`, 409);
  }

  const start = new Date(`${booking.booking_date}T${String(booking.start_time).slice(0, 5)}:00+07:00`);
  if (start.getTime() < Date.now() + CANCEL_BEFORE_MINUTES * 60 * 1000) {
    return badRequest(`Pembatalan hanya bisa sampai ${CANCEL_BEFORE_MINUTES} menit sebelum jadwal mulai`);
  }

  const { col, table } = machineInfo(booking);
  const data = await withTransaction(async (conn) => {
    const refund = await refundBooking(conn, booking, `Refund pembatalan booking #${booking.id}`);
    await conn.query("UPDATE bookings SET status = 'CANCELLED' WHERE id = ?", [booking.id]);
    await conn.query(`UPDATE ${table} SET status = 'AVAILABLE' WHERE id = ?`, [booking[col]]);
    return { booking_id: booking.id, status: "CANCELLED", refunded: refund };
  });

  return success(res, data, "Booking berhasil dibatalkan");
};

export const uploadArrivalPhoto = async (req: AuthRequest, res: Response) => {
  const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
  if (!booking) return notFound("Booking tidak ditemukan");
  if (booking.user_id !== req.user!.id) return forbidden("Booking ini bukan milikmu");
  if (booking.status !== "CONFIRMED") {
    return fail(res, "Upload foto hanya untuk booking yang sudah dibayar", 409);
  }
  if (!req.file) return badRequest("Foto wajib diupload (field: photo)");

  const img = await uploadImage(req.file.buffer, FOLDERS.bookingArrived);
  await pool.query("UPDATE bookings SET photo_arrived_url = ?, status = 'IN_PROGRESS' WHERE id = ?",
    [img.url, booking.id]);

  const { col, table } = machineInfo(booking);
  await pool.query(`UPDATE ${table} SET status = 'IN_USE' WHERE id = ?`, [booking[col]]);

  return success(res, { booking_id: booking.id, photo_arrived_url: img.url, status: "IN_PROGRESS" },
    "Foto bukti tiba berhasil diupload, cucian dimulai");
};

export const getAllBookings = async (_req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT b.*, u.full_name, u.email FROM bookings b JOIN users u ON u.id = b.user_id
     ORDER BY b.created_at DESC`);
  rows.forEach((r: any) => { r.total_price = price(r.total_price); });
  return success(res, rows, "Semua booking berhasil diambil");
};

export const updateBookingStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = updateStatusSchema.parse(req.body);
    const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
    if (!booking) return notFound("Booking tidak ditemukan");

    await pool.query("UPDATE bookings SET status = ? WHERE id = ?", [status, booking.id]);

    const { col, table } = machineInfo(booking);
    if (["COMPLETED", "CANCELLED"].includes(status)) {
      await pool.query(`UPDATE ${table} SET status = 'AVAILABLE' WHERE id = ?`, [booking[col]]);
    }
    return success(res, { booking_id: booking.id, status }, "Status booking diperbarui");
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

export const updateBooking = async (req: AuthRequest, res: Response) => {
  try {
    const data = updateBookingSchema.parse(req.body);
    const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
    if (!booking) return notFound("Booking tidak ditemukan");
    if (booking.user_id !== req.user!.id && req.user!.role !== "ADMIN") {
      return forbidden("Booking ini bukan milikmu");
    }
    if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
      return fail(res, `Booking berstatus ${booking.status}, tidak bisa diubah jadwalnya`, 409);
    }

    const dateStr = data.booking_date ?? booking.booking_date;
    const startMin = toMinutes(data.start_time ?? String(booking.start_time).slice(0, 5));
    const endMin = startMin + DURATION_MINUTES;
    if (startMin < OPEN_HOUR * 60 || endMin > CLOSE_HOUR * 60) {
      return badRequest("Jam operasional hanya pukul 10.00 - 15.00");
    }

    const { col, table } = machineInfo(booking);
    const machine: any = await queryOne(`SELECT * FROM ${table} WHERE id = ?`, [booking[col]]);
    if (!machine) return notFound("Mesin dari booking ini tidak ditemukan");

    if (await slotOverlap(col, booking[col], dateStr, startMin, endMin, booking.id)) {
      return fail(res, `Mesin ${machine.code} sudah dibooking di jam tersebut, pilih jam lain`, 409);
    }

    await pool.query(
      "UPDATE bookings SET booking_date = ?, start_time = ?, end_time = ? WHERE id = ?",
      [dateStr, minutesToTime(startMin), minutesToTime(endMin), booking.id]);

    const updated: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [booking.id]);
    updated.total_price = price(updated.total_price);
    return success(res, updated, "Jadwal booking berhasil diubah");
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

export const deleteBooking = async (req: AuthRequest, res: Response) => {
  const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
  if (!booking) return notFound("Booking tidak ditemukan");

  const { col, table } = machineInfo(booking);
  const data = await withTransaction(async (conn) => {
    const refund = await refundBooking(conn, booking, `Refund hapus booking #${booking.id} oleh admin`);
    await conn.query("DELETE FROM bookings WHERE id = ?", [booking.id]);
    await conn.query(`UPDATE ${table} SET status = 'AVAILABLE' WHERE id = ?`, [booking[col]]);
    return { booking_id: booking.id, deleted: true, refunded: refund };
  });

  return success(res, data, "Booking berhasil dihapus permanen oleh admin");
};
