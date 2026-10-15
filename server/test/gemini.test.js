import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateJson } from '../src/services/gemini.js';

const base = { apiKey: 'chave-teste', model: 'modelo', system: 's', prompt: 'p', schema: {}, retries: 1 };

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const okBody = (obj) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(obj) }] } }] });

test('sem chave: assistente indisponível', async () => {
  await assert.rejects(generateJson({ ...base, apiKey: '' }), { code: 'not_configured' });
});

test('envia a chave somente no cabeçalho e devolve o JSON', async () => {
  let captured;
  const fetchImpl = async (url, opts) => { captured = { url, opts }; return jsonResponse(200, okBody({ a: 1 })); };
  const out = await generateJson({ ...base, fetchImpl });
  assert.deepEqual(out, { a: 1 });
  assert.equal(captured.opts.headers['x-goog-api-key'], 'chave-teste');
  assert.doesNotMatch(captured.url, /chave-teste/);
});

test('ignora partes de "pensamento" e cercas ```json', async () => {
  const body = { candidates: [{ content: { parts: [{ text: 'pensando...', thought: true }, { text: '```json\n{"b":2}\n```' }] } }] };
  const out = await generateJson({ ...base, fetchImpl: async () => jsonResponse(200, body) });
  assert.deepEqual(out, { b: 2 });
});

test('limite de uso (429) não é repetido', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return jsonResponse(429, {}); };
  await assert.rejects(generateJson({ ...base, fetchImpl }), { code: 'rate_limit', status: 429 });
  assert.equal(calls, 1);
});

test('chave inválida', async () => {
  await assert.rejects(generateJson({ ...base, fetchImpl: async () => jsonResponse(403, {}) }), { code: 'auth' });
});

test('serviço indisponível (503) tenta de novo e depois falha', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return jsonResponse(503, {}); };
  await assert.rejects(generateJson({ ...base, fetchImpl }), { code: 'unavailable' });
  assert.equal(calls, 2);
});

test('falha de conexão', async () => {
  const fetchImpl = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(generateJson({ ...base, fetchImpl, retries: 0 }), { code: 'network' });
});

test('tempo esgotado', async () => {
  const fetchImpl = (_u, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(Object.assign(new Error('abort'), { name: 'AbortError' })));
  });
  await assert.rejects(generateJson({ ...base, fetchImpl, timeoutMs: 30, retries: 0 }), { code: 'timeout' });
});

test('resposta inválida: tenta de novo e recupera', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return calls === 1
      ? jsonResponse(200, { candidates: [{ content: { parts: [{ text: 'isto não é json' }] } }] })
      : jsonResponse(200, okBody({ ok: true }));
  };
  assert.deepEqual(await generateJson({ ...base, fetchImpl }), { ok: true });
});

test('conteúdo bloqueado pela IA', async () => {
  const fetchImpl = async () => jsonResponse(200, { promptFeedback: { blockReason: 'SAFETY' } });
  await assert.rejects(generateJson({ ...base, fetchImpl }), { code: 'blocked' });
});
