import { Request, Response, NextFunction, response } from "express";
import { verifyToken } from "../utils/jwt.util";
import { fail } from "../utils/response";

export interface AuthRequest extends Request {
  user?: { id: number; email: string; role: string };
}

export const authenticate = (
  req: AuthRequest,
  response: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return fail(response, "Token tidak ditemukan atau format salah", 401);
  }
  try {
    const token = authHeader.split(" ")[1];
    req.user = verifyToken(token);
    next();
  } catch {
    return fail(response, "Token tidak valid atau expired", 401);
  }
};

export const requireRole =
  (...roles: string[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return fail(res, "Token tidak ditemukan", 401);
    if (!roles.includes(req.user.role))
      return fail(res, "Kamu tidak punya akses ke endpoint ini", 403);
    next();
  };

export const requireAdmin = requireRole("ADMIN");
