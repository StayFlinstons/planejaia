import { useEffect, useState } from 'react';
import { Field, Modal, ErrorBox } from './ui.jsx';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { TASK_PRIORITY, TASK_STATUS, options } from '../utils/labels.js';
import { validateTaskForm, hasErrors } from '../utils/validation.js';

const empty = (projectId) => ({
  titulo: '', descricao: '', project_id: projectId || '', prazo: '', prioridade: 'media', status: 'pendente',
});

/**
 * Formulário de tarefa. `task` presente = edição.
 * `projects` alimenta o seletor; `defaultProjectId` pré-seleciona um projeto.
 */
export default function TaskFormModal({ open, task, projects = [], defaultProjectId, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => empty(defaultProjectId));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setServerError('');
    setForm(task ? {
      titulo: task.titulo || '',
      descricao: task.descricao || '',
      project_id: task.project_id || '',
      prazo: task.prazo || '',
      prioridade: task.prioridade || 'media',
      status: task.status || 'pendente',
    } : empty(defaultProjectId));
  }, [open, task, defaultProjectId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const v = validateTaskForm(form);
    setErrors(v);
    if (hasErrors(v)) return;
    setSaving(true);
    setServerError('');
    try {
      const payload = { ...form, project_id: form.project_id || null, prazo: form.prazo || null };
      const res = task ? await api.updateTask(task.id, payload) : await api.createTask(payload);
      toast.success(task ? 'Tarefa atualizada.' : 'Tarefa criada.');
      onSaved?.(res.task);
    } catch (err) {
      if (err.details && typeof err.details === 'object') setErrors(err.details);
      setServerError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title={task ? 'Editar tarefa' : 'Nova tarefa'}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" form="task-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar tarefa'}
          </button>
        </>
      )}
    >
      <form id="task-form" onSubmit={submit} noValidate className="form-grid">
        <ErrorBox message={serverError} />
        <Field label="Título" required error={errors.titulo}>
          {(id) => <input id={id} value={form.titulo} onChange={set('titulo')} maxLength={200} placeholder="Ex.: Publicar post no Instagram" />}
        </Field>
        <Field label="Descrição" error={errors.descricao}>
          {(id) => <textarea id={id} rows={3} value={form.descricao} onChange={set('descricao')} maxLength={2000} />}
        </Field>
        <Field label="Projeto" error={errors.project_id} hint="Deixe em branco para uma tarefa independente.">
          {(id) => (
            <select id={id} value={form.project_id} onChange={set('project_id')}>
              <option value="">Sem projeto (tarefa independente)</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          )}
        </Field>
        <div className="form-row form-row-3">
          <Field label="Prazo" error={errors.prazo}>
            {(id) => <input id={id} type="date" value={form.prazo} onChange={set('prazo')} />}
          </Field>
          <Field label="Prioridade" error={errors.prioridade}>
            {(id) => (
              <select id={id} value={form.prioridade} onChange={set('prioridade')}>
                {options(TASK_PRIORITY).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </Field>
          <Field label="Status" error={errors.status}>
            {(id) => (
              <select id={id} value={form.status} onChange={set('status')}>
                {options(TASK_STATUS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </Field>
        </div>
      </form>
    </Modal>
  );
}
