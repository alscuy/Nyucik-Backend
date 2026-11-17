import QRCode from "qrcode";

export const crc16 = (str: string): string => {
  let crc = 0xffff;
  for (let index = 0; index < str.length; index++) {
    crc ^= str.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit++) {
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
  let cursor = 0;
  while (cursor + 4 <= payload.length) {
    const tag = payload.slice(cursor, cursor + 2);
    const length = parseInt(payload.slice(cursor + 2, cursor + 4), 10);
    const value = payload.slice(cursor + 4, cursor + 4 + length);
    if (value.length < length) break;
    rows.push({ tag, value });
    cursor += 4 + length;
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
  const rows = parseEmv(staticPayload).filter((row) => row.tag !== "63");
  if (rows.length === 0) {
    throw new Error("Payload QRIS statis tidak valid");
  }

  let out: Array<{ tag: string; value: string }> = [];
  let hasAmount = false;
  for (const row of rows) {
    if (row.tag === "01") {
      out.push({ tag: "01", value: "12" });
    } else if (row.tag === "54") {
      hasAmount = true;
      out.push({ tag: "54", value: amount.toFixed(2) });
    } else {
      out.push(row);
    }
  }

  if (!hasAmount) {
    const position = out.findIndex((row) => row.tag === "59");
    out.splice(position === -1 ? out.length : position, 0, {
      tag: "54",
      value: amount.toFixed(2),
    });
  }

  const body = serialize(out) + "6304";
  return body + crc16(body);
};

export const generateQrisImage = (payload: string): Promise<string> =>
  QRCode.toDataURL(payload, { margin: 1, width: 512, errorCorrectionLevel: "M" });
