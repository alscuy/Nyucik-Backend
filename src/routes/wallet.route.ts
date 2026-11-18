import { Router } from "express";
import {
  getBalance,
  getWalletTransactions,
  createTopUp,
  getTopUps,
  simulateTopUpPayment,
} from "../controllers/wallet.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/balance", authenticate, getBalance);
router.get("/transactions", authenticate, getWalletTransactions);
router.post("/topup", authenticate, createTopUp);
router.get("/topups", authenticate, getTopUps);
router.post("/topups/:id/simulate", authenticate, simulateTopUpPayment);

export default router;
