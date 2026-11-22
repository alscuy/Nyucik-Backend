import { Response } from "express";
import { pool, query, queryOne, withTransaction } from "../config/database";
import { success, fail } from "../utils/response";
import { badRequest, notFound } from "../utils/http-error";
import { uploadImage, FOLDERS } from "../utils/cloudinary.util";
import { productSchema, purchaseSchema } from "../validators";
import { AuthRequest } from "../middlewares/auth.middleware";
import { storeIsOpen } from "../services/store.service";

export const listProducts = async (_req: AuthRequest, res: Response) => {
  const rows = await query(
    "SELECT id, name, description, price, stock, photo_url FROM products WHERE is_active = 1 ORDER BY name ASC"
  );
  rows.forEach((product: any) => { product.price = Number(product.price); });
  return success(res, rows, "Katalog produk berhasil diambil");
};

export const getProduct = async (req: AuthRequest, res: Response) => {
  const product: any = await queryOne(
    "SELECT id, name, description, price, stock, photo_url FROM products WHERE id = ? AND is_active = 1",
    [req.params.id]
  );
  if (!product) return notFound("Produk tidak ditemukan");
  product.price = Number(product.price);
  return success(res, product, "Detail produk berhasil diambil");
};

export const purchaseProduct = async (req: AuthRequest, res: Response) => {
  try {
    const data = purchaseSchema.parse(req.body);

    if (!(await storeIsOpen())) {
      return fail(res, "Toko sedang tutup. Pembelian belum bisa dilakukan sekarang.", 409);
    }

    const order = await withTransaction(async (conn) => {

      const [productRows]: any = await conn.query("SELECT * FROM products WHERE id = ? AND is_active = 1 FOR UPDATE", [data.product_id]);
      if (productRows.length === 0) {
        throw notFound("Produk tidak ditemukan");
      }
      const product: any = productRows[0];
      if (Number(product.stock) < data.quantity) {
        throw badRequest(`Stok tidak cukup. Sisa stok: ${product.stock}`);
      }

      const [userRows]: any = await conn.query("SELECT balance FROM users WHERE id = ? FOR UPDATE", [req.user!.id]);
      const balance = Number(userRows[0].balance);
      const totalPrice = Number(product.price) * data.quantity;
      if (balance < totalPrice) {
        throw badRequest(`Saldo tidak cukup. Saldo: Rp${balance}, total: Rp${totalPrice}`);
      }

      const before = balance;
      const after = balance - totalPrice;
      await conn.query("UPDATE products SET stock = stock - ? WHERE id = ?", [data.quantity, data.product_id]);
      await conn.query("UPDATE users SET balance = ? WHERE id = ?", [after, req.user!.id]);

      const [orderResult]: any = await conn.query(
        "INSERT INTO product_orders (user_id, product_id, quantity, total_price) VALUES (?, ?, ?, ?)",
        [req.user!.id, data.product_id, data.quantity, totalPrice]
      );
      await conn.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
         VALUES (?, 'PAYMENT', ?, ?, ?, 'PRODUCT', ?, ?)`,
        [req.user!.id, totalPrice, before, after, orderResult.insertId, `Beli ${product.name} x${data.quantity}`]
      );

      return { order_id: orderResult.insertId, product: product.name, quantity: data.quantity, total_price: totalPrice, status: "PENDING", balance_after: after };
    });

    return success(res, order, "Pembelian berhasil, silakan tunjukkan ke petugas", 201);
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((issue: any) => issue.message).join(", "), 400);
    if (typeof err.status === "number") return fail(res, err.message, err.status);
    console.error(err);
    return fail(res);
  }
};

export const myOrders = async (req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT po.id, po.product_id, p.name AS product_name, p.photo_url,
            po.quantity, po.total_price, po.status, po.created_at
     FROM product_orders po JOIN products p ON p.id = po.product_id
     WHERE po.user_id = ? ORDER BY po.created_at DESC`,
    [req.user!.id]
  );
  rows.forEach((row: any) => { row.total_price = Number(row.total_price); });
  return success(res, rows, "Riwayat pembelian berhasil diambil");
};

export const completeOrder = async (req: AuthRequest, res: Response) => {
  const order: any = await queryOne(
    "SELECT * FROM product_orders WHERE id = ? AND user_id = ?",
    [req.params.id, req.user!.id]
  );
  if (!order) return notFound("Pesanan tidak ditemukan");
  if (order.status === "COMPLETED") {
    return fail(res, "Pesanan ini sudah dikonfirmasi sebelumnya", 409);
  }
  await pool.query(
    "UPDATE product_orders SET status = 'COMPLETED' WHERE id = ?",
    [req.params.id]
  );
  return success(res, { id: Number(req.params.id), status: "COMPLETED" }, "Pesanan dikonfirmasi selesai. Terima kasih!");
};

export const listAllProducts = async (_req: AuthRequest, res: Response) => {
  const rows = await query("SELECT * FROM products ORDER BY name ASC");
  rows.forEach((product: any) => { product.price = Number(product.price); });
  return success(res, rows, "Semua produk berhasil diambil");
};

export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const data = productSchema.parse(req.body);

    let photoUrl: string | null = null;
    if (req.file) photoUrl = (await uploadImage(req.file.buffer, FOLDERS.products)).url;

    const result: any = await pool.query(
      `INSERT INTO products (name, description, price, stock, photo_url, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.name, data.description, data.price, data.stock, photoUrl, data.is_active]
    );
    const product: any = await queryOne("SELECT * FROM products WHERE id = ?", [result[0].insertId]);
    product.price = Number(product.price);

    return success(res, product, "Produk berhasil ditambahkan", 201);
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((issue: any) => issue.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const product: any = await queryOne("SELECT * FROM products WHERE id = ?", [req.params.id]);
    if (!product) return notFound("Produk tidak ditemukan");

    const data = productSchema.partial().parse(req.body);

    let photoUrl: string | null = null;
    if (req.file) photoUrl = (await uploadImage(req.file.buffer, FOLDERS.products)).url;

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
    if (photoUrl) { fields.push("photo_url = ?"); values.push(photoUrl); }
    if (fields.length === 0) return fail(res, "Tidak ada data yang diubah", 400);

    values.push(req.params.id);
    await pool.query(`UPDATE products SET ${fields.join(", ")} WHERE id = ?`, values);

    const updated: any = await queryOne("SELECT * FROM products WHERE id = ?", [req.params.id]);
    updated.price = Number(updated.price);
    return success(res, updated, "Produk berhasil diperbarui");
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((issue: any) => issue.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response) => {
  const product: any = await queryOne("SELECT id FROM products WHERE id = ?", [req.params.id]);
  if (!product) return notFound("Produk tidak ditemukan");
  await pool.query("DELETE FROM products WHERE id = ?", [req.params.id]);
  return success(res, null, "Produk berhasil dihapus");
};
