import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFICIAL_AGENTS } from '../data/agentsRoster';
import { AGENT_SPECIFIC_DIRECTIVES } from '../data/agentDirectives';
import {
  buildGatesForRepoScripts,
  checkSlotConflicts,
  evaluateWaveTransition,
  formatHandoffFileName,
  formatMissionPrompt,
  resolveFileOwnership,
} from './governanceEngine';
import type { Handoff, IndependentReview, Mission, Wave } from '../types/governance';

test('every official agent has a unique character persona, codename, and motto', () => {
  assert.equal(OFFICIAL_AGENTS.length, 26);
  const codenames = new Set(OFFICIAL_AGENTS.map((a) => a.persona.codename));
  const mottos = new Set(OFFICIAL_AGENTS.map((a) => a.persona.motto));
  assert.equal(codenames.size, OFFICIAL_AGENTS.length);
  assert.equal(mottos.size, OFFICIAL_AGENTS.length);
  for (const agent of OFFICIAL_AGENTS) {
    assert.ok(agent.persona.voiceStyle.length > 10);
    assert.ok(agent.persona.signatureTools.length >= 1);
    const dirs = AGENT_SPECIFIC_DIRECTIVES[agent.id];
    assert.ok(Array.isArray(dirs) && dirs.length === 2, `Missing directives for ${agent.id}`);
  }
});

test('rejects reserved agent IDs 19 and 20', () => {
  const res19 = checkSlotConflicts({
    activeAgentIds: ['00'],
    candidateAgentId: '19',
    matrixPublished: true,
  });
  assert.equal(res19.allowed, false);
  assert.match(res19.reasons[0], /reservado/i);

  const res20 = checkSlotConflicts({
    activeAgentIds: ['00'],
    candidateAgentId: '20',
    matrixPublished: true,
  });
  assert.equal(res20.allowed, false);
});

test('enforces exclusive slot pairs 01<->01A, 06<->06A, 08<->08A', () => {
  const conflict01 = checkSlotConflicts({
    activeAgentIds: ['00', '01'],
    candidateAgentId: '01A',
    matrixPublished: true,
  });
  assert.equal(conflict01.allowed, false);
  assert.match(conflict01.reasons[0], /Slot exclusivo violado/);

  const conflict06 = checkSlotConflicts({
    activeAgentIds: ['00', '06A'],
    candidateAgentId: '06',
    matrixPublished: true,
  });
  assert.equal(conflict06.allowed, false);

  const conflict08 = checkSlotConflicts({
    activeAgentIds: ['00', '08'],
    candidateAgentId: '08A',
    matrixPublished: true,
  });
  assert.equal(conflict08.allowed, false);
});

test('enforces queue conflict between 16 and 06/07 when touching src/lib/queue/**', () => {
  const conflictQueue = checkSlotConflicts({
    activeAgentIds: ['00', '06'],
    candidateAgentId: '16',
    matrixPublished: true,
    touchedPaths: ['src/lib/queue/bitrixWorker.ts'],
  });
  assert.equal(conflictQueue.allowed, false);
  assert.match(conflictQueue.reasons[0], /src\/lib\/queue/);

  const allowedNoQueueTouch = checkSlotConflicts({
    activeAgentIds: ['00', '06'],
    candidateAgentId: '16',
    matrixPublished: true,
    touchedPaths: ['src/integrations/bitrix/client.ts'],
  });
  assert.equal(allowedNoQueueTouch.allowed, true);
});

test('requires published ownership matrix when activating more than 3 specialists', () => {
  const blocked = checkSlotConflicts({
    activeAgentIds: ['00', '01', '02', '03'],
    candidateAgentId: '04',
    matrixPublished: false,
  });
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reasons[0], /matriz de propriedade/i);

  const allowed = checkSlotConflicts({
    activeAgentIds: ['00', '01', '02', '03'],
    candidateAgentId: '04',
    matrixPublished: true,
  });
  assert.equal(allowed.allowed, true);
});

test('resolves exclusive file ownership per section 15', () => {
  assert.deepEqual(resolveFileOwnership('prisma/schema.prisma').ownerAgentIds, ['01']);
  assert.deepEqual(resolveFileOwnership('src/App.tsx').ownerAgentIds, ['02']);
  assert.deepEqual(resolveFileOwnership('.github/workflows/ci.yml').ownerAgentIds, ['08']);
  assert.deepEqual(resolveFileOwnership('charts/api/values.yaml').ownerAgentIds, ['10']);
  assert.deepEqual(resolveFileOwnership('android/app/build.gradle').ownerAgentIds, ['09']);
  assert.equal(resolveFileOwnership('server.ts').ruleType, 'aprovacao_00');
  assert.equal(resolveFileOwnership('.agents/prompts/24-revisao-independente.md').ruleType, 'decisao_humana');
});

test('never masks missing package.json scripts as green gates (section 29)', () => {
  const gates = buildGatesForRepoScripts({
    lint: 'tsc --noEmit',
    build: 'vite build',
  });
  const e2e = gates.find((g) => g.scriptKey === 'test:e2e');
  const lint = gates.find((g) => g.scriptKey === 'lint');
  assert.equal(e2e?.status, 'NAO_APLICAVEL');
  assert.equal(lint?.status, 'NAO_EXECUTADO');
});

test('blocks RELEASE_APPROVED without Agent 24 APROVADO verdict or with open blocker handoffs', () => {
  const baseWave: Wave = {
    id: 'w1',
    repoId: 'r1',
    number: 1,
    name: 'Onda 1',
    integrationBranch: 'integracao/onda-1',
    state: 'GATE_VERDE',
    scopeFreezeActive: true,
    activeAgentIds: ['00', '01', '02'],
    matrixPublishedAt: '2026-10-10T10:00:00Z',
    mergesSinceLastGate: 0,
    gates: [
      { id: 'g1', scriptKey: 'tsc', command: 'npx tsc --noEmit', tier: 'local', status: 'EXECUTADO_VERDE' },
    ],
    createdAt: '2026-10-10T09:00:00Z',
  };

  const noReview = evaluateWaveTransition({
    wave: baseWave,
    targetState: 'RELEASE_APPROVED',
    handoffs: [],
    reviews: [],
  });
  assert.equal(noReview.allowed, false);
  assert.match(noReview.blockers[0], /Agente 24/);

  const openBlockerHandoff: Handoff = {
    id: 'h1',
    repoId: 'r1',
    waveNumber: 1,
    slug: 'tenant-rls',
    fromAgentId: '06',
    toAgentId: '01',
    status: 'aberto',
    priority: 'bloqueador',
    blockerRef: 'B-10',
    targetSprint: 'Onda 1',
    problem: 'Falta filtro de tenant',
    filesInvolved: ['prisma/schema.prisma'],
    evidence: 'Query sem tenantId',
    requiredChange: 'Adicionar tenantId obrigatório',
    expectedTest: 'Teste de acesso cruzado',
    additionalContext: '',
    createdAt: '2026-10-10T10:00:00Z',
  };

  const approvedReview: IndependentReview = {
    id: 'rev1',
    repoId: 'r1',
    waveNumber: 1,
    missionId: 'm1',
    missionTitle: 'Isolamento de Tenant',
    authorAgentId: '01',
    auditorAgentId: '24',
    baseBranch: 'integracao/onda-1',
    commitOrHashes: 'abc1234',
    scopeSummary: 'Tenant isolation',
    criteriaChecked: ['P1-P4'],
    commandsExecuted: [{ command: 'npx tsc --noEmit', result: 'OK' }],
    evidence: 'Logs verdes',
    findings: [],
    pendingItems: [],
    p1ToP4Compliant: true,
    tenancyLgpdChecked: true,
    ownershipCompliant: true,
    verdict: 'APROVADO',
    createdAt: '2026-10-10T12:00:00Z',
  };

  const blockedByHandoff = evaluateWaveTransition({
    wave: baseWave,
    targetState: 'RELEASE_APPROVED',
    handoffs: [openBlockerHandoff],
    reviews: [approvedReview],
  });
  assert.equal(blockedByHandoff.allowed, false);
  assert.match(blockedByHandoff.blockers[0], /bloqueador/);

  const approvedRelease = evaluateWaveTransition({
    wave: baseWave,
    targetState: 'RELEASE_APPROVED',
    handoffs: [{ ...openBlockerHandoff, status: 'resolvido' }],
    reviews: [approvedReview],
  });
  assert.equal(approvedRelease.allowed, true);
});

test('formats handoff file path and mission prompt according to AGENTS.md', () => {
  const path = formatHandoffFileName({
    fromAgentId: '06',
    toAgentId: '01',
    slug: 'Schema Bitrix',
    waveNumber: 2,
  });
  assert.equal(path, '.agents/handoffs/onda-2/06-para-01-schema-bitrix.md');

  const mission: Mission = {
    id: 'm1',
    repoId: 'r1',
    waveNumber: 2,
    agentId: '06',
    title: 'Corrigir sincronização Bitrix',
    slug: 'sync-bitrix',
    baseBranch: 'integracao/onda-2',
    branchName: 'agente/06-sync-bitrix',
    objective: 'Garantir observabilidade de falhas na sincronização Bitrix.',
    outOfScope: ['Alterar schema Prisma'],
    ownedFiles: ['src/integrations/bitrix/sync.ts'],
    dependencyFiles: ['prisma/schema.prisma'],
    assumptions: ['Token armazenado no cofre de segredos'],
    plan: [{ description: 'Capturar erros HTTP', verificationCriteria: 'Teste de falha retorna erro explícito', completed: false }],
    finalSuccessCriterion: 'npm run test:unit && npx tsc --noEmit',
    expectedDeliverable: 'Relatório de conclusão + evidência de teste',
    status: 'planejada',
    createdAt: '2026-10-10T10:00:00Z',
  };

  const prompt = formatMissionPrompt(mission);
  assert.ok(prompt.startsWith('Você é o Agente 06. Leia AGENTS.md e .agents/prompts/06-integracoes-bitrix.md antes de planejar.'));
});
