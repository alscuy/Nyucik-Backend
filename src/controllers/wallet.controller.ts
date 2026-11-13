import crypto from "crypto";
import { Response } from "express";
import { pool, query, queryOne, withTransaction } from "../config/database";
import { success, fail } from "../utils/response";
import { badRequest } from "../utils/httpError";
import { createQris, isDanaConfigured } from "../utils/dana.util";
import { AuthRequest } from "../middlewares/auth.middleware";

/** GET /api/v1/wallet/balance */
export const getBalance = async (req: AuthRequest, res: Response) => {
  const user: any = await queryOne("SELECT balance FROM users WHERE id = ?", [req.user!.id]);
  return success(res, { balance: Number(user.balance) }, "Saldo berhasil diambil");
};

/** GET /api/v1/wallet/transactions - riwayat semua perubahan saldo */
export const getWalletTransactions = async (req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT id, type, amount, balance_before, balance_after, reference_type,
            reference_id, description, created_at
     FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC`,
    [req.user!.id]
  );
  rows.forEach((r: any) => {
    r.amount = Number(r.amount);
    r.balance_before = Number(r.balance_before);
    r.balance_after = Number(r.balance_after);
  });
  return success(res, rows, "Riwayat saldo berhasil diambil");
};

/** POST /api/v1/wallet/topup - nominal dari user, nominal TIDAK dipercaya saat webhook */
export const createTopUp = async (req: AuthRequest, res: Response) => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || isNaN(amount)) return badRequest("Nominal top up wajib diisi");
    if (amount < 10000) return badRequest("Minimal top up Rp10.000");
    if (amount > 2000000) return badRequest("Maksimal top up Rp2.000.000");

    const reference = "TOPUP-" + crypto.randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase();

    const qris = await createQris(amount, reference);

    const result: any = await pool.query(
      `INSERT INTO top_ups (user_id, reference, amount, status, qr_string, dana_ref)
       VALUES (?, ?, ?, 'PENDING', ?, ?)`,
      [req.user!.id, reference, amount, qris.qr_string, qris.dana_ref]
    );

    return success(
      res,
      {
        top_up_id: result[0].insertId,
        reference,
        amount,
        qris: qris.qr_string,
        sandbox: qris.sandbox,
        dana_note: qris.message,
        status: "PENDING",
        note: "Saldo akan bertambah otomatis setelah webhook pembayaran valid diterima.",
      },
      isDanaConfigured()
        ? "QRIS DANA berhasil dibuat, silakan bayar"
        : "QRIS dibuat dalam mode sandbox (kredensial DANA belum diisi)",
      201
    );
  } catch (err: any) {
    if (err?.message?.includes("QRIS")) return fail(res, err.message, 502);
    console.error(err);
    return fail(res);
  }
};

/** GET /api/v1/wallet/topups - riwayat top up */
export const getTopUps = async (req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT id, reference, amount, status, qr_string, paid_at, created_at
     FROM top_ups WHERE user_id = ? ORDER BY created_at DESC`,
    [req.user!.id]
  );
  rows.forEach((r: any) => { r.amount = Number(r.amount); });
  return success(res, rows, "Riwayat top up berhasil diambil");
};

/** GET /api/v1/wallet/topups/:id */
export const getTopUpDetail = async (req: AuthRequest, res: Response) => {
  const topup: any = await queryOne(
    "SELECT * FROM top_ups WHERE id = ? AND user_id = ?",
    [req.params.id, req.user!.id]
  );
  if (!topup) return fail(res, "Top up tidak ditemukan", 404);
  topup.amount = Number(topup.amount);
  return success(res, topup, "Detail top up berhasil diambil");
};

/**
 * POST /api/v1/payments/webhook  (publik, dipanggil DANA)
 * - verifikasi signature (HMAC-SHA256 raw body)
 * - verifikasi nominal & reference
 * - idempotency: kalau sudah PAID, tidak diproses lagi
 */
export const danaWebhook = async (req: any, res: Response) => {
  try {
    const { verifyWebhookSignature } = await import("../utils/dana.util");
    const signature = (req.headers["x-signature"] as string) || "";
    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (!verifyWebhookSignature(rawBody, signature)) {
      return fail(res, "Signature webhook tidak valid", 401);
    }

    const { reference, dana_ref, status, amount } = req.body;
    if (!reference) return fail(res, "Reference wajib diisi", 400);

    const topup: any = await queryOne("SELECT * FROM top_ups WHERE reference = ?", [reference]);
    if (!topup) return fail(res, "Transaksi top up tidak ditemukan", 404);

    // IDEMPOTENCY: kalau sudah diproses, langsung OK tanpa menambah saldo lagi
    if (topup.status === "PAID") {
      return success(res, { reference, status: "PAID", note: "Sudah diproses sebelumnya (idempotent)" }, "Webhook diterima");
    }

    if (status !== "PAID") {
      await pool.query("UPDATE top_ups SET status = ?, dana_ref = COALESCE(?, dana_ref) WHERE id = ?", [status || "FAILED", dana_ref, topup.id]);
      return success(res, { reference, status }, "Status top up diperbarui");
    }

    // Verifikasi nominal: HARUS sama dengan nominal transaksi di database
    if (Number(amount) !== Number(topup.amount)) {
      await pool.query("UPDATE top_ups SET status = 'FAILED' WHERE id = ?", [topup.id]);
      return fail(res, "Nominal pembayaran tidak sesuai transaksi", 400);
    }

    // Tambah saldo aman: DB transaction + lock row topup
    await withTransaction(async (conn) => {
      const [locked]: any = await conn.query("SELECT status FROM top_ups WHERE id = ? FOR UPDATE", [topup.id]);
      if (locked[0].status === "PAID") return; // sudah diproses oleh request lain

      const [userRow]: any = await conn.query("SELECT balance FROM users WHERE id = ? FOR UPDATE", [topup.user_id]);
      const before = Number(userRow[0].balance);
      const after = before + Number(topup.amount);

      await conn.query("UPDATE top_ups SET status = 'PAID', dana_ref = COALESCE(?, dana_ref), paid_at = NOW() WHERE id = ?", [dana_ref, topup.id]);
      await conn.query("UPDATE users SET balance = ? WHERE id = ?", [after, topup.user_id]);
      await conn.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
         VALUES (?, 'TOPUP', ?, ?, ?, 'TOPUP', ?, ?)`,
        [topup.user_id, topup.amount, before, after, topup.id, `Top up saldo via DANA QRIS (${topup.reference})`]
      );
    });

    return success(res, { reference, status: "PAID" }, "Pembayaran valid, saldo pengguna bertambah");
  } catch (err) {
    console.error("Webhook error:", err);
    return fail(res);
  }
};
