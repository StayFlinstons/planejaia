import { Router } from 'express';
import {
  validateTask, hasErrors, isUuid, isValidDate, todayISO, TASK_STATUS, TASK_PRIORITY,
} from '../utils/validation.js';
import { badRequest, notFound, fromSupabaseError } from '../utils/httpError.js';
import { TASK_FIELDS } from './projects.js';

const TASK_WITH_PROJECT = `${TASK_FIELDS}, project:projects(id, nome)`;
const MAX_BULK = 50;

function ensureId(id) {
  if (!isUuid(id)) throw notFound('Tarefa não encontrada.');
}

/** Garante que o projeto informado existe e pertence ao usuário. */
async function ensureProjectOwned(req, projectId) {
  if (!projectId) return;
  const { data, error } = await req.db
    .from('projects').select('id').eq('id', projectId).eq('user_id', req.user.id).maybeSingle();
  if (error) throw fromSupabaseError(error);
  if (!data) throw badRequest('O projeto selecionado não existe ou não pertence à sua conta.', { project_id: 'Projeto inválido.' });
}

export function tasksRouter() {
  const router = Router();

  // Lista com filtros: ?project_id=<uuid|none>&status=&prioridade=&atrasadas=1&ordem=prazo_asc|prazo_desc|recentes&hoje=AAAA-MM-DD
  router.get('/', async (req, res, next) => {
    try {
      const { project_id: projectId, status, prioridade, atrasadas, ordem = 'prazo_asc' } = req.query;
      const hoje = isValidDate(req.query.hoje) ? req.query.hoje : todayISO();

      let query = req.db.from('tasks').select(TASK_WITH_PROJECT).eq('user_id', req.user.id);

      if (projectId === 'none') query = query.is('project_id', null);
      else if (projectId) {
        if (!isUuid(projectId)) throw badRequest('Filtro de projeto inválido.');
        query = query.eq('project_id', projectId);
      }
      if (status) {
        if (!TASK_STATUS.includes(status)) throw badRequest('Filtro de status inválido.');
        query = query.eq('status', status);
      }
      if (prioridade) {
        if (!TASK_PRIORITY.includes(prioridade)) throw badRequest('Filtro de prioridade inválido.');
        query = query.eq('prioridade', prioridade);
      }
      if (atrasadas === '1' || atrasadas === 'true') {
        query = query.lt('prazo', hoje).neq('status', 'concluida');
      }

      if (ordem === 'recentes') query = query.order('created_at', { ascending: false });
      else {
        query = query
          .order('prazo', { ascending: ordem !== 'prazo_desc', nullsFirst: false })
          .order('created_at', { ascending: true });
      }

      const { data, error } = await query.limit(1000);
      if (error) throw fromSupabaseError(error, 'Não foi possível carregar as tarefas.');
      res.json({ tasks: data, hoje });
    } catch (err) { next(err); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const { value, errors } = validateTask(req.body);
      if (hasErrors(errors)) throw badRequest('Revise os campos destacados.', errors);
      await ensureProjectOwned(req, value.project_id);
      const { data, error } = await req.db
        .from('tasks').insert({ ...value, user_id: req.user.id }).select(TASK_WITH_PROJECT).single();
      if (error) throw fromSupabaseError(error, 'Não foi possível salvar a tarefa.');
      res.status(201).json({ task: data });
    } catch (err) { next(err); }
  });

  // Cadastro de várias tarefas de uma vez (usado ao aceitar sugestões da IA).
  // A gravação é feita em uma única operação: ou todas são salvas, ou nenhuma.
  router.post('/bulk', async (req, res, next) => {
    try {
      const list = req.body?.tasks;
      if (!Array.isArray(list) || list.length === 0) throw badRequest('Nenhuma tarefa foi selecionada.');
      if (list.length > MAX_BULK) throw badRequest(`Selecione no máximo ${MAX_BULK} tarefas por vez.`);

      const rows = [];
      const allErrors = {};
      list.forEach((item, i) => {
        const { value, errors } = validateTask(item);
        if (hasErrors(errors)) allErrors[i] = errors;
        rows.push({ ...value, user_id: req.user.id });
      });
      if (hasErrors(allErrors)) throw badRequest('Algumas tarefas têm campos inválidos. Revise e tente novamente.', allErrors);

      const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))];
      for (const pid of projectIds) await ensureProjectOwned(req, pid);

      const { data, error } = await req.db.from('tasks').insert(rows).select(TASK_WITH_PROJECT);
      if (error) throw fromSupabaseError(error, 'Não foi possível salvar as tarefas. Nenhuma tarefa foi cadastrada.');
      res.status(201).json({ tasks: data, count: data.length });
    } catch (err) { next(err); }
  });

  // Atualização de várias tarefas (usado no replanejamento aprovado pelo usuário).
  // Informa exatamente quais foram atualizadas e quais falharam.
  router.patch('/bulk', async (req, res, next) => {
    try {
      const list = req.body?.updates;
      if (!Array.isArray(list) || list.length === 0) throw badRequest('Nenhuma alteração foi selecionada.');
      if (list.length > MAX_BULK) throw badRequest(`Selecione no máximo ${MAX_BULK} alterações por vez.`);

      const allowed = ['prazo', 'prioridade', 'status'];
      const prepared = list.map((item, i) => {
        if (!item || !isUuid(item.id)) throw badRequest(`Alteração ${i + 1}: tarefa inválida.`);
        const fields = Object.fromEntries(Object.entries(item).filter(([k]) => allowed.includes(k)));
        if (Object.keys(fields).length === 0) throw badRequest(`Alteração ${i + 1}: nada para alterar.`);
        const { value, errors } = validateTask(fields, { partial: true });
        if (hasErrors(errors)) throw badRequest(`Alteração ${i + 1}: ${Object.values(errors)[0]}`);
        return { id: item.id, value };
      });

      const updated = [];
      const failed = [];
      for (const { id, value } of prepared) {
        const { data, error } = await req.db
          .from('tasks').update(value).eq('id', id).eq('user_id', req.user.id)
          .select(TASK_WITH_PROJECT).maybeSingle();
        if (error || !data) failed.push({ id, message: error ? 'Erro ao salvar.' : 'Tarefa não encontrada.' });
        else updated.push(data);
      }
      res.status(failed.length && !updated.length ? 400 : 200).json({ updated, failed });
    } catch (err) { next(err); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      ensureId(req.params.id);
      const { data, error } = await req.db
        .from('tasks').select(TASK_WITH_PROJECT).eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();
      if (error) throw fromSupabaseError(error);
      if (!data) throw notFound('Tarefa não encontrada.');
      res.json({ task: data });
    } catch (err) { next(err); }
  });

  // PUT: edição completa | PATCH: alteração parcial (ex.: concluir/reabrir)
  for (const method of ['put', 'patch']) {
    router[method]('/:id', async (req, res, next) => {
      try {
        ensureId(req.params.id);
        const { value, errors } = validateTask(req.body, { partial: method === 'patch' });
        if (hasErrors(errors)) throw badRequest('Revise os campos destacados.', errors);
        if (Object.keys(value).length === 0) throw badRequest('Nenhum campo para alterar.');
        if (value.project_id) await ensureProjectOwned(req, value.project_id);
        const { data, error } = await req.db
          .from('tasks').update(value).eq('id', req.params.id).eq('user_id', req.user.id)
          .select(TASK_WITH_PROJECT).maybeSingle();
        if (error) throw fromSupabaseError(error, 'Não foi possível salvar as alterações da tarefa.');
        if (!data) throw notFound('Tarefa não encontrada.');
        res.json({ task: data });
      } catch (err) { next(err); }
    });
  }

  router.delete('/:id', async (req, res, next) => {
    try {
      ensureId(req.params.id);
      const { data, error } = await req.db
        .from('tasks').delete().eq('id', req.params.id).eq('user_id', req.user.id).select('id');
      if (error) throw fromSupabaseError(error, 'Não foi possível excluir a tarefa.');
      if (!data || data.length === 0) throw notFound('Tarefa não encontrada.');
      res.json({ deleted: true });
    } catch (err) { next(err); }
  });

  return router;
}
