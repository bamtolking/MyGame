// Hazard drawing. Rules: (1) the drawn body always COVERS the hitbox (never "hit by nothing"); decorative
// tips may stick out past it (forgiving, never punishing); (2) every hazard has a dark outline + a reserved
// hot-pink rim (HAZARD_RIM is used for nothing else), so hazards read by shape + rim, not by hue alone.
import type { Hazard } from '../sim/types';
import { rr } from './characters';

export const HAZARD_RIM = '#ff2e63';
const OUTLINE = '#1c0f24';
function rim(c: CanvasRenderingContext2D, hc: boolean): void {
  c.lineJoin = 'round';
  c.strokeStyle = OUTLINE; c.lineWidth = hc ? 7 : 6; c.stroke();
  c.strokeStyle = hc ? '#ffffff' : HAZARD_RIM; c.lineWidth = hc ? 3.5 : 2.5; c.stroke();
}
export function drawSpike(c: CanvasRenderingContext2D, h: Hazard, col: string, hc: boolean): void {
  const x0 = h.x0 - 2, x1 = h.x1 + 2, top = h.y0, bot = h.y1; const w = x1 - x0; const mid = (x0 + x1) / 2;
  c.fillStyle = 'rgba(0,0,0,0.28)'; c.beginPath(); c.ellipse(mid, bot + 1, w / 2 + 6, 4, 0, 0, Math.PI * 2); c.fill();
  // body: rounded block covering the whole hitbox, crowned by three spikes above it
  c.beginPath();
  c.moveTo(x0, bot); c.lineTo(x0, top + 8);
  c.lineTo(x0 + w * 0.17, top - 10); c.lineTo(x0 + w * 0.33, top + 4);
  c.lineTo(mid, top - 16); c.lineTo(x1 - w * 0.33, top + 4);
  c.lineTo(x1 - w * 0.17, top - 10); c.lineTo(x1, top + 8); c.lineTo(x1, bot); c.closePath();
  c.fillStyle = col; c.fill(); rim(c, hc);
  c.fillStyle = 'rgba(255,255,255,0.35)'; rr(c, x0 + 5, top + 10, 5, bot - top - 16, 2.5); c.fill();
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(x0 + 2, bot - 8, w - 4, 6);
}
export function drawTall(c: CanvasRenderingContext2D, h: Hazard, col: string, hc: boolean, t: number): void {
  const x0 = h.x0 - 2, x1 = h.x1 + 2, top = h.y0, bot = h.y1; const w = x1 - x0; const mid = (x0 + x1) / 2;
  c.fillStyle = 'rgba(0,0,0,0.28)'; c.beginPath(); c.ellipse(mid, bot + 1, w / 2 + 8, 4, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(x0, bot); c.lineTo(x0, top + 6);
  for (let i = 0; i <= 4; i++) c.lineTo(x0 + (w * i) / 4, i % 2 ? top - 2 : top - 14 + Math.sin(t * 3 + i) * 1.5);
  c.lineTo(x1, top + 6); c.lineTo(x1, bot); c.closePath();
  c.fillStyle = col; c.fill(); rim(c, hc);
  c.save(); c.beginPath(); c.rect(x0 + 2, top + 8, w - 4, bot - top - 10); c.clip();
  c.fillStyle = 'rgba(255,255,255,0.22)'; for (let y = top; y < bot; y += 28) { c.beginPath(); c.moveTo(x0, y + 16); c.lineTo(x1, y); c.lineTo(x1, y + 10); c.lineTo(x0, y + 26); c.closePath(); c.fill(); }
  c.restore();
  // "taller than you" cue: a double-chevron badge near the top
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(mid - 7, top + 26); c.lineTo(mid, top + 18); c.lineTo(mid + 7, top + 26); c.lineTo(mid + 7, top + 31); c.lineTo(mid, top + 23); c.lineTo(mid - 7, top + 31); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(mid - 7, top + 38); c.lineTo(mid, top + 30); c.lineTo(mid + 7, top + 38); c.lineTo(mid + 7, top + 43); c.lineTo(mid, top + 35); c.lineTo(mid - 7, top + 43); c.closePath(); c.fill();
}
export function drawHang(c: CanvasRenderingContext2D, x0: number, x1: number, bot: number, col: string, hc: boolean, t: number): void {
  // one solid slab hanging from above the screen: every px of the hitbox is visibly solid
  const w = x1 - x0; const topY = -420;
  c.beginPath(); c.moveTo(x0, topY); c.lineTo(x0, bot - 8);
  const teeth = Math.max(2, Math.round(w / 14)); for (let i = 0; i < teeth; i++) { const a = x0 + (w * i) / teeth, b = x0 + (w * (i + 1)) / teeth; c.lineTo((a + b) / 2, bot + 7); c.lineTo(b, bot - 8); }
  c.lineTo(x1, topY); c.closePath();
  c.fillStyle = col; c.fill(); rim(c, hc);
  // painted band + stitched seams so it reads as one hanging banner/board
  c.save(); c.beginPath(); c.rect(x0 + 3, topY, w - 6, bot - 10 - topY); c.clip();
  c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(x0, bot - 58, w, 22);
  c.fillStyle = 'rgba(0,0,0,0.16)'; for (let y = bot - 96; y > topY; y -= 46) c.fillRect(x0, y, w, 5);
  c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(x0 + 5, topY, 4, bot - 16 - topY);
  c.restore();
  const n = Math.max(1, Math.round(w / 40));
  for (let i = 0; i < n; i++) {
    const glow = 0.5 + 0.5 * Math.sin(t * 5 + i * 1.7 + x0 * 0.02);
    c.fillStyle = `rgba(255,230,120,${0.55 + 0.35 * glow})`; c.beginPath(); c.arc(x0 + (w * (i + 0.5)) / n, bot - 47, 5, 0, Math.PI * 2); c.fill();
  }
}

