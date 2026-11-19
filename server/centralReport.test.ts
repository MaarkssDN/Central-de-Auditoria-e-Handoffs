import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWaveReportHtml } from './centralReport';
import type { CentralState } from './centralStore';

const fakeState = {
  generatedAt: '2026-11-19T00:00:00.000Z',
  state: { veredito: 'NO-GO', waveStatus: 'Trava de mutação ativa até decisão D-01.' },
  waves: [{ name: 'w1', handoffs: 2, byStatus: { PENDENTE: 1, 'CONCLUÍDO': 1 } }],
  handoffs: [
    {
      file: 'ondas/w1/handoffs/01-para-10-a.md', relPath: 'ondas/w1/handoffs/01-para-10-a.md',
      name: '01-para-10-a.md', title: 'Backup diário', de: '00', para: '10', onda: 'w1',
      status: 'CONCLUÍDO', prioridade: 'P0', dependencias: [], referencia: '',
      problema: 'sem backup', correcao: 'configurar', aceite: 'restore ok',
      resolucao: 'branch agente/10-backup, gate exit 0', revisao24: 'APROVADO',
    },
    {
      file: 'ondas/w1/handoffs/02-para-11-b.md', relPath: 'ondas/w1/handoffs/02-para-11-b.md',
      name: '02-para-11-b.md', title: 'Pendente X', de: '00', para: '11', onda: 'w1',
      status: 'PENDENTE', prioridade: 'P2', dependencias: ['D-01'], referencia: '',
      problema: '', correcao: '', aceite: '', resolucao: '', revisao24: '',
    },
  ],
  audits: [{ file: 'ondas/w1/auditoria/a.md', name: 'a.md', size: 100 }],
  reviews: [{ file: 'ondas/w1/revisoes/r.md', name: 'r.md' }],
  decisions: [{ id: 'D-01', title: 'Decisão teste', body: 'Corpo da decisão' }],
  agents: [],
} as unknown as CentralState;

test('buildWaveReportHtml gera HTML executivo com veredito e handoffs', () => {
  const html = buildWaveReportHtml(fakeState, 'w1');
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /NO-GO/);
  assert.match(html, /Backup diário/);
  assert.match(html, /Pendente X/);
  assert.match(html, /D-01/);
  assert.match(html, /CONCLUÍDO/);
});

test('buildWaveReportHtml sem wave inclui todas as ondas', () => {
  const html = buildWaveReportHtml(fakeState);
  assert.match(html, /Backup diário/);
  assert.match(html, /Pendente X/);
});

test('buildWaveReportHtml escapa HTML em campos do handoff', () => {
  const evil = {
    ...fakeState,
    handoffs: [{ ...fakeState.handoffs[0], title: '<script>alert(1)</script>' }],
  } as CentralState;
  const html = buildWaveReportHtml(evil, 'w1');
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /&lt;script&gt;/);
});
