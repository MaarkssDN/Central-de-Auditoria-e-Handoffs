import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CENTRAL_DIR } from './centralStore';
import { emitCentralEvent } from './centralEvents';

export const EXECUTIONS_DIR = path.join(CENTRAL_DIR, 'estado', 'executions');

export interface ExecutionEntry {
  ts: string;
  execId: string;
  handoff: string;
  agent?: string;
  provider?: string;
  action: 'dispatch' | 'heartbeat' | 'complete' | 'fail' | 'review' | 'pr_created' | string;
  promptHash?: string;
  exitCode?: number | null;
  durationMs?: number | null;
  branch?: string | null;
  prUrl?: string | null;
  worktree?: string | null;
  notes?: string;
  [key: string]: unknown;
}

function dayFile(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function newExecId(prefix = 'exec'): string {
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const rand = crypto.randomBytes(3).toString('hex');
  return `${prefix}-${stamp}-${rand}`;
}

export function promptHash(text: string): string {
  return `sha256:${crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)}`;
}

export function appendExecution(entry: Omit<ExecutionEntry, 'ts' | 'execId'> & { execId?: string; ts?: string }): ExecutionEntry {
  const full: ExecutionEntry = {
    ts: entry.ts || new Date().toISOString(),
    execId: entry.execId || newExecId(),
    ...entry,
  } as ExecutionEntry;

  fs.mkdirSync(EXECUTIONS_DIR, { recursive: true });
  const file = path.join(EXECUTIONS_DIR, `${dayFile(new Date(full.ts))}.jsonl`);
  fs.appendFileSync(file, JSON.stringify(full) + '\n', 'utf-8');

  const actionEvent: Record<string, string> = {
    dispatch: 'exec_started',
    heartbeat: 'exec_heartbeat',
    complete: 'exec_done',
    fail: 'exec_done',
    review: 'exec_done',
    pr_created: 'pr_created',
  };
  const evType = actionEvent[full.action];
  if (evType) {
    emitCentralEvent(evType as Parameters<typeof emitCentralEvent>[0], {
      execId: full.execId,
      handoff: full.handoff,
      agent: full.agent,
      provider: full.provider,
      action: full.action,
      exitCode: full.exitCode ?? null,
      branch: full.branch ?? null,
      prUrl: full.prUrl ?? null,
      notes: full.notes,
    });
  }
  return full;
}

export function readExecutions(opts: { days?: number; handoff?: string; limit?: number } = {}): ExecutionEntry[] {
  if (!fs.existsSync(EXECUTIONS_DIR)) return [];
  const files = fs.readdirSync(EXECUTIONS_DIR).filter((f) => f.endsWith('.jsonl')).sort();
  const slice = opts.days ? files.slice(-opts.days) : files;
  const out: ExecutionEntry[] = [];
  for (const f of slice) {
    const lines = fs.readFileSync(path.join(EXECUTIONS_DIR, f), 'utf-8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const e = JSON.parse(line) as ExecutionEntry;
        if (opts.handoff && e.handoff !== opts.handoff) continue;
        out.push(e);
      } catch { /* linha corrompida — log é append-only, ignora */ }
    }
  }
  const limited = opts.limit ? out.slice(-opts.limit) : out;
  return limited;
}

export function activeExecutions(): ExecutionEntry[] {
  const all = readExecutions({ days: 2 });
  const done = new Set<string>();
  const started = new Map<string, ExecutionEntry>();
  for (const e of all) {
    if (e.action === 'dispatch') started.set(e.execId, e);
    if (['complete', 'fail', 'review'].includes(e.action)) done.add(e.execId);
  }
  return [...started.entries()].filter(([id]) => !done.has(id)).map(([, e]) => e);
}
