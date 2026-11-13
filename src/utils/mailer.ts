import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/** Kirim OTP 6 digit ke email user Nyucik */
export const sendOTPEmail = async (to: string, otp: string) => {
  const mailOptions = {
    from: `"Nyucik Laundry" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Kode OTP Verifikasi Akun Nyucik",
    html: `
      <div style="font-family: Arial, sans-serif; background: #f4f6f8; color: #222; padding: 40px; text-align: center;">
        <h2 style="color:#0b7285;">Verifikasi Email Nyucik</h2>
        <p>Gunakan kode OTP di bawah ini untuk mengaktifkan akun laundry kamu:</p>
        <h1 style="font-size: 48px; letter-spacing: 10px; background: #0b7285; color: #fff; display: inline-block; padding: 10px 24px; border-radius: 8px;">${otp}</h1>
        <p>Kode ini berlaku selama <b>5 menit</b> dan hanya bisa dipakai <b>1 kali</b>. Jangan bagikan kode ini kepada siapa pun.</p>
      </div>
    `,
  };
  await transporter.sendMail(mailOptions);
};
