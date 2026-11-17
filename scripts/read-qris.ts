import fs from "fs";
import jsQR from "jsqr";
import jpeg from "jpeg-js";

const run = () => {
  const file = process.argv[2] ?? "image/qriss.jpg";
  const buf = fs.readFileSync(file);
  const img = jpeg.decode(buf, { useTArray: true });
  const code = jsQR(new Uint8ClampedArray(img.data), img.width, img.height);
  if (!code) {
    console.error("❌ QR tidak terbaca dari gambar:", file);
    process.exitCode = 1;
    return;
  }
  console.log("✅ Payload QRIS:");
  console.log(code.data);
};

run();
