import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import {
  CENTRAL_DIR,
  buildDispatchPrompt,
  detectAgents,
  getCentralState,
  queueDispatch,
  updateHandoffStatus,
} from './centralStore';
import { emitCentralEvent, recentCentralEvents, sseHandler } from './centralEvents';
import { appendExecution, activeExecutions, promptHash, readExecutions } from './centralExecutions';
import { getCentralMetrics } from './centralMetrics';
import { createPullRequest } from './centralGithub';
import { notificationsConfigured } from './centralNotify';
import { runCoordinator } from './coordinator';
import { buildWaveReportHtml } from './centralReport';
import { handoffTemplate, onboardWave, type OnboardWaveInput } from './waveOnboarding';
import {
  claimLock,
  releaseLock,
  renewLock,
  getLock,
  listLocks,
} from './phase1/locks';
import { appendEvent } from './phase1/executions';
import { registerWorktree, findOrphanedWorktrees, listWorktrees } from './phase1/worktree';
import { getAdapter, type AdapterKind } from './phase1/adapters';
import {
  getDbStats,
  getChatMessages,
  saveChatMessage,
  clearChatMessages,
} from './db';
import './centralNotify';

function currentStatusOf(relPath: string): string {
  const abs = path.resolve(CENTRAL_DIR, relPath);
  if (!abs.startsWith(CENTRAL_DIR) || !fs.existsSync(abs)) return '';
  const m = fs.readFileSync(abs, 'utf-8').match(/^- Status:[ \t]*(.*)$/m);
  return (m?.[1] || '').trim().toUpperCase();
}

export function createCentralRouter(): Router {
  const router = Router();

  // ── Fase 3: observabilidade ──────────────────────────────────────────
  router.get('/events', (req, res) => sseHandler(req, res));
  router.get('/events/recent', (_req, res) => res.json({ events: recentCentralEvents(100) }));

  router.get('/metrics', (_req, res) => res.json(getCentralMetrics()));

  // ── SQLite: status e histórico de chat ────────────────────────────────
  router.get('/db-stats', (_req, res) => {
    try {
      res.json(getDbStats());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  router.get('/chat/messages', (req, res) => {
    const { sessionId = 'default', limit, offset } = req.query as {
      sessionId?: string;
      limit?: string;
      offset?: string;
    };
    try {
      const messages = getChatMessages(
        sessionId,
        limit ? Number(limit) : 100,
        offset ? Number(offset) : 0,
      );
      res.json({ messages });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  router.post('/chat/messages', (req, res) => {
    const { sessionId = 'default', role, content, agentId } = req.body as {
      sessionId?: string;
      role?: string;
      content?: string;
      agentId?: string;
    };
    if (!role || !content) {
      res.status(400).json({ error: 'Informe role e content para a mensagem.' });
      return;
    }
    try {
      const id = saveChatMessage(sessionId, role, content, agentId);
      res.status(201).json({ id, ok: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  router.delete('/chat/messages', (req, res) => {
    const { sessionId } = req.query as { sessionId?: string };
    try {
      const changes = clearChatMessages(sessionId);
      res.json({ cleared: changes, ok: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  router.get('/executions', (req, res) => {
    const { days, handoff, limit, active } = req.query as Record<string, string>;
    if (active === '1') return res.json({ executions: activeExecutions() });
    res.json({
      executions: readExecutions({
        days: days ? Number(days) : undefined,
        handoff: handoff || undefined,
        limit: limit ? Number(limit) : undefined,
      }),
    });
  });

  router.post('/github/pr', async (req, res) => {
    const { handoff, branch, repoPath, base, title, body, agent, provider } = req.body as {
      handoff?: string; branch?: string; repoPath?: string; base?: string;
      title?: string; body?: string; agent?: string; provider?: string;
    };
    if (!handoff || !branch) {
      res.status(400).json({ ok: false, error: 'Informe handoff e branch.' });
      return;
    }
    const result = await createPullRequest({
      handoff, branch, repoPath: repoPath || 'C:\\Github\\Birthub-360',
      base, title, body, agent, provider,
    });
    res.status(result.ok ? 200 : 502).json(result);
  });

  router.post('/coordinator/run', (req, res) => {
    const { wave, maxParallel, dryRun, repoPath } = req.body as {
      wave?: string; maxParallel?: number; dryRun?: boolean; repoPath?: string;
    };
    const result = runCoordinator({ wave, maxParallel, dryRun, repoPath });
    const body = result.body as { runId?: string; proposed?: unknown[]; dispatched?: unknown[]; errors?: unknown[] };
    if (!dryRun) {
      emitCentralEvent('coordinator_run_done', {
        runId: body.runId,
        wave: wave || 'auto',
        proposed: Array.isArray(body.proposed) ? body.proposed.length : 0,
        dispatched: Array.isArray(body.dispatched) ? body.dispatched.length : 0,
        errors: Array.isArray(body.errors) ? body.errors.length : 0,
      });
    }
    res.status(result.status).json(result.body);
  });

  router.get('/coordinator/runs', (_req, res) => {
    const dir = path.join(CENTRAL_DIR, 'estado', 'coordinator-runs');
    if (!fs.existsSync(dir)) return res.json({ runs: [] });
    const runs = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse().slice(0, 20)
      .map((f) => {
        try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')); }
        catch { return { file: f, error: 'corrompido' }; }
      });
    res.json({ runs });
  });

  router.get('/notifications/status', (_req, res) => {
    res.json({
      configured: notificationsConfigured(),
      webhook: process.env.CENTRAL_NOTIFY_WEBHOOK ? '***configurado***' : null,
      events: (process.env.CENTRAL_NOTIFY_EVENTS || 'default').split(','),
    });
  });

  // ── Fase 4: relatório executivo + onboarding de onda ─────────────────
  router.get('/report', (req, res) => {
    const { wave, format } = req.query as Record<string, string>;
    const state = getCentralState();
    if ((format || 'html') !== 'html') {
      res.status(400).json({ error: "Formato não suportado. Use format=html." });
      return;
    }
    res.type('text/html; charset=utf-8').send(buildWaveReportHtml(state, wave || undefined));
  });

  router.get('/waves/template', (_req, res) => {
    res.type('text/markdown; charset=utf-8').send(handoffTemplate(
      { para: '00', titulo: 'Título do handoff', prioridade: 'P2' },
      'nome-da-onda', 1, { repoPath: 'C:\\Github\\repo', baseline: 'main' },
    ));
  });

  router.post('/waves/onboard', (req, res) => {
    const body = req.body as OnboardWaveInput;
    if (!body?.name || !Array.isArray(body.handoffs)) {
      res.status(400).json({ ok: false, error: 'Informe name e handoffs[] (para, titulo, prioridade, dependencias).' });
      return;
    }
    const result = onboardWave(body);
    res.status(result.ok ? 201 : 400).json(result);
  });

  // ── Fase 0/1: estado e leitura ───────────────────────────────────────
  router.get('/state', (_req, res) => {
    res.json(getCentralState());
  });

  router.get('/doc', (req, res) => {
    const rel = String(req.query.path || '');
    const abs = path.resolve(CENTRAL_DIR, rel);
    if (!abs.startsWith(CENTRAL_DIR) || !fs.existsSync(abs)) {
      res.status(404).json({ error: 'Documento não encontrado.' });
      return;
    }
    res.type('text/plain; charset=utf-8').send(fs.readFileSync(abs, 'utf-8'));
  });

  router.post('/handoffs/status', (req, res) => {
    const { file, status, resolution } = req.body as { file?: string; status?: string; resolution?: string };
    if (!file || !status) {
      res.status(400).json({ error: 'Informe file e status.' });
      return;
    }
    const from = currentStatusOf(file);
    const result = updateHandoffStatus(file, status, resolution);
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    const to = status.toUpperCase();
    appendExecution({
      handoff: file,
      action: 'status',
      notes: `${from || '?'} → ${to}`,
    });
    emitCentralEvent('handoff_status_changed', { file, from, to });
    if (to === 'REPROVADO_24' || to === 'BLOQUEADO' || to === 'CONCLUÍDO' || to === 'AGUARDANDO_24') {
      emitCentralEvent('decision_pending', { file, reason: `status ${to}` });
    }
    res.json({ ok: true });
  });

  router.post('/dispatch', (req, res) => {
    const { handoff, agentId, worktree, branch, repoPath } = req.body as {
      handoff?: string; agentId?: string; worktree?: string; branch?: string; repoPath?: string;
    };
    if (!handoff) {
      res.status(400).json({ error: 'Informe handoff (caminho relativo na central).' });
      return;
    }
    const result = queueDispatch({
      handoffRelPath: handoff,
      agentId: agentId || 'generico',
      worktree, branch, repoPath,
    });
    if (!result.ok) {
      res.status(result.conflict ? 409 : 400).json(result);
      return;
    }

    // Fase 1/3: registra execução e emite eventos de ciclo de vida
    const abs = path.resolve(CENTRAL_DIR, handoff);
    let hash = '';
    try { hash = promptHash(fs.readFileSync(abs, 'utf-8')); } catch { /* ok */ }
    const exec = appendExecution({
      handoff,
      agent: agentId || 'generico',
      provider: agentId || 'manual',
      action: 'dispatch',
      promptHash: hash,
      branch: branch || null,
      worktree: worktree || null,
      notes: `prompt enfileirado: ${result.promptFile}`,
    });
    emitCentralEvent('handoff_dispatched', {
      handoff, agent: agentId || 'generico', execId: exec.execId,
      promptFile: result.promptFile, worktree, branch,
    });
    res.json({ ...result, execId: exec.execId });
  });

  router.get('/agents/detect', (_req, res) => {
    res.json({ agentes: detectAgents() });
  });

  router.get('/prompt', (req, res) => {
    const { handoff, agentId, worktree, branch } = req.query as Record<string, string>;
    if (!handoff) {
      res.status(400).json({ error: 'Informe handoff.' });
      return;
    }
    const abs = path.resolve(CENTRAL_DIR, handoff);
    if (!abs.startsWith(CENTRAL_DIR) || !fs.existsSync(abs)) {
      res.status(404).json({ error: 'Handoff não encontrado.' });
      return;
    }
    const prompt = buildDispatchPrompt({
      handoffAbsPath: abs,
      agentName: agentId || 'agente',
      worktree, branch,
    });
    res.type('text/plain; charset=utf-8').send(prompt);
  });


  // ── Fase 1: locks/lease ────────────────────────────────────────────
  router.get('/locks', (_req, res) => {
    res.json({ locks: listLocks() });
  });

  router.post('/locks/claim', (req, res) => {
    const { handoff, owner, executionId, ttlMs, worktree } = req.body as {
      handoff?: string; owner?: string; executionId?: string; ttlMs?: number; worktree?: string;
    };
    if (!handoff || !owner) {
      res.status(400).json({ error: 'Informe handoff e owner.' });
      return;
    }
    const result = claimLock({ handoffRelPath: handoff, owner, executionId, ttlMs, worktree });
    if (!result.ok) {
      res.status(409).json({ error: 'Lock em conflito.', conflict: result.conflict });
      return;
    }
    appendEvent({
      executionId: result.lock.executionId,
      handoff: handoff.replace(/\\/g, '/'),
      type: 'LOCK_CLAIMED',
      actor: owner,
      detail: `Lock adquirido por '${owner}' até ${result.lock.expiresAt}`,
      meta: { stolen: result.stolen || false, worktree },
    });
    emitCentralEvent('lock_claimed', { handoff, owner, executionId: result.lock.executionId });
    res.json({ ok: true, lock: result.lock, stolen: result.stolen || false });
  });

  router.post('/locks/release', (req, res) => {
    const { handoff, owner, executionId } = req.body as {
      handoff?: string; owner?: string; executionId?: string;
    };
    if (!handoff) {
      res.status(400).json({ error: 'Informe handoff.' });
      return;
    }
    const existing = getLock(handoff);
    const result = releaseLock({ handoffRelPath: handoff, owner, executionId });
    if (!result.ok) {
      res.status(409).json(result);
      return;
    }
    if (existing) {
      appendEvent({
        executionId: existing.executionId,
        handoff: handoff.replace(/\\/g, '/'),
        type: 'LOCK_RELEASED',
        actor: owner || existing.owner,
        detail: 'Lock liberado',
      });
      emitCentralEvent('lock_released', { handoff, owner: owner || existing.owner });
    }
    res.json(result);
  });

  router.post('/locks/renew', (req, res) => {
    const { handoff, executionId, ttlMs } = req.body as {
      handoff?: string; executionId?: string; ttlMs?: number;
    };
    if (!handoff || !executionId) {
      res.status(400).json({ error: 'Informe handoff e executionId.' });
      return;
    }
    const result = renewLock({ handoffRelPath: handoff, executionId, ttlMs });
    if (!result.ok) {
      res.status(409).json(result);
      return;
    }
    res.json(result);
  });

  router.get('/worktrees', (_req, res) => {
    res.json({ worktrees: listWorktrees(), orphaned: findOrphanedWorktrees() });
  });

  // ── Fase 1: dispatch/execute com adapter real ─────────────────────
  router.post('/dispatch/execute', async (req, res) => {
    const {
      handoff, agentId, provider, worktree, branch, repoPath,
      command, timeoutMs, prompt: promptOverride,
    } = req.body as {
      handoff?: string; agentId?: string; provider?: string; worktree?: string;
      branch?: string; repoPath?: string; command?: string; timeoutMs?: number;
      prompt?: string;
    };
    if (!handoff) {
      res.status(400).json({ error: 'Informe handoff (caminho relativo na central).' });
      return;
    }
    const abs = path.resolve(CENTRAL_DIR, handoff);
    if (!abs.startsWith(CENTRAL_DIR) || !fs.existsSync(abs)) {
      res.status(404).json({ error: 'Handoff não encontrado.' });
      return;
    }

    const owner = agentId || provider || 'executor';
    const claim = claimLock({ handoffRelPath: handoff, owner, worktree });
    if (!claim.ok) {
      res.status(409).json({
        error: `Handoff já em execução por '${claim.conflict.owner}' até ${claim.conflict.expiresAt}.`,
        conflict: claim.conflict,
      });
      return;
    }
    const { executionId } = claim.lock;
    const relHandoff = handoff.replace(/\\/g, '/');
    appendEvent({
      executionId, handoff: relHandoff, type: 'CREATED', actor: owner,
      detail: 'Execução criada via /dispatch/execute',
      meta: { provider, agentId, worktree, branch },
    });

    const prompt = promptOverride || buildDispatchPrompt({
      handoffAbsPath: abs,
      agentName: owner,
      worktree, branch, repoPath,
    });

    const kind = (provider === 'gemini-api' ? 'gemini' : provider || 'cli') as AdapterKind;
    const adapter = getAdapter(kind);
    appendEvent({
      executionId, handoff: relHandoff, type: 'ADAPTER_STARTED', actor: owner,
      detail: `Adapter '${kind}' iniciado`,
    });
    emitCentralEvent('exec_started', { handoff, execId: executionId, agent: owner });

    if (worktree) {
      registerWorktree({
        path: worktree, branch, repoPath,
        executionId, handoff: relHandoff, owner,
      });
    }

    try {
      if (kind === 'cli' && command) {
        process.env.CENTRAL_CLI_COMMAND = command;
      }
      const result = await adapter.execute({
        executionId,
        handoffRelPath: handoff,
        prompt,
        worktree, branch, repoPath,
        agentId,
        timeoutMs,
      });
      const done = result.status === 'SUCCEEDED';
      appendEvent({
        executionId, handoff: relHandoff,
        type: done ? 'ADAPTER_COMPLETED' : 'ADAPTER_FAILED',
        actor: owner,
        detail: `Adapter '${kind}' finalizou: ${result.status} (exit ${result.exitCode ?? 'n/a'})`,
        meta: { exitCode: result.exitCode, sessionId: result.sessionId, durationMs: result.durationMs },
      });
      appendExecution({
        handoff, agent: owner, provider: kind, action: done ? 'complete' : 'fail',
        exitCode: result.exitCode ?? null, durationMs: result.durationMs,
        branch: branch || null, worktree: worktree || null,
        notes: `dispatch/execute ${result.status}`,
      });
      emitCentralEvent('exec_done', {
        handoff, execId: executionId, status: result.status,
      });
      if (done || result.status === 'FAILED') {
        releaseLock({ handoffRelPath: handoff, executionId });
      }
      res.json({ ok: done, executionId, result });
    } catch (e) {
      appendEvent({
        executionId, handoff: relHandoff, type: 'ADAPTER_FAILED',
        actor: owner, detail: (e as Error).message,
      });
      appendExecution({
        handoff, agent: owner, provider: kind, action: 'fail',
        notes: (e as Error).message,
      });
      releaseLock({ handoffRelPath: handoff, executionId });
      res.status(500).json({ ok: false, executionId, error: (e as Error).message });
    }
  });

  return router;
}
