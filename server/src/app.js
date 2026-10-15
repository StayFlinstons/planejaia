import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { projectsRouter } from './routes/projects.js';
import { tasksRouter } from './routes/tasks.js';
import { dashboardRouter } from './routes/dashboard.js';
import { aiRouter } from './routes/ai.js';
import * as supabaseLib from './lib/supabase.js';

/**
 * Cria o aplicativo Express.
 * As dependências podem ser substituídas nos testes automatizados.
 */
export function createApp(deps = {}) {
  const {
    getUserFromToken = supabaseLib.getUserFromToken,
    createUserClient = supabaseLib.createUserClient,
    generate,
  } = deps;

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(cors({
    origin(origin, cb) {
      // Permite ferramentas sem origem (curl, testes) e as origens configuradas
      if (!origin || config.clientOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
  }));
  app.use(express.json({ limit: '200kb' }));
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  const auth = requireAuth({ getUserFromToken, createUserClient });
  app.use('/api/projects', auth, projectsRouter());
  app.use('/api/tasks', auth, tasksRouter());
  app.use('/api/dashboard', auth, dashboardRouter());
  app.use('/api/ai', auth, aiRouter({ generate }));

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
