import { Response } from "express";
import { success, fail } from "../utils/response";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getStoreStatus, setStoreOpen } from "../services/store.service";

export const getStatus = async (_req: AuthRequest, res: Response) => {
  return success(res, await getStoreStatus(), "Status toko berhasil diambil");
};

export const updateStatus = async (req: AuthRequest, res: Response) => {
  if (typeof req.body?.is_open !== "boolean") {
    return fail(res, "is_open wajib boolean", 400);
  }

  const data = await setStoreOpen(req.body.is_open);
  return success(res, data, data.is_open ? "Toko dibuka" : "Toko ditutup");
};
