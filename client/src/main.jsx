import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { supabaseMissingConfig } from './lib/supabase.js';
import './styles.css';

function MissingConfig() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Configuração necessária</h1>
        <p>O front-end não encontrou as variáveis do Supabase.</p>
        <ol>
          <li>Copie <code>client/.env.example</code> para <code>client/.env</code>.</li>
          <li>Preencha <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>.</li>
          <li>Reinicie o comando <code>npm run dev</code>.</li>
        </ol>
        <p className="muted small">Veja o passo a passo completo no README.md.</p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {supabaseMissingConfig ? <MissingConfig /> : (
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    )}
  </StrictMode>,
);
