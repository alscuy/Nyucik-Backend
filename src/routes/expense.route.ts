import { Router } from "express";
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from "../controllers/expense.controller";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware";

const router = Router();
const adminOnly = [authenticate, requireAdmin];

router.get("/", authenticate, listExpenses);
router.post("/", adminOnly, createExpense);
router.patch("/:id", adminOnly, updateExpense);
router.delete("/:id", adminOnly, deleteExpense);

export default router;
