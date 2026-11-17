import { Router } from "express";
import {
  createBooking,
  getMyBookings,
  getBookingDetail,
  payBooking,
  cancelBooking,
  uploadArrivalPhoto,
  getAllBookings,
  updateBookingStatus,
  updateBooking,
  deleteBooking,
} from "../controllers/booking.controller";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();
const adminOnly = [authenticate, requireAdmin];

router.post("/", authenticate, upload.single("photo"), createBooking);
router.get("/my", authenticate, getMyBookings);
router.get("/:id", authenticate, getBookingDetail);
router.patch("/:id", authenticate, updateBooking);
router.post("/:id/pay", authenticate, payBooking);
router.post("/:id/cancel", authenticate, cancelBooking);
router.post("/:id/arrival-photo", authenticate, upload.single("photo"), uploadArrivalPhoto);

router.get("/", adminOnly, getAllBookings);
router.patch("/:id/status", adminOnly, updateBookingStatus);
router.delete("/:id", adminOnly, deleteBooking);

export default router;
