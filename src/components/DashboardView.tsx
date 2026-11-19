import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarDays,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  FolderGit2,
  Handshake,
  Landmark,
  Lightbulb,
  Mic,
  PlugZap,
  Radio,
  Settings2,
  Users,
} from 'lucide-react';
import type { NavSection } from './Sidebar';
import type { ThemeMode } from './ThemeToggle';
import type { Handoff, IndependentReview, Mission, WorkspaceState } from '../types/governance';
import { OFFICIAL_AGENTS } from '../data/agentsRoster';

interface DashboardViewProps {
  workspace: WorkspaceState;
  userName: string;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onNavigate: (section: NavSection) => void;
}

interface ActivityItem {
  id: string;
  kind: 'handoff' | 'review' | 'mission';
  title: string;
  detail: string;
  date: string;
  tone: 'signal' | 'amber' | 'alert' | 'ok' | 'violet';
}

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const WEEKDAYS_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const SUGGESTIONS = [
  'Conecte um provider em Conexões de IA para despachar execuções reais.',
  'Registre a raiz dos seus repositórios em Arquivos Locais para leitura e edição seguras.',
  'Crie um handoff com evidência clara — o Parecer 24 audita contra ela.',
  'Use o Chat Boot flutuante (ou comando de voz) para pedir despachos ao coordenador.',
  'Sincronize um repo do GitHub em Repositórios para trazer waves e handoffs reais.',
  'Bloqueadores P0 na Central de Handoffs merecem atenção antes de qualquer onda nova.',
];

const TONE_TEXT: Record<ActivityItem['tone'], string> = {
  signal: 'text-signal-400',
  amber: 'text-amberx-400',
  alert: 'text-alert-400',
  ok: 'text-ok-400',
  violet: 'text-violet-400',
};
const TONE_DOT: Record<ActivityItem['tone'], string> = {
  signal: 'bg-signal-400',
  amber: 'bg-amberx-400',
  alert: 'bg-alert-400',
  ok: 'bg-ok-400',
  violet: 'bg-violet-400',
};

function firstName(name: string): string {
  const n = name.trim();
  return n ? n.split(/\s+/)[0] : 'Operador';
}

function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function buildActivity(workspace: WorkspaceState): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const h of workspace.handoffs as Handoff[]) {
    const date = h.resolution?.resolvedAt || h.createdAt;
    items.push({
      id: `h-${h.id}`,
      kind: 'handoff',
      title: `Handoff ${h.slug}`,
      detail: `${h.priority} · ${h.status}`,
      date,
      tone: h.status === 'resolvido' ? 'ok' : h.priority === 'bloqueador' ? 'alert' : 'signal',
    });
  }
  for (const r of workspace.reviews as IndependentReview[]) {
    items.push({
      id: `r-${r.id}`,
      kind: 'review',
      title: `Parecer 24 — ${r.missionTitle || r.id}`,
      detail: `Veredito ${r.verdict}`,
      date: r.createdAt,
      tone: r.verdict === 'APROVADO' ? 'ok' : r.verdict === 'BLOQUEADO' ? 'alert' : 'amber',
    });
  }
  for (const m of workspace.missions as Mission[]) {
    items.push({
      id: `m-${m.id}`,
      kind: 'mission',
      title: `Missão ${m.title || m.id}`,
      detail: m.status,
      date: m.createdAt,
      tone: m.status === 'aprovada' ? 'ok' : m.status === 'reprovada' ? 'alert' : 'violet',
    });
  }
  return items
    .filter((i) => !Number.isNaN(new Date(i.date).getTime()))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 8);
}

interface Kpi {
  label: string;
  value: number;
  sub: string;
  icon: typeof Handshake;
  color: string;
  bg: string;
}

function KpiCard({ kpi, delay }: { kpi: Kpi; delay: number }) {
  const v = useCountUp(kpi.value);
  const Icon = kpi.icon;
  return (
    <div className={`panel rounded-2xl p-4 dash-rise dash-rise-${delay} flex items-center gap-4`}>
      <div className={`w-11 h-11 rounded-xl grid place-items-center shrink-0 ${kpi.bg}`}>
        <Icon className={`w-5 h-5 ${kpi.color}`} />
      </div>
      <div className="min-w-0">
        <div className={`dash-num font-display text-2xl font-bold leading-none ${kpi.color}`}>{v}</div>
        <div className={`text-[11px] font-bold mt-1 truncate ${kpi.color}`}>{kpi.label}</div>
        <div className="text-[10px] font-mono text-paper-400 truncate">{kpi.sub}</div>
      </div>
    </div>
  );
}

function Calendar({ now }: { now: Date }) {
  const [view, setView] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const isToday = (d: number) =>
    d === now.getDate() && month === now.getMonth() && year === now.getFullYear();
  const shift = (dir: number) =>
    setView((v) => new Date(v.getFullYear(), v.getMonth() + dir, 1));
  return (
    <div className="panel rounded-2xl p-4 h-full overflow-hidden relative">
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: 'linear-gradient(90deg, var(--color-signal-500), var(--color-violet-500), var(--color-amberx-500))' }}
      />
      <div className="flex items-center justify-between mb-3 mt-1">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Mês anterior"
          className="w-7 h-7 rounded-lg grid place-items-center text-paper-400 hover:text-signal-300 hover:bg-ink-800/60 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-display text-sm font-bold text-signal-400">
          {MONTHS_PT[month]} <span className="text-violet-400 font-bold">{year}</span>
        </span>
        <div className="flex items-center gap-1">
          <CalendarDays className="w-4 h-4 text-amberx-400" />
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Próximo mês"
            className="w-7 h-7 rounded-lg grid place-items-center text-paper-400 hover:text-signal-300 hover:bg-ink-800/60 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS_PT.map((d, i) => (
          <span key={i} className="text-[10px] font-black text-violet-400/80 py-1">{d}</span>
        ))}
        {cells.map((day, i) => (
          <span
            key={i}
            className={`text-xs py-1.5 rounded-full transition-colors ${
              day === null
                ? ''
                : isToday(day)
                  ? 'bg-signal-500 text-white font-black shadow-[0_0_12px_rgba(59,130,246,0.5)]'
                  : 'text-paper-300 hover:bg-ink-800/70 hover:text-signal-300'
            }`}
          >
            {day ?? ''}
          </span>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-ink-700/60 flex items-center justify-between">
        <span className="text-[10px] font-mono text-paper-400">{now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <span className="text-[10px] font-mono font-bold text-ok-400 dash-blink">HOJE</span>
      </div>
    </div>
  );
}

function RadarClock({ now, timeStr, dateStr }: { now: Date; timeStr: string; dateStr: string }) {
  return (
    <div className="panel rounded-2xl px-5 py-4 flex items-center gap-5">
      <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0" aria-hidden="true">
        <circle cx="36" cy="36" r="33" fill="none" stroke="var(--color-ink-600)" strokeWidth="1.5" />
        <circle cx="36" cy="36" r="22" fill="none" stroke="var(--color-ink-700)" strokeWidth="1" />
        <circle cx="36" cy="36" r="11" fill="none" stroke="var(--color-ink-700)" strokeWidth="1" />
        <line x1="36" y1="3" x2="36" y2="69" stroke="var(--color-ink-700)" strokeWidth="1" />
        <line x1="3" y1="36" x2="69" y2="36" stroke="var(--color-ink-700)" strokeWidth="1" />
        <g className="dash-radar-sweep">
          <path d="M36 36 L36 5 A31 31 0 0 1 62 20 Z" fill="rgba(56,189,248,0.28)" />
          <line x1="36" y1="36" x2="36" y2="5" stroke="var(--color-signal-400)" strokeWidth="1.5" />
        </g>
        <circle cx="36" cy="36" r="3" fill="var(--color-signal-400)" />
        <circle cx="52" cy="24" r="2" fill="var(--color-ok-400)" className="dash-blink" />
      </svg>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-ok-400 dash-blink" />
          <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-ok-400">
            Sistemas operacionais
          </span>
        </div>
        <div className="dash-num font-mono text-3xl font-bold text-signal-300 leading-none">{timeStr}</div>
        <div className="text-xs text-violet-300 mt-1.5 capitalize">{dateStr}</div>
      </div>
    </div>
  );
}

export function DashboardView({ workspace, userName, theme, onToggleTheme, onNavigate }: DashboardViewProps) {
  const [now, setNow] = useState(() => new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const stats = useMemo(() => {
    const openHandoffs = workspace.handoffs.filter((h) => h.status !== 'resolvido');
    const running = workspace.missions.filter((m) => m.status === 'em_execucao');
    const reviews = workspace.reviews.length;
    const blockers = openHandoffs.filter((h) => h.priority === 'bloqueador').length;
    return { openHandoffs: openHandoffs.length, running: running.length, reviews, blockers, agents: OFFICIAL_AGENTS.length };
  }, [workspace]);

  const kpis: Kpi[] = [
    { label: 'Handoffs abertos', value: stats.openHandoffs, sub: `${stats.blockers} bloqueador(es)`, icon: Handshake, color: 'text-signal-400', bg: 'bg-signal-500/10' },
    { label: 'Missões em execução', value: stats.running, sub: 'ondas ativas', icon: Radio, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Pareceres 24', value: stats.reviews, sub: 'auditorias registradas', icon: ClipboardCheck, color: 'text-amberx-400', bg: 'bg-amberx-500/10' },
    { label: 'Agentes no elenco', value: stats.agents, sub: 'prontos para dispatch', icon: Users, color: 'text-ok-400', bg: 'bg-ok-500/10' },
  ];

  const activity = useMemo(() => buildActivity(workspace), [workspace]);
  const notifications = useMemo(() => {
    const list: { icon: typeof Bell; text: string; tone: 'alert' | 'amber' | 'signal' | 'ok' }[] = [];
    if (stats.blockers) list.push({ icon: Bell, text: `${stats.blockers} handoff(s) bloqueador(es) aberto(s)`, tone: 'alert' });
    if (stats.openHandoffs) list.push({ icon: Handshake, text: `${stats.openHandoffs} handoff(s) aguardando resolução`, tone: 'amber' });
    if (stats.running) list.push({ icon: Radio, text: `${stats.running} missão(ões) em execução`, tone: 'signal' });
    if (!list.length) list.push({ icon: Bell, text: 'Nenhuma pendência — filas limpas.', tone: 'ok' });
    return list.slice(0, 4);
  }, [stats]);
  const suggestions = useMemo(() => {
    const start = Math.floor(now.getTime() / 86400000) % SUGGESTIONS.length;
    return Array.from({ length: 3 }, (_, i) => SUGGESTIONS[(start + i) % SUGGESTIONS.length]);
  }, [now]);

  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const entryCards: { section: NavSection; title: string; desc: string; stat: string; statLabel: string; icon: typeof Landmark; accent: string }[] = [
    {
      section: 'central',
      title: 'Central de Auditoria',
      desc: 'Estado da onda, bloqueios, handoffs e trilha de evidências do repositório ativo.',
      stat: String(workspace.handoffs.length),
      statLabel: 'handoffs no repo',
      icon: FileSearch,
      accent: '#38BDF8',
    },
    {
      section: 'handoffs',
      title: 'Central de Handoffs',
      desc: 'Fila de delegação entre agentes: prioridade, dependências e resolução verificada.',
      stat: String(stats.openHandoffs),
      statLabel: 'aguardando resolução',
      icon: Handshake,
      accent: '#DB2777',
    },
  ];

  const quickActions: { section: NavSection; label: string; icon: typeof PlugZap }[] = [
    { section: 'providers', label: 'Provedores', icon: PlugZap },
    { section: 'arquivos', label: 'Arquivos', icon: FileSearch },
    { section: 'repositorios', label: 'Repositórios', icon: FolderGit2 },
    { section: 'agentes', label: 'Elenco', icon: Users },
  ];

  return (
    <div className="space-y-5">
      {/* ── Cabeçalho de comando ── */}
      <div className="dash-rise flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight leading-none">
            <span className="text-amberx-300">Sala de </span>
            <span className="text-signal-400">Comando</span>
          </h1>
          <p className="text-sm mt-2.5 capitalize">
            <span className="text-violet-300">{dateStr}</span>
            <span className="text-paper-400"> — olá, </span>
            <span className="text-amberx-400 font-bold">{firstName(userName)}</span>
            <span className="text-paper-400">. O set está montado; os agentes aguardam direção.</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RadarClock now={now} timeStr={timeStr} dateStr={dateStr} />
          <div className="relative">
            <button type="button" onClick={() => setSettingsOpen((v) => !v)} aria-label="Configurações" className="btn p-3">
              <Settings2 className="w-4 h-4" />
            </button>
            {settingsOpen && (
              <div className="absolute right-0 top-14 z-30 panel rounded-2xl p-2 w-52">
                <button
                  type="button"
                  onClick={() => { onToggleTheme(); setSettingsOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-paper-200 hover:bg-ink-800/60"
                >
                  <Settings2 className="w-4 h-4 text-signal-400" />
                  Tema {theme === 'dark' ? 'claro' : 'escuro'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <KpiCard key={kpi.label} kpi={kpi} delay={i + 1} />
        ))}
      </div>

      {/* ── Ações rápidas ── */}
      <div className="dash-rise dash-rise-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-signal-400 mr-1">Acesso rápido</span>
        {quickActions.map(({ section, label, icon: Icon }) => (
          <button
            key={section}
            type="button"
            onClick={() => onNavigate(section)}
            className="chip hover:border-signal-500/60 hover:text-signal-300 transition-colors cursor-pointer"
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
        <span className="chip ml-auto border-dashed">
          <Mic className="w-3.5 h-3.5" /> Chat Boot sempre disponível no canto
        </span>
      </div>

      {/* ── Cards de entrada ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {entryCards.map(({ section, title, desc, stat, statLabel, icon: Icon, accent }, i) => (
          <button
            key={section}
            type="button"
            onClick={() => onNavigate(section)}
            className={`panel rounded-2xl p-6 text-left group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dash-rise dash-rise-${i + 3}`}
          >
            <div className="flex items-start justify-between mb-5">
              <div
                className="w-12 h-12 rounded-2xl grid place-items-center transition-transform duration-300 group-hover:scale-110"
                style={{ background: `${accent}1f`, border: `1px solid ${accent}55` }}
              >
                <Icon className="w-6 h-6" style={{ color: accent }} strokeWidth={2} />
              </div>
              <ArrowRight className="w-5 h-5 text-paper-400 group-hover:translate-x-1 transition-all" />
            </div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold mb-1.5" style={{ color: accent }}>{title}</h2>
                <p className="text-sm leading-relaxed" style={{ color: `${accent}cc` }}>{desc}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="dash-num font-display text-3xl font-bold" style={{ color: accent }}>{stat}</div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-paper-400">{statLabel}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Grid inferior ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Timeline */}
        <div className="panel rounded-2xl p-5 lg:col-span-5 dash-rise dash-rise-4">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-signal-400" />
            <h3 className="font-display text-sm font-bold text-signal-300">Últimas atividades</h3>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-paper-400">
              Nenhuma atividade registrada ainda. Conecte um repositório ou crie um handoff para começar.
            </p>
          ) : (
            <ul className="relative space-y-4 before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-px before:bg-ink-600">
              {activity.map((a) => (
                <li key={a.id} className="relative pl-6">
                  <span className={`absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full border-2 border-ink-900 ${TONE_DOT[a.tone]}`} />
                  <div className="flex items-center justify-between gap-3">
                    <p className={`text-sm font-bold truncate ${TONE_TEXT[a.tone]}`}>{a.title}</p>
                    <span className="text-[10px] font-mono text-paper-400 shrink-0 tabular-nums">
                      {new Date(a.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 ${TONE_TEXT[a.tone]}`}>
                    {a.kind === 'handoff' ? 'Handoff' : a.kind === 'review' ? 'Parecer 24' : 'Missão'} · {a.detail}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Direita: notificações + calendário + sugestões */}
        <div className="lg:col-span-4 space-y-4">
          <div className="panel rounded-2xl p-4 dash-rise dash-rise-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-amberx-400" />
              <h3 className="font-display text-sm font-bold text-amberx-300">Notificações</h3>
            </div>
            <ul className="space-y-2.5">
              {notifications.map((n, i) => {
                const Icon = n.icon;
                const tone =
                  n.tone === 'alert' ? 'text-alert-400' : n.tone === 'amber' ? 'text-amberx-400' : n.tone === 'signal' ? 'text-signal-400' : 'text-ok-400';
                return (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] text-paper-300">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${tone}`} />
                    <span>{n.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="dash-rise dash-rise-5">
            <Calendar now={now} />
          </div>
        </div>

        {/* Sugestões */}
        <div className="panel rounded-2xl p-4 lg:col-span-3 dash-rise dash-rise-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-violet-400" />
            <h3 className="font-display text-sm font-bold text-violet-300">Diretrizes</h3>
          </div>
          <ul className="space-y-3">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] text-paper-300 leading-relaxed">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Rodapé de status ── */}
      <div className="dash-rise dash-rise-5 flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 text-[11px] font-mono text-paper-400">
          <Landmark className="w-3.5 h-3.5 text-signal-400" />
          <span>GOV-360 · {workspace.repositories.length} repositório(s) sob governança</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-ok-400">
          <span className="w-1.5 h-1.5 rounded-full bg-ok-400 dash-blink" />
          <span>LINK LOCAL ESTÁVEL</span>
        </div>
      </div>
    </div>
  );
}
