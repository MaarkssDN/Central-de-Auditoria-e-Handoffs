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
  bots: 'Personagens e Bots',
  ondas: 'Ondas e Missões',
  handoffs: 'Central de Handoffs',
  auditoria: 'Auditoria e Parecer 24',
  agentes: 'Agentes e Propriedade',
  repositorios: 'Repositórios Conectados',
};

export function TopBar({
  activeSection,
  repositories,
  activeRepoId,
  onSelectRepo,
  onOpenConnectRepo,
  onOpenMobileMenu,
}: TopBarProps) {
  const activeRepo = repositories.find((r) => r.id === activeRepoId);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Abrir menu lateral"
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-500 hidden sm:inline whitespace-nowrap shrink-0">
            {activeRepo ? activeRepo.fullName : 'Sem repositório'}
          </span>
          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <h1 className="font-semibold text-slate-900 truncate">
            {SECTION_TITLES[activeSection]}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <label htmlFor="repo-switcher" className="sr-only">
          Selecionar repositório ativo
        </label>
        <select
          id="repo-switcher"
          value={activeRepoId}
          onChange={(e) => onSelectRepo(e.target.value)}
          className="hidden md:block h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 max-w-[220px]"
        >
          {repositories.map((repo) => (
            <option key={repo.id} value={repo.id}>
              {repo.fullName}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onOpenConnectRepo}
          className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Conectar Repositório</span>
        </button>
      </div>
    </header>
  );
}
