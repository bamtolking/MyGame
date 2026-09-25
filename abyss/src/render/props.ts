// Procedural prop art (barrels, chests, shrines, torches, trees, portals…). Drawn in iso px at zoom 1,
// origin at the prop's ground point.
import { SHRINES } from '../data/zones';
import type { Prop } from '../sim/types';
import { shade } from './iso';

const TAU = Math.PI * 2;

export function flame(c: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, seed: number): void {
  c.save();
  c.globalCompositeOperation = 'lighter';
  const f = Math.sin(t * 13 + seed) * 0.15 + Math.sin(t * 7.3 + seed * 2) * 0.1;
  const g = c.createRadialGradient(x, y - 3 * s, 0, x, y - 3 * s, 9 * s);
  g.addColorStop(0, 'rgba(255,200,90,0.55)'); g.addColorStop(1, 'rgba(255,90,20,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y - 3 * s, 9 * s, 0, TAU); c.fill();
  c.fillStyle = '#ff7a1a'; c.beginPath(); c.moveTo(x - 2.6 * s, y); c.quadraticCurveTo(x - 3 * s, y - 5 * s, x + f * 4 * s, y - (9 + f * 3) * s); c.quadraticCurveTo(x + 3 * s, y - 5 * s, x + 2.6 * s, y); c.fill();
  c.fillStyle = '#ffe28a'; c.beginPath(); c.moveTo(x - 1.2 * s, y); c.quadraticCurveTo(x - 1.4 * s, y - 3 * s, x + f * 2 * s, y - (5.5 + f * 2) * s); c.quadraticCurveTo(x + 1.4 * s, y - 3 * s, x + 1.2 * s, y); c.fill();
  c.restore();
}

function isoBox(c: CanvasRenderingContext2D, w: number, d: number, h: number, top: string, left: string, right: string, y0 = 0): void {
  // w along +x (screen right-down), d along +y (screen left-down); centered at origin
  const hx = w / 2, hy = d / 2;
  const P = (x: number, y: number, z: number): [number, number] => [(x - y) * 0.7071 * 1.0, (x + y) * 0.3535 - z + y0];
  const pts = { a: P(-hx, -hy, h), b: P(hx, -hy, h), c: P(hx, hy, h), d: P(-hx, hy, h), c0: P(hx, hy, 0), d0: P(-hx, hy, 0), b0: P(hx, -hy, 0) };
  c.fillStyle = left; c.beginPath(); c.moveTo(...pts.d); c.lineTo(...pts.c); c.lineTo(...pts.c0); c.lineTo(...pts.d0); c.closePath(); c.fill();
  c.fillStyle = right; c.beginPath(); c.moveTo(...pts.c); c.lineTo(...pts.b); c.lineTo(...pts.b0); c.lineTo(...pts.c0); c.closePath(); c.fill();
  c.fillStyle = top; c.beginPath(); c.moveTo(...pts.a); c.lineTo(...pts.b); c.lineTo(...pts.c); c.lineTo(...pts.d); c.closePath(); c.fill();
}

function shadowBlob(c: CanvasRenderingContext2D, rx: number, ry: number): void {
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.fill();
}

export function drawProp(c: CanvasRenderingContext2D, p: Prop, t: number, zone: number): void {
  const v = p.variant;
  switch (p.kind) {
    case 'barrel': {
      if (p.used) { c.fillStyle = '#4a3220'; for (let i = 0; i < 5; i++) c.fillRect(-9 + i * 4 + (i % 2) * 2, -2 + (i % 3), 5, 2); return; }
      shadowBlob(c, 10, 5);
      const body = ['#7a5230', '#6a4628', '#8a5e36'][v % 3];
      c.fillStyle = shade(body, -0.25); c.beginPath(); c.ellipse(0, -2, 8.5, 4.2, 0, 0, Math.PI); c.fill();
      c.fillStyle = body; c.beginPath(); c.moveTo(-8.5, -2); c.quadraticCurveTo(-10, -11, -8.5, -20); c.lineTo(8.5, -20); c.quadraticCurveTo(10, -11, 8.5, -2); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.8; for (const x of [-4.5, 0, 4.5]) { c.beginPath(); c.moveTo(x, -3); c.lineTo(x, -19); c.stroke(); }
      c.strokeStyle = '#3a3a3a'; c.lineWidth = 1.6; for (const y of [-6, -16]) { c.beginPath(); c.moveTo(-9.3, y); c.quadraticCurveTo(0, y + 3, 9.3, y); c.stroke(); }
      c.fillStyle = shade(body, 0.12); c.beginPath(); c.ellipse(0, -20, 8.5, 4.2, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(0, -20, 6, 2.8, 0, 0, TAU); c.fill();
      return;
    }
    case 'crate': {
      if (p.used) { c.fillStyle = '#5a4428'; for (let i = 0; i < 4; i++) c.fillRect(-8 + i * 4, -1 + (i % 2) * 2, 6, 2); return; }
      shadowBlob(c, 12, 6);
      isoBox(c, 16, 16, 15, '#8a6a40', '#6a4e2e', '#5a4024');
      c.strokeStyle = 'rgba(40,24,10,0.7)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(-11.3, -9.5); c.lineTo(0, -3.8); c.moveTo(0, -3.8); c.lineTo(11.3, -9.5); c.stroke();
      return;
    }
    case 'chest': case 'bigchest': case 'stash': {
      const big = p.kind !== 'chest';
      const s = big ? 1.25 : 1;
      shadowBlob(c, 14 * s, 7 * s);
      c.save(); c.scale(s, s);
      const wood = p.kind === 'stash' ? '#5a3a24' : '#6a4424';
      isoBox(c, 20, 12, 10, shade(wood, 0.1), wood, shade(wood, -0.25));
      if (p.used && p.kind !== 'stash') {
        c.fillStyle = shade(wood, -0.4); c.beginPath(); c.moveTo(-11, -11); c.lineTo(3, -18); c.lineTo(3, -26); c.lineTo(-11, -19); c.fill();
        c.fillStyle = 'rgba(255,210,80,0.5)'; c.beginPath(); c.ellipse(-1, -10, 6, 2.5, 0, 0, TAU); c.fill();
      } else {
        c.fillStyle = shade(wood, 0.2); c.beginPath(); c.moveTo(-10.6, -12.1); c.quadraticCurveTo(-3, -19, 3.5, -16.3); c.lineTo(11.3, -11.8); c.quadraticCurveTo(4, -5, -3, -8.1); c.closePath(); c.fill();
        c.strokeStyle = big ? '#e0b040' : '#b89040'; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(-7, -9.6); c.lineTo(-7, -2); c.moveTo(4.5, -8); c.lineTo(4.5, -0.5); c.stroke();
        c.fillStyle = '#e0c060'; c.fillRect(-1.5, -6.5, 3, 3.5);
      }
      c.restore();
      return;
    }
    case 'sarco': {
      shadowBlob(c, 16, 8);
      isoBox(c, 26, 11, 9, '#8a8478', '#6a655c', '#56524a');
      if (p.used) { c.save(); c.translate(5, -4); isoBox(c, 26, 11, 3, '#9a9488', '#7a756c', '#66625a', -9); c.restore(); c.fillStyle = '#0a0806'; c.beginPath(); c.ellipse(-2, -9, 8, 2.5, 0.45, 0, TAU); c.fill(); }
      else { isoBox(c, 27, 12, 3, '#9a9488', '#7a756c', '#66625a', -9); c.strokeStyle = 'rgba(40,30,20,0.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-6, -16); c.lineTo(4, -11); c.moveTo(-3, -14.5); c.lineTo(-1, -16); c.stroke(); }
      return;
    }
    case 'shrine': {
      shadowBlob(c, 12, 6);
      isoBox(c, 14, 14, 10, '#7a766c', '#5e5a52', '#4a4640');
      isoBox(c, 9, 9, 8, '#8a867c', '#6e6a62', '#5a5650', -10);
      const col = SHRINES[v % SHRINES.length].color;
      if (!p.used) {
        const bob = Math.sin(t * 2) * 2;
        c.save(); c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(0, -30 + bob, 0, 0, -30 + bob, 16);
        g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, -30 + bob, 16, 0, TAU); c.fill();
        c.restore();
        c.fillStyle = col; c.beginPath(); c.moveTo(0, -38 + bob); c.lineTo(4, -30 + bob); c.lineTo(0, -22 + bob); c.lineTo(-4, -30 + bob); c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.moveTo(0, -37 + bob); c.lineTo(1.5, -31 + bob); c.lineTo(0, -29 + bob); c.fill();
      } else { c.fillStyle = '#3a3a3a'; c.beginPath(); c.moveTo(0, -24); c.lineTo(3, -20); c.lineTo(0, -18); c.lineTo(-3, -20); c.fill(); }
      return;
    }
    case 'torch': {
      c.fillStyle = '#2a2420'; c.fillRect(-1.5, -4, 3, 8);
      c.fillStyle = '#4a3a2a'; c.beginPath(); c.moveTo(-3.5, -4); c.lineTo(3.5, -4); c.lineTo(2, -1); c.lineTo(-2, -1); c.fill();
      flame(c, 0, -4, 1, t, p.id);
      return;
    }
    case 'brazier': {
      shadowBlob(c, 10, 5);
      c.strokeStyle = '#2a2220'; c.lineWidth = 2; c.beginPath(); c.moveTo(-6, 0); c.lineTo(0, -14); c.lineTo(6, 0); c.moveTo(0, 2); c.lineTo(0, -14); c.stroke();
      c.fillStyle = '#3a302a'; c.beginPath(); c.ellipse(0, -15, 9, 4, 0, 0, TAU); c.fill();
      c.fillStyle = '#ff6a1a'; c.beginPath(); c.ellipse(0, -16, 7, 2.8, 0, 0, TAU); c.fill();
      flame(c, -3, -16, 1.1, t, p.id); flame(c, 3, -16, 1.2, t, p.id + 3); flame(c, 0, -17, 1.5, t, p.id + 7);
      return;
    }
    case 'pillar': {
      shadowBlob(c, 13, 6.5);
      const col = zone === 2 ? '#6a5446' : '#6e6a62';
      c.fillStyle = shade(col, -0.2); c.beginPath(); c.ellipse(0, -2, 11, 5.5, 0, 0, TAU); c.fill();
      const g = c.createLinearGradient(-8, 0, 8, 0);
      g.addColorStop(0, shade(col, 0.15)); g.addColorStop(0.6, col); g.addColorStop(1, shade(col, -0.35));
      c.fillStyle = g; c.fillRect(-8, -78, 16, 76);
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.8; for (const x of [-4, 0, 4]) { c.beginPath(); c.moveTo(x, -76); c.lineTo(x, -4); c.stroke(); }
      c.fillStyle = shade(col, 0.1); c.beginPath(); c.ellipse(0, -79, 11, 5, 0, 0, TAU); c.fill();
      c.fillStyle = shade(col, -0.1); c.fillRect(-11, -84, 22, 5);
      c.fillStyle = shade(col, 0.2); c.beginPath(); c.ellipse(0, -84, 11, 5, 0, 0, TAU); c.fill();
      return;
    }
    case 'candle': {
      shadowBlob(c, 7, 3.5);
      c.strokeStyle = '#8a7a50'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -24); c.moveTo(-6, -20); c.quadraticCurveTo(0, -14, 6, -20); c.stroke();
      c.fillStyle = '#e8e0c8'; for (const x of [-6, 0, 6]) c.fillRect(x - 1.2, x === 0 ? -30 : -26, 2.4, 6);
      for (const x of [-6, 0, 6]) flame(c, x, x === 0 ? -30 : -26, 0.55, t, p.id + x);
      return;
    }
    case 'statue': {
      shadowBlob(c, 13, 6.5);
      isoBox(c, 16, 16, 10, '#76726a', '#5a564e', '#4a4640');
      c.fillStyle = '#86827a'; c.beginPath(); c.moveTo(-7, -10); c.quadraticCurveTo(-8, -34, 0, -40); c.quadraticCurveTo(8, -34, 7, -10); c.closePath(); c.fill();
      c.beginPath(); c.arc(0, -44, 4.5, 0, TAU); c.fill();
      c.fillStyle = '#6e6a62'; c.beginPath(); c.moveTo(-3, -34); c.quadraticCurveTo(-20, -50, -16, -26); c.quadraticCurveTo(-10, -30, -3, -26); c.fill();
      c.beginPath(); c.moveTo(3, -34); c.quadraticCurveTo(20, -50, 16, -26); c.quadraticCurveTo(10, -30, 3, -26); c.fill();
      return;
    }
    case 'tree': {
      shadowBlob(c, 18, 9);
      const sway = Math.sin(t * 0.8 + p.id) * 1.5;
      c.fillStyle = '#3a2a1a'; c.beginPath(); c.moveTo(-3, 0); c.lineTo(-2, -30); c.lineTo(2, -30); c.lineTo(3.5, 0); c.fill();
      const greens = [['#1e3218', '#2a4420', '#365428'], ['#24321a', '#30421e', '#3e5226'], ['#1a2a1e', '#243a28', '#2e4a32'], ['#2a3418', '#36441c', '#465624']][v % 4];
      const blobs: [number, number, number][] = [[0, -40, 15], [-10, -32, 11], [10, -33, 11], [-5, -52, 11], [6, -50, 10], [0, -60, 8]];
      greens.forEach((gcol, i) => { c.fillStyle = gcol; for (const [x, y, r] of blobs) { c.beginPath(); c.arc(x + sway * (1 - y / -60) - i, y - i * 1.5, r * (1 - i * 0.18), 0, TAU); c.fill(); } });
      return;
    }
    case 'well': {
      shadowBlob(c, 18, 9);
      c.fillStyle = '#5e5a52'; c.beginPath(); c.ellipse(0, -2, 14, 7, 0, 0, TAU); c.fill();
      c.fillRect(-14, -12, 28, 10);
      c.fillStyle = '#76726a'; c.beginPath(); c.ellipse(0, -12, 14, 7, 0, 0, TAU); c.fill();
      c.fillStyle = '#0a1418'; c.beginPath(); c.ellipse(0, -12, 10, 5, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(80,140,180,0.4)'; c.beginPath(); c.ellipse(0, -11, 7, 3, 0, 0, TAU); c.fill();
      c.strokeStyle = '#4a3220'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-11, -12); c.lineTo(-11, -40); c.moveTo(11, -12); c.lineTo(11, -40); c.stroke();
      c.fillStyle = '#6a2e22'; c.beginPath(); c.moveTo(-17, -36); c.lineTo(0, -50); c.lineTo(17, -36); c.lineTo(13, -34); c.lineTo(0, -45); c.lineTo(-13, -34); c.fill();
      c.strokeStyle = '#8a7a60'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0, -40); c.lineTo(0, -22); c.stroke(); c.fillStyle = '#5a3a20'; c.fillRect(-2, -24, 4, 4);
      return;
    }
    case 'fence': {
      c.strokeStyle = '#5a3e22'; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(-14, 7); c.lineTo(-14, -12); c.moveTo(14, -7); c.lineTo(14, -26); c.stroke();
      c.lineWidth = 1.8; c.beginPath(); c.moveTo(-15, -2); c.lineTo(15, -17); c.moveTo(-15, -8); c.lineTo(15, -23); c.stroke();
      return;
    }
    case 'waypoint': {
      c.fillStyle = '#4a4a52'; c.beginPath(); c.ellipse(0, 0, 26, 13, 0, 0, TAU); c.fill();
      c.fillStyle = '#5e5e68'; c.beginPath(); c.ellipse(0, -3, 26, 13, 0, 0, TAU); c.fill();
      c.save(); c.globalCompositeOperation = 'lighter';
      const pulse = 0.55 + 0.45 * Math.sin(t * 2.2);
      c.strokeStyle = `rgba(90,160,255,${0.5 + 0.4 * pulse})`; c.lineWidth = 2;
      c.beginPath(); c.ellipse(0, -3, 19, 9.5, 0, 0, TAU); c.stroke();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + t * 0.3; c.fillStyle = `rgba(140,200,255,${0.6 * pulse})`; c.fillRect(Math.cos(a) * 22 - 1.5, -3 + Math.sin(a) * 11 - 1, 3, 2); }
      const g = c.createRadialGradient(0, -3, 0, 0, -3, 22); g.addColorStop(0, `rgba(80,140,255,${0.35 * pulse})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(0, -3, 22, 11, 0, 0, TAU); c.fill();
      c.restore();
      return;
    }
    case 'portal': {
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(0, -26, 2, 0, -26, 26);
      g.addColorStop(0, 'rgba(200,230,255,0.95)'); g.addColorStop(0.4, 'rgba(60,120,255,0.8)'); g.addColorStop(1, 'rgba(20,40,160,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(0, -26, 14, 27, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(160,210,255,0.8)'; c.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(0, -26, 12 - i * 3, 24 - i * 6, 0, t * (2 + i) + i, t * (2 + i) + i + 3.6); c.stroke(); }
      c.restore();
      return;
    }
    case 'crystal': {
      const col = ['#60a0ff', '#b070ff', '#ff5070'][v % 3];
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(0, -12, 0, 0, -12, 22); g.addColorStop(0, shade(col, 0) .replace('rgb', 'rgba').replace(')', ',0.35)')); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, -12, 22, 0, TAU); c.fill(); c.restore();
      const shards: [number, number, number, number][] = [[-6, 0, 5, 22], [0, 0, 6, 30], [6, 0, 4.5, 18], [-2, 2, 4, 14], [4, 2, 3.5, 12]];
      for (const [x, y, w, h] of shards) {
        c.fillStyle = shade(col, -0.2); c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x, y - h); c.lineTo(x + w / 2, y); c.closePath(); c.fill();
        c.fillStyle = shade(col, 0.4); c.beginPath(); c.moveTo(x - w / 4, y - 1); c.lineTo(x, y - h + 2); c.lineTo(x, y); c.closePath(); c.fill();
      }
      return;
    }
    case 'rock': {
      shadowBlob(c, 13, 6.5);
      const col = zone === 3 ? '#5a4c40' : '#5a5650';
      c.fillStyle = shade(col, -0.2); c.beginPath(); c.ellipse(2, -6, 12, 8, 0.2, 0, TAU); c.fill();
      c.fillStyle = col; c.beginPath(); c.ellipse(-2, -9, 10, 8, -0.3, 0, TAU); c.fill();
      c.fillStyle = shade(col, 0.2); c.beginPath(); c.ellipse(-4, -12, 5, 3.5, -0.3, 0, TAU); c.fill();
      return;
    }
    case 'lamp': {
      shadowBlob(c, 6, 3);
      c.strokeStyle = '#2a2622'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -40); c.lineTo(6, -40); c.stroke();
      c.fillStyle = '#3a3026'; c.fillRect(3, -39, 6, 2);
      c.save(); c.shadowColor = '#ffb040'; c.shadowBlur = 12; c.fillStyle = '#ffd070'; c.fillRect(4, -37, 4, 6); c.restore();
      return;
    }
    case 'grave': {
      c.fillStyle = '#2e2a22'; c.beginPath(); c.ellipse(0, 1, 10, 5, 0, 0, TAU); c.fill();
      const col = ['#6a665e', '#5a564e', '#7a766c'][v % 3];
      c.fillStyle = col; c.beginPath(); c.moveTo(-6, 0); c.lineTo(-6, -14); c.quadraticCurveTo(0, -21, 6, -14); c.lineTo(6, 0); c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-1, -14, 2, 8); c.fillRect(-3.5, -12, 7, 2);
      return;
    }
    case 'cart': {
      shadowBlob(c, 18, 9);
      isoBox(c, 26, 14, 8, '#7a5a36', '#5a4028', '#4a3420', -6);
      c.fillStyle = '#3a2818'; c.strokeStyle = '#2a1a10'; c.lineWidth = 1.5;
      for (const x of [-10, 8]) { c.beginPath(); c.ellipse(x, -3, 5, 6, 0, 0, TAU); c.fill(); c.stroke(); }
      c.strokeStyle = '#5a4028'; c.lineWidth = 2; c.beginPath(); c.moveTo(14, -8); c.lineTo(24, -2); c.stroke();
      return;
    }
    case 'lavavent': {
      c.save(); c.globalCompositeOperation = 'lighter';
      const pulse = 0.6 + 0.4 * Math.sin(t * 3 + p.id);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 16); g.addColorStop(0, `rgba(255,140,40,${0.7 * pulse})`); g.addColorStop(1, 'rgba(255,40,0,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 16, 8, 0, 0, TAU); c.fill(); c.restore();
      c.strokeStyle = '#ffb040'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-9, 1); c.lineTo(-3, -2); c.lineTo(2, 1); c.lineTo(8, -2); c.stroke();
      return;
    }
    case 'spikes': {
      c.fillStyle = '#2a2020';
      for (let i = 0; i < 9; i++) { const x = -9 + (i % 3) * 9 + (Math.floor(i / 3) % 2) * 4, y = -4 + Math.floor(i / 3) * 4; c.beginPath(); c.moveTo(x - 1.5, y); c.lineTo(x, y - 8); c.lineTo(x + 1.5, y); c.fill(); }
      return;
    }
    default: return;
  }
}

/** Props that are tall enough to hide the hero when in front of him. */
export const TALL_PROPS = new Set(['pillar', 'tree', 'statue', 'well']);
