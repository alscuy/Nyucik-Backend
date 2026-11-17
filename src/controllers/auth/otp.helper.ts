import bcrypt from "bcryptjs";
import { pool } from "../../config/database";
import { sendOTPEmail } from "../../utils/mailer";

const generateOTP = (): string => Math.floor(100000 + Math.random() * 900000).toString();

export const createAndSendOtp = async (userId: number, email: string) => {
  const otp = generateOTP();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await pool.query(
    `UPDATE users SET otp_hash = ?, otp_expires_at = ?,
     otp_attempts = 0, otp_last_sent_at = ? WHERE id = ?`,
    [otpHash, expiresAt, new Date(), userId]
  );
  await sendOTPEmail(email, otp);
  return otp;
};
