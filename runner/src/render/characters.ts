// Procedural characters: street-snack buddies drawn with canvas paths (no image assets).
// Feet at (0,0), facing right, ≈56×84 logical px standing. The sim hurtbox (36×70) sits inside the drawing.

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

export function drawCharacter(c: CanvasRenderingContext2D, shape: Shape, pal: Palette, p: Pose): void {
  c.save();
  c.globalAlpha *= p.alpha;
  const slide = p.state === 'slide';
  const air = p.state === 'jump' || p.state === 'air2' || p.state === 'fall' || p.state === 'fly';
  // squash & stretch around the feet
  if (slide) c.scale(1.25, 0.46); else c.scale(p.squash, 1 / p.squash);   // area-preserving
  const bob = p.state === 'run' ? Math.abs(Math.sin(p.runPhase * Math.PI * 2)) * 3 : p.state === 'idle' ? Math.sin(p.t * 3) * 1.5 : 0;
  c.translate(0, -bob);
  if (slide) c.rotate(0.12);

  // body centre ~ 42 px above the feet
  const cy = -44;
  if (p.state === 'air2' && p.spin) { c.translate(0, cy); c.rotate(p.spin); c.translate(0, -cy); }

  // legs
  if (!slide) {
    c.fillStyle = pal.accent;
    const swing = p.state === 'run' ? Math.sin(p.runPhase * Math.PI * 2) : air ? 0.6 : 0;
    for (const side of [-1, 1]) {
      const a = swing * side * 0.9;
      c.save(); c.translate(side * 8, -16); c.rotate(a * (air ? 0.4 : 1) + (air ? side * 0.3 : 0));
      rr(c, -4.5, 0, 9, 17, 4.5); c.fill();
      c.fillStyle = shade(pal.accent, -0.25); rr(c, -6, 13, 13, 6, 3); c.fill(); c.fillStyle = pal.accent;
      c.restore();
    }
  }
  // arms (behind body)
  const armSwing = p.state === 'run' ? Math.sin(p.runPhase * Math.PI * 2 + Math.PI) : air ? -1 : 0;
  c.fillStyle = shade(pal.body, -0.1);
  c.save(); c.translate(-17, cy + 6); c.rotate(armSwing * 0.8 - (air ? 0.9 : 0)); rr(c, -4, 0, 8, 15, 4); c.fill(); c.restore();

  bodyPath(c, shape, pal, cy, p);

  // near arm
  c.fillStyle = shade(pal.body, 0.05); c.strokeStyle = shade(pal.body, -0.35); c.lineWidth = 1.5;
  c.save(); c.translate(15, cy + 6); c.rotate(-armSwing * 0.8 - (air ? 1.2 : 0)); rr(c, -4, 0, 8, 15, 4); c.fill(); c.stroke(); c.restore();

  face(c, shape, pal, cy, p);
  c.restore();
}

function bodyPath(c: CanvasRenderingContext2D, shape: Shape, pal: Palette, cy: number, p: Pose): void {
  const outline = shade(pal.body, -0.45);
  c.lineWidth = 2.2; c.strokeStyle = outline;
  switch (shape) {
    case 'disc': { // 호떡: flat golden pancake with a syrup spot
      c.fillStyle = pal.body; c.beginPath(); c.ellipse(0, cy, 27, 25, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = pal.shade; c.beginPath(); c.ellipse(0, cy + 4, 24, 19, 0, 0.15 * Math.PI, 0.85 * Math.PI); c.fill();
      c.fillStyle = 'rgba(120,60,20,0.55)'; c.beginPath(); c.ellipse(-9, cy - 12, 6, 3.5, -0.4, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(11, cy + 13, 5, 2.5, 0.3, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'fish': { // 붕어빵: fish-shaped bread with tail, fin and scale arcs
      c.fillStyle = pal.body;
      c.beginPath(); c.moveTo(-18, cy); c.lineTo(-32, cy - 14); c.quadraticCurveTo(-28, cy, -32, cy + 14); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(2, cy, 26, 22, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-2, cy - 20); c.quadraticCurveTo(4, cy - 30, 12, cy - 20); c.fill(); c.stroke();
      c.strokeStyle = shade(pal.body, -0.25); c.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { c.beginPath(); c.arc(-12 + i * 8, cy - 2 + j * 9, 4, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke(); }
      break;
    }
    case 'fishcake': { // 어묵 (placeholder: wavy block): soft rounded square dusted with bean powder
      c.fillStyle = pal.body; rr(c, -25, cy - 25, 50, 48, 14); c.fill(); c.stroke();
      c.fillStyle = pal.shade; for (let i = 0; i < 14; i++) { const a = i * 2.4; c.beginPath(); c.arc(Math.cos(a) * (8 + i), cy + Math.sin(a) * (6 + i * 0.9), 1.4, 0, Math.PI * 2); c.fill(); }
      break;
    }
    case 'skewer': { // 떡꼬치: three glazed rice cakes on a stick
      c.fillStyle = '#c8a06a'; c.fillRect(-2, cy - 40, 4, 64);
      c.fillStyle = pal.body;
      for (const dy of [-22, 0, 20]) { rr(c, -18, cy + dy - 9, 36, 19, 9); c.fill(); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,0.35)'; for (const dy of [-22, 0, 20]) { rr(c, -12, cy + dy - 6, 14, 4, 2); c.fill(); }
      break;
    }
    case 'star': { // 달고나: honeycomb disc with a star imprint
      c.fillStyle = pal.body; c.beginPath(); c.arc(0, cy, 26, 0, Math.PI * 2); c.fill(); c.stroke();
      c.strokeStyle = pal.shade; c.lineWidth = 2; c.beginPath();
      for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2; const r = i % 2 ? 6 : 14; c.lineTo(Math.cos(a) * r, cy + 4 + Math.sin(a) * r); }
      c.closePath(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.arc(-9, cy - 12, 7, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'potato': { // 군고구마 (placeholder): glossy ball with honey sheen
      c.fillStyle = pal.body; c.beginPath(); c.arc(0, cy + 2, 25, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = pal.shade; c.beginPath(); c.arc(0, cy + 2, 25, 0.1 * Math.PI, 0.9 * Math.PI); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(-10, cy - 10, 7, 4, -0.6, 0, Math.PI * 2); c.fill();
      break;
    }
    default: { // fallback: oval bread with an egg on top
      c.fillStyle = pal.body; c.beginPath(); c.ellipse(0, cy + 2, 24, 26, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#fff8e6'; c.beginPath(); c.ellipse(0, cy - 16, 17, 9, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffb627'; c.beginPath(); c.arc(3, cy - 17, 6, 0, Math.PI * 2); c.fill();
      break;
    }
  }
  if (p.hurt) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(255,40,60,0.45)'; c.fillRect(-40, cy - 50, 80, 100); c.globalCompositeOperation = 'source-over'; }
}

function face(c: CanvasRenderingContext2D, shape: Shape, pal: Palette, cy: number, p: Pose): void {
  const fx = shape === 'fish' ? 10 : 6; const fy = shape === 'skewer' ? cy - 2 : cy - 2;
  const blink = (p.t % 3.2) > 3.05;
  const ouch = p.hurt || p.state === 'dead';
  c.fillStyle = '#2a1a22';
  if (ouch) {
    c.strokeStyle = '#2a1a22'; c.lineWidth = 2.2;
    for (const ex of [fx - 7, fx + 8]) { c.beginPath(); c.moveTo(ex - 3, fy - 4); c.lineTo(ex + 3, fy); c.lineTo(ex - 3, fy + 4); c.stroke(); }
  } else if (blink) {
    c.fillRect(fx - 10, fy - 1, 6, 2.2); c.fillRect(fx + 5, fy - 1, 6, 2.2);
  } else {
    for (const ex of [fx - 7, fx + 8]) {
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex, fy - 1, 4.5, 5.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2a1a22'; c.beginPath(); c.ellipse(ex + 1.2, fy, 2.8, 3.6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + 2, fy - 1.6, 1.1, 0, Math.PI * 2); c.fill();
    }
  }
  c.fillStyle = pal.cheek; c.globalAlpha *= 0.75;
  c.beginPath(); c.ellipse(fx - 13, fy + 7, 4, 2.6, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(fx + 14, fy + 7, 4, 2.6, 0, 0, Math.PI * 2); c.fill();
  c.globalAlpha /= 0.75;
  c.strokeStyle = '#2a1a22'; c.lineWidth = 2; c.fillStyle = '#7a1f2b';
  const air = p.state === 'jump' || p.state === 'air2' || p.state === 'fly';
  if (ouch) { c.beginPath(); c.arc(fx + 1, fy + 11, 3, Math.PI, 0); c.stroke(); }
  else if (air) { c.beginPath(); c.ellipse(fx + 1, fy + 9, 3, 3.6, 0, 0, Math.PI * 2); c.fill(); }
  else { c.beginPath(); c.arc(fx + 1, fy + 6, 4.5, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
}

export function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

/** lighten (+) / darken (−) a #rrggbb colour */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; } else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
