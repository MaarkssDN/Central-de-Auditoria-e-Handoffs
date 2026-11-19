import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Play,
  Send,
  Terminal,
  Wrench,
} from 'lucide-react';
import { getDirectivesForAgent } from '../data/agentDirectives';
import { OFFICIAL_AGENTS } from '../data/agentsRoster';
import type {
  AgentBotMessage,
  AgentCategory,
  AgentStreamEvent,
  AgentToolTrace,
  RepositoryTarget,
  Wave,
  WorkspaceState,
} from '../types/governance';
import { getAgentById } from '../utils/governanceEngine';
import { AgentAvatar } from './AgentAvatar';
import { MarkdownMessage } from './MarkdownMessage';

interface AgentBotsWorkspaceProps {
  activeRepo?: RepositoryTarget;
  activeWave?: Wave;
  workspace: WorkspaceState;
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
  onReplaceWorkspace: (next: WorkspaceState) => void;
}

interface LiveExecutionState {
  mode: 'single' | 'swarm';
  currentAgentId: string;
  currentStep: number;
  activeToolName: string | null;
  completedAgents: string[];
  traces: Array<AgentToolTrace & { agentId: string }>;
}

const GALLERY_CATEGORY_LABELS: Record<'all' | AgentCategory, string> = {
  all: `Todos (${OFFICIAL_AGENTS.length})`,
  coordenacao: 'Coordenação',
  produto_engenharia: 'Produto & Engenharia',
  governanca: 'Governança',
};

export function AgentBotsWorkspace({
  activeRepo,
  activeWave,
  workspace,
  selectedAgentId,
  onSelectAgent,
  onReplaceWorkspace,
}: AgentBotsWorkspaceProps) {
  const [promptInput, setPromptInput] = useState('');
  const [running, setRunning] = useState(false);
  const [liveState, setLiveState] = useState<LiveExecutionState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [galleryCategory, setGalleryCategory] = useState<'all' | AgentCategory>('all');
  const [viewMode, setViewMode] = useState<'desk' | 'gallery'>('desk');
  const [feedScope, setFeedScope] = useState<'all' | 'selected'>('all');
  const [elapsedSec, setElapsedSec] = useState(0);
  const feedScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!running) {
      setElapsedSec(0);
      return;
    }
    setElapsedSec(0);
    const id = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const selectedAgent = getAgentById(selectedAgentId) ?? OFFICIAL_AGENTS[0];
  const allRepoMessages = (workspace.botMessages ?? []).filter(
    (m) => m.repoId === activeRepo?.id
  );
  const repoMessages =
    feedScope === 'selected'
      ? allRepoMessages.filter((m) => m.agentId === selectedAgent.id)
      : allRepoMessages;

  useEffect(() => {
    const el = feedScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [repoMessages.length, feedScope, viewMode]);

  const waveActiveIds = activeWave?.activeAgentIds ?? ['00'];

  const visibleRoster = OFFICIAL_AGENTS.filter((a) => {
    const matchesCategory =
      viewMode === 'desk' || galleryCategory === 'all' || a.category === galleryCategory;
    if (!matchesCategory) return false;
    const q = filterQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      a.id.toLowerCase().includes(q) ||
      `agente ${a.id}`.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.persona.codename.toLowerCase().includes(q) ||
      a.persona.archetype.toLowerCase().includes(q) ||
      a.persona.motto.toLowerCase().includes(q)
    );
  });

  function countAgentMessages(agentId: string): number {
    return allRepoMessages.filter((m) => m.role === 'agent' && m.agentId === agentId).length;
  }

  async function consumeSseStream(
    url: string,
    body: Record<string, unknown>,
    initialMode: 'single' | 'swarm',
    initialAgentId: string
  ) {
    setErrorMsg(null);
    setRunning(true);
    setLiveState({
      mode: initialMode,
      currentAgentId: initialAgentId,
      currentStep: 1,
      activeToolName: null,
      completedAgents: [],
      traces: [],
    });

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errPayload = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(errPayload.error || `Falha no servidor (HTTP ${res.status}).`);
        return;
      }

      if (!res.body) {
        setErrorMsg('Stream de resposta indisponível.');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
        }

        const chunks = buffer.split('\n\n');
        buffer = done ? '' : (chunks.pop() ?? '');

        for (const chunk of chunks) {
          const line = chunk
            .split('\n')
            .find((l) => l.startsWith('data: '));
          if (!line) continue;

          let event: AgentStreamEvent;
          try {
            event = JSON.parse(line.slice(6)) as AgentStreamEvent;
          } catch {
            continue;
          }

          if (event.type === 'agent_start') {
            setLiveState((prev) =>
              prev
                ? {
                    ...prev,
                    currentAgentId: event.agentId,
                    currentStep: 1,
                    activeToolName: null,
                  }
                : prev
            );
          } else if (event.type === 'thinking') {
            setLiveState((prev) =>
              prev
                ? {
                    ...prev,
                    currentAgentId: event.agentId,
                    currentStep: event.step,
                    activeToolName: null,
                  }
                : prev
            );
          } else if (event.type === 'tool_call') {
            setLiveState((prev) =>
              prev
                ? {
                    ...prev,
                    currentAgentId: event.agentId,
                    activeToolName: event.toolName,
                  }
                : prev
            );
          } else if (event.type === 'tool_result') {
            setLiveState((prev) =>
              prev
                ? {
                    ...prev,
                    activeToolName: null,
                    traces: [...prev.traces, { ...event.trace, agentId: event.agentId }],
                  }
                : prev
            );
          } else if (event.type === 'agent_done') {
            onReplaceWorkspace(event.workspace);
            setLiveState((prev) =>
              prev
                ? {
                    ...prev,
                    completedAgents: [...prev.completedAgents, event.agentId],
                    activeToolName: null,
                  }
                : prev
            );
            setPromptInput('');
          } else if (event.type === 'swarm_complete') {
            onReplaceWorkspace(event.workspace);
            setPromptInput('');
          } else if (event.type === 'error') {
            setErrorMsg(event.error);
          }
        }
        if (done) break;
      }
    } catch {
      setErrorMsg('Falha de rede ao acompanhar execução em tempo real.');
    } finally {
      setRunning(false);
      setLiveState(null);
    }
  }

  async function executeSingleBot(instruction: string) {
    if (!activeRepo || !instruction.trim() || running) return;
    await consumeSseStream(
      '/api/agents/execute-stream',
      {
        agentId: selectedAgent.id,
        prompt: instruction.trim(),
        workspace,
      },
      'single',
      selectedAgent.id
    );
  }

  async function executeSwarmTurn(goal: string) {
    if (!activeRepo || !goal.trim() || running) return;
    const specialistId =
      selectedAgent.id === '00' || selectedAgent.id === '24' ? '01' : selectedAgent.id;

    await consumeSseStream(
      '/api/agents/swarm-turn-stream',
      {
        specialistAgentId: specialistId,
        missionGoal: goal.trim(),
        workspace,
      },
      'swarm',
      '00'
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    executeSingleBot(promptInput);
  }

  if (!activeRepo) {
    return (
      <div className="neon-card p-10 text-center text-sm text-[#A6B7D9]">
        Conecte um repositório para operar os bots autônomos.
      </div>
    );
  }

  const directives = getDirectivesForAgent(
    selectedAgent.id,
    selectedAgent.persona.codename,
    selectedAgent.name
  );
  const swarmSpecialistId =
    selectedAgent.id === '00' || selectedAgent.id === '24' ? '01' : selectedAgent.id;
  const swarmSpecialist = getAgentById(swarmSpecialistId);

  const ownedBlockers = activeRepo.blockers.filter(
    (b) => b.ownerAgentId === selectedAgent.id && b.status === 'aberto'
  );
  const incomingHandoffs = workspace.handoffs.filter(
    (h) =>
      h.repoId === activeRepo.id &&
      h.toAgentId === selectedAgent.id &&
      h.status !== 'resolvido'
  );

  const featuredIds = Array.from(new Set([...waveActiveIds, '24']));
  const featuredAgents = featuredIds
    .map((id) => getAgentById(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const liveAgent = liveState ? getAgentById(liveState.currentAgentId) : null;
  const accent = selectedAgent.persona.accentHex;

  return (
    <div className="space-y-6">
      {/* Top Active Squad Strip + View Mode Switch */}
      <section className="neon-card p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-paper-100">
              Esquadrão em Operação — {activeWave ? activeWave.name : activeRepo.fullName}
            </span>
            <span className="text-[#5C7099]" aria-hidden="true">·</span>
            <span className="font-mono text-[#2563EB] tabular-nums">
              {OFFICIAL_AGENTS.length} agentes oficiais (AGENTS.md)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {featuredAgents.map((agent) => {
              const isSelected = agent.id === selectedAgent.id && viewMode === 'desk';
              const hex = agent.persona.accentHex;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => {
                    onSelectAgent(agent.id);
                    setViewMode('desk');
                    setErrorMsg(null);
                  }}
                  className="inline-flex items-center gap-2.5 px-3 py-2 rounded-2xl text-left transition-all duration-200"
                  style={
                    isSelected
                      ? {
                          background: `linear-gradient(135deg, ${hex}2a 0%, var(--color-ink-900) 100%)`,
                          border: `1.5px solid ${hex}`,
                          boxShadow: `0 0 22px -6px ${hex}aa`,
                        }
                      : {
                          background: 'var(--color-ink-850)',
                          border: `1px solid ${hex}44`,
                        }
                  }
                >
                  <AgentAvatar agent={agent} size="sm" />
                  <div className="leading-tight">
                    <div className="text-xs font-semibold text-paper-100">
                      {agent.id} · {agent.persona.codename}
                    </div>
                    <div className="text-[11px]" style={{ color: isSelected ? hex : 'var(--color-paper-400)' }}>
                      {agent.persona.archetype}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1 p-1.5 bg-[#070B16] border border-cyan-400/20 rounded-2xl self-start lg:self-center shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('desk')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
              viewMode === 'desk'
                ? 'bg-gradient-to-r from-[#2563EB]/25 to-[#7C3AED]/25 text-paper-100 border border-[#2563EB]/55 shadow-[0_0_16px_-6px_rgba(37,99,235,0.8)]'
                : 'text-[#8FA3C8] hover:text-paper-100 border border-transparent'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Mesa do Bot</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('gallery')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
              viewMode === 'gallery'
                ? 'bg-gradient-to-r from-[#7C3AED]/30 to-[#DB2777]/25 text-paper-100 border border-[#DB2777]/55 shadow-[0_0_16px_-6px_rgba(219,39,119,0.8)]'
                : 'text-[#8FA3C8] hover:text-paper-100 border border-transparent'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Galeria ({OFFICIAL_AGENTS.length})</span>
          </button>
        </div>
      </section>

      {viewMode === 'gallery' ? (
        <section className="space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-accent-blue">
                Todos os Personagens Autônomos ({visibleRoster.length} de {OFFICIAL_AGENTS.length})
              </h2>
              <p className="text-xs text-accent-blue/70 mt-1">
                Roster integral do AGENTS.md (slots 19 e 20 reservados). Cada agente tem assinatura neon, voz e diretivas próprias.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1 p-1 bg-[#070B16] border border-violet-400/20 rounded-2xl overflow-x-auto">
                {(['all', 'coordenacao', 'produto_engenharia', 'governanca'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setGalleryCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
                      galleryCategory === cat
                        ? 'bg-[#7C3AED]/25 text-paper-100 border border-[#7C3AED]/55'
                        : 'text-[#8FA3C8] hover:text-paper-100 border border-transparent'
                    }`}
                  >
                    {GALLERY_CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filtrar codinome, papel ou ID..."
                aria-label="Filtrar galeria de personagens"
                className="input h-10 w-full sm:w-64 !rounded-2xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {visibleRoster.map((agent) => {
              const isWaveActive = waveActiveIds.includes(agent.id);
              const msgCount = countAgentMessages(agent.id);
              const hex = agent.persona.accentHex;
              return (
                <article
                  key={agent.id}
                  className="rounded-3xl overflow-hidden flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5"
                  style={{
                    background: `radial-gradient(circle at 92% 6%, ${hex}22 0%, var(--color-ink-900) 55%, var(--color-ink-950) 100%)`,
                    border: `1px solid ${hex}4d`,
                    boxShadow: `0 16px 36px -22px rgba(0,0,0,0.95), 0 0 26px -14px ${hex}66`,
                  }}
                >
                  <div
                    className="h-1.5 w-full"
                    style={{
                      background: `linear-gradient(90deg, ${hex}, ${hex}33)`,
                      boxShadow: `0 0 14px ${hex}`,
                    }}
                    aria-hidden="true"
                  />
                  <div className="p-5 space-y-3 flex-1">
                    <div className="flex items-start gap-3.5">
                      <AgentAvatar agent={agent} size="lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                          <span style={{ color: hex }} className="font-semibold whitespace-nowrap">
                            Agente {agent.id}
                          </span>
                          {isWaveActive && (
                            <span className="text-[#047857] font-semibold whitespace-nowrap">● Ativo</span>
                          )}
                        </div>
                        <h3 className="font-display text-base font-bold text-accent-blue truncate mt-0.5">
                          {agent.persona.codename}
                        </h3>
                        <div className="text-xs text-[#A6B7D9] truncate">
                          {agent.persona.archetype}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs font-semibold text-[#E8EEF8]">{agent.name}</div>
                    <p className="text-xs text-[#C9D4E8] italic line-clamp-2 leading-relaxed">
                      &ldquo;{agent.persona.motto}&rdquo;
                    </p>
                    <div className="text-[11px] text-[#8FA3C8] line-clamp-2 leading-relaxed">
                      {agent.persona.voiceStyle}
                    </div>
                  </div>

                  <div className="px-5 py-3.5 border-t border-white/10 flex items-center justify-between gap-2 bg-[#060A15]/60">
                    <span className="text-[11px] font-mono text-[#8FA3C8] truncate tabular-nums">
                      {msgCount > 0
                        ? `${msgCount} exec. · ${agent.persona.signatureTools.length} tools`
                        : `${agent.persona.signatureTools.length} ferramentas`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectAgent(agent.id);
                        setViewMode('desk');
                        setErrorMsg(null);
                      }}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold text-paper-100 rounded-2xl whitespace-nowrap shrink-0 transition-all"
                      style={{
                        background: `linear-gradient(135deg, ${hex}40 0%, var(--color-ink-900) 100%)`,
                        border: `1px solid ${hex}99`,
                        boxShadow: `0 0 18px -6px ${hex}aa`,
                      }}
                    >
                      <Bot className="w-3.5 h-3.5" style={{ color: hex }} />
                      <span>Operar Bot</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Character Roster Selector */}
          <section className="xl:col-span-4 neon-card overflow-hidden">
            <div className="p-5 border-b border-cyan-400/15 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-bold text-accent-blue">
                  Personagens Autônomos ({OFFICIAL_AGENTS.length})
                </h2>
                <span className="text-xs font-mono text-[#7C3AED]">19/20 reserv.</span>
              </div>
              <label htmlFor="bot-roster-search" className="sr-only">
                Filtrar personagens
              </label>
              <input
                id="bot-roster-search"
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Buscar codinome, ID ou papel..."
                className="input w-full h-10 !rounded-2xl"
              />
            </div>

            <div className="max-h-64 xl:max-h-[670px] overflow-y-auto p-2.5 space-y-1.5">
              {visibleRoster.map((agent) => {
                const isSelected = agent.id === selectedAgent.id;
                const isWaveActive = waveActiveIds.includes(agent.id);
                const msgCount = countAgentMessages(agent.id);
                const hex = agent.persona.accentHex;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => {
                      onSelectAgent(agent.id);
                      setErrorMsg(null);
                    }}
                    className="w-full text-left p-3 rounded-2xl flex items-start gap-3 transition-all duration-150"
                    style={
                      isSelected
                        ? {
                            background: `linear-gradient(125deg, ${hex}26 0%, var(--color-ink-900) 90%)`,
                            border: `1px solid ${hex}99`,
                            boxShadow: `0 0 22px -10px ${hex}aa`,
                          }
                        : {
                            background: 'transparent',
                            border: '1px solid transparent',
                          }
                    }
                  >
                    <AgentAvatar agent={agent} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-paper-100 truncate">
                          {agent.id} · {agent.persona.codename}
                        </span>
                        <span
                          className="text-[11px] truncate font-medium"
                          style={{ color: isSelected ? hex : 'var(--color-paper-400)' }}
                        >
                          {agent.persona.archetype}
                        </span>
                      </div>
                      <div className="text-xs text-[#C9D4E8] truncate mt-0.5">{agent.name}</div>
                      <div className="text-[11px] truncate mt-0.5 text-[#7C90B8]">
                        {isWaveActive ? (
                          <span className="text-[#047857] font-semibold">Ativo na onda · </span>
                        ) : null}
                        {msgCount > 0 ? `${msgCount} exec. · ` : ''}
                        {agent.persona.motto}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Active Character Command Desk */}
          <section className="xl:col-span-8 space-y-5 min-w-0">
            {/* Character Dossier with Dynamic Signature Neon Aura */}
            <div
              className="rounded-3xl overflow-hidden transition-all duration-300"
              style={{
                background: `radial-gradient(circle at 90% 8%, ${accent}24 0%, var(--color-ink-850) 55%, var(--color-ink-950) 100%)`,
                border: `1.5px solid ${accent}77`,
                boxShadow: `0 20px 48px -24px rgba(0,0,0,0.95), 0 0 38px -16px ${accent}88`,
              }}
            >
              <div
                className="h-1.5 w-full"
                style={{
                  background: `linear-gradient(90deg, ${accent}, #7C3AED, #DB2777)`,
                  boxShadow: `0 0 18px ${accent}`,
                }}
                aria-hidden="true"
              />
              <div className="p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <AgentAvatar agent={selectedAgent} size="xl" />
                    <div className="min-w-0">
                      <div className="text-xs font-mono font-semibold" style={{ color: accent }}>
                        Agente {selectedAgent.id} · {selectedAgent.persona.archetype}
                        {selectedAgent.cannotEditCode ? ' · Somente Auditoria' : ''}
                      </div>
                      <h2 className="font-display text-xl font-bold text-accent-blue mt-0.5">
                        {selectedAgent.persona.codename} — {selectedAgent.name}
                      </h2>
                      <p className="text-xs text-accent-blue/70 mt-1 italic">
                        &ldquo;{selectedAgent.persona.motto}&rdquo;
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={running}
                    onClick={() =>
                      executeSwarmTurn(
                        promptInput.trim() ||
                          `Auditar prioridades do repositório ${activeRepo.fullName} e verificar conformidade §40.`
                      )
                    }
                    className="btn btn-primary w-full sm:w-auto !rounded-2xl !h-10 !px-4 whitespace-nowrap shrink-0"
                  >
                    {liveState?.mode === 'swarm' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    <span>Rodar Enxame (00 → {swarmSpecialistId} → 24)</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/10 text-xs">
                  <div className="space-y-2">
                    <div>
                      <span className="font-semibold text-paper-100">Personalidade &amp; Voz: </span>
                      <span className="text-[#C9D4E8]">{selectedAgent.persona.voiceStyle}</span>
                    </div>
                    {selectedAgent.exclusivePaths.length > 0 && (
                      <div>
                        <span className="font-semibold text-paper-100">Propriedade exclusiva: </span>
                        <span className="font-mono" style={{ color: accent }}>
                          {selectedAgent.exclusivePaths.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="font-semibold text-paper-100">Ferramentas reais: </span>
                      <span className="font-mono text-[#2563EB]">
                        {selectedAgent.persona.signatureTools.join(', ')}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-paper-100">Pendências no domínio: </span>
                      <span className="font-mono text-[#D97706] tabular-nums">
                        {ownedBlockers.length} bloqueador(es) · {incomingHandoffs.length} handoff(s)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Domain Directives */}
                <div className="flex flex-wrap gap-2.5 pt-1">
                  {directives.map((dir) => (
                    <button
                      key={dir.label}
                      type="button"
                      disabled={running}
                      onClick={() => executeSingleBot(dir.prompt)}
                      className="inline-flex items-center gap-2 h-9 px-3.5 text-xs font-semibold text-paper-100 rounded-2xl transition-all disabled:opacity-50"
                      style={{
                        background: 'var(--color-ink-850)',
                        border: `1px solid ${accent}55`,
                      }}
                    >
                      <Terminal className="w-3.5 h-3.5" style={{ color: accent }} />
                      <span>{dir.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Real-Time Execution Activity Panel */}
            {liveState && (
              <div className="rounded-3xl bg-[#070B18] text-paper-100 border border-[#2563EB]/55 shadow-[0_0_30px_-10px_rgba(37,99,235,0.65)] p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 text-xs font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin text-[#2563EB] shrink-0" />
                    <span>
                      {liveAgent
                        ? `${liveAgent.id} · ${liveAgent.persona.codename} em operação (passo ${liveState.currentStep})`
                        : 'Executando agente...'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {liveState.activeToolName && (
                      <span className="text-[11px] font-mono text-[#D97706]">
                        chamando {liveState.activeToolName}...
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-[#2563EB] tabular-nums">
                      {elapsedSec}s
                    </span>
                  </div>
                </div>

                {liveState.mode === 'swarm' && (
                  <div className="flex flex-wrap items-center gap-2 text-xs pt-2 border-t border-white/10">
                    {[
                      { id: '00', label: '00 Núcleo (Planejamento)' },
                      {
                        id: swarmSpecialistId,
                        label: `${swarmSpecialistId} ${swarmSpecialist?.persona.codename ?? 'Especialista'}`,
                      },
                      { id: '24', label: '24 Veredito (Auditoria)' },
                    ].map((stage, idx) => {
                      const isDone = liveState.completedAgents.includes(stage.id);
                      const isCurrent = liveState.currentAgentId === stage.id && !isDone;
                      return (
                        <div key={stage.id} className="inline-flex items-center gap-1.5">
                          {idx > 0 && <ArrowRight className="w-3 h-3 text-[#5C7099]" />}
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-mono text-[11px] ${
                              isDone
                                ? 'bg-[#047857]/15 text-[#047857] border border-[#047857]/50'
                                : isCurrent
                                  ? 'bg-[#2563EB]/15 text-[#2563EB] border border-[#2563EB]/60'
                                  : 'bg-white/5 text-[#7C90B8] border border-white/10'
                            }`}
                          >
                            {isDone && <CheckCircle2 className="w-3 h-3" />}
                            {stage.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {liveState.traces.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-white/10 text-[11px] font-mono">
                    {liveState.traces.map((tr) => (
                      <div key={tr.id} className="flex items-center justify-between gap-2 text-[#D6E0F5]">
                        <span className="text-[#2563EB] shrink-0">
                          [{tr.agentId}] {tr.toolName}
                        </span>
                        <span className="truncate text-[#8FA3C8]">{tr.resultSummary}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Live Error Banner */}
            {errorMsg && (
              <div className="p-4 bg-[#DC2626]/12 border border-[#DC2626]/50 rounded-2xl text-xs text-[#E11D48] flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626]" />
                <div>{errorMsg}</div>
              </div>
            )}

            {/* Autonomous Execution Feed */}
            <div className="neon-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-cyan-400/15 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-paper-100">
                  <Bot className="w-4 h-4 text-[#2563EB]" />
                  <span>Linha de Execução Autônoma — {activeRepo.fullName}</span>
                </div>

                <div className="inline-flex p-1 bg-[#070B16] border border-cyan-400/20 rounded-xl text-[11px]">
                  <button
                    type="button"
                    onClick={() => setFeedScope('all')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      feedScope === 'all'
                        ? 'bg-[#2563EB]/20 text-paper-100 border border-[#2563EB]/45'
                        : 'text-[#8FA3C8] hover:text-paper-100 border border-transparent'
                    }`}
                  >
                    Todos ({allRepoMessages.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedScope('selected')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      feedScope === 'selected'
                        ? 'bg-[#7C3AED]/25 text-paper-100 border border-[#7C3AED]/50'
                        : 'text-[#8FA3C8] hover:text-paper-100 border border-transparent'
                    }`}
                  >
                    Só {selectedAgent.persona.codename}
                  </button>
                </div>
              </div>

              <div
                ref={feedScrollRef}
                className="p-5 space-y-4 max-h-[500px] overflow-y-auto bg-[#060914]/70"
              >
                {repoMessages.length === 0 ? (
                  <div className="text-center py-10 text-xs text-[#8FA3C8]">
                    Nenhuma execução registrada para este filtro ainda. Escolha uma diretiva acima ou envie um comando abaixo.
                  </div>
                ) : (
                  repoMessages.map((msg: AgentBotMessage) => {
                    const msgAgent = getAgentById(msg.agentId);
                    const msgHex = msgAgent?.persona.accentHex ?? '#2563EB';
                    if (msg.role === 'user') {
                      return (
                        <div key={msg.id} className="flex justify-end">
                          <div
                            className="max-w-[85%] text-paper-100 rounded-2xl px-4 py-3 text-xs space-y-1"
                            style={{
                              background:
                                'linear-gradient(135deg, rgba(37,99,235,0.22), rgba(124,58,237,0.26))',
                              border: '1px solid rgba(37,99,235,0.45)',
                            }}
                          >
                            <div className="text-[11px] text-[#2563EB] font-mono">
                              Diretiva → {msgAgent ? `${msgAgent.id} ${msgAgent.persona.codename}` : msg.agentId}
                            </div>
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className="rounded-2xl p-4 space-y-3 bg-[#0B1124]/95"
                        style={{
                          border: `1px solid ${msgHex}44`,
                          boxShadow: `0 10px 28px -18px ${msgHex}66`,
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            {msgAgent && <AgentAvatar agent={msgAgent} size="sm" />}
                            <div>
                              <div className="text-xs font-bold text-paper-100">
                                {msgAgent
                                  ? `${msgAgent.id} · ${msgAgent.persona.codename} (${msgAgent.name})`
                                  : `Agente ${msg.agentId}`}
                              </div>
                              <div className="text-[11px] text-[#7C90B8] font-mono tabular-nums">
                                {new Date(msg.timestamp).toLocaleTimeString('pt-BR')}
                              </div>
                            </div>
                          </div>
                          {msgAgent && msgAgent.id !== selectedAgent.id && (
                            <button
                              type="button"
                              onClick={() => onSelectAgent(msgAgent.id)}
                              className="text-[11px] font-semibold text-paper-100 px-3 py-1.5 rounded-xl transition-all"
                              style={{
                                background: `${msgHex}1a`,
                                border: `1px solid ${msgHex}66`,
                              }}
                            >
                              Falar com {msgAgent.persona.codename}
                            </button>
                          )}
                        </div>

                        {msg.toolTraces && msg.toolTraces.length > 0 && (
                          <div className="bg-[#060914] border border-cyan-400/20 rounded-xl p-3 space-y-1.5">
                            <div className="text-[11px] font-semibold text-[#2563EB] flex items-center gap-1.5">
                              <Wrench className="w-3 h-3" />
                              <span>Ações executadas no workspace ({msg.toolTraces.length})</span>
                            </div>
                            {msg.toolTraces.map((tr) => (
                              <div
                                key={tr.id}
                                className="text-[11px] font-mono text-[#D6E0F5] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-t border-white/10 pt-1.5"
                              >
                                <span className="font-semibold text-[#047857]">{tr.toolName}</span>
                                <span className="text-[#8FA3C8] truncate">{tr.resultSummary}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <MarkdownMessage content={msg.content} />
                      </div>
                    );
                  })
                )}
              </div>

              <form
                onSubmit={handleSubmit}
                className="p-4 bg-[#080C1A] border-t border-cyan-400/15 flex items-center gap-2.5"
              >
                <label htmlFor="bot-command-input" className="sr-only">
                  Enviar comando ao bot selecionado
                </label>
                <input
                  id="bot-command-input"
                  type="text"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  disabled={running}
                  placeholder={`Enviar comando para ${selectedAgent.persona.codename} (${selectedAgent.id})...`}
                  className="input flex-1 h-11 !rounded-2xl"
                />
                <button
                  type="submit"
                  disabled={running || !promptInput.trim()}
                  className="btn btn-primary h-11 !px-5 !rounded-2xl whitespace-nowrap shrink-0"
                >
                  {liveState?.mode === 'single' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{running ? 'Executando...' : 'Executar'}</span>
                </button>
              </form>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
