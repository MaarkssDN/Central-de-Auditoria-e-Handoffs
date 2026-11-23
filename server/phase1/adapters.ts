import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export type AdapterKind = 'cli' | 'devin' | 'gemini' | 'subagente' | 'manual' | 'mock';

export type ExecutionStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMEOUT' | 'CANCELLED';

export interface AdapterRequest {
  executionId: string;
  handoffRelPath: string;
  prompt: string;
  worktree?: string;
  branch?: string;
  repoPath?: string;
  agentId?: string;
  timeoutMs?: number;
}

export interface AdapterResult {
  executionId: string;
  status: ExecutionStatus;
  exitCode?: number | null;
  output?: string;
  error?: string;
  sessionId?: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
}

export interface ProviderAdapter {
  kind: AdapterKind;
  execute(req: AdapterRequest): Promise<AdapterResult>;
  poll?(sessionId: string): Promise<{ status: ExecutionStatus; detail?: string }>;
}

const TERMINAL_DEVIN_STATES = new Set(['finished', 'failed', 'cancelled', 'expired', 'blocked']);

export function createCliAdapter(opts?: { shell?: string }): ProviderAdapter {
  return {
    kind: 'cli',
    async execute(req: AdapterRequest): Promise<AdapterResult> {
      const startedAt = new Date();
      const timeoutMs = req.timeoutMs ?? 10 * 60 * 1000;
      const cmd = process.env.CENTRAL_CLI_COMMAND || 'echo';
      const args = (process.env.CENTRAL_CLI_ARGS || req.prompt.slice(0, 200))
        .split(' ')
        .filter(Boolean);
      return new Promise((resolve) => {
        const child = spawn(cmd, args, {
          cwd: req.worktree || req.repoPath || process.cwd(),
          shell: opts?.shell ?? true,
          env: { ...process.env, CENTRAL_EXECUTION_ID: req.executionId },
        });
        let output = '';
        const timer = setTimeout(() => {
          child.kill('SIGKILL');
          resolve({
            executionId: req.executionId,
            status: 'TIMEOUT',
            output,
            error: `Timeout após ${timeoutMs}ms`,
            startedAt: startedAt.toISOString(),
            endedAt: new Date().toISOString(),
            durationMs: Date.now() - startedAt.getTime(),
          });
        }, timeoutMs);
        child.stdout?.on('data', (d) => { output += d.toString(); });
        child.stderr?.on('data', (d) => { output += d.toString(); });
        child.on('error', (err) => {
          clearTimeout(timer);
          resolve({
            executionId: req.executionId,
            status: 'FAILED',
            output,
            error: err.message,
            startedAt: startedAt.toISOString(),
            endedAt: new Date().toISOString(),
            durationMs: Date.now() - startedAt.getTime(),
          });
        });
        child.on('close', (code) => {
          clearTimeout(timer);
          resolve({
            executionId: req.executionId,
            status: code === 0 ? 'SUCCEEDED' : 'FAILED',
            exitCode: code,
            output,
            startedAt: startedAt.toISOString(),
            endedAt: new Date().toISOString(),
            durationMs: Date.now() - startedAt.getTime(),
          });
        });
      });
    },
  };
}

export function createDevinAdapter(opts?: {
  apiBase?: string;
  apiKey?: string;
  pollIntervalMs?: number;
  maxPollMs?: number;
  fetchImpl?: typeof fetch;
}): ProviderAdapter {
  const apiBase = opts?.apiBase || process.env.DEVIN_API_BASE || 'https://api.devin.ai/v1';
  const apiKey = opts?.apiKey || process.env.DEVIN_API_KEY || '';
  const pollIntervalMs = opts?.pollIntervalMs ?? 5000;
  const maxPollMs = opts?.maxPollMs ?? 30 * 60 * 1000;
  const fetchImpl = opts?.fetchImpl || fetch;

  async function createSession(req: AdapterRequest): Promise<{ sessionId: string; url?: string }> {
    const res = await fetchImpl(`${apiBase}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        prompt: req.prompt,
        idempotent: true,
        tags: [`central:${req.executionId}`, `handoff:${req.handoffRelPath}`],
      }),
    });
    if (!res.ok) {
      throw new Error(`Devin API create session falhou: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { session_id?: string; id?: string; url?: string };
    const sessionId = data.session_id || data.id;
    if (!sessionId) throw new Error('Devin API não retornou session_id.');
    return { sessionId, url: data.url };
  }

  async function getSession(sessionId: string): Promise<{ status: string; detail?: string }> {
    const res = await fetchImpl(`${apiBase}/sessions/${sessionId}`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) {
      throw new Error(`Devin API get session falhou: ${res.status}`);
    }
    const data = (await res.json()) as { status?: string; status_enum?: string; detail?: string };
    return { status: data.status_enum || data.status || 'running', detail: data.detail };
  }

  return {
    kind: 'devin',
    async execute(req: AdapterRequest): Promise<AdapterResult> {
      const startedAt = new Date();
      try {
        const { sessionId } = await createSession(req);
        const deadline = Date.now() + (req.timeoutMs ?? maxPollMs);
        let lastStatus = 'running';
        let lastDetail: string | undefined;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, pollIntervalMs));
          const s = await getSession(sessionId);
          lastStatus = s.status;
          lastDetail = s.detail;
          const normalized = lastStatus.toLowerCase();
          if (TERMINAL_DEVIN_STATES.has(normalized) || normalized === 'finished') {
            const ok = normalized === 'finished';
            return {
              executionId: req.executionId,
              status: ok ? 'SUCCEEDED' : normalized === 'blocked' ? 'FAILED' : 'FAILED',
              sessionId,
              output: lastDetail,
              startedAt: startedAt.toISOString(),
              endedAt: new Date().toISOString(),
              durationMs: Date.now() - startedAt.getTime(),
            };
          }
        }
        return {
          executionId: req.executionId,
          status: 'TIMEOUT',
          sessionId,
          output: lastDetail,
          error: `Polling excedeu ${maxPollMs}ms (último status: ${lastStatus})`,
          startedAt: startedAt.toISOString(),
          endedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt.getTime(),
        };
      } catch (e) {
        return {
          executionId: req.executionId,
          status: 'FAILED',
          error: (e as Error).message,
          startedAt: startedAt.toISOString(),
          endedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt.getTime(),
        };
      }
    },
    async poll(sessionId: string) {
      const s = await getSession(sessionId);
      const n = s.status.toLowerCase();
      const status: ExecutionStatus = TERMINAL_DEVIN_STATES.has(n) || n === 'finished'
        ? (n === 'finished' ? 'SUCCEEDED' : 'FAILED')
        : 'RUNNING';
      return { status, detail: s.detail };
    },
  };
}

export function createMockAdapter(behavior?: {
  status?: ExecutionStatus;
  exitCode?: number;
  output?: string;
  delayMs?: number;
}): ProviderAdapter & { calls: AdapterRequest[] } {
  const calls: AdapterRequest[] = [];
  return {
    kind: 'mock',
    calls,
    async execute(req: AdapterRequest): Promise<AdapterResult> {
      calls.push(req);
      const startedAt = new Date();
      if (behavior?.delayMs) await new Promise((r) => setTimeout(r, behavior.delayMs));
      const status = behavior?.status || 'SUCCEEDED';
      return {
        executionId: req.executionId,
        status,
        exitCode: behavior?.exitCode ?? (status === 'SUCCEEDED' ? 0 : 1),
        output: behavior?.output ?? `mock output for ${req.executionId}`,
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
      };
    },
  };
}

export function createManualAdapter(): ProviderAdapter {
  return {
    kind: 'manual',
    async execute(req: AdapterRequest): Promise<AdapterResult> {
      const startedAt = new Date();
      const promptFile = path.join(process.cwd(), 'central', 'estado', 'fila', `manual-${req.executionId}.md`);
      fs.mkdirSync(path.dirname(promptFile), { recursive: true });
      fs.writeFileSync(promptFile, req.prompt, 'utf-8');
      return {
        executionId: req.executionId,
        status: 'RUNNING',
        output: `Execução manual. Prompt em: ${promptFile}`,
        startedAt: startedAt.toISOString(),
        endedAt: startedAt.toISOString(),
        durationMs: 0,
      };
    },
  };
}

export function createGeminiAdapter(): ProviderAdapter {
  return {
    kind: 'gemini',
    async execute(req: AdapterRequest): Promise<AdapterResult> {
      const startedAt = new Date();
      try {
        const { getGeminiClient, GEMINI_DEFAULT_MODEL } = await import('../geminiService');
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
          model: GEMINI_DEFAULT_MODEL,
          contents: req.prompt,
        });

        const output = response.text || '(Sem saída textual gerada pelo Gemini)';
        return {
          executionId: req.executionId,
          status: 'SUCCEEDED',
          exitCode: 0,
          output,
          startedAt: startedAt.toISOString(),
          endedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt.getTime(),
        };
      } catch (err) {
        return {
          executionId: req.executionId,
          status: 'FAILED',
          exitCode: 1,
          error: err instanceof Error ? err.message : String(err),
          startedAt: startedAt.toISOString(),
          endedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt.getTime(),
        };
      }
    },
  };
}

const registry = new Map<AdapterKind, ProviderAdapter>();

export function registerAdapter(kind: AdapterKind, adapter: ProviderAdapter): void {
  registry.set(kind, adapter);
}

export function getAdapter(kind: AdapterKind): ProviderAdapter {
  const existing = registry.get(kind);
  if (existing) return existing;
  switch (kind) {
    case 'cli': return createCliAdapter();
    case 'devin': return createDevinAdapter();
    case 'gemini': return createGeminiAdapter();
    case 'manual': return createManualAdapter();
    case 'mock': return createMockAdapter();
    case 'subagente': return createManualAdapter();
    default: return createManualAdapter();
  }
}

export function resetAdapters(): void {
  registry.clear();
}

export function runCliSync(cmd: string, opts?: { cwd?: string; timeoutMs?: number }): { code: number | null; output: string } {
  try {
    const out = execSync(cmd, {
      cwd: opts?.cwd,
      timeout: opts?.timeoutMs ?? 60000,
      stdio: 'pipe',

    }).toString();
    return { code: 0, output: out };
  } catch (e) {
    const err = e as { status?: number; stdout?: Buffer; stderr?: Buffer; message: string };
    return {
      code: err.status ?? null,
      output: `${err.stdout?.toString() || ''}${err.stderr?.toString() || ''}${err.message}`,
    };
  }
}

export default {
  createCliAdapter,
  createDevinAdapter,
  createGeminiAdapter,
  createMockAdapter,
  createManualAdapter,
  registerAdapter,
  getAdapter,
  resetAdapters,
  runCliSync,
};
