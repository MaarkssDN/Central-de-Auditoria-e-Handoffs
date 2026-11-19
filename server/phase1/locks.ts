import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { saveJsonAtomic } from '../persistence';
// Central dir local p/ evitar ciclo com centralStore.
const CENTRAL_DIR = path.resolve(process.cwd(), process.env.CENTRAL_DIR || 'central');

export const LOCK_DIR = path.join(CENTRAL_DIR, 'estado', 'locks');
export const DEFAULT_LEASE_MS = 60 * 60 * 1000;

export interface HandoffLock {
  handoff: string;
  owner: string;
  executionId: string;
  claimedAt: string;
  expiresAt: string;
  worktree?: string;
}

export interface LockConflict {
  handoff: string;
  owner: string;
  executionId: string;
  expiresAt: string;
}

export type ClaimResult =
  | { ok: true; lock: HandoffLock; stolen?: boolean }
  | { ok: false; conflict: LockConflict };

function lockFileFor(handoffRelPath: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(handoffRelPath.replace(/\\/g, '/'))
    .digest('hex')
    .slice(0, 16);
  return path.join(LOCK_DIR, `${hash}.json`);
}

function normalizeRel(p: string): string {
  return p.replace(/\\/g, '/');
}

export function isLockExpired(lock: HandoffLock, now = Date.now()): boolean {
  return new Date(lock.expiresAt).getTime() <= now;
}

export function getLock(handoffRelPath: string): HandoffLock | null {
  const file = lockFileFor(handoffRelPath);
  if (!fs.existsSync(file)) return null;
  try {
    const lock = JSON.parse(fs.readFileSync(file, 'utf-8')) as HandoffLock;
    if (normalizeRel(lock.handoff) !== normalizeRel(handoffRelPath)) return null;
    return lock;
  } catch {
    return null;
  }
}

export function claimLock(opts: {
  handoffRelPath: string;
  owner: string;
  executionId?: string;
  ttlMs?: number;
  worktree?: string;
  now?: Date;
}): ClaimResult {
  fs.mkdirSync(LOCK_DIR, { recursive: true });
  const now = opts.now || new Date();
  const existing = getLock(opts.handoffRelPath);
  if (existing && !isLockExpired(existing, now.getTime())) {
    return {
      ok: false,
      conflict: {
        handoff: existing.handoff,
        owner: existing.owner,
        executionId: existing.executionId,
        expiresAt: existing.expiresAt,
      },
    };
  }
  const lock: HandoffLock = {
    handoff: normalizeRel(opts.handoffRelPath),
    owner: opts.owner,
    executionId:
      opts.executionId ||
      `exec-${now.toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${crypto.randomBytes(3).toString('hex')}`,
    claimedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + (opts.ttlMs || DEFAULT_LEASE_MS)).toISOString(),
    worktree: opts.worktree,
  };
  saveJsonAtomic(lockFileFor(opts.handoffRelPath), lock);
  return { ok: true, lock, stolen: Boolean(existing) };
}

export function releaseLock(opts: {
  handoffRelPath: string;
  owner?: string;
  executionId?: string;
}): { ok: boolean; released?: boolean; error?: string } {
  const existing = getLock(opts.handoffRelPath);
  if (!existing) return { ok: true, released: false };
  if (opts.owner && existing.owner !== opts.owner) {
    return { ok: false, error: `Lock pertence a '${existing.owner}', não '${opts.owner}'.` };
  }
  if (opts.executionId && existing.executionId !== opts.executionId) {
    return { ok: false, error: 'executionId diverge do lock vigente.' };
  }
  fs.rmSync(lockFileFor(opts.handoffRelPath), { force: true });
  return { ok: true, released: true };
}

export function renewLock(opts: {
  handoffRelPath: string;
  executionId: string;
  ttlMs?: number;
  now?: Date;
}): { ok: boolean; lock?: HandoffLock; error?: string } {
  const existing = getLock(opts.handoffRelPath);
  if (!existing) return { ok: false, error: 'Nenhum lock vigente para este handoff.' };
  if (existing.executionId !== opts.executionId) {
    return { ok: false, error: 'executionId não corresponde ao lock vigente.' };
  }
  const now = opts.now || new Date();
  existing.expiresAt = new Date(now.getTime() + (opts.ttlMs || DEFAULT_LEASE_MS)).toISOString();
  saveJsonAtomic(lockFileFor(opts.handoffRelPath), existing);
  return { ok: true, lock: existing };
}

export function listLocks(): Array<HandoffLock & { expired: boolean }> {
  if (!fs.existsSync(LOCK_DIR)) return [];
  const out: Array<HandoffLock & { expired: boolean }> = [];
  const now = Date.now();
  for (const f of fs.readdirSync(LOCK_DIR).filter((f) => f.endsWith('.json'))) {
    try {
      const lock = JSON.parse(fs.readFileSync(path.join(LOCK_DIR, f), 'utf-8')) as HandoffLock;
      out.push({ ...lock, expired: isLockExpired(lock, now) });
    } catch { /* ignora lock corrompido */ }
  }
  return out.sort((a, b) => a.handoff.localeCompare(b.handoff));
}

export function newExecutionId(now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `exec-${stamp}-${crypto.randomBytes(3).toString('hex')}`;
}

export function hashPrompt(text: string): string {
  return `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;
}

export { lockFileFor, normalizeRel };
export default { claimLock, releaseLock, renewLock, getLock, listLocks, isLockExpired, newExecutionId, hashPrompt };
