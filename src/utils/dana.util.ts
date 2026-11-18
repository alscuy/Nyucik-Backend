import dotenv from "dotenv";
import { buildDynamicQris, generateQrisImage } from "./qris.util";

dotenv.config();

export interface QrisResult {
  sandbox: boolean;
  qr_string: string | null;
  qr_image: string | null;
}

export const createQris = async (
  amount: number,
  reference: string
): Promise<QrisResult> => {
  const staticPayload = process.env.QRIS_STATIC_PAYLOAD;
  if (staticPayload && staticPayload.trim().length > 0) {
    const payload = buildDynamicQris(staticPayload.trim(), amount);
    return {
      sandbox: false,
      qr_string: payload,
      qr_image: await generateQrisImage(payload),
    };
  }

  return {
    sandbox: true,
    qr_string: `SANDBOX-QRIS|NYUCIK|${reference}|${amount}`,
    qr_image: null,
  };
};
