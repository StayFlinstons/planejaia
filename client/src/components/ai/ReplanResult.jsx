import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../Icon.jsx';
import { ConfirmDialog, ErrorBox, PriorityBadge } from '../ui.jsx';
import SuggestedTasks, { SelectedSummary, selectedTasksPayload, toEditable } from './SuggestedTasks.jsx';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDate, todayISO } from '../../utils/dates.js';
import { TASK_PRIORITY, options } from '../../utils/labels.js';

/** Resultado da Função D — replanejamento. Mostra o "antes → depois" e só aplica o que for aprovado. */
export default function ReplanResult({ result, project, onDiscard }) {
  const toast = useToast();
  const [changes, setChanges] = useState(() => result.alteracoes.map((a) => ({
    ...a, selected: true, prazo: a.proposto.prazo || a.atual.prazo || '', prioridade: a.proposto.prioridade || a.atual.prioridade,
  })));
  const [newTasks, setNewTasks] = useState(() => toEditable(result.novas_tarefas));
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  const update = (id, patch) => setChanges((list) => list.map((c) => (c.tarefa.id === id ? { ...c, ...patch } : c)));

  // Só envia o que realmente difere do valor atual
  const updates = changes.filter((c) => c.selected).map((c) => {
    const u = { id: c.tarefa.id };
    if (c.prazo && c.prazo !== c.atual.prazo) u.prazo = c.prazo;
    if (c.prioridade !== c.atual.prioridade) u.prioridade = c.prioridade;
    return u;
  }).filter((u) => Object.keys(u).length > 1);
  const creations = selectedTasksPayload(newTasks, project?.id);
  const total = updates.length + creations.length;
  const invalid = newTasks.some((t) => t.selected && !t.titulo.trim());

  async function apply() {
    setSaving(true);
    setError('');
    const r = { updated: 0, failed: [], created: 0, createError: null };
    try {
      if (updates.length) {
        try {
          const res = await api.updateTasksBulk(updates);
          r.updated = res.updated.length;
          r.failed = res.failed;
        } catch (err) {
          r.failed = updates.map((u) => ({ id: u.id, message: err.message }));
        }
      }
      if (creations.length) {
        try {
          const res = await api.createTasksBulk(creations);
          r.created = res.count;
        } catch (err) {
          r.createError = err.message;
        }
      }
      if (r.updated + r.created > 0) toast.success('Alterações aplicadas.');
      if (r.failed.length || r.createError) setError('Algumas alterações não foram salvas. Veja os detalhes abaixo.');
      setReport(r);
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  }

  if (report) {
    const titleOf = (id) => changes.find((c) => c.tarefa.id === id)?.tarefa.titulo || 'Tarefa';
    return (
      <div className="card ai-result">
        <h2>Resultado do replanejamento</h2>
        <ul className="report">
          <li><Icon name="check" size={16} /> {report.updated} tarefa(s) atualizada(s).</li>
          {creations.length > 0 && !report.createError && <li><Icon name="check" size={16} /> {report.created} nova(s) tarefa(s) cadastrada(s).</li>}
          {report.failed.map((f) => <li key={f.id} className="text-danger"><Icon name="alert" size={16} /> Não salvo: {titleOf(f.id)} — {f.message}</li>)}
          {report.createError && <li className="text-danger"><Icon name="alert" size={16} /> Novas tarefas NÃO cadastradas: {report.createError}</li>}
        </ul>
        <ErrorBox message={error} />
        <div className="row-gap">
          <Link to={project ? `/projetos/${project.id}` : '/tarefas'} className="btn btn-primary btn-sm">Ver tarefas</Link>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onDiscard}>Fazer novo pedido</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card ai-result">
      <h2>Proposta de replanejamento</h2>
      {result.resumo && <p>{result.resumo}</p>}
      <p className="muted small">Nada foi alterado ainda. Revise cada mudança, ajuste se quiser e confirme apenas as que deseja aplicar.</p>

      <div className="ai-block">
        <h3>Alterações em tarefas existentes</h3>
        {changes.length === 0 ? <p className="muted">A IA não sugeriu alterações nas tarefas atuais.</p> : (
          <ul className="changes">
            {changes.map((c) => (
              <li key={c.tarefa.id} className={`change ${c.selected ? '' : 'unselected'}`}>
                <label className="filter-check">
                  <input type="checkbox" checked={c.selected} onChange={(e) => update(c.tarefa.id, { selected: e.target.checked })} />
                  <strong>{c.tarefa.titulo}</strong>
                </label>
                {c.motivo && <p className="small muted">{c.motivo}</p>}
                <div className="diff">
                  <div>
                    <span className="diff-label">Prazo</span>
                    <span className="diff-old">{formatDate(c.atual.prazo)}</span>
                    <span aria-hidden="true">→</span>
                    <input type="date" value={c.prazo} min={todayISO()} onChange={(e) => update(c.tarefa.id, { prazo: e.target.value })} aria-label="Novo prazo" />
                  </div>
                  <div>
                    <span className="diff-label">Prioridade</span>
                    <PriorityBadge value={c.atual.prioridade} />
                    <span aria-hidden="true">→</span>
                    <select value={c.prioridade} onChange={(e) => update(c.tarefa.id, { prioridade: e.target.value })} aria-label="Nova prioridade">
                      {options(TASK_PRIORITY).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {newTasks.length > 0 && (
        <div className="ai-block">
          <h3>Novas tarefas sugeridas</h3>
          <SuggestedTasks items={newTasks} onChange={setNewTasks} />
        </div>
      )}

      {result.recomendacoes?.length > 0 && (
        <div className="ai-block">
          <h3>Recomendações</h3>
          <ul>{result.recomendacoes.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}

      <div className="ai-actions">
        <button type="button" className="btn btn-ghost" onClick={onDiscard}>Descartar proposta</button>
        <button type="button" className="btn btn-primary" disabled={total === 0 || invalid} onClick={() => setConfirming(true)}>
          <Icon name="check" />Revisar e aplicar ({total})
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Confirmar replanejamento"
        confirmLabel="Aplicar alterações"
        busy={saving}
        onCancel={() => setConfirming(false)}
        onConfirm={apply}
        message={(
          <>
            {updates.length > 0 && (
              <>
                <p>Serão alteradas {updates.length} tarefa(s):</p>
                <ul className="confirm-list">
                  {updates.map((u) => {
                    const c = changes.find((x) => x.tarefa.id === u.id);
                    return (
                      <li key={u.id}>
                        <strong>{c.tarefa.titulo}</strong>
                        <span className="muted small">
                          {u.prazo && ` — prazo: ${formatDate(c.atual.prazo)} → ${formatDate(u.prazo)}`}
                          {u.prioridade && ` — prioridade: ${TASK_PRIORITY[c.atual.prioridade]} → ${TASK_PRIORITY[u.prioridade]}`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {creations.length > 0 && (
              <>
                <p>Serão criadas {creations.length} nova(s) tarefa(s):</p>
                <SelectedSummary tasks={creations} />
              </>
            )}
          </>
        )}
      />
    </div>
  );
}
