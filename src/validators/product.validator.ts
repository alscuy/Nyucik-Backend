import { z } from "zod";
import { booleanField } from "./common";

export const purchaseSchema = z.object({
  product_id: z.coerce.number().int().positive("ID produk wajib diisi"),
  quantity: z.coerce
    .number()
    .int()
    .min(1, "Quantity minimal 1")
    .max(100, "Quantity maksimal 100"),
});

export const productSchema = z.object({
  name: z.string().min(3, "Nama produk minimal 3 karakter"),
  description: z.string().optional(),
  price: z.coerce.number().positive("Harga wajib diisi"),
  stock: z.coerce.number().int().min(0, "Stok tidak boleh negatif"),
  is_active: booleanField.optional().default(true),
});
