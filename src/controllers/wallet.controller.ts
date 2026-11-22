import { Response } from "express";
import { pool, query, queryOne, withTransaction, parseWib } from "../config/database";
import { success, fail } from "../utils/response";
import { badRequest } from "../utils/http-error";
import {
  createKipayTransaction,
  getKipayTransaction,
  kipayEnabled,
  kipayPaymentUrl,
  simulateKipayTransaction,
} from "../utils/kipay.util";
import { AuthRequest } from "../middlewares/auth.middleware";

const MIN_TOPUP = 10000;
const MAX_TOPUP = 10000000;

/// Format tanggal WIB "YYYY-MM-DD HH:mm:ss" untuk kolom DATETIME.
const wibDateTime = (date: Date): string =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

const hasExpired = (value?: string | null): boolean => {
  const expiresAt = parseWib(value);
  return expiresAt !== null && expiresAt.getTime() <= Date.now();
};

export const getBalance = async (req: AuthRequest, res: Response) => {
  const user: any = await queryOne("SELECT balance FROM users WHERE id = ?", [req.user!.id]);
  return success(res, { balance: Number(user.balance) }, "Saldo berhasil diambil");
};

export const getWalletTransactions = async (req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT id, type, amount, balance_before, balance_after, reference_type,
            reference_id, description, created_at
     FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC`,
    [req.user!.id]
  );
  rows.forEach((row: any) => {
    row.amount = Number(row.amount);
    row.balance_before = Number(row.balance_before);
    row.balance_after = Number(row.balance_after);
  });
  return success(res, rows, "Riwayat saldo berhasil diambil");
};

const creditTopUp = async (topUp: any) =>
  withTransaction(async (conn) => {
    const [locked]: any = await conn.query(
      "SELECT status FROM top_ups WHERE id = ? FOR UPDATE",
      [topUp.id]
    );
    if (locked[0].status === "PAID") {
      const [current]: any = await conn.query("SELECT balance FROM users WHERE id = ?", [
        topUp.user_id,
      ]);
      return { credited: false, balance: Number(current[0].balance) };
    }

    const [userRow]: any = await conn.query(
      "SELECT balance FROM users WHERE id = ? FOR UPDATE",
      [topUp.user_id]
    );
    const before = Number(userRow[0].balance);
    const after = before + Number(topUp.amount);

    await conn.query("UPDATE top_ups SET status = 'PAID', paid_at = NOW() WHERE id = ?", [
      topUp.id,
    ]);
    await conn.query("UPDATE users SET balance = ? WHERE id = ?", [after, topUp.user_id]);
    await conn.query(
      `INSERT INTO wallet_transactions
       (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
       VALUES (?, 'TOPUP', ?, ?, ?, 'TOPUP', ?, ?)`,
      [
        topUp.user_id,
        topUp.amount,
        before,
        after,
        topUp.id,
        `Top up saldo via QRIS KiPay (${topUp.reference})`,
      ]
    );
    return { credited: true, balance: after };
  });

export const createTopUp = async (req: AuthRequest, res: Response) => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || isNaN(amount)) return badRequest("Nominal top up wajib diisi");
    if (amount < MIN_TOPUP) return badRequest(`Minimal top up Rp${MIN_TOPUP.toLocaleString("id-ID")}`);
    if (amount > MAX_TOPUP) return badRequest(`Maksimal top up Rp${MAX_TOPUP.toLocaleString("id-ID")}`);

    if (!kipayEnabled()) {
      return fail(res, "Pembayaran QRIS belum dikonfigurasi di server", 503);
    }

    const note = `NYUCIK-TOPUP-${req.user!.id}-${Date.now()}`;
    const trx = await createKipayTransaction(amount, note);
    const expiresAt =
      trx.expiresAt ||
      wibDateTime(new Date(Date.now() + 15 * 60_000));
    const paymentUrl = kipayPaymentUrl();

    const result: any = await pool.query(
      `INSERT INTO top_ups
       (user_id, reference, amount, status, qr_string, provider, provider_ref,
        provider_ext, provider_date, expires_at)
       VALUES (?, ?, ?, 'PENDING', ?, 'KIPAY', ?, ?, ?, ?)`,
      [
        req.user!.id,
        trx.trxId,
        trx.amount,
        trx.qrPayload,
        trx.trxId,
        paymentUrl,
        String(trx.uniqueCode),
        expiresAt,
      ]
    );

    return success(
      res,
      {
        id: result[0].insertId,
        top_up_id: result[0].insertId,
        reference: trx.trxId,
        amount: trx.amount,
        original_amount: trx.requestedAmount,
        unique_code: trx.uniqueCode,
        fee_amount: trx.feeAmount,
        fee_bearer: trx.feeBearer,
        provider: "KIPAY",
        mode: trx.mode,
        qris: trx.qrPayload,
        qr_string: trx.qrPayload,
        payment_url: paymentUrl,
        expires_at: expiresAt,
        status: "PENDING",
      },
      `QRIS dibuat. Bayar sebelum ${expiresAt.slice(11, 16)} WIB.`,
      201
    );
  } catch (err: any) {
    console.error("KiPay create error:", err?.message || err);
    return fail(res, err?.message || "Gagal membuat QRIS KiPay", 502);
  }
};

export const getTopUps = async (req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT id, reference, amount, status, qr_string, provider,
            provider_ext AS payment_url, provider_date AS unique_code,
            expires_at, paid_at, created_at
     FROM top_ups WHERE user_id = ? ORDER BY created_at DESC`,
    [req.user!.id]
  );
  rows.forEach((row: any) => {
    row.amount = Number(row.amount);
    row.unique_code = Number(row.unique_code || 0);
  });
  return success(res, rows, "Riwayat top up berhasil diambil");
};

export const payTopUp = async (req: AuthRequest, res: Response) => {
  const topUp: any = await queryOne("SELECT * FROM top_ups WHERE id = ? AND user_id = ?", [
    req.params.id,
    req.user!.id,
  ]);
  if (!topUp) return fail(res, "Top up tidak ditemukan", 404);

  if (topUp.status === "PAID") {
    const user: any = await queryOne("SELECT balance FROM users WHERE id = ?", [req.user!.id]);
    return success(
      res,
      { top_up_id: topUp.id, status: "PAID", balance: Number(user.balance) },
      "Top up ini sudah dibayar"
    );
  }

  if (!["PENDING", "EXPIRED", "FAILED"].includes(topUp.status)) {
    return fail(res, "Top up ini tidak bisa dibayar", 409);
  }

  if (topUp.provider !== "KIPAY") {
    return fail(
      res,
      "Top up ini memakai metode pembayaran lama. Silakan buat top up baru.",
      409
    );
  }

  try {
    const check = await getKipayTransaction(
      topUp.provider_ref || topUp.reference
    );
    const paid = ["paid", "success", "settled"].includes(check.status);

    if (!paid) {
      const expired =
        ["expired", "failed", "cancel", "cancelled", "canceled"].includes(
          check.status
        ) ||
        hasExpired(topUp.expires_at) ||
        hasExpired(check.expiresAt);
      if (expired) {
        await pool.query("UPDATE top_ups SET status = 'EXPIRED' WHERE id = ?", [topUp.id]);
        return fail(res, "QRIS sudah kedaluwarsa. Buat QRIS baru untuk top up.", 409);
      }
      return fail(
        res,
        `Pembayaran belum masuk (${check.status || "menunggu"}). ` +
          "Selesaikan pembayaran QRIS lalu tekan Cek Pembayaran lagi.",
        409
      );
    }

    const result = await creditTopUp(topUp);
    return success(
      res,
      { top_up_id: topUp.id, status: "PAID", balance: result.balance },
      result.credited ? "Pembayaran berhasil, saldo bertambah" : "Top up ini sudah dibayar"
    );
  } catch (err: any) {
    console.error("KiPay check error:", err?.message || err);
    return fail(res, `Gagal cek pembayaran: ${err?.message || "coba lagi"}`, 502);
  }
};

/**
 * Simulasi pembayaran sandbox: tandai transaksi KiPay lunas, lalu saldo masuk.
 * Hanya untuk project sandbox (production akan ditolak oleh KiPay).
 */
export const simulateTopUp = async (req: AuthRequest, res: Response) => {
  const topUp: any = await queryOne(
    "SELECT * FROM top_ups WHERE id = ? AND user_id = ?",
    [req.params.id, req.user!.id]
  );
  if (!topUp) return fail(res, "Top up tidak ditemukan", 404);

  if (topUp.status === "PAID") {
    const user: any = await queryOne("SELECT balance FROM users WHERE id = ?", [req.user!.id]);
    return success(
      res,
      { top_up_id: topUp.id, status: "PAID", balance: Number(user.balance) },
      "Top up ini sudah dibayar"
    );
  }

  if (topUp.provider !== "KIPAY") {
    return fail(res, "Top up ini memakai metode pembayaran lama", 409);
  }

  try {
    const trxId = topUp.provider_ref || topUp.reference;
    const check = await simulateKipayTransaction(trxId);
    if (!["paid", "success", "settled"].includes(check.status)) {
      return fail(res, "Transaksi belum lunas. Coba lagi.", 409);
    }
    const result = await creditTopUp(topUp);
    return success(
      res,
      { top_up_id: topUp.id, status: "PAID", balance: result.balance },
      result.credited
        ? "Pembayaran simulasi berhasil, saldo bertambah"
        : "Top up ini sudah dibayar"
    );
  } catch (err: any) {
    console.error("KiPay simulate error:", err?.message || err);
    return fail(res, `Gagal simulasi pembayaran: ${err?.message || "coba lagi"}`, 502);
  }
};

/**
 * Batalkan top up yang masih menunggu pembayaran.
 * Saldo tidak berubah karena transaksi belum pernah masuk.
 */
export const cancelTopUp = async (req: AuthRequest, res: Response) => {
  const topUp: any = await queryOne(
    "SELECT * FROM top_ups WHERE id = ? AND user_id = ?",
    [req.params.id, req.user!.id]
  );
  if (!topUp) return fail(res, "Top up tidak ditemukan", 404);

  if (topUp.status === "PAID") {
    return fail(res, "Top up ini sudah dibayar, tidak bisa dibatalkan", 409);
  }

  if (topUp.status !== "PENDING") {
    return success(
      res,
      { top_up_id: topUp.id, status: topUp.status },
      "Top up ini sudah tidak aktif"
    );
  }

  await pool.query(
    "UPDATE top_ups SET status = 'CANCELLED' WHERE id = ? AND status = 'PENDING'",
    [topUp.id]
  );

  return success(
    res,
    { top_up_id: topUp.id, status: "CANCELLED" },
    "Top up dibatalkan"
  );
};
