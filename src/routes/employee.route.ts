import { Router } from "express";
import {
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "../controllers/employee.controller";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware";

const router = Router();
const adminOnly = [authenticate, requireAdmin];

router.get("/", authenticate, listEmployees);
router.post("/", adminOnly, createEmployee);
router.patch("/:id", adminOnly, updateEmployee);
router.delete("/:id", adminOnly, deleteEmployee);

export default router;
