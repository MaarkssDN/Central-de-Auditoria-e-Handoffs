import {
  Activity,
  ArrowLeftRight,
  Bot,
  FolderGit2,
  FolderOpen,
  Landmark,
  LayoutDashboard,
  PlugZap,
  Radar,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { OFFICIAL_AGENTS } from '../data/agentsRoster';

export type NavSection =
  | 'home'
  | 'providers'
  | 'arquivos'
  | 'central'
  | 'ondas'
  | 'bots'
  | 'handoffs'
  | 'auditoria'
  | 'agentes'
  | 'repositorios';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  openHandoffsCount: number;
  pendingAuditCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

type NavGroup = 'Comando' | 'Operação' | 'Governança';

const NAV_GROUPS: Record<NavGroup, string> = {
  Comando: 'text-accent-blue',
  'Operação': 'text-accent-cyan',
  'Governança': 'text-accent-violet',
};

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: typeof Activity;
  neonHex: string;
  group: NavGroup;
}> = [
  { id: 'home', label: 'Início', icon: LayoutDashboard, neonHex: '#38BDF8', group: 'Comando' },
  { id: 'providers', label: 'Conexões de IA', icon: PlugZap, neonHex: '#7C3AED', group: 'Operação' },
  { id: 'arquivos', label: 'Arquivos Locais', icon: FolderOpen, neonHex: '#22D3EE', group: 'Operação' },
  { id: 'bots', label: 'Personagens e Bots', icon: Bot, neonHex: '#2563EB', group: 'Operação' },
  { id: 'ondas', label: 'Ondas e Missões', icon: Activity, neonHex: '#7C3AED', group: 'Operação' },
  { id: 'handoffs', label: 'Central de Handoffs', icon: ArrowLeftRight, neonHex: '#DB2777', group: 'Governança' },
  { id: 'auditoria', label: 'Auditoria e Parecer 24', icon: ShieldCheck, neonHex: '#DC2626', group: 'Governança' },
  { id: 'agentes', label: 'Agentes e Propriedade', icon: Users, neonHex: '#047857', group: 'Governança' },
  { id: 'repositorios', label: 'Repositórios', icon: FolderGit2, neonHex: '#D97706', group: 'Governança' },
  { id: 'central', label: 'Central Local', icon: Landmark, neonHex: '#22D3EE', group: 'Governança' },
];

const GROUP_ORDER: NavGroup[] = ['Comando', 'Operação', 'Governança'];

export function Sidebar({
  activeSection,
  onSelectSection,
  openHandoffsCount,
  pendingAuditCount,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navContent = (
    <div className="flex h-full flex-col bg-ink-900/95 backdrop-blur-xl border-r border-ink-700/60">
      {/* Brand header */}
      <div className="px-5 py-5 border-b border-ink-700/60">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl grid place-items-center shrink-0"
            style={{
              background:
                'var(--color-ink-800)',
              border: '1px solid var(--color-ink-600)',
              
            }}
          >
            <Radar className="w-5 h-5 text-signal-400" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-base leading-tight tracking-tight">
              <span className="text-accent-amber">Governança</span>{' '}
              <span className="text-accent-blue">360</span>
            </div>
            <div className="text-[11px] text-accent-violet mt-0.5 truncate font-medium">
              Orquestração Multiagente
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fechar menu lateral"
            className="lg:hidden ml-auto p-2 text-paper-300 hover:text-paper-100 rounded-xl"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Navegação principal" className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {GROUP_ORDER.map((group) => (
          <div key={group}>
            <div className={`px-3.5 pb-1.5 text-[9px] font-mono font-bold uppercase tracking-[0.22em] ${NAV_GROUPS[group]}`}>
              {group}
            </div>
            <div className="space-y-1">
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
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
                    className={`group relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-left transition-all duration-200 ${
                      isActive
                        ? 'text-paper-100'
                        : 'text-paper-400 hover:bg-ink-800/60 hover:text-paper-200'
                    }`}
                    style={
                      isActive
                        ? {
                            background: `linear-gradient(125deg, ${item.neonHex}26 0%, var(--color-ink-900) 80%)`,
                            border: `1px solid ${item.neonHex}55`,
                            boxShadow: `0 0 18px -6px ${item.neonHex}66`,
                          }
                        : { border: '1px solid transparent' }
                    }
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
                        style={{ background: item.neonHex, boxShadow: `0 0 10px ${item.neonHex}` }}
                      />
                    )}
                    <Icon
                      className="w-4 h-4 shrink-0 transition-colors"
                      style={{ color: isActive ? item.neonHex : 'var(--color-paper-500)' }}
                      strokeWidth={2}
                    />
                    <span
                      className="flex-1 text-[13px] font-bold truncate transition-colors"
                      style={{ color: isActive ? item.neonHex : undefined }}
                    >
                      {item.label}
                    </span>
                    {typeof count === 'number' && count > 0 && (
                      <span
                        className="font-mono text-[11px] font-semibold tabular-nums"
                        style={{ color: isActive ? item.neonHex : 'var(--color-amberx-500)' }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Roster Governance Footer */}
      <div className="p-4 border-t border-ink-700/60">
        <div className="rounded-2xl bg-ink-850/90 border border-ink-600 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-accent-emerald font-bold">Roster Oficial</span>
            <span className="font-mono font-bold text-accent-blue tabular-nums">
              {OFFICIAL_AGENTS.length} agentes
            </span>
          </div>
          <div className="text-[11px] text-accent-violet leading-snug">
            Slots 19 e 20 reservados (§4) · Parecer obrigatório: Agente 24 (§40)
          </div>
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
            className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[85vw] h-full z-10">{navContent}</aside>
        </div>
      )}
    </>
  );
}
