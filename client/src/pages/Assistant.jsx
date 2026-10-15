import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { ErrorBox, PageHeader, Spinner } from '../components/ui.jsx';
import PlanResult from '../components/ai/PlanResult.jsx';
import ReplanResult from '../components/ai/ReplanResult.jsx';
import {
  CommunicationResult, OrganizeResult, RisksResult, SummaryResult,
} from '../components/ai/InfoResults.jsx';
import { api } from '../services/api.js';

const MODES = [
  {
    id: 'plano', label: 'Criar plano de ação', icon: 'spark', needsText: true,
    help: 'Descreva seu objetivo e a IA sugere etapas, tarefas, prioridades, prazos e riscos.',
    placeholder: 'Ex.: Quero organizar uma campanha para divulgar minha loja de roupas durante o próximo mês. Tenho pouco orçamento e trabalho sozinha.',
  },
  {
    id: 'organizar', label: 'Organizar tarefas', icon: 'check', needsText: false,
    help: 'A IA analisa prazos, prioridades e andamento e sugere em que ordem fazer suas tarefas.',
    placeholder: 'Opcional: conte algo que a IA deve considerar (ex.: "esta semana só tenho as manhãs livres").',
  },
  {
    id: 'riscos', label: 'Identificar riscos', icon: 'alert', needsText: false,
    help: 'A IA aponta prazos apertados, acúmulo de tarefas, dependências e informações que faltam.',
    placeholder: 'Opcional: alguma preocupação específica?',
  },
  {
    id: 'replanejar', label: 'Replanejar', icon: 'undo', needsText: true,
    help: 'Conte o que mudou ou o que atrasou e a IA sugere uma nova organização. Você aprova antes de aplicar.',
    placeholder: 'Ex.: Atrasei a sessão de fotos em uma semana porque o fornecedor não entregou as peças.',
  },
  {
    id: 'resumo', label: 'Resumir andamento', icon: 'dashboard', needsText: false,
    help: 'A IA gera um resumo com o que foi concluído, o que falta, atrasos e próximos passos.',
    placeholder: 'Opcional: para quem é o resumo ou o que destacar.',
  },
  {
    id: 'comunicacao', label: 'Textos de divulgação', icon: 'edit', needsText: true,
    help: 'A IA sugere mensagens, descrições de campanha e comunicados que você pode editar e copiar.',
    placeholder: 'Ex.: Preciso de uma mensagem para WhatsApp avisando os clientes da promoção de fim de ano.',
  },
];

export default function Assistant() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [projects, setProjects] = useState([]);
  const [mode, setMode] = useState('plano');
  const [projectId, setProjectId] = useState(params.get('projeto') || '');
  const [mensagem, setMensagem] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState(null);

  useEffect(() => {
    api.aiStatus().then(setStatus).catch((err) => setStatusError(err.message));
    api.listProjects().then((r) => setProjects(r.projects)).catch(() => {});
  }, []);

  const current = MODES.find((m) => m.id === mode);

  async function submit(e) {
    e.preventDefault();
    const text = mensagem.trim();
    if (current.needsText && text.length < 10) {
      setFieldError('Descreva o que você precisa com pelo menos 10 caracteres.');
      return;
    }
    setFieldError('');
    setError('');
    setResponse(null);
    setLoading(true);
    try {
      const res = await api.aiRun(mode, { mensagem: text, project_id: projectId || null });
      setResponse(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const discard = () => { setResponse(null); setError(''); };
  const unavailable = status && !status.available;

  // Função comum (não componente) para não recriar os resultados a cada digitação
  function renderResult() {
    const props = { result: response.result, project: response.project, onDiscard: discard };
    switch (response.mode) {
      case 'plano': return <PlanResult {...props} />;
      case 'replanejar': return <ReplanResult {...props} />;
      case 'organizar': return <OrganizeResult {...props} />;
      case 'riscos': return <RisksResult {...props} />;
      case 'resumo': return <SummaryResult {...props} />;
      case 'comunicacao': return <CommunicationResult {...props} />;
      default: return null;
    }
  }

  return (
    <div className="page">
      <PageHeader title="Assistente de IA" subtitle="Peça ajuda para planejar, organizar e comunicar seus projetos, em linguagem simples." />

      {statusError && <ErrorBox message={statusError} />}
      {unavailable && (
        <div className="alert alert-warn" role="alert">
          <Icon name="alert" />
          <div>
            <p><strong>O assistente de IA está indisponível no momento.</strong></p>
            <p className="small">A integração com a IA não foi configurada no servidor. Os demais recursos do sistema funcionam normalmente.</p>
          </div>
        </div>
      )}
      {status?.demo && (
        <div className="alert alert-info">
          <Icon name="alert" />
          <p><strong>Modo demonstração:</strong> as respostas são exemplos fixos e NÃO foram geradas por Inteligência Artificial.</p>
        </div>
      )}

      <form className="card ai-form" onSubmit={submit} noValidate>
        <fieldset className="mode-picker" disabled={loading}>
          <legend>O que você precisa?</legend>
          <div className="modes">
            {MODES.map((m) => (
              <label key={m.id} className={`mode ${mode === m.id ? 'active' : ''}`}>
                <input type="radio" name="mode" value={m.id} checked={mode === m.id} onChange={() => { setMode(m.id); setFieldError(''); }} />
                <Icon name={m.icon} />
                <span>{m.label}</span>
              </label>
            ))}
          </div>
          <p className="muted small mode-help">{current.help}</p>
        </fieldset>

        <div className="field">
          <label htmlFor="ai-project">Projeto</label>
          <select id="ai-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={loading}>
            <option value="">{mode === 'plano' || mode === 'comunicacao' ? 'Sem projeto (plano livre)' : 'Todas as minhas tarefas'}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>

        <div className={`field ${fieldError ? 'has-error' : ''}`}>
          <label htmlFor="ai-text">
            {current.needsText ? 'Descreva o que você precisa' : 'Observações (opcional)'}
            {current.needsText && <span className="req" aria-hidden="true"> *</span>}
          </label>
          <textarea
            id="ai-text"
            rows={4}
            maxLength={4000}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder={current.placeholder}
            disabled={loading}
          />
          {fieldError ? <small className="field-error" role="alert">{fieldError}</small> : (
            <small className="hint">Não inclua senhas, dados bancários ou dados pessoais de clientes. {mensagem.length}/4000</small>
          )}
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading || unavailable || !status}>
          <Icon name="spark" />{loading ? 'Analisando...' : 'Pedir análise da IA'}
        </button>
      </form>

      {loading && (
        <div className="card ai-loading" aria-live="polite">
          <Spinner label="A IA está analisando sua solicitação. Isso pode levar alguns segundos..." />
        </div>
      )}

      {error && <ErrorBox message={error} onRetry={() => submit({ preventDefault() {} })} />}

      {response && (
        <div className="ai-response">
          {response.demo && (
            <div className="alert alert-info"><Icon name="alert" /><p><strong>DEMONSTRAÇÃO</strong> — resposta de exemplo, não gerada por IA.</p></div>
          )}
          {response.dados_removidos && (
            <div className="alert alert-info"><Icon name="alert" /><p className="small">Para sua segurança, dados como e-mails, telefones, documentos ou senhas foram removidos do seu texto antes do envio à IA.</p></div>
          )}
          <p className="muted small">
            {response.project ? <>Análise do projeto <strong>{response.project.nome}</strong>. </> : null}
            Sugestões geradas por IA podem conter erros: revise antes de usar.
          </p>
          <div key={response.gerado_em}>{renderResult()}</div>
        </div>
      )}
    </div>
  );
}
