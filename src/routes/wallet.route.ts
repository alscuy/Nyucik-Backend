import { Router } from "express";
import {
  getBalance,
  getWalletTransactions,
  createTopUp,
  getTopUps,
  getTopUpDetail,
} from "../controllers/wallet.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

// ==================== WALLET (user) ====================
router.get("/balance", authenticate, getBalance);
router.get("/transactions", authenticate, getWalletTransactions);
router.post("/topup", authenticate, createTopUp);
router.get("/topups", authenticate, getTopUps);
router.get("/topups/:id", authenticate, getTopUpDetail);

export default router;
