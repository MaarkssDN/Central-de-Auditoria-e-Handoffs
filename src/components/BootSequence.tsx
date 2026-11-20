import { useEffect, useRef, useState } from 'react';
import { Radar } from 'lucide-react';

interface BootSequenceProps {
  onDone: () => void;
}

const LINES = [
  'GOV-360 // CENTRAL DE AUDITORIA E HANDOFFS',
  'carregando roster oficial .......... 30/30 agentes',
  'verificando providers .............. 8 registrados',
  'sincronizando central/estado ....... locks ok',
  'montando worktrees ................ prontos',
  'parecer 24 em standby .............. aguardando',
];

// Sequência de boot cinematográfica — toca uma vez por sessão.
export function BootSequence({ onDone }: BootSequenceProps) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    LINES.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleLines(i + 1), 350 + i * 420));
    });
    const total = 350 + LINES.length * 420 + 500;
    timers.push(setTimeout(() => setProgress(100), total - 900));
    timers.push(
      setTimeout(() => {
        if (doneRef.current) return;
        doneRef.current = true;
        setLeaving(true);
        setTimeout(onDone, 650);
      }, total),
    );
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  function skip() {
    if (doneRef.current) return;
    doneRef.current = true;
    setLeaving(true);
    setTimeout(onDone, 300);
  }

  return (
    <div
      className={`fixed inset-0 z-[100] bg-ink-950 blueprint-grid flex items-center justify-center transition-opacity duration-500 ${
        leaving ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      onClick={skip}
      role="status"
      aria-label="Inicializando sistema"
    >
      <div className="w-[min(560px,90vw)]">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-11 h-11 rounded-2xl bg-accent-blue/15 border border-accent-blue/40 grid place-items-center">
            <Radar className="w-5 h-5 text-accent-blue" />
          </div>
          <div className="text-left">
            <div className="font-display font-bold text-lg text-accent-amber">Governança 360</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent-violet">
              Central de Auditoria e Handoffs
            </div>
          </div>
        </div>

        <div className="panel rounded-2xl p-5 font-mono text-[13px] space-y-2.5 min-h-[190px]">
          {LINES.slice(0, visibleLines).map((l, i) => (
            <div key={i} className="dash-rise flex items-center gap-2">
              <span className="text-ok-400">▸</span>
              <span className={i === LINES.length - 1 ? 'text-amberx-300' : 'text-paper-300'}>{l}</span>
            </div>
          ))}
          {visibleLines < LINES.length && (
            <span className="inline-block w-2.5 h-4 bg-accent-blue dash-blink" />
          )}
        </div>

        <div className="mt-5">
          <div className="flex justify-between text-[10px] font-mono text-paper-400 mb-1.5">
            <span>INICIALIZANDO</span>
            <span className="text-accent-blue tabular-nums">{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-ink-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #2563eb, #60a5fa, #fbbf24)',
              }}
            />
          </div>
        </div>

        <p className="text-center text-[10px] font-mono text-paper-500 mt-6 tracking-widest uppercase">
          clique para pular
        </p>
      </div>
    </div>
  );
}
