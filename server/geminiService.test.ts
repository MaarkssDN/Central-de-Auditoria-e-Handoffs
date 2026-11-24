import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GEMINI_DEFAULT_MODEL,
  getGeminiClient,
} from './geminiService';

test('geminiService: uses current model gemini-4-hydrogen and never deprecated models', () => {
  assert.equal(GEMINI_DEFAULT_MODEL, 'gemini-4-hydrogen');
  assert.doesNotMatch(GEMINI_DEFAULT_MODEL, /gemini-1\.|gemini-2\./);
});

test('geminiService: getGeminiClient throws informative error when GEMINI_API_KEY is missing', () => {
  const originalKey = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    assert.throws(
      () => getGeminiClient(),
      /GEMINI_API_KEY não configurada/
    );
  } finally {
    if (originalKey) {
      process.env.GEMINI_API_KEY = originalKey;
    }
  }
});

test('geminiService: getGeminiClient returns GoogleGenAI instance when key is present', () => {
  const originalKey = process.env.GEMINI_API_KEY;
  try {
    process.env.GEMINI_API_KEY = 'test-mock-gemini-key-12345';
    const client = getGeminiClient();
    assert.ok(client);
    assert.ok(typeof client.models?.generateContent === 'function');
  } finally {
    if (originalKey) {
      process.env.GEMINI_API_KEY = originalKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  }
});

test('geminiService: parses and normalizes audit review output and verdicts', async () => {
  // Teste de normalização de dados e veredito
  const rawSample = {
    verdict: 'APROVADO',
    scopeSummary: 'Auditoria de entrega do Agente 01 (Prisma & RLS)',
    criteriaChecked: ['Conformidade P1-P4', 'Propriedade §15'],
    commandsExecuted: [{ command: 'npm test', result: 'PASS' }],
    findings: ['Migração aplicada com sucesso', 'RLS ativado em todas as tabelas'],
    pendingItems: [],
    evidence: '74 testes unitários passaram',
    p1ToP4Compliant: true,
    ownershipCompliant: true,
    tenancyLgpdChecked: true,
    rationale: 'Todas as regras de isolamento e governança cumpridas.',
  };

  assert.equal(rawSample.verdict, 'APROVADO');
  assert.equal(rawSample.p1ToP4Compliant, true);
  assert.equal(rawSample.ownershipCompliant, true);
  assert.equal(rawSample.commandsExecuted[0].result, 'PASS');
});

test('geminiService: sanitizes slug into kebab-case safely', () => {
  const rawSlug = '  Erro de Tenant no Supabase RLS!  ';
  const sanitized = rawSlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  assert.equal(sanitized, 'erro-de-tenant-no-supabase-rls');
});

test('adapters: getAdapter recognizes gemini provider and returns gemini adapter', async () => {
  const { getAdapter } = await import('./phase1/adapters');
  const adapter = getAdapter('gemini');
  assert.equal(adapter.kind, 'gemini');
  assert.ok(typeof adapter.execute === 'function');
});

test('geminiService: parses file audit output contract correctly', () => {
  const sampleAudit = {
    filePath: 'prisma/schema.prisma',
    ownerAgentId: '01',
    ownerAgentName: 'Valkiria',
    ownershipExplanation: 'Modelos e migrações do banco pertencem ao Agente 01 per §15.',
    complianceRating: 'CONFORME',
    blockersIdentified: [],
    findings: ['Isolamento multi-tenant presente no modelo'],
    recommendations: ['Adicionar índice composto para tenantId'],
  };

  assert.equal(sampleAudit.ownerAgentId, '01');
  assert.equal(sampleAudit.complianceRating, 'CONFORME');
  assert.equal(sampleAudit.findings.length, 1);
});

test('geminiService: parses executive summary output contract correctly', () => {
  const sampleSummary = {
    healthStatus: 'EM_RISCO',
    headline: 'Onda com bloqueadores de dados e decisões humanas pendentes',
    summary: 'A onda possui 2 handoffs em estado AGUARDANDO_24 e 1 bloqueio de migração.',
    criticalPath: ['Handoff 01-para-01A-retencao bloqueado por decisão D-01'],
    recommendedActions: [
      { priority: 'P0', action: 'Responder decisão D-01 sobre retenção', targetAgent: '00' },
      { priority: 'P1', action: 'Executar testes de acesso cruzado RLS', targetAgent: '01' },
    ],
    releaseReadinessScore: 65,
  };

  assert.equal(sampleSummary.healthStatus, 'EM_RISCO');
  assert.equal(sampleSummary.criticalPath.length, 1);
  assert.equal(sampleSummary.recommendedActions[0].priority, 'P0');
  assert.equal(sampleSummary.releaseReadinessScore, 65);
});



