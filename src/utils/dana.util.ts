import crypto from "crypto";
import dotenv from "dotenv";
import { buildDynamicQris, generateQrisImage } from "./qris.util";

dotenv.config();

/**
 * Sumber QRIS untuk top up (TANPA kredensial DANA API):
 *  1. QRIS_STATIC_PAYLOAD terisi di .env -> QRIS DINAMIS dari QRIS statis
 *     merchant (nominal di-tag per transaksi, gambar QR asli)
 *  2. Kosong                             -> string sandbox (testing alur)
 * Saldo TIDAK pernah bertambah tanpa webhook valid.
 */

export interface QrisResult {
  sandbox: boolean;
  qr_string: string | null;
  qr_image: string | null;
  dana_ref: string | null;
  message?: string;
}

/** Buat QRIS dinamis (QRIS statis merchant -> sandbox) */
export const createQris = async (
  amount: number,
  reference: string
): Promise<QrisResult> => {
  // 1. QRIS dinamis dari QRIS statis merchant
  const staticPayload = process.env.QRIS_STATIC_PAYLOAD;
  if (staticPayload && staticPayload.trim().length > 0) {
    const payload = buildDynamicQris(staticPayload.trim(), amount);
    return {
      sandbox: false,
      qr_string: payload,
      qr_image: await generateQrisImage(payload),
      dana_ref: null,
      message:
        "QRIS dinamis dibuat dari QRIS statis merchant (nominal masuk otomatis). Status tetap PENDING sampai webhook valid diterima.",
    };
  }

  // 2. Sandbox
  return {
    sandbox: true,
    qr_string: `SANDBOX-QRIS|NYUCIK|${reference}|${amount}`,
    qr_image: null,
    dana_ref: null,
    message:
      "Mode sandbox: QRIS_STATIC_PAYLOAD belum terisi di environment. Webhook sandbox tetap diverifikasi signature-nya.",
  };
};

/** Verifikasi signature webhook DANA: HMAC-SHA256(rawBody, secret) dibandingkan header X-Signature */
export const verifyWebhookSignature = (rawBody: string, signature: string): boolean => {
  const secret = process.env.DANA_WEBHOOK_SECRET || "";
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
};
