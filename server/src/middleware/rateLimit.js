import { HttpError } from '../utils/httpError.js';

/**
 * Limitador simples em memória (por usuário).
 * Evita que uma conta esgote a cota da API de IA.
 */
export function rateLimitPerUser({ max, windowMs, message }) {
  const hits = new Map();
  return function rateLimit(req, _res, next) {
    const key = req.user?.id || req.ip;
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      const err = new HttpError(429, message);
      err.code = 'rate_limit';
      err.retryAfter = Math.ceil((windowMs - (now - recent[0])) / 1000);
      hits.set(key, recent);
      return next(err);
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}
