// monk: skill visuals — punch speed lines and white impact rings, the golden palm print, the chi wave (a translucent
// golden crescent rolling forward), the mantra rune circle and aura, golden afterimages and wind for the flying kick,
// light trails / star bursts for the seven-sided strike and its gong-like finishing flash (render/registry hooks).
import type { Fx } from '../../render/fx';
import { RX, screenDir } from '../../render/iso';
import { BUFF_ART, EFFECT_ART, FX_EVENT, PROJ_ART, type FxHost } from '../../render/registry';
import { clamp01, ease, heroRef } from './look';
import { MANTRA, WAVE } from './shared';

type C2D = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const outCubic = (x: number): number => 1 - (1 - clamp01(x)) ** 3;
/** Rig units → css px at zoom 1 (the renderer draws heroes at ACTOR_SCALE). */
const ACTOR = 1.22;
const GOLD = '255,200,96', PALE = '255,240,200', WHITE = '255,252,240';

// ================================================================ shared drawing
/** A stylised open hand (fingers up), centred on the palm, `s` = half height. Fills the current path. */
export function palmGlyph(c: C2D, x: number, y: number, s: number): void {
  c.beginPath();
  c.moveTo(x - 0.42 * s, y - 0.05 * s);
  c.quadraticCurveTo(x - 0.52 * s, y + 0.62 * s, x - 0.05 * s, y + 0.82 * s);
  c.quadraticCurveTo(x + 0.46 * s, y + 0.8 * s, x + 0.46 * s, y + 0.2 * s);
  c.lineTo(x + 0.44 * s, y - 0.1 * s);
  c.closePath();
  c.fill();
  const fingers: [number, number][] = [[-0.3, 0.62], [-0.1, 0.78], [0.1, 0.74], [0.3, 0.58]];
  c.lineCap = 'round'; c.lineWidth = 0.19 * s;
  c.beginPath();
  for (const [fx, len] of fingers) { c.moveTo(x + fx * s, y + 0.05 * s); c.lineTo(x + fx * s * 1.12, y - len * s); }
  c.moveTo(x - 0.4 * s, y + 0.35 * s); c.lineTo(x - 0.72 * s, y + 0.02 * s);
  c.stroke();
}

function flatRing(c: C2D, sx: number, sy: number, r: number, col: string, lw: number): void {
  c.save(); c.translate(sx, sy); c.scale(1, 0.5);
  c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.arc(0, 0, Math.max(0.5, r), 0, TAU); c.stroke();
  c.restore();
}

function glow(c: C2D, x: number, y: number, r: number, col: string, a: number, sy = 1): void {
  if (a <= 0.01 || r <= 0.5) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${WHITE},${Math.min(1, a)})`); g.addColorStop(0.3, `rgba(${col},${a * 0.6})`); g.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r, r * sy, 0, 0, TAU); c.fill();
}

/** A pointed star (n points), filled. */
function star(c: C2D, x: number, y: number, r0: number, r1: number, n: number, rot: number): void {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * TAU, r = i % 2 ? r0 : r1; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  c.closePath(); c.fill();
}

/** Screen angle of a world direction. */
const sAng = (ang: number): number => { const d = screenDir(ang); return Math.atan2(d.dy, d.dx); };

// ================================================================ afterimage silhouettes
const GH = { w: 58, h: 72, ax: 26, ay: 64, res: 3 };
type GhostKind = 'kick' | 'punch';
const ghosts: Partial<Record<GhostKind, HTMLCanvasElement | null>> = {};

function limbs(g: C2D, pts: number[], w: number): void {
  g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
}

/** The monk's silhouette in a flying side kick or a lunging punch (rig units, feet at the origin, facing +x). */
export function figure(g: C2D, kind: GhostKind): void {
  if (kind === 'kick') {
    limbs(g, [0, -31, -3, -22, -10, -26], 4.6);                           // tucked leg
    g.beginPath(); g.moveTo(-6.5, -33); g.lineTo(5, -32); g.quadraticCurveTo(-5, -26, -18, -22); g.quadraticCurveTo(-11, -29, -6.5, -33); g.fill(); // robe flying back
    limbs(g, [-6, -44, -12.5, -40.5, -19.5, -37.5], 3.6);                 // back arm swept back
    g.beginPath(); g.moveTo(-6.8, -31); g.lineTo(5.6, -30); g.lineTo(3.6, -45.5); g.quadraticCurveTo(-3, -49, -10.4, -45); g.closePath(); g.fill(); // torso
    g.beginPath(); g.arc(-4.8, -51.8, 5.6, 0, TAU); g.fill();                  // head
    limbs(g, [0, -31, 9.5, -32.5, 20, -34], 4.6);                          // kicking leg
    g.beginPath(); g.ellipse(21.4, -34.6, 1.9, 3.1, 0, 0, TAU); g.fill();     // foot
    limbs(g, [0.5, -43.5, 4, -37, 7.5, -43.5], 3.6);                       // guarding arm
    limbs(g, [-4, -33, -11, -34, -18, -31], 1.8);                           // sash tails
  } else {
    limbs(g, [0, -19, -6, -9.5, -12.5, -0.5], 4.6);                         // back leg
    limbs(g, [0, -19, 6.5, -11, 9, 0], 4.6);                                // front leg
    g.beginPath(); g.ellipse(10.8, -0.6, 2.8, 1.5, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-6.5, -22); g.lineTo(6.5, -22); g.lineTo(10, -10); g.quadraticCurveTo(0, -8, -11, -10); g.closePath(); g.fill(); // robe
    g.beginPath(); g.moveTo(-6, -21); g.lineTo(6.5, -21); g.lineTo(10.5, -35); g.quadraticCurveTo(3.5, -38.5, -3.5, -34); g.closePath(); g.fill(); // torso
    g.beginPath(); g.arc(6.6, -41.2, 5.6, 0, TAU); g.fill();                   // head
    limbs(g, [2, -34, -3, -28, 3, -26], 3.6);                               // chambered fist
    limbs(g, [6, -34, 14, -34.5, 22.5, -34], 3.6);                          // punching arm
    g.beginPath(); g.arc(23.6, -34, 2.6, 0, TAU); g.fill();
    limbs(g, [-5, -23, -12, -18, -15, -12], 1.8);                           // sash tail
  }
}

function ghostSprite(kind: GhostKind): HTMLCanvasElement | null {
  const have = ghosts[kind];
  if (have !== undefined) return have;
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = GH.w * GH.res; cv.height = GH.h * GH.res;
  const g = cv.getContext('2d');
  if (!g) { ghosts[kind] = null; return null; }
  g.scale(GH.res, GH.res); g.translate(GH.ax, GH.ay);
  g.fillStyle = g.strokeStyle = '#ffffff';
  g.shadowColor = 'rgba(255,190,80,1)'; g.shadowBlur = 5 * GH.res;
  figure(g, kind);
  g.shadowBlur = 0;
  figure(g, kind);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  const gr = g.createLinearGradient(0, 0, 0, cv.height);
  gr.addColorStop(0, 'rgba(255,252,232,1)'); gr.addColorStop(0.55, 'rgba(255,208,112,1)'); gr.addColorStop(1, 'rgba(255,140,40,0.85)');
  g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height);
  ghosts[kind] = cv;
  return cv;
}

EFFECT_ART.mk_ghost = {
  air(e, d) {
    const cv = ghostSprite(e.data as GhostKind);
    if (!cv) return;
    const { c, z, sx, sy, k } = d;
    const s = (z * ACTOR) / GH.res;
    const flip = screenDir(e.ang).dx < 0;
    c.globalCompositeOperation = 'lighter';
    const fadeIn = e.heavy ? Math.min(1, k / 0.25) : 1;
    c.globalAlpha = Math.max(0, fadeIn * (1 - k) ** 1.4 * e.power);
    c.translate(sx, sy); c.scale(flip ? -s : s, s);
    c.drawImage(cv, -GH.ax * GH.res, -GH.ay * GH.res);
  },
};

// ================================================================ punches
/** Speed lines from the monk's fist toward the target. */
EFFECT_ART.mk_lines = {
  air(e, d) {
    const { c, cam, z, k } = d;
    const x0 = cam.sxOf(e.x, e.y), y0 = cam.syOf(e.x, e.y) - 40 * z;
    const x1 = cam.sxOf(e.x2 ?? e.x, e.y2 ?? e.y), y1 = cam.syOf(e.x2 ?? e.x, e.y2 ?? e.y) - 30 * z;
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const head = 0.3 + 0.8 * outCubic(k / 0.45), tail = head - (e.heavy ? 0.6 : 0.45);
    const a = 1 - ease(k);
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    const n = e.heavy ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * (e.heavy ? 3.4 : 3) * z, sk = 1 - Math.abs(i - (n - 1) / 2) * 0.18;
      const t0 = Math.max(0, tail + (i % 2) * 0.08), t1 = Math.min(1.05, head * sk);
      if (t1 <= t0) continue;
      c.strokeStyle = `rgba(${PALE},${0.7 * a * sk})`; c.lineWidth = (e.heavy ? 1.6 : 1.1) * z;
      c.beginPath(); c.moveTo(x0 + dx * t0 + nx * o, y0 + dy * t0 + ny * o); c.lineTo(x0 + dx * t1 + nx * o * 0.6, y0 + dy * t1 + ny * o * 0.6); c.stroke();
    }
  },
};

/** White impact ring around the punch axis (a shock ring seen at an angle), with a gold echo. */
EFFECT_ART.mk_ring = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const cy = sy - (e.heavy ? 32 : 30) * z;
    c.globalCompositeOperation = 'lighter';
    c.translate(sx, cy); c.rotate(sAng(e.ang));
    const p = e.power;
    for (let i = 0; i < 2; i++) {
      const kk = clamp01(k * 1.25 - i * 0.2);
      if (kk <= 0 || kk >= 1) continue;
      const R = (5 + 17 * outCubic(kk)) * z * p;
      c.strokeStyle = i ? `rgba(${GOLD},${0.7 * (1 - kk)})` : `rgba(${WHITE},${0.95 * (1 - kk)})`;
      c.lineWidth = ((i ? 1.6 : 2.6) * (1 - kk) + 0.5) * z * Math.sqrt(p);
      c.beginPath(); c.ellipse(-i * 4 * z * kk, 0, R * 0.34, R, 0, 0, TAU); c.stroke();
    }
    if (k < 0.3) glow(c, 0, 0, 10 * z * p, GOLD, (1 - k / 0.3) * 0.8);
  },
};

/** A golden palm print flashing at the point of impact. */
EFFECT_ART.mk_palmPrint = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const s = (11 + 7 * outCubic(k)) * z * e.r;
    const a = k < 0.15 ? k / 0.15 : 1 - ease((k - 0.15) / 0.85);
    const cy = sy - 34 * z - k * 8 * z;
    c.globalCompositeOperation = 'lighter';
    glow(c, sx, cy, s * 1.5, GOLD, a * 0.45);
    c.globalAlpha = a * 0.8;
    c.fillStyle = `rgba(${GOLD},0.9)`; c.strokeStyle = `rgba(${GOLD},0.9)`;
    palmGlyph(c, sx, cy, s);
    c.globalAlpha = a;
    c.fillStyle = `rgba(${WHITE},0.55)`; c.strokeStyle = `rgba(${WHITE},0.55)`;
    palmGlyph(c, sx, cy, s * 0.7);
  },
};

/** A gold-white star burst (seven-sided strike hits, kick hits, flash-steps). */
EFFECT_ART.mk_star = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const cy = sy - 28 * z;
    const p = e.power, a = 1 - ease(k);
    c.globalCompositeOperation = 'lighter';
    glow(c, sx, cy, (14 + 12 * k) * z * p, GOLD, a * (p < 1 ? 0.55 : 0.8));
    const r1 = (10 + 22 * outCubic(k)) * z * p;
    c.fillStyle = `rgba(${PALE},${0.85 * a})`; star(c, sx, cy, r1 * 0.12, r1, 4, e.seed * 0.01 + k * 0.6);
    c.fillStyle = `rgba(${GOLD},${0.6 * a})`; star(c, sx, cy, r1 * 0.08, r1 * 0.6, 4, e.seed * 0.01 + Math.PI / 4 - k * 0.4);
  },
};

// ================================================================ chi wave
/** Screen points of the wave's foot and crest (reused every frame). */
const WAVE_FOOT = new Float32Array(34), WAVE_CREST = new Float32Array(34);

PROJ_ART.mk_wave = {
  light: [2.6, '255,196,96'],
  trail: ['255,205,120', 2.5],
  draw(p, d) {
    const { c, cam, z, fx, time } = d;
    const sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp, uy = p.vy / sp, nx = -uy, ny = ux;
    const grow = outCubic(Math.min(1, p.age / 0.16));
    const fade = Math.min(1, p.life / 0.14);
    // half-width (tiles): the hit width plus a little, unfolding as it leaves the palms
    const W = (WAVE.r + 0.45) * (0.45 + 0.55 * grow), bulge = 0.5 * W;
    const N = 16;
    // a point of the crescent: sv across (-1..1), `back` tiles behind the front
    const P = (sv: number, back: number): [number, number] => {
      const b = bulge * (1 - sv * sv) - back;
      const wx = p.x + nx * sv * W * (1 - back * 0.25) + ux * b, wy = p.y + ny * sv * W * (1 - back * 0.25) + uy * b;
      return [cam.sxOf(wx, wy), cam.syOf(wx, wy)];
    };
    // crest height: tallest in the middle, tapering to nothing at the horns
    const Hm = 34 * z * (0.55 + 0.45 * grow);
    const top = (sv: number): number => Hm * Math.pow(Math.max(0, 1 - sv * sv), 0.65);
    const foot = WAVE_FOOT, crest = WAVE_CREST;
    for (let i = 0; i <= N; i++) {
      const sv = -1 + (2 * i) / N, [X, Y] = P(sv, 0);
      foot[i * 2] = X; foot[i * 2 + 1] = Y - 1.5 * z;
      crest[i * 2] = X; crest[i * 2 + 1] = Y - top(sv);
    }
    const gx = cam.sxOf(p.x, p.y), gy = cam.syOf(p.x, p.y);
    c.save();
    c.globalCompositeOperation = 'lighter';
    // light pooled on the floor inside the crescent
    glow(c, gx, gy, W * RX * z * 1.05, GOLD, 0.24 * fade, 0.5);
    // the ground band of the crescent (between the front arc and a thinner inner arc)
    c.fillStyle = `rgba(${GOLD},${0.22 * fade})`;
    c.beginPath();
    for (let i = 0; i <= N; i++) { const [X, Y] = P(-1 + (2 * i) / N, 0); if (i) c.lineTo(X, Y); else c.moveTo(X, Y); }
    for (let i = N; i >= 0; i--) { const sv = -1 + (2 * i) / N; const [X, Y] = P(sv, 0.32 * (1 - sv * sv)); c.lineTo(X, Y); }
    c.closePath(); c.fill();
    // the standing curtain of chi: bright at its foot, fading upward
    const g = c.createLinearGradient(0, gy - Hm, 0, gy);
    g.addColorStop(0, `rgba(${GOLD},0)`); g.addColorStop(0.45, `rgba(${GOLD},${0.15 * fade})`); g.addColorStop(1, `rgba(${PALE},${0.36 * fade})`);
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i <= N; i++) { if (i) c.lineTo(foot[i * 2], foot[i * 2 + 1]); else c.moveTo(foot[0], foot[1]); }
    for (let i = N; i >= 0; i--) c.lineTo(crest[i * 2], crest[i * 2 + 1]);
    c.closePath(); c.fill();
    // flowing streaks inside the curtain, sweeping back from the crest
    c.lineCap = 'round';
    c.strokeStyle = `rgba(${PALE},${0.42 * fade})`; c.lineWidth = 0.9 * z;
    c.beginPath();
    for (let j = 0; j < 6; j++) {
      const sv = -0.78 + j * 0.31 + Math.sin(time * 3 + j * 1.7 + p.id) * 0.05;
      const ph = (time * 2.4 + j * 0.37 + p.id * 0.13) % 1;
      const [X0, Y0] = P(sv, 0.05), [X1, Y1] = P(sv * 0.96, 0.3);
      const h0 = top(sv) * (0.12 + 0.62 * ph), h1 = Math.min(top(sv) * 0.95, h0 + top(sv) * 0.28);
      c.moveTo(X0, Y0 - h0); c.quadraticCurveTo((X0 + X1) / 2, (Y0 + Y1) / 2 - h1, X1, Y1 - h1 * 0.9);
    }
    c.stroke();
    // the foot (a hard white line on the floor) and the crest (a pale gold rim)
    c.strokeStyle = `rgba(${WHITE},${0.8 * fade})`; c.lineWidth = 1.8 * z;
    c.beginPath(); for (let i = 1; i < N; i++) { if (i > 1) c.lineTo(foot[i * 2], foot[i * 2 + 1]); else c.moveTo(foot[2], foot[3]); } c.stroke();
    c.strokeStyle = `rgba(${GOLD},${0.75 * fade})`; c.lineWidth = 1.4 * z;
    c.beginPath(); for (let i = 0; i <= N; i++) { if (i) c.lineTo(crest[i * 2], crest[i * 2 + 1]); else c.moveTo(crest[0], crest[1]); } c.stroke();
    c.strokeStyle = `rgba(${WHITE},${0.55 * fade})`; c.lineWidth = 0.7 * z;
    c.beginPath(); for (let i = 3; i <= N - 3; i++) { if (i > 3) c.lineTo(crest[i * 2], crest[i * 2 + 1] + 0.8 * z); else c.moveTo(crest[i * 2], crest[i * 2 + 1] + 0.8 * z); } c.stroke();
    // an echo of the crest trailing behind
    c.strokeStyle = `rgba(${GOLD},${0.3 * fade})`; c.lineWidth = 1 * z;
    c.beginPath();
    for (let i = 2; i <= N - 2; i++) { const sv = -1 + (2 * i) / N; const [X, Y] = P(sv, 0.55); if (i > 2) c.lineTo(X, Y - top(sv) * 0.7); else c.moveTo(X, Y - top(sv) * 0.7); }
    c.stroke();
    // the great palm at the heart of the wave, always turned to the viewer: a semi-opaque gold hand (so it reads
    // against the bright curtain) with a white-hot centre
    const [px, py] = P(0, 0.15);
    const cy = py - Hm * 0.7, ps = 12.5 * z * (0.7 + 0.3 * grow);
    glow(c, px, cy, ps * 1.9, GOLD, 0.3 * fade);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 0.62 * fade;
    c.fillStyle = '#f0a838'; c.strokeStyle = '#f0a838';
    palmGlyph(c, px, cy, ps);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.75 * fade;
    c.fillStyle = `rgba(${WHITE},0.8)`; c.strokeStyle = `rgba(${WHITE},0.8)`;
    palmGlyph(c, px, cy + ps * 0.05, ps * 0.6);
    c.restore();
    // chi motes shed behind the wave
    if (Math.random() < (fx.low ? 0.3 : 0.85)) {
      const s = Math.random() * 2 - 1;
      fx.add({ x: p.x + nx * s * W - ux * 0.2, y: p.y + ny * s * W - uy * 0.2, z: 6 + Math.random() * 22, vz: 18, vx: -ux * 1.4, vy: -uy * 1.4, color: Math.random() < 0.5 ? '#ffe0a0' : '#ffb850', kind: 'glint', size: 0.9, life: 0.4, add: true });
    }
  },
};

/** A flare at the monk's palms as the wave leaves them. */
EFFECT_ART.mk_waveFlash = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const cy = sy - 34 * z, a = 1 - ease(k);
    c.globalCompositeOperation = 'lighter';
    glow(c, sx, cy, (16 + 18 * k) * z, GOLD, a * 0.9);
    // a crescent of pushed air bursting from the palms toward the aim
    c.translate(sx, cy); c.rotate(sAng(e.ang));
    const R = (10 + 22 * outCubic(k)) * z, th = (4 + 3 * (1 - k)) * z;
    c.fillStyle = `rgba(${PALE},${0.75 * a})`;
    c.beginPath(); c.ellipse(0, 0, R * 0.55, R, 0, -Math.PI / 2, Math.PI / 2); c.ellipse(-th, 0, R * 0.55 - th * 0.6, R * 0.94, 0, Math.PI / 2, -Math.PI / 2, true); c.closePath(); c.fill();
    c.rotate(-sAng(e.ang));
    c.globalAlpha = 0.6 * a; c.fillStyle = `rgba(${GOLD},1)`; c.strokeStyle = `rgba(${GOLD},1)`;
    palmGlyph(c, 0, 0, (9 + 6 * k) * z);
  },
};

// ================================================================ mantra
function lotus(c: C2D, R: number, n: number, rot: number): void {
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU, a0 = a - Math.PI / n, a1 = a + Math.PI / n;
    c.moveTo(Math.cos(a0) * R * 0.35, Math.sin(a0) * R * 0.35);
    c.quadraticCurveTo(Math.cos(a - 0.1) * R * 1.05, Math.sin(a - 0.1) * R * 1.05, Math.cos(a) * R, Math.sin(a) * R);
    c.quadraticCurveTo(Math.cos(a + 0.1) * R * 1.05, Math.sin(a + 0.1) * R * 1.05, Math.cos(a1) * R * 0.35, Math.sin(a1) * R * 0.35);
  }
  c.stroke();
}

/** The mantra circle laid on the floor: double ring, glyph ticks and a lotus, turning slowly. Call with the
 *  transform centred and scaled (1, 0.5). */
function mantraCircle(c: C2D, R: number, time: number, a: number, z: number): void {
  c.strokeStyle = `rgba(${GOLD},${0.75 * a})`; c.lineWidth = 1.6 * z;
  c.beginPath(); c.arc(0, 0, R, 0, TAU); c.stroke();
  c.lineWidth = 0.9 * z; c.beginPath(); c.arc(0, 0, R * 0.84, 0, TAU); c.stroke();
  // glyph ticks between the rings
  c.strokeStyle = `rgba(${PALE},${0.8 * a})`; c.lineWidth = 1.1 * z;
  c.beginPath();
  for (let i = 0; i < 16; i++) {
    const an = time * 0.35 + (i / 16) * TAU, ca = Math.cos(an), sa = Math.sin(an);
    const r0 = R * 0.87, r1 = R * 0.97;
    if (i % 4 === 0) { c.moveTo(ca * r0, sa * r0); c.lineTo(ca * r1, sa * r1); c.moveTo(ca * (r0 + r1) / 2 - sa * R * 0.04, sa * (r0 + r1) / 2 + ca * R * 0.04); c.lineTo(ca * (r0 + r1) / 2 + sa * R * 0.04, sa * (r0 + r1) / 2 - ca * R * 0.04); }
    else if (i % 2) { c.moveTo(ca * r0 - sa * R * 0.03, sa * r0 + ca * R * 0.03); c.lineTo(ca * r1, sa * r1); c.lineTo(ca * r0 + sa * R * 0.03, sa * r0 - ca * R * 0.03); }
    else { c.moveTo(ca * (r0 + 0.02 * R) + 0.6, sa * (r0 + 0.02 * R)); c.arc(ca * (r0 + r1) / 2, sa * (r0 + r1) / 2, R * 0.025, 0, TAU); }
  }
  c.stroke();
  c.strokeStyle = `rgba(${GOLD},${0.6 * a})`; c.lineWidth = 1 * z;
  lotus(c, R * 0.62, 8, -time * 0.5);
  c.strokeStyle = `rgba(${PALE},${0.55 * a})`;
  c.beginPath(); c.arc(0, 0, R * 0.2, 0, TAU); c.stroke();
}

/** Persistent floor circle under the monk while the mantra lasts (re-created by the buff art if it goes missing). */
EFFECT_ART.mk_mantraGround = {
  ground(_e, d) {
    const h = heroRef;
    const b = h?.buffs.find((q) => q.id === 'mk_mantra');
    if (!h || !b || h.dead) return;
    const { c, cam, z } = d;
    const a = Math.min(1, (b.dur - b.t) / 0.5, b.t / 0.8);
    const sx = cam.sxOf(h.x, h.y), sy = cam.syOf(h.x, h.y);
    const t = heroTime;
    const R = 1.15 * RX * z * (0.92 + 0.08 * Math.sin(t * 3));
    c.globalCompositeOperation = 'lighter';
    glow(c, sx, sy, R * 1.1, GOLD, 0.28 * a, 0.5);
    c.translate(sx, sy); c.scale(1, 0.5);
    mantraCircle(c, R, t, a * (0.8 + 0.2 * Math.sin(t * 4)), z);
  },
};
let heroTime = 0;

BUFF_ART.mk_mantra = (c, sx, sy, z, time, b, fx, h) => {
  heroTime = time;
  if (!fx.effects.some((e) => e.kind === 'mk_mantraGround')) fx.effect('mk_mantraGround', h.x, h.y, MANTRA.dur + 1);
  const a = Math.min(1, (b.dur - b.t) / 0.4, b.t / 0.8);
  if (a <= 0 || h.dead) return;
  const pulse = 0.75 + 0.25 * Math.sin(time * 4);
  c.save(); c.globalCompositeOperation = 'lighter';
  const cy = sy - 30 * z;
  const g = c.createRadialGradient(sx, cy, 0, sx, cy, 40 * z);
  g.addColorStop(0, `rgba(255,214,120,${0.3 * a * pulse})`); g.addColorStop(0.6, `rgba(255,170,60,${0.12 * a})`); g.addColorStop(1, 'rgba(255,150,40,0)');
  c.fillStyle = g; c.beginPath(); c.ellipse(sx, cy, 24 * z, 42 * z, 0, 0, TAU); c.fill();
  c.restore();
  // rising golden motes
  if (Math.random() < (fx.low ? 0.12 : 0.4) * a) {
    const an = Math.random() * TAU, r = 0.25 + Math.random() * 0.4;
    fx.add({ x: h.x + Math.cos(an) * r, y: h.y + Math.sin(an) * r, z: 4 + Math.random() * 16, vz: 26 + Math.random() * 18, color: Math.random() < 0.3 ? '#fff4c8' : '#ffc860', kind: Math.random() < 0.3 ? 'star' : 'dot', size: 0.9, life: 1, add: true });
  }
};

/** Casting the mantra: the circle blooms outward and a column of light rises. */
EFFECT_ART.mk_bloom = {
  ground(e, d) {
    const { c, z, sx, sy, k, rx } = d;
    const a = 1 - ease(k);
    c.globalCompositeOperation = 'lighter';
    glow(c, sx, sy, rx * (0.4 + 0.8 * outCubic(k)), GOLD, 0.5 * a, 0.5);
    c.translate(sx, sy); c.scale(1, 0.5);
    mantraCircle(c, rx * (0.35 + 0.65 * outCubic(k * 1.4)), e.seed + k * 2, a, z);
  },
  air(_e, d) {
    const { c, z, sx, sy, k } = d;
    const a = k < 0.15 ? k / 0.15 : 1 - ease((k - 0.15) / 0.85);
    c.globalCompositeOperation = 'lighter';
    const w = (18 - 10 * k) * z, H = 150 * z;
    const g = c.createLinearGradient(sx, sy - H, sx, sy);
    g.addColorStop(0, 'rgba(255,220,130,0)'); g.addColorStop(0.7, `rgba(255,220,130,${0.24 * a})`); g.addColorStop(1, `rgba(255,248,220,${0.42 * a})`);
    c.fillStyle = g; c.fillRect(sx - w / 2, sy - H, w, H);
    for (let i = 0; i < 3; i++) {
      const kk = (k * 1.6 + i / 3) % 1;
      c.strokeStyle = `rgba(${GOLD},${(1 - kk) * a * 0.8})`; c.lineWidth = 1.6 * z;
      c.beginPath(); c.ellipse(sx, sy - kk * 90 * z, 20 * z * (1 - kk * 0.4), 7 * z * (1 - kk * 0.4), 0, 0, TAU); c.stroke();
    }
  },
};

// ================================================================ flying kick
/** Wind streaks peeling off the flying monk. */
EFFECT_ART.mk_wind = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const a = 1 - k;
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    c.translate(sx, sy - 30 * z); c.rotate(sAng(e.ang));
    for (let i = 0; i < 3; i++) {
      const o = (i - 1) * 9 * z + Math.sin(e.seed + i) * 3 * z, L = (22 + i * 6) * z;
      const back = -8 * z - k * 26 * z;
      c.strokeStyle = `rgba(${WHITE},${0.55 * a * (1 - Math.abs(i - 1) * 0.3)})`; c.lineWidth = 1.2 * z;
      c.beginPath(); c.moveTo(back, o); c.quadraticCurveTo(back - L * 0.5, o + (i - 1) * 3 * z, back - L, o + (i - 1) * 6 * z); c.stroke();
    }
  },
};

// ================================================================ seven-sided strike
/** A streak of golden light between two flash-step spots. */
EFFECT_ART.mk_streak = {
  air(e, d) {
    const { c, cam, z, k } = d;
    const x0 = cam.sxOf(e.x, e.y), y0 = cam.syOf(e.x, e.y) - 30 * z;
    const x1 = cam.sxOf(e.x2 ?? e.x, e.y2 ?? e.y), y1 = cam.syOf(e.x2 ?? e.x, e.y2 ?? e.y) - 30 * z;
    const a = 1 - ease(k);
    const head = outCubic(k / 0.25);
    const hx = x0 + (x1 - x0) * head, hy = y0 + (y1 - y0) * head;
    const tx = x0 + (x1 - x0) * clamp01(k * 1.6), ty = y0 + (y1 - y0) * clamp01(k * 1.6);
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    const g = c.createLinearGradient(tx, ty, hx, hy);
    g.addColorStop(0, `rgba(${GOLD},0)`); g.addColorStop(1, `rgba(${GOLD},${0.75 * a})`);
    c.strokeStyle = g; c.lineWidth = 7 * z * (1 - k * 0.6);
    c.beginPath(); c.moveTo(tx, ty); c.lineTo(hx, hy); c.stroke();
    const g2 = c.createLinearGradient(tx, ty, hx, hy);
    g2.addColorStop(0, `rgba(${WHITE},0)`); g2.addColorStop(1, `rgba(${WHITE},${0.95 * a})`);
    c.strokeStyle = g2; c.lineWidth = 2.2 * z;
    c.beginPath(); c.moveTo(tx, ty); c.lineTo(hx, hy); c.stroke();
  },
};

/** Heptagram (a seven-pointed star {7/3}) path. */
function heptagram(c: C2D, R: number, rot: number): void {
  c.beginPath();
  for (let j = 0; j <= 7; j++) { const i = (j * 3) % 7, a = rot - Math.PI / 2 + (i / 7) * TAU; if (j) c.lineTo(Math.cos(a) * R, Math.sin(a) * R); else c.moveTo(Math.cos(a) * R, Math.sin(a) * R); }
  c.closePath();
}

/** The gong: a seven-pointed seal on the floor, rings rolling out, a burst of light and rays. */
EFFECT_ART.mk_gong = {
  ground(e, d) {
    const { c, z, sx, sy, k, rx } = d;
    c.globalCompositeOperation = 'lighter';
    glow(c, sx, sy, rx * (0.6 + 0.6 * outCubic(k)), GOLD, 0.55 * (1 - k), 0.5);
    for (let i = 0; i < 3; i++) {
      const kk = clamp01(k * 1.5 - i * 0.14);
      if (kk <= 0 || kk >= 1) continue;
      flatRing(c, sx, sy, rx * (0.2 + 1.15 * outCubic(kk)), `rgba(${i ? GOLD : PALE},${(1 - kk) * 0.9})`, (4.5 - i * 1.3) * z * (1 - kk * 0.5));
    }
    const sa = Math.sin(Math.min(1, k * 1.3) * Math.PI);
    if (sa > 0.01) {
      c.save(); c.translate(sx, sy); c.scale(1, 0.5);
      const R = rx * (0.55 + 0.25 * outCubic(k));
      c.strokeStyle = `rgba(${GOLD},${0.85 * sa})`; c.lineWidth = 1.6 * z; c.lineJoin = 'round';
      heptagram(c, R, e.seed * 0.01 + k * 0.5); c.stroke();
      c.lineWidth = 1 * z; c.beginPath(); c.arc(0, 0, R * 1.08, 0, TAU); c.stroke();
      c.fillStyle = `rgba(${WHITE},${sa})`;
      for (let i = 0; i < 7; i++) { const a = e.seed * 0.01 + k * 0.5 - Math.PI / 2 + (i / 7) * TAU; star(c, Math.cos(a) * R, Math.sin(a) * R, 1 * z, 4.5 * z, 4, 0); }
      c.restore();
    }
  },
  air(_e, d) {
    const { c, z, sx, sy, k } = d;
    const cy = sy - 30 * z;
    const a = k < 0.08 ? k / 0.08 : 1 - ease((k - 0.08) / 0.92);
    c.globalCompositeOperation = 'lighter';
    glow(c, sx, cy, (22 + 40 * outCubic(k)) * z, GOLD, a * 0.6);
    // rays
    c.strokeStyle = `rgba(${PALE},${0.6 * a})`; c.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const an = (i / 14) * TAU + 0.2, r0 = (14 + 30 * outCubic(k)) * z, r1 = r0 + (18 + (i % 2) * 16) * z * (1 - k * 0.5);
      c.lineWidth = (i % 2 ? 1.2 : 2) * z;
      c.beginPath(); c.moveTo(sx + Math.cos(an) * r0, cy + Math.sin(an) * r0 * 0.7); c.lineTo(sx + Math.cos(an) * r1, cy + Math.sin(an) * r1 * 0.7); c.stroke();
    }
    // a thin flash column
    const w = 10 * z * (1 - k), H = 130 * z;
    const g = c.createLinearGradient(sx, sy - H, sx, sy);
    g.addColorStop(0, 'rgba(255,230,160,0)'); g.addColorStop(1, `rgba(255,246,220,${0.8 * a})`);
    c.fillStyle = g; c.fillRect(sx - w / 2, sy - H, w, H);
  },
};

// ================================================================ fx events
const ang2 = (e: { x: number; y: number; x2?: number; y2?: number }): number => Math.atan2((e.y2 ?? e.y) - e.y, (e.x2 ?? e.x) - e.x);

function sparks(fx: Fx, x: number, y: number, n: number, dir: { x: number; y: number } | undefined, o: { color?: string; speed?: number; z?: number; life?: number; kind?: 'streak' | 'glint' | 'star' | 'dot' } = {}): void {
  fx.burst(x, y, n, { dir, spread: dir ? 1.1 : undefined, color: o.color ?? '#fff0c8', kind: o.kind ?? 'streak', size: 1.2, speed: o.speed ?? 5, up: 50, grav: 90, life: o.life ?? 0.3, add: true, z: o.z ?? 26, drag: 2 });
}

function punchFx(e: Parameters<typeof FX_EVENT[string]>[0], h: FxHost, palm: boolean, heavy: boolean): void {
  const fx = h.fx, a = ang2(e);
  fx.effect('mk_lines', e.x, e.y, heavy ? 0.26 : 0.18, { x2: e.x2, y2: e.y2, ang: a, heavy });
  if (!(e.r && e.r > 0)) return;
  const ix = (e.x2 ?? e.x) - Math.cos(a) * 0.3, iy = (e.y2 ?? e.y) - Math.sin(a) * 0.3;
  fx.effect('mk_ring', ix, iy, heavy ? 0.36 : 0.22, { ang: a, power: heavy ? 1.55 : 1, heavy });
  if (palm || heavy) fx.effect('mk_palmPrint', ix, iy, heavy ? 0.5 : 0.3, { r: heavy ? 1.25 : 0.75 });
  sparks(fx, ix, iy, h.low ? 3 : heavy ? 10 : 5, { x: Math.cos(a), y: Math.sin(a) }, { speed: heavy ? 7 : 5 });
  if (heavy) {
    fx.effect('shock', e.x2 ?? e.x, e.y2 ?? e.y, 0.4, { r: 1.3, c: '255,220,150' });
    fx.effect('dust', e.x2 ?? e.x, e.y2 ?? e.y, 0.5, { r: 0.9 });
  }
}

FX_EVENT.mk_palm = (e, h) => punchFx(e, h, true, false);
FX_EVENT.mk_combo = (e, h) => punchFx(e, h, e.n === 2, e.n === 2);

FX_EVENT.mk_waveCast = (e, h) => {
  const fx = h.fx, a = ang2(e);
  const x = e.x + Math.cos(a) * 0.55, y = e.y + Math.sin(a) * 0.55;
  fx.effect('mk_waveFlash', x, y, 0.35, { ang: a });
  fx.effect('shock', e.x, e.y, 0.35, { r: 1.2, c: '255,200,110' });
  sparks(fx, x, y, h.low ? 6 : 14, { x: Math.cos(a), y: Math.sin(a) }, { color: '#ffd890', speed: 7, z: 34, kind: 'glint', life: 0.4 });
};

FX_EVENT.mk_waveHit = (e, h) => {
  const fx = h.fx, a = Math.atan2(e.y - (e.y2 ?? e.y), e.x - (e.x2 ?? e.x));
  fx.effect('mk_ring', e.x, e.y, 0.24, { ang: a, power: 0.9 });
  sparks(fx, e.x, e.y, h.low ? 3 : 7, { x: Math.cos(a), y: Math.sin(a) }, { color: '#ffd890', speed: 5, kind: 'glint' });
};

FX_EVENT.mk_mantra = (e, h) => {
  const fx = h.fx, r = e.r ?? 2.2;
  fx.effect('mk_bloom', e.x, e.y, 0.9, { r: r * 0.6 });
  fx.effect('shock', e.x, e.y, 0.6, { r, c: '255,210,120' });
  fx.burst(e.x, e.y, h.low ? 10 : 26, { color: '#ffd878', kind: 'star', size: 1.2, speed: 1.4, up: 110, grav: 15, life: 1.1, add: true, z: 8 });
};

/** The flying kick's comet trail: a golden wedge from the launch point to the flying monk (then to the landing). */
EFFECT_ART.mk_kickStreak = {
  air(e, d) {
    const { c, cam, z, k } = d;
    const h = heroRef;
    const flying = !!h && h.act?.skill === 'mk_kick' && k < 0.7;
    const ex = flying ? h!.x : e.x2 ?? e.x, ey = flying ? h!.y : e.y2 ?? e.y;
    const x1 = cam.sxOf(ex, ey), y1 = cam.syOf(ex, ey) - 24 * z;
    const tail = clamp01((k - 0.35) / 0.65);
    const tx = e.x + (ex - e.x) * tail, ty = e.y + (ey - e.y) * tail;
    const x0 = cam.sxOf(tx, ty), y0 = cam.syOf(tx, ty) - 18 * z;
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
    if (l < 4) return;
    const nx = -dy / l, ny = dx / l, a = 1 - ease(clamp01((k - 0.3) / 0.7)), w = 9 * z;
    c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `rgba(${GOLD},0)`); g.addColorStop(0.7, `rgba(${GOLD},${0.35 * a})`); g.addColorStop(1, `rgba(${PALE},${0.6 * a})`);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1 + nx * w, y1 + ny * w); c.quadraticCurveTo(x1 + dx / l * w * 1.4, y1 + dy / l * w * 1.4, x1 - nx * w, y1 - ny * w); c.closePath(); c.fill();
    const g2 = c.createLinearGradient(x0, y0, x1, y1);
    g2.addColorStop(0, `rgba(${WHITE},0)`); g2.addColorStop(1, `rgba(${WHITE},${0.8 * a})`);
    c.strokeStyle = g2; c.lineWidth = 1.6 * z; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  },
};

FX_EVENT.mk_kickStart = (e, h) => {
  const fx = h.fx, a = ang2(e);
  fx.effect('dust', e.x, e.y, 0.5, { r: 0.8 });
  fx.effect('mk_kickStreak', e.x, e.y, 0.6, { x2: e.x2, y2: e.y2 });
  fx.effect('shock', e.x, e.y, 0.3, { r: 0.9, c: '255,220,160' });
  fx.burst(e.x, e.y, h.low ? 4 : 9, { dir: { x: -Math.cos(a), y: -Math.sin(a) }, spread: 1.6, color: '#9a8a70', kind: 'smoke', size: 3.2, speed: 1.6, up: 16, life: 0.6, z: 3 });
};

FX_EVENT.mk_kickTrail = (e, h) => {
  const n = e.n ?? 0;
  const fx = h.fx;
  const a = Math.atan2(e.y - (e.y2 ?? e.y), e.x - (e.x2 ?? e.x));
  // sparse golden afterimages (fading in, so they never cover the monk himself), wind, a scuff of dust
  if (n % 3 === 1 && !(h.low && n % 6 === 4)) fx.effect('mk_ghost', e.x, e.y, 0.3, { data: 'kick', ang: a, power: 0.42, heavy: true });
  if (n % 5 === 2) fx.effect('mk_wind', e.x, e.y, 0.3, { ang: a });
  if (n % 4 === 0) fx.add({ x: e.x + (Math.random() - 0.5) * 0.3, y: e.y + (Math.random() - 0.5) * 0.3, z: 2, vz: 12, color: '#a89878', kind: 'smoke', size: 2.6, life: 0.5 });
};

FX_EVENT.mk_kickHit = (e, h) => {
  const fx = h.fx, a = ang2(e);
  fx.effect('mk_ring', e.x, e.y, 0.3, { ang: a, power: 1.15 });
  sparks(fx, e.x, e.y, h.low ? 3 : 6, { x: Math.cos(a), y: Math.sin(a) }, { speed: 7 });
};

FX_EVENT.mk_kickEnd = (e, h) => {
  const fx = h.fx;
  fx.effect('dust', e.x, e.y, 0.55, { r: 1 });
  fx.effect('shock', e.x, e.y, 0.35, { r: 1.1, c: '255,225,170' });
  fx.burst(e.x, e.y, h.low ? 4 : 10, { color: '#9a8a70', kind: 'smoke', size: 3, speed: 1.8, up: 14, life: 0.6, z: 3 });
};

FX_EVENT.mk_sevenStart = (e, h) => {
  const fx = h.fx, a = ang2(e);
  fx.effect('mk_star', e.x, e.y, 0.3, { power: 1.2 });
  fx.effect('mk_ghost', e.x, e.y, 0.45, { data: 'punch', ang: a, power: 0.8 });
  fx.effect('shock', e.x, e.y, 0.35, { r: 1.2, c: '255,210,130' });
  fx.burst(e.x, e.y, h.low ? 6 : 16, { color: '#ffe0a0', kind: 'glint', size: 1.2, speed: 3, up: 90, grav: 40, life: 0.5, add: true, z: 24 });
};

FX_EVENT.mk_sevenDash = (e, h) => {
  const fx = h.fx, a = ang2(e);
  const d = Math.hypot((e.x2 ?? e.x) - e.x, (e.y2 ?? e.y) - e.y);
  if (d > 0.2) {
    fx.effect('mk_streak', e.x, e.y, 0.3, { x2: e.x2, y2: e.y2 });
    fx.effect('mk_ghost', e.x, e.y, 0.36, { data: 'punch', ang: a, power: 0.5 });
    const n = h.low ? 2 : Math.min(8, 2 + Math.round(d * 1.5));
    for (let i = 0; i < n; i++) {
      const q = Math.random();
      fx.add({ x: e.x + ((e.x2 ?? e.x) - e.x) * q, y: e.y + ((e.y2 ?? e.y) - e.y) * q, z: 20 + Math.random() * 20, vz: 20, color: '#ffe6a8', kind: 'glint', size: 1.1, life: 0.35, add: true });
    }
  }
};

FX_EVENT.mk_sevenHit = (e, h) => {
  const fx = h.fx, a = Math.atan2(e.y - (e.y2 ?? e.y), e.x - (e.x2 ?? e.x));
  fx.effect('mk_star', e.x, e.y, 0.22, { power: 0.62 + (e.n ?? 0) * 0.04 });
  fx.effect('mk_ring', e.x, e.y, 0.22, { ang: a, power: 0.95 });
  sparks(fx, e.x, e.y, h.low ? 3 : 6, { x: Math.cos(a), y: Math.sin(a) }, { speed: 6, color: '#ffe8b0' });
};

FX_EVENT.mk_sevenEnd = (e, h) => {
  const fx = h.fx, r = e.r ?? 2.4;
  fx.effect('mk_gong', e.x, e.y, 1.15, { r });
  fx.effect('shock', e.x, e.y, 0.6, { r: r * 1.2, c: '255,214,130' });
  fx.effect('mk_star', e.x, e.y, 0.35, { power: 1.35 });
  fx.burst(e.x, e.y, h.low ? 12 : 30, { color: '#ffd878', kind: 'star', size: 1.3, speed: 3.2, up: 120, grav: 50, life: 1, add: true, z: 20 });
  h.shake(0.3);
};

