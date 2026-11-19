import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskQueue } from './taskQueue';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('taskQueue limita concorrência e enfileira o excedente', async () => {
  const q = createTaskQueue(2);
  let running = 0;
  let maxSeen = 0;
  const order: string[] = [];

  const task = (name: string, ms: number) => q.run(async () => {
    running++;
    maxSeen = Math.max(maxSeen, running);
    order.push(`start:${name}`);
    await sleep(ms);
    order.push(`end:${name}`);
    running--;
  });

  await Promise.all([task('a', 40), task('b', 30), task('c', 10), task('d', 10)]);
  assert.equal(maxSeen, 2);
  assert.equal(order.filter((o) => o.startsWith('start:')).length, 4);
  assert.deepEqual(q.stats(), { max: 2, active: 0, queued: 0 });
});

test('taskQueue libera slot mesmo quando a tarefa falha', async () => {
  const q = createTaskQueue(1);
  await assert.rejects(q.run(async () => { throw new Error('boom'); }));
  const res = await q.run(async () => 'depois');
  assert.equal(res, 'depois');
  assert.equal(q.stats().active, 0);
});

test('drain espera tarefas ativas terminarem', async () => {
  const q = createTaskQueue(1);
  let done = false;
  const p = q.run(async () => { await sleep(80); done = true; });
  const drained = await q.drain(2000);
  await p;
  assert.equal(drained, true);
  assert.equal(done, true);
});
