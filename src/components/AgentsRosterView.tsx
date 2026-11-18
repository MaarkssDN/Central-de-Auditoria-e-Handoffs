import { useState } from 'react';
import { Bot, Lock, Search, ShieldAlert } from 'lucide-react';
import { CONSULTATION_MATRIX, OFFICIAL_AGENTS, RESERVED_AGENT_IDS } from '../data/agentsRoster';
import type { AgentCategory, RepositoryTarget } from '../types/governance';
import { resolveFileOwnership } from '../utils/governanceEngine';
import { AgentAvatar } from './AgentAvatar';

interface AgentsRosterViewProps {
  activeRepo?: RepositoryTarget;
  onActivateBot?: (agentId: string) => void;
}

const CATEGORY_LABELS: Record<AgentCategory, string> = {
  coordenacao: 'Coordenação',
  produto_engenharia: 'Produto, Engenharia e Operação',
  governanca: 'Especialistas de Governança',
};

export function AgentsRosterView({ activeRepo, onActivateBot }: AgentsRosterViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | AgentCategory>('all');
  const [filePathInput, setFilePathInput] = useState('prisma/schema.prisma');

  const filteredAgents = OFFICIAL_AGENTS.filter((agent) => {
    const matchesCategory = categoryFilter === 'all' || agent.category === categoryFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      agent.id.toLowerCase().includes(q) ||
      agent.name.toLowerCase().includes(q) ||
      agent.persona.codename.toLowerCase().includes(q) ||
      agent.persona.archetype.toLowerCase().includes(q) ||
      agent.summary.toLowerCase().includes(q) ||
      agent.exclusivePaths.some((p) => p.toLowerCase().includes(q));
    return matchesCategory && matchesQuery;
  });

  const ownershipResult = resolveFileOwnership(filePathInput);

  return (
    <div className="space-y-8">
      {/* File Ownership Resolver */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="text-base font-semibold text-slate-900">
              Verificador de Propriedade Exclusiva de Arquivos (§15)
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Informe qualquer caminho do repositório{activeRepo ? ` (${activeRepo.fullName})` : ''} para saber o proprietário exclusivo, regras de aprovação do Coordenador ou necessidade de handoff.
            </p>
          </div>
          <div className="w-full lg:w-96">
            <label htmlFor="ownership-path-input" className="block text-xs font-medium text-slate-700 mb-1">
              Caminho do arquivo
            </label>
            <input
              id="ownership-path-input"
              type="text"
              value={filePathInput}
              onChange={(e) => setFilePathInput(e.target.value)}
              placeholder="ex: src/App.tsx, server.ts, src/lib/queue/job.ts"
              className="w-full h-9 px-3 text-sm border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
          <div>
            <div className="text-xs text-slate-500">Proprietário identificado</div>
            <div className="text-sm font-semibold text-slate-900 mt-0.5">
              {ownershipResult.ownerLabel}
            </div>
            <div className="text-xs text-slate-600 mt-0.5">{ownershipResult.guidance}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              'prisma/schema.prisma',
              'src/App.tsx',
              'src/lib/queue/worker.ts',
              'server.ts',
              '.github/workflows/ci.yml',
              '.agents/prompts/24-revisao-independente.md',
            ].map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setFilePathInput(sample)}
                className="px-2.5 py-1 text-xs font-mono text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors max-w-full truncate"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Roster Header & Filters */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Roster Oficial de Agentes ({filteredAgents.length} de {OFFICIAL_AGENTS.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Agentes {RESERVED_AGENT_IDS.join(' e ')} não existem e permanecem reservados (§4).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md" role="tablist">
              {(['all', 'coordenacao', 'produto_engenharia', 'governanca'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={categoryFilter === cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    categoryFilter === cat
                      ? 'bg-white text-slate-900'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat === 'all' ? 'Todos' : CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <label htmlFor="agent-search" className="sr-only">
                Buscar agente
              </label>
              <input
                id="agent-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por ID, nome ou caminho..."
                className="h-9 pl-9 pr-3 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 w-64"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[780px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                <th className="py-3 px-4 w-20">ID</th>
                <th className="py-3 px-4">Personagem e Escopo</th>
                <th className="py-3 px-4">Propriedade / Restrições</th>
                <th className="py-3 px-4">Slot Exclusivo</th>
                <th className="py-3 px-4 text-right">Bot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredAgents.map((agent) => (
                <tr key={agent.id} className="hover:bg-slate-50 align-top">
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900 tabular-nums">
                    <div className="flex items-center gap-2">
                      <AgentAvatar agent={agent} size="sm" />
                      <span>{agent.id}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">
                      {agent.persona.codename} <span className="text-slate-400 font-normal">·</span>{' '}
                      {agent.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {agent.persona.archetype} · &ldquo;{agent.persona.motto}&rdquo;
                    </div>
                    <div className="text-xs text-slate-600 mt-1 max-w-xl">{agent.summary}</div>
                    <div className="text-xs font-mono text-slate-400 mt-1">{agent.promptFile}</div>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    {agent.exclusivePaths.length > 0 ? (
                      <div className="space-y-0.5 font-mono text-slate-700">
                        {agent.exclusivePaths.map((path) => (
                          <div key={path}>{path}</div>
                        ))}
                      </div>
                    ) : agent.cannotEditCode ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                        <Lock className="w-3.5 h-3.5" />
                        Somente auditoria / evidência
                      </span>
                    ) : (
                      <span className="text-slate-500">Conforme matriz da onda</span>
                    )}
                    {agent.requiresCoordinatorApprovalFor && (
                      <div className="text-slate-500 mt-1">
                        Aprova: <span className="font-mono">{agent.requiresCoordinatorApprovalFor.join(', ')}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    {agent.exclusiveSlotWith.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-red-700 font-medium font-mono">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Exclusivo com {agent.exclusiveSlotWith.join(', ')}
                      </span>
                    ) : agent.queueConflictOnQueueFiles ? (
                      <span className="text-amber-700 font-medium">
                        Conflito em src/lib/queue/**
                      </span>
                    ) : (
                      <span className="text-slate-400">Sem bloqueio de slot</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {onActivateBot && (
                      <button
                        type="button"
                        onClick={() => onActivateBot(agent.id)}
                        className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-100 rounded-md whitespace-nowrap"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        <span>Acionar</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Consultation Matrix */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="text-base font-semibold text-slate-900">
          Matriz de Consulta Obrigatória entre Agentes (§6.3)
        </h3>
        <p className="text-xs text-slate-500 mt-0.5 mb-4">
          Consultar outro agente garante rastreabilidade, mas não transfere automaticamente a responsabilidade pela missão.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CONSULTATION_MATRIX.map((rule) => (
            <div key={rule.trigger} className="p-3.5 bg-slate-50 border border-slate-200 rounded-md">
              <div className="text-xs font-medium text-slate-900">{rule.trigger}</div>
              <div className="text-xs text-slate-600 mt-1">
                Consultar: <span className="font-mono font-semibold text-slate-900">Agente {rule.consultAgent}</span> · {rule.reason}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
