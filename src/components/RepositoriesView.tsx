import { useState } from 'react';
import { Check, FolderGit2, RefreshCw, Trash2 } from 'lucide-react';
import type { RepositoryTarget } from '../types/governance';
import { resolveFileOwnership } from '../utils/governanceEngine';

interface RepositoriesViewProps {
  repositories: RepositoryTarget[];
  activeRepoId: string;
  onSelectRepo: (repoId: string) => void;
  onOpenConnectModal: () => void;
  onSyncGitHubRepo: (repo: RepositoryTarget) => Promise<string | null>;
  onRemoveRepo: (repoId: string) => void;
}

export function RepositoriesView({
  repositories,
  activeRepoId,
  onSelectRepo,
  onOpenConnectModal,
  onSyncGitHubRepo,
  onRemoveRepo,
}: RepositoriesViewProps) {
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const activeRepo = repositories.find((r) => r.id === activeRepoId);

  async function handleSync(repo: RepositoryTarget) {
    setSyncError(null);
    setSyncingId(repo.id);
    const err = await onSyncGitHubRepo(repo);
    setSyncingId(null);
    if (err) setSyncError(err);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-400 mb-1">SEC-REP · Contexto</div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-paper-100">Repositórios sob Orquestração</h2>
          <p className="text-sm text-paper-400 mt-1 max-w-2xl">
            Alterne o contexto ativo ou conecte qualquer repositório GitHub/local para aplicar a matriz de propriedade, gates e handoffs.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenConnectModal}
          className="h-9 px-4 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md whitespace-nowrap shrink-0"
        >
          Conectar Novo Repositório
        </button>
      </div>

      {syncError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {syncError}
        </div>
      )}

      <div className="panel overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[680px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
              <th className="py-3 px-4">Repositório</th>
              <th className="py-3 px-4">Origem</th>
              <th className="py-3 px-4">AGENTS.md</th>
              <th className="py-3 px-4 text-right">Scripts</th>
              <th className="py-3 px-4 text-right">Arquivos Mapeados</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {repositories.map((repo) => {
              const isActive = repo.id === activeRepoId;
              return (
                <tr key={repo.id} className={isActive ? 'bg-slate-50/80' : 'hover:bg-slate-50'}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 font-medium text-slate-900">
                      <FolderGit2 className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="font-mono">{repo.fullName}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 font-mono">
                      Branch padrão: {repo.defaultBranch} · {repo.branches.length} branch(es)
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {repo.sourceType === 'github' ? 'GitHub API' : 'Configuração Manual'}
                  </td>
                  <td className="py-3 px-4">
                    <span className={repo.detectedAgentsMd ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                      {repo.detectedAgentsMd ? 'Detectado' : 'Não detectado'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                    {Object.keys(repo.packageScripts).length}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                    {repo.samplePaths.length}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 px-2.5 py-1">
                          <Check className="w-3.5 h-3.5" />
                          Ativo
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectRepo(repo.id)}
                          className="h-8 px-3 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-100 rounded-md"
                        >
                          Selecionar
                        </button>
                      )}

                      {repo.sourceType === 'github' && (
                        <button
                          type="button"
                          onClick={() => handleSync(repo)}
                          disabled={syncingId === repo.id}
                          aria-label={`Sincronizar ${repo.fullName}`}
                          className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
                        >
                          <RefreshCw className={`w-4 h-4 ${syncingId === repo.id ? 'animate-spin' : ''}`} />
                        </button>
                      )}

                      {repositories.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveRepo(repo.id)}
                          aria-label={`Remover ${repo.fullName}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {activeRepo && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="panel p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Scripts Detectados em package.json
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">
              Utilizados pelo Gate Runner (§29) para não mascarar scripts ausentes.
            </p>
            {Object.keys(activeRepo.packageScripts).length === 0 ? (
              <div className="text-sm text-slate-500 py-4 border-t border-slate-100">
                Nenhum script encontrado em package.json deste repositório.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {Object.entries(activeRepo.packageScripts).map(([key, cmd]) => (
                  <div key={key} className="py-2 flex items-center justify-between gap-4 text-xs">
                    <span className="font-mono font-medium text-slate-800">{key}</span>
                    <span className="font-mono text-slate-500 truncate">{cmd}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Árvore Mapeada e Propriedade Automática (§15)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">
              Amostra de arquivos inspecionados com resolução imediata de proprietário.
            </p>
            {activeRepo.samplePaths.length === 0 ? (
              <div className="text-sm text-slate-500 py-4 border-t border-slate-100">
                Nenhum caminho mapeado neste repositório.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border-t border-slate-100">
                {activeRepo.samplePaths.slice(0, 30).map((filePath) => {
                  const resolved = resolveFileOwnership(filePath);
                  return (
                    <div key={filePath} className="py-2 flex items-center justify-between gap-3 text-xs">
                      <span className="font-mono text-slate-800 truncate">{filePath}</span>
                      <span className="text-slate-500 whitespace-nowrap shrink-0">
                        {resolved.ownerAgentIds.length > 0
                          ? `Agente ${resolved.ownerAgentIds.join(' / ')}`
                          : resolved.ruleType === 'decisao_humana'
                            ? 'Humano'
                            : 'Matriz'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
