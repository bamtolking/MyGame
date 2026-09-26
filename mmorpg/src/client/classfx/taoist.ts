// 도사: violet chain lightning from the talisman sword; ult 천뢰진 = a floating 八卦 thunder array and 12 bolts from the sky.
import { EMIT, SCENE } from '../render/paint.ts';
import { type Tex, type Ctx, makeTex } from '../render/art/core.ts';
import type { ClassFx, FxCtx } from './types.ts';

const VIO = 0xa47bff, PALE = 0xe6dcff, DEEP = 0x6a3cff;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
/** Trigrams in 後天 order around the array; bit i set = line i (bottom first) is solid. */
const TRI = [7, 6, 5, 4, 3, 2, 1, 0];

function bars(c: Ctx, b: number, x: number, y: number, w: number, h: number, gap: number): void {
  for (let i = 0; i < 3; i++) { const yy = y + (1 - i) * (h + gap); if (b & (1 << i)) c.fillRect(x - w / 2, yy - h / 2, w, h); else { c.fillRect(x - w / 2, yy - h / 2, w * 0.4, h); c.fillRect(x + w * 0.1, yy - h / 2, w * 0.4, h); } }
}
/** Upright glowing trigram glyphs (white, tinted at draw time). */
let triT: Tex[] | null = null;
const triTex = (): Tex[] => triT ??= TRI.map(b => makeTex('fx:taoTri' + b, 40, 40, 0.5, 0.5, 2, c => {
  const g = c.createRadialGradient(20, 20, 0, 20, 20, 20); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 40, 40);
  c.fillStyle = 'rgba(255,255,255,0.45)'; bars(c, b, 20, 20, 29, 7.5, 2.5); c.fillStyle = '#fff'; bars(c, b, 20, 20, 25, 4.5, 5.5);
}));
/** Ground 八卦 thunder array: double octagon, trigrams on the edges, spokes and a 雷 seal in the middle. */
let baguaT: Tex | null = null;
const baguaTex = (): Tex => baguaT ??= makeTex('fx:taoBagua', 256, 256, 0.5, 0.5, 2, c => {
  c.translate(128, 128); c.strokeStyle = '#fff'; c.fillStyle = '#fff';
  const oct = (r: number, w: number) => { c.beginPath(); for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.lineWidth = w; c.stroke(); };
  oct(124, 4); oct(114, 1.5); oct(84, 2.5);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; c.beginPath(); c.moveTo(Math.cos(a) * 44, Math.sin(a) * 44); c.lineTo(Math.cos(a) * 84, Math.sin(a) * 84); c.lineWidth = 1.5; c.stroke(); }
  for (let i = 0; i < 8; i++) { c.save(); c.rotate((i / 8) * Math.PI * 2 + Math.PI / 2); bars(c, TRI[i], 0, -99, 26, 3.6, 2.8); c.restore(); }
  c.beginPath(); c.arc(0, 0, 44, 0, Math.PI * 2); c.lineWidth = 3; c.stroke(); c.beginPath(); c.arc(0, 0, 38, 0, Math.PI * 2); c.lineWidth = 1; c.stroke();
  c.font = 'bold 44px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('雷', 0, 2);
});

/** Jagged, flickering lightning (glow + white core) with side forks; the path is re-rolled every few frames. */
function zap(c: FxCtx, x1: number, y1: number, x2: number, y2: number, w: number, dur: number, forks: number, delay = 0, col = VIO): void {
  const beam = c.art.fx('beam'), soft = c.art.fx('soft'); const L = Math.hypot(x2 - x1, y2 - y1) || 1; const n = Math.max(3, Math.min(16, Math.round(L / 24)));
  const nx = -(y2 - y1) / L, ny = (x2 - x1) / L, jag = Math.min(30, L * 0.16); let pts: number[] = [], fk: number[][] = [], next = -1;
  const build = () => {
    pts = []; for (let i = 0; i <= n; i++) { const t = i / n, j = i === 0 || i === n ? 0 : (Math.random() - 0.5) * jag * 2 * (0.4 + Math.sin(t * Math.PI) * 0.6); pts.push(x1 + (x2 - x1) * t + nx * j, y1 + (y2 - y1) * t + ny * j); }
    fk = []; for (let f = 0; f < forks; f++) {
      const i = 1 + Math.floor(Math.random() * (n - 1)); let x = pts[i * 2], y = pts[i * 2 + 1]; const a = Math.atan2(y2 - y1, x2 - x1) + (Math.random() < 0.5 ? -1 : 1) * rnd(0.5, 1.1); const q = [x, y];
      for (let s = 0; s < 3; s++) { const l = L * rnd(0.05, 0.09); x += Math.cos(a + rnd(-0.6, 0.6)) * l; y += Math.sin(a + rnd(-0.6, 0.6)) * l; q.push(x, y); } fk.push(q);
    }
  };
  c.fx.add(1, dur, (p, k, t) => {
    if (t >= next) { build(); next = t + 0.05; }
    const a = (k < 0.12 ? 1 : 1 - (k - 0.12) / 0.88) * (Math.random() < 0.2 ? 0.6 : 1);
    for (let i = 0; i + 3 < pts.length; i += 2) { p.beam(EMIT, beam, pts[i], pts[i + 1], pts[i + 2], pts[i + 3], w * 3.4, col, a * 0.5, 1); p.beam(EMIT, beam, pts[i], pts[i + 1], pts[i + 2], pts[i + 3], w, PALE, a, 1); }
    for (const q of fk) for (let i = 0; i + 3 < q.length; i += 2) { p.beam(EMIT, beam, q[i], q[i + 1], q[i + 2], q[i + 3], w * 1.6, col, a * 0.4, 1); p.beam(EMIT, beam, q[i], q[i + 1], q[i + 2], q[i + 3], w * 0.45, PALE, a * 0.8, 1); }
    p.draw(EMIT, soft, x2, y2, w * 0.28, w * 0.28, 0, col, a * 0.6, 1);
  }, undefined, delay);
}
/** Small impact where a chain bolt lands. */
function spark(c: FxCtx, x: number, y: number, first: boolean): void {
  c.fx.sparks(x, y, first ? 6 : 4, 0xc9b0ff, 320, undefined, Math.PI, 9); c.fx.glow(x, y, first ? 40 : 30, VIO, 0.22, 0.75); c.fx.light(x, y, 120, VIO, 0.9, 0.25);
  if (first) c.fx.ring(x, y, 6, 42, 0.24, PALE, true, 1, 0.7);
}

export const taoist: ClassFx = {
  atkDur: 0.3, ultR: 150,
  atk: (c, e, ang) => {
    const f = Math.cos(ang) < 0 ? -1 : 1; const ox = c.x + f * 14, oy = c.y - 36; const D = 0.05; // lands with the atk1 frame
    const t0 = e.tid ? c.entPos('m', e.tid) : null; const hits: number[] = [t0 ? t0.x : e.tx, t0 ? t0.y : e.ty - 18];
    for (let i = 0; e.pts && i + 1 < e.pts.length; i += 2) if (e.pts[i] >= 0) hits.push(e.pts[i], e.pts[i + 1] - 18);
    c.fx.glow(ox, oy, 22, PALE, 0.16, 0.7);
    c.fx.part({ tex: 'paper', layer: SCENE, x: ox, y: oy, vx: Math.cos(ang) * 90, vy: Math.sin(ang) * 90 - 60, drag: 0.86, life: 0.28, size: 6, spin: 16, add: 0 });
    let px = ox, py = oy;
    for (let k = 0; k < hits.length / 2; k++) {
      const hx = hits[k * 2], hy = hits[k * 2 + 1]; const w = k ? 3 : 3.8;
      zap(c, px, py, hx, hy, w, 0.2, k ? 1 : 2, D + k * 0.045);
      c.fx.later(D + k * 0.045, () => spark(c, hx, hy, k === 0));
      px = hx; py = hy;
    }
    c.snd.play('zap', c.vol, c.x, c.y);
  },
  ult: (c, e) => {
    const x = e.x, y = e.y, R = 230, DUR = 2.75; const bag = baguaTex(), tris = triTex(), soft = c.art.fx('soft'), beam = c.art.fx('beam');
    // ground array (static, like a drawn formation): grows in, arcs crawl along its rim, fades after the last strike
    let arc: number[] = [], nextArc = 0;
    c.fx.add(0, DUR, (p, k, t) => {
      const g = k < 0.1 ? easeOut(k / 0.1) : 1, al = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1; const s = (R * 2 * 1.02) / bag.w * g;
      p.draw(EMIT, soft, x, y, R / 20, R / 20 * 0.62, 0, DEEP, 0.16 * al, 1);
      p.draw(EMIT, bag, x, y, s, s * 0.62, 0, VIO, 0.8 * al, 1); p.draw(EMIT, bag, x, y, s * 0.995, s * 0.995 * 0.62, 0, 0xffffff, 0.22 * al, 1);
      if (t >= nextArc && k < 0.85) {
        nextArc = t + 0.07; const i = Math.floor(Math.random() * 8), a0 = (i / 8) * Math.PI * 2 + Math.PI / 8, a1 = a0 + Math.PI / 4, r = R * 0.99 * g; arc = [];
        const ax = Math.cos(a0) * r, ay = Math.sin(a0) * r, bx = Math.cos(a1) * r, by = Math.sin(a1) * r;
        for (let j = 0; j <= 5; j++) { const u = j / 5, jj = j % 5 ? rnd(-9, 9) : 0; arc.push(x + ax + (bx - ax) * u + Math.cos((a0 + a1) / 2) * jj, y + (ay + (by - ay) * u + Math.sin((a0 + a1) / 2) * jj) * 0.62); }
      }
      for (let j = 0; j + 3 < arc.length; j += 2) { p.beam(EMIT, beam, arc[j], arc[j + 1], arc[j + 2], arc[j + 3], 8, VIO, 0.6 * al, 1); p.beam(EMIT, beam, arc[j], arc[j + 1], arc[j + 2], arc[j + 3], 2.5, PALE, 0.9 * al, 1); }
    });
    // eight trigram glyphs rise over the array's edges, one after another, bobbing on light beams
    for (let i = 0; i < 8; i++) {
      const d = i * 0.06, a = (i / 8) * Math.PI * 2, gx = x + Math.cos(a) * R * 0.91, gy = y + Math.sin(a) * R * 0.91 * 0.62;
      c.fx.add(1, DUR - d, (p, k, t) => {
        const pop = Math.min(1, t / 0.18), al = (k > 0.85 ? (1 - k) / 0.15 : 1) * pop, lift = 30 + easeOut(pop) * 18 + Math.sin(t * 3 + i) * 4;
        p.beam(EMIT, beam, gx, gy, gx, gy - lift, 5, VIO, 0.35 * al, 1);
        p.draw(EMIT, soft, gx, gy - lift, 0.9, 0.9, 0, VIO, 0.35 * al, 1);
        const s = 0.72 * (1.4 - 0.4 * easeOut(pop)); p.draw(EMIT, tris[i], gx, gy - lift, s, s, 0, PALE, 0.95 * al, 1); p.draw(EMIT, tris[i], gx, gy - lift, s * 1.35, s * 1.35, 0, VIO, 0.4 * al, 1);
      }, undefined, d);
      c.fx.later(d, () => c.fx.sparks(gx, gy - 30, 3, 0xd8c8ff, 200, -Math.PI / 2, 1.2, 8));
    }
    // caster: charged sword, rising sparks; the array collapses in a soft ring when it ends
    c.fx.burst(x, y - 34, c.mine ? 22 : 10, [VIO, PALE, 0xffffff], 360, 7, 0.55, 'spark', 0, 0.006);
    c.fx.glow(x, y - 34, 70, VIO, 0.5, 0.45);
    c.fx.later(DUR - 0.35, () => { c.fx.ring(x, y, R * 0.9, R * 1.2, 0.45, VIO, true, 0, 0.8); c.fx.burst(x, y - 20, c.mine ? 16 : 8, [VIO, PALE], 260, 6, 0.6); });
  },
  uhit: (c, e) => {
    const x = e.x, y = e.y, sx = x + rnd(-60, 60), sy = y - 420;
    zap(c, sx, sy, x, y - 4, 7, 0.34, 3); zap(c, sx + rnd(-20, 20), sy, x + rnd(-6, 6), y - 4, 2.5, 0.22, 1, 0.03, 0xc8a8ff);
    c.fx.glow(x, y - 14, 80, VIO, 0.42, 0.5); c.fx.glow(x, y - 6, 26, 0xffffff, 0.18, 0.5);
    c.fx.ring(x, y, 8, 100, 0.45, VIO, false, 0, 0.9); c.fx.ring(x, y, 4, 60, 0.3, PALE, true, 0, 0.6);
    c.fx.decal(x, y, 'scorch', 96, 0x140a24, 2.2, 0.62); c.fx.decal(x, y, 'crack', 74, 0x3a2070, 1.8, 0.5);
    c.fx.sparks(x, y - 8, 9, 0xd0b8ff, 480, -Math.PI / 2, 2.6, 12);
    c.fx.debris(x, y - 4, 4, 'shard', [0x5a4c78, 0x3a3050], 240, 5, 0.6);
    c.fx.smoke(x, y - 6, 2, 0x2e2640, 40, 26, 0.9, 0.35);
    c.fx.light(x, y - 12, 260, VIO, 1.2, 0.4);
    if (c.mine) { c.fx.shake(0.08); c.fx.wave(x, y - 10, 120, 10, 0.35); }
    c.snd.play('thunder', 0.4 * (c.mine ? 1 : 0.6), x, y);
  },
};
