import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

/**
 * Simulasi webhook DANA untuk testing alur top up otomatis di lokal.
 * Kirim webhook PAID yang signed ke backend, saldo user langsung bertambah
 * dan dialog pembayaran di app berubah jadi sukses (polling 3 detik).
 *
 * Pemakaian:
 *   npx ts-node scripts/simulate-webhook.ts TOPUP-XXXXXXXX 15000
 *   npx ts-node scripts/simulate-webhook.ts <reference> <amount> [PAID|EXPIRED|FAILED]
 */

const [, , refArg, amountArg, statusArg] = process.argv;

if (!refArg) {
  console.error("Pemakaian: npx ts-node scripts/simulate-webhook.ts <reference> <amount> [status]");
  console.error("Contoh   : npx ts-node scripts/simulate-webhook.ts TOPUP-ABC123 15000 PAID");
  process.exit(1);
}

const amount = Number(amountArg ?? 0);
const status = statusArg || "PAID";
const baseUrl = process.env.API_URL || "http://localhost:3000";
const secret = process.env.DANA_WEBHOOK_SECRET || "";

const payload = JSON.stringify({
  reference: refArg,
  dana_ref: `SIM-${Date.now()}`,
  status,
  amount,
});

const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

const send = async () => {
  const res = await fetch(`${baseUrl}/api/v1/payments/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Signature": signature },
    body: payload,
  });
  const body = await res.json().catch(() => null);
  console.log(`HTTP ${res.status}`, JSON.stringify(body, null, 2));
};

send();
