import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import {
  EmptyState, ErrorBox, PageHeader, PriorityBadge, ProgressBar, ProjectStatusBadge, Spinner,
} from '../components/ui.jsx';
import ProjectFormModal from '../components/ProjectFormModal.jsx';
import TaskFormModal from '../components/TaskFormModal.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { deadlineLabel, formatDate } from '../utils/dates.js';

function StatCard({ label, value, tone, to }) {
  return (
    <Link to={to} className={`stat stat-${tone}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // 'project' | 'task'

  const load = useCallback(async () => {
    setError('');
    try {
      const [dash, proj] = await Promise.all([api.dashboard(), api.listProjects()]);
      setData(dash);
      setProjects(proj.projects);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const nome = user?.user_metadata?.nome?.split(' ')[0];

  const actions = (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setModal('project')}><Icon name="plus" />Novo projeto</button>
      <button type="button" className="btn btn-ghost" onClick={() => setModal('task')}><Icon name="plus" />Nova tarefa</button>
      <Link to="/assistente" className="btn btn-primary"><Icon name="spark" />Assistente IA</Link>
    </>
  );

  return (
    <div className="page">
      <PageHeader title={nome ? `Olá, ${nome}!` : 'Painel'} subtitle="Veja como estão seus projetos e tarefas." actions={actions} />

      {error && <ErrorBox message={error} onRetry={load} />}
      {!data && !error && <Spinner />}

      {data && (
        <>
          <section className="stats" aria-label="Indicadores">
            <StatCard label="Projetos" value={data.indicadores.projetos} tone="blue" to="/projetos" />
            <StatCard label="Pendentes" value={data.indicadores.pendentes} tone="gray" to="/tarefas?status=pendente" />
            <StatCard label="Em andamento" value={data.indicadores.em_andamento} tone="amber" to="/tarefas?status=em_andamento" />
            <StatCard label="Concluídas" value={data.indicadores.concluidas} tone="green" to="/tarefas?status=concluida" />
            <StatCard label="Atrasadas" value={data.indicadores.atrasadas} tone="red" to="/tarefas?atrasadas=1" />
          </section>

          {data.indicadores.projetos === 0 && data.indicadores.pendentes + data.indicadores.em_andamento + data.indicadores.concluidas === 0 ? (
            <EmptyState
              icon="spark"
              title="Vamos começar?"
              action={(
                <div className="row-gap">
                  <button type="button" className="btn btn-primary" onClick={() => setModal('project')}>Criar meu primeiro projeto</button>
                  <Link to="/assistente" className="btn btn-ghost">Pedir um plano à IA</Link>
                </div>
              )}
            >
              Crie um projeto, cadastre tarefas ou descreva seu objetivo para o assistente de IA montar um plano para você.
            </EmptyState>
          ) : (
            <div className="grid-2">
              <section className="card">
                <div className="card-head">
                  <h2>Próximas tarefas</h2>
                  <Link to="/tarefas" className="link">Ver todas</Link>
                </div>
                {data.tarefas_atrasadas.length > 0 && (
                  <div className="late-box">
                    <strong><Icon name="alert" size={16} /> {data.indicadores.atrasadas} tarefa(s) atrasada(s)</strong>
                    <ul className="mini-list">
                      {data.tarefas_atrasadas.map((t) => (
                        <li key={t.id}>
                          <span className="mini-title">{t.titulo}</span>
                          <span className="deadline late">{deadlineLabel(t, data.hoje)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {data.proximas_tarefas.length === 0 ? (
                  <p className="muted small">Nenhuma tarefa com prazo pela frente.</p>
                ) : (
                  <ul className="mini-list">
                    {data.proximas_tarefas.map((t) => (
                      <li key={t.id}>
                        <div>
                          <span className="mini-title">{t.titulo}</span>
                          {t.project && <span className="mini-sub">{t.project.nome}</span>}
                        </div>
                        <div className="mini-right">
                          <PriorityBadge value={t.prioridade} />
                          <span className="deadline">{deadlineLabel(t, data.hoje)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card">
                <div className="card-head">
                  <h2>Projetos em andamento</h2>
                  <Link to="/projetos" className="link">Ver todos</Link>
                </div>
                {data.projetos_em_andamento.length === 0 ? (
                  <p className="muted small">Nenhum projeto em planejamento ou em andamento.</p>
                ) : (
                  <ul className="mini-list">
                    {data.projetos_em_andamento.map((p) => (
                      <li key={p.id} className="mini-project">
                        <Link to={`/projetos/${p.id}`} className="mini-title">{p.nome}</Link>
                        <div className="mini-right">
                          <ProjectStatusBadge value={p.status} />
                          <span className="muted small">até {formatDate(p.prazo_final)}</span>
                        </div>
                        <ProgressBar value={p.progresso.percentual} label={`Progresso de ${p.nome}`} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </>
      )}

      <ProjectFormModal
        open={modal === 'project'}
        onClose={() => setModal(null)}
        onSaved={(p) => { setModal(null); navigate(`/projetos/${p.id}`); }}
      />
      <TaskFormModal
        open={modal === 'task'}
        projects={projects}
        onClose={() => setModal(null)}
        onSaved={() => { setModal(null); load(); }}
      />
    </div>
  );
}
