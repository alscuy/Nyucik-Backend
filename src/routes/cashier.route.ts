import { Router } from "express";
import {
  listUnpaidBookings,
  acceptCashPayment,
  cashierSummary,
  listPendingTopUps,
  verifyTopUp,
} from "../controllers/cashier";
import { authenticate, requireRole } from "../middlewares/auth.middleware";

const cashierOnly = [authenticate, requireRole("CASHIER")];

const router = Router();

router.get("/bookings", cashierOnly, listUnpaidBookings);
router.post("/bookings/:id/accept", cashierOnly, acceptCashPayment);
router.get("/topups", cashierOnly, listPendingTopUps);
router.patch("/topups/:id/verify", cashierOnly, verifyTopUp);
router.get("/summary", cashierOnly, cashierSummary);

export default router;
