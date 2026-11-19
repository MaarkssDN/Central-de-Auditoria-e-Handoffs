import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import {
  CENTRAL_DIR,
  RUNS_DIR,
  ParsedHandoff,
  CentralState,
  getCentralState,
  detectAgents,
  queueDispatch,
  readHandoffRaw,
} from './centralStore';
import { getLock, isLockExpired, claimLock, releaseLock } from './phase1/locks';
import { appendEvent } from './phase1/executions';
import { registerWorktree } from './phase1/worktree';
import { saveJsonAtomic } from './persistence';

const COORDINATOR_LOCK_KEY = 'coordinator';
const COORDINATOR_LEASE_MS = 10 * 60 * 1000;

export interface CoordinatorOptions {
  wave?: string;
  maxParallel?: number;
  dryRun?: boolean;
  repoPath?: string;
}

interface SlotRef { num: number; label: string }

function slotOf(h: ParsedHandoff): SlotRef | null {
  const m = h.name.match(/para-(\d+)([A-Z]?)?/i);
  if (!m) return null;
  return { num: parseInt(m[1], 10), label: `${m[1]}${(m[2] || '').toUpperCase()}` };
}

function slotsConflict(a: SlotRef, b: SlotRef): boolean {
  if (a.num === b.num) return true; // 01↔01A, 06↔06A, 08↔08A e mesmo agente
  const pair = (x: number, y: number) => (x === 16 && (y === 6 || y === 7)) || (y === 16 && (x === 6 || x === 7));
  return pair(a.num, b.num);
}

const PRIO_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

function pendingDecisionIds(state: CentralState): Set<string> {
  const pending = new Set<string>();
  for (const d of state.decisions) {
    const after = d.body.split(/Resposta:\*{0,2}/i).pop() || '';
    if (!after.replace(/[*\s]/g, '')) pending.add(d.id);
  }
  return pending;
}

function freezeActive(state: CentralState): string | null {
  const blockers = (state.state as { blockers?: string[] }).blockers || [];
  const hit = blockers.find((b) => /trava de muta|freeze|etapa 0/i.test(b));
  return hit || null;
}

function pickProvider(): { id: string; motivo: string } {
  const agents = detectAgents();
  const devin = agents.find((a) => a.id === 'devin');
  if (devin) return { id: 'devin', motivo: 'provider preferencial (subagente Devin sempre disponível nesta sessão)' };
  const cli = agents.find((a) => a.tipo === 'cli' && a.disponivel);
  if (cli) return { id: cli.id, motivo: `CLI detectada: ${cli.binarios?.map((b) => b.cmd).join(', ')}` };
  return { id: 'generico', motivo: 'nenhum provider headless disponível — pacote manual em estado/fila/' };
}

function slugify(name: string): string {
  return name.replace(/\.md$/i, '').replace(/^\d+-para-\d+[A-Z]?-/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

function ensureWorktree(repoPath: string, slot: SlotRef | null, h: ParsedHandoff, baseBranch: string): { worktree?: string; branch?: string; ok: boolean; error?: string } {
  if (!repoPath || !fs.existsSync(repoPath)) {
    return { ok: false, error: `repoPath inexistente: ${repoPath || '(vazio)'}` };
  }
  try {
    execSync(`git -C "${repoPath}" rev-parse --git-dir`, { stdio: 'pipe' });
  } catch {
    return { ok: false, error: `repoPath não é um repositório git: ${repoPath}` };
  }
  const num = slot ? String(slot.num).padStart(2, '0') : 'xx';
  const suffix = slot && slot.label.length > 2 ? slot.label.slice(2) : '';
  const branch = `agente/${num}${suffix.toLowerCase()}-${slugify(h.name).slice(0, 40)}`;
  const wtRoot = path.join(path.dirname(repoPath), `${path.basename(repoPath)}-wt`);
  const worktree = path.join(wtRoot, `ag-${num}${suffix.toLowerCase()}`);
  fs.mkdirSync(wtRoot, { recursive: true });
  try {
    execSync(`git -C "${repoPath}" rev-parse --verify "${worktree}"`, { stdio: 'pipe' });
    return { worktree, branch, ok: true }; // já existe — reutiliza
  } catch { /* não existe ainda */ }
  try {
    execSync(`git -C "${repoPath}" worktree add "${worktree}" -b "${branch}" "${baseBranch}"`, { stdio: 'pipe' });
    return { worktree, branch, ok: true };
  } catch (e) {
    return { ok: false, error: `git worktree add falhou: ${e instanceof Error ? e.message.slice(0, 300) : String(e)}` };
  }
}

function depSatisfied(dep: string, waveHandoffs: ParsedHandoff[]): { ok: boolean; detail: string } {
  const upper = dep.toUpperCase();
  const match = waveHandoffs.find((h) => {
    const raw = readHandoffRaw(h.relPath) || '';
    return raw.toUpperCase().includes(upper) || h.name.toUpperCase().includes(upper) || h.title.toUpperCase().includes(upper);
  });
  if (!match) return { ok: false, detail: `dependência "${dep}" não encontrada na onda` };
  if (match.status === 'CONCLUÍDO') return { ok: true, detail: `dependência satisfeita por ${match.name}` };
  return { ok: false, detail: `dependência "${dep}" → ${match.name} está ${match.status}` };
}

interface BatchItem {
  handoff: ParsedHandoff;
  slot: SlotRef | null;
  provider: string;
  providerMotivo: string;
  reason: string;
}

function selectBatch(state: CentralState, wave: string, activeWave: string, maxParallel: number): {
  selected: BatchItem[];
  deferred: { handoff: string; reason: string }[];
  excluded: { handoff: string; reason: string }[];
  freeze: string | null;
  pendingDecisions: string[];
} {
  const pendingDecisions = [...pendingDecisionIds(state)];
  const freeze = freezeActive(state);
  const provider = pickProvider();

  const waveHandoffs = state.handoffs.filter((h) => h.relPath.replace(/\\/g, '/').includes(`ondas/${wave}/`));
  const eligible = waveHandoffs.filter((h) => h.status === 'PENDENTE' || h.status === 'REPROVADO_24');
  const sorted = [...eligible].sort((a, b) =>
    (PRIO_RANK[a.prioridade] ?? 9) - (PRIO_RANK[b.prioridade] ?? 9) || a.name.localeCompare(b.name));

  const selected: BatchItem[] = [];
  const deferred: { handoff: string; reason: string }[] = [];
  const excluded: { handoff: string; reason: string }[] = [];
  const selectedSlots: SlotRef[] = [];

  for (const h of sorted) {
    const slot = slotOf(h);
    const base = { handoff: h.name };

    if (freeze && wave === activeWave) {
      excluded.push({ ...base, reason: `freeze de mutação ativo na onda ${activeWave}: "${freeze}" — coordenador reporta, não despacha` });
      continue;
    }
    const raw = readHandoffRaw(h.relPath) || '';
    const refs = [...raw.matchAll(/\bD-\d{2}\b/g)].map((m) => m[0]);
    const blockedBy = refs.filter((d) => pendingDecisions.includes(d));
    if (blockedBy.length) {
      excluded.push({ ...base, reason: `bloqueado por decisão humana pendente: ${[...new Set(blockedBy)].join(', ')}` });
      continue;
    }
    const lock = getLock(h.relPath);
    if (lock && !isLockExpired(lock)) {
      deferred.push({ ...base, reason: `lock ativo de ${lock.owner} até ${lock.expiresAt}` });
      continue;
    }
    const unmet = h.dependencias.map((d) => depSatisfied(d, waveHandoffs)).filter((d) => !d.ok);
    if (unmet.length) {
      deferred.push({ ...base, reason: unmet.map((u) => u.detail).join('; ') });
      continue;
    }
    if (selected.length >= maxParallel) {
      deferred.push({ ...base, reason: `concorrência máxima (${maxParallel}) atingida` });
      continue;
    }
    const conflict = slot ? selectedSlots.find((s) => slotsConflict(s, slot)) : undefined;
    const conflictH = conflict ? selected.find((it) => it.slot && slotsConflict(it.slot, slot!)) : undefined;
    if (conflict && conflictH) {
      deferred.push({ ...base, reason: `conflito de slot com ${conflictH.handoff.name} — vai para a fila seguinte` });
      continue;
    }
    if (slot) selectedSlots.push(slot);
    selected.push({
      handoff: h, slot, provider: provider.id, providerMotivo: provider.motivo,
      reason: `${h.prioridade} · deps ok · slot ${slot?.label || 'n/a'} livre · provider ${provider.id}`,
    });
  }
  return { selected, deferred, excluded, freeze, pendingDecisions };
}

function reviewPromptFor(h: ParsedHandoff, state: CentralState): string {
  const waveDir = h.relPath.split('/')[1] || '';
  const stateSnap = (state.state as { snapshot?: { localHead?: string; branch?: string } }).snapshot || {};
  return `# REVISÃO 24 — Parecer independente

Você é o Agente 24 — Revisão Independente. Leia AGENTS.md §40.

Handoff: ${path.resolve(CENTRAL_DIR, h.relPath)}
Status atual: ${h.status} | Prioridade: ${h.prioridade}
Onda: ${waveDir} | Repo: ${(state.state as { repo?: string }).repo || 'C:\\Github\\Birthub-360'}
Branch de referência do snapshot: ${stateSnap.branch || 'main'} @ ${stateSnap.localHead || '?'}

## Handoff (fonte oficial)
${readHandoffRaw(h.relPath) || '(não foi possível ler)'}

## O que auditar
1. O diff real no repo (git log/diff da branch do executor vs base) vs. o escopo declarado no handoff.
2. Propriedade de arquivos (§15) e slots exclusivos (§14) — o executor tocou arquivos de outros agentes?
3. Prioridade P1–P4, tenancy e LGPD conforme aplicável.
4. Gates: a seção ## Resolução lista comandos e exit codes reais e reproduzíveis?
5. ## Resolução preenche evidência suficiente para julgar (branch, commits, gates, limitações)?

## Saída obrigatória
1. Escreva o parecer em central/ondas/${waveDir}/revisoes/<AAAA-MM-DD>-24-${slugify(h.name)}.md
   com veredito APROVADO | REPROVADO | BLOQUEADO + motivos objetivos.
2. Atualize o handoff na central: Status → CONCLUÍDO (se APROVADO) ou REPROVADO_24 (se REPROVADO).
3. NÃO edite código do repositório. NÃO faça push/merge.
`;
}

export function runCoordinator(opts: CoordinatorOptions): { status: number; body: Record<string, unknown> } {
  const state = getCentralState();
  const wave = opts.wave || (state.state as { activeWave?: string }).activeWave || state.waves[0]?.name || '';
  const activeWave = (state.state as { activeWave?: string }).activeWave || wave;
  const maxParallel = Math.max(1, Math.min(8, opts.maxParallel || (state.state as { concurrencyRules?: { maxParallel?: number } }).concurrencyRules?.maxParallel || 3));
  const dryRun = opts.dryRun !== false;
  const repoPath = opts.repoPath || (state.state as { repo?: string }).repo || '';
  const baseBranch = (state.state as { snapshot?: { branch?: string } }).snapshot?.branch || 'main';

  const { selected, deferred, excluded, freeze, pendingDecisions } = selectBatch(state, wave, activeWave, maxParallel);

  const runId = `run-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}-${crypto.randomBytes(3).toString('hex')}`;
  const report: Record<string, unknown> = {
    runId, ts: new Date().toISOString(), wave, dryRun, maxParallel, repoPath, baseBranch,
    freeze: freeze || null, pendingDecisions,
    proposed: selected.map((it) => ({
      handoff: it.handoff.relPath, agent: it.handoff.para || slotOf(it.handoff)?.label || '?',
      prioridade: it.handoff.prioridade, provider: it.provider, motivo: it.reason,
    })),
    deferred, excluded,
    dispatched: [] as unknown[], reviews: [] as unknown[], errors: [] as unknown[],
  };

  const persist = () => {
    fs.mkdirSync(RUNS_DIR, { recursive: true });
    const file = path.join(RUNS_DIR, `${runId}.json`);
    (report as { reportFile?: string }).reportFile = path.relative(CENTRAL_DIR, file).replace(/\\/g, '/');
    saveJsonAtomic(file, report);
  };

  if (dryRun) {
    persist();
    return { status: 200, body: report };
  }

  // Trava single-run do coordenador
  const coordClaim = claimLock({
    handoffRelPath: COORDINATOR_LOCK_KEY, owner: 'coordinator',
    executionId: runId, ttlMs: COORDINATOR_LEASE_MS,
  });
  if (!coordClaim.ok) {
    persist();
    return { status: 409, body: { ...report, error: `Coordenador já em execução por '${coordClaim.conflict.owner}' até ${coordClaim.conflict.expiresAt}.` } };
  }

  try {
    const dispatched = report.dispatched as Record<string, unknown>[];
    const errors = report.errors as Record<string, unknown>[];
    const reviews = report.reviews as Record<string, unknown>[];

    for (const it of selected) {
      const h = it.handoff;
      const wt = ensureWorktree(repoPath, it.slot, h, baseBranch);
      if (!wt.ok) {
        errors.push({ handoff: h.relPath, stage: 'worktree', error: wt.error });
        appendEvent({
          executionId: runId, handoff: h.relPath.replace(/\\/g, '/'), type: 'ADAPTER_FAILED',
          actor: 'coordinator', detail: `worktree falhou: ${wt.error}`,
        });
        continue;
      }
      if (wt.worktree && wt.branch) {
        registerWorktree({
          path: wt.worktree, branch: wt.branch, repoPath,
          handoff: h.relPath.replace(/\\/g, '/'), owner: it.provider,
        });
      }
      const q = queueDispatch({
        handoffRelPath: h.relPath, agentId: it.provider,
        worktree: wt.worktree, branch: wt.branch, repoPath,
      });
      if (!q.ok) {
        errors.push({ handoff: h.relPath, stage: 'dispatch', error: q.error });
        continue;
      }
      const execId = getLock(h.relPath)?.executionId || runId;
      appendEvent({
        executionId: execId, handoff: h.relPath.replace(/\\/g, '/'), type: 'DISPATCHED',
        actor: it.provider, detail: `Lote do coordenador ${runId} — provider ${it.provider}`,
        meta: { runId, worktree: wt.worktree, branch: wt.branch, promptFile: q.promptFile },
      });
      dispatched.push({
        handoff: h.relPath, agent: h.para, provider: it.provider, priority: h.prioridade,
        execId, worktree: wt.worktree, branch: wt.branch, promptFile: q.promptFile,
      });
    }

    // Revisão 24 automática para handoffs AGUARDANDO_24 da onda
    const waveDir = wave;
    const filaDir = path.join(CENTRAL_DIR, 'estado', 'fila');
    fs.mkdirSync(filaDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const alreadyQueued = new Set(
      fs.existsSync(filaDir) ? fs.readdirSync(filaDir).filter((f) => f.includes('-24-review-')) : []);
    for (const h of state.handoffs) {
      if (h.status !== 'AGUARDANDO_24') continue;
      if (!h.relPath.replace(/\\/g, '/').includes(`ondas/${waveDir}/`)) continue;
      const slug = slugify(h.name);
      if ([...alreadyQueued].some((f) => f.endsWith(`-24-review-${slug}.md`))) {
        reviews.push({ handoff: h.relPath, skipped: 'revisão 24 já enfileirada em estado/fila/' });
        continue;
      }
      const outFile = path.join(filaDir, `${stamp}-24-review-${slug}.md`);
      saveJsonAtomic(outFile, reviewPromptFor(h, state));
      appendEvent({
        executionId: runId, handoff: h.relPath.replace(/\\/g, '/'), type: 'DISPATCHED',
        actor: 'agente-24', detail: `Revisão 24 enfileirada: ${path.basename(outFile)}`,
        meta: { kind: 'review-24', promptFile: path.basename(outFile) },
      });
      reviews.push({ handoff: h.relPath, promptFile: path.relative(CENTRAL_DIR, outFile).replace(/\\/g, '/') });
    }
  } finally {
    releaseLock({ handoffRelPath: COORDINATOR_LOCK_KEY, executionId: runId });
    persist();
  }

  return { status: 200, body: report };
}
