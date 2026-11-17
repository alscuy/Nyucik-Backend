import { z } from "zod";

export const createBookingSchema = z.object({
  machine_type: z.enum(["WASHING", "DRYING"], {
    message: "Tipe mesin harus WASHING atau DRYING",
  }),
  machine_id: z.coerce.number().int().positive("ID mesin wajib diisi"),
});

export const updateStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"], {
    message: "Status booking tidak valid",
  }),
});
