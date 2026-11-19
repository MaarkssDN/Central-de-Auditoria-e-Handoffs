import { useState, type FormEvent } from 'react';
import { Radar } from 'lucide-react';

interface LoginModalProps {
  onSuccess: () => void;
}

export function LoginModal({ onSuccess }: LoginModalProps) {
  const [email, setEmail] = useState('marcelinmark@gmail.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || 'Falha ao autenticar.');
        return;
      }
      onSuccess();
    } catch {
      setError('Servidor indisponível.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-sm">
      <div className="panel panel-corner w-full max-w-sm p-6 rise-in" role="dialog" aria-modal="true" aria-label="Login">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg border border-signal-500/50 bg-ink-800 grid place-items-center">
            <Radar className="w-5 h-5 text-signal-400" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-paper-100">Central de Auditoria</h1>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper-400">Acesso restrito</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block font-mono text-[10px] uppercase tracking-wider text-paper-400 mb-1.5">
              E-mail
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="username"
              className="input w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block font-mono text-[10px] uppercase tracking-wider text-paper-400 mb-1.5">
              Senha
            </label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              className="input w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-xs text-alert-400 font-mono" role="alert">{error}</p>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-4 text-[10px] font-mono text-paper-500 text-center">
          Acesso local · sessão neste dispositivo
        </p>
      </div>
    </div>
  );
}
