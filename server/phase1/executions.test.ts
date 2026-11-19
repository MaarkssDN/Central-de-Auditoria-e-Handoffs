import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-test-'));
process.env.CENTRAL_DIR = tmp;

const { appendEvent, logStatusTransition, getExecution, listExecutions, allEvents } = await import('./executions');

test('appendEvent cria registro e acumula eventos no mesmo executionId', () => {
  const e1 = appendEvent({ executionId: 'exec-t1', handoff: 'h1.md', type: 'DISPATCHED', actor: 'devin' });
  assert.equal(e1.seq, 1);
  const e2 = appendEvent({ executionId: 'exec-t1', handoff: 'h1.md', type: 'ADAPTER_COMPLETED', detail: 'exit 0' });
  assert.equal(e2.seq, 2);

  const rec = getExecution('exec-t1');
  assert.ok(rec);
  assert.equal(rec!.events.length, 2);
  assert.equal(rec!.status, 'SUCCEEDED'); // ADAPTER_COMPLETED marca sucesso
  assert.ok(rec!.endedAt);
});

test('ADAPTER_FAILED marca status FAILED', () => {
  appendEvent({ executionId: 'exec-t2', type: 'ADAPTER_FAILED', detail: 'boom' });
  assert.equal(getExecution('exec-t2')!.status, 'FAILED');
});

test('logStatusTransition registra transição de status', () => {
  logStatusTransition({ executionId: 'exec-t3', handoff: 'h2.md', from: 'PENDENTE', to: 'EM_EXECUÇÃO', actor: 'central-api' });
  const events = allEvents({ handoff: 'h2.md' });
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'STATUS_TRANSITION');
  assert.equal(events[0].from, 'PENDENTE');
  assert.equal(events[0].to, 'EM_EXECUÇÃO');
});

test('listExecutions filtra por handoff e getExecution tolera id inexistente', () => {
  const list = listExecutions({ handoff: 'h1.md' });
  assert.ok(list.length >= 1);
  assert.ok(list.every((r) => r.handoff === 'h1.md'));
  assert.equal(getExecution('exec-inexistente'), null);
});
