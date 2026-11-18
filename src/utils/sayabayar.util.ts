import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const env = (key: string) => (process.env[key] || "").trim();

const baseUrl = () =>
  (env("SAYABAYAR_BASE_URL") || "https://api.sayabayar.com/v1").replace(
    /\/$/,
    ""
  );

const apiKey = () => env("SAYABAYAR_API_KEY");

export const sayabayarEnabled = () => apiKey().length > 0;

export const webhookEnabled = () =>
  env("SAYABAYAR_WEBHOOK_SECRET").length > 0;

export const verifyWebhook = (raw: string, signature: string) => {
  const secret = env("SAYABAYAR_WEBHOOK_SECRET");
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(raw)
    .digest("hex");
  const received = Buffer.from(signature);
  const target = Buffer.from(expected);
  return (
    received.length === target.length &&
    crypto.timingSafeEqual(received, target)
  );
};

const call = async (path: string, method = "GET", body?: unknown) => {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json: any = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(
      json.error?.message || json.message || `HTTP ${res.status}`
    );
  }
  return json.data;
};

export interface SayabayarInvoice {
  id: string;
  invoiceNumber: string;
  paymentUrl: string;
  status: string;
}

const toInvoice = (data: any): SayabayarInvoice => {
  const id = String(data?.id ?? data?.invoice_id ?? "");
  if (!id) throw new Error("ID invoice Sayabayar tidak ditemukan");
  return {
    id,
    invoiceNumber: String(
      data?.invoice_number ?? data?.invoiceNumber ?? ""
    ),
    paymentUrl: String(data?.payment_url ?? data?.paymentUrl ?? ""),
    status: String(data?.status ?? "PENDING"),
  };
};

export const createSayabayarInvoice = async (params: {
  reference: string;
  amount: number;
  name: string;
  email: string;
}): Promise<SayabayarInvoice> => {
  const data = await call("/invoices", "POST", {
    customer_name: params.name,
    customer_email: params.email,
    amount: params.amount,
    description: `Top up saldo Nyucik (${params.reference})`,
    channel_preference: "client",
    payment_method: "qris",
  });
  const invoice = toInvoice(data);
  if (!invoice.paymentUrl) {
    throw new Error("URL pembayaran Sayabayar tidak ditemukan");
  }
  return invoice;
};

export const getSayabayarInvoice = async (
  id: string
): Promise<SayabayarInvoice> =>
  toInvoice(await call(`/invoices/${encodeURIComponent(id)}`));

export const confirmSayabayarInvoice = async (id: string) => {
  try {
    return await call(`/invoices/${encodeURIComponent(id)}/confirm`, "POST");
  } catch {
    return null;
  }
};

const paidStatuses = [
  "paid",
  "lunas",
  "success",
  "successful",
  "settled",
  "settlement",
  "completed",
  "confirmed",
  "captured",
];

export const isPaidStatus = (status: string) =>
  paidStatuses.includes(status.trim().toLowerCase());
