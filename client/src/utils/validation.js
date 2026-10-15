// Validação no navegador (o servidor valida de novo, com as mesmas regras).

export function validateProjectForm(f) {
  const e = {};
  if (!f.nome?.trim()) e.nome = 'Informe o nome do projeto.';
  else if (f.nome.trim().length > 120) e.nome = 'Use no máximo 120 caracteres.';
  if (!f.data_inicio) e.data_inicio = 'Informe a data de início.';
  if (!f.prazo_final) e.prazo_final = 'Informe o prazo final.';
  if (f.data_inicio && f.prazo_final && f.prazo_final < f.data_inicio) {
    e.prazo_final = 'O prazo final não pode ser anterior à data de início.';
  }
  if (f.orcamento_previsto !== '' && f.orcamento_previsto != null) {
    const n = Number(String(f.orcamento_previsto).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) e.orcamento_previsto = 'Informe um valor válido (ex.: 1500,00).';
  }
  if ((f.descricao || '').length > 2000) e.descricao = 'Use no máximo 2000 caracteres.';
  if ((f.objetivo || '').length > 1000) e.objetivo = 'Use no máximo 1000 caracteres.';
  return e;
}

export function validateTaskForm(f) {
  const e = {};
  if (!f.titulo?.trim()) e.titulo = 'Informe o título da tarefa.';
  else if (f.titulo.trim().length > 200) e.titulo = 'Use no máximo 200 caracteres.';
  if ((f.descricao || '').length > 2000) e.descricao = 'Use no máximo 2000 caracteres.';
  return e;
}

export const hasErrors = (e) => Object.keys(e).length > 0;
