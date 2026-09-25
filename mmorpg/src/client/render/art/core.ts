// Procedural art core: texture records, caching, drawing helpers and the lighting post-pass (rim light / shade / ground AO).
export type Ctx = CanvasRenderingContext2D;
export interface Tex { key: string; id: number; cv: HTMLCanvasElement; w: number; h: number; ax: number; ay: number; solo?: boolean; ver?: number }
let nextId = 1;
export const newId = (): number => nextId++;
export const INK = '#120c1c';

export function canvas(w: number, h: number): HTMLCanvasElement { const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(w)); cv.height = Math.max(1, Math.ceil(h)); return cv; }
export function makeTex(key: string, w: number, h: number, ax: number, ay: number, px: number, draw: (c: Ctx) => void, post?: PostOpts): Tex {
  const pad = post ? 3 : 0; // room for the rim pass
  const cv = canvas((w + pad * 2) * px, (h + pad * 2) * px); const c = cv.getContext('2d')!;
  c.scale(px, px); c.translate(pad, pad); c.lineJoin = 'round'; c.lineCap = 'round'; draw(c);
  if (post) light(cv, px, post);
  return { key, id: newId(), cv, w: w + pad * 2, h: h + pad * 2, ax: (ax * w + pad) / (w + pad * 2), ay: (ay * h + pad) / (h + pad * 2) };
}
export interface PostOpts { rim?: string; rimA?: number; shade?: number; ao?: number; d?: number }
/** Moonlight from the upper left: a bright rim on up-left edges, a shade band on low-right edges, darker feet. */
export function light(cv: HTMLCanvasElement, px: number, o: PostOpts): void {
  const W = cv.width, H = cv.height, d = Math.max(1, Math.round((o.d ?? 2.2) * px)); const c = cv.getContext('2d')!;
  const band = (dx: number, dy: number, color: string, alpha: number) => {
    const b = canvas(W, H), bc = b.getContext('2d')!; bc.drawImage(cv, 0, 0); bc.globalCompositeOperation = 'destination-out'; bc.drawImage(cv, dx, dy);
    bc.globalCompositeOperation = 'source-in'; bc.fillStyle = color; bc.fillRect(0, 0, W, H);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = alpha; c.globalCompositeOperation = 'source-atop'; c.drawImage(b, 0, 0); c.restore();
  };
  if (o.shade) band(-d, -d, '#0b0716', o.shade);
  if (o.rimA ?? 0.55) band(d, d, o.rim ?? '#bcd6ff', o.rimA ?? 0.55);
  if (o.ao) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; const g = c.createLinearGradient(0, H * 0.55, 0, H); g.addColorStop(0, 'rgba(10,6,24,0)'); g.addColorStop(1, `rgba(10,6,24,${o.ao})`); c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore(); }
}
/** White silhouette (hit flash) and tinted variants for the 2D fallback. */
export function silhouette(t: Tex, color = '#ffffff'): HTMLCanvasElement { const cv = canvas(t.cv.width, t.cv.height), c = cv.getContext('2d')!; c.drawImage(t.cv, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = color; c.fillRect(0, 0, cv.width, cv.height); return cv; }
export function tinted(t: Tex, color: string): HTMLCanvasElement { const cv = canvas(t.cv.width, t.cv.height), c = cv.getContext('2d')!; c.drawImage(t.cv, 0, 0); c.globalCompositeOperation = 'multiply'; c.fillStyle = color; c.fillRect(0, 0, cv.width, cv.height); c.globalCompositeOperation = 'destination-in'; c.drawImage(t.cv, 0, 0); return cv; }

// ---------- colour ----------
export function rgb(hex: string): [number, number, number] { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function shade(hex: string, amt: number): string { const [r, g, b] = rgb(hex); const f = (v: number) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)); return `rgb(${f(r)},${f(g)},${f(b)})`; }
export const hexNum = (hex: string): number => parseInt(hex.slice(1), 16);

// ---------- shapes ----------
/** Fill with a volume gradient (light top-left → dark bottom-right) and ink outline. */
export function vol(c: Ctx, base: string, x0: number, y0: number, x1: number, y1: number, lw = 2.2, outline: string | null = INK, hi = 0.22, lo = -0.28): void {
  const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, shade(base, hi)); g.addColorStop(0.45, base); g.addColorStop(1, shade(base, lo));
  c.fillStyle = g; c.fill(); if (outline) { c.strokeStyle = outline; c.lineWidth = lw; c.stroke(); }
}
export function circle(c: Ctx, x: number, y: number, r: number): void { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); }
export function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }
export function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number): void { c.beginPath(); c.roundRect(x, y, w, h, r); }
export function poly(c: Ctx, pts: number[]): void { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
export function fillC(c: Ctx, fill: string | CanvasGradient, stroke: string | null = INK, lw = 2): void { c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } }
export function line(c: Ctx, pts: number[], color: string, lw: number): void { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.strokeStyle = color; c.lineWidth = lw; c.stroke(); }
export function inkLine(c: Ctx, pts: number[], color: string, lw: number): void { line(c, pts, INK, lw + 2.4); line(c, pts, color, lw); }
export function glowDot(c: Ctx, x: number, y: number, r: number, color: string): void { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
/** Anime-style eye: sclera, gradient iris, pupil, two catch-lights. */
export function eye(c: Ctx, x: number, y: number, s: number, iris: string, mode: 'open' | 'blink' | 'hurt' | 'fierce' | 'glow' = 'open', flip = false): void {
  if (mode === 'blink') { line(c, [x - s * 0.9, y + s * 0.2, x, y + s * 0.5, x + s * 0.9, y + s * 0.2], INK, 1.6); return; }
  if (mode === 'hurt') { const k = flip ? -1 : 1; line(c, [x - s * 0.8 * k, y - s * 0.6, x + s * 0.6 * k, y, x - s * 0.8 * k, y + s * 0.6], INK, 1.7); return; }
  ellipse(c, x, y, s * 0.82, s); c.fillStyle = '#fbfaff'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.3; c.stroke();
  const g = c.createLinearGradient(x, y - s, x, y + s); g.addColorStop(0, shade(iris, -0.45)); g.addColorStop(1, shade(iris, 0.25));
  ellipse(c, x + s * 0.12, y + s * 0.08, s * 0.58, s * 0.8); c.fillStyle = mode === 'glow' ? iris : g; c.fill();
  ellipse(c, x + s * 0.15, y + s * 0.12, s * 0.28, s * 0.42); c.fillStyle = mode === 'glow' ? '#fff' : '#120c1c'; c.fill();
  circle(c, x - s * 0.18, y - s * 0.35, s * 0.24); c.fillStyle = '#fff'; c.fill(); circle(c, x + s * 0.32, y + s * 0.42, s * 0.12); c.fill();
  if (mode === 'fierce') line(c, [x - s * 1.05, y - s * 1.35, x + s * 0.8, y - s * 0.95], INK, 1.9);
  else line(c, [x - s * 0.95, y - s * 1.25, x + s * 0.7, y - s * 1.3], INK, 1.5);
}
export function blush(c: Ctx, x: number, y: number): void { c.globalAlpha = 0.35; ellipse(c, x, y, 3.2, 1.8); c.fillStyle = '#ff7aa2'; c.fill(); c.globalAlpha = 1; }
