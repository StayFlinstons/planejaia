import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

const baseOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

/**
 * Cria um cliente do Supabase que age COMO o usuário logado.
 * Todas as consultas feitas com ele passam pelas políticas de RLS,
 * então o banco só devolve/altera registros daquele usuário.
 */
export function createUserClient(accessToken) {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    ...baseOptions,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/** Valida o token de acesso e devolve o usuário correspondente (ou null). */
export async function getUserFromToken(accessToken) {
  const client = createClient(config.supabaseUrl, config.supabaseAnonKey, baseOptions);
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data?.user) return null;
  return data.user;
}
