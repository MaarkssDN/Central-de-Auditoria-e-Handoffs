import {
  Activity,
  ArrowLeftRight,
  Bot,
  FolderGit2,
  Landmark,
  Radar,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';

export type NavSection = 'central' | 'ondas' | 'bots' | 'handoffs' | 'auditoria' | 'agentes' | 'repositorios';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  openHandoffsCount: number;
  pendingAuditCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{ id: NavSection; label: string; icon: typeof Activity; code: string }> = [
  { id: 'central', label: 'Central de Auditoria', icon: Landmark, code: 'CEN' },
  { id: 'bots', label: 'Personagens e Bots', icon: Bot, code: 'BOT' },
  { id: 'ondas', label: 'Ondas e Missões', icon: Activity, code: 'OND' },
  { id: 'handoffs', label: 'Central de Handoffs', icon: ArrowLeftRight, code: 'HND' },
  { id: 'auditoria', label: 'Auditoria e Parecer 24', icon: ShieldCheck, code: 'AUD' },
  { id: 'agentes', label: 'Agentes e Propriedade', icon: Users, code: 'AGT' },
  { id: 'repositorios', label: 'Repositórios', icon: FolderGit2, code: 'REP' },
];

export function Sidebar({
  activeSection,
  onSelectSection,
  openHandoffsCount,
  pendingAuditCount,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navContent = (
    <div className="flex h-full flex-col bg-ink-900/90 backdrop-blur border-r border-ink-700">
      {/* Brand block */}
      <div className="px-5 pt-5 pb-4 border-b border-ink-700/70">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-lg border border-signal-500/50 bg-ink-800 grid place-items-center overflow-hidden">
            <Radar className="w-5 h-5 text-signal-400" strokeWidth={1.8} />
            <span className="absolute inset-0 blueprint-grid opacity-60" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-[15px] leading-tight tracking-tight text-paper-100">
              Governança<span className="text-signal-400">360</span>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper-500 mt-0.5">
              War Room · v2.0
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fechar menu lateral"
            className="lg:hidden ml-auto p-2 text-paper-400 hover:text-paper-100 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="led led-ok" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-paper-400">
            Sistemas nominais
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav aria-label="Navegação principal" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-500">
          Console
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          const count =
            item.id === 'handoffs'
              ? openHandoffsCount
              : item.id === 'auditoria'
                ? pendingAuditCount
                : undefined;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectSection(item.id);
                onCloseMobile();
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 ${
                isActive
                  ? 'bg-ink-800 text-paper-100'
                  : 'text-paper-400 hover:bg-ink-800/60 hover:text-paper-200'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r bg-signal-400 shadow-[0_0_10px_rgba(56,189,248,0.7)]" />
              )}
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-signal-400' : 'text-paper-500 group-hover:text-paper-300'
                }`}
                strokeWidth={1.8}
              />
              <span className="flex-1 text-[13px] font-medium truncate">{item.label}</span>
              <span
                className={`font-mono text-[9px] tracking-widest ${
                  isActive ? 'text-signal-400/80' : 'text-paper-500/60'
                }`}
              >
                {item.code}
              </span>
              {typeof count === 'number' && count > 0 && (
                <span
                  className={`font-mono text-[10px] tabular-nums px-1.5 py-0.5 rounded border ${
                    isActive
                      ? 'text-signal-300 border-signal-500/40 bg-signal-500/10'
                      : 'text-amberx-300 border-amberx-500/30 bg-amberx-500/10'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer status */}
      <div className="px-5 py-4 border-t border-ink-700/70 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-paper-500">
            Roster ativo
          </span>
          <span className="font-mono text-[11px] font-semibold text-signal-300 tabular-nums">
            26
          </span>
        </div>
        <div className="text-[11px] text-paper-500 leading-snug">
          Slots 19 e 20 reservados · Revisão obrigatória: Agente 24
        </div>
        <div className="pt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-paper-500/70">
          Central-Auditoria-BirthHub
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">{navContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-ink-950/70 backdrop-blur-sm"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[85vw] h-full z-10">{navContent}</aside>
        </div>
      )}
    </>
  );
}
