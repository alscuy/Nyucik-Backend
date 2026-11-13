import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/httpError";

/** Error handler terpusat */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof HttpError) {
    return res
      .status(err.status)
      .json({ success: false, message: err.message });
  }

  if (err instanceof ZodError) {
    const msg = err.errors.map((e) => e.message).join(", ");
    return res.status(400).json({ success: false, message: msg });
  }

  console.error(err);
  return res.status(500).json({ success: false, message: "Terjadi kesalahan pada server" });
};

/** 404 untuk route yang tidak ada */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} tidak ditemukan`,
  });
};
