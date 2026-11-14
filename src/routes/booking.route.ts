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

router.post("/", authenticate, upload.single("photo"), createBooking);          // create (foto cucian wajib utk mesin cuci)
router.get("/my", authenticate, getMyBookings);
router.get("/:id", authenticate, getBookingDetail);
router.patch("/:id", authenticate, updateBooking);                              // user: ubah jadwal (reschedule)
router.post("/:id/pay", authenticate, payBooking);                              // bayar pakai saldo
router.post("/:id/cancel", authenticate, cancelBooking);                        // batal (sampai 30 menit sebelum jadwal)
router.post("/:id/arrival-photo", authenticate, upload.single("photo"), uploadArrivalPhoto); // konfirmasi tiba (window 10 menit sejak jadwal)

// Admin
router.get("/", adminOnly, getAllBookings);
router.patch("/:id/status", adminOnly, updateBookingStatus);
router.delete("/:id", adminOnly, deleteBooking);

export default router;
