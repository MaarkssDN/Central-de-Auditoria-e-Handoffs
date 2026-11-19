import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'locks-test-'));
process.env.CENTRAL_DIR = tmp;

const locks = await import('./locks');
const { claimLock, getLock, releaseLock, renewLock, listLocks, isLockExpired, newExecutionId } = locks;

const HANDOFF = 'ondas/w1/handoffs/01-para-10-exemplo.md';

test('claimLock adquire lock e getLock o retorna', () => {
  const res = claimLock({ handoffRelPath: HANDOFF, owner: 'devin' });
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.lock.owner, 'devin');
    assert.equal(res.lock.handoff, HANDOFF);
    assert.ok(res.lock.executionId.startsWith('exec-'));
    assert.equal(res.stolen, false);
  }
  assert.equal(getLock(HANDOFF)?.owner, 'devin');
});

test('segundo claim no mesmo handoff retorna conflito com dono e expiração', () => {
  const res = claimLock({ handoffRelPath: HANDOFF, owner: 'claude' });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.conflict.owner, 'devin');
    assert.ok(res.conflict.expiresAt);
    assert.ok(res.conflict.executionId);
  }
});

test('releaseLock com owner errado falha; com owner certo libera', () => {
  const wrong = releaseLock({ handoffRelPath: HANDOFF, owner: 'outro' });
  assert.equal(wrong.ok, false);
  assert.ok(getLock(HANDOFF));

  const right = releaseLock({ handoffRelPath: HANDOFF, owner: 'devin' });
  assert.equal(right.ok, true);
  assert.equal(right.released, true);
  assert.equal(getLock(HANDOFF), null);
});

test('lease expirado pode ser reclamado por outro executor (stolen)', () => {
  claimLock({ handoffRelPath: HANDOFF, owner: 'devin', ttlMs: -1000 }); // já nasce expirado
  const res = claimLock({ handoffRelPath: HANDOFF, owner: 'codex' });
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.lock.owner, 'codex');
    assert.equal(res.stolen, true);
  }
});

test('isLockExpired e listLocks refletem expiração', () => {
  const lock = getLock(HANDOFF);
  assert.ok(lock);
  assert.equal(isLockExpired(lock!), false);
  const all = listLocks();
  assert.ok(all.some((l) => l.handoff === HANDOFF && l.expired === false));
});

test('renewLock exige executionId correto', () => {
  const lock = getLock(HANDOFF)!;
  const bad = renewLock({ handoffRelPath: HANDOFF, executionId: 'exec-fake' });
  assert.equal(bad.ok, false);
  const good = renewLock({ handoffRelPath: HANDOFF, executionId: lock.executionId });
  assert.equal(good.ok, true);
});

test('newExecutionId gera ids únicos', () => {
  assert.notEqual(newExecutionId(), newExecutionId());
});
