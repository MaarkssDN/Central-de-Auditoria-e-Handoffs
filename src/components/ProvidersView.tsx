import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, PlugZap, RefreshCw, Send, XCircle } from 'lucide-react';

// Conexões de IA — catálogo dos 8 providers que a Central pode acionar.
// Status vem de GET /api/providers (detectado/configurado/mock/indisponivel).
// API keys e modelos ficam em SQLite local (data/central.db), nunca no repo.

interface ProviderInfo {
  def: { id: string; nome: string; kind: 'cli' | 'api' | 'manual'; descricao: string; envKeys?: string[]; defaultModel?: string };
  status: 'configurado' | 'detectado' | 'mock' | 'indisponivel';
  binarios: { cmd: string; path: string }[];
  model?: string;
  hasKey: boolean;
  enabled: boolean;
}

const STATUS_LABEL: Record<ProviderInfo['status'], string> = {
  configurado: 'Configurado',
  detectado: 'Detectado',
  mock: 'Mock',
  indisponivel: 'Indisponível',
};

const STATUS_TONE: Record<ProviderInfo['status'], 'ok' | 'signal' | 'amber' | 'alert'> = {
  configurado: 'ok',
  detectado: 'signal',
  mock: 'amber',
  indisponivel: 'alert',
};

export function ProvidersView() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [models, setModels] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; output: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/providers');
      const data = (await res.json()) as { providers: ProviderInfo[] };
      setProviders(data.providers || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveProvider(p: ProviderInfo) {
    setSaving(p.def.id);
    try {
      await fetch(`/api/providers/${p.def.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: keys[p.def.id] ?? '',
          model: models[p.def.id] ?? '',
        }),
      });
      await load();
    } finally {
      setSaving(null);
    }
  }

  async function toggleProvider(p: ProviderInfo) {
    await fetch(`/api/providers/${p.def.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !p.enabled }),
    });
    await load();
  }

  async function testProvider(p: ProviderInfo) {
    setTesting(p.def.id);
    setTestResult((prev) => ({ ...prev, [p.def.id]: { ok: true, output: 'testando…' } }));
    try {
      const res = await fetch(`/api/providers/${p.def.id}/test`, { method: 'POST' });
      const data = (await res.json()) as { ok: boolean; output: string; mode: string };
      setTestResult((prev) => ({ ...prev, [p.def.id]: { ok: data.ok, output: `[${data.mode}] ${data.output}` } }));
    } catch (e) {
      setTestResult((prev) => ({ ...prev, [p.def.id]: { ok: false, output: String(e) } }));
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="space-y-6 rise-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-accent-violet">Conexões de IA</h2>
          <p className="text-xs text-accent-violet/70 mt-1">
            Providers que a Central pode acionar. Sem credencial, cada um responde em modo mock.
          </p>
        </div>
        <button type="button" onClick={load} className="btn" aria-label="Recarregar">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="panel p-6 text-sm text-paper-400 font-mono">Carregando providers…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {providers.map((p) => (
            <div key={p.def.id} className="panel panel-corner p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-semibold text-accent-violet">{p.def.nome}</h3>
                    <span className="chip" data-tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</span>
                    <span className="chip">{p.def.kind}</span>
                  </div>
                  <p className="text-xs text-accent-violet/70 mt-1">{p.def.descricao}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleProvider(p)}
                  className={`chip cursor-pointer ${p.enabled ? '' : 'opacity-40'}`}
                  title={p.enabled ? 'Desabilitar' : 'Habilitar'}
                >
                  {p.enabled ? 'on' : 'off'}
                </button>
              </div>

              {p.binarios.length > 0 && (
                <p className="font-mono text-[10px] text-paper-500">
                  bin: {p.binarios.map((b) => `${b.cmd} → ${b.path}`).join(' · ')}
                </p>
              )}

              {p.def.kind === 'api' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="password"
                    className="input"
                    placeholder={p.hasKey ? '•••••••• (salva — digite para trocar)' : `API key (${(p.def.envKeys || []).join(' ou ')})`}
                    value={keys[p.def.id] || ''}
                    onChange={(e) => setKeys((prev) => ({ ...prev, [p.def.id]: e.target.value }))}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder={`modelo (default: ${p.def.defaultModel || '—'})`}
                    value={models[p.def.id] || ''}
                    onChange={(e) => setModels((prev) => ({ ...prev, [p.def.id]: e.target.value }))}
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                {p.def.kind === 'api' && (
                  <button type="button" className="btn" disabled={saving === p.def.id} onClick={() => saveProvider(p)}>
                    {saving === p.def.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
                    Salvar
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  disabled={testing === p.def.id || !p.enabled}
                  onClick={() => testProvider(p)}
                >
                  {testing === p.def.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Testar
                </button>
              </div>

              {testResult[p.def.id] && (
                <pre className="text-[11px] font-mono text-paper-300 bg-ink-850 border border-ink-700 rounded p-2 whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {testResult[p.def.id].ok ? <CheckCircle2 className="w-3 h-3 inline mr-1 text-ok-400" /> : <XCircle className="w-3 h-3 inline mr-1 text-alert-400" />}
                  {testResult[p.def.id].output}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
