import { Router } from "express";
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from "../controllers/expense.controller";
import { authenticate, requireAdmin, requireRole } from "../middlewares/auth.middleware";

const router = Router();
const adminOnly = [authenticate, requireAdmin];
const staff = [authenticate, requireRole("ADMIN", "CASHIER")];

router.get("/", authenticate, listExpenses);
router.post("/", staff, createExpense);
router.patch("/:id", adminOnly, updateExpense);
router.delete("/:id", adminOnly, deleteExpense);

export default router;
