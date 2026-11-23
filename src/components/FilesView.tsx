import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileCode2,
  FilePlus2,
  Folder,
  FolderOpen,
  HardDrive,
  Loader2,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

// Navegador/editor de arquivos locais — usa /api/fs (raízes permitidas no servidor).

interface FsEntry { name: string; path: string; type: 'dir' | 'file'; size: number }
interface FsRoot { path: string }

function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const TEXT_EXT = /\.(ts|tsx|js|jsx|json|md|mdx|css|scss|html|py|rs|go|java|c|cpp|h|hpp|cs|rb|php|swift|kt|yml|yaml|toml|ini|cfg|env|txt|sql|sh|ps1|vue|svelte)$/i;

interface FileAuditResult {
  filePath: string;
  ownerAgentId: string;
  ownerAgentName: string;
  ownershipExplanation: string;
  complianceRating: 'CONFORME' | 'ATENCAO' | 'VIOLACAO';
  blockersIdentified: Array<{
    code: string;
    title: string;
    severity: 'alta' | 'media' | 'baixa';
    description: string;
  }>;
  findings: string[];
  recommendations: string[];
  suggestedHandoff?: {
    toAgentId: string;
    slug: string;
    priority: 'bloqueador' | 'alto' | 'normal';
    problem: string;
    requiredChange: string;
  };
}

export function FilesView() {
  const [roots, setRoots] = useState<FsRoot[]>([]);
  const [customRoots, setCustomRoots] = useState<{ path: string; label: string | null }[]>([]);
  const [cwd, setCwd] = useState('');
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [newRoot, setNewRoot] = useState('');
  const [activeFile, setActiveFile] = useState<{ path: string; content: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Gemini Code & Governance Audit
  const [auditResult, setAuditResult] = useState<FileAuditResult | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [showAuditPanel, setShowAuditPanel] = useState(false);

  async function auditFile() {
    if (!activeFile) return;
    setAuditing(true);
    setAuditError(null);
    setShowAuditPanel(true);
    try {
      const res = await fetch('/api/gemini/audit-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: activeFile.path,
          content: activeFile.content,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `Erro HTTP ${res.status}`);
      }
      const data = (await res.json()) as FileAuditResult;
      setAuditResult(data);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : 'Falha ao auditar arquivo.');
    } finally {
      setAuditing(false);
    }
  }

  const loadRoots = useCallback(async () => {
    const res = await fetch('/api/fs/roots');
    const data = (await res.json()) as { roots: FsRoot[]; custom: { path: string; label: string | null }[] };
    setRoots(data.roots);
    setCustomRoots(data.custom);
    if (!cwd && data.roots[0]) navigate(data.roots[0].path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd]);

  useEffect(() => { loadRoots(); }, [loadRoots]);

  async function navigate(dir: string) {
    setError(null);
    try {
      const res = await fetch(`/api/fs/list?path=${encodeURIComponent(dir)}`);
      const data = (await res.json()) as { entries?: FsEntry[]; error?: string };
      if (!res.ok) { setError(data.error || 'Falha ao listar.'); return; }
      setCwd(dir);
      setEntries(data.entries || []);
      setActiveFile(null);
      setDirty(false);
    } catch {
      setError('Falha de rede.');
    }
  }

  async function openFileAt(path: string) {
    setError(null);
    try {
      const res = await fetch(`/api/fs/read?path=${encodeURIComponent(path)}`);
      const data = (await res.json()) as { content?: string; error?: string };
      if (!res.ok) { setError(data.error || 'Falha ao ler.'); return; }
      setActiveFile({ path, content: data.content || '' });
      setDirty(false);
      setAuditResult(null);
      setShowAuditPanel(false);
    } catch {
      setError('Falha de rede.');
    }
  }

  async function saveFile() {
    if (!activeFile) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/fs/write', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: activeFile.path, content: activeFile.content }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setError(data.error || 'Falha ao salvar.'); return; }
      setDirty(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1600);
    } finally {
      setSaving(false);
    }
  }

  // Ctrl+S salva
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (activeFile && dirty) void saveFile();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile, dirty]);

  async function addRoot() {
    if (!newRoot.trim()) return;
    await fetch('/api/fs/roots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: newRoot.trim() }),
    });
    setNewRoot('');
    await loadRoots();
  }

  async function removeRoot(path: string) {
    await fetch('/api/fs/roots', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    await loadRoots();
  }

  const breadcrumbs = cwd.split(/[\\/]/).filter(Boolean);
  const fileName = activeFile?.path.split(/[\\/]/).pop() || '';
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
  const stats = useMemo(() => {
    if (!activeFile) return null;
    const lines = activeFile.content.split('\n').length;
    return { lines, chars: activeFile.content.length, size: formatSize(new Blob([activeFile.content]).size) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile?.content]);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1)),
    [entries],
  );

  return (
    <div className="space-y-4 rise-in">
      <div>
        <h2 className="font-display text-xl font-bold text-accent-cyan">Arquivos Locais</h2>
        <p className="text-xs text-accent-cyan/70 mt-1">
          Leitura e edição restritas às raízes permitidas no servidor.
        </p>
      </div>

      {/* Raízes */}
      <div className="panel p-3 flex flex-wrap items-center gap-2">
        {roots.map((r) => (
          <button
            key={r.path}
            type="button"
            onClick={() => navigate(r.path)}
            className={`chip cursor-pointer transition-colors ${cwd === r.path ? '!border-accent-cyan !text-accent-cyan' : 'hover:!border-accent-cyan/60'}`}
          >
            <HardDrive className="w-3 h-3" /> {r.path}
          </button>
        ))}
        <span className="flex items-center gap-1 ml-auto">
          <input
            className="input !py-1 text-xs w-56"
            placeholder="Adicionar raiz (ex.: C:\Github)"
            value={newRoot}
            onChange={(e) => setNewRoot(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRoot()}
          />
          <button type="button" className="btn !py-1" onClick={addRoot}>
            <FilePlus2 className="w-3.5 h-3.5" /> Add
          </button>
        </span>
      </div>

      {customRoots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customRoots.map((r) => (
            <span key={r.path} className="chip">
              {r.label || r.path}
              <button type="button" onClick={() => removeRoot(r.path)} aria-label="Remover raiz" className="hover:text-alert-400">
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <div className="p-3 bg-alert-500/10 border border-alert-500/30 rounded-xl text-xs text-alert-400 font-mono">{error}</div>}

      {activeFile ? (
        /* ── Editor de código ── */
        <div className="panel panel-corner overflow-hidden flex flex-col">
          {/* Titlebar do editor */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-ink-700 bg-ink-900/70">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-alert-500/80" />
              <span className="w-3 h-3 rounded-full bg-amberx-500/80" />
              <span className="w-3 h-3 rounded-full bg-ok-400/80" />
            </div>
            <FileCode2 className="w-4 h-4 text-accent-cyan" />
            <div className="flex-1 min-w-0">
              <span className="font-mono text-xs font-semibold text-accent-cyan">{fileName}</span>
              {ext && <span className="ml-2 chip !py-0 !px-1.5 text-[9px] uppercase">{ext}</span>}
              <span className="ml-2 font-mono text-[10px] text-paper-500 truncate hidden sm:inline" title={activeFile.path}>
                {activeFile.path}
              </span>
            </div>
            {dirty && <span className="w-2 h-2 rounded-full bg-amberx-400 dash-blink" title="Alterações não salvas" />}
            {savedFlash && <span className="text-[10px] font-mono font-bold text-ok-400">SALVO ✓</span>}
            <div className="flex gap-2">
              <button
                type="button"
                className="btn !py-1"
                onClick={() => {
                  setActiveFile(null);
                  setDirty(false);
                  setAuditResult(null);
                  setShowAuditPanel(false);
                }}
              >
                Voltar
              </button>
              <button
                type="button"
                className="btn !py-1 text-violet-300 border-violet-500/40 hover:bg-violet-500/10 flex items-center gap-1.5"
                disabled={auditing}
                onClick={auditFile}
              >
                {auditing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                )}
                <span>{auditing ? 'Auditando…' : 'Auditar com Gemini'}</span>
              </button>
              <button type="button" className="btn btn-primary !py-1" disabled={!dirty || saving} onClick={saveFile}>
                <Save className="w-3.5 h-3.5" /> {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>

          {/* Gemini File & Governance Audit Drawer */}
          {showAuditPanel && (
            <div className="border-b border-ink-700 bg-ink-900/95 p-4 space-y-3 font-sans text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-violet-400" />
                  <span className="font-semibold text-paper-100">
                    Auditoria de Código & Propriedade (§15) — Agente 24 (Gemini 4 Hydrogen)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAuditPanel(false)}
                  className="text-paper-500 hover:text-paper-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {auditing && (
                <div className="flex items-center gap-2 text-paper-400 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                  <span>Analisando conformidade com §15, isolamento de tenant e bloqueadores B-01..B-14...</span>
                </div>
              )}

              {auditError && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {auditError}
                </div>
              )}

              {auditResult && !auditing && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-paper-400">Proprietário §15:</span>
                    <span className="chip !py-0.5 !px-2 bg-violet-500/20 text-violet-300 border-violet-500/30 font-semibold">
                      Agente {auditResult.ownerAgentId} — {auditResult.ownerAgentName}
                    </span>
                    <span className="ml-auto font-mono text-[11px] text-paper-400">Classificação:</span>
                    <span
                      className={`chip !py-0.5 !px-2 font-bold ${
                        auditResult.complianceRating === 'CONFORME'
                          ? 'bg-ok-500/20 text-ok-400 border-ok-500/30'
                          : auditResult.complianceRating === 'ATENCAO'
                          ? 'bg-amberx-500/20 text-amberx-400 border-amberx-500/30'
                          : 'bg-alert-500/20 text-alert-400 border-alert-500/30'
                      }`}
                    >
                      {auditResult.complianceRating}
                    </span>
                  </div>

                  <p className="text-paper-300 text-[11px] bg-ink-950/60 p-2.5 rounded border border-ink-800">
                    <strong>Justificativa §15:</strong> {auditResult.ownershipExplanation}
                  </p>

                  {auditResult.blockersIdentified.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-alert-400">
                        Bloqueadores Detectados:
                      </span>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {auditResult.blockersIdentified.map((b, i) => (
                          <div
                            key={i}
                            className="p-2 rounded bg-alert-500/10 border border-alert-500/25 text-[11px] space-y-0.5"
                          >
                            <div className="flex items-center justify-between font-semibold text-alert-300">
                              <span>{b.code}: {b.title}</span>
                              <span className="text-[9px] uppercase px-1 rounded bg-alert-500/30">{b.severity}</span>
                            </div>
                            <p className="text-paper-300 text-[10px]">{b.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {auditResult.recommendations.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-paper-200">Recomendações Técnicas:</span>
                      <ul className="list-disc list-inside text-[11px] text-paper-300 space-y-0.5">
                        {auditResult.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {auditResult.suggestedHandoff && (
                    <div className="p-2.5 rounded bg-sky-500/10 border border-sky-500/30 flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-sky-300 text-xs">Handoff Sugerido:</span>
                        <p className="text-[11px] text-paper-200">
                          Abrir para <strong>Agente {auditResult.suggestedHandoff.toAgentId}</strong>: {auditResult.suggestedHandoff.problem}
                        </p>
                      </div>
                      <span className="chip bg-sky-500/20 text-sky-300 border-sky-500/40 text-[10px]">
                        {auditResult.suggestedHandoff.priority}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <textarea
            className="input w-full font-mono text-[13px] !leading-relaxed !rounded-none !border-0 !bg-ink-950/80 focus:!shadow-none resize-none"
            style={{ minHeight: '62vh', tabSize: 2 }}
            value={activeFile.content}
            onChange={(e) => { setActiveFile({ ...activeFile, content: e.target.value }); setDirty(true); setSavedFlash(false); }}
            spellCheck={false}
          />
          {/* Status bar */}
          {stats && (
            <div className="flex items-center gap-4 px-4 py-1.5 border-t border-ink-700 bg-ink-900/70 font-mono text-[10px] text-paper-400">
              <span className="text-accent-cyan font-semibold uppercase">{ext || 'txt'}</span>
              <span>{stats.lines} linhas</span>
              <span>{stats.chars.toLocaleString('pt-BR')} chars</span>
              <span>{stats.size}</span>
              <span className="ml-auto flex items-center gap-1.5">
                {dirty ? (
                  <><span className="w-1.5 h-1.5 rounded-full bg-amberx-400" /> modificado</>
                ) : (
                  <><span className="w-1.5 h-1.5 rounded-full bg-ok-400" /> salvo</>
                )}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* ── Visualizador de pastas ── */
        <div className="panel panel-corner overflow-hidden">
          {/* Breadcrumb */}
          <div className="px-4 py-2.5 border-b border-ink-700 bg-ink-900/60 flex items-center gap-1 flex-wrap">
            <HardDrive className="w-3.5 h-3.5 text-accent-cyan" />
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-paper-500 mx-0.5">/</span>
                <button
                  type="button"
                  className={`text-xs font-mono transition-colors ${
                    i === breadcrumbs.length - 1 ? 'text-accent-cyan font-bold' : 'text-paper-400 hover:text-accent-cyan'
                  }`}
                  onClick={() => navigate(breadcrumbs.slice(0, i + 1).join(b.includes(':') ? '\\' : '/'))}
                >
                  {b}
                </button>
              </span>
            ))}
            <span className="ml-auto text-[10px] font-mono text-paper-500">{entries.length} item(ns)</span>
          </div>
          {/* Lista */}
          <div className="divide-y divide-ink-800/70 max-h-[62vh] overflow-y-auto">
            {sortedEntries.map((e) => {
              const isCode = e.type === 'file' && TEXT_EXT.test(e.name);
              return (
                <button
                  key={e.path}
                  type="button"
                  onClick={() => (e.type === 'dir' ? navigate(e.path) : openFileAt(e.path))}
                  className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-accent-cyan/5 transition-colors group"
                >
                  {e.type === 'dir' ? (
                    <Folder className="w-4 h-4 text-accent-cyan shrink-0" />
                  ) : isCode ? (
                    <FileCode2 className="w-4 h-4 text-accent-violet shrink-0" />
                  ) : (
                    <FolderOpen className="w-4 h-4 text-paper-500 shrink-0" />
                  )}
                  <span className={`text-sm truncate flex-1 ${e.type === 'dir' ? 'text-accent-cyan font-semibold' : 'text-paper-200 group-hover:text-paper-100'}`}>
                    {e.name}
                  </span>
                  <span className="font-mono text-[10px] text-paper-500 w-16 text-right shrink-0">
                    {e.type === 'dir' ? 'DIR' : formatSize(e.size)}
                  </span>
                </button>
              );
            })}
            {entries.length === 0 && (
              <div className="px-4 py-10 text-center">
                <FolderOpen className="w-8 h-8 text-paper-500 mx-auto mb-2" />
                <div className="text-xs text-paper-500 font-mono">Diretório vazio</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
