import cloudinary from "../config/cloudinary";

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
  photoBefore: "nyucik/bookings/before",
  photoStart: "nyucik/bookings/arrived",
  machines: "nyucik/machines",
  products: "nyucik/products",
  announcements: "nyucik/announcements",
  profiles: "nyucik/profiles",
};
