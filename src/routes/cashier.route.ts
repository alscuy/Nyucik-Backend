import { Router } from "express";
import { listUnpaidBookings, acceptCashPayment, cashierSummary, listPendingTopUps } from "../controllers/cashier.controller";
import { verifyTopUp } from "../controllers/admin.controller";
import { authenticate, requireRole } from "../middlewares/auth.middleware";

const staff = [authenticate, requireRole("CASHIER", "ADMIN")];

const router = Router();

router.get("/bookings", staff, listUnpaidBookings);
router.post("/bookings/:id/accept", staff, acceptCashPayment);
router.get("/topups", staff, listPendingTopUps);
router.patch("/topups/:id/verify", staff, verifyTopUp);
router.get("/summary", staff, cashierSummary);

export default router;
