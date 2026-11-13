import { Router } from "express";
import {
  listProducts,
  getProduct,
  purchaseProduct,
  myOrders,
  listAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/product.controller";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();
const adminOnly = [authenticate, requireAdmin];

// ==================== USER ====================
router.get("/", authenticate, listProducts);
router.get("/:id", authenticate, getProduct);
router.post("/orders", authenticate, purchaseProduct);   // beli produk pakai saldo
router.get("/orders/my", authenticate, myOrders);

// ==================== ADMIN ====================
router.get("/admin/all", adminOnly, listAllProducts);
router.post("/", adminOnly, upload.single("photo"), createProduct);
router.patch("/:id", adminOnly, upload.single("photo"), updateProduct);
router.delete("/:id", adminOnly, deleteProduct);

export default router;
