import { Menu, Plus } from 'lucide-react';
import type { RepositoryTarget } from '../types/governance';
import type { NavSection } from './Sidebar';

interface TopBarProps {
  activeSection: NavSection;
  repositories: RepositoryTarget[];
  activeRepoId: string;
  onSelectRepo: (repoId: string) => void;
  onOpenConnectRepo: () => void;
  onOpenMobileMenu: () => void;
}

const SECTION_TITLES: Record<NavSection, string> = {
  central: 'Central Local',
  bots: 'Personagens e Bots',
  ondas: 'Ondas e Missões',
  handoffs: 'Central de Handoffs',
  auditoria: 'Auditoria e Parecer 24',
  agentes: 'Agentes e Propriedade',
  repositorios: 'Repositórios e Integrações',
};

export function TopBar({
  activeSection,
  repositories,
  activeRepoId,
  onSelectRepo,
  onOpenConnectRepo,
  onOpenMobileMenu,
}: TopBarProps) {
  const activeRepo = repositories.find((r) => r.id === activeRepoId) ?? repositories[0];
  const openBlockers = activeRepo?.blockers.filter((b) => b.status === 'aberto').length ?? 0;

  return (
    <header className="sticky top-0 z-30 border-b border-cyan-400/15 bg-[#060914]/85 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 px-4 lg:px-8 h-16 max-w-[1600px] mx-auto w-full">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Abrir menu"
            className="lg:hidden p-2 -ml-2 text-[#A6B7D9] hover:text-white rounded-xl"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 min-w-0 text-sm">
            {activeRepo && (
              <>
                <span className="hidden sm:inline font-mono text-xs text-[#00F0FF] truncate max-w-[200px]">
                  {activeRepo.fullName}
                </span>
                <span className="hidden sm:inline text-[#5C7099]" aria-hidden="true">
                  /
                </span>
              </>
            )}
            <h1 className="font-display text-lg font-bold tracking-tight text-white truncate">
              {SECTION_TITLES[activeSection]}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-3">
            {openBlockers > 0 && (
              <span className="text-xs font-mono text-[#FFB800] tabular-nums whitespace-nowrap">
                {openBlockers} bloqueio{openBlockers > 1 ? 's' : ''} aberto{openBlockers > 1 ? 's' : ''}
              </span>
            )}
            <select
              value={activeRepoId}
              onChange={(e) => onSelectRepo(e.target.value)}
              className="input !py-2 !px-3.5 !text-xs font-mono max-w-[230px] !rounded-2xl"
              aria-label="Selecionar repositório ativo"
            >
              {repositories.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onOpenConnectRepo}
            className="btn btn-primary !rounded-2xl !px-4 !py-2 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Conectar Repositório</span>
          </button>
        </div>
      </div>
    </header>
  );
}
