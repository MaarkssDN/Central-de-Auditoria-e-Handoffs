export type NeonAccentKey = 'cyan' | 'violet' | 'emerald' | 'blue';

export interface GridParticleSpec {
  id: string;
  /** Left position in viewport percentage (0..100) */
  xPct: number;
  /** Top position in viewport percentage (0..100) */
  yPct: number;
  /** Core diameter in pixels */
  sizePx: number;
  /** Neon accent key aligned with the app design system */
  accent: NeonAccentKey;
  /** Ambient drift amplitude on X axis in px */
  driftX: number;
  /** Ambient drift amplitude on Y axis in px */
  driftY: number;
  /** Full loop duration in seconds */
  durationSec: number;
  /** Stagger start delay in seconds */
  delaySec: number;
  /** Peak resting opacity (kept restrained for high contrast) */
  peakOpacity: number;
  /** Whether to render a crisp geometric crosshair halo at grid node */
  isNodeCrosshair: boolean;
}

export interface GridBeamSpec {
  id: string;
  orientation: 'horizontal' | 'vertical';
  /** Track index multiplied by gridSizePx (72px) */
  trackIndex: number;
  /** Length of the luminous light streak in pixels */
  lengthPx: number;
  accent: NeonAccentKey;
  durationSec: number;
  delaySec: number;
  reverse: boolean;
}

export const GRID_CELL_SIZE_PX = 72;

export const NEON_ACCENT_HEX: Record<NeonAccentKey, string> = {
  cyan: '#00F0FF',
  violet: '#BF5AF2',
  emerald: '#00FFA3',
  blue: '#2E7BFF',
};

const ACCENT_CYCLE: readonly NeonAccentKey[] = ['cyan', 'blue', 'violet', 'cyan', 'emerald'];

/**
 * Deterministic PRNG (Mulberry32) so particle layouts remain stable across renders and SSR/hydration.
 */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a balanced, deterministic distribution of futuristic grid particles.
 * Uses stratified cells across the viewport to prevent unsightly clumping.
 */
export function generateGridParticles(count = 26, seed = 36024): GridParticleSpec[] {
  const safeCount = Math.max(0, Math.min(80, Math.floor(count)));
  if (safeCount === 0) return [];

  const rand = createSeededRandom(seed);
  const cols = 6;
  const rows = Math.max(1, Math.ceil(safeCount / cols));
  const particles: GridParticleSpec[] = [];

  for (let i = 0; i < safeCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);

    const cellW = 100 / cols;
    const cellH = 100 / rows;

    const jitterX = 0.16 + rand() * 0.68;
    const jitterY = 0.16 + rand() * 0.68;

    const xPct = Number((col * cellW + jitterX * cellW).toFixed(2));
    const yPct = Number((row * cellH + jitterY * cellH).toFixed(2));

    const isNodeCrosshair = i % 5 === 0;
    const sizePx = isNodeCrosshair ? 4 : Number((2 + rand() * 2.2).toFixed(1));
    const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];
    const driftX = Number(((rand() - 0.5) * 26).toFixed(1));
    const driftY = Number(((rand() - 0.5) * 32).toFixed(1));
    const durationSec = Number((7.5 + rand() * 7.5).toFixed(2));
    const delaySec = Number((rand() * 4.5).toFixed(2));
    const peakOpacity = Number((isNodeCrosshair ? 0.72 : 0.35 + rand() * 0.42).toFixed(2));

    particles.push({
      id: `grid-particle-${i}`,
      xPct,
      yPct,
      sizePx,
      accent,
      driftX,
      driftY,
      durationSec,
      delaySec,
      peakOpacity,
      isNodeCrosshair,
    });
  }

  return particles;
}

/**
 * Generates crisp 1px energy beams gliding strictly along the 72px architectural grid tracks.
 */
export function generateGridBeams(): GridBeamSpec[] {
  return [
    {
      id: 'beam-h-1',
      orientation: 'horizontal',
      trackIndex: 2,
      lengthPx: 180,
      accent: 'cyan',
      durationSec: 11,
      delaySec: 0.4,
      reverse: false,
    },
    {
      id: 'beam-h-2',
      orientation: 'horizontal',
      trackIndex: 6,
      lengthPx: 140,
      accent: 'violet',
      durationSec: 14.5,
      delaySec: 3.2,
      reverse: true,
    },
    {
      id: 'beam-h-3',
      orientation: 'horizontal',
      trackIndex: 10,
      lengthPx: 160,
      accent: 'blue',
      durationSec: 13,
      delaySec: 6.1,
      reverse: false,
    },
    {
      id: 'beam-v-1',
      orientation: 'vertical',
      trackIndex: 3,
      lengthPx: 150,
      accent: 'cyan',
      durationSec: 12.5,
      delaySec: 1.5,
      reverse: false,
    },
    {
      id: 'beam-v-2',
      orientation: 'vertical',
      trackIndex: 9,
      lengthPx: 170,
      accent: 'emerald',
      durationSec: 15.5,
      delaySec: 4.8,
      reverse: true,
    },
    {
      id: 'beam-v-3',
      orientation: 'vertical',
      trackIndex: 15,
      lengthPx: 140,
      accent: 'violet',
      durationSec: 13.8,
      delaySec: 2.1,
      reverse: false,
    },
  ];
}

export interface GridLatticeDot {
  id: string;
  col: number;
  row: number;
  /** Left position in viewport percentage (0..100) */
  xPct: number;
  /** Top position in viewport percentage (0..100) */
  yPct: number;
  accent: NeonAccentKey;
  baseOpacity: number;
  /** Diagonal wave phase delay in seconds */
  phaseDelaySec: number;
  /** Autonomous gentle vertical drift amplitude in pixels */
  ambientDriftPx: number;
  isAnchorCrosshair: boolean;
}

export interface CursorInfluence {
  proximity: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  opacityBoost: number;
}

/**
 * Generates an evenly spaced futuristic dot lattice across the viewport.
 */
export function generateDotGridLattice(cols = 12, rows = 7): GridLatticeDot[] {
  const safeCols = Math.max(2, Math.min(20, Math.floor(cols)));
  const safeRows = Math.max(2, Math.min(14, Math.floor(rows)));
  const dots: GridLatticeDot[] = [];

  for (let row = 0; row < safeRows; row++) {
    for (let col = 0; col < safeCols; col++) {
      const xPct = Number((((col + 0.5) / safeCols) * 100).toFixed(2));
      const yPct = Number((((row + 0.5) / safeRows) * 100).toFixed(2));
      const index = row * safeCols + col;
      const accent = ACCENT_CYCLE[(col + row) % ACCENT_CYCLE.length];
      const isAnchorCrosshair = col % 4 === 1 && row % 3 === 1;

      dots.push({
        id: `lattice-dot-${row}-${col}`,
        col,
        row,
        xPct,
        yPct,
        accent,
        baseOpacity: isAnchorCrosshair ? 0.52 : 0.24 + ((col + row) % 3) * 0.06,
        phaseDelaySec: Number(((col * 0.14 + row * 0.22) % 3.2).toFixed(2)),
        ambientDriftPx: Number((3 + (index % 4) * 1.4).toFixed(1)),
        isAnchorCrosshair,
      });
    }
  }

  return dots;
}

/**
 * Computes smooth magnetic attraction, scale bloom, and opacity lift
 * for a single grid dot relative to the user's cursor coordinates.
 */
export function computeCursorInfluence(
  dotX: number,
  dotY: number,
  cursor: { x: number; y: number } | null,
  radiusPx = 220,
  maxPullPx = 14
): CursorInfluence {
  if (!cursor || radiusPx <= 0) {
    return { proximity: 0, offsetX: 0, offsetY: 0, scale: 1, opacityBoost: 0 };
  }

  const dx = cursor.x - dotX;
  const dy = cursor.y - dotY;
  const dist = Math.hypot(dx, dy);

  if (dist >= radiusPx) {
    return { proximity: 0, offsetX: 0, offsetY: 0, scale: 1, opacityBoost: 0 };
  }

  // Smooth cubic ease-out falloff from cursor center to radius edge
  const normalized = 1 - dist / radiusPx;
  const proximity = Number((normalized * normalized * (3 - 2 * normalized)).toFixed(4));

  // Subtle magnetic pull toward the cursor, dampened right at the center to prevent jitter
  const pullFactor = dist > 6 ? (proximity * maxPullPx) / dist : 0;
  const offsetX = Number((dx * pullFactor).toFixed(2));
  const offsetY = Number((dy * pullFactor).toFixed(2));
  const scale = Number((1 + proximity * 1.35).toFixed(3));
  const opacityBoost = Number((proximity * 0.72).toFixed(3));

  return { proximity, offsetX, offsetY, scale, opacityBoost };
}

