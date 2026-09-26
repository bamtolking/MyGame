// Biome backdrops: sky, 4 parallax layers (painted once per biome + size into offscreen canvases ≈1.5× the view
// wide, then tiled), stars / moon / fireworks / birds (a handful of cheap draws per frame), the ground, pits,
// one-way platforms, the finish gate and the bonus-time sky. Presentation only — geometry comes from the sim.
// Per-frame cost target: ≤ ~15 drawImage + ~60 fillRect for the whole background, no shadowBlur / filter.
import { BIOMES, BIOME_ORDER, BIOME_BY_ID, type BiomeDef } from '../data/biomes';
import type { RunState } from '../sim/types';
import { VIEW_H, GROUND_Y, TILE, PLATFORM_THICK } from '../data/physics';
import { rr, drawCharacter } from './characters';
import { CHAR_BY_ID } from '../data/characters';
import { warmFonts } from './fx';

// ================================================================ shared colour / canvas helpers
const rgbCache = new Map<string, readonly [number, number, number]>();
/** '#rgb' / '#rrggbb' / 'rgb(…)' → [r, g, b] (memoised: the painters convert the same palette colours thousands of times) */
export function hexRgb(h: string): readonly [number, number, number] {
  let v = rgbCache.get(h); if (v) return v;
  if (h.startsWith('rgb')) { const m = h.match(/[\d.]+/g)!; v = [+m[0], +m[1], +m[2]]; }
  else { let s = h.slice(1); if (s.length === 3) s = s.split('').map(ch => ch + ch).join(''); const n = parseInt(s, 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  if (rgbCache.size > 512) rgbCache.clear();
  rgbCache.set(h, v); return v;
}
function toHex(c: readonly number[]): string { return '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
/** linear blend of two colours (t = 0 → a, 1 → b) */
export function mix(a: string, b: string, t: number): string { const A = hexRgb(a), B = hexRgb(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); }
export function rgba(a: string, al: number): string { const [r, g, b] = hexRgb(a); return `rgba(${r},${g},${b},${al})`; }
export const lighten = (a: string, t: number): string => mix(a, '#ffffff', t);
export const darken = (a: string, t: number): string => mix(a, '#000000', t);
/** integer → [0, 1) hash (visual only; no allocation, for per-frame use) */
export function hash01(n: number): number { let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; }
/** deterministic visual-only RNG (never the sim's) */
export function srng(seed: number): () => number { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
/** an offscreen canvas `w × h` logical px at `res` device px per logical px; the context is pre-scaled */
export function makeCanvas(w: number, h: number, res: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(w * res)); cv.height = Math.max(1, Math.ceil(h * res));
  const g = cv.getContext('2d')!; g.scale(res, res); return [cv, g];
}
function newCanvas(w: number, h: number): HTMLCanvasElement { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
/** allocate a canvas's pixels now (a canvas gets them on its first draw) */
function touch(cv: HTMLCanvasElement): HTMLCanvasElement { cv.getContext('2d')?.clearRect(0, 0, 1, 1); return cv; }
/** a parallax layer: the top `sh` rows of a (pooled, possibly taller) canvas. The far layers are painted below the
 *  device resolution and were bilinearly upscaled on every frame — on a CPU-rastered canvas the dearest thing a frame
 *  does (≈ 30 ms of 50 at 4× throttle, landscape) — so each also gets `px`: the same upscale done once (at the whole
 *  device px it is always drawn at, so the pixels are the same), blitted 1:1. `ps`: 0 none yet · 1 canvas · 2 drawn ·
 *  3 ready (or not needed). */
interface Layer { cv: HTMLCanvasElement; sh: number; px: HTMLCanvasElement | null; pw: number; ph: number; ps: 0 | 1 | 2 | 3 }
const layerOf = (cv: HTMLCanvasElement, sh: number): Layer => ({ cv, sh, px: null, pw: 0, ph: 0, ps: 0 });
/** a layer being painted ahead of time: its painter's canvas calls are recorded once (one frame), replayed three times
 *  (−W, 0, +W) a time slice per frame, then rasterised in a frame of their own — the painters issue thousands of calls,
 *  12–20 ms at 4× CPU throttle for one copy of the busiest layer */
interface Job { L: Layer; g: CanvasRenderingContext2D; paint: (g: CanvasRenderingContext2D) => void; W: number; ops: unknown[] | null; at: number; flushed: boolean; done: boolean }
let gradCtx: CanvasRenderingContext2D | null = null;
function grads(): CanvasRenderingContext2D { if (!gradCtx) { const cv = document.createElement('canvas'); cv.width = cv.height = 1; gradCtx = cv.getContext('2d')!; } return gradCtx; }
// opcodes of the flat recording (opcode, then its arguments)
const enum O { Save, Restore, Translate, Scale, Rotate, Begin, Close, Move, Line, Quad, Bezier, Arc, ArcTo, Ellipse, Rect, Fill, FillPath, Stroke, Clip, FillRect, StrokeRect, FillText, StrokeText, Dash,
  FillStyle, StrokeStyle, LineWidth, LineCap, LineJoin, Font, TextAlign, TextBaseline, Alpha, MiterLimit, Composite }
/** records the canvas calls of a painter into one flat array (no allocation per call; only what painters use —
 *  gradients are real objects, made on a scratch context) */
class Recorder {
  q: unknown[] = [];
  save(): void { this.q.push(O.Save); }
  restore(): void { this.q.push(O.Restore); }
  translate(x: number, y: number): void { this.q.push(O.Translate, x, y); }
  scale(x: number, y: number): void { this.q.push(O.Scale, x, y); }
  rotate(a: number): void { this.q.push(O.Rotate, a); }
  beginPath(): void { this.q.push(O.Begin); }
  closePath(): void { this.q.push(O.Close); }
  moveTo(x: number, y: number): void { this.q.push(O.Move, x, y); }
  lineTo(x: number, y: number): void { this.q.push(O.Line, x, y); }
  quadraticCurveTo(a: number, b: number, x: number, y: number): void { this.q.push(O.Quad, a, b, x, y); }
  bezierCurveTo(a: number, b: number, c: number, d: number, x: number, y: number): void { this.q.push(O.Bezier, a, b, c, d, x, y); }
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false): void { this.q.push(O.Arc, x, y, r, a0, a1, ccw); }
  arcTo(a: number, b: number, c: number, d: number, r: number): void { this.q.push(O.ArcTo, a, b, c, d, r); }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw = false): void { this.q.push(O.Ellipse, x, y, rx, ry, rot, a0, a1, ccw); }
  rect(x: number, y: number, w: number, h: number): void { this.q.push(O.Rect, x, y, w, h); }
  fill(path?: Path2D): void { if (path) this.q.push(O.FillPath, path); else this.q.push(O.Fill); }
  stroke(): void { this.q.push(O.Stroke); }
  clip(): void { this.q.push(O.Clip); }
  fillRect(x: number, y: number, w: number, h: number): void { this.q.push(O.FillRect, x, y, w, h); }
  strokeRect(x: number, y: number, w: number, h: number): void { this.q.push(O.StrokeRect, x, y, w, h); }
  fillText(t: string, x: number, y: number): void { this.q.push(O.FillText, t, x, y); }
  strokeText(t: string, x: number, y: number): void { this.q.push(O.StrokeText, t, x, y); }
  setLineDash(d: number[]): void { this.q.push(O.Dash, d.slice()); }
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient { return grads().createLinearGradient(x0, y0, x1, y1); }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient { return grads().createRadialGradient(x0, y0, r0, x1, y1, r1); }
  set fillStyle(v: unknown) { this.q.push(O.FillStyle, v); }
  set strokeStyle(v: unknown) { this.q.push(O.StrokeStyle, v); }
  set lineWidth(v: unknown) { this.q.push(O.LineWidth, v); }
  set lineCap(v: unknown) { this.q.push(O.LineCap, v); }
  set lineJoin(v: unknown) { this.q.push(O.LineJoin, v); }
  set font(v: unknown) { this.q.push(O.Font, v); }
  set textAlign(v: unknown) { this.q.push(O.TextAlign, v); }
  set textBaseline(v: unknown) { this.q.push(O.TextBaseline, v); }
  set globalAlpha(v: unknown) { this.q.push(O.Alpha, v); }
  set miterLimit(v: unknown) { this.q.push(O.MiterLimit, v); }
  set globalCompositeOperation(v: unknown) { this.q.push(O.Composite, v); }
}
/** replay the call at q[i] on g; returns the index of the next one */
function play(g: CanvasRenderingContext2D, q: unknown[], i: number): number {
  const n = (k: number) => q[i + k] as number;
  switch (q[i] as O) {
    case O.Save: g.save(); return i + 1;
    case O.Restore: g.restore(); return i + 1;
    case O.Translate: g.translate(n(1), n(2)); return i + 3;
    case O.Scale: g.scale(n(1), n(2)); return i + 3;
    case O.Rotate: g.rotate(n(1)); return i + 2;
    case O.Begin: g.beginPath(); return i + 1;
    case O.Close: g.closePath(); return i + 1;
    case O.Move: g.moveTo(n(1), n(2)); return i + 3;
    case O.Line: g.lineTo(n(1), n(2)); return i + 3;
    case O.Quad: g.quadraticCurveTo(n(1), n(2), n(3), n(4)); return i + 5;
    case O.Bezier: g.bezierCurveTo(n(1), n(2), n(3), n(4), n(5), n(6)); return i + 7;
    case O.Arc: g.arc(n(1), n(2), n(3), n(4), n(5), q[i + 6] as boolean); return i + 7;
    case O.ArcTo: g.arcTo(n(1), n(2), n(3), n(4), n(5)); return i + 6;
    case O.Ellipse: g.ellipse(n(1), n(2), n(3), n(4), n(5), n(6), n(7), q[i + 8] as boolean); return i + 9;
    case O.Rect: g.rect(n(1), n(2), n(3), n(4)); return i + 5;
    case O.Fill: g.fill(); return i + 1;
    case O.FillPath: g.fill(q[i + 1] as Path2D); return i + 2;
    case O.Stroke: g.stroke(); return i + 1;
    case O.Clip: g.clip(); return i + 1;
    case O.FillRect: g.fillRect(n(1), n(2), n(3), n(4)); return i + 5;
    case O.StrokeRect: g.strokeRect(n(1), n(2), n(3), n(4)); return i + 5;
    case O.FillText: g.fillText(q[i + 1] as string, n(2), n(3)); return i + 4;
    case O.StrokeText: g.strokeText(q[i + 1] as string, n(2), n(3)); return i + 4;
    case O.Dash: g.setLineDash(q[i + 1] as number[]); return i + 2;
    case O.FillStyle: g.fillStyle = q[i + 1] as string; return i + 2;
    case O.StrokeStyle: g.strokeStyle = q[i + 1] as string; return i + 2;
    case O.LineWidth: g.lineWidth = n(1); return i + 2;
    case O.LineCap: g.lineCap = q[i + 1] as CanvasLineCap; return i + 2;
    case O.LineJoin: g.lineJoin = q[i + 1] as CanvasLineJoin; return i + 2;
    case O.Font: g.font = q[i + 1] as string; return i + 2;
    case O.TextAlign: g.textAlign = q[i + 1] as CanvasTextAlign; return i + 2;
    case O.TextBaseline: g.textBaseline = q[i + 1] as CanvasTextBaseline; return i + 2;
    case O.Alpha: g.globalAlpha = n(1); return i + 2;
    case O.MiterLimit: g.miterLimit = n(1); return i + 2;
    case O.Composite: g.globalCompositeOperation = q[i + 1] as GlobalCompositeOperation; return i + 2;
  }
  throw new Error('backdrop recorder: bad opcode');
}
const SLICE_MS = 2.5;                    // replay budget per pre-warm frame (performance.now ms)
/** device px per logical px of a world-space context (quantised so sprite caches stay small) */
export function worldRes(c: CanvasRenderingContext2D): number {
  const m = c.getTransform(); return quantRes(Math.hypot(m.a, m.b));
}
/** worldRes() of a transform scaling `k` device px per logical px */
export function quantRes(k: number): number { return Math.max(0.5, Math.min(3, Math.round(k * 8) / 8)); }
/** tiny LRU of pre-rendered sprites */
export class SpriteCache<T = HTMLCanvasElement> {
  private map = new Map<string, T>();
  constructor(private max: number) {}
  get(key: string, make: () => T): T {
    let v = this.map.get(key);
    if (v !== undefined) { this.map.delete(key); this.map.set(key, v); return v; }
    v = make(); this.map.set(key, v);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
    return v;
  }
  has(key: string): boolean { return this.map.has(key); }
  clear(): void { this.map.clear(); }
}
const FONT = 'system-ui, "Noto Sans KR", "Apple SD Gothic Neo", sans-serif';

// ================================================================ palettes
interface Pal { id: string; style: BiomeDef['style']; sky: [string, string]; far: string; mid: string; near: string; haze: string; light: string; a0: string; a1: string; ground: string; top: string; plat: string; pit: string }
const palCache = new Map<string, Pal>();
function pal(bi: BiomeDef): Pal {
  let p = palCache.get(bi.id); if (p) return p;
  p = { id: bi.id, style: bi.style, sky: bi.sky, far: bi.far, mid: bi.mid, near: bi.near, haze: bi.haze ?? bi.sky[1], light: bi.light ?? '#ffd27a',
    a0: bi.accent?.[0] ?? '#e0524f', a1: bi.accent?.[1] ?? '#f3dfbd', ground: bi.ground, top: bi.groundTop, plat: bi.platform, pit: bi.pit ?? '#120a18' };
  palCache.set(bi.id, p); return p;
}

// ================================================================ parallax layers
type Painter = (g: CanvasRenderingContext2D, W: number, r: () => number, P: Pal) => void;
interface LayerSpec { top: number; k: number; paint: Painter }   // top = logical px above the ground line; k = max device-px factor
export const PARALLAX = [0.05, 0.15, 0.35, 0.6];
const BELOW = 16;                        // logical px painted below the ground line (hidden by the ground)

/** a periodic silhouette ridge (integer harmonics → tiles seamlessly) */
function ridge(g: CanvasRenderingContext2D, W: number, base: number, harm: [number, number, number][], col: string | CanvasGradient, step = 12): void {
  const y = (x: number) => { let v = base; for (const [k, A, ph] of harm) v -= A * Math.sin((x / W) * Math.PI * 2 * k + ph); return v; };
  g.fillStyle = col; g.beginPath(); g.moveTo(0, BELOW);
  for (let x = 0; x < W; x += step) g.lineTo(x, y(x));
  g.lineTo(W, y(W)); g.lineTo(W, BELOW); g.closePath(); g.fill();
}
function glowDot(g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a = 0.35): void {
  const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}
/** little silk lantern (청사초롱-ish / round) hanging at (x, y) = its centre */
function miniLantern(g: CanvasRenderingContext2D, x: number, y: number, s: number, col: string, glow = true): void {
  if (glow) glowDot(g, x, y, s * 3, col, 0.28);
  g.fillStyle = col; g.beginPath(); g.ellipse(x, y, s * 0.78, s, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(x - s * 0.25, y - s * 0.2, s * 0.22, s * 0.45, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(30,16,30,0.7)'; g.fillRect(x - s * 0.45, y - s - 1.5, s * 0.9, 2); g.fillRect(x - s * 0.45, y + s - 0.5, s * 0.9, 2);
}
/** a sagging string between two points with evenly spaced lanterns */
function lanternString(g: CanvasRenderingContext2D, xa: number, ya: number, xb: number, yb: number, sag: number, cols: string[], spacing: number, s: number, line: string): void {
  const at = (t: number) => [xa + (xb - xa) * t, ya + (yb - ya) * t + sag * 4 * t * (1 - t)];
  g.strokeStyle = line; g.lineWidth = 1.2; g.beginPath();
  const n = Math.max(2, Math.round(Math.abs(xb - xa) / 10));
  for (let i = 0; i <= n; i++) { const [x, y] = at(i / n); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
  g.stroke();
  const m = Math.max(2, Math.round(Math.abs(xb - xa) / spacing));
  for (let i = 1; i < m; i++) { const [x, y] = at(i / m); g.fillStyle = line; g.fillRect(x - 0.5, y, 1, s * 0.5); miniLantern(g, x, y + s * 1.4, s, cols[i % cols.length]); }
}
function windows(g: CanvasRenderingContext2D, r: () => number, x: number, y0: number, w: number, h: number, cw: number, ch: number, gap: number, lit: string, dark: string, pLit: number): void {
  for (let yy = y0; yy + ch <= y0 + h; yy += ch + gap) for (let xx = x; xx + cw <= x + w; xx += cw + gap) { g.fillStyle = r() < pLit ? lit : dark; g.fillRect(xx, yy, cw, ch); }
}
function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, col: string, vertical = false): void {
  g.font = `800 ${size}px ${FONT}`; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (!vertical) { g.fillText(s, x, y); return; }
  const chars = [...s]; for (let i = 0; i < chars.length; i++) g.fillText(chars[i], x, y + (i - (chars.length - 1) / 2) * size * 1.05);
}
/** place items along [0, W) so that the gap across the wrap looks like any other gap */
function spread(r: () => number, W: number, minW: number, maxW: number, minGap: number, maxGap: number, start = 0): [number, number][] {
  const out: [number, number][] = []; let x = start + r() * maxGap * 0.5;
  for (;;) { const w = minW + r() * (maxW - minW); if (x + w + minGap > W + start) break; out.push([x, w]); x += w + minGap + r() * (maxGap - minGap); }
  return out;
}

// ---------------------------------------------------------------- 야시장 골목 (market)
const MARKET_WORDS = ['분식', '호떡', '떡볶이', '어묵', '야식', '국수', '순대', '만두', '찐빵', '튀김', '붕어빵', '식혜'];
const marketLayers: LayerSpec[] = [
  { top: 250, k: 1, paint: (g, W, r, P) => {
    ridge(g, W, -150, [[2, 30, r() * 6], [5, 14, r() * 6], [9, 6, r() * 6]], mix(P.far, P.haze, 0.62));
    ridge(g, W, -96, [[3, 20, r() * 6], [7, 9, r() * 6], [13, 4, r() * 6]], mix(P.far, P.haze, 0.42));
    // distant hill town lights
    for (let i = 0; i < 70; i++) { const x = r() * W, y = -8 - r() * 60; g.fillStyle = rgba(P.light, 0.25 + r() * 0.35); g.fillRect(x, y, 2, 2); }
  } },
  { top: 230, k: 1.25, paint: (g, W, r, P) => {
    const base = P.far;
    for (const [x, w] of spread(r, W, 36, 90, -6, 10)) {
      const h = 50 + r() * 95; const col = mix(base, P.haze, r() * 0.12);
      g.fillStyle = col; g.fillRect(x, -h, w, h + BELOW);
      if (r() < 0.35) { g.beginPath(); g.moveTo(x - 4, -h); g.lineTo(x + w / 2, -h - 16); g.lineTo(x + w + 4, -h); g.closePath(); g.fill(); }
      else if (r() < 0.4) { g.fillRect(x + w * 0.2, -h - 12, 12, 12); g.fillRect(x + w * 0.2 + 5, -h - 22, 1.5, 10); }
      windows(g, r, x + 5, -h + 10, w - 10, h - 24, 4, 5, 6, rgba(P.light, 0.55), rgba(darken(base, 0.2), 0.35), 0.35);
    }
    // a generic broadcast tower on the hill
    const tx = W * 0.62; g.fillStyle = mix(base, P.haze, 0.1);
    g.fillRect(tx - 3, -225, 6, 225); g.beginPath(); g.ellipse(tx, -170, 16, 7, 0, 0, Math.PI * 2); g.fill(); g.fillRect(tx - 10, -186, 20, 10);
    g.fillStyle = rgba('#ff6b6b', 0.8); g.fillRect(tx - 1.5, -232, 3, 5);
  } },
  { top: 230, k: 1.5, paint: (g, W, r, P) => {
    const base = P.mid; const signs = [P.a0, '#3e9fd1', '#e8b04a', '#58b27c', '#c46bd6'];
    const items = spread(r, W, 90, 150, -4, 26);
    const tops: [number, number][] = [];
    for (const [x, w] of items) {
      const h = 120 + r() * 80; const col = mix(base, r() < 0.5 ? P.far : P.near, r() * 0.18);
      g.fillStyle = col; g.fillRect(x, -h, w, h + BELOW);
      g.fillStyle = darken(col, 0.18); g.fillRect(x - 3, -h - 5, w + 6, 6);             // parapet
      windows(g, r, x + 10, -h + 14, w - 20, h * 0.42, 12, 14, 8, rgba(P.light, 0.62), rgba(darken(col, 0.3), 0.6), 0.55);
      // horizontal signboard band (generic food words, no brands)
      const sc = mix(signs[Math.floor(r() * signs.length)], col, 0.48); const sy = -h * 0.42 - 8;
      g.fillStyle = sc; g.fillRect(x + 6, sy, w - 12, 22);
      g.fillStyle = rgba('#fff4dd', 0.18); g.fillRect(x + 6, sy, w - 12, 3);
      text(g, MARKET_WORDS[Math.floor(r() * MARKET_WORDS.length)], x + w / 2, sy + 12, 15, rgba('#fff4dd', 0.7));
      // lit shop front
      const gr = g.createLinearGradient(0, -52, 0, 0); gr.addColorStop(0, rgba(P.light, 0.5)); gr.addColorStop(1, rgba(P.light, 0.1));
      g.fillStyle = gr; g.fillRect(x + 8, -52, w - 16, 52);
      // vertical sign on some buildings
      if (r() < 0.45) { const vx = x + w - 16; g.fillStyle = mix(signs[Math.floor(r() * signs.length)], col, 0.3); g.fillRect(vx, -h + 16, 14, 50); text(g, MARKET_WORDS[Math.floor(r() * 6)].slice(0, 2), vx + 7, -h + 41, 11, rgba('#fff4dd', 0.85), true); }
      tops.push([x + w / 2, -h]);
    }
    // lantern strings between neighbouring roofs
    const lc = [mix(P.a0, P.mid, 0.1), mix('#ffb03b', P.mid, 0.15), mix('#ff7a5a', P.mid, 0.1)];
    for (let i = 0; i + 1 < tops.length; i++) lanternString(g, tops[i][0], tops[i][1] + 30, tops[i + 1][0], tops[i + 1][1] + 30, 26, lc, 22, 4, rgba('#2a1830', 0.8));
  } },
  { top: 205, k: 2, paint: (g, W, r, P) => {
    const body = P.near;
    const aw0 = mix(P.a0, body, 0.55), aw1 = mix(P.a1, body, 0.76);
    const stalls = spread(r, W, 150, 230, 50, 130);
    // festival lantern string high over the alley (behind the stalls)
    const lc = [mix(P.a0, body, 0.15), mix('#ffb03b', body, 0.2), mix('#3e9fd1', body, 0.25)];
    lanternString(g, -20, -196, W * 0.5, -190, 22, lc, 34, 5, rgba('#150a18', 0.85));
    lanternString(g, W * 0.5, -190, W + 20, -196, 22, lc, 34, 5, rgba('#150a18', 0.85));
    for (const [x, w] of stalls) {
      const awBot = -142, awTop = -170, counter = -56;
      // back wall + warm lit interior
      g.fillStyle = mix(body, P.mid, 0.3); g.fillRect(x + 6, awBot, w - 12, counter - awBot);
      const gr = g.createLinearGradient(0, awBot, 0, counter); gr.addColorStop(0, rgba(P.light, 0.42)); gr.addColorStop(1, rgba(P.light, 0.12));
      g.fillStyle = gr; g.fillRect(x + 6, awBot, w - 12, counter - awBot);
      // shelves with jars
      g.fillStyle = rgba(darken(body, 0.3), 0.55); g.fillRect(x + 12, -112, w - 24, 3);
      for (let jx = x + 16; jx < x + w - 22; jx += 12 + r() * 8) { const jh = 8 + r() * 10; g.fillRect(jx, -112 - jh, 7, jh); }
      // posts
      g.fillStyle = darken(body, 0.3); g.fillRect(x + 3, awBot, 5, -awBot); g.fillRect(x + w - 8, awBot, 5, -awBot);
      // pots + steam
      const pots = 1 + Math.floor(r() * 3);
      for (let k = 0; k < pots; k++) {
        const px = x + 20 + (w - 60) * ((k + 0.5) / pots) + r() * 10; const pw = 26 + r() * 10;
        g.fillStyle = mix('#8b95a8', body, 0.45); rr(g, px, counter - 18, pw, 20, 5); g.fill();
        g.fillStyle = mix('#c9d1de', body, 0.4); g.fillRect(px - 2, counter - 20, pw + 4, 3);
        for (let s = 0; s < 5; s++) { g.fillStyle = `rgba(255,255,255,${0.16 - s * 0.025})`; g.beginPath(); g.arc(px + pw / 2 + Math.sin(s * 1.7 + k) * 7, counter - 30 - s * 15, 7 + s * 2.2, 0, Math.PI * 2); g.fill(); }
      }
      // counter
      g.fillStyle = body; g.fillRect(x, counter, w, -counter + BELOW);
      g.fillStyle = lighten(body, 0.16); g.fillRect(x - 3, counter - 4, w + 6, 6);
      g.fillStyle = darken(body, 0.2); for (let bx = x + 18; bx < x + w - 10; bx += 26) g.fillRect(bx, counter + 12, 2, -counter - 16);
      // striped awning
      g.save(); g.beginPath(); g.moveTo(x - 12, awBot); g.lineTo(x + w + 12, awBot); g.lineTo(x + w, awTop); g.lineTo(x, awTop); g.closePath(); g.clip();
      for (let sx = x - 12, i = 0; sx < x + w + 12; sx += 16, i++) { g.fillStyle = i % 2 ? aw1 : aw0; g.fillRect(sx, awTop, 16, awBot - awTop); }
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x - 12, awBot - 5, w + 24, 5);
      g.restore();
      // scalloped valance
      for (let sx = x - 12, i = 0; sx < x + w + 12; sx += 16, i++) { g.fillStyle = i % 2 ? aw1 : aw0; g.beginPath(); g.arc(sx + 8, awBot, 8, 0, Math.PI); g.fill(); }
      // bulbs
      for (let b = 0; b < 3; b++) { const bx = x + w * (0.2 + b * 0.3); g.fillStyle = rgba('#1a0f1c', 0.8); g.fillRect(bx - 0.5, awBot + 6, 1, 10); glowDot(g, bx, awBot + 19, 16, P.light, 0.45); g.fillStyle = lighten(P.light, 0.4); g.beginPath(); g.arc(bx, awBot + 19, 3, 0, Math.PI * 2); g.fill(); }
      // name board on the awning
      const bw = Math.min(70, w * 0.45); g.fillStyle = mix('#fff1d6', body, 0.25); rr(g, x + w / 2 - bw / 2, awTop - 20, bw, 20, 4); g.fill();
      text(g, MARKET_WORDS[Math.floor(r() * MARKET_WORDS.length)], x + w / 2, awTop - 9.5, 12, mix(P.a0, body, 0.2));
    }
  } },
];

// ---------------------------------------------------------------- 포장마차 강변 (riverside)
const RIVER_TOP = -84;                   // far river bank (layer 1, logical y above the ground line)
const TENT_WORDS = ['포차', '우동', '잔치국수', '어묵탕', '꼼장어', '닭꼬치', '해물파전'];
const riversideLayers: LayerSpec[] = [
  { top: 260, k: 1, paint: (g, W, r, P) => {
    ridge(g, W, -150, [[2, 26, r() * 6], [5, 10, r() * 6]], mix(P.far, P.haze, 0.55));
    const col = mix(P.far, P.haze, 0.3);
    for (const [x, w] of spread(r, W, 22, 60, -4, 8)) {
      const h = 60 + r() * r() * 150; g.fillStyle = mix(col, P.haze, r() * 0.15); g.fillRect(x, RIVER_TOP - h + 10, w, h + 100);
      windows(g, r, x + 4, RIVER_TOP - h + 16, w - 8, h - 16, 3, 3, 5, rgba(P.light, 0.5), rgba(P.haze, 0.08), 0.28);
      if (h > 150) { g.fillStyle = rgba('#ff6b6b', 0.85); g.fillRect(x + w / 2 - 1.5, RIVER_TOP - h + 5, 3, 3); }
    }
  } },
  { top: 170, k: 1.25, paint: (g, W, r, P) => {
    // river
    const gr = g.createLinearGradient(0, RIVER_TOP, 0, 0); gr.addColorStop(0, mix(P.haze, P.mid, 0.15)); gr.addColorStop(1, mix(P.mid, P.near, 0.2));
    g.fillStyle = gr; g.fillRect(0, RIVER_TOP, W, -RIVER_TOP + BELOW);
    g.fillStyle = mix(P.far, P.near, 0.25); g.fillRect(0, RIVER_TOP - 4, W, 6);   // far bank
    // distant arch bridge with lights
    const spans = Math.max(3, Math.round(W / 230)); const sw = W / spans; const deck = RIVER_TOP - 58;
    const bc = mix(P.far, P.near, 0.2);
    g.fillStyle = bc; g.fillRect(0, deck, W, 7);
    for (let i = 0; i < spans; i++) {
      const x = i * sw; g.fillRect(x - 5, deck, 10, RIVER_TOP - deck);
      g.strokeStyle = bc; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 5, RIVER_TOP); g.quadraticCurveTo(x + sw / 2, deck - 34, x + sw - 5, RIVER_TOP); g.stroke();
      g.lineWidth = 1.2; for (let k = 1; k < 8; k++) { const t = k / 8; const ax = x + 5 + (sw - 10) * t; const ay = RIVER_TOP + (deck - 34 - RIVER_TOP) * 2 * t * (1 - t) * 2; if (ay < deck) { g.beginPath(); g.moveTo(ax, deck); g.lineTo(ax, ay); g.stroke(); } }
    }
    for (let x = 6; x < W; x += 18) {
      const c = (x / 18) % 3 < 1 ? '#9fe7ff' : P.light;
      g.fillStyle = rgba(c, 0.9); g.fillRect(x, deck - 2, 2.5, 2.5);
      // reflection streak in the water
      for (let k = 0; k < 4; k++) { g.fillStyle = rgba(c, 0.22 - k * 0.045); g.fillRect(x - 3 + r() * 2, RIVER_TOP + 8 + k * 12 + r() * 4, 7 - k, 2); }
    }
    // shimmering light lines on the water
    for (let i = 0; i < 110; i++) { g.fillStyle = rgba('#cfefff', 0.1 + r() * 0.18); g.fillRect(r() * W, RIVER_TOP + 6 + r() * (-RIVER_TOP - 6), 8 + r() * 26, 1.5); }
    g.fillStyle = rgba('#dff4ff', 0.35); g.fillRect(0, RIVER_TOP + 2, W, 1.5);
  } },
  { top: 175, k: 1.5, paint: (g, W, r, P) => {
    const col = P.mid;
    // willow trees
    for (const [x, w] of spread(r, W, 70, 110, 90, 220)) {
      const cx = x + w / 2, top = -150 - r() * 20;
      g.fillStyle = darken(col, 0.2); g.fillRect(cx - 4, top + 30, 8, -top - 30 + BELOW);
      g.fillStyle = mix(col, '#2e6b5e', 0.35); g.beginPath(); g.ellipse(cx, top + 34, w * 0.5, 36, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = mix(col, '#3f8a73', 0.4); g.lineWidth = 2;
      for (let k = 0; k < 16; k++) { const sx = cx - w * 0.48 + (w * 0.96 * k) / 15; const len = 50 + r() * 60; g.beginPath(); g.moveTo(sx, top + 30 + r() * 10); g.quadraticCurveTo(sx + 6, top + 50 + len * 0.5, sx + 2, top + 40 + len); g.stroke(); }
    }
    // promenade lamps
    for (let x = 60; x < W - 20; x += 200) {
      g.fillStyle = darken(col, 0.3); g.fillRect(x - 2, -118, 4, 118 + BELOW); g.fillRect(x - 12, -120, 24, 3);
      glowDot(g, x - 10, -112, 26, P.light, 0.5); glowDot(g, x + 10, -112, 26, P.light, 0.5);
      g.fillStyle = lighten(P.light, 0.5); g.beginPath(); g.arc(x - 10, -112, 3.5, 0, Math.PI * 2); g.arc(x + 10, -112, 3.5, 0, Math.PI * 2); g.fill();
    }
    // railing
    g.fillStyle = darken(col, 0.15); g.fillRect(0, -34, W, 4); g.fillRect(0, -18, W, 2);
    for (let x = 0; x < W; x += 20) g.fillRect(x, -34, 3, 34 + BELOW);
    g.fillStyle = darken(col, 0.25); g.fillRect(0, -6, W, 6 + BELOW);
  } },
  { top: 190, k: 2, paint: (g, W, r, P) => {
    const body = P.near;
    for (const [x, w] of spread(r, W, 170, 240, 130, 280)) {
      const h = 128 + r() * 22, top = -h;
      // tent glow on the ground
      glowDot(g, x + w / 2, -10, w * 0.7, P.a0, 0.18);
      // tent body (orange tarp lit from inside)
      const gr = g.createLinearGradient(0, top, 0, 0);
      gr.addColorStop(0, mix(P.a0, body, 0.45)); gr.addColorStop(0.35, mix(mix(P.a1, P.a0, 0.5), body, 0.22)); gr.addColorStop(0.75, mix(P.a0, body, 0.42)); gr.addColorStop(1, mix(P.a0, body, 0.66));
      g.fillStyle = gr; g.beginPath(); g.moveTo(x, BELOW); g.lineTo(x, top + 28); g.quadraticCurveTo(x + 2, top + 2, x + 30, top); g.lineTo(x + w - 30, top); g.quadraticCurveTo(x + w - 2, top + 2, x + w, top + 28); g.lineTo(x + w, BELOW); g.closePath(); g.fill();
      // frame / seams
      g.strokeStyle = rgba(darken(P.a0, 0.55), 0.55); g.lineWidth = 2;
      for (let sx = x + 40; sx < x + w - 20; sx += 44) { g.beginPath(); g.moveTo(sx, top + 2); g.lineTo(sx, 0); g.stroke(); }
      // rolled-up window with customers inside
      const wy = top + 34, wh = 46;
      g.fillStyle = rgba(lighten(P.light, 0.3), 0.42); g.fillRect(x + 12, wy, w - 24, wh);
      g.fillStyle = mix(P.a0, body, 0.1); rr(g, x + 8, wy - 8, w - 16, 9, 4); g.fill();
      g.fillStyle = rgba(darken(P.a0, 0.75), 0.75);
      for (let px = x + 26; px < x + w - 26; px += 30 + r() * 26) { const hr = 7 + r() * 2; g.beginPath(); g.arc(px, wy + wh - 20, hr, 0, Math.PI * 2); g.fill(); rr(g, px - 12, wy + wh - 12, 24, 14, 7); g.fill(); }
      g.fillStyle = rgba(darken(P.a0, 0.7), 0.6); g.fillRect(x + 12, wy + wh - 4, w - 24, 4);
      // sign
      const word = TENT_WORDS[Math.floor(r() * TENT_WORDS.length)];
      g.fillStyle = mix('#fff1d6', body, 0.15); rr(g, x + w / 2 - 34, top + 6, 68, 18, 4); g.fill();
      text(g, word, x + w / 2, top + 15.5, word.length > 3 ? 10 : 12, mix('#c2410c', body, 0.2));
      // bulb string along the front
      g.strokeStyle = rgba('#1a0f1c', 0.8); g.lineWidth = 1; g.beginPath(); g.moveTo(x + 6, top + 30); g.quadraticCurveTo(x + w / 2, top + 44, x + w - 6, top + 30); g.stroke();
      for (let b = 1; b < 6; b++) { const t = b / 6; const bx = x + 6 + (w - 12) * t; const by = top + 30 + 28 * t * (1 - t); glowDot(g, bx, by + 3, 10, P.light, 0.5); g.fillStyle = lighten(P.light, 0.5); g.beginPath(); g.arc(bx, by + 3, 2.2, 0, Math.PI * 2); g.fill(); }
      // plastic stools + a table outside
      const sc = mix('#e0453f', body, 0.4);
      for (let k = 0; k < 2; k++) { const sx = x + (k ? w + 8 : -30); if (r() < 0.7) { g.fillStyle = sc; g.fillRect(sx, -26, 22, 5); g.beginPath(); g.moveTo(sx + 2, -21); g.lineTo(sx + 20, -21); g.lineTo(sx + 17, 0); g.lineTo(sx + 5, 0); g.closePath(); g.fill(); } }
    }
  } },
];

// ---------------------------------------------------------------- 불꽃놀이 다리 (bridge)
const bridgeLayers: LayerSpec[] = [
  { top: 300, k: 1, paint: (g, W, r, P) => {
    const col = mix(P.far, P.haze, 0.45);
    for (const [x, w] of spread(r, W, 18, 50, -4, 10)) {
      const h = 70 + r() * r() * 210; g.fillStyle = mix(col, P.haze, r() * 0.2); g.fillRect(x, -h, w, h + BELOW);
      if (r() < 0.3) { g.beginPath(); g.moveTo(x, -h); g.lineTo(x + w / 2, -h - 14); g.lineTo(x + w, -h); g.fill(); }
      windows(g, r, x + 3, -h + 8, w - 6, h - 12, 2, 3, 4, rgba(P.light, 0.45), rgba(P.haze, 0.05), 0.25);
      if (h > 180) { g.fillStyle = rgba('#ff5c7a', 0.9); g.fillRect(x + w / 2 - 1.5, -h - 3, 3, 3); }
    }
  } },
  { top: 250, k: 1.25, paint: (g, W, r, P) => {
    const col = P.far;
    for (const [x, w] of spread(r, W, 34, 80, -2, 14)) {
      const h = 60 + r() * 150; const c = mix(col, P.near, r() * 0.2);
      g.fillStyle = c; g.fillRect(x, -h, w, h + BELOW);
      g.fillStyle = darken(c, 0.15); g.fillRect(x + w - 6, -h, 6, h);
      windows(g, r, x + 5, -h + 8, w - 14, h - 14, 4, 6, 4, rgba(P.light, 0.55), rgba(darken(c, 0.3), 0.5), 0.4);
    }
    // generic tower on a hill
    const tx = W * 0.3; g.fillStyle = mix(col, P.near, 0.1);
    g.beginPath(); g.ellipse(tx, 10, 150, 70, 0, Math.PI, 0); g.fill();
    g.fillRect(tx - 4, -240, 8, 190); g.beginPath(); g.ellipse(tx, -200, 18, 8, 0, 0, Math.PI * 2); g.fill(); g.fillRect(tx - 12, -218, 24, 12); g.fillRect(tx - 1, -262, 2, 24);
    g.fillStyle = rgba(P.a0, 0.9); for (let k = 0; k < 7; k++) g.fillRect(tx - 15 + k * 5, -202, 2, 2);
  } },
  { top: 250, k: 1.5, paint: (g, W, r, P) => {
    // suspension bridge (towers, main cable with festival lights, hangers, deck)
    const col = P.mid; const deck = -46; const n = Math.max(2, Math.round(W / 560)); const span = W / n; const tTop = -232;
    const cable = lighten(col, 0.25);
    for (let i = 0; i < n; i++) {
      const x0 = i * span, x1 = x0 + span;
      // main cable: from tower top (x0) sagging to near the deck at mid-span, up to the next tower (x1)
      g.strokeStyle = cable; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, tTop + 10); g.quadraticCurveTo((x0 + x1) / 2, deck + 40 - 60, x1, tTop + 10); g.stroke();
      const cy = (t: number) => (1 - t) * (1 - t) * (tTop + 10) + 2 * (1 - t) * t * (deck - 20) + t * t * (tTop + 10);
      g.strokeStyle = rgba(cable, 0.7); g.lineWidth = 1.2;
      for (let k = 1; k < 28; k++) { const t = k / 28; const hx = x0 + span * t; const hy = cy(t); if (hy < deck - 4) { g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx, deck); g.stroke(); } }
      // festival lights along the cable
      for (let k = 1; k < 40; k++) { const t = k / 40; const c = [P.a0, P.light, P.a1][k % 3]; g.fillStyle = rgba(c, 0.95); g.fillRect(x0 + span * t - 1.5, cy(t) - 1.5, 3, 3); }
      // H tower
      g.fillStyle = col; g.fillRect(x0 - 14, tTop, 9, -tTop + BELOW); g.fillRect(x0 + 5, tTop, 9, -tTop + BELOW);
      g.fillRect(x0 - 14, tTop + 18, 28, 7); g.fillRect(x0 - 14, tTop + 90, 28, 7); g.fillRect(x0 - 14, deck - 12, 28, 8);
      g.fillStyle = rgba('#ff5c7a', 0.9); g.fillRect(x0 - 11, tTop - 4, 3, 3); g.fillRect(x0 + 8, tTop - 4, 3, 3);
    }
    g.fillStyle = darken(col, 0.1); g.fillRect(0, deck, W, 12);
    g.fillStyle = rgba(P.light, 0.8); for (let x = 4; x < W; x += 16) g.fillRect(x, deck + 4, 3, 2);
    // water under the bridge with light reflections
    const gr = g.createLinearGradient(0, deck + 12, 0, 0); gr.addColorStop(0, mix(col, P.near, 0.4)); gr.addColorStop(1, mix(P.near, '#000000', 0.2));
    g.fillStyle = gr; g.fillRect(0, deck + 12, W, -deck - 12 + BELOW);
    for (let i = 0; i < 60; i++) { g.fillStyle = rgba([P.a0, P.light, P.a1][i % 3], 0.1 + r() * 0.15); g.fillRect(r() * W, deck + 16 + r() * (-deck - 18), 6 + r() * 16, 1.5); }
  } },
  { top: 150, k: 2, paint: (g, W, r, P) => {
    // our bridge: steel lattice railing, lamp posts with round lamps, arch ribs
    const col = P.near; const railTop = -66;
    // big arch ribs (the bridge's own arch passing overhead, only the lower ends are visible)
    g.strokeStyle = mix(col, P.mid, 0.3); g.lineWidth = 10;
    for (let x = 0; x < W; x += 480) { g.beginPath(); g.moveTo(x + 40, 10); g.quadraticCurveTo(x + 240, -300, x + 440, 10); g.stroke(); }
    g.lineWidth = 3; g.strokeStyle = mix(col, P.mid, 0.2);
    for (let x = 0; x < W; x += 480) for (let k = 1; k < 10; k++) { const t = k / 10; const ax = x + 40 + 400 * t; const ay = 10 + (-300 - 10) * 2 * t * (1 - t) + 0; if (ay < railTop) { g.beginPath(); g.moveTo(ax, ay + 6); g.lineTo(ax, railTop); g.stroke(); } }
    // lattice railing
    g.strokeStyle = col; g.lineWidth = 3;
    g.beginPath(); for (let x = 0; x < W; x += 24) { g.moveTo(x, railTop + 6); g.lineTo(x + 24, -4); g.moveTo(x + 24, railTop + 6); g.lineTo(x, -4); } g.stroke();
    g.fillStyle = col; g.fillRect(0, railTop, W, 7); g.fillRect(0, -6, W, 6 + BELOW);
    g.fillStyle = lighten(col, 0.18); g.fillRect(0, railTop, W, 2);
    for (let x = 0; x < W; x += 96) g.fillRect(x - 3, railTop, 6, -railTop);
    // lamp posts
    for (let x = 48; x < W; x += 192) {
      g.fillStyle = col; g.fillRect(x - 3, -140, 6, 140 + BELOW); g.fillRect(x - 8, -12, 16, 12);
      glowDot(g, x, -148, 30, P.light, 0.55);
      g.fillStyle = lighten(P.light, 0.55); g.beginPath(); g.arc(x, -148, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = col; g.fillRect(x - 8, -158, 16, 4);
      // small festival flag
      g.fillStyle = mix(r() < 0.5 ? P.a0 : P.a1, col, 0.35); g.fillRect(x + 3, -128, 18, 12);
    }
  } },
];

// ---------------------------------------------------------------- 새벽 지붕길 (dawn)
/** hanok roof (side view): upturned eaves, concave slopes, a ridge with raised ends; eave line at y, ridge h above */
function hanokRoof(g: CanvasRenderingContext2D, x: number, w: number, y: number, h: number, col: string, ridge?: string, tiles?: string): void {
  const path = () => {
    g.beginPath(); g.moveTo(x - 14, y - 9);
    g.quadraticCurveTo(x + w * 0.12, y + 1, x + w * 0.3, y); g.lineTo(x + w * 0.7, y);
    g.quadraticCurveTo(x + w * 0.88, y + 1, x + w + 14, y - 9);
    g.quadraticCurveTo(x + w * 0.84, y - h * 0.3, x + w * 0.78, y - h);
    g.lineTo(x + w * 0.22, y - h);
    g.quadraticCurveTo(x + w * 0.16, y - h * 0.3, x - 14, y - 9); g.closePath();
  };
  g.fillStyle = col; path(); g.fill();
  if (tiles) { g.save(); path(); g.clip(); g.fillStyle = tiles; for (let tx = x - 10; tx < x + w + 10; tx += 7) g.fillRect(tx, y - h, 1.6, h); g.fillRect(x - 14, y - 4, w + 28, 3); g.restore(); }
  g.fillStyle = ridge ?? col; g.beginPath(); g.moveTo(x + w * 0.17, y - h - 10); g.quadraticCurveTo(x + w * 0.5, y - h - 3, x + w * 0.83, y - h - 10); g.lineTo(x + w * 0.79, y - h + 1); g.lineTo(x + w * 0.21, y - h + 1); g.closePath(); g.fill();
}
const dawnLayers: LayerSpec[] = [
  { top: 260, k: 1, paint: (g, W, r, P) => {
    ridge(g, W, -170, [[2, 34, r() * 6], [3, 18, r() * 6], [7, 8, r() * 6]], mix(P.far, P.haze, 0.5));
    ridge(g, W, -120, [[1, 22, r() * 6], [4, 16, r() * 6], [9, 6, r() * 6]], mix(P.far, P.haze, 0.25));
    // mist band
    const gr = g.createLinearGradient(0, -120, 0, -40); gr.addColorStop(0, rgba(P.haze, 0)); gr.addColorStop(1, rgba(lighten(P.haze, 0.3), 0.55));
    g.fillStyle = gr; g.fillRect(0, -120, W, 80);
    g.fillStyle = rgba(lighten(P.haze, 0.3), 0.55); g.fillRect(0, -40, W, 40 + BELOW);
  } },
  { top: 210, k: 1.25, paint: (g, W, r, P) => {
    const col = P.far;
    ridge(g, W, -70, [[2, 22, r() * 6], [5, 10, r() * 6]], col);
    // pavilion on the hill + pines
    const px = W * 0.4; g.fillStyle = col;
    g.fillRect(px - 20, -120, 3, 30); g.fillRect(px + 17, -120, 3, 30);
    hanokRoof(g, px - 26, 52, -118, 26, col);
    for (let i = 0; i < 14; i++) { const x = r() * W, s = 12 + r() * 16, y = -60 - r() * 25; g.fillStyle = darken(col, 0.08); g.beginPath(); g.moveTo(x, y - s * 2); g.lineTo(x + s * 0.8, y); g.lineTo(x - s * 0.8, y); g.closePath(); g.fill(); g.fillRect(x - 1.5, y, 3, 8); }
    // far village roofs
    for (const [x, w] of spread(r, W, 40, 70, 10, 60)) { g.fillStyle = mix(col, P.mid, 0.3); g.fillRect(x + 6, -34, w - 12, 40); hanokRoof(g, x, w, -32, 22, mix(col, P.mid, 0.45)); }
  } },
  { top: 190, k: 1.5, paint: (g, W, r, P) => {
    const col = P.mid;
    // stone wall (돌담) along the lane
    g.fillStyle = darken(col, 0.05); g.fillRect(0, -42, W, 42 + BELOW);
    g.fillStyle = lighten(col, 0.08);
    for (let y = -40, row = 0; y < 0; y += 10, row++) for (let x = (row % 2) * 9; x < W; x += 16 + r() * 6) { g.beginPath(); g.ellipse(x, y + 5, 7, 4, 0, 0, Math.PI * 2); g.fill(); }
    hanokRoofRow(g, W, r, col, P, -42);
  } },
  { top: 200, k: 2, paint: (g, W, r, P) => {
    const col = P.near;
    // near roof ridges (용마루) passing by
    for (const [x, w] of spread(r, W, 180, 280, 120, 260)) {
      const y = -54 - r() * 20;
      g.fillStyle = col; g.fillRect(x + 10, y, w - 20, -y + BELOW);
      hanokRoof(g, x, w, y, 58, darken(col, 0.1), lighten(col, 0.3), rgba(lighten(col, 0.25), 0.35));
    }
    // persimmon trees (감나무) — Chuseok season
    for (const [x] of spread(r, W, 10, 11, 380, 620, 200)) {
      const tx = x, ty = -128;
      g.strokeStyle = darken(col, 0.2); g.lineWidth = 5; g.beginPath(); g.moveTo(tx, BELOW); g.lineTo(tx + 4, ty + 40);
      g.moveTo(tx + 3, ty + 60); g.lineTo(tx - 40, ty + 10); g.moveTo(tx + 4, ty + 45); g.lineTo(tx + 50, ty); g.moveTo(tx + 4, ty + 40); g.lineTo(tx + 8, ty - 20); g.stroke();
      g.lineWidth = 2; for (let k = 0; k < 12; k++) { const a = -Math.PI * (0.1 + 0.8 * r()); const l = 25 + r() * 30; const bx = tx + 4 + Math.cos(a) * 30, by = ty + 20 + Math.sin(a) * 30; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a) * l, by + Math.sin(a) * l); g.stroke(); }
      g.fillStyle = rgba(mix('#4a5a3a', col, 0.4), 0.9); for (let k = 0; k < 22; k++) { g.beginPath(); g.ellipse(tx - 50 + r() * 110, ty - 30 + r() * 70, 9, 5, r() * 3, 0, Math.PI * 2); g.fill(); }
      for (let k = 0; k < 11; k++) { const fx = tx - 45 + r() * 100, fy = ty - 20 + r() * 60; g.fillStyle = mix(P.a0, col, 0.25); g.beginPath(); g.arc(fx, fy, 4.5, 0, Math.PI * 2); g.fill(); g.fillStyle = rgba('#ffe0b0', 0.5); g.fillRect(fx - 2, fy - 3, 2, 2); }
    }
  } },
];
function hanokRoofRow(g: CanvasRenderingContext2D, W: number, r: () => number, col: string, P: Pal, base: number): void {
  for (const [x, w] of spread(r, W, 110, 170, 30, 90)) {
    const eave = base - 40 - r() * 30; const wall = mix(col, P.far, 0.35);
    g.fillStyle = wall; g.fillRect(x + 8, eave, w - 16, base - eave);
    g.fillStyle = darken(col, 0.15); for (let bx = x + 8; bx <= x + w - 12; bx += (w - 20) / 3) g.fillRect(bx, eave, 4, base - eave);
    // 한지 windows still lit at dawn
    const ww = 16; for (let k = 0; k < 2; k++) { const wx = x + w * (0.3 + k * 0.3) - ww / 2; g.fillStyle = rgba(P.light, 0.55); g.fillRect(wx, eave + 8, ww, 18); g.fillStyle = rgba(darken(col, 0.3), 0.6); g.fillRect(wx + ww / 2 - 0.5, eave + 8, 1, 18); g.fillRect(wx, eave + 16, ww, 1); }
    hanokRoof(g, x, w, eave, 44, col, lighten(col, 0.2), rgba(lighten(col, 0.2), 0.3));
  }
}

const LAYERS: Record<BiomeDef['style'], LayerSpec[]> = { market: marketLayers, riverside: riversideLayers, bridge: bridgeLayers, dawn: dawnLayers };
/** per layer index, the tallest layer of any style: layer canvases are all this tall (a layer uses its top rows), so a
 *  biome that leaves the cache hands its canvases on (a fresh 1–3 Mpx canvas costs ~10 ms at 4× CPU throttle on its
 *  first draw) */
const TOP_MAX = [0, 1, 2, 3].map(li => Math.max(...Object.values(LAYERS).map(ls => ls[li].top)));
/** text painted into the layers (warmed at prepare, so no pre-warm frame resolves a Hangul font) */
const LAYER_FONTS = [10, 11, 12, 15].map(px => `800 ${px}px ${FONT}`).concat(`900 26px ${FONT}`);
const LAYER_TEXT = [...new Set(MARKET_WORDS.join('') + TENT_WORDS.join('') + '도착')].join('');

// ================================================================ celestial sprites (moon, fireworks, sky lanterns)
function moonSprite(rad: number, res: number, pale: boolean, rabbit = false): HTMLCanvasElement {
  const R = rad * (pale ? 1.7 : 2.4); const [cv, g] = makeCanvas(R * 2, R * 2, res);
  const gr = g.createRadialGradient(R, R, rad * 0.9, R, R, R);
  gr.addColorStop(0, pale ? 'rgba(255,240,225,0.28)' : 'rgba(255,236,190,0.42)'); gr.addColorStop(0.35, pale ? 'rgba(255,240,225,0.10)' : 'rgba(255,220,160,0.16)'); gr.addColorStop(1, 'rgba(255,220,160,0)');
  g.fillStyle = gr; g.fillRect(0, 0, R * 2, R * 2);
  const body = g.createRadialGradient(R - rad * 0.3, R - rad * 0.3, rad * 0.1, R, R, rad);
  body.addColorStop(0, pale ? '#fffaf2' : '#fffbe8'); body.addColorStop(1, pale ? '#f2dccb' : '#ffe2a0');
  g.fillStyle = body; g.beginPath(); g.arc(R, R, rad, 0, Math.PI * 2); g.fill();
  g.fillStyle = pale ? 'rgba(170,140,160,0.16)' : 'rgba(210,160,90,0.2)';
  if (!rabbit) for (const [dx, dy, s] of [[-0.35, -0.2, 0.22], [0.25, 0.3, 0.28], [0.35, -0.35, 0.14], [-0.1, 0.45, 0.12]]) { g.beginPath(); g.arc(R + dx * rad, R + dy * rad, s * rad, 0, Math.PI * 2); g.fill(); }
  if (rabbit) {
    // 옥토끼 pounding rice cake (절구 + 절굿공이) — a soft silhouette on the moon
    g.fillStyle = 'rgba(206,150,96,0.3)'; const s = rad / 60; const bx = R - 14 * s, by = R + 12 * s;
    g.beginPath(); g.ellipse(bx, by, 14 * s, 17 * s, -0.15, 0, Math.PI * 2); g.fill();                      // body
    g.beginPath(); g.arc(bx - 13 * s, by + 10 * s, 4.5 * s, 0, Math.PI * 2); g.fill();                    // tail
    g.beginPath(); g.ellipse(bx + 7 * s, by - 19 * s, 10 * s, 9 * s, 0.1, 0, Math.PI * 2); g.fill();      // head
    g.beginPath(); g.ellipse(bx - 2 * s, by - 36 * s, 3.4 * s, 12 * s, -0.45, 0, Math.PI * 2); g.fill();  // ears
    g.beginPath(); g.ellipse(bx + 5 * s, by - 38 * s, 3.4 * s, 12 * s, -0.15, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(bx + 24 * s, by + 4 * s); g.lineTo(bx + 48 * s, by + 4 * s); g.lineTo(bx + 43 * s, by + 20 * s); g.lineTo(bx + 29 * s, by + 20 * s); g.closePath(); g.fill(); // mortar
    g.fillRect(bx + 22 * s, by + 1 * s, 28 * s, 4 * s);
    g.save(); g.translate(bx + 25 * s, by - 10 * s); g.rotate(0.55); g.fillRect(-2 * s, -4 * s, 4 * s, 30 * s); g.fillRect(-4.5 * s, 18 * s, 9 * s, 10 * s); g.restore(); // pestle
    g.beginPath(); g.ellipse(bx + 12 * s, by - 4 * s, 6 * s, 3.5 * s, -0.5, 0, Math.PI * 2); g.fill();  // paws
  }
  return cv;
}
function burstSprite(rad: number, res: number, col: string, col2: string): HTMLCanvasElement {
  const R = rad + 8; const [cv, g] = makeCanvas(R * 2, R * 2, res);
  glowDot(g, R, R, rad * 1.05, col, 0.32);
  const rays = 26; g.lineCap = 'round';
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + (i % 2) * 0.06; const len = rad * (i % 2 ? 0.8 : 1); const ca = Math.cos(a), sa = Math.sin(a);
    g.strokeStyle = rgba(col, 0.45); g.lineWidth = 2.2; g.beginPath(); g.moveTo(R + ca * len * 0.28, R + sa * len * 0.28); g.lineTo(R + ca * len * 0.78, R + sa * len * 0.78); g.stroke();
    g.strokeStyle = rgba(col2, 0.9); g.lineWidth = 1.6; g.beginPath(); g.moveTo(R + ca * len * 0.7, R + sa * len * 0.7); g.lineTo(R + ca * len * 0.93, R + sa * len * 0.93); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(R + ca * len, R + sa * len, 2.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = rgba(col, 0.9); g.beginPath(); g.arc(R + ca * len * 0.55, R + sa * len * 0.55, 1.6, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(R, R, 3.5, 0, Math.PI * 2); g.fill();
  return cv;
}
function skyLanternSprite(res: number): HTMLCanvasElement {
  // 풍등: a paper balloon, wide at the top, lit from the burner at its mouth
  const [cv, g] = makeCanvas(56, 64, res);
  glowDot(g, 28, 34, 28, '#ffb45a', 0.45);
  const gr = g.createLinearGradient(0, 10, 0, 50); gr.addColorStop(0, '#ffcf8a'); gr.addColorStop(0.55, '#ffab55'); gr.addColorStop(1, '#fff0c0');
  g.fillStyle = gr; g.beginPath(); g.moveTo(14, 16); g.quadraticCurveTo(14, 9, 22, 9); g.lineTo(34, 9); g.quadraticCurveTo(42, 9, 42, 16); g.quadraticCurveTo(41, 34, 35, 47); g.lineTo(21, 47); g.quadraticCurveTo(15, 34, 14, 16); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(170,70,20,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(28, 9); g.lineTo(28, 47); g.moveTo(21, 10); g.quadraticCurveTo(19, 30, 24, 47); g.moveTo(35, 10); g.quadraticCurveTo(37, 30, 32, 47); g.stroke();
  g.fillStyle = '#c0602a'; g.fillRect(20, 46, 16, 2.5);
  g.fillStyle = 'rgba(255,255,235,0.95)'; g.beginPath(); g.ellipse(28, 45, 3.2, 3.8, 0, 0, Math.PI * 2); g.fill();
  return cv;
}
function sparkleSprite(res: number): HTMLCanvasElement {
  const [cv, g] = makeCanvas(24, 24, res);
  glowDot(g, 12, 12, 10, '#fff6c8', 0.6);
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(12, 1); g.quadraticCurveTo(13, 11, 23, 12); g.quadraticCurveTo(13, 13, 12, 23); g.quadraticCurveTo(11, 13, 1, 12); g.quadraticCurveTo(11, 11, 12, 1); g.fill();
  return cv;
}
/** puffy cloud blob: circles + a flat base, each tone filled as ONE path (no alpha build-up inside a cloud) */
function cloud(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string, shadeCol: string, r: () => number): void {
  const n = Math.max(3, Math.round(w / 34)); const rs: number[] = [];
  for (let i = 0; i < n; i++) rs.push(h * (0.45 + 0.4 * Math.sin(Math.PI * ((i + 0.5) / n))) * (0.85 + r() * 0.3));
  const blob = (dy: number, k: number) => {
    g.beginPath();
    for (let i = 0; i < n; i++) { const cx = x + w * ((i + 0.5) / n); g.moveTo(cx + rs[i] * k, y + dy); g.arc(cx, y + dy, rs[i] * k, 0, Math.PI * 2); }
    g.rect(x + h * 0.3, y + dy, w - h * 0.6, h * 0.45 * k); g.fill();
  };
  g.fillStyle = shadeCol; blob(4, 1);
  g.fillStyle = col; blob(-2, 0.92);
}

const STAR_N: Record<BiomeDef['style'], number> = { market: 26, riverside: 42, bridge: 60, dawn: 14 };
const FIREWORK_COLS: [string, string][] = [['#ff7ab8', '#ffd1ea'], ['#7ae8ff', '#e0fbff'], ['#ffd36b', '#fff3c4'], ['#b69cff', '#ffffff']];

// ================================================================ ground / platform textures
const GT_W = 160, GT_UP = 12, GT_H = 140;    // ground texture tile: 160 logical wide, from 12 px above the surface down 128 px
type GroundStyle = BiomeDef['style'] | 'sky';

function paintGroundTile(g: CanvasRenderingContext2D, st: GroundStyle, P: Pal): void {
  const W = GT_W, D = GT_H - GT_UP; const r = srng(911 + st.length * 7);
  g.translate(0, GT_UP);                 // y = 0 is the walking surface
  const wrap = (fn: (ox: number) => void) => { fn(-W); fn(0); fn(W); };
  if (st === 'sky') {
    const gr = g.createLinearGradient(0, 0, 0, D); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#fff0f8'); gr.addColorStop(1, '#e2d2ff');
    g.fillStyle = gr; g.fillRect(0, 6, W, D);
    // puffy top edge (irregular bumps, period = tile width)
    const bumps: [number, number][] = []; for (let x = 0; x < W;) { const rad = 15 + r() * 10; bumps.push([x + rad, rad]); x += rad * 1.6; }
    const k = W / (bumps[bumps.length - 1][0] + bumps[bumps.length - 1][1] * 0.6);
    g.fillStyle = '#ffffff'; wrap(ox => { g.beginPath(); for (const [bx, rad] of bumps) { g.moveTo(ox + bx * k + rad, 10); g.arc(ox + bx * k, 10, rad, Math.PI, 0); } g.fill(); });
    // soft inner puffs
    for (let i = 0; i < 9; i++) { const x = r() * W, y = 30 + r() * (D - 40), rad = 10 + r() * 16; const col = i % 3 === 0 ? 'rgba(255,255,255,0.4)' : i % 3 === 1 ? 'rgba(255,196,228,0.14)' : 'rgba(196,170,255,0.13)'; g.fillStyle = col; wrap(ox => { g.beginPath(); g.arc(ox + x, y, rad, 0, Math.PI * 2); g.fill(); }); }
    g.fillStyle = 'rgba(255,190,225,0.35)'; g.fillRect(0, 22, W, 2);
    return;
  }
  if (st === 'market') {
    g.fillStyle = darken(P.ground, 0.35); g.fillRect(0, 0, W, D);
    let y = 14, row = 0;
    while (y < D) {
      const rh = 16 + r() * 5; const n = 5 + (row % 2); const ws: number[] = []; for (let i = 0; i < n; i++) ws.push(0.75 + r() * 0.5);
      const sum = ws.reduce((a, b) => a + b, 0); let x = (row % 2) * 13 + r() * 6;
      for (let i = 0; i < n; i++) {
        const w = (ws[i] / sum) * W; const c = mix(P.ground, P.top, 0.08 + r() * 0.2); const sx = x;
        wrap(ox => {
          g.fillStyle = c; rr(g, ox + sx + 1.5, y + 1.5, w - 3, rh - 3, 7); g.fill();
          g.fillStyle = 'rgba(255,240,210,0.16)'; rr(g, ox + sx + 4, y + 2.5, w - 9, 4, 2); g.fill();
          g.fillStyle = 'rgba(20,8,10,0.22)'; g.fillRect(ox + sx + 5, y + rh - 5, w - 10, 2.5);
        });
        x += w;
      }
      y += rh; row++;
    }
    const gr = g.createLinearGradient(0, 16, 0, D); gr.addColorStop(0, 'rgba(20,8,16,0)'); gr.addColorStop(1, 'rgba(20,8,16,0.5)');
    g.fillStyle = gr; g.fillRect(0, 0, W, D);
    // granite curb = the walking surface
    g.fillStyle = P.top; g.fillRect(0, -5, W, 17);
    g.fillStyle = lighten(P.top, 0.35); g.fillRect(0, -5, W, 3);
    g.fillStyle = darken(P.top, 0.25); g.fillRect(0, 9, W, 3);
    g.fillStyle = darken(P.top, 0.3); for (let x = 0; x < W; x += 40) g.fillRect(x, -3, 2, 12);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 12, W, 3);
    return;
  }
  if (st === 'riverside') {
    const wood = P.ground;
    for (let y = 16, row = 0; y < D; y += 17, row++) {
      g.fillStyle = mix(wood, row % 2 ? '#000000' : P.top, row % 2 ? 0.08 : 0.06); g.fillRect(0, y, W, 17);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, y + 15, W, 2);
      g.strokeStyle = 'rgba(0,0,0,0.13)'; g.lineWidth = 1;
      for (let k = 0; k < 3; k++) { const gy = y + 4 + k * 4; g.beginPath(); g.moveTo(0, gy); for (let x = 0; x <= W; x += 20) g.lineTo(x, gy + Math.sin(x * 0.08 + row + k) * 0.8); g.stroke(); }
      const off = (row * 53) % 80;
      for (let x = off; x < W + 80; x += 80) { const sx = x % W; g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(sx, y, 2, 15); g.fillStyle = 'rgba(255,230,190,0.25)'; g.fillRect(sx + 4, y + 6, 2, 2); g.fillRect(sx - 5, y + 6, 2, 2); }
    }
    g.fillStyle = 'rgba(0,0,0,0.22)'; for (let x = 36; x < W; x += 80) g.fillRect(x, 16, 10, D);
    const gr = g.createLinearGradient(0, 16, 0, D); gr.addColorStop(0, 'rgba(6,10,20,0)'); gr.addColorStop(1, 'rgba(6,10,20,0.5)');
    g.fillStyle = gr; g.fillRect(0, 0, W, D);
    // deck edge board (the walking surface) + fascia
    g.fillStyle = P.top; g.fillRect(0, -5, W, 13);
    g.fillStyle = lighten(P.top, 0.35); g.fillRect(0, -5, W, 2.5);
    g.fillStyle = darken(P.top, 0.3); for (let x = 0; x < W; x += 80) g.fillRect(x + 31, -4, 2, 11);
    g.fillStyle = darken(P.top, 0.45); for (let x = 8; x < W; x += 20) g.fillRect(x, 2, 2, 2);
    g.fillStyle = darken(wood, 0.25); g.fillRect(0, 8, W, 8);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 15, W, 2);
    return;
  }
  if (st === 'bridge') {
    const steel = P.ground;
    g.fillStyle = steel; g.fillRect(0, 0, W, D);
    for (let x = 0; x < W; x += 80) {
      g.fillStyle = lighten(steel, 0.08); g.fillRect(x + 6, 24, 68, 38);
      g.fillStyle = darken(steel, 0.2); g.fillRect(x + 6, 60, 68, 2);
      g.fillStyle = lighten(steel, 0.18); g.fillRect(x - 3, 16, 6, D);
      g.fillStyle = darken(steel, 0.35); g.fillRect(x + 3, 16, 2, D);
      g.fillStyle = lighten(steel, 0.4); for (let ry = 26; ry < D; ry += 12) g.fillRect(x - 1, ry, 2, 2);
      for (let rx = x + 12; rx < x + 72; rx += 10) { g.fillRect(rx, 28, 2, 2); g.fillRect(rx, 55, 2, 2); }
    }
    g.strokeStyle = darken(steel, 0.3); g.lineWidth = 5;
    g.beginPath(); for (let x = 0; x < W; x += 80) { g.moveTo(x + 6, 70); g.lineTo(x + 74, D); g.moveTo(x + 74, 70); g.lineTo(x + 6, D); } g.stroke();
    g.fillStyle = darken(steel, 0.15); g.fillRect(0, 66, W, 6);
    const gr = g.createLinearGradient(0, 16, 0, D); gr.addColorStop(0, 'rgba(8,4,20,0)'); gr.addColorStop(1, 'rgba(8,4,20,0.55)');
    g.fillStyle = gr; g.fillRect(0, 0, W, D);
    // steel walkway plate (walking surface) + rail with rivets
    g.fillStyle = P.top; g.fillRect(0, -5, W, 11);
    g.fillStyle = lighten(P.top, 0.45); g.fillRect(0, -5, W, 2);
    g.fillStyle = darken(P.top, 0.25); for (let x = 0; x < W; x += 12) g.fillRect(x, 0, 6, 1.5);
    g.fillStyle = darken(steel, 0.25); g.fillRect(0, 6, W, 10);
    g.fillStyle = lighten(steel, 0.35); for (let x = 5; x < W; x += 10) g.fillRect(x, 10, 2, 2);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 15, W, 2);
    return;
  }
  // dawn: giwa roof — columns of convex tiles under a lime-plaster ridge
  const tile = P.ground;
  g.fillStyle = darken(tile, 0.3); g.fillRect(0, 0, W, D);
  for (let x = 0; x < W; x += 20) {
    const gr = g.createLinearGradient(x, 0, x + 20, 0); gr.addColorStop(0, darken(tile, 0.1)); gr.addColorStop(0.45, lighten(tile, 0.16)); gr.addColorStop(1, darken(tile, 0.2));
    g.fillStyle = gr; g.fillRect(x + 2, 18, 16, D);
    g.fillStyle = 'rgba(0,0,0,0.28)'; for (let y = 34; y < D; y += 16) { g.beginPath(); g.ellipse(x + 10, y, 8, 3, 0, 0, Math.PI); g.fill(); }
  }
  const gr = g.createLinearGradient(0, 16, 0, D); gr.addColorStop(0, 'rgba(10,6,20,0)'); gr.addColorStop(1, 'rgba(10,6,20,0.5)');
  g.fillStyle = gr; g.fillRect(0, 0, W, D);
  // round tile ends (수막새)
  for (let x = 0; x < W; x += 20) { g.fillStyle = darken(tile, 0.15); g.beginPath(); g.arc(x + 10, 17, 7, 0, Math.PI * 2); g.fill(); g.strokeStyle = lighten(tile, 0.3); g.lineWidth = 1.2; g.stroke(); g.fillStyle = lighten(tile, 0.25); g.beginPath(); g.arc(x + 10, 17, 2, 0, Math.PI * 2); g.fill(); }
  // ridge (용마루, lime plaster) = the walking surface
  g.fillStyle = P.top; g.fillRect(0, -5, W, 14);
  g.fillStyle = lighten(P.top, 0.4); g.fillRect(0, -5, W, 2.5);
  g.fillStyle = darken(P.top, 0.2); g.fillRect(0, 5, W, 4);
  g.fillStyle = darken(P.top, 0.35); for (let x = 10; x < W; x += 40) g.fillRect(x, -2, 1.5, 6);
}

/** one-way platform sprite, w logical px wide (drawn from y = -6 above its top to +34) */
const PL_UP = 6, PL_H = 42;
function paintPlatform(g: CanvasRenderingContext2D, st: GroundStyle, P: Pal, w: number): void {
  g.translate(0, PL_UP);
  const T = PLATFORM_THICK;
  // soft drop shadow
  g.fillStyle = 'rgba(0,0,0,0.2)'; rr(g, 4, 8, w - 2, T + 6, 7); g.fill();
  if (st === 'sky') {
    g.fillStyle = '#e9dcff'; g.beginPath(); for (let x = 14; x < w; x += 24) { g.moveTo(x + 14, 10); g.arc(x, 10, 14, 0, Math.PI * 2); } g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); for (let x = 12; x < w; x += 24) { g.moveTo(x + 13, 5); g.arc(x, 5, 13, 0, Math.PI * 2); } g.fill();
    rr(g, 0, -2, w, 14, 7); g.fill();
    return;
  }
  const outline = 'rgba(20,10,24,0.75)';
  if (st === 'market') {
    // 평상 (low wooden bench): plank top, apron, stubby legs
    const wood = P.plat;
    g.fillStyle = darken(wood, 0.35); g.fillRect(8, T, 7, 11); g.fillRect(w - 15, T, 7, 11); if (w > 160) g.fillRect(w / 2 - 3, T, 7, 11);
    g.fillStyle = wood; rr(g, 0, 0, w, T, 4); g.fill();
    g.fillStyle = lighten(wood, 0.3); rr(g, -2, -3, w + 4, 9, 4); g.fill();
    g.fillStyle = lighten(wood, 0.55); g.fillRect(2, -3, w - 4, 2);
    g.fillStyle = darken(wood, 0.3); for (let x = 20; x < w - 6; x += 20) g.fillRect(x, -2, 1.5, 7);
    g.fillStyle = darken(wood, 0.25); for (let x = 40; x < w - 6; x += 40) g.fillRect(x, 7, 2, T - 8);
    g.fillStyle = 'rgba(255,230,190,0.4)'; for (let x = 8; x < w - 4; x += 40) { g.fillRect(x, 10, 2, 2); g.fillRect(x + 24, 10, 2, 2); }
    g.strokeStyle = outline; g.lineWidth = 1.5; rr(g, -2, -3, w + 4, T + 3, 4); g.stroke();
    return;
  }
  if (st === 'riverside') {
    // tent roof edge: striped canvas with a scalloped valance
    const c0 = P.plat, c1 = mix(P.a1, '#ffffff', 0.2);
    g.save(); rr(g, 0, 0, w, T - 2, 3); g.clip();
    for (let x = 0, i = 0; x < w; x += 20, i++) { g.fillStyle = i % 2 ? c1 : c0; g.fillRect(x, 0, 20, T); }
    g.restore();
    for (let x = 0, i = 0; x < w; x += 20, i++) { g.fillStyle = i % 2 ? darken(c1, 0.08) : darken(c0, 0.08); g.beginPath(); g.arc(x + 10, T - 3, 10, 0, Math.PI); g.fill(); }
    g.fillStyle = lighten(P.a1, 0.4); rr(g, -3, -4, w + 6, 7, 3.5); g.fill();
    g.fillStyle = darken(c0, 0.3); for (let x = 0; x < w; x += 20) g.fillRect(x, 3, 1, T - 6);
    g.strokeStyle = outline; g.lineWidth = 1.5; rr(g, -3, -4, w + 6, 7, 3.5); g.stroke();
    return;
  }
  if (st === 'bridge') {
    // steel I-beam with rivets
    const s = P.plat;
    g.fillStyle = darken(s, 0.3); g.fillRect(3, 4, w - 6, T - 8);
    g.fillStyle = darken(s, 0.5); for (let x = 20; x < w - 10; x += 40) { g.beginPath(); g.arc(x, T / 2, 3.5, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = lighten(s, 0.3); g.fillRect(-2, -3, w + 4, 7);
    g.fillStyle = lighten(s, 0.6); g.fillRect(-2, -3, w + 4, 2);
    g.fillStyle = s; g.fillRect(-2, T - 5, w + 4, 6);
    g.fillStyle = darken(s, 0.4); for (let x = 6; x < w - 2; x += 10) { g.fillRect(x, 1, 2, 2); g.fillRect(x, T - 3, 2, 2); }
    g.strokeStyle = outline; g.lineWidth = 1.5; g.strokeRect(-2, -3, w + 4, T + 4);
    return;
  }
  // dawn: roof ledge — plaster ridge, tile band, round tile ends, rafter ends
  const tile = P.ground;
  g.fillStyle = P.plat; for (let x = 10; x < w - 4; x += 20) { g.beginPath(); g.arc(x, T + 5, 3.5, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = darken(P.plat, 0.2); g.fillRect(2, T - 2, w - 4, 4);
  g.fillStyle = tile; g.fillRect(0, 3, w, T - 5);
  for (let x = 0; x < w; x += 20) { g.fillStyle = lighten(tile, 0.15); g.fillRect(x + 6, 4, 8, T - 8); g.fillStyle = darken(tile, 0.1); g.beginPath(); g.arc(x + 10, T - 3, 5.5, 0, Math.PI * 2); g.fill(); g.strokeStyle = lighten(tile, 0.35); g.lineWidth = 1; g.stroke(); }
  g.fillStyle = P.top; rr(g, -2, -4, w + 4, 8, 3); g.fill();
  g.fillStyle = lighten(P.top, 0.4); g.fillRect(0, -4, w, 2);
  g.strokeStyle = outline; g.lineWidth = 1.5; rr(g, -2, -4, w + 4, 8, 3); g.stroke();
}

// ---------------------------------------------------------------- pits (하수구 틈 / 물웅덩이 틈 / 끊어진 난간 / 지붕 사이)
const PIT_H = VIEW_H + 32 - GROUND_Y;           // from 2 px above the surface to below the view
/** a 8-px column of the pit interior (stretched across the gap): dark, darker with depth, style details */
function paintPitColumn(g: CanvasRenderingContext2D, st: GroundStyle, P: Pal): void {
  const gr = g.createLinearGradient(0, 0, 0, PIT_H); gr.addColorStop(0, rgba(P.pit, 0.92)); gr.addColorStop(0.22, P.pit); gr.addColorStop(1, darken(P.pit, 0.5));
  g.fillStyle = gr; g.fillRect(0, 0, 8, PIT_H);
  if (st === 'riverside') { g.fillStyle = mix(P.pit, '#1f4a6e', 0.55); g.fillRect(0, 72, 8, PIT_H - 72); g.fillStyle = 'rgba(160,210,255,0.25)'; g.fillRect(0, 72, 8, 1.5); }
  else if (st === 'market') { g.fillStyle = 'rgba(255,220,180,0.06)'; for (let y = 28; y < PIT_H; y += 14) g.fillRect(0, y, 8, 1.5); g.fillStyle = 'rgba(120,200,255,0.18)'; g.fillRect(0, 90, 8, 2); }
  else if (st === 'dawn') { g.fillStyle = 'rgba(255,220,200,0.05)'; for (let y = 32; y < PIT_H; y += 18) g.fillRect(0, y, 8, 1.5); }
  else if (st === 'sky') { g.clearRect(0, 0, 8, PIT_H); g.fillStyle = 'rgba(120,80,200,0.25)'; g.fillRect(0, 12, 8, PIT_H - 12); }
}
const EDGE_W = 12, EDGE_UP = 6, EDGE_H = PIT_H + 4;
/** the end of a ground run at a pit: dark cliff face fading into the ground + a rounded lip of the walking surface */
function paintEdge(g: CanvasRenderingContext2D, st: GroundStyle, P: Pal, dir: 1 | -1): void {
  const face = st === 'sky' ? '#b48ce6' : darken(P.ground, 0.55);
  const x = dir > 0 ? 0 : EDGE_W; const y0 = EDGE_UP + 10;
  const gr = g.createLinearGradient(x, 0, x + dir * 10, 0); gr.addColorStop(0, rgba(face, st === 'sky' ? 0.5 : 1)); gr.addColorStop(1, rgba(face, 0));
  g.fillStyle = gr; g.fillRect(dir > 0 ? 0 : EDGE_W - 10, y0, 10, EDGE_H - y0);
  g.fillStyle = st === 'sky' ? 'rgba(150,110,220,0.7)' : 'rgba(0,0,0,0.55)'; g.fillRect(dir > 0 ? 0 : EDGE_W - 3, EDGE_UP + 8, 3, EDGE_H);
  g.fillStyle = st === 'sky' ? '#ffffff' : P.top; g.beginPath(); g.arc(x + dir * 6, EDGE_UP + 2, 6, 0, Math.PI * 2); g.fill();
}

/** one copy of a bonus-sky cloud bank (the tile repeats every W) */
function paintClouds(g: CanvasRenderingContext2D, W: number, li: number): void {
  const r = srng(4242 + li * 17);
  if (li === 0) {
    for (let x = 0; x < W; x += 150 + r() * 120) cloud(g, x, -60 - r() * 120, 140 + r() * 120, 26 + r() * 14, 'rgba(255,214,236,0.55)', 'rgba(190,140,220,0.35)', r);
    for (let x = 0; x < W; x += 90 + r() * 60) cloud(g, x, -20 - r() * 20, 120 + r() * 90, 30 + r() * 12, 'rgba(255,226,240,0.8)', 'rgba(214,160,220,0.6)', r);
  } else {
    for (let x = 0; x < W; x += 110 + r() * 90) cloud(g, x, -10 - r() * 40, 150 + r() * 100, 34 + r() * 16, '#fff4fa', 'rgba(236,190,236,0.95)', r);
  }
}
/** the moon each style shows: [radius, pale] (the bridge has fireworks instead) */
const MOON: Record<BiomeDef['style'], [number, boolean] | null> = { market: [30, false], riverside: [26, false], dawn: [92, true], bridge: null };

// ================================================================ the Backdrop
/** the Backdrop sized last. Every run gets a new renderer: a new run on the same screen takes over the last one's painted
 *  layers, sprites and spare canvases (an instant retry repaints and allocates nothing) */
let last: Backdrop | null = null;

export class Backdrop {
  cssW = 1; cssH = 1; dpr = 1; scale = 1;
  lowFx = false; reduceMotion = false;
  private layers = new Map<string, (Layer | null)[]>();   // biome id → 4 lazily painted layers
  private jobs = new Map<string, Job>();                 // layers being pre-warmed
  private pool = new Map<string, HTMLCanvasElement[]>(); // spare layer canvases by size (from biomes that left the cache)
  private pxPool = new Map<string, HTMLCanvasElement[]>(); // spare device-resolution copies by size
  private skyCache = new Map<string, HTMLCanvasElement>();
  private sprites = new SpriteCache(40);
  private tileW = 1440;                  // logical width of one parallax tile (≈1.5× the view)
  private frameT = NaN; private budget = 1;
  private ta = 1; private td = 1; private te = 0; private tf = 0;   // current screen transform (device px)
  private stars = new Map<string, Float32Array>();
  private flushG: CanvasRenderingContext2D | null = null;
  private toFlush: HTMLCanvasElement | null = null;       // a pre-warmed bonus piece to rasterise next
  private moons = new Map<number, { res: number; cv: HTMLCanvasElement }>();
  private clouds: (Job | null)[] = [null, null];           // the bonus sky's two cloud banks

  resize(cssW: number, cssH: number, dpr: number, scale: number): void {
    if (cssW === this.cssW && cssH === this.cssH && dpr === this.dpr && scale === this.scale) return;   // (layout runs twice at a run start)
    this.cssW = cssW; this.cssH = cssH; this.dpr = dpr; this.scale = scale;
    this.tileW = Math.max(1440, Math.ceil((1.5 * cssW) / scale / 40) * 40);
    this.layers.clear(); this.jobs.clear(); this.pool.clear(); this.pxPool.clear(); this.skyCache.clear(); this.sprites.clear(); this.moons.clear(); this.toFlush = null; this.clouds = [null, null];
    const p = last; last = this;
    if (p && p !== this && p.cssW === cssW && p.cssH === cssH && p.dpr === dpr && p.scale === scale) this.adopt(p);
  }

  /** take over another (dropped) Backdrop's caches for the same screen — everything in them depends only on its size */
  private adopt(p: Backdrop): void {
    [this.layers, p.layers] = [p.layers, this.layers]; [this.jobs, p.jobs] = [p.jobs, this.jobs];
    [this.pool, p.pool] = [p.pool, this.pool]; [this.pxPool, p.pxPool] = [p.pxPool, this.pxPool];
    [this.skyCache, p.skyCache] = [p.skyCache, this.skyCache]; [this.sprites, p.sprites] = [p.sprites, this.sprites];
    [this.stars, p.stars] = [p.stars, this.stars]; [this.moons, p.moons] = [p.moons, this.moons];
    [this.clouds, p.clouds] = [p.clouds, this.clouds]; [this.toFlush, p.toFlush] = [p.toFlush, null]; this.flushG = p.flushG;
  }

  /** screen y (css px) of the ground line */
  private get gy(): number { return this.cssH - (VIEW_H - GROUND_Y) * this.scale; }

  /** paint every layer of a biome now (loading, resize, a biome switch that outran its pre-warm); otherwise layers are
   *  pre-warmed a piece per frame */
  prepare(bi: BiomeDef): void {
    warmFonts(LAYER_FONTS, LAYER_TEXT);
    for (let li = 0; li < 4; li++) this.layer(bi, li, true);
  }

  /** a layer's canvas size (device px) and the rows it uses (its own height, from the top) */
  private dims(bi: BiomeDef, li: number): { res: number; w: number; h: number; sh: number } {
    const spec = LAYERS[bi.style][li]; const res = Math.min(2.5, this.scale * Math.min(this.dpr, spec.k));
    return { res, w: Math.max(1, Math.round(this.tileW * res)), h: Math.max(1, Math.ceil((TOP_MAX[li] + BELOW) * res)), sh: Math.max(1, Math.ceil((spec.top + BELOW) * res)) };
  }

  private job(bi: BiomeDef, li: number): Job {
    const key = bi.id + '|' + li; let job = this.jobs.get(key); if (job) return job;
    const d = this.dims(bi, li); const pk = d.w + 'x' + d.h;
    const pooled = this.pool.get(pk)?.pop(); const cv = pooled ?? touch(newCanvas(d.w, d.h));
    const g = cv.getContext('2d')!; g.setTransform(1, 0, 0, 1, 0, 0); if (pooled) g.clearRect(0, 0, cv.width, cv.height);
    // (clipped to the layer's own rows, as its own canvas would be — popped when the layer is done)
    g.save(); g.beginPath(); g.rect(0, 0, d.w, d.sh); g.clip();
    // the canvas is a whole number of px wide and the content period is exactly that width (seamless tiling)
    g.setTransform(d.w / this.tileW, 0, 0, d.res, 0, 0); g.translate(0, LAYERS[bi.style][li].top);
    const spec = LAYERS[bi.style][li]; const W = this.tileW; const P = pal(bi); const seed = 1000 + li * 97 + bi.id.length * 13 + bi.id.charCodeAt(0);
    job = { L: layerOf(cv, d.sh), g, paint: r => spec.paint(r, W, srng(seed), P), W, ops: null, at: 0, flushed: false, done: false }; this.jobs.set(key, job);
    return job;
  }

  /** advance a job by one frame's worth (record → replay slices → rasterise); `force`: finish it now. True when done. */
  private advance(job: Job, force: boolean): boolean {
    if (!job.ops && force) {                      // all at once: paint the three copies straight away (no recording)
      const g = job.g; for (let copy = 0; copy < 3; copy++) { g.save(); g.translate((copy - 1) * job.W, 0); job.paint(g); g.restore(); }
      g.restore(); job.done = true; return true;
    }
    if (!job.ops) { const r = new Recorder(); job.paint(r as unknown as CanvasRenderingContext2D); job.ops = r.q; return false; }
    const q = job.ops, n = q.length, total = 3 * n, g = job.g;
    if (job.at < total) {
      const t0 = performance.now(); let calls = 0;
      while (job.at < total) {
        const copy = Math.floor(job.at / n), k = job.at - copy * n;
        if (k === 0) { g.save(); g.translate((copy - 1) * job.W, 0); }
        const next = play(g, q, k); job.at = copy * n + next;
        if (next === n) g.restore();
        if (!force && (++calls & 31) === 0 && performance.now() - t0 > SLICE_MS) break;
      }
      if (job.at < total || !force) return false;
    }
    if (!job.flushed && !force) { this.flush(job.L.cv); job.flushed = true; }
    job.g.restore(); job.done = true; return true;
  }

  private layer(bi: BiomeDef, li: number, force = false): Layer | null {
    let arr = this.layers.get(bi.id);
    if (arr) { this.layers.delete(bi.id); this.layers.set(bi.id, arr); }          // LRU touch
    else {
      arr = [null, null, null, null]; this.layers.set(bi.id, arr);
      // keep at most 2 biomes (≈ 2 × 7 MB on a phone): the current one and the previous one while they cross-fade, then
      // the next one being pre-warmed (pre-warming waits for the cross-fade) — which takes over the leaving one's canvases
      if (this.layers.size > 2) {
        const old = this.layers.keys().next().value as string; const gone = this.layers.get(old)!; this.layers.delete(old);
        for (let k = 0; k < 4; k++) {
          const L = gone[k]; this.jobs.delete(old + '|' + k);          // (a half-painted layer's canvas is dropped, not reused)
          if (L) { const pk = L.cv.width + 'x' + L.cv.height; const list = this.pool.get(pk) ?? []; list.push(L.cv); this.pool.set(pk, list); }
          if (L?.px && L.ps === 3) { const pk = L.px.width + 'x' + L.px.height; const list = this.pxPool.get(pk) ?? []; list.push(L.px); this.pxPool.set(pk, list); }
        }
      }
    }
    if (arr[li]) return arr[li];
    if (!force && this.budget <= 0) return null;
    this.budget--;
    // three copies (−W, 0, +W) make the tile seamless. A pre-warm spreads the work over several frames and rasterises
    // the finished layer in a frame of its own (so none of it lands on the frame the biome comes in); a forced paint
    // (biome switch, resize) does whatever is left at once
    const had = this.jobs.has(bi.id + '|' + li); const job = this.job(bi, li);
    if (!had && !force) return null;                    // (a new canvas's pixels: a step of their own)
    if (!this.advance(job, force)) return null;
    this.jobs.delete(bi.id + '|' + li);
    arr[li] = job.L; return job.L;
  }

  /** one frame's step toward a finished layer's device-resolution copy (see Layer); false when there was none to do */
  private prescale(L: Layer, top: number): boolean {
    if (L.ps === 3) return false;
    const a = this.dpr, want = this.tileW * this.scale * a, hDev = (top + BELOW) * this.scale * a;   // (= tiled()'s)
    if (Math.abs(want - L.cv.width) <= 1.5 && Math.abs(hDev - L.sh) <= 2) { L.ps = 3; return false; }   // painted 1:1 already
    const w = Math.max(1, Math.round(want)), h = Math.ceil(hDev);
    if (L.ps === 0) {
      const pooled = this.pxPool.get(w + 'x' + h)?.pop();
      if (pooled) { const g = pooled.getContext('2d')!; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); }
      L.px = pooled ?? touch(newCanvas(w, h)); L.pw = w; L.ph = hDev; L.ps = 1; return true;
    }
    const px = L.px!;
    if (L.ps === 1) {                   // the very upscale tiled() would do each frame, into device px at (0, 0)
      const g = px.getContext('2d')!; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.imageSmoothingEnabled = true;
      g.drawImage(L.cv, 0, 0, L.cv.width, L.sh, 0, 0, w, hDev); L.ps = 2; return true;
    }
    this.flush(px); L.ps = 3; return true;
  }

  /** rasterise a canvas's recorded drawing now (drawing it anywhere does; a 1×1 scratch keeps it cheap) */
  private flush(cv: HTMLCanvasElement): void {
    if (!this.flushG) { const f = document.createElement('canvas'); f.width = f.height = 1; this.flushG = f.getContext('2d'); }
    const g = this.flushG; if (!g) return;
    g.drawImage(cv, 0, 0, 1, 1); g.clearRect(0, 0, 1, 1);
  }

  /** paint the 보름달 잔치 sky's pieces ahead of time, one per frame (from the 4th letter on), each rasterised on the
   *  frame after it is painted — its first frame used to paint them all at once (≈ 90 ms at 4× CPU throttle) */
  prewarmBonus(bi?: BiomeDef): void {
    if (this.budget <= 0) return;
    if (this.toFlush) { this.budget--; this.flush(this.toFlush); this.toFlush = null; return; }
    const res = Math.min(2.5, this.scale * this.dpr); const has = (k: string) => this.sprites.has(`${k}|${res}`);
    const wres = quantRes(this.scale * this.dpr);                                           // = worldRes() of the world transform
    const job = !this.skyCache.has('__bonus') ? () => this.skyCanvas(null)
      : !has('bonusMoon') ? () => this.sprite('bonusMoon', r => moonSprite(118, r, false, true))
      : !has('sparkle') ? () => this.sprite('sparkle', r => sparkleSprite(r))
      : !has('skyLantern') ? () => this.sprite('skyLantern', r => skyLanternSprite(r))
      : bi && !this.sprites.has(`gt|sky|${bi.id}|${wres}`) ? () => this.groundTile('sky', bi, wres) : null;
    if (job) { this.budget--; this.toFlush = job(); return; }
    for (let li = 0; li < 2; li++) {           // the cloud banks: allocate, record, replay in slices, rasterise
      const cj = this.clouds[li]; if (cj?.done) continue;
      this.budget--; if (!cj) this.cloudJob(li); else this.advance(cj, false);
      return;
    }
  }

  /** spend the frame's budget on a step of a finished layer's device-resolution copy (see Layer) */
  private prescaleBiome(bi: BiomeDef): void {
    const arr = this.layers.get(bi.id); if (!arr) return;
    for (let li = 0; li < 4 && this.budget > 0; li++) { const L = arr[li]; if (L && this.prescale(L, LAYERS[bi.style][li].top)) this.budget--; }
  }

  /** the next biome's sky, moon and firework sprites, one per frame after its layers (not on the frame it comes in) */
  private prewarmExtras(bi: BiomeDef): void {
    if (this.budget <= 0) return;
    if (this.toFlush) { this.budget--; this.flush(this.toFlush); this.toFlush = null; return; }
    const res = Math.min(2.5, this.scale * this.dpr);
    let job: (() => HTMLCanvasElement) | null = !this.skyCache.has(bi.id) ? () => this.skyCanvas(bi) : null;
    if (!job) {
      const moon = MOON[bi.style];
      if (moon) { const m = this.moons.get(moon[0] * (moon[1] ? -1 : 1)); if (!m || m.res !== res) job = () => this.moonSprite(moon[0], moon[1]); }
      else for (let k = 0; k < FIREWORK_COLS.length && !job; k++) if (!this.sprites.has(`fw${k}|${res}`)) { const [col, col2] = FIREWORK_COLS[k]; job = () => this.sprite(`fw${k}`, r => burstSprite(80, r, col, col2)); }
    }
    if (job) { this.budget--; this.toFlush = job(); }
  }

  private skyCanvas(bi: BiomeDef | null): HTMLCanvasElement {
    const key = bi ? bi.id : '__bonus'; let cv = this.skyCache.get(key); if (cv) return cv;
    // device-pixel tall and 4 px wide: blitted 1:1 vertically with smoothing off (a vertical gradient needs no
    // horizontal filtering) — several times cheaper than a smoothed stretch on CPU-rastered canvases
    const H = Math.max(2, Math.round(this.cssH * this.dpr)); cv = document.createElement('canvas'); cv.width = 4; cv.height = H;
    const g = cv.getContext('2d')!; const gr = g.createLinearGradient(0, 0, 0, H);
    const at = (worldY: number) => Math.max(0, Math.min(1, ((this.cssH - (VIEW_H - worldY) * this.scale) * this.dpr) / H));
    if (bi) {
      const P = pal(bi);
      gr.addColorStop(0, bi.sky[0]); gr.addColorStop(at(0), bi.sky[0]);
      gr.addColorStop(at(200), mix(bi.sky[0], bi.sky[1], 0.35));
      gr.addColorStop(at(330), mix(bi.sky[0], bi.sky[1], 0.75));
      gr.addColorStop(at(GROUND_Y - 40), bi.sky[1]); gr.addColorStop(at(GROUND_Y), mix(bi.sky[1], P.haze, 0.5)); gr.addColorStop(1, mix(bi.sky[1], P.haze, 0.5));
    } else {
      gr.addColorStop(0, '#1d1650'); gr.addColorStop(at(0), '#2a1d6b'); gr.addColorStop(at(170), '#5b3597'); gr.addColorStop(at(310), '#c261b4'); gr.addColorStop(at(410), '#ff9fb0'); gr.addColorStop(at(GROUND_Y), '#ffd29a'); gr.addColorStop(1, '#ffd29a');
    }
    g.fillStyle = gr; g.fillRect(0, 0, 4, H);
    this.skyCache.set(key, cv); return cv;
  }

  /** the colour at the very top of the sky gradient: the renderer fills the strip the camera uncovers above the
   *  world with it, so the two never show a seam (bonus sky: #1d1650 only when the gradient starts below the top) */
  skyTop(bi: BiomeDef | null): string {
    if (bi) return bi.sky[0];
    return this.cssH - VIEW_H * this.scale > 0.5 ? '#1d1650' : '#2a1d6b';
  }

  private sprite(key: string, make: (res: number) => HTMLCanvasElement): HTMLCanvasElement {
    const res = Math.min(2.5, this.scale * this.dpr);
    return this.sprites.get(`${key}|${res}`, () => make(res));
  }

  /** sky gradient + stars/moon/fireworks + 4 tiled parallax layers (screen space, css px) */
  drawBiome(c: CanvasRenderingContext2D, bi: BiomeDef, alpha: number, camX: number, time: number, prewarm = true): void {
    if (time !== this.frameT) { this.frameT = time; this.budget = 1; }
    const sc = this.scale, gy = this.gy, W = this.cssW; this.readTransform(c);
    c.globalAlpha = alpha;
    this.blitSky(c, this.skyCanvas(bi));
    this.drawStars(c, bi, time, alpha);
    // celestial bodies (fixed on screen: they are "at infinity")
    if (bi.style === 'market') this.drawMoon(c, W * 0.8, gy - 335 * sc, 30, false, alpha);
    else if (bi.style === 'riverside') this.drawMoon(c, W * 0.7, gy - 330 * sc, 26, false, alpha);
    else if (bi.style === 'dawn') this.drawMoon(c, W * 0.66, gy - 205 * sc, 92, true, alpha * 0.9);
    else this.drawFireworks(c, camX, time, alpha);
    for (let li = 0; li < 4; li++) {
      const L = this.layer(bi, li); if (!L) continue;
      const top = LAYERS[bi.style][li].top;
      this.tiled(c, L, camX * PARALLAX[li], gy - top * sc, (top + BELOW) * sc);
      if (li === 1 && bi.style === 'riverside') this.drawMoonReflection(c, W * 0.7, gy + RIVER_TOP * sc, time, alpha);
      if (li === 1 && bi.style === 'dawn') this.drawBirds(c, time, alpha);
    }
    c.globalAlpha = 1;
    // pre-warm the next biome in the cycle with any budget left this frame
    // (not during a cross-fade: those frames draw two biomes already); this biome's device-resolution copies come first
    if (prewarm && this.budget > 0) {
      this.prescaleBiome(bi);
      const next = BIOMES[(BIOME_ORDER.indexOf(bi.id) + 1) % BIOMES.length];
      if (next && next.id !== bi.id) { for (let li = 0; li < 4 && this.budget > 0; li++) this.layer(next, li); this.prescaleBiome(next); this.prewarmExtras(next); }
    }
  }

  private blitSky(c: CanvasRenderingContext2D, sky: HTMLCanvasElement): void {
    const sm = c.imageSmoothingEnabled; c.imageSmoothingEnabled = false;
    c.drawImage(sky, 0, 0, this.cssW, this.cssH); c.imageSmoothingEnabled = sm;
  }

  /** draw a periodic layer (the top `sh` rows of canvas L) across the screen; tiles abut on whole device pixels (no
   *  seams, no overlap) */
  private tiled(c: CanvasRenderingContext2D, L: Layer, scroll: number, y: number, h: number): void {
    // work in device pixels (the context may carry a fractional camera translate): tiles abut exactly, and a
    // canvas painted at device resolution is blitted 1:1 (fast path, crisp)
    const a = this.ta, d = this.td; const cv = L.cv, sh = L.sh;
    const want = this.tileW * this.scale * a; const one = Math.abs(want - cv.width) <= 1.5 && Math.abs(h * d - sh) <= 2;
    const stepDev = one ? cv.width : Math.max(1, Math.round(want)); const hDev = one ? sh : h * d;
    const pre = !one && L.ps === 3 && L.px && L.pw === stepDev && L.ph === hDev ? L.px : null;   // the upscale, done once
    let off = -((scroll * this.scale * a) % stepDev); if (off > 0) off -= stepDev;
    const Y = Math.round(y * d + this.tf);
    let X = Math.round(off + this.te); while (X > this.te) X -= stepDev;
    for (const end = this.cssW * a + this.te; X < end; X += stepDev) {
      if (pre) c.drawImage(pre, (X - this.te) / a, (Y - this.tf) / d, pre.width / a, pre.height / d);
      else c.drawImage(cv, 0, 0, cv.width, sh, (X - this.te) / a, (Y - this.tf) / d, stepDev / a, hDev / d);
    }
  }
  /** drawImage snapped to device pixels (1:1 when the sprite was painted at device resolution) */
  private blit(c: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, w: number, h: number): void {
    const a = this.ta, d = this.td; let W = w * a, H = h * d;
    if (Math.abs(W - img.width) <= 1.5 && Math.abs(H - img.height) <= 1.5) { W = img.width; H = img.height; }
    const X = Math.round(x * a + this.te), Y = Math.round(y * d + this.tf);
    c.drawImage(img, (X - this.te) / a, (Y - this.tf) / d, W / a, H / d);
  }
  private readTransform(c: CanvasRenderingContext2D): void { const m = c.getTransform(); this.ta = m.a || 1; this.td = m.d || 1; this.te = m.e; this.tf = m.f; }

  private drawStars(c: CanvasRenderingContext2D, bi: BiomeDef, time: number, alpha: number): void {
    const n = STAR_N[bi.style];
    let st = this.stars.get(bi.id);
    if (!st) { const r = srng(bi.id.length * 131 + 7); st = new Float32Array(n * 4); for (let i = 0; i < n; i++) { st[i * 4] = r(); st[i * 4 + 1] = Math.pow(r(), 1.3); st[i * 4 + 2] = 1 + r() * 1.6; st[i * 4 + 3] = r() * 6.28; } this.stars.set(bi.id, st); }
    const top = 0, bot = this.gy - 250 * this.scale; if (bot <= top) return;
    const k = bi.style === 'dawn' ? 0.45 : 1; const cnt = this.lowFx ? n >> 1 : n;
    c.fillStyle = '#fff6dd';
    for (let i = 0; i < cnt; i++) {
      const tw = this.reduceMotion ? 0.8 : 0.6 + 0.4 * Math.sin(time * (1.3 + (i % 5) * 0.4) + st[i * 4 + 3]);
      c.globalAlpha = alpha * k * tw * (1 - st[i * 4 + 1] * 0.5);
      const s = st[i * 4 + 2]; c.fillRect(st[i * 4] * this.cssW, top + st[i * 4 + 1] * (bot - top), s, s);
    }
    c.globalAlpha = alpha;
  }

  /** a moon sprite, kept per radius (no key strings per frame) */
  private moonSprite(rad: number, pale: boolean): HTMLCanvasElement {
    const key = rad * (pale ? -1 : 1); let m = this.moons.get(key); const res = Math.min(2.5, this.scale * this.dpr);
    if (!m || m.res !== res) { m = { res, cv: this.sprite(`moon${rad}${pale}`, r => moonSprite(rad, r, pale)) }; this.moons.set(key, m); }
    return m.cv;
  }
  private drawMoon(c: CanvasRenderingContext2D, x: number, y: number, rad: number, pale: boolean, alpha: number): void {
    const spr = this.moonSprite(rad, pale);
    const R = rad * (pale ? 1.7 : 2.4) * this.scale; c.globalAlpha = alpha; this.blit(c, spr, x - R, y - R, R * 2, R * 2);
  }

  private drawMoonReflection(c: CanvasRenderingContext2D, x: number, y: number, time: number, alpha: number): void {
    const sc = this.scale; c.fillStyle = '#fff1c8';
    for (let k = 0; k < 6; k++) {
      const w = (34 - k * 4) * sc * (this.reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(time * 2 + k));
      c.globalAlpha = alpha * (0.34 - k * 0.045); c.fillRect(x - w / 2, y + (8 + k * 12) * sc, w, 2.5 * sc);
    }
    c.globalAlpha = alpha;
  }

  private drawFireworks(c: CanvasRenderingContext2D, camX: number, time: number, alpha: number): void {
    const sc = this.scale, gy = this.gy; const cols = FIREWORK_COLS;
    const slow = this.reduceMotion ? 1.8 : 1;
    for (let i = 0, n = this.lowFx ? 1 : 4; i < n; i++) {
      const P = (2.3 + i * 0.7) * slow; const tt = time + i * 1.37; const cyc = Math.floor(tt / P); const local = tt - cyc * P;
      const h = hash01(cyc * 7919 + i * 104729), h2 = hash01(cyc * 31 + i * 977 + 5);
      const x = ((h * 0.8 + 0.1) * this.cssW - camX * 0.02 * sc) % this.cssW; const xx = x < 0 ? x + this.cssW : x;
      const y = gy - (290 + h2 * 130) * sc; const [col, col2] = cols[(cyc + i) % cols.length];
      const rise = 0.55 * slow;
      if (local < rise) {
        if (this.reduceMotion) continue;
        const k = local / rise; c.globalAlpha = alpha * 0.9; c.fillStyle = col2; c.fillRect(xx - 1, y + (1 - k) * 160 * sc, 2, 6 * sc); continue;
      }
      const k = (local - rise) / (1.4 * slow); if (k > 1) continue;
      const spr = this.sprite(`fw${(cyc + i) % cols.length}`, res => burstSprite(80, res, col, col2));
      const s = (0.35 + 0.65 * (1 - Math.pow(1 - k, 3))) * (70 + h * 30) * sc; c.globalAlpha = alpha * Math.min(1, 1.6 * Math.pow(1 - k, 1.3));
      c.drawImage(spr, xx - s, y - s + k * k * 14 * sc, s * 2, s * 2);
    }
    c.globalAlpha = alpha;
  }

  private drawBirds(c: CanvasRenderingContext2D, time: number, alpha: number): void {
    const sc = this.scale, gy = this.gy; c.strokeStyle = 'rgba(58,44,78,0.75)'; c.lineWidth = Math.max(1, 1.8 * sc); c.lineJoin = 'round';
    c.globalAlpha = alpha; c.beginPath();
    for (let i = 0; i < 5; i++) {
      const sp = 0.018 + (i % 3) * 0.004; const u = this.reduceMotion ? i * 0.21 : ((i * 0.21 + time * sp) % 1.2) - 0.1;
      const x = u * this.cssW, y = gy - (262 + ((i * 37) % 60)) * sc + Math.sin(time * 1.1 + i) * 4 * sc;
      const f = this.reduceMotion ? 0.5 : Math.sin(time * 7 + i * 1.9); const s = (6 + (i % 2) * 2) * sc;
      c.moveTo(x - s, y - f * s * 0.6); c.quadraticCurveTo(x - s * 0.4, y - s * 0.2, x, y); c.quadraticCurveTo(x + s * 0.4, y - s * 0.2, x + s, y - f * s * 0.6);
    }
    c.stroke(); c.globalAlpha = alpha;
  }

  /** bonus-time sky 보름달 잔치 (screen space): huge moon, drifting clouds, floating 풍등, sparkles */
  drawBonusSky(c: CanvasRenderingContext2D, alpha: number, camX: number, time: number): void {
    if (time !== this.frameT) { this.frameT = time; this.budget = 1; }
    const sc = this.scale, gy = this.gy, W = this.cssW; this.readTransform(c);
    c.globalAlpha = alpha;
    this.blitSky(c, this.skyCanvas(null));
    // the moon (with the rabbit pounding rice cakes)
    const mr = 118; const spr = this.sprite('bonusMoon', res => moonSprite(mr, res, false, true));
    const R = mr * 2.4 * sc; const mx = W * 0.64, my = gy - 290 * sc; this.blit(c, spr, mx - R, my - R, R * 2, R * 2);
    // sparkles
    const sp = this.sprite('sparkle', res => sparkleSprite(res));
    const n = this.lowFx ? 8 : 18;
    for (let i = 0; i < n; i++) {
      const h0 = hash01(i * 4 + 1), h1 = hash01(i * 4 + 2), h2 = hash01(i * 4 + 3), h3 = hash01(i * 4 + 4);
      const x = ((h0 * 1.2 * W - camX * 0.04 * sc) % W + W) % W; const y = h1 * (gy - 140 * sc);
      const tw = this.reduceMotion ? 0.7 : Math.max(0, Math.sin(time * (1.5 + h2 * 2) + h3 * 6.3));
      if (tw <= 0.02) continue;
      const s = (6 + h2 * 8) * sc * (0.6 + 0.4 * tw); c.globalAlpha = alpha * tw; c.drawImage(sp, x - s, y - s, s * 2, s * 2);
    }
    c.globalAlpha = alpha;
    // cloud banks (two tiled layers)
    for (let li = 0; li < 2; li++) {
      const L = this.bonusCloudLayer(li); const top = li ? 150 : 230;
      this.tiled(c, L, camX * (li ? 0.3 : 0.12), gy - top * sc, (top + BELOW) * sc);
      if (li === 0) this.drawSkyLanterns(c, camX, time, alpha);
    }
    c.globalAlpha = 1;
  }

  private cloudJob(li: number): Job {
    let job = this.clouds[li]; if (job) return job;
    const W = this.tileW, top = li ? 150 : 230; const res = Math.min(Math.min(2.5, this.scale * this.dpr), li ? 2 : 1.25);
    const [cv, g] = makeCanvas(W, top + BELOW, res); g.clearRect(0, 0, 1, 1); g.save(); g.translate(0, top);      // (allocates the pixels now)
    job = { L: { ...layerOf(cv, cv.height), ps: 3 }, g, paint: r => paintClouds(r, W, li), W, ops: null, at: 0, flushed: false, done: false };
    return (this.clouds[li] = job);
  }
  private bonusCloudLayer(li: number): Layer {
    const job = this.cloudJob(li); if (!job.done) this.advance(job, true);
    return job.L;
  }

  private drawSkyLanterns(c: CanvasRenderingContext2D, camX: number, time: number, alpha: number): void {
    const spr = this.sprite('skyLantern', res => skyLanternSprite(res));
    const sc = this.scale, W = this.cssW, gy = this.gy; const n = this.lowFx ? 6 : 12;
    for (let i = 0; i < n; i++) {
      const depth = 0.35 + hash01(i * 3 + 101) * 0.65; const s = 44 * depth * sc;
      const x = ((hash01(i * 3 + 102) * W * 1.3 - camX * 0.08 * depth * sc + (this.reduceMotion ? 0 : Math.sin(time * 0.7 + i) * 8 * sc)) % (W + s * 2) + W + s * 2) % (W + s * 2) - s;
      const range = gy - 60 * sc; const y = range - ((hash01(i * 3 + 103) * range + (this.reduceMotion ? 0 : time * 14 * depth * sc)) % (range + s * 2)) + s;
      c.globalAlpha = alpha * (0.55 + 0.45 * depth) * (this.reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(time * 5 + i * 2.1));
      c.drawImage(spr, x - s / 2, y - s * 0.57, s, s * 1.14);
    }
    c.globalAlpha = alpha;
  }

  // ------------------------------------------------------------ world space
  private groundTile(st: GroundStyle, bi: BiomeDef, res: number): HTMLCanvasElement {
    return this.sprites.get(`gt|${st}|${bi.id}|${res}`, () => { const [cv, g] = makeCanvas(GT_W, GT_H, res); paintGroundTile(g, st, pal(bi)); return cv; });
  }
  private platformSprite(st: GroundStyle, bi: BiomeDef, w: number, res: number): HTMLCanvasElement {
    return this.sprites.get(`pl|${st}|${bi.id}|${w}|${res}`, () => { const [cv, g] = makeCanvas(w + 8, PL_H, res); g.translate(4, 0); paintPlatform(g, st, pal(bi), w); return cv; });
  }

  /** ground, pits, one-way platforms and the finish gate (world space; ctx already transformed). Every piece wears
   *  the skin of the chunk it belongs to (as hazards do), so a biome seam scrolls in with the new chunk instead of the
   *  whole floor swapping on the frame the runner crosses it; `bi` (the runner's biome) skins the finish gate and the
   *  bonus sky. */
  drawGround(c: CanvasRenderingContext2D, s: RunState, bi: BiomeDef, x0: number, x1: number, sky: boolean, time: number): void {
    const res = worldRes(c);
    const chunks = s.level.chunks;
    const biAt = (x: number): BiomeDef => {   // the chunk covering world x (chunks are placed left to right, ≤ ~12 kept)
      if (sky) return bi;
      for (let k = chunks.length - 1; k >= 0; k--) if (x >= chunks[k].x) return BIOME_BY_ID[chunks[k].biome] ?? bi;
      return chunks.length ? BIOME_BY_ID[chunks[0].biome] ?? bi : bi;
    };
    const stOf = (b: BiomeDef): GroundStyle => (sky ? 'sky' : b.style);
    // true when ground at x opens a chunk with nothing, or a bonus-sky chunk, right before it: run start, bonus return
    const startsCourse = (x: number): boolean => {
      for (let k = chunks.length - 1; k >= 0; k--) {
        const ch = chunks[k];
        if (x >= ch.x && x < ch.x + ch.width) return x - ch.x < 1 && (k === 0 || chunks[k - 1].sky);
      }
      return false;
    };
    const bridged = !sky && (s.rescue > 0 || s.power.giant > 0 || s.power.dash > 0);
    let prev: { x0: number; x1: number } | null = null;
    const solids = s.level.solids;
    for (let i = 0; i < solids.length; i++) {
      const so = solids[i];
      if (!so.ground) continue;
      // pit between the previous ground run and this one (split at chunk joins: each part takes its own chunk's skin)
      if (prev && so.x0 - prev.x1 > 1 && so.x0 - prev.x1 < 2400 && so.x0 > x0 && prev.x1 < x1) {
        let a = prev.x1;
        while (a < so.x0) {
          const pb = biAt(a); let b = so.x0;
          for (const ch of chunks) if (ch.x > a && ch.x < b) { b = ch.x; break; }
          this.drawPit(c, stOf(pb), pal(pb), a, b, x0, x1, time, bridged, res);
          a = b;
        }
      }
      // nothing is generated behind the course start or a bonus return: extend the first ground run leftwards as a
      // lead-in instead of leaving a flat block that reads as a pit right behind the runner
      const lead = !prev && !sky && so.x0 > x0 - 20 && startsCourse(so.x0);
      const adjL = lead || (!!prev && Math.abs(prev.x1 - so.x0) < 1);
      prev = so;
      if (so.x1 < x0 || so.x0 > x1) continue;
      const sb = biAt(so.x0), st = stOf(sb), P = pal(sb);
      const tile = this.groundTile(st, sb, res); const th = tile.height / res;
      // texture tiles anchored to world x (seamless across chunk joins of one biome)
      const a = lead ? x0 - 20 : Math.max(so.x0, x0 - 20), b = Math.min(so.x1, x1 + 20);
      for (let tx = Math.floor(a / GT_W) * GT_W; tx < b; tx += GT_W) {
        const u0 = Math.max(a, tx), u1 = Math.min(b, tx + GT_W); if (u1 <= u0) continue;
        c.drawImage(tile, (u0 - tx) * res, 0, (u1 - u0) * res, tile.height, u0, GROUND_Y - GT_UP, u1 - u0 + (u1 < b ? 0.5 : 0), th);
      }
      // pit edges: dark cliff face + a bright rounded lip so gaps read instantly
      let adjR = false; for (let j = i + 1; j < solids.length && solids[j].x0 <= so.x1 + 1; j++) if (solids[j].ground && Math.abs(solids[j].x0 - so.x1) < 1) { adjR = true; break; }
      if (!adjL && so.x0 > x0 - 20) this.drawEdge(c, st, P, so.x0, 1, res);
      if (!adjR && so.x1 < x1 + 20) this.drawEdge(c, st, P, so.x1, -1, res);
    }
    // one-way platforms
    for (const so of solids) {
      if (so.ground || so.x1 < x0 || so.x0 > x1) continue;
      const pb = biAt(so.x0);
      const w = Math.round(so.x1 - so.x0); const spr = this.platformSprite(stOf(pb), pb, w, res);
      c.drawImage(spr, so.x0 - 4, so.top - PL_UP, spr.width / res, spr.height / res);
    }
    // finish gate
    if (s.level.finishX !== Infinity && s.level.finishX > x0 - 300 && s.level.finishX < x1 + 200) this.drawFinish(c, s.level.finishX + 5 * TILE - 84, pal(bi), time);   // the runner stops (sim: finishX + 5 tiles) under the banner
  }

  private drawPit(c: CanvasRenderingContext2D, st: GroundStyle, P: Pal, a: number, b: number, x0: number, x1: number, time: number, bridged: boolean, res: number): void {
    const L = Math.max(a, x0 - 10), R = Math.min(b, x1 + 10); if (R <= L) return;
    const bottom = VIEW_H + 30;
    if (st === 'sky') {
      c.fillStyle = 'rgba(120,80,200,0.25)'; c.fillRect(L, GROUND_Y + 10, R - L, bottom - GROUND_Y);
      return;
    }
    const col = this.sprites.get(`pit|${st}|${P.id}|${res}`, () => { const [cv, g] = makeCanvas(8, PIT_H, res); paintPitColumn(g, st, P); return cv; });
    c.drawImage(col, L, GROUND_Y - 2, R - L, PIT_H);
    if (st === 'riverside') {
      // ripples on the dark water far below
      c.fillStyle = 'rgba(160,210,255,0.28)';
      for (let x = a + 10; x < b - 14; x += 26) { const w = 10 + ((x * 7) % 9); const yy = GROUND_Y + 72 + ((x * 13) % 22) + Math.sin(time * 2 + x) * 1.5; if (x > L - 30 && x < R) c.fillRect(x, yy, w, 2); }
    } else if (st === 'bridge') {
      // river lights far below
      c.fillStyle = 'rgba(255,210,140,0.45)'; for (let x = a + 14; x < b - 6; x += 37) if (x > L && x < R) c.fillRect(x, GROUND_Y + 80 + ((x * 11) % 18), 2, 2);
    }
    if (bridged) {
      // pits are bridged while rescue / giant / dash is active: a glowing plank bridge
      c.fillStyle = 'rgba(255,214,110,0.22)'; c.fillRect(L, GROUND_Y - 16, R - L, 34);
      c.fillStyle = 'rgba(255,200,90,0.95)'; for (let x = Math.floor(L / 20) * 20; x < R; x += 20) c.fillRect(Math.max(L, x + 2), GROUND_Y, Math.min(16, R - x - 2), 9);
      c.fillStyle = '#fff0b8'; c.fillRect(L, GROUND_Y - 4, R - L, 4);
    }
  }

  private drawEdge(c: CanvasRenderingContext2D, st: GroundStyle, P: Pal, x: number, dir: 1 | -1, res: number): void {
    const spr = this.sprites.get(`edge|${st}|${P.id}|${dir}|${res}`, () => { const [cv, g] = makeCanvas(EDGE_W, EDGE_H, res); paintEdge(g, st, P, dir); return cv; });
    c.drawImage(spr, dir > 0 ? x : x - EDGE_W, GROUND_Y - EDGE_UP, EDGE_W, EDGE_H);
  }

  private drawFinish(c: CanvasRenderingContext2D, fx: number, P: Pal, time: number): void {
    const gy = GROUND_Y; const H = 190, span = 150;
    // two festival poles + banner
    c.fillStyle = '#4a2c22'; c.fillRect(fx - 4, gy - H, 8, H); c.fillRect(fx + span - 4, gy - H, 8, H);
    c.fillStyle = '#f7d774'; c.beginPath(); c.arc(fx, gy - H - 4, 7, 0, Math.PI * 2); c.arc(fx + span, gy - H - 4, 7, 0, Math.PI * 2); c.fill();
    const sway = this.reduceMotion ? 0 : Math.sin(time * 3) * 3;
    c.fillStyle = '#c0392b'; c.beginPath(); c.moveTo(fx, gy - H + 8); c.quadraticCurveTo(fx + span / 2, gy - H + 22 + sway, fx + span, gy - H + 8); c.lineTo(fx + span, gy - H + 52); c.quadraticCurveTo(fx + span / 2, gy - H + 66 + sway, fx, gy - H + 52); c.closePath(); c.fill();
    c.strokeStyle = '#f7d774'; c.lineWidth = 3; c.stroke();
    c.font = `900 26px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff6e0';
    c.fillText('도착', fx + span / 2, gy - H + 38 + sway);
    // lanterns hanging from the banner
    for (let k = 0; k < 3; k++) { const lx = fx + 30 + k * 45; const ly = gy - H + 82 + (k === 1 ? 6 : 0) + sway; c.fillStyle = '#3b2a3a'; c.fillRect(lx - 0.5, ly - 20, 1, 12); c.fillStyle = k === 1 ? '#3e7cc9' : '#e0524f'; c.beginPath(); c.ellipse(lx, ly, 8, 10, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(lx - 4, ly - 6, 2, 8); }
    // checkered flag on the right pole
    const wave = this.reduceMotion ? 0 : Math.sin(time * 6) * 4;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { c.fillStyle = (i + j) % 2 ? '#fff6e0' : '#231a2a'; c.fillRect(fx + span + 4 + i * 12, gy - H + 60 + j * 11 + (i * wave) / 4, 12, 11); }
    // 뚝딱이 the dokkaebi cheering by the gate
    const bx = fx + 150 + 84, by = gy;   // past the flag, clear of where the runner stops
    const hop = this.reduceMotion ? 0 : Math.abs(Math.sin(time * 5)) * 6;
    c.save(); c.translate(bx, by - hop);
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(0, hop + 1, 16, 4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5bb8a6'; c.beginPath(); c.ellipse(0, -22, 17, 21, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f5e6c8'; c.beginPath(); c.moveTo(-4, -40); c.lineTo(0, -54); c.lineTo(4, -40); c.closePath(); c.fill();
    c.fillStyle = '#231a2a'; c.beginPath(); c.arc(-6, -26, 2.6, 0, Math.PI * 2); c.arc(6, -26, 2.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff'; c.fillRect(-7, -27.5, 1.3, 1.3); c.fillRect(5, -27.5, 1.3, 1.3);
    c.fillStyle = '#c0392b'; c.beginPath(); c.arc(0, -17, 5, 0, Math.PI); c.fill();
    c.fillStyle = 'rgba(255,120,140,0.5)'; c.beginPath(); c.arc(-11, -19, 3, 0, Math.PI * 2); c.arc(11, -19, 3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e8a33c'; c.fillRect(-15, -8, 30, 6);
    // raised 방망이 club
    c.strokeStyle = '#4a9d8c'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(9, -22); c.lineTo(14, -30); c.stroke(); c.lineCap = 'butt';
    c.save(); c.translate(14, -30); c.rotate(-0.5 + (this.reduceMotion ? 0 : Math.sin(time * 5) * 0.3));
    c.fillStyle = '#8a5a3c'; c.fillRect(-2, -20, 4, 20); c.fillStyle = '#a86b4a'; rr(c, -6, -34, 12, 17, 5); c.fill();
    c.fillStyle = '#f7d774'; c.fillRect(-4, -30, 2, 2); c.fillRect(2, -24, 2, 2);
    c.restore(); c.restore();
  }
}

if (typeof window !== 'undefined') { const w = window as unknown as { __world?: Record<string, unknown> }; Object.assign((w.__world ??= {}), { Backdrop, BIOMES, drawCharacter, CHAR_BY_ID }); }
