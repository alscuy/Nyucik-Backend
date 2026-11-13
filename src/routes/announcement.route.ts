import { Router } from "express";
import {
  listAnnouncements,
  listAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../controllers/announcement.controller";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();
const adminOnly = [authenticate, requireAdmin];

router.get("/", authenticate, listAnnouncements);                  // pengumuman aktif utk user
router.get("/admin/all", adminOnly, listAllAnnouncements);
router.post("/", adminOnly, upload.single("photo"), createAnnouncement);
router.patch("/:id", adminOnly, upload.single("photo"), updateAnnouncement);
router.delete("/:id", adminOnly, deleteAnnouncement);

export default router;
