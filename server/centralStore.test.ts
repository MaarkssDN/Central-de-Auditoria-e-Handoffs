import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'store-test-'));
process.env.CENTRAL_DIR = tmp;

// Fixture mínima de central
const waveDir = path.join(tmp, 'ondas', 'w1', 'handoffs');
fs.mkdirSync(waveDir, { recursive: true });
fs.mkdirSync(path.join(tmp, 'decisoes'), { recursive: true });
fs.mkdirSync(path.join(tmp, 'estado'), { recursive: true });
fs.mkdirSync(path.join(tmp, 'agents'), { recursive: true });

fs.writeFileSync(path.join(waveDir, '01-para-10-backup.md'), `# Backup e deploy

- De: 00
- Para: 10
- Onda: w1
- Status: PENDENTE
- Prioridade: P1
- Dependências: nenhuma

## Problema
Backup inexistente.

## Correção exigida
Configurar backup.

## Critério de aceite
Restore test OK.
`, 'utf-8');

fs.writeFileSync(path.join(tmp, 'decisoes', 'PENDENTES.md'), '# Decisões\n\n## D-01 — Teste\n\nCorpo.\n', 'utf-8');
fs.writeFileSync(path.join(tmp, 'estado', 'central-state.json'), JSON.stringify({ veredito: 'NO-GO', activeWave: 'w1' }), 'utf-8');
fs.writeFileSync(path.join(tmp, 'estado', 'agentes-disponiveis.json'), JSON.stringify({ agentes: [] }), 'utf-8');
fs.writeFileSync(path.join(tmp, 'agents', 'registry.json'), JSON.stringify({
  agents: [
    { id: 'devin', nome: 'Devin', tipo: 'subagente', detect: [] },
    { id: 'generico', nome: 'Genérico', tipo: 'manual', detect: [] },
  ],
}), 'utf-8');

const store = await import('./centralStore');
const { getCentralState, updateHandoffStatus, queueDispatch, readHandoffRaw } = store;

const REL = 'ondas/w1/handoffs/01-para-10-backup.md';

test('getCentralState parseia handoffs, ondas, decisões e estado', () => {
  const s = getCentralState();
  assert.equal(s.handoffs.length, 1);
  const h = s.handoffs[0];
  assert.equal(h.status, 'PENDENTE');
  assert.equal(h.prioridade, 'P1');
  assert.equal(h.para, '10');
  assert.equal(s.waves[0].name, 'w1');
  assert.equal(s.decisions[0].id, 'D-01');
  assert.equal((s.state as { veredito?: string }).veredito, 'NO-GO');
});

test('readHandoffRaw lê o arquivo e rejeita path traversal', () => {
  assert.match(readHandoffRaw(REL) || '', /Backup e deploy/);
  assert.equal(readHandoffRaw('../fora.md'), null);
  assert.equal(readHandoffRaw('C:/Windows/win.ini'), null);
});

test('updateHandoffStatus valida transição na máquina de estados', () => {
  const bad = updateHandoffStatus(REL, 'CONCLUÍDO');
  assert.equal(bad.ok, false);
  assert.match(bad.error || '', /Transição inválida/);

  const good = updateHandoffStatus(REL, 'EM_EXECUÇÃO');
  assert.equal(good.ok, true);
  assert.match(readHandoffRaw(REL) || '', /- Status: EM_EXECUÇÃO/);
});

test('queueDispatch gera prompt, trava lock e muda status; segundo dispatch conflita', () => {
  const first = queueDispatch({ handoffRelPath: REL, agentId: 'devin', worktree: 'C:/wt/ag-10', branch: 'agente/10-backup' });
  assert.equal(first.ok, true);
  assert.ok(first.promptFile);
  const promptPath = path.join(tmp, first.promptFile!);
  assert.ok(fs.existsSync(promptPath));
  assert.match(fs.readFileSync(promptPath, 'utf-8'), /MISSÃO/);

  // handoff agora EM_EXECUÇÃO — lock ativo impede re-despacho
  const second = queueDispatch({ handoffRelPath: REL, agentId: 'generico' });
  assert.equal(second.ok, false);
  assert.match(second.error || '', /já está em execução/);
});
