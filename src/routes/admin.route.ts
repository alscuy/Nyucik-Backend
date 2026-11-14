import { Router } from "express";
import {
  dashboard,
  listUsers,
  listTransactions,
  listPayments,
  revenueReport,
  getUserDetail,
  dailyReport,
} from "../controllers/admin.controller";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware";

const router = Router();
const adminOnly = [authenticate, requireAdmin];

router.get("/dashboard", adminOnly, dashboard);
router.get("/users", adminOnly, listUsers);
router.get("/users/:id", adminOnly, getUserDetail);       // profil + log user (udh bayar/blm)
router.get("/transactions", adminOnly, listTransactions);
router.get("/payments", adminOnly, listPayments);
router.get("/revenue", adminOnly, revenueReport);
router.get("/revenue/daily", adminOnly, dailyReport);     // log terjual/terpakai hari ini (IDR)

export default router;
