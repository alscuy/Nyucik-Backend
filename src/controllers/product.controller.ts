import { Response } from "express";
import { pool, query, queryOne, withTransaction } from "../config/database";
import { success, fail } from "../utils/response";
import { badRequest, notFound, forbidden } from "../utils/httpError";
import { uploadImage, FOLDERS } from "../utils/cloudinary.util";
import { productSchema, purchaseSchema } from "../validators";
import { AuthRequest } from "../middlewares/auth.middleware";

// ==================== USER ====================

/** GET /api/v1/products - katalog produk aktif */
export const listProducts = async (_req: AuthRequest, res: Response) => {
  const rows = await query(
    "SELECT id, name, description, price, stock, photo_url FROM products WHERE is_active = 1 ORDER BY name ASC"
  );
  rows.forEach((r: any) => { r.price = Number(r.price); });
  return success(res, rows, "Katalog produk berhasil diambil");
};

/** GET /api/v1/products/:id - detail produk */
export const getProduct = async (req: AuthRequest, res: Response) => {
  const product: any = await queryOne(
    "SELECT id, name, description, price, stock, photo_url FROM products WHERE id = ? AND is_active = 1",
    [req.params.id]
  );
  if (!product) return notFound("Produk tidak ditemukan");
  product.price = Number(product.price);
  return success(res, product, "Detail produk berhasil diambil");
};

/** POST /api/v1/products/orders - beli produk pakai saldo (stok aman: DB transaction) */
export const purchaseProduct = async (req: AuthRequest, res: Response) => {
  try {
    const data = purchaseSchema.parse(req.body);

    const order = await withTransaction(async (conn) => {
      // Lock produk & cek stok (stok tidak boleh negatif)
      const [productRows]: any = await conn.query("SELECT * FROM products WHERE id = ? AND is_active = 1 FOR UPDATE", [data.product_id]);
      if (productRows.length === 0) {
        throw notFound("Produk tidak ditemukan");
      }
      const product: any = productRows[0];
      if (Number(product.stock) < data.quantity) {
        throw badRequest(`Stok tidak cukup. Sisa stok: ${product.stock}`);
      }

      // Lock saldo user
      const [userRows]: any = await conn.query("SELECT balance FROM users WHERE id = ? FOR UPDATE", [req.user!.id]);
      const balance = Number(userRows[0].balance);
      const totalPrice = Number(product.price) * data.quantity;
      if (balance < totalPrice) {
        throw badRequest(`Saldo tidak cukup. Saldo: Rp${balance}, total: Rp${totalPrice}`);
      }

      // Kurangi stok & saldo
      const before = balance;
      const after = balance - totalPrice;
      await conn.query("UPDATE products SET stock = stock - ? WHERE id = ?", [data.quantity, data.product_id]);
      await conn.query("UPDATE users SET balance = ? WHERE id = ?", [after, req.user!.id]);

      // Simpan order + catat wallet transaction
      const [orderResult]: any = await conn.query(
        "INSERT INTO product_orders (user_id, product_id, quantity, total_price) VALUES (?, ?, ?, ?)",
        [req.user!.id, data.product_id, data.quantity, totalPrice]
      );
      await conn.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
         VALUES (?, 'PAYMENT', ?, ?, ?, 'PRODUCT', ?, ?)`,
        [req.user!.id, totalPrice, before, after, orderResult.insertId, `Beli ${product.name} x${data.quantity}`]
      );

      return { order_id: orderResult.insertId, product: product.name, quantity: data.quantity, total_price: totalPrice, balance_after: after };
    });

    return success(res, order, "Pembelian berhasil, stok berkurang otomatis", 201);
  } catch (err: any) {
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    if (typeof err.status === "number") return fail(res, err.message, err.status);
    console.error(err);
    return fail(res);
  }
};

/** GET /api/v1/products/orders/my - riwayat pembelian */
export const myOrders = async (req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT po.id, p.name AS product_name, p.photo_url, po.quantity, po.total_price, po.created_at
     FROM product_orders po JOIN products p ON p.id = po.product_id
     WHERE po.user_id = ? ORDER BY po.created_at DESC`,
    [req.user!.id]
  );
  rows.forEach((r: any) => { r.total_price = Number(r.total_price); });
  return success(res, rows, "Riwayat pembelian berhasil diambil");
};

// ==================== ADMIN ====================

/** GET /api/v1/products/admin/all (admin) - termasuk yang tidak aktif */
export const listAllProducts = async (_req: AuthRequest, res: Response) => {
  const rows = await query("SELECT * FROM products ORDER BY name ASC");
  rows.forEach((r: any) => { r.price = Number(r.price); });
  return success(res, rows, "Semua produk berhasil diambil");
};

/** POST /api/v1/products (admin, multipart: photo) */
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
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

/** PATCH /api/v1/products/:id (admin, multipart: photo) */
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
    if (err.name === "ZodError") return fail(res, err.errors.map((e: any) => e.message).join(", "), 400);
    console.error(err);
    return fail(res);
  }
};

/** DELETE /api/v1/products/:id (admin) */
export const deleteProduct = async (req: AuthRequest, res: Response) => {
  const product: any = await queryOne("SELECT id FROM products WHERE id = ?", [req.params.id]);
  if (!product) return notFound("Produk tidak ditemukan");
  await pool.query("DELETE FROM products WHERE id = ?", [req.params.id]);
  return success(res, null, "Produk berhasil dihapus");
};
