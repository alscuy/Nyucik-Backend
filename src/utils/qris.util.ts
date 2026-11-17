import QRCode from "qrcode";

export const crc16 = (str: string): string => {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
};

export const parseEmv = (
  payload: string
): Array<{ tag: string; value: string }> => {
  const rows: Array<{ tag: string; value: string }> = [];
  let i = 0;
  while (i + 4 <= payload.length) {
    const tag = payload.slice(i, i + 2);
    const len = parseInt(payload.slice(i + 2, i + 4), 10);
    const value = payload.slice(i + 4, i + 4 + len);
    if (value.length < len) break;
    rows.push({ tag, value });
    i += 4 + len;
  }
  return rows;
};

const serialize = (rows: Array<{ tag: string; value: string }>): string =>
  rows
    .map(({ tag, value }) => `${tag}${String(value.length).padStart(2, "0")}${value}`)
    .join("");

export const buildDynamicQris = (
  staticPayload: string,
  amount: number
): string => {
  const rows = parseEmv(staticPayload).filter((r) => r.tag !== "63");
  if (rows.length === 0) {
    throw new Error("Payload QRIS statis tidak valid");
  }

  let out: Array<{ tag: string; value: string }> = [];
  let hasAmount = false;
  for (const r of rows) {
    if (r.tag === "01") {
      out.push({ tag: "01", value: "12" });
    } else if (r.tag === "54") {
      hasAmount = true;
      out.push({ tag: "54", value: amount.toFixed(2) });
    } else {
      out.push(r);
    }
  }

  if (!hasAmount) {
    const idx = out.findIndex((r) => r.tag === "59");
    out.splice(idx === -1 ? out.length : idx, 0, {
      tag: "54",
      value: amount.toFixed(2),
    });
  }

  const body = serialize(out) + "6304";
  return body + crc16(body);
};

export const generateQrisImage = (payload: string): Promise<string> =>
  QRCode.toDataURL(payload, { margin: 1, width: 512, errorCorrectionLevel: "M" });
