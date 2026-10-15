import { HttpError } from '../utils/httpError.js';

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { message: 'Endereço não encontrado.' } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Os dados enviados estão em um formato inválido.' } });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: { message: 'Os dados enviados são grandes demais.' } });
  }
  if (err instanceof HttpError) {
    const body = { error: { message: err.message } };
    if (err.details) body.error.details = err.details;
    if (err.code) body.error.code = err.code;
    if (err.retryAfter) res.set('Retry-After', String(err.retryAfter));
    return res.status(err.status).json(body);
  }
  console.error('[erro inesperado]', err);
  return res.status(500).json({ error: { message: 'Ocorreu um erro inesperado. Tente novamente.' } });
}
