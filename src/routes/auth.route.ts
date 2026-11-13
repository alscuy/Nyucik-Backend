import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  register,
  verifyOtp,
  resendOtp,
  login,
  logout,
} from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

// Rate limit khusus auth: max 10 request / 15 menit per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Terlalu banyak percobaan, coba lagi dalam 15 menit" },
});

router.post("/register", authLimiter, register);
router.post("/verify-otp", authLimiter, verifyOtp);
router.post("/resend-otp", authLimiter, resendOtp);
router.post("/login", authLimiter, login);
router.post("/logout", authenticate, logout);

export default router;
