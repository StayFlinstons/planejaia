import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { EmptyState, ErrorBox, PageHeader, Spinner } from '../components/ui.jsx';
import TaskFormModal from '../components/TaskFormModal.jsx';
import TaskList from '../components/TaskList.jsx';
import { api } from '../services/api.js';
import { TASK_PRIORITY, TASK_STATUS, options } from '../utils/labels.js';

const FILTER_KEYS = ['project_id', 'status', 'prioridade', 'atrasadas', 'ordem'];

export default function Tasks() {
  const [params, setParams] = useSearchParams();
  const [tasks, setTasks] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(undefined); // undefined = fechado, null = nova

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']));
  const filtersKey = FILTER_KEYS.map((k) => filters[k]).join('|');
  const activeFilters = ['project_id', 'status', 'prioridade', 'atrasadas'].some((k) => filters[k]);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const f = Object.fromEntries(filtersKey.split('|').map((v, i) => [FILTER_KEYS[i], v]));
      const res = await api.listTasks(f);
      setTasks(res.tasks);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filtersKey]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.listProjects().then((r) => setProjects(r.projects)).catch(() => {});
  }, []);

  // Guarda os filtros mais recentes: a URL é atualizada de forma assíncrona e
  // cliques rápidos seguidos poderiam usar um valor antigo.
  const latest = useRef(params);
  useEffect(() => { latest.current = params; }, [params]);

  function applyParams(next) {
    latest.current = next;
    setParams(next, { replace: true });
  }

  function setFilter(key, value) {
    const next = new URLSearchParams(latest.current);
    if (value) next.set(key, value); else next.delete(key);
    applyParams(next);
  }

  return (
    <div className="page">
      <PageHeader
        title="Tarefas"
        subtitle="Todas as suas atividades, com ou sem projeto."
        actions={<button type="button" className="btn btn-primary" onClick={() => setModal(null)}><Icon name="plus" />Nova tarefa</button>}
      />

      <div className="filters" role="search">
        <label className="filter">
          <span>Projeto</span>
          <select value={filters.project_id} onChange={(e) => setFilter('project_id', e.target.value)}>
            <option value="">Todos</option>
            <option value="none">Sem projeto</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
        <label className="filter">
          <span>Status</span>
          <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">Todos</option>
            {options(TASK_STATUS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="filter">
          <span>Prioridade</span>
          <select value={filters.prioridade} onChange={(e) => setFilter('prioridade', e.target.value)}>
            <option value="">Todas</option>
            {options(TASK_PRIORITY).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="filter">
          <span>Ordenar</span>
          <select value={filters.ordem || 'prazo_asc'} onChange={(e) => setFilter('ordem', e.target.value === 'prazo_asc' ? '' : e.target.value)}>
            <option value="prazo_asc">Prazo mais próximo</option>
            <option value="prazo_desc">Prazo mais distante</option>
            <option value="recentes">Criadas recentemente</option>
          </select>
        </label>
        <label className="filter-check">
          <input type="checkbox" checked={filters.atrasadas === '1'} onChange={(e) => setFilter('atrasadas', e.target.checked ? '1' : '')} />
          <span>Somente atrasadas</span>
        </label>
        {activeFilters && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => applyParams(new URLSearchParams())}>Limpar filtros</button>
        )}
      </div>

      {error && <ErrorBox message={error} onRetry={load} />}
      {tasks === null && !error && <Spinner />}

      {tasks && tasks.length === 0 && (
        activeFilters ? (
          <EmptyState icon="check" title="Nenhuma tarefa encontrada">Nenhuma tarefa corresponde aos filtros escolhidos.</EmptyState>
        ) : (
          <EmptyState
            icon="check"
            title="Você ainda não tem tarefas"
            action={<button type="button" className="btn btn-primary" onClick={() => setModal(null)}>Criar tarefa</button>}
          >
            Cadastre sua primeira tarefa. Ela pode fazer parte de um projeto ou ser independente.
          </EmptyState>
        )
      )}

      {tasks && tasks.length > 0 && (
        <section className={`card ${loading ? 'is-loading' : ''}`}>
          <p className="muted small">{tasks.length} tarefa(s)</p>
          <TaskList tasks={tasks} onEdit={(t) => setModal(t)} onChanged={load} />
        </section>
      )}

      <TaskFormModal
        open={modal !== undefined}
        task={modal}
        projects={projects}
        defaultProjectId={filters.project_id && filters.project_id !== 'none' ? filters.project_id : ''}
        onClose={() => setModal(undefined)}
        onSaved={() => { setModal(undefined); load(); }}
      />
    </div>
  );
}
