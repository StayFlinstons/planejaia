import Icon from '../Icon.jsx';
import { TASK_PRIORITY, options } from '../../utils/labels.js';
import { formatDate } from '../../utils/dates.js';

/** Converte as tarefas sugeridas pela IA em itens editáveis. */
export function toEditable(tarefas = []) {
  return tarefas.map((t, i) => ({
    key: `${Date.now()}-${i}`,
    selected: true,
    titulo: t.titulo,
    descricao: t.descricao || '',
    etapa: t.etapa || '',
    prioridade: t.prioridade || 'media',
    prazo: t.prazo_sugerido || '',
    estimativa: Boolean(t.prazo_e_estimativa),
  }));
}

/**
 * Lista editável de tarefas sugeridas: o usuário pode marcar/desmarcar,
 * alterar título, descrição, prioridade e prazo, ou descartar cada item.
 */
export default function SuggestedTasks({ items, onChange }) {
  const update = (key, patch) => onChange(items.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const remove = (key) => onChange(items.filter((it) => it.key !== key));
  const allSelected = items.length > 0 && items.every((i) => i.selected);

  if (items.length === 0) {
    return <p className="muted">Todas as sugestões de tarefas foram descartadas.</p>;
  }

  return (
    <div className="suggested">
      <label className="filter-check select-all">
        <input type="checkbox" checked={allSelected} onChange={(e) => onChange(items.map((i) => ({ ...i, selected: e.target.checked })))} />
        <span>Selecionar todas ({items.filter((i) => i.selected).length} de {items.length} selecionadas)</span>
      </label>
      <ol className="suggested-list">
        {items.map((it, idx) => (
          <li key={it.key} className={`suggested-item ${it.selected ? '' : 'unselected'}`}>
            <div className="suggested-head">
              <label className="filter-check">
                <input type="checkbox" checked={it.selected} onChange={(e) => update(it.key, { selected: e.target.checked })} aria-label={`Selecionar tarefa ${idx + 1}`} />
                <span className="suggested-order">{idx + 1}.</span>
              </label>
              {it.etapa && <span className="badge badge-soft">{it.etapa}</span>}
              <button type="button" className="icon-btn danger push-right" onClick={() => remove(it.key)} aria-label="Descartar sugestão" title="Descartar sugestão">
                <Icon name="close" />
              </button>
            </div>
            <input
              className="input-title"
              value={it.titulo}
              maxLength={200}
              onChange={(e) => update(it.key, { titulo: e.target.value })}
              aria-label="Título da tarefa"
            />
            {!it.titulo.trim() && <small className="field-error">O título não pode ficar vazio.</small>}
            <textarea
              rows={2}
              value={it.descricao}
              maxLength={2000}
              onChange={(e) => update(it.key, { descricao: e.target.value })}
              aria-label="Descrição da tarefa"
            />
            <div className="suggested-fields">
              <label>
                <span>Prioridade</span>
                <select value={it.prioridade} onChange={(e) => update(it.key, { prioridade: e.target.value })}>
                  {options(TASK_PRIORITY).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label>
                <span>Prazo {it.estimativa && <em className="estimate">(estimativa)</em>}</span>
                <input type="date" value={it.prazo} onChange={(e) => update(it.key, { prazo: e.target.value, estimativa: false })} />
              </label>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function selectedTasksPayload(items, projectId) {
  return items
    .filter((i) => i.selected)
    .map((i) => ({
      titulo: i.titulo.trim(),
      descricao: i.descricao.trim() || null,
      prioridade: i.prioridade,
      prazo: i.prazo || null,
      status: 'pendente',
      project_id: projectId || null,
    }));
}

export function SelectedSummary({ tasks }) {
  return (
    <ul className="confirm-list">
      {tasks.map((t, i) => (
        <li key={i}>
          <strong>{t.titulo}</strong>
          <span className="muted small"> — {TASK_PRIORITY[t.prioridade]}{t.prazo ? `, prazo ${formatDate(t.prazo)}` : ', sem prazo'}</span>
        </li>
      ))}
    </ul>
  );
}
