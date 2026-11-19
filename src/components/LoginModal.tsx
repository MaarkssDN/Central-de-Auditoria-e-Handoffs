import { useState, type FormEvent } from 'react';
import { Clapperboard, ArrowLeft } from 'lucide-react';

interface LoginModalProps {
  onSuccess: () => void;
  onBack?: () => void;
}

export function LoginModal({ onSuccess, onBack }: LoginModalProps) {
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
    <div className="film-login-wrap">
      <div className="film-login-card" role="dialog" aria-modal="true" aria-label="Login">
        <div className="film-login-brand">
          <span className="film-brand-mark"><Clapperboard className="w-5 h-5" strokeWidth={2.2} /></span>
          <div>
            <h1 className="film-login-title">Central de Auditoria</h1>
            <p className="film-login-sub">Acesso restrito · SC 02 — PALCO EXTERNO</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="film-login-label" htmlFor="login-email">E-mail</label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="username"
            className="film-login-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="film-login-label" htmlFor="login-password">Senha</label>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            className="film-login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="film-login-error" role="alert">✗ {error}</p>}

          <button type="submit" disabled={loading} className="film-btn film-btn-tally w-full" style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? 'Entrando…' : 'Cortar — entrar'}
          </button>
        </form>

        {onBack && (
          <button type="button" className="film-login-back" onClick={onBack}>
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao letreiro
          </button>
        )}
      </div>
    </div>
  );
}
