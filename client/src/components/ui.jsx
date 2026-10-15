// Componentes de interface reutilizáveis.
import { useEffect, useId, useRef } from 'react';
import Icon from './Icon.jsx';
import { PROJECT_STATUS, TASK_PRIORITY, TASK_STATUS } from '../utils/labels.js';

export function Spinner({ label = 'Carregando...' }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="alert alert-error" role="alert">
      <Icon name="alert" />
      <div>
        <p>{message}</p>
        {onRetry && <button type="button" className="btn btn-sm btn-ghost" onClick={onRetry}>Tentar novamente</button>}
      </div>
    </div>
  );
}

export function EmptyState({ icon = 'folder', title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={28} /></div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function PriorityBadge({ value }) {
  return <span className={`badge prio-${value}`}>{TASK_PRIORITY[value] || value}</span>;
}

export function TaskStatusBadge({ value }) {
  return <span className={`badge status-${value}`}>{TASK_STATUS[value] || value}</span>;
}

export function ProjectStatusBadge({ value }) {
  return <span className={`badge pstatus-${value}`}>{PROJECT_STATUS[value] || value}</span>;
}

export function ProgressBar({ value = 0, label }) {
  return (
    <div className="progress-wrap">
      <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label || 'Progresso'}>
        <div className="progress-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="progress-text">{value}%</span>
    </div>
  );
}

/** Campo de formulário com rótulo e mensagem de erro. */
export function Field({ label, error, hint, required, children }) {
  const id = useId();
  const child = typeof children === 'function' ? children(id) : children;
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}{required && <span className="req" aria-hidden="true"> *</span>}</label>
      {child}
      {hint && !error && <small className="hint">{hint}</small>}
      {error && <small className="field-error" role="alert">{error}</small>}
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer, size = 'md' }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current?.(); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    (ref.current?.querySelector('.modal-body input, .modal-body textarea, .modal-body select')
      || ref.current?.querySelector('.modal-footer button'))?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref}>
        <header className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}

/** Diálogo de confirmação para exclusões e ações importantes. */
export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirmar', danger = false, busy = false, onConfirm, onCancel,
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? undefined : onCancel}
      size="sm"
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
            {busy ? 'Aguarde...' : confirmLabel}
          </button>
        </>
      )}
    >
      <div className="confirm-message">{message}</div>
    </Modal>
  );
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="page-header">
      <div>
        {back}
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
