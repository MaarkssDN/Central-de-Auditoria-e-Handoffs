import { Router, type Request, type Response } from 'express';
import { getDb } from './db';
import { which } from './centralStore';

// Catálogo de providers de IA que a Central pode acionar.
// - kind 'cli': binário headless detectado na máquina (spawn no worktree).
// - kind 'api': chamada HTTPS direta com chave configurada (mock até lá).
// - kind 'manual': sem integração headless — gera pacote de prompt p/ humano.
// Configurações persistem em `provider_configs` (SQLite local, data/ gitignored).

export type ProviderKind = 'cli' | 'api' | 'manual';

export interface ProviderDef {
  id: string;
  nome: string;
  kind: ProviderKind;
  descricao: string;
  detect?: string[];
  envKeys?: string[];
  defaultModel?: string;
}

export const PROVIDER_CATALOG: ProviderDef[] = [
  { id: 'codex', nome: 'OpenAI Codex', kind: 'cli', detect: ['codex'], descricao: 'Codex CLI — `codex exec` no worktree do agente.' },
  { id: 'claude', nome: 'Claude (Code)', kind: 'cli', detect: ['claude'], descricao: 'Claude Code CLI — `claude -p` no worktree.' },
  { id: 'chatgpt', nome: 'ChatGPT (API)', kind: 'api', envKeys: ['OPENAI_API_KEY'], defaultModel: 'gpt-4o-mini', descricao: 'API OpenAI — respostas e dispatch via chat completions.' },
  { id: 'gemini', nome: 'Gemini', kind: 'api', envKeys: ['GEMINI_API_KEY'], defaultModel: 'gemini-2.0-flash', descricao: 'Google Gemini API (já usada pelo runtime de bots).' },
  { id: 'antigravity', nome: 'Antigravity', kind: 'manual', descricao: 'Sem CLI headless — pacote de prompt em central/estado/fila/.' },
  { id: 'devin', nome: 'Devin', kind: 'api', envKeys: ['DEVIN_API_KEY'], descricao: 'API Devin — cria sessões remotas (adapter existente).' },
  { id: 'copilot', nome: 'GitHub Copilot', kind: 'cli', detect: ['copilot'], descricao: 'Copilot CLI no VS Code/terminal — shim interativo.' },
  { id: 'grok', nome: 'Grok (xAI)', kind: 'api', envKeys: ['XAI_API_KEY'], defaultModel: 'grok-2-latest', descricao: 'xAI API — compatível com o formato OpenAI chat completions.' },
];

interface ProviderConfig {
  apiKey?: string;
  model?: string;
  command?: string;
  enabled?: boolean;
}

function getConfig(providerId: string): ProviderConfig {
  try {
    const row = getDb()
      .prepare('SELECT config FROM provider_configs WHERE provider_id = ?')
      .get(providerId) as { config: string } | undefined;
    return row ? (JSON.parse(row.config) as ProviderConfig) : {};
  } catch {
    return {};
  }
}

function saveConfig(providerId: string, cfg: ProviderConfig) {
  getDb()
    .prepare(
      `INSERT INTO provider_configs (provider_id, config, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(provider_id) DO UPDATE SET config = excluded.config, updated_at = excluded.updated_at`,
    )
    .run(providerId, JSON.stringify(cfg));
}

function envKeyFor(def: ProviderDef, cfg: ProviderConfig): string | undefined {
  if (cfg.apiKey) return cfg.apiKey;
  for (const k of def.envKeys || []) {
    const v = process.env[k];
    if (v) return v;
  }
  return undefined;
}

export type ProviderStatus = 'configurado' | 'detectado' | 'mock' | 'indisponivel';

export interface ProviderStatusInfo {
  def: ProviderDef;
  status: ProviderStatus;
  binarios: { cmd: string; path: string }[];
  model?: string;
  hasKey: boolean;
  enabled: boolean;
}

export function listProviderStatuses(): ProviderStatusInfo[] {
  return PROVIDER_CATALOG.map((def) => {
    const cfg = getConfig(def.id);
    const binarios = (def.detect || [])
      .map((c) => ({ cmd: c, path: which(c) }))
      .filter((b): b is { cmd: string; path: string } => Boolean(b.path));
    const hasKey = Boolean(envKeyFor(def, cfg));
    let status: ProviderStatus;
    if (def.kind === 'manual') status = 'mock';
    else if (def.kind === 'cli') status = binarios.length ? 'detectado' : 'indisponivel';
    else status = hasKey ? 'configurado' : 'mock';
    if (cfg.enabled === false) status = 'indisponivel';
    return { def, status, binarios, model: cfg.model || def.defaultModel, hasKey, enabled: cfg.enabled !== false };
  });
}

// ── Dispatch genérico por provider ─────────────────────────────────────────
// Retorna texto de resposta. Providers 'api' usam chat completion; 'cli' e
// 'manual' geram pacote de prompt (execução real fica a cargo do executor local
// ou do humano) — mesmo contrato, modos honestos.

async function callOpenAiCompat(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<string> {
  const res = await fetch(`${opts.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify({
      model: opts.model,
      messages: [{ role: 'user', content: opts.prompt }],
      max_tokens: 1024,
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content || '(resposta vazia)';
}

async function callGemini(opts: { apiKey: string; model: string; prompt: string }): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${opts.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: opts.prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '(resposta vazia)';
}

export async function dispatchToProvider(providerId: string, prompt: string): Promise<{ ok: boolean; output: string; mode: string }> {
  const def = PROVIDER_CATALOG.find((p) => p.id === providerId);
  if (!def) return { ok: false, output: 'Provider desconhecido.', mode: 'erro' };
  const cfg = getConfig(providerId);
  const statuses = listProviderStatuses().find((s) => s.def.id === providerId);
  if (statuses && !statuses.enabled) return { ok: false, output: 'Provider desabilitado na configuração.', mode: 'erro' };

  if (def.kind === 'api') {
    const key = envKeyFor(def, cfg);
    if (!key) {
      return {
        ok: true,
        mode: 'mock',
        output: `[MOCK] ${def.nome} ainda não tem credencial configurada. Configure a API key em Conexões de IA.\n\nPrompt recebido (${prompt.length} chars):\n${prompt.slice(0, 500)}`,
      };
    }
    try {
      let output: string;
      if (providerId === 'gemini') {
        output = await callGemini({ apiKey: key, model: cfg.model || def.defaultModel || 'gemini-2.0-flash', prompt });
      } else if (providerId === 'devin') {
        const base = process.env.DEVIN_API_BASE || 'https://api.devin.ai/v1';
        const res = await fetch(`${base}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ prompt, idempotent: true }),
        });
        if (!res.ok) throw new Error(`Devin ${res.status}`);
        const data = (await res.json()) as { session_id?: string; url?: string };
        output = `Sessão Devin criada: ${data.session_id || '?'} ${data.url || ''}`;
      } else {
        const baseUrl = providerId === 'grok' ? 'https://api.x.ai/v1' : 'https://api.openai.com/v1';
        output = await callOpenAiCompat({ baseUrl, apiKey: key, model: cfg.model || def.defaultModel || 'gpt-4o-mini', prompt });
      }
      return { ok: true, output, mode: 'api' };
    } catch (e) {
      return { ok: false, output: `Falha na API: ${e instanceof Error ? e.message : String(e)}`, mode: 'api' };
    }
  }

  // cli / manual — pacote de prompt honesto (execução real via dispatch/execute ou humano)
  const bin = def.detect?.map((c) => which(c)).find(Boolean);
  const mode = def.kind === 'cli' && bin ? 'cli' : 'manual';
  const hint =
    providerId === 'codex' ? 'codex exec "<prompt>"'
    : providerId === 'claude' ? 'claude -p "<prompt>"'
    : providerId === 'copilot' ? 'copilot no VS Code/terminal'
    : 'colar o prompt no app da ferramenta';
  return {
    ok: true,
    mode,
    output: `[${mode.toUpperCase()}] ${def.nome}\nBinário: ${bin || 'não detectado'}\nComo executar: ${hint}\n\n--- PROMPT ---\n${prompt}`,
  };
}

export function providersRouter() {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ providers: listProviderStatuses() });
  });

  router.put('/:id', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const def = PROVIDER_CATALOG.find((p) => p.id === id);
    if (!def) { res.status(404).json({ error: 'Provider não existe.' }); return; }
    const body = (req.body || {}) as ProviderConfig;
    const current = getConfig(id);
    // apiKey vazio/não enviado → mantém o anterior; string vazia explícita limpa.
    const next: ProviderConfig = {
      ...current,
      model: body.model !== undefined ? body.model || undefined : current.model,
      command: body.command !== undefined ? body.command || undefined : current.command,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : current.enabled,
    };
    if (body.apiKey !== undefined) {
      next.apiKey = body.apiKey === '' ? undefined : body.apiKey;
    }
    saveConfig(id, next);
    res.json({ ok: true, provider: listProviderStatuses().find((s) => s.def.id === id) });
  });

  router.post('/:id/test', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const result = await dispatchToProvider(id, 'Responda apenas: OK');
    res.json(result);
  });

  router.post('/dispatch', async (req: Request, res: Response) => {
    const { providerId, prompt } = (req.body || {}) as { providerId?: string; prompt?: string };
    if (!providerId || !prompt?.trim()) {
      res.status(400).json({ error: 'Informe providerId e prompt.' });
      return;
    }
    const result = await dispatchToProvider(providerId, prompt.trim());
    res.json(result);
  });

  return router;
}
