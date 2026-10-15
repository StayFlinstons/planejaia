import { supabase } from '../lib/supabase.js';
import { todayISO } from '../utils/dates.js';

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/** Erro com mensagem amigável vinda do servidor. */
export class ApiError extends Error {
  constructor(message, { status = 0, code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(method, path, body) {
  let response;
  try {
    response = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.');
  }

  let data = null;
  try { data = await response.json(); } catch { /* resposta sem JSON */ }

  if (!response.ok) {
    const err = data?.error || {};
    if (response.status === 401) {
      // sessão expirada: encerra para voltar à tela de acesso
      await supabase.auth.signOut().catch(() => {});
    }
    throw new ApiError(
      err.message || (response.status >= 500
        ? 'O servidor está com problemas no momento. Tente novamente em instantes.'
        : 'Não foi possível concluir a operação.'),
      { status: response.status, code: err.code, details: err.details },
    );
  }
  return data;
}

const qs = (params) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  dashboard: () => request('GET', `/dashboard${qs({ hoje: todayISO() })}`),

  listProjects: () => request('GET', '/projects'),
  getProject: (id) => request('GET', `/projects/${id}`),
  createProject: (data) => request('POST', '/projects', data),
  updateProject: (id, data) => request('PUT', `/projects/${id}`, data),
  deleteProject: (id) => request('DELETE', `/projects/${id}`),

  listTasks: (filters = {}) => request('GET', `/tasks${qs({ ...filters, hoje: todayISO() })}`),
  createTask: (data) => request('POST', '/tasks', data),
  createTasksBulk: (tasks) => request('POST', '/tasks/bulk', { tasks }),
  updateTask: (id, data) => request('PUT', `/tasks/${id}`, data),
  patchTask: (id, data) => request('PATCH', `/tasks/${id}`, data),
  updateTasksBulk: (updates) => request('PATCH', '/tasks/bulk', { updates }),
  deleteTask: (id) => request('DELETE', `/tasks/${id}`),

  aiStatus: () => request('GET', '/ai/status'),
  aiRun: (mode, { mensagem, project_id }) => request('POST', `/ai/${mode}`, { mensagem, project_id, hoje: todayISO() }),
};
