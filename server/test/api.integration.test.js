// Teste de integração OPCIONAL: roda a API contra um PostgreSQL real com o schema.sql
// e as políticas de RLS, servido pelo PostgREST (o mesmo componente usado pelo Supabase).
// Só executa quando TEST_POSTGREST_URL e TEST_JWT_SECRET estão definidos; caso contrário é ignorado.
// Veja "Testes automatizados" no README.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import { PostgrestClient } from '@supabase/postgrest-js';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';

const URL = process.env.TEST_POSTGREST_URL;
const SECRET = process.env.TEST_JWT_SECRET;
const skip = !URL || !SECRET ? 'defina TEST_POSTGREST_URL e TEST_JWT_SECRET para rodar' : false;

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
function signJwt(sub) {
  const head = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

let app;
let generateCalls = [];
const tokenA = SECRET ? signJwt(USER_A) : '';
const tokenB = SECRET ? signJwt(USER_B) : '';

before(() => {
  if (skip) return;
  app = createApp({
    getUserFromToken: async (token) => {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      return { id: payload.sub, email: `${payload.sub}@teste` };
    },
    createUserClient: (token) => new PostgrestClient(URL, { headers: { Authorization: `Bearer ${token}` } }),
    generate: async (args) => {
      generateCalls.push(args);
      return {
        objetivo: 'Divulgar a loja',
        resumo: 'Plano de teste',
        etapas: [{ nome: 'Preparação', descricao: '...' }],
        tarefas: [
          { titulo: 'Criar posts', descricao: 'Instagram', etapa: 'Preparação', ordem: 1, prioridade: 'alta', prazo_sugerido: '2099-01-10', prazo_e_estimativa: true },
          { titulo: 'Contratar fotógrafo', descricao: '', etapa: 'Preparação', ordem: 2, prioridade: 'media', prazo_sugerido: null, prazo_e_estimativa: true },
        ],
        riscos: ['Pouco tempo'],
        recomendacoes_acompanhamento: ['Medir vendas'],
        informacoes_faltantes: ['Orçamento'],
      };
    },
  });
});

const as = (token) => ({ Authorization: `Bearer ${token}` });

test('fluxo completo de projetos, tarefas, painel, IA e isolamento entre usuários', { skip }, async () => {
  // --- Projetos ---
  let res = await request(app).post('/api/projects').set(as(tokenA))
    .send({ nome: 'Campanha', objetivo: 'Vender', data_inicio: '2026-10-01', prazo_final: '2026-11-30', orcamento_previsto: 500, status: 'em_andamento' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const project = res.body.project;

  res = await request(app).put(`/api/projects/${project.id}`).set(as(tokenA))
    .send({ ...project, nome: 'Campanha de Natal' });
  assert.equal(res.status, 200);
  assert.equal(res.body.project.nome, 'Campanha de Natal');

  res = await request(app).put(`/api/projects/${project.id}`).set(as(tokenA))
    .send({ ...project, data_inicio: '2026-12-01', prazo_final: '2026-11-01' });
  assert.equal(res.status, 400);

  // --- Tarefas ---
  res = await request(app).post('/api/tasks').set(as(tokenA))
    .send({ titulo: 'Tarefa vinculada', project_id: project.id, prazo: '2026-10-05', prioridade: 'alta' });
  assert.equal(res.status, 201);
  const vinculada = res.body.task;
  assert.equal(vinculada.project.nome, 'Campanha de Natal');

  res = await request(app).post('/api/tasks').set(as(tokenA)).send({ titulo: 'Tarefa independente', prazo: '2099-01-01' });
  assert.equal(res.status, 201);
  assert.equal(res.body.task.project_id, null);

  res = await request(app).patch(`/api/tasks/${vinculada.id}`).set(as(tokenA)).send({ prioridade: 'urgente', prazo: '2026-10-06' });
  assert.equal(res.body.task.prioridade, 'urgente');

  // Painel: 1 atrasada (prazo 2026-10-06 < hoje 2026-10-15)
  res = await request(app).get('/api/dashboard?hoje=2026-10-15').set(as(tokenA));
  assert.deepEqual(res.body.indicadores, { projetos: 1, pendentes: 2, em_andamento: 0, concluidas: 0, atrasadas: 1 });

  // Concluir e reabrir; progresso do projeto
  res = await request(app).patch(`/api/tasks/${vinculada.id}`).set(as(tokenA)).send({ status: 'concluida' });
  assert.ok(res.body.task.concluida_em);
  res = await request(app).get(`/api/projects/${project.id}`).set(as(tokenA));
  assert.equal(res.body.project.progresso.percentual, 100);
  res = await request(app).get('/api/dashboard?hoje=2026-10-15').set(as(tokenA));
  assert.equal(res.body.indicadores.atrasadas, 0);
  assert.equal(res.body.indicadores.concluidas, 1);
  res = await request(app).patch(`/api/tasks/${vinculada.id}`).set(as(tokenA)).send({ status: 'pendente' });
  assert.equal(res.body.task.concluida_em, null);

  // Filtros
  res = await request(app).get('/api/tasks?project_id=none').set(as(tokenA));
  assert.deepEqual(res.body.tasks.map((t) => t.titulo), ['Tarefa independente']);
  res = await request(app).get('/api/tasks?atrasadas=1&hoje=2026-10-15').set(as(tokenA));
  assert.deepEqual(res.body.tasks.map((t) => t.titulo), ['Tarefa vinculada']);
  res = await request(app).get('/api/tasks?prioridade=urgente').set(as(tokenA));
  assert.equal(res.body.tasks.length, 1);
  res = await request(app).get('/api/tasks?ordem=prazo_desc').set(as(tokenA));
  assert.deepEqual(res.body.tasks.map((t) => t.titulo), ['Tarefa independente', 'Tarefa vinculada']);

  // --- IA: gera plano, NÃO grava nada sozinha ---
  config.geminiApiKey = 'chave-de-teste';
  try {
    res = await request(app).post('/api/ai/plano').set(as(tokenA))
      .send({ mensagem: 'Quero divulgar minha loja no próximo mês. Meu email é dono@loja.com', project_id: project.id, hoje: '2026-10-15' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.result.tarefas.length, 2);
    assert.equal(res.body.dados_removidos, true);
    const prompt = generateCalls.at(-1).prompt;
    assert.doesNotMatch(prompt, /dono@loja\.com/);
    assert.doesNotMatch(prompt, new RegExp(vinculada.id)); // ids internos não vão para a IA
    assert.match(prompt, /Campanha de Natal/);

    res = await request(app).get(`/api/tasks?project_id=${project.id}`).set(as(tokenA));
    assert.equal(res.body.tasks.length, 1, 'a IA não pode cadastrar tarefas sem confirmação');

    // Usuário confirma apenas UMA das sugestões
    const escolhida = { titulo: 'Criar posts', descricao: 'Instagram', prioridade: 'alta', prazo: '2099-01-10', project_id: project.id };
    res = await request(app).post('/api/tasks/bulk').set(as(tokenA)).send({ tasks: [escolhida] });
    assert.equal(res.status, 201);
    assert.equal(res.body.count, 1);
    res = await request(app).get(`/api/tasks?project_id=${project.id}`).set(as(tokenA));
    assert.equal(res.body.tasks.length, 2);

    // Lote com item inválido: nada é salvo
    res = await request(app).post('/api/tasks/bulk').set(as(tokenA)).send({ tasks: [{ titulo: 'ok' }, { titulo: '' }] });
    assert.equal(res.status, 400);
    res = await request(app).get('/api/tasks').set(as(tokenA));
    assert.equal(res.body.tasks.length, 3);

    // Replanejamento aplicado após aprovação
    res = await request(app).patch('/api/tasks/bulk').set(as(tokenA)).send({ updates: [{ id: vinculada.id, prazo: '2026-10-25' }] });
    assert.equal(res.body.updated.length, 1);
    assert.equal(res.body.updated[0].prazo, '2026-10-25');
  } finally {
    config.geminiApiKey = '';
  }

  // --- Isolamento: usuário B não vê nem altera nada de A ---
  res = await request(app).get('/api/projects').set(as(tokenB));
  assert.deepEqual(res.body.projects, []);
  res = await request(app).get(`/api/projects/${project.id}`).set(as(tokenB));
  assert.equal(res.status, 404);
  res = await request(app).put(`/api/projects/${project.id}`).set(as(tokenB)).send({ ...project, nome: 'invadido' });
  assert.equal(res.status, 404);
  res = await request(app).patch(`/api/tasks/${vinculada.id}`).set(as(tokenB)).send({ status: 'concluida' });
  assert.equal(res.status, 404);
  res = await request(app).delete(`/api/tasks/${vinculada.id}`).set(as(tokenB));
  assert.equal(res.status, 404);
  res = await request(app).post('/api/tasks').set(as(tokenB)).send({ titulo: 'x', project_id: project.id });
  assert.equal(res.status, 400);
  res = await request(app).patch('/api/tasks/bulk').set(as(tokenB)).send({ updates: [{ id: vinculada.id, prazo: '2026-12-01' }] });
  assert.equal(res.body.updated.length, 0);
  assert.equal(res.body.failed.length, 1);
  res = await request(app).get('/api/dashboard').set(as(tokenB));
  assert.equal(res.body.indicadores.projetos, 0);

  // Dados de A continuam intactos
  res = await request(app).get(`/api/tasks/${vinculada.id}`).set(as(tokenA));
  assert.equal(res.body.task.status, 'pendente');
  assert.equal(res.body.task.prazo, '2026-10-25');

  // --- Exclusões ---
  res = await request(app).delete(`/api/projects/${project.id}`).set(as(tokenA));
  assert.equal(res.status, 200);
  res = await request(app).get('/api/tasks').set(as(tokenA));
  assert.deepEqual(res.body.tasks.map((t) => t.titulo), ['Tarefa independente']);
  res = await request(app).delete(`/api/tasks/${res.body.tasks[0].id}`).set(as(tokenA));
  assert.equal(res.status, 200);
  res = await request(app).delete(`/api/projects/${project.id}`).set(as(tokenA));
  assert.equal(res.status, 404, 'não deve afirmar que excluiu algo inexistente');
});
