// 수문장: shield bash = a golden hex-lattice shockwave arc sweeping the bash cone, dust and sparks;
// ult 철벽진 = the ground is slammed (shockwave to the push radius, dust ring, cracks), a golden hexagon dome rises around the
// guardian and bursts into hex shards, and a soft ring marks the ally-shield radius; while it lasts, golden shield runes orbit
// the guardian inside a faint hex barrier.
import { CLASSES, ATK } from '../../shared/data/classes.ts';
import { SCENE, EMIT, type Painter } from '../render/paint.ts';
import { type Tex, type Ctx, makeTex } from '../render/art/core.ts';
import type { ClassFx, FxCtx } from './types.ts';

const RANGE = CLASSES.guardian.range, HALF = ATK.bashHalf, PUSH_R = 220, ALLY_R = 300, DOME_R = 128;
const GOLD = 0xffd23f, AMBER = 0xffae2a, CREAM = 0xfff2c4, DUST = 0xb9a888;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const out3 = (k: number) => 1 - (1 - k) ** 3;
const easeBack = (k: number) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;

// ---------- textures (white, tinted at draw time; built once) ----------
function hexPath(c: Ctx, x: number, y: number, r: number, rot = 0): void { c.beginPath(); for (let i = 0; i < 6; i++) { const a = rot + (i * Math.PI) / 3; if (i) c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); }
/** Flat-top hex lattice centres covering [-ext, ext]² for cells of radius h. */
function lattice(h: number, ext: number, fn: (x: number, y: number) => void): void {
  const dx = h * 1.5, dy = h * Math.sqrt(3); for (let i = -Math.ceil(ext / dx); i <= Math.ceil(ext / dx); i++) for (let j = -Math.ceil(ext / dy) - 1; j <= Math.ceil(ext / dy) + 1; j++) fn(i * dx, j * dy + (i & 1 ? dy / 2 : 0));
}
let waveT: Tex | null = null, domeT: Tex | null = null, ringT: Tex | null = null, cellT: Tex | null = null;
/** Bash shockwave: a crescent band (leading edge at radius 58, facing +x, ±1.42 rad) filled with a hex lattice, tips faded. */
const W_RIM = 58;
const waveTex = (): Tex => waveT ??= makeTex('guardian:wave', 128, 128, 0.5, 0.5, 2, c => {
  const A = 1.42, band = () => { c.beginPath(); c.arc(64, 64, 62, -A, A); c.arc(64, 64, 26, A, -A, true); c.closePath(); };
  c.save(); band(); c.clip(); c.strokeStyle = '#fff'; c.lineWidth = 1.3; lattice(6.5, 64, (x, y) => { hexPath(c, 64 + x, 64 + y, 6.5); c.stroke(); }); c.restore();
  c.globalCompositeOperation = 'destination-in';
  const g = c.createRadialGradient(64, 64, 26, 64, 64, 62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0.25)'); g.addColorStop(0.85, 'rgba(0,0,0,0.8)'); g.addColorStop(1, 'rgba(0,0,0,0.2)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  c.globalCompositeOperation = 'source-over';
  const f = c.createRadialGradient(64, 64, 26, 64, 64, 62); f.addColorStop(0, 'rgba(255,255,255,0)'); f.addColorStop(0.6, 'rgba(255,255,255,0.16)'); f.addColorStop(0.84, 'rgba(255,255,255,0.5)'); f.addColorStop(0.9, '#fff'); f.addColorStop(0.95, 'rgba(255,255,255,0.35)'); f.addColorStop(1, 'rgba(255,255,255,0)');
  band(); c.fillStyle = f; c.fill();
  // fade the tips (angular wedges erased progressively; no conic gradients on older mobile Safari)
  c.globalCompositeOperation = 'destination-out'; const n = 14, a0 = A * 0.5;
  for (let i = 0; i < n; i++) { const b0 = a0 + ((A + 0.05 - a0) * i) / n, b1 = a0 + ((A + 0.05 - a0) * (i + 1)) / n, e = 1 - ((i + 0.5) / n) ** 1.2; c.fillStyle = `rgba(0,0,0,${(1 - e).toFixed(3)})`;
    for (const sg of [1, -1]) { c.beginPath(); c.moveTo(64, 64); c.arc(64, 64, 64, sg * b0, sg * b1, sg < 0); c.closePath(); c.fill(); } }
});
/** Hex dome seen from the game camera: upper half-circle (radius D_R) over the ground ellipse (D_R × 0.62 D_R), spherical hex
 *  lattice, fresnel rim glow and a bright base ring. Anchor = the base centre. */
const D_R = 124, D_H = 128 + Math.ceil(D_R * 0.62) + 4;
const domeTex = (): Tex => domeT ??= makeTex('guardian:dome', 256, D_H, 0.5, 128 / D_H, 2, c => {
  const cx = 128, cy = 128, sil = () => { c.beginPath(); c.arc(cx, cy, D_R, Math.PI, 0); c.ellipse(cx, cy, D_R, D_R * 0.62, 0, 0, Math.PI); c.closePath(); };
  // map a flat lattice point (in units of D_R) onto the sphere cap: |q| is the angle from the view axis
  const map = (qx: number, qy: number): [number, number] => { const d = Math.hypot(qx, qy), m = d > 1e-6 ? Math.sin(Math.min(d, Math.PI / 2)) / d : 1; const py = qy * m; return [cx + qx * m * D_R, cy + py * D_R * (py > 0 ? 0.62 : 1)]; };
  c.save(); sil(); c.clip();
  c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.2; const h = 0.15;
  lattice(h, 1.75, (x, y) => { if (Math.hypot(x, y) > Math.PI / 2 + h) return; c.beginPath(); for (let k = 0; k <= 6; k++) { const a = (k * Math.PI) / 3, [px, py] = map(x + Math.cos(a) * h * 0.94, y + Math.sin(a) * h * 0.94); if (k) c.lineTo(px, py); else c.moveTo(px, py); } c.stroke(); });
  // fresnel glow: top half as a circle, bottom half squashed like the ground
  for (const [y0, sy] of [[0, 1], [cy, 0.62]] as const) {
    c.save(); c.beginPath(); c.rect(0, y0, 256, y0 ? D_H - cy : cy); c.clip(); c.translate(cx, cy); c.scale(1, sy);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, D_R); g.addColorStop(0, 'rgba(255,255,255,0.02)'); g.addColorStop(0.62, 'rgba(255,255,255,0.05)'); g.addColorStop(0.9, 'rgba(255,255,255,0.28)'); g.addColorStop(1, 'rgba(255,255,255,0.85)');
    c.fillStyle = g; c.fillRect(-D_R, -D_R, D_R * 2, D_R * 2); c.restore();
  }
  c.restore();
  c.beginPath(); c.arc(cx, cy, D_R - 1.5, Math.PI, 0); c.strokeStyle = '#fff'; c.lineWidth = 2.4; c.stroke();
  c.beginPath(); c.ellipse(cx, cy, D_R - 1.5, D_R * 0.62 - 1.5, 0, 0, Math.PI); c.lineWidth = 3; c.stroke();
  c.beginPath(); c.ellipse(cx, cy, D_R - 1.5, D_R * 0.62 - 1.5, 0, Math.PI, Math.PI * 2); c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.6; c.stroke();
});
/** Ground ward circle: double ring, two interlaced hexagons, inner ring (drawn unrotated and squashed onto the ground). */
const ringTex = (): Tex => ringT ??= makeTex('guardian:ring', 256, 256, 0.5, 0.5, 2, c => {
  c.translate(128, 128); c.strokeStyle = '#fff'; c.fillStyle = '#fff';
  for (const [r, w] of [[123, 3.4], [112, 1.4], [58, 1.6], [48, 1]] as const) { c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.lineWidth = w; c.stroke(); }
  for (const rot of [0, Math.PI / 6]) { hexPath(c, 0, 0, 104, rot); c.lineWidth = 2; c.stroke(); }
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * 112, Math.sin(a) * 112); c.lineTo(Math.cos(a) * 118, Math.sin(a) * 118); c.lineWidth = 1.6; c.stroke(); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; hexPath(c, Math.cos(a) * 80, Math.sin(a) * 80, 8, 0); c.lineWidth = 1.4; c.stroke(); }
});
/** Hexagonal shield plate (rune): thick rim, faint fill, inner hexagon, centre boss. */
const cellTex = (): Tex => cellT ??= makeTex('guardian:cell', 48, 48, 0.5, 0.5, 2, c => {
  hexPath(c, 24, 24, 21, Math.PI / 6); c.fillStyle = 'rgba(255,255,255,0.28)'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3.4; c.stroke();
  hexPath(c, 24, 24, 12.5, Math.PI / 6); c.lineWidth = 1.6; c.stroke();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; c.beginPath(); c.moveTo(24 + Math.cos(a) * 12.5, 24 + Math.sin(a) * 12.5); c.lineTo(24 + Math.cos(a) * 21, 24 + Math.sin(a) * 21); c.lineWidth = 1; c.stroke(); }
  c.beginPath(); c.arc(24, 24, 4.2, 0, Math.PI * 2); c.fill();
});

// ---------- pieces ----------
/** Hex shards bursting off the dome and tumbling outward. */
function shards(c: FxCtx, x: number, y: number, R: number, n: number): void {
  const cell = cellTex(), S: number[] = []; // x, y, vx, vy, rot, spin, size, life
  for (let i = 0; i < n; i++) {
    const top = i % 3 !== 2, a = top ? rnd(Math.PI * 1.05, Math.PI * 1.95) : rnd(0.1, Math.PI - 0.1), ca = Math.cos(a), sa = Math.sin(a), sp = rnd(170, 330);
    S.push(x + ca * R, y + sa * R * (top ? 1 : 0.62), ca * sp, sa * sp * (top ? 0.8 : 0.5) - (top ? 40 : 0), rnd(0, 6.28), rnd(-7, 7), rnd(0.22, 0.4), rnd(0.55, 0.9));
  }
  c.fx.add(1, 0.95, (p, _k, t) => {
    for (let i = 0; i < S.length; i += 8) {
      const k = t / S[i + 7]; if (k >= 1) continue; const a = (1 - k) ** 1.3, s = S[i + 6] * (1 - k * 0.4);
      p.draw(EMIT, cell, S[i], S[i + 1], s, s, S[i + 4], GOLD, 0.85 * a, 1); p.draw(EMIT, cell, S[i], S[i + 1], s * 0.6, s * 0.6, S[i + 4], CREAM, 0.6 * a, 1);
    }
  }, (dt) => { const d = Math.pow(0.9, dt * 60); for (let i = 0; i < S.length; i += 8) { S[i + 2] *= d; S[i + 3] = S[i + 3] * d + 160 * dt; S[i] += S[i + 2] * dt; S[i + 1] += S[i + 3] * dt; S[i + 4] += S[i + 5] * dt; } return true; });
}
/** Expanding ground ring (ring texture rim ≈ 58/64 of the half size). */
function groundRing(p: Painter, tex: Tex, x: number, y: number, r: number, col: number, a: number, soft = false): void {
  const s = (r * 2) / 128 / (soft ? 55 / 64 : 58 / 64); p.draw(EMIT, tex, x, y, s, s * 0.62, 0, col, a, 1);
}

export const guardian: ClassFx = {
  warm: () => { waveTex(); domeTex(); ringTex(); cellTex(); },
  atkDur: 0.32, ultR: PUSH_R,
  atk: (c, e, ang) => {
    const x = c.x, y = c.y, ca = Math.cos(ang), sa = Math.sin(ang), big = c.ult ? 1.12 : 1;
    const ox = x - ca * 6, oy = y - 18, ix = x + ca * 26, iy = y - 22 + sa * 10; // wave origin (behind the shield) and shield impact point
    c.fx.later(0.06, () => {
      const wave = waveTex(), star = c.art.fx('star'), soft = c.art.fx('soft');
      c.fx.add(1, 0.34, (p, k, t) => {
        for (let i = 0; i < 2; i++) {
          const kk = Math.min(1, (t - i * 0.05) / 0.26); if (kk <= 0) continue;
          const r = (20 + (RANGE + 10 - 20) * out3(kk)) * big, s = r / W_RIM, a = (kk < 0.5 ? 1 : 1 - (kk - 0.5) / 0.5) * (i ? 0.45 : 1) * (1 - k * 0.3);
          p.draw(EMIT, wave, ox, oy, s, s, ang, GOLD, 0.72 * a, 1); if (!i) p.draw(EMIT, wave, ox, oy, s * 0.97, s * 0.97, ang, CREAM, 0.3 * a, 1);
        }
        if (k < 0.4) { const f = 1 - k / 0.4; p.draw(EMIT, soft, ix, iy, 1, 1, 0, GOLD, 0.2 * f, 1); p.draw(EMIT, star, ix, iy, 0.85 * (0.7 + k), 0.5 * (0.7 + k), ang + Math.PI / 2, 0xffe49a, 0.55 * f, 1); }
      });
      c.fx.sparks(ix, iy, c.ult ? 8 : 6, GOLD, 440, ang, 1.7, 9);
      for (let i = 0; i < 5; i++) {
        const a = ang + rnd(-0.8, 0.8) * HALF, d = rnd(26, 62), v = rnd(70, 120);
        c.fx.part({ tex: 'smoke', layer: SCENE, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.62 - 3, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.62 - 8, drag: 0.9, life: rnd(0.45, 0.65), size: rnd(12, 16), grow: 28, col: DUST, a: 0.4, spin: rnd(-1, 1) });
      }
      const q = e.tid ? c.entPos('m', e.tid) : null; if (q) { c.fx.ring(q.x, q.y, 6, 30, 0.22, GOLD, false, 1, 0.45); c.fx.sparks(q.x, q.y, 3, GOLD, 300, ang, 1.2, 7); }
      c.fx.light(ix, iy, 150, GOLD, 0.7, 0.22);
      if (c.mine) { c.fx.shake(0.05); c.fx.zoomPunch(0.005); }
    });
    c.snd.play('bash', c.vol, x, y);
  },
  ult: (c, e) => {
    const x = e.x, y = e.y, big = c.mine ? 1 : 0.55; const A = c.art, ring = A.fx('ring'), ringSoft = A.fx('ringSoft'), dome = domeTex(), wr = ringTex();
    // ground slam: shockwave to the push radius, then a soft ring out to the ally-shield radius
    c.fx.add(0, 0.62, (p, k) => { const r = 26 + (PUSH_R - 26) * out3(k); groundRing(p, ring, x, y, r, GOLD, 0.7 * (1 - k) ** 1.2); groundRing(p, ringSoft, x, y, r * 0.97, AMBER, 0.2 * (1 - k), true); });
    c.fx.add(0, 1, (p, k) => { groundRing(p, ringSoft, x, y, 60 + (ALLY_R - 60) * out3(k), CREAM, 0.22 * (1 - k) * Math.min(1, k * 5), true); }, undefined, 0.1);
    c.fx.add(0, 1.3, (p, k) => { const s = (2 * (DOME_R + 8)) / 256 * (0.6 + 0.4 * out3(Math.min(1, k * 3))); p.draw(EMIT, wr, x, y, s, s * 0.62, 0, GOLD, 0.26 * (k < 0.7 ? 1 : (1 - k) / 0.3), 1); });
    // the hex dome rises (overshoot), holds, then bursts outward into shards
    c.fx.add(1, 1.12, (p, _k, t) => {
      const rise = t < 0.26 ? Math.max(0.02, easeBack(t / 0.26)) : 1, b = t > 0.8 ? Math.min(1, (t - 0.8) / 0.32) : 0;
      const s = (DOME_R * rise * (1 + b * 0.3)) / D_R, a = Math.min(1, t / 0.32) ** 1.5 * (1 - b) ** 1.5; // fades in as the generic cast flash dies down
      p.draw(EMIT, dome, x, y, s, s, 0, GOLD, 0.28 * a, 1);
    });
    c.fx.later(0.8, () => { shards(c, x, y, DOME_R, Math.round(18 * big)); c.fx.light(x, y, 240, GOLD, 0.15, 0.4); if (c.mine) c.fx.wave(x, y - 40, DOME_R * 1.4, 10, 0.45); c.snd.play('guard', c.vol * 0.8, x, y); });
    // dust ring, rubble, sparks, cracks
    for (let i = 0, n = Math.round(16 * big); i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(-0.15, 0.15), v = rnd(280, 360);
      c.fx.part({ tex: 'smoke', layer: SCENE, x: x + Math.cos(a) * 28, y: y + Math.sin(a) * 17 - 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.62 - 10, drag: 0.88, life: rnd(0.7, 1), size: rnd(22, 30), grow: 42, col: DUST, a: 0.45, spin: rnd(-1, 1) });
    }
    c.fx.debris(x, y - 6, Math.round(10 * big), 'shard', [0x6a5a48, 0x3a3028, 0x8a7a60], 280, 7, 0.9);
    c.fx.sparks(x, y - 26, Math.round(14 * big), GOLD, 640);
    c.fx.decal(x, y, 'crack', 170, 0x1a1208, 2.4, 0.55); c.fx.decal(x, y, 'scorch', 150, 0x2a1c08, 1.6, 0.3);
    c.fx.light(x, y, 300, GOLD, 0.2, 0.9);
    if (c.mine) { c.fx.wave(x, y - 8, PUSH_R, 24, 0.7); c.fx.shake(0.2); }
    c.snd.play('slam', c.vol, x, y);
  },
  aura: (p, art, t, x, y) => {
    // ward circle on the ground with six hex runes travelling around it
    const wr = ringTex(), cell = cellTex(), soft = art.fx('soft'), R = 70, s = (2 * R) / 256 * 1.04;
    p.draw(EMIT, wr, x, y, s, s * 0.62, 0, GOLD, 0.22 + 0.05 * Math.sin(t * 3.2), 1);
    for (let i = 0; i < 6; i++) { const a = t * 0.7 + (i / 6) * Math.PI * 2; p.draw(EMIT, cell, x + Math.cos(a) * R * 0.63, y + Math.sin(a) * R * 0.63 * 0.62, 0.3, 0.3 * 0.62, 0, GOLD, 0.55, 1); }
    // faint hex barrier around the guardian
    p.draw(EMIT, domeTex(), x, y + 1, 50 / D_R, 50 / D_R, 0, GOLD, 0.12 + 0.03 * Math.sin(t * 5), 1);
    // shield runes orbiting at chest height (dimmer behind the body)
    for (let i = 0; i < 4; i++) {
      const a = t * 1.9 + (i / 4) * Math.PI * 2, front = Math.sin(a), px = x + Math.cos(a) * 46, py = y - 24 + front * 13, al = front > 0 ? 0.7 : 0.28, sc = 0.33 + front * 0.05;
      p.draw(EMIT, soft, px, py, 0.45, 0.45, 0, GOLD, 0.1 * al, 1); p.draw(EMIT, cell, px, py, sc * Math.max(0.35, Math.abs(Math.cos(a * 1.5))), sc, 0, i % 2 ? CREAM : GOLD, al, 1);
    }
    // motes rising from the ward
    const dot = art.fx('dot');
    for (let i = 0; i < 6; i++) { const k = (t * 0.6 + i / 6) % 1, a = i * 1.7 + t * 0.4; p.draw(EMIT, dot, x + Math.cos(a) * 34, y - 4 + Math.sin(a) * 12 - k * 56, 0.5, 0.5, 0, i % 2 ? GOLD : CREAM, Math.sin(k * Math.PI) * 0.8, 1); }
  },
};
