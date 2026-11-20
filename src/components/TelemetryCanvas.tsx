import { useEffect, useRef } from 'react';

interface TelemetryCanvasProps {
  // valores diários (14 dias) de atividade
  series: number[];
  height?: number;
}

// Gráfico de área animado — telemetria de atividade dos últimos 14 dias.
export function TelemetryCanvas({ series, height = 150 }: TelemetryCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let progress = 0;

    function draw(p: number) {
      const w = wrap!.clientWidth;
      const h = height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, w, h);

      const padX = 8;
      const padY = 14;
      const max = Math.max(...series, 1);
      const n = series.length;
      const stepX = (w - padX * 2) / Math.max(1, n - 1);
      const pt = (i: number) => ({
        x: padX + i * stepX,
        y: padY + (h - padY * 2) * (1 - (series[i] / max) * p),
      });

      // grid horizontal
      ctx!.strokeStyle = 'rgba(148, 163, 184, 0.10)';
      ctx!.lineWidth = 1;
      for (let g = 0; g < 4; g++) {
        const y = padY + ((h - padY * 2) / 3) * g;
        ctx!.beginPath();
        ctx!.moveTo(padX, y);
        ctx!.lineTo(w - padX, y);
        ctx!.stroke();
      }

      // área
      const pts = series.map((_, i) => pt(i));
      const grad = ctx!.createLinearGradient(0, padY, 0, h - padY);
      grad.addColorStop(0, 'rgba(96, 165, 250, 0.35)');
      grad.addColorStop(1, 'rgba(96, 165, 250, 0.02)');
      ctx!.beginPath();
      ctx!.moveTo(pts[0].x, h - padY);
      pts.forEach((pt2) => ctx!.lineTo(pt2.x, pt2.y));
      ctx!.lineTo(pts[n - 1].x, h - padY);
      ctx!.closePath();
      ctx!.fillStyle = grad;
      ctx!.fill();

      // linha
      ctx!.beginPath();
      pts.forEach((pt2, i) => (i === 0 ? ctx!.moveTo(pt2.x, pt2.y) : ctx!.lineTo(pt2.x, pt2.y)));
      ctx!.strokeStyle = '#60a5fa';
      ctx!.lineWidth = 2;
      ctx!.lineJoin = 'round';
      ctx!.stroke();

      // pontos
      pts.forEach((pt2, i) => {
        const isLast = i === n - 1;
        ctx!.beginPath();
        ctx!.arc(pt2.x, pt2.y, isLast ? 4 : 2.2, 0, Math.PI * 2);
        ctx!.fillStyle = isLast ? '#fbbf24' : '#60a5fa';
        ctx!.fill();
        if (isLast) {
          ctx!.beginPath();
          ctx!.arc(pt2.x, pt2.y, 8, 0, Math.PI * 2);
          ctx!.strokeStyle = 'rgba(251, 191, 36, 0.4)';
          ctx!.lineWidth = 1.5;
          ctx!.stroke();
        }
      });
    }

    function animate() {
      const start = performance.now();
      const dur = reduced ? 1 : 1100;
      const step = (t: number) => {
        progress = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - progress, 3);
        draw(eased);
        if (progress < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }

    animate();
    const ro = new ResizeObserver(() => draw(1));
    ro.observe(wrap);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [series, height]);

  return (
    <div ref={wrapRef} className="w-full" style={{ height }}>
      <canvas ref={canvasRef} className="block w-full" style={{ height }} aria-hidden="true" />
    </div>
  );
}
