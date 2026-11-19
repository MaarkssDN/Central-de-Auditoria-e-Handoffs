import { GoogleGenAI, ThinkingLevel, Type, type Content, type FunctionDeclaration } from '@google/genai';
import { OFFICIAL_AGENTS } from '../src/data/agentsRoster';
import type {
  AgentBotMessage,
  AgentStreamEvent,
  AgentToolTrace,
  BlockerStatus,
  Handoff,
  HandoffPriority,
  IndependentReview,
  Mission,
  ReviewVerdict,
  WaveState,
  WorkspaceState,
} from '../src/types/governance';
import {
  checkSlotConflicts,
  evaluateWaveTransition,
  getAgentById,
  resolveFileOwnership,
} from '../src/utils/governanceEngine';

const MODEL_ID = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY não configurada. Configure a chave no painel Settings > Secrets para executar agentes autônomos.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function fetchGitHubFileContent(fullName: string, branch: string, filePath: string): Promise<string> {
  const cleanPath = filePath.replace(/^\/+/, '');
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'central-auditoria-handoffs',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const url = `https://api.github.com/repos/${fullName}/contents/${cleanPath}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    return `Erro ao ler arquivo no GitHub (HTTP ${res.status}): ${cleanPath}`;
  }
  const data = (await res.json()) as { content?: string; encoding?: string; size?: number };
  if (data.content && data.encoding === 'base64') {
    const text = Buffer.from(data.content, 'base64').toString('utf-8');
    return text.length > 6000 ? `${text.slice(0, 6000)}\n... [truncado em 6000 chars]` : text;
  }
  return `Arquivo binário ou sem conteúdo textual legível (${data.size ?? 0} bytes).`;
}

function buildToolDeclarations(agentId: string): FunctionDeclaration[] {
  const tools: FunctionDeclaration[] = [
    {
      name: 'inspect_repository_files',
      description:
        'Inspeciona o estado atual do repositório ativo: scripts do package.json, arquivos mapeados, handoffs abertos, bloqueadores B-01..B-14 e estado da onda.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          filterPrefix: {
            type: Type.STRING,
            description: 'Prefixo opcional para filtrar caminhos de arquivos (ex: src/ ou prisma/).',
          },
        },
      },
    },
    {
      name: 'read_github_file',
      description:
        'Lê o conteúdo real de um arquivo específico no repositório GitHub conectado (quando o repositório for sourceType=github).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          filePath: {
            type: Type.STRING,
            description: 'Caminho relativo do arquivo no repositório (ex: package.json, AGENTS.md, src/App.tsx).',
          },
        },
        required: ['filePath'],
      },
    },
    {
      name: 'check_file_ownership',
      description:
        'Verifica quem é o proprietário exclusivo de um arquivo conforme a §15 do AGENTS.md antes de propor qualquer alteração.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          filePath: {
            type: Type.STRING,
            description: 'Caminho do arquivo a verificar.',
          },
        },
        required: ['filePath'],
      },
    },
    {
      name: 'open_handoff',
      description:
        'Abre um novo handoff rastreável (§18) para outro agente quando encontrar problema fora da própria propriedade ou dependência cross-domain.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          toAgentId: {
            type: Type.STRING,
            description: 'ID do agente destinatário (ex: 01, 06, 15, 18, 21).',
          },
          slug: {
            type: Type.STRING,
            description: 'Slug curto em kebab-case (ex: tenant-bitrix-rls).',
          },
          priority: {
            type: Type.STRING,
            description: 'Prioridade: bloqueador, alto ou normal.',
          },
          blockerRef: {
            type: Type.STRING,
            description: 'Referência de bloqueador se aplicável (ex: B-10, B-11, ou vazio).',
          },
          problem: {
            type: Type.STRING,
            description: 'Descrição objetiva do problema identificado.',
          },
          filesInvolved: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Lista de arquivos envolvidos.',
          },
          evidence: {
            type: Type.STRING,
            description: 'Evidência observada no repositório ou execução.',
          },
          requiredChange: {
            type: Type.STRING,
            description: 'Alteração necessária pelo agente destinatário.',
          },
          expectedTest: {
            type: Type.STRING,
            description: 'Teste ou critério executável esperado.',
          },
        },
        required: ['toAgentId', 'slug', 'priority', 'problem', 'evidence', 'requiredChange', 'expectedTest'],
      },
    },
    {
      name: 'resolve_handoff',
      description:
        'Adiciona seção de resolução preservando o pedido original (§18) em um handoff destinado a este agente.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          handoffId: {
            type: Type.STRING,
            description: 'ID do handoff a atualizar como resolvido.',
          },
          summary: {
            type: Type.STRING,
            description: 'Resumo técnico da correção aplicada.',
          },
          evidence: {
            type: Type.STRING,
            description: 'Comando e evidência real observada.',
          },
        },
        required: ['handoffId', 'summary', 'evidence'],
      },
    },
    {
      name: 'update_blocker_status',
      description:
        'Atualiza o status e a evidência de um dos 14 bloqueadores prioritários (B-01 a B-14) no repositório ativo.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          code: {
            type: Type.STRING,
            description: 'Código do bloqueador (ex: B-01 até B-14).',
          },
          status: {
            type: Type.STRING,
            description: 'Novo status: aberto, mitigado, validado ou nao_aplicavel.',
          },
          evidenceNote: {
            type: Type.STRING,
            description: 'Nota objetiva com a evidência encontrada.',
          },
        },
        required: ['code', 'status', 'evidenceNote'],
      },
    },
    {
      name: 'check_wave_readiness',
      description:
        'Avalia se a onda ativa atende aos requisitos reais do AGENTS.md (§20, §28, §29, §40) para avançar para GATE_VERDE ou RELEASE_APPROVED.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          targetState: {
            type: Type.STRING,
            description: 'Estado alvo desejado: MATRIZ_PUBLICADA, GATE_VERDE ou RELEASE_APPROVED.',
          },
        },
      },
    },
  ];

  if (agentId === '00') {
    tools.push({
      name: 'create_mission',
      description:
        'Cria uma nova missão formal (§11) na onda ativa para um especialista, validando slots exclusivos (§14). Exclusivo do Coordenador (00).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          targetAgentId: {
            type: Type.STRING,
            description: 'ID do agente executor (ex: 01, 02, 06, 15).',
          },
          title: {
            type: Type.STRING,
            description: 'Título claro da missão.',
          },
          slug: {
            type: Type.STRING,
            description: 'Slug da branch em kebab-case.',
          },
          objective: {
            type: Type.STRING,
            description: 'Objetivo em uma frase.',
          },
          ownedFiles: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Arquivos sob propriedade da missão.',
          },
          finalSuccessCriterion: {
            type: Type.STRING,
            description: 'Comando verificável de sucesso final.',
          },
        },
        required: ['targetAgentId', 'title', 'slug', 'objective', 'finalSuccessCriterion'],
      },
    });
  }

  if (agentId === '24') {
    tools.push({
      name: 'issue_review_24',
      description:
        'Emite um parecer oficial independente em .agents/reviews/ (APROVADO, REPROVADO ou BLOQUEADO). Exclusivo do Agente 24 (§40).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          missionId: {
            type: Type.STRING,
            description: 'ID da missão auditada (ou "auditoria-geral").',
          },
          missionTitle: {
            type: Type.STRING,
            description: 'Título da entrega auditada.',
          },
          authorAgentId: {
            type: Type.STRING,
            description: 'ID do agente autor da entrega (nunca pode ser 24).',
          },
          verdict: {
            type: Type.STRING,
            description: 'APROVADO, REPROVADO ou BLOQUEADO.',
          },
          scopeSummary: {
            type: Type.STRING,
            description: 'Resumo do escopo auditado.',
          },
          evidence: {
            type: Type.STRING,
            description: 'Evidências reais verificadas.',
          },
          findings: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Lista de achados ou violações encontradas.',
          },
          pendingItems: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Pendências para próxima submissão.',
          },
        },
        required: ['missionTitle', 'authorAgentId', 'verdict', 'scopeSummary', 'evidence'],
      },
    });
  }

  return tools;
}

function buildSystemInstruction(agentId: string, workspace: WorkspaceState): string {
  const agent = getAgentById(agentId);
  const repo =
    workspace.repositories.find((r) => r.id === workspace.activeRepoId) ??
    workspace.repositories[0];
  const wave = workspace.waves.filter((w) => w.repoId === repo?.id).slice(-1)[0];
  const openHandoffs = workspace.handoffs.filter(
    (h) => h.repoId === repo?.id && h.status !== 'resolvido'
  );
  const repoMissions = workspace.missions.filter((m) => m.repoId === repo?.id);
  const repoReviews = workspace.reviews.filter((r) => r.repoId === repo?.id);

  if (!agent) {
    throw new Error(`Agente ${agentId} não encontrado no roster oficial.`);
  }

  return [
    `Você é o Agente ${agent.id} — "${agent.persona.codename}" (${agent.name}), arquétipo: ${agent.persona.archetype}.`,
    `Lema pessoal: "${agent.persona.motto}"`,
    `Tom e personalidade obrigatórios: ${agent.persona.voiceStyle}`,
    `Especialidade oficial: ${agent.summary}`,
    `Arquivos sob sua propriedade exclusiva: ${agent.exclusivePaths.length > 0 ? agent.exclusivePaths.join(', ') : 'Nenhum caminho fixo global; respeitar matriz publicada'}.`,
    `Slots exclusivos que bloqueiam sua execução paralela: ${agent.exclusiveSlotWith.length > 0 ? agent.exclusiveSlotWith.join(', ') : 'Nenhum'}.`,
    agent.cannotEditCode
      ? 'RESTRIÇÃO CRÍTICA: Você NÃO altera código de produto; atua apenas com auditoria, evidências, handoffs ou pareceres.'
      : 'Respeite P1–P4 e a §16 (nunca edite arquivo de outro dono; abra handoff quando houver dependência fora do seu domínio).',
    '',
    'REGRAS DE VERDADE OPERACIONAL (§30):',
    '- Nunca invente arquivos, testes executados ou resultados que não existam no repositório.',
    '- Use as ferramentas disponíveis (inspect_repository_files, read_github_file, check_file_ownership, open_handoff, etc.) para agir de verdade no workspace.',
    '- Fale em Português do Brasil mantendo sua personalidade distinta de personagem, de forma direta, técnica e acionável.',
    '',
    'CONTEXTO ATUAL DO REPOSITÓRIO:',
    `Repositório: ${repo ? `${repo.fullName} (${repo.sourceType}, branch: ${repo.defaultBranch})` : 'Nenhum'}`,
    `AGENTS.md detectado: ${repo?.detectedAgentsMd ? 'SIM' : 'NÃO'}`,
    `Onda ativa: ${wave ? `${wave.name} | Estado: ${wave.state} | Agentes ativos: ${wave.activeAgentIds.join(', ')}` : 'Nenhuma'}`,
    `Missões no repositório (${repoMissions.length}): ${repoMissions.map((m) => `[${m.id}] Ag.${m.agentId}: ${m.title} (${m.status})`).join(' ; ') || 'nenhuma'}`,
    `Handoffs abertos/em andamento (${openHandoffs.length}): ${openHandoffs.map((h) => `[${h.id}] ${h.fromAgentId}->${h.toAgentId} (${h.priority}): ${h.slug}`).join(' ; ') || 'nenhum'}`,
    `Pareceres recentes (${repoReviews.length}): ${repoReviews.slice(0, 4).map((r) => `${r.missionTitle}: ${r.verdict}`).join(' ; ') || 'nenhum'}`,
  ].join('\n');
}

async function executeToolCall(params: {
  toolName: string;
  args: Record<string, unknown>;
  agentId: string;
  workspace: WorkspaceState;
}): Promise<{ result: Record<string, unknown>; summary: string }> {
  const { toolName, args, agentId, workspace } = params;
  const repo =
    workspace.repositories.find((r) => r.id === workspace.activeRepoId) ??
    workspace.repositories[0];
  const wave = workspace.waves.filter((w) => w.repoId === repo?.id).slice(-1)[0];

  if (!repo) {
    return { result: { error: 'Nenhum repositório ativo.' }, summary: 'Sem repositório ativo' };
  }

  switch (toolName) {
    case 'inspect_repository_files': {
      const prefix = typeof args.filterPrefix === 'string' ? args.filterPrefix.trim() : '';
      const paths = prefix
        ? repo.samplePaths.filter((p) => p.startsWith(prefix))
        : repo.samplePaths;
      const openHandoffs = workspace.handoffs.filter(
        (h) => h.repoId === repo.id && h.status !== 'resolvido'
      );
      const openBlockers = repo.blockers.filter((b) => b.status === 'aberto');
      return {
        result: {
          repository: repo.fullName,
          sourceType: repo.sourceType,
          defaultBranch: repo.defaultBranch,
          detectedAgentsMd: repo.detectedAgentsMd,
          packageScripts: repo.packageScripts,
          files: paths.slice(0, 50),
          activeWave: wave
            ? {
                number: wave.number,
                state: wave.state,
                activeAgentIds: wave.activeAgentIds,
                gates: wave.gates.map((g) => ({ command: g.command, status: g.status })),
              }
            : null,
          openHandoffs: openHandoffs.map((h) => ({
            id: h.id,
            from: h.fromAgentId,
            to: h.toAgentId,
            priority: h.priority,
            slug: h.slug,
            problem: h.problem,
          })),
          openBlockers: openBlockers.map((b) => ({
            code: b.code,
            title: b.title,
            owner: b.ownerAgentId,
          })),
        },
        summary: `${paths.length} arquivos · ${openHandoffs.length} handoffs abertos · ${openBlockers.length} bloqueadores abertos`,
      };
    }

    case 'read_github_file': {
      const filePath = String(args.filePath || '');
      if (repo.sourceType !== 'github') {
        return {
          result: {
            note: `Repositório "${repo.fullName}" foi conectado manualmente (sem acesso GitHub API). Caminho listado no mapa: ${repo.samplePaths.includes(filePath) ? 'SIM' : 'NÃO'}.`,
          },
          summary: `Verificado caminho local ${filePath} (modo manual)`,
        };
      }
      const content = await fetchGitHubFileContent(repo.fullName, repo.defaultBranch, filePath);
      return {
        result: { filePath, content },
        summary: `Lido ${filePath} (${content.length} chars)`,
      };
    }

    case 'check_file_ownership': {
      const filePath = String(args.filePath || '');
      const resolution = resolveFileOwnership(filePath);
      return {
        result: resolution as unknown as Record<string, unknown>,
        summary: `${filePath} → ${resolution.ownerLabel}`,
      };
    }

    case 'open_handoff': {
      const toAgentId = String(args.toAgentId || '00');
      const targetAgent = getAgentById(toAgentId);
      if (!targetAgent) {
        return {
          result: { error: `Agente destino "${toAgentId}" inválido ou reservado.` },
          summary: `Erro: destino ${toAgentId} inválido`,
        };
      }
      const priorityRaw = String(args.priority || 'normal');
      const priority: HandoffPriority =
        priorityRaw === 'bloqueador' || priorityRaw === 'alto' ? priorityRaw : 'normal';
      const newHandoff: Handoff = {
        id: `hoff-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        repoId: repo.id,
        waveNumber: wave?.number ?? 1,
        slug: String(args.slug || 'handoff-agente')
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-'),
        fromAgentId: agentId,
        toAgentId,
        status: 'aberto',
        priority,
        blockerRef: typeof args.blockerRef === 'string' ? args.blockerRef : '',
        targetSprint: wave ? `Onda ${wave.number}` : 'Onda 1',
        problem: String(args.problem || ''),
        filesInvolved: Array.isArray(args.filesInvolved)
          ? args.filesInvolved.map((f) => String(f))
          : [],
        evidence: String(args.evidence || ''),
        requiredChange: String(args.requiredChange || ''),
        expectedTest: String(args.expectedTest || ''),
        additionalContext: `Aberto autonomamente pelo bot Agente ${agentId} (${getAgentById(agentId)?.persona.codename ?? agentId}).`,
        createdAt: new Date().toISOString(),
      };
      workspace.handoffs.unshift(newHandoff);
      return {
        result: { created: true, handoffId: newHandoff.id, slug: newHandoff.slug },
        summary: `Handoff ${agentId} → ${toAgentId} (${newHandoff.slug}) criado [${priority}]`,
      };
    }

    case 'resolve_handoff': {
      const handoffId = String(args.handoffId || '');
      const idx = workspace.handoffs.findIndex((h) => h.id === handoffId && h.repoId === repo.id);
      if (idx === -1) {
        return {
          result: { error: `Handoff ${handoffId} não encontrado.` },
          summary: `Handoff ${handoffId} não encontrado`,
        };
      }
      const target = workspace.handoffs[idx];
      workspace.handoffs[idx] = {
        ...target,
        status: 'resolvido',
        resolution: {
          resolvedBy: agentId,
          resolvedAt: new Date().toISOString(),
          summary: String(args.summary || ''),
          evidence: String(args.evidence || ''),
          verifiedByAgent24: false,
        },
      };
      return {
        result: { resolved: true, handoffId, verifiedByAgent24: false },
        summary: `Handoff ${target.slug} marcado como resolvido (aguarda Agente 24)`,
      };
    }

    case 'update_blocker_status': {
      const code = String(args.code || '').toUpperCase();
      const statusRaw = String(args.status || 'aberto');
      const status: BlockerStatus =
        statusRaw === 'mitigado' || statusRaw === 'validado' || statusRaw === 'nao_aplicavel'
          ? statusRaw
          : 'aberto';
      const bIdx = repo.blockers.findIndex((b) => b.code === code);
      if (bIdx === -1) {
        return { result: { error: `Bloqueador ${code} não encontrado.` }, summary: `${code} inválido` };
      }
      repo.blockers[bIdx] = {
        ...repo.blockers[bIdx],
        status,
        evidenceNote: String(args.evidenceNote || ''),
      };
      return {
        result: { updated: true, code, status },
        summary: `Bloqueador ${code} → ${status}`,
      };
    }

    case 'create_mission': {
      if (agentId !== '00') {
        return {
          result: { error: 'Apenas o Coordenador (00) pode criar e despachar missões.' },
          summary: 'Bloqueado: exclusivo do 00',
        };
      }
      if (!wave) {
        return { result: { error: 'Nenhuma onda ativa.' }, summary: 'Sem onda ativa' };
      }
      const targetAgentId = String(args.targetAgentId || '');
      const ownedFiles = Array.isArray(args.ownedFiles) ? args.ownedFiles.map(String) : [];
      const slotCheck = checkSlotConflicts({
        activeAgentIds: wave.activeAgentIds,
        candidateAgentId: targetAgentId,
        matrixPublished: Boolean(wave.matrixPublishedAt),
        openHandoffs: workspace.handoffs.filter((h) => h.repoId === repo.id),
        touchedPaths: ownedFiles,
      });
      if (!slotCheck.allowed) {
        return {
          result: { error: slotCheck.reasons.join(' ') },
          summary: `Bloqueio de slot: ${slotCheck.reasons[0]}`,
        };
      }
      const slug = String(args.slug || 'missao')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-');
      const mission: Mission = {
        id: `mis-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        repoId: repo.id,
        waveNumber: wave.number,
        agentId: targetAgentId,
        title: String(args.title || ''),
        slug,
        baseBranch: wave.integrationBranch,
        branchName: `agente/${targetAgentId}-${slug}`,
        objective: String(args.objective || ''),
        outOfScope: ['Arquivos fora da propriedade definida na missão'],
        ownedFiles,
        dependencyFiles: [],
        assumptions: ['Definido autonomamente pelo Coordenador Núcleo (00)'],
        plan: [
          {
            description: String(args.objective || 'Executar missão'),
            verificationCriteria: String(args.finalSuccessCriterion || 'npx tsc --noEmit'),
            completed: false,
          },
        ],
        finalSuccessCriterion: String(args.finalSuccessCriterion || 'npx tsc --noEmit'),
        expectedDeliverable: 'Relatório + parecer APROVADO do Agente 24',
        status: 'planejada',
        createdAt: new Date().toISOString(),
      };
      workspace.missions.push(mission);
      if (!wave.activeAgentIds.includes(targetAgentId)) {
        wave.activeAgentIds.push(targetAgentId);
      }
      return {
        result: { created: true, missionId: mission.id, branchName: mission.branchName },
        summary: `Missão atribuída ao Agente ${targetAgentId} (${mission.branchName})`,
      };
    }

    case 'issue_review_24': {
      if (agentId !== '24') {
        return {
          result: { error: 'Apenas o Agente 24 (Veredito) pode emitir pareceres independentes (§40).' },
          summary: 'Bloqueado: exclusivo do 24',
        };
      }
      const authorAgentId = String(args.authorAgentId || '00');
      if (authorAgentId === '24') {
        return {
          result: { error: 'Violação §40: o autor nunca aprova a própria entrega.' },
          summary: 'Bloqueado: autoaprovação proibida',
        };
      }
      const verdictRaw = String(args.verdict || 'REPROVADO').toUpperCase();
      const verdict: ReviewVerdict =
        verdictRaw === 'APROVADO' || verdictRaw === 'BLOQUEADO' ? verdictRaw : 'REPROVADO';
      const review: IndependentReview = {
        id: `rev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        repoId: repo.id,
        waveNumber: wave?.number ?? 1,
        missionId: String(args.missionId || 'auditoria-geral'),
        missionTitle: String(args.missionTitle || 'Auditoria de Repositório'),
        authorAgentId,
        auditorAgentId: '24',
        baseBranch: wave?.integrationBranch || repo.defaultBranch,
        commitOrHashes: 'audit-bot-live',
        scopeSummary: String(args.scopeSummary || ''),
        criteriaChecked: [
          'Conformidade P1–P4 verificada pelo Veredito (24)',
          'Propriedade exclusiva e regras de slot (§14 e §15)',
        ],
        commandsExecuted: [{ command: 'auditoria-autonoma-24', result: verdict }],
        evidence: String(args.evidence || ''),
        findings: Array.isArray(args.findings) ? args.findings.map(String) : [],
        pendingItems: Array.isArray(args.pendingItems) ? args.pendingItems.map(String) : [],
        p1ToP4Compliant: verdict === 'APROVADO',
        tenancyLgpdChecked: verdict === 'APROVADO',
        ownershipCompliant: verdict === 'APROVADO',
        verdict,
        createdAt: new Date().toISOString(),
      };
      workspace.reviews.unshift(review);
      return {
        result: { issued: true, reviewId: review.id, verdict },
        summary: `Parecer ${verdict} publicado pelo Agente 24`,
      };
    }

    case 'check_wave_readiness': {
      if (!wave) {
        return { result: { error: 'Nenhuma onda ativa.' }, summary: 'Sem onda ativa' };
      }
      const rawTarget = String(args.targetState || 'RELEASE_APPROVED').toUpperCase();
      const targetState: WaveState =
        rawTarget === 'MATRIZ_PUBLICADA' || rawTarget === 'GATE_VERDE'
          ? rawTarget
          : 'RELEASE_APPROVED';
      const waveHandoffs = workspace.handoffs.filter(
        (h) => h.repoId === repo.id && h.waveNumber === wave.number
      );
      const waveReviews = workspace.reviews.filter(
        (r) => r.repoId === repo.id && r.waveNumber === wave.number
      );
      const evaluation = evaluateWaveTransition({
        wave,
        targetState,
        handoffs: waveHandoffs,
        reviews: waveReviews,
      });
      return {
        result: {
          currentState: wave.state,
          targetState,
          allowed: evaluation.allowed,
          blockers: evaluation.blockers,
        },
        summary: evaluation.allowed
          ? `Pronto para ${targetState}`
          : `Bloqueado para ${targetState} (${evaluation.blockers.length} pendência(s))`,
      };
    }

    default:
      return {
        result: { error: `Ferramenta desconhecida: ${toolName}` },
        summary: `Ferramenta desconhecida: ${toolName}`,
      };
  }
}

export async function runAgentBotTurn(params: {
  agentId: string;
  prompt: string;
  workspace: WorkspaceState;
  onEvent?: (event: AgentStreamEvent) => void;
}): Promise<{
  replyMessage: AgentBotMessage;
  updatedWorkspace: WorkspaceState;
}> {
  const { agentId, prompt, onEvent } = params;
  // Clone workspace deeply so mutations are atomic per successful turn
  const workingWorkspace: WorkspaceState = JSON.parse(JSON.stringify(params.workspace));
  const ai = getGeminiClient();

  const agent = getAgentById(agentId);
  if (!agent) {
    throw new Error(`Agente ${agentId} não existe no roster.`);
  }

  onEvent?.({
    type: 'agent_start',
    agentId: agent.id,
    codename: agent.persona.codename,
    roleLabel: agent.name,
  });

  const tools = [{ functionDeclarations: buildToolDeclarations(agentId) }];
  const systemInstruction = buildSystemInstruction(agentId, workingWorkspace);

  const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
  const toolTraces: AgentToolTrace[] = [];

  let finalText = '';
  const MAX_STEPS = 3;

  const generateWithRetry = async (withTools: boolean) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({
          model: MODEL_ID,
          contents,
          config: withTools
            ? {
                systemInstruction,
                tools,
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              }
            : {
                systemInstruction,
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429');
        if (isTransient && attempt === 0) {
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
        if (isTransient) {
          throw new Error(
            'O modelo Gemini está temporariamente sobrecarregado (HTTP 503). Aguarde alguns segundos e tente novamente.'
          );
        }
        throw err;
      }
    }
    throw new Error('Falha ao obter resposta do modelo Gemini.');
  };

  for (let step = 0; step < MAX_STEPS; step++) {
    onEvent?.({ type: 'thinking', agentId: agent.id, step: step + 1 });

    const response = await generateWithRetry(true);

    const candidateContent = response.candidates?.[0]?.content;
    const functionCalls = response.functionCalls;

    if (!functionCalls || functionCalls.length === 0) {
      finalText = response.text?.trim() || '';
      break;
    }

    if (candidateContent) {
      contents.push(candidateContent);
    }

    const functionResponseParts = [];
    for (const fc of functionCalls) {
      const toolName = fc.name || 'unknown';
      const args = (fc.args || {}) as Record<string, unknown>;
      const argsSummary = JSON.stringify(args).slice(0, 140);

      onEvent?.({
        type: 'tool_call',
        agentId: agent.id,
        toolName,
        argsSummary,
      });

      const exec = await executeToolCall({
        toolName,
        args,
        agentId,
        workspace: workingWorkspace,
      });

      const trace: AgentToolTrace = {
        id: `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        toolName,
        argsSummary,
        resultSummary: exec.summary,
        timestamp: new Date().toISOString(),
      };
      toolTraces.push(trace);

      onEvent?.({
        type: 'tool_result',
        agentId: agent.id,
        trace,
      });

      functionResponseParts.push({
        functionResponse: {
          id: fc.id,
          name: toolName,
          response: exec.result,
        },
      });
    }

    contents.push({
      role: 'user',
      parts: functionResponseParts,
    });

    if (step === MAX_STEPS - 1) {
      onEvent?.({ type: 'thinking', agentId: agent.id, step: MAX_STEPS + 1 });
      const wrapUp = await generateWithRetry(false);
      finalText = wrapUp.text?.trim() || 'Execução de ferramentas concluída.';
    }
  }

  const repoId = workingWorkspace.activeRepoId;
  const replyMessage: AgentBotMessage = {
    id: `bot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    repoId,
    agentId,
    role: 'agent',
    content: finalText || `${agent.persona.codename} (${agent.id}) concluiu a execução.`,
    toolTraces,
    timestamp: new Date().toISOString(),
  };

  if (!workingWorkspace.botMessages) {
    workingWorkspace.botMessages = [];
  }
  workingWorkspace.botMessages.push(replyMessage);

  onEvent?.({
    type: 'agent_done',
    agentId: agent.id,
    message: replyMessage,
    workspace: workingWorkspace,
  });

  return {
    replyMessage,
    updatedWorkspace: workingWorkspace,
  };
}

export async function runSwarmSequence(params: {
  specialistAgentId: string;
  missionGoal: string;
  workspace: WorkspaceState;
  onEvent?: (event: AgentStreamEvent) => void;
}): Promise<{
  messages: AgentBotMessage[];
  updatedWorkspace: WorkspaceState;
}> {
  const { specialistAgentId, missionGoal, onEvent } = params;
  const specialist = getAgentById(specialistAgentId);
  if (!specialist) {
    throw new Error(`Especialista ${specialistAgentId} inválido.`);
  }

  // Step 1: 00 Núcleo coordinates and inspects repo
  const step1 = await runAgentBotTurn({
    agentId: '00',
    prompt: `O usuário solicitou ao enxame: "${missionGoal}". Inspecione o repositório ativo usando inspect_repository_files e check_wave_readiness, verifique regras de propriedade/concorrência e dê uma diretiva objetiva ao Agente ${specialist.id} (${specialist.persona.codename}).`,
    workspace: params.workspace,
    onEvent,
  });

  // Step 2: Specialist executes inspection / ownership / handoffs
  const step2 = await runAgentBotTurn({
    agentId: specialist.id,
    prompt: `Núcleo (00) orientou: "${step1.replyMessage.content}". Considerando o objetivo "${missionGoal}", inspecione o repositório, verifique propriedade dos arquivos relevantes e, se encontrar qualquer risco/pendência em outro domínio, abra um handoff real com open_handoff ou atualize bloqueadores.`,
    workspace: step1.updatedWorkspace,
    onEvent,
  });

  // Step 3: 24 Veredito audits independently
  const step3 = await runAgentBotTurn({
    agentId: '24',
    prompt: `Como Agente 24 (Veredito), audite de forma independente a atuação de ${specialist.id} (${specialist.persona.codename}) sobre "${missionGoal}". Relatório do especialista: "${step2.replyMessage.content}". Inspecione o repositório e emita seu parecer oficial com issue_review_24 (lembrando: sem evidência de teste real executado, não aprove cegamente).`,
    workspace: step2.updatedWorkspace,
    onEvent,
  });

  onEvent?.({
    type: 'swarm_complete',
    messages: [step1.replyMessage, step2.replyMessage, step3.replyMessage],
    workspace: step3.updatedWorkspace,
  });

  return {
    messages: [step1.replyMessage, step2.replyMessage, step3.replyMessage],
    updatedWorkspace: step3.updatedWorkspace,
  };
}
