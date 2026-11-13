import { Router } from "express";
import {
  dashboard,
  listUsers,
  listTransactions,
  listPayments,
  revenueReport,
} from "../controllers/admin.controller";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware";

const router = Router();
const adminOnly = [authenticate, requireAdmin];

router.get("/dashboard", adminOnly, dashboard);
router.get("/users", adminOnly, listUsers);
router.get("/transactions", adminOnly, listTransactions);
router.get("/payments", adminOnly, listPayments);
router.get("/revenue", adminOnly, revenueReport);

export default router;
