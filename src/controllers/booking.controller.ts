import { Response } from "express";
import { pool, query, queryOne, withTransaction } from "../config/database";
import { success, fail } from "../utils/response";
import { badRequest, notFound, forbidden } from "../utils/httpError";
import { uploadImage, FOLDERS } from "../utils/cloudinary.util";
import { createBookingSchema, updateStatusSchema } from "../validators";
import { AuthRequest } from "../middlewares/auth.middleware";

const WASH_DURATION_MINUTES = 25; // durasi pencucian 25 menit
const OPEN_HOUR = 10;             // jam operasional mulai 10.00
const CLOSE_HOUR = 15;            // jam operasional sampai 15.00

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const minutesToTime = (total: number): string => {
  const h = String(Math.floor(total / 60)).padStart(2, "0");
  const m = String(total % 60).padStart(2, "0");
  return `${h}:${m}:00`;
};

/** POST /api/v1/bookings (multipart: photo = foto cucian yang mau dicuci) */
export const createBooking = async (req: AuthRequest, res: Response) => {
  try {
    const data = createBookingSchema.parse(req.body);

    // 1. Ambil mesin sesuai tipe
    const table = data.machine_type === "WASHING" ? "washing_machines" : "drying_machines";
    const col = data.machine_type === "WASHING" ? "washing_machine_id" : "drying_machine_id";
    const machine: any = await queryOne(
      `SELECT * FROM ${table} WHERE id = ?`,
      [data.machine_id]
    );
    if (!machine) return notFound(`${data.machine_type === "WASHING" ? "Mesin cuci" : "Mesin pengering"} tidak ditemukan`);
    if (machine.status !== "AVAILABLE") {
      return fail(res, `Mesin ${machine.code} sedang ${machine.status}, pilih mesin lain`, 409);
    }

    // 2. Validasi berat untuk mesin cuci (max = kapasitas mesin)
    if (data.machine_type === "WASHING") {
      if (data.weight_kg! > machine.capacity_kg) {
        return badRequest(`Berat maksimal mesin ${machine.code} adalah ${machine.capacity_kg} kg`);
      }
    }

    // 3. Validasi tanggal & jam operasional (10.00 - 15.00)
    const dateStr = data.booking_date;
    const startMin = toMinutes(data.start_time);
    const duration =
      data.machine_type === "WASHING" ? WASH_DURATION_MINUTES : machine.duration_minutes;
    const endMin = startMin + duration;

    if (startMin < OPEN_HOUR * 60 || endMin > CLOSE_HOUR * 60) {
      return badRequest("Jam operasional hanya pukul 10.00 - 15.00");
    }

    // 4. Booking minimal 1 jam sebelum waktu penggunaan & tidak boleh di masa lalu
    const bookingDateTime = new Date(`${dateStr}T${data.start_time}:00`);
    const nowPlusOne = new Date(Date.now() + 60 * 60 * 1000);
    if (bookingDateTime < nowPlusOne) {
      return badRequest("Booking harus dilakukan minimal 1 jam sebelum waktu penggunaan");
    }

    // 5. Harga dihitung backend (bukan dari frontend)
    const totalPrice =
      data.machine_type === "WASHING"
        ? Math.round(data.weight_kg! * Number(machine.price_per_kg))
        : Number(machine.price_per_use);

    // 6. Cek slot: 1 mesin tidak boleh punya 2 booking pada waktu yang sama
    const overlap = await queryOne(
      `SELECT id FROM bookings
       WHERE ${col} = ? AND booking_date = ? AND status <> 'CANCELLED'
         AND start_time < ? AND end_time > ?`,
      [data.machine_id, dateStr, minutesToTime(endMin), minutesToTime(startMin)]
    );
    if (overlap) {
      return fail(res, `Mesin ${machine.code} sudah dibooking di jam tersebut`, 409);
    }

    // 7. Upload foto cucian (folder Cloudinary: nyucik/bookings/before)
    //    Wajib untuk mesin cuci, optional untuk pengering
    let photoBeforeUrl: string | null = null;
    if (req.file) {
      const img = await uploadImage(req.file.buffer, FOLDERS.bookingBefore);
      photoBeforeUrl = img.url;
    } else if (data.machine_type === "WASHING") {
      return badRequest("Foto cucian yang mau dicuci wajib diupload (field: photo)");
    }

    // 8. Simpan booking (status PENDING, belum dibayar)
    const result: any = await pool.query(
      `INSERT INTO bookings
       (user_id, machine_type, washing_machine_id, drying_machine_id, booking_date,
        start_time, end_time, weight_kg, total_price, status, photo_before_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [
        req.user!.id, data.machine_type,
        data.machine_type === "WASHING" ? data.machine_id : null,
        data.machine_type === "DRYING" ? data.machine_id : null,
        dateStr, minutesToTime(startMin), minutesToTime(endMin),
        data.weight_kg ?? null, totalPrice, photoBeforeUrl,
      ]
    );

    const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [result[0].insertId]);
    booking.total_price = Number(booking.total_price);

    return success(
      res,
      { ...booking, machine_code: machine.code },
      "Booking berhasil dibuat. Bayar pakai saldo: POST /api/v1/bookings/" + booking.id + "/pay",
      201
    );
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

/** GET /api/v1/bookings/my */
export const getMyBookings = async (req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT b.*, w.code AS washing_code, d.code AS drying_code
     FROM bookings b
     LEFT JOIN washing_machines w ON w.id = b.washing_machine_id
     LEFT JOIN drying_machines d ON d.id = b.drying_machine_id
     WHERE b.user_id = ? ORDER BY b.created_at DESC`,
    [req.user!.id]
  );
  rows.forEach((r: any) => { r.total_price = Number(r.total_price); });
  return success(res, rows, "Riwayat booking berhasil diambil");
};

/** GET /api/v1/bookings/:id */
export const getBookingDetail = async (req: AuthRequest, res: Response) => {
  const booking: any = await queryOne(
    `SELECT b.*, u.full_name, u.phone, w.code AS washing_code, d.code AS drying_code
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     LEFT JOIN washing_machines w ON w.id = b.washing_machine_id
     LEFT JOIN drying_machines d ON d.id = b.drying_machine_id
     WHERE b.id = ?`,
    [req.params.id]
  );
  if (!booking) return notFound("Booking tidak ditemukan");
  if (booking.user_id !== req.user!.id && req.user!.role !== "ADMIN") {
    return forbidden("Booking ini bukan milikmu");
  }
  booking.total_price = Number(booking.total_price);
  return success(res, booking, "Detail booking berhasil diambil");
};

/** POST /api/v1/bookings/:id/pay - bayar booking pakai saldo (aman: DB transaction) */
export const payBooking = async (req: AuthRequest, res: Response) => {
  const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
  if (!booking) return notFound("Booking tidak ditemukan");
  if (booking.user_id !== req.user!.id) return forbidden("Booking ini bukan milikmu");
  if (booking.status !== "PENDING") {
    return fail(res, `Booking sudah berstatus ${booking.status}, tidak bisa dibayar lagi`, 409);
  }

  const col = booking.machine_type === "WASHING" ? "washing_machine_id" : "drying_machine_id";
  const machineId = booking[col];

  const data = await withTransaction(async (conn) => {
    // Lock saldo user agar tidak bisa double-spend
    const [userRows]: any = await conn.query("SELECT balance FROM users WHERE id = ? FOR UPDATE", [req.user!.id]);
    const balance = Number(userRows[0].balance);
    const price = Number(booking.total_price);

    if (balance < price) {
      throw badRequest(`Saldo tidak cukup. Saldo: Rp${balance}, total: Rp${price}. Top up dulu.`);
    }

    const before = balance;
    const after = balance - price;

    await conn.query("UPDATE users SET balance = ? WHERE id = ?", [after, req.user!.id]);
    await conn.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
       VALUES (?, 'PAYMENT', ?, ?, ?, 'BOOKING', ?, ?)`,
      [req.user!.id, price, before, after, booking.id, `Bayar booking #${booking.id}`]
    );
    await conn.query(
      "UPDATE bookings SET status = 'CONFIRMED', paid_at = NOW() WHERE id = ?",
      [booking.id]
    );
    await conn.query(
      `UPDATE ${booking.machine_type === "WASHING" ? "washing_machines" : "drying_machines"}
       SET status = 'BOOKED' WHERE id = ?`,
      [machineId]
    );

    return { booking_id: booking.id, status: "CONFIRMED", paid: price, balance_before: before, balance_after: after };
  });

  return success(res, data, "Booking berhasil dibayar & dikonfirmasi");
};

/** POST /api/v1/bookings/:id/cancel */
export const cancelBooking = async (req: AuthRequest, res: Response) => {
  const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
  if (!booking) return notFound("Booking tidak ditemukan");
  if (booking.user_id !== req.user!.id && req.user!.role !== "ADMIN") {
    return forbidden("Booking ini bukan milikmu");
  }
  if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
    return fail(res, `Booking berstatus ${booking.status}, tidak bisa dibatalkan`, 409);
  }

  // Cek waktu: minimal 1 jam sebelum jadwal
  const startDateTime = new Date(
    `${booking.booking_date.toISOString().slice(0, 10)}T${String(booking.start_time).slice(0, 5)}:00`
  );
  if (startDateTime < new Date(Date.now() + 60 * 60 * 1000)) {
    return badRequest("Pembatalan hanya bisa minimal 1 jam sebelum waktu penggunaan");
  }

  const col = booking.machine_type === "WASHING" ? "washing_machine_id" : "drying_machine_id";
  const machineTable = booking.machine_type === "WASHING" ? "washing_machines" : "drying_machines";

  const data = await withTransaction(async (conn) => {
    // Refund kalau sudah dibayar (CONFIRMED)
    let refund = 0;
    if (booking.status === "CONFIRMED") {
      const [userRows]: any = await conn.query("SELECT balance FROM users WHERE id = ? FOR UPDATE", [booking.user_id]);
      const before = Number(userRows[0].balance);
      refund = Number(booking.total_price);
      const after = before + refund;

      await conn.query("UPDATE users SET balance = ? WHERE id = ?", [after, booking.user_id]);
      await conn.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
         VALUES (?, 'REFUND', ?, ?, ?, 'BOOKING', ?, ?)`,
        [booking.user_id, refund, before, after, booking.id, `Refund pembatalan booking #${booking.id}`]
      );
    }

    await conn.query("UPDATE bookings SET status = 'CANCELLED' WHERE id = ?", [booking.id]);
    await conn.query(
      `UPDATE ${machineTable} SET status = 'AVAILABLE' WHERE id = ?`,
      [booking[col]]
    );

    return { booking_id: booking.id, status: "CANCELLED", refunded: refund };
  });

  return success(res, data, "Booking berhasil dibatalkan");
};

/** POST /api/v1/bookings/:id/arrival-photo (multipart: photo)
 *  Foto bukti sudah sampai di tempat penyucian -> folder Cloudinary: nyucik/bookings/arrived */
export const uploadArrivalPhoto = async (req: AuthRequest, res: Response) => {
  const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
  if (!booking) return notFound("Booking tidak ditemukan");
  if (booking.user_id !== req.user!.id) return forbidden("Booking ini bukan milikmu");
  if (!["CONFIRMED", "IN_PROGRESS"].includes(booking.status)) {
    return fail(res, "Upload foto hanya untuk booking yang sudah dibayar", 409);
  }
  if (!req.file) return badRequest("Foto wajib diupload (field: photo)");

  const img = await uploadImage(req.file.buffer, FOLDERS.bookingArrived);

  const newStatus = "IN_PROGRESS";
  await pool.query(
    "UPDATE bookings SET photo_arrived_url = ?, status = ? WHERE id = ?",
    [img.url, newStatus, booking.id]
  );

  const col = booking.machine_type === "WASHING" ? "washing_machine_id" : "drying_machine_id";
  await pool.query(
    `UPDATE ${booking.machine_type === "WASHING" ? "washing_machines" : "drying_machines"}
     SET status = 'IN_USE' WHERE id = ?`,
    [booking[col]]
  );

  return success(res, { booking_id: booking.id, photo_arrived_url: img.url, status: newStatus }, "Foto bukti tiba berhasil diupload, cucian dimulai");
};

// ==================== ADMIN ====================

/** GET /api/v1/bookings (admin) */
export const getAllBookings = async (_req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT b.*, u.full_name, u.email, w.code AS washing_code, d.code AS drying_code
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     LEFT JOIN washing_machines w ON w.id = b.washing_machine_id
     LEFT JOIN drying_machines d ON d.id = b.drying_machine_id
     ORDER BY b.created_at DESC`
  );
  rows.forEach((r: any) => { r.total_price = Number(r.total_price); });
  return success(res, rows, "Semua booking berhasil diambil");
};

/** PATCH /api/v1/bookings/:id/status (admin) */
export const updateBookingStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = updateStatusSchema.parse(req.body);
    const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
    if (!booking) return notFound("Booking tidak ditemukan");

    const col = booking.machine_type === "WASHING" ? "washing_machine_id" : "drying_machine_id";
    const machineTable = booking.machine_type === "WASHING" ? "washing_machines" : "drying_machines";

    await pool.query("UPDATE bookings SET status = ? WHERE id = ?", [status, booking.id]);

    // Mesin kembali AVAILABLE kalau selesai/dibatalkan
    if (["COMPLETED", "CANCELLED"].includes(status)) {
      await pool.query(`UPDATE ${machineTable} SET status = 'AVAILABLE' WHERE id = ?`, [booking[col]]);
    }

    return success(res, { booking_id: booking.id, status }, "Status booking diperbarui");
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};
