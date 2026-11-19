import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

// CENTRAL_DIR precisa estar definido antes dos imports dos módulos phase1.
const tmpCentral = fs.mkdtempSync(path.join(os.tmpdir(), 'central-phase1-'));
process.env.CENTRAL_DIR = tmpCentral;

let locks: typeof import('./locks');
let sm: typeof import('./stateMachine');
let execs: typeof import('./executions');
let adapters: typeof import('./adapters');

const HANDOFF = 'ondas/wave-x/handoffs/H1.md';
const H2 = 'ondas/wave-x/handoffs/H2.md';
const H3 = 'ondas/wave-x/handoffs/H3.md';
const H4 = 'ondas/wave-x/handoffs/H4.md';
const H5 = 'ondas/wave-x/handoffs/H5.md';

before(async () => {
  locks = await import('./locks');
  sm = await import('./stateMachine');
  execs = await import('./executions');
  adapters = await import('./adapters');
});

after(() => {
  fs.rmSync(tmpCentral, { recursive: true, force: true });
});

test('locks: claim adquire lock com owner e expiração', () => {
  const r = locks.claimLock({ handoffRelPath: HANDOFF, owner: 'devin-a', ttlMs: 60000 });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.lock.owner, 'devin-a');
    assert.ok(r.lock.expiresAt > r.lock.claimedAt);
  }
});

test('locks: segundo claim retorna conflito com owner e expiresAt', () => {
  const r = locks.claimLock({ handoffRelPath: HANDOFF, owner: 'devin-b' });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.conflict.owner, 'devin-a');
    assert.ok(r.conflict.expiresAt);
    assert.equal(r.conflict.handoff, HANDOFF);
  }
});

test('locks: lease expirado pode ser retomado por outro executor', () => {
  const past = new Date(Date.now() - 1000);
  // força expiração escrevendo lock já vencido
  const claim = locks.claimLock({ handoffRelPath: H2, owner: 'devin-a', ttlMs: 1, now: past });
  assert.equal(claim.ok, true);
  const r = locks.claimLock({ handoffRelPath: H2, owner: 'devin-b' });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.lock.owner, 'devin-b');
    assert.equal(r.stolen, true);
  }
});

test('locks: release exige owner correto', () => {
  locks.claimLock({ handoffRelPath: H3, owner: 'devin-b' });
  const wrong = locks.releaseLock({ handoffRelPath: H3, owner: 'devin-a' });
  assert.equal(wrong.ok, false);
  const right = locks.releaseLock({ handoffRelPath: H3, owner: 'devin-b' });
  assert.equal(right.ok, true);
  assert.equal(right.released, true);
  assert.equal(locks.getLock(H3), null);
});

test('locks: renew estende expiração apenas para executionId correto', () => {
  const c = locks.claimLock({ handoffRelPath: H4, owner: 'devin-c', ttlMs: 1000 });
  assert.equal(c.ok, true);
  if (!c.ok) return;
  const bad = locks.renewLock({ handoffRelPath: H4, executionId: 'exec-errado' });
  assert.equal(bad.ok, false);
  const good = locks.renewLock({ handoffRelPath: H4, executionId: c.lock.executionId, ttlMs: 999999 });
  assert.equal(good.ok, true);
  locks.releaseLock({ handoffRelPath: H4 });
});

test('stateMachine: transições válidas e inválidas', () => {
  assert.equal(sm.canTransition('PENDENTE', 'EM_EXECUÇÃO').ok, true);
  assert.equal(sm.canTransition('EM_EXECUÇÃO', 'AGUARDANDO_24').ok, true);
  assert.equal(sm.canTransition('AGUARDANDO_24', 'CONCLUÍDO').ok, true);
  assert.equal(sm.canTransition('PENDENTE', 'CONCLUÍDO').ok, false);
  assert.equal(sm.canTransition('CONCLUÍDO', 'PENDENTE').ok, false);
  assert.equal(sm.canTransition('BLOQUEADO', 'EM_EXECUÇÃO').ok, true);
  // aliases
  assert.equal(sm.canTransition('EM_ANDAMENTO', 'AGUARDANDO_24').ok, true);
  assert.equal(sm.normalizeStatus('resolvido'), 'CONCLUÍDO');
  assert.equal(sm.normalizeStatus('STATUS_X'), null);
});

test('executions: transição gera registro imutável no log', () => {
  const execId = 'exec-test-1';
  execs.logStatusTransition({
    executionId: execId,
    handoff: HANDOFF,
    from: 'PENDENTE',
    to: 'EM_EXECUÇÃO',
    actor: 'devin-a',
  });
  execs.appendEvent({
    executionId: execId,
    handoff: HANDOFF,
    type: 'ADAPTER_COMPLETED',
    detail: 'fim',
  });
  const rec = execs.getExecution(execId);
  assert.ok(rec);
  assert.equal(rec!.events.length, 2);
  assert.equal(rec!.events[0].type, 'STATUS_TRANSITION');
  assert.equal(rec!.events[0].from, 'PENDENTE');
  assert.equal(rec!.events[0].to, 'EM_EXECUÇÃO');
  assert.equal(rec!.status, 'SUCCEEDED');
  const list = execs.listExecutions({ handoff: HANDOFF });
  assert.ok(list.some((r) => r.executionId === execId));
});

test('adapters: mock retorna status configurado e registra chamada', async () => {
  const mock = adapters.createMockAdapter({ status: 'FAILED', exitCode: 3, output: 'boom' });
  const res = await mock.execute({
    executionId: 'exec-mock-1',
    handoffRelPath: HANDOFF,
    prompt: 'teste',
  });
  assert.equal(res.status, 'FAILED');
  assert.equal(res.exitCode, 3);
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].executionId, 'exec-mock-1');
});

test('adapters: devin com fetch mockado cria sessão e faz polling até terminal', async () => {
  let polls = 0;
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith('/sessions') && init?.method === 'POST') {
      return new Response(JSON.stringify({ session_id: 'sess-1' }), { status: 200 });
    }
    polls += 1;
    const status = polls < 2 ? 'running' : 'finished';
    return new Response(JSON.stringify({ status_enum: status }), { status: 200 });
  }) as typeof fetch;

  const devin = adapters.createDevinAdapter({ fetchImpl, pollIntervalMs: 1, maxPollMs: 5000 });
  const res = await devin.execute({
    executionId: 'exec-devin-1',
    handoffRelPath: HANDOFF,
    prompt: 'missão',
  });
  assert.equal(res.status, 'SUCCEEDED');
  assert.equal(res.sessionId, 'sess-1');
  assert.ok(polls >= 2);
});

test('adapters: cli executa comando real e reporta exit code', async () => {
  process.env.CENTRAL_CLI_COMMAND = 'node';
  process.env.CENTRAL_CLI_ARGS = '-e "process.exit(3)"';
  const cli = adapters.createCliAdapter();
  const res = await cli.execute({
    executionId: 'exec-cli-1',
    handoffRelPath: HANDOFF,
    prompt: '',
    timeoutMs: 15000,
  });
  assert.equal(res.status, 'FAILED');
  assert.equal(res.exitCode, 3);
  delete process.env.CENTRAL_CLI_COMMAND;
  delete process.env.CENTRAL_CLI_ARGS;
});

test('adapters: runCliSync captura exit code e output', () => {
  const ok = adapters.runCliSync('node -e "console.log(42)"');
  assert.equal(ok.code, 0);
  assert.ok(ok.output.includes('42'));
  const fail = adapters.runCliSync('node -e "process.exit(7)"');
  assert.equal(fail.code, 7);
});
