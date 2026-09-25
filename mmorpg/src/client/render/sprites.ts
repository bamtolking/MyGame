// All art is procedural (Canvas 2D paths), cached on offscreen canvases at the current render scale.
import type { ClassId, TalKind, GearSlot } from '../../shared/types.ts';
import { TALS } from '../../shared/data/talismans.ts';

export type Ctx = CanvasRenderingContext2D;
export interface Spr { cv: HTMLCanvasElement; w: number; h: number; ox: number; oy: number }
const OUT = '#1b1426';

export class Sprites {
  scale = 1; private cache = new Map<string, Spr>();
  setScale(s: number): void { if (Math.abs(s - this.scale) > 0.01) { this.scale = s; this.cache.clear(); } }
  get(key: string, w: number, h: number, ox: number, oy: number, draw: (c: Ctx) => void, scale = this.scale): Spr {
    const k = key + '@' + scale.toFixed(2); let s = this.cache.get(k); if (s) return s;
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(w * scale)); cv.height = Math.max(1, Math.ceil(h * scale));
    const c = cv.getContext('2d')!; c.scale(scale, scale); c.lineJoin = 'round'; c.lineCap = 'round'; draw(c);
    s = { cv, w, h, ox, oy }; this.cache.set(k, s); return s;
  }
  /** White silhouette of a sprite for hit flashes. */
  flash(base: Spr, key: string): Spr {
    return this.get(key + ':flash', base.w, base.h, base.ox, base.oy, c => { c.drawImage(base.cv, 0, 0, base.w, base.h); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillRect(0, 0, base.w, base.h); });
  }
  glow(color: string, r: number): Spr {
    return this.get(`glow:${color}:${r}`, r * 2, r * 2, r, r, c => { const g = c.createRadialGradient(r, r, 0, r, r, r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, r * 2, r * 2); }, Math.min(this.scale, 1));
  }
  player(cls: ClassId): Spr { return this.get('pl:' + cls, 48, 58, 24, 54, c => drawPlayer(c, cls)); }
  monster(key: string): Spr { const d = MON_DRAW[key] ?? MON_DRAW.imp; return this.get('mon:' + key, d.w, d.h, d.w / 2, d.h - 4, d.draw); }
  prop(key: string, v = 0): Spr { const d = PROP_DRAW[key]; return this.get(`prop:${key}:${v}`, d.w, d.h, d.w / 2, d.h - (d.base ?? 6), c => d.draw(c, v)); }
  npc(kind: string): Spr { return this.get('npc:' + kind, 48, 60, 24, 56, c => drawNpc(c, kind)); }
  house(w: number, h: number, v: number): Spr { const W = w * 32, H = h * 32 + 34; return this.get(`house:${w}:${h}:${v}`, W + 16, H + 8, 8, 34, c => drawHouse(c, w * 32, h * 32, v)); }
}

// ---------- helpers ----------
function circ(c: Ctx, x: number, y: number, r: number, fill: string | CanvasGradient, stroke: string | null = OUT, lw = 2) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } }
function ell(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, stroke: string | null = OUT, lw = 2, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } }
function poly(c: Ctx, pts: number[], fill: string | CanvasGradient, stroke: string | null = OUT, lw = 2) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } }
function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke: string | null = OUT, lw = 2) { c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } }
function line(c: Ctx, pts: number[], color: string, lw: number) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.strokeStyle = color; c.lineWidth = lw; c.stroke(); }
function eyes(c: Ctx, x: number, y: number, gap: number, r: number, color = '#1b1426', shine = true) {
  for (const s of [-1, 1]) { ell(c, x + s * gap, y, r * 0.8, r, color, null); if (shine) circ(c, x + s * gap - r * 0.25, y - r * 0.35, r * 0.32, '#fff', null); }
}
function angryEyes(c: Ctx, x: number, y: number, gap: number, r: number, iris: string) {
  for (const s of [-1, 1]) { ell(c, x + s * gap, y, r, r * 0.8, '#fffbe6', OUT, 1.2); circ(c, x + s * gap + 0.6, y + 0.4, r * 0.5, iris, null); line(c, [x + s * (gap + r + 1), y - r - 2, x + s * (gap - r * 0.7), y - r + 1], OUT, 2); }
}
function blush(c: Ctx, x: number, y: number, gap: number) { c.globalAlpha = 0.45; ell(c, x - gap, y, 3, 1.8, '#ff7aa2', null); ell(c, x + gap, y, 3, 1.8, '#ff7aa2', null); c.globalAlpha = 1; }
function shade(c: Ctx, draw: () => void, color = 'rgba(0,0,0,0.18)') { c.save(); c.clip(); c.fillStyle = color; draw(); c.restore(); }

// ---------- players ----------
function drawPlayer(c: Ctx, cls: ClassId) {
  const X = 24;
  // legs
  rr(c, X - 8, 44, 6, 10, 3, '#2b2233'); rr(c, X + 2, 44, 6, 10, 3, '#2b2233');
  if (cls === 'sword') {
    // sheathed hwando behind
    line(c, [X + 6, 30, X + 20, 48], OUT, 5); line(c, [X + 6, 30, X + 20, 48], '#4a2c1c', 3); line(c, [X + 3, 27, X + 8, 33], '#c9a54a', 4);
    poly(c, [X - 12, 30, X + 12, 30, X + 15, 50, X - 15, 50], '#3a5fc8');
    c.save(); c.beginPath(); c.moveTo(X - 12, 30); c.lineTo(X + 12, 30); c.lineTo(X + 15, 50); c.lineTo(X - 15, 50); c.closePath(); c.clip(); c.fillStyle = '#2d4aa0'; c.fillRect(X, 30, 16, 22); c.restore();
    line(c, [X - 5, 30, X, 38, X + 5, 30], '#f4f1e8', 3); line(c, [X - 13, 42, X + 13, 42], '#1b1f3b', 3);
    circ(c, X, 21, 12, '#ffe3c8'); eyes(c, X, 22, 4.8, 2.4); blush(c, X, 26, 7);
    // gat: translucent black brim + crown
    ell(c, X, 13, 20, 5.5, 'rgba(20,16,30,0.82)', OUT, 1.5); rr(c, X - 7.5, 1, 15, 12, 5, '#1b1426', OUT, 1.5); line(c, [X - 7, 10, X + 7, 10], '#5b4d7a', 1.5);
    line(c, [X - 9, 16, X - 7, 30], 'rgba(40,30,60,0.8)', 1); line(c, [X + 9, 16, X + 7, 30], 'rgba(40,30,60,0.8)', 1);
  } else if (cls === 'archer') {
    // quiver
    rr(c, X - 16, 22, 7, 18, 3, '#7a4a28'); line(c, [X - 14, 22, X - 16, 15], '#f2e3c2', 2); line(c, [X - 11, 22, X - 11, 14], '#f2e3c2', 2);
    poly(c, [X - 11, 30, X + 11, 30, X + 14, 50, X - 14, 50], '#2f9e5f');
    rr(c, X - 9, 31, 18, 12, 3, '#8a5a34', OUT, 1.5); line(c, [X - 13, 43, X + 13, 43], '#5a3a1e', 3);
    circ(c, X, 21, 12, '#ffe3c8'); eyes(c, X, 22, 4.8, 2.4); blush(c, X, 26, 7);
    c.beginPath(); c.arc(X, 17, 12.5, Math.PI * 1.05, Math.PI * 1.95); c.fillStyle = '#2b2233'; c.fill(); circ(c, X, 5, 4.5, '#2b2233', OUT, 1.5);
    line(c, [X - 12, 13, X + 12, 13], '#e0344d', 3); line(c, [X + 11, 13, X + 16, 18], '#e0344d', 2.5);
    // bow
    c.beginPath(); c.arc(X + 12, 36, 15, -1.15, 1.15); c.strokeStyle = OUT; c.lineWidth = 4.5; c.stroke(); c.strokeStyle = '#b3743a'; c.lineWidth = 2.5; c.stroke();
    line(c, [X + 18, 22.5, X + 18, 49.5], '#f7f2e0', 1);
  } else {
    // shaman: white jeogori, red skirt, bells + fan
    poly(c, [X - 13, 36, X + 13, 36, X + 17, 52, X - 17, 52], '#d8344d');
    rr(c, X - 11, 29, 22, 10, 4, '#f7f3ea'); line(c, [X, 30, X + 4, 38], '#d8344d', 2.5);
    line(c, [X - 3, 38, X - 6, 46], '#ffcf3f', 2);
    circ(c, X, 21, 12, '#ffe3c8'); eyes(c, X, 22, 4.8, 2.4); blush(c, X, 26, 7);
    c.beginPath(); c.arc(X, 18, 12.5, Math.PI * 1.02, Math.PI * 1.98); c.fillStyle = '#2b2233'; c.fill();
    circ(c, X + 7, 8, 5, '#2b2233', OUT, 1.5); line(c, [X + 1, 6, X + 14, 10], '#ffcf3f', 2);
    line(c, [X - 11, 15, X - 16, 30], '#d8344d', 3); // daenggi ribbon
    // bells in hand
    line(c, [X + 13, 34, X + 18, 28], '#7a4a28', 2); for (const [bx, by] of [[X + 17, 26], [X + 21, 28], [X + 19, 23]]) circ(c, bx, by, 2.8, '#ffd54a', OUT, 1.2);
    // fan
    c.beginPath(); c.moveTo(X - 13, 40); c.arc(X - 13, 40, 11, Math.PI * 1.05, Math.PI * 1.55); c.closePath(); c.fillStyle = '#4a7bd8'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
  }
}

// ---------- monsters ----------
interface MD { w: number; h: number; draw: (c: Ctx) => void }
function flame(c: Ctx, x: number, y: number, r: number, outer: string, inner: string, core: string) {
  const g = c.createRadialGradient(x, y + r * 0.3, 1, x, y, r * 1.6); g.addColorStop(0, core); g.addColorStop(0.35, inner); g.addColorStop(1, outer);
  c.beginPath(); c.moveTo(x, y - r * 1.9); c.bezierCurveTo(x + r * 0.5, y - r * 1.1, x + r * 1.15, y - r * 0.4, x + r, y + r * 0.2);
  c.arc(x, y + r * 0.2, r, 0, Math.PI); c.bezierCurveTo(x - r * 1.15, y - r * 0.4, x - r * 0.3, y - r * 0.9, x - r * 0.15, y - r * 1.4);
  c.quadraticCurveTo(x - r * 0.05, y - r * 1.2, x, y - r * 1.9); c.fillStyle = g; c.fill();
}
const MON_DRAW: Record<string, MD> = {
  wisp: { w: 32, h: 38, draw: c => { flame(c, 16, 22, 10, 'rgba(60,140,255,0.15)', '#6fc0ff', '#eaf6ff'); eyes(c, 16, 24, 3.6, 2.2, '#123'); } },
  bogwisp: { w: 32, h: 38, draw: c => { flame(c, 16, 22, 10, 'rgba(100,255,80,0.15)', '#9dff6a', '#f4ffe0'); angryEyes(c, 16, 23, 3.8, 2.4, '#2a5a10'); c.beginPath(); c.arc(16, 29, 3, 0, Math.PI); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke(); } },
  foxfire: { w: 34, h: 40, draw: c => { poly(c, [8, 16, 11, 5, 15, 14], '#ff8a2a', null); poly(c, [26, 16, 23, 5, 19, 14], '#ff8a2a', null); flame(c, 17, 24, 11, 'rgba(255,120,40,0.15)', '#ff9a3c', '#fff1c8'); ell(c, 12.5, 25, 2.6, 1.4, OUT, null, 1, -0.3); ell(c, 21.5, 25, 2.6, 1.4, OUT, null, 1, 0.3); } },
  imp: { w: 38, h: 44, draw: c => {
    rr(c, 11, 34, 6, 8, 3, '#b8322a'); rr(c, 21, 34, 6, 8, 3, '#b8322a');
    ell(c, 19, 31, 11, 8, '#e0473a'); rr(c, 10, 31, 18, 7, 3, '#ffc53d', OUT, 1.5); for (let i = 0; i < 4; i++) line(c, [12 + i * 4.5, 31, 13 + i * 4.5, 37], OUT, 1.5);
    circ(c, 19, 19, 11, '#e0473a'); poly(c, [16, 9, 19, 0, 22, 9], '#ffe08a'); c.beginPath(); c.arc(19, 17, 11.5, Math.PI * 1.1, Math.PI * 1.9); c.fillStyle = '#3a2438'; c.fill();
    angryEyes(c, 19, 20, 4.5, 2.6, '#ffcc00'); poly(c, [15, 25, 17, 28, 19, 25, 21, 28, 23, 25], '#fff', OUT, 1);
    line(c, [29, 28, 35, 14], OUT, 6); line(c, [29, 28, 35, 14], '#9a6a3a', 4); } },
  clubber: { w: 54, h: 58, draw: c => {
    rr(c, 17, 46, 8, 10, 3, '#2a4f9a'); rr(c, 30, 46, 8, 10, 3, '#2a4f9a');
    ell(c, 27, 40, 16, 11, '#3f73d8'); rr(c, 13, 40, 28, 8, 3, '#ffc53d', OUT, 1.5); for (let i = 0; i < 6; i++) line(c, [15 + i * 4.5, 40, 16 + i * 4.5, 47], OUT, 1.5);
    circ(c, 27, 24, 14, '#3f73d8'); poly(c, [16, 14, 13, 2, 21, 11], '#fff0b0'); poly(c, [38, 14, 41, 2, 33, 11], '#fff0b0');
    c.beginPath(); c.arc(27, 22, 14.5, Math.PI * 1.15, Math.PI * 1.85); c.fillStyle = '#2b1f3a'; c.fill();
    angryEyes(c, 27, 25, 6, 3.2, '#ff3b3b'); poly(c, [21, 31, 24, 35, 27, 31, 30, 35, 33, 31], '#fff', OUT, 1);
    // spiked club
    c.save(); c.translate(45, 34); c.rotate(-0.5); rr(c, -4, -24, 9, 30, 4, '#a56a36'); for (let i = 0; i < 4; i++) { circ(c, -5, -20 + i * 6, 2, '#ddd', OUT, 1); circ(c, 6, -18 + i * 6, 2, '#ddd', OUT, 1); } c.restore(); } },
  toad: { w: 48, h: 42, draw: c => {
    ell(c, 24, 28, 19, 12, '#5d7a3a'); shade(c, () => c.fillRect(0, 30, 48, 12));
    for (const [x, y] of [[14, 24], [30, 22], [22, 33], [34, 30], [12, 32]]) circ(c, x, y, 2.2, '#7e9c4c', null);
    ell(c, 24, 34, 12, 5, '#d9d08a', null);
    circ(c, 15, 16, 6, '#5d7a3a'); circ(c, 33, 16, 6, '#5d7a3a'); circ(c, 15, 16, 3.6, '#ffc93a', OUT, 1); circ(c, 33, 16, 3.6, '#ffc93a', OUT, 1); rr(c, 14, 15, 2, 3, 1, OUT, null); rr(c, 32, 15, 2, 3, 1, OUT, null);
    line(c, [14, 27, 24, 30, 34, 27], OUT, 1.8); rr(c, 6, 34, 9, 5, 2, '#4d6a2e'); rr(c, 33, 34, 9, 5, 2, '#4d6a2e'); } },
  drowned: { w: 38, h: 50, draw: c => {
    c.beginPath(); c.moveTo(8, 22); c.quadraticCurveTo(6, 44, 12, 46); c.quadraticCurveTo(16, 42, 19, 47); c.quadraticCurveTo(23, 42, 26, 47); c.quadraticCurveTo(32, 44, 30, 22); c.closePath();
    c.fillStyle = 'rgba(214,238,245,0.92)'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    circ(c, 19, 17, 10, '#cfe6ee'); c.beginPath(); c.moveTo(7, 32); c.quadraticCurveTo(5, 8, 19, 6); c.quadraticCurveTo(33, 8, 31, 32); c.quadraticCurveTo(27, 22, 25, 30); c.quadraticCurveTo(22, 18, 19, 26); c.quadraticCurveTo(16, 18, 13, 30); c.quadraticCurveTo(11, 22, 7, 32);
    c.fillStyle = '#141824'; c.fill(); circ(c, 15, 21, 1.6, '#aef', null); circ(c, 23, 21, 1.6, '#aef', null);
    for (const x of [10, 28]) { ell(c, x, 36, 1.4, 2.4, 'rgba(130,200,255,0.8)', null); } } },
  egg: { w: 40, h: 52, draw: c => {
    c.beginPath(); c.moveTo(9, 30); c.quadraticCurveTo(6, 46, 10, 49); c.quadraticCurveTo(20, 44, 30, 49); c.quadraticCurveTo(34, 46, 31, 30); c.closePath(); c.fillStyle = '#f4f2ff'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    line(c, [20, 30, 24, 38], '#b8b4d8', 2);
    ell(c, 20, 18, 11, 14, '#fffdf6'); c.globalAlpha = 0.5; ell(c, 16, 12, 3, 5, '#fff', null); c.globalAlpha = 1;
    c.globalAlpha = 0.25; ell(c, 20, 24, 8, 4, '#c8c4e8', null); c.globalAlpha = 1; } },
  skeleton: { w: 42, h: 50, draw: c => {
    rr(c, 14, 40, 5, 9, 2, '#e8e2cc'); rr(c, 23, 40, 5, 9, 2, '#e8e2cc');
    rr(c, 11, 26, 20, 16, 4, '#6b5a4a'); for (let i = 0; i < 3; i++) line(c, [13, 30 + i * 4, 29, 30 + i * 4], '#8e7a5e', 2);
    circ(c, 21, 16, 10, '#efe9d4'); circ(c, 17, 16, 3, '#1b1426', null); circ(c, 25, 16, 3, '#1b1426', null); circ(c, 17, 16, 1, '#ff4a4a', null); circ(c, 25, 16, 1, '#ff4a4a', null);
    line(c, [17, 22, 25, 22], OUT, 1.5); for (let i = 0; i < 4; i++) line(c, [18 + i * 2, 21, 18 + i * 2, 23], OUT, 1);
    ell(c, 21, 7, 13, 3.5, 'rgba(20,16,30,0.8)', OUT, 1.2); rr(c, 16, 0, 10, 7, 3, '#1b1426', null);
    line(c, [32, 38, 40, 16], OUT, 4.5); line(c, [32, 38, 40, 16], '#b9c2cc', 2.5); line(c, [29, 34, 35, 36], '#6b5a4a', 3); } },
  crow: { w: 44, h: 36, draw: c => {
    poly(c, [22, 18, 2, 10, 8, 20, 4, 26, 18, 24], '#1d1a2a'); poly(c, [22, 18, 42, 10, 36, 20, 40, 26, 26, 24], '#1d1a2a');
    ell(c, 22, 22, 9, 8, '#26223a'); circ(c, 22, 13, 7, '#26223a'); poly(c, [22, 13, 32, 15, 22, 17], '#3a3550', OUT, 1.5);
    circ(c, 20, 12, 2, '#ff3b3b', null); line(c, [18, 30, 17, 35], '#e0c050', 1.5); line(c, [26, 30, 27, 35], '#e0c050', 1.5); line(c, [22, 30, 22, 35], '#e0c050', 1.5); } },
  foxmage: { w: 40, h: 52, draw: c => {
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(20, 40); c.quadraticCurveTo(6 - i * 4, 34 - i * 6, 4 + i * 2, 18 - i * 3); c.strokeStyle = '#ffb86b'; c.lineWidth = 5; c.stroke(); }
    poly(c, [11, 28, 29, 28, 33, 49, 7, 49], '#c9303f'); rr(c, 12, 26, 16, 9, 3, '#f7f3ea');
    circ(c, 20, 18, 10, '#f7f3ea'); poly(c, [11, 13, 12, 3, 17, 10], '#f7f3ea'); poly(c, [29, 13, 28, 3, 23, 10], '#f7f3ea');
    line(c, [14, 17, 18, 19], '#c9303f', 2); line(c, [26, 17, 22, 19], '#c9303f', 2); circ(c, 20, 23, 1.3, OUT, null); line(c, [20, 11, 20, 15], '#c9303f', 1.5); } },
  jangseung: { w: 58, h: 88, draw: c => {
    rr(c, 17, 20, 24, 64, 6, '#9a6a3e'); for (let i = 0; i < 6; i++) line(c, [20, 40 + i * 7, 38, 40 + i * 7], 'rgba(60,35,20,0.35)', 1.5);
    ell(c, 29, 16, 16, 8, '#2b2233'); rr(c, 22, 2, 14, 12, 4, '#2b2233');
    ell(c, 29, 28, 13, 11, '#c9523e', null); angryEyes(c, 29, 25, 6, 4, '#1b1426'); line(c, [20, 19, 26, 22], OUT, 3); line(c, [38, 19, 32, 22], OUT, 3);
    ell(c, 29, 32, 3.5, 3, '#8a3322', null); rr(c, 22, 36, 14, 5, 2, '#fff', OUT, 1.2); poly(c, [23, 36, 24, 41, 25, 36], '#fff', null); poly(c, [33, 36, 34, 41, 35, 36], '#fff', null);
    c.fillStyle = '#1b1426'; c.font = 'bold 7px serif'; c.textAlign = 'center'; ['天', '下', '大', '將'].forEach((ch, i) => c.fillText(ch, 29, 52 + i * 8));
    line(c, [14, 50, 6, 60], '#9a6a3e', 5); line(c, [44, 50, 52, 60], '#9a6a3e', 5); } },
  goldgob: { w: 46, h: 48, draw: c => {
    ell(c, 11, 30, 10, 12, '#b88a3a'); circ(c, 11, 18, 4, '#b88a3a'); for (const [x, y] of [[8, 26], [14, 32], [9, 36]]) circ(c, x, y, 2.5, '#ffe36b', OUT, 1);
    rr(c, 22, 38, 6, 8, 3, '#b8860b'); rr(c, 31, 38, 6, 8, 3, '#b8860b'); ell(c, 29, 34, 11, 8, '#ffcf3f');
    circ(c, 29, 21, 11, '#ffcf3f'); poly(c, [26, 11, 29, 2, 32, 11], '#fff6c8'); eyes(c, 29, 21, 4.5, 2.4); c.beginPath(); c.arc(29, 25, 4, 0.1, Math.PI - 0.1); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke(); blush(c, 29, 25, 7);
    c.beginPath(); c.arc(29, 20, 11.5, Math.PI * 1.1, Math.PI * 1.9); c.fillStyle = '#8a5a1a'; c.fill(); } },
  boss_chief: { w: 112, h: 112, draw: c => {
    rr(c, 36, 88, 14, 20, 5, '#a82a22'); rr(c, 62, 88, 14, 20, 5, '#a82a22');
    ell(c, 56, 78, 34, 22, '#d9392e'); rr(c, 25, 76, 62, 14, 5, '#ffc53d', OUT, 2); for (let i = 0; i < 9; i++) line(c, [29 + i * 7, 76, 31 + i * 7, 89], OUT, 2.5);
    circ(c, 56, 46, 30, '#d9392e'); poly(c, [32, 30, 22, 2, 42, 24], '#fff3c0'); poly(c, [80, 30, 90, 2, 70, 24], '#fff3c0'); poly(c, [48, 18, 56, 6, 64, 18], '#ffd54a');
    c.beginPath(); c.arc(56, 43, 31, Math.PI * 1.12, Math.PI * 1.88); c.fillStyle = '#2b1f3a'; c.fill();
    angryEyes(c, 56, 48, 12, 6, '#ffcc00'); line(c, [40, 60, 46, 56, 52, 60, 58, 56, 64, 60, 70, 56], OUT, 2.5); poly(c, [42, 58, 45, 66, 48, 58], '#fff', OUT, 1.2); poly(c, [66, 58, 69, 66, 72, 58], '#fff', OUT, 1.2);
    c.save(); c.translate(96, 70); c.rotate(-0.55); rr(c, -8, -50, 17, 58, 7, '#ffcf3f'); for (let i = 0; i < 5; i++) { circ(c, -9, -44 + i * 10, 3, '#fff8d0', OUT, 1.2); circ(c, 10, -40 + i * 10, 3, '#fff8d0', OUT, 1.2); } c.restore(); } },
  boss_imugi: { w: 132, h: 112, draw: c => {
    const body = '#2f8f86', belly = '#bfe8c8';
    for (let i = 0; i < 3; i++) { ell(c, 66 - i * 6, 92 - i * 16, 48 - i * 10, 14 - i * 1.5, body); c.globalAlpha = 0.5; ell(c, 66 - i * 6, 95 - i * 16, 34 - i * 8, 6, belly, null); c.globalAlpha = 1; }
    c.beginPath(); c.moveTo(60, 50); c.quadraticCurveTo(66, 30, 82, 24); c.lineWidth = 22; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 18; c.strokeStyle = body; c.stroke();
    ell(c, 90, 22, 22, 15, body); ell(c, 104, 27, 10, 7, '#3aa89c'); circ(c, 108, 25, 1.8, OUT, null);
    angryEyes(c, 88, 17, 7, 4, '#ffe066'); line(c, [104, 30, 124, 40, 118, 50], '#e8f4d0', 2); line(c, [104, 30, 120, 22, 128, 28], '#e8f4d0', 2);
    for (let i = 0; i < 5; i++) poly(c, [72 + i * 7, 12 - (i % 2) * 2, 76 + i * 7, 3, 79 + i * 7, 12], '#7fe0d0', OUT, 1.2);
    for (let i = 0; i < 10; i++) { c.globalAlpha = 0.35; c.beginPath(); c.arc(30 + i * 8, 88 - (i % 3) * 3, 3, Math.PI, 0); c.strokeStyle = '#0d4a44'; c.lineWidth = 1.5; c.stroke(); c.globalAlpha = 1; } } },
  boss_reaper: { w: 84, h: 112, draw: c => {
    c.beginPath(); c.moveTo(26, 40); c.lineTo(14, 106); c.lineTo(70, 106); c.lineTo(58, 40); c.closePath(); c.fillStyle = '#16131f'; c.fill(); c.strokeStyle = '#5b4d8a'; c.lineWidth = 2; c.stroke();
    line(c, [42, 44, 42, 104], '#2a2440', 2); line(c, [34, 46, 42, 60, 50, 46], '#e8e4f4', 3);
    circ(c, 42, 32, 14, '#f4f2fa'); ell(c, 36, 32, 3.4, 1.6, OUT, null); ell(c, 48, 32, 3.4, 1.6, OUT, null); ell(c, 42, 40, 3, 1.8, '#c01e3a', null);
    ell(c, 42, 20, 32, 7, 'rgba(12,10,20,0.9)', '#5b4d8a', 1.5); rr(c, 31, 0, 22, 20, 7, '#0e0c16', '#5b4d8a', 1.5);
    line(c, [12, 22, 20, 60], 'rgba(60,50,90,0.6)', 1.2); line(c, [72, 22, 64, 60], 'rgba(60,50,90,0.6)', 1.2);
    rr(c, 60, 62, 18, 8, 3, '#e8dcc0', OUT, 1.5); c.fillStyle = OUT; c.fillRect(64, 65, 10, 1.2); } },
  boss_gumiho: { w: 132, h: 112, draw: c => {
    for (let i = 0; i < 9; i++) { const a = -Math.PI * 0.95 + (i / 8) * Math.PI * 0.9; c.beginPath(); c.moveTo(50, 70); c.quadraticCurveTo(50 + Math.cos(a) * 30, 60 + Math.sin(a) * 40, 50 + Math.cos(a) * 52, 58 + Math.sin(a) * 52); c.strokeStyle = OUT; c.lineWidth = 13; c.stroke(); c.strokeStyle = i % 2 ? '#fff6ee' : '#ffe1c8'; c.lineWidth = 10; c.stroke(); circ(c, 50 + Math.cos(a) * 52, 58 + Math.sin(a) * 52, 5, '#ff9a3c', null); }
    ell(c, 70, 80, 30, 18, '#fff6ee'); rr(c, 52, 86, 9, 20, 4, '#fff6ee'); rr(c, 80, 86, 9, 20, 4, '#fff6ee');
    circ(c, 94, 56, 20, '#fff6ee'); poly(c, [80, 44, 80, 22, 92, 38], '#fff6ee'); poly(c, [104, 40, 112, 20, 112, 44], '#fff6ee'); poly(c, [83, 40, 83, 29, 89, 37], '#ff9aa8', null); poly(c, [107, 40, 110, 29, 110, 42], '#ff9aa8', null);
    poly(c, [102, 62, 122, 62, 106, 70], '#fff6ee'); circ(c, 121, 62, 3, OUT, null);
    ell(c, 90, 54, 4.5, 2.2, '#c01e3a', null, 1, -0.3); ell(c, 102, 54, 4.5, 2.2, '#c01e3a', null, 1, 0.3); line(c, [96, 44, 96, 48], '#c01e3a', 2.5); } },
  boss_bulgasari: { w: 172, h: 152, draw: c => {
    rr(c, 44, 112, 26, 36, 8, '#3a3d48'); rr(c, 104, 112, 26, 36, 8, '#3a3d48');
    const g = c.createLinearGradient(0, 40, 0, 130); g.addColorStop(0, '#5a5f6e'); g.addColorStop(1, '#2d303a');
    ell(c, 86, 92, 64, 44, g);
    for (let i = 0; i < 16; i++) { const a = Math.PI + (i / 15) * Math.PI; const x = 86 + Math.cos(a) * 60, y = 88 + Math.sin(a) * 42; poly(c, [x - 5, y + 3, x + Math.cos(a) * 16, y + Math.sin(a) * 16, x + 5, y + 3], '#8a8f9e', OUT, 1.5); }
    for (const [x1, y1, x2, y2] of [[50, 90, 70, 100], [90, 110, 110, 96], [120, 84, 132, 100], [66, 112, 80, 104]]) { line(c, [x1, y1, x2, y2], '#ff7a2a', 3); line(c, [x1, y1, x2, y2], '#ffe08a', 1); }
    circ(c, 132, 64, 30, '#4a4e5c'); ell(c, 150, 84, 9, 22, '#4a4e5c', OUT, 2, -0.3); ell(c, 154, 104, 7, 5, '#3a3d48', OUT, 2);
    angryEyes(c, 128, 58, 11, 6, '#ff2a2a'); poly(c, [112, 40, 108, 22, 122, 36], '#8a8f9e'); poly(c, [146, 38, 154, 20, 150, 42], '#8a8f9e');
    poly(c, [118, 76, 122, 84, 126, 76], '#fff', OUT, 1.2); poly(c, [134, 76, 138, 84, 142, 76], '#fff', OUT, 1.2);
    c.beginPath(); c.moveTo(24, 86); c.quadraticCurveTo(0, 70, 8, 50); c.strokeStyle = OUT; c.lineWidth = 9; c.stroke(); c.strokeStyle = '#ff9a3c'; c.lineWidth = 6; c.stroke(); } },
};

// ---------- props ----------
interface PD { w: number; h: number; base?: number; draw: (c: Ctx, v: number) => void }
function treeCanopy(c: Ctx, x: number, y: number, r: number, dark: string, mid: string, light: string) {
  circ(c, x - r * 0.55, y + r * 0.15, r * 0.7, dark, OUT, 2); circ(c, x + r * 0.55, y + r * 0.15, r * 0.7, dark, OUT, 2); circ(c, x, y - r * 0.35, r * 0.8, mid, OUT, 2);
  circ(c, x - r * 0.5, y + r * 0.1, r * 0.62, dark, null); circ(c, x + r * 0.5, y + r * 0.1, r * 0.62, dark, null); circ(c, x, y - r * 0.3, r * 0.72, mid, null);
  c.globalAlpha = 0.55; circ(c, x - r * 0.25, y - r * 0.55, r * 0.35, light, null); c.globalAlpha = 1;
}
const PROP_DRAW: Record<string, PD> = {
  tree: { w: 64, h: 84, draw: (c, v) => {
    rr(c, 27, 54, 10, 26, 3, '#4a3024'); const pal = [['#1d4a33', '#2a6645', '#6fb58a'], ['#1b4230', '#23593e', '#5fa27a'], ['#22503a', '#2f7250', '#86c99e']][v % 3];
    treeCanopy(c, 32, 40 - (v % 2) * 3, 24 + (v % 3) * 2, pal[0], pal[1], pal[2]); } },
  pine: { w: 60, h: 90, draw: (c, v) => {
    rr(c, 26, 66, 8, 20, 2, '#4a3024'); const d = v % 2 ? '#183e2c' : '#1d4633';
    for (let i = 0; i < 3; i++) poly(c, [30, 6 + i * 18, 6 + i * 2, 44 + i * 13, 54 - i * 2, 44 + i * 13], i === 0 ? '#2a6645' : d);
    c.globalAlpha = 0.4; poly(c, [30, 8, 22, 30, 30, 26], '#7fc79a', null); c.globalAlpha = 1; } },
  maple: { w: 64, h: 84, draw: (c, v) => { rr(c, 27, 54, 10, 26, 3, '#4a3024'); const pal = [['#8a2a1a', '#c9502a', '#ffb36b'], ['#9a3a14', '#d8702a', '#ffd08a'], ['#7a1e24', '#b8323a', '#ff8a7a']][v % 3]; treeCanopy(c, 32, 40, 25, pal[0], pal[1], pal[2]); } },
  deadtree: { w: 60, h: 80, draw: c => { line(c, [30, 78, 30, 30], OUT, 9); line(c, [30, 78, 30, 30], '#5a4a44', 6); for (const [a, b, x, y] of [[30, 48, 12, 30], [30, 40, 48, 22], [30, 32, 22, 12], [30, 36, 42, 8], [20, 38, 8, 40]]) { line(c, [a, b, x, y], OUT, 5); line(c, [a, b, x, y], '#5a4a44', 3); } } },
  rock: { w: 48, h: 44, draw: (c, v) => { poly(c, [6, 36, 10, 16, 22, 6, 36, 10, 44, 26, 40, 38], v % 2 ? '#6a6570' : '#7a6f66'); c.globalAlpha = 0.35; poly(c, [12, 18, 22, 9, 30, 12, 18, 22], '#fff', null); c.globalAlpha = 1; line(c, [22, 22, 30, 32], 'rgba(0,0,0,0.3)', 2); } },
  lantern: { w: 36, h: 64, draw: c => {
    rr(c, 13, 40, 10, 20, 2, '#8a8690'); rr(c, 8, 36, 20, 6, 2, '#9a96a0'); rr(c, 10, 22, 16, 15, 3, '#8a8690');
    rr(c, 13, 25, 10, 9, 2, '#ffdb7a', null); poly(c, [4, 23, 18, 12, 32, 23], '#6a6670'); circ(c, 18, 11, 3, '#8a8690'); } },
  jangseung: { w: 40, h: 76, draw: c => {
    rr(c, 12, 18, 16, 54, 5, '#9a6a3e'); ell(c, 20, 15, 11, 5, '#2b2233'); rr(c, 15, 4, 10, 10, 3, '#2b2233');
    ell(c, 20, 26, 9, 8, '#d8a070', null); eyes(c, 20, 24, 4, 2.2); ell(c, 20, 30, 3, 2, '#8a3322', null); rr(c, 15, 33, 10, 3, 1, '#fff', OUT, 1);
    c.fillStyle = '#1b1426'; c.font = 'bold 6px serif'; c.textAlign = 'center'; ['天', '下', '大'].forEach((ch, i) => c.fillText(ch, 20, 46 + i * 7)); } },
  grave: { w: 44, h: 36, draw: c => { ell(c, 22, 26, 18, 9, '#3f5a3a'); c.globalAlpha = 0.4; ell(c, 18, 22, 8, 4, '#7a9a6a', null); c.globalAlpha = 1; rr(c, 17, 8, 10, 16, 2, '#9a96a0'); line(c, [20, 13, 24, 13], '#5a5660', 1.2); line(c, [20, 17, 24, 17], '#5a5660', 1.2); } },
  moontree: { w: 180, h: 200, base: 20, draw: c => {
    rr(c, 78, 110, 24, 76, 8, '#5a4a6a'); line(c, [90, 150, 60, 190], '#5a4a6a', 10); line(c, [90, 150, 120, 190], '#5a4a6a', 10);
    const g = c.createRadialGradient(90, 80, 10, 90, 80, 90); g.addColorStop(0, '#e8f4ff'); g.addColorStop(0.5, '#9fc4ff'); g.addColorStop(1, '#4a6ab8');
    for (const [x, y, r] of [[50, 90, 38], [130, 90, 38], [90, 58, 46], [62, 50, 30], [118, 50, 30], [90, 100, 40]]) circ(c, x, y, r, g, OUT, 2.5);
    for (const [x, y, r] of [[50, 90, 36], [130, 90, 36], [90, 58, 44], [62, 50, 28], [118, 50, 28], [90, 100, 38]]) circ(c, x, y, r, g, null);
    const cols = ['#ff5a6a', '#ffd54a', '#7fe0a0', '#7fb8ff', '#e08aff'];
    for (let i = 0; i < 14; i++) { const x = 40 + (i * 37) % 100, y = 70 + (i * 23) % 50; line(c, [x, y, x + 2, y + 14], cols[i % 5], 3); }
    for (let i = 0; i < 20; i++) circ(c, 30 + (i * 53) % 120, 30 + (i * 31) % 90, 1.6, '#fff', null); } },
  shrine: { w: 72, h: 76, draw: c => {
    for (const x of [12, 58]) rr(c, x - 3, 14, 6, 60, 2, '#c8323a');
    rr(c, 4, 10, 64, 6, 2, '#c8323a'); rr(c, 8, 20, 56, 4, 2, '#c8323a');
    for (let i = 0; i < 9; i++) line(c, [14 + i * 5.5, 24, 14 + i * 5.5, 10], '#c8323a', 2);
    poly(c, [26, 72, 30, 46, 42, 44, 46, 72], '#8a8690'); circ(c, 36, 40, 7, '#bfe0ff', OUT, 2); } },
  board: { w: 52, h: 56, draw: c => { rr(c, 10, 30, 5, 24, 2, '#6a4a2a'); rr(c, 37, 30, 5, 24, 2, '#6a4a2a'); rr(c, 4, 8, 44, 28, 3, '#9a6a3e'); for (const [x, y, r] of [[8, 11, -0.1], [22, 12, 0.05], [34, 11, 0.1], [14, 22, 0.08], [30, 22, -0.06]]) { c.save(); c.translate(x + 5, y + 5); c.rotate(r); rr(c, -5, -5, 10, 11, 1, '#f4ecd0', OUT, 1); line(c, [-3, -1, 3, -1], '#c8323a', 1); c.restore(); } } },
  altar: { w: 64, h: 60, draw: c => { poly(c, [6, 52, 12, 30, 52, 30, 58, 52], '#6a5a5a'); rr(c, 18, 12, 28, 20, 4, '#7a6a6a'); circ(c, 32, 22, 6, '#ff5a3c', OUT, 2); } },
};

function drawHouse(c: Ctx, W: number, H: number, v: number) {
  const ox = 8, top = 34;
  rr(c, ox + 4, top + 6, W - 8, H - 6, 3, '#efe6d4'); // walls
  for (let x = ox + 4; x < ox + W - 4; x += 16) line(c, [x, top + 6, x, top + H], '#6a4a2a', 3);
  line(c, [ox + 4, top + H * 0.55, ox + W - 4, top + H * 0.55], '#6a4a2a', 3);
  rr(c, ox + W / 2 - 9, top + H - 20, 18, 20, 2, '#8a5a34'); if (v % 2 === 0) rr(c, ox + 12, top + 14, 14, 10, 1, '#ffdb7a');
  // curved tiled roof with lifted eaves
  c.beginPath(); c.moveTo(ox - 6, top + 10); c.quadraticCurveTo(ox + W / 2, top + 22, ox + W + 6, top + 10); c.lineTo(ox + W - 10, top - 20); c.quadraticCurveTo(ox + W / 2, top - 30, ox + 10, top - 20); c.closePath();
  const g = c.createLinearGradient(0, top - 30, 0, top + 20); g.addColorStop(0, '#3e4660'); g.addColorStop(1, '#262b3e'); c.fillStyle = g; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke();
  for (let x = ox + 4; x < ox + W; x += 7) line(c, [x, top - 22 + Math.abs(x - ox - W / 2) * 0.12, x + (x - ox - W / 2) * 0.05, top + 12 - Math.abs(x - ox - W / 2) * 0.1], 'rgba(10,12,24,0.5)', 1.2);
  line(c, [ox + 10, top - 21, ox + W - 10, top - 21], '#f0ebe0', 3);
}

function drawNpc(c: Ctx, kind: string) {
  const X = 24;
  rr(c, X - 8, 46, 6, 10, 3, '#2b2233'); rr(c, X + 2, 46, 6, 10, 3, '#2b2233');
  const robe = kind === 'smith' ? '#6a4a3a' : kind === 'talshop' ? '#7a4ab8' : kind === 'priest' ? '#c8323a' : '#4a6a8a';
  poly(c, [X - 13, 30, X + 13, 30, X + 16, 52, X - 16, 52], robe);
  if (kind === 'smith') { rr(c, X - 9, 32, 18, 18, 3, '#3a3036'); line(c, [X + 14, 42, X + 22, 26], '#7a5a3a', 3); rr(c, X + 17, 20, 12, 8, 2, '#8a8f9e'); }
  if (kind === 'talshop') for (let i = 0; i < 3; i++) rr(c, X + 10 + i * 5, 26 + i * 2, 6, 11, 1, '#ffe89a', OUT, 1);
  if (kind === 'priest') { circ(c, X + 15, 30, 3, '#ffd54a', OUT, 1.2); circ(c, X + 18, 34, 3, '#ffd54a', OUT, 1.2); }
  circ(c, X, 21, 12, '#ffe3c8'); eyes(c, X, 22, 4.8, 2.2); blush(c, X, 26, 7);
  if (kind === 'smith') { c.beginPath(); c.arc(X, 18, 12.5, Math.PI, Math.PI * 2); c.fillStyle = '#e8e2d4'; c.fill(); line(c, [X - 7, 29, X, 32, X + 7, 29], '#5a4a3a', 3); }
  else if (kind === 'talshop') { c.beginPath(); c.arc(X, 18, 12.5, Math.PI * 1.02, Math.PI * 1.98); c.fillStyle = '#2b2233'; c.fill(); rr(c, X - 3, 2, 6, 8, 2, '#2b2233'); line(c, [X - 8, 5, X + 8, 5], '#c8a0ff', 2); }
  else if (kind === 'priest') { ell(c, X, 12, 16, 4, '#c8323a'); rr(c, X - 7, 1, 14, 11, 4, '#c8323a'); }
  else { ell(c, X, 12, 18, 4.5, 'rgba(20,16,30,0.85)'); rr(c, X - 6, 1, 12, 11, 4, '#1b1426'); }
}

// ---------- UI icons (data URLs) ----------
const iconCache = new Map<string, string>();
function icon(key: string, size: number, draw: (c: Ctx) => void): string {
  let u = iconCache.get(key); if (u) return u;
  const cv = document.createElement('canvas'); cv.width = cv.height = size * 2; const c = cv.getContext('2d')!; c.scale(2, 2); c.lineJoin = 'round'; c.lineCap = 'round'; draw(c);
  u = cv.toDataURL(); iconCache.set(key, u); return u;
}
export function talIcon(kind: TalKind): string {
  const d = TALS[kind];
  return icon('tal:' + kind, 48, c => {
    c.save(); c.translate(24, 24); c.rotate(-0.08);
    rr(c, -13, -20, 26, 40, 3, '#f7e08a', '#8a6a1a', 2); c.globalAlpha = 0.25; rr(c, -13, 8, 26, 12, 3, '#c8a040', null); c.globalAlpha = 1;
    line(c, [-9, -15, 9, -15], '#c8323a', 1.5); line(c, [-9, 15, 9, 15], '#c8323a', 1.5);
    c.fillStyle = '#c8323a'; c.font = 'bold 20px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(d.glyph, 0, 1);
    c.restore(); c.globalAlpha = 0.9; circ(c, 40, 8, 5, d.color, OUT, 1.5); c.globalAlpha = 1;
  });
}
export function classIcon(cls: ClassId): string {
  return icon('cls:' + cls, 64, c => { c.save(); c.translate(8, 2); drawPlayer(c, cls); c.restore(); });
}
export function npcIcon(kind: string): string { return icon('npc:' + kind, 56, c => { c.save(); c.translate(4, 0); drawNpc(c, kind); c.restore(); }); }
export function monIcon(key: string): string {
  const d = MON_DRAW[key]; const s = Math.max(d.w, d.h);
  return icon('mon:' + key, 64, c => { c.save(); c.scale(60 / s, 60 / s); c.translate((s - d.w) / 2, (s - d.h) / 2); d.draw(c); c.restore(); });
}
export function itemIcon(slot: GearSlot, cls: ClassId, tier: number, rarity: number): string {
  const tc = ['#9a7a5a', '#b87a3a', '#b8c2cc', '#9fc4ff', '#ffe066'][tier];
  return icon(`it:${slot}:${cls}:${tier}:${rarity}`, 48, c => {
    if (slot === 'weapon') {
      if (cls === 'sword') { c.save(); c.translate(24, 24); c.rotate(-0.8); rr(c, -3, -20, 6, 30, 2, tc); rr(c, -7, 9, 14, 4, 2, '#c9a54a'); rr(c, -2.5, 13, 5, 9, 2, '#4a2c1c'); c.restore(); }
      else if (cls === 'archer') { c.beginPath(); c.arc(16, 24, 18, -1.1, 1.1); c.strokeStyle = OUT; c.lineWidth = 6; c.stroke(); c.strokeStyle = tc; c.lineWidth = 3.5; c.stroke(); line(c, [23.5, 8, 23.5, 40], '#f7f2e0', 1.2); }
      else { line(c, [24, 42, 24, 22], '#7a4a28', 3); for (const [x, y] of [[24, 16], [17, 20], [31, 20], [20, 11], [28, 11]]) circ(c, x, y, 4.5, tc, OUT, 1.5); }
    } else if (slot === 'armor') { poly(c, [12, 10, 36, 10, 42, 40, 6, 40], tc); line(c, [18, 10, 24, 22, 30, 10], '#f4f1e8', 3); line(c, [7, 30, 41, 30], OUT, 2); }
    else { circ(c, 24, 14, 7, tc, OUT, 2); rr(c, 20, 20, 8, 6, 2, '#c8323a'); for (let i = 0; i < 5; i++) line(c, [21 + i * 1.5, 26, 19 + i * 2.5, 42], '#c8323a', 1.5); }
    if (rarity >= 3) { c.globalAlpha = 0.9; circ(c, 40, 8, 4, rarity === 4 ? '#ffb02e' : '#c16bff', OUT, 1.2); c.globalAlpha = 1; }
  });
}
export function emoteText(e: number): string { return ['👍', 'ㅋㅋ', '도와줘!', '고마워', '가자!', '❤️', '😭', '🔥'][e] ?? '?'; }
export { MON_DRAW };
