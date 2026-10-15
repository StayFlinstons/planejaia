import 'dotenv/config';

function bool(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'sim', 'yes'].includes(String(value).toLowerCase());
}

function int(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  port: int(process.env.PORT, 3001),
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-flash-latest',
  // Modelos usados se o principal estiver sobrecarregado ou indisponível (separados por vírgula)
  geminiFallbackModels: (process.env.GEMINI_FALLBACK_MODELS ?? 'gemini-flash-lite-latest,gemini-2.5-flash')
    .split(',').map((m) => m.trim()).filter(Boolean),
  geminiTimeoutMs: int(process.env.GEMINI_TIMEOUT_MS, 40000),
  aiRateLimit: int(process.env.AI_RATE_LIMIT, 20),
  aiDemoMode: bool(process.env.AI_DEMO_MODE, false),
};

export function missingSupabaseConfig() {
  return !config.supabaseUrl || !config.supabaseAnonKey;
}
