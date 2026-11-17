import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { pool, queryOne, parseWib } from "../../config/database";
import { success, fail } from "../../utils/response";
import { verifyOtpSchema } from "../../validators";
import { createAndSendOtp } from "./otp.helper";

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const data = verifyOtpSchema.parse(req.body);

    const user = await queryOne(
      "SELECT id, is_verified, otp_hash, otp_expires_at, otp_attempts FROM users WHERE email = ?",
      [data.email]
    );
    if (!user) return fail(res, "Email tidak terdaftar, silakan register", 404);
    if (user.is_verified) return fail(res, "Akun sudah terverifikasi, silakan login", 409);
    if (!user.otp_hash) return fail(res, "Tidak ada OTP aktif, silakan kirim ulang OTP", 400);

    const expiresAt = parseWib(user.otp_expires_at);
    if (!expiresAt || expiresAt < new Date()) {
      return fail(res, "OTP sudah kedaluwarsa, silakan request OTP baru", 410);
    }

    if (user.otp_attempts >= 5) {
      return fail(res, "Terlalu banyak percobaan salah. Request OTP baru.", 429);
    }

    const match = await bcrypt.compare(data.otp, user.otp_hash);
    if (!match) {
      await pool.query("UPDATE users SET otp_attempts = otp_attempts + 1 WHERE id = ?", [user.id]);
      return fail(res, "Kode OTP salah", 400);
    }

    await pool.query(
      `UPDATE users SET is_verified = 1, otp_hash = NULL, otp_expires_at = NULL,
       otp_attempts = 0, otp_resend_count = 0 WHERE id = ?`,
      [user.id]
    );

    return success(res, { email: data.email }, "Verifikasi berhasil! Akun kamu aktif, silakan login.");
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return fail(res, (err as any).errors.map((e: any) => e.message).join(", "), 400);
    }
    console.error(err);
    return fail(res);
  }
};

export const resendOtp = async (req: Request, res: Response) => {
  try {
    if (req.body?.otp) {
      return fail(
        res,
        "Endpoint ini hanya untuk kirim ulang OTP. Verifikasi kode pakai POST /api/v1/auth/verify-otp",
        400
      );
    }

    const { email } = req.body;
    if (!email) return fail(res, "Email wajib diisi", 400);

    const user = await queryOne(
      "SELECT id, is_verified, otp_last_sent_at FROM users WHERE email = ?",
      [email]
    );
    if (!user) return fail(res, "Email tidak terdaftar, silakan register", 404);
    if (user.is_verified) return fail(res, "Akun sudah terverifikasi, silakan login", 409);

    if (user.otp_last_sent_at) {
      const last = parseWib(user.otp_last_sent_at);
      if (last && Date.now() - last.getTime() < 5 * 60 * 1000) {
        const remaining = Math.ceil((5 * 60 * 1000 - (Date.now() - last.getTime())) / 60000);
        return fail(res, `Tunggu ${remaining} menit lagi sebelum meminta OTP baru`, 429);
      }
    }

    const otp = await createAndSendOtp(user.id, email);

    const response: any = { email, otp_expired_in: "5 menit" };
    if (process.env.SEND_OTP_IN_RESPONSE === "true") response.debug_otp = otp;

    return success(res, response, "OTP baru telah dikirim ke email kamu.");
  } catch (err) {
    console.error(err);
    return fail(res);
  }
};
