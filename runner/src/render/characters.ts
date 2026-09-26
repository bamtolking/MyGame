// Procedural runners (주자): street-snack buddies drawn with canvas paths — no image assets (GDD 11.1).
//
// Contract with the renderer: feet at (0,0), facing right (+x), logical px, y down.
//  - Standing art ≈ 56–64 × 84. The sim hurtbox (36×70, centred on x, y −70..0) always sits inside it.
//  - Sliding art ≈ 64 × 36, low and flattened (hurtbox 52×32).
//  - pose.squash is applied area-preserving and anchored at the feet (1 = neutral, >1 = squashed).
// Cost: the static body (outline, gradients, textures) is rendered once per shape × palette × tint ×
// resolution bucket into an offscreen canvas and blitted; limbs, face and small animated extras are
// ~15–22 live paths per frame. No shadowBlur / filter anywhere.
//
// Extra exports (optional, not required by callers):
//  - drawCharacter(c, shape, pal, pose, hat?)  — the 5th arg draws a cosmetic hat in the same call.
//  - drawHat(c, hatId, shape, pose)            — same hat, as a separate call with the same transform.
//  - HAT_IDS / HatId                           — 'gat' 갓, 'bokgeon' 복건, 'band' 머리띠.
//  - drawCompanion (re-exported from ./companions).

export type PoseState = 'run' | 'jump' | 'air2' | 'fall' | 'slide' | 'fly' | 'idle' | 'dead';
export interface Pose {
  state: PoseState;
  t: number;          // seconds, free-running (blink, bob)
  runPhase: number;   // 0..1 run cycle (distance-driven so legs never "moonwalk")
  spin: number;       // radians (air-jump flip)
  squash: number;     // 1 = neutral; >1 = squashed (landing), <1 = stretched (take-off)
  hurt: boolean;      // blinking red
  alpha: number;
}
export interface Palette { body: string; shade: string; accent: string; cheek: string }
export type { Shape } from '../data/characters';
import type { Shape } from '../data/characters';
export { drawCompanion, COMPANION_IDS } from './companions';
export type { CompanionId } from './companions';

export type HatId = 'gat' | 'bokgeon' | 'band';
export const HAT_IDS: HatId[] = ['gat', 'bokgeon', 'band'];

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const PUPIL = '#2a1622', MOUTH = '#8a2432', TONGUE = '#ff8c8c';

// ------------------------------------------------------------------ public entry points

export function drawCharacter(c: Ctx, shape: Shape, pal: Palette, p: Pose, hat?: HatId | null): void {
  const sp = SPECS[shape] ?? SPECS.disc;
  const dead = p.state === 'dead';
  const tint: Tint = dead ? 2 : p.hurt ? 1 : 0;           // dead = "cooled down" blue-grey, hurt = red
  const k = inkFor(pal, tint);
  const res = resFor(c);
  c.save();
  c.globalAlpha *= p.alpha;
  c.lineCap = 'round'; c.lineJoin = 'round';
  const sq = p.squash > 0 ? p.squash : 1;
  c.scale(sq, 1 / sq);                                    // area-preserving, anchored at the feet

  if (p.state === 'slide') { drawSlide(c, shape, sp, pal, k, p, tint, res, hat ?? null); c.restore(); return; }

  // run: feet plant on the ground line while the body bobs above them
  let bob = 0;
  if (p.state === 'run') {
    const a = TAU * p.runPhase; bob = Math.abs(Math.sin(a)) * 2.6;
    const cs = Math.cos(RUN_LEAN), sn = Math.sin(RUN_LEAN);
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1, ph = side > 0 ? a : a + Math.PI;
      const hx = side * sp.hipX, hy = sp.hipY;
      const L = LEGS[i]; L[0] = hx * cs - hy * sn; L[1] = hx * sn + hy * cs - bob;
      L[2] = side * sp.hipX * 0.5 + Math.cos(ph) * 11; L[3] = -Math.max(0, -Math.sin(ph)) * 8;
    }
    legs(c, k);
  }
  enterBody(c, sp, p, bob);
  if (p.state !== 'run') {
    for (let i = 0; i < 2; i++) { const side = i ? 1 : -1, f = footFor(p, sp, side), L = LEGS[i]; L[0] = side * sp.hipX; L[1] = sp.hipY; L[2] = f[0]; L[3] = f[1]; }
    legs(c, k);
  }

  const [ab, af] = armAngles(p, !!sp.fins);
  limb(c, k, sp, sp.armB[0], sp.armB[1], ab);
  sp.behind?.(c, k, p);
  blitBody(c, shape, sp, pal, tint, res);
  if (!dead) sp.front?.(c, k, p);
  limb(c, k, sp, sp.armF[0], sp.armF[1], af);
  const m = moodFor(p);
  face(c, sp.face, k, m[0], m[1], m[2], m[3], p.t);
  if (hat) { c.save(); c.translate(sp.hat.x, sp.hat.y); c.rotate(sp.hat.rot); hatArt(c, hat, sp.hat.w, p.t); c.restore(); }
  if (p.state === 'air2') swoosh(c, sp, p.spin);
  if (dead) dizzy(c, sp, p.t);
  c.restore();
}

/** Draw a cosmetic hat on a runner that was drawn with the same transform and pose (not wired in yet). */
export function drawHat(c: Ctx, hatId: HatId, shape: Shape, p: Pose): void {
  const sp = SPECS[shape] ?? SPECS.disc;
  c.save();
  c.globalAlpha *= p.alpha; c.lineCap = 'round'; c.lineJoin = 'round';
  const sq = p.squash > 0 ? p.squash : 1;
  c.scale(sq, 1 / sq);
  if (p.state === 'slide') { const h = sp.slide.hat; c.translate(h.x, h.y); c.rotate(h.rot); hatArt(c, hatId, h.w, p.t); }
  else {
    const bob = p.state === 'run' ? Math.abs(Math.sin(TAU * p.runPhase)) * 2.6 : 0;
    enterBody(c, sp, p, bob); c.translate(sp.hat.x, sp.hat.y); c.rotate(sp.hat.rot); hatArt(c, hatId, sp.hat.w, p.t);
  }
  c.restore();
}

// ------------------------------------------------------------------ shared helpers (exported ones are used elsewhere)

export function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath(); rrSub(c, x, y, w, h, r);
}

/** lighten (+) / darken (−) a #rrggbb colour */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; } else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function rrSub(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function ellSub(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  c.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot)); c.ellipse(x, y, rx, ry, rot, 0, TAU);
}
function ell(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); }
function circSub(c: Ctx, x: number, y: number, r: number): void { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); }
function sparkSub(c: Ctx, x: number, y: number, r: number): void {   // 4-point twinkle
  const q = r * 0.28;
  c.moveTo(x, y - r); c.quadraticCurveTo(x + q, y - q, x + r, y); c.quadraticCurveTo(x + q, y + q, x, y + r);
  c.quadraticCurveTo(x - q, y + q, x - r, y); c.quadraticCurveTo(x - q, y - q, x, y - r); c.closePath();
}
function starPath(c: Ctx, x: number, y: number, R: number, r: number): void {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const d = i % 2 ? r : R; const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
  c.closePath();
}
/** deterministic tiny RNG so textures are identical every time they are cached */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// colours (accept #rgb, #rrggbb or rgb()/rgba())
type RGB = [number, number, number];
function rgbOf(col: string): RGB {
  if (col[0] === '#') { let h = col.slice(1); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; const n = parseInt(h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const m = col.match(/[\d.]+/g); return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
}
function css(v: RGB, a = 1): string { return a >= 1 ? `rgb(${v[0] | 0},${v[1] | 0},${v[2] | 0})` : `rgba(${v[0] | 0},${v[1] | 0},${v[2] | 0},${a})`; }
function lit(col: string, amt: number, a = 1): string {
  const v = rgbOf(col);
  return css(amt >= 0 ? [v[0] + (255 - v[0]) * amt, v[1] + (255 - v[1]) * amt, v[2] + (255 - v[2]) * amt] : [v[0] * (1 + amt), v[1] * (1 + amt), v[2] * (1 + amt)], a);
}
function mixc(a: string, b: string, k: number): string { const x = rgbOf(a), y = rgbOf(b); return css([x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k]); }
function alpha(col: string, a: number): string { return css(rgbOf(col), a); }

// ------------------------------------------------------------------ ink (per palette × tint, cached)

type Tint = 0 | 1 | 2;
interface Ink { line: string; lw: number; limb: string; shoe: string; arm: string; fin: string; rib: string; cheek: string }
const inks = new Map<string, Ink>();
function inkFor(pal: Palette, tint: Tint): Ink {
  const key = pal.body + pal.shade + pal.accent + pal.cheek + tint;
  let k = inks.get(key);
  if (!k) {
    const to = tint === 1 ? '#ff2d4a' : '#8aa0cf', f = tint ? 0.42 : 0;
    const tt = (col: string): string => (f ? mixc(col, to, f) : col);
    const line = tt(lit(pal.accent, -0.5));
    k = { line, lw: 2.3, limb: tt(lit(pal.accent, 0.04)), shoe: tt(lit(pal.accent, -0.3)), arm: tt(lit(pal.body, 0.06)), fin: tt(lit(pal.body, 0.1)), rib: alpha(tt(pal.shade), 0.8), cheek: tint === 2 ? alpha('#c9d6ff', 0.7) : alpha(pal.cheek, 0.85) };
    if (inks.size > 64) inks.clear();
    inks.set(key, k);
  }
  return k;
}

// ------------------------------------------------------------------ body sprite cache

const SX = -50, SY = -108, SW = 100, SH = 116;            // logical bounds of every body sprite
const BUCKETS = [1, 1.5, 2, 3, 4, 6, 8];
const sprites = new Map<string, HTMLCanvasElement>();
const TINT_FILL = ['', 'rgba(255,40,70,0.5)', 'rgba(120,150,205,0.5)'];

function resFor(c: Ctx): number {
  let s = 2;
  if (typeof c.getTransform === 'function') { const m = c.getTransform(); s = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 2; }
  s *= 1.15;                                                // headroom for stretch / slide scaling
  for (const b of BUCKETS) if (b >= s) return b;
  return BUCKETS[BUCKETS.length - 1];
}

function blitBody(c: Ctx, shape: Shape, sp: Spec, pal: Palette, tint: Tint, res: number): void {
  const key = shape + pal.body + pal.shade + pal.accent + tint + '@' + res;
  let cv = sprites.get(key);
  if (!cv && typeof document !== 'undefined') {
    const n = document.createElement('canvas'); n.width = Math.ceil(SW * res); n.height = Math.ceil(SH * res);
    const g = n.getContext('2d');
    if (g) {
      g.scale(res, res); g.translate(-SX, -SY); g.lineCap = 'round'; g.lineJoin = 'round';
      sp.body(g, pal, inkFor(pal, 0));
      if (tint) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = TINT_FILL[tint]; g.fillRect(0, 0, n.width, n.height); }
      if (sprites.size > 48) sprites.clear();
      sprites.set(key, n); cv = n;
    }
  }
  if (cv) c.drawImage(cv, SX, SY, SW, SH);
  else { c.save(); sp.body(c, pal, inkFor(pal, 0)); c.restore(); }   // no DOM (e.g. worker): draw live
}

// ------------------------------------------------------------------ pose

const RUN_LEAN = 0.07;

function enterBody(c: Ctx, sp: Spec, p: Pose, bob: number): void {
  switch (p.state) {
    case 'run': c.translate(0, -bob); c.rotate(RUN_LEAN); break;
    case 'idle': { const b = Math.sin(p.t * 2.6) * 0.022; c.scale(1 - b * 0.6, 1 + b); break; }
    case 'jump': c.scale(0.97, 1.035); break;
    case 'air2': c.translate(0, sp.cy); c.rotate(p.spin); c.scale(0.96, 0.96); c.translate(0, -sp.cy); break;
    case 'fall': c.translate(0, sp.cy); c.rotate(Math.sin(p.t * 5) * 0.06); c.translate(0, -sp.cy); break;
    case 'fly': c.translate(0, sp.cy + Math.sin(p.t * 4) * 2); c.rotate(0.26); c.translate(0, -sp.cy); break;
    default: break;
  }
}

function footFor(p: Pose, sp: Spec, side: number): [number, number] {
  const hx = sp.hipX, back = side < 0;
  switch (p.state) {
    case 'jump': return back ? [-hx - 3, -1] : [hx + 5, -8];
    case 'air2': return back ? [-4, sp.hipY + 8] : [5, sp.hipY + 7];
    case 'fall': { const w = Math.sin(p.t * 9) * 1.6; return back ? [-hx - 4 + w, 0] : [hx + 4 - w, -1]; }
    case 'fly': return back ? [-hx - 9, -5] : [-hx - 2, -2];
    case 'dead': return back ? [-hx - 4, 0] : [hx + 4, 0];
    default: return back ? [-hx - 1, 0] : [hx + 1, 0];
  }
}

/** [back, front] arm angles; 0 = hanging down, + swings back (left), − swings forward (right) */
function armAngles(p: Pose, fins: boolean): [number, number] {
  switch (p.state) {
    case 'run': { const s = Math.cos(TAU * p.runPhase) * 0.95; return [-s + 0.1, s - 0.1]; }
    case 'jump': return [2.5, -2.55];
    case 'air2': return [0.9, -1.1];
    case 'fall': {
      if (fins) { const fl = Math.sin(p.t * 20) * 0.3; return [1.75 + fl, -1.85 - fl]; }       // fins spread like wings: floaty glide
      return [2.0 + Math.sin(p.t * 15) * 0.25, -2.15 - Math.sin(p.t * 15 + 1) * 0.25];
    }
    case 'fly': return [1.5, -2.05];
    case 'dead': return [1.3, -1.3];
    default: { const b = Math.sin(p.t * 2.6) * 0.05; return [0.22 + b, -0.22 - b]; }
  }
}

type EyeMode = 'open' | 'blink' | 'happy' | 'squeeze' | 'squint' | 'spiral';
type MouthMode = 'smile' | 'open' | 'grin' | 'o' | 'grit' | 'wavy' | 'ouch';
function moodFor(p: Pose): [EyeMode, MouthMode, number, number] {
  if (p.state === 'dead') return ['spiral', 'wavy', 0, 0];
  if (p.hurt) return ['squeeze', 'ouch', 0, 0];
  const bt = (p.t + 0.7) % 3.6;
  const blink = bt > 3.46 || (bt > 3.2 && bt < 3.3 && Math.floor((p.t + 0.7) / 3.6) % 2 === 1);
  const open: EyeMode = blink ? 'blink' : 'open';
  switch (p.state) {
    case 'run': return [open, 'open', 1.4, 0];
    case 'jump': return ['open', 'grin', 1, -1.4];
    case 'air2': return ['squeeze', 'o', 0, 0];
    case 'fall': return [open, 'o', 0.8, 1.6];
    case 'fly': return ['happy', 'grin', 0, 0];
    case 'slide': return ['squint', 'grit', 0, 0];
    default: return [open, 'smile', 0.8, 0];
  }
}

// ------------------------------------------------------------------ limbs

/** both rubber-hose legs (hip → foot, [hx, hy, fx, fy] in LEGS) with round shoes pointing forward; 4 draw calls */
const LEGS: [number, number, number, number][] = [[0, 0, 0, 0], [0, 0, 0, 0]];
function legs(c: Ctx, k: Ink): void {
  c.beginPath(); for (const L of LEGS) { c.moveTo(L[0], L[1]); c.lineTo(L[2], L[3] - 3.4); }
  c.strokeStyle = k.line; c.lineWidth = 9.4; c.stroke();
  c.strokeStyle = k.limb; c.lineWidth = 6.6; c.stroke();
  c.beginPath(); for (const L of LEGS) ellSub(c, L[2] + 2, L[3] - 3.6, 6.6, 4.2);
  c.fillStyle = k.shoe; c.fill(); c.strokeStyle = k.line; c.lineWidth = 1.7; c.stroke();
}

function limb(c: Ctx, k: Ink, sp: Spec, x: number, y: number, ang: number): void {
  c.save(); c.translate(x, y); c.rotate(ang);
  if (sp.fins) {
    const L = 13;
    c.beginPath(); c.moveTo(-3.4, -1); c.quadraticCurveTo(-8, L * 0.7, -2.5, L + 3.5); c.quadraticCurveTo(3, L + 5.5, 7.5, L - 1); c.quadraticCurveTo(5, L * 0.4, 3.4, -1); c.closePath();
    c.fillStyle = k.fin; c.fill(); c.strokeStyle = k.line; c.lineWidth = 1.6; c.stroke();
    c.strokeStyle = k.rib; c.lineWidth = 1.1; c.beginPath(); c.moveTo(0, 2); c.lineTo(-0.5, L + 1.5); c.moveTo(2, 2); c.lineTo(4.6, L - 0.5); c.stroke();
  } else {
    const L = 12;
    c.beginPath(); c.arc(0, 0, 3.7, Math.PI, 0); c.lineTo(4.9, L); c.arc(0, L, 4.9, 0, Math.PI); c.closePath();
    c.fillStyle = k.arm; c.fill(); c.strokeStyle = k.line; c.lineWidth = 1.7; c.stroke();
  }
  c.restore();
}

// ------------------------------------------------------------------ face

interface FaceSpot { x: number; y: number; gap: number; k: number }

function face(c: Ctx, f: FaceSpot, k: Ink, eye: EyeMode, mouth: MouthMode, lx: number, ly: number, t: number): void {
  const s = f.k, e0 = f.x - f.gap / 2, e1 = f.x + f.gap / 2, y = f.y;
  c.fillStyle = k.cheek; c.beginPath(); ellSub(c, e0 - 4.4 * s, y + 8.4 * s, 4.5 * s, 2.8 * s); ellSub(c, e1 + 4.8 * s, y + 8.4 * s, 4.5 * s, 2.8 * s); c.fill();
  const W = 6 * s, H = 7.4 * s;
  c.strokeStyle = PUPIL;
  switch (eye) {
    case 'open': {
      c.fillStyle = '#fff'; c.beginPath(); ellSub(c, e0, y, W * 0.94, H * 0.94); ellSub(c, e1, y, W, H); c.fill();
      c.strokeStyle = k.line; c.lineWidth = 1.3 * s; c.stroke();
      c.fillStyle = PUPIL; c.beginPath(); ellSub(c, e0 + 1.1 * s + lx, y + 0.8 * s + ly, 4.1 * s, 5.1 * s); ellSub(c, e1 + 1.3 * s + lx, y + 0.8 * s + ly, 4.3 * s, 5.4 * s); c.fill();
      c.fillStyle = '#fff'; c.beginPath();
      circSub(c, e0 + 2.3 * s + lx * 0.7, y - 1.9 * s + ly * 0.7, 1.8 * s); circSub(c, e1 + 2.6 * s + lx * 0.7, y - 2 * s + ly * 0.7, 1.95 * s);
      circSub(c, e0 - 0.3 * s + lx, y + 3 * s + ly, 0.85 * s); circSub(c, e1 - 0.1 * s + lx, y + 3.1 * s + ly, 0.9 * s); c.fill();
      break;
    }
    case 'blink': {
      c.lineWidth = 2.1 * s; c.beginPath();
      for (const ex of [e0, e1]) { c.moveTo(ex - 4.6 * s, y + 0.5 * s); c.quadraticCurveTo(ex, y + 4.4 * s, ex + 4.6 * s, y + 0.5 * s); }
      c.stroke(); break;
    }
    case 'happy': {
      c.lineWidth = 2.3 * s; c.beginPath();
      for (const ex of [e0, e1]) { c.moveTo(ex - 4.8 * s, y + 2 * s); c.quadraticCurveTo(ex, y - 5.6 * s, ex + 4.8 * s, y + 2 * s); }
      c.stroke(); break;
    }
    case 'squeeze': {
      c.lineWidth = 2.3 * s; c.beginPath();
      c.moveTo(e0 - 3.8 * s, y - 4.2 * s); c.lineTo(e0 + 3.4 * s, y); c.lineTo(e0 - 3.8 * s, y + 4.2 * s);
      c.moveTo(e1 + 3.8 * s, y - 4.2 * s); c.lineTo(e1 - 3.4 * s, y); c.lineTo(e1 + 3.8 * s, y + 4.2 * s);
      c.stroke(); break;
    }
    case 'squint': {
      c.fillStyle = '#fff'; c.beginPath(); ellSub(c, e0, y + 1 * s, W * 0.95, 4.2 * s); ellSub(c, e1, y + 1 * s, W, 4.4 * s); c.fill();
      c.strokeStyle = k.line; c.lineWidth = 1.2 * s; c.stroke();
      c.fillStyle = PUPIL; c.beginPath(); ellSub(c, e0 + 2.4 * s, y + 1.6 * s, 3.2 * s, 3.4 * s); ellSub(c, e1 + 2.6 * s, y + 1.6 * s, 3.3 * s, 3.5 * s); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); circSub(c, e0 + 3.3 * s, y + 0.4 * s, 1.1 * s); circSub(c, e1 + 3.5 * s, y + 0.4 * s, 1.15 * s); c.fill();
      c.strokeStyle = PUPIL; c.lineWidth = 2.5 * s; c.beginPath();
      c.moveTo(e0 - 6.4 * s, y - 3.8 * s); c.lineTo(e0 + 6 * s, y - 1.6 * s); c.moveTo(e1 - 6.2 * s, y - 3.8 * s); c.lineTo(e1 + 6.4 * s, y - 1.4 * s); c.stroke();
      break;
    }
    case 'spiral': {
      c.fillStyle = '#fff'; c.beginPath(); ellSub(c, e0, y, W * 0.94, H * 0.94); ellSub(c, e1, y, W, H); c.fill();
      c.strokeStyle = k.line; c.lineWidth = 1.2 * s; c.stroke();
      c.strokeStyle = PUPIL; c.lineWidth = 1.5 * s; c.beginPath();
      for (const ex of [e0, e1]) for (let i = 0; i <= 14; i++) { const a = i * 0.78 + t * 6, r = (0.3 + i * 0.33) * s; const px = ex + Math.cos(a) * r, py = y + Math.sin(a) * r * 1.15; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
      c.stroke(); break;
    }
  }
  const mx = f.x + 1.2 * s, my = y + 9.6 * s;
  c.strokeStyle = PUPIL; c.lineWidth = 1.5 * s;
  switch (mouth) {
    case 'smile': c.lineWidth = 1.9 * s; c.beginPath(); c.arc(mx, my - 2.8 * s, 3.4 * s, 0.18 * Math.PI, 0.82 * Math.PI); c.stroke(); break;
    case 'open': case 'grin': {
      const w = mouth === 'grin' ? 5 : 3.8, d = mouth === 'grin' ? 8 : 6.4;
      c.beginPath(); c.moveTo(mx - w * s, my - 1.6 * s); c.quadraticCurveTo(mx, my + d * s, mx + w * s, my - 1.6 * s); c.closePath();
      c.fillStyle = MOUTH; c.fill(); c.stroke();
      c.fillStyle = TONGUE; c.beginPath(); ellSub(c, mx + 0.3 * s, my + (d * 0.36) * s, w * 0.5 * s, 1.4 * s); c.fill();
      break;
    }
    case 'o': c.fillStyle = MOUTH; ell(c, mx, my + 0.4 * s, 2.5 * s, 3 * s); c.fill(); c.stroke(); break;
    case 'grit': c.lineWidth = 2 * s; c.beginPath(); c.moveTo(mx - 3.6 * s, my - 0.4 * s); c.quadraticCurveTo(mx + 0.6 * s, my + 2.2 * s, mx + 4.2 * s, my - 1.4 * s); c.stroke(); break;
    case 'wavy': {
      c.lineWidth = 1.8 * s; c.beginPath(); c.moveTo(mx - 5 * s, my);
      for (let i = 1; i <= 4; i++) c.quadraticCurveTo(mx - 5 * s + (i - 0.5) * 2.5 * s, my + (i % 2 ? -2 : 2) * s, mx - 5 * s + i * 2.5 * s, my);
      c.stroke(); break;
    }
    case 'ouch': c.beginPath(); c.moveTo(mx - 3.8 * s, my + 2 * s); c.quadraticCurveTo(mx, my - 4.2 * s, mx + 3.8 * s, my + 2 * s); c.closePath(); c.fillStyle = MOUTH; c.fill(); c.stroke(); break;
  }
}

// ------------------------------------------------------------------ pose extras

function swoosh(c: Ctx, sp: Spec, spin: number): void {           // the '휙' of the air-jump flip
  if (!spin) return;
  const prog = Math.min(1, Math.abs(spin) / TAU); const a = Math.sin(Math.PI * prog) * 0.85;
  if (a < 0.05) return;
  const dir = spin < 0 ? 1 : -1, ccw = dir < 0, R = sp.cy - sp.top + 9, top = -Math.PI / 2, bot = Math.PI / 2;
  c.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`;
  c.lineWidth = 3.4; c.beginPath(); c.arc(0, sp.cy, R, top + dir * 0.25, top + dir * 1.6, ccw); c.stroke();
  c.lineWidth = 2.2; c.beginPath(); c.arc(0, sp.cy, R - 7, top + dir * 0.5, top + dir * 1.25, ccw);
  c.moveTo(Math.cos(bot + dir * 0.3) * R, sp.cy + Math.sin(bot + dir * 0.3) * R); c.arc(0, sp.cy, R, bot + dir * 0.3, bot + dir * 1.3, ccw); c.stroke();
}

function dizzy(c: Ctx, sp: Spec, t: number): void {
  c.fillStyle = '#ffe066'; c.beginPath();
  for (let i = 0; i < 3; i++) { const a = t * 4 + i * TAU / 3; sparkSub(c, sp.face.x + Math.cos(a) * 15, sp.top - 6 + Math.sin(a) * 4, 3.6); }
  c.fill();
}

function steamWisps(c: Ctx, x0: number, y0: number, n: number, t: number, speed: number, col: string, amp: number): void {
  for (let i = 0; i < n; i++) {
    const ph = (t * speed + i / n) % 1; const a = Math.sin(Math.PI * ph) * amp;
    const x = x0 + (i - (n - 1) / 2) * 8 + Math.sin(t * 2 + i) * 1.5, y = y0 - ph * 22;
    c.strokeStyle = `rgba(${col},${a.toFixed(3)})`; c.lineWidth = 2.6 - ph * 1.1;
    c.beginPath(); c.moveTo(x, y + 9); c.bezierCurveTo(x - 5, y + 5, x + 5, y, x, y - 7); c.stroke();
  }
}

// ------------------------------------------------------------------ slide (low, flattened, head-first)

function drawSlide(c: Ctx, shape: Shape, sp: Spec, pal: Palette, k: Ink, p: Pose, tint: Tint, res: number, hat: HatId | null): void {
  const S = sp.slide, t = p.t;
  // speed streaks behind
  c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2; c.beginPath();
  for (let i = 0; i < 3; i++) { const y = -7 - i * 9, o = ((t * 7 + i * 0.37) % 1) * 12; c.moveTo(-38 - o, y); c.lineTo(-50 - o - i * 3, y); }
  c.stroke();
  // little feet kicking out behind
  const kick = Math.sin(TAU * p.runPhase) * 1.6, [fx, fy] = S.feet;
  LEGS[0][0] = fx + 8; LEGS[0][1] = fy - 4; LEGS[0][2] = fx; LEGS[0][3] = fy + kick;
  LEGS[1][0] = fx + 12; LEGS[1][1] = fy - 3; LEGS[1][2] = fx + 5; LEGS[1][3] = fy + 1.5 - kick;
  legs(c, k);
  // the body, laid low
  c.save();
  if (S.mode === 'lie') { c.translate(S.cx, -18); c.rotate(Math.PI / 2); c.scale(S.sx, S.sy); c.translate(0, -sp.cy); }
  else { c.transform(1, 0, S.lean, 1, 0, 0); c.rotate(S.rot); c.scale(S.sx, S.sy); c.translate(0, -sp.bottom); }
  sp.behind?.(c, k, p);
  blitBody(c, shape, sp, pal, tint, res);
  c.restore();
  // one arm swept back over the top
  limb(c, k, sp, S.arm[0], S.arm[1], 1.75);
  face(c, S.face, k, p.hurt ? 'squeeze' : 'squint', p.hurt ? 'ouch' : 'grit', 0, 0, t);
  if (hat) { c.save(); c.translate(S.hat.x, S.hat.y); c.rotate(S.hat.rot); hatArt(c, hat, S.hat.w, t); c.restore(); }
}

// ------------------------------------------------------------------ hats (cosmetics; origin = top-centre of the head)

function hatArt(c: Ctx, id: HatId, w: number, t: number): void {
  const ink = '#140c1c';
  c.lineWidth = 1.5; c.strokeStyle = ink;
  switch (id) {
    case 'gat': {      // 갓: translucent horsehair brim, tall crown, bead chin strap
      c.fillStyle = 'rgba(24,18,30,0.62)'; ell(c, 0, 1, w * 0.78, 3.6); c.fill(); c.stroke();
      c.fillStyle = '#1d1726'; c.beginPath(); c.moveTo(-w * 0.24, 1); c.lineTo(-w * 0.21, -15); c.quadraticCurveTo(0, -20, w * 0.21, -15); c.lineTo(w * 0.24, 1); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(-w * 0.16, -13, 2.2, 12);
      c.fillStyle = '#e9b44c'; c.beginPath(); for (let i = 0; i < 5; i++) circSub(c, w * 0.3 + i * 0.4, 5 + i * 4.2, 1.5); c.fill();
      break;
    }
    case 'bokgeon': {  // 복건: soft black scholar's cap with a back flap and ties
      c.fillStyle = '#211c33';
      c.beginPath(); c.moveTo(-w * 0.52, 5); c.quadraticCurveTo(-w * 0.58, -14, 0, -15); c.quadraticCurveTo(w * 0.5, -13, w * 0.5, 4); c.quadraticCurveTo(0, -1, -w * 0.52, 5); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-w * 0.5, 2); c.quadraticCurveTo(-w * 0.66, 10, -w * 0.56, 20); c.lineTo(-w * 0.4, 12); c.closePath(); c.fill(); c.stroke();
      const fl = Math.sin(t * 9) * 2;
      c.strokeStyle = '#211c33'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-w * 0.45, 4); c.quadraticCurveTo(-w * 0.7, 8 + fl, -w * 0.9, 6 - fl); c.moveTo(-w * 0.42, 6); c.quadraticCurveTo(-w * 0.62, 13 - fl, -w * 0.82, 14 + fl); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-w * 0.2, -11); c.quadraticCurveTo(0, -6, w * 0.25, -9); c.stroke();
      break;
    }
    case 'band': {     // 머리띠: red headband with a knot and fluttering tails
      const fl = Math.sin(t * 10) * 2.2;
      c.fillStyle = '#e63946'; c.beginPath(); rrSub(c, -w * 0.5, 7, w, 5.5, 2.7); c.fill(); c.stroke();
      c.fillStyle = '#fff4e6'; c.fillRect(-w * 0.1, 8.6, w * 0.2, 2.3);
      c.strokeStyle = ink; c.lineWidth = 5; c.beginPath(); c.moveTo(-w * 0.48, 10); c.quadraticCurveTo(-w * 0.7, 9 + fl, -w * 0.9, 12 - fl); c.moveTo(-w * 0.48, 11); c.quadraticCurveTo(-w * 0.68, 16 - fl, -w * 0.84, 19 + fl); c.stroke();
      c.strokeStyle = '#e63946'; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#e63946'; ell(c, -w * 0.5, 10, 3.2, 3.6); c.fill(); c.strokeStyle = ink; c.lineWidth = 1.4; c.stroke();
      break;
    }
  }
}

// ------------------------------------------------------------------ shapes

interface SlideSpec {
  mode: 'squash' | 'lie';
  sx: number; sy: number; lean: number; rot: number; cx: number;   // squash: skew/rotate/scale about the feet; lie: rotate 90° head-first
  face: FaceSpot; arm: [number, number]; feet: [number, number]; hat: { x: number; y: number; w: number; rot: number };
}
interface Spec {
  cy: number; top: number; bottom: number;                     // body centre (flip pivot), top, bottom (y)
  hipX: number; hipY: number;
  armB: [number, number]; armF: [number, number];
  face: FaceSpot;
  hat: { x: number; y: number; w: number; rot: number };
  fins?: boolean;
  slide: SlideSpec;
  body(g: Ctx, pal: Palette, k: Ink): void;                   // static art (cached)
  behind?(c: Ctx, k: Ink, p: Pose): void;                     // live, under the body
  front?(c: Ctx, k: Ink, p: Pose): void;                      // live, over the body (skipped when dead)
}

// 호떡이 — a puffy golden pancake seen face-on, wider than tall; the crispy back rim shows its thickness, sugar
// glints on the rim, and brown-sugar syrup leaks from a split at the lower-back edge and drips.
function bodyDisc(g: Ctx, pal: Palette, k: Ink): void {
  const cx = 0, cy = -47, rx = 35, ry = 26, R = rng(11);
  g.lineWidth = k.lw; g.strokeStyle = k.line;
  g.fillStyle = lit(pal.shade, -0.18); ell(g, cx - 3.4, cy + 2.6, rx, ry); g.fill(); g.stroke();
  g.fillStyle = alpha(lit(pal.body, 0.2), 0.6); ell(g, cx - 3.4, cy + 2.6, rx - 3, ry - 3, 0); g.fill();
  const gr = g.createRadialGradient(cx + 3, cy - 6, 2, cx, cy, rx + 1);
  gr.addColorStop(0, lit(pal.body, 0.42)); gr.addColorStop(0.45, lit(pal.body, 0.12)); gr.addColorStop(0.78, pal.body); gr.addColorStop(1, pal.shade);
  g.fillStyle = gr; ell(g, cx, cy, rx, ry); g.fill(); g.stroke();
  // crispy toasted ring just inside the edge + browned spots
  g.strokeStyle = alpha(pal.shade, 0.6); g.lineWidth = 3.2; ell(g, cx, cy, rx - 3.4, ry - 3.4); g.stroke();
  g.fillStyle = alpha(pal.shade, 0.3); g.beginPath();
  for (let i = 0; i < 6; i++) { const a = R() * TAU, d = 8 + R() * 14; ellSub(g, cx + Math.cos(a) * d * 1.2, cy + Math.sin(a) * d * 0.8, 2.5 + R() * 3, 1.6 + R() * 2, R() * 3); }
  g.fill();
  // sugary glaze on the rim
  g.strokeStyle = 'rgba(255,248,228,0.8)'; g.lineWidth = 2.4;
  g.beginPath(); g.ellipse(cx, cy, rx - 2.3, ry - 2.3, 0, Math.PI * 1.1, Math.PI * 1.5); g.stroke();
  g.beginPath(); g.ellipse(cx, cy, rx - 2.3, ry - 2.3, 0, Math.PI * 1.6, Math.PI * 1.72); g.stroke();
  g.beginPath(); g.ellipse(cx, cy, rx - 2.3, ry - 2.3, 0, Math.PI * 0.08, Math.PI * 0.2); g.stroke();
  g.fillStyle = 'rgba(255,252,240,0.95)'; g.beginPath();
  for (let i = 0; i < 22; i++) { const a = R() * TAU, d = 1.2 + R() * 4, s = 0.9 + R() * 0.9; const x = cx + Math.cos(a) * (rx - d), y = cy + Math.sin(a) * (ry - d); g.moveTo(x, y - s); g.lineTo(x + s * 0.75, y); g.lineTo(x, y + s); g.lineTo(x - s * 0.75, y); g.closePath(); }
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.3)'; ell(g, cx - 12, cy - 13, 10, 4, -0.35); g.fill();
  // brown-sugar syrup leaking from a split at the lower-back edge, one fat drip hanging off it
  g.beginPath(); ellSub(g, -19.5, -26.6, 9.5, 4.4, 0.5); rrSub(g, -24.6, -28, 5.6, 13, 2.8); ellSub(g, -21.8, -14.6, 3.9, 4.6);
  g.lineWidth = k.lw * 2; g.strokeStyle = k.line; g.stroke();
  const sg = g.createLinearGradient(-26, -32, -16, -10); sg.addColorStop(0, '#d0701f'); sg.addColorStop(1, '#6c2a0c');
  g.fillStyle = sg; g.fill();
  g.fillStyle = 'rgba(255,224,165,0.9)'; g.beginPath(); ellSub(g, -17, -28.4, 3.8, 1.3, 0.5); ellSub(g, -23, -16.6, 1.2, 1.8); g.fill();
  g.fillStyle = '#f3e2b8'; g.beginPath(); ellSub(g, -23.4, -24.8, 1.9, 1, 0.9); ellSub(g, -14.5, -25.5, 1.6, 0.9, 0.3); g.fill();
}

// 붕이 — fish-shaped bread: plump fish facing right, scales on the body, gill line, toasted mould rim,
// dorsal fin on top; the tail fin and pectoral fins (arms) are live so they can waggle / spread.
function fishPath(g: Ctx): void {
  g.beginPath();
  g.moveTo(29, -44);
  g.bezierCurveTo(29, -63, 16, -74, -1, -74);
  g.bezierCurveTo(-14, -74, -20, -64, -23, -54);
  g.quadraticCurveTo(-25, -45, -23, -36);
  g.bezierCurveTo(-20, -24, -12, -17, 0, -17);
  g.bezierCurveTo(15, -17, 29, -27, 29, -44);
  g.closePath();
}
function bodyFish(g: Ctx, pal: Palette, k: Ink): void {
  g.lineWidth = k.lw; g.strokeStyle = k.line;
  // dorsal fin (under the body outline)
  g.beginPath(); g.moveTo(-17, -63); g.quadraticCurveTo(-16, -80, -7, -86); g.quadraticCurveTo(-4, -80, 1, -83); g.quadraticCurveTo(6, -80, 9, -71); g.closePath();
  g.fillStyle = lit(pal.body, 0.08); g.fill(); g.stroke();
  g.strokeStyle = alpha(pal.shade, 0.9); g.lineWidth = 1.2; g.beginPath(); g.moveTo(-10, -70); g.lineTo(-8, -82); g.moveTo(-4, -71); g.lineTo(-2, -80); g.moveTo(2, -71); g.lineTo(4, -77); g.stroke();
  // body
  const gr = g.createLinearGradient(0, -74, 0, -17);
  gr.addColorStop(0, pal.shade); gr.addColorStop(0.3, pal.body); gr.addColorStop(0.72, lit(pal.body, 0.22)); gr.addColorStop(1, lit(pal.body, 0.05));
  fishPath(g); g.fillStyle = gr; g.fill();
  g.save(); fishPath(g); g.clip();
  g.lineWidth = 7; g.strokeStyle = alpha(pal.shade, 0.4); fishPath(g); g.stroke();          // toasted mould rim
  g.lineWidth = 1.2; g.strokeStyle = 'rgba(255,236,190,0.55)'; g.beginPath(); g.moveTo(24, -58); g.bezierCurveTo(14, -70, -2, -71, -12, -66); g.stroke();
  // scales (U arcs) on the back half
  g.strokeStyle = alpha(lit(pal.shade, -0.1), 0.85); g.lineWidth = 1.35; g.beginPath();
  for (let row = 0; row < 6; row++) for (let col = 0; col < 4; col++) {
    const x = -21 + col * 7.4 + (row % 2) * 3.7, y = -63 + row * 7.2, r = 3.9;
    if (x > -1) continue;
    const a0 = 0.12 * Math.PI, a1 = 0.88 * Math.PI; g.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r); g.arc(x, y, r, a0, a1);
  }
  g.stroke();
  g.restore();
  // gill line
  g.strokeStyle = alpha(lit(pal.shade, -0.15), 0.9); g.lineWidth = 1.9; g.beginPath(); g.moveTo(3, -67); g.quadraticCurveTo(-6, -47, 2, -26); g.stroke();
  fishPath(g); g.strokeStyle = k.line; g.lineWidth = k.lw; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.32)'; ell(g, 12, -66, 7, 3, -0.3); g.fill();
}
function fishTail(c: Ctx, k: Ink, p: Pose): void {
  const wag = p.state === 'run' ? Math.sin(TAU * p.runPhase * 2) * 0.12 : p.state === 'fall' ? Math.sin(p.t * 12) * 0.2 : p.state === 'idle' ? Math.sin(p.t * 3) * 0.08 : 0;
  const fan = p.state === 'fall' ? 1.25 : 1;
  c.save(); c.translate(-21, -45); c.rotate(wag); c.scale(1, fan);
  c.beginPath(); c.moveTo(3, -8); c.quadraticCurveTo(-7, -12, -17, -20); c.quadraticCurveTo(-15, -8, -10, 0); c.quadraticCurveTo(-15, 8, -17, 20); c.quadraticCurveTo(-7, 12, 3, 8); c.closePath();
  c.fillStyle = k.fin; c.fill(); c.strokeStyle = k.line; c.lineWidth = 2; c.stroke();
  c.strokeStyle = k.rib; c.lineWidth = 1.1; c.beginPath(); c.moveTo(-2, -3); c.lineTo(-13, -14); c.moveTo(-2, 3); c.lineTo(-13, 14); c.moveTo(-3, 0); c.lineTo(-8, 0); c.stroke();
  c.restore();
}

// 꼬치 — three glazed rice-cake pieces on a skewer; red gochujang glaze with gloss streaks, drips and sesame.
function tteok(g: Ctx, pal: Palette, k: Ink, x: number, y: number, w: number, h: number, rot: number, R: () => number): void {
  g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(rot);
  const hw = w / 2, hh = h / 2;
  g.beginPath(); rrSub(g, -hw, -hh, w, h, hh * 0.92);
  for (const dx of [-hw * 0.45 + R() * 4, hw * 0.3 + R() * 4]) { ellSub(g, dx, hh + 0.5, 2.6, 3.8); }
  g.lineWidth = k.lw * 2; g.strokeStyle = k.line; g.stroke();
  const gr = g.createLinearGradient(0, -hh, 0, hh + 3);
  gr.addColorStop(0, lit(pal.body, 0.22)); gr.addColorStop(0.45, pal.body); gr.addColorStop(1, pal.shade);
  g.fillStyle = gr; g.fill();
  g.fillStyle = alpha(lit(pal.shade, -0.25), 0.35); g.beginPath(); rrSub(g, -hw + 3, hh - 5, w - 6, 3.4, 1.7); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.62)'; g.beginPath(); rrSub(g, -hw + 5, -hh + 2.6, w * 0.42, 3.3, 1.65); circSub(g, -hw + 5 + w * 0.42 + 4, -hh + 4.2, 1.5); g.fill();
  g.fillStyle = '#fff3d4'; g.beginPath();
  for (let i = 0; i < 6; i++) ellSub(g, -hw + 5 + R() * (w - 10), -hh + 4 + R() * (h - 8), 1.8, 0.95, R() * 3);
  g.fill();
  g.restore();
}
function bodySkewer(g: Ctx, pal: Palette, k: Ink): void {
  const R = rng(5);
  stick(g, k, -98, -16);
  tteok(g, pal, k, -21, -33, 42, 18, 0.06, R);
  tteok(g, pal, k, -22, -54, 44, 19, -0.05, R);
  tteok(g, pal, k, -24, -86, 48, 30, 0, R);
}
function stick(g: Ctx, k: Ink, top: number, bottom: number): void {
  g.beginPath(); g.moveTo(-2.4, bottom); g.lineTo(-2.4, top + 7); g.lineTo(0, top); g.lineTo(2.4, top + 7); g.lineTo(2.4, bottom); g.closePath();
  g.fillStyle = '#dcb47c'; g.fill(); g.strokeStyle = k.line; g.lineWidth = 1.6; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-1, top + 8); g.lineTo(-1, bottom); g.stroke();
}

// 어묵이 — a fish-cake sheet folded like an accordion on a skewer: seen from the side the ribbon snakes left
// and right (the silhouette zig-zags), folds alternate light / shadowed, fried edges, steam rising from the top.
const FC_W2 = 23.5, FC_Y0 = -74, FC_Y1 = -22, FC_WAVE0 = -66, FC_P = 30;
function fcShift(y: number): number {                     // sideways shift of the ribbon at height y
  const u = (y - FC_WAVE0) / FC_P; if (u <= 0) return 0;
  return 5.8 * Math.min(1, u * 2.5) * Math.sin(u * TAU);
}
function fishcakePath(g: Ctx): void {
  g.beginPath();
  g.moveTo(-FC_W2, FC_Y0);
  g.ellipse(0, FC_Y0, FC_W2, 14, 0, Math.PI, TAU);
  for (let y = FC_Y0; y <= FC_Y1; y += 1.5) g.lineTo(FC_W2 + fcShift(y), y);
  const sb = fcShift(FC_Y1);
  g.ellipse(sb, FC_Y1, FC_W2, 7, 0, 0, Math.PI);
  for (let y = FC_Y1; y >= FC_Y0; y -= 1.5) g.lineTo(-FC_W2 + fcShift(y), y);
  g.closePath();
}
function bodyFishcake(g: Ctx, pal: Palette, k: Ink): void {
  const R = rng(3);
  stick(g, k, -100, -20);
  const gr = g.createLinearGradient(0, -88, 0, -15);
  gr.addColorStop(0, lit(pal.body, 0.3)); gr.addColorStop(0.5, pal.body); gr.addColorStop(1, lit(pal.body, -0.05));
  fishcakePath(g); g.fillStyle = gr; g.fill();
  g.save(); fishcakePath(g); g.clip();
  // folds: each band lit on one face and shadowed toward the next crease
  const creases = [FC_WAVE0 + FC_P * 0.25, FC_WAVE0 + FC_P * 0.75, FC_WAVE0 + FC_P * 1.25];
  let prev = FC_WAVE0 - 4;
  [...creases, -12].forEach((yc, i) => {
    const lg = g.createLinearGradient(0, prev, 0, yc);
    if (i % 2 === 0) { lg.addColorStop(0, 'rgba(255,255,255,0.22)'); lg.addColorStop(1, alpha(pal.shade, 0.6)); }
    else { lg.addColorStop(0, alpha(pal.shade, 0.35)); lg.addColorStop(0.6, 'rgba(255,255,255,0.12)'); lg.addColorStop(1, alpha(pal.shade, 0.4)); }
    g.fillStyle = lg; g.fillRect(-40, prev, 80, yc - prev); prev = yc;
  });
  g.lineWidth = 6; g.strokeStyle = 'rgba(196,112,40,0.32)'; fishcakePath(g); g.stroke();       // fried edges
  g.fillStyle = alpha(pal.shade, 0.55); g.beginPath();
  for (let i = 0; i < 16; i++) { const y = -84 + R() * 64; circSub(g, fcShift(y) - 17 + R() * 34, y, 0.7 + R() * 0.6); }
  g.fill();
  g.restore();
  fishcakePath(g); g.lineWidth = k.lw; g.strokeStyle = k.line; g.stroke();
  // crease lines bow toward the side the fold turns
  g.strokeStyle = alpha(lit(pal.shade, -0.3), 0.7); g.lineWidth = 1.5; g.beginPath();
  creases.forEach((yc, i) => { const sft = fcShift(yc), d = i % 2 ? -3.5 : 3.5; g.moveTo(-FC_W2 + sft + 2, yc - d * 0.3); g.quadraticCurveTo(sft, yc + d, FC_W2 + sft - 2, yc - d * 0.3); });
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2.2; g.beginPath(); g.ellipse(0, FC_Y0 + 1, FC_W2 - 6, 10, 0, Math.PI * 1.15, Math.PI * 1.55); g.stroke();
}

// 달콩 — a round dalgona disc: caramel edge, porous honeycomb, big embossed star imprint (face sits on it).
function bodyStar(g: Ctx, pal: Palette, k: Ink): void {
  const cx = 0, cy = -48, r = 30, R = rng(7), n = 26;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU; let d = r * (1 + (R() - 0.5) * 0.06);
    const da = Math.abs(a - Math.PI * 1.24); if (da < 0.3) d -= 7 * (1 - da / 0.3);     // a chip broken off the top-back edge (뽑기!)
    pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]);
  }
  const edge = (): void => {
    g.beginPath(); const m0 = mid(pts[n - 1], pts[0]); g.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n], m = mid(a, b); g.quadraticCurveTo(a[0], a[1], m[0], m[1]); }
    g.closePath();
  };
  const gr = g.createRadialGradient(cx - 4, cy - 6, 2, cx, cy, r + 1);
  gr.addColorStop(0, lit(pal.body, 0.45)); gr.addColorStop(0.55, lit(pal.body, 0.18)); gr.addColorStop(0.85, pal.body); gr.addColorStop(1, pal.shade);
  edge(); g.fillStyle = gr; g.fill();
  g.save(); edge(); g.clip();
  g.lineWidth = 7; g.strokeStyle = alpha(pal.shade, 0.5); edge(); g.stroke();              // caramelised edge
  // honeycomb pores
  const holes: [number, number, number][] = [];
  for (let i = 0; i < 40; i++) { const a = R() * TAU, d = 5 + R() * 21; holes.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.8 + R() * 1.5]); }
  g.fillStyle = alpha(lit(pal.shade, -0.1), 0.5); g.beginPath(); for (const [x, y, s] of holes) circSub(g, x, y, s); g.fill();
  g.fillStyle = 'rgba(255,244,210,0.7)'; g.beginPath(); for (const [x, y, s] of holes) { g.moveTo(x - s * 0.9, y - s * 0.2); g.arc(x - s * 0.25, y - s * 0.35, s * 0.62, Math.PI, Math.PI * 1.9); } g.fill();
  g.restore();
  edge(); g.lineWidth = k.lw; g.strokeStyle = k.line; g.stroke();
  // embossed star imprint
  const sx = 1.5, sy = -46.5;
  starPath(g, sx + 1.2, sy + 1.6, 22, 9.5); g.fillStyle = alpha(lit(pal.shade, -0.3), 0.45); g.fill();
  starPath(g, sx, sy, 22, 9.5); g.fillStyle = lit(pal.body, 0.55); g.fill(); g.lineWidth = 1.8; g.strokeStyle = pal.shade; g.stroke();
  g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,0.75)'; starPath(g, sx - 0.5, sy - 0.6, 19.8, 8.4); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.3)'; ell(g, cx - 9, cy - 19, 6, 2.6, -0.4); g.fill();
  // hairline cracks running in from the chip
  g.strokeStyle = alpha(lit(pal.shade, -0.35), 0.8); g.lineWidth = 1.1; g.beginPath();
  g.moveTo(-16.5, -66.5); g.lineTo(-13, -62); g.lineTo(-13.8, -58); g.lineTo(-10.5, -55);
  g.moveTo(-13, -62); g.lineTo(-9, -63.5);
  g.stroke();
}
function mid(a: [number, number], b: [number, number]): [number, number] { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
function starTwinkle(c: Ctx, _k: Ink, p: Pose): void {
  const ph = p.t % 2.6; if (ph > 0.5) return;
  const a = Math.sin(ph / 0.5 * Math.PI);
  c.fillStyle = `rgba(255,255,240,${(a * 0.95).toFixed(3)})`; c.beginPath(); sparkSub(c, 21, -70, 2 + a * 3); c.fill();
}

// 고구미 — an elongated roasted sweet potato: purple skin with little root marks, a crack at the top-back
// showing bright yellow flesh, a curly root tip, and a wisp of heat.
function potatoPath(g: Ctx): void {
  g.beginPath();
  g.moveTo(1, -88);
  g.bezierCurveTo(14, -88, 26, -68, 25, -45);
  g.bezierCurveTo(24, -24, 15, -13, 0, -13);
  g.bezierCurveTo(-15, -13, -25, -24, -25, -45);
  g.bezierCurveTo(-25, -68, -12, -88, 1, -88);
  g.closePath();
}
function bodyPotato(g: Ctx, pal: Palette, k: Ink): void {
  const R = rng(9);
  // curly root tip
  g.beginPath(); g.moveTo(-1, -86); g.bezierCurveTo(-3, -95, -11, -98, -14, -93);
  g.strokeStyle = k.line; g.lineWidth = 5.4; g.stroke(); g.strokeStyle = pal.shade; g.lineWidth = 3; g.stroke();
  const gr = g.createRadialGradient(6, -62, 3, 0, -50, 42);
  gr.addColorStop(0, lit(pal.body, 0.3)); gr.addColorStop(0.5, pal.body); gr.addColorStop(1, pal.shade);
  potatoPath(g); g.fillStyle = gr; g.fill();
  g.save(); potatoPath(g); g.clip();
  g.lineWidth = 6; g.strokeStyle = alpha(lit(pal.shade, -0.25), 0.4); potatoPath(g); g.stroke();
  // skin rings and root dots
  g.strokeStyle = alpha(lit(pal.shade, -0.35), 0.55); g.lineWidth = 1.3; g.beginPath();
  for (const [x, y, w] of [[-17, -38, 7], [-14, -26, 9], [14, -28, 8], [18, -64, 5], [-19, -50, 5]] as [number, number, number][]) { g.moveTo(x - w / 2, y); g.quadraticCurveTo(x, y + 2.2, x + w / 2, y); }
  g.stroke();
  g.fillStyle = alpha(lit(pal.shade, -0.4), 0.6); g.beginPath();
  for (let i = 0; i < 7; i++) circSub(g, -20 + R() * 40, -34 + R() * 20 - (i % 2) * 22, 0.8 + R() * 0.5);
  g.fill();
  g.restore();
  potatoPath(g); g.strokeStyle = k.line; g.lineWidth = k.lw; g.stroke();
  // the crack: a jagged lens along the top-back showing hot yellow flesh
  const A: [number, number] = [-22, -57], B: [number, number] = [3, -84];
  const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  const up = [0, 1.3, -0.4, 1.1, -0.5, 0.9, 0], lo = [0, -0.6, 1.0, -0.4, 0.9, -0.5, 0];
  g.beginPath(); g.moveTo(A[0], A[1]);
  for (let i = 1; i < 7; i++) { const t = i / 6, w = 4.4 * Math.pow(Math.sin(Math.PI * t), 0.8) + up[i]; g.lineTo(A[0] + dx * t - nx * w, A[1] + dy * t - ny * w); }
  for (let i = 5; i >= 1; i--) { const t = i / 6, w = 3.4 * Math.pow(Math.sin(Math.PI * t), 0.8) + lo[i]; g.lineTo(A[0] + dx * t + nx * w, A[1] + dy * t + ny * w); }
  g.closePath();
  const fg = g.createRadialGradient(-9, -71, 1, -9, -71, 17);
  fg.addColorStop(0, '#fff6b0'); fg.addColorStop(0.45, '#ffd43b'); fg.addColorStop(1, '#f39a1e');
  g.fillStyle = fg; g.fill(); g.lineWidth = 1.7; g.strokeStyle = k.line; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.7)'; ell(g, -11, -69, 3.4, 1.1, -0.8); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.28)'; ell(g, 13, -70, 5, 2.4, 0.9); g.fill();
}

const SPECS: Record<Shape, Spec> = {
  disc: {
    cy: -47, top: -73, bottom: -21, hipX: 10, hipY: -22, armB: [-33, -44], armF: [33, -42],
    face: { x: 5, y: -49, gap: 16, k: 1.05 }, hat: { x: 0, y: -72, w: 50, rot: 0 },
    slide: { mode: 'squash', sx: 0.95, sy: 0.64, lean: -0.2, rot: 0, cx: 0, face: { x: 13, y: -17, gap: 15, k: 0.92 }, arm: [-8, -28], feet: [-36, -2], hat: { x: 6, y: -34, w: 40, rot: 0.12 } },
    body: bodyDisc,
  },
  fish: {
    cy: -45, top: -86, bottom: -17, hipX: 8, hipY: -19, armB: [-12, -31], armF: [9, -30], fins: true,
    face: { x: 12, y: -50, gap: 13.5, k: 0.95 }, hat: { x: 4, y: -73, w: 36, rot: 0.08 },
    slide: { mode: 'squash', sx: 1.0, sy: 0.55, lean: -0.05, rot: 0.04, cx: 0, face: { x: 16, y: -16, gap: 13, k: 0.85 }, arm: [-4, -16], feet: [-40, -2], hat: { x: 8, y: -32, w: 32, rot: 0.1 } },
    body: bodyFish, behind: fishTail,
  },
  skewer: {
    cy: -50, top: -86, bottom: -15, hipX: 8, hipY: -18, armB: [-21, -47], armF: [21, -46],
    face: { x: 4, y: -71.5, gap: 15, k: 0.95 }, hat: { x: 0, y: -86, w: 44, rot: 0 },
    slide: { mode: 'lie', sx: 0.7, sy: 0.84, lean: 0, rot: 0, cx: -2, face: { x: 15, y: -18, gap: 13, k: 0.82 }, arm: [-10, -30], feet: [-40, -2], hat: { x: 14, y: -35, w: 34, rot: 0.1 } },
    body: bodySkewer,
  },
  fishcake: {
    cy: -52, top: -88, bottom: -15, hipX: 8, hipY: -18, armB: [-24, -50], armF: [23, -50],
    face: { x: 3, y: -74, gap: 15, k: 0.95 }, hat: { x: 1, y: -88, w: 44, rot: 0 },
    slide: { mode: 'lie', sx: 0.7, sy: 0.86, lean: 0, rot: 0, cx: -2, face: { x: 15, y: -18, gap: 13, k: 0.82 }, arm: [-10, -30], feet: [-40, -2], hat: { x: 14, y: -35, w: 34, rot: 0.1 } },
    body: bodyFishcake,
    front: (c, _k, p) => steamWisps(c, 1, -94, 3, p.t, 0.55, '255,255,255', 0.6),
  },
  star: {
    cy: -48, top: -78, bottom: -18, hipX: 8, hipY: -20, armB: [-28, -43], armF: [28, -41],
    face: { x: 4, y: -47, gap: 15, k: 1 }, hat: { x: 0, y: -78, w: 40, rot: 0 },
    slide: { mode: 'squash', sx: 1.06, sy: 0.57, lean: -0.2, rot: 0, cx: 0, face: { x: 13, y: -17, gap: 14, k: 0.9 }, arm: [-8, -28], feet: [-36, -2], hat: { x: 6, y: -34, w: 36, rot: 0.12 } },
    body: bodyStar, front: starTwinkle,
  },
  potato: {
    cy: -50, top: -88, bottom: -13, hipX: 8, hipY: -16, armB: [-24, -42], armF: [24, -40],
    face: { x: 5, y: -51, gap: 15, k: 1 }, hat: { x: 1, y: -86, w: 30, rot: 0 },
    slide: { mode: 'lie', sx: 0.68, sy: 0.86, lean: 0, rot: 0, cx: -2, face: { x: 16, y: -18, gap: 13, k: 0.84 }, arm: [-10, -30], feet: [-40, -2], hat: { x: 14, y: -35, w: 30, rot: 0.1 } },
    body: bodyPotato,
    front: (c, _k, p) => steamWisps(c, -10, -80, 2, p.t, 0.7, '255,236,200', 0.55),
  },
};

// debug / tooling hook (scripts/preview-chars.mjs renders a contact sheet through it)
if (typeof window !== 'undefined') (window as any).__drawCharacter = drawCharacter;
if (typeof window !== 'undefined') (window as any).__drawHat = drawHat;
