import fs from 'fs';
import path from 'path';
import { saveJsonAtomic } from '../persistence';
const CENTRAL_DIR = path.resolve(process.cwd(), process.env.CENTRAL_DIR || 'central');

export const EXEC_DIR = path.join(CENTRAL_DIR, 'estado', 'executions');

export type ExecutionEventType =
  | 'CREATED'
  | 'STATUS_TRANSITION'
  | 'LOCK_CLAIMED'
  | 'LOCK_RELEASED'
  | 'LOCK_EXPIRED'
  | 'DISPATCHED'
  | 'ADAPTER_STARTED'
  | 'ADAPTER_COMPLETED'
  | 'ADAPTER_FAILED'
  | 'WORKTREE_REGISTERED'
  | 'WORKTREE_ORPHANED';

export interface ExecutionEvent {
  seq: number;
  executionId: string;
  handoff?: string;
  type: ExecutionEventType;
  at: string;
  actor?: string;
  from?: string;
  to?: string;
  detail?: string;
  meta?: Record<string, unknown>;
}

export interface ExecutionRecord {
  executionId: string;
  handoff: string;
  owner: string;
  startedAt: string;
  endedAt?: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';
  events: ExecutionEvent[];
}

function ensureDir(): void {
  fs.mkdirSync(EXEC_DIR, { recursive: true });
}

function recordFile(executionId: string): string {
  const safe = executionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(EXEC_DIR, `${safe}.json`);
}

export function appendEvent(opts: {
  executionId: string;
  handoff?: string;
  type: ExecutionEventType;
  actor?: string;
  from?: string;
  to?: string;
  detail?: string;
  meta?: Record<string, unknown>;
  at?: Date;
}): ExecutionEvent {
  ensureDir();
  const file = recordFile(opts.executionId);
  let record: ExecutionRecord;
  if (fs.existsSync(file)) {
    record = JSON.parse(fs.readFileSync(file, 'utf-8')) as ExecutionRecord;
  } else {
    record = {
      executionId: opts.executionId,
      handoff: opts.handoff || '',
      owner: opts.actor || '',
      startedAt: (opts.at || new Date()).toISOString(),
      status: 'RUNNING',
      events: [],
    };
  }
  const event: ExecutionEvent = {
    seq: record.events.length + 1,
    executionId: opts.executionId,
    handoff: opts.handoff,
    type: opts.type,
    at: (opts.at || new Date()).toISOString(),
    actor: opts.actor,
    from: opts.from,
    to: opts.to,
    detail: opts.detail,
    meta: opts.meta,
  };
  record.events.push(event);
  if (opts.handoff && !record.handoff) record.handoff = opts.handoff;
  if (opts.type === 'ADAPTER_COMPLETED' || opts.to === 'CONCLUÍDO') {
    record.status = 'SUCCEEDED';
    record.endedAt = event.at;
  } else if (opts.type === 'ADAPTER_FAILED') {
    record.status = 'FAILED';
    record.endedAt = event.at;
  }
  saveJsonAtomic(file, record);
  return event;
}

export function logStatusTransition(opts: {
  executionId: string;
  handoff: string;
  from: string;
  to: string;
  actor?: string;
  detail?: string;
}): ExecutionEvent {
  return appendEvent({
    executionId: opts.executionId,
    handoff: opts.handoff,
    type: 'STATUS_TRANSITION',
    actor: opts.actor,
    from: opts.from,
    to: opts.to,
    detail: opts.detail,
  });
}

export function getExecution(executionId: string): ExecutionRecord | null {
  const file = recordFile(executionId);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as ExecutionRecord;
  } catch {
    return null;
  }
}

export function listExecutions(opts?: { handoff?: string; limit?: number }): ExecutionRecord[] {
  ensureDir();
  const out: ExecutionRecord[] = [];
  for (const f of fs.readdirSync(EXEC_DIR).filter((f) => f.endsWith('.json'))) {
    try {
      const rec = JSON.parse(fs.readFileSync(path.join(EXEC_DIR, f), 'utf-8')) as ExecutionRecord;
      if (opts?.handoff && rec.handoff !== opts.handoff) continue;
      out.push(rec);
    } catch { /* ignora corrompido */ }
  }
  out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return opts?.limit ? out.slice(0, opts.limit) : out;
}

export function allEvents(opts?: { handoff?: string; type?: ExecutionEventType }): ExecutionEvent[] {
  const events: ExecutionEvent[] = [];
  for (const rec of listExecutions({ handoff: opts?.handoff })) {
    for (const e of rec.events) {
      if (!opts?.type || e.type === opts.type) events.push(e);
    }
  }
  return events.sort((a, b) => a.at.localeCompare(b.at));
}

export default { appendEvent, logStatusTransition, getExecution, listExecutions, allEvents };
