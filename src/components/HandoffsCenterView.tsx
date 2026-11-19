import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { DEFAULT_PRIORITY_BLOCKERS, OFFICIAL_AGENTS } from '../data/agentsRoster';
import { AgentAvatar } from './AgentAvatar';
import type {
  Handoff,
  HandoffPriority,
  HandoffStatus,
  Wave,
} from '../types/governance';
import {
  formatHandoffFileName,
  formatHandoffMarkdown,
  getAgentById,
} from '../utils/governanceEngine';

interface HandoffsCenterViewProps {
  repoId: string;
  waves: Wave[];
  handoffs: Handoff[];
  onCreateHandoff: (handoff: Handoff) => void;
  onUpdateHandoff: (handoff: Handoff) => void;
  onActivateBot?: (agentId: string) => void;
}

export function HandoffsCenterView({
  repoId,
  waves,
  handoffs,
  onCreateHandoff,
  onUpdateHandoff,
  onActivateBot,
}: HandoffsCenterViewProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | HandoffStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | HandoffPriority>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(handoffs[0]?.id ?? null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Resolution form state
  const [resolutionBy, setResolutionBy] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [resolutionEvidence, setResolutionEvidence] = useState('');
  const [resolutionVerified24, setResolutionVerified24] = useState(false);
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  // Create form state
  const [fromAgentId, setFromAgentId] = useState('06');
  const [toAgentId, setToAgentId] = useState('01');
  const [waveNumber, setWaveNumber] = useState(waves[waves.length - 1]?.number ?? 1);
  const [slug, setSlug] = useState('');
  const [priority, setPriority] = useState<HandoffPriority>('bloqueador');
  const [blockerRef, setBlockerRef] = useState('B-10');
  const [targetSprint, setTargetSprint] = useState(`Onda ${waves[waves.length - 1]?.number ?? 1}`);
  const [problem, setProblem] = useState('');
  const [filesText, setFilesText] = useState('');
  const [evidence, setEvidence] = useState('');
  const [requiredChange, setRequiredChange] = useState('');
  const [expectedTest, setExpectedTest] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = handoffs.filter((h) => {
    const matchStatus = statusFilter === 'all' || h.status === statusFilter;
    const matchPriority = priorityFilter === 'all' || h.priority === priorityFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchQuery =
      !q ||
      h.slug.toLowerCase().includes(q) ||
      h.problem.toLowerCase().includes(q) ||
      h.fromAgentId.toLowerCase().includes(q) ||
      h.toAgentId.toLowerCase().includes(q) ||
      h.blockerRef.toLowerCase().includes(q);
    return matchStatus && matchPriority && matchQuery;
  });

  const selectedHandoff =
    handoffs.find((h) => h.id === selectedId) ?? filtered[0] ?? null;

  async function handleCopyMarkdown(handoff: Handoff) {
    try {
      await navigator.clipboard.writeText(formatHandoffMarkdown(handoff));
      setCopiedId(handoff.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard blocked in headless browser; ignore silently
    }
  }

  function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!slug.trim() || !problem.trim() || !requiredChange.trim() || !expectedTest.trim()) {
      setFormError('Preencha slug, problema, alteração necessária e teste esperado.');
      return;
    }

    const newHandoff: Handoff = {
      id: `hoff-${Date.now().toString(36)}`,
      repoId,
      waveNumber,
      slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
      fromAgentId,
      toAgentId,
      status: 'aberto',
      priority,
      blockerRef,
      targetSprint: targetSprint.trim() || `Onda ${waveNumber}`,
      problem: problem.trim(),
      filesInvolved: filesText
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean),
      evidence: evidence.trim() || 'Evidência registrada na abertura do handoff.',
      requiredChange: requiredChange.trim(),
      expectedTest: expectedTest.trim(),
      additionalContext: additionalContext.trim(),
      createdAt: new Date().toISOString(),
    };

    onCreateHandoff(newHandoff);
    setSelectedId(newHandoff.id);
    setShowCreateModal(false);
    setSlug('');
    setProblem('');
    setFilesText('');
    setEvidence('');
    setRequiredChange('');
    setExpectedTest('');
    setAdditionalContext('');
  }

  function handleResolveSubmit(e: FormEvent, handoff: Handoff) {
    e.preventDefault();
    setResolutionError(null);
    if (!resolutionSummary.trim() || !resolutionEvidence.trim()) {
      setResolutionError('Descreva a resolução e a evidência verificável antes de concluir (§18).');
      return;
    }

    onUpdateHandoff({
      ...handoff,
      status: 'resolvido',
      resolution: {
        resolvedBy: resolutionBy || handoff.toAgentId,
        resolvedAt: new Date().toISOString(),
        summary: resolutionSummary.trim(),
        evidence: resolutionEvidence.trim(),
        verifiedByAgent24: resolutionVerified24,
      },
    });

    setResolutionSummary('');
    setResolutionEvidence('');
    setResolutionVerified24(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-400 mb-1">SEC-HND · Rastreabilidade</div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-paper-100">
            Central de Handoffs
          </h2>
          <p className="text-sm text-paper-400 mt-1 max-w-2xl">
            Comunicação formal entre domínios em <span className="font-mono text-paper-300">.agents/handoffs/onda-&lt;n&gt;/</span>. O destinatário atualiza o status sem apagar o pedido original.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Handoff</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md" role="tablist">
            {(['all', 'aberto', 'em-andamento', 'resolvido'] as const).map((st) => (
              <button
                key={st}
                type="button"
                role="tab"
                aria-selected={statusFilter === st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  statusFilter === st ? 'bg-white text-slate-900' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'all' ? 'Todos' : st}
              </button>
            ))}
          </div>

          <label htmlFor="handoff-priority-filter" className="sr-only">
            Filtrar por prioridade
          </label>
          <select
            id="handoff-priority-filter"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as 'all' | HandoffPriority)}
            className="h-9 px-3 text-xs font-medium panel text-slate-700"
          >
            <option value="all">Todas as prioridades</option>
            <option value="bloqueador">Bloqueador</option>
            <option value="alto">Alto</option>
            <option value="normal">Normal</option>
          </select>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <label htmlFor="handoff-search" className="sr-only">
            Buscar handoffs
          </label>
          <input
            id="handoff-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar slug, agente ou ref..."
            className="h-9 pl-9 pr-3 text-sm panel w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-sm font-medium text-slate-900">Nenhum handoff encontrado para os filtros aplicados.</p>
          <p className="text-xs text-slate-500 mt-1">
            Crie um novo handoff sempre que um problema pertencer a outro domínio ou exigir alteração em arquivo exclusivo (§16).
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="mt-4 h-9 px-4 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md"
          >
            Abrir Primeiro Handoff
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* List */}
          <div className="xl:col-span-5 panel divide-y divide-slate-200">
            {filtered.map((h) => {
              const isSelected = selectedHandoff?.id === h.id;
              const fromAgent = getAgentById(h.fromAgentId);
              const toAgent = getAgentById(h.toAgentId);
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setSelectedId(h.id)}
                  className={`w-full text-left p-4 transition-colors block ${
                    isSelected ? 'bg-slate-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-slate-900 min-w-0 truncate">
                      {fromAgent && <AgentAvatar agent={fromAgent} size="sm" />}
                      <span>
                        {h.fromAgentId} {fromAgent?.persona.codename} → {h.toAgentId}{' '}
                        {toAgent?.persona.codename}
                      </span>
                      <span className="text-slate-400 font-normal ml-1">Onda {h.waveNumber}</span>
                    </span>
                    <span
                      className={`font-medium ${
                        h.priority === 'bloqueador'
                          ? 'text-red-700'
                          : h.priority === 'alto'
                            ? 'text-amber-700'
                            : 'text-slate-600'
                      }`}
                    >
                      {h.priority.toUpperCase()}
                    </span>
                  </div>

                  <div className="text-sm font-medium text-slate-900 mt-1 truncate">
                    {h.slug}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">{h.problem}</p>

                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                    <span className="inline-flex items-center gap-1">
                      {h.status === 'resolvido' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : h.status === 'em-andamento' ? (
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                      )}
                      <span className="font-medium text-slate-700">{h.status}</span>
                    </span>
                    {h.blockerRef && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{h.blockerRef}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{h.targetSprint}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail Inspector */}
          {selectedHandoff && (
            <div className="xl:col-span-7 panel p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-200">
                <div className="flex items-start gap-3 min-w-0">
                  {getAgentById(selectedHandoff.toAgentId) && (
                    <AgentAvatar agent={getAgentById(selectedHandoff.toAgentId)!} size="md" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-slate-500 break-all">
                      {formatHandoffFileName(selectedHandoff)}
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mt-1">
                      {selectedHandoff.fromAgentId} · {getAgentById(selectedHandoff.fromAgentId)?.persona.codename}{' '}
                      ({getAgentById(selectedHandoff.fromAgentId)?.name}) →{' '}
                      {selectedHandoff.toAgentId} · {getAgentById(selectedHandoff.toAgentId)?.persona.codename}{' '}
                      ({getAgentById(selectedHandoff.toAgentId)?.name})
                    </h3>
                    <div className="text-xs text-slate-500 mt-1">
                      Status: <span className="font-semibold text-slate-800">{selectedHandoff.status}</span> · Prioridade:{' '}
                      <span className="font-semibold text-slate-800">{selectedHandoff.priority}</span> · Ref:{' '}
                      <span className="font-mono">{selectedHandoff.blockerRef || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {onActivateBot && (
                    <button
                      type="button"
                      onClick={() => onActivateBot(selectedHandoff.toAgentId)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>
                        Acionar {getAgentById(selectedHandoff.toAgentId)?.persona.codename ?? selectedHandoff.toAgentId}
                      </span>
                    </button>
                  )}
                  {selectedHandoff.status === 'aberto' && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateHandoff({ ...selectedHandoff, status: 'em-andamento' })
                      }
                      className="h-8 px-3 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap"
                    >
                      Assumir (em-andamento)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCopyMarkdown(selectedHandoff)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap"
                  >
                    {copiedId === selectedHandoff.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Markdown copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar .md</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-xs font-semibold text-slate-700">Problema</div>
                  <p className="text-slate-700 mt-1">{selectedHandoff.problem}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-semibold text-slate-700">Arquivo(s) envolvido(s)</div>
                    <ul className="mt-1 space-y-0.5 font-mono text-xs text-slate-600">
                      {selectedHandoff.filesInvolved.length > 0 ? (
                        selectedHandoff.filesInvolved.map((f) => <li key={f}>{f}</li>)
                      ) : (
                        <li>Não especificado</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-700">Evidência</div>
                    <p className="text-xs text-slate-600 mt-1">{selectedHandoff.evidence}</p>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-700">Alteração necessária</div>
                  <p className="text-slate-700 mt-1">{selectedHandoff.requiredChange}</p>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-700">Teste esperado</div>
                  <p className="text-slate-700 mt-1">{selectedHandoff.expectedTest}</p>
                </div>

                {selectedHandoff.additionalContext && (
                  <div>
                    <div className="text-xs font-semibold text-slate-700">Contexto adicional</div>
                    <p className="text-xs text-slate-600 mt-1">{selectedHandoff.additionalContext}</p>
                  </div>
                )}
              </div>

              {/* Resolution Section (Append-only per §18 & §40) */}
              <div className="pt-4 border-t border-slate-200">
                {selectedHandoff.resolution ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">
                        Resolução Registrada (Agente {selectedHandoff.resolution.resolvedBy})
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          selectedHandoff.resolution.verifiedByAgent24
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {selectedHandoff.resolution.verifiedByAgent24
                          ? 'Validado pelo Agente 24 (§40)'
                          : 'Aguardando parecer do Agente 24 (§40)'}
                      </span>
                    </div>
                    <p className="text-slate-700 text-xs">{selectedHandoff.resolution.summary}</p>
                    <div className="text-xs text-slate-600 font-mono">
                      Evidência: {selectedHandoff.resolution.evidence}
                    </div>
                    {!selectedHandoff.resolution.verifiedByAgent24 && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateHandoff({
                            ...selectedHandoff,
                            resolution: {
                              ...selectedHandoff.resolution!,
                              verifiedByAgent24: true,
                            },
                          })
                        }
                        className="mt-2 h-8 px-3 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                      >
                        Confirmar Validação do Agente 24
                      </button>
                    )}
                  </div>
                ) : (
                  <form onSubmit={(e) => handleResolveSubmit(e, selectedHandoff)} className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <span>Adicionar Seção de Resolução (preserva pedido original §18)</span>
                    </div>

                    {resolutionError && (
                      <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                        {resolutionError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="res-agent" className="block text-xs font-medium text-slate-600 mb-1">
                          Agente executor
                        </label>
                        <select
                          id="res-agent"
                          value={resolutionBy || selectedHandoff.toAgentId}
                          onChange={(e) => setResolutionBy(e.target.value)}
                          className="w-full h-9 px-2.5 text-xs border border-slate-300 rounded-md bg-white"
                        >
                          {OFFICIAL_AGENTS.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.id} — {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="res-evidence" className="block text-xs font-medium text-slate-600 mb-1">
                          Evidência / comando executado
                        </label>
                        <input
                          id="res-evidence"
                          type="text"
                          value={resolutionEvidence}
                          onChange={(e) => setResolutionEvidence(e.target.value)}
                          placeholder="ex: npm run test:unit (12/12 PASS)"
                          className="w-full h-9 px-3 text-xs font-mono border border-slate-300 rounded-md"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="res-summary" className="block text-xs font-medium text-slate-600 mb-1">
                        Resumo da resolução
                      </label>
                      <textarea
                        id="res-summary"
                        rows={2}
                        value={resolutionSummary}
                        onChange={(e) => setResolutionSummary(e.target.value)}
                        placeholder="Descreva a correção aplicada..."
                        className="w-full p-2.5 text-xs border border-slate-300 rounded-md"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={resolutionVerified24}
                          onChange={(e) => setResolutionVerified24(e.target.checked)}
                          className="rounded border-slate-300"
                        />
                        <span>Já possui parecer APROVADO do Agente 24 (§40)</span>
                      </label>

                      <button
                        type="submit"
                        className="h-9 px-4 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md whitespace-nowrap"
                      >
                        Registrar Resolução
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Handoff Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-handoff-title"
        >
          <div className="w-full max-w-2xl panel overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 id="create-handoff-title" className="text-base font-semibold text-slate-900">
                Abrir Novo Handoff (§18)
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Fechar janela de novo handoff"
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="hoff-from" className="block text-xs font-medium text-slate-700 mb-1">
                    De (Agente origem)
                  </label>
                  <select
                    id="hoff-from"
                    value={fromAgentId}
                    onChange={(e) => setFromAgentId(e.target.value)}
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
                  <label htmlFor="hoff-to" className="block text-xs font-medium text-slate-700 mb-1">
                    Para (Agente destino)
                  </label>
                  <select
                    id="hoff-to"
                    value={toAgentId}
                    onChange={(e) => setToAgentId(e.target.value)}
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
                  <label htmlFor="hoff-wave" className="block text-xs font-medium text-slate-700 mb-1">
                    Onda
                  </label>
                  <input
                    id="hoff-wave"
                    type="number"
                    min={1}
                    value={waveNumber}
                    onChange={(e) => setWaveNumber(Number(e.target.value) || 1)}
                    className="w-full h-9 px-3 text-xs border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="hoff-slug" className="block text-xs font-medium text-slate-700 mb-1">
                    Slug do arquivo
                  </label>
                  <input
                    id="hoff-slug"
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="ex: schema-bitrix-tenant"
                    className="w-full h-9 px-3 text-xs font-mono border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="hoff-priority" className="block text-xs font-medium text-slate-700 mb-1">
                    Prioridade
                  </label>
                  <select
                    id="hoff-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as HandoffPriority)}
                    className="w-full h-9 px-2.5 text-xs border border-slate-300 rounded-md bg-white"
                  >
                    <option value="bloqueador">bloqueador</option>
                    <option value="alto">alto</option>
                    <option value="normal">normal</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="hoff-blocker" className="block text-xs font-medium text-slate-700 mb-1">
                    Bloqueador-ref
                  </label>
                  <select
                    id="hoff-blocker"
                    value={blockerRef}
                    onChange={(e) => setBlockerRef(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs border border-slate-300 rounded-md bg-white"
                  >
                    <option value="">Sem bloqueador B-01..B-14</option>
                    {DEFAULT_PRIORITY_BLOCKERS.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.code} — {b.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="hoff-problem" className="block text-xs font-medium text-slate-700 mb-1">
                  Problema
                </label>
                <textarea
                  id="hoff-problem"
                  rows={2}
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  placeholder="Descreva a causa raiz ou bloqueio identificado fora da sua propriedade..."
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="hoff-files" className="block text-xs font-medium text-slate-700 mb-1">
                    Arquivo(s) envolvido(s) (1 por linha)
                  </label>
                  <textarea
                    id="hoff-files"
                    rows={2}
                    value={filesText}
                    onChange={(e) => setFilesText(e.target.value)}
                    placeholder="prisma/schema.prisma"
                    className="w-full p-2.5 text-xs font-mono border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="hoff-evidence" className="block text-xs font-medium text-slate-700 mb-1">
                    Evidência
                  </label>
                  <textarea
                    id="hoff-evidence"
                    rows={2}
                    value={evidence}
                    onChange={(e) => setEvidence(e.target.value)}
                    placeholder="Stacktrace, teste falhando ou diff observado..."
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="hoff-change" className="block text-xs font-medium text-slate-700 mb-1">
                    Alteração necessária
                  </label>
                  <textarea
                    id="hoff-change"
                    rows={2}
                    value={requiredChange}
                    onChange={(e) => setRequiredChange(e.target.value)}
                    placeholder="O que o agente destino precisa alterar..."
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="hoff-test" className="block text-xs font-medium text-slate-700 mb-1">
                    Teste esperado
                  </label>
                  <textarea
                    id="hoff-test"
                    rows={2}
                    value={expectedTest}
                    onChange={(e) => setExpectedTest(e.target.value)}
                    placeholder="Comando ou cenário de validação..."
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="hoff-sprint" className="block text-xs font-medium text-slate-700 mb-1">
                    Sprint destino
                  </label>
                  <input
                    id="hoff-sprint"
                    type="text"
                    value={targetSprint}
                    onChange={(e) => setTargetSprint(e.target.value)}
                    className="w-full h-9 px-3 text-xs border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="hoff-context" className="block text-xs font-medium text-slate-700 mb-1">
                    Contexto adicional
                  </label>
                  <input
                    id="hoff-context"
                    type="text"
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    className="w-full h-9 px-3 text-xs border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="h-9 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                >
                  Criar Handoff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
