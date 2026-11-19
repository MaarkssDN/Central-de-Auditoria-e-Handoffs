export type AgentCategory = 'coordenacao' | 'produto_engenharia' | 'governanca';

export type AvatarEmblem =
  | 'compass'
  | 'shield'
  | 'lock'
  | 'sparkles'
  | 'eye'
  | 'radar'
  | 'bridge'
  | 'pickaxe'
  | 'bolt'
  | 'bastion'
  | 'rocket'
  | 'mobile'
  | 'tower'
  | 'seal'
  | 'wave'
  | 'swarm'
  | 'anvil'
  | 'vault'
  | 'turbine'
  | 'cadence'
  | 'scroll'
  | 'scale'
  | 'gavel';

export interface AgentPersona {
  codename: string;
  archetype: string;
  motto: string;
  voiceStyle: string;
  accentHex: string;
  emblem: AvatarEmblem;
  signatureTools: string[];
}

export interface AgentDefinition {
  id: string;
  name: string;
  slug: string;
  category: AgentCategory;
  summary: string;
  exclusivePaths: string[];
  exclusiveSlotWith: string[];
  queueConflictOnQueueFiles?: boolean;
  requiresCoordinatorApprovalFor?: string[];
  promptFile: string;
  cannotEditCode?: boolean;
  persona: AgentPersona;
}

export type WaveState =
  | 'PLANEJADA'
  | 'MATRIZ_PUBLICADA'
  | 'EM_EXECUCAO'
  | 'EM_REVISAO'
  | 'EM_INTEGRACAO'
  | 'GATE_VERDE'
  | 'RELEASE_APPROVED'
  | 'RELEASE_BLOCKED';

export type HandoffStatus = 'aberto' | 'em-andamento' | 'resolvido';
export type HandoffPriority = 'bloqueador' | 'alto' | 'normal';

export interface HandoffResolution {
  resolvedBy: string;
  resolvedAt: string;
  summary: string;
  evidence: string;
  verifiedByAgent24: boolean;
}

export interface Handoff {
  id: string;
  repoId: string;
  waveNumber: number;
  slug: string;
  fromAgentId: string;
  toAgentId: string;
  status: HandoffStatus;
  priority: HandoffPriority;
  blockerRef: string;
  targetSprint: string;
  problem: string;
  filesInvolved: string[];
  evidence: string;
  requiredChange: string;
  expectedTest: string;
  additionalContext: string;
  createdAt: string;
  resolution?: HandoffResolution;
}

export type ReviewVerdict = 'APROVADO' | 'REPROVADO' | 'BLOQUEADO';

export interface IndependentReview {
  id: string;
  repoId: string;
  waveNumber: number;
  missionId: string;
  missionTitle: string;
  authorAgentId: string;
  auditorAgentId: string;
  baseBranch: string;
  commitOrHashes: string;
  scopeSummary: string;
  criteriaChecked: string[];
  commandsExecuted: { command: string; result: string }[];
  evidence: string;
  findings: string[];
  pendingItems: string[];
  p1ToP4Compliant: boolean;
  tenancyLgpdChecked: boolean;
  ownershipCompliant: boolean;
  verdict: ReviewVerdict;
  createdAt: string;
}

export type MissionStatus = 'planejada' | 'em_execucao' | 'em_revisao' | 'aprovada' | 'reprovada';

export interface MissionStep {
  description: string;
  verificationCriteria: string;
  completed: boolean;
}

export interface Mission {
  id: string;
  repoId: string;
  waveNumber: number;
  agentId: string;
  title: string;
  slug: string;
  baseBranch: string;
  branchName: string;
  objective: string;
  outOfScope: string[];
  ownedFiles: string[];
  dependencyFiles: string[];
  assumptions: string[];
  plan: MissionStep[];
  finalSuccessCriterion: string;
  expectedDeliverable: string;
  status: MissionStatus;
  createdAt: string;
}

export type GateStatus = 'EXECUTADO_VERDE' | 'FALHOU' | 'NAO_APLICAVEL' | 'NAO_EXECUTADO';

export interface GateCheck {
  id: string;
  scriptKey: string;
  command: string;
  tier: 'local' | 'integracao' | 'release';
  status: GateStatus;
  lastRunAt?: string;
  notes?: string;
}

export interface Wave {
  id: string;
  repoId: string;
  number: number;
  name: string;
  integrationBranch: string;
  state: WaveState;
  scopeFreezeActive: boolean;
  activeAgentIds: string[];
  matrixPublishedAt?: string;
  mergesSinceLastGate: number;
  gates: GateCheck[];
  createdAt: string;
}

export type BlockerStatus = 'aberto' | 'mitigado' | 'validado' | 'nao_aplicavel';

export interface BlockerRecord {
  code: string;
  title: string;
  description: string;
  ownerAgentId: string;
  status: BlockerStatus;
  evidenceNote?: string;
  linkedHandoffId?: string;
}

export type WebhookProvider = 'slack' | 'discord';

export interface WebhookIntegration {
  provider: WebhookProvider;
  url: string;
  enabled: boolean;
  notifyOnHandoff: boolean;
  notifyOnAuditFailure: boolean;
  channelLabel?: string;
  lastTestedAt?: string;
  lastTestStatus?: 'ok' | 'error';
  lastTestMessage?: string;
}

export interface RepositoryTarget {
  id: string;
  name: string;
  fullName: string;
  sourceType: 'github' | 'manual';
  url?: string;
  defaultBranch: string;
  branches: string[];
  detectedAgentsMd: boolean;
  agentsMdRevision?: string;
  packageScripts: Record<string, string>;
  samplePaths: string[];
  existingHandoffFiles: string[];
  existingReviewFiles: string[];
  lastSyncedAt: string;
  blockers: BlockerRecord[];
  webhook?: WebhookIntegration;
}

export interface TechnicalAuditReport {
  schemaVersion: string;
  generatedAt: string;
  repository: {
    id: string;
    fullName: string;
    defaultBranch: string;
    sourceType: 'github' | 'manual';
    detectedAgentsMd: boolean;
  };
  wave: {
    number: number;
    name: string;
    state: WaveState;
    integrationBranch: string;
    activeAgentIds: string[];
  } | null;
  summary: {
    approvedGatesCount: number;
    totalGatesCount: number;
    resolvedBlockersCount: number;
    openBlockersCount: number;
    totalBlockersCount: number;
    approvedVerdictsCount: number;
    rejectedOrBlockedVerdictsCount: number;
    totalVerdictsCount: number;
  };
  approvedGates: Array<{
    id: string;
    scriptKey: string;
    command: string;
    tier: GateCheck['tier'];
    status: GateStatus;
    lastRunAt?: string;
    notes?: string;
  }>;
  resolvedBlockers: Array<{
    code: string;
    title: string;
    ownerAgentId: string;
    status: BlockerStatus;
    evidenceNote?: string;
  }>;
  auditVerdicts: Array<{
    id: string;
    waveNumber: number;
    missionTitle: string;
    authorAgentId: string;
    auditorAgentId: string;
    commitOrHashes: string;
    verdict: ReviewVerdict;
    scopeSummary: string;
    evidence: string;
    p1ToP4Compliant: boolean;
    tenancyLgpdChecked: boolean;
    ownershipCompliant: boolean;
    commandsExecuted: { command: string; result: string }[];
    findings: string[];
    pendingItems: string[];
    createdAt: string;
  }>;
}

export interface AgentToolTrace {
  id: string;
  toolName: string;
  argsSummary: string;
  resultSummary: string;
  timestamp: string;
}

export interface AgentBotMessage {
  id: string;
  repoId: string;
  agentId: string;
  role: 'user' | 'agent';
  content: string;
  toolTraces?: AgentToolTrace[];
  timestamp: string;
}

export interface WorkspaceState {
  activeRepoId: string;
  repositories: RepositoryTarget[];
  waves: Wave[];
  missions: Mission[];
  handoffs: Handoff[];
  reviews: IndependentReview[];
  botMessages?: AgentBotMessage[];
}

export type AgentStreamEvent =
  | { type: 'agent_start'; agentId: string; codename: string; roleLabel: string }
  | { type: 'thinking'; agentId: string; step: number }
  | { type: 'tool_call'; agentId: string; toolName: string; argsSummary: string }
  | { type: 'tool_result'; agentId: string; trace: AgentToolTrace }
  | { type: 'agent_done'; agentId: string; message: AgentBotMessage; workspace: WorkspaceState }
  | { type: 'swarm_complete'; messages: AgentBotMessage[]; workspace: WorkspaceState }
  | { type: 'error'; error: string; status: number };

