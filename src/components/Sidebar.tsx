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
import { OFFICIAL_AGENTS } from '../data/agentsRoster';

export type NavSection =
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
  { id: 'bots', label: 'Personagens e Bots', icon: Bot, neonHex: '#00F0FF' },
  { id: 'ondas', label: 'Ondas e Missões', icon: Activity, neonHex: '#BF5AF2' },
  { id: 'handoffs', label: 'Central de Handoffs', icon: ArrowLeftRight, neonHex: '#FF2E97' },
  { id: 'auditoria', label: 'Auditoria e Parecer 24', icon: ShieldCheck, neonHex: '#FF073A' },
  { id: 'agentes', label: 'Agentes e Propriedade', icon: Users, neonHex: '#00FFA3' },
  { id: 'repositorios', label: 'Repositórios', icon: FolderGit2, neonHex: '#FFB800' },
  { id: 'central', label: 'Central Local', icon: Landmark, neonHex: '#38F9FF' },
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
    <div className="flex h-full flex-col bg-[#070B16]/95 backdrop-blur-xl border-r border-cyan-400/15">
      {/* Brand header */}
      <div className="px-5 py-5 border-b border-cyan-400/15">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl grid place-items-center shrink-0"
            style={{
              background:
                'linear-gradient(135deg, rgba(0,240,255,0.22), rgba(191,90,242,0.28), rgba(255,46,151,0.22))',
              border: '1px solid rgba(0,240,255,0.55)',
              boxShadow: '0 0 22px -6px rgba(0,240,255,0.75)',
            }}
          >
            <Radar className="w-5 h-5 text-[#00F0FF]" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-base leading-tight tracking-tight text-white">
              Governança <span className="neon-text-gradient">360</span>
            </div>
            <div className="text-[11px] text-[#7C90B8] mt-0.5 truncate">
              Orquestração Multiagente
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fechar menu lateral"
            className="lg:hidden ml-auto p-2 text-[#A6B7D9] hover:text-white rounded-xl"
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
                  ? 'text-white'
                  : 'text-[#A6B7D9] hover:bg-white/[0.04] hover:text-white'
              }`}
              style={
                isActive
                  ? {
                      background: `linear-gradient(125deg, ${item.neonHex}22 0%, rgba(12,18,37,0.92) 85%)`,
                      border: `1px solid ${item.neonHex}66`,
                      boxShadow: `0 0 22px -10px ${item.neonHex}aa`,
                    }
                  : { border: '1px solid transparent' }
              }
            >
              <Icon
                className="w-4 h-4 shrink-0 transition-colors"
                style={{ color: isActive ? item.neonHex : '#7C90B8' }}
                strokeWidth={2}
              />
              <span className="flex-1 text-[13px] font-medium truncate">{item.label}</span>
              {typeof count === 'number' && count > 0 && (
                <span
                  className="font-mono text-[11px] font-semibold tabular-nums"
                  style={{ color: isActive ? item.neonHex : '#FFB800' }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Roster Governance Footer */}
      <div className="p-4 border-t border-cyan-400/15">
        <div className="rounded-2xl bg-[#0C1224]/90 border border-violet-400/25 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#A6B7D9] font-medium">Roster Oficial</span>
            <span className="font-mono font-bold text-[#00F0FF] tabular-nums">
              {OFFICIAL_AGENTS.length} agentes
            </span>
          </div>
          <div className="text-[11px] text-[#7C90B8] leading-snug">
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
            className="fixed inset-0 bg-[#04060D]/80 backdrop-blur-sm"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[85vw] h-full z-10">{navContent}</aside>
        </div>
      )}
    </>
  );
}
