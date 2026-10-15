import { HttpError } from '../utils/httpError.js';

/**
 * Exige um usuário autenticado (token do Supabase no cabeçalho Authorization).
 * Anexa `req.user` e `req.db` (cliente do Supabase com as permissões do usuário).
 */
export function requireAuth({ getUserFromToken, createUserClient }) {
  return async function authMiddleware(req, _res, next) {
    try {
      const header = req.headers.authorization || '';
      const [scheme, token] = header.split(' ');
      if (scheme !== 'Bearer' || !token) {
        throw new HttpError(401, 'Sua sessão expirou. Entre novamente.');
      }
      let user;
      try {
        user = await getUserFromToken(token);
      } catch (err) {
        console.error('[auth]', err.message);
        throw new HttpError(503, 'Não foi possível verificar sua sessão agora. Tente novamente.');
      }
      if (!user) throw new HttpError(401, 'Sua sessão expirou. Entre novamente.');
      req.user = { id: user.id, email: user.email };
      req.db = createUserClient(token);
      next();
    } catch (err) {
      next(err);
    }
  };
}
