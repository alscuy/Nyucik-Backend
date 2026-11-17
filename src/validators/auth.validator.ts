import { z } from "zod";

export const registerSchema = z
  .object({
    full_name: z.string().min(3, "Nama lengkap minimal 3 karakter"),
    email: z.string().email("Format email tidak valid"),
    phone: z
      .string()
      .regex(/^08[0-9]{7,12}$/, "Nomor telepon harus format 08 dan 9-14 digit"),
    password: z.string().min(6, "Password minimal 6 karakter"),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Konfirmasi password tidak sama dengan password",
    path: ["confirm_password"],
  });

export const verifyOtpSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  otp: z.string().regex(/^[0-9]{6}$/, "OTP harus 6 digit angka"),
});

export const loginSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export const updateProfileSchema = z.object({
  full_name: z.string().min(3, "Nama lengkap minimal 3 karakter").optional(),
  email: z.string().email("Format email tidak valid").optional(),
  phone: z
    .string()
    .regex(/^08[0-9]{7,12}$/, "Nomor telepon harus format 08 dan 9-14 digit")
    .optional(),
});

export const changePasswordSchema = z
  .object({
    old_password: z.string().min(1, "Password lama wajib diisi"),
    new_password: z.string().min(6, "Password baru minimal 6 karakter"),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Konfirmasi password tidak sama dengan password baru",
    path: ["confirm_password"],
  });
