import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const SECRET = process.env.JWT_SECRET as string;
const EXPIRES = process.env.JWT_EXPIRES_IN || "1d";

export interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

export const signToken = (payload: TokenPayload): string =>
  jwt.sign(payload, SECRET, { expiresIn: EXPIRES } as jwt.SignOptions);

export const verifyToken = (token: string): TokenPayload =>
  jwt.verify(token, SECRET) as TokenPayload;
