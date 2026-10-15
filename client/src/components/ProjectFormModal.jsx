import { useEffect, useState } from 'react';
import { Field, Modal, ErrorBox } from './ui.jsx';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { PROJECT_STATUS, options } from '../utils/labels.js';
import { validateProjectForm, hasErrors } from '../utils/validation.js';
import { todayISO, addDaysISO } from '../utils/dates.js';

const empty = () => ({
  nome: '', descricao: '', objetivo: '',
  data_inicio: todayISO(), prazo_final: addDaysISO(todayISO(), 30),
  orcamento_previsto: '', status: 'planejamento',
});

/** Formulário de criação/edição de projeto. `project` presente = edição. */
export default function ProjectFormModal({ open, project, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setServerError('');
    setForm(project ? {
      nome: project.nome || '',
      descricao: project.descricao || '',
      objetivo: project.objetivo || '',
      data_inicio: project.data_inicio || '',
      prazo_final: project.prazo_final || '',
      orcamento_previsto: project.orcamento_previsto ?? '',
      status: project.status || 'planejamento',
    } : empty());
  }, [open, project]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const v = validateProjectForm(form);
    setErrors(v);
    if (hasErrors(v)) return;
    setSaving(true);
    setServerError('');
    try {
      const payload = {
        ...form,
        orcamento_previsto: form.orcamento_previsto === '' ? null : String(form.orcamento_previsto).replace(',', '.'),
      };
      const res = project ? await api.updateProject(project.id, payload) : await api.createProject(payload);
      toast.success(project ? 'Projeto atualizado.' : 'Projeto criado.');
      onSaved?.(res.project);
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
      title={project ? 'Editar projeto' : 'Novo projeto'}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" form="project-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar projeto'}
          </button>
        </>
      )}
    >
      <form id="project-form" onSubmit={submit} noValidate className="form-grid">
        <ErrorBox message={serverError} />
        <Field label="Nome do projeto" required error={errors.nome}>
          {(id) => <input id={id} value={form.nome} onChange={set('nome')} maxLength={120} placeholder="Ex.: Campanha de fim de ano" />}
        </Field>
        <Field label="Objetivo principal" error={errors.objetivo} hint="O que você quer alcançar com este projeto?">
          {(id) => <input id={id} value={form.objetivo} onChange={set('objetivo')} maxLength={1000} placeholder="Ex.: Aumentar as vendas em dezembro" />}
        </Field>
        <Field label="Descrição" error={errors.descricao}>
          {(id) => <textarea id={id} rows={3} value={form.descricao} onChange={set('descricao')} maxLength={2000} />}
        </Field>
        <div className="form-row">
          <Field label="Data de início" required error={errors.data_inicio}>
            {(id) => <input id={id} type="date" value={form.data_inicio} onChange={set('data_inicio')} />}
          </Field>
          <Field label="Prazo final" required error={errors.prazo_final}>
            {(id) => <input id={id} type="date" value={form.prazo_final} min={form.data_inicio || undefined} onChange={set('prazo_final')} />}
          </Field>
        </div>
        <div className="form-row">
          <Field label="Orçamento previsto (R$)" error={errors.orcamento_previsto} hint="Opcional">
            {(id) => <input id={id} inputMode="decimal" value={form.orcamento_previsto} onChange={set('orcamento_previsto')} placeholder="0,00" />}
          </Field>
          <Field label="Status" error={errors.status}>
            {(id) => (
              <select id={id} value={form.status} onChange={set('status')}>
                {options(PROJECT_STATUS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </Field>
        </div>
      </form>
    </Modal>
  );
}
