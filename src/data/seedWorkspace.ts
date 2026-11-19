import { DEFAULT_PRIORITY_BLOCKERS } from './agentsRoster';
import type {
  AgentBotMessage,
  Handoff,
  IndependentReview,
  Mission,
  RepositoryTarget,
  Wave,
  WorkspaceState,
} from '../types/governance';
import { buildGatesForRepoScripts } from '../utils/governanceEngine';

export function createSeedWorkspace(): WorkspaceState {
  const repoId = 'repo-birth-hub-360';
  const now = new Date().toISOString();

  const packageScripts: Record<string, string> = {
    lint: 'tsc --noEmit',
    'test:unit': 'tsx --test src/utils/governanceEngine.test.ts',
    build: 'vite build',
    'verify:integrations': 'tsx scripts/verify-integrations.ts',
  };

  const blockers = DEFAULT_PRIORITY_BLOCKERS.map((b) => {
    if (b.code === 'B-01') {
      return {
        ...b,
        status: 'validado' as const,
        evidenceNote: 'Guard RBAC unificado no backend com testes de autorização 403 aprovados pelo Agente 24.',
      };
    }
    if (b.code === 'B-02') {
      return {
        ...b,
        status: 'mitigado' as const,
        evidenceNote: 'Middleware de rotas administrativas endurecido; aguardando revalidação final da Onda 4.',
      };
    }
    return { ...b, status: 'aberto' as const };
  });

  const repository: RepositoryTarget = {
    id: repoId,
    name: 'birth-hub-360',
    fullName: 'birth-hub/birth-hub-360',
    sourceType: 'manual',
    defaultBranch: 'main',
    branches: ['main', 'integracao/onda-4'],
    detectedAgentsMd: true,
    agentsMdRevision: '2026-10-09',
    packageScripts,
    samplePaths: [
      'AGENTS.md',
      'prisma/schema.prisma',
      'prisma/migrations/20261009_tenant_rls/migration.sql',
      'src/App.tsx',
      'src/components/Sidebar.tsx',
      'src/integrations/bitrix/sync.ts',
      'src/lib/queue/bitrixWorker.ts',
      'src/lib/security/secretRedactor.ts',
      '.github/workflows/ci.yml',
      'server.ts',
      'package.json',
      '.agents/prompts/24-revisao-independente.md',
      '.agents/reviews/onda-4-rbac.md',
    ],
    existingHandoffFiles: ['.agents/handoffs/onda-4/06-para-01-tenant-bitrix-sync-log.md'],
    existingReviewFiles: ['.agents/reviews/onda-4-rbac.md'],
    lastSyncedAt: now,
    blockers,
  };

  const baseGates = buildGatesForRepoScripts(packageScripts).map((g) => {
    if (g.scriptKey === 'tsc' || g.scriptKey === 'lint' || g.scriptKey === 'test:unit' || g.scriptKey === 'build') {
      return {
        ...g,
        status: 'EXECUTADO_VERDE' as const,
        lastRunAt: '2026-11-18T11:20:00Z',
        notes: 'Validado na integração da Onda 4 com exit code 0.',
      };
    }
    return g;
  });

  const wave: Wave = {
    id: `wave-${repoId}-4`,
    repoId,
    number: 4,
    name: 'Onda 4 — Endurecimento de Tenancy, Bitrix e LGPD',
    integrationBranch: 'integracao/onda-4',
    state: 'EM_REVISAO',
    scopeFreezeActive: true,
    activeAgentIds: ['00', '01', '06', '15'],
    matrixPublishedAt: '2026-11-16T09:00:00Z',
    mergesSinceLastGate: 2,
    gates: baseGates,
    createdAt: '2026-11-16T08:30:00Z',
  };

  const missions: Mission[] = [
    {
      id: 'mis-1',
      repoId,
      waveNumber: 4,
      agentId: '01',
      title: 'Isolamento de Tenant em extrações e tabelas Bitrix',
      slug: 'tenant-bitrix-rls',
      baseBranch: 'integracao/onda-4',
      branchName: 'agente/01-tenant-bitrix-rls',
      objective: 'Garantir organizationId obrigatório e isolamento multi-tenant na tabela BitrixSyncLog.',
      outOfScope: ['Alterar conectores HTTP do Bitrix (propriedade do Agente 06)'],
      ownedFiles: ['prisma/schema.prisma', 'prisma/migrations/20261009_tenant_rls/migration.sql'],
      dependencyFiles: ['src/integrations/bitrix/sync.ts'],
      assumptions: ['Contexto de tenant chega autenticado no middleware de sessão'],
      plan: [
        {
          description: 'Adicionar organizationId e índice composto no schema Prisma',
          verificationCriteria: 'prisma validate e npx tsc --noEmit verdes',
          completed: true,
        },
        {
          description: 'Adicionar teste de acesso cruzado entre Tenant A e Tenant B',
          verificationCriteria: 'Teste de isolamento falha para tenant divergente',
          completed: false,
        },
      ],
      finalSuccessCriterion: 'npx tsc --noEmit && npm run test:unit && npm run verify:integrations',
      expectedDeliverable: 'Relatório de conclusão + parecer APROVADO do Agente 24',
      status: 'em_revisao',
      createdAt: '2026-11-17T08:00:00Z',
    },
  ];

  const handoffs: Handoff[] = [
    {
      id: 'hoff-1',
      repoId,
      waveNumber: 4,
      slug: 'tenant-bitrix-sync-log',
      fromAgentId: '06',
      toAgentId: '01',
      status: 'aberto',
      priority: 'bloqueador',
      blockerRef: 'B-10',
      targetSprint: 'Onda 4',
      problem: 'A tabela BitrixSyncLog não exige organizationId em queries de reprocessamento.',
      filesInvolved: ['prisma/schema.prisma', 'src/integrations/bitrix/sync.ts'],
      evidence: 'Consulta findMany sem filtro de tenant expõe logs entre organizações.',
      requiredChange: 'Adicionar coluna organizationId NOT NULL e índice composto no schema Prisma.',
      expectedTest: 'Teste de acesso cruzado garantindo retorno vazio para outro tenant.',
      additionalContext: 'Agente 06 não altera migrações conforme §15.',
      createdAt: '2026-11-17T14:20:00Z',
    },
    {
      id: 'hoff-2',
      repoId,
      waveNumber: 4,
      slug: 'sanitizacao-token-bitrix',
      fromAgentId: '06',
      toAgentId: '15',
      status: 'em-andamento',
      priority: 'alto',
      blockerRef: 'B-11',
      targetSprint: 'Onda 4',
      problem: 'Payload de erro do webhook Bitrix incluía query string com token de entrada nos logs.',
      filesInvolved: ['src/integrations/bitrix/sync.ts', 'src/lib/security/secretRedactor.ts'],
      evidence: 'Captura HTTP 401 registrou URL completa com ?auth=*** em staging.',
      requiredChange: 'Aplicar redação de segredos antes de serializar erros e validar retenção com Agente 21.',
      expectedTest: 'Teste unitário garantindo que tokens secretos nunca aparecem nos logs.',
      additionalContext: 'Envolver Agente 21 (Escudo) caso haja PII no payload.',
      createdAt: '2026-11-17T16:10:00Z',
    },
    {
      id: 'hoff-3',
      repoId,
      waveNumber: 4,
      slug: 'auditoria-rbac-admin',
      fromAgentId: '02',
      toAgentId: '01',
      status: 'resolvido',
      priority: 'alto',
      blockerRef: 'B-01',
      targetSprint: 'Onda 4',
      problem: 'Verificação de papel administrativo duplicada no frontend sem enforcement idêntico na API.',
      filesInvolved: ['src/App.tsx', 'server.ts'],
      evidence: 'Rota administrativa aceitava token de operador padrão antes da unificação.',
      requiredChange: 'Centralizar guard RBAC no backend e expor permissões derivadas na sessão.',
      expectedTest: 'Teste de integração retornando HTTP 403 para operador padrão.',
      additionalContext: 'Alteração em server.ts aprovada pelo Coordenador (00 Núcleo).',
      createdAt: '2026-11-16T11:00:00Z',
      resolution: {
        resolvedBy: '01',
        resolvedAt: '2026-11-17T09:40:00Z',
        summary: 'Guard RBAC unificado no backend com testes de autorização positiva e negativa.',
        evidence: 'npm run test:unit (PASS) e parecer APROVADO emitido pelo Agente 24 (Veredito).',
        verifiedByAgent24: true,
      },
    },
  ];

  const reviews: IndependentReview[] = [
    {
      id: 'rev-1',
      repoId,
      waveNumber: 4,
      missionId: 'mis-rbac',
      missionTitle: 'Unificação de RBAC e Autorização Administrativa',
      authorAgentId: '01',
      auditorAgentId: '24',
      baseBranch: 'integracao/onda-4',
      commitOrHashes: '9f4a21c',
      scopeSummary: 'Centralização do middleware RBAC e bloqueio 403 em rotas administrativas.',
      criteriaChecked: [
        'Autor diferente do auditor (§40)',
        'Sem regressão de tenancy ou exposição de segredos',
        'Testes de caminho feliz e erro 403 executados',
      ],
      commandsExecuted: [
        { command: 'npx tsc --noEmit', result: 'PASS (0 erros)' },
        { command: 'npm run test:unit', result: 'PASS (14/14)' },
      ],
      evidence: 'Diff auditado em 3 arquivos; cobertura de negação HTTP 403 comprovada.',
      findings: [],
      pendingItems: [],
      p1ToP4Compliant: true,
      tenancyLgpdChecked: true,
      ownershipCompliant: true,
      verdict: 'APROVADO',
      createdAt: '2026-11-17T10:00:00Z',
    },
    {
      id: 'rev-2',
      repoId,
      waveNumber: 4,
      missionId: 'mis-1',
      missionTitle: 'Isolamento de Tenant em extrações e tabelas Bitrix',
      authorAgentId: '01',
      auditorAgentId: '24',
      baseBranch: 'integracao/onda-4',
      commitOrHashes: '3c8e10b',
      scopeSummary: 'Migração de schema BitrixSyncLog com organizationId obrigatório.',
      criteriaChecked: [
        'Propriedade exclusiva respeitada (Agente 01)',
        'Contrato de sucesso exige teste de acesso cruzado',
      ],
      commandsExecuted: [
        { command: 'npx tsc --noEmit', result: 'PASS' },
        { command: 'npm run verify:integrations', result: 'FALHOU (falta teste de acesso cruzado)' },
      ],
      evidence: 'Migração criada, porém o teste de isolamento entre tenants ainda não foi concluído.',
      findings: ['Teste de acesso cruzado entre Tenant A e B pendente no plano da missão.'],
      pendingItems: ['Executar e registrar evidência do teste de acesso cruzado antes de nova submissão ao 24.'],
      p1ToP4Compliant: true,
      tenancyLgpdChecked: false,
      ownershipCompliant: true,
      verdict: 'REPROVADO',
      createdAt: '2026-11-18T07:55:00Z',
    },
  ];

  const botMessages: AgentBotMessage[] = [
    {
      id: 'bot-seed-1',
      repoId,
      agentId: '00',
      role: 'agent',
      content:
        '**Núcleo (00)** no comando da **Onda 4**. Temos 3 especialistas ativos (`01 Valkiria`, `06 Ponte` e `15 Cofre`), 4 gates locais/integração verdes e 1 parecer **APROVADO** do Veredito (`24`) sobre RBAC. Pendência crítica aberta: handoff bloqueador `06 → 01` (`B-10`) aguardando teste de acesso cruzado antes da liberação.',
      toolTraces: [
        {
          id: 'tr-seed-1',
          toolName: 'inspect_repository_files',
          argsSummary: '{"repo":"birth-hub/birth-hub-360"}',
          resultSummary: '13 arquivos mapeados · AGENTS.md rev 2026-10-09 · 2 handoffs ativos',
          timestamp: '2026-11-18T08:00:00Z',
        },
      ],
      timestamp: '2026-11-18T08:00:00Z',
    },
  ];

  return {
    activeRepoId: repoId,
    repositories: [repository],
    waves: [wave],
    missions,
    handoffs,
    reviews,
    botMessages,
  };
}
