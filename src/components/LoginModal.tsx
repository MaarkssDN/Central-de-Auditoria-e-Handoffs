import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { OFFICIAL_AGENTS } from '../data/agentsRoster';
import {
  GRID_CELL_SIZE_PX,
  NEON_ACCENT_HEX,
  computeCursorInfluence,
  generateDotGridLattice,
  generateGridBeams,
  type GridLatticeDot,
} from '../utils/gridParticles';

interface LoginModalProps {
  onSuccess: () => void;
}

interface ViewportSize {
  width: number;
  height: number;
}

interface CursorPoint {
  x: number;
  y: number;
}

const SPOTLIGHT_SIZE_PX = 460;

export function AnimatedGridParticles() {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  const [viewport, setViewport] = useState<ViewportSize>({ width: 1440, height: 900 });
  const [dots, setDots] = useState<GridLatticeDot[]>(() => generateDotGridLattice(8, 5));
  const [cursor, setCursor] = useState<CursorPoint | null>(null);

  const beams = useMemo(() => generateGridBeams(), []);

  // Framer Motion spring-smoothed cursor coordinates driving pure GPU transform translation
  const rawMouseX = useMotionValue(-SPOTLIGHT_SIZE_PX);
  const rawMouseY = useMotionValue(-SPOTLIGHT_SIZE_PX);
  const smoothMouseX = useSpring(rawMouseX, { stiffness: 150, damping: 26, mass: 0.35 });
  const smoothMouseY = useSpring(rawMouseY, { stiffness: 150, damping: 26, mass: 0.35 });

  useEffect(() => {
    const syncGridToViewport = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      const width = rect?.width || window.innerWidth || 1440;
      const height = rect?.height || window.innerHeight || 900;
      setViewport({ width, height });

      const cols = width < 640 ? 5 : width < 1024 ? 7 : 8;
      const rows = width < 640 ? 6 : 5;
      setDots(generateDotGridLattice(cols, rows));
    };

    syncGridToViewport();
    window.addEventListener('resize', syncGridToViewport);

    if (prefersReducedMotion) {
      return () => {
        window.removeEventListener('resize', syncGridToViewport);
      };
    }

    let rafId: number | null = null;
    let pendingPoint: CursorPoint | null = null;
    let lastCommitted: CursorPoint | null = null;

    const handlePointerMove = (event: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const x = rect ? event.clientX - rect.left : event.clientX;
      const y = rect ? event.clientY - rect.top : event.clientY;

      rawMouseX.set(x - SPOTLIGHT_SIZE_PX / 2);
      rawMouseY.set(y - SPOTLIGHT_SIZE_PX / 2);
      pendingPoint = { x, y };

      if (rafId === null) {
        rafId = window.requestAnimationFrame(() => {
          rafId = null;
          if (!pendingPoint) return;
          if (
            !lastCommitted ||
            Math.abs(pendingPoint.x - lastCommitted.x) >= 6 ||
            Math.abs(pendingPoint.y - lastCommitted.y) >= 6
          ) {
            lastCommitted = pendingPoint;
            setCursor(pendingPoint);
          }
        });
      }
    };

    const handlePointerLeave = () => {
      pendingPoint = null;
      lastCommitted = null;
      setCursor(null);
      rawMouseX.set(-SPOTLIGHT_SIZE_PX);
      rawMouseY.set(-SPOTLIGHT_SIZE_PX);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('mouseleave', handlePointerLeave);
    window.addEventListener('blur', handlePointerLeave);

    return () => {
      window.removeEventListener('resize', syncGridToViewport);
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('mouseleave', handlePointerLeave);
      window.removeEventListener('blur', handlePointerLeave);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [prefersReducedMotion, rawMouseX, rawMouseY]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      data-testid="animated-grid-particles"
      data-cursor-tracking={cursor ? 'active' : 'idle'}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Ambient obsidian-to-neon atmospheric depth fields */}
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(640px 480px at 18% 20%, rgba(0, 240, 255, 0.11), transparent 68%),
            radial-gradient(680px 520px at 84% 84%, rgba(191, 90, 242, 0.10), transparent 68%),
            radial-gradient(460px 360px at 56% 12%, rgba(46, 123, 255, 0.06), transparent 64%)
          `,
        }}
        animate={prefersReducedMotion ? undefined : { opacity: [0.82, 1, 0.86, 0.82] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Precision 72px architectural hairline grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: `${GRID_CELL_SIZE_PX}px ${GRID_CELL_SIZE_PX}px`,
          maskImage:
            'radial-gradient(ellipse 92% 90% at 50% 50%, black 52%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 92% 90% at 50% 50%, black 52%, transparent 100%)',
        }}
      />

      {/* Responsive GPU-composited Framer Motion cursor illumination halo */}
      {!prefersReducedMotion && (
        <motion.div
          data-testid="cursor-glow-field"
          className="absolute top-0 left-0 rounded-full will-change-transform transition-opacity duration-300"
          style={{
            width: SPOTLIGHT_SIZE_PX,
            height: SPOTLIGHT_SIZE_PX,
            x: smoothMouseX,
            y: smoothMouseY,
            background:
              'radial-gradient(circle, rgba(0, 240, 255, 0.16) 0%, rgba(191, 90, 242, 0.07) 44%, transparent 72%)',
            opacity: cursor ? 1 : 0,
          }}
        />
      )}

      {/* Grid-aligned luminous 1px energy beams */}
      {!prefersReducedMotion &&
        beams.map((beam) => {
          const hex = NEON_ACCENT_HEX[beam.accent];
          const offsetPx = beam.trackIndex * GRID_CELL_SIZE_PX;

          if (beam.orientation === 'horizontal') {
            return (
              <motion.div
                key={beam.id}
                data-testid="grid-energy-beam"
                className="absolute left-0 h-px"
                style={{
                  top: `${offsetPx}px`,
                  width: `${beam.lengthPx}px`,
                  background: beam.reverse
                    ? `linear-gradient(270deg, transparent 0%, ${hex} 72%, rgba(255,255,255,0.88) 100%)`
                    : `linear-gradient(90deg, transparent 0%, ${hex} 72%, rgba(255,255,255,0.88) 100%)`,
                }}
                initial={{
                  x: beam.reverse ? '108vw' : `-${beam.lengthPx + 40}px`,
                  opacity: 0,
                }}
                animate={{
                  x: beam.reverse ? `-${beam.lengthPx + 40}px` : '108vw',
                  opacity: [0, 0.65, 0.65, 0],
                }}
                transition={{
                  duration: beam.durationSec,
                  delay: beam.delaySec,
                  repeat: Infinity,
                  repeatDelay: 2.6,
                  ease: 'linear',
                }}
              />
            );
          }

          return (
            <motion.div
              key={beam.id}
              data-testid="grid-energy-beam"
              className="absolute top-0 w-px"
              style={{
                left: `${offsetPx}px`,
                height: `${beam.lengthPx}px`,
                background: beam.reverse
                  ? `linear-gradient(0deg, transparent 0%, ${hex} 72%, rgba(255,255,255,0.88) 100%)`
                  : `linear-gradient(180deg, transparent 0%, ${hex} 72%, rgba(255,255,255,0.88) 100%)`,
              }}
              initial={{
                y: beam.reverse ? '108vh' : `-${beam.lengthPx + 40}px`,
                opacity: 0,
              }}
              animate={{
                y: beam.reverse ? `-${beam.lengthPx + 40}px` : '108vh',
                opacity: [0, 0.58, 0.58, 0],
              }}
              transition={{
                duration: beam.durationSec,
                delay: beam.delaySec,
                repeat: Infinity,
                repeatDelay: 3,
                ease: 'linear',
              }}
            />
          );
        })}

      {/* Cursor-responsive moving futuristic dot grid lattice */}
      {dots.map((dot) => {
        const hex = NEON_ACCENT_HEX[dot.accent];
        const dotX = (dot.xPct / 100) * viewport.width;
        const dotY = (dot.yPct / 100) * viewport.height;
        const influence = prefersReducedMotion
          ? { proximity: 0, offsetX: 0, offsetY: 0, scale: 1, opacityBoost: 0 }
          : computeCursorInfluence(dotX, dotY, cursor, 240, 14);
        const isCursorActive = influence.proximity > 0.05;

        return (
          <motion.div
            key={dot.id}
            data-testid="grid-lattice-dot"
            data-cursor-active={isCursorActive ? 'true' : 'false'}
            className="absolute flex items-center justify-center will-change-transform"
            style={{
              left: `${dot.xPct}%`,
              top: `${dot.yPct}%`,
              width: dot.isAnchorCrosshair ? 14 : 6,
              height: dot.isAnchorCrosshair ? 14 : 6,
              marginLeft: dot.isAnchorCrosshair ? -7 : -3,
              marginTop: dot.isAnchorCrosshair ? -7 : -3,
            }}
            animate={
              prefersReducedMotion
                ? { opacity: dot.baseOpacity, scale: 1, x: 0, y: 0 }
                : isCursorActive
                  ? {
                      x: influence.offsetX,
                      y: influence.offsetY,
                      scale: influence.scale,
                      opacity: Math.min(1, dot.baseOpacity + influence.opacityBoost),
                    }
                  : {
                      x: [0, dot.ambientDriftPx * 0.5, 0],
                      y: [0, -dot.ambientDriftPx, 0],
                      scale: [0.92, 1.12, 0.92],
                      opacity: [dot.baseOpacity * 0.65, dot.baseOpacity + 0.18, dot.baseOpacity * 0.65],
                    }
            }
            transition={
              isCursorActive
                ? { type: 'spring', stiffness: 260, damping: 22, mass: 0.45 }
                : {
                    duration: 5.4 + (dot.col % 3) * 1.1,
                    delay: dot.phaseDelaySec,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }
            }
          >
            {dot.isAnchorCrosshair ? (
              <div className="relative flex items-center justify-center w-full h-full">
                <span
                  className="absolute h-px w-3.5"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${hex}aa, transparent)`,
                  }}
                />
                <span
                  className="absolute w-px h-3.5"
                  style={{
                    background: `linear-gradient(180deg, transparent, ${hex}aa, transparent)`,
                  }}
                />
                <span
                  className="h-[3.5px] w-[3.5px] rounded-full"
                  style={{
                    backgroundColor: isCursorActive ? '#FFFFFF' : hex,
                    boxShadow: isCursorActive ? `0 0 12px ${hex}` : undefined,
                  }}
                />
              </div>
            ) : (
              <span
                className="block rounded-full"
                style={{
                  width: isCursorActive ? '4px' : '2.5px',
                  height: isCursorActive ? '4px' : '2.5px',
                  backgroundColor: isCursorActive ? '#F4F7FF' : hex,
                  boxShadow: isCursorActive ? `0 0 10px ${hex}` : undefined,
                }}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
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
      {/* Futuristic Framer Motion Animated Grid Particles Background */}
      <AnimatedGridParticles />

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

          {/* Centered Refined Glassmorphism Authentication Card */}
          <div className="my-auto py-8 w-full max-w-[416px] mx-auto rise-in">
            <div
              data-testid="login-glass-container"
              className="relative overflow-hidden rounded-[28px] p-8 sm:p-10 border border-white/[0.16] backdrop-blur-[12px]"
              style={{
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                background:
                  'linear-gradient(155deg, rgba(15, 23, 46, 0.56) 0%, rgba(7, 11, 24, 0.72) 100%)',
                boxShadow:
                  '0 32px 84px -26px rgba(0, 0, 0, 0.92), 0 0 56px -28px rgba(0, 240, 255, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.18), inset 0 -1px 0 rgba(0, 240, 255, 0.10)',
              }}
              role="region"
              aria-labelledby="login-heading"
            >
              {/* Soft internal glass sheen across top-left facet */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(320px 180px at 18% 0%, rgba(255, 255, 255, 0.065), transparent 72%)',
                }}
              />

              {/* Razor-thin top translucent specular accent line */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-10 top-0 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(0, 240, 255, 0.75) 45%, rgba(191, 90, 242, 0.55) 75%, transparent 100%)',
                }}
              />

              {/* Subtle bottom frosted refraction edge */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-14 bottom-0 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.18) 50%, transparent 100%)',
                }}
              />

              <div className="relative z-10 space-y-2 mb-8">
                <p className="text-xs font-medium text-[#67E8F9] tracking-wide">
                  Acesso autenticado
                </p>
                <h2
                  id="login-heading"
                  className="font-display text-[26px] font-semibold tracking-tight text-white leading-tight"
                >
                  Entrar no console
                </h2>
                <p className="text-sm text-[#9BAAC4] leading-relaxed">
                  Informe suas credenciais de operador para iniciar a sessão.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="relative z-10 space-y-5" noValidate>
                <div className="space-y-2">
                  <label
                    htmlFor="login-email"
                    className="block text-[13px] font-medium text-[#CBD5E1]"
                  >
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none w-4 h-4 text-[#7D8CA8] absolute left-4 top-1/2 -translate-y-1/2"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <input
                      id="login-email"
                      type="email"
                      required
                      autoComplete="username"
                      placeholder="operador@empresa.com"
                      className="w-full h-12 pl-11 pr-4 rounded-2xl bg-[#040712]/65 border border-white/[0.15] hover:border-white/[0.24] text-sm text-white placeholder:text-[#5C6D8A] transition-colors duration-150 focus:outline-none focus:border-[#00E5FF]/80 focus:ring-2 focus:ring-[#00E5FF]/20"
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
                      className="pointer-events-none w-4 h-4 text-[#7D8CA8] absolute left-4 top-1/2 -translate-y-1/2"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder="Digite sua senha"
                      className="w-full h-12 pl-11 pr-12 rounded-2xl bg-[#040712]/65 border border-white/[0.15] hover:border-white/[0.24] text-sm text-white placeholder:text-[#5C6D8A] transition-colors duration-150 focus:outline-none focus:border-[#00E5FF]/80 focus:ring-2 focus:ring-[#00E5FF]/20"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center text-[#8C9BB8] hover:text-white hover:bg-white/[0.08] transition-colors"
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

              <div className="relative z-10 mt-7 pt-5 border-t border-white/[0.11] flex items-center justify-center gap-2 text-xs text-[#8091B0]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00FFA3]/85 shrink-0" aria-hidden="true" />
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
