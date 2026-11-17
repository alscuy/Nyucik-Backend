import { Router } from "express";
import {
  getBalance,
  getWalletTransactions,
  createTopUp,
  getTopUps,
  getTopUpDetail,
  uploadTopUpProof,
} from "../controllers/wallet.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();

router.get("/balance", authenticate, getBalance);
router.get("/transactions", authenticate, getWalletTransactions);
router.post("/topup", authenticate, createTopUp);
router.get("/topups", authenticate, getTopUps);
router.get("/topups/:id", authenticate, getTopUpDetail);
router.post("/topups/:id/proof", authenticate, upload.single("photo"), uploadTopUpProof);

export default router;
