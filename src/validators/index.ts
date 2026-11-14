import { z } from "zod";

/** Konversi string dari multipart form ("true"/"1") jadi boolean */
const booleanField = z.preprocess(
  (v) => v === true || v === "true" || v === 1 || v === "1",
  z.boolean()
);

// ==================== AUTH ====================
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
  .refine((d) => d.password === d.confirm_password, {
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
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Konfirmasi password tidak sama dengan password baru",
    path: ["confirm_password"],
  });

// ==================== MESIN ====================
export const washingMachineSchema = z.object({
  code: z.string().min(1, "Kode mesin wajib diisi"),
  capacity_kg: z.coerce.number().int().positive("Kapasitas wajib diisi"),
  price_per_kg: z.coerce.number().positive("Harga per kg wajib diisi"),
  status: z
    .enum(["AVAILABLE", "BOOKED", "IN_USE", "MAINTENANCE"])
    .optional()
    .default("AVAILABLE"),
  description: z.string().optional(),
});

export const dryingMachineSchema = z.object({
  code: z.string().min(1, "Kode mesin wajib diisi"),
  price_per_use: z.coerce.number().positive("Harga per pakai wajib diisi"),
  duration_minutes: z.coerce.number().int().positive("Durasi wajib diisi"),
  status: z
    .enum(["AVAILABLE", "BOOKED", "IN_USE", "MAINTENANCE"])
    .optional()
    .default("AVAILABLE"),
  description: z.string().optional(),
});

// ==================== BOOKING ====================
export const createBookingSchema = z
  .object({
    machine_type: z.enum(["WASHING", "DRYING"], {
      message: "Tipe mesin harus WASHING atau DRYING",
    }),
    machine_id: z.coerce.number().int().positive("ID mesin wajib diisi"),
    booking_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus format YYYY-MM-DD"),
    start_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Jam harus format HH:MM (contoh 10:00)"),
    weight_kg: z.coerce
      .number()
      .positive("Berat cucian wajib diisi untuk mesin cuci")
      .optional(),
  })
  .refine((d) => d.machine_type !== "WASHING" || d.weight_kg !== undefined, {
    message: "Berat cucian wajib diisi untuk mesin cuci",
    path: ["weight_kg"],
  });

export const purchaseSchema = z.object({
  product_id: z.coerce.number().int().positive("ID produk wajib diisi"),
  quantity: z.coerce
    .number()
    .int()
    .min(1, "Quantity minimal 1")
    .max(100, "Quantity maksimal 100"),
});

// ==================== PRODUK / PENGUMUMAN / PEGAWAI ====================
export const productSchema = z.object({
  name: z.string().min(3, "Nama produk minimal 3 karakter"),
  description: z.string().optional(),
  price: z.coerce.number().positive("Harga wajib diisi"),
  stock: z.coerce.number().int().min(0, "Stok tidak boleh negatif"),
  is_active: booleanField.optional().default(true),
});

export const announcementSchemaBase = z.object({
  title: z.string().min(3, "Judul minimal 3 karakter"),
  content: z.string().min(3, "Konten wajib diisi"),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus format YYYY-MM-DD"),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus format YYYY-MM-DD"),
  is_active: booleanField.optional().default(true),
});

export const announcementSchema = announcementSchemaBase
  .refine((d) => d.end_date >= d.start_date, {
    message: "Tanggal berakhir harus sama atau setelah tanggal mulai",
    path: ["end_date"],
  });

export const employeeSchema = z.object({
  name: z.string().min(3, "Nama pegawai minimal 3 karakter"),
  position: z.string().min(3, "Posisi wajib diisi"),
  phone: z.string().optional(),
  is_ready: booleanField.optional().default(true),
});

export const updateStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"], {
    message: "Status booking tidak valid",
  }),
});

export const updateBookingSchema = z
  .object({
    booking_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus format YYYY-MM-DD")
      .optional(),
    start_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Jam harus format HH:MM (contoh 10:00)")
      .optional(),
  })
  .refine((d) => d.booking_date !== undefined || d.start_time !== undefined, {
    message: "Isi minimal salah satu: booking_date atau start_time",
  });

export const machineStatusSchema = z.object({
  status: z.enum(["AVAILABLE", "BOOKED", "IN_USE", "MAINTENANCE"], {
    message: "Status mesin tidak valid",
  }),
});
