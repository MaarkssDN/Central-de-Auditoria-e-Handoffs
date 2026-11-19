import test from 'node:test';
import assert from 'node:assert/strict';
import { createCliAdapter, createDevinAdapter, createMockAdapter, getAdapter, resetAdapters, runCliSync } from './adapters';

const REQ = { executionId: 'exec-test-1', handoffRelPath: 'h.md', prompt: 'faça algo' };

test('mock adapter retorna SUCCEEDED e registra a chamada', async () => {
  const mock = createMockAdapter({ output: 'ok!' });
  const res = await mock.execute(REQ);
  assert.equal(res.status, 'SUCCEEDED');
  assert.equal(res.exitCode, 0);
  assert.equal(res.output, 'ok!');
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].executionId, 'exec-test-1');
});

test('mock adapter pode simular falha', async () => {
  const mock = createMockAdapter({ status: 'FAILED', exitCode: 1 });
  const res = await mock.execute(REQ);
  assert.equal(res.status, 'FAILED');
  assert.equal(res.exitCode, 1);
});

test('devin adapter cria sessão e faz poll até estado terminal (fetch mockado)', async () => {
  const calls: string[] = [];
  let polls = 0;
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push(`${init?.method || 'GET'} ${u}`);
    if (u.endsWith('/sessions') && init?.method === 'POST') {
      return new Response(JSON.stringify({ session_id: 'sess-1' }), { status: 200 });
    }
    polls++;
    return new Response(JSON.stringify({ status_enum: polls < 2 ? 'running' : 'finished' }), { status: 200 });
  }) as typeof fetch;

  const devin = createDevinAdapter({ fetchImpl, pollIntervalMs: 1, maxPollMs: 5000 });
  const res = await devin.execute(REQ);
  assert.equal(res.status, 'SUCCEEDED');
  assert.equal(res.sessionId, 'sess-1');
  assert.ok(calls.some((c) => c.startsWith('POST')));
  assert.ok(calls.filter((c) => c.startsWith('GET')).length >= 2);
});

test('devin adapter reporta FAILED quando a API rejeita', async () => {
  const fetchImpl = (async () => new Response('nope', { status: 500 })) as typeof fetch;
  const devin = createDevinAdapter({ fetchImpl, pollIntervalMs: 1 });
  const res = await devin.execute(REQ);
  assert.equal(res.status, 'FAILED');
  assert.match(res.error || '', /500/);
});

test('cli adapter executa comando real e reporta exit code', async () => {
  process.env.CENTRAL_CLI_COMMAND = 'echo';
  process.env.CENTRAL_CLI_ARGS = 'hello-from-cli';
  const cli = createCliAdapter();
  const res = await cli.execute({ ...REQ, timeoutMs: 15000 });
  assert.equal(res.status, 'SUCCEEDED');
  assert.equal(res.exitCode, 0);
  assert.match(res.output || '', /hello-from-cli/);
  delete process.env.CENTRAL_CLI_COMMAND;
  delete process.env.CENTRAL_CLI_ARGS;
});

test('runCliSync captura exit code e output', () => {
  const ok = runCliSync('echo sync-ok');
  assert.equal(ok.code, 0);
  assert.match(ok.output, /sync-ok/);
});

test('registry de adapters: getAdapter/resetAdapters', () => {
  resetAdapters();
  assert.equal(getAdapter('mock').kind, 'mock');
  assert.equal(getAdapter('manual').kind, 'manual');
});
