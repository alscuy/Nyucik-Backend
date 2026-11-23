import { z } from "zod";
import { booleanField } from "./common";

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

export const announcementSchema = announcementSchemaBase.refine(
  (data) => data.end_date >= data.start_date,
  {
    message: "Tanggal berakhir harus sama atau setelah tanggal mulai",
    path: ["end_date"],
  }
);

export const employeeSchema = z.object({
  name: z.string().min(3, "Nama pegawai minimal 3 karakter"),
  position: z.string().min(3, "Posisi wajib diisi"),
  phone: z.string().optional(),
  is_ready: booleanField.optional().default(true),
});

export const expenseSchema = z.object({
  title: z.string().min(3, "Judul pengeluaran minimal 3 karakter"),
  amount: z.coerce
    .number()
    .positive("Nominal pengeluaran harus lebih dari 0"),
  expense_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus format YYYY-MM-DD"),
  note: z.string().optional(),
});
