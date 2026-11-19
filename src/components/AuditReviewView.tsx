import { useState, type FormEvent } from 'react';
import {
  AlertOctagon,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  Plus,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { OFFICIAL_AGENTS } from '../data/agentsRoster';
import { AgentAvatar } from './AgentAvatar';
import type {
  BlockerRecord,
  BlockerStatus,
  GateCheck,
  GateStatus,
  IndependentReview,
  Mission,
  RepositoryTarget,
  ReviewVerdict,
  Wave,
} from '../types/governance';
import { formatReviewMarkdown, getAgentById } from '../utils/governanceEngine';

interface AuditReviewViewProps {
  activeRepo?: RepositoryTarget;
  activeWave?: Wave;
  missions: Mission[];
  reviews: IndependentReview[];
  onCreateReview: (review: IndependentReview) => void;
  onUpdateGateStatus: (waveId: string, gateId: string, status: GateStatus, notes?: string) => void;
  onUpdateBlockerStatus: (repoId: string, code: string, status: BlockerStatus, evidenceNote?: string) => void;
  onActivateBot?: (agentId: string) => void;
}

export function AuditReviewView({
  activeRepo,
  activeWave,
  missions,
  reviews,
  onCreateReview,
  onUpdateGateStatus,
  onUpdateBlockerStatus,
  onActivateBot,
}: AuditReviewViewProps) {
  const [subTab, setSubTab] = useState<'pareceres' | 'gates' | 'bloqueadores'>('pareceres');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Review modal state
  const [missionId, setMissionId] = useState(missions[0]?.id ?? '');
  const [authorAgentId, setAuthorAgentId] = useState(missions[0]?.agentId ?? '01');
  const [commitOrHashes, setCommitOrHashes] = useState('');
  const [scopeSummary, setScopeSummary] = useState('');
  const [commandsText, setCommandsText] = useState('npx tsc --noEmit -> PASS\nnpm run lint -> PASS');
  const [evidence, setEvidence] = useState('');
  const [findingsText, setFindingsText] = useState('');
  const [pendingText, setPendingText] = useState('');
  const [p1ToP4Compliant, setP1ToP4Compliant] = useState(true);
  const [ownershipCompliant, setOwnershipCompliant] = useState(true);
  const [tenancyLgpdChecked, setTenancyLgpdChecked] = useState(true);
  const [verdict, setVerdict] = useState<ReviewVerdict>('APROVADO');
  const [formError, setFormError] = useState<string | null>(null);

  if (!activeRepo) {
    return (
      <div className="panel p-10 text-center text-sm text-slate-500">
        Selecione ou conecte um repositório para iniciar a auditoria.
      </div>
    );
  }

  async function handleCopyReview(rev: IndependentReview) {
    try {
      await navigator.clipboard.writeText(formatReviewMarkdown(rev));
      setCopiedId(rev.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard error
    }
  }

  function handleMissionSelection(nextMissionId: string) {
    setMissionId(nextMissionId);
    const found = missions.find((m) => m.id === nextMissionId);
    if (found) {
      setAuthorAgentId(found.agentId);
      setScopeSummary(found.objective);
    }
  }

  function handleReviewSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!activeRepo) return;

    if (authorAgentId === '24') {
      setFormError('Violação §40: o autor nunca pode aprovar a própria entrega.');
      return;
    }

    if (!commitOrHashes.trim() || !evidence.trim()) {
      setFormError('Informe o commit/hashes auditados e a evidência observada (§40).');
      return;
    }

    if (verdict === 'APROVADO' && (!p1ToP4Compliant || !ownershipCompliant || !tenancyLgpdChecked)) {
      setFormError(
        'Para emitir parecer APROVADO, P1-P4, Propriedade e Tenancy/LGPD devem estar verificados (§32 e §40).'
      );
      return;
    }

    const selectedMission = missions.find((m) => m.id === missionId);
    const parsedCommands = commandsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('->');
        return {
          command: parts[0]?.trim() || line,
          result: parts[1]?.trim() || 'EXECUTADO',
        };
      });

    const newReview: IndependentReview = {
      id: `rev-${Date.now().toString(36)}`,
      repoId: activeRepo.id,
      waveNumber: activeWave?.number ?? 1,
      missionId: selectedMission?.id || 'manual',
      missionTitle: selectedMission?.title || scopeSummary.trim() || 'Revisão de entrega',
      authorAgentId,
      auditorAgentId: '24',
      baseBranch: activeWave?.integrationBranch || activeRepo.defaultBranch,
      commitOrHashes: commitOrHashes.trim(),
      scopeSummary: scopeSummary.trim() || selectedMission?.objective || 'Escopo auditado',
      criteriaChecked: [
        'Escopo e contrato de aceite (§41)',
        'Sem segredos no diff acumulado (§24)',
        'Verdade operacional verificada (§30)',
      ],
      commandsExecuted: parsedCommands,
      evidence: evidence.trim(),
      findings: findingsText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
      pendingItems: pendingText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
      p1ToP4Compliant,
      tenancyLgpdChecked,
      ownershipCompliant,
      verdict,
      createdAt: new Date().toISOString(),
    };

    onCreateReview(newReview);
    setShowReviewModal(false);
    setCommitOrHashes('');
    setEvidence('');
    setFindingsText('');
    setPendingText('');
  }

  const approvedCount = reviews.filter((r) => r.verdict === 'APROVADO').length;
  const rejectedCount = reviews.filter((r) => r.verdict !== 'APROVADO').length;
  const openBlockersCount = activeRepo.blockers.filter((b) => b.status === 'aberto').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-400 mb-1">SEC-AUD · Revisão Independente</div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-paper-100">
            Auditoria e Gates
          </h2>
          <p className="text-sm text-paper-400 mt-1 max-w-2xl">
            Pareceres oficiais do Agente 24 em <span className="font-mono text-paper-300">.agents/reviews/</span>, matriz de gates reais e bloqueadores B-01..B-14.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onActivateBot && (
            <button
              type="button"
              onClick={() => onActivateBot('24')}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap"
            >
              <Bot className="w-4 h-4" />
              <span>Auditar com Veredito (24)</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (missions[0]) {
                setMissionId(missions[0].id);
                setAuthorAgentId(missions[0].agentId);
                setScopeSummary(missions[0].objective);
              }
              setShowReviewModal(true);
            }}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Emitir Parecer 24</span>
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="panel p-4">
          <div className="text-xs text-slate-500">Pareceres APROVADOS</div>
          <div className="text-2xl font-semibold text-emerald-700 font-mono tabular-nums mt-1">
            {approvedCount}
          </div>
        </div>
        <div className="panel p-4">
          <div className="text-xs text-slate-500">Reprovados / Bloqueados</div>
          <div className="text-2xl font-semibold text-red-700 font-mono tabular-nums mt-1">
            {rejectedCount}
          </div>
        </div>
        <div className="panel p-4">
          <div className="text-xs text-slate-500">Bloqueadores B-01..B-14 Abertos</div>
          <div className="text-2xl font-semibold text-slate-900 font-mono tabular-nums mt-1">
            {openBlockersCount}
          </div>
        </div>
        <div className="panel p-4">
          <div className="text-xs text-slate-500">Gates Executados Verdes</div>
          <div className="text-2xl font-semibold text-slate-900 font-mono tabular-nums mt-1">
            {activeWave
              ? `${activeWave.gates.filter((g) => g.status === 'EXECUTADO_VERDE').length}/${activeWave.gates.length}`
              : '0/0'}
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="inline-flex p-1 bg-slate-100 rounded-md" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'pareceres'}
          onClick={() => setSubTab('pareceres')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors ${
            subTab === 'pareceres' ? 'bg-white text-slate-900' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Pareceres do Agente 24 ({reviews.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'gates'}
          onClick={() => setSubTab('gates')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors ${
            subTab === 'gates' ? 'bg-white text-slate-900' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Gates Obrigatórios (§28 / §29)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'bloqueadores'}
          onClick={() => setSubTab('bloqueadores')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors ${
            subTab === 'bloqueadores' ? 'bg-white text-slate-900' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Bloqueadores B-01..B-14
        </button>
      </div>

      {/* Tab 1: Independent Reviews */}
      {subTab === 'pareceres' && (
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <div className="panel p-10 text-center">
              <p className="text-sm font-medium text-slate-900">
                Nenhum parecer independente emitido para este repositório.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                O Agente 24 deve emitir parecer APROVADO antes de fechar handoffs ou liberar release (§40).
              </p>
            </div>
          ) : (
            reviews.map((rev) => {
              const authorAgent = getAgentById(rev.authorAgentId);
              const auditorAgent = getAgentById(rev.auditorAgentId);
              return (
              <article key={rev.id} className="panel p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {auditorAgent && <AgentAvatar agent={auditorAgent} size="md" />}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono">Onda {rev.waveNumber}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Autor: {rev.authorAgentId} {authorAgent?.persona.codename} ({authorAgent?.name})
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Auditor: {rev.auditorAgentId} {auditorAgent?.persona.codename}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">Hash: {rev.commitOrHashes}</span>
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 mt-1">
                        {rev.missionTitle}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                        rev.verdict === 'APROVADO'
                          ? 'text-emerald-700'
                          : rev.verdict === 'BLOQUEADO'
                            ? 'text-amber-700'
                            : 'text-red-700'
                      }`}
                    >
                      {rev.verdict === 'APROVADO' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : rev.verdict === 'BLOQUEADO' ? (
                        <AlertOctagon className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      {rev.verdict}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleCopyReview(rev)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md"
                    >
                      {copiedId === rev.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Parecer .md</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-3 border-t border-slate-100">
                  <div>
                    <div className="font-semibold text-slate-700 mb-1">Evidência verificada</div>
                    <p className="text-slate-600">{rev.evidence}</p>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-700 mb-1">Comandos executados</div>
                    <ul className="space-y-0.5 font-mono text-slate-600">
                      {rev.commandsExecuted.map((c, idx) => (
                        <li key={idx}>
                          {c.command} → {c.result}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-700 mb-1">Achados e Pendências</div>
                    {rev.findings.length === 0 && rev.pendingItems.length === 0 ? (
                      <p className="text-slate-500">Sem achados bloqueantes ou pendências.</p>
                    ) : (
                      <ul className="space-y-1 text-red-700">
                        {rev.findings.map((f, i) => (
                          <li key={`f-${i}`}>• {f}</li>
                        ))}
                        {rev.pendingItems.map((p, i) => (
                          <li key={`p-${i}`} className="text-amber-700">
                            • Pendente: {p}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </article>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Gates Matrix */}
      {subTab === 'gates' && activeWave && (
        <div className="panel overflow-x-auto">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Matriz de Gates — {activeWave.name}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Scripts ausentes no package.json do repositório permanecem como NAO_APLICAVEL (§29).
              </p>
            </div>
          </div>

          <table className="w-full text-left border-collapse min-w-[680px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                <th className="py-3 px-4">Comando</th>
                <th className="py-3 px-4">Camada</th>
                <th className="py-3 px-4">Status Real (§30)</th>
                <th className="py-3 px-4">Observação</th>
                <th className="py-3 px-4 text-right">Registrar Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {activeWave.gates.map((gate: GateCheck) => (
                <tr key={gate.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-medium text-slate-900">{gate.command}</td>
                  <td className="py-3 px-4 text-slate-600 capitalize">{gate.tier}</td>
                  <td className="py-3 px-4 font-medium">
                    <span
                      className={
                        gate.status === 'EXECUTADO_VERDE'
                          ? 'text-emerald-700'
                          : gate.status === 'FALHOU'
                            ? 'text-red-700'
                            : gate.status === 'NAO_APLICAVEL'
                              ? 'text-slate-400'
                              : 'text-amber-700'
                      }
                    >
                      {gate.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 max-w-sm">
                    {gate.notes || 'Pronto para registro de execução.'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {gate.status === 'NAO_APLICAVEL' ? (
                      <span className="text-slate-400">Script ausente</span>
                    ) : (
                      <select
                        aria-label={`Status do gate ${gate.command}`}
                        value={gate.status}
                        onChange={(e) =>
                          onUpdateGateStatus(
                            activeWave.id,
                            gate.id,
                            e.target.value as GateStatus
                          )
                        }
                        className="h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-800"
                      >
                        <option value="NAO_EXECUTADO">NAO_EXECUTADO</option>
                        <option value="EXECUTADO_VERDE">EXECUTADO_VERDE</option>
                        <option value="FALHOU">FALHOU</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Priority Blockers B-01..B-14 */}
      {subTab === 'bloqueadores' && (
        <div className="panel overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[680px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                <th className="py-3 px-4 w-20">Código</th>
                <th className="py-3 px-4">Risco / Bloqueador Prioritário (§22)</th>
                <th className="py-3 px-4">Dono</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Atualizar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {activeRepo.blockers.map((blocker: BlockerRecord) => (
                <tr key={blocker.code} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                    {blocker.code}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{blocker.title}</div>
                    <div className="text-slate-500 mt-0.5">{blocker.description}</div>
                    {blocker.evidenceNote && (
                      <div className="text-slate-600 mt-1 font-mono">{blocker.evidenceNote}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                    {(() => {
                      const owner = getAgentById(blocker.ownerAgentId);
                      return (
                        <div className="flex items-center gap-2">
                          {owner && <AgentAvatar agent={owner} size="sm" />}
                          <span>
                            {blocker.ownerAgentId} · {owner?.persona.codename ?? `Agente ${blocker.ownerAgentId}`}
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-3 px-4 font-medium whitespace-nowrap">
                    <span
                      className={
                        blocker.status === 'validado'
                          ? 'text-emerald-700'
                          : blocker.status === 'mitigado'
                            ? 'text-amber-700'
                            : blocker.status === 'nao_aplicavel'
                              ? 'text-slate-400'
                              : 'text-red-700'
                      }
                    >
                      {blocker.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <select
                      aria-label={`Status do bloqueador ${blocker.code}`}
                      value={blocker.status}
                      onChange={(e) =>
                        onUpdateBlockerStatus(
                          activeRepo.id,
                          blocker.code,
                          e.target.value as BlockerStatus
                        )
                      }
                      className="h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-800"
                    >
                      <option value="aberto">aberto</option>
                      <option value="mitigado">mitigado</option>
                      <option value="validado">validado</option>
                      <option value="nao_aplicavel">nao_aplicavel</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Issue Review 24 Modal */}
      {showReviewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-modal-title"
        >
          <div className="w-full max-w-2xl panel overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-slate-800" />
                <h2 id="review-modal-title" className="text-base font-semibold text-slate-900">
                  Emitir Parecer Independente — Agente 24 (§40)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                aria-label="Fechar janela de parecer"
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="rev-mission" className="block text-xs font-medium text-slate-700 mb-1">
                    Missão auditada
                  </label>
                  <select
                    id="rev-mission"
                    value={missionId}
                    onChange={(e) => handleMissionSelection(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs border border-slate-300 rounded-md bg-white"
                  >
                    {missions.map((m) => (
                      <option key={m.id} value={m.id}>
                        Agente {m.agentId} — {m.title}
                      </option>
                    ))}
                    <option value="manual">Auditoria avulsa / documentação</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="rev-author" className="block text-xs font-medium text-slate-700 mb-1">
                    Agente autor da entrega
                  </label>
                  <select
                    id="rev-author"
                    value={authorAgentId}
                    onChange={(e) => setAuthorAgentId(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs border border-slate-300 rounded-md bg-white"
                  >
                    {OFFICIAL_AGENTS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.id} — {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="rev-hash" className="block text-xs font-medium text-slate-700 mb-1">
                    Commit / Hashes auditados
                  </label>
                  <input
                    id="rev-hash"
                    type="text"
                    value={commitOrHashes}
                    onChange={(e) => setCommitOrHashes(e.target.value)}
                    placeholder="ex: 4e8d21a"
                    className="w-full h-9 px-3 text-xs font-mono border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="rev-verdict" className="block text-xs font-medium text-slate-700 mb-1">
                    Decisão oficial
                  </label>
                  <select
                    id="rev-verdict"
                    value={verdict}
                    onChange={(e) => setVerdict(e.target.value as ReviewVerdict)}
                    className="w-full h-9 px-2.5 text-xs font-semibold border border-slate-300 rounded-md bg-white"
                  >
                    <option value="APROVADO">APROVADO</option>
                    <option value="REPROVADO">REPROVADO</option>
                    <option value="BLOQUEADO">BLOQUEADO</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="rev-scope" className="block text-xs font-medium text-slate-700 mb-1">
                  Escopo auditado
                </label>
                <input
                  id="rev-scope"
                  type="text"
                  value={scopeSummary}
                  onChange={(e) => setScopeSummary(e.target.value)}
                  className="w-full h-9 px-3 text-xs border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label htmlFor="rev-cmds" className="block text-xs font-medium text-slate-700 mb-1">
                  Comandos e resultados (1 por linha: comando -&gt; resultado)
                </label>
                <textarea
                  id="rev-cmds"
                  rows={2}
                  value={commandsText}
                  onChange={(e) => setCommandsText(e.target.value)}
                  className="w-full p-2.5 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label htmlFor="rev-evidence" className="block text-xs font-medium text-slate-700 mb-1">
                  Evidências verificadas
                </label>
                <textarea
                  id="rev-evidence"
                  rows={2}
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="Descreva os diffs, logs e evidências reais observadas..."
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="rev-findings" className="block text-xs font-medium text-slate-700 mb-1">
                    Achados (1 por linha)
                  </label>
                  <textarea
                    id="rev-findings"
                    rows={2}
                    value={findingsText}
                    onChange={(e) => setFindingsText(e.target.value)}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="rev-pending" className="block text-xs font-medium text-slate-700 mb-1">
                    Pendências (1 por linha)
                  </label>
                  <textarea
                    id="rev-pending"
                    rows={2}
                    value={pendingText}
                    onChange={(e) => setPendingText(e.target.value)}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={p1ToP4Compliant}
                    onChange={(e) => setP1ToP4Compliant(e.target.checked)}
                  />
                  <span>Conformidade com P1–P4 (alterações cirúrgicas e critérios verificáveis)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ownershipCompliant}
                    onChange={(e) => setOwnershipCompliant(e.target.checked)}
                  />
                  <span>Propriedade exclusiva de arquivos respeitada (§15 e §36)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tenancyLgpdChecked}
                    onChange={(e) => setTenancyLgpdChecked(e.target.checked)}
                  />
                  <span>Tenancy, LGPD e segredos auditados (§24, §26, §27)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="h-9 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                >
                  Publicar Parecer 24
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
