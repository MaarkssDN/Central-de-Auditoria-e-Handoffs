import { getCentralState } from './centralStore';
import { readExecutions } from './centralExecutions';

export interface CentralMetrics {
  generatedAt: string;
  totals: { handoffs: number; byStatus: Record<string, number> };
  waves: {
    name: string;
    handoffs: number;
    byStatus: Record<string, number>;
    concluidoPct: number;
    reprovacao24Pct: number | null;
  }[];
  quality: {
    concluidos: number;
    reprovados24: number;
    aguardando24: number;
    bloqueados: number;
    reprovacao24Pct: number | null;
    blockedByDecision: number;
  };
  leadTime: {
    avgDispatchToReviewMs: number | null;
    avgDispatchToDoneMs: number | null;
    samples: number;
  };
  executions: {
    total: number;
    active: number;
    byProvider: Record<string, { count: number; avgDurationMs: number | null; failures: number }>;
    prs: number;
  };
}

export function getCentralMetrics(): CentralMetrics {
  const state = getCentralState();
  const executions = readExecutions({ days: 90 });

  const byStatus: Record<string, number> = {};
  for (const h of state.handoffs) byStatus[h.status] = (byStatus[h.status] || 0) + 1;

  // taxa de reprovação 24 e bloqueio por decisão
  let concluidos = 0, reprovados = 0, aguardando = 0, bloqueados = 0, blockedByDecision = 0;
  for (const h of state.handoffs) {
    if (h.status === 'CONCLUÍDO') concluidos++;
    else if (h.status === 'REPROVADO_24') reprovados++;
    else if (h.status === 'AGUARDANDO_24') aguardando++;
    else if (h.status === 'BLOQUEADO') {
      bloqueados++;
      if (/D-\d+|decis[aã]o/i.test(`${h.problema} ${h.resolucao}`)) blockedByDecision++;
    }
  }
  const reviewTotal = concluidos + reprovados;
  const reprovacao24Pct = reviewTotal > 0 ? (reprovados / reviewTotal) * 100 : null;

  const waves = state.waves.map((w) => {
    const hs = state.handoffs.filter((h) => h.file.startsWith(`ondas/${w.name}/`));
    const c = hs.filter((h) => h.status === 'CONCLUÍDO').length;
    const r = hs.filter((h) => h.status === 'REPROVADO_24').length;
    const rt = c + r;
    return {
      name: w.name,
      handoffs: w.handoffs,
      byStatus: w.byStatus,
      concluidoPct: w.handoffs ? Math.round((c / w.handoffs) * 100) : 0,
      reprovacao24Pct: rt > 0 ? Math.round((r / rt) * 1000) / 10 : null,
    };
  });

  // lead time: dispatch → primeiro complete/fail/review por handoff
  const dispatchTs = new Map<string, number>();
  const reviewTs = new Map<string, number>();
  const doneTs = new Map<string, number>();
  for (const e of executions) {
    const t = Date.parse(e.ts);
    if (!Number.isFinite(t)) continue;
    if (e.action === 'dispatch' && !dispatchTs.has(e.handoff)) dispatchTs.set(e.handoff, t);
    if (e.action === 'review' && !reviewTs.has(e.handoff)) reviewTs.set(e.handoff, t);
    if ((e.action === 'complete' || e.action === 'fail') && !doneTs.has(e.handoff)) doneTs.set(e.handoff, t);
  }
  const avg = (pairs: [number, number][]) =>
    pairs.length ? Math.round(pairs.reduce((a, [s, e]) => a + (e - s), 0) / pairs.length) : null;
  const toReview: [number, number][] = [];
  const toDone: [number, number][] = [];
  for (const [h, d] of dispatchTs) {
    const r = reviewTs.get(h);
    if (r && r > d) toReview.push([d, r]);
    const dn = doneTs.get(h);
    if (dn && dn > d) toDone.push([d, dn]);
  }

  // execuções por provider
  const byProvider: CentralMetrics['executions']['byProvider'] = {};
  const startedIds = new Set<string>();
  const finishedIds = new Set<string>();
  for (const e of executions) {
    if (e.action === 'dispatch') startedIds.add(e.execId);
    if (['complete', 'fail', 'review'].includes(e.action)) finishedIds.add(e.execId);
    const p = e.provider || 'desconhecido';
    const slot = (byProvider[p] ||= { count: 0, avgDurationMs: null, failures: 0 });
    slot.count++;
    if (e.action === 'fail') slot.failures++;
    if (typeof e.durationMs === 'number' && e.durationMs > 0) {
      // média incremental simples
      const n = slot.count;
      slot.avgDurationMs = slot.avgDurationMs == null
        ? e.durationMs
        : Math.round((slot.avgDurationMs * (n - 1) + e.durationMs) / n);
    }
  }
  const active = [...startedIds].filter((id) => !finishedIds.has(id)).length;
  const prs = executions.filter((e) => e.action === 'pr_created' || e.prUrl).length;

  return {
    generatedAt: new Date().toISOString(),
    totals: { handoffs: state.handoffs.length, byStatus },
    waves,
    quality: {
      concluidos, reprovados24: reprovados, aguardando24: aguardando, bloqueados,
      reprovacao24Pct: reprovacao24Pct == null ? null : Math.round(reprovacao24Pct * 10) / 10,
      blockedByDecision,
    },
    leadTime: {
      avgDispatchToReviewMs: avg(toReview),
      avgDispatchToDoneMs: avg(toDone),
      samples: Math.max(toReview.length, toDone.length),
    },
    executions: { total: executions.length, active, byProvider, prs },
  };
}
