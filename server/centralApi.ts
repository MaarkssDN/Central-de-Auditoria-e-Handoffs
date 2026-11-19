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

export function createCentralRouter(): Router {
  const router = Router();

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
    const result = updateHandoffStatus(file, status, resolution);
    if (!result.ok) {
      res.status(400).json(result);
      return;
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
    res.json(result);
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
