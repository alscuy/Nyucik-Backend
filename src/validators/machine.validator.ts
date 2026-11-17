import { z } from "zod";

export const washingMachineSchema = z.object({
  code: z.string().min(1, "Kode mesin wajib diisi"),
  capacity_kg: z.coerce.number().int().positive("Kapasitas wajib diisi"),
  price_per_use: z.coerce.number().positive("Harga per pakai wajib diisi"),
  status: z
    .enum(["AVAILABLE", "BOOKED", "IN_USE", "MAINTENANCE"])
    .optional()
    .default("AVAILABLE"),
  description: z.string().optional(),
});

export const dryingMachineSchema = z.object({
  code: z.string().min(1, "Kode mesin wajib diisi"),
  price_per_use: z.coerce.number().positive("Harga per pakai wajib diisi"),
  status: z
    .enum(["AVAILABLE", "BOOKED", "IN_USE", "MAINTENANCE"])
    .optional()
    .default("AVAILABLE"),
  description: z.string().optional(),
});

export const machineStatusSchema = z.object({
  status: z.enum(["AVAILABLE", "BOOKED", "IN_USE", "MAINTENANCE"], {
    message: "Status mesin tidak valid",
  }),
});
