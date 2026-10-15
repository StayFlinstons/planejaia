/** Data de hoje (AAAA-MM-DD) no fuso do navegador. */
export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDaysISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** "2026-10-15" -> "15/10/2026" (sem conversão de fuso). */
export function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateTime(isoTs) {
  if (!isoTs) return '—';
  return new Date(isoTs).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Diferença em dias entre duas datas AAAA-MM-DD. */
export function daysBetween(fromIso, toIso) {
  const a = new Date(`${fromIso}T12:00:00`);
  const b = new Date(`${toIso}T12:00:00`);
  return Math.round((b - a) / 86400000);
}

export function isOverdue(task, hoje = todayISO()) {
  return Boolean(task?.prazo) && task.prazo < hoje && task.status !== 'concluida';
}

/** Texto amigável para o prazo: "vence hoje", "em 3 dias", "atrasada há 2 dias". */
export function deadlineLabel(task, hoje = todayISO()) {
  if (!task?.prazo) return 'Sem prazo';
  if (task.status === 'concluida') return formatDate(task.prazo);
  const diff = daysBetween(hoje, task.prazo);
  if (diff < 0) return `Atrasada há ${-diff} dia${diff === -1 ? '' : 's'}`;
  if (diff === 0) return 'Vence hoje';
  if (diff === 1) return 'Vence amanhã';
  if (diff <= 7) return `Em ${diff} dias`;
  return formatDate(task.prazo);
}

export function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—';
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
