/** Erro com status HTTP e mensagem pronta para o usuário. */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const notFound = (message = 'Registro não encontrado.') => new HttpError(404, message);

/**
 * Converte erros do Supabase/PostgreSQL em mensagens compreensíveis.
 * Nunca expõe detalhes internos ao usuário.
 */
export function fromSupabaseError(error, fallback = 'Não foi possível concluir a operação.') {
  if (!error) return new HttpError(500, fallback);
  const code = error.code || '';
  if (code === '23514') {
    if (String(error.message).includes('datas_validas')) {
      return badRequest('O prazo final não pode ser anterior à data de início.');
    }
    return badRequest('Algum campo tem um valor inválido. Revise os dados e tente novamente.');
  }
  if (code === '23503') return badRequest('O projeto selecionado não existe ou não pertence à sua conta.');
  if (code === '23502') return badRequest('Preencha todos os campos obrigatórios.');
  if (code === '22P02' || code === '22007' || code === '22008') {
    return badRequest('Algum campo tem um formato inválido.');
  }
  if (code === '42501') return new HttpError(403, 'Você não tem permissão para esta operação.');
  if (code === 'PGRST116') return notFound();
  // Falha de rede ao falar com o Supabase
  if (!code && /fetch failed|network|ECONN|ETIMEDOUT/i.test(String(error.message))) {
    return new HttpError(503, 'O banco de dados está indisponível no momento. Tente novamente em instantes.');
  }
  console.error('[supabase]', code, error.message);
  return new HttpError(500, fallback);
}
