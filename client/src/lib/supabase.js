import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** true quando as variáveis do Supabase não foram configuradas no client/.env */
export const supabaseMissingConfig = !url || !anonKey;

// O front-end usa o Supabase SOMENTE para login/cadastro/sessão.
// Projetos e tarefas passam pelo back-end (pasta server), que valida tudo.
export const supabase = supabaseMissingConfig
  ? null
  : createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
