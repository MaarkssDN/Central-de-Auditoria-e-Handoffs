import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ClipboardCopy,
  FileText,
  Loader2,
  Radio,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react';

interface Handoff {
  file: string;
  name: string;
  title: string;
  de: string;
  para: string;
  onda: string;
  status: string;
  prioridade: string;
  dependencias: string[];
  problema: string;
  correcao: string;
  aceite: string;
  resolucao: string;
  revisao24: string;
}
interface CentralDoc { file: string; name: string; size: number }
interface CentralAgent { id: string; nome: string; tipo: string; disponivel: boolean; dispatch?: string; detect?: string[]; binarios?: { cmd: string; path: string }[] }
interface CentralState {
  generatedAt: string;
  state: { veredito?: string; bloqueios?: string[]; proxima_acao?: string; waveStatus?: string };
  waves: { name: string; handoffs: number; byStatus: Record<string, number> }[];
  handoffs: Handoff[];
  audits: CentralDoc[];
  reviews: CentralDoc[];
  decisions: { id: string; title: string; body: string }[];
  agents: CentralAgent[];
}

const STATUS_META: Record<string, { tone: string; led: string; label: string }> = {
  PENDENTE: { tone: '', led: 'led-idle', label: 'Pendente' },
  EM_EXECUÇÃO: { tone: 'signal', led: 'led-warn', label: 'Em execução' },
  AGUARDANDO_24: { tone: 'amber', led: 'led-warn', label: 'Ag. revisão' },
  REPROVADO_24: { tone: 'alert', led: 'led-alert', label: 'Reprovado' },
  BLOQUEADO: { tone: 'alert', led: 'led-alert', label: 'Bloqueado' },
  CONCLUÍDO: { tone: 'ok', led: 'led-ok', label: 'Concluído' },
};
const PRIO_META: Record<string, { bar: string; text: string; label: string }> = {
  P0: { bar: 'bg-alert-500', text: 'text-alert-400', label: 'P0' },
  P1: { bar: 'bg-amberx-500', text: 'text-amberx-400', label: 'P1' },
  P2: { bar: 'bg-signal-400', text: 'text-signal-300', label: 'P2' },
  P3: { bar: 'bg-paper-500', text: 'text-paper-400', label: 'P3' },
};

type Tab = 'geral' | 'handoffs' | 'decisoes' | 'ondas' | 'docs' | 'agentes';

const TABS: { id: Tab; label: string }[] = [
  { id: 'geral', label: 'Visão Geral' },
  { id: 'handoffs', label: 'Handoffs' },
  { id: 'decisoes', label: 'Decisões' },
  { id: 'ondas', label: 'Ondas' },
  { id: 'docs', label: 'Dossiês' },
  { id: 'agentes', label: 'Agentes' },
];

export function CentralAuditView() {
  const [data, setData] = useState<CentralState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('geral');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [docContent, setDocContent] = useState<{ file: string; text: string } | null>(null);
  const [filter, setFilter] = useState({ status: '', prio: '', q: '' });
  const [dispatch, setDispatch] = useState<Record<string, { agent: string; worktree: string; open: boolean; msg?: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/central/state');
      if (!res.ok) throw new Error('Falha ao carregar central.');
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.handoffs.filter((h) =>
      (!filter.status || h.status === filter.status) &&
      (!filter.prio || h.prioridade === filter.prio) &&
      (!filter.q || h.title.toLowerCase().includes(filter.q.toLowerCase()) || h.para.toLowerCase().includes(filter.q.toLowerCase()) || h.name.toLowerCase().includes(filter.q.toLowerCase()))
    );
  }, [data, filter]);

  async function openDoc(file: string) {
    const res = await fetch(`/api/central/doc?path=${encodeURIComponent(file)}`);
    const text = res.ok ? await res.text() : 'Erro ao carregar documento.';
    setDocContent({ file, text });
  }

  async function setStatus(h: Handoff, status: string) {
    setBusy(h.file);
    try {
      await fetch('/api/central/handoffs/status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: h.file, status }),
      });
      await load();
    } finally { setBusy(null); }
  }

  async function doDispatch(h: Handoff) {
    const d = dispatch[h.file] || { agent: 'generico', worktree: '', open: true };
    setBusy(h.file);
    try {
      const res = await fetch('/api/central/dispatch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handoff: h.file, agentId: d.agent, worktree: d.worktree || undefined }),
      });
      const json = await res.json();
      setDispatch((p) => ({
        ...p,
        [h.file]: { agent: d.agent, worktree: d.worktree, open: false, msg: res.ok ? `Prompt enfileirado → ${json.promptFile}` : json.error },
      }));
      await load();
    } finally { setBusy(null); }
  }

  if (error) {
    return (
      <div className="panel panel-corner p-6 max-w-lg">
        <div className="flex items-center gap-2 text-alert-400 font-mono text-sm">
          <XCircle className="w-4 h-4" /> FALHA DE TELEMETRIA
        </div>
        <p className="text-sm text-paper-300 mt-2">{error}</p>
        <button onClick={load} className="btn mt-4">Tentar novamente</button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="panel h-24 animate-pulse" />)}
      </div>
    );
  }

  const counts = data.handoffs.reduce<Record<string, number>>((a, h) => { a[h.status] = (a[h.status] || 0) + 1; return a; }, {});
  const verdict = String(data.state.veredito || '—');
  const noGo = verdict.toUpperCase().includes('NO-GO');

  return (
    <div className="space-y-5">
      {/* ── Command header ─────────────────────────────── */}
      <div className="rise-in">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-signal-400 mb-1.5">
              Release Readiness · Onda release-readiness-2026-11-18
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-paper-100">
              Central de Auditoria
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="chip" data-tone={noGo ? 'alert' : 'ok'}>
              <span className={`led ${noGo ? 'led-alert led-pulse' : 'led-ok'}`} />
              {verdict}
            </span>
            <button onClick={load} className="btn !px-3 !py-2" aria-label="Recarregar estado">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {data.state.waveStatus && (
          <p className="text-[13px] text-paper-400 mt-2 max-w-3xl leading-relaxed">{data.state.waveStatus}</p>
        )}
      </div>

      {/* ── Instrument strip ───────────────────────────── */}
      <div className="rise-in rise-in-1 grid grid-cols-3 sm:grid-cols-6 gap-2">
        {Object.keys(STATUS_META).map((s) => {
          const meta = STATUS_META[s];
          const n = counts[s] || 0;
          return (
            <div key={s} className="panel px-3 py-2.5 flex items-center gap-2.5">
              <span className={`led ${meta.led}`} />
              <div className="min-w-0">
                <div className="font-mono text-lg font-bold tabular-nums leading-none text-paper-100">{n}</div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-paper-500 truncate">{meta.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Channel tabs ───────────────────────────────── */}
      <div className="rise-in rise-in-2 flex gap-1 border-b border-ink-700 overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.id;
          const badge = t.id === 'handoffs' ? data.handoffs.length
            : t.id === 'decisoes' ? data.decisions.length
            : t.id === 'docs' ? data.audits.length + data.reviews.length : undefined;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative px-4 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
                active ? 'text-paper-100' : 'text-paper-500 hover:text-paper-300'
              }`}
            >
              {t.label}
              {typeof badge === 'number' && badge > 0 && (
                <span className={`ml-1.5 font-mono text-[10px] tabular-nums ${active ? 'text-signal-300' : 'text-paper-500'}`}>{badge}</span>
              )}
              {active && <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-signal-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.6)]" />}
            </button>
          );
        })}
      </div>

      {/* ── Tab bodies ─────────────────────────────────── */}
      {tab === 'geral' && (
        <div className="rise-in rise-in-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="panel panel-corner p-5 lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-signal-400" />
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-paper-200">Bloqueios ativos</h3>
            </div>
            {Array.isArray(data.state.bloqueios) && data.state.bloqueios.length > 0 ? (
              <ul className="space-y-2">
                {(data.state.bloqueios as string[]).map((b, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] text-paper-300 leading-relaxed">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-alert-400 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-paper-500">Nenhum bloqueio registrado no checkpoint.</p>
            )}
            {data.state.proxima_acao && (
              <div className="mt-4 pt-4 border-t border-ink-700/70">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-500 mb-1">Próxima ação</div>
                <p className="text-sm text-signal-300">{data.state.proxima_acao}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="panel p-5">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-paper-200 mb-3">Ondas</h3>
              {data.waves.map((w) => (
                <div key={w.name} className="py-2.5 border-b border-ink-800 last:border-0">
                  <div className="font-mono text-xs text-paper-200 truncate" title={w.name}>{w.name}</div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {Object.entries(w.byStatus).map(([s, n]) => {
                      const m = STATUS_META[s];
                      return (
                        <span key={s} className="chip !text-[9px] !py-0" data-tone={m?.tone || ''}>
                          {m?.label || s} {n}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="panel p-5">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-paper-200 mb-3">Agentes</h3>
              <div className="space-y-1.5">
                {data.agents.map((a) => (
                  <div key={a.id} className="flex items-center gap-2.5 text-[13px]">
                    {a.disponivel
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-ok-400 shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-paper-500 shrink-0" />}
                    <span className="text-paper-200 truncate">{a.nome}</span>
                    <span className="ml-auto font-mono text-[9px] uppercase text-paper-500">{a.tipo}</span>
                  </div>
                ))}
                {data.agents.length === 0 && (
                  <p className="text-xs text-paper-500">Sem detecção — rode <code className="font-mono">node central/agents/detect-agents.mjs</code></p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'handoffs' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap items-center">
            <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} className="input !w-auto !py-1.5 !text-xs font-mono">
              <option value="">Todos status</option>
              {Object.keys(STATUS_META).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
            <select value={filter.prio} onChange={(e) => setFilter({ ...filter, prio: e.target.value })} className="input !w-auto !py-1.5 !text-xs font-mono">
              <option value="">Todas prioridades</option>
              {['P0', 'P1', 'P2', 'P3'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} placeholder="Buscar handoff, agente, arquivo…"
              className="input flex-1 min-w-44 !py-1.5 !text-xs" />
            <span className="font-mono text-[10px] text-paper-500 tabular-nums">{filtered.length}/{data.handoffs.length}</span>
          </div>

          {filtered.map((h) => {
            const open = expanded === h.file;
            const d = dispatch[h.file];
            const sm = STATUS_META[h.status] || STATUS_META.PENDENTE;
            const pm = PRIO_META[h.prioridade] || PRIO_META.P3;
            return (
              <div key={h.file} className={`panel overflow-hidden transition-colors ${open ? 'border-signal-500/50' : ''}`}>
                <div className="flex">
                  <div className={`w-1 shrink-0 ${pm.bar}`} />
                  <button onClick={() => setExpanded(open ? null : h.file)} className="flex-1 text-left p-4 flex items-start gap-3 min-w-0">
                    <ChevronDown className={`w-4 h-4 mt-0.5 shrink-0 text-paper-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-mono text-[10px] font-bold ${pm.text}`}>{pm.label}</span>
                        <span className="chip" data-tone={sm.tone}><span className={`led ${sm.led} !w-1.5 !h-1.5`} />{sm.label}</span>
                        <span className="font-mono text-[10px] text-paper-500">→ {h.para}</span>
                      </div>
                      <div className="text-[14px] font-medium text-paper-100 mt-1.5 leading-snug">{h.title}</div>
                      <div className="font-mono text-[10px] text-paper-500 mt-1 truncate">{h.name}</div>
                    </div>
                  </button>
                </div>

                {open && (
                  <div className="border-t border-ink-700/70 px-5 py-5 space-y-5">
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="panel !bg-ink-900/60 p-3">
                        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-500 mb-1">Roteamento</div>
                        <div className="text-xs text-paper-200 space-y-1">
                          <div><span className="text-paper-500">De:</span> {h.de}</div>
                          <div><span className="text-paper-500">Para:</span> {h.para}</div>
                          <div><span className="text-paper-500">Onda:</span> {h.onda}</div>
                        </div>
                      </div>
                      <div className="panel !bg-ink-900/60 p-3">
                        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-500 mb-1">Dependências</div>
                        <div className="text-xs text-paper-200 font-mono">
                          {h.dependencias.length ? h.dependencias.join(' · ') : 'nenhuma'}
                        </div>
                      </div>
                    </div>

                    <DossierSection title="Problema" text={h.problema} />
                    <DossierSection title="Correção exigida" text={h.correcao} />
                    <DossierSection title="Critério de aceite" text={h.aceite} />
                    {h.resolucao && <DossierSection title="Resolução" text={h.resolucao} accent />}
                    {h.revisao24 && <DossierSection title="Revisão 24" text={h.revisao24} accent />}

                    {/* Console de despacho */}
                    <div className="panel !bg-ink-900/80 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-violet-400" />
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-400">Console de despacho</span>
                      </div>
                      <div className="flex gap-2 flex-wrap items-center">
                        <select value={d?.agent || 'generico'}
                          onChange={(e) => setDispatch({ ...dispatch, [h.file]: { agent: e.target.value, worktree: d?.worktree || '', open: true } })}
                          className="input !w-auto !py-1.5 !text-xs font-mono">
                          {data.agents.length
                            ? data.agents.map((a) => <option key={a.id} value={a.id}>{a.nome} — {a.disponivel ? 'ok' : 'off'}</option>)
                            : <option value="generico">genérico</option>}
                        </select>
                        <input value={d?.worktree || ''} placeholder="worktree (opcional)"
                          onChange={(e) => setDispatch({ ...dispatch, [h.file]: { agent: d?.agent || 'generico', worktree: e.target.value, open: true } })}
                          className="input flex-1 min-w-44 !py-1.5 !text-xs font-mono" />
                        <button onClick={() => doDispatch(h)} disabled={busy === h.file} className="btn btn-primary !py-1.5">
                          {busy === h.file ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          Gerar prompt
                        </button>
                        <a href={`/api/central/prompt?handoff=${encodeURIComponent(h.file)}&agentId=${d?.agent || 'generico'}`}
                          target="_blank" rel="noreferrer" className="btn !py-1.5">
                          <ClipboardCopy className="w-3.5 h-3.5" /> Prompt
                        </a>
                      </div>
                      {d?.msg && <div className="font-mono text-[11px] text-signal-300">{d.msg}</div>}
                    </div>

                    {/* Transições de estado */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-500 mr-1">Estado →</span>
                      {['EM_EXECUÇÃO', 'AGUARDANDO_24', 'BLOQUEADO', 'REPROVADO_24', 'CONCLUÍDO'].map((s) => {
                        const m = STATUS_META[s];
                        return (
                          <button key={s} disabled={busy === h.file || h.status === s}
                            onClick={() => setStatus(h, s)}
                            className={`chip !normal-case !tracking-normal transition-opacity ${h.status === s ? 'opacity-40' : 'hover:!border-signal-500/60 cursor-pointer'}`}
                            data-tone={m.tone}>
                            {m.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="font-mono text-[10px] text-paper-500/70 truncate">{h.file}</div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="panel p-10 text-center">
              <p className="text-sm text-paper-400">Nenhum handoff corresponde aos filtros.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'decisoes' && (
        <div className="space-y-3">
          {data.decisions.map((d) => (
            <div key={d.id} className="panel panel-corner p-5">
              <div className="flex items-center gap-2.5">
                <span className="chip" data-tone="amber">{d.id}</span>
                <span className="font-display text-sm font-semibold text-paper-100">{d.title}</span>
              </div>
              <pre className="text-[13px] text-paper-300 whitespace-pre-wrap mt-3 font-sans leading-relaxed">{d.body}</pre>
            </div>
          ))}
          {data.decisions.length === 0 && (
            <div className="panel p-10 text-center text-sm text-paper-400">Nenhuma decisão pendente registrada.</div>
          )}
        </div>
      )}

      {tab === 'ondas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.waves.map((w) => (
            <div key={w.name} className="panel p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal-400 mb-1">Onda</div>
              <div className="font-display text-sm font-semibold text-paper-100">{w.name}</div>
              <div className="font-mono text-[11px] text-paper-500 mt-1 tabular-nums">{w.handoffs} handoffs</div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {Object.entries(w.byStatus).map(([s, n]) => {
                  const m = STATUS_META[s];
                  return <span key={s} className="chip" data-tone={m?.tone || ''}>{m?.label || s} · {n}</span>;
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'docs' && (
        <div className="space-y-3">
          {docContent && (
            <div className="panel panel-corner !bg-ink-900 p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-ink-700 bg-ink-850">
                <span className="font-mono text-[11px] text-signal-300 truncate">{docContent.file}</span>
                <button onClick={() => setDocContent(null)} className="btn !px-2.5 !py-1 !text-[10px]">fechar</button>
              </div>
              <pre className="text-[12px] leading-relaxed text-paper-300 whitespace-pre-wrap p-5 font-mono max-h-[32rem] overflow-auto">{docContent.text}</pre>
            </div>
          )}
          {[...data.audits.map((d) => ({ ...d, kind: 'AUDITORIA' })), ...data.reviews.map((d) => ({ ...d, kind: 'REVISÃO' }))].map((d) => (
            <button key={d.file} onClick={() => openDoc(d.file)}
              className="panel w-full text-left p-3.5 flex items-center gap-3 hover:border-signal-500/50 transition-colors group">
              <FileText className="w-4 h-4 text-paper-500 group-hover:text-signal-400 transition-colors shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-paper-200 truncate">{d.name}</div>
                <div className="font-mono text-[10px] text-paper-500 mt-0.5">{d.kind} · {d.file}</div>
              </div>
              <span className="font-mono text-[10px] text-paper-500 tabular-nums">{(d.size / 1024).toFixed(0)}k</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'agentes' && (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700 bg-ink-850/60">
                {['Agente', 'Tipo', 'Status', 'Binários'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-paper-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.agents.map((a) => (
                <tr key={a.id} className="border-b border-ink-800/70 last:border-0 hover:bg-ink-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-[13px] font-medium text-paper-100">{a.nome}</div>
                    <div className="font-mono text-[10px] text-paper-500">{a.id}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-paper-400">{a.tipo}</td>
                  <td className="px-4 py-3">
                    {a.disponivel
                      ? <span className="chip" data-tone="ok"><span className="led led-ok !w-1.5 !h-1.5" />online</span>
                      : <span className="chip"><span className="led led-idle !w-1.5 !h-1.5" />offline</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-paper-400">{a.binarios?.map((b) => b.cmd).join(', ') || '—'}</td>
                </tr>
              ))}
              {data.agents.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-paper-400">
                  Sem dados de detecção. Rode <code className="font-mono text-signal-300">node central/agents/detect-agents.mjs</code> na pasta central.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DossierSection({ title, text, accent }: { title: string; text: string; accent?: boolean }) {
  return (
    <div>
      <div className={`font-mono text-[10px] uppercase tracking-[0.2em] mb-1.5 ${accent ? 'text-signal-300' : 'text-paper-500'}`}>{title}</div>
      <pre className={`text-[13px] leading-relaxed whitespace-pre-wrap font-sans rounded-lg p-3 border ${
        accent ? 'text-paper-200 bg-signal-500/5 border-signal-500/20' : 'text-paper-300 bg-ink-900/50 border-ink-700/60'
      }`}>{text}</pre>
    </div>
  );
}
