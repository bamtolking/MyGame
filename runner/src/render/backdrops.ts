// Biome backdrops: parallax silhouettes (rendered once per biome/size to offscreen canvases).
import type { BiomeDef } from '../data/biomes';
import { shade } from './characters';

export /** Parallax silhouettes. li 0 = far, 1 = mid, 2 = near. Drawn in css px on a tile W wide. */
function paintLayer(g: CanvasRenderingContext2D, bi: BiomeDef, li: number, W: number, groundY: number, sc: number, col: string): void {
  let sd = 1000 + li * 77 + bi.id.length * 13; const r = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; };
  const base = groundY - (li === 0 ? 150 : li === 1 ? 70 : 10) * sc;
  g.fillStyle = col;
  const style = (bi as any).style ?? 'hills';
  if (li === 0) {
    // far: soft hills / mountains / skyline
    g.beginPath(); g.moveTo(0, groundY);
    const peaks = 6; for (let i = 0; i <= peaks; i++) { const x = (W * i) / peaks; const h = (style === 'snow' ? 190 : 110) * sc * (0.6 + r() * 0.5); g.lineTo(x - W / peaks / 2, base - h * 0.3); g.lineTo(x, base - h); }
    g.lineTo(W, groundY); g.closePath(); g.fill();
    if (style === 'snow') { g.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i <= peaks; i++) { const x = (W * i) / peaks; g.beginPath(); g.arc(x, base - 150 * sc, 16 * sc, 0, Math.PI * 2); g.fill(); } }
    return;
  }
  // mid / near: buildings, stalls, trees depending on style
  g.fillRect(0, base, W, groundY - base + 400);
  let x = 0;
  while (x < W) {
    const w = (li === 1 ? 70 : 50) * sc * (0.7 + r() * 0.8); const h = (li === 1 ? 120 : 70) * sc * (0.5 + r() * 0.8);
    if (style === 'market' || style === 'hills') {
      g.fillStyle = col; g.fillRect(x, base - h, w, h + 2);
      if (li === 2) { g.fillStyle = shade(col, 0.25); g.beginPath(); g.moveTo(x - 6 * sc, base - h + 2); g.lineTo(x + w / 2, base - h - 18 * sc); g.lineTo(x + w + 6 * sc, base - h + 2); g.closePath(); g.fill(); }
      g.fillStyle = 'rgba(255,214,120,0.55)'; for (let k = 0; k < 3; k++) if (r() > 0.4) g.fillRect(x + w * 0.2 + k * w * 0.25, base - h * 0.7, 5 * sc, 7 * sc);
      if (li === 1 && r() > 0.5) { g.fillStyle = 'rgba(255,120,90,0.8)'; g.beginPath(); g.arc(x + w / 2, base - h - 10 * sc, 6 * sc, 0, Math.PI * 2); g.fill(); }
    } else if (style === 'hanok') {
      g.fillStyle = col; g.fillRect(x + 6 * sc, base - h * 0.6, w - 12 * sc, h * 0.6 + 2);
      g.beginPath(); g.moveTo(x - 8 * sc, base - h * 0.6); g.quadraticCurveTo(x + w / 2, base - h * 0.95, x + w + 8 * sc, base - h * 0.6); g.lineTo(x + w + 14 * sc, base - h * 0.66); g.lineTo(x - 14 * sc, base - h * 0.66); g.closePath(); g.fill();
    } else if (style === 'city') {
      g.fillStyle = col; g.fillRect(x, base - h * 1.4, w * 0.9, h * 1.4 + 2);
      g.fillStyle = 'rgba(255,240,180,0.5)'; for (let yy = base - h * 1.3; yy < base - 8; yy += 14 * sc) for (let xx = x + 6 * sc; xx < x + w * 0.8; xx += 12 * sc) if (r() > 0.5) g.fillRect(xx, yy, 4 * sc, 6 * sc);
    } else if (style === 'snow') {
      g.fillStyle = col; g.beginPath(); g.moveTo(x, base + 2); g.lineTo(x + w / 2, base - h * 1.2); g.lineTo(x + w, base + 2); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(x + w * 0.35, base - h * 0.8); g.lineTo(x + w / 2, base - h * 1.2); g.lineTo(x + w * 0.65, base - h * 0.8); g.closePath(); g.fill();
    }
    x += w + (li === 1 ? 20 : 30) * sc * r();
  }
  if (li === 2 && style === 'market') { // string lights
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5; g.beginPath();
    for (let xx = 0; xx <= W; xx += 20) g.lineTo(xx, base - 95 * sc + Math.sin(xx / W * Math.PI * 4) * 12 * sc); g.stroke();
    for (let xx = 10; xx < W; xx += 40) { g.fillStyle = ['#ffd166', '#ff5d8f', '#4cc9f0'][(xx / 40 | 0) % 3]; g.beginPath(); g.arc(xx, base - 95 * sc + Math.sin(xx / W * Math.PI * 4) * 12 * sc + 4, 3.5 * sc, 0, Math.PI * 2); g.fill(); }
  }
}
