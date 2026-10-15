import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

/** Endereço completo do app, incluindo o caminho base (ex.: GitHub Pages). */
const appUrl = () => `${window.location.origin}${import.meta.env.BASE_URL}`;

/** Traduz as mensagens de erro mais comuns do Supabase Auth. */
export function authErrorMessage(error) {
  const msg = String(error?.message || '').toLowerCase();
  const code = error?.code || '';
  if (code === 'email_address_not_authorized' || msg.includes('not authorized')) {
    return 'O Supabase não pôde enviar o e-mail de confirmação para este endereço. Desative "Confirm email" em Authentication > Sign In / Providers > Email ou configure um SMTP próprio.';
  }
  if (code === 'over_email_send_rate_limit' || msg.includes('email rate limit')) {
    return 'Limite de envio de e-mails do Supabase atingido (o plano gratuito envia poucos por hora). Aguarde ou desative "Confirm email" no Supabase.';
  }
  if (code === 'signup_disabled' || msg.includes('signups not allowed')) {
    return 'O cadastro de novas contas está desativado no Supabase (Authentication > Sign In / Providers).';
  }
  if (msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.';
  if (msg.includes('user already registered')) return 'Já existe uma conta com este e-mail.';
  if (msg.includes('password should be') || msg.includes('weak')) return 'A senha é fraca. Use pelo menos 8 caracteres, com letras e números.';
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (msg.includes('invalid email') || msg.includes('unable to validate email')) return 'E-mail inválido.';
  if (msg.includes('same password') || msg.includes('should be different')) return 'A nova senha deve ser diferente da atual.';
  if (msg.includes('failed to fetch') || msg.includes('network')) return 'Não foi possível conectar. Verifique sua internet.';
  // Mostra o código técnico para facilitar o diagnóstico
  return `Não foi possível concluir a operação. Tente novamente.${code ? ` (código: ${code})` : ''}`;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) { setSession(data.session); setLoading(false); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    loading,
    recovering,
    clearRecovering: () => setRecovering(false),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password, nome) => supabase.auth.signUp({
      email,
      password,
      options: { data: { nome }, emailRedirectTo: appUrl() },
    }),
    resetPassword: (email) => supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl()}redefinir-senha`,
    }),
    updateUser: (attrs) => supabase.auth.updateUser(attrs),
    signOut: () => supabase.auth.signOut(),
  }), [session, loading, recovering]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
