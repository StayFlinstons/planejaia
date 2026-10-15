// Resultados somente-leitura (Funções B, C, E) e textos editáveis (Função F).
import { useState } from 'react';
import Icon from '../Icon.jsx';
import { useToast } from '../../context/ToastContext.jsx';

async function copyText(text, toast) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Texto copiado.');
  } catch {
    toast.error('Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.');
  }
}

function Footer({ onDiscard, children }) {
  return (
    <div className="ai-actions">
      <button type="button" className="btn btn-ghost" onClick={onDiscard}>Descartar</button>
      {children}
    </div>
  );
}

export function OrganizeResult({ result, onDiscard }) {
  return (
    <div className="card ai-result">
      <h2>Ordem sugerida para suas tarefas</h2>
      {result.resumo && <p>{result.resumo}</p>}
      {result.sequencia.length === 0 ? <p className="muted">Não há tarefas em aberto para organizar.</p> : (
        <ol className="sequence">
          {result.sequencia.map((s) => (
            <li key={s.tarefa.id} className={s.foco_imediato ? 'focus' : ''}>
              <div className="sequence-head">
                <strong>{s.tarefa.titulo}</strong>
                {s.foco_imediato && <span className="badge prio-urgente">Foco agora</span>}
              </div>
              {s.motivo && <p className="small">{s.motivo}</p>}
              {s.depende_de.length > 0 && (
                <p className="small muted">Depende de: {s.depende_de.map((d) => d.titulo).join(', ')}</p>
              )}
            </li>
          ))}
        </ol>
      )}
      {result.recomendacoes.length > 0 && (
        <div className="ai-block"><h3>Recomendações</h3><ul>{result.recomendacoes.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
      )}
      <p className="muted small">Estas são sugestões. Nenhuma tarefa foi alterada.</p>
      <Footer onDiscard={onDiscard} />
    </div>
  );
}

const TIPO_RISCO = {
  prazo_apertado: 'Prazo apertado',
  concentracao: 'Muitas tarefas no mesmo período',
  etapa_nao_planejada: 'Etapa não planejada',
  dependencia: 'Dependência entre atividades',
  falta_informacao: 'Falta de informação',
  outro: 'Outro',
};
const GRAVIDADE = { baixa: 'Atenção baixa', media: 'Atenção média', alta: 'Atenção alta' };

export function RisksResult({ result, onDiscard }) {
  return (
    <div className="card ai-result">
      <h2>Possíveis riscos e dificuldades</h2>
      {result.resumo && <p>{result.resumo}</p>}
      <p className="muted small">Os pontos abaixo são possibilidades a observar, não previsões garantidas.</p>
      {result.riscos.length === 0 ? <p>Nenhum risco relevante foi identificado.</p> : (
        <ul className="risks">
          {result.riscos.map((r, i) => (
            <li key={i} className={`risk risk-${r.gravidade}`}>
              <div className="risk-head">
                <strong>{TIPO_RISCO[r.tipo]}</strong>
                <span className={`badge sev-${r.gravidade}`}>{GRAVIDADE[r.gravidade]}</span>
              </div>
              <p>{r.descricao}</p>
              {r.tarefas.length > 0 && <p className="small muted">Tarefas relacionadas: {r.tarefas.map((t) => t.titulo).join(', ')}</p>}
              {r.sugestao && <p className="small"><strong>Sugestão:</strong> {r.sugestao}</p>}
            </li>
          ))}
        </ul>
      )}
      <Footer onDiscard={onDiscard} />
    </div>
  );
}

export function SummaryResult({ result, project, onDiscard }) {
  const toast = useToast();
  const sections = [
    ['Atividades concluídas', result.concluidas],
    ['Atividades pendentes', result.pendentes],
    ['Principais atrasos', result.atrasos],
    ['Dificuldades identificadas', result.dificuldades],
    ['Próximos passos recomendados', result.proximos_passos],
  ];
  const asText = [
    `Resumo do andamento${project ? ` — ${project.nome}` : ''}`,
    '',
    result.resumo,
    ...sections.flatMap(([t, items]) => (items.length ? ['', `${t}:`, ...items.map((i) => `• ${i}`)] : [])),
  ].join('\n');

  return (
    <div className="card ai-result">
      <h2>Resumo do andamento</h2>
      {result.resumo && <p>{result.resumo}</p>}
      <div className="summary-grid">
        {sections.map(([title, items]) => (
          <div key={title} className="ai-block">
            <h3>{title}</h3>
            {items.length ? <ul>{items.map((it, i) => <li key={i}>{it}</li>)}</ul> : <p className="muted small">Nada a destacar.</p>}
          </div>
        ))}
      </div>
      <Footer onDiscard={onDiscard}>
        <button type="button" className="btn btn-primary" onClick={() => copyText(asText, toast)}><Icon name="copy" />Copiar resumo</button>
      </Footer>
    </div>
  );
}

export function CommunicationResult({ result, onDiscard }) {
  const toast = useToast();
  const [texts, setTexts] = useState(() => result.textos.map((t) => t.texto));
  return (
    <div className="card ai-result">
      <h2>Sugestões de textos</h2>
      <p className="muted small">Edite à vontade antes de copiar. Substitua os campos entre colchetes, como [preço], pelas suas informações.</p>
      {result.textos.map((t, i) => (
        <div key={i} className="ai-block comm">
          <div className="comm-head">
            <h3>{t.titulo}</h3>
            {t.canal && <span className="badge badge-soft">{t.canal}</span>}
          </div>
          <textarea rows={Math.min(12, Math.max(4, texts[i].split('\n').length + 1))} value={texts[i]} onChange={(e) => setTexts((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Texto: ${t.titulo}`} />
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => copyText(texts[i], toast)}><Icon name="copy" />Copiar texto</button>
        </div>
      ))}
      {result.dicas.length > 0 && (
        <div className="ai-block"><h3>Dicas</h3><ul>{result.dicas.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
      )}
      <Footer onDiscard={onDiscard} />
    </div>
  );
}
