import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { validateProject, validateTask, isValidDate } from '../src/utils/validation.js';
import { computeDashboard, isOverdue } from '../src/routes/dashboard.js';
import { progressOf } from '../src/routes/projects.js';
import { redactSensitive, buildContext } from '../src/services/aiPrompts.js';
import { normalizeAiResult } from '../src/services/aiNormalize.js';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';

// ---------------- Validação ----------------
test('valida datas reais', () => {
  assert.equal(isValidDate('2026-02-28'), true);
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidDate('15/10/2026'), false);
});

test('projeto: campos obrigatórios', () => {
  const { errors } = validateProject({});
  assert.ok(errors.nome);
  assert.ok(errors.data_inicio);
  assert.ok(errors.prazo_final);
});

test('projeto: impede prazo final anterior ao início', () => {
  const { errors } = validateProject({ nome: 'X', data_inicio: '2026-05-10', prazo_final: '2026-05-01' });
  assert.match(errors.prazo_final, /anterior/);
});

test('projeto: orçamento negativo é rejeitado e vírgula decimal é aceita', () => {
  assert.ok(validateProject({ nome: 'X', data_inicio: '2026-01-01', prazo_final: '2026-01-02', orcamento_previsto: -5 }).errors.orcamento_previsto);
  const { value, errors } = validateProject({ nome: 'X', data_inicio: '2026-01-01', prazo_final: '2026-01-02', orcamento_previsto: '1500,50' });
  assert.deepEqual(errors, {});
  assert.equal(value.orcamento_previsto, 1500.5);
});

test('tarefa: título obrigatório, prioridade e status válidos', () => {
  assert.ok(validateTask({ titulo: '   ' }).errors.titulo);
  assert.ok(validateTask({ titulo: 'A', prioridade: 'altissima' }).errors.prioridade);
  assert.ok(validateTask({ titulo: 'A', status: 'feito' }).errors.status);
  const ok = validateTask({ titulo: 'A' });
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.value.project_id, null); // tarefa independente
  assert.equal(ok.value.prioridade, 'media');
});

test('tarefa: atualização parcial só valida o que foi enviado', () => {
  const { value, errors } = validateTask({ status: 'concluida' }, { partial: true });
  assert.deepEqual(errors, {});
  assert.deepEqual(value, { status: 'concluida' });
});

// ---------------- Indicadores ----------------
test('identifica tarefas atrasadas', () => {
  assert.equal(isOverdue({ prazo: '2026-10-14', status: 'pendente' }, '2026-10-15'), true);
  assert.equal(isOverdue({ prazo: '2026-10-14', status: 'concluida' }, '2026-10-15'), false);
  assert.equal(isOverdue({ prazo: '2026-10-15', status: 'pendente' }, '2026-10-15'), false);
  assert.equal(isOverdue({ prazo: null, status: 'pendente' }, '2026-10-15'), false);
});

test('progresso = concluídas / total', () => {
  assert.deepEqual(progressOf([]), { total: 0, concluidas: 0, pendentes: 0, percentual: 0 });
  assert.equal(progressOf([{ status: 'concluida' }, { status: 'pendente' }, { status: 'concluida' }]).percentual, 67);
});

test('painel calcula indicadores com dados reais', () => {
  const tasks = [
    { id: 1, status: 'pendente', prazo: '2026-10-10' },
    { id: 2, status: 'em_andamento', prazo: '2026-10-20' },
    { id: 3, status: 'concluida', prazo: '2026-10-01' },
    { id: 4, status: 'pendente', prazo: null },
  ];
  const projects = [{ id: 'p', nome: 'P', status: 'em_andamento', prazo_final: '2026-12-01', tasks: [{ status: 'concluida' }] }];
  const d = computeDashboard(projects, tasks, '2026-10-15');
  assert.deepEqual(d.indicadores, { projetos: 1, pendentes: 2, em_andamento: 1, concluidas: 1, atrasadas: 1 });
  assert.deepEqual(d.proximas_tarefas.map((t) => t.id), [2]);
  assert.deepEqual(d.tarefas_atrasadas.map((t) => t.id), [1]);
  assert.equal(d.projetos_em_andamento[0].progresso.percentual, 100);
});

// ---------------- IA: privacidade e normalização ----------------
test('remove dados sensíveis antes de enviar à IA', () => {
  const out = redactSensitive('Meu email é joao@loja.com, CPF 123.456.789-09, cartão 4111 1111 1111 1111, tel (11) 98765-4321, senha: abc123');
  assert.doesNotMatch(out, /joao@loja\.com|123\.456\.789-09|4111|98765|abc123/);
});

test('contexto usa referências curtas e não envia ids', () => {
  const { text, refMap } = buildContext({
    tasks: [{ id: 'uuid-secreto', titulo: 'Fazer post', status: 'pendente', prioridade: 'alta', prazo: '2026-10-01' }],
    hoje: '2026-10-15',
  });
  assert.match(text, /T1: "Fazer post".*\[ATRASADA\]/);
  assert.doesNotMatch(text, /uuid-secreto/);
  assert.equal(refMap.get('T1').id, 'uuid-secreto');
});

test('plano: normaliza prioridade, descarta datas passadas e tarefas sem título', () => {
  const r = normalizeAiResult('plano', {
    objetivo: 'Vender mais',
    resumo: '',
    etapas: [],
    tarefas: [
      { titulo: 'A', descricao: '', ordem: 2, prioridade: 'Média', prazo_sugerido: '2026-10-20', prazo_e_estimativa: false },
      { titulo: 'B', descricao: '', ordem: 1, prioridade: 'URGENTE', prazo_sugerido: '2020-01-01', prazo_e_estimativa: false },
      { titulo: '', descricao: 'sem título', ordem: 3, prioridade: 'alta' },
    ],
    riscos: [], recomendacoes_acompanhamento: [], informacoes_faltantes: [],
  }, { hoje: '2026-10-15', refMap: new Map() });
  assert.equal(r.tarefas.length, 2);
  assert.equal(r.tarefas[0].titulo, 'B');
  assert.equal(r.tarefas[0].prioridade, 'urgente');
  assert.equal(r.tarefas[0].prazo_sugerido, null);
  assert.equal(r.tarefas[0].prazo_e_estimativa, true);
  assert.equal(r.tarefas[1].prioridade, 'media');
});

test('plano sem tarefas é considerado resposta inválida', () => {
  assert.throws(() => normalizeAiResult('plano', { tarefas: [] }, { hoje: '2026-10-15', refMap: new Map() }), { code: 'invalid_response' });
});

test('replanejar: ignora referências desconhecidas, tarefas concluídas e "alterações" sem mudança', () => {
  const refMap = new Map([
    ['T1', { id: 'a', titulo: 'A', status: 'pendente', prazo: '2026-10-10', prioridade: 'media' }],
    ['T2', { id: 'b', titulo: 'B', status: 'concluida', prazo: '2026-10-10', prioridade: 'media' }],
    ['T3', { id: 'c', titulo: 'C', status: 'pendente', prazo: '2026-10-20', prioridade: 'alta' }],
  ]);
  const r = normalizeAiResult('replanejar', {
    resumo: 'ok',
    alteracoes: [
      { tarefa_ref: 'T1', novo_prazo: '2026-10-22', nova_prioridade: 'alta', motivo: 'atrasou' },
      { tarefa_ref: 'T2', novo_prazo: '2026-10-22', motivo: 'x' },
      { tarefa_ref: 'T3', novo_prazo: '2026-10-20', nova_prioridade: 'alta', motivo: 'nada muda' },
      { tarefa_ref: 'T99', novo_prazo: '2026-10-22', motivo: 'inventada' },
    ],
    novas_tarefas: [],
    recomendacoes: [],
  }, { hoje: '2026-10-15', refMap });
  assert.equal(r.alteracoes.length, 1);
  assert.deepEqual(r.alteracoes[0].proposto, { prazo: '2026-10-22', prioridade: 'alta' });
  assert.deepEqual(r.alteracoes[0].atual, { prazo: '2026-10-10', prioridade: 'media' });
});

// ---------------- API (sem banco) ----------------
const fakeAuth = {
  getUserFromToken: async (token) => (token === 'valido' ? { id: '11111111-1111-1111-1111-111111111111', email: 'a@x' } : null),
  createUserClient: () => ({}),
};

test('API recusa acesso sem login', async () => {
  const app = createApp(fakeAuth);
  const res = await request(app).get('/api/projects');
  assert.equal(res.status, 401);
  assert.match(res.body.error.message, /sessão/i);
  const res2 = await request(app).get('/api/tasks').set('Authorization', 'Bearer invalido');
  assert.equal(res2.status, 401);
});

test('API informa assistente indisponível quando não há chave', async () => {
  const saved = { key: config.geminiApiKey, demo: config.aiDemoMode };
  config.geminiApiKey = '';
  config.aiDemoMode = false;
  try {
    const app = createApp(fakeAuth);
    const st = await request(app).get('/api/ai/status').set('Authorization', 'Bearer valido');
    assert.deepEqual(st.body, { available: false, demo: false });
    const res = await request(app).post('/api/ai/plano').set('Authorization', 'Bearer valido')
      .send({ mensagem: 'Quero organizar uma campanha de divulgação' });
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'not_configured');
  } finally {
    config.geminiApiKey = saved.key;
    config.aiDemoMode = saved.demo;
  }
});

test('API valida solicitações vazias, inválidas e funções inexistentes', async () => {
  const app = createApp(fakeAuth);
  const auth = ['Authorization', 'Bearer valido'];
  assert.equal((await request(app).post('/api/ai/plano').set(...auth).send({ mensagem: '' })).status, 400);
  assert.equal((await request(app).post('/api/ai/plano').set(...auth).send({ mensagem: 123 })).status, 400);
  assert.equal((await request(app).post('/api/ai/plano').set(...auth).send({ mensagem: 'x'.repeat(5000) })).status, 400);
  assert.equal((await request(app).post('/api/ai/hackear').set(...auth).send({ mensagem: 'qualquer coisa aqui' })).status, 404);
  const bad = await request(app).post('/api/projects').set(...auth).set('Content-Type', 'application/json').send('{quebrado');
  assert.equal(bad.status, 400);
});

test('API valida projeto antes de acessar o banco', async () => {
  const app = createApp(fakeAuth);
  const res = await request(app).post('/api/projects').set('Authorization', 'Bearer valido')
    .send({ nome: 'X', data_inicio: '2026-05-10', prazo_final: '2026-05-01' });
  assert.equal(res.status, 400);
  assert.ok(res.body.error.details.prazo_final);
});
