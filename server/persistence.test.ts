import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { atomicWriteFile, loadJson, saveJsonAtomic, withFileLockSync } from './persistence';

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'persist-test-'));
}

test('atomicWriteFile escreve conteúdo e não deixa .tmp para trás', () => {
  const dir = tmpdir();
  const file = path.join(dir, 'sub', 'state.json');
  atomicWriteFile(file, '{"a":1}');
  assert.equal(fs.readFileSync(file, 'utf-8'), '{"a":1}');
  const leftovers = fs.readdirSync(path.dirname(file)).filter((f) => f.endsWith('.tmp'));
  assert.equal(leftovers.length, 0);
});

test('saveJsonAtomic + loadJson fazem round-trip e toleram arquivo ausente', () => {
  const dir = tmpdir();
  const file = path.join(dir, 'cfg.json');
  saveJsonAtomic(file, { x: [1, 2, 3] });
  assert.deepEqual(loadJson(file, null), { x: [1, 2, 3] });
  assert.deepEqual(loadJson(path.join(dir, 'nope.json'), { fallback: true }), { fallback: true });
  fs.writeFileSync(file, '{invalid', 'utf-8');
  assert.deepEqual(loadJson(file, 'fb'), 'fb');
});

test('withFileLockSync executa fn e remove o lock ao final', () => {
  const dir = tmpdir();
  const lockDir = path.join(dir, 'x.lock');
  let sawLock = false;
  const result = withFileLockSync(lockDir, () => {
    sawLock = fs.existsSync(lockDir);
    return 42;
  });
  assert.equal(result, 42);
  assert.equal(sawLock, true);
  assert.equal(fs.existsSync(lockDir), false);
});

test('withFileLockSync expira por timeout quando lock está fresco', () => {
  const dir = tmpdir();
  const lockDir = path.join(dir, 'busy.lock');
  fs.mkdirSync(lockDir); // simula outro processo segurando o lock
  assert.throws(() => withFileLockSync(lockDir, () => 'nope', { timeoutMs: 200, retryMs: 20 }), /Timeout/);
  fs.rmSync(lockDir, { recursive: true, force: true });
  assert.equal(withFileLockSync(lockDir, () => 'ok'), 'ok');
});

test('withFileLockSync recupera lock órfão (stale)', () => {
  const dir = tmpdir();
  const lockDir = path.join(dir, 'stale.lock');
  fs.mkdirSync(lockDir);
  const old = new Date(Date.now() - 60_000);
  fs.utimesSync(lockDir, old, old);
  assert.equal(withFileLockSync(lockDir, () => 'recovered', { staleMs: 1000, timeoutMs: 2000 }), 'recovered');
});
