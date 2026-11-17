import multer from "multer";
import { HttpError } from "../utils/http-error";

const storage = multer.memoryStorage();

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 3 * 1024 * 1024;

export const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return (cb as any)(new HttpError(400, "File harus berupa gambar (JPG, PNG, atau WEBP)"), false);
    }
    cb(null, true);
  },
});
