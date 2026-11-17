import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { queryOne } from "../../config/database";
import { signToken } from "../../utils/jwt.util";
import { success, fail } from "../../utils/response";
import { loginSchema } from "../../validators";
import type { AuthRequest } from "../../middlewares/auth.middleware";

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

export const logout = async (_req: AuthRequest, res: Response) => {
  return success(res, null, "Logout berhasil. Hapus token di sisi aplikasi.");
};
