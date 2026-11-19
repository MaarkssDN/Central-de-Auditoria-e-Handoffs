import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'coord-test-'));
process.env.CENTRAL_DIR = tmp;

const waveDir = path.join(tmp, 'ondas', 'w1', 'handoffs');
fs.mkdirSync(waveDir, { recursive: true });
fs.mkdirSync(path.join(tmp, 'decisoes'), { recursive: true });
fs.mkdirSync(path.join(tmp, 'estado'), { recursive: true });
fs.mkdirSync(path.join(tmp, 'agents'), { recursive: true });

const mkHandoff = (name: string, prio: string, status = 'PENDENTE') => fs.writeFileSync(
  path.join(waveDir, name),
  `# Handoff ${name}\n\n- De: 00\n- Para: 10\n- Status: ${status}\n- Prioridade: ${prio}\n\n## Problema\nx\n\n## Correção exigida\ny\n\n## Critério de aceite\nz\n`,
  'utf-8',
);

mkHandoff('01-para-10-a.md', 'P0');
mkHandoff('02-para-10-b.md', 'P1'); // mesmo slot 10 → conflito de slot com o P0
mkHandoff('03-para-11-c.md', 'P2', 'EM_EXECUÇÃO'); // não elegível

fs.writeFileSync(path.join(tmp, 'decisoes', 'PENDENTES.md'), '# D\n\n## D-01 — Pendente\n\nSem resposta.\n', 'utf-8');
fs.writeFileSync(path.join(tmp, 'estado', 'central-state.json'), JSON.stringify({ activeWave: 'w1', repo: tmp }), 'utf-8');
fs.writeFileSync(path.join(tmp, 'agents', 'registry.json'), JSON.stringify({
  agents: [{ id: 'devin', nome: 'Devin', tipo: 'subagente', detect: [] }],
}), 'utf-8');

const { runCoordinator } = await import('./coordinator');

test('coordinator dryRun propõe lote com justificativa e respeita slots', () => {
  const res = runCoordinator({ wave: 'w1', dryRun: true });
  assert.equal(res.status, 200);
  const body = res.body as {
    proposed: { handoff: string; motivo: string }[];
    deferred: { handoff: string; reason: string }[];
    dryRun: boolean;
  };
  assert.equal(body.dryRun, true);
  // P0 (slot 10) selecionado; P1 mesmo slot → deferred por conflito de slot
  assert.equal(body.proposed.length, 1);
  assert.match(body.proposed[0].handoff, /01-para-10-a/);
  assert.match(body.proposed[0].motivo, /P0/);
  assert.ok(body.deferred.some((d) => /slot/i.test(d.reason)));
});

test('coordinator dryRun não despacha nem cria locks', async () => {
  const { getLock } = await import('./phase1/locks');
  const res = runCoordinator({ wave: 'w1', dryRun: true });
  assert.equal(res.status, 200);
  assert.equal(getLock('ondas/w1/handoffs/01-para-10-a.md'), null);
});

test('coordinator run real despacha e grava relatório em coordinator-runs', () => {
  const res = runCoordinator({ wave: 'w1', dryRun: false, maxParallel: 2, repoPath: tmp });
  // repoPath=tmp não é repo git → worktree falha, mas o fluxo deve registrar erros sem quebrar
  assert.equal(res.status, 200);
  const body = res.body as { runId: string; errors?: unknown[]; reportFile?: string };
  assert.ok(body.runId);
  assert.ok(body.reportFile);
  const reportPath = path.join(tmp, body.reportFile);
  assert.ok(fs.existsSync(reportPath));
});
