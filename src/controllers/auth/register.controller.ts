import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { pool, queryOne } from "../../config/database";
import { success, fail } from "../../utils/response";
import { HttpError } from "../../utils/httpError";
import { registerSchema } from "../../validators";
import { createAndSendOtp } from "./otp.helper";

export const register = async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await queryOne("SELECT id FROM users WHERE email = ?", [data.email]);
    if (existing) return fail(res, "Email sudah terdaftar", 409);

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
