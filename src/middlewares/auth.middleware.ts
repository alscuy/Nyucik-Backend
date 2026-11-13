import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.util";
import { success, fail } from "../utils/response";

export interface AuthRequest extends Request {
  user?: { id: number; email: string; role: string };
}

/** Wajib login (Bearer token) */
export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return fail(res, "Token tidak ditemukan atau format salah", 401);
  }
  try {
    const token = authHeader.split(" ")[1];
    req.user = verifyToken(token);
    next();
  } catch {
    return fail(res, "Token tidak valid atau expired", 401);
  }
};

/** Wajib role ADMIN */
export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) return fail(res, "Token tidak ditemukan", 401);
  if (req.user.role !== "ADMIN")
    return fail(res, "Endpoint ini khusus admin", 403);
  next();
};

export { success };
