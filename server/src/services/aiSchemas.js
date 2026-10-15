// Estruturas de resposta exigidas da IA (formato "responseSchema" do Gemini).

const S = { type: 'STRING' };
const SN = { type: 'STRING', nullable: true };
const LIST = { type: 'ARRAY', items: S };
const PRIORIDADE = { type: 'STRING', enum: ['baixa', 'media', 'alta', 'urgente'] };

const TAREFA_SUGERIDA = {
  type: 'OBJECT',
  properties: {
    titulo: S,
    descricao: S,
    etapa: S,
    ordem: { type: 'INTEGER' },
    prioridade: PRIORIDADE,
    prazo_sugerido: { ...SN, description: 'Data AAAA-MM-DD ou null' },
    prazo_e_estimativa: { type: 'BOOLEAN' },
  },
  required: ['titulo', 'descricao', 'ordem', 'prioridade', 'prazo_e_estimativa'],
};

export const SCHEMAS = {
  plano: {
    type: 'OBJECT',
    properties: {
      objetivo: S,
      resumo: S,
      etapas: {
        type: 'ARRAY',
        items: { type: 'OBJECT', properties: { nome: S, descricao: S }, required: ['nome', 'descricao'] },
      },
      tarefas: { type: 'ARRAY', items: TAREFA_SUGERIDA },
      riscos: LIST,
      recomendacoes_acompanhamento: LIST,
      informacoes_faltantes: LIST,
      observacao_prazos: S,
    },
    required: ['objetivo', 'resumo', 'etapas', 'tarefas', 'riscos', 'recomendacoes_acompanhamento', 'informacoes_faltantes'],
  },

  organizar: {
    type: 'OBJECT',
    properties: {
      resumo: S,
      sequencia: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            tarefa_ref: S,
            motivo: S,
            depende_de: LIST,
            foco_imediato: { type: 'BOOLEAN' },
          },
          required: ['tarefa_ref', 'motivo', 'depende_de', 'foco_imediato'],
        },
      },
      recomendacoes: LIST,
    },
    required: ['resumo', 'sequencia', 'recomendacoes'],
  },

  riscos: {
    type: 'OBJECT',
    properties: {
      resumo: S,
      riscos: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            tipo: {
              type: 'STRING',
              enum: ['prazo_apertado', 'concentracao', 'etapa_nao_planejada', 'dependencia', 'falta_informacao', 'outro'],
            },
            descricao: S,
            gravidade: { type: 'STRING', enum: ['baixa', 'media', 'alta'] },
            tarefas_ref: LIST,
            sugestao: S,
          },
          required: ['tipo', 'descricao', 'gravidade', 'tarefas_ref', 'sugestao'],
        },
      },
    },
    required: ['resumo', 'riscos'],
  },

  replanejar: {
    type: 'OBJECT',
    properties: {
      resumo: S,
      alteracoes: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            tarefa_ref: S,
            novo_prazo: { ...SN, description: 'Data AAAA-MM-DD ou null para manter' },
            nova_prioridade: { ...PRIORIDADE, nullable: true },
            motivo: S,
          },
          required: ['tarefa_ref', 'motivo'],
        },
      },
      novas_tarefas: { type: 'ARRAY', items: TAREFA_SUGERIDA },
      recomendacoes: LIST,
    },
    required: ['resumo', 'alteracoes', 'novas_tarefas', 'recomendacoes'],
  },

  resumo: {
    type: 'OBJECT',
    properties: {
      resumo: S,
      concluidas: LIST,
      pendentes: LIST,
      atrasos: LIST,
      dificuldades: LIST,
      proximos_passos: LIST,
    },
    required: ['resumo', 'concluidas', 'pendentes', 'atrasos', 'dificuldades', 'proximos_passos'],
  },

  comunicacao: {
    type: 'OBJECT',
    properties: {
      textos: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { titulo: S, canal: S, texto: S },
          required: ['titulo', 'canal', 'texto'],
        },
      },
      dicas: LIST,
    },
    required: ['textos', 'dicas'],
  },
};
