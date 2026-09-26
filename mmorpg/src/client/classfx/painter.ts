// 화공: an ink blob lobbed from the brush splashes into a lingering ink pool (damage on landing + 2 ticks);
// ult 묵호도 = a scroll unrolls above the painter and brush-stroke ink tigers leap out of it, racing across the crowd
// with claw slashes and ink splatter. Black ink always gets a pale rim/glow so it reads on the dark night ground.
import { ATK } from '../../shared/data/classes.ts';
import { type Ctx, type Tex, makeTex } from '../render/art/core.ts';
import { Rand } from '../audio/synth.ts';
import { SCENE, EMIT } from '../render/paint.ts';
import type { ClassFx, FxCtx } from './types.ts';

const IVORY = 0xefe4cf, SUMI = 0x120d1a, INKC = '#100b17', PALE = 'rgba(238,230,212,0.62)', HI = '#f3ecdc';
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------------- textures (built once) ----------------
/** Tapered brush stroke through points (Catmull-Rom), stamped as discs; widths at start / middle / end, grown by `pad` (halo pass). */
function stroke(c: Ctx, pts: number[], w0: number, w1: number, w2: number, pad = 0): void {
  const n = pts.length / 2, seg = n - 1, N = Math.max(8, seg * 22); const P = (i: number, j: number) => pts[Math.max(0, Math.min(n - 1, i)) * 2 + j];
  for (let s = 0; s <= N; s++) {
    const u = (s / N) * seg, i = Math.min(seg - 1, Math.floor(u)), t = u - i;
    const cr = (j: number) => { const a = P(i - 1, j), b = P(i, j), cc = P(i + 1, j), d = P(i + 2, j); return 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t * t + (-a + 3 * b - 3 * cc + d) * t * t * t); };
    const k = s / N, w = k < 0.5 ? w0 + (w1 - w0) * k * 2 : w1 + (w2 - w1) * (k - 0.5) * 2;
    c.beginPath(); c.arc(cr(0), cr(1), Math.max(0.2, w / 2 + pad), 0, Math.PI * 2); c.fill();
  }
}
/** Point, unit tangent and normal at parameter t (0..1, by segment) of a polyline. */
function along(pts: number[], t: number): [number, number, number, number, number, number] {
  const n = pts.length / 2 - 1, u = Math.min(n - 1e-6, Math.max(0, t) * n), i = Math.floor(u), f = u - i;
  const x0 = pts[i * 2], y0 = pts[i * 2 + 1], dx = pts[i * 2 + 2] - x0, dy = pts[i * 2 + 3] - y0, L = Math.hypot(dx, dy) || 1;
  return [x0 + dx * f, y0 + dy * f, dx / L, dy / L, -dy / L, dx / L];
}
const wAt = (w0: number, w1: number, w2: number, t: number) => (t < 0.5 ? w0 + (w1 - w0) * t * 2 : w1 + (w2 - w1) * (t - 0.5) * 2);
interface TigerPose { spine: number[]; belly: number[]; head: [number, number]; tail: number[]; legs: number[][] }
/** Two gallop phases of the ink tiger (facing right in a 170×100 box, ground line y≈82). legs: far fore, far hind, near hind, near fore. */
const POSES: Record<'a' | 'b', TigerPose> = {
  a: { spine: [44, 45, 64, 36, 86, 32, 106, 34, 121, 39], belly: [50, 54, 70, 50, 92, 48, 112, 51], head: [134, 36], tail: [44, 44, 28, 41, 18, 31, 13, 19, 5, 12],
    legs: [[104, 48, 122, 60, 141, 71], [56, 54, 42, 67, 25, 80], [50, 54, 33, 60, 12, 71], [110, 48, 130, 57, 153, 63]] },
  b: { spine: [48, 43, 64, 30, 84, 26, 102, 31, 117, 40], belly: [52, 52, 72, 46, 92, 46, 108, 53], head: [128, 44], tail: [46, 42, 30, 34, 18, 34, 10, 41, 3, 36],
    legs: [[102, 50, 107, 66, 99, 81], [60, 52, 74, 63, 90, 79], [54, 52, 66, 66, 78, 81], [108, 50, 118, 64, 112, 81]] },
};
/** A dynamic brush-stroke ink tiger: tapered strokes, dry-brush gaps, white (negative) stripes and highlights, a pale halo. */
function drawTiger(c: Ctx, ph: 'a' | 'b', halo = true): void {
  const T = POSES[ph], r = new Rand(ph === 'a' ? 7 : 11), [hx, hy] = T.head;
  const SP: [number, number, number] = [20, 28, 23], BE: [number, number, number] = [18, 23, 19], TL: [number, number, number] = [8, 5, 1];
  const legW = (i: number): [number, number, number] => (i < 2 ? [11, 8, 5.5] : [13, 10, 6.5]);
  const head: [number[], number, number, number][] = [
    [[hx - 11, hy + 1, hx - 1, hy - 4, hx + 8, hy - 1], 20, 23, 17], [[hx + 6, hy + 2, hx + 15, hy + 3, hx + 21, hy + 5], 13, 11, 8], [[hx + 2, hy + 13, hx + 11, hy + 16.5, hx + 18, hy + 18], 9, 7, 3],
    [[hx - 6, hy + 5, hx - 13, hy + 11, hx - 20, hy + 14], 9, 5, 0.8], [[hx - 3, hy + 9, hx - 8, hy + 16, hx - 12, hy + 22], 8, 4, 0.6],
  ];
  const all = (pad: number) => {
    stroke(c, T.tail, ...TL, pad); T.legs.forEach((l, i) => stroke(c, l, ...legW(i), pad)); stroke(c, T.spine, ...SP, pad); stroke(c, T.belly, ...BE, pad);
    for (const [p, a, b, d] of head) stroke(c, p, a, b, d, pad);
    for (const [ex, ey, er] of [[hx - 9, hy - 10, 4.8], [hx - 1, hy - 12.5, 4.6]]) { c.beginPath(); c.arc(ex, ey, er + pad, 0, Math.PI * 2); c.fill(); }
    for (const i of [2, 3]) { const l = T.legs[i]; c.beginPath(); c.ellipse(l[4] + 1.5, l[5] + 0.5, 5 + pad, 3.6 + pad, 0, 0, Math.PI * 2); c.fill(); }
  };
  if (halo) { c.fillStyle = PALE; all(1.5); }
  c.fillStyle = INKC; all(0);
  // far legs in a grey wash for depth
  c.globalAlpha = 0.3; c.fillStyle = '#3b3552'; for (const i of [0, 1]) stroke(c, T.legs[i], 5, 3.5, 1.5); c.globalAlpha = 1;
  // dry-brush gaps (飛白) on the rump and tail tip, and the open mouth
  c.globalCompositeOperation = 'destination-out'; c.strokeStyle = '#000';
  for (let i = 0; i < 7; i++) { const o = -9 + i * 3 + r.bi() * 0.8, t1 = 0.12 + r.next() * 0.22; const [x0, y0, , , nx, ny] = along(T.spine, 0), [x1, y1, , , mx, my] = along(T.spine, t1); c.lineWidth = 0.5 + r.next() * 0.7; c.beginPath(); c.moveTo(x0 + nx * o - 3, y0 + ny * o); c.lineTo(x1 + mx * o, y1 + my * o); c.stroke(); }
  for (let i = 0; i < 3; i++) { const [x0, y0] = along(T.tail, 0.55), [x1, y1] = along(T.tail, 1); c.lineWidth = 0.6; c.beginPath(); c.moveTo(x0 + (i - 1) * 1.6, y0 + (i - 1) * 0.8); c.lineTo(x1 + (i - 1) * 2, y1 + (i - 1)); c.stroke(); }
  c.fillStyle = '#000'; c.beginPath(); c.moveTo(hx + 7, hy + 9); c.lineTo(hx + 23, hy + 8); c.lineTo(hx + 20, hy + 13.5); c.lineTo(hx + 9, hy + 12); c.closePath(); c.fill();
  c.globalCompositeOperation = 'source-over';
  // white stripes: pointed, slightly hooked brush marks around the body, legs and tail
  c.fillStyle = HI;
  for (let i = 0; i < 8; i++) {
    const t = 0.13 + i * 0.105, [x, y, tx, ty, nx, ny] = along(T.spine, t), hw = wAt(...SP, t) / 2, L = hw * (1.05 + r.next() * 0.45);
    const x0 = x - nx * (hw - 1.2), y0 = y - ny * (hw - 1.2); stroke(c, [x0, y0, x0 + nx * L * 0.5 - tx * 2.4, y0 + ny * L * 0.5 - ty * 2.4, x0 + nx * L - tx * 1.2, y0 + ny * L - ty * 1.2], 0.4, 2.9 - (i % 2) * 0.7, 0.3);
    if (i % 2 === 0) stroke(c, [x0 + nx * L * 0.45 - tx * 2, y0 + ny * L * 0.45 - ty * 2, x0 + nx * L * 0.7 - tx * 5.5, y0 + ny * L * 0.7 - ty * 5.5], 1.4, 1, 0.2);
  }
  for (const i of [2, 3]) for (const t of [0.38, 0.62]) { const [x, y, , , nx, ny] = along(T.legs[i], t), hw = wAt(...legW(i), t) / 2; stroke(c, [x - nx * hw * 0.9, y - ny * hw * 0.9, x + nx * hw * 0.1 + 1, y + ny * hw * 0.1, x + nx * hw * 0.8, y + ny * hw * 0.8], 0.3, 2, 0.3); }
  for (const t of [0.2, 0.42, 0.64]) { const [x, y, , , nx, ny] = along(T.tail, t), hw = wAt(...TL, t) / 2; stroke(c, [x - nx * hw, y - ny * hw, x + nx * hw, y + ny * hw], 1.6, 1.8, 1.2); }
  // pale rim along the back and belly
  c.globalAlpha = 0.75; const rim = [0.2, 0.4, 0.6, 0.8].flatMap(t => { const [x, y, , , nx, ny] = along(T.spine, t), hw = wAt(...SP, t) / 2; return [x - nx * (hw - 1), y - ny * (hw - 1)]; }); stroke(c, rim, 0.3, 1.3, 0.3); c.globalAlpha = 1;
  // face: ears, 王 brow mark, eye, muzzle highlight, ruff, fangs, whisker dots
  c.strokeStyle = HI; c.lineWidth = 1; for (const [ex, ey] of [[hx - 9, hy - 10], [hx - 1, hy - 12.5]]) { c.beginPath(); c.arc(ex, ey + 0.6, 2.2, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
  c.lineWidth = 0.9; c.beginPath(); for (const [dy, w] of [[-9.5, 2.2], [-7, 1.6], [-4.5, 2.4]]) { c.moveTo(hx - 5 - w, hy + dy); c.lineTo(hx - 5 + w, hy + dy); } c.moveTo(hx - 5, hy - 9.5); c.lineTo(hx - 5, hy - 4.5); c.stroke();
  c.beginPath(); c.moveTo(hx, hy - 1); c.quadraticCurveTo(hx + 4, hy - 5, hx + 9, hy - 2.5); c.quadraticCurveTo(hx + 5, hy + 1.5, hx, hy - 1); c.fill();
  c.fillStyle = '#e8b030'; c.beginPath(); c.arc(hx + 5, hy - 2, 1.7, 0, Math.PI * 2); c.fill(); c.fillStyle = INKC; c.fillRect(hx + 4.6, hy - 3.6, 0.8, 3.2);
  c.fillStyle = HI; c.lineWidth = 1.3; c.beginPath(); c.moveTo(hx - 1, hy - 5); c.lineTo(hx + 9, hy - 6.5); c.stroke();
  stroke(c, [hx + 8, hy - 0.5, hx + 15, hy - 0.2, hx + 21, hy + 2], 0.4, 1.6, 0.4);
  for (const [a, b2, d] of [[-8, 9, 11], [-5, 12, 14]]) stroke(c, [hx + a, hy + b2 - 2, hx + a - 5, hy + b2 + 2, hx + a - 9, hy + d + 2], 0.3, 1.4, 0.2);
  for (const f of [[hx + 11.5, hy + 8.6, 12.5, 12.6, 13.6, 8.5], [hx + 18.5, hy + 8.2, 19.3, 12, 20.4, 8.1], [hx + 13.5, hy + 13.8, 14.6, 10.6, 15.8, 13.6]]) { c.beginPath(); c.moveTo(f[0], f[1]); c.lineTo(hx + f[2], hy + f[3]); c.lineTo(hx + f[4], hy + f[5]); c.closePath(); c.fill(); }
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(hx + 14 + i * 2.2, hy + 4.8 - i * 0.3, 0.55, 0, Math.PI * 2); c.fill(); }
  // claws on the near paws
  c.lineWidth = 0.9; for (const i of [2, 3]) { const l = T.legs[i], x = l[4] + 4, y = l[5] + 0.5; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(x, y + k * 2); c.quadraticCurveTo(x + 4, y + k * 2.2, x + 4.5, y + 1.8 + k * 2.4); c.stroke(); } }
  // spatter flung behind
  for (let i = 0; i < 9; i++) { const x = r.range(2, 44), y = r.range(30, 94), rr = r.range(0.7, 2.3); c.fillStyle = 'rgba(238,230,212,0.4)'; c.beginPath(); c.arc(x, y, rr + 0.6, 0, Math.PI * 2); c.fill(); c.fillStyle = INKC; c.beginPath(); c.arc(x, y, rr, 0, Math.PI * 2); c.fill(); }
}
/** Blobby splat outline (main body radius `R` + satellite drops) as one path. */
function splatPath(c: Ctx, seed: number, S: number, R: number, sat = true): void {
  const r = new Rand(seed), cx = S / 2, cy = S / 2, N = 20; const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, rr = R * (0.8 + r.next() * 0.32) * (i % 5 === 0 ? 1.18 : 1); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  const mid = (i: number) => { const p = pts[i % N], q = pts[(i + 1) % N]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; };
  c.beginPath(); const m0 = mid(N - 1); c.moveTo(m0[0], m0[1]); for (let i = 0; i < N; i++) { const m = mid(i); c.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); } c.closePath();
  if (sat) for (let i = 0; i < 11; i++) { const a = r.next() * Math.PI * 2, d = R * (1.12 + r.next() * 0.34), rr = R * (0.03 + r.next() * 0.07); c.moveTo(cx + Math.cos(a) * d + rr, cy + Math.sin(a) * d); c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr, 0, Math.PI * 2); }
}
let TX: Record<string, Tex> | null = null, UX: Record<string, Tex> | null = null;
/** Basic-attack textures. */
function tex(): Record<string, Tex> {
  if (TX) return TX;
  const S = 128, R = 44;
  const pool = (seed: number) => makeTex('painter:pool' + seed, S, S, 0.5, 0.5, 1.5, c => {
    splatPath(c, seed, S, R); const g = c.createRadialGradient(S / 2 - 10, S / 2 - 10, 4, S / 2, S / 2, R * 1.2); g.addColorStop(0, '#2e2546'); g.addColorStop(0.6, '#191325'); g.addColorStop(1, '#0c0812');
    c.fillStyle = g; c.fill(); splatPath(c, seed, S, R, false); c.strokeStyle = 'rgba(232,224,206,0.4)'; c.lineWidth = 1.4; c.stroke();
    c.beginPath(); c.ellipse(S / 2 - 14, S / 2 - 16, 14, 6, -0.5, Math.PI * 1.05, Math.PI * 1.75); c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 2.4; c.stroke();
  });
  const rim = (seed: number) => makeTex('painter:rim' + seed, S, S, 0.5, 0.5, 1.5, c => { splatPath(c, seed, S, R, false); c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 7; c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 1.8; c.stroke(); });
  TX = {
    pool0: pool(41), pool1: pool(77), rim0: rim(41), rim1: rim(77),
    blob: makeTex('painter:blob', 24, 24, 0.5, 0.5, 2, c => {
      c.fillStyle = PALE; c.beginPath(); c.ellipse(12, 12, 9.4, 8.4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = INKC; c.beginPath(); c.ellipse(12.5, 12, 8, 7, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(5, 9); c.quadraticCurveTo(-1, 12, 5, 15); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.ellipse(15, 9, 2.8, 1.4, -0.4, 0, Math.PI * 2); c.fill();
    }),
  };
  return TX;
}
/** Ultimate textures (built on the first ult: tigers, claws, ground stroke, scroll). */
function utex(): Record<string, Tex> {
  if (UX) return UX;
  UX = {
    claw: makeTex('painter:claw', 64, 64, 0.5, 0.5, 2, c => { c.fillStyle = '#fff'; for (let i = -1; i <= 1; i++) stroke(c, [12 + i * 9, 50 + i * 3, 30 + i * 9, 34 + i * 2, 52 + i * 8, 12 + i * 3], 0.6, 5.2 - Math.abs(i), 0.6); }),
    stroke: makeTex('painter:stroke', 256, 64, 0, 0.5, 1, c => {
      const pts = [4, 34, 60, 30, 130, 35, 200, 29, 244, 32]; c.fillStyle = 'rgba(232,224,206,0.45)'; stroke(c, pts, 6, 34, 40, 2.2); c.fillStyle = INKC; stroke(c, pts, 6, 34, 40);
      const r = new Rand(5); c.globalCompositeOperation = 'destination-out'; c.strokeStyle = '#000';
      for (let i = 0; i < 9; i++) { const y = 18 + i * 3.6 + r.bi(); c.lineWidth = 0.8 + r.next() * 1.2; c.beginPath(); c.moveTo(0, y); c.lineTo(60 + r.next() * 90, y + r.bi() * 3); c.stroke(); }
      c.globalCompositeOperation = 'source-over';
    }),
    tigerA: makeTex('painter:tigerA', 170, 100, 0.55, 0.82, 2, c => drawTiger(c, 'a')),
    tigerB: makeTex('painter:tigerB', 170, 100, 0.55, 0.82, 2, c => drawTiger(c, 'b')),
    scroll: makeTex('painter:scroll', 200, 60, 0.5, 0.5, 2, c => {
      c.fillStyle = '#46597f'; c.fillRect(0, 0, 200, 60); c.fillStyle = '#e2b64c'; c.fillRect(0, 6.5, 200, 1); c.fillRect(0, 52.5, 200, 1);
      const g = c.createLinearGradient(0, 8, 0, 52); g.addColorStop(0, '#e6dcc2'); g.addColorStop(1, '#d2c4a4'); c.fillStyle = g; c.fillRect(0, 8, 200, 44);
      c.save(); c.translate(38, 8); c.scale(0.44, 0.44); drawTiger(c, 'a', false); c.restore();
      c.fillStyle = INKC; stroke(c, [22, 14, 20, 26, 23, 40], 1, 3.2, 0.6); stroke(c, [30, 16, 31, 30], 0.8, 2.6, 0.5); stroke(c, [16, 44, 70, 47, 130, 45, 184, 47], 0.5, 1.6, 0.3);
      c.fillStyle = '#c8323a'; c.fillRect(168, 14, 12, 12); c.strokeStyle = '#f3e4dc'; c.lineWidth = 1; c.strokeRect(170, 16, 8, 8); c.beginPath(); c.moveTo(174, 16); c.lineTo(174, 24); c.moveTo(170, 20); c.lineTo(178, 20); c.stroke();
      c.strokeStyle = '#0c0812'; c.lineWidth = 1.4; c.strokeRect(0.7, 0.7, 198.6, 58.6);
    }),
    roller: makeTex('painter:roller', 12, 72, 0.5, 0.5, 2, c => {
      const g = c.createLinearGradient(2, 0, 10, 0); g.addColorStop(0, '#9a6a3a'); g.addColorStop(0.5, '#6a4222'); g.addColorStop(1, '#3a2412'); c.fillStyle = g; c.fillRect(3, 4, 6, 64);
      c.fillStyle = '#2a1a10'; for (const y of [0, 66]) { c.beginPath(); c.roundRect(1.5, y, 9, 6, 2); c.fill(); } c.strokeStyle = '#0c0812'; c.lineWidth = 1; c.strokeRect(3, 4, 6, 64);
    }),
  };
  return UX;
}

// ---------------- pieces ----------------
/** Ink droplet with a pale halo so it reads on the dark ground (two particles sharing one motion). */
function drop(c: FxCtx, x: number, y: number, vx: number, vy: number, size: number, life: number, g = 650): void {
  c.fx.part({ tex: 'dot', layer: EMIT, add: 1, x, y, vx, vy, g, drag: 0.94, life, size: size * 1.6, col: IVORY, a: 0.24 });
  c.fx.part({ tex: 'dot', layer: EMIT, add: 0, x, y, vx, vy, g, drag: 0.94, life, size, col: SUMI, a: 1 });
}
/** Dark ink pool on the ground (radius ≈ r) with a faint pale rim glow; grows in, lingers, fades. */
function pool(c: FxCtx, x: number, y: number, r: number, dur: number, v = Math.random() < 0.5 ? 0 : 1): void {
  const A = tex(), P = v ? A.pool1 : A.pool0, Rm = v ? A.rim1 : A.rim0; const s = r / 44, flip = Math.random() < 0.5 ? -1 : 1;
  c.fx.add(0, dur, (p, k, t) => {
    const g = t < 0.14 ? 0.5 + 0.5 * (1 - (1 - t / 0.14) ** 3) : 1, a = k > 0.55 ? (1 - k) / 0.45 : 1, sx = s * g;
    p.draw(SCENE, P, x, y, sx * flip, sx * 0.9, 0, 0xffffff, 0.86 * a, 0); // nearly round: the pool hurts everything within inkR
    p.draw(EMIT, Rm, x, y, sx * flip, sx * 0.9, 0, IVORY, (t < 0.25 ? 0.4 - t * 0.8 : 0.2) * a, 1);
  });
}
/** Splash where the ink blob lands: pool, crown of droplets, pale ring, a little light; then the two damage ticks ripple. */
function splash(c: FxCtx, x: number, y: number): void {
  const R = ATK.inkR, n = c.fx.low ? 3 : 6;
  pool(c, x, y, R, 1.25);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rnd(-0.3, 0.3), s = rnd(90, 190); drop(c, x + Math.cos(a) * 8, y - 6, Math.cos(a) * s, Math.sin(a) * s * 0.6 - rnd(120, 220), rnd(4, 7), rnd(0.35, 0.55)); }
  c.fx.sparks(x, y - 8, 3, IVORY, 260, -Math.PI / 2, 2.4, 8);
  c.fx.ring(x, y, 10, R, 0.32, IVORY, true, 0, 0.5); c.fx.light(x, y, 150, IVORY, 0.5, 0.35);
  const ink = c.art.fx('ink1');
  c.fx.add(1, 0.22, (p, k) => { const s = (R * 1.5) / 96 * (0.4 + 0.6 * (1 - (1 - k) ** 2)); p.draw(EMIT, ink, x, y - 10, s, s * 0.55, 0, SUMI, 0.85 * (1 - k), 0); });
  for (let k = 1; k <= ATK.inkTicks; k++) c.fx.later(k * 0.5, () => c.fx.ring(x, y, 14, R * 0.95, 0.4, IVORY, true, 0, 0.32));
  c.snd.play('ink', c.vol * 0.9, x, y);
}
/** Ink blob lobbed from the brush to the target's feet (tracks the monster), arriving when the server lands the pool (dist / 700). */
function lob(c: FxCtx, tx: number, ty: number, tid: number | undefined, ang: number): void {
  const A = tex(), soft = c.art.fx('soft'), streak = c.art.fx('streak');
  const x0 = c.x + Math.cos(ang) * 18, y0 = c.y - 32; const c0 = tid ? c.entPos('m', tid) : null; const off = c0 ? ty - c0.y : 0, track = c0 ? tid : 0;
  const T = Math.max(0.1, Math.hypot(tx - c.x, ty - c.y) / 700), h = Math.min(70, Math.hypot(tx - x0, ty - y0) * 0.22) + 8;
  let t = 0, x = x0, y = y0, rot = ang, drip = 0.02;
  c.fx.add(1, T + 0.1, (p) => {
    p.draw(EMIT, soft, x, y, 0.8, 0.8, 0, IVORY, 0.32, 1); p.draw(EMIT, streak, x, y, 0.7, 2.6, rot, IVORY, 0.28, 1); p.draw(EMIT, streak, x, y, 0.62, 1.7, rot, SUMI, 0.85, 0);
    p.draw(EMIT, A.blob, x, y, 1.45, 1.1, rot, 0xffffff, 1, 0);
  }, (dt) => {
    t += dt; if (track) { const q = c.entPos('m', track); if (q) { tx = q.x; ty = q.y + off; } }
    const k = Math.min(1, t / T), nx = x0 + (tx - x0) * k, ny = y0 + (ty - y0) * k - h * 4 * k * (1 - k);
    if (nx !== x || ny !== y) rot = Math.atan2(ny - y, nx - x); x = nx; y = ny;
    if ((drip -= dt) <= 0 && !c.fx.low) { drip = 0.09; c.fx.part({ tex: 'dot', layer: EMIT, add: 0, x, y, vx: rnd(-25, 25), vy: rnd(-30, 10), g: 300, life: 0.3, size: rnd(4, 5.5), col: SUMI }); }
    if (k >= 1) { splash(c, tx, ty); return false; }
    return true;
  });
}
/** Three glowing claw rakes with a dark ink core. */
function claw(c: FxCtx, x: number, y: number, rot: number, size: number): void {
  const t = utex().claw;
  c.fx.add(1, 0.42, (p, k) => {
    const g = k < 0.2 ? 0.6 + 2 * k : 1, s = (size / 64) * g, a = k < 0.2 ? 1 : 1 - (k - 0.2) / 0.8;
    p.draw(EMIT, t, x, y, s * 1.08, s * 1.08, rot, SUMI, 0.9 * a, 0); p.draw(EMIT, t, x, y, s * 0.9, s * 0.9, rot, IVORY, 0.8 * a, 1);
  });
}

// ---------------- class fx ----------------
const scrolls = new Map<number, { x: number; y: number; until: number }>();
export const painter: ClassFx = {
  warm: () => { tex(); utex(); }, reset: () => scrolls.clear(),
  atkDur: 0.32, ultR: 190,
  atk: (c, e, ang) => { lob(c, e.tx, e.ty, e.tid, ang); c.snd.play('brush', c.vol, c.x, c.y); },
  ult: (c, e) => {
    const A = utex(), soft = c.art.fx('soft'), x = e.x, y = e.y, sy = y - 124, low = c.fx.low;
    // ink burst at the painter
    pool(c, x, y, 105, 2.1); c.fx.smoke(x, y - 16, low ? 3 : 7, 0x1a1426, 150, 40, 1, 0.38); c.fx.ring(x, y, 20, 210, 0.6, IVORY, true, 0, 0.55);
    for (let i = 0; i < (low ? 8 : 18); i++) { const a = rnd(0, Math.PI * 2), s = rnd(140, 360); drop(c, x, y - 24, Math.cos(a) * s, Math.sin(a) * s * 0.6 - rnd(150, 300), rnd(5, 9), rnd(0.5, 0.8)); }
    c.snd.play('ink', c.vol, x, y);
    // the scroll unrolls above the painter; the tigers leap out of it
    for (const [k, v] of scrolls) if (v.until < c.fx.time) scrolls.delete(k);
    scrolls.set(c.id, { x, y: sy, until: c.fx.time + 2.1 });
    c.fx.add(1, 2.15, (p, _k, t) => {
      const u = Math.min(1, t / 0.3), open = 1 - (1 - u) ** 3, a = Math.min(1, t / 0.06) * (t > 1.85 ? Math.max(0, 1 - (t - 1.85) / 0.3) : 1), b = Math.sin(t * 3) * 2, S = 0.95;
      p.draw(EMIT, soft, x, sy + b, (230 * open) / 64, 100 / 64, 0, IVORY, 0.2 * a, 1);
      p.draw(EMIT, A.scroll, x, sy + b, S * Math.max(0.03, open), S, 0, 0xffffff, a, 0);
      for (const d of [-1, 1]) p.draw(EMIT, A.roller, x + d * (100 * S * open + 4), sy + b, S, S, 0, 0xffffff, a, 0);
    });
    c.fx.light(x, sy, 260, IVORY, 0.6, 2);
  },
  uhit: (c, e) => {
    if (e.x2 == null || e.y2 == null) return;
    const A = utex(), soft = c.art.fx('soft'), beam = c.art.fx('beam'); const x0 = e.x, y0 = e.y, x1 = e.x2, y1 = e.y2, dx = x1 - x0, dy = y1 - y0;
    const dir = dx >= 0 ? 1 : -1, rot = dir * clamp(Math.atan2(dy, Math.abs(dx)), -0.5, 0.5), pathRot = Math.atan2(dy, dx);
    const RUN = 0.36, SC = 0.92, low = c.fx.low; const ease = (k: number) => 1 - (1 - k) ** 1.6;
    const at = (k: number): [number, number] => { const q = ease(Math.max(0, Math.min(1, k))); return [x0 + dx * q, y0 + dy * q]; };
    // it leaps out of the painting
    const sc = scrolls.get(c.id);
    if (sc && c.fx.time < sc.until) { c.fx.ring(sc.x, sc.y, 10, 110, 0.35, IVORY, true, 1, 0.5); for (let i = 0; i < (low ? 3 : 7); i++) drop(c, sc.x + rnd(-60, 60), sc.y + 20, rnd(-60, 60), rnd(-80, 20), rnd(4, 7), 0.5); }
    c.fx.smoke(x0, y0 - 20, low ? 2 : 4, 0x1a1426, 70, 36, 0.7, 0.55);
    // painted ground stroke that follows the tiger, then dries away
    c.fx.add(0, RUN + 0.9, (p, _k, t) => {
      const [hx, hy] = at(t / RUN), a = t < RUN ? 1 : 1 - (t - RUN) / 0.9;
      p.beam(EMIT, beam, x0, y0, hx, hy, 76, IVORY, 0.13 * a, 1); p.beam(SCENE, A.stroke, x0, y0, hx, hy, 54, 0xffffff, 0.9 * a, 0);
    });
    // the tiger (two gallop frames) with afterimages and a pale glow so the black ink reads at night
    let t = 0, spl = 0, ci = 0, done = false; const clawK = [0.3, 0.55, 0.8];
    c.fx.add(1, RUN + 0.24, (p, _k, tt) => {
      const fr = Math.floor(tt / 0.075) % 2 ? A.tigerB : A.tigerA, fin = tt > RUN ? Math.max(0, 1 - (tt - RUN) / 0.24) : 1, fadeIn = Math.min(1, tt / 0.05);
      for (const [lag, al] of [[0.09, 0.2], [0.045, 0.38], [0, 1]]) {
        const [hx, hy] = at((tt - lag) / RUN), a = al * fin * fadeIn; if (a <= 0.01 || tt < lag) continue;
        const s = SC * (tt > RUN ? 1 + (tt - RUN) * 1.2 : 1);
        if (!lag) p.draw(EMIT, soft, hx, hy - 38, 2.9 * s, 1.7 * s, rot, IVORY, 0.3 * a, 1);
        p.draw(EMIT, fr, hx, hy, s * dir, s, rot, 0xffffff, a, 0);
      }
    }, (dt) => {
      t += dt; const k = Math.min(1, t / RUN), [hx, hy] = at(k);
      if (t < RUN && (spl -= dt) <= 0) { spl = low ? 0.07 : 0.035; drop(c, hx - Math.cos(pathRot) * 30, hy - 4, -Math.cos(pathRot) * rnd(60, 160) + rnd(-40, 40), -rnd(120, 240), rnd(4, 7), rnd(0.35, 0.55)); }
      while (ci < clawK.length && k >= clawK[ci]) { const q = at(clawK[ci]); claw(c, q[0] + rnd(-10, 10), q[1] - 30 + rnd(-8, 8), pathRot + (ci % 2 ? 0.5 : -0.3), 96); if (ci === 1) c.snd.play('slash', c.vol * 0.5, q[0], q[1]); ci++; }
      if (!done && t >= RUN) {
        done = true; pool(c, x1, y1, 50, 1.3); c.fx.ring(x1, y1, 16, 140, 0.4, IVORY, true, 0, 0.5); c.fx.smoke(x1, y1 - 20, low ? 2 : 5, 0x1a1426, 90, 40, 0.8, 0.6);
        for (let i = 0; i < (low ? 3 : 7); i++) { const a = rnd(0, Math.PI * 2), s = rnd(120, 260); drop(c, x1, y1 - 20, Math.cos(a) * s, Math.sin(a) * s * 0.6 - rnd(100, 200), rnd(5, 8), rnd(0.4, 0.65)); }
        c.fx.light(x1, y1, 200, IVORY, 0.6, 0.4); if (c.mine) c.fx.wave(x1, y1 - 20, 140, 10, 0.45);
      }
      return true;
    });
    c.fx.light((x0 + x1) / 2, (y0 + y1) / 2, 320, IVORY, 0.55, 0.6);
    c.snd.play('ink', c.vol, x0, y0);
    if (c.mine) { c.fx.shake(0.22); c.fx.zoomPunch(0.012); }
  },
};
