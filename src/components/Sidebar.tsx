import {
  Activity,
  ArrowLeftRight,
  Bot,
  FolderGit2,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';

export type NavSection = 'ondas' | 'bots' | 'handoffs' | 'auditoria' | 'agentes' | 'repositorios';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  openHandoffsCount: number;
  pendingAuditCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{ id: NavSection; label: string; icon: typeof Activity }> = [
  { id: 'bots', label: 'Personagens e Bots', icon: Bot },
  { id: 'ondas', label: 'Ondas e Missões', icon: Activity },
  { id: 'handoffs', label: 'Central de Handoffs', icon: ArrowLeftRight },
  { id: 'auditoria', label: 'Auditoria e Parecer 24', icon: ShieldCheck },
  { id: 'agentes', label: 'Agentes e Propriedade', icon: Users },
  { id: 'repositorios', label: 'Repositórios', icon: FolderGit2 },
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
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200">
      <div>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <span className="text-sm font-bold tracking-tight text-slate-900 block">
              Governança 360
            </span>
            <span className="text-xs text-slate-500 block mt-0.5">
              Orquestração Multiagente
            </span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fechar menu lateral"
            className="lg:hidden p-2 text-slate-500 hover:text-slate-900 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav aria-label="Navegação principal" className="p-3 space-y-1">
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
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium rounded-md transition-colors text-left ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof count === 'number' && count > 0 && (
                  <span
                    className={`font-mono text-xs tabular-nums shrink-0 ${
                      isActive ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="px-5 py-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
        <div className="font-medium text-slate-700">Roster Ativo: 26 Agentes</div>
        <div>Slots 19 e 20 reservados (§4)</div>
        <div>Revisão obrigatória: Agente 24 (§40)</div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[85vw] h-full z-10">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
