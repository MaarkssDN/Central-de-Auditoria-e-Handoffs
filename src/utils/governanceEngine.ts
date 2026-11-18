import { OFFICIAL_AGENTS, RESERVED_AGENT_IDS } from '../data/agentsRoster';
import type {
  GateCheck,
  Handoff,
  IndependentReview,
  Mission,
  Wave,
  WaveState,
} from '../types/governance';

export interface SlotConflictResult {
  allowed: boolean;
  reasons: string[];
}

export interface OwnershipResolution {
  filePath: string;
  ownerLabel: string;
  ownerAgentIds: string[];
  ruleType: 'exclusivo' | 'aprovacao_00' | 'decisao_humana' | 'compartilhado_handoffs' | 'dominio_geral';
  guidance: string;
}

export interface WaveTransitionCheck {
  allowed: boolean;
  blockers: string[];
}

export function getAgentById(id: string) {
  return OFFICIAL_AGENTS.find((a) => a.id === id);
}

export function checkSlotConflicts(params: {
  activeAgentIds: string[];
  candidateAgentId: string;
  matrixPublished: boolean;
  openHandoffs?: Handoff[];
  touchedPaths?: string[];
}): SlotConflictResult {
  const {
    activeAgentIds,
    candidateAgentId,
    matrixPublished,
    openHandoffs = [],
    touchedPaths = [],
  } = params;

  const reasons: string[] = [];

  if ((RESERVED_AGENT_IDS as readonly string[]).includes(candidateAgentId)) {
    reasons.push(`Agente ${candidateAgentId} não existe e continua reservado (§4 do AGENTS.md).`);
    return { allowed: false, reasons };
  }

  const candidate = getAgentById(candidateAgentId);
  if (!candidate) {
    reasons.push(`Agente ${candidateAgentId} não consta no roster oficial.`);
    return { allowed: false, reasons };
  }

  if (activeAgentIds.includes(candidateAgentId)) {
    return { allowed: true, reasons: [] };
  }

  const nextActive = [...activeAgentIds, candidateAgentId];
  const specialists = nextActive.filter((id) => id !== '00');

  if (specialists.length > 8) {
    reasons.push('Limite máximo de concorrência atingido: até 8 especialistas simultâneos além do Coordenador (§13).');
  }

  if (specialists.length > 3 && !matrixPublished) {
    reasons.push(
      'Executar mais de 3 especialistas simultaneamente exige matriz de propriedade publicada (§13).'
    );
  }

  for (const existingId of activeAgentIds) {
    if (candidate.exclusiveSlotWith.includes(existingId)) {
      const existingAgent = getAgentById(existingId);
      reasons.push(
        `Slot exclusivo violado (§14): Agente ${candidate.id} (${candidate.name}) não pode executar simultaneamente com Agente ${existingId} (${existingAgent?.name ?? existingId}).`
      );
    }
  }

  const touchesQueue = touchedPaths.some((p) => p.replace(/^\/+/, '').startsWith('src/lib/queue'));
  if (candidateIdInvolvesQueueConflict(candidateAgentId, activeAgentIds, touchesQueue)) {
    reasons.push(
      'Conflito de fila (§14): Agente 16 não pode executar simultaneamente com 06 ou 07 ao tocar src/lib/queue/**.'
    );
  }

  const schemaBlockingHandoffs = openHandoffs.filter(
    (h) =>
      h.status !== 'resolvido' &&
      h.priority === 'bloqueador' &&
      (h.toAgentId === '01' || h.toAgentId === '01A')
  );

  if (schemaBlockingHandoffs.length > 0) {
    if (candidateAgentId === '01' || candidateAgentId === '01A') {
      const originIds = schemaBlockingHandoffs.map((h) => h.fromAgentId);
      const conflictOrigin = originIds.find((id) => activeAgentIds.includes(id));
      if (conflictOrigin) {
        reasons.push(
          `Bloqueador de schema (§14): ${candidateAgentId} não deve executar em paralelo com ${conflictOrigin} enquanto houver handoff bloqueador aberto.`
        );
      }
    } else if (
      (activeAgentIds.includes('01') || activeAgentIds.includes('01A')) &&
      schemaBlockingHandoffs.some((h) => h.fromAgentId === candidateAgentId)
    ) {
      reasons.push(
        `Bloqueador de schema (§14): ${candidateAgentId} possui handoff bloqueador aberto para 01/01A.`
      );
    }
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

function candidateIdInvolvesQueueConflict(
  candidateId: string,
  activeAgentIds: string[],
  touchesQueue: boolean
): boolean {
  if (!touchesQueue) return false;
  if (candidateId === '16' && (activeAgentIds.includes('06') || activeAgentIds.includes('07'))) {
    return true;
  }
  if ((candidateId === '06' || candidateId === '07') && activeAgentIds.includes('16')) {
    return true;
  }
  return false;
}

export function resolveFileOwnership(rawPath: string): OwnershipResolution {
  const normalized = rawPath.trim().replace(/^\/+/, '').replace(/^\.\//, '');

  if (!normalized) {
    return {
      filePath: rawPath,
      ownerLabel: 'Caminho vazio',
      ownerAgentIds: [],
      ruleType: 'dominio_geral',
      guidance: 'Informe um caminho relativo do repositório para resolver o proprietário.',
    };
  }

  if (normalized.startsWith('.agents/prompts/')) {
    return {
      filePath: normalized,
      ownerLabel: 'Decisão Humana (Protegido)',
      ownerAgentIds: [],
      ruleType: 'decisao_humana',
      guidance:
        'Nenhum agente pode editar prompts em .agents/prompts/**. Alterações exigem decisão humana (§5 e §15).',
    };
  }

  if (normalized === 'AGENTS.md') {
    return {
      filePath: normalized,
      ownerLabel: 'Decisão Humana (Autoridade Global)',
      ownerAgentIds: [],
      ruleType: 'decisao_humana',
      guidance: 'Nenhum agente pode editar regras globais de AGENTS.md (§5).',
    };
  }

  if (
    normalized === 'server.ts' ||
    normalized === 'package.json' ||
    normalized === 'package-lock.json' ||
    normalized === 'pnpm-lock.yaml' ||
    normalized === 'yarn.lock'
  ) {
    return {
      filePath: normalized,
      ownerLabel: 'Aprovação explícita do Agente 00 (Coordenador)',
      ownerAgentIds: ['00'],
      ruleType: 'aprovacao_00',
      guidance: `${normalized} exige aprovação explícita do Coordenador (00) antes de qualquer alteração (§15).`,
    };
  }

  if (normalized === 'prisma/schema.prisma' || normalized.startsWith('prisma/migrations/')) {
    return {
      filePath: normalized,
      ownerLabel: 'Agente 01 — Plataforma, Segurança e Dados',
      ownerAgentIds: ['01'],
      ruleType: 'exclusivo',
      guidance: 'Integrações não criam migrações; devem abrir handoff para o Agente 01 (§15).',
    };
  }

  if (
    normalized === 'src/App.tsx' ||
    normalized.toLowerCase().includes('sidebar') ||
    normalized.toLowerCase().includes('navigation')
  ) {
    return {
      filePath: normalized,
      ownerLabel: 'Agente 02 — Produto e UX',
      ownerAgentIds: ['02'],
      ruleType: 'exclusivo',
      guidance: 'Navegação principal, Sidebar e src/App.tsx pertencem exclusivamente ao Agente 02 (§15).',
    };
  }

  if (
    normalized.startsWith('.github/workflows/') ||
    normalized === 'Dockerfile' ||
    normalized === 'docker-compose.yml'
  ) {
    return {
      filePath: normalized,
      ownerLabel: 'Agente 08 — QA e Release',
      ownerAgentIds: ['08'],
      ruleType: 'exclusivo',
      guidance: 'Pipelines CI/CD e containerização pertencem ao Agente 08 (§15).',
    };
  }

  if (normalized.startsWith('charts/') || normalized.startsWith('infrastructure/')) {
    return {
      filePath: normalized,
      ownerLabel: 'Agente 10 — Infraestrutura, Observabilidade e SRE',
      ownerAgentIds: ['10'],
      ruleType: 'exclusivo',
      guidance: 'Infraestrutura e charts pertencem ao Agente 10 (§15).',
    };
  }

  if (normalized.startsWith('android/') || normalized === 'capacitor.config.ts') {
    return {
      filePath: normalized,
      ownerLabel: 'Agente 09 — Mobile',
      ownerAgentIds: ['09'],
      ruleType: 'exclusivo',
      guidance: 'Artefatos Android e Capacitor pertencem ao Agente 09 (§15).',
    };
  }

  if (normalized.startsWith('identidade-visual/') || normalized.startsWith('documentacao-aplicacao/')) {
    return {
      filePath: normalized,
      ownerLabel: 'Agente 11 — Marca e Ativos Institucionais',
      ownerAgentIds: ['11'],
      ruleType: 'exclusivo',
      guidance: 'Identidade visual e documentação institucional pertencem ao Agente 11 (§15).',
    };
  }

  if (normalized.startsWith('src/lib/queue/')) {
    return {
      filePath: normalized,
      ownerLabel: 'Agente 16 — Runtime, Workers e Escala',
      ownerAgentIds: ['16'],
      ruleType: 'exclusivo',
      guidance: 'Filas em src/lib/queue/** são do domínio do 16; bloqueia execução simultânea com 06/07 (§14).',
    };
  }

  if (normalized.startsWith('.agents/runs/')) {
    return {
      filePath: normalized,
      ownerLabel: 'Agente 00 — Coordenador',
      ownerAgentIds: ['00'],
      ruleType: 'exclusivo',
      guidance: 'Logs de execução em .agents/runs/** são propriedade do Agente 00 (§15).',
    };
  }

  if (normalized.startsWith('.agents/reviews/')) {
    return {
      filePath: normalized,
      ownerLabel: 'Agente 24 (Revisão Independente) ou Agente 00',
      ownerAgentIds: ['24', '00'],
      ruleType: 'exclusivo',
      guidance: 'Pareceres oficiais em .agents/reviews/** pertencem ao auditor (24) ou ao Coordenador (00) (§15 e §40).',
    };
  }

  if (normalized.startsWith('.agents/handoffs/')) {
    return {
      filePath: normalized,
      ownerLabel: 'Cada agente cria seus próprios handoffs',
      ownerAgentIds: [],
      ruleType: 'compartilhado_handoffs',
      guidance:
        'Cada agente cria seus handoffs no formato <de>-para-<para>-<slug>.md; o destinatário atualiza status sem apagar o pedido original (§18).',
    };
  }

  return {
    filePath: normalized,
    ownerLabel: 'Domínio específico da missão (verificar matriz publicada)',
    ownerAgentIds: ['00'],
    ruleType: 'dominio_geral',
    guidance:
      'Arquivo sem exclusividade global listada na §15. Verifique o dono atribuído na matriz de propriedade da onda antes de editar (§9 e §16).',
  };
}

export function buildGatesForRepoScripts(packageScripts: Record<string, string>): GateCheck[] {
  const hasScript = (name: string) => Boolean(packageScripts && Object.prototype.hasOwnProperty.call(packageScripts, name));

  const definitions: Array<{
    id: string;
    scriptKey: string;
    command: string;
    tier: 'local' | 'integracao' | 'release';
    alwaysApplicable?: boolean;
  }> = [
    { id: 'gate-tsc', scriptKey: 'tsc', command: 'npx tsc --noEmit', tier: 'local', alwaysApplicable: true },
    { id: 'gate-lint', scriptKey: 'lint', command: 'npm run lint', tier: 'local' },
    { id: 'gate-arch', scriptKey: 'test:architecture', command: 'npm run test:architecture', tier: 'integracao' },
    { id: 'gate-unit', scriptKey: 'test:unit', command: 'npm run test:unit', tier: 'integracao' },
    { id: 'gate-int', scriptKey: 'test:integration', command: 'npm run test:integration', tier: 'integracao' },
    { id: 'gate-e2e', scriptKey: 'test:e2e', command: 'npm run test:e2e', tier: 'integracao' },
    { id: 'gate-build', scriptKey: 'build', command: 'npm run build', tier: 'integracao' },
    { id: 'gate-ver-int', scriptKey: 'verify:integrations', command: 'npm run verify:integrations', tier: 'integracao' },
    { id: 'gate-ver-ai', scriptKey: 'verify:ai', command: 'npm run verify:ai', tier: 'integracao' },
    { id: 'gate-audit', scriptKey: 'audit', command: 'npm audit', tier: 'release', alwaysApplicable: true },
  ];

  return definitions.map((def) => {
    const exists = def.alwaysApplicable || hasScript(def.scriptKey);
    return {
      id: def.id,
      scriptKey: def.scriptKey,
      command: def.command,
      tier: def.tier,
      status: exists ? 'NAO_EXECUTADO' : 'NAO_APLICAVEL',
      notes: exists
        ? undefined
        : `Script "${def.scriptKey}" inexistente em package.json — não mascarar como aprovado (§29).`,
    };
  });
}

export function evaluateWaveTransition(params: {
  wave: Wave;
  targetState: WaveState;
  handoffs: Handoff[];
  reviews: IndependentReview[];
}): WaveTransitionCheck {
  const { wave, targetState, handoffs, reviews } = params;
  const blockers: string[] = [];

  const waveHandoffs = handoffs.filter((h) => h.repoId === wave.repoId && h.waveNumber === wave.number);
  const waveReviews = reviews.filter((r) => r.repoId === wave.repoId && r.waveNumber === wave.number);

  if (targetState === 'MATRIZ_PUBLICADA' && wave.activeAgentIds.length === 0) {
    blockers.push('Ative ao menos um agente para publicar a matriz de propriedade da onda.');
  }

  if (targetState === 'EM_EXECUCAO' && !wave.matrixPublishedAt) {
    blockers.push('A onda precisa passar por MATRIZ_PUBLICADA antes de entrar em execução (§20).');
  }

  if (targetState === 'GATE_VERDE' || targetState === 'RELEASE_APPROVED') {
    const failedGates = wave.gates.filter((g) => g.status === 'FALHOU');
    if (failedGates.length > 0) {
      blockers.push(
        `Existem gates com falha: ${failedGates.map((g) => g.command).join(', ')}.`
      );
    }
    const executedGreen = wave.gates.some((g) => g.status === 'EXECUTADO_VERDE');
    if (!executedGreen) {
      blockers.push('Nenhum gate foi executado com resultado verde até o momento (§30).');
    }
  }

  if (targetState === 'RELEASE_APPROVED') {
    const openBlockers = waveHandoffs.filter(
      (h) => h.priority === 'bloqueador' && h.status !== 'resolvido'
    );
    if (openBlockers.length > 0) {
      blockers.push(
        `Há ${openBlockers.length} handoff(s) de prioridade bloqueador ainda não resolvido(s).`
      );
    }

    const approvedReviews = waveReviews.filter(
      (r) => r.auditorAgentId === '24' && r.verdict === 'APROVADO' && r.authorAgentId !== '24'
    );
    const blockingReviews = waveReviews.filter(
      (r) => r.verdict === 'REPROVADO' || r.verdict === 'BLOQUEADO'
    );

    if (approvedReviews.length === 0) {
      blockers.push(
        'Parecer APROVADO obrigatório do Agente 24 (Revisão Independente) ausente para esta onda (§40).'
      );
    }

    if (blockingReviews.length > 0 && approvedReviews.length <= blockingReviews.length) {
      const unresolved = blockingReviews.filter(
        (br) =>
          !approvedReviews.some(
            (ar) => ar.missionId === br.missionId && ar.createdAt >= br.createdAt
          )
      );
      if (unresolved.length > 0) {
        blockers.push(
          `Existem ${unresolved.length} entrega(s) com parecer REPROVADO/BLOQUEADO sem nova revisão APROVADA do Agente 24.`
        );
      }
    }
  }

  return {
    allowed: blockers.length === 0,
    blockers,
  };
}

export function formatHandoffFileName(handoff: Pick<Handoff, 'fromAgentId' | 'toAgentId' | 'slug' | 'waveNumber'>): string {
  const safeSlug = handoff.slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '') || 'handoff';
  return `.agents/handoffs/onda-${handoff.waveNumber}/${handoff.fromAgentId}-para-${handoff.toAgentId}-${safeSlug}.md`;
}

export function formatHandoffMarkdown(handoff: Handoff): string {
  const base = [
    `De: ${handoff.fromAgentId}`,
    `Para: ${handoff.toAgentId}`,
    `Onda: ${handoff.waveNumber}`,
    `Status: ${handoff.status}`,
    `Prioridade: ${handoff.priority}`,
    `Bloqueador-ref: ${handoff.blockerRef || 'N/A'}`,
    `Sprint destino: ${handoff.targetSprint || 'Atual'}`,
    '',
    '## Problema',
    handoff.problem,
    '',
    '## Arquivo(s) envolvido(s)',
    ...(handoff.filesInvolved.length > 0 ? handoff.filesInvolved.map((f) => `- ${f}`) : ['- Não especificado']),
    '',
    '## Evidência',
    handoff.evidence,
    '',
    '## Alteração necessária',
    handoff.requiredChange,
    '',
    '## Teste esperado',
    handoff.expectedTest,
    '',
    '## Contexto adicional',
    handoff.additionalContext || 'Sem contexto adicional.',
  ];

  if (handoff.resolution) {
    base.push(
      '',
      '## Resolução',
      `Resolvido por: Agente ${handoff.resolution.resolvedBy}`,
      `Data: ${handoff.resolution.resolvedAt}`,
      `Validado pelo Agente 24: ${handoff.resolution.verifiedByAgent24 ? 'SIM (APROVADO)' : 'PENDENTE (§40)'}`,
      '',
      handoff.resolution.summary,
      '',
      '### Evidência da resolução',
      handoff.resolution.evidence
    );
  }

  return base.join('\n');
}

export function formatMissionPrompt(mission: Mission): string {
  const agent = getAgentById(mission.agentId);
  const agentName = agent ? `${agent.id} — ${agent.name}` : mission.agentId;
  const promptRef = agent?.promptFile ?? `.agents/prompts/${mission.agentId}-${mission.slug}.md`;

  return [
    `Você é o Agente ${mission.agentId}. Leia AGENTS.md e ${promptRef} antes de planejar.`,
    '',
    `Agente: ${agentName}`,
    `Onda: ${mission.waveNumber}`,
    `Base: ${mission.baseBranch}`,
    `Branch: ${mission.branchName}`,
    '',
    'Objetivo:',
    mission.objective,
    '',
    'Fora de escopo:',
    ...(mission.outOfScope.length > 0 ? mission.outOfScope.map((item) => `- ${item}`) : ['- Alterar arquivos fora da propriedade atribuída']),
    '',
    'Arquivos sob propriedade:',
    ...(mission.ownedFiles.length > 0 ? mission.ownedFiles.map((f) => `- ${f}`) : ['- Definir conforme matriz da onda']),
    '',
    'Arquivos de outros donos:',
    ...(mission.dependencyFiles.length > 0 ? mission.dependencyFiles.map((f) => `- ${f}`) : ['- Nenhum (somente leitura)']),
    '',
    'Suposições:',
    ...(mission.assumptions.length > 0 ? mission.assumptions.map((a) => `- ${a}`) : ['- Sem suposições silenciosas']),
    '',
    'Plano:',
    ...(mission.plan.length > 0
      ? mission.plan.map((step, idx) => `${idx + 1}. ${step.description} → verificar: ${step.verificationCriteria}`)
      : ['1. Executar análise e implementação → verificar: critérios de aceite']),
    '',
    'Critério de sucesso final:',
    mission.finalSuccessCriterion,
    '',
    'Entrega:',
    mission.expectedDeliverable,
  ].join('\n');
}

export function formatReviewMarkdown(review: IndependentReview): string {
  return [
    `# Parecer de Revisão Independente — ${review.missionTitle}`,
    '',
    `Missão: ${review.missionId}`,
    `Autor: Agente ${review.authorAgentId}`,
    `Auditor: Agente ${review.auditorAgentId}`,
    `Onda: ${review.waveNumber}`,
    `Base: ${review.baseBranch}`,
    `Commit / Hashes auditados: ${review.commitOrHashes}`,
    `Decisão: ${review.verdict}`,
    '',
    '## Escopo auditado',
    review.scopeSummary,
    '',
    '## Critérios verificados',
    ...(review.criteriaChecked.length > 0 ? review.criteriaChecked.map((c) => `- [x] ${c}`) : ['- Nenhum critério listado']),
    `- [${review.p1ToP4Compliant ? 'x' : ' '}] Conformidade P1–P4`,
    `- [${review.ownershipCompliant ? 'x' : ' '}] Propriedade exclusiva (§15 / §36)`,
    `- [${review.tenancyLgpdChecked ? 'x' : ' '}] Tenancy e LGPD (§26 / §27)`,
    '',
    '## Comandos e resultados',
    ...(review.commandsExecuted.length > 0
      ? review.commandsExecuted.map((c) => `- \`${c.command}\` → ${c.result}`)
      : ['- NÃO EXECUTADO']),
    '',
    '## Evidências',
    review.evidence,
    '',
    '## Achados',
    ...(review.findings.length > 0 ? review.findings.map((f) => `- ${f}`) : ['- Sem achados bloqueantes']),
    '',
    '## Pendências',
    ...(review.pendingItems.length > 0 ? review.pendingItems.map((p) => `- ${p}`) : ['- Nenhuma']),
  ].join('\n');
}
