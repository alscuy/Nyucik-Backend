import { Router } from "express";
import {
  dashboard,
  listUsers,
  getUserDetail,
  revenueDetail,
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from "../controllers/admin.controller";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware";

const router = Router();
const adminOnly = [authenticate, requireAdmin];

router.get("/dashboard", adminOnly, dashboard);
router.get("/users", adminOnly, listUsers);
router.get("/users/:id", adminOnly, getUserDetail);
router.get("/revenue", adminOnly, revenueDetail);
router.get("/expenses", adminOnly, listExpenses);
router.post("/expenses", adminOnly, createExpense);
router.patch("/expenses/:id", adminOnly, updateExpense);
router.delete("/expenses/:id", adminOnly, deleteExpense);

export default router;
