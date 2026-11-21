import { Router } from "express";
import {
  createBooking,
  getMyBookings,
  getBookingDetail,
  payBooking,
  cancelBooking,
  startLaundry,
  getAllBookings,
  updateBookingStatus,
  deleteBooking,
} from "../controllers/booking.controller";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();
const adminOnly = [authenticate, requireAdmin];

router.post("/", authenticate, upload.single("photo"), createBooking);
router.get("/my", authenticate, getMyBookings);
router.get("/:id", authenticate, getBookingDetail);
router.post("/:id/pay", authenticate, payBooking);
router.post("/:id/cancel", authenticate, cancelBooking);
router.post("/:id/start", authenticate, upload.single("photo"), startLaundry);

router.get("/", adminOnly, getAllBookings);
router.patch("/:id/status", adminOnly, updateBookingStatus);
router.delete("/:id", adminOnly, deleteBooking);

export default router;
