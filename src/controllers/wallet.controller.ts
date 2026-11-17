import crypto from "crypto";
import { Response } from "express";
import { pool, query, queryOne, withTransaction } from "../config/database";
import { success, fail } from "../utils/response";
import { badRequest } from "../utils/httpError";
import { createQris } from "../utils/dana.util";
import { uploadImage, FOLDERS } from "../utils/cloudinary.util";
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
        qr_image: qris.qr_image,
        sandbox: qris.sandbox,
        dana_note: qris.message,
        status: "PENDING",
        note: "Pembayaran sedang di verfikasi",
      },
      qris.qr_image ? "QRIS dinamis berhasil dibuat, silakan bayar lalu klik Sudah Bayar & upload bukti" : "QRIS dibuat dalam mode sandbox (QRIS_STATIC_PAYLOAD belum diisi)",
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
    `SELECT id, reference, amount, status, qr_string, proof_url, admin_note, paid_at, created_at
     FROM top_ups WHERE user_id = ? ORDER BY created_at DESC`,
    [req.user!.id]
  );
  rows.forEach((row: any) => { row.amount = Number(row.amount); });
  return success(res, rows, "Riwayat top up berhasil diambil");
};

export const getTopUpDetail = async (req: AuthRequest, res: Response) => {
  const topup: any = await queryOne(
    "SELECT * FROM top_ups WHERE id = ? AND user_id = ?",
    [req.params.id, req.user!.id]
  );
  if (!topup) return fail(res, "Top up tidak ditemukan", 404);
  topup.amount = Number(topup.amount);
  return success(res, topup, "Detail top up berhasil diambil");
};

export const uploadTopUpProof = async (req: AuthRequest, res: Response) => {
  try {
    const topup: any = await queryOne(
      "SELECT * FROM top_ups WHERE id = ? AND user_id = ?",
      [req.params.id, req.user!.id]
    );
    if (!topup) return fail(res, "Top up tidak ditemukan", 404);
    if (!["PENDING", "WAITING_CONFIRM", "REJECTED"].includes(topup.status)) {
      return fail(res, "Top up ini sudah tidak bisa dikirim bukti", 409);
    }
    if (!req.file) return badRequest("Foto bukti wajib diupload (field: photo)");

    const img = await uploadImage(req.file.buffer, FOLDERS.topups);
    await pool.query(
      "UPDATE top_ups SET proof_url = ?, status = 'WAITING_CONFIRM', admin_note = NULL WHERE id = ?",
      [img.url, topup.id]
    );

    return success(
      res,
      { top_up_id: topup.id, proof_url: img.url, status: "WAITING_CONFIRM" },
      "Bukti pembayaran terkirim, menunggu konfirmasi kasir",
      201
    );
  } catch (err) {
    console.error(err);
    return fail(res);
  }
};
