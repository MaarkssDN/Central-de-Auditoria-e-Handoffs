import {
  Activity,
  ArrowLeftRight,
  Bot,
  FolderGit2,
  FolderOpen,
  Landmark,
  MessageSquare,
  PlugZap,
  Radar,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { OFFICIAL_AGENTS } from '../data/agentsRoster';

export type NavSection =
  | 'chat'
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

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: typeof Activity;
  neonHex: string;
}> = [
  { id: 'chat', label: 'Chat Boot', icon: MessageSquare, neonHex: '#2563EB' },
  { id: 'providers', label: 'Conexões de IA', icon: PlugZap, neonHex: '#7C3AED' },
  { id: 'arquivos', label: 'Arquivos Locais', icon: FolderOpen, neonHex: '#22D3EE' },
  { id: 'bots', label: 'Personagens e Bots', icon: Bot, neonHex: '#2563EB' },
  { id: 'ondas', label: 'Ondas e Missões', icon: Activity, neonHex: '#7C3AED' },
  { id: 'handoffs', label: 'Central de Handoffs', icon: ArrowLeftRight, neonHex: '#DB2777' },
  { id: 'auditoria', label: 'Auditoria e Parecer 24', icon: ShieldCheck, neonHex: '#DC2626' },
  { id: 'agentes', label: 'Agentes e Propriedade', icon: Users, neonHex: '#047857' },
  { id: 'repositorios', label: 'Repositórios', icon: FolderGit2, neonHex: '#D97706' },
  { id: 'central', label: 'Central Local', icon: Landmark, neonHex: '#22D3EE' },
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
            <div className="font-display font-bold text-base leading-tight tracking-tight text-paper-100">
              Governança <span className="neon-text-gradient">360</span>
            </div>
            <div className="text-[11px] text-paper-400 mt-0.5 truncate">
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
      <nav aria-label="Navegação principal" className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
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
              className={`group relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-left transition-all duration-200 ${
                isActive
                  ? 'text-paper-100'
                  : 'text-paper-300 hover:bg-ink-800/60 hover:text-paper-100'
              }`}
              style={
                isActive
                  ? {
                      background: `linear-gradient(125deg, ${item.neonHex}22 0%, var(--color-ink-900) 85%)`,
                      border: `1px solid ${item.neonHex}66`,
                      
                    }
                  : { border: '1px solid transparent' }
              }
            >
              <Icon
                className="w-4 h-4 shrink-0 transition-colors"
                style={{ color: isActive ? item.neonHex : 'var(--color-paper-400)' }}
                strokeWidth={2}
              />
              <span className="flex-1 text-[13px] font-medium truncate">{item.label}</span>
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
      </nav>

      {/* Roster Governance Footer */}
      <div className="p-4 border-t border-ink-700/60">
        <div className="rounded-2xl bg-ink-850/90 border border-ink-600 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-paper-300 font-medium">Roster Oficial</span>
            <span className="font-mono font-bold text-signal-400 tabular-nums">
              {OFFICIAL_AGENTS.length} agentes
            </span>
          </div>
          <div className="text-[11px] text-paper-400 leading-snug">
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
