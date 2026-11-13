import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { pool, queryOne } from "../config/database";
import { signToken } from "../utils/jwt.util";
import { sendOTPEmail } from "../utils/mailer";
import { success, fail } from "../utils/response";
import { HttpError } from "../utils/httpError";
import {
  registerSchema,
  verifyOtpSchema,
  loginSchema,
} from "../validators";
import type { AuthRequest } from "../middlewares/auth.middleware";
// otp ganti di sini 
const generateOTP = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

/** Buat OTP baru: hash + simpan ke users, kirim email */
const createAndSendOtp = async (userId: number, email: string) => {
  const otp = generateOTP();
  const otpHash = await bcrypt.hash(otp, 10);
  await pool.query(
    `UPDATE users SET otp_hash = ?, otp_expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE),
     otp_attempts = 0, otp_resend_count = 0, otp_last_sent_at = NOW() WHERE id = ?`,
    [otpHash, userId]
  );
  await sendOTPEmail(email, otp);
  return otp;
};

/** POST /api/v1/auth/register */
export const register = async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await queryOne(
      "SELECT id FROM users WHERE email = ?",
      [data.email]
    );
    if (existing) {
      return fail(res, "Email sudah terdaftar", 409);
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const result: any = await pool.query(
      `INSERT INTO users (full_name, email, phone, password, role, is_verified)
       VALUES (?, ?, ?, ?, 'USER', 0)`,
      [data.full_name, data.email, data.phone, hashedPassword]
    );
    const userId = result[0].insertId;

    const otp = await createAndSendOtp(userId, data.email);

    const response: any = {
      email: data.email,
      otp_expired_in: "5 menit",
      note: "Akun aktif setelah verifikasi OTP di /api/v1/auth/verify-otp",
    };
    if (process.env.SEND_OTP_IN_RESPONSE === "true") {
      response.debug_otp = otp;
    }

    return success(
      res,
      response,
      "Kode OTP (6 digit) telah dikirim ke email kamu. Berlaku 5 menit.",
      201
    );
  } catch (err) {
    if (err instanceof HttpError) return fail(res, err.message, err.status);
    if (err instanceof Error && err.name === "ZodError") {
      return fail(res, (err as any).errors.map((e: any) => e.message).join(", "), 400);
    }
    console.error(err);
    return fail(res);
  }
};

/** POST /api/v1/auth/verify-otp */
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

    if (new Date(user.otp_expires_at) < new Date()) {
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

    // OTP hanya dipakai sekali
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

/** POST /api/v1/auth/resend-otp */
export const resendOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return fail(res, "Email wajib diisi", 400);

    const user = await queryOne(
      "SELECT id, is_verified, otp_last_sent_at FROM users WHERE email = ?",
      [email]
    );
    if (!user) return fail(res, "Email tidak terdaftar, silakan register", 404);
    if (user.is_verified) return fail(res, "Akun sudah terverifikasi, silakan login", 409);

    // Jeda kirim OTP: sekali kirim, harus tunggu 5 menit untuk kirim lagi
    if (user.otp_last_sent_at) {
      const elapsed = Date.now() - new Date(user.otp_last_sent_at).getTime();
      if (elapsed < 5 * 60 * 1000) {
        const sisa = Math.ceil((5 * 60 * 1000 - elapsed) / 60000);
        return fail(res, `Tunggu ${sisa} menit lagi sebelum meminta OTP baru`, 429);
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

/** POST /api/v1/auth/login */
export const login = async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await queryOne("SELECT * FROM users WHERE email = ?", [data.email]);
    if (!user) return fail(res, "Email atau password salah", 401);

    const match = await bcrypt.compare(data.password, user.password);
    if (!match) return fail(res, "Email atau password salah", 401);

    if (!user.is_verified) {
      return fail(res, "Email belum diverifikasi. Cek email untuk OTP.", 403);
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role });

    return success(
      res,
      {
        token,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          photo_url: user.photo_url,
          balance: Number(user.balance),
        },
      },
      "Login berhasil"
    );
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return fail(res, (err as any).errors.map((e: any) => e.message).join(", "), 400);
    }
    console.error(err);
    return fail(res);
  }
};

/** POST /api/v1/auth/logout */
export const logout = async (req: AuthRequest, res: Response) => {
  return success(res, null, "Logout berhasil. Hapus token di sisi aplikasi.");
};
