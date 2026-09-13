export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400, public details?: unknown) {
    super(message);
  }
}
export const forbidden = (m = "Недостаточно прав") => new AppError("forbidden", m, 403);
export const notFound = (m = "Не найдено") => new AppError("not_found", m, 404);
export const conflict = (code: string, m: string) => new AppError(code, m, 409);
export const bad = (code: string, m: string, details?: unknown) => new AppError(code, m, 400, details);
