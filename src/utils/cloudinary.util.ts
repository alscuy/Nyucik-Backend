import cloudinary from "../config/cloudinary";

/**
 * Upload buffer (dari multer) ke Cloudinary.
 * Folder:
 *  - nyucik/bookings/before  -> foto cucian saat booking
 *  - nyucik/bookings/arrived -> foto bukti sudah sampai di tempat
 *  - nyucik/machines         -> foto mesin cuci/pengering
 *  - nyucik/products         -> foto produk
 *  - nyucik/announcements    -> foto pengumuman
 *  - nyucik/profiles         -> foto profil user
 */
export const uploadImage = (
  buffer: Buffer,
  folder: string
): Promise<{ url: string; publicId: string }> =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error || !result) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });

export const FOLDERS = {
  bookingBefore: "nyucik/bookings/before",
  bookingArrived: "nyucik/bookings/arrived",
  machines: "nyucik/machines",
  products: "nyucik/products",
  announcements: "nyucik/announcements",
  profiles: "nyucik/profiles",
};
