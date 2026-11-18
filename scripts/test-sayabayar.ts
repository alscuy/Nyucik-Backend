import dotenv from "dotenv";

dotenv.config();

const apiKey = (process.env.SAYABAYAR_API_KEY || "").trim();
const base = (
  process.env.SAYABAYAR_BASE_URL || "https://api.sayabayar.com/v1"
).replace(/\/$/, "");

const headers = {
  "Content-Type": "application/json",
  "X-API-Key": apiKey,
};

const call = async (path: string, method = "GET", body?: unknown) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
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

const print = (label: string, data: unknown) => {
  console.log(`\n${label}`);
  console.log(JSON.stringify(data, null, 2));
};

const create = async (amount: number) => {
  const invoice = await call("/invoices", "POST", {
    customer_name: "Uji Nyucik",
    customer_email: "user@nyucik.com",
    amount,
    description: `Uji QRIS ${amount}`,
    channel_preference: "client",
    payment_method: "qris",
  });
  print("Invoice dibuat", invoice);
  console.log(`\nURL bayar: ${invoice.payment_url}`);
  console.log(`ID invoice: ${invoice.id}`);
  return invoice;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isPaid = (status: unknown) => {
  const value = String(status || "").toLowerCase();
  return ["paid", "success", "settle", "complete", "confirmed"].some((key) =>
    value.includes(key)
  );
};

const poll = async (id: string, seconds: number) => {
  const until = Date.now() + seconds * 1000;
  let last = "";
  while (Date.now() < until) {
    const detail = await call(`/invoices/${id}`);
    if (detail.status !== last) {
      last = detail.status;
      console.log(
        `[${new Date().toLocaleTimeString("id-ID")}] status: ${detail.status}`
      );
    }
    if (isPaid(detail.status)) {
      print("Invoice lunas", detail);
      return detail;
    }
    await wait(3000);
  }
  console.log("Polling selesai. Cek manual: check " + id);
  return null;
};

const run = async () => {
  if (!apiKey) {
    console.error("SAYABAYAR_API_KEY belum diisi di .env");
    process.exit(1);
  }

  const [command = "create", arg1, arg2] = process.argv.slice(2);

  if (command === "create") {
    const invoice = await create(Number(arg1 || 1000));
    if (arg2 !== "--no-poll") await poll(String(invoice.id), 120);
    return;
  }

  if (command === "check") {
    print("Detail invoice", await call(`/invoices/${arg1}`));
    return;
  }

  if (command === "confirm") {
    print("Konfirmasi", await call(`/invoices/${arg1}/confirm`, "POST"));
    print("Detail invoice", await call(`/invoices/${arg1}`));
    return;
  }

  if (command === "poll") {
    await poll(String(arg1), Number(arg2 || 120));
    return;
  }

  console.error(
    "Perintah: create [nominal] [--no-poll] | check <id> | confirm <id> | poll <id> [detik]"
  );
};

run().catch((err: any) => {
  console.error("Gagal:", err?.message || err);
  process.exit(1);
});
