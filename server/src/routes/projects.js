import { Router } from 'express';
import {
  validateProject, hasErrors, isUuid,
} from '../utils/validation.js';
import { badRequest, notFound, fromSupabaseError } from '../utils/httpError.js';

const PROJECT_FIELDS = 'id, nome, descricao, objetivo, data_inicio, prazo_final, orcamento_previsto, status, created_at, updated_at';
const TASK_FIELDS = 'id, project_id, titulo, descricao, prazo, prioridade, status, concluida_em, created_at, updated_at';

/** Calcula o progresso: tarefas concluídas / total de tarefas. */
export function progressOf(tasks = []) {
  const total = tasks.length;
  const concluidas = tasks.filter((t) => t.status === 'concluida').length;
  return {
    total,
    concluidas,
    pendentes: total - concluidas,
    percentual: total === 0 ? 0 : Math.round((concluidas / total) * 100),
  };
}

function ensureId(id) {
  if (!isUuid(id)) throw notFound('Projeto não encontrado.');
}

export function projectsRouter() {
  const router = Router();

  // Lista os projetos do usuário com o progresso de cada um
  router.get('/', async (req, res, next) => {
    try {
      const { data, error } = await req.db
        .from('projects')
        .select(`${PROJECT_FIELDS}, tasks(id, status)`)
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });
      if (error) throw fromSupabaseError(error, 'Não foi possível carregar os projetos.');
      const projects = data.map(({ tasks, ...p }) => ({ ...p, progresso: progressOf(tasks) }));
      res.json({ projects });
    } catch (err) { next(err); }
  });

  // Detalhes de um projeto + tarefas vinculadas
  router.get('/:id', async (req, res, next) => {
    try {
      ensureId(req.params.id);
      const { data, error } = await req.db
        .from('projects')
        .select(`${PROJECT_FIELDS}, tasks(${TASK_FIELDS})`)
        .eq('id', req.params.id)
        .eq('user_id', req.user.id)
        .maybeSingle();
      if (error) throw fromSupabaseError(error, 'Não foi possível carregar o projeto.');
      if (!data) throw notFound('Projeto não encontrado.');
      const { tasks, ...project } = data;
      res.json({ project: { ...project, progresso: progressOf(tasks) }, tasks });
    } catch (err) { next(err); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const { value, errors } = validateProject(req.body);
      if (hasErrors(errors)) throw badRequest('Revise os campos destacados.', errors);
      const { data, error } = await req.db
        .from('projects')
        .insert({ ...value, user_id: req.user.id })
        .select(PROJECT_FIELDS)
        .single();
      if (error) throw fromSupabaseError(error, 'Não foi possível salvar o projeto.');
      res.status(201).json({ project: { ...data, progresso: progressOf([]) } });
    } catch (err) { next(err); }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      ensureId(req.params.id);
      const { value, errors } = validateProject(req.body);
      if (hasErrors(errors)) throw badRequest('Revise os campos destacados.', errors);
      const { data, error } = await req.db
        .from('projects')
        .update(value)
        .eq('id', req.params.id)
        .eq('user_id', req.user.id)
        .select(PROJECT_FIELDS)
        .maybeSingle();
      if (error) throw fromSupabaseError(error, 'Não foi possível salvar as alterações do projeto.');
      // Nenhuma linha alterada: projeto inexistente ou de outra conta
      if (!data) throw notFound('Projeto não encontrado.');
      res.json({ project: data });
    } catch (err) { next(err); }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      ensureId(req.params.id);
      const { data, error } = await req.db
        .from('projects')
        .delete()
        .eq('id', req.params.id)
        .eq('user_id', req.user.id)
        .select('id');
      if (error) throw fromSupabaseError(error, 'Não foi possível excluir o projeto.');
      if (!data || data.length === 0) throw notFound('Projeto não encontrado.');
      res.json({ deleted: true });
    } catch (err) { next(err); }
  });

  return router;
}

export { PROJECT_FIELDS, TASK_FIELDS };
