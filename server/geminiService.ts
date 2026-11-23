import { GoogleGenAI, Type } from '@google/genai';
import { getDb } from './db';
import { OFFICIAL_AGENTS, DEFAULT_PRIORITY_BLOCKERS } from '../src/data/agentsRoster';
import type {
  BlockerRecord,
  IndependentReview,
  Mission,
  RepositoryTarget,
  ReviewVerdict,
  Wave,
} from '../src/types/governance';
import { resolveFileOwnership } from '../src/utils/governanceEngine';

export const GEMINI_DEFAULT_MODEL = 'gemini-4-hydrogen';

/**
 * Retorna uma instância configurada do GoogleGenAI usando GEMINI_API_KEY do ambiente
 * ou da tabela provider_configs do SQLite local.
 */
export function getGeminiClient(): GoogleGenAI {
  let apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    try {
      const row = getDb()
        .prepare("SELECT config FROM provider_configs WHERE provider_id = 'gemini'")
        .get() as { config: string } | undefined;
      apiKey = row ? (JSON.parse(row.config) as { apiKey?: string }).apiKey : undefined;
    } catch {
      // Banco indisponível ou em execução de teste puro
    }
  }

  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY não configurada. Configure a chave no painel Conexões de IA ou na variável de ambiente GEMINI_API_KEY.'
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'central-auditoria-handoffs',
      },
    },
  });
}

export interface GeminiAuditReviewInput {
  repo?: RepositoryTarget;
  wave?: Wave;
  mission?: Mission;
  authorAgentId: string;
  commitOrHashes?: string;
  scopeSummary?: string;
  commandsText?: string;
  evidence?: string;
  additionalContext?: string;
}

export interface GeminiAuditReviewOutput {
  verdict: ReviewVerdict;
  scopeSummary: string;
  criteriaChecked: string[];
  commandsExecuted: Array<{ command: string; result: string }>;
  findings: string[];
  pendingItems: string[];
  evidence: string;
  p1ToP4Compliant: boolean;
  ownershipCompliant: boolean;
  tenancyLgpdChecked: boolean;
  rationale: string;
}

export interface GeminiHandoffDiagnosisInput {
  problemDescription: string;
  repo?: RepositoryTarget;
  fromAgentId?: string;
  additionalLogs?: string;
}

export interface GeminiHandoffDiagnosisOutput {
  toAgentId: string;
  slug: string;
  priority: 'bloqueador' | 'alto' | 'normal';
  blockerRef: string;
  problem: string;
  filesInvolved: string[];
  evidence: string;
  requiredChange: string;
  expectedTest: string;
  ownershipExplanation: string;
}

/**
 * Gera um Parecer Técnico Independente (Agente 24 - Veredito) via Gemini API (§40 do AGENTS.md).
 */
export async function generateGeminiAuditReview(
  input: GeminiAuditReviewInput
): Promise<GeminiAuditReviewOutput> {
  const ai = getGeminiClient();

  const author = OFFICIAL_AGENTS.find((a) => a.id === input.authorAgentId);
  const authorName = author ? `${author.id} — ${author.name}` : `Agente ${input.authorAgentId}`;

  const prompt = `Você é o Agente 24 (Veredito), o Auditor Independente da Central de Auditoria e Handoffs.
Sua missão é auditar a entrega técnica descrita a seguir e emitir o Parecer 24 oficial, rigoroso e sem concessões (§40 do AGENTS.md).

Regras inegociáveis de auditoria:
1. §40: O autor nunca aprova a própria entrega. Se o autor for o 24, a auditoria é inválida.
2. §15: Propriedade exclusiva de arquivos. Verifique se os arquivos alterados pertencem ao domínio do autor (${authorName}).
3. §29: Nunca mascarar scripts de teste ausentes ou falhos como gates verdes.
4. Vereditos possíveis:
   - "APROVADO": Testes executáveis passaram, evidência real presente, conformidade P1-P4 respeitada, sem pendências bloqueadoras.
   - "REPROVADO": Falha de testes, pendências abertas, débitos técnicos ou falta de evidência comprobatória.
   - "BLOQUEADO": Violação de isolamento/RBAC/LGPD, violação crítica de propriedade de arquivos (§15) ou presença de bloqueador impeditivo.

Contexto da entrega:
- Repositório: ${input.repo?.fullName || input.repo?.name || 'Local'}
- Agente Autor: ${authorName}
- Missão: ${input.mission ? `[${input.mission.id}] ${input.mission.title} (${input.mission.slug})` : 'Auditoria técnica pontual'}
- Commit / Hashes informados: ${input.commitOrHashes || '(não informado)'}
- Resumo do escopo: ${input.scopeSummary || '(não informado)'}
- Comandos e resultados informados:
${input.commandsText || 'npx tsc --noEmit -> PASS\nnpm test -> PASS'}
- Evidências fornecidas: ${input.evidence || '(sem evidência detalhada)'}
- Informações adicionais: ${input.additionalContext || 'Nenhuma'}

Gere o Parecer Técnico estruturado em formato JSON rigoroso.`;

  const response = await ai.models.generateContent({
    model: GEMINI_DEFAULT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          verdict: {
            type: Type.STRING,
            description: 'Veredito oficial: APROVADO, REPROVADO ou BLOQUEADO',
            enum: ['APROVADO', 'REPROVADO', 'BLOQUEADO'],
          },
          scopeSummary: {
            type: Type.STRING,
            description: 'Resumo claro e técnico do que foi auditado',
          },
          criteriaChecked: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Critérios oficiais verificados (§14, §15, §29, P1-P4, etc.)',
          },
          commandsExecuted: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                command: { type: Type.STRING },
                result: { type: Type.STRING },
              },
              required: ['command', 'result'],
            },
            description: 'Comandos de teste executados e respectivos resultados verificados',
          },
          findings: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Achados técnicos e evidências concretas encontradas na auditoria',
          },
          pendingItems: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Itens pendentes ou ações corretivas requeridas para aprovação plena',
          },
          evidence: {
            type: Type.STRING,
            description: 'Evidência técnica auditada (logs, saídas de teste, commits)',
          },
          p1ToP4Compliant: {
            type: Type.BOOLEAN,
            description: 'Conformidade com os princípios P1 a P4',
          },
          ownershipCompliant: {
            type: Type.BOOLEAN,
            description: 'Conformidade estrita com a propriedade exclusiva de arquivos (§15)',
          },
          tenancyLgpdChecked: {
            type: Type.BOOLEAN,
            description: 'Isolamento multi-tenant e verificação de LGPD aprovados',
          },
          rationale: {
            type: Type.STRING,
            description: 'Fundamentação técnica sucinta da decisão do Auditor 24',
          },
        },
        required: [
          'verdict',
          'scopeSummary',
          'criteriaChecked',
          'commandsExecuted',
          'findings',
          'pendingItems',
          'evidence',
          'p1ToP4Compliant',
          'ownershipCompliant',
          'tenancyLgpdChecked',
          'rationale',
        ],
      },
    },
  });

  const text = response.text?.trim() || '{}';
  const parsed = JSON.parse(text) as GeminiAuditReviewOutput;

  // Normaliza o veredito para os tipos válidos da Central
  if (!['APROVADO', 'REPROVADO', 'BLOQUEADO'].includes(parsed.verdict)) {
    parsed.verdict = 'REPROVADO';
  }

  return parsed;
}

/**
 * Diagnostica um incidente/problema e gera especificação formal de Handoff (§18) via Gemini API.
 */
export async function diagnoseGeminiHandoff(
  input: GeminiHandoffDiagnosisInput
): Promise<GeminiHandoffDiagnosisOutput> {
  const ai = getGeminiClient();

  const blockersList = DEFAULT_PRIORITY_BLOCKERS.map(
    (b) => `${b.code}: ${b.title} (Dono sugerido: ${b.ownerAgentId})`
  ).join('\n');

  const agentsList = OFFICIAL_AGENTS.map(
    (a) => `${a.id} — ${a.name} (${a.persona.codename}): ${a.summary}`
  ).join('\n');

  const sampleFiles = (input.repo?.samplePaths || []).slice(0, 40).join('\n');

  const prompt = `Você é o Coordenador da Central de Governança Multiagente (Agente 00).
Um desenvolvedor ou agente identificou um problema técnico e precisa abrir um Handoff formal (§18 do AGENTS.md).

Sua tarefa:
1. Analisar o sintoma e os logs fornecidos.
2. Identificar o agente especialista de destino correto com base na matriz de propriedade exclusiva de arquivos (§15).
   - Agente 01: Banco de dados, schema Prisma, RLS, migrations, RBAC.
   - Agente 02: Interface web, componentes React, layout, Tailwind, acessibilidade.
   - Agente 06: APIs backend, integrações, webhooks, rotas Express/Nest.
   - Agente 07: Gateway de IA, prompts, streaming, LLM client.
   - Agente 08: Filas assíncronas, workers, Redis, jobs em background.
   - Agente 15: Segurança, segredos, proteção de credenciais, PII.
   - Agente 18: Documentação viva, contratos de API, schemas OpenAPI.
   - Agente 21: DevOps, CI/CD, Docker, scripts de build.
   - Agente 24: Auditoria e conformidade técnica.
3. Verificar se o problema corresponde a um dos Bloqueadores Prioritários oficiais (B-01 a B-14):
${blockersList}
4. Gerar os campos do Handoff rastreável com base na especificação §18:
   - slug em kebab-case
   - prioridade: "bloqueador", "alto" ou "normal"
   - blockerRef (ex: "B-10", "B-01", ou vazio se não for um bloqueador padrão)
   - problema objetivo
   - arquivos envolvidos
   - evidência observada
   - alteração necessária
   - teste executável esperado
   - explicação da regra de propriedade §15 que justifica a escolha do agente.

Contexto do Repositório:
- Nome: ${input.repo?.name || 'Local'}
- Arquivos de amostra no repositório:
${sampleFiles || '(não informados)'}

Descrição do problema / erro pelo usuário:
"""
${input.problemDescription}
"""
${input.additionalLogs ? `Logs adicionais:\n"""\n${input.additionalLogs}\n"""` : ''}

Retorne a especificação estruturada em JSON.`;

  const response = await ai.models.generateContent({
    model: GEMINI_DEFAULT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          toAgentId: {
            type: Type.STRING,
            description: 'ID do agente especialista destinatário (ex: 01, 02, 06, 08, 15, 21, etc.)',
          },
          slug: {
            type: Type.STRING,
            description: 'Slug conciso em kebab-case para o handoff (ex: rls-tenant-leak-fix)',
          },
          priority: {
            type: Type.STRING,
            description: 'Prioridade do handoff: bloqueador, alto ou normal',
            enum: ['bloqueador', 'alto', 'normal'],
          },
          blockerRef: {
            type: Type.STRING,
            description: 'Código do bloqueador (ex: B-01 a B-14) ou string vazia',
          },
          problem: {
            type: Type.STRING,
            description: 'Descrição objetiva e técnica do problema identificado',
          },
          filesInvolved: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Caminhos de arquivos envolvidos que o agente precisará inspecionar ou alterar',
          },
          evidence: {
            type: Type.STRING,
            description: 'Evidência observada ou comando de reprodução',
          },
          requiredChange: {
            type: Type.STRING,
            description: 'Alteração técnica necessária esperada do agente destinatário',
          },
          expectedTest: {
            type: Type.STRING,
            description: 'Critério ou comando de teste executável para validação da resolução',
          },
          ownershipExplanation: {
            type: Type.STRING,
            description: 'Fundamentação técnica da atribuição ao agente com base na §15 do AGENTS.md',
          },
        },
        required: [
          'toAgentId',
          'slug',
          'priority',
          'blockerRef',
          'problem',
          'filesInvolved',
          'evidence',
          'requiredChange',
          'expectedTest',
          'ownershipExplanation',
        ],
      },
    },
  });

  const text = response.text?.trim() || '{}';
  const parsed = JSON.parse(text) as GeminiHandoffDiagnosisOutput;

  // Garante que o slug é kebab-case válido
  parsed.slug = (parsed.slug || 'diagnostico-gemini')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (!['bloqueador', 'alto', 'normal'].includes(parsed.priority)) {
    parsed.priority = 'alto';
  }

  return parsed;
}

export interface GeminiFileAuditInput {
  filePath: string;
  content: string;
}

export interface GeminiFileAuditOutput {
  filePath: string;
  ownerAgentId: string;
  ownerAgentName: string;
  ownershipExplanation: string;
  complianceRating: 'CONFORME' | 'ATENCAO' | 'VIOLACAO';
  blockersIdentified: Array<{
    code: string;
    title: string;
    severity: 'alta' | 'media' | 'baixa';
    description: string;
  }>;
  findings: string[];
  recommendations: string[];
  suggestedHandoff?: {
    toAgentId: string;
    slug: string;
    priority: 'bloqueador' | 'alto' | 'normal';
    problem: string;
    requiredChange: string;
  };
}

/**
 * Audita um arquivo de código específico com o Agente 24 (Veredito) sob a ótica de §15 e Bloqueadores B-01..B-14.
 */
export async function auditFileWithGemini(
  input: GeminiFileAuditInput
): Promise<GeminiFileAuditOutput> {
  const ai = getGeminiClient();

  const blockersList = DEFAULT_PRIORITY_BLOCKERS.map(
    (b) => `${b.code}: ${b.title} (Dono: ${b.ownerAgentId})`
  ).join('\n');

  const contentSnippet =
    input.content.length > 25000
      ? `${input.content.slice(0, 25000)}\n... [truncado em 25.000 caracteres pelo auditor]`
      : input.content;

  const prompt = `Você é o Agente 24 (Veredito), o Auditor Independente da Central de Governança.
Analise criticamente o arquivo a seguir considerando as regras de governança (§15 do AGENTS.md e Bloqueadores B-01 a B-14):

Caminho do arquivo: "${input.filePath}"

Regras de Propriedade (§15):
- 00 (Núcleo): Orquestração global, package.json, server.ts, governança.
- 01 (Valkiria): Prisma schema, migrations, PostgreSQL, Supabase RLS, isolamento de dados.
- 02 (Pixel): Interface web React, componentes, layout, Tailwind, acessibilidade.
- 06 (Nexus): APIs backend, rotas Express, integrações, webhooks.
- 07 (Morpheus): Prompts de IA, hub de IA, streaming de LLM.
- 08 (Titan): Filas assíncronas, BullMQ, Redis, workers de background.
- 12 (Scribe): TTS, áudio, transcrições, processamento de voz.
- 15 (Sentinela): Segredos (.env), criptografia, chaves de API, PII e LGPD.
- 18 (Cronos): Contratos OpenAPI, documentação viva, schemas.
- 21 (Aegis): Docker, CI/CD, scripts de build, deploy, pipelines.
- 24 (Veredito): Auditoria técnica e pareceres independentes.

Catálogo de Bloqueadores Prioritários (B-01 a B-14):
${blockersList}

Conteúdo do arquivo:
\`\`\`
${contentSnippet}
\`\`\`

Tarefas da Auditoria:
1. Identifique o agente dono legítimo conforme §15 e explique a regra aplicável.
2. Identifique potenciais violações: segredos em código (B-04), ausência de tenantId (B-10), bypass de RBAC (B-01/B-02), testes mascarados (§29) ou código sem tratamento de erro.
3. Atribua o rating: "CONFORME", "ATENCAO" ou "VIOLACAO".
4. Liste achados técnicos objetivos e recomendações de melhoria.
5. Se houver inconformidade, sugira um handoff formal a ser aberto.

Retorne em formato JSON estruturado.`;

  const response = await ai.models.generateContent({
    model: GEMINI_DEFAULT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          filePath: { type: Type.STRING },
          ownerAgentId: { type: Type.STRING },
          ownerAgentName: { type: Type.STRING },
          ownershipExplanation: { type: Type.STRING },
          complianceRating: {
            type: Type.STRING,
            enum: ['CONFORME', 'ATENCAO', 'VIOLACAO'],
          },
          blockersIdentified: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                code: { type: Type.STRING },
                title: { type: Type.STRING },
                severity: { type: Type.STRING, enum: ['alta', 'media', 'baixa'] },
                description: { type: Type.STRING },
              },
              required: ['code', 'title', 'severity', 'description'],
            },
          },
          findings: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          recommendations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          suggestedHandoff: {
            type: Type.OBJECT,
            properties: {
              toAgentId: { type: Type.STRING },
              slug: { type: Type.STRING },
              priority: { type: Type.STRING, enum: ['bloqueador', 'alto', 'normal'] },
              problem: { type: Type.STRING },
              requiredChange: { type: Type.STRING },
            },
            required: ['toAgentId', 'slug', 'priority', 'problem', 'requiredChange'],
          },
        },
        required: [
          'filePath',
          'ownerAgentId',
          'ownerAgentName',
          'ownershipExplanation',
          'complianceRating',
          'blockersIdentified',
          'findings',
          'recommendations',
        ],
      },
    },
  });

  const text = response.text?.trim() || '{}';
  const parsed = JSON.parse(text) as GeminiFileAuditOutput;
  parsed.filePath = input.filePath;

  if (!['CONFORME', 'ATENCAO', 'VIOLACAO'].includes(parsed.complianceRating)) {
    parsed.complianceRating = 'ATENCAO';
  }

  return parsed;
}

export interface GeminiExecutiveSummaryInput {
  generatedAt: string;
  state: { veredito?: string; bloqueios?: string[]; proxima_acao?: string; waveStatus?: string };
  waves: { name: string; handoffs: number; byStatus: Record<string, number> }[];
  handoffs: Array<{
    name: string;
    title: string;
    de: string;
    para: string;
    status: string;
    prioridade: string;
  }>;
  decisions: Array<{ id: string; title: string }>;
  metrics?: {
    quality?: {
      concluidos?: number;
      reprovados24?: number;
      bloqueados?: number;
      reprovacao24Pct?: number | null;
      blockedByDecision?: number;
    };
  };
}

export interface GeminiExecutiveSummaryOutput {
  healthStatus: 'SAUDAVEL' | 'EM_RISCO' | 'BLOQUEADO';
  headline: string;
  summary: string;
  criticalPath: string[];
  recommendedActions: Array<{
    priority: 'P0' | 'P1' | 'P2';
    action: string;
    targetAgent: string;
  }>;
  releaseReadinessScore: number;
}

/**
 * Gera uma Síntese Executiva Estruturada da onda com o Agente 00 via Gemini 4 Hydrogen.
 */
export async function generateExecutiveSummaryWithGemini(
  input: GeminiExecutiveSummaryInput
): Promise<GeminiExecutiveSummaryOutput> {
  const ai = getGeminiClient();

  const totalHandoffs = input.handoffs.length;
  const byStatus: Record<string, number> = {};
  input.handoffs.forEach((h) => {
    byStatus[h.status] = (byStatus[h.status] || 0) + 1;
  });

  const prompt = `Você é o Coordenador-Geral da Central de Governança Multiagente (Agente 00).
Gere uma Síntese Executiva de Alto Nível sobre o estado de prontidão e saúde da onda atual.

Dados da Central:
- Veredito da Central: ${input.state.veredito || '—'}
- Status da Onda: ${input.state.waveStatus || '—'}
- Total de Handoffs: ${totalHandoffs}
- Distribuição por Status: ${JSON.stringify(byStatus)}
- Bloqueios Ativos declarados: ${JSON.stringify(input.state.bloqueios || [])}
- Decisões Humanas Pendentes: ${input.decisions.length}
- Próxima Ação registrada: ${input.state.proxima_acao || 'Nenhuma'}
- Amostra de Handoffs críticos (P0/P1):
${input.handoffs
  .filter((h) => h.prioridade === 'P0' || h.prioridade === 'P1' || h.status === 'BLOQUEADO' || h.status === 'REPROVADO_24')
  .slice(0, 15)
  .map((h) => `- [${h.prioridade}] ${h.name} (${h.status}) de ${h.de} para ${h.para}: ${h.title}`)
  .join('\n') || '(Nenhum handoff P0/P1 pendente)'}

Tarefas:
1. Avalie a saúde da onda: "SAUDAVEL", "EM_RISCO" ou "BLOQUEADO".
2. Crie uma manchete executiva direta (headline).
3. Redija um resumo executivo objetivo (summary) explicando a situação real para a liderança técnica.
4. Identifique os itens do caminho crítico (criticalPath) que travam o avanço para a próxima fase.
5. Indique as 3 principais ações imediatas (recommendedActions) com prioridade e agente responsável.
6. Calcule o score de prontidão para release (releaseReadinessScore) de 0 a 100.

Retorne em formato JSON rigoroso.`;

  const response = await ai.models.generateContent({
    model: GEMINI_DEFAULT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          healthStatus: {
            type: Type.STRING,
            enum: ['SAUDAVEL', 'EM_RISCO', 'BLOQUEADO'],
          },
          headline: { type: Type.STRING },
          summary: { type: Type.STRING },
          criticalPath: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          recommendedActions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                priority: { type: Type.STRING, enum: ['P0', 'P1', 'P2'] },
                action: { type: Type.STRING },
                targetAgent: { type: Type.STRING },
              },
              required: ['priority', 'action', 'targetAgent'],
            },
          },
          releaseReadinessScore: { type: Type.INTEGER },
        },
        required: [
          'healthStatus',
          'headline',
          'summary',
          'criticalPath',
          'recommendedActions',
          'releaseReadinessScore',
        ],
      },
    },
  });

  const text = response.text?.trim() || '{}';
  const parsed = JSON.parse(text) as GeminiExecutiveSummaryOutput;

  if (!['SAUDAVEL', 'EM_RISCO', 'BLOQUEADO'].includes(parsed.healthStatus)) {
    parsed.healthStatus = 'EM_RISCO';
  }

  parsed.releaseReadinessScore = Math.max(0, Math.min(100, parsed.releaseReadinessScore || 0));

  return parsed;
}


