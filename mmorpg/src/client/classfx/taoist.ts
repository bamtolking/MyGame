// 도사: violet chain lightning flicked from the talismans; ult 천뢰진 = a 八卦 thunder array of eight floating talismans and 12 bolts from the sky.
import { EMIT } from '../render/paint.ts';
import { type Tex, type Ctx, makeTex, circle } from '../render/art/core.ts';
import type { ClassFx, FxCtx } from './types.ts';

const VIO = 0xa47bff, LILAC = 0xcdb6ff, BODY = 0x9f78ff, DEEP = 0x6a3cff;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
/** Trigrams in 後天 order around the array; bit i set = line i (inner first) is solid. */
const TRI = [7, 6, 5, 4, 3, 2, 1, 0];
const SQ = 0.62; // ground ellipse squash

/** Three bars of a trigram centred at (x, y); the first line is the bottom one. */
function bars(c: Ctx, b: number, x: number, y: number, w: number, h: number, gap: number): void {
  for (let i = 0; i < 3; i++) { const yy = y + (1 - i) * (h + gap); if (b & (1 << i)) c.fillRect(x - w / 2, yy - h / 2, w, h); else { c.fillRect(x - w / 2, yy - h / 2, w * 0.42, h); c.fillRect(x + w * 0.08, yy - h / 2, w * 0.42, h); } }
}
/** Ground 八卦 array (white, tinted at draw time): double ring, two octagons with spokes, the eight trigrams, element glyphs and a 太極. */
let arrT: Tex | null = null;
const arrayTex = (): Tex => arrT ??= makeTex('fx:taoArray', 256, 256, 0.5, 0.5, 2, c => {
  c.translate(128, 128); c.strokeStyle = '#fff'; c.fillStyle = '#fff';
  const V = (r: number, i: number, o = 0): [number, number] => { const a = (i / 8) * Math.PI * 2 + o; return [Math.cos(a) * r, Math.sin(a) * r]; };
  const oct = (r: number) => { c.beginPath(); for (let i = 0; i <= 8; i++) c.lineTo(...V(r, i)); c.stroke(); };
  const ring = (r: number) => { c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); };
  // soft under-glow first (wide, faint), then the crisp lines
  for (const [m, a] of [[4, 0.16], [1, 1]] as [number, number][]) {
    c.globalAlpha = a; c.lineWidth = 2.4 * m; ring(124); c.lineWidth = 1 * m; ring(118); c.lineWidth = 2 * m; oct(112); c.lineWidth = 1.3 * m; oct(80); c.lineWidth = 1.2 * m; ring(56); ring(28);
    c.lineWidth = 1 * m; for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(...V(80, i)); c.lineTo(...V(112, i)); c.stroke(); c.beginPath(); c.moveTo(...V(56, i, Math.PI / 8)); c.lineTo(...V(80, i, Math.PI / 8)); c.stroke(); }
  }
  c.globalAlpha = 1;
  for (let i = 0; i < 8; i++) { circle(c, ...V(112, i), 3.4); c.fill(); c.save(); c.rotate((i / 8) * Math.PI * 2 + Math.PI / 8 + Math.PI / 2); bars(c, TRI[i], 0, -96, 22, 3.2, 2.6); c.restore(); }
  c.font = 'bold 15px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  [...'天澤火雷風水山地'].forEach((g, i) => { c.save(); c.rotate((i / 8) * Math.PI * 2 + Math.PI / 8 + Math.PI / 2); c.fillText(g, 0, -42); c.restore(); });
  // 太極 (faint fill: the caster stands on it and the generic ult sigil already has a bright one)
  c.beginPath(); c.arc(0, 0, 24, -Math.PI / 2, Math.PI / 2); c.arc(0, 12, 12, Math.PI / 2, -Math.PI / 2, true); c.arc(0, -12, 12, Math.PI / 2, -Math.PI / 2);
  c.globalAlpha = 0.3; c.fill(); c.globalAlpha = 1; c.lineWidth = 1.2; c.stroke(); circle(c, 0, 12, 3.6); c.fill(); circle(c, 0, -12, 3.6); c.stroke();
});
/** Floating 부적 for the array: yellow slip, red border, red seal scrawl and an ink trigram (full colour, drawn untinted). */
let talT: Tex[] | null = null;
const talTex = (): Tex[] => talT ??= TRI.map(b => makeTex('fx:taoTal' + b, 12, 26, 0.5, 0.5, 3, c => {
  c.fillStyle = '#f2cf5c'; c.fillRect(0.6, 0.6, 10.8, 24.8); c.strokeStyle = '#b8322e'; c.lineWidth = 0.9; c.strokeRect(1.8, 1.8, 8.4, 22.4);
  c.fillStyle = '#2a1830'; bars(c, b, 6, 6.2, 6.4, 1.3, 1.1);
  c.strokeStyle = '#c42a2e'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(6, 10.5); c.lineTo(6, 23); c.moveTo(3.4, 13); c.lineTo(8.6, 13); c.moveTo(3.6, 16.5); c.quadraticCurveTo(8.6, 16, 4, 20.5); c.lineTo(8.4, 21.5); c.stroke();
}));

/** Jagged, flickering lightning (violet glow, lilac body, white core) with side forks; the path is re-rolled every few frames. */
function zap(c: FxCtx, x1: number, y1: number, x2: number, y2: number, w: number, dur: number, forks: number, delay = 0, end = 0.3): void {
  const beam = c.art.fx('beam'), soft = c.art.fx('soft'); const L = Math.hypot(x2 - x1, y2 - y1) || 1; const n = Math.max(3, Math.min(16, Math.round(L / 22)));
  const nx = -(y2 - y1) / L, ny = (x2 - x1) / L, jag = Math.min(28, L * 0.16), fk = c.fx.low ? Math.min(1, forks) : forks; let pts: number[] = [], fks: number[][] = [], next = -1;
  const build = () => {
    pts = []; for (let i = 0; i <= n; i++) { const t = i / n, j = i === 0 || i === n ? 0 : (Math.random() - 0.5) * jag * 2 * (0.4 + Math.sin(t * Math.PI) * 0.6); pts.push(x1 + (x2 - x1) * t + nx * j, y1 + (y2 - y1) * t + ny * j); }
    fks = []; for (let f = 0; f < fk; f++) {
      const i = 1 + Math.floor(Math.random() * (n - 1)); let x = pts[i * 2], y = pts[i * 2 + 1]; const a = Math.atan2(y2 - y1, x2 - x1) + (Math.random() < 0.5 ? -1 : 1) * rnd(0.5, 1.1); const q = [x, y];
      for (let s = 0; s < 3; s++) { const l = Math.min(40, L * rnd(0.05, 0.09)); x += Math.cos(a + rnd(-0.6, 0.6)) * l; y += Math.sin(a + rnd(-0.6, 0.6)) * l; q.push(x, y); } fks.push(q);
    }
  };
  c.fx.add(1, dur, (p, k, t) => {
    if (t >= next) { build(); next = t + 0.05; }
    const a = (k < 0.15 ? 1 : 1 - (k - 0.15) / 0.85) * (Math.random() < 0.2 ? 0.55 : 1), fat = k < 0.12 ? 1.25 : 1;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      p.beam(EMIT, beam, pts[i], pts[i + 1], pts[i + 2], pts[i + 3], w * 3.8 * fat, VIO, a * 0.72, 1);
      p.beam(EMIT, beam, pts[i], pts[i + 1], pts[i + 2], pts[i + 3], w * 1.3, BODY, a * 0.85, 1);
      p.beam(EMIT, beam, pts[i], pts[i + 1], pts[i + 2], pts[i + 3], w * 0.4, 0xffffff, a * 0.85, 1);
    }
    for (const q of fks) for (let i = 0; i + 3 < q.length; i += 2) { p.beam(EMIT, beam, q[i], q[i + 1], q[i + 2], q[i + 3], w * 2, VIO, a * 0.45, 1); p.beam(EMIT, beam, q[i], q[i + 1], q[i + 2], q[i + 3], w * 0.5, BODY, a * 0.85, 1); }
    if (end > 0) p.draw(EMIT, soft, x2, y2, w * 0.2, w * 0.2, 0, VIO, a * end, 1);
  }, undefined, delay);
}
/** Where a chain bolt lands: a few sparks, a thin violet ring on the first target, a brief light. */
function spark(c: FxCtx, x: number, y: number, first: boolean): void {
  c.fx.sparks(x, y, first ? 6 : 4, LILAC, 300, undefined, Math.PI, 8);
  c.fx.light(x, y, 110, VIO, 0.8, 0.24);
  if (first) c.fx.ring(x, y, 5, 30, 0.22, VIO, false, 1, 0.55);
}

export const taoist: ClassFx = {
  atkDur: 0.3, ultR: 150,
  atk: (c, e, ang) => {
    // bolt leaves the flicked talismans in front of the chest (atk1 frame) → target → each chain jump in order
    const f = Math.cos(ang) < 0 ? -1 : 1; const ox = c.x + f * 20, oy = c.y - 30; const D = 0.06, J = 0.045;
    const t0 = e.tid ? c.entPos('m', e.tid) : null; const hits: number[] = [t0 ? t0.x : e.tx, t0 ? t0.y : e.ty - 16];
    for (let i = 0; e.pts && i + 1 < e.pts.length; i += 2) hits.push(e.pts[i], e.pts[i + 1] - 16);
    c.fx.glow(ox, oy, 18, VIO, 0.22, 0.45);
    c.fx.part({ tex: 'paper', x: ox, y: oy, vx: Math.cos(ang) * 120, vy: Math.sin(ang) * 120 - 50, drag: 0.85, life: 0.26, size: 5, spin: 18, col: 0xfff0c0, a: 0.9, add: 0 });
    c.fx.sparks(ox, oy, 3, LILAC, 220, ang, 1.2, 6);
    let px = ox, py = oy;
    for (let k = 0; k < hits.length / 2; k++) {
      const hx = hits[k * 2], hy = hits[k * 2 + 1];
      zap(c, px, py, hx, hy, k ? 2.6 : 3.2, 0.22, k ? 1 : 2, D + k * J, k ? 0.22 : 0.3);
      c.fx.later(D + k * J, () => spark(c, hx, hy, k === 0));
      px = hx; py = hy;
    }
    c.snd.play('zap', c.vol, c.x, c.y);
  },
  ult: (c, e) => {
    // 12 strikes at 0.15 + k·0.2 s → the array holds until the last bolt has faded
    const x = e.x, y = e.y, R = 230, DUR = 2.8; const arr = arrayTex(), tals = talTex(), soft = c.art.fx('soft'), beam = c.art.fx('beam');
    const V = (i: number, r: number): [number, number] => { const a = (i / 8) * Math.PI * 2; return [x + Math.cos(a) * r, y + Math.sin(a) * r * SQ]; };
    let arc: number[] = [], nextArc = 0;
    c.fx.add(0, DUR, (p, k, t) => {
      const g = k < 0.09 ? easeOut(k / 0.09) : 1, al = k < 0.06 ? k / 0.06 : k > 0.86 ? (1 - k) / 0.14 : 1, s = (R * 2) / arr.w * (0.55 + 0.45 * g), pulse = 0.85 + 0.15 * Math.sin(t * 9);
      p.draw(EMIT, soft, x, y, R / 26, R / 26 * SQ, 0, DEEP, 0.12 * al, 1);
      p.draw(EMIT, arr, x, y, s * 1.01, s * 1.01 * SQ, 0, DEEP, 0.55 * al, 1); p.draw(EMIT, arr, x, y, s, s * SQ, 0, VIO, 0.3 * al * pulse, 1);
      if (t < 0.25) p.draw(EMIT, arr, x, y, s, s * SQ, 0, 0xffffff, 0.35 * (1 - t / 0.25), 1); // ink-in flash
      // lightning crawling along one edge of the outer octagon, between two talismans
      if (t >= nextArc && k < 0.86) {
        nextArc = t + 0.08; const i = Math.floor(Math.random() * 8); const [ax, ay] = V(i, R * 0.87 * g), [bx, by] = V(i + 1, R * 0.87 * g); arc = [];
        for (let j = 0; j <= 6; j++) { const u = j / 6, jj = j % 6 ? rnd(-8, 8) : 0; arc.push(ax + (bx - ax) * u + jj * 0.5, ay + (by - ay) * u + jj); }
      }
      for (let j = 0; j + 3 < arc.length; j += 2) { p.beam(EMIT, beam, arc[j], arc[j + 1], arc[j + 2], arc[j + 3], 8, VIO, 0.4 * al, 1); p.beam(EMIT, beam, arc[j], arc[j + 1], arc[j + 2], arc[j + 3], 2.2, LILAC, 0.8 * al, 1); }
    });
    // eight talismans rise at the octagon corners, one after another, and hover on violet light
    for (let i = 0; i < 8; i++) {
      const d = i * 0.05, [gx, gy] = V(i, R * 0.87), tex = tals[i];
      c.fx.add(1, DUR - d, (p, k, t) => {
        const pop = Math.min(1, t / 0.2), al = (k > 0.86 ? (1 - k) / 0.14 : 1) * Math.min(1, t / 0.08), lift = 20 + easeOut(pop) * 22 + Math.sin(t * 3.2 + i) * 3, ty = gy - lift;
        p.beam(EMIT, beam, gx, gy, gx, ty + 8, 5, VIO, 0.3 * al, 1);
        p.draw(EMIT, soft, gx, gy, 0.7, 0.7 * SQ, 0, VIO, 0.35 * al, 1);
        p.draw(EMIT, soft, gx, ty, 0.62, 0.8, 0, VIO, 0.3 * al, 1);
        const sw = Math.sin(t * 2.4 + i * 1.3) * 0.12, sc = 1.25 + (1 - easeOut(pop)) * 0.6;
        p.draw(EMIT, tex, gx, ty, sc, sc, sw, 0xe8e0d0, 0.95 * al, 0);
      }, undefined, d);
      c.fx.later(d, () => c.fx.sparks(gx, gy - 24, 3, LILAC, 180, -Math.PI / 2, 1.2, 7));
    }
    // activation: lightning runs round the talismans and seals the array; a violet charge and sparks rise from the caster
    for (let i = 0; i < 8; i += c.fx.low ? 2 : 1) { const [ax, ay] = V(i, R * 0.87), [bx, by] = V(i + (c.fx.low ? 2 : 1), R * 0.87); zap(c, ax, ay - 38, bx, by - 38, 1.3, 0.3, 1, 0.16 + i * 0.03, 0); }
    c.fx.glow(x, y - 40, 34, VIO, 0.4, 0.2);
    c.fx.burst(x, y - 36, c.mine ? 12 : 6, [VIO, LILAC], 260, 6, 0.55, 'spark', -200, 0.006);
    c.fx.later(DUR - 0.4, () => { c.fx.ring(x, y, R * 0.8, R * 1.1, 0.45, VIO, true, 0, 0.6); c.fx.burst(x, y - 20, c.mine ? 14 : 6, [VIO, LILAC], 240, 6, 0.6); });
  },
  uhit: (c, e) => {
    // a bolt from the sky onto (x, y): hits radius 70 → the array's mark flashes at that size, violet ring, scorch, glowing cracks
    const x = e.x, y = e.y, sx = x + rnd(-70, 70), sy = y - 440; const arr = arrayTex();
    zap(c, sx, sy, x, y - 3, 3.4, 0.34, 3, 0, 0.1); zap(c, sx + rnd(-40, 40), sy, x + rnd(-8, 8), y - 3, 1.4, 0.24, 1, 0.03, 0);
    c.fx.add(0, 0.55, (p, k) => { const s = (70 * 2) / arr.w * (0.7 + 0.3 * easeOut(Math.min(1, k * 3))); p.draw(EMIT, arr, x, y, s, s * SQ, 0, VIO, 0.5 * (1 - k), 1); });
    c.fx.ring(x, y, 10, 80, 0.4, VIO, false, 0, 0.5);
    c.fx.glow(x, y - 10, 26, VIO, 0.26, 0.2);
    c.fx.decal(x, y, 'scorch', 90, 0x140a24, 2.4, 0.6); c.fx.decal(x, y, 'crack', 72, 0x3a2070, 2, 0.5); c.fx.decal(x, y, 'crack', 72, VIO, 0.7, 0.3, EMIT);
    c.fx.sparks(x, y - 6, 8, LILAC, 460, -Math.PI / 2, 2.6, 11);
    c.fx.debris(x, y - 4, 3, 'shard', [0x5a4c78, 0x3a3050], 240, 5, 0.6);
    c.fx.smoke(x, y - 6, 2, 0x2e2640, 40, 24, 0.9, 0.3);
    c.fx.light(x, y - 12, 230, VIO, 0.75, 0.35);
    if (c.mine) { c.fx.shake(0.07); c.fx.wave(x, y - 10, 100, 8, 0.35); }
    c.snd.play('thunder', c.mine ? 0.4 : 0.22, x, y);
  },
};
