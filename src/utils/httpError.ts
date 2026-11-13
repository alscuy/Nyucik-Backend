/** Error class dengan HTTP status, dipakai di semua controller */
export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const unauthorized = (msg = "Tidak memiliki akses, silakan login") =>
  new HttpError(401, msg);
export const forbidden = (msg = "Anda tidak memiliki hak akses") =>
  new HttpError(403, msg);
export const notFound = (msg = "Data tidak ditemukan") => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);
