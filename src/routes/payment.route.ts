import { Router } from "express";
import { danaWebhook } from "../controllers/wallet.controller";

const router = Router();

// Webhook DANA (publik) - keamanan lewat verifikasi signature HMAC + idempotency
router.post("/webhook", danaWebhook);

export default router;
