import { Router } from 'express';
import { isValidDate, todayISO } from '../utils/validation.js';
import { fromSupabaseError } from '../utils/httpError.js';
import { progressOf } from './projects.js';

export function isOverdue(task, hoje) {
  return Boolean(task.prazo) && task.prazo < hoje && task.status !== 'concluida';
}

/** Calcula os indicadores do painel a partir dos dados reais do usuário. */
export function computeDashboard(projects, tasks, hoje) {
  const abertas = tasks.filter((t) => t.status !== 'concluida');
  const byDeadline = (a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999');

  return {
    hoje,
    indicadores: {
      projetos: projects.length,
      pendentes: tasks.filter((t) => t.status === 'pendente').length,
      em_andamento: tasks.filter((t) => t.status === 'em_andamento').length,
      concluidas: tasks.filter((t) => t.status === 'concluida').length,
      atrasadas: abertas.filter((t) => isOverdue(t, hoje)).length,
    },
    proximas_tarefas: abertas
      .filter((t) => t.prazo && t.prazo >= hoje)
      .sort(byDeadline)
      .slice(0, 6),
    tarefas_atrasadas: abertas.filter((t) => isOverdue(t, hoje)).sort(byDeadline).slice(0, 6),
    projetos_em_andamento: projects
      .filter((p) => p.status === 'em_andamento' || p.status === 'planejamento')
      .map(({ tasks: pt = [], ...p }) => ({ ...p, progresso: progressOf(pt) }))
      .sort((a, b) => a.prazo_final.localeCompare(b.prazo_final))
      .slice(0, 6),
  };
}

export function dashboardRouter() {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const hoje = isValidDate(req.query.hoje) ? req.query.hoje : todayISO();
      const [projectsRes, tasksRes] = await Promise.all([
        req.db.from('projects')
          .select('id, nome, status, data_inicio, prazo_final, tasks(id, status)')
          .eq('user_id', req.user.id),
        req.db.from('tasks')
          .select('id, titulo, prazo, prioridade, status, project_id, project:projects(id, nome)')
          .eq('user_id', req.user.id)
          .limit(5000),
      ]);
      if (projectsRes.error) throw fromSupabaseError(projectsRes.error, 'Não foi possível carregar o painel.');
      if (tasksRes.error) throw fromSupabaseError(tasksRes.error, 'Não foi possível carregar o painel.');
      res.json(computeDashboard(projectsRes.data, tasksRes.data, hoje));
    } catch (err) { next(err); }
  });

  return router;
}
