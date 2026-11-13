import { Response } from "express";

/** Format response JSON yang konsisten: { success, message, data } */
export const success = (
  res: Response,
  data: unknown = null,
  message = "Success",
  status = 200
) => res.status(status).json({ success: true, message, data });

export const fail = (
  res: Response,
  message = "Terjadi kesalahan pada server",
  status = 500
) => res.status(status).json({ success: false, message });
