import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRID_CELL_SIZE_PX,
  NEON_ACCENT_HEX,
  computeCursorInfluence,
  generateDotGridLattice,
  generateGridBeams,
  generateGridParticles,
} from './gridParticles';

test('generateGridParticles is deterministic and bounds particle properties cleanly', () => {
  const firstRun = generateGridParticles(24, 36024);
  const secondRun = generateGridParticles(24, 36024);

  assert.equal(firstRun.length, 24);
  assert.deepEqual(firstRun, secondRun);

  for (const p of firstRun) {
    assert.ok(p.xPct >= 0 && p.xPct <= 100, `xPct out of range: ${p.xPct}`);
    assert.ok(p.yPct >= 0 && p.yPct <= 100, `yPct out of range: ${p.yPct}`);
    assert.ok(p.sizePx >= 2 && p.sizePx <= 5, `sizePx out of range: ${p.sizePx}`);
    assert.ok(p.durationSec >= 7.5 && p.durationSec <= 15, `durationSec out of range: ${p.durationSec}`);
    assert.ok(p.peakOpacity > 0 && p.peakOpacity <= 0.85, `peakOpacity out of range: ${p.peakOpacity}`);
    assert.ok(NEON_ACCENT_HEX[p.accent], `accent missing hex: ${p.accent}`);
  }
});

test('generateGridParticles clamps invalid counts safely', () => {
  assert.equal(generateGridParticles(0).length, 0);
  assert.equal(generateGridParticles(-10).length, 0);
  assert.equal(generateGridParticles(200).length, 80);
});

test('generateGridBeams produces horizontal and vertical grid-aligned tracks', () => {
  const beams = generateGridBeams();
  assert.ok(beams.length >= 4);

  const horizontals = beams.filter((b) => b.orientation === 'horizontal');
  const verticals = beams.filter((b) => b.orientation === 'vertical');

  assert.ok(horizontals.length >= 2);
  assert.ok(verticals.length >= 2);
  assert.equal(GRID_CELL_SIZE_PX, 72);

  for (const beam of beams) {
    assert.ok(beam.trackIndex > 0);
    assert.ok(beam.lengthPx >= 100);
    assert.ok(beam.durationSec >= 8);
    assert.ok(NEON_ACCENT_HEX[beam.accent]);
  }
});

test('generateDotGridLattice creates evenly spaced deterministic lattice points', () => {
  const dots = generateDotGridLattice(12, 7);
  assert.equal(dots.length, 84);
  assert.equal(dots[0].col, 0);
  assert.equal(dots[0].row, 0);

  for (const dot of dots) {
    assert.ok(dot.xPct > 0 && dot.xPct < 100);
    assert.ok(dot.yPct > 0 && dot.yPct < 100);
    assert.ok(dot.baseOpacity > 0 && dot.baseOpacity <= 0.65);
    assert.ok(NEON_ACCENT_HEX[dot.accent]);
  }
});

test('computeCursorInfluence yields zero outside radius and smooth magnetic pull inside radius', () => {
  const idle = computeCursorInfluence(400, 300, null);
  assert.equal(idle.proximity, 0);
  assert.equal(idle.scale, 1);

  const far = computeCursorInfluence(400, 300, { x: 800, y: 800 }, 220);
  assert.equal(far.proximity, 0);
  assert.equal(far.offsetX, 0);
  assert.equal(far.offsetY, 0);

  const near = computeCursorInfluence(400, 300, { x: 460, y: 340 }, 220, 14);
  assert.ok(near.proximity > 0.4 && near.proximity <= 1);
  assert.ok(near.offsetX > 0 && near.offsetX <= 14);
  assert.ok(near.offsetY > 0 && near.offsetY <= 14);
  assert.ok(near.scale > 1.5);
  assert.ok(near.opacityBoost > 0.3);
});

