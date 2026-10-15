// Regras de validação usadas pelas rotas. Retornam { value, errors }.
// `errors` é um objeto { campo: 'mensagem' } (vazio quando está tudo certo).

export const PROJECT_STATUS = ['planejamento', 'em_andamento', 'concluido', 'cancelado'];
export const TASK_STATUS = ['pendente', 'em_andamento', 'concluida'];
export const TASK_PRIORITY = ['baixa', 'media', 'alta', 'urgente'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Verifica se é uma data real no formato AAAA-MM-DD (ex.: rejeita 2026-02-30). */
export function isValidDate(value) {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900 || y > 2200) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Data de hoje (AAAA-MM-DD) no fuso informado, padrão America/Sao_Paulo. */
export function todayISO(timeZone = 'America/Sao_Paulo') {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function text(value, { field, label, required = false, max, errors }) {
  if (value === undefined || value === null) {
    if (required) errors[field] = `${label} é obrigatório.`;
    return null;
  }
  if (typeof value !== 'string') {
    errors[field] = `${label} deve ser um texto.`;
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    if (required) errors[field] = `${label} é obrigatório.`;
    return null;
  }
  if (max && trimmed.length > max) {
    errors[field] = `${label} deve ter no máximo ${max} caracteres.`;
  }
  return trimmed;
}

function date(value, { field, label, required = false, errors }) {
  if (value === undefined || value === null || value === '') {
    if (required) errors[field] = `${label} é obrigatória.`;
    return null;
  }
  if (!isValidDate(value)) {
    errors[field] = `${label} é inválida. Use o formato AAAA-MM-DD.`;
    return null;
  }
  return value;
}

function oneOf(value, { field, label, options, fallback, errors }) {
  if (value === undefined || value === null || value === '') return fallback;
  if (!options.includes(value)) {
    errors[field] = `${label} inválido.`;
    return fallback;
  }
  return value;
}

export function validateProject(body = {}) {
  const errors = {};
  const value = {
    nome: text(body.nome, { field: 'nome', label: 'O nome', required: true, max: 120, errors }),
    descricao: text(body.descricao, { field: 'descricao', label: 'A descrição', max: 2000, errors }),
    objetivo: text(body.objetivo, { field: 'objetivo', label: 'O objetivo', max: 1000, errors }),
    data_inicio: date(body.data_inicio, { field: 'data_inicio', label: 'A data de início', required: true, errors }),
    prazo_final: date(body.prazo_final, { field: 'prazo_final', label: 'A data do prazo final', required: true, errors }),
    status: oneOf(body.status, {
      field: 'status', label: 'Status', options: PROJECT_STATUS, fallback: 'planejamento', errors,
    }),
    orcamento_previsto: null,
  };

  const orc = body.orcamento_previsto;
  if (orc !== undefined && orc !== null && orc !== '') {
    const n = typeof orc === 'number' ? orc : Number(String(orc).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) {
      errors.orcamento_previsto = 'O orçamento deve ser um número maior ou igual a zero.';
    } else if (n > 999999999999) {
      errors.orcamento_previsto = 'O orçamento informado é alto demais.';
    } else {
      value.orcamento_previsto = Math.round(n * 100) / 100;
    }
  }

  if (value.data_inicio && value.prazo_final && value.prazo_final < value.data_inicio) {
    errors.prazo_final = 'O prazo final não pode ser anterior à data de início.';
  }
  return { value, errors };
}

/**
 * Valida uma tarefa. Com `partial: true`, só valida os campos enviados
 * (usado em atualizações pontuais, como mudar status ou prazo).
 */
export function validateTask(body = {}, { partial = false } = {}) {
  const errors = {};
  const value = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  if (!partial || has('titulo')) {
    value.titulo = text(body.titulo, { field: 'titulo', label: 'O título', required: true, max: 200, errors });
  }
  if (!partial || has('descricao')) {
    value.descricao = text(body.descricao, { field: 'descricao', label: 'A descrição', max: 2000, errors });
  }
  if (!partial || has('prazo')) {
    value.prazo = date(body.prazo, { field: 'prazo', label: 'A data do prazo', errors });
  }
  if (!partial || has('prioridade')) {
    value.prioridade = oneOf(body.prioridade, {
      field: 'prioridade', label: 'Prioridade', options: TASK_PRIORITY, fallback: 'media', errors,
    });
  }
  if (!partial || has('status')) {
    value.status = oneOf(body.status, {
      field: 'status', label: 'Status', options: TASK_STATUS, fallback: 'pendente', errors,
    });
  }
  if (!partial || has('project_id')) {
    const pid = body.project_id;
    if (pid === undefined || pid === null || pid === '') {
      value.project_id = null;
    } else if (!isUuid(pid)) {
      errors.project_id = 'Projeto inválido.';
    } else {
      value.project_id = pid;
    }
  }
  return { value, errors };
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}
