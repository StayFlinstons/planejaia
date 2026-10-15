import { createApp } from './app.js';
import { config, missingSupabaseConfig } from './config.js';

if (missingSupabaseConfig()) {
  console.error('\n[PlanejaIA] Configure SUPABASE_URL e SUPABASE_ANON_KEY no arquivo server/.env (veja server/.env.example).\n');
  process.exit(1);
}

if (!config.geminiApiKey) {
  console.warn(config.aiDemoMode
    ? '[PlanejaIA] GEMINI_API_KEY ausente: assistente em MODO DEMONSTRAÇÃO.'
    : '[PlanejaIA] GEMINI_API_KEY ausente: o assistente de IA ficará indisponível.');
}

createApp().listen(config.port, () => {
  console.log(`[PlanejaIA] API rodando em http://localhost:${config.port}`);
});
