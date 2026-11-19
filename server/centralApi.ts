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
      res.status(400).json(result);
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

  return router;
}
