// Respostas de DEMONSTRAÇÃO, usadas somente quando AI_DEMO_MODE=true e não há chave da IA.
// O front-end exibe um aviso claro de que não são respostas reais da IA.

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function demoResponse(mode, { hoje, refMap }) {
  const refs = [...refMap.keys()];
  const abertas = refs.filter((r) => refMap.get(r).status !== 'concluida');

  switch (mode) {
    case 'plano':
      return {
        objetivo: '[Demonstração] Objetivo de exemplo',
        resumo: 'Este é um plano de demonstração, gerado sem IA, apenas para mostrar o funcionamento da tela.',
        etapas: [
          { nome: 'Preparação', descricao: 'Definir o que será feito.' },
          { nome: 'Execução', descricao: 'Realizar as atividades.' },
        ],
        tarefas: [
          { titulo: 'Definir o público-alvo', descricao: 'Exemplo de tarefa.', etapa: 'Preparação', ordem: 1, prioridade: 'alta', prazo_sugerido: addDays(hoje, 3), prazo_e_estimativa: true },
          { titulo: 'Preparar o material', descricao: 'Exemplo de tarefa.', etapa: 'Execução', ordem: 2, prioridade: 'media', prazo_sugerido: addDays(hoje, 7), prazo_e_estimativa: true },
          { titulo: 'Avaliar os resultados', descricao: 'Exemplo de tarefa.', etapa: 'Execução', ordem: 3, prioridade: 'baixa', prazo_sugerido: null, prazo_e_estimativa: true },
        ],
        riscos: ['Exemplo de risco de demonstração.'],
        recomendacoes_acompanhamento: ['Exemplo de recomendação de demonstração.'],
        informacoes_faltantes: ['Esta resposta não foi gerada por IA.'],
        observacao_prazos: 'Prazos fictícios de demonstração.',
      };
    case 'organizar':
      return {
        resumo: '[Demonstração] Ordem de exemplo baseada apenas na lista atual.',
        sequencia: abertas.map((r, i) => ({ tarefa_ref: r, motivo: 'Exemplo de motivo.', depende_de: [], foco_imediato: i === 0 })),
        recomendacoes: ['Resposta de demonstração, não gerada por IA.'],
      };
    case 'riscos':
      return {
        resumo: '[Demonstração] Exemplo de análise de riscos.',
        riscos: [{ tipo: 'outro', descricao: 'Exemplo de risco de demonstração.', gravidade: 'baixa', tarefas_ref: abertas.slice(0, 1), sugestao: 'Exemplo de sugestão.' }],
      };
    case 'replanejar':
      return {
        resumo: '[Demonstração] Exemplo de replanejamento.',
        alteracoes: abertas.slice(0, 2).map((r) => ({ tarefa_ref: r, novo_prazo: addDays(hoje, 5), nova_prioridade: null, motivo: 'Exemplo de motivo.' })),
        novas_tarefas: [],
        recomendacoes: ['Resposta de demonstração, não gerada por IA.'],
      };
    case 'resumo':
      return {
        resumo: '[Demonstração] Resumo de exemplo.',
        concluidas: [], pendentes: [], atrasos: [], dificuldades: [],
        proximos_passos: ['Configure a chave da IA para obter resumos reais.'],
      };
    case 'comunicacao':
    default:
      return {
        textos: [{ titulo: '[Demonstração] Texto de exemplo', canal: 'WhatsApp', texto: 'Olá! Este é um texto de demonstração, não gerado por IA. [preço] [endereço]' }],
        dicas: ['Configure a chave da IA para obter textos reais.'],
      };
  }
}
