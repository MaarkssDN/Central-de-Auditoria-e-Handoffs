const fs = require('fs');
const f = 'server/centralApi.ts';
let t = fs.readFileSync(f, 'utf8');

// imports
t = t.replace(
  "} from './centralStore';",
  `} from './centralStore';
import {
  claimLock,
  releaseLock,
  renewLock,
  getLock,
  listLocks,
} from './phase1/locks';
import { listExecutions, getExecution, appendEvent } from './phase1/executions';
import { registerWorktree, findOrphanedWorktrees, listWorktrees } from './phase1/worktree';
import { getAdapter, type AdapterKind } from './phase1/adapters';`
);

const routes = `
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
    const result = releaseLock({ handoffRelPath: handoff, owner, executionId });
    if (!result.ok) {
      res.status(409).json(result);
      return;
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

  router.get('/locks', (_req, res) => {
    res.json({ locks: listLocks() });
  });

  router.get('/executions', (req, res) => {
    const { handoff, limit, id } = req.query as Record<string, string>;
    if (id) {
      const rec = getExecution(id);
      if (!rec) { res.status(404).json({ error: 'Execução não encontrada.' }); return; }
      res.json(rec);
      return;
    }
    res.json({
      executions: listExecutions({ handoff, limit: limit ? Number(limit) : undefined }),
    });
  });

  router.get('/worktrees', (_req, res) => {
    res.json({ worktrees: listWorktrees(), orphaned: findOrphanedWorktrees() });
  });

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
        error: \`Handoff já em execução por '\${claim.conflict.owner}' até \${claim.conflict.expiresAt}.\`,
        conflict: claim.conflict,
      });
      return;
    }
    const { executionId } = claim.lock;
    appendEvent({
      executionId, handoff: handoff.replace(/\\\\/g, '/'), type: 'CREATED',
      actor: owner, detail: 'Execução criada via /dispatch/execute',
      meta: { provider, agentId, worktree, branch },
    });

    const prompt = promptOverride || buildDispatchPrompt({
      handoffAbsPath: abs,
      agentName: owner,
      worktree, branch, repoPath,
    });

    const kind = (provider || 'cli') as AdapterKind;
    const adapter = getAdapter(kind);
    appendEvent({
      executionId, handoff: handoff.replace(/\\\\/g, '/'), type: 'ADAPTER_STARTED',
      actor: owner, detail: \`Adapter '\${kind}' iniciado\`,
    });

    if (worktree) {
      registerWorktree({
        path: worktree, branch, repoPath,
        executionId, handoff: handoff.replace(/\\\\/g, '/'), owner,
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
      appendEvent({
        executionId, handoff: handoff.replace(/\\\\/g, '/'),
        type: result.status === 'SUCCEEDED' ? 'ADAPTER_COMPLETED' : 'ADAPTER_FAILED',
        actor: owner,
        detail: \`Adapter '\${kind}' finalizou: \${result.status} (exit \${result.exitCode ?? 'n/a'})\`,
        meta: { exitCode: result.exitCode, sessionId: result.sessionId, durationMs: result.durationMs },
      });
      // libera lock em estado terminal
      if (result.status === 'SUCCEEDED' || result.status === 'FAILED') {
        releaseLock({ handoffRelPath: handoff, executionId });
      }
      res.json({ ok: result.status === 'SUCCEEDED', executionId, result });
    } catch (e) {
      appendEvent({
        executionId, handoff: handoff.replace(/\\\\/g, '/'), type: 'ADAPTER_FAILED',
        actor: owner, detail: (e as Error).message,
      });
      releaseLock({ handoffRelPath: handoff, executionId });
      res.status(500).json({ ok: false, executionId, error: (e as Error).message });
    }
  });
`;

const anchor = /  return router;\r?\n}/;
if (!anchor.test(t)) { console.error('anchor not found'); process.exit(1); }
t = t.replace(anchor, routes + '\n' + anchor);
fs.writeFileSync(f, t);
console.log('patched');
