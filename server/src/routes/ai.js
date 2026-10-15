import { Router } from 'express';
import { config } from '../config.js';
import { isUuid, isValidDate, todayISO } from '../utils/validation.js';
import { badRequest, notFound, fromSupabaseError, HttpError } from '../utils/httpError.js';
import { rateLimitPerUser } from '../middleware/rateLimit.js';
import { generateJson, AiError } from '../services/gemini.js';
import { SCHEMAS } from '../services/aiSchemas.js';
import { SYSTEM_PROMPT, buildContext, buildPrompt, redactSensitive } from '../services/aiPrompts.js';
import { normalizeAiResult } from '../services/aiNormalize.js';
import { demoResponse } from '../services/aiDemo.js';
import { PROJECT_FIELDS } from './projects.js';

export const AI_MODES = ['plano', 'organizar', 'riscos', 'replanejar', 'resumo', 'comunicacao'];
// Funções em que o texto do usuário é obrigatório
const NEEDS_MESSAGE = ['plano', 'replanejar', 'comunicacao'];
// Funções que analisam tarefas já cadastradas
const NEEDS_TASKS = ['organizar', 'riscos', 'replanejar', 'resumo'];
const MAX_MESSAGE = 4000;
const MIN_MESSAGE = 10;

function aiAvailability() {
  if (config.geminiApiKey) return { available: true, demo: false };
  if (config.aiDemoMode) return { available: true, demo: true };
  return { available: false, demo: false };
}

async function loadContext(req, projectId) {
  let project = null;
  if (projectId) {
    const { data, error } = await req.db
      .from('projects').select(PROJECT_FIELDS).eq('id', projectId).eq('user_id', req.user.id).maybeSingle();
    if (error) throw fromSupabaseError(error);
    if (!data) throw notFound('Projeto não encontrado.');
    project = data;
  }
  let query = req.db
    .from('tasks')
    .select('id, titulo, descricao, prazo, prioridade, status, project:projects(nome)')
    .eq('user_id', req.user.id)
    .order('prazo', { ascending: true, nullsFirst: false })
    .limit(80);
  if (projectId) query = query.eq('project_id', projectId);
  const { data: tasks, error } = await query;
  if (error) throw fromSupabaseError(error);
  return { project, tasks };
}

export function aiRouter({ generate = generateJson } = {}) {
  const router = Router();

  // Informa ao front-end se o assistente está disponível (sem revelar a chave)
  router.get('/status', (_req, res) => {
    res.json(aiAvailability());
  });

  router.post(
    '/:mode',
    rateLimitPerUser({
      max: config.aiRateLimit,
      windowMs: 10 * 60 * 1000,
      message: 'Você fez muitas solicitações ao assistente em pouco tempo. Aguarde alguns minutos e tente novamente.',
    }),
    async (req, res, next) => {
      try {
        const { mode } = req.params;
        if (!AI_MODES.includes(mode)) throw notFound('Função do assistente não encontrada.');

        const body = req.body || {};
        if (body.mensagem !== undefined && typeof body.mensagem !== 'string') {
          throw badRequest('A descrição deve ser um texto.');
        }
        const mensagemOriginal = (body.mensagem || '').trim();
        if (NEEDS_MESSAGE.includes(mode) && mensagemOriginal.length < MIN_MESSAGE) {
          throw badRequest(`Descreva o que você precisa com pelo menos ${MIN_MESSAGE} caracteres.`, {
            mensagem: 'Descrição muito curta.',
          });
        }
        if (mensagemOriginal.length > MAX_MESSAGE) {
          throw badRequest(`A descrição deve ter no máximo ${MAX_MESSAGE} caracteres.`, { mensagem: 'Descrição muito longa.' });
        }
        const projectId = body.project_id || null;
        if (projectId && !isUuid(projectId)) throw badRequest('Projeto inválido.');
        const hoje = isValidDate(body.hoje) ? body.hoje : todayISO();

        const status = aiAvailability();
        if (!status.available) {
          const err = new HttpError(503, 'O assistente de IA está indisponível no momento: a integração não foi configurada no servidor.');
          err.code = 'not_configured';
          throw err;
        }

        const { project, tasks } = await loadContext(req, projectId);
        if (NEEDS_TASKS.includes(mode) && tasks.length === 0) {
          throw badRequest(project
            ? 'Este projeto ainda não tem tarefas para analisar. Cadastre tarefas ou use "Criar plano de ação".'
            : 'Você ainda não tem tarefas para analisar. Cadastre tarefas ou use "Criar plano de ação".');
        }

        const { text: contextText, refMap } = buildContext({ project, tasks, hoje });
        const mensagem = redactSensitive(mensagemOriginal);

        let raw;
        if (status.demo) {
          raw = demoResponse(mode, { hoje, refMap });
        } else {
          raw = await generate({
            apiKey: config.geminiApiKey,
            model: config.geminiModel,
            system: SYSTEM_PROMPT,
            prompt: buildPrompt(mode, mensagem, contextText),
            schema: SCHEMAS[mode],
          });
        }

        const result = normalizeAiResult(mode, raw, { hoje, refMap });
        res.json({
          mode,
          demo: status.demo,
          project: project ? { id: project.id, nome: project.nome } : null,
          dados_removidos: mensagem !== mensagemOriginal,
          gerado_em: new Date().toISOString(),
          result,
        });
      } catch (err) {
        if (err instanceof AiError) {
          const httpErr = new HttpError(err.status, err.message);
          httpErr.code = err.code;
          return next(httpErr);
        }
        next(err);
      }
    },
  );

  return router;
}
