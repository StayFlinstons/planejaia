import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import {
  ConfirmDialog, EmptyState, ErrorBox, PageHeader, ProgressBar, ProjectStatusBadge, Spinner,
} from '../components/ui.jsx';
import ProjectFormModal from '../components/ProjectFormModal.jsx';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { formatDate } from '../utils/dates.js';
import { PROJECT_STATUS, options } from '../utils/labels.js';

export function deleteProjectMessage(project) {
  const n = project?.progresso?.total || 0;
  return (
    <>
      <p>Tem certeza que deseja excluir o projeto <strong>{project?.nome}</strong>?</p>
      {n > 0 && <p className="text-danger">As {n} tarefa(s) vinculadas a ele também serão excluídas.</p>}
      <p className="muted small">Esta ação não pode ser desfeita.</p>
    </>
  );
}

export default function Projects() {
  const toast = useToast();
  const navigate = useNavigate();
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(undefined); // undefined = fechado, null = novo
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.listProjects();
      setProjects(res.projects);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await api.deleteProject(toDelete.id);
      toast.success('Projeto excluído.');
      setToDelete(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const visible = (projects || []).filter((p) => !filter || p.status === filter);

  return (
    <div className="page">
      <PageHeader
        title="Projetos"
        subtitle="Cadastre e acompanhe seus projetos."
        actions={<button type="button" className="btn btn-primary" onClick={() => setEditing(null)}><Icon name="plus" />Novo projeto</button>}
      />

      {error && <ErrorBox message={error} onRetry={load} />}
      {!projects && !error && <Spinner />}

      {projects && projects.length === 0 && (
        <EmptyState
          title="Nenhum projeto cadastrado"
          action={<button type="button" className="btn btn-primary" onClick={() => setEditing(null)}>Criar projeto</button>}
        >
          Projetos ajudam a agrupar tarefas de um mesmo objetivo, como uma campanha ou a abertura de uma loja.
        </EmptyState>
      )}

      {projects && projects.length > 0 && (
        <>
          <div className="filters">
            <label className="filter">
              <span>Status</span>
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="">Todos</option>
                {options(PROJECT_STATUS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>
          {visible.length === 0 && <p className="muted">Nenhum projeto com este status.</p>}
          <div className="project-grid">
            {visible.map((p) => (
              <article key={p.id} className="card project-card">
                <div className="project-card-head">
                  <ProjectStatusBadge value={p.status} />
                  <div className="row-gap-sm">
                    <button type="button" className="icon-btn" onClick={() => setEditing(p)} aria-label={`Editar ${p.nome}`} title="Editar"><Icon name="edit" /></button>
                    <button type="button" className="icon-btn danger" onClick={() => setToDelete(p)} aria-label={`Excluir ${p.nome}`} title="Excluir"><Icon name="trash" /></button>
                  </div>
                </div>
                <h2 className="project-title"><Link to={`/projetos/${p.id}`}>{p.nome}</Link></h2>
                {p.objetivo && <p className="muted small clamp-2">{p.objetivo}</p>}
                <p className="small"><Icon name="calendar" size={14} /> {formatDate(p.data_inicio)} – {formatDate(p.prazo_final)}</p>
                <ProgressBar value={p.progresso.percentual} label={`Progresso de ${p.nome}`} />
                <p className="muted small">{p.progresso.concluidas} de {p.progresso.total} tarefa(s) concluída(s)</p>
                <Link to={`/projetos/${p.id}`} className="btn btn-ghost btn-sm">Ver detalhes</Link>
              </article>
            ))}
          </div>
        </>
      )}

      <ProjectFormModal
        open={editing !== undefined}
        project={editing}
        onClose={() => setEditing(undefined)}
        onSaved={(saved) => {
          const wasNew = editing === null;
          setEditing(undefined);
          if (wasNew) navigate(`/projetos/${saved.id}`);
          else load();
        }}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir projeto"
        message={deleteProjectMessage(toDelete)}
        confirmLabel="Excluir projeto"
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
