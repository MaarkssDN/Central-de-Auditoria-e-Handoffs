import { Menu, Plus, Radio } from 'lucide-react';
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
  central: 'Central de Auditoria',
  bots: 'Personagens e Bots',
  ondas: 'Ondas e Missões',
  handoffs: 'Central de Handoffs',
  auditoria: 'Auditoria e Parecer 24',
  agentes: 'Agentes e Propriedade',
  repositorios: 'Repositórios Conectados',
};

const SECTION_CODES: Record<NavSection, string> = {
  central: 'SEC-CEN',
  bots: 'SEC-BOT',
  ondas: 'SEC-OND',
  handoffs: 'SEC-HND',
  auditoria: 'SEC-AUD',
  agentes: 'SEC-AGT',
  repositorios: 'SEC-REP',
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
    <header className="sticky top-0 z-30 border-b border-ink-700/70 bg-ink-950/85 backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 lg:px-8 h-16 max-w-[1600px] mx-auto w-full">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Abrir menu"
          className="lg:hidden p-2 -ml-2 text-paper-400 hover:text-paper-100 rounded-md"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-baseline gap-3 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-signal-400/90 hidden sm:block">
            {SECTION_CODES[activeSection]}
          </span>
          <h1 className="font-display text-lg font-semibold tracking-tight text-paper-100 truncate">
            {SECTION_TITLES[activeSection]}
          </h1>
        </div>

        <div className="flex-1" />

        {/* Repo selector */}
        <div className="hidden md:flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-paper-500" />
          <select
            value={activeRepoId}
            onChange={(e) => onSelectRepo(e.target.value)}
            className="input !py-1.5 !text-xs font-mono max-w-[220px]"
            aria-label="Repositório ativo"
          >
            {repositories.map((r) => (
              <option key={r.id} value={r.id}>
                {r.fullName}
              </option>
            ))}
          </select>
          {openBlockers > 0 && (
            <span className="chip" data-tone="amber">
              {openBlockers} bloqueio{openBlockers > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <button type="button" onClick={onOpenConnectRepo} className="btn !px-3 !py-1.5">
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Repo</span>
        </button>
      </div>
    </header>
  );
}
