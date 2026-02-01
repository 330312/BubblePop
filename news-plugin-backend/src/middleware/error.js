import { AppError } from '../utils/error.js';

export function errorMiddleware(err, _req, res, _next) {
  // body-parser / express.json JSON parse errors
  const isJsonParseError =
    err?.type === 'entity.parse.failed' ||
    (err instanceof SyntaxError && 'body' in err);

  const status =
    err instanceof AppError ? err.status :
    isJsonParseError ? 400 :
    500;

  const message =
    isJsonParseError ? 'Invalid JSON body (use double quotes, e.g. {"query":"..."} )' :
    err?.message || 'Internal Server Error';

  res.status(status).json({
    code: status,
    error: message
  });
}