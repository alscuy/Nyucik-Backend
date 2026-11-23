import dotenv from "dotenv";

dotenv.config();

const env = (key: string) => (process.env[key] || "").trim();

const baseUrl = () => env("KIPAY_BASE_URL") || "https://api.kipay.biz.id";
const apiKey = () => env("KIPAY_API_KEY");

export const kipayEnabled = () => Boolean(apiKey());

/**
 * Link halaman pembayaran publik milik project.
 * Dipakai sebagai fallback kalau transaksi perlu dibuka di browser.
 */
export const kipayPaymentUrl = (): string | null => {
  const custom = env("KIPAY_PAYMENT_URL");
  if (custom) return custom;
  return apiKey() ? `${baseUrl()}/pay/${apiKey()}` : null;
};

export type KipayTransaction = {
  trxId: string;
  mode: string;
  requestedAmount: number;
  uniqueCode: number;
  amount: number;
  feeAmount: number;
  feeBearer: string;
  status: string;
  provider: string | null;
  note: string | null;
  qrPayload: string;
  qrUrl: string;
  matchedAt: string | null;
  createdAt: string;
  expiresAt: string;
};

const mapTransaction = (data: any): KipayTransaction => ({
  trxId: String(data?.trx_id || ""),
  mode: String(data?.mode || ""),
  requestedAmount: Number(data?.requested_amount ?? 0),
  uniqueCode: Number(data?.unique_code ?? 0),
  amount: Number(data?.amount ?? 0),
  feeAmount: Number(data?.fee_amount ?? 0),
  feeBearer: String(data?.fee_bearer || ""),
  status: String(data?.status || "").toLowerCase(),
  provider: data?.provider ? String(data.provider) : null,
  note: data?.note ? String(data.note) : null,
  qrPayload: String(data?.qr_payload || ""),
  qrUrl: String(data?.qr_url || ""),
  matchedAt: data?.matched_at ? String(data.matched_at) : null,
  createdAt: String(data?.created_at || ""),
  expiresAt: String(data?.expires_at || ""),
});

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  if (!kipayEnabled()) {
    throw new Error("KiPay belum dikonfigurasi (KIPAY_API_KEY)");
  }

  const response = await fetch(
    `${baseUrl()}/api/pay/${encodeURIComponent(apiKey())}${path}`,
    {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers || {}),
      },
      signal: AbortSignal.timeout(30000),
    }
  );

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      `KiPay error (HTTP ${response.status})`;
    throw new Error(message);
  }

  return payload as T;
};

export const createKipayTransaction = async (
  amount: number,
  note?: string
): Promise<KipayTransaction> => {
  const data = await request<any>("/transactions", {
    method: "POST",
    body: JSON.stringify({ amount, note: note || null }),
  });

  const transaction = mapTransaction(data);
  if (!transaction.trxId || !transaction.qrPayload) {
    throw new Error("KiPay tidak mengembalikan transaksi/QR yang valid");
  }

  if (transaction.mode === "sandbox") {
    console.warn(
      "[KiPay] Transaksi dibuat dalam mode sandbox. " +
        "Gunakan API key project production untuk pembayaran QRIS nyata."
    );
  }

  return transaction;
};

export const getKipayTransaction = async (
  trxId: string
): Promise<KipayTransaction> => {
  const data = await request<any>(
    `/transactions/${encodeURIComponent(trxId)}`,
    { method: "GET" }
  );

  const transaction = mapTransaction(data);
  if (!transaction.trxId) {
    throw new Error("KiPay tidak mengembalikan detail transaksi yang valid");
  }
  return transaction;
};

/**
 * Simulasi pembayaran sandbox KiPay.
 * Hanya berlaku untuk project sandbox (project production akan menolak).
 */
export const simulateKipayTransaction = async (
  trxId: string,
  provider = "shopeepay"
): Promise<KipayTransaction> => {
  const data = await request<any>(
    `/transactions/${encodeURIComponent(trxId)}/simulate`,
    {
      method: "POST",
      body: JSON.stringify({ provider }),
    }
  );

  return mapTransaction(data);
};
