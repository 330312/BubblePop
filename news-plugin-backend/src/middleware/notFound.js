export function notFoundMiddleware(_req, res) {
  res.status(404).json({ code: 404, error: 'Not Found' });
}
