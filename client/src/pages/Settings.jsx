import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { ErrorBox, Field, PageHeader } from '../components/ui.jsx';
import { authErrorMessage, useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatDateTime } from '../utils/dates.js';

export default function Settings() {
  const { user, updateUser, signOut } = useAuth();
  const toast = useToast();

  const [nome, setNome] = useState(user?.user_metadata?.nome || '');
  const [nomeError, setNomeError] = useState('');
  const [savingNome, setSavingNome] = useState(false);

  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [pwErrors, setPwErrors] = useState({});
  const [pwError, setPwError] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  async function saveNome(e) {
    e.preventDefault();
    if (!nome.trim()) return setNomeError('Informe seu nome.');
    setNomeError('');
    setSavingNome(true);
    const { error } = await updateUser({ data: { nome: nome.trim() } });
    setSavingNome(false);
    if (error) toast.error(authErrorMessage(error));
    else toast.success('Nome atualizado.');
  }

  async function savePassword(e) {
    e.preventDefault();
    const v = {};
    if (senha.length < 8) v.senha = 'A senha deve ter pelo menos 8 caracteres.';
    else if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) v.senha = 'Use letras e números na senha.';
    if (confirmar !== senha) v.confirmar = 'As senhas não conferem.';
    setPwErrors(v);
    if (Object.keys(v).length) return;
    setSavingPw(true);
    setPwError('');
    const { error } = await updateUser({ password: senha });
    setSavingPw(false);
    if (error) return setPwError(authErrorMessage(error));
    setSenha('');
    setConfirmar('');
    toast.success('Senha alterada com sucesso.');
  }

  return (
    <div className="page">
      <PageHeader title="Configurações" subtitle="Dados da sua conta e informações sobre privacidade." />

      <div className="grid-2">
        <section className="card">
          <h2>Minha conta</h2>
          <dl className="details">
            <div><dt>E-mail</dt><dd>{user?.email}</dd></div>
            <div><dt>Conta criada em</dt><dd>{formatDateTime(user?.created_at)}</dd></div>
            <div><dt>Último acesso</dt><dd>{formatDateTime(user?.last_sign_in_at)}</dd></div>
          </dl>
          <form onSubmit={saveNome} noValidate className="form-grid">
            <Field label="Nome" error={nomeError}>
              {(id) => <input id={id} value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} />}
            </Field>
            <button type="submit" className="btn btn-primary" disabled={savingNome}>{savingNome ? 'Salvando...' : 'Salvar nome'}</button>
          </form>
        </section>

        <section className="card">
          <h2>Alterar senha</h2>
          <form onSubmit={savePassword} noValidate className="form-grid">
            <ErrorBox message={pwError} />
            <Field label="Nova senha" error={pwErrors.senha} hint="Mínimo de 8 caracteres, com letras e números.">
              {(id) => <input id={id} type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />}
            </Field>
            <Field label="Confirmar nova senha" error={pwErrors.confirmar}>
              {(id) => <input id={id} type="password" autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />}
            </Field>
            <button type="submit" className="btn btn-primary" disabled={savingPw}>{savingPw ? 'Salvando...' : 'Alterar senha'}</button>
          </form>
        </section>
      </div>

      <section className="card">
        <h2>Privacidade e uso da IA</h2>
        <ul className="privacy">
          <li>Seus projetos e tarefas ficam guardados no banco de dados com proteção por conta: <strong>somente você</strong> tem acesso a eles.</li>
          <li>Sua senha é gerenciada pelo serviço de autenticação (Supabase Auth) e nunca é armazenada pelo PlanejaIA nem enviada à IA.</li>
          <li>Quando você usa o assistente, são enviados ao provedor de IA (Google Gemini) apenas o texto do seu pedido e os dados do projeto e das tarefas necessários para a análise (títulos, descrições, prazos, prioridades e status). Seu e-mail e seu nome não são enviados.</li>
          <li>Antes do envio, o sistema tenta remover do seu texto e-mails, telefones, CPF/CNPJ, números de cartão e senhas. Mesmo assim, evite escrever dados pessoais de clientes ou informações bancárias.</li>
          <li>A IA apenas sugere. Nada é cadastrado, alterado ou excluído sem a sua confirmação.</li>
          <li>As sugestões da IA podem conter erros. Revise sempre antes de usar.</li>
        </ul>
      </section>

      <section className="card">
        <h2>Sessão</h2>
        <p className="muted small">Encerre a sessão ao usar um computador compartilhado.</p>
        <button type="button" className="btn btn-danger" onClick={signOut}><Icon name="logout" />Sair da conta</button>
      </section>
    </div>
  );
}
