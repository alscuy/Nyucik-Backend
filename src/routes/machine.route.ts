import { Router } from "express";
import {
  listWashingMachines,
  getWashingMachine,
  createWashingMachine,
  updateWashingMachine,
  updateWashingStatus,
  deleteWashingMachine,
  listDryingMachines,
  getDryingMachine,
  createDryingMachine,
  updateDryingMachine,
  updateDryingStatus,
  deleteDryingMachine,
} from "../controllers/machine.controller";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();
const adminOnly = [authenticate, requireAdmin];

// ==================== MESIN CUCI ====================
router.get("/washing-machines", authenticate, listWashingMachines);
router.get("/washing-machines/:id", authenticate, getWashingMachine);
router.post("/washing-machines", adminOnly, upload.single("photo"), createWashingMachine);
router.patch("/washing-machines/:id", adminOnly, upload.single("photo"), updateWashingMachine);
router.patch("/washing-machines/:id/status", adminOnly, updateWashingStatus);
router.delete("/washing-machines/:id", adminOnly, deleteWashingMachine);

// ==================== MESIN PENGERING ====================
router.get("/drying-machines", authenticate, listDryingMachines);
router.get("/drying-machines/:id", authenticate, getDryingMachine);
router.post("/drying-machines", adminOnly, upload.single("photo"), createDryingMachine);
router.patch("/drying-machines/:id", adminOnly, upload.single("photo"), updateDryingMachine);
router.patch("/drying-machines/:id/status", adminOnly, updateDryingStatus);
router.delete("/drying-machines/:id", adminOnly, deleteDryingMachine);

export default router;
