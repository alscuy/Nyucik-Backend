import crypto from "crypto";
import dotenv from "dotenv";
import { buildDynamicQris, generateQrisImage } from "./qris.util";

dotenv.config();

const env = (key: string) => (process.env[key] || "").trim();

const privateKey = () => env("DANA_PRIVATE_KEY").replace(/\\n/g, "\n");

const baseUrl = () =>
  env("DANA_BASE_URL") ||
  (env("DANA_ENV") === "production"
    ? "https://api.dana.id"
    : "https://api.sandbox.dana.id");

export const danaEnabled = () =>
  Boolean(
    privateKey() &&
      env("DANA_CLIENT_ID") &&
      env("DANA_PARTNER_ID") &&
      env("DANA_MERCHANT_ID")
  );

const timestamp = () =>
  new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 19) + "+07:00";

const sign = (data: string) =>
  crypto.sign("RSA-SHA256", Buffer.from(data), privateKey()).toString("base64");

const sha256 = (data: string) =>
  crypto.createHash("sha256").update(data).digest("hex").toLowerCase();

let cachedToken: { token: string; expiresAt: number } | null = null;

const getAccessToken = async (): Promise<string> => {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const ts = timestamp();
  const res = await fetch(`${baseUrl()}/v1.0/access-token/b2b.htm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-TIMESTAMP": ts,
      "X-CLIENT-KEY": env("DANA_CLIENT_ID"),
      "X-SIGNATURE": sign(`${env("DANA_CLIENT_ID")}|${ts}`),
    },
    body: JSON.stringify({ grantType: "client_credentials" }),
  });
  const data: any = await res.json();
  if (!res.ok || !data.accessToken) {
    throw new Error(data.responseMessage || "Gagal mengambil access token DANA");
  }

  cachedToken = {
    token: data.accessToken,
    expiresAt: Date.now() + Number(data.expiresIn || 900) * 1000,
  };
  return cachedToken.token;
};

const post = async (path: string, body: unknown) => {
  const token = await getAccessToken();
  const ts = timestamp();
  const raw = JSON.stringify(body);
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-TIMESTAMP": ts,
      "X-SIGNATURE": sign(`POST:${path}:${token}:${sha256(raw)}:${ts}`),
      ORIGIN: env("DANA_ORIGIN"),
      "X-PARTNER-ID": env("DANA_PARTNER_ID"),
      "X-EXTERNAL-ID": crypto.randomUUID().replace(/-/g, ""),
      "CHANNEL-ID": env("DANA_CHANNEL_ID"),
    },
    body: raw,
  });
  const data: any = await res.json();
  return { ok: res.ok, data };
};

export interface DanaQr {
  referenceNo: string;
  externalId: string;
  qrContent: string;
  transactionDate: string;
}

export const createDanaQr = async (
  partnerReferenceNo: string,
  amount: number
): Promise<DanaQr> => {
  const transactionDate = timestamp();
  const externalId = crypto.randomUUID().replace(/-/g, "");
  const path = "/v1.0/qr/qr-mpm-generate.htm";
  const token = await getAccessToken();
  const ts = timestamp();
  const raw = JSON.stringify({
    merchantId: env("DANA_MERCHANT_ID"),
    partnerReferenceNo,
    amount: { value: amount.toFixed(2), currency: "IDR" },
    storeId: env("DANA_STORE_ID"),
    additionalInfo: {
      terminalSource: "MER",
      envInfo: { terminalType: "SYSTEM", orderTerminalType: "APP" },
    },
  });

  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-TIMESTAMP": ts,
      "X-SIGNATURE": sign(`POST:${path}:${token}:${sha256(raw)}:${ts}`),
      ORIGIN: env("DANA_ORIGIN"),
      "X-PARTNER-ID": env("DANA_PARTNER_ID"),
      "X-EXTERNAL-ID": externalId,
      "CHANNEL-ID": env("DANA_CHANNEL_ID"),
    },
    body: raw,
  });
  const data: any = await res.json();
  const qrContent = data.qrContent || data.qrString || data.qrCode;
  if (!res.ok || !qrContent) {
    throw new Error(
      data.responseMessage || data.error?.message || "Gagal membuat QRIS DANA"
    );
  }

  return {
    referenceNo: String(data.referenceNo || ""),
    externalId,
    qrContent: String(qrContent),
    transactionDate,
  };
};

export interface DanaStatus {
  paid: boolean;
  status: string;
  message: string;
}

export const checkDanaStatus = async (params: {
  partnerReferenceNo: string;
  referenceNo: string;
  externalId?: string | null;
  transactionDate: string;
  amount: number;
}): Promise<DanaStatus> => {
  const { ok, data } = await post("/rest/v1.1/debit/status", {
    originalPartnerReferenceNo: params.partnerReferenceNo,
    originalReferenceNo: params.referenceNo,
    originalExternalId: params.externalId || undefined,
    serviceCode: "47",
    transactionDate: params.transactionDate,
    amount: { value: params.amount.toFixed(2), currency: "IDR" },
    merchantId: env("DANA_MERCHANT_ID"),
    subMerchantId: env("DANA_MERCHANT_ID"),
    externalStoreId: env("DANA_STORE_ID") || undefined,
    additionalInfo: {},
  });

  const status = String(
    data.latestTransactionStatus || data.transactionStatus || data.responseCode || ""
  );
  return {
    paid: ok && status === "00",
    status,
    message: data.transactionStatusDesc || data.responseMessage || "Status tidak diketahui",
  };
};

export interface QrisResult {
  sandbox: boolean;
  qr_string: string | null;
  qr_image: string | null;
}

export const createStaticQris = async (
  amount: number,
  reference: string
): Promise<QrisResult> => {
  const staticPayload = env("QRIS_STATIC_PAYLOAD");
  if (staticPayload.length > 0) {
    const payload = buildDynamicQris(staticPayload, amount);
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
