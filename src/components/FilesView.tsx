import { useCallback, useEffect, useState } from 'react';
import { FilePlus2, FolderOpen, Save, Trash2 } from 'lucide-react';

// Navegador/editor de arquivos locais — usa /api/fs (raízes permitidas no servidor).

interface FsEntry { name: string; path: string; type: 'dir' | 'file'; size: number }
interface FsRoot { path: string }

function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
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
    } finally {
      setSaving(false);
    }
  }

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

  return (
    <div className="space-y-4 rise-in">
      <div>
        <h2 className="font-display text-xl font-bold text-paper-100">Arquivos Locais</h2>
        <p className="text-xs text-paper-400 mt-1">
          Leitura e edição restritas às raízes permitidas no servidor.
        </p>
      </div>

      <div className="panel p-3 flex flex-wrap items-center gap-2">
        {roots.map((r) => (
          <button key={r.path} type="button" onClick={() => navigate(r.path)} className="chip hover:border-signal-500 cursor-pointer">
            <FolderOpen className="w-3 h-3" /> {r.path}
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

      {error && <div className="p-3 bg-alert-500/10 border border-alert-500/30 rounded text-xs text-alert-400 font-mono">{error}</div>}

      {activeFile ? (
        <div className="panel panel-corner p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="font-mono text-xs text-paper-300 truncate" title={activeFile.path}>{activeFile.path}</div>
            <div className="flex gap-2">
              <button type="button" className="btn !py-1" onClick={() => { setActiveFile(null); setDirty(false); }}>Voltar</button>
              <button type="button" className="btn btn-primary !py-1" disabled={!dirty || saving} onClick={saveFile}>
                <Save className="w-3.5 h-3.5" /> {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
          <textarea
            className="input w-full font-mono text-xs !leading-relaxed"
            style={{ minHeight: '60vh' }}
            value={activeFile.content}
            onChange={(e) => { setActiveFile({ ...activeFile, content: e.target.value }); setDirty(true); }}
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="panel panel-corner">
          <div className="px-4 py-2 border-b border-ink-700 font-mono text-[10px] uppercase tracking-wider text-paper-400 flex gap-1 flex-wrap">
            {breadcrumbs.map((b, i) => (
              <span key={i}>
                {i > 0 && <span className="text-paper-500 mx-1">/</span>}
                <button type="button" className="hover:text-signal-300" onClick={() => navigate(breadcrumbs.slice(0, i + 1).join(b.includes(':') ? '\\' : '/'))}>{b}</button>
              </span>
            ))}
          </div>
          <div className="divide-y divide-ink-800 max-h-[65vh] overflow-y-auto">
            {entries.map((e) => (
              <button
                key={e.path}
                type="button"
                onClick={() => (e.type === 'dir' ? navigate(e.path) : openFileAt(e.path))}
                className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-ink-800/60 transition-colors"
              >
                <span className="font-mono text-[10px] text-paper-500 w-14 text-right">{e.type === 'dir' ? 'DIR' : formatSize(e.size)}</span>
                <span className={`text-sm truncate ${e.type === 'dir' ? 'text-signal-300' : 'text-paper-200'}`}>
                  {e.type === 'dir' ? '📁 ' : '📄 '}{e.name}
                </span>
              </button>
            ))}
            {entries.length === 0 && <div className="px-4 py-8 text-center text-xs text-paper-500 font-mono">Diretório vazio</div>}
          </div>
        </div>
      )}
    </div>
  );
}
