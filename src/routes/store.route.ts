import { Router } from "express";
import { getStatus, updateStatus } from "../controllers/store.controller";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware";

const router = Router();

router.get("/status", getStatus);
router.patch("/status", authenticate, requireAdmin, updateStatus);

export default router;
