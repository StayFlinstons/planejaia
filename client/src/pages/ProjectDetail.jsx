import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import {
  ConfirmDialog, EmptyState, ErrorBox, PageHeader, ProgressBar, ProjectStatusBadge, Spinner,
} from '../components/ui.jsx';
import ProjectFormModal from '../components/ProjectFormModal.jsx';
import TaskFormModal from '../components/TaskFormModal.jsx';
import TaskList from '../components/TaskList.jsx';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { formatDate, formatMoney, isOverdue, todayISO } from '../utils/dates.js';
import { deleteProjectMessage } from './Projects.jsx';

const ORDER = { pendente: 0, em_andamento: 0, concluida: 1 };

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [editingProject, setEditingProject] = useState(false);
  const [taskModal, setTaskModal] = useState(undefined); // undefined = fechado, null = nova
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.getProject(id);
      setProject(res.project);
      setTasks(res.tasks);
    } catch (err) {
      if (err.status === 404) setNotFound(true);
      else setError(err.message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function doDelete() {
    setDeleting(true);
    try {
      await api.deleteProject(id);
      toast.success('Projeto excluído.');
      navigate('/projetos', { replace: true });
    } catch (err) {
      toast.error(err.message);
      setDeleting(false);
    }
  }

  if (notFound) {
    return (
      <div className="page">
        <EmptyState title="Projeto não encontrado" action={<Link to="/projetos" className="btn btn-primary">Voltar para projetos</Link>}>
          Ele pode ter sido excluído.
        </EmptyState>
      </div>
    );
  }

  const hoje = todayISO();
  const sorted = [...tasks].sort((a, b) => (ORDER[a.status] - ORDER[b.status])
    || (a.prazo || '9999').localeCompare(b.prazo || '9999'));
  const atrasadas = tasks.filter((t) => isOverdue(t, hoje)).length;

  return (
    <div className="page">
      {error && <ErrorBox message={error} onRetry={load} />}
      {!project && !error && <Spinner />}

      {project && (
        <>
          <PageHeader
            back={<Link to="/projetos" className="back-link"><Icon name="arrowLeft" size={16} />Projetos</Link>}
            title={project.nome}
            actions={(
              <>
                <button type="button" className="btn btn-ghost" onClick={() => setEditingProject(true)}><Icon name="edit" />Editar</button>
                <button type="button" className="btn btn-ghost danger" onClick={() => setConfirmDelete(true)}><Icon name="trash" />Excluir</button>
              </>
            )}
          />

          <div className="grid-detail">
            <section className="card">
              <div className="detail-status"><ProjectStatusBadge value={project.status} /></div>
              {project.descricao && <p>{project.descricao}</p>}
              <dl className="details">
                <div><dt>Objetivo</dt><dd>{project.objetivo || <span className="muted">Não informado</span>}</dd></div>
                <div><dt>Início</dt><dd>{formatDate(project.data_inicio)}</dd></div>
                <div><dt>Prazo final</dt><dd>{formatDate(project.prazo_final)}</dd></div>
                {project.orcamento_previsto != null && <div><dt>Orçamento previsto</dt><dd>{formatMoney(project.orcamento_previsto)}</dd></div>}
              </dl>
            </section>

            <section className="card">
              <h2>Progresso</h2>
              <ProgressBar value={project.progresso.percentual} />
              <div className="mini-stats">
                <div><strong>{project.progresso.concluidas}</strong><span>Concluídas</span></div>
                <div><strong>{project.progresso.pendentes}</strong><span>Pendentes</span></div>
                <div className={atrasadas ? 'text-danger' : ''}><strong>{atrasadas}</strong><span>Atrasadas</span></div>
              </div>
              <Link to={`/assistente?projeto=${project.id}`} className="btn btn-primary btn-block">
                <Icon name="spark" />Pedir ajuda da IA para este projeto
              </Link>
            </section>
          </div>

          <section className="card">
            <div className="card-head">
              <h2>Tarefas ({tasks.length})</h2>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setTaskModal(null)}><Icon name="plus" />Adicionar tarefa</button>
            </div>
            {tasks.length === 0 ? (
              <EmptyState
                icon="check"
                title="Ainda não existem atividades cadastradas"
                action={(
                  <div className="row-gap">
                    <button type="button" className="btn btn-primary" onClick={() => setTaskModal(null)}>Adicionar tarefa</button>
                    <Link to={`/assistente?projeto=${project.id}`} className="btn btn-ghost">Gerar tarefas com a IA</Link>
                  </div>
                )}
              >
                Adicione as tarefas deste projeto manualmente ou peça para o assistente sugerir um plano.
              </EmptyState>
            ) : (
              <TaskList tasks={sorted} showProject={false} onEdit={(t) => setTaskModal(t)} onChanged={load} />
            )}
          </section>
        </>
      )}

      <ProjectFormModal
        open={editingProject}
        project={project}
        onClose={() => setEditingProject(false)}
        onSaved={() => { setEditingProject(false); load(); }}
      />
      <TaskFormModal
        open={taskModal !== undefined}
        task={taskModal}
        projects={project ? [project] : []}
        defaultProjectId={id}
        onClose={() => setTaskModal(undefined)}
        onSaved={() => { setTaskModal(undefined); load(); }}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Excluir projeto"
        message={deleteProjectMessage(project)}
        confirmLabel="Excluir projeto"
        danger
        busy={deleting}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
