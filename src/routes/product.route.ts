import { Router } from "express";
import {
  listProducts,
  getProduct,
  purchaseProduct,
  myOrders,
  completeOrder,
  listAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/product.controller";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();
const adminOnly = [authenticate, requireAdmin];

router.get("/", authenticate, listProducts);
router.get("/:id", authenticate, getProduct);
router.post("/orders", authenticate, purchaseProduct);
router.get("/orders/my", authenticate, myOrders);
router.post("/orders/:id/complete", authenticate, completeOrder);

router.get("/admin/all", adminOnly, listAllProducts);
router.post("/", adminOnly, upload.single("photo"), createProduct);
router.patch("/:id", adminOnly, upload.single("photo"), updateProduct);
router.delete("/:id", adminOnly, deleteProduct);

export default router;
