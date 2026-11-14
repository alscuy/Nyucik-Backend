import { Response } from "express";
import { pool, query, queryOne, withTransaction } from "../config/database";
import { success, fail } from "../utils/response";
import { badRequest, notFound, forbidden } from "../utils/httpError";
import { uploadImage, FOLDERS } from "../utils/cloudinary.util";
import { createBookingSchema, updateStatusSchema, updateBookingSchema } from "../validators";
import { AuthRequest } from "../middlewares/auth.middleware";

const WASH_DURATION_MINUTES = 25; // durasi pencucian 25 menit
const OPEN_HOUR = 10;             // jam operasional mulai 10.00
const CLOSE_HOUR = 15;            // jam operasional sampai 15.00
const CANCEL_BEFORE_MINUTES = 30; // batal boleh sampai H-30 menit sebelum jadwal
const ARRIVAL_WINDOW_MINUTES = 10;// konfirmasi tiba harus dalam 10 menit sejak jadwal
const RESCHEDULE_BEFORE_MINUTES = 60; // ubah jadwal minimal 1 jam sebelum jadwal

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const minutesToTime = (total: number): string => {
  const h = String(Math.floor(total / 60)).padStart(2, "0");
  const m = String(total % 60).padStart(2, "0");
  return `${h}:${m}:00`;
};

/** Gabungkan booking_date + start_time (string MySQL) jadi Date zona WIB */
const startDateTimeOf = (booking: any): Date =>
  new Date(`${booking.booking_date}T${String(booking.start_time).slice(0, 5)}:00+07:00`);

/** Auto-expire: booking CONFIRMED yang tidak dikonfirmasi tiba dalam 10 menit
 *  sejak jadwal -> langsung dibatalkan otomatis + refund saldo + mesin AVAILABLE.
 *  Return true kalau booking baru saja di-expire. */
export const autoExpireBooking = async (booking: any): Promise<boolean> => {
  if (booking.status !== "CONFIRMED") return false;
  const deadline =
    startDateTimeOf(booking).getTime() + ARRIVAL_WINDOW_MINUTES * 60 * 1000;
  if (Date.now() <= deadline) return false;

  const col = booking.machine_type === "WASHING" ? "washing_machine_id" : "drying_machine_id";
  const machineTable = booking.machine_type === "WASHING" ? "washing_machines" : "drying_machines";

  await withTransaction(async (conn) => {
    const [userRows]: any = await conn.query(
      "SELECT balance FROM users WHERE id = ? FOR UPDATE",
      [booking.user_id]
    );
    const before = Number(userRows[0].balance);
    const refund = Number(booking.total_price);
    const after = before + refund;

    await conn.query("UPDATE users SET balance = ? WHERE id = ?", [after, booking.user_id]);
    await conn.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
       VALUES (?, 'REFUND', ?, ?, ?, 'BOOKING', ?, ?)`,
      [booking.user_id, refund, before, after, booking.id, `Auto-cancel booking #${booking.id}: tidak konfirmasi dalam ${ARRIVAL_WINDOW_MINUTES} menit`]
    );
    await conn.query("UPDATE bookings SET status = 'CANCELLED' WHERE id = ?", [booking.id]);
    await conn.query(`UPDATE ${machineTable} SET status = 'AVAILABLE' WHERE id = ?`, [booking[col]]);
  });

  return true;
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
    // (pakai zona WIB eksplisit biar hasilnya sama di localhost maupun server)
    const bookingDateTime = new Date(`${dateStr}T${data.start_time}:00+07:00`);
    if (bookingDateTime.getTime() < Date.now() + 60 * 60 * 1000) {
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
  // Auto-expire booking yang kelewat konfirmasi biar statusnya selalu akurat
  for (const r of rows as any[]) {
    if (await autoExpireBooking(r)) r.status = "CANCELLED";
  }
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
  if (await autoExpireBooking(booking)) booking.status = "CANCELLED";
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

  // Kalau telat konfirmasi (>10 menit sejak jadwal), auto-expire dulu (+ refund)
  if (await autoExpireBooking(booking)) {
    return fail(res, `Booking #${booking.id} sudah otomatis dibatalkan karena tidak konfirmasi dalam ${ARRIVAL_WINDOW_MINUTES} menit. Saldo sudah dikembalikan.`, 409);
  }

  if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
    return fail(res, `Booking berstatus ${booking.status}, tidak bisa dibatalkan`, 409);
  }

  // Cek waktu: batal hanya bisa sampai 30 menit sebelum jadwal mulai
  if (startDateTimeOf(booking).getTime() < Date.now() + CANCEL_BEFORE_MINUTES * 60 * 1000) {
    return badRequest(`Pembatalan hanya bisa sampai ${CANCEL_BEFORE_MINUTES} menit sebelum jadwal mulai`);
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

  // Window konfirmasi: hanya berlaku untuk booking CONFIRMED (IN_PROGRESS = sudah mulai)
  if (booking.status === "CONFIRMED") {
    const start = startDateTimeOf(booking).getTime();
    const deadline = start + ARRIVAL_WINDOW_MINUTES * 60 * 1000;
    const now = Date.now();

    // Lewat 10 menit -> booking auto dibatalkan + refund
    if (now > deadline) {
      await autoExpireBooking(booking);
      return fail(res, `Konfirmasi hanya bisa dalam ${ARRIVAL_WINDOW_MINUTES} menit sejak jadwal. Booking #${booking.id} otomatis dibatalkan & saldo dikembalikan.`, 409);
    }
    // Belum masuk jadwal -> belum boleh konfirmasi
    if (now < start) {
      const s = startDateTimeOf(booking);
      const hhmm = `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`;
      return fail(res, `Belum waktunya. Konfirmasi tiba hanya bisa mulai pukul ${hhmm} WIB sampai ${ARRIVAL_WINDOW_MINUTES} menit berikutnya`, 409);
    }
  }

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

/** PATCH /api/v1/bookings/:id (user: reschedule tanggal &/atau jam)
 *  Syarat: masih PENDING/CONFIRMED, belum melewati H-1 jam jadwal LAMA, jadwal BARU
 *  minimal 1 jam dari sekarang, dalam jam operasional, dan mesin masih bebas di slot baru. */
export const updateBooking = async (req: AuthRequest, res: Response) => {
  try {
    const data = updateBookingSchema.parse(req.body);
    const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
    if (!booking) return notFound("Booking tidak ditemukan");
    if (booking.user_id !== req.user!.id && req.user!.role !== "ADMIN") {
      return forbidden("Booking ini bukan milikmu");
    }
    if (await autoExpireBooking(booking)) {
      return fail(res, `Booking #${booking.id} sudah otomatis dibatalkan karena tidak konfirmasi dalam ${ARRIVAL_WINDOW_MINUTES} menit`, 409);
    }
    if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
      return fail(res, `Booking berstatus ${booking.status}, tidak bisa diubah jadwalnya`, 409);
    }

    // Jadwal lama harus masih lebih dari 1 jam lagi (sama seperti aturan booking baru)
    const oldStart = startDateTimeOf(booking).getTime();
    if (oldStart < Date.now() + RESCHEDULE_BEFORE_MINUTES * 60 * 1000) {
      return badRequest("Ubah jadwal hanya bisa minimal 1 jam sebelum jadwal lama");
    }

    const dateStr = data.booking_date ?? booking.booking_date;
    const startMin = toMinutes(data.start_time ?? String(booking.start_time).slice(0, 5));

    // Jadwal baru minimal 1 jam dari sekarang
    const newStart = new Date(`${dateStr}T${String(data.start_time ?? String(booking.start_time).slice(0, 5))}:00+07:00`);
    if (newStart.getTime() < Date.now() + RESCHEDULE_BEFORE_MINUTES * 60 * 1000) {
      return badRequest("Jadwal baru harus minimal 1 jam dari sekarang");
    }

    // Slot mesin di jadwal baru tidak boleh bentrok (kecuali booking ini sendiri)
    const col = booking.machine_type === "WASHING" ? "washing_machine_id" : "drying_machine_id";
    const machine: any = await queryOne(
      `SELECT * FROM ${booking.machine_type === "WASHING" ? "washing_machines" : "drying_machines"} WHERE id = ?`,
      [booking[col]]
    );
    if (!machine) return notFound("Mesin dari booking ini tidak ditemukan");
    const dur = booking.machine_type === "WASHING" ? WASH_DURATION_MINUTES : machine.duration_minutes;
    const newEndMin = startMin + dur;
    if (startMin < OPEN_HOUR * 60 || newEndMin > CLOSE_HOUR * 60) {
      return badRequest("Jam operasional hanya pukul 10.00 - 15.00");
    }

    const overlap = await queryOne(
      `SELECT id FROM bookings
       WHERE ${col} = ? AND booking_date = ? AND status <> 'CANCELLED' AND id <> ?
         AND start_time < ? AND end_time > ?`,
      [booking[col], dateStr, booking.id, minutesToTime(newEndMin), minutesToTime(startMin)]
    );
    if (overlap) {
      return fail(res, `Mesin ${machine.code} sudah dibooking di jam tersebut, pilih jam lain`, 409);
    }

    await pool.query(
      "UPDATE bookings SET booking_date = ?, start_time = ?, end_time = ? WHERE id = ?",
      [dateStr, minutesToTime(startMin), minutesToTime(newEndMin), booking.id]
    );

    const updated: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [booking.id]);
    updated.total_price = Number(updated.total_price);
    return success(res, updated, "Jadwal booking berhasil diubah");
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

/** DELETE /api/v1/bookings/:id (admin: hapus permanen, refund kalau sudah dibayar) */
export const deleteBooking = async (req: AuthRequest, res: Response) => {
  const booking: any = await queryOne("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
  if (!booking) return notFound("Booking tidak ditemukan");

  const col = booking.machine_type === "WASHING" ? "washing_machine_id" : "drying_machine_id";
  const machineTable = booking.machine_type === "WASHING" ? "washing_machines" : "drying_machines";

  const data = await withTransaction(async (conn) => {
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
        [booking.user_id, refund, before, after, booking.id, `Refund hapus booking #${booking.id} oleh admin`]
      );
    }

    await conn.query("DELETE FROM bookings WHERE id = ?", [booking.id]);
    await conn.query(`UPDATE ${machineTable} SET status = 'AVAILABLE' WHERE id = ?`, [booking[col]]);

    return { booking_id: booking.id, deleted: true, refunded: refund };
  });

  return success(res, data, "Booking berhasil dihapus permanen oleh admin");
};
