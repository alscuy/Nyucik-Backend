import { Router } from "express";
import {
  register,
  verifyOtp,
  resendOtp,
  login,
  logout,
} from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/login", login);
router.post("/logout", authenticate, logout);

export default router;
