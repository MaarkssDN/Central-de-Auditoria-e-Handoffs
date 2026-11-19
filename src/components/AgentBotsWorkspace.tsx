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
      <div className="panel p-10 text-center text-sm text-slate-500">
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

  // Featured squad bar: active wave agents + Veredito (24)
  const featuredIds = Array.from(new Set([...waveActiveIds, '24']));
  const featuredAgents = featuredIds
    .map((id) => getAgentById(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const liveAgent = liveState ? getAgentById(liveState.currentAgentId) : null;

  return (
    <div className="space-y-5">
      {/* Top Active Squad Strip + View Mode Toggle */}
      <section className="panel p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-signal-400">
            SEC-BOT · Esquadrão em Operação
          </div>
          <div className="text-sm font-display font-semibold text-paper-100">
            {activeWave ? activeWave.name : activeRepo.fullName}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {featuredAgents.map((agent) => {
              const isSelected = agent.id === selectedAgent.id && viewMode === 'desk';
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => {
                    onSelectAgent(agent.id);
                    setViewMode('desk');
                    setErrorMsg(null);
                  }}
                  className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-left transition-colors ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <AgentAvatar agent={agent} size="sm" />
                  <div className="leading-tight">
                    <div className="text-xs font-semibold">
                      {agent.id} · {agent.persona.codename}
                    </div>
                    <div className={`text-[11px] ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                      {agent.persona.archetype}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md self-start lg:self-center shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('desk')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              viewMode === 'desk' ? 'bg-white text-slate-900' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Mesa do Bot</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('gallery')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              viewMode === 'gallery' ? 'bg-white text-slate-900' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Galeria ({OFFICIAL_AGENTS.length})</span>
          </button>
        </div>
      </section>

      {viewMode === 'gallery' ? (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Todos os Personagens Autônomos ({visibleRoster.length} de {OFFICIAL_AGENTS.length})
              </h2>
              <p className="text-xs text-slate-500">
                Cada agente possui identidade, voz, lema e diretivas próprias. Clique para operar o bot.
              </p>
            </div>
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filtrar codinome, papel ou lema..."
              aria-label="Filtrar galeria de personagens"
              className="h-9 px-3 text-xs panel w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleRoster.map((agent) => {
              const isWaveActive = waveActiveIds.includes(agent.id);
              const msgCount = countAgentMessages(agent.id);
              return (
                <article
                  key={agent.id}
                  className="panel overflow-hidden flex flex-col justify-between"
                >
                  <div
                    className="h-1 w-full"
                    style={{ backgroundColor: agent.persona.accentHex }}
                    aria-hidden="true"
                  />
                  <div className="p-4 space-y-2.5 flex-1">
                    <div className="flex items-start gap-3">
                      <AgentAvatar agent={agent} size="lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
                          <span>Agente {agent.id}</span>
                          {isWaveActive && (
                            <span className="text-emerald-700 font-semibold">Ativo na onda</span>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 truncate">
                          {agent.persona.codename}
                        </h3>
                        <div className="text-xs text-slate-600 truncate">
                          {agent.persona.archetype}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs font-medium text-slate-800">{agent.name}</div>
                    <p className="text-xs text-slate-600 italic line-clamp-2">
                      &ldquo;{agent.persona.motto}&rdquo;
                    </p>
                    <div className="text-[11px] text-slate-500 line-clamp-2">
                      {agent.persona.voiceStyle}
                    </div>
                  </div>

                  <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-slate-500 truncate">
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
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md whitespace-nowrap shrink-0"
                    >
                      <Bot className="w-3.5 h-3.5" />
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
          <section className="xl:col-span-4 panel overflow-hidden">
            <div className="p-4 border-b border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">
                  Personagens Autônomos ({OFFICIAL_AGENTS.length})
                </h2>
                <span className="text-xs font-mono text-slate-500">19/20 reserv.</span>
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
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="max-h-60 xl:max-h-[650px] overflow-y-auto divide-y divide-slate-100">
              {visibleRoster.map((agent) => {
                const isSelected = agent.id === selectedAgent.id;
                const isWaveActive = waveActiveIds.includes(agent.id);
                const msgCount = countAgentMessages(agent.id);
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => {
                      onSelectAgent(agent.id);
                      setErrorMsg(null);
                    }}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors ${
                      isSelected ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-900'
                    }`}
                  >
                    <AgentAvatar agent={agent} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold truncate">
                          {agent.id} · {agent.persona.codename}
                        </span>
                        <span
                          className={`text-[11px] truncate ${
                            isSelected ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {agent.persona.archetype}
                        </span>
                      </div>
                      <div
                        className={`text-xs truncate mt-0.5 ${
                          isSelected ? 'text-slate-200' : 'text-slate-700'
                        }`}
                      >
                        {agent.name}
                      </div>
                      <div
                        className={`text-[11px] truncate mt-0.5 ${
                          isSelected
                            ? 'text-slate-400'
                            : isWaveActive
                              ? 'text-emerald-700 font-medium'
                              : 'text-slate-400'
                        }`}
                      >
                        {isWaveActive ? 'Ativo na onda · ' : ''}
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
            {/* Character Dossier with Signature Accent Strip */}
            <div className="panel overflow-hidden">
              <div
                className="h-1.5 w-full"
                style={{ backgroundColor: selectedAgent.persona.accentHex }}
                aria-hidden="true"
              />
              <div className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <AgentAvatar agent={selectedAgent} size="xl" />
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-slate-500">
                        Agente {selectedAgent.id} · {selectedAgent.persona.archetype}
                        {selectedAgent.cannotEditCode ? ' · Somente Auditoria' : ''}
                      </div>
                      <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
                        {selectedAgent.persona.codename} — {selectedAgent.name}
                      </h2>
                      <p className="text-xs text-slate-600 mt-1 italic">
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
                    className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-md whitespace-nowrap shrink-0"
                  >
                    {liveState?.mode === 'swarm' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    <span>
                      Rodar Enxame (00 → {swarmSpecialistId} → 24)
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100 text-xs">
                  <div className="space-y-1.5">
                    <div>
                      <span className="font-semibold text-slate-700">Personalidade &amp; Voz: </span>
                      <span className="text-slate-600">{selectedAgent.persona.voiceStyle}</span>
                    </div>
                    {selectedAgent.exclusivePaths.length > 0 && (
                      <div>
                        <span className="font-semibold text-slate-700">Propriedade exclusiva: </span>
                        <span className="font-mono text-slate-600">
                          {selectedAgent.exclusivePaths.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <span className="font-semibold text-slate-700">Ferramentas reais: </span>
                      <span className="font-mono text-slate-600">
                        {selectedAgent.persona.signatureTools.join(', ')}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Pendências no domínio: </span>
                      <span className="font-mono text-slate-600">
                        {ownedBlockers.length} bloqueador(es) · {incomingHandoffs.length} handoff(s)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Domain Directives */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {directives.map((dir) => (
                    <button
                      key={dir.label}
                      type="button"
                      disabled={running}
                      onClick={() => executeSingleBot(dir.prompt)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 rounded-md transition-colors"
                    >
                      <Terminal className="w-3.5 h-3.5 text-slate-500" />
                      <span>{dir.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Devin/Swarm Real-Time Activity Panel while executing */}
            {liveState && (
              <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-lg p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 text-xs font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-400 shrink-0" />
                    <span>
                      {liveAgent
                        ? `${liveAgent.id} · ${liveAgent.persona.codename} em operação (passo ${liveState.currentStep})`
                        : 'Executando agente...'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {liveState.activeToolName && (
                      <span className="text-[11px] font-mono text-amber-300">
                        chamando {liveState.activeToolName}...
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-slate-400">
                      {elapsedSec}s
                    </span>
                  </div>
                </div>

                {liveState.mode === 'swarm' && (
                  <div className="flex flex-wrap items-center gap-2 text-xs pt-1 border-t border-slate-800">
                    {[
                      { id: '00', label: '00 Atlas (Planejamento)' },
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
                          {idx > 0 && <ArrowRight className="w-3 h-3 text-slate-600" />}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded font-mono text-[11px] ${
                              isDone
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : isCurrent
                                  ? 'bg-sky-950 text-sky-200 border border-sky-700'
                                  : 'bg-slate-800 text-slate-400'
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
                  <div className="space-y-1 pt-2 border-t border-slate-800 text-[11px] font-mono">
                    {liveState.traces.map((tr) => (
                      <div key={tr.id} className="flex items-center justify-between gap-2 text-slate-300">
                        <span className="text-sky-300 shrink-0">
                          [{tr.agentId}] {tr.toolName}
                        </span>
                        <span className="truncate text-slate-400">{tr.resultSummary}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Live Error Banner (explicit, never mocked) */}
            {errorMsg && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>{errorMsg}</div>
              </div>
            )}

            {/* Execution Feed (Devin / Grok-Bot Timeline) */}
            <div className="panel overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <Bot className="w-4 h-4 text-slate-500" />
                  <span>Linha de Execução Autônoma — {activeRepo.fullName}</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="inline-flex p-0.5 bg-slate-100 rounded text-[11px]">
                    <button
                      type="button"
                      onClick={() => setFeedScope('all')}
                      className={`px-2 py-1 rounded font-medium ${
                        feedScope === 'all' ? 'bg-white text-slate-900' : 'text-slate-600'
                      }`}
                    >
                      Todos ({allRepoMessages.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedScope('selected')}
                      className={`px-2 py-1 rounded font-medium ${
                        feedScope === 'selected' ? 'bg-white text-slate-900' : 'text-slate-600'
                      }`}
                    >
                      Só {selectedAgent.persona.codename}
                    </button>
                  </div>
                </div>
              </div>

              <div
                ref={feedScrollRef}
                className="p-5 space-y-4 max-h-[500px] overflow-y-auto bg-slate-50/50"
              >
                {repoMessages.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    Nenhuma execução registrada para este filtro ainda. Escolha uma diretiva acima ou envie um comando abaixo.
                  </div>
                ) : (
                  repoMessages.map((msg: AgentBotMessage) => {
                    const msgAgent = getAgentById(msg.agentId);
                    if (msg.role === 'user') {
                      return (
                        <div key={msg.id} className="flex justify-end">
                          <div className="max-w-[85%] bg-signal-500/15 border border-signal-500/30 text-paper-100 rounded-lg px-4 py-2.5 text-xs space-y-1">
                            <div className="text-[11px] text-signal-300 font-mono">
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
                        className="panel p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            {msgAgent && <AgentAvatar agent={msgAgent} size="sm" />}
                            <div>
                              <div className="text-xs font-semibold text-slate-900">
                                {msgAgent
                                  ? `${msgAgent.id} · ${msgAgent.persona.codename} (${msgAgent.name})`
                                  : `Agente ${msg.agentId}`}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {new Date(msg.timestamp).toLocaleTimeString('pt-BR')}
                              </div>
                            </div>
                          </div>
                          {msgAgent && msgAgent.id !== selectedAgent.id && (
                            <button
                              type="button"
                              onClick={() => onSelectAgent(msgAgent.id)}
                              className="text-[11px] font-medium text-slate-600 hover:text-slate-900 border border-slate-200 px-2 py-1 rounded"
                            >
                              Falar com {msgAgent.persona.codename}
                            </button>
                          )}
                        </div>

                        {msg.toolTraces && msg.toolTraces.length > 0 && (
                          <div className="bg-slate-50 border border-slate-200 rounded-md p-2.5 space-y-1.5">
                            <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                              <Wrench className="w-3 h-3" />
                              <span>Ações executadas no workspace ({msg.toolTraces.length})</span>
                            </div>
                            {msg.toolTraces.map((tr) => (
                              <div
                                key={tr.id}
                                className="text-[11px] font-mono text-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-t border-slate-200/70 pt-1"
                              >
                                <span className="font-semibold text-slate-900">{tr.toolName}</span>
                                <span className="text-slate-600 truncate">{tr.resultSummary}</span>
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
                className="p-4 bg-white border-t border-slate-200 flex items-center gap-2.5"
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
                  className="input flex-1 h-10 !text-sm"
                />
                <button
                  type="submit"
                  disabled={running || !promptInput.trim()}
                  className="btn btn-primary h-10 !px-4 whitespace-nowrap shrink-0"
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
