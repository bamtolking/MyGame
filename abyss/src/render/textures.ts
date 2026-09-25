// Procedurally painted, cached tile sprites (floors, walls, stairs, lava) per zone.
import { ZONES } from '../data/zones';
import { HALF_H, HALF_W, TH, TW, WALL_H, shade } from './iso';

export const S = 2; // sprite supersampling
const VARIANTS = 6;

function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * S); c.height = Math.ceil(h * S);
  const x = c.getContext('2d')!;
  x.scale(S, S);
  return [c, x];
}

let seed = 1;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

/** Point on a tile diamond from local (u,v) in [0,1]^2 (u = +x, v = +y). */
const P = (u: number, v: number): [number, number] => [(u - v) * HALF_W + HALF_W, (u + v) * HALF_H];

function diamond(c: CanvasRenderingContext2D, ox = 0, oy = 0): void {
  c.beginPath(); c.moveTo(ox + HALF_W, oy); c.lineTo(ox + TW, oy + HALF_H); c.lineTo(ox + HALF_W, oy + TH); c.lineTo(ox, oy + HALF_H); c.closePath();
}
function quad(c: CanvasRenderingContext2D, u0: number, v0: number, u1: number, v1: number): void {
  const a = P(u0, v0), b = P(u1, v0), d = P(u1, v1), e = P(u0, v1);
  c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.lineTo(e[0], e[1]); c.closePath();
}
function speckle(c: CanvasRenderingContext2D, n: number, cols: string[], size = 1.2): void {
  for (let i = 0; i < n; i++) {
    const [x, y] = P(rnd(), rnd());
    c.fillStyle = cols[Math.floor(rnd() * cols.length)];
    c.globalAlpha = 0.15 + rnd() * 0.35;
    c.fillRect(x, y, size * (0.5 + rnd()), size * 0.6 * (0.5 + rnd()));
  }
  c.globalAlpha = 1;
}
function crack(c: CanvasRenderingContext2D, col: string, width = 0.6): void {
  let [x, y] = P(0.2 + rnd() * 0.6, 0.2 + rnd() * 0.6);
  c.strokeStyle = col; c.lineWidth = width; c.beginPath(); c.moveTo(x, y);
  for (let i = 0; i < 4; i++) { x += (rnd() - 0.5) * 12; y += (rnd() - 0.5) * 6; c.lineTo(x, y); }
  c.stroke();
}

export interface ZoneTex { floors: HTMLCanvasElement[]; walls: HTMLCanvasElement[]; up: HTMLCanvasElement; down: HTMLCanvasElement; lava: HTMLCanvasElement[]; extra: Record<string, HTMLCanvasElement[]> }
const cache = new Map<number, ZoneTex>();

export function zoneTex(zone: number): ZoneTex {
  let t = cache.get(zone);
  if (!t) { t = buildZone(zone); cache.set(zone, t); }
  return t;
}

function floorTile(zone: number, v: number, kind: 'normal' | 'dirt' | 'flag' = 'normal'): HTMLCanvasElement {
  const z = ZONES[zone];
  const [cv, c] = mk(TW, TH);
  seed = zone * 1000 + v * 37 + (kind === 'dirt' ? 500 : kind === 'flag' ? 700 : 0) + 11;
  c.save(); diamond(c); c.clip();
  const [base, dark, light] = z.floorColors;
  if (zone === 0 && kind === 'normal') {
    // grass
    c.fillStyle = shade(base, (rnd() - 0.5) * 0.12); c.fillRect(0, 0, TW, TH);
    for (let i = 0; i < 70; i++) { const [x, y] = P(rnd(), rnd()); c.strokeStyle = rnd() < 0.5 ? shade(light, rnd() * 0.2) : shade(dark, -rnd() * 0.2); c.globalAlpha = 0.5; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 2, y - 1.5 - rnd() * 2); c.stroke(); }
    c.globalAlpha = 1;
    speckle(c, 20, ['#2a3418', '#56683a'], 1.4);
  } else if (zone === 0 && kind === 'dirt') {
    c.fillStyle = shade('#5a4632', (rnd() - 0.5) * 0.1); c.fillRect(0, 0, TW, TH);
    speckle(c, 60, ['#3a2c1e', '#6e5840', '#48382a'], 1.6);
    for (let i = 0; i < 5; i++) { const [x, y] = P(rnd(), rnd()); c.fillStyle = '#7a6a58'; c.globalAlpha = 0.5; c.beginPath(); c.ellipse(x, y, 1.2, 0.7, 0, 0, 7); c.fill(); }
    c.globalAlpha = 1;
  } else if (kind === 'flag' || zone === 1) {
    // flagstones: 2x2 stones with mortar gaps
    const mortar = zone === 0 ? '#3a3228' : z.mortar;
    c.fillStyle = mortar; c.fillRect(0, 0, TW, TH);
    const stoneBase = zone === 0 ? '#6a6458' : base;
    const cuts = rnd() < 0.5 ? [[0, 0, 0.5, 0.5], [0.5, 0, 1, 0.5], [0, 0.5, 0.5, 1], [0.5, 0.5, 1, 1]] : [[0, 0, 1, 0.5], [0, 0.5, 0.5, 1], [0.5, 0.5, 1, 1]];
    for (const [u0, v0, u1, v1] of cuts) {
      const g = 0.035;
      quad(c, u0 + g, v0 + g, u1 - g, v1 - g);
      c.fillStyle = shade(stoneBase, (rnd() - 0.5) * 0.18); c.fill();
      // bevel highlight on top-left edges
      c.strokeStyle = shade(stoneBase, 0.18); c.lineWidth = 0.6; c.globalAlpha = 0.5; c.stroke(); c.globalAlpha = 1;
    }
    speckle(c, 40, [dark, light, '#000000'], 1.1);
    if (rnd() < 0.5) crack(c, shade(dark, -0.4));
  } else if (zone === 2) {
    // packed earth + small bricks
    c.fillStyle = shade(base, (rnd() - 0.5) * 0.12); c.fillRect(0, 0, TW, TH);
    if (rnd() < 0.55) {
      c.fillStyle = z.mortar; c.globalAlpha = 0.9;
      for (let r = 0; r < 4; r++) for (let q = 0; q < 3; q++) {
        const u0 = q / 3 + (r % 2 ? 0.16 : 0), v0 = r / 4;
        quad(c, u0 + 0.02, v0 + 0.02, Math.min(1, u0 + 1 / 3) - 0.02, v0 + 0.25 - 0.02);
        c.fillStyle = shade(light, (rnd() - 0.6) * 0.3); c.fill();
      }
      c.globalAlpha = 1;
    }
    speckle(c, 80, [dark, light, '#1a120c'], 1.3);
    if (rnd() < 0.3) crack(c, '#1a120c');
  } else if (zone === 3) {
    c.fillStyle = shade(base, (rnd() - 0.5) * 0.14); c.fillRect(0, 0, TW, TH);
    for (let i = 0; i < 6; i++) { const [x, y] = P(rnd(), rnd()); c.fillStyle = rnd() < 0.5 ? shade(dark, -0.1) : shade(light, 0.05); c.globalAlpha = 0.45; c.beginPath(); c.ellipse(x, y, 4 + rnd() * 7, 2 + rnd() * 3, 0, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    speckle(c, 70, ['#1a1410', '#6a5a4a', '#2c241e'], 1.4);
    for (let i = 0; i < 4; i++) { const [x, y] = P(rnd(), rnd()); c.fillStyle = '#6e6254'; c.beginPath(); c.ellipse(x, y, 1.3, 0.8, 0, 0, 7); c.fill(); c.fillStyle = '#231d18'; c.fillRect(x - 1, y + 0.5, 2, 0.5); }
    if (rnd() < 0.4) crack(c, '#140e0a', 0.8);
  } else {
    // abyss: dark red rock, glowing veins
    c.fillStyle = shade(base, (rnd() - 0.5) * 0.14); c.fillRect(0, 0, TW, TH);
    for (let i = 0; i < 5; i++) { const [x, y] = P(rnd(), rnd()); c.fillStyle = shade(dark, -0.2); c.globalAlpha = 0.5; c.beginPath(); c.ellipse(x, y, 5 + rnd() * 6, 2 + rnd() * 3, 0, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    speckle(c, 60, ['#140606', '#5a2a24', '#200a08'], 1.3);
    if (rnd() < 0.55) { c.shadowColor = '#ff5010'; c.shadowBlur = 3; crack(c, '#ff6a20', 0.7); c.shadowBlur = 0; }
  }
  // soft edge darkening for tile readability
  c.restore();
  c.save(); diamond(c); c.clip();
  c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1; diamond(c); c.stroke();
  c.restore();
  return cv;
}

function brickFace(c: CanvasRenderingContext2D, pts: [number, number][], col: string, mortar: string, rowH: number, brickW: number, slope: number, zone: number, style: string): void {
  c.save();
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.closePath(); c.clip();
  c.fillStyle = col; c.fillRect(-2, -2, TW + 4, TH + WALL_H + 4);
  const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
  const y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
  if (style === 'rock') {
    for (let i = 0; i < 26; i++) { const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0); c.fillStyle = rnd() < 0.5 ? shade(col, -0.25) : shade(col, 0.12); c.globalAlpha = 0.5; c.beginPath(); c.ellipse(x, y, 3 + rnd() * 6, 2 + rnd() * 5, rnd() * 3, 0, 7); c.fill(); }
    c.globalAlpha = 0.6; c.strokeStyle = shade(col, -0.5); c.lineWidth = 0.7;
    for (let i = 0; i < 5; i++) { let x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0); c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 3; k++) { x += (rnd() - 0.5) * 10; y += rnd() * 9; c.lineTo(x, y); } c.stroke(); }
    c.globalAlpha = 1;
  } else if (style === 'palisade') {
    for (let x = x0; x < x1; x += 5) {
      c.fillStyle = shade(col, (rnd() - 0.5) * 0.3); c.fillRect(x, y0 - 4, 4.4, y1 - y0 + 8);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 3.4, y0 - 4, 1, y1 - y0 + 8);
    }
  } else if (style === 'plaster') {
    c.fillStyle = shade('#c8b48c', (rnd() - 0.5) * 0.08); c.fillRect(x0, y0, x1 - x0, y1 - y0);
    speckle2(c, x0, y0, x1, y1, 30, ['#a89470', '#d8c8a0']);
    // timber frame
    c.strokeStyle = '#4a3220'; c.lineWidth = 2.4;
    const mid = (x0 + x1) / 2;
    c.beginPath(); c.moveTo(x0 + 1, y0 + (slope > 0 ? 0 : 0)); c.stroke();
    for (const x of [x0 + 1.2, mid, x1 - 1.2]) { c.beginPath(); c.moveTo(x, y0 - 10); c.lineTo(x, y1 + 10); c.stroke(); }
    for (const fy of [0.08, 0.55, 0.97]) { c.beginPath(); c.moveTo(x0, y0 + (y1 - y0) * fy + (slope > 0 ? 0 : 0)); c.lineTo(x1, y0 + (y1 - y0) * fy + slope * (x1 - x0)); c.stroke(); }
    // window
    if (rnd() < 0.6) {
      const wx = mid + (rnd() < 0.5 ? -8 : 3), wy = y0 + (y1 - y0) * 0.3 + slope * (wx - x0);
      c.fillStyle = '#2a1a10'; c.fillRect(wx, wy, 6, 8);
      c.fillStyle = rnd() < 0.6 ? '#ffb040' : '#3a2a1a'; c.fillRect(wx + 0.8, wy + 0.8, 4.4, 6.4);
      c.fillStyle = '#2a1a10'; c.fillRect(wx + 2.7, wy, 0.6, 8); c.fillRect(wx, wy + 3.7, 6, 0.6);
    }
  } else {
    // bricks along the slanted face
    c.strokeStyle = mortar; c.lineWidth = zone === 2 ? 0.9 : 1.1;
    let row = 0;
    for (let y = y0 - (x1 - x0) * Math.abs(slope) - rowH; y < y1 + rowH; y += rowH, row++) {
      // row line
      c.beginPath(); c.moveTo(x0, y + (slope > 0 ? 0 : 0)); c.lineTo(x1, y + slope * (x1 - x0)); c.stroke();
      const off = (row % 2) * brickW * 0.5;
      for (let x = x0 - off; x < x1; x += brickW) {
        const yy = y + slope * (x - x0);
        c.fillStyle = shade(col, (rnd() - 0.5) * 0.2);
        c.globalAlpha = 0.55;
        c.beginPath(); c.moveTo(x + 0.6, yy + 0.6 + slope * 0.6); c.lineTo(x + brickW - 0.6, yy + 0.6 + slope * (brickW - 0.6)); c.lineTo(x + brickW - 0.6, yy + rowH - 0.6 + slope * (brickW - 0.6)); c.lineTo(x + 0.6, yy + rowH - 0.6 + slope * 0.6); c.closePath(); c.fill();
        c.globalAlpha = 1;
        c.beginPath(); c.moveTo(x, yy + slope * 0); c.lineTo(x, yy + rowH); c.stroke();
      }
    }
    speckle2(c, x0, y0, x1, y1, 40, [shade(col, -0.4), shade(col, 0.25)]);
    if (zone === 4) { c.shadowColor = '#ff4010'; c.shadowBlur = 4; c.strokeStyle = '#ff5a1a'; c.lineWidth = 0.7; let x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * 20; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 8; y += 5 + rnd() * 6; c.lineTo(x, y); } c.stroke(); c.shadowBlur = 0; }
    if (zone === 2 && rnd() < 0.5) { // skull niche
      const cx = (x0 + x1) / 2 + (rnd() - 0.5) * 8, cy = y0 + (y1 - y0) * 0.45 + slope * ((x0 + x1) / 2 - x0);
      c.fillStyle = '#140c08'; c.beginPath(); c.ellipse(cx, cy, 4, 5, 0, 0, 7); c.fill();
      c.fillStyle = '#c8bca0'; c.beginPath(); c.arc(cx, cy + 0.5, 2.2, 0, 7); c.fill();
      c.fillStyle = '#140c08'; c.fillRect(cx - 1.4, cy, 1, 1); c.fillRect(cx + 0.4, cy, 1, 1);
    }
  }
  // vertical light falloff (dark at the bottom)
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(0.7, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
  c.fillStyle = g; c.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
  c.restore();
}
function speckle2(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, n: number, cols: string[]): void {
  for (let i = 0; i < n; i++) { c.fillStyle = cols[Math.floor(rnd() * cols.length)]; c.globalAlpha = 0.2 + rnd() * 0.3; c.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 1 + rnd(), 0.8); }
  c.globalAlpha = 1;
}

export function wallBlock(zone: number, v: number, style: string, height = WALL_H): HTMLCanvasElement {
  const z = ZONES[zone];
  const [cv, c] = mk(TW, TH + height);
  seed = zone * 777 + v * 91 + style.length * 13 + 5;
  const [top, left, right] = z.wallColors;
  let lc = left, rc = right, tc = top;
  if (style === 'stone') { lc = '#6a665e'; rc = '#4e4a44'; tc = '#7a766c'; }
  if (style === 'palisade') { lc = '#6a4a2a'; rc = '#4e361e'; tc = '#5a3e22'; }
  const L: [number, number][] = [[0, HALF_H], [HALF_W, TH], [HALF_W, TH + height], [0, HALF_H + height]];
  const R: [number, number][] = [[HALF_W, TH], [TW, HALF_H], [TW, HALF_H + height], [HALF_W, TH + height]];
  // draw with the top face at y=0 (raised)
  const rowH = zone === 2 ? 6 : zone === 1 ? 9 : 8;
  const bw = zone === 2 ? 9 : 14;
  const kind = style === 'house' ? 'plaster' : style === 'palisade' ? 'palisade' : zone === 3 ? 'rock' : 'brick';
  brickFace(c, L, lc, z.mortar, rowH, bw, 0.5, zone, kind);
  brickFace(c, R, rc, z.mortar, rowH, bw, -0.5, zone, kind);
  // top face
  c.save(); diamond(c); c.clip();
  if (style === 'house') {
    c.fillStyle = '#6a2e22'; c.fillRect(0, 0, TW, TH);
    c.strokeStyle = '#3a1a12'; c.lineWidth = 0.8;
    for (let k = 0; k < 8; k++) { const [a, b] = [P(k / 8, 0), P(k / 8, 1)]; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    speckle(c, 30, ['#8a3e2e', '#4a2018'], 1.2);
  } else if (style === 'palisade') {
    c.fillStyle = tc; c.fillRect(0, 0, TW, TH);
    for (let k = 0; k < 9; k++) { const [x, y] = P(k / 9 + 0.05, 0.5); c.fillStyle = shade(tc, 0.15); c.beginPath(); c.ellipse(x, y, 3, 1.6, 0, 0, 7); c.fill(); }
  } else {
    c.fillStyle = shade(tc, -0.15); c.fillRect(0, 0, TW, TH);
    speckle(c, 30, [shade(tc, -0.4), shade(tc, 0.2)], 1.3);
    // capstone rim
    c.strokeStyle = shade(tc, 0.15); c.lineWidth = 1.4; diamond(c); c.stroke();
  }
  c.restore();
  // edges
  c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.8;
  c.beginPath(); c.moveTo(HALF_W, TH); c.lineTo(HALF_W, TH + height); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.08)';
  c.beginPath(); c.moveTo(0, HALF_H); c.lineTo(0, HALF_H + height); c.stroke();
  return cv;
}

function stairsTile(zone: number, down: boolean): HTMLCanvasElement {
  const [cv, c] = mk(TW, TH);
  seed = zone * 5 + (down ? 1 : 2);
  const z = ZONES[zone];
  c.save(); diamond(c); c.clip();
  c.fillStyle = z.mortar; c.fillRect(0, 0, TW, TH);
  if (down) {
    for (let i = 0; i < 6; i++) {
      const k = i / 6;
      quad(c, 0.12, 0.12 + k * 0.76, 0.88, 0.12 + (k + 1 / 6) * 0.76);
      c.fillStyle = shade(z.floorColors[2], -0.1 - k * 0.75); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 0.6; c.stroke();
    }
    const g = c.createRadialGradient(TW * 0.5, TH * 0.75, 1, TW * 0.5, TH * 0.75, 18);
    g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, TW, TH);
  } else {
    for (let i = 0; i < 6; i++) {
      const k = i / 6;
      quad(c, 0.12, 0.12 + k * 0.76, 0.88, 0.12 + (k + 1 / 6) * 0.76);
      c.fillStyle = shade(z.floorColors[2], 0.2 - (1 - k) * 0.35); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.6; c.stroke();
    }
  }
  c.restore();
  return cv;
}

function lavaTile(v: number): HTMLCanvasElement {
  const [cv, c] = mk(TW, TH);
  seed = 9000 + v * 17;
  c.save(); diamond(c); c.clip();
  const g = c.createLinearGradient(0, 0, TW, TH);
  g.addColorStop(0, '#c83a08'); g.addColorStop(0.5, '#ff7a14'); g.addColorStop(1, '#b02a06');
  c.fillStyle = g; c.fillRect(0, 0, TW, TH);
  for (let i = 0; i < 9; i++) { const [x, y] = P(rnd(), rnd()); c.fillStyle = rnd() < 0.5 ? '#ffd24a' : '#5a1204'; c.globalAlpha = 0.5; c.beginPath(); c.ellipse(x, y, 3 + rnd() * 7, 1.5 + rnd() * 3, 0, 0, 7); c.fill(); }
  c.globalAlpha = 0.8; c.strokeStyle = '#3a0c02'; c.lineWidth = 1;
  for (let i = 0; i < 3; i++) { let [x, y] = P(rnd(), rnd()); c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 14; y += (rnd() - 0.5) * 6; c.lineTo(x, y); } c.stroke(); }
  c.restore();
  return cv;
}

function buildZone(zone: number): ZoneTex {
  const floors: HTMLCanvasElement[] = [];
  for (let v = 0; v < VARIANTS; v++) floors.push(floorTile(zone, v));
  const walls: HTMLCanvasElement[] = [];
  const extra: Record<string, HTMLCanvasElement[]> = {};
  if (zone === 0) {
    extra.dirt = [0, 1, 2, 3].map((v) => floorTile(0, v, 'dirt'));
    extra.flag = [0, 1, 2, 3].map((v) => floorTile(0, v, 'flag'));
    extra.house = [0, 1, 2].map((v) => wallBlock(0, v, 'house', WALL_H + 14));
    extra.stone = [0, 1, 2].map((v) => wallBlock(1, v, 'stone', WALL_H + 20));
    extra.palisade = [0, 1].map((v) => wallBlock(0, v, 'palisade', WALL_H - 18));
  } else for (let v = 0; v < 4; v++) walls.push(wallBlock(zone, v, 'brick'));
  return { floors, walls, up: stairsTile(zone, false), down: stairsTile(zone, true), lava: [0, 1, 2].map(lavaTile), extra };
}
