import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { DEFAULT_PRIORITY_BLOCKERS } from './src/data/agentsRoster';
import { createSeedWorkspace } from './src/data/seedWorkspace';
import type { RepositoryTarget, Wave, WorkspaceState } from './src/types/governance';
import { buildGatesForRepoScripts } from './src/utils/governanceEngine';
import {
  buildWebhookPayload,
  validateWebhookConfig,
  type WebhookEventType,
} from './src/utils/webhookNotifier';
import { runAgentBotTurn, runSwarmSequence } from './server/agentRuntime';
import { createCentralRouter } from './server/centralApi';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'workspace.json');

function ensureStore(): WorkspaceState {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const seed = createSeedWorkspace();
    fs.writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    return JSON.parse(raw) as WorkspaceState;
  } catch {
    const seed = createSeedWorkspace();
    fs.writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
}

function saveStore(state: WorkspaceState) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

function parseGitHubRepoInput(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().replace(/\.git$/, '').replace(/\/+$/, '');
  const urlMatch = trimmed.match(/github\.com\/([^/]+)\/([^/]+)$/i);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }
  const slugMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (slugMatch) {
    return { owner: slugMatch[1], repo: slugMatch[2] };
  }
  return null;
}

async function fetchGitHubJson(url: string) {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'central-auditoria-handoffs',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return fetch(url, { headers });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.use('/api/central', createCentralRouter());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/workspace', (_req, res) => {
    const state = ensureStore();
    res.json(state);
  });

  app.put('/api/workspace', (req, res) => {
    const body = req.body as WorkspaceState;
    if (!body || !Array.isArray(body.repositories) || !Array.isArray(body.waves)) {
      res.status(400).json({ error: 'Payload de workspace inválido.' });
      return;
    }
    saveStore(body);
    res.json(body);
  });

  app.post('/api/workspace/reset', (_req, res) => {
    const seed = createSeedWorkspace();
    saveStore(seed);
    res.json(seed);
  });

  app.post('/api/webhooks/dispatch', async (req, res) => {
    const { provider, url, eventType, repoFullName, title, details, severity, channelLabel } = req.body as {
      provider?: 'slack' | 'discord';
      url?: string;
      eventType?: WebhookEventType;
      repoFullName?: string;
      title?: string;
      details?: string;
      severity?: 'info' | 'warning' | 'critical';
      channelLabel?: string;
    };

    if (!provider || (provider !== 'slack' && provider !== 'discord')) {
      res.status(400).json({ ok: false, error: 'Provedor inválido. Use slack ou discord.' });
      return;
    }

    const check = validateWebhookConfig(provider, String(url || ''));
    if (!check.valid || !check.normalizedUrl) {
      res.status(400).json({ ok: false, error: check.error || 'URL de webhook inválida.' });
      return;
    }

    const payload = buildWebhookPayload({
      provider,
      url: check.normalizedUrl,
      eventType: eventType ?? 'test',
      repoFullName: repoFullName || 'repositório',
      title: title || 'Evento de Governança',
      details: details || 'Notificação emitida pela Central de Auditoria e Handoffs.',
      severity: severity ?? 'info',
      channelLabel,
    });

    try {
      const hookRes = await fetch(check.normalizedUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        redirect: 'manual',
      });
      if (!hookRes.ok) {
        const errBody = await hookRes.text().catch(() => '');
        res.status(502).json({
          ok: false,
          status: hookRes.status,
          error: `Webhook retornou HTTP ${hookRes.status}${errBody ? `: ${errBody.slice(0, 140)}` : ''}`,
        });
        return;
      }
      res.json({
        ok: true,
        status: hookRes.status,
        deliveredAt: new Date().toISOString(),
        message: `Notificação entregue com sucesso ao ${provider === 'slack' ? 'Slack' : 'Discord'}.`,
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        error: err instanceof Error ? `Falha de rede ao enviar webhook: ${err.message}` : 'Falha de rede ao enviar webhook.',
      });
    }
  });

  app.post('/api/github/inspect', async (req, res) => {
    const { repoInput } = req.body as { repoInput?: string };
    if (!repoInput || typeof repoInput !== 'string') {
      res.status(400).json({ error: 'Informe owner/repo ou URL do GitHub.' });
      return;
    }

    const parsed = parseGitHubRepoInput(repoInput);
    if (!parsed) {
      res.status(400).json({ error: 'Formato inválido. Use owner/repo ou https://github.com/owner/repo.' });
      return;
    }

    try {
      const repoRes = await fetchGitHubJson(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`);
      if (!repoRes.ok) {
        const status = repoRes.status;
        const message =
          status === 404
            ? 'Repositório não encontrado ou privado na API pública do GitHub.'
            : status === 403
              ? 'Limite de requisições da API do GitHub atingido. Use importação manual ou configure GITHUB_TOKEN.'
              : `Erro da API do GitHub (HTTP ${status}).`;
        res.status(status === 404 ? 404 : 502).json({ error: message });
        return;
      }

      const repoJson = (await repoRes.json()) as {
        name: string;
        full_name: string;
        html_url: string;
        default_branch: string;
      };

      const defaultBranch = repoJson.default_branch || 'main';
      let branches: string[] = [defaultBranch];
      let samplePaths: string[] = [];
      let detectedAgentsMd = false;
      let packageScripts: Record<string, string> = {};
      let existingHandoffFiles: string[] = [];
      let existingReviewFiles: string[] = [];

      const [branchesRes, treeRes, pkgRes] = await Promise.all([
        fetchGitHubJson(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/branches?per_page=15`),
        fetchGitHubJson(
          `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`
        ),
        fetchGitHubJson(
          `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/package.json?ref=${encodeURIComponent(defaultBranch)}`
        ),
      ]);

      if (branchesRes.ok) {
        const bList = (await branchesRes.json()) as Array<{ name: string }>;
        if (Array.isArray(bList) && bList.length > 0) {
          branches = bList.map((b) => b.name);
        }
      }

      if (treeRes.ok) {
        const treeJson = (await treeRes.json()) as { tree?: Array<{ path: string; type: string }> };
        const allPaths = (treeJson.tree || []).filter((t) => t.type === 'blob').map((t) => t.path);
        detectedAgentsMd = allPaths.some((p) => p === 'AGENTS.md' || p.endsWith('/AGENTS.md'));
        existingHandoffFiles = allPaths.filter((p) => p.startsWith('.agents/handoffs/'));
        existingReviewFiles = allPaths.filter((p) => p.startsWith('.agents/reviews/'));
        samplePaths = allPaths.slice(0, 80);
      }

      if (pkgRes.ok) {
        const pkgData = (await pkgRes.json()) as { content?: string; encoding?: string };
        if (pkgData.content && pkgData.encoding === 'base64') {
          try {
            const decoded = Buffer.from(pkgData.content, 'base64').toString('utf-8');
            const parsedPkg = JSON.parse(decoded) as { scripts?: Record<string, string> };
            if (parsedPkg.scripts && typeof parsedPkg.scripts === 'object') {
              packageScripts = parsedPkg.scripts;
            }
          } catch {
            // Ignore malformed package.json
          }
        }
      }

      const repoId = `repo-${repoJson.full_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const newRepo: RepositoryTarget = {
        id: repoId,
        name: repoJson.name,
        fullName: repoJson.full_name,
        sourceType: 'github',
        url: repoJson.html_url,
        defaultBranch,
        branches,
        detectedAgentsMd,
        packageScripts,
        samplePaths,
        existingHandoffFiles,
        existingReviewFiles,
        lastSyncedAt: new Date().toISOString(),
        blockers: DEFAULT_PRIORITY_BLOCKERS.map((b) => ({ ...b, status: 'aberto' })),
      };

      const initialWave: Wave = {
        id: `wave-${repoId}-1`,
        repoId,
        number: 1,
        name: `Onda 1 — Auditoria Inicial (${repoJson.name})`,
        integrationBranch: 'integracao/onda-1',
        state: 'PLANEJADA',
        scopeFreezeActive: false,
        activeAgentIds: ['00'],
        mergesSinceLastGate: 0,
        gates: buildGatesForRepoScripts(packageScripts),
        createdAt: new Date().toISOString(),
      };

      res.json({ repository: newRepo, initialWave });
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Falha ao consultar API do GitHub.',
      });
    }
  });

  app.post('/api/agents/execute', async (req, res) => {
    const { agentId, prompt, workspace: clientWorkspace } = req.body as {
      agentId?: string;
      prompt?: string;
      workspace?: WorkspaceState;
    };

    if (!agentId || !prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Informe agentId e prompt para acionar o agente.' });
      return;
    }

    const baseState = clientWorkspace && Array.isArray(clientWorkspace.repositories)
      ? clientWorkspace
      : ensureStore();

    if (!baseState.botMessages) {
      baseState.botMessages = [];
    }
    baseState.botMessages.push({
      id: `usr-${Date.now().toString(36)}`,
      repoId: baseState.activeRepoId,
      agentId,
      role: 'user',
      content: prompt.trim(),
      timestamp: new Date().toISOString(),
    });

    try {
      const { replyMessage, updatedWorkspace } = await runAgentBotTurn({
        agentId,
        prompt: prompt.trim(),
        workspace: baseState,
      });
      saveStore(updatedWorkspace);
      res.json({ replyMessage, workspace: updatedWorkspace });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao executar agente autônomo.';
      const status = message.includes('GEMINI_API_KEY') ? 503 : 502;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/agents/swarm-turn', async (req, res) => {
    const { specialistAgentId, missionGoal, workspace: clientWorkspace } = req.body as {
      specialistAgentId?: string;
      missionGoal?: string;
      workspace?: WorkspaceState;
    };

    if (!specialistAgentId || !missionGoal || !missionGoal.trim()) {
      res.status(400).json({ error: 'Informe specialistAgentId e missionGoal para o enxame.' });
      return;
    }

    const baseState = clientWorkspace && Array.isArray(clientWorkspace.repositories)
      ? clientWorkspace
      : ensureStore();

    if (!baseState.botMessages) {
      baseState.botMessages = [];
    }
    baseState.botMessages.push({
      id: `usr-swarm-${Date.now().toString(36)}`,
      repoId: baseState.activeRepoId,
      agentId: specialistAgentId,
      role: 'user',
      content: `[Enxame 00 → ${specialistAgentId} → 24] ${missionGoal.trim()}`,
      timestamp: new Date().toISOString(),
    });

    try {
      const { messages, updatedWorkspace } = await runSwarmSequence({
        specialistAgentId,
        missionGoal: missionGoal.trim(),
        workspace: baseState,
      });
      saveStore(updatedWorkspace);
      res.json({ messages, workspace: updatedWorkspace });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao executar turno do enxame.';
      const status = message.includes('GEMINI_API_KEY') ? 503 : 502;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/agents/execute-stream', async (req, res) => {
    const { agentId, prompt, workspace: clientWorkspace } = req.body as {
      agentId?: string;
      prompt?: string;
      workspace?: WorkspaceState;
    };

    if (!agentId || !prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Informe agentId e prompt para acionar o agente.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (payload: unknown) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const baseState =
      clientWorkspace && Array.isArray(clientWorkspace.repositories)
        ? clientWorkspace
        : ensureStore();

    if (!baseState.botMessages) {
      baseState.botMessages = [];
    }
    baseState.botMessages.push({
      id: `usr-${Date.now().toString(36)}`,
      repoId: baseState.activeRepoId,
      agentId,
      role: 'user',
      content: prompt.trim(),
      timestamp: new Date().toISOString(),
    });

    const heartbeat = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 8000);

    try {
      const { updatedWorkspace } = await runAgentBotTurn({
        agentId,
        prompt: prompt.trim(),
        workspace: baseState,
        onEvent: (ev) => sendEvent(ev),
      });
      saveStore(updatedWorkspace);
      res.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao executar agente autônomo.';
      const status = message.includes('GEMINI_API_KEY') ? 503 : 502;
      sendEvent({ type: 'error', error: message, status });
      res.end();
    } finally {
      clearInterval(heartbeat);
    }
  });

  app.post('/api/agents/swarm-turn-stream', async (req, res) => {
    const { specialistAgentId, missionGoal, workspace: clientWorkspace } = req.body as {
      specialistAgentId?: string;
      missionGoal?: string;
      workspace?: WorkspaceState;
    };

    if (!specialistAgentId || !missionGoal || !missionGoal.trim()) {
      res.status(400).json({ error: 'Informe specialistAgentId e missionGoal para o enxame.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (payload: unknown) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const baseState =
      clientWorkspace && Array.isArray(clientWorkspace.repositories)
        ? clientWorkspace
        : ensureStore();

    if (!baseState.botMessages) {
      baseState.botMessages = [];
    }
    baseState.botMessages.push({
      id: `usr-swarm-${Date.now().toString(36)}`,
      repoId: baseState.activeRepoId,
      agentId: specialistAgentId,
      role: 'user',
      content: `[Enxame 00 → ${specialistAgentId} → 24] ${missionGoal.trim()}`,
      timestamp: new Date().toISOString(),
    });

    const heartbeat = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 8000);

    try {
      const { updatedWorkspace } = await runSwarmSequence({
        specialistAgentId,
        missionGoal: missionGoal.trim(),
        workspace: baseState,
        onEvent: (ev) => sendEvent(ev),
      });
      saveStore(updatedWorkspace);
      res.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao executar turno do enxame.';
      const status = message.includes('GEMINI_API_KEY') ? 503 : 502;
      sendEvent({ type: 'error', error: message, status });
      res.end();
    } finally {
      clearInterval(heartbeat);
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Central de Auditoria e Handoffs executando em http://localhost:${PORT}`);
  });
}

startServer();
