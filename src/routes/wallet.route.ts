import { Router } from "express";
import {
  getBalance,
  getWalletTransactions,
  createTopUp,
  getTopUps,
  payTopUp,
  simulateTopUp,
  cancelTopUp,
} from "../controllers/wallet.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/balance", authenticate, getBalance);
router.get("/transactions", authenticate, getWalletTransactions);
router.post("/topup", authenticate, createTopUp);
router.get("/topups", authenticate, getTopUps);
router.post("/topups/:id/pay", authenticate, payTopUp);
router.post("/topups/:id/check", authenticate, payTopUp);
router.post("/topups/:id/simulate", authenticate, simulateTopUp);
router.post("/topups/:id/cancel", authenticate, cancelTopUp);

export default router;
