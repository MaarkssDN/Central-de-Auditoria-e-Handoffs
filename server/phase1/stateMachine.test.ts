import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, isValidTransition, normalizeStatus, CANONICAL_STATUS } from './stateMachine';

test('normalizeStatus mapeia aliases para status canônicos', () => {
  assert.equal(normalizeStatus('RESOLVIDO'), 'CONCLUÍDO');
  assert.equal(normalizeStatus('EM_ANDAMENTO'), 'EM_EXECUÇÃO');
  assert.equal(normalizeStatus('em_execucao'), 'EM_EXECUÇÃO');
  assert.equal(normalizeStatus('ABERTO'), 'PENDENTE');
  assert.equal(normalizeStatus('LIXO'), null);
});

test('transições canônicas seguem a tabela do plano', () => {
  assert.equal(isValidTransition('PENDENTE', 'EM_EXECUÇÃO'), true);
  assert.equal(isValidTransition('EM_EXECUÇÃO', 'AGUARDANDO_24'), true);
  assert.equal(isValidTransition('AGUARDANDO_24', 'CONCLUÍDO'), true);
  assert.equal(isValidTransition('AGUARDANDO_24', 'REPROVADO_24'), true);
  assert.equal(isValidTransition('REPROVADO_24', 'EM_EXECUÇÃO'), true);
  assert.equal(isValidTransition('BLOQUEADO', 'PENDENTE'), true);
});

test('transições inválidas são rejeitadas', () => {
  assert.equal(isValidTransition('PENDENTE', 'CONCLUÍDO'), false);
  assert.equal(isValidTransition('CONCLUÍDO', 'PENDENTE'), false);
  assert.equal(isValidTransition('AGUARDANDO_24', 'PENDENTE'), false);
});

test('canTransition normaliza entradas e retorna erro descritivo', () => {
  const ok = canTransition('PENDENTE', 'em_execucao');
  assert.equal(ok.ok, true);
  assert.equal(ok.to, 'EM_EXECUÇÃO');

  const bad = canTransition('PENDENTE', 'CONCLUÍDO');
  assert.equal(bad.ok, false);
  assert.match(bad.error || '', /Transição inválida/);

  const invalid = canTransition('PENDENTE', 'STATUS_X');
  assert.equal(invalid.ok, false);
  assert.match(invalid.error || '', /Status inválido/);
});

test('mesmo status é sempre permitido (no-op)', () => {
  for (const s of CANONICAL_STATUS) {
    assert.equal(canTransition(s, s).ok, true);
  }
});
