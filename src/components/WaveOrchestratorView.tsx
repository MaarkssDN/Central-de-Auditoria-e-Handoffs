import { useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  Copy,
  Lock,
  Plus,
  ShieldAlert,
  Unlock,
  X,
} from 'lucide-react';
import { OFFICIAL_AGENTS } from '../data/agentsRoster';
import { AgentAvatar } from './AgentAvatar';
import type {
  Handoff,
  IndependentReview,
  Mission,
  RepositoryTarget,
  Wave,
  WaveState,
} from '../types/governance';
import {
  checkSlotConflicts,
  evaluateWaveTransition,
  formatMissionPrompt,
  getAgentById,
} from '../utils/governanceEngine';

interface WaveOrchestratorViewProps {
  activeRepo?: RepositoryTarget;
  waves: Wave[];
  missions: Mission[];
  handoffs: Handoff[];
  reviews: IndependentReview[];
  onCreateWave: (wave: Wave) => void;
  onUpdateWave: (wave: Wave) => void;
  onCreateMission: (mission: Mission) => void;
  onToggleMissionStep: (missionId: string, stepIndex: number) => void;
  onActivateBot?: (agentId: string) => void;
}

const WAVE_STATES: WaveState[] = [
  'PLANEJADA',
  'MATRIZ_PUBLICADA',
  'EM_EXECUCAO',
  'EM_REVISAO',
  'EM_INTEGRACAO',
  'GATE_VERDE',
  'RELEASE_APPROVED',
];

export function WaveOrchestratorView({
  activeRepo,
  waves,
  missions,
  handoffs,
  reviews,
  onCreateWave,
  onUpdateWave,
  onCreateMission,
  onToggleMissionStep,
  onActivateBot,
}: WaveOrchestratorViewProps) {
  const [selectedWaveId, setSelectedWaveId] = useState<string>(waves[0]?.id ?? '');
  const [slotAlert, setSlotAlert] = useState<string | null>(null);
  const [transitionAlert, setTransitionAlert] = useState<string | null>(null);
  const [copiedMissionId, setCopiedMissionId] = useState<string | null>(null);
  const [showMissionModal, setShowMissionModal] = useState(false);

  // Mission modal state
  const [missionAgentId, setMissionAgentId] = useState('02');
  const [missionTitle, setMissionTitle] = useState('');
  const [missionSlug, setMissionSlug] = useState('');
  const [missionObjective, setMissionObjective] = useState('');
  const [missionOwnedFiles, setMissionOwnedFiles] = useState('');
  const [missionOutOfScope, setMissionOutOfScope] = useState('');
  const [missionSuccess, setMissionSuccess] = useState('npx tsc --noEmit && npm run lint');
  const [missionPlanText, setMissionPlanText] = useState(
    'Diagnosticar escopo e propriedade -> Critério: arquivos mapeados\nImplementar correção cirúrgica -> Critério: testes passando'
  );
  const [missionError, setMissionError] = useState<string | null>(null);

  if (!activeRepo) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-sm text-slate-500">
        Conecte um repositório para orquestrar ondas e missões.
      </div>
    );
  }

  const activeWave = waves.find((w) => w.id === selectedWaveId) ?? waves[waves.length - 1];
  const waveMissions = activeWave
    ? missions.filter((m) => m.repoId === activeRepo.id && m.waveNumber === activeWave.number)
    : [];
  const waveHandoffs = activeWave
    ? handoffs.filter((h) => h.repoId === activeRepo.id && h.waveNumber === activeWave.number)
    : [];
  const waveReviews = activeWave
    ? reviews.filter((r) => r.repoId === activeRepo.id && r.waveNumber === activeWave.number)
    : [];

  function handleToggleAgentInWave(agentId: string) {
    if (!activeWave) return;
    setSlotAlert(null);

    if (activeWave.activeAgentIds.includes(agentId)) {
      if (agentId === '00') {
        setSlotAlert('O Coordenador (00) permanece ativo durante toda a onda (§13).');
        return;
      }
      onUpdateWave({
        ...activeWave,
        activeAgentIds: activeWave.activeAgentIds.filter((id) => id !== agentId),
      });
      return;
    }

    const touchedPaths = waveMissions.flatMap((m) => m.ownedFiles);
    const check = checkSlotConflicts({
      activeAgentIds: activeWave.activeAgentIds,
      candidateAgentId: agentId,
      matrixPublished: Boolean(activeWave.matrixPublishedAt),
      openHandoffs: waveHandoffs,
      touchedPaths,
    });

    if (!check.allowed) {
      setSlotAlert(check.reasons.join(' '));
      return;
    }

    onUpdateWave({
      ...activeWave,
      activeAgentIds: [...activeWave.activeAgentIds, agentId],
    });
  }

  function handleTransitionWave(targetState: WaveState) {
    if (!activeWave) return;
    setTransitionAlert(null);

    const check = evaluateWaveTransition({
      wave: activeWave,
      targetState,
      handoffs: waveHandoffs,
      reviews: waveReviews,
    });

    if (!check.allowed) {
      setTransitionAlert(check.blockers.join(' '));
      return;
    }

    onUpdateWave({
      ...activeWave,
      state: targetState,
      matrixPublishedAt:
        targetState === 'MATRIZ_PUBLICADA' && !activeWave.matrixPublishedAt
          ? new Date().toISOString()
          : activeWave.matrixPublishedAt,
    });
  }

  function handleCreateNextWave() {
    if (!activeRepo) return;
    const nextNumber = (waves[waves.length - 1]?.number ?? 0) + 1;
    const baseGates = activeWave?.gates.map((g) => ({
      ...g,
      status: g.status === 'NAO_APLICAVEL' ? ('NAO_APLICAVEL' as const) : ('NAO_EXECUTADO' as const),
      lastRunAt: undefined,
    })) ?? [];

    const newWave: Wave = {
      id: `wave-${activeRepo.id}-${nextNumber}-${Date.now().toString(36)}`,
      repoId: activeRepo.id,
      number: nextNumber,
      name: `Onda ${nextNumber} — Nova Onda de Execução`,
      integrationBranch: `integracao/onda-${nextNumber}`,
      state: 'PLANEJADA',
      scopeFreezeActive: false,
      activeAgentIds: ['00'],
      mergesSinceLastGate: 0,
      gates: baseGates,
      createdAt: new Date().toISOString(),
    };
    onCreateWave(newWave);
    setSelectedWaveId(newWave.id);
  }

  async function handleCopyPrompt(mission: Mission) {
    try {
      await navigator.clipboard.writeText(formatMissionPrompt(mission));
      setCopiedMissionId(mission.id);
      setTimeout(() => setCopiedMissionId(null), 2000);
    } catch {
      // Ignore clipboard failure
    }
  }

  function handleCreateMissionSubmit(e: FormEvent) {
    e.preventDefault();
    if (!activeWave || !activeRepo) return;
    setMissionError(null);

    if (!missionTitle.trim() || !missionSlug.trim() || !missionObjective.trim()) {
      setMissionError('Preencha título, slug e objetivo da missão (§11).');
      return;
    }

    const safeSlug = missionSlug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    const ownedFiles = missionOwnedFiles
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const conflictCheck = checkSlotConflicts({
      activeAgentIds: activeWave.activeAgentIds,
      candidateAgentId: missionAgentId,
      matrixPublished: Boolean(activeWave.matrixPublishedAt),
      openHandoffs: waveHandoffs,
      touchedPaths: ownedFiles,
    });

    if (!conflictCheck.allowed) {
      setMissionError(conflictCheck.reasons.join(' '));
      return;
    }

    const planSteps = missionPlanText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [desc, crit] = line.split('->');
        return {
          description: desc?.trim() || line,
          verificationCriteria: crit?.replace(/^Critério:\s*/i, '').trim() || 'Verificado via teste',
          completed: false,
        };
      });

    const newMission: Mission = {
      id: `mis-${Date.now().toString(36)}`,
      repoId: activeRepo.id,
      waveNumber: activeWave.number,
      agentId: missionAgentId,
      title: missionTitle.trim(),
      slug: safeSlug,
      baseBranch: activeWave.integrationBranch,
      branchName: `agente/${missionAgentId}-${safeSlug}`,
      objective: missionObjective.trim(),
      outOfScope: missionOutOfScope
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      ownedFiles,
      dependencyFiles: [],
      assumptions: ['Sem suposições silenciosas (P1)'],
      plan: planSteps,
      finalSuccessCriterion: missionSuccess.trim() || 'npx tsc --noEmit && npm run lint',
      expectedDeliverable: 'Relatório de conclusão + parecer APROVADO do Agente 24',
      status: 'planejada',
      createdAt: new Date().toISOString(),
    };

    if (!activeWave.activeAgentIds.includes(missionAgentId)) {
      onUpdateWave({
        ...activeWave,
        activeAgentIds: [...activeWave.activeAgentIds, missionAgentId],
      });
    }

    onCreateMission(newMission);
    setShowMissionModal(false);
    setMissionTitle('');
    setMissionSlug('');
    setMissionObjective('');
    setMissionOwnedFiles('');
    setMissionOutOfScope('');
  }

  return (
    <div className="space-y-6">
      {/* Wave Selector Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0">
        <div className="flex flex-wrap items-center gap-3 min-w-0 w-full md:w-auto">
          <label htmlFor="wave-selector" className="sr-only">
            Selecionar Onda
          </label>
          <select
            id="wave-selector"
            value={activeWave?.id || ''}
            onChange={(e) => {
              setSelectedWaveId(e.target.value);
              setSlotAlert(null);
              setTransitionAlert(null);
            }}
            className="h-9 w-full sm:w-auto max-w-full px-3 text-sm font-medium bg-white border border-slate-200 rounded-md text-slate-900 truncate"
          >
            {waves.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.state})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleCreateNextWave}
            className="h-9 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap"
          >
            + Nova Onda
          </button>
        </div>

        {activeWave && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onUpdateWave({ ...activeWave, scopeFreezeActive: !activeWave.scopeFreezeActive })
              }
              className={`inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium rounded-md border whitespace-nowrap ${
                activeWave.scopeFreezeActive
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {activeWave.scopeFreezeActive ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Unlock className="w-3.5 h-3.5" />
              )}
              <span>
                {activeWave.scopeFreezeActive ? 'Freeze de Escopo Ativo (§23)' : 'Ativar Freeze'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowMissionModal(true)}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Missão</span>
            </button>
          </div>
        )}
      </div>

      {activeWave && (
        <>
          {/* Lifecycle Stepper (§20) */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Ciclo de Vida da Onda (§20)
                </h2>
                <div className="text-xs text-slate-500 mt-0.5 font-mono">
                  Branch de integração: {activeWave.integrationBranch} · Merges desde o último gate:{' '}
                  <span className="font-semibold text-slate-800">{activeWave.mergesSinceLastGate}/3</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateWave({
                      ...activeWave,
                      mergesSinceLastGate: activeWave.mergesSinceLastGate + 1,
                    })
                  }
                  className="h-8 px-3 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap"
                >
                  +1 Merge
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateWave({ ...activeWave, mergesSinceLastGate: 0 })}
                  className="h-8 px-3 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap"
                >
                  Zerar Gate
                </button>
              </div>
            </div>

            {transitionAlert && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>{transitionAlert}</div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {WAVE_STATES.map((st) => {
                const isCurrent = activeWave.state === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleTransitionWave(st)}
                    className={`px-2 py-2 text-[11px] sm:text-xs font-mono font-medium rounded-md border text-center transition-colors truncate ${
                      isCurrent
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Active Specialists & Exclusive Slot Guard (§13 & §14) */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Concorrência e Slots Exclusivos (§13 e §14)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ative ou desative especialistas na onda. Conflitos exclusivos (01↔01A, 06↔06A, 08↔08A, 16↔06/07 em fila) e limites são bloqueados automaticamente.
                </p>
              </div>
              <div className="text-xs font-mono text-slate-700 tabular-nums shrink-0">
                Especialistas ativos: {activeWave.activeAgentIds.filter((id) => id !== '00').length}/8
              </div>
            </div>

            {slotAlert && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <div>{slotAlert}</div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {OFFICIAL_AGENTS.map((agent) => {
                const isActive = activeWave.activeAgentIds.includes(agent.id);
                return (
                  <div
                    key={agent.id}
                    className={`rounded-md border p-2.5 flex items-center justify-between gap-2 transition-colors ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleAgentInWave(agent.id)}
                      aria-pressed={isActive}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                    >
                      <AgentAvatar agent={agent} size="sm" />
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-semibold truncate">
                          {agent.id} · {agent.persona.codename}
                        </div>
                        <div
                          className={`text-[11px] truncate ${
                            isActive ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {agent.name}
                        </div>
                      </div>
                    </button>
                    {onActivateBot && (
                      <button
                        type="button"
                        onClick={() => onActivateBot(agent.id)}
                        title={`Abrir bot ${agent.persona.codename}`}
                        aria-label={`Abrir bot ${agent.id} ${agent.persona.codename}`}
                        className={`p-1.5 rounded border shrink-0 transition-colors ${
                          isActive
                            ? 'border-slate-700 text-slate-200 hover:bg-slate-800'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <Bot className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Missions Board */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Missões da Onda {activeWave.number} ({waveMissions.length})
              </h3>
            </div>

            {waveMissions.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
                <p className="text-sm text-slate-700 font-medium">
                  Nenhuma missão cadastrada para a Onda {activeWave.number}.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Crie missões no formato oficial (§11) para gerar branch isolada e prompt pronto para o Jules.
                </p>
                <button
                  type="button"
                  onClick={() => setShowMissionModal(true)}
                  className="mt-4 h-9 px-4 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                >
                  Criar Primeira Missão
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {waveMissions.map((mission) => {
                  const agent = getAgentById(mission.agentId);
                  return (
                    <article
                      key={mission.id}
                      className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 min-w-0"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {agent && <AgentAvatar agent={agent} size="md" />}
                          <div className="min-w-0">
                            <div className="text-xs font-mono text-slate-500 break-words">
                              Agente {mission.agentId} · {agent?.persona.codename} ({agent?.name}) ·{' '}
                              {mission.branchName}
                            </div>
                            <h4 className="text-base font-semibold text-slate-900 mt-0.5">
                              {mission.title}
                            </h4>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {onActivateBot && (
                            <button
                              type="button"
                              onClick={() => onActivateBot(mission.agentId)}
                              className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap"
                            >
                              <Bot className="w-3.5 h-3.5" />
                              <span>Bot</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopyPrompt(mission)}
                            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md shrink-0 whitespace-nowrap"
                          >
                            {copiedMissionId === mission.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Prompt copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Prompt Jules</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <p className="text-sm text-slate-600">{mission.objective}</p>

                      {mission.ownedFiles.length > 0 && (
                        <div className="text-xs break-all">
                          <span className="font-semibold text-slate-700">Propriedade: </span>
                          <span className="font-mono text-slate-600">
                            {mission.ownedFiles.join(', ')}
                          </span>
                        </div>
                      )}

                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <div className="text-xs font-semibold text-slate-700">
                          Plano e Critérios Verificáveis
                        </div>
                        {mission.plan.map((step, idx) => (
                          <label
                            key={idx}
                            className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={step.completed}
                              onChange={() => onToggleMissionStep(mission.id, idx)}
                              className="mt-0.5 rounded border-slate-300"
                            />
                            <span className={step.completed ? 'line-through text-slate-400' : ''}>
                              {step.description} →{' '}
                              <span className="font-mono text-slate-500">
                                {step.verificationCriteria}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>

                      <div className="text-xs text-slate-500 font-mono pt-2 border-t border-slate-100">
                        Sucesso final: {mission.finalSuccessCriterion}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* Create Mission Modal */}
      {showMissionModal && activeWave && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mission-modal-title"
        >
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-lg overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 id="mission-modal-title" className="text-base font-semibold text-slate-900">
                Nova Missão na Onda {activeWave.number} (§11)
              </h2>
              <button
                type="button"
                onClick={() => setShowMissionModal(false)}
                aria-label="Fechar janela de nova missão"
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMissionSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {missionError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {missionError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="mis-agent" className="block text-xs font-medium text-slate-700 mb-1">
                    Agente executor
                  </label>
                  <select
                    id="mis-agent"
                    value={missionAgentId}
                    onChange={(e) => setMissionAgentId(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs border border-slate-300 rounded-md bg-white"
                  >
                    {OFFICIAL_AGENTS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.id} — {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="mis-slug" className="block text-xs font-medium text-slate-700 mb-1">
                    Slug da branch
                  </label>
                  <input
                    id="mis-slug"
                    type="text"
                    value={missionSlug}
                    onChange={(e) => setMissionSlug(e.target.value)}
                    placeholder="ex: corrigir-nav"
                    className="w-full h-9 px-3 text-xs font-mono border border-slate-300 rounded-md"
                  />
                </div>

                <div>
                  <label htmlFor="mis-title" className="block text-xs font-medium text-slate-700 mb-1">
                    Título curto
                  </label>
                  <input
                    id="mis-title"
                    type="text"
                    value={missionTitle}
                    onChange={(e) => setMissionTitle(e.target.value)}
                    placeholder="ex: Navegação acessível"
                    className="w-full h-9 px-3 text-xs border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="mis-obj" className="block text-xs font-medium text-slate-700 mb-1">
                  Objetivo (uma frase)
                </label>
                <input
                  id="mis-obj"
                  type="text"
                  value={missionObjective}
                  onChange={(e) => setMissionObjective(e.target.value)}
                  placeholder="Descreva exatamente o que será entregue..."
                  className="w-full h-9 px-3 text-xs border border-slate-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="mis-files" className="block text-xs font-medium text-slate-700 mb-1">
                    Arquivos sob propriedade (1 por linha)
                  </label>
                  <textarea
                    id="mis-files"
                    rows={3}
                    value={missionOwnedFiles}
                    onChange={(e) => setMissionOwnedFiles(e.target.value)}
                    placeholder="src/App.tsx"
                    className="w-full p-2.5 text-xs font-mono border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="mis-oos" className="block text-xs font-medium text-slate-700 mb-1">
                    Fora de escopo (1 por linha)
                  </label>
                  <textarea
                    id="mis-oos"
                    rows={3}
                    value={missionOutOfScope}
                    onChange={(e) => setMissionOutOfScope(e.target.value)}
                    placeholder="Alterar prisma/schema.prisma"
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="mis-plan" className="block text-xs font-medium text-slate-700 mb-1">
                  Etapas do plano (etapa -&gt; Critério: verificável)
                </label>
                <textarea
                  id="mis-plan"
                  rows={2}
                  value={missionPlanText}
                  onChange={(e) => setMissionPlanText(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label htmlFor="mis-success" className="block text-xs font-medium text-slate-700 mb-1">
                  Critério de sucesso final (executável)
                </label>
                <input
                  id="mis-success"
                  type="text"
                  value={missionSuccess}
                  onChange={(e) => setMissionSuccess(e.target.value)}
                  className="w-full h-9 px-3 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowMissionModal(false)}
                  className="h-9 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                >
                  Criar Missão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
