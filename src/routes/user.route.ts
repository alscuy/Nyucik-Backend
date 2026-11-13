import { Router } from "express";
import {
  getProfile,
  updateProfile,
  changePassword,
  myTransactions,
  myBookings,
} from "../controllers/user.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();

router.use(authenticate);

router.get("/me", getProfile);
router.patch("/me", upload.single("photo"), updateProfile);
router.patch("/me/password", changePassword);
router.get("/me/transactions", myTransactions);
router.get("/me/bookings", myBookings);

export default router;
