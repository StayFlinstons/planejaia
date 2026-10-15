import { Navigate, Route, Routes, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import { EmptyState, Spinner } from './components/ui.jsx';
import {
  ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage,
} from './pages/AuthPages.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Projects from './pages/Projects.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import Tasks from './pages/Tasks.jsx';
import Assistant from './pages/Assistant.jsx';
import Settings from './pages/Settings.jsx';

/** Só permite acesso com usuário logado. */
function Private({ children }) {
  const { session, loading, recovering } = useAuth();
  if (loading) return <div className="center-page"><Spinner /></div>;
  if (!session) return <Navigate to="/entrar" replace />;
  if (recovering) return <Navigate to="/redefinir-senha" replace />;
  return children;
}

/** Telas de acesso: quem já está logado vai para o painel. */
function PublicOnly({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="center-page"><Spinner /></div>;
  if (session) return <Navigate to="/" replace />;
  return children;
}

function NotFound() {
  return (
    <div className="page">
      <EmptyState title="Página não encontrada" action={<Link to="/" className="btn btn-primary">Ir para o painel</Link>}>
        O endereço acessado não existe.
      </EmptyState>
    </div>
  );
}

export default function App() {
  const { loading } = useAuth();
  return (
    <Routes>
      <Route path="/entrar" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/cadastro" element={<PublicOnly><SignupPage /></PublicOnly>} />
      <Route path="/recuperar-senha" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />
      <Route path="/redefinir-senha" element={loading ? <div className="center-page"><Spinner /></div> : <ResetPasswordPage />} />

      <Route element={<Private><Layout /></Private>}>
        <Route index element={<Dashboard />} />
        <Route path="projetos" element={<Projects />} />
        <Route path="projetos/:id" element={<ProjectDetail />} />
        <Route path="tarefas" element={<Tasks />} />
        <Route path="assistente" element={<Assistant />} />
        <Route path="configuracoes" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
