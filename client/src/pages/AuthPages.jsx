// Telas de acesso: entrar, criar conta, recuperar e redefinir senha.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Layout.jsx';
import { ErrorBox, Field } from '../components/ui.jsx';
import { authErrorMessage, useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo"><Logo /></div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
        {children}
        {footer && <div className="auth-footer">{footer}</div>}
      </div>
      <p className="auth-tagline">Organize projetos e tarefas com ajuda de Inteligência Artificial.</p>
    </div>
  );
}

function checkPassword(senha) {
  if (senha.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return 'Use letras e números na senha.';
  return null;
}

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const v = {};
    if (!EMAIL_RE.test(email.trim())) v.email = 'Informe um e-mail válido.';
    if (!senha) v.senha = 'Informe sua senha.';
    setErrors(v);
    if (Object.keys(v).length) return;
    setLoading(true);
    setError('');
    const { error: err } = await signIn(email.trim(), senha);
    setLoading(false);
    if (err) setError(authErrorMessage(err));
    else navigate('/', { replace: true });
  }

  return (
    <AuthCard
      title="Entrar"
      subtitle="Acesse seus projetos e tarefas."
      footer={<>Ainda não tem conta? <Link to="/cadastro">Criar conta</Link></>}
    >
      <form onSubmit={submit} noValidate className="form-grid">
        <ErrorBox message={error} />
        <Field label="E-mail" error={errors.email}>
          {(id) => <input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Senha" error={errors.senha}>
          {(id) => <input id={id} type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />}
        </Field>
        <div className="auth-links"><Link to="/recuperar-senha">Esqueci minha senha</Link></div>
        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </AuthCard>
  );
}

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: '', email: '', senha: '', confirmar: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const v = {};
    if (!form.nome.trim()) v.nome = 'Informe seu nome.';
    if (!EMAIL_RE.test(form.email.trim())) v.email = 'Informe um e-mail válido.';
    const pw = checkPassword(form.senha);
    if (pw) v.senha = pw;
    if (form.confirmar !== form.senha) v.confirmar = 'As senhas não conferem.';
    setErrors(v);
    if (Object.keys(v).length) return;
    setLoading(true);
    setError('');
    const { data, error: err } = await signUp(form.email.trim(), form.senha, form.nome.trim());
    setLoading(false);
    if (err) return setError(authErrorMessage(err));
    if (data.session) navigate('/', { replace: true });
    else setSent(true); // confirmação por e-mail ativada no Supabase
  }

  if (sent) {
    return (
      <AuthCard title="Confirme seu e-mail" footer={<Link to="/entrar">Voltar para entrar</Link>}>
        <p>Enviamos um link de confirmação para <strong>{form.email}</strong>. Abra o e-mail e clique no link para ativar sua conta.</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Criar conta"
      subtitle="Comece a organizar seus projetos gratuitamente."
      footer={<>Já tem conta? <Link to="/entrar">Entrar</Link></>}
    >
      <form onSubmit={submit} noValidate className="form-grid">
        <ErrorBox message={error} />
        <Field label="Seu nome" error={errors.nome}>
          {(id) => <input id={id} autoComplete="name" value={form.nome} onChange={set('nome')} maxLength={80} />}
        </Field>
        <Field label="E-mail" error={errors.email}>
          {(id) => <input id={id} type="email" autoComplete="email" value={form.email} onChange={set('email')} />}
        </Field>
        <Field label="Senha" error={errors.senha} hint="Mínimo de 8 caracteres, com letras e números.">
          {(id) => <input id={id} type="password" autoComplete="new-password" value={form.senha} onChange={set('senha')} />}
        </Field>
        <Field label="Confirmar senha" error={errors.confirmar}>
          {(id) => <input id={id} type="password" autoComplete="new-password" value={form.confirmar} onChange={set('confirmar')} />}
        </Field>
        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) return setFieldError('Informe um e-mail válido.');
    setFieldError('');
    setLoading(true);
    setError('');
    const { error: err } = await resetPassword(email.trim());
    setLoading(false);
    if (err) setError(authErrorMessage(err));
    else setSent(true);
  }

  return (
    <AuthCard
      title="Recuperar senha"
      subtitle={sent ? null : 'Informe seu e-mail para receber um link de redefinição.'}
      footer={<Link to="/entrar">Voltar para entrar</Link>}
    >
      {sent ? (
        <p>Se existir uma conta com <strong>{email}</strong>, você receberá um e-mail com o link para criar uma nova senha.</p>
      ) : (
        <form onSubmit={submit} noValidate className="form-grid">
          <ErrorBox message={error} />
          <Field label="E-mail" error={fieldError}>
            {(id) => <input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar link'}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  const { updateUser, session, clearRecovering } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!session) {
    return (
      <AuthCard title="Link inválido" footer={<Link to="/recuperar-senha">Solicitar novo link</Link>}>
        <p>O link de redefinição expirou ou já foi usado. Solicite um novo link.</p>
      </AuthCard>
    );
  }

  async function submit(e) {
    e.preventDefault();
    const v = {};
    const pw = checkPassword(senha);
    if (pw) v.senha = pw;
    if (confirmar !== senha) v.confirmar = 'As senhas não conferem.';
    setErrors(v);
    if (Object.keys(v).length) return;
    setLoading(true);
    setError('');
    const { error: err } = await updateUser({ password: senha });
    setLoading(false);
    if (err) return setError(authErrorMessage(err));
    clearRecovering();
    toast.success('Senha alterada com sucesso.');
    navigate('/', { replace: true });
  }

  return (
    <AuthCard title="Criar nova senha">
      <form onSubmit={submit} noValidate className="form-grid">
        <ErrorBox message={error} />
        <Field label="Nova senha" error={errors.senha} hint="Mínimo de 8 caracteres, com letras e números.">
          {(id) => <input id={id} type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />}
        </Field>
        <Field label="Confirmar nova senha" error={errors.confirmar}>
          {(id) => <input id={id} type="password" autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />}
        </Field>
        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </form>
    </AuthCard>
  );
}
