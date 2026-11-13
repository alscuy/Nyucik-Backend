import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

/**
 * Integrasi DANA QRIS Acquirer MPM.
 * Jika kredensial DANA belum diisi di .env -> mode SANDBOX:
 * QRIS dibuat secara internal, hanya untuk testing struktur & alur.
 * Saldo TIDAK pernah bertambah dari sandbox tanpa webhook valid.
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
  dana_ref: string | null;
  message?: string;
}

/** Buat QRIS dinamis (real DANA bila terkonfigurasi, sandbox bila belum) */
export const createQris = async (
  amount: number,
  reference: string
): Promise<QrisResult> => {
  if (!isDanaConfigured()) {
    return {
      sandbox: true,
      qr_string: `SANDBOX-QRIS|NYUCIK|${reference}|${amount}`,
      dana_ref: null,
      message:
        "Mode sandbox: kredensial DANA belum tersedia di environment. Webhook sandbox tetap diverifikasi signature-nya.",
    };
  }

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
      dana_ref: data.referenceNo ?? data.reference_id ?? null,
    };
  } catch (err) {
    console.error("DANA QRIS error:", err);
    throw new Error("Gagal membuat QRIS dari DANA");
  }
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
