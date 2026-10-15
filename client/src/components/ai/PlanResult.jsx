import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../Icon.jsx';
import { ConfirmDialog, ErrorBox, Field } from '../ui.jsx';
import SuggestedTasks, { SelectedSummary, selectedTasksPayload, toEditable } from './SuggestedTasks.jsx';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { addDaysISO, todayISO } from '../../utils/dates.js';

function BulletList({ title, items, tone }) {
  if (!items?.length) return null;
  return (
    <div className={`ai-block ${tone ? `ai-${tone}` : ''}`}>
      <h3>{title}</h3>
      <ul>{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
    </div>
  );
}

/** Resultado da Função A — plano de ação, com revisão antes de salvar. */
export default function PlanResult({ result, project, onDiscard }) {
  const toast = useToast();
  const [items, setItems] = useState(() => toEditable(result.tarefas));
  const [newProject, setNewProject] = useState(() => {
    const prazos = result.tarefas.map((t) => t.prazo_sugerido).filter(Boolean).sort();
    return {
      criar: !project,
      nome: (result.objetivo || 'Novo projeto').slice(0, 120),
      data_inicio: todayISO(),
      prazo_final: prazos.at(-1) || addDaysISO(todayISO(), 30),
    };
  });
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(null); // { count, projectId, projectName }

  const selected = items.filter((i) => i.selected);
  const invalid = selected.some((i) => !i.titulo.trim());
  const projectInvalid = !project && newProject.criar
    && (!newProject.nome.trim() || !newProject.data_inicio || !newProject.prazo_final || newProject.prazo_final < newProject.data_inicio);

  async function save() {
    setSaving(true);
    setError('');
    const existing = project || (newProject.existingId ? { id: newProject.existingId, nome: newProject.nome } : null);
    let projectId = existing?.id || null;
    let projectName = existing?.nome || null;
    let createdProject = false;
    try {
      if (!existing && newProject.criar) {
        const res = await api.createProject({
          nome: newProject.nome,
          objetivo: result.objetivo,
          descricao: result.resumo,
          data_inicio: newProject.data_inicio,
          prazo_final: newProject.prazo_final,
          status: 'planejamento',
        });
        projectId = res.project.id;
        projectName = res.project.nome;
        createdProject = true;
      }
      const res = await api.createTasksBulk(selectedTasksPayload(items, projectId));
      setSaved({ count: res.count, projectId, projectName });
      toast.success(`${res.count} tarefa(s) cadastrada(s).`);
      setConfirming(false);
    } catch (err) {
      // Informa exatamente o que foi e o que não foi salvo
      setError(createdProject
        ? `O projeto "${projectName}" foi criado, mas as tarefas NÃO foram salvas: ${err.message}`
        : `Nada foi salvo: ${err.message}`);
      setConfirming(false);
      if (createdProject) setNewProject((p) => ({ ...p, criar: false, existingId: projectId }));
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="card ai-result">
        <div className="alert alert-success">
          <Icon name="check" />
          <div>
            <p><strong>{saved.count} tarefa(s) cadastrada(s) com sucesso{saved.projectName ? ` no projeto "${saved.projectName}"` : ' como tarefas independentes'}.</strong></p>
            <div className="row-gap">
              {saved.projectId
                ? <Link to={`/projetos/${saved.projectId}`} className="btn btn-primary btn-sm">Ver projeto</Link>
                : <Link to="/tarefas" className="btn btn-primary btn-sm">Ver tarefas</Link>}
              <button type="button" className="btn btn-ghost btn-sm" onClick={onDiscard}>Fazer novo pedido</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Se o projeto foi criado mas as tarefas falharam, a nova tentativa usa o projeto já criado
  const targetProject = project || (newProject.existingId ? { id: newProject.existingId, nome: newProject.nome } : null);

  return (
    <div className="card ai-result">
      <h2>Plano de ação sugerido</h2>
      {result.objetivo && <p className="ai-objective"><strong>Objetivo:</strong> {result.objetivo}</p>}
      {result.resumo && <p>{result.resumo}</p>}

      {result.etapas?.length > 0 && (
        <div className="ai-block">
          <h3>Etapas</h3>
          <ol className="steps">
            {result.etapas.map((e, i) => <li key={i}><strong>{e.nome}</strong>{e.descricao && ` — ${e.descricao}`}</li>)}
          </ol>
        </div>
      )}

      <div className="ai-block">
        <h3>Tarefas sugeridas</h3>
        <p className="muted small">Revise, edite ou descarte as sugestões. Somente as tarefas selecionadas serão cadastradas, e só depois da sua confirmação.</p>
        {result.observacao_prazos && <p className="small"><Icon name="clock" size={14} /> {result.observacao_prazos}</p>}
        <SuggestedTasks items={items} onChange={setItems} />
      </div>

      <BulletList title="Possíveis riscos e dificuldades" items={result.riscos} tone="warn" />
      <BulletList title="Como acompanhar o resultado" items={result.recomendacoes_acompanhamento} />
      <BulletList title="Informações que ajudariam a melhorar o plano" items={result.informacoes_faltantes} tone="info" />

      {!targetProject && (
        <div className="ai-block new-project-box">
          <label className="filter-check">
            <input type="checkbox" checked={newProject.criar} onChange={(e) => setNewProject((p) => ({ ...p, criar: e.target.checked }))} />
            <span>Criar um novo projeto com este plano</span>
          </label>
          {newProject.criar ? (
            <div className="form-grid">
              <Field label="Nome do projeto" required error={!newProject.nome.trim() ? 'Informe o nome.' : null}>
                {(id) => <input id={id} value={newProject.nome} maxLength={120} onChange={(e) => setNewProject((p) => ({ ...p, nome: e.target.value }))} />}
              </Field>
              <div className="form-row">
                <Field label="Início" required>
                  {(id) => <input id={id} type="date" value={newProject.data_inicio} onChange={(e) => setNewProject((p) => ({ ...p, data_inicio: e.target.value }))} />}
                </Field>
                <Field label="Prazo final" required error={newProject.prazo_final && newProject.prazo_final < newProject.data_inicio ? 'Não pode ser anterior ao início.' : null}>
                  {(id) => <input id={id} type="date" value={newProject.prazo_final} onChange={(e) => setNewProject((p) => ({ ...p, prazo_final: e.target.value }))} />}
                </Field>
              </div>
            </div>
          ) : (
            <p className="muted small">As tarefas serão salvas como tarefas independentes (sem projeto).</p>
          )}
        </div>
      )}

      <ErrorBox message={error} />

      <div className="ai-actions">
        <button type="button" className="btn btn-ghost" onClick={onDiscard} disabled={saving}>Descartar plano</button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={selected.length === 0 || invalid || projectInvalid || saving}
          onClick={() => setConfirming(true)}
        >
          <Icon name="check" />Revisar e salvar {selected.length} tarefa(s)
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Confirmar cadastro"
        confirmLabel={`Cadastrar ${selected.length} tarefa(s)`}
        busy={saving}
        onCancel={() => setConfirming(false)}
        onConfirm={save}
        message={(
          <>
            <p>
              As tarefas abaixo serão cadastradas
              {targetProject ? <> no projeto <strong>{targetProject.nome}</strong></> : newProject.criar ? <> no novo projeto <strong>{newProject.nome}</strong></> : ' como tarefas independentes'}:
            </p>
            <SelectedSummary tasks={selectedTasksPayload(items, null)} />
          </>
        )}
      />
    </div>
  );
}
