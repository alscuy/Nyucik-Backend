export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const forbidden = (message = "Anda tidak memiliki hak akses") =>
  new HttpError(403, message);
export const notFound = (message = "Data tidak ditemukan") => new HttpError(404, message);
