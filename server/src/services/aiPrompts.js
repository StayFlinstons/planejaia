// Monta as instruções e o contexto enviados à IA.
// Apenas os dados necessários são enviados: nada de e-mail, senha ou identificadores internos.

const PRIORIDADE = { baixa: 'baixa', media: 'média', alta: 'alta', urgente: 'urgente' };
const STATUS_TAREFA = { pendente: 'pendente', em_andamento: 'em andamento', concluida: 'concluída' };
const STATUS_PROJETO = {
  planejamento: 'planejamento', em_andamento: 'em andamento', concluido: 'concluído', cancelado: 'cancelado',
};

/**
 * Remove dados pessoais/sensíveis óbvios do texto livre antes de enviá-lo à IA:
 * e-mails, CPF/CNPJ, números de cartão, telefones e senhas declaradas.
 */
export function redactSensitive(input) {
  if (!input) return '';
  return String(input)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[e-mail removido]')
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '[documento removido]') // CNPJ
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[documento removido]') // CPF
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[número removido]') // cartões e contas longas
    .replace(/(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, '[telefone removido]')
    .replace(/\b(senha|password|pin)\s*[:=é]?\s*\S+/gi, '$1: [removida]');
}

/**
 * Converte projeto/tarefas em texto para a IA. Cada tarefa recebe uma referência
 * curta (T1, T2...) e o servidor guarda a correspondência com o id real.
 */
export function buildContext({ project, tasks = [], hoje }) {
  const refMap = new Map(); // "T1" -> tarefa
  const lines = [`Data de hoje: ${hoje}`];

  if (project) {
    lines.push(
      '',
      'PROJETO:',
      `- Nome: ${project.nome}`,
      project.descricao ? `- Descrição: ${project.descricao}` : null,
      project.objetivo ? `- Objetivo: ${project.objetivo}` : null,
      `- Período: de ${project.data_inicio} até ${project.prazo_final}`,
      `- Status: ${STATUS_PROJETO[project.status] || project.status}`,
      project.orcamento_previsto != null ? `- Orçamento previsto: R$ ${project.orcamento_previsto}` : null,
    );
  }

  if (tasks.length) {
    lines.push('', `TAREFAS CADASTRADAS (${tasks.length}):`);
    tasks.forEach((t, i) => {
      const ref = `T${i + 1}`;
      refMap.set(ref, t);
      const atrasada = t.prazo && t.prazo < hoje && t.status !== 'concluida' ? ' [ATRASADA]' : '';
      const projeto = !project && t.project?.nome ? ` | projeto: ${t.project.nome}` : '';
      lines.push(
        `- ${ref}: "${t.titulo}" | status: ${STATUS_TAREFA[t.status] || t.status} | prioridade: ${PRIORIDADE[t.prioridade] || t.prioridade} | prazo: ${t.prazo || 'sem prazo'}${atrasada}${projeto}`
        + (t.descricao ? `\n    descrição: ${t.descricao.slice(0, 300)}` : ''),
      );
    });
  } else {
    lines.push('', 'TAREFAS CADASTRADAS: nenhuma.');
  }

  return { text: lines.filter((l) => l !== null).join('\n'), refMap };
}

export const SYSTEM_PROMPT = `Você é o assistente de planejamento do PlanejaIA, um sistema de gestão de projetos para pequenos empreendedores brasileiros.
Regras:
- Responda SEMPRE em português do Brasil, com linguagem simples, sem jargões de gerenciamento de projetos.
- Baseie-se apenas nas informações fornecidas. Não invente dados, números, clientes ou resultados.
- Quando faltarem informações para definir prazos, marque o prazo como estimativa (prazo_e_estimativa = true) ou deixe-o nulo, e liste o que falta em "informacoes_faltantes".
- Datas sempre no formato AAAA-MM-DD e nunca anteriores à data de hoje.
- Riscos e dificuldades são possibilidades a observar, nunca previsões garantidas.
- Ao citar tarefas existentes, use somente as referências fornecidas (T1, T2...).
- Seja prático: tarefas curtas, claras e executáveis por uma pessoa.`;

const INSTRUCOES = {
  plano: (msg) => `FUNÇÃO: criar um plano de ação.
Pedido do usuário: """${msg}"""
Gere: objetivo principal, um resumo curto, etapas necessárias, lista de tarefas (com descrição, etapa, ordem de execução, prioridade e prazo sugerido), possíveis riscos, recomendações para acompanhar o resultado e informações que faltam. Entre 4 e 15 tarefas. Não repita tarefas que já estão cadastradas. Em "observacao_prazos", explique em uma frase como os prazos foram estimados.`,

  organizar: (msg) => `FUNÇÃO: organizar as tarefas existentes.
${msg ? `Observação do usuário: """${msg}"""\n` : ''}Indique em que ordem as tarefas NÃO concluídas devem ser feitas, considerando prazos, prioridades, status e dependências entre elas. Para cada uma explique o motivo em uma frase, indique de quais tarefas ela depende (referências T…) e marque foco_imediato = true nas que merecem atenção agora (no máximo 3). Inclua recomendações gerais.`,

  riscos: (msg) => `FUNÇÃO: identificar riscos e dificuldades.
${msg ? `Observação do usuário: """${msg}"""\n` : ''}Aponte possíveis problemas: prazos muito próximos ou já vencidos, muitas tarefas concentradas no mesmo período, etapas importantes ainda não planejadas, dependências entre atividades e falta de informações para concluir tarefas. Para cada risco, indique a gravidade, as tarefas relacionadas e uma sugestão prática. Se não houver riscos relevantes, diga isso no resumo e devolva poucos itens.`,

  replanejar: (msg) => `FUNÇÃO: replanejar atividades.
O que mudou, segundo o usuário: """${msg}"""
Sugira uma nova organização: alterações de prazo e/ou prioridade nas tarefas existentes (só inclua as que realmente precisam mudar, sem tarefas concluídas) e, se necessário, novas tarefas. Explique o motivo de cada alteração. Não altere status. Novos prazos não podem ser anteriores a hoje.`,

  resumo: (msg) => `FUNÇÃO: resumir o andamento.
${msg ? `Foco pedido pelo usuário: """${msg}"""\n` : ''}Produza um resumo baseado SOMENTE nas tarefas listadas: atividades concluídas, pendentes, principais atrasos, dificuldades identificadas e próximos passos recomendados. Use os títulos das tarefas (não as referências T…). Se não houver dados suficientes, diga isso claramente.`,

  comunicacao: (msg) => `FUNÇÃO: auxiliar na comunicação.
Pedido do usuário: """${msg}"""
Sugira de 2 a 4 textos prontos (por exemplo: mensagem de divulgação, descrição de campanha, comunicado, lista de ações de divulgação), cada um com título, canal sugerido (Instagram, WhatsApp, e-mail, cartaz etc.) e o texto completo. Não invente preços, descontos, endereços ou contatos que não foram informados: use marcadores como [preço] ou [endereço]. Inclua dicas curtas de uso.`,
};

export function buildPrompt(mode, mensagem, contextText) {
  return `${INSTRUCOES[mode](mensagem)}\n\nCONTEXTO DO SISTEMA:\n${contextText}`;
}
