import crypto from "crypto";
import dotenv from "dotenv";
import { buildDynamicQris, generateQrisImage } from "./qris.util";

dotenv.config();

/**
 * Integrasi DANA QRIS Acquirer MPM.
 * Prioritas sumber QRIS:
 *  1. Kredensial DANA lengkap di .env      -> QRIS asli dari API DANA
 *  2. QRIS_STATIC_PAYLOAD terisi di .env   -> QRIS DINAMIS dari QRIS statis
 *     merchant (tanpa kredensial DANA, nominal di-tag per transaksi)
 *  3. Kosong semua                          -> string sandbox (testing alur)
 * Saldo TIDAK pernah bertambah tanpa webhook valid.
 */
export const isDanaConfigured = (): boolean =>
  Boolean(
    process.env.DANA_MERCHANT_ID &&
      process.env.DANA_CLIENT_ID &&
      process.env.DANA_API_URL
  );

export interface QrisResult {
  sandbox: boolean;
  qr_string: string | null;
  qr_image: string | null;
  dana_ref: string | null;
  message?: string;
}

/** Buat QRIS dinamis (DANA API -> QRIS statis merchant -> sandbox) */
export const createQris = async (
  amount: number,
  reference: string
): Promise<QrisResult> => {
  // 1. DANA asli
  if (isDanaConfigured()) {
    // Struktur request mengikuti DANA QRIS Acquirer MPM:
    // POST {DANA_API_URL}/dana/qr/generate dengan auth header dari env.
    try {
      const res = await fetch(process.env.DANA_API_URL + "/dana/qr/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CLIENT-ID": process.env.DANA_CLIENT_ID!,
          Authorization:
            "Bearer " +
            crypto
              .createHmac("sha256", process.env.DANA_CLIENT_SECRET!)
              .update(reference)
              .digest("hex"),
        },
        body: JSON.stringify({
          merchantId: process.env.DANA_MERCHANT_ID,
          terminalId: process.env.DANA_TERMINAL_ID,
          amount: { value: amount, currency: "IDR" },
          partnerReferenceNo: reference,
          validityPeriod: 900,
        }),
      });
      const data: any = await res.json();
      return {
        sandbox: false,
        qr_string: data.qrString ?? data.qr_string ?? null,
        qr_image: null,
        dana_ref: data.referenceNo ?? data.reference_id ?? null,
      };
    } catch (err) {
      console.error("DANA QRIS error:", err);
      throw new Error("Gagal membuat QRIS dari DANA");
    }
  }

  // 2. QRIS dinamis dari QRIS statis merchant (tanpa kredensial DANA)
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

  // 3. Sandbox
  return {
    sandbox: true,
    qr_string: `SANDBOX-QRIS|NYUCIK|${reference}|${amount}`,
    qr_image: null,
    dana_ref: null,
    message:
      "Mode sandbox: kredensial DANA & QRIS_STATIC_PAYLOAD belum tersedia di environment. Webhook sandbox tetap diverifikasi signature-nya.",
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
