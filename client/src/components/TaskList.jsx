import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { ConfirmDialog, PriorityBadge, TaskStatusBadge } from './ui.jsx';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { deadlineLabel, isOverdue, todayISO } from '../utils/dates.js';

/**
 * Lista de tarefas com ações: concluir/reabrir, editar e excluir (com confirmação).
 * `onChanged` é chamado depois de qualquer alteração salva com sucesso.
 */
export default function TaskList({ tasks, onEdit, onChanged, showProject = true }) {
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const hoje = todayISO();

  async function toggle(task) {
    const novo = task.status === 'concluida' ? 'pendente' : 'concluida';
    setBusyId(task.id);
    try {
      await api.patchTask(task.id, { status: novo });
      toast.success(novo === 'concluida' ? 'Tarefa concluída.' : 'Tarefa reaberta.');
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function changeStatus(task, status) {
    setBusyId(task.id);
    try {
      await api.patchTask(task.id, { status });
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await api.deleteTask(toDelete.id);
      toast.success('Tarefa excluída.');
      setToDelete(null);
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <ul className="task-list">
        {tasks.map((t) => {
          const late = isOverdue(t, hoje);
          const done = t.status === 'concluida';
          return (
            <li key={t.id} className={`task-item ${late ? 'is-late' : ''} ${done ? 'is-done' : ''}`}>
              <button
                type="button"
                className={`check ${done ? 'checked' : ''}`}
                onClick={() => toggle(t)}
                disabled={busyId === t.id}
                aria-label={done ? `Reabrir "${t.titulo}"` : `Concluir "${t.titulo}"`}
                title={done ? 'Reabrir tarefa' : 'Marcar como concluída'}
              >
                {done && <Icon name="check" size={14} />}
              </button>
              <div className="task-main">
                <div className="task-title">{t.titulo}</div>
                {t.descricao && <div className="task-desc">{t.descricao}</div>}
                <div className="task-meta">
                  <PriorityBadge value={t.prioridade} />
                  <TaskStatusBadge value={t.status} />
                  <span className={`deadline ${late ? 'late' : ''}`}>
                    <Icon name={late ? 'alert' : 'calendar'} size={14} />
                    {deadlineLabel(t, hoje)}
                  </span>
                  {showProject && t.project && (
                    <Link className="task-project" to={`/projetos/${t.project.id}`}>
                      <Icon name="folder" size={14} />{t.project.nome}
                    </Link>
                  )}
                </div>
              </div>
              <div className="task-actions">
                {!done && t.status === 'pendente' && (
                  <button type="button" className="btn btn-sm btn-ghost hide-sm" onClick={() => changeStatus(t, 'em_andamento')} disabled={busyId === t.id}>
                    Iniciar
                  </button>
                )}
                {done && (
                  <button type="button" className="icon-btn" onClick={() => toggle(t)} disabled={busyId === t.id} aria-label="Reabrir tarefa" title="Reabrir tarefa">
                    <Icon name="undo" />
                  </button>
                )}
                <button type="button" className="icon-btn" onClick={() => onEdit?.(t)} aria-label={`Editar "${t.titulo}"`} title="Editar">
                  <Icon name="edit" />
                </button>
                <button type="button" className="icon-btn danger" onClick={() => setToDelete(t)} aria-label={`Excluir "${t.titulo}"`} title="Excluir">
                  <Icon name="trash" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir tarefa"
        message={<p>Tem certeza que deseja excluir a tarefa <strong>{toDelete?.titulo}</strong>? Esta ação não pode ser desfeita.</p>}
        confirmLabel="Excluir"
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
