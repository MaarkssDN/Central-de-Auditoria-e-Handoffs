import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
const CENTRAL_DIR = path.resolve(process.cwd(), process.env.CENTRAL_DIR || 'central');
import { listLocks } from './locks';
import { appendEvent } from './executions';
import { saveJsonAtomic } from '../persistence';

export const WORKTREE_REGISTRY = path.join(CENTRAL_DIR, 'estado', 'worktrees.json');

export interface WorktreeRecord {
  path: string;
  branch?: string;
  repoPath?: string;
  executionId?: string;
  handoff?: string;
  owner?: string;
  registeredAt: string;
  status: 'ACTIVE' | 'ORPHANED' | 'RELEASED';
}

export interface OrphanedWorktree extends WorktreeRecord {
  orphanReason: string;
}

function ensureDir(): void {
  fs.mkdirSync(path.dirname(WORKTREE_REGISTRY), { recursive: true });
}

function readRegistry(): WorktreeRecord[] {
  if (!fs.existsSync(WORKTREE_REGISTRY)) return [];
  try {
    return JSON.parse(fs.readFileSync(WORKTREE_REGISTRY, 'utf-8')) as WorktreeRecord[];
  } catch {
    return [];
  }
}

function writeRegistry(records: WorktreeRecord[]): void {
  ensureDir();
  saveJsonAtomic(WORKTREE_REGISTRY, records);
}

export function registerWorktree(opts: {
  path: string;
  branch?: string;
  repoPath?: string;
  executionId?: string;
  handoff?: string;
  owner?: string;
}): WorktreeRecord {
  const records = readRegistry();
  const existing = records.find((r) => r.path === opts.path && r.status === 'ACTIVE');
  if (existing) return existing;
  const rec: WorktreeRecord = {
    path: opts.path,
    branch: opts.branch,
    repoPath: opts.repoPath,
    executionId: opts.executionId,
    handoff: opts.handoff,
    owner: opts.owner,
    registeredAt: new Date().toISOString(),
    status: 'ACTIVE',
  };
  records.push(rec);
  writeRegistry(records);
  if (opts.executionId) {
    appendEvent({
      executionId: opts.executionId,
      handoff: opts.handoff,
      type: 'WORKTREE_REGISTERED',
      actor: opts.owner,
      detail: `Worktree registrado: ${opts.path}${opts.branch ? ` (${opts.branch})` : ''}`,
      meta: { path: opts.path, branch: opts.branch },
    });
  }
  return rec;
}

export function listWorktrees(status?: WorktreeRecord['status']): WorktreeRecord[] {
  const records = readRegistry();
  return status ? records.filter((r) => r.status === status) : records;
}

export function releaseWorktree(wtPath: string): boolean {
  const records = readRegistry();
  const rec = records.find((r) => r.path === wtPath && r.status === 'ACTIVE');
  if (!rec) return false;
  rec.status = 'RELEASED';
  writeRegistry(records);
  if (rec.executionId) {
    appendEvent({
      executionId: rec.executionId,
      handoff: rec.handoff,
      type: 'WORKTREE_REGISTERED',
      detail: `Worktree liberado: ${wtPath}`,
      meta: { path: wtPath, action: 'released' },
    });
  }
  return true;
}

function worktreeExistsOnDisk(wtPath: string): boolean {
  try {
    return fs.existsSync(wtPath) && fs.statSync(wtPath).isDirectory();
  } catch {
    return false;
  }
}

function isGitWorktree(wtPath: string): boolean {
  try {
    return fs.existsSync(path.join(wtPath, '.git'));
  } catch {
    return false;
  }
}

export function findOrphanedWorktrees(): OrphanedWorktree[] {
  const locks = listLocks().filter((l) => l.expired);
  const expiredHandoffs = new Set(locks.map((l) => l.handoff.replace(/\\/g, '/')));
  const expiredExecs = new Set(locks.map((l) => l.executionId));
  const orphans: OrphanedWorktree[] = [];
  for (const rec of readRegistry()) {
    if (rec.status !== 'ACTIVE') continue;
    const lockExpired =
      (rec.handoff && expiredHandoffs.has(rec.handoff.replace(/\\/g, '/'))) ||
      (rec.executionId && expiredExecs.has(rec.executionId));
    if (!lockExpired) continue;
    orphans.push({
      ...rec,
      status: 'ORPHANED',
      orphanReason: 'Lock/lease expirado sem liberação do worktree. Remoção manual necessária.',
    });
    for (const o of orphans) {
      if (o.executionId && o.status === 'ORPHANED') {
        appendEvent({
          executionId: o.executionId,
          handoff: o.handoff,
          type: 'WORKTREE_ORPHANED',
          detail: o.orphanReason,
          meta: { path: o.path },
        });
      }
    }
    // marca no registry sem apagar nada em disco
    const records = readRegistry();
    const target = records.find((r) => r.path === rec.path && r.status === 'ACTIVE');
    if (target) {
      target.status = 'ORPHANED';
      writeRegistry(records);
    }
  }
  return orphans;
}

export function cleanupOrphanedWorktrees(opts?: { dryRun?: boolean }): {
  removed: string[];
  skipped: string[];
  errors: string[];
} {
  const removed: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  for (const orphan of findOrphanedWorktrees()) {
    const wtPath = orphan.path;
    if (!worktreeExistsOnDisk(wtPath)) {
      skipped.push(`${wtPath} (não existe em disco)`);
      continue;
    }
    if (!isGitWorktree(wtPath)) {
      skipped.push(`${wtPath} (não é worktree git — remoção manual)`);
      continue;
    }
    if (opts?.dryRun) {
      skipped.push(`${wtPath} (dry-run)`);
      continue;
    }
    try {
      const repo = orphan.repoPath || process.cwd();
      execSync(`git -C "${repo}" worktree remove "${wtPath}" --force`, { stdio: 'pipe' });
      removed.push(wtPath);
    } catch (e) {
      errors.push(`${wtPath}: ${(e as Error).message}`);
    }
  }
  return { removed, skipped, errors };
}

export function gitWorktreeList(repoPath: string): string[] {
  try {
    const out = execSync(`git -C "${repoPath}" worktree list --porcelain`, { stdio: 'pipe' }).toString();
    return out
      .split('\n')
      .filter((l) => l.startsWith('worktree '))
      .map((l) => l.replace('worktree ', '').trim());
  } catch {
    return [];
  }
}

export default {
  registerWorktree,
  listWorktrees,
  releaseWorktree,
  findOrphanedWorktrees,
  cleanupOrphanedWorktrees,
  gitWorktreeList,
};
