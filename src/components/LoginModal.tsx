import { useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { OFFICIAL_AGENTS } from '../data/agentsRoster';

interface LoginModalProps {
  onSuccess: () => void;
}

export function LoginModal({ onSuccess }: LoginModalProps) {
  const [email, setEmail] = useState('marcelinmark@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Informe e-mail e senha para continuar.');
      return;
    }

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
      setError('Servidor indisponível. Verifique se a API local está ativa.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#03050B] text-[#F4F7FF] selection:bg-[#00E5FF]/25 selection:text-white">
      {/* Subtle Architectural Light Field & Hairline Perspective Grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(720px 520px at 22% 24%, rgba(0, 229, 255, 0.085), transparent 65%),
            radial-gradient(640px 520px at 78% 82%, rgba(129, 140, 248, 0.09), transparent 65%),
            radial-gradient(480px 380px at 56% 14%, rgba(192, 132, 252, 0.05), transparent 62%),
            linear-gradient(rgba(255, 255, 255, 0.028) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.028) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 100% 100%, 100% 100%, 72px 72px, 72px 72px',
          maskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%, black 55%, transparent 100%)',
        }}
      />

      <div className="relative z-10 min-h-screen grid grid-cols-1 lg:grid-cols-12">
        {/* Left Architectural Showcase (Desktop) */}
        <section className="hidden lg:flex lg:col-span-7 flex-col justify-between p-12 xl:p-16 border-r border-white/[0.06] relative overflow-hidden">
          {/* Top Minimalist Wordmark */}
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center border border-white/15 bg-white/[0.03] backdrop-blur-md"
                style={{ boxShadow: '0 0 28px -10px rgba(0, 229, 255, 0.55)' }}
                aria-hidden="true"
              >
                <svg viewBox="0 0 32 32" className="w-5 h-5" fill="none">
                  <circle cx="16" cy="16" r="11" stroke="url(#brandRing)" strokeWidth="1.4" />
                  <circle cx="16" cy="16" r="5.5" stroke="#00E5FF" strokeWidth="1.3" strokeOpacity="0.85" />
                  <circle cx="16" cy="16" r="2" fill="#F4F7FF" />
                  <circle cx="25.5" cy="10.5" r="1.5" fill="#00E5FF" />
                  <defs>
                    <linearGradient id="brandRing" x1="5" y1="5" x2="27" y2="27" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#00E5FF" />
                      <stop offset="1" stopColor="#818CF8" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span className="font-display text-[17px] font-semibold tracking-tight text-white whitespace-nowrap">
                Governança 360
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#8C9BB8]">
              <span>Auditoria</span>
              <span aria-hidden="true" className="text-white/20">·</span>
              <span>Handoffs</span>
              <span aria-hidden="true" className="text-white/20">·</span>
              <span>Orquestração</span>
            </div>
          </header>

          {/* Center Minimalist Orbital Topology Sculpture + Editorial Statement */}
          <div className="my-auto py-10 max-w-xl space-y-9 rise-in">
            {/* Precision Geometric Orbital Visual */}
            <div className="relative w-56 h-56 flex items-center justify-center" aria-hidden="true">
              <div
                className="absolute inset-4 rounded-full blur-3xl opacity-35"
                style={{
                  background:
                    'radial-gradient(circle, rgba(0,229,255,0.45) 0%, rgba(129,140,248,0.22) 55%, transparent 75%)',
                }}
              />
              <svg viewBox="0 0 240 240" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="orbitArcCyan" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.95" />
                    <stop offset="55%" stopColor="#818CF8" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#818CF8" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="orbitArcViolet" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#C084FC" stopOpacity="0.8" />
                    <stop offset="60%" stopColor="#00FFA3" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Static architectural calibration crosshairs */}
                <line x1="120" y1="8" x2="120" y2="26" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
                <line x1="120" y1="214" x2="120" y2="232" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
                <line x1="8" y1="120" x2="26" y2="120" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
                <line x1="214" y1="120" x2="232" y2="120" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />

                {/* Outer slow rotating orbit */}
                <g className="orbit-spin-slow" style={{ transformOrigin: '120px 120px' }}>
                  <circle
                    cx="120"
                    cy="120"
                    r="102"
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="0.9"
                    strokeDasharray="2 7"
                  />
                  <path
                    d="M 120 18 A 102 102 0 0 1 214 80"
                    fill="none"
                    stroke="url(#orbitArcCyan)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  <circle cx="214" cy="80" r="3.2" fill="#00E5FF" />
                </g>

                {/* Middle counter-rotating orbit */}
                <g className="orbit-spin-reverse" style={{ transformOrigin: '120px 120px' }}>
                  <circle
                    cx="120"
                    cy="120"
                    r="72"
                    fill="none"
                    stroke="rgba(255,255,255,0.10)"
                    strokeWidth="0.9"
                  />
                  <path
                    d="M 192 120 A 72 72 0 0 1 68 170"
                    fill="none"
                    stroke="url(#orbitArcViolet)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <circle cx="68" cy="170" r="2.8" fill="#C084FC" />
                </g>

                {/* Inner precision core ring */}
                <circle
                  cx="120"
                  cy="120"
                  r="42"
                  fill="rgba(7, 11, 22, 0.72)"
                  stroke="rgba(0, 229, 255, 0.32)"
                  strokeWidth="1"
                />
                <circle
                  cx="120"
                  cy="120"
                  r="24"
                  fill="none"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="0.8"
                />
                <circle cx="120" cy="120" r="5" fill="#F4F7FF" />
                <circle cx="120" cy="120" r="11" fill="none" stroke="#00E5FF" strokeWidth="1" strokeOpacity="0.65" />
              </svg>
            </div>

            <div className="space-y-4">
              <h1 className="font-display text-4xl xl:text-[46px] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
                Orquestração multiagente com precisão cirúrgica.
              </h1>
              <p className="text-[15px] leading-relaxed text-[#94A3B8] max-w-lg">
                Coordene especialistas, controle slots exclusivos, valide gates reais e emita pareceres independentes em um ambiente projetado para clareza absoluta.
              </p>
            </div>
          </div>

          {/* Bottom Minimalist Typographic Index (Zero Pills, Hairline Dividers Only) */}
          <footer className="grid grid-cols-3 gap-8 pt-8 border-t border-white/[0.07] max-w-xl">
            <div>
              <div className="font-mono text-2xl font-medium text-white tabular-nums tracking-tight">
                {OFFICIAL_AGENTS.length}
              </div>
              <div className="text-xs text-[#7D8CA8] mt-1">
                Agentes especialistas
              </div>
            </div>
            <div>
              <div className="font-mono text-2xl font-medium text-white tabular-nums tracking-tight">
                §14
              </div>
              <div className="text-xs text-[#7D8CA8] mt-1">
                Proteção de slots
              </div>
            </div>
            <div>
              <div className="font-mono text-2xl font-medium text-white tabular-nums tracking-tight">
                24
              </div>
              <div className="text-xs text-[#7D8CA8] mt-1">
                Revisão independente
              </div>
            </div>
          </footer>
        </section>

        {/* Right Authentication Sanctuary */}
        <main className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-10 lg:p-14">
          {/* Mobile Brand Header */}
          <div className="flex lg:hidden items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center border border-white/15 bg-white/[0.04]">
                <svg viewBox="0 0 32 32" className="w-4 h-4" fill="none" aria-hidden="true">
                  <circle cx="16" cy="16" r="11" stroke="#00E5FF" strokeWidth="1.5" />
                  <circle cx="16" cy="16" r="3" fill="#F4F7FF" />
                </svg>
              </div>
              <span className="font-display text-base font-semibold tracking-tight text-white">
                Governança 360
              </span>
            </div>
            <span className="font-mono text-xs text-[#7D8CA8] tabular-nums">
              {OFFICIAL_AGENTS.length} agentes
            </span>
          </div>

          {/* Centered Refined Glass Authentication Card */}
          <div className="my-auto py-8 w-full max-w-[410px] mx-auto rise-in">
            <div
              className="relative rounded-[28px] p-8 sm:p-10 border border-white/[0.09] backdrop-blur-2xl"
              style={{
                background:
                  'linear-gradient(165deg, rgba(13, 19, 36, 0.82) 0%, rgba(6, 9, 20, 0.92) 100%)',
                boxShadow:
                  '0 32px 80px -28px rgba(0, 0, 0, 0.95), 0 0 48px -28px rgba(0, 229, 255, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
              }}
              role="region"
              aria-labelledby="login-heading"
            >
              {/* Razor-thin top specular accent line */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-10 top-0 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(0, 229, 255, 0.65) 45%, rgba(129, 140, 248, 0.55) 70%, transparent 100%)',
                }}
              />

              <div className="space-y-2 mb-8">
                <p className="text-xs font-medium text-[#67E8F9] tracking-wide">
                  Acesso autenticado
                </p>
                <h2
                  id="login-heading"
                  className="font-display text-[26px] font-semibold tracking-tight text-white leading-tight"
                >
                  Entrar no console
                </h2>
                <p className="text-sm text-[#8C9BB8] leading-relaxed">
                  Informe suas credenciais de operador para iniciar a sessão.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="space-y-2">
                  <label
                    htmlFor="login-email"
                    className="block text-[13px] font-medium text-[#CBD5E1]"
                  >
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none w-4 h-4 text-[#64748B] absolute left-4 top-1/2 -translate-y-1/2"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <input
                      id="login-email"
                      type="email"
                      required
                      autoComplete="username"
                      placeholder="operador@empresa.com"
                      className="w-full h-12 pl-11 pr-4 rounded-2xl bg-[#040712]/90 border border-white/[0.11] text-sm text-white placeholder:text-[#4E5E7A] transition-colors duration-150 focus:outline-none focus:border-[#00E5FF]/80 focus:ring-2 focus:ring-[#00E5FF]/20"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="login-password"
                    className="block text-[13px] font-medium text-[#CBD5E1]"
                  >
                    Senha
                  </label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none w-4 h-4 text-[#64748B] absolute left-4 top-1/2 -translate-y-1/2"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder="Digite sua senha"
                      className="w-full h-12 pl-11 pr-12 rounded-2xl bg-[#040712]/90 border border-white/[0.11] text-sm text-white placeholder:text-[#4E5E7A] transition-colors duration-150 focus:outline-none focus:border-[#00E5FF]/80 focus:ring-2 focus:ring-[#00E5FF]/20"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center text-[#7D8CA8] hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                      ) : (
                        <Eye className="w-4 h-4" strokeWidth={1.75} />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-2xl px-3.5 py-3 text-xs leading-relaxed border border-[#FF3B6B]/40 bg-[#FF073A]/[0.09] text-[#FF9BB3]"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#FF3B6B]" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full h-12 rounded-2xl font-medium text-sm text-[#03050B] flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed hover:brightness-110 active:translate-y-[1px]"
                  style={{
                    background: 'linear-gradient(135deg, #E2F8FF 0%, #67E8F9 48%, #818CF8 100%)',
                    boxShadow:
                      '0 12px 32px -12px rgba(0, 229, 255, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.65)',
                  }}
                >
                  <span>{loading ? 'Autenticando…' : 'Entrar no console'}</span>
                  {!loading && (
                    <ArrowRight
                      className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  )}
                </button>
              </form>

              <div className="mt-7 pt-5 border-t border-white/[0.07] flex items-center justify-center gap-2 text-xs text-[#6E7E9C]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00FFA3]/80 shrink-0" aria-hidden="true" />
                <span>Sessão local protegida por cookie HttpOnly</span>
              </div>
            </div>
          </div>

          {/* Quiet Footer */}
          <div className="flex items-center justify-between text-[11px] text-[#5C6D8A]">
            <span>Central de Auditoria e Handoffs</span>
            <span className="font-mono tabular-nums">Acesso restrito</span>
          </div>
        </main>
      </div>
    </div>
  );
}
