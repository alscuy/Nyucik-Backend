import crypto from "crypto";
import { Response } from "express";
import { pool, query, queryOne, withTransaction } from "../config/database";
import { success, fail } from "../utils/response";
import { badRequest } from "../utils/http-error";
import { createQris } from "../utils/dana.util";
import { AuthRequest } from "../middlewares/auth.middleware";

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

export const createTopUp = async (req: AuthRequest, res: Response) => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || isNaN(amount)) return badRequest("Nominal top up wajib diisi");
    if (amount < 10000) return badRequest("Minimal top up Rp10.000");

    const reference = "TOPUP-" + crypto.randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase();

    const qris = await createQris(amount, reference);

    const result: any = await pool.query(
      `INSERT INTO top_ups (user_id, reference, amount, status, qr_string)
       VALUES (?, ?, ?, 'PENDING', ?)`,
      [req.user!.id, reference, amount, qris.qr_string]
    );

    return success(
      res,
      {
        top_up_id: result[0].insertId,
        reference,
        amount,
        qris: qris.qr_string,
        qr_image: qris.qr_image,
        sandbox: qris.sandbox,
        status: "PENDING",
      },
      qris.qr_image
        ? "QRIS berhasil dibuat, silakan scan lalu jalankan simulasi pembayaran"
        : "QRIS dibuat dalam mode sandbox (QRIS_STATIC_PAYLOAD belum diisi)",
      201
    );
  } catch (err: any) {
    if (err?.message?.includes("QRIS")) return fail(res, err.message, 502);
    console.error(err);
    return fail(res);
  }
};

export const getTopUps = async (req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT id, reference, amount, status, qr_string, paid_at, created_at
     FROM top_ups WHERE user_id = ? ORDER BY created_at DESC`,
    [req.user!.id]
  );
  rows.forEach((row: any) => { row.amount = Number(row.amount); });
  return success(res, rows, "Riwayat top up berhasil diambil");
};

export const simulateTopUpPayment = async (req: AuthRequest, res: Response) => {
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

  if (!["PENDING", "EXPIRED", "FAILED"].includes(topUp.status)) {
    return fail(res, "Top up ini tidak bisa dibayar", 409);
  }

  const balance = await withTransaction(async (conn) => {
    const [locked]: any = await conn.query(
      "SELECT status FROM top_ups WHERE id = ? FOR UPDATE",
      [topUp.id]
    );
    if (locked[0].status === "PAID") {
      const [current]: any = await conn.query("SELECT balance FROM users WHERE id = ?", [
        topUp.user_id,
      ]);
      return Number(current[0].balance);
    }

    const [userRow]: any = await conn.query(
      "SELECT balance FROM users WHERE id = ? FOR UPDATE",
      [topUp.user_id]
    );
    const before = Number(userRow[0].balance);
    const after = before + Number(topUp.amount);

    await conn.query(
      "UPDATE top_ups SET status = 'PAID', paid_at = NOW() WHERE id = ?",
      [topUp.id]
    );
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
        `Top up saldo via QRIS (${topUp.reference})`,
      ]
    );
    return after;
  });

  return success(
    res,
    { top_up_id: topUp.id, status: "PAID", balance },
    "Pembayaran QRIS berhasil, saldo bertambah"
  );
};
