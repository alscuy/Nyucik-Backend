import { Router } from "express";
import {
  dashboard,
  listUsers,
  getUserDetail,
  revenueDetail,
} from "../controllers/admin.controller";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware";

const router = Router();
const adminOnly = [authenticate, requireAdmin];

router.get("/dashboard", adminOnly, dashboard);
router.get("/users", adminOnly, listUsers);
router.get("/users/:id", adminOnly, getUserDetail);
router.get("/revenue", adminOnly, revenueDetail);

export default router;
