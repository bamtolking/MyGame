// 창술사: fast jade-lime thrust lances along the attack line; ult 백룡창 = a storm of dragon thrusts, a jade dragon coiling around the spearman.
import { CLASSES } from '../../shared/data/classes.ts';
import { EMIT, type Painter } from '../render/paint.ts';
import type { Art } from '../render/art/index.ts';
import { type Tex, makeTex, ellipse } from '../render/art/core.ts';
import type { ClassFx, FxCtx } from './types.ts';

const LIME = 0xb8e04a, JADE = 0x5fe6a0, PALE = 0xe4ffd6;
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);

/** Dragon head silhouette facing +x (white, tinted at draw time), anchored at the snout; the mane fades out behind. */
let headTex: Tex | null = null;
function dragonHead(): Tex {
  return headTex ??= makeTex('fx:spearDragon', 80, 44, 0.97, 0.42, 2, c => {
    c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineCap = 'round';
    const tuft = (x0: number, y0: number, x1: number, y1: number, w: number) => {
      const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
      c.beginPath(); c.moveTo(x0 + nx, y0 + ny); c.quadraticCurveTo((x0 + x1) / 2 + nx * 1.4, (y0 + y1) / 2 + ny * 1.4 + 2, x1, y1); c.quadraticCurveTo((x0 + x1) / 2 - nx, (y0 + y1) / 2 - ny, x0 - nx, y0 - ny); c.fill();
    };
    // flowing mane
    c.globalAlpha = 0.7; tuft(36, 12, 6, 6, 4.2); tuft(33, 18, 3, 18, 4.6); tuft(33, 25, 6, 31, 4.2); tuft(38, 30, 14, 40, 3.6); c.globalAlpha = 1;
    // swept-back horns
    tuft(46, 9, 14, 1.5, 2.6); tuft(42, 12, 16, 7, 2.1);
    // skull with brow ridge, long snout and nose bump
    c.beginPath(); c.moveTo(31, 22); c.quadraticCurveTo(33, 8, 46, 6); c.quadraticCurveTo(54, 5, 58, 9.5); c.lineTo(71, 12); c.quadraticCurveTo(78, 11, 79.5, 16); c.quadraticCurveTo(79, 20.5, 74, 21.5);
    c.lineTo(58, 22.5); c.quadraticCurveTo(48, 24, 41, 27.5); c.quadraticCurveTo(33, 28.5, 31, 22); c.fill();
    // open lower jaw, beard, whiskers
    c.beginPath(); c.moveTo(39, 29.5); c.quadraticCurveTo(52, 26.5, 64, 27); c.quadraticCurveTo(71, 27.5, 72, 30); c.quadraticCurveTo(64, 33.5, 52, 33); c.quadraticCurveTo(43, 35, 35, 33.5); c.fill();
    tuft(51, 33, 40, 42, 2.3); tuft(58, 32, 51, 41, 1.8);
    c.lineWidth = 1.6; c.beginPath(); c.moveTo(76, 19); c.quadraticCurveTo(60, 31, 41, 38); c.quadraticCurveTo(28, 42, 16, 38); c.stroke();
    c.lineWidth = 1.3; c.beginPath(); c.moveTo(75, 12.5); c.quadraticCurveTo(64, 1, 44, 2.5); c.stroke();
    for (const x of [62, 68]) { c.beginPath(); c.moveTo(x, 22); c.lineTo(x + 1.4, 26.5); c.lineTo(x + 2.8, 22); c.fill(); }
    // eye, nostril and brow line cut out; mane end fades
    c.globalCompositeOperation = 'destination-out';
    c.beginPath(); c.moveTo(46.5, 13.5); c.quadraticCurveTo(52, 9.5, 56.5, 13.5); c.quadraticCurveTo(51, 16, 46.5, 13.5); c.fill();
    ellipse(c, 75.5, 14.5, 1.4, 1); c.fill();
    c.lineWidth = 1; c.beginPath(); c.moveTo(44, 10.5); c.quadraticCurveTo(52, 6.5, 59, 11); c.stroke();
    const g = c.createLinearGradient(0, 0, 36, 0); g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, -2, 36, 48);
  });
}
/** Dragon head at (x, y) heading along `ang` (kept upright when heading left). */
function drawHead(p: Painter, x: number, y: number, ang: number, s: number, a: number): void {
  const h = dragonHead(), fl = Math.cos(ang) < 0 ? -1 : 1;
  p.draw(EMIT, h, x, y, s, s * fl, ang, JADE, a * 0.8, 1); p.draw(EMIT, h, x, y, s * 0.94, s * 0.94 * fl, ang, PALE, a * 0.45, 1);
}
/** Serpent body through the points [x, y, ...] from tail to head: glowing band tapering toward the tail, pale core, scales. */
function drawBody(p: Painter, art: Art, pts: number[], w: number, a: number, dim?: (i: number) => number): void {
  const beam = art.fx('beam'), petal = art.fx('petal'); const n = pts.length / 2 - 1;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, x0 = pts[i * 2], y0 = pts[i * 2 + 1], x1 = pts[i * 2 + 2], y1 = pts[i * 2 + 3]; const al = a * (dim ? dim(i) : 1) * (0.35 + 0.65 * u), ww = w * (0.3 + 0.7 * u);
    p.beam(EMIT, beam, x0, y0, x1, y1, ww * 1.9, JADE, al * 0.6, 1); p.beam(EMIT, beam, x0, y0, x1, y1, ww * 0.45, PALE, al * 0.65, 1);
    if (i % 2 === 1) p.draw(EMIT, petal, (x0 + x1) / 2, (y0 + y1) / 2, ww / 11, ww / 16, Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2, PALE, al * 0.7, 1);
  }
}

/** Ult thrust: a straight jade lance from (x0, y0) to (x1, y1) with a dragon lunging along it, head at the tip. */
function dragonThrust(c: FxCtx, x0: number, y0: number, x1: number, y1: number): void {
  const A = c.art, streak = A.fx('streak'), soft = A.fx('soft');
  const L = Math.hypot(x1 - x0, y1 - y0) || 1, ang = Math.atan2(y1 - y0, x1 - x0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, nx = -uy, ny = ux;
  const side = Math.random() < 0.5 ? -1 : 1, BL = L * 0.85, SEG = c.fx.low ? 16 : 32, pts: number[] = [];
  c.fx.add(1, 0.38, (p, k, t) => {
    const h = easeOut(Math.min(1, k / 0.26)), fade = k < 0.34 ? 1 : 1 - (k - 0.34) / 0.66, len = L * h, hx = x0 + ux * len, hy = y0 + uy * len;
    p.draw(EMIT, streak, hx, hy, len / 64, 24 / 8, ang, LIME, 0.45 * fade, 1); p.draw(EMIT, streak, hx, hy, len / 64, 5 / 8, ang, 0xffffff, 0.9 * fade, 1);
    // the dragon: tail → head, winding around the lance
    pts.length = 0; const tail = Math.max(0, len - BL * Math.min(1, h * 1.6));
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG, d = tail + (len - tail) * u, env = Math.sin(Math.PI * Math.min(1, u * 1.08)) ** 0.8, off = Math.sin(d / 120 * Math.PI * 2 - t * 22) * 20 * env * side;
      pts.push(x0 + ux * d + nx * off, y0 + uy * d + ny * off);
    }
    drawBody(p, A, pts, 22, fade);
    p.draw(EMIT, soft, hx, hy, 1.5, 1.5, 0, JADE, 0.35 * fade, 1);
    drawHead(p, hx + ux * 8, hy + uy * 8, ang, 0.78, fade);
  });
}

const auraPts: number[] = []; let auraT = 0;
const auraTh = (i: number) => auraT * 4.2 - (16 - i) * 0.21, auraDim = (i: number) => (Math.sin(auraTh(i)) > 0 ? 1 : 0.45);
export const spear: ClassFx = {
  warm: () => { dragonHead(); },
  atkDur: 0.3, ultR: 190,
  atk: (c, _e, ang) => {
    const ux = Math.cos(ang), uy = Math.sin(ang), len = CLASSES.spear.range - 10;
    const x0 = c.x + ux * 10, y0 = c.y - 20 + uy * 10, x1 = x0 + ux * len, y1 = y0 + uy * len;
    const A = c.art, streak = A.fx('streak'), star = A.fx('star'), soft = A.fx('soft'), ring = A.fx('ring');
    const col = c.ult ? JADE : LIME, w = c.ult ? 30 : 24;
    c.fx.add(1, 0.24, (p, k) => {
      const h = easeOut(Math.min(1, k / 0.3)), fade = k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7, thin = 1 - (1 - fade) * 0.6, L = len * h, hx = x0 + ux * L, hy = y0 + uy * L;
      p.draw(EMIT, streak, hx, hy, L / 64, w * 1.4 * thin / 8, ang, col, 0.5 * fade, 1);
      p.draw(EMIT, streak, hx, hy, L / 64, w * 0.38 * thin / 8, ang, 0xffffff, 0.95 * fade, 1);
      for (const s of [-1, 1]) p.draw(EMIT, streak, hx - ux * 22 - uy * s * w * 0.6, hy - uy * 22 + ux * s * w * 0.6, L * 0.5 / 64, 2.4 / 8, ang, PALE, 0.5 * fade, 1);
      const ga = k < 0.3 ? k / 0.3 : Math.max(0, 1 - (k - 0.3) / 0.45);
      p.draw(EMIT, star, hx, hy, 0.25 + ga * 0.75, 0.12 + ga * 0.4, ang, 0xffffff, ga, 1);
      p.draw(EMIT, soft, hx, hy, 0.7, 0.7, 0, col, 0.4 * fade, 1);
      if (k > 0.12) { const rk = (k - 0.12) / 0.88, rx = x0 + ux * len * 0.5, ry = y0 + uy * len * 0.5; p.draw(EMIT, ring, rx, ry, 0.05 + rk * 0.05, 0.16 + rk * 0.2, ang, col, 0.6 * (1 - rk), 1); }
    });
    c.fx.later(0.07, () => { c.fx.sparks(x1, y1, 5, col, 420, ang, 0.9, 10); c.fx.light(x1, y1, 100, col, 0.5, 0.2); });
    c.snd.play('thrust', c.vol, c.x, c.y);
    if (c.mine) c.fx.zoomPunch(0.003);
  },
  ult: (c, e) => {
    const A = c.art, pts: number[] = [];
    c.fx.ring(e.x, e.y, 10, 150, 0.45, PALE, true, 0); c.fx.decal(e.x, e.y, 'crack', 150, 0x0c1f16, 1.6, 0.55); c.fx.glow(e.x, e.y - 40, 110, JADE, 0.6, 0.35);
    c.fx.burst(e.x, e.y - 30, c.mine ? 26 : 12, [JADE, LIME, 0xffffff], 420, 8, 0.6, 'spark', 0, 0.004);
    c.fx.light(e.x, e.y - 40, 260, JADE, 0.9, 1);
    // a jade dragon bursts from the ground and coils up around the spearman
    const pos = (v: number, i: number) => { const th = v * Math.PI * 4 + 0.4, r = 62 - v * 24; pts[i * 2] = e.x + Math.cos(th) * r; pts[i * 2 + 1] = e.y - 14 - v * 210 + Math.sin(th) * r * 0.42; };
    c.fx.add(1, 1.15, (p, k) => {
      const u = easeOut(Math.min(1, k / 0.75)) + Math.max(0, k - 0.75) * 0.5, fade = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3, M = 26, span = 0.55;
      pts.length = 0; for (let i = 0; i <= M; i++) pos(Math.max(0, u - span + span * i / M), i);
      drawBody(p, A, pts, 26, fade, i => Math.sin((u - span + span * i / M) * Math.PI * 4 + 0.4) > 0 ? 1 : 0.55);
      const n = pts.length; drawHead(p, pts[n - 2], pts[n - 1], Math.atan2(pts[n - 1] - pts[n - 3], pts[n - 2] - pts[n - 4]), 0.8, fade);
    });
  },
  uhit: (c, e) => {
    if (e.x2 == null || e.y2 == null) return;
    const ang = Math.atan2(e.y2 - e.y, e.x2 - e.x), ux = Math.cos(ang), uy = Math.sin(ang);
    const x0 = e.x + ux * 12, y0 = e.y - 22 + uy * 12, x1 = e.x2, y1 = e.y2 - 22;
    dragonThrust(c, x0, y0, x1, y1);
    c.fx.later(0.09, () => {
      c.fx.burst(x1, y1, 8, [JADE, LIME, 0xffffff], 300, 7, 0.35); c.fx.sparks(x1, y1, 6, LIME, 480, ang, 1.1, 11);
      c.fx.ring(x1, y1, 8, 54, 0.28, JADE, true); c.fx.glow(x1, y1, 46, JADE, 0.25, 0.35); c.fx.light(x1, y1, 170, JADE, 0.8, 0.25);
      if (c.mine) c.fx.shake(0.05);
    });
    c.snd.play('thrust', c.vol * 0.55, e.x, e.y);
  },
  aura: (p, art, t, x, y) => {
    p.draw(EMIT, art.fx('ringSoft'), x, y, 0.95, 0.95 * 0.62, 0, JADE, 0.3 + Math.sin(t * 7) * 0.08, 1);
    // a jade dragon circling the spearman (the half behind him is dimmer)
    // runs every frame per spearman in ult: reuse one scratch array and one dimming function
    const M = 16, pts = auraPts; pts.length = 0; auraT = t;
    for (let i = 0; i <= M; i++) { const a = auraTh(i); pts.push(x + Math.cos(a) * 44, y - 26 + Math.sin(a) * 18 + Math.sin(a * 2 + t * 3) * 5); }
    drawBody(p, art, pts, 16, 0.9, auraDim);
    drawHead(p, pts[M * 2], pts[M * 2 + 1], Math.atan2(pts[M * 2 + 1] - pts[M * 2 - 1], pts[M * 2] - pts[M * 2 - 2]), 0.55, Math.sin(auraTh(M)) > 0 ? 1 : 0.55);
  },
};
