import { AppError } from '../utils/error.js';

export function errorMiddleware(err, _req, res, _next) {
  const status = err instanceof AppError ? err.status : 500;
  const message = err?.message || 'Internal Server Error';

  // Keep response JSON simple for frontend.
  res.status(status).json({
    code: status,
    error: message
  });
}
