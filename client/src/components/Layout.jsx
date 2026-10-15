import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { to: '/', label: 'Painel', icon: 'dashboard', end: true },
  { to: '/projetos', label: 'Projetos', icon: 'folder' },
  { to: '/tarefas', label: 'Tarefas', icon: 'check' },
  { to: '/assistente', label: 'Assistente IA', icon: 'spark' },
  { to: '/configuracoes', label: 'Configurações', icon: 'settings' },
];

export function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark" aria-hidden="true"><Icon name="check" size={16} /></span>
      <span>Planeja<strong>IA</strong></span>
    </span>
  );
}

export default function Layout() {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setMenuOpen(false); window.scrollTo(0, 0); }, [location.pathname]);

  const nome = user?.user_metadata?.nome || user?.email;

  return (
    <div className="app-shell">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
          <Icon name="menu" />
        </button>
        <Logo />
        <span style={{ width: 36 }} />
      </header>

      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      <aside className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="Menu principal">
        <div className="sidebar-head">
          <Logo />
          <button type="button" className="icon-btn only-mobile" onClick={() => setMenuOpen(false)} aria-label="Fechar menu">
            <Icon name="close" />
          </button>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip" title={user?.email}>
            <span className="avatar" aria-hidden="true">{(nome || '?').charAt(0).toUpperCase()}</span>
            <span className="user-name">{nome}</span>
          </div>
          <button type="button" className="nav-link logout" onClick={signOut}>
            <Icon name="logout" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <main className="main" id="conteudo">
        <Outlet />
      </main>
    </div>
  );
}
