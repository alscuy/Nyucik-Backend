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
} from "../controllers/booking.controller";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();
const adminOnly = [authenticate, requireAdmin];

router.post("/", authenticate, upload.single("photo"), createBooking);          // create (foto cucian wajib utk mesin cuci)
router.get("/my", authenticate, getMyBookings);
router.get("/:id", authenticate, getBookingDetail);
router.post("/:id/pay", authenticate, payBooking);                              // bayar pakai saldo
router.post("/:id/cancel", authenticate, cancelBooking);
router.post("/:id/arrival-photo", authenticate, upload.single("photo"), uploadArrivalPhoto); // foto sudah sampai (folder: bookings/arrived)

// Admin
router.get("/", adminOnly, getAllBookings);
router.patch("/:id/status", adminOnly, updateBookingStatus);

export default router;
