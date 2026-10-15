// Cliente mínimo da API REST do Google Gemini.
// A chave da API é lida SOMENTE no servidor (variável de ambiente GEMINI_API_KEY).

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Erro da integração com IA, com código e mensagem para o usuário. */
export class AiError extends Error {
  constructor(code, message, status = 503) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const MESSAGES = {
  not_configured: ['O assistente de IA está indisponível: a integração não foi configurada no servidor.', 503],
  timeout: ['A IA demorou demais para responder. Tente novamente em instantes.', 504],
  network: ['Não foi possível conectar ao serviço de IA. Verifique a conexão do servidor e tente novamente.', 503],
  rate_limit: ['O limite de uso da IA foi atingido. Aguarde alguns minutos e tente novamente.', 429],
  auth: ['O assistente de IA está indisponível: a chave de acesso da IA é inválida ou foi bloqueada.', 503],
  model_not_found: ['O assistente de IA está indisponível: o modelo configurado não foi encontrado.', 503],
  unavailable: ['O serviço de IA está temporariamente indisponível. Tente novamente em alguns minutos.', 503],
  blocked: ['A IA não pôde responder a esta solicitação. Tente reescrever o pedido com outras palavras.', 422],
  invalid_response: ['A IA devolveu uma resposta em formato inesperado. Tente novamente.', 502],
  bad_request: ['A solicitação enviada à IA foi recusada. Tente reformular o pedido.', 502],
};

export function aiError(code) {
  const [message, status] = MESSAGES[code] || MESSAGES.unavailable;
  return new AiError(code, message, status);
}

function classifyHttp(status, bodyText) {
  if (status === 429) return 'rate_limit';
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'model_not_found';
  if (status === 400) {
    if (/API key/i.test(bodyText)) return 'auth';
    return 'bad_request';
  }
  return 'unavailable';
}

/** Extrai o texto da resposta, ignorando partes de "pensamento" do modelo. */
export function extractText(data) {
  if (data?.promptFeedback?.blockReason) throw aiError('blocked');
  const candidate = data?.candidates?.[0];
  if (!candidate) throw aiError('invalid_response');
  if (['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION'].includes(candidate.finishReason)) {
    throw aiError('blocked');
  }
  const text = (candidate.content?.parts || [])
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('')
    .trim();
  if (!text) throw aiError('invalid_response');
  return text;
}

/** Converte o texto em JSON, tolerando cercas de código ```json. */
export function parseJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('não é objeto');
    return parsed;
  } catch {
    throw aiError('invalid_response');
  }
}

/**
 * Pede à IA uma resposta em JSON seguindo `schema`.
 * Faz 1 nova tentativa em caso de instabilidade ou resposta inválida.
 */
export async function generateJson({
  apiKey, model, system, prompt, schema,
  timeoutMs = 60000, fetchImpl = globalThis.fetch, retries = 1,
}) {
  if (!apiKey) throw aiError('not_configured');

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  };

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let response;
      try {
        response = await fetchImpl(`${BASE_URL}/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err) {
        throw aiError(err?.name === 'AbortError' ? 'timeout' : 'network');
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const code = classifyHttp(response.status, text);
        console.error(`[gemini] HTTP ${response.status} (${code})`);
        throw aiError(code);
      }

      let data;
      try { data = await response.json(); } catch { throw aiError('invalid_response'); }
      return parseJson(extractText(data));
    } catch (err) {
      lastError = err instanceof AiError ? err : aiError('unavailable');
      const retryable = ['unavailable', 'invalid_response', 'network'].includes(lastError.code);
      if (!retryable || attempt === retries) throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}
