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
//  - HAT_IDS / HatId / hatIdOf                 — the 12 cosmetic hats (COSMETICS id minus 'hat_'), see HATS below.
//  - headTop(shape)                            — where the hat sits (UI close-ups).
//  - drawCompanion (re-exported from ./companions).
// Hats: the static part of every hat is cached like the body (hat × head width × resolution bucket); only
// fluttering ties / tassels / a twinkle are live (≤ 3 paths). Every hat sits on the crown of the head and stays
// above the eyes (each head spot carries its own `brow` limit and the head's curvature `sag`).

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

export type HatId = 'gat' | 'bokgeon' | 'band' | 'jokduri' | 'jobawi' | 'flowerpin' | 'beanie' | 'pouch' | 'horns' | 'satgat' | 'crown' | 'laurel';
export const HAT_IDS: HatId[] = ['gat', 'bokgeon', 'band', 'jokduri', 'jobawi', 'flowerpin', 'beanie', 'pouch', 'horns', 'satgat', 'crown', 'laurel'];
/** 'hat_gat' (a COSMETICS id) or 'gat' → 'gat'; anything else → null */
export function hatIdOf(id: string | null | undefined): HatId | null {
  const h = (id ?? '').replace(/^hat_/, '') as HatId;
  return HAT_IDS.includes(h) ? h : null;
}

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
  sp.behind?.(c, k, p);
  limb(c, k, sp, sp.armB[0], sp.armB[1], ab);
  blitBody(c, shape, sp, pal, tint, res);
  if (!dead) sp.front?.(c, k, p);
  limb(c, k, sp, sp.armF[0], sp.armF[1], af);
  const m = moodFor(p);
  face(c, sp.face, k, m[0], m[1], m[2], m[3], p.t);
  if (hat) { c.save(); c.translate(sp.hat.x, sp.hat.y); c.rotate(sp.hat.rot); hatArt(c, hat, sp.hat, p.t, res); c.restore(); }
  if (p.state === 'air2') swoosh(c, sp, p.spin);
  if (dead) dizzy(c, sp, p.t);
  c.restore();
}

/** Draw a cosmetic hat on a runner drawn with the same transform and pose — equivalent to drawCharacter's 5th
 *  argument; use it when the hat must go on another layer. */
export function drawHat(c: Ctx, hatId: HatId, shape: Shape, p: Pose): void {
  const sp = SPECS[shape] ?? SPECS.disc;
  c.save();
  c.globalAlpha *= p.alpha; c.lineCap = 'round'; c.lineJoin = 'round';
  const sq = p.squash > 0 ? p.squash : 1;
  c.scale(sq, 1 / sq);
  const res = resFor(c);
  if (p.state === 'slide') { const h = sp.slide.hat; c.translate(h.x, h.y); c.rotate(h.rot); hatArt(c, hatId, h, p.t, res); }
  else {
    const bob = p.state === 'run' ? Math.abs(Math.sin(TAU * p.runPhase)) * 2.6 : 0;
    enterBody(c, sp, p, bob); c.translate(sp.hat.x, sp.hat.y); c.rotate(sp.hat.rot); hatArt(c, hatId, sp.hat, p.t, res);
  }
  c.restore();
}

// ------------------------------------------------------------------ shared helpers (exported ones are used elsewhere)

export function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
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
    case 'jump': return fins ? [2.2, -1.45] : [2.5, -2.55];
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
  if (hat) { c.save(); c.translate(S.hat.x, S.hat.y); c.rotate(S.hat.rot); hatArt(c, hat, S.hat, t, res); c.restore(); }
}

// ------------------------------------------------------------------ hats (cosmetics; origin = top-centre of the head)
//
// A HatSpot says where the crown of the head is (x, y, rot in the body frame), how wide it is (w) and how far the
// head surface drops at x = ±w/2 (sag — bands and brims hug it with a parabola). The eyes start 5.5–25 px below (
// nothing may hang lower than ≈ 5 px across the face — 꼬치 / 어묵이 have the shortest foreheads — so ties and
// tassels hang at the back, x < −w/2 · 0.8; scripts/preview-chars.mjs checks that no hat pixel lands on an eye).
// Shapes are sized by w (widths) and s = w/44 clamped (heights, ornaments) so a narrow head gets a smaller hat.

export interface HatSpot { x: number; y: number; w: number; rot: number; sag: number }
interface HatDef {
  art(g: Ctx, h: HatSpot): void;                              // static, cached per hat × spot × resolution
  under?(c: Ctx, h: HatSpot, t: number): void;                // live, under the cached art (ties, tassels)
  over?(c: Ctx, h: HatSpot, t: number): void;                 // live, over it (twinkles, dangles)
}
const HAT_INK = '#231527';
const hatS = (w: number): number => Math.max(0.8, Math.min(1.15, w / 44));
/** y of the head surface at x (0 at the crown, h.sag at x = ±w/2) */
const hy = (h: HatSpot, x: number): number => h.sag * (2 * x / h.w) * (2 * x / h.w);
/** a strip that hugs the head: top edge = surface + top, bottom edge = surface + bot (exact parabola segments) */
function hugPath(g: Ctx, h: HatSpot, x0: number, x1: number, top: number, bot: number): void {
  const a = h.sag * 4 / (h.w * h.w), m = (x0 + x1) / 2, cy = a * x0 * x1;
  g.beginPath(); g.moveTo(x0, a * x0 * x0 + top); g.quadraticCurveTo(m, cy + top, x1, a * x1 * x1 + top);
  g.lineTo(x1, a * x1 * x1 + bot); g.quadraticCurveTo(m, cy + bot, x0, a * x0 * x0 + bot); g.closePath();
}
function fillStroke(g: Ctx, fill: string, lw = 1.6, ink = HAT_INK): void { g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = ink; g.stroke(); }
/** fluttering tails hanging back from (x, y): ink-outlined ribbons */
function tails(c: Ctx, x: number, y: number, len: number, col: string, t: number, lw = 3, speed = 10): void {
  const fl = Math.sin(t * speed) * 2.2, fl2 = Math.sin(t * speed + 1.3) * 2.2;
  c.beginPath();
  c.moveTo(x, y); c.quadraticCurveTo(x - len * 0.5, y - 1 + fl, x - len, y + 2 - fl);
  c.moveTo(x, y + 1); c.quadraticCurveTo(x - len * 0.45, y + 6 - fl2, x - len * 0.85, y + 9 + fl2);
  c.strokeStyle = HAT_INK; c.lineWidth = lw + 2; c.stroke(); c.strokeStyle = col; c.lineWidth = lw; c.stroke();
}

const HATS: Record<HatId, HatDef> = {
  // 갓: translucent horsehair brim, tall black crown, amber bead strap hanging at the back
  gat: {
    art(g, h) {
      const w = h.w, s = hatS(w);
      g.beginPath(); for (let i = 0; i < 5; i++) circSub(g, -w * 0.36 - i * 0.9, 4 + i * 3.6 * s, 1.7);
      fillStroke(g, '#e9b44c', 1);
      ell(g, 0, 1, w * 0.8, 3.9 * s); fillStroke(g, 'rgba(28,20,36,0.7)', 1.6);
      g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 1; ell(g, 0, 1, w * 0.56, 2.5 * s); g.stroke();
      g.beginPath(); g.moveTo(-w * 0.24, 1); g.lineTo(-w * 0.21, -15 * s); g.quadraticCurveTo(0, -20 * s, w * 0.21, -15 * s); g.lineTo(w * 0.24, 1); g.closePath();
      fillStroke(g, '#1d1726');
      g.fillStyle = '#433853'; g.beginPath(); g.moveTo(-w * 0.235, -3.8 * s); g.lineTo(w * 0.235, -3.8 * s); g.lineTo(w * 0.24, 0.4); g.lineTo(-w * 0.24, 0.4); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.24)'; g.fillRect(-w * 0.15, -13 * s, 2.2, 8 * s);
    },
  },
  // 복건: soft navy scholar's cap with a back flap and two ties
  bokgeon: {
    art(g, h) {
      const w = h.w, s = hatS(w);
      g.beginPath(); g.moveTo(-w * 0.5, 2); g.quadraticCurveTo(-w * 0.68, 10 * s, -w * 0.58, 20 * s); g.lineTo(-w * 0.4, 12 * s); g.closePath();
      fillStroke(g, '#2a2544');
      g.beginPath(); g.moveTo(-w * 0.53, hy(h, -w * 0.5) + 2); g.quadraticCurveTo(-w * 0.6, -14 * s, 0, -15 * s); g.quadraticCurveTo(w * 0.5, -13 * s, w * 0.5, hy(h, w * 0.5) + 1);
      g.quadraticCurveTo(0, -1, -w * 0.53, hy(h, -w * 0.5) + 2); g.closePath();
      fillStroke(g, '#2f2a52');
      g.strokeStyle = 'rgba(160,170,255,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-w * 0.12, -14 * s); g.quadraticCurveTo(-w * 0.02, -6 * s, -w * 0.06, 0); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-w * 0.3, -9 * s); g.quadraticCurveTo(-w * 0.1, -13 * s, w * 0.12, -12 * s); g.stroke();
    },
    under(c, h, t) { tails(c, -h.w * 0.44, hy(h, -h.w * 0.44) + 4, h.w * 0.44, '#2f2a52', t, 2.4, 9); },
  },
  // 머리띠: red headband hugging the head, white badge in front, knot + fluttering tails at the back
  band: {
    art(g, h) {
      const w = h.w, u = w / 2, s = hatS(w);
      hugPath(g, h, -u * 1.02, u * 1.04, -1.6, 3.9); fillStroke(g, '#e63946');
      hugPath(g, h, u * 0.05, u * 0.5, -0.1, 2.4); g.fillStyle = '#fff4e6'; g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; hugPath(g, h, -u * 0.8, u * 0.9, -0.6, 0.5); g.fill();
      ell(g, -u, hy(h, -u) + 1.6, 3.2 * s, 3.8 * s); fillStroke(g, '#e63946', 1.4);
    },
    under(c, h, t) { const u = h.w / 2; tails(c, -u, hy(h, -u) + 1.6, h.w * 0.42, '#e63946', t); },
  },
  // 족두리: small purple bridal coronet with gold rims, coral + jade beads on top and two swinging bead drops
  jokduri: {
    art(g, h) {
      const s = hatS(h.w), b0 = 10.5 * s, b1 = 13.8 * s, H = 11 * s;
      g.lineWidth = 1.4; g.strokeStyle = '#d9a93a';
      g.beginPath(); g.moveTo(0, -H - 1); g.lineTo(0, -H - 5 * s); g.moveTo(-5 * s, -H); g.lineTo(-8 * s, -H - 3.4 * s); g.moveTo(5 * s, -H); g.lineTo(8 * s, -H - 3.4 * s); g.stroke();
      g.beginPath(); g.moveTo(-b0, 2); g.lineTo(-b1, -H + 2); g.quadraticCurveTo(0, -H - 2.5 * s, b1, -H + 2); g.lineTo(b0, 2); g.quadraticCurveTo(0, 3.4, -b0, 2); g.closePath();
      fillStroke(g, '#7a3fa0');
      g.strokeStyle = '#4e2270'; g.lineWidth = 1.3; g.beginPath();
      g.moveTo(-3.6 * s, 2.6); g.lineTo(-4.4 * s, -H + 0.6); g.moveTo(3.6 * s, 2.6); g.lineTo(4.4 * s, -H + 0.6); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.moveTo(-b1 + 2, -H + 3); g.lineTo(-b0 + 1.6, 0); g.lineTo(-5.5 * s, 0.6); g.lineTo(-6.2 * s, -H + 1.8); g.closePath(); g.fill();
      g.strokeStyle = '#f0c14b'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-b0 + 0.6, 1.2); g.quadraticCurveTo(0, 2.6, b0 - 0.6, 1.2); g.stroke();
      g.lineWidth = 1.8; g.beginPath(); g.moveTo(-b1 + 1, -H + 1.6); g.quadraticCurveTo(0, -H - 1.6 * s, b1 - 1, -H + 1.6); g.stroke();
      g.beginPath(); circSub(g, -8.2 * s, -H - 3.8 * s, 2.1 * s); circSub(g, 8.2 * s, -H - 3.8 * s, 2.1 * s); fillStroke(g, '#4fc4a0', 1.1);
      g.beginPath(); circSub(g, 0, -H - 5.8 * s, 2.9 * s); fillStroke(g, '#ff5a5f', 1.1);
      g.fillStyle = '#fff'; g.beginPath(); circSub(g, -0.9 * s, -H - 6.8 * s, 0.9 * s); circSub(g, -3.4 * s, -H - 1.2 * s, 1.2 * s); circSub(g, 3.4 * s, -H - 1.2 * s, 1.2 * s); g.fill();
    },
    over(c, h, t) {
      const s = hatS(h.w), b1 = 13.8 * s, H = 11 * s;
      c.strokeStyle = '#d9a93a'; c.lineWidth = 1.1; c.beginPath();
      for (let i = 0; i < 2; i++) {
        const x = (i ? 1 : -1) * (b1 - 0.5), a = Math.sin(t * 5 + i * 1.7) * 0.28 + (i ? -0.1 : 0.1), L = 5.5 * s;
        c.moveTo(x, -H + 2); c.lineTo(x + Math.sin(a) * L, -H + 2 + Math.cos(a) * L);
        BEAD[i * 2] = x + Math.sin(a) * (L + 1.4 * s); BEAD[i * 2 + 1] = -H + 2 + Math.cos(a) * (L + 1.4 * s);
      }
      c.stroke();
      c.beginPath(); circSub(c, BEAD[0], BEAD[1], 1.7 * s); circSub(c, BEAD[2], BEAD[3], 1.7 * s); fillStroke(c, '#ff8fb1', 1);
    },
  },
  // 조바위: burgundy winter cap open at the top, dark trim, pearl string over the top, jade ornament, pink tassel
  jobawi: {
    art(g, h) {
      const w = h.w, u = w / 2, s = hatS(w), top = -10.5 * s;
      const yb = hy(h, -u) + 2, yf = hy(h, u * 0.95) + 2.2;
      g.beginPath();
      g.moveTo(u * 0.95, yf);
      g.bezierCurveTo(u * 1.02, top * 0.55, u * 0.62, top, u * 0.3, top);
      g.lineTo(-u * 0.3, top);
      g.bezierCurveTo(-u * 0.7, top, -u * 1.08, top * 0.5, -u * 1.02, yb);
      g.quadraticCurveTo(-u * 1.14, yb + 7 * s, -u * 1.02, yb + 12 * s);
      g.quadraticCurveTo(-u * 0.82, yb + 7 * s, -u * 0.62, hy(h, -u * 0.62) + 3);
      g.quadraticCurveTo(u * 0.165, -h.sag * 0.589 + 2.6, u * 0.95, yf);
      g.closePath(); fillStroke(g, '#8a2f4a');
      g.save(); g.clip();
      g.strokeStyle = '#3c1424'; g.lineWidth = 3.2; hugPath(g, h, -u * 0.62, u * 0.95, 3, 3); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-u * 0.55, top + 2); g.quadraticCurveTo(-u * 0.75, -2 * s, -u * 0.72, 4 * s); g.moveTo(u * 0.4, top + 2); g.quadraticCurveTo(u * 0.66, -3 * s, u * 0.7, 2 * s); g.stroke();
      g.restore();
      ell(g, 0, top + 0.3, u * 0.34, 1.9 * s); fillStroke(g, '#4a1426', 1.2);
      g.strokeStyle = '#f0c14b'; g.lineWidth = 1.2; ell(g, 0, top + 0.3, u * 0.34, 1.9 * s); g.stroke();
      // pearl string arcing over the top, front ornament → back ornament
      const ax = u * 0.62, ay = -2.6 * s, bx = -u * 0.66, by = -1.8 * s, cx = 0, cy = top - 7 * s;
      g.beginPath(); for (let i = 0; i <= 8; i++) { const k = i / 8, a = (1 - k) * (1 - k), b = 2 * k * (1 - k), d = k * k; circSub(g, a * ax + b * cx + d * bx, a * ay + b * cy + d * by, 1.25 * s); }
      fillStroke(g, '#fffaf0', 0.9);
      g.beginPath(); circSub(g, ax, ay, 2.7 * s); fillStroke(g, '#5fd0ae', 1.2);
      g.beginPath(); circSub(g, bx, by, 2.2 * s); fillStroke(g, '#f0c14b', 1.1);
      g.fillStyle = '#fff'; g.beginPath(); circSub(g, ax - 0.8 * s, ay - 0.9 * s, 0.8 * s); g.fill();
    },
    under(c, h, t) {
      const u = h.w / 2, s = hatS(h.w), x = -u * 1.02, y = hy(h, -u) + 2 + 12 * s, a = Math.sin(t * 5) * 0.22 + 0.15;
      c.save(); c.translate(x, y); c.rotate(a);
      c.beginPath(); c.moveTo(0, -1); c.lineTo(0, 3.5 * s); c.strokeStyle = '#c0283c'; c.lineWidth = 1.6; c.stroke();
      c.beginPath(); circSub(c, 0, 3.8 * s, 1.9 * s); fillStroke(c, '#e63950', 1);
      c.beginPath(); c.moveTo(-1.6 * s, 5 * s); c.lineTo(-3 * s, 12 * s); c.quadraticCurveTo(0, 13.4 * s, 3 * s, 12 * s); c.lineTo(1.6 * s, 5 * s); c.closePath(); fillStroke(c, '#ff6f9a', 1.1);
      c.restore();
    },
  },
  // 꽃핀: a pink five-petal flower with a yellow heart and leaves, pinned on the front-top of the head
  flowerpin: {
    art(g, h) {
      const w = h.w, s = hatS(w), fx = w * 0.14, fy = hy(h, fx) - 4.4 * s;
      g.beginPath(); g.moveTo(fx - 2 * s, fy + 2 * s); g.lineTo(fx - 13 * s, fy + 3.2 * s + (hy(h, fx - 13 * s) - hy(h, fx)));
      g.strokeStyle = HAT_INK; g.lineWidth = 3.4; g.stroke(); g.strokeStyle = '#f0c14b'; g.lineWidth = 1.8; g.stroke();
      g.beginPath(); ellSub(g, fx - 7.4 * s, fy - 1 * s, 4.2 * s, 2 * s, -0.5); ellSub(g, fx - 6.4 * s, fy + 3.8 * s, 3.8 * s, 1.9 * s, 0.45);
      fillStroke(g, '#5fae4f', 1.2);
      g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; circSub(g, fx + Math.cos(a) * 4.4 * s, fy + Math.sin(a) * 4.4 * s, 4.2 * s); }
      fillStroke(g, '#ff86ab', 1.5);
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5 - 0.35; ellSub(g, fx + Math.cos(a) * 5.4 * s, fy + Math.sin(a) * 5.4 * s, 1.6 * s, 1 * s, a); } g.fill();
      g.beginPath(); circSub(g, fx, fy, 2.5 * s); fillStroke(g, '#ffd84a', 1.1);
    },
  },
  // 털모자: cream knitted beanie, red stripes, ribbed cuff hugging the head, red pompom
  beanie: {
    art(g, h) {
      const w = h.w, u = w / 2, s = hatS(w), top = -15 * s, ct = -3.6 * s;
      const dome = (): void => {
        g.beginPath(); g.moveTo(-u * 0.98, hy(h, -u * 0.98) + ct);
        g.bezierCurveTo(-u * 0.98, top * 0.75, -u * 0.46, top, 0, top); g.bezierCurveTo(u * 0.46, top, u * 0.98, top * 0.75, u * 0.98, hy(h, u * 0.98) + ct);
        g.lineTo(-u * 0.98, hy(h, -u * 0.98) + ct); g.closePath();
      };
      g.beginPath(); circSub(g, u * 0.06, top - 3.4 * s, 5 * s); fillStroke(g, '#e2543f', 1.4);
      g.strokeStyle = 'rgba(120,20,20,0.45)'; g.lineWidth = 1; g.beginPath();
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.3, r = 5 * s; g.moveTo(u * 0.06 + Math.cos(a) * r * 0.45, top - 3.4 * s + Math.sin(a) * r * 0.45); g.lineTo(u * 0.06 + Math.cos(a) * r * 0.85, top - 3.4 * s + Math.sin(a) * r * 0.85); }
      g.stroke();
      dome(); g.fillStyle = '#f1ead6'; g.fill();
      g.save(); dome(); g.clip();
      g.strokeStyle = '#e2543f'; g.lineWidth = 2.6 * s; g.beginPath(); g.moveTo(-u, -6.8 * s); g.quadraticCurveTo(0, -9.8 * s, u, -6.8 * s); g.moveTo(-u, -11 * s); g.quadraticCurveTo(0, -14 * s, u, -11 * s); g.stroke();
      g.fillStyle = 'rgba(160,140,110,0.22)'; g.fillRect(u * 0.35, top, u, 20 * s);
      g.restore();
      dome(); g.lineWidth = 1.6; g.strokeStyle = HAT_INK; g.stroke();
      hugPath(g, h, -u * 1.04, u * 1.04, ct, 3.2); fillStroke(g, '#e6dcc2');
      g.save(); hugPath(g, h, -u * 1.04, u * 1.04, ct, 3.2); g.clip();
      g.strokeStyle = 'rgba(110,90,60,0.35)'; g.lineWidth = 1; g.beginPath();
      for (let i = -5; i <= 5; i++) { const x = i * u / 5.2; g.moveTo(x, hy(h, x) + ct); g.lineTo(x, hy(h, x) + 3.2); }
      g.stroke(); g.restore();
    },
  },
  // 복주머니 모자: a golden lucky pouch perched on the head — gathered neck, red cord, frilled top, red medallion
  pouch: {
    art(g, h) {
      const w = h.w, s = hatS(w), B = Math.max(0.32 * w, 12 * s), nk = -11.5 * s;
      g.beginPath(); g.moveTo(-0.42 * B, nk); g.lineTo(-0.8 * B, nk - 5.4 * s);
      for (let i = 0; i < 4; i++) { const x0 = -0.8 * B + i * 0.4 * B, x1 = x0 + 0.4 * B; g.quadraticCurveTo((x0 + x1) / 2, nk - 8.2 * s, x1, nk - 5.4 * s); }
      g.lineTo(0.42 * B, nk); g.closePath(); fillStroke(g, '#f3cf5f');
      g.strokeStyle = 'rgba(150,100,20,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-0.2 * B, nk); g.lineTo(-0.36 * B, nk - 5 * s); g.moveTo(0.18 * B, nk); g.lineTo(0.3 * B, nk - 5.2 * s); g.stroke();
      const body = (): void => {
        const a = h.sag * 4 / (w * w);
        g.beginPath(); g.moveTo(-B * 0.95, hy(h, -B * 0.95) + 1.8);
        g.bezierCurveTo(-B * 1.16, -5 * s, -B * 0.72, nk + 0.5, -B * 0.4, nk);
        g.lineTo(B * 0.4, nk);
        g.bezierCurveTo(B * 0.72, nk + 0.5, B * 1.16, -5 * s, B * 0.95, hy(h, B * 0.95) + 1.8);
        g.quadraticCurveTo(0, -a * B * B * 0.9 + 1.8, -B * 0.95, hy(h, -B * 0.95) + 1.8); g.closePath();
      };
      body(); g.fillStyle = '#e8b83e'; g.fill();
      g.save(); body(); g.clip();
      g.fillStyle = 'rgba(170,100,10,0.3)'; ell(g, B * 0.95, 0, B * 0.55, 12 * s); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.4)'; ell(g, -B * 0.45, -6.5 * s, B * 0.22, 2.2 * s, -0.5); g.fill();
      g.strokeStyle = 'rgba(150,95,15,0.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-B * 0.25, nk + 1); g.quadraticCurveTo(-B * 0.5, -4 * s, -B * 0.55, 1); g.moveTo(B * 0.3, nk + 1); g.quadraticCurveTo(B * 0.55, -5 * s, B * 0.62, 0); g.stroke();
      g.restore();
      body(); g.lineWidth = 1.6; g.strokeStyle = HAT_INK; g.stroke();
      g.beginPath(); circSub(g, B * 0.06, -4.6 * s, 3.6 * s); fillStroke(g, '#d9343f', 1.2);
      g.strokeStyle = '#ffd86a'; g.lineWidth = 1.1; g.beginPath(); circSub(g, B * 0.06, -4.6 * s, 1.9 * s);
      g.moveTo(B * 0.06 - 1.9 * s, -4.6 * s); g.lineTo(B * 0.06 + 1.9 * s, -4.6 * s); g.stroke();
      g.beginPath(); rrSub(g, -0.5 * B, nk - 1.7 * s, B, 3.2 * s, 1.6 * s); fillStroke(g, '#d9343f', 1.2);
      g.beginPath(); circSub(g, -0.52 * B, nk, 2.2 * s); fillStroke(g, '#e63950', 1.1);
    },
    under(c, h, t) { const B = Math.max(0.32 * h.w, 12 * hatS(h.w)), s = hatS(h.w); tails(c, -0.52 * B, -11.5 * s, 9 * s, '#e63950', t, 1.8, 7); },
  },
  // 도깨비 뿔: two little striped yellow horns with orange tips
  horns: {
    art(g, h) {
      const w = h.w, s = hatS(w);
      for (const [bx, H, hw, lean] of [[-w * 0.25, 12 * s, 4 * s, -3.4 * s], [w * 0.2, 13.8 * s, 4.5 * s, 3 * s]]) {
        const by = hy(h, bx) + 2.6;
        const path = (): void => {
          g.beginPath(); g.moveTo(bx - hw, by);
          g.quadraticCurveTo(bx - hw * 0.7 + lean * 0.1, by - H * 0.62, bx + lean, by - H);
          g.quadraticCurveTo(bx + hw * 0.75 + lean * 0.45, by - H * 0.5, bx + hw, by);
          g.quadraticCurveTo(bx, by + 1.4, bx - hw, by); g.closePath();
        };
        path(); g.fillStyle = '#f2c14e'; g.fill();
        g.save(); path(); g.clip();
        g.fillStyle = '#e8622c'; g.fillRect(bx - hw - 4, by - H - 4, hw * 2 + 8, H * 0.42 + 4);
        g.strokeStyle = '#b8741c'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx - hw, by - H * 0.22); g.lineTo(bx + hw, by - H * 0.16); g.moveTo(bx - hw, by - H * 0.44); g.lineTo(bx + hw, by - H * 0.38); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(bx - hw * 0.55, by - H * 0.62, 1.4, H * 0.5);
        g.restore();
        path(); g.lineWidth = 1.9; g.strokeStyle = HAT_INK; g.stroke();
      }
    },
  },
  // 삿갓: wide conical bamboo hat — woven rays, rings, a knob on top
  satgat: {
    art(g, h) {
      const w = h.w, s = hatS(w), rx = w * 0.8 + 3, ry = 3.4 * s, cy = 1.6, ay = -14 * s;
      ell(g, 0, cy, rx, ry); fillStroke(g, '#8e6a33');
      const cone = (): void => {
        g.beginPath(); g.moveTo(-rx, cy); g.quadraticCurveTo(-rx * 0.42, ay * 0.45, -1.4, ay); g.lineTo(1.4, ay);
        g.quadraticCurveTo(rx * 0.42, ay * 0.45, rx, cy); g.ellipse(0, cy, rx, ry, 0, 0, Math.PI); g.closePath();
      };
      cone(); g.fillStyle = '#dcb86e'; g.fill();
      g.save(); cone(); g.clip();
      g.fillStyle = 'rgba(140,90,30,0.28)'; g.beginPath(); g.moveTo(1, ay - 2); g.lineTo(rx + 2, cy - 2); g.lineTo(rx + 2, cy + ry + 2); g.lineTo(0, cy + ry + 2); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(120,78,28,0.5)'; g.lineWidth = 1; g.beginPath();
      for (let i = 1; i < 8; i++) { const a = i / 8 * Math.PI; g.moveTo(0, ay); g.lineTo(Math.cos(a) * rx, cy + Math.sin(a) * ry); }
      g.stroke();
      g.strokeStyle = 'rgba(150,100,40,0.8)'; g.lineWidth = 1.3; g.beginPath();
      for (const k of [0.42, 0.72]) { const x = rx * k, y = ay + (cy - ay) * k; g.moveTo(-x, y); g.quadraticCurveTo(0, y + ry * k * 2, x, y); }
      g.stroke();
      g.strokeStyle = 'rgba(255,245,210,0.55)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-2, ay + 3); g.quadraticCurveTo(-rx * 0.3, ay * 0.4, -rx * 0.62, cy - 1); g.stroke();
      g.restore();
      cone(); g.lineWidth = 1.6; g.strokeStyle = HAT_INK; g.stroke();
      g.beginPath(); circSub(g, 0, ay - 0.6, 1.9 * s); fillStroke(g, '#8e6a33', 1.2);
    },
  },
  // 왕관: gold crown with five pearl-tipped points, a gem band, and a twinkle
  crown: {
    art(g, h) {
      const s = hatS(h.w), cw = Math.max(0.34 * h.w, 12.5 * s), H = 11.5 * s;
      const tips: [number, number][] = [[-cw * 1.06, -H * 0.72], [-cw * 0.52, -H * 0.95], [0, -H * 1.14], [cw * 0.52, -H * 0.95], [cw * 1.06, -H * 0.72]];
      const vals: [number, number][] = [[-cw * 0.76, -H * 0.3], [-cw * 0.26, -H * 0.42], [cw * 0.26, -H * 0.42], [cw * 0.76, -H * 0.3]];
      const shape = (): void => {
        g.beginPath(); g.moveTo(-cw, hy(h, -cw) + 2.6); g.lineTo(tips[0][0], tips[0][1]);
        for (let i = 0; i < 4; i++) { g.lineTo(vals[i][0], vals[i][1]); g.lineTo(tips[i + 1][0], tips[i + 1][1]); }
        g.lineTo(cw, hy(h, cw) + 2.6); g.quadraticCurveTo(0, -hy(h, cw) + 2.6, -cw, hy(h, -cw) + 2.6); g.closePath();
      };
      shape(); g.fillStyle = '#ffd24a'; g.fill();
      g.save(); shape(); g.clip();
      g.fillStyle = 'rgba(214,120,10,0.3)'; g.fillRect(cw * 0.25, -H * 1.4, cw, H * 2);
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.moveTo(-cw * 0.8, -H * 0.2); g.lineTo(-cw * 0.52, -H * 0.8); g.lineTo(-cw * 0.4, -H * 0.3); g.closePath(); g.fill();
      g.restore();
      shape(); g.lineWidth = 1.6; g.strokeStyle = HAT_INK; g.stroke();
      hugPath(g, h, -cw * 1.02, cw * 1.02, -2.4 * s, 2.6); fillStroke(g, '#f0ae2a', 1.2);
      g.beginPath(); ellSub(g, cw * 0.08, hy(h, cw * 0.08) - 0.1 * s, 2.6 * s, 2.1 * s); fillStroke(g, '#e63946', 1);
      g.beginPath(); circSub(g, -cw * 0.6, hy(h, -cw * 0.6) + 0.1, 1.5 * s); circSub(g, cw * 0.72, hy(h, cw * 0.72) + 0.1, 1.5 * s); fillStroke(g, '#4aa3ff', 0.9);
      g.beginPath(); for (const [x, y] of tips) circSub(g, x, y, 1.9 * s); fillStroke(g, '#fff3b0', 1.1);
      g.fillStyle = '#fff'; g.beginPath(); circSub(g, cw * 0.02, hy(h, cw * 0.08) - 1 * s, 0.8 * s); g.fill();
    },
    over(c, h, t) {
      const ph = (t + 0.9) % 2.4; if (ph > 0.45) return;
      const s = hatS(h.w), cw = Math.max(0.34 * h.w, 12.5 * s), a = Math.sin(ph / 0.45 * Math.PI);
      c.fillStyle = `rgba(255,255,235,${(a * 0.95).toFixed(3)})`; c.beginPath(); sparkSub(c, cw * 0.62, -11.5 * s * 1.1, 1.6 + a * 2.8); c.fill();
    },
  },
  // 월계관: a green laurel wreath around the head, two rows of leaves pointing back, gold bow + tails at the back
  laurel: {
    art(g, h) {
      const w = h.w, u = w / 2, s = hatS(w), a = h.sag * 4 / (w * w), N = 7;
      const rows: [number, string][] = [[-1, '#7cc35a'], [1, '#5a9a3e']];
      g.strokeStyle = '#3d7a2c'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-u * 1.0, hy(h, -u)); g.quadraticCurveTo(-u * 0.14, a * -u * u * 0.72, u * 0.72, hy(h, u * 0.72)); g.stroke();
      for (const [side, col] of rows) {
        g.beginPath();
        for (let i = 0; i < N; i++) {
          const x = -u * 0.9 + (u * 1.58) * (i / (N - 1)), y = hy(h, x), ang = Math.atan(2 * a * x), off = side < 0 ? 2.2 * s : 1.7 * s;
          const cx = x - Math.cos(ang) * 2.2 * s + Math.sin(ang) * side * -off, cy = y - Math.sin(ang) * 2.2 * s + Math.cos(ang) * side * off;
          ellSub(g, cx, cy, 3.9 * s, 1.75 * s, ang + side * 0.5);
        }
        fillStroke(g, col, 1.1);
      }
      g.beginPath(); ellSub(g, u * 0.8, hy(h, u * 0.8) - 1.4, 3.6 * s, 1.6 * s, -0.5); fillStroke(g, '#7cc35a', 1.1);
      const kx = -u * 1.0, ky = hy(h, -u);
      g.beginPath(); ellSub(g, kx - 2.6 * s, ky - 2 * s, 2.6 * s, 1.7 * s, 0.6); ellSub(g, kx - 2.4 * s, ky + 2.2 * s, 2.5 * s, 1.6 * s, -0.6); fillStroke(g, '#f0c14b', 1.1);
      g.beginPath(); circSub(g, kx, ky, 1.7 * s); fillStroke(g, '#e8a92a', 1);
    },
    under(c, h, t) { const u = h.w / 2; tails(c, -u * 1.02, hy(h, -u) + 0.8, h.w * 0.34, '#f0c14b', t, 1.8, 8); },
  },
};
const BEAD = [0, 0, 0, 0];

const hatSprites = new Map<string, HTMLCanvasElement>();
function hatArt(c: Ctx, id: HatId, h: HatSpot, t: number, res: number): void {
  const d = HATS[id]; if (!d) return;
  c.lineCap = 'round'; c.lineJoin = 'round';
  d.under?.(c, h, t);
  // static part: cached (bounds generous enough for every hat: the brim of 갓/삿갓, 복건's flap)
  const x0 = -(h.w * 0.95 + 10), y0 = -34, bw = -2 * x0, bh = 64;
  const key = id + '|' + h.w + '|' + h.sag + '@' + res;
  let cv = hatSprites.get(key);
  if (!cv && typeof document !== 'undefined') {
    const n = document.createElement('canvas'); n.width = Math.ceil(bw * res); n.height = Math.ceil(bh * res);
    const g = n.getContext('2d');
    if (g) {
      g.scale(res, res); g.translate(-x0, -y0); g.lineCap = 'round'; g.lineJoin = 'round';
      d.art(g, h);
      if (hatSprites.size >= 96) hatSprites.delete(hatSprites.keys().next().value as string);   // oldest first
      hatSprites.set(key, n); cv = n;
    }
  }
  if (cv) c.drawImage(cv, x0, y0, bw, bh);
  else { c.save(); d.art(c, h); c.restore(); }
  d.over?.(c, h, t);
}

// ------------------------------------------------------------------ shapes

interface SlideSpec {
  mode: 'squash' | 'lie';
  sx: number; sy: number; lean: number; rot: number; cx: number;   // squash: skew/rotate/scale about the feet; lie: rotate 90° head-first
  face: FaceSpot; arm: [number, number]; feet: [number, number]; hat: HatSpot;
}
interface Spec {
  cy: number; top: number; bottom: number;                     // body centre (flip pivot), top, bottom (y)
  hipX: number; hipY: number;
  armB: [number, number]; armF: [number, number];
  face: FaceSpot;
  hat: HatSpot;
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
    cy: -47, top: -73, bottom: -12, hipX: 10, hipY: -22, armB: [-33, -44], armF: [33, -42],
    face: { x: 5, y: -49, gap: 16, k: 1.05 }, hat: { x: 0, y: -72, w: 50, rot: 0, sag: 7 },
    slide: { mode: 'squash', sx: 0.95, sy: 0.58, lean: -0.2, rot: 0, cx: 0, face: { x: 13, y: -17, gap: 15, k: 0.92 }, arm: [-8, -28], feet: [-36, -2], hat: { x: 6, y: -35, w: 40, rot: 0.12, sag: 4 } },
    body: bodyDisc,
  },
  fish: {
    cy: -45, top: -86, bottom: -17, hipX: 8, hipY: -19, armB: [-12, -31], armF: [9, -30], fins: true,
    face: { x: 12, y: -50, gap: 13.5, k: 0.95 }, hat: { x: 4, y: -73, w: 36, rot: 0.08, sag: 8 },
    slide: { mode: 'squash', sx: 1.0, sy: 0.55, lean: -0.05, rot: 0.04, cx: 0, face: { x: 16, y: -16, gap: 13, k: 0.85 }, arm: [-4, -16], feet: [-40, -2], hat: { x: 8, y: -35, w: 32, rot: 0.1, sag: 5 } },
    body: bodyFish, behind: fishTail,
  },
  skewer: {
    cy: -50, top: -86, bottom: -15, hipX: 8, hipY: -18, armB: [-21, -47], armF: [21, -46],
    face: { x: 4, y: -71.5, gap: 15, k: 0.95 }, hat: { x: 0, y: -87.5, w: 44, rot: 0, sag: 6.5 },
    slide: { mode: 'lie', sx: 0.7, sy: 0.84, lean: 0, rot: 0, cx: -2, face: { x: 15, y: -18, gap: 13, k: 0.82 }, arm: [-10, -30], feet: [-40, -2], hat: { x: 14, y: -35, w: 34, rot: 0.1, sag: 3 } },
    body: bodySkewer,
  },
  fishcake: {
    cy: -52, top: -88, bottom: -15, hipX: 8, hipY: -18, armB: [-24, -50], armF: [23, -50],
    face: { x: 3, y: -74, gap: 15, k: 0.95 }, hat: { x: 1, y: -90, w: 44, rot: 0, sag: 8 },
    slide: { mode: 'lie', sx: 0.7, sy: 0.86, lean: 0, rot: 0, cx: -2, face: { x: 15, y: -18, gap: 13, k: 0.82 }, arm: [-10, -30], feet: [-40, -2], hat: { x: 14, y: -35, w: 34, rot: 0.1, sag: 3 } },
    body: bodyFishcake,
    front: (c, _k, p) => steamWisps(c, 1, -94, 3, p.t, 0.55, '255,255,255', 0.6),
  },
  star: {
    cy: -48, top: -78, bottom: -18, hipX: 8, hipY: -20, armB: [-28, -43], armF: [28, -41],
    face: { x: 4, y: -47, gap: 15, k: 1 }, hat: { x: 0, y: -78, w: 40, rot: 0, sag: 7.5 },
    slide: { mode: 'squash', sx: 1.06, sy: 0.57, lean: -0.2, rot: 0, cx: 0, face: { x: 13, y: -17, gap: 14, k: 0.9 }, arm: [-8, -28], feet: [-36, -2], hat: { x: 6, y: -35.5, w: 36, rot: 0.12, sag: 4 } },
    body: bodyStar, front: starTwinkle,
  },
  potato: {
    cy: -50, top: -88, bottom: -13, hipX: 8, hipY: -16, armB: [-24, -42], armF: [24, -40],
    face: { x: 5, y: -51, gap: 15, k: 1 }, hat: { x: 1, y: -86, w: 30, rot: 0, sag: 7 },
    slide: { mode: 'lie', sx: 0.68, sy: 0.86, lean: 0, rot: 0, cx: -2, face: { x: 16, y: -18, gap: 13, k: 0.84 }, arm: [-10, -30], feet: [-40, -2], hat: { x: 14, y: -35, w: 30, rot: 0.1, sag: 3 } },
    body: bodyPotato,
    front: (c, _k, p) => steamWisps(c, -10, -80, 2, p.t, 0.7, '255,236,200', 0.55),
  },
};

/** where a hat sits on this shape (standing, body frame) — for UI framing, e.g. a head-and-hat close-up */
export function headTop(shape: Shape): { x: number; y: number } { const h = (SPECS[shape] ?? SPECS.disc).hat; return { x: h.x, y: h.y }; }

/** tooling: the two eye ellipses [cx, cy, rx, ry] (open-eye size + outline; body frame, standing = before the pose
 *  transform) — a hat must never paint inside them */
function eyeBox(shape: Shape, slide: boolean): [number, number, number, number][] {
  const sp = SPECS[shape] ?? SPECS.disc, f = slide ? sp.slide.face : sp.face, W = 6 * f.k + 1, H = 7.4 * f.k + 1;
  return [[f.x - f.gap / 2, f.y, W, H], [f.x + f.gap / 2, f.y, W, H]];
}

// debug / tooling hook (scripts/preview-chars.mjs renders a contact sheet through it)
if (typeof window !== 'undefined') { (window as any).__drawCharacter = drawCharacter; (window as any).__charDebug = { eyeBox, HAT_IDS }; }
