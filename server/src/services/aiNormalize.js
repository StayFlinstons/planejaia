// Valida e "limpa" a resposta da IA antes de devolvê-la ao front-end.
// Nada aqui grava no banco: o usuário sempre revisa e confirma depois.
import { isValidDate, TASK_PRIORITY } from '../utils/validation.js';
import { aiError } from './gemini.js';

const str = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v, max = 12, len = 500) => (Array.isArray(v) ? v.map((x) => str(x, len)).filter(Boolean).slice(0, max) : []);

export function normalizePriority(value) {
  const v = str(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (TASK_PRIORITY.includes(v)) return v;
  if (v.startsWith('urg') || v === 'critica') return 'urgente';
  if (v.startsWith('alt')) return 'alta';
  if (v.startsWith('baix')) return 'baixa';
  return 'media';
}

/** Aceita somente datas válidas e não anteriores a hoje. */
export function normalizeFutureDate(value, hoje) {
  if (!isValidDate(value)) return null;
  return value < hoje ? null : value;
}

function normalizeSuggestedTasks(items, hoje, max = 30) {
  if (!Array.isArray(items)) return [];
  return items
    .map((t, i) => {
      const prazo = normalizeFutureDate(t?.prazo_sugerido, hoje);
      return {
        titulo: str(t?.titulo, 200),
        descricao: str(t?.descricao, 2000),
        etapa: str(t?.etapa, 120),
        ordem: Number.isInteger(t?.ordem) ? t.ordem : i + 1,
        prioridade: normalizePriority(t?.prioridade),
        prazo_sugerido: prazo,
        // sem data => obrigatoriamente uma estimativa a definir
        prazo_e_estimativa: prazo ? Boolean(t?.prazo_e_estimativa) : true,
      };
    })
    .filter((t) => t.titulo)
    .sort((a, b) => a.ordem - b.ordem)
    .slice(0, max)
    .map((t, i) => ({ ...t, ordem: i + 1 }));
}

/** Converte referências T1, T2… em {id, titulo}; descarta as desconhecidas. */
function resolveRef(ref, refMap) {
  const task = refMap.get(str(ref, 10).toUpperCase());
  return task ? { id: task.id, titulo: task.titulo } : null;
}

function resolveRefs(refs, refMap) {
  if (!Array.isArray(refs)) return [];
  const seen = new Set();
  return refs.map((r) => resolveRef(r, refMap)).filter((t) => t && !seen.has(t.id) && seen.add(t.id));
}

const NORMALIZERS = {
  plano(raw, { hoje }) {
    const tarefas = normalizeSuggestedTasks(raw.tarefas, hoje);
    if (tarefas.length === 0) throw aiError('invalid_response');
    return {
      objetivo: str(raw.objetivo, 1000),
      resumo: str(raw.resumo),
      etapas: Array.isArray(raw.etapas)
        ? raw.etapas.map((e) => ({ nome: str(e?.nome, 120), descricao: str(e?.descricao, 600) })).filter((e) => e.nome).slice(0, 10)
        : [],
      tarefas,
      riscos: list(raw.riscos),
      recomendacoes_acompanhamento: list(raw.recomendacoes_acompanhamento),
      informacoes_faltantes: list(raw.informacoes_faltantes),
      observacao_prazos: str(raw.observacao_prazos, 600),
    };
  },

  organizar(raw, { refMap }) {
    const seen = new Set();
    const sequencia = (Array.isArray(raw.sequencia) ? raw.sequencia : [])
      .map((s) => {
        const tarefa = resolveRef(s?.tarefa_ref, refMap);
        if (!tarefa || seen.has(tarefa.id)) return null;
        seen.add(tarefa.id);
        return {
          tarefa,
          motivo: str(s?.motivo, 500),
          depende_de: resolveRefs(s?.depende_de, refMap).filter((d) => d.id !== tarefa.id),
          foco_imediato: Boolean(s?.foco_imediato),
        };
      })
      .filter(Boolean)
      .map((s, i) => ({ ...s, posicao: i + 1 }));
    return { resumo: str(raw.resumo), sequencia, recomendacoes: list(raw.recomendacoes) };
  },

  riscos(raw, { refMap }) {
    const tipos = ['prazo_apertado', 'concentracao', 'etapa_nao_planejada', 'dependencia', 'falta_informacao', 'outro'];
    const riscos = (Array.isArray(raw.riscos) ? raw.riscos : [])
      .map((r) => ({
        tipo: tipos.includes(r?.tipo) ? r.tipo : 'outro',
        descricao: str(r?.descricao, 800),
        gravidade: ['baixa', 'media', 'alta'].includes(r?.gravidade) ? r.gravidade : 'media',
        tarefas: resolveRefs(r?.tarefas_ref, refMap),
        sugestao: str(r?.sugestao, 800),
      }))
      .filter((r) => r.descricao)
      .slice(0, 15);
    return { resumo: str(raw.resumo), riscos };
  },

  replanejar(raw, { refMap, hoje }) {
    const seen = new Set();
    const alteracoes = (Array.isArray(raw.alteracoes) ? raw.alteracoes : [])
      .map((a) => {
        const task = refMap.get(str(a?.tarefa_ref, 10).toUpperCase());
        if (!task || task.status === 'concluida' || seen.has(task.id)) return null;
        seen.add(task.id);
        const novoPrazo = normalizeFutureDate(a?.novo_prazo, hoje);
        const novaPrioridade = a?.nova_prioridade ? normalizePriority(a.nova_prioridade) : null;
        const mudancas = {};
        if (novoPrazo && novoPrazo !== task.prazo) mudancas.prazo = novoPrazo;
        if (novaPrioridade && novaPrioridade !== task.prioridade) mudancas.prioridade = novaPrioridade;
        if (Object.keys(mudancas).length === 0) return null; // nada muda de fato
        return {
          tarefa: { id: task.id, titulo: task.titulo },
          atual: { prazo: task.prazo, prioridade: task.prioridade },
          proposto: mudancas,
          motivo: str(a?.motivo, 500),
        };
      })
      .filter(Boolean);
    return {
      resumo: str(raw.resumo),
      alteracoes,
      novas_tarefas: normalizeSuggestedTasks(raw.novas_tarefas, hoje, 15),
      recomendacoes: list(raw.recomendacoes),
    };
  },

  resumo(raw) {
    return {
      resumo: str(raw.resumo, 3000),
      concluidas: list(raw.concluidas, 30),
      pendentes: list(raw.pendentes, 30),
      atrasos: list(raw.atrasos, 30),
      dificuldades: list(raw.dificuldades, 15),
      proximos_passos: list(raw.proximos_passos, 15),
    };
  },

  comunicacao(raw) {
    const textos = (Array.isArray(raw.textos) ? raw.textos : [])
      .map((t) => ({ titulo: str(t?.titulo, 150), canal: str(t?.canal, 60), texto: str(t?.texto, 4000) }))
      .filter((t) => t.texto)
      .slice(0, 6);
    if (textos.length === 0) throw aiError('invalid_response');
    return { textos, dicas: list(raw.dicas) };
  },
};

export function normalizeAiResult(mode, raw, ctx) {
  const fn = NORMALIZERS[mode];
  if (!fn || !raw || typeof raw !== 'object') throw aiError('invalid_response');
  return fn(raw, ctx);
}
