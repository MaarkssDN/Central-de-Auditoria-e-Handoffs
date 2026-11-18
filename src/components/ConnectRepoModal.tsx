import { useState, type FormEvent } from 'react';
import { X, Loader2, GitBranch } from 'lucide-react';
import { DEFAULT_PRIORITY_BLOCKERS } from '../data/agentsRoster';
import type { RepositoryTarget, Wave } from '../types/governance';
import { buildGatesForRepoScripts } from '../utils/governanceEngine';

interface ConnectRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRepository: (repo: RepositoryTarget, initialWave: Wave) => void;
}

export function ConnectRepoModal({
  isOpen,
  onClose,
  onAddRepository,
}: ConnectRepoModalProps) {
  const [mode, setMode] = useState<'github' | 'manual'>('github');
  const [githubInput, setGithubInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [manualFullName, setManualFullName] = useState('');
  const [manualBranch, setManualBranch] = useState('main');
  const [manualScriptsText, setManualScriptsText] = useState('lint, test:unit, build');
  const [manualPathsText, setManualPathsText] = useState(
    'AGENTS.md\nprisma/schema.prisma\nsrc/App.tsx\nsrc/lib/queue/worker.ts\n.github/workflows/ci.yml\nserver.ts'
  );
  const [manualHasAgentsMd, setManualHasAgentsMd] = useState(true);

  if (!isOpen) return null;

  async function handleGitHubSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!githubInput.trim()) {
      setError('Informe o repositório no formato owner/repo ou URL do GitHub.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/github/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoInput: githubInput.trim() }),
      });
      const data = (await response.json()) as {
        error?: string;
        repository?: RepositoryTarget;
        initialWave?: Wave;
      };
      if (!response.ok || !data.repository || !data.initialWave) {
        setError(data.error || 'Não foi possível inspecionar o repositório no GitHub.');
        return;
      }
      onAddRepository(data.repository, data.initialWave);
      setGithubInput('');
      onClose();
    } catch {
      setError('Falha de rede ao consultar o servidor de inspeção.');
    } finally {
      setLoading(false);
    }
  }

  function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cleaned = manualFullName.trim();
    if (!cleaned || !cleaned.includes('/')) {
      setError('Informe o identificador do repositório no formato organizacao/repositorio.');
      return;
    }

    const namePart = cleaned.split('/').pop() || cleaned;
    const repoId = `repo-${cleaned.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;

    const scriptKeys = manualScriptsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const packageScripts: Record<string, string> = {};
    for (const key of scriptKeys) {
      packageScripts[key] = `configured (${key})`;
    }

    const samplePaths = manualPathsText
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean);

    const newRepo: RepositoryTarget = {
      id: repoId,
      name: namePart,
      fullName: cleaned,
      sourceType: 'manual',
      defaultBranch: manualBranch.trim() || 'main',
      branches: [manualBranch.trim() || 'main', 'integracao/onda-1'],
      detectedAgentsMd: manualHasAgentsMd,
      agentsMdRevision: manualHasAgentsMd ? '2026-10-09' : undefined,
      packageScripts,
      samplePaths,
      existingHandoffFiles: samplePaths.filter((p) => p.startsWith('.agents/handoffs/')),
      existingReviewFiles: samplePaths.filter((p) => p.startsWith('.agents/reviews/')),
      lastSyncedAt: new Date().toISOString(),
      blockers: DEFAULT_PRIORITY_BLOCKERS.map((b) => ({ ...b, status: 'aberto' })),
    };

    const initialWave: Wave = {
      id: `wave-${repoId}-1`,
      repoId,
      number: 1,
      name: `Onda 1 — Auditoria e Orquestração (${namePart})`,
      integrationBranch: 'integracao/onda-1',
      state: 'PLANEJADA',
      scopeFreezeActive: false,
      activeAgentIds: ['00'],
      mergesSinceLastGate: 0,
      gates: buildGatesForRepoScripts(packageScripts),
      createdAt: new Date().toISOString(),
    };

    onAddRepository(newRepo, initialWave);
    setManualFullName('');
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-repo-title"
    >
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="connect-repo-title" className="text-base font-semibold text-slate-900">
              Conectar Repositório para Orquestração
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspecione um repositório público do GitHub ou configure manualmente qualquer repositório local/privado.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de conexão"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="inline-flex p-1 bg-slate-100 rounded-md" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'github'}
              onClick={() => {
                setMode('github');
                setError(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                mode === 'github' ? 'bg-white text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              GitHub Público
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'manual'}
              onClick={() => {
                setMode('manual');
                setError(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                mode === 'manual' ? 'bg-white text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Configuração Manual / Privado
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
            {error}
          </div>
        )}

        {mode === 'github' ? (
          <form onSubmit={handleGitHubSubmit} className="p-6 space-y-4">
            <div>
              <label htmlFor="github-repo-input" className="block text-sm font-medium text-slate-800 mb-1.5">
                Repositório GitHub (owner/repo ou URL)
              </label>
              <input
                id="github-repo-input"
                type="text"
                value={githubInput}
                onChange={(e) => setGithubInput(e.target.value)}
                placeholder="ex: vercel/next.js ou https://github.com/org/repo"
                className="w-full h-10 px-3 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                A inspeção lê branches, árvore de diretórios, scripts do package.json, AGENTS.md e pastas .agents/.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-md"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
                <span>{loading ? 'Inspecionando...' : 'Inspecionar e Conectar'}</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleManualSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="manual-repo-name" className="block text-sm font-medium text-slate-800 mb-1">
                  Identificador (org/repo)
                </label>
                <input
                  id="manual-repo-name"
                  type="text"
                  value={manualFullName}
                  onChange={(e) => setManualFullName(e.target.value)}
                  placeholder="minha-org/meu-servico"
                  className="w-full h-9 px-3 text-sm border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label htmlFor="manual-repo-branch" className="block text-sm font-medium text-slate-800 mb-1">
                  Branch padrão
                </label>
                <input
                  id="manual-repo-branch"
                  type="text"
                  value={manualBranch}
                  onChange={(e) => setManualBranch(e.target.value)}
                  className="w-full h-9 px-3 text-sm border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label htmlFor="manual-scripts" className="block text-sm font-medium text-slate-800 mb-1">
                Scripts existentes em package.json (separados por vírgula)
              </label>
              <input
                id="manual-scripts"
                type="text"
                value={manualScriptsText}
                onChange={(e) => setManualScriptsText(e.target.value)}
                placeholder="lint, test:unit, test:e2e, build"
                className="w-full h-9 px-3 text-sm border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <p className="text-xs text-slate-500 mt-1">
                Scripts ausentes serão marcados automaticamente como NAO_APLICAVEL (§29).
              </p>
            </div>

            <div>
              <label htmlFor="manual-paths" className="block text-sm font-medium text-slate-800 mb-1">
                Caminhos principais do repositório (1 por linha)
              </label>
              <textarea
                id="manual-paths"
                rows={4}
                value={manualPathsText}
                onChange={(e) => setManualPathsText(e.target.value)}
                className="w-full p-3 text-xs border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={manualHasAgentsMd}
                onChange={(e) => setManualHasAgentsMd(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Aplicar governança AGENTS.md na raiz deste repositório</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="h-9 px-4 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md"
              >
                Adicionar Repositório
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
