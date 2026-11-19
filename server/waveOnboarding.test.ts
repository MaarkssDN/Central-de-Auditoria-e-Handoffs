import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'onboard-test-'));
process.env.CENTRAL_DIR = tmp;

const { onboardWave, handoffTemplate } = await import('./waveOnboarding');

test('handoffTemplate gera markdown com campos e seções oficiais', () => {
  const md = handoffTemplate({ para: '10', titulo: 'Backup', prioridade: 'P1', dependencias: ['D-01'] }, 'onda-x', 1, { repoPath: 'C:/repo', baseline: 'main' });
  assert.match(md, /- Para: 10/);
  assert.match(md, /- Status: PENDENTE/);
  assert.match(md, /- Prioridade: P1/);
  assert.match(md, /- Dependências: D-01/);
  assert.match(md, /## Problema/);
  assert.match(md, /## Resolução/);
  assert.match(md, /## Revisão 24/);
});

test('onboardWave cria estrutura da onda e handoffs a partir do template', () => {
  const res = onboardWave({
    name: 'Onda Teste 2026',
    repoPath: 'C:/Github/Birthub-360',
    baseline: 'integracao/onda-1',
    handoffs: [
      { para: '10', titulo: 'Configurar backup', prioridade: 'P0' },
      { para: '11', titulo: 'Revisar logs', prioridade: 'P2', dependencias: ['D-01'] },
    ],
  });
  assert.equal(res.ok, true);
  assert.equal(res.waveDir, 'onda-teste-2026');
  assert.ok(res.files!.length >= 3); // INDEX + 2 handoffs

  const hdir = path.join(tmp, 'ondas', 'onda-teste-2026', 'handoffs');
  const files = fs.readdirSync(hdir).filter((f) => f.endsWith('.md'));
  assert.equal(files.length, 2);
  assert.ok(files.some((f) => f.includes('para-10')));
  assert.ok(files.some((f) => f.includes('para-11')));

  const first = fs.readFileSync(path.join(hdir, files.find((f) => f.includes('para-10'))!), 'utf-8');
  assert.match(first, /- Status: PENDENTE/);
  assert.match(first, /C:\/Github\/Birthub-360/);

  assert.ok(fs.existsSync(path.join(tmp, 'ondas', 'onda-teste-2026', 'auditoria')));
  assert.ok(fs.existsSync(path.join(tmp, 'ondas', 'onda-teste-2026', 'revisoes')));
  assert.ok(fs.existsSync(path.join(tmp, 'ondas', 'onda-teste-2026', 'INDEX.md')));
});

test('onboardWave rejeita onda existente sem force e aceita com force', () => {
  const again = onboardWave({ name: 'onda-teste-2026', handoffs: [{ para: '10', titulo: 'X' }] });
  assert.equal(again.ok, false);
  assert.match(again.error || '', /já existe/);

  const forced = onboardWave({ name: 'onda-teste-2026', force: true, handoffs: [{ para: '10', titulo: 'X' }] });
  assert.equal(forced.ok, true);
});

test('onboardWave valida entradas', () => {
  assert.equal(onboardWave({ name: '', handoffs: [{ para: '1', titulo: 'x' }] }).ok, false);
  assert.equal(onboardWave({ name: 'w', handoffs: [] }).ok, false);
  assert.equal(onboardWave({ name: 'w', handoffs: [{ para: '', titulo: 'x' }] }).ok, false);
});
