// Ground rendering: a 1px-per-tile colour map scaled up with smoothing (soft zone borders),
// plus lazily baked 8x8-tile detail chunks. Tall obstacles are returned for the y-sorted sprite pass.
import { TILE } from '../../shared/constants.ts';
import { T, SOLID, type GameMap } from '../../shared/map.ts';
import { hash2, fbm } from '../../shared/rng.ts';
import { ZONES } from '../../shared/data/zones.ts';

const CH = 8; const CW = CH * TILE;
type Ctx = CanvasRenderingContext2D;
export interface TileObj { kind: string; x: number; y: number; v: number; light?: string }

function hex(c: string): [number, number, number] { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

export class Terrain {
  map: GameMap; colorMap: HTMLCanvasElement; miniMap: HTMLCanvasElement; scale = 1;
  private chunks = new Map<number, HTMLCanvasElement>(); private order: number[] = [];
  constructor(map: GameMap) { this.map = map; this.colorMap = this.buildColorMap(false); this.miniMap = this.buildColorMap(true); }
  setScale(s: number): void { if (Math.abs(s - this.scale) > 0.01) { this.scale = s; this.chunks.clear(); this.order = []; } }

  private tileColor(x: number, y: number, mini: boolean): [number, number, number] {
    const m = this.map; const i = y * m.w + x; const t = m.tiles[i]; const z = ZONES[m.zones[i]] ?? ZONES[1];
    const n = fbm(x / 6, y / 6, 99);
    if (mini) {
      if (t === T.VOID) return [10, 12, 22]; if (t === T.WATER) return [36, 86, 120]; if (t === T.ROAD) return [150, 128, 96];
      if (t === T.PLAZA || t === T.HOUSE || t === T.MOONTREE) return [170, 160, 140]; if (t === T.ARENA) return [150, 70, 60];
      const c = hex(z.mini); return SOLID[t] ? mix(c, [10, 20, 16], 0.35) : c;
    }
    switch (t) {
      case T.VOID: return mix([14, 16, 28], [24, 26, 40], n);
      case T.WATER: return m.zones[i] === 2 ? mix([22, 60, 70], [30, 78, 88], n) : mix([22, 48, 80], [30, 62, 100], n);
      case T.ROAD: return mix([104, 88, 66], [120, 102, 76], n);
      case T.PLAZA: case T.HOUSE: case T.MOONTREE: return mix([86, 86, 100], [100, 98, 112], n);
      case T.MUD: return mix([58, 60, 42], [70, 70, 48], n);
      case T.ARENA: return mix([92, 60, 56], [108, 70, 64], n);
      case T.WALL: return m.zones[i] === 0 ? [70, 72, 88] : [74, 70, 82];
      default: return mix(hex(z.ground), hex(z.ground2), n);
    }
  }
  private buildColorMap(mini: boolean): HTMLCanvasElement {
    const m = this.map; const cv = document.createElement('canvas'); cv.width = m.w; cv.height = m.h;
    const c = cv.getContext('2d')!; const img = c.createImageData(m.w, m.h);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const [r, g, b] = this.tileColor(x, y, mini); const o = (y * m.w + x) * 4; img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255; }
    c.putImageData(img, 0, 0); return cv;
  }

  /** Draw ground for the visible world rect (ctx already in world space). Bakes at most `budget` new chunks. */
  draw(c: Ctx, x0: number, y0: number, x1: number, y1: number, budget = 2): void {
    const cx0 = Math.max(0, Math.floor(x0 / CW)), cy0 = Math.max(0, Math.floor(y0 / CW));
    const cx1 = Math.min(Math.ceil(this.map.w / CH) - 1, Math.floor(x1 / CW)), cy1 = Math.min(Math.ceil(this.map.h / CH) - 1, Math.floor(y1 / CW));
    c.imageSmoothingEnabled = true;
    // base colour everywhere first (covers chunks not baked yet)
    c.drawImage(this.colorMap, x0 / TILE - 1, y0 / TILE - 1, (x1 - x0) / TILE + 2, (y1 - y0) / TILE + 2, x0 - TILE * 1.5, y0 - TILE * 1.5, x1 - x0 + TILE * 2, y1 - y0 + TILE * 2);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const k = cy * 64 + cx; let ch = this.chunks.get(k);
      if (!ch && budget > 0) { budget--; ch = this.bake(cx, cy); this.chunks.set(k, ch); this.order.push(k); if (this.order.length > 70) this.chunks.delete(this.order.shift()!); }
      if (ch) c.drawImage(ch, cx * CW, cy * CW, CW, CW);
    }
  }
  private bake(cx: number, cy: number): HTMLCanvasElement {
    const s = this.scale; const cv = document.createElement('canvas'); cv.width = Math.ceil(CW * s); cv.height = Math.ceil(CW * s);
    const c = cv.getContext('2d')!; c.scale(s, s); c.translate(-cx * CW, -cy * CW); c.imageSmoothingEnabled = true; c.lineCap = 'round';
    const tx0 = cx * CH, ty0 = cy * CH;
    c.drawImage(this.colorMap, tx0 - 1, ty0 - 1, CH + 2, CH + 2, (tx0 - 1.5) * TILE, (ty0 - 1.5) * TILE, (CH + 2) * TILE, (CH + 2) * TILE);
    const m = this.map;
    for (let ty = ty0; ty < ty0 + CH; ty++) for (let tx = tx0; tx < tx0 + CH; tx++) {
      if (tx >= m.w || ty >= m.h) continue; const t = m.tiles[ty * m.w + tx]; const z = m.zones[ty * m.w + tx];
      const X = tx * TILE, Y = ty * TILE; const h = hash2(tx, ty, 7), h2 = hash2(tx, ty, 13), h3 = hash2(tx, ty, 29);
      switch (t) {
        case T.GRASS: case T.TREE: case T.MAPLE: case T.DEADTREE: case T.ROCK: case T.GRAVE: case T.JANGSEUNG: case T.SHRUB: case T.LANTERN: {
          const light = z === 4 ? 'rgba(255,190,140,0.18)' : z === 3 ? 'rgba(200,200,230,0.12)' : 'rgba(160,230,170,0.16)';
          const dark = 'rgba(0,0,0,0.16)';
          for (let k = 0; k < 3; k++) { const gx = X + hash2(tx * 3 + k, ty, 3) * TILE, gy = Y + hash2(tx, ty * 3 + k, 5) * TILE; c.strokeStyle = k % 2 ? light : dark; c.lineWidth = 1.4; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - 1.5, gy - 5); c.moveTo(gx + 2, gy); c.lineTo(gx + 3, gy - 4); c.stroke(); }
          if (z === 1 && h < 0.07) { const col = ['#ffd6e8', '#fff3a8', '#e8f0ff'][Math.floor(h2 * 3)]; for (let k = 0; k < 3; k++) { c.fillStyle = col; c.beginPath(); c.arc(X + 8 + h3 * 16 + k * 3, Y + 10 + h2 * 12 + (k % 2) * 3, 1.6, 0, 6.3); c.fill(); } }
          if (z === 1 && h > 0.985) { c.fillStyle = '#c8323a'; c.beginPath(); c.ellipse(X + 16, Y + 16, 4, 3, 0, Math.PI, 0); c.fill(); c.fillStyle = '#efe6d4'; c.fillRect(X + 15, Y + 16, 2, 4); }
          if (z === 4 && h < 0.3) for (let k = 0; k < 2; k++) { c.fillStyle = ['#d8602a', '#e8a03a', '#b8323a'][(k + Math.floor(h2 * 3)) % 3]; c.beginPath(); c.ellipse(X + hash2(tx + k, ty, 41) * TILE, Y + hash2(tx, ty + k, 43) * TILE, 2.6, 1.6, h3 * 3, 0, 6.3); c.fill(); }
          if (z === 3 && h < 0.08) { c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; c.strokeRect(X + 4 + h2 * 8, Y + 6 + h3 * 8, 14, 10); }
          if (t === T.SHRUB) { c.fillStyle = '#23583a'; for (const [dx, dy, r] of [[12, 18, 7], [20, 16, 6], [16, 12, 6]]) { c.beginPath(); c.arc(X + dx, Y + dy, r, 0, 6.3); c.fill(); } c.fillStyle = 'rgba(160,230,170,0.3)'; c.beginPath(); c.arc(X + 14, Y + 11, 3, 0, 6.3); c.fill(); }
          break;
        }
        case T.ROAD: { if (h < 0.5) { c.fillStyle = 'rgba(40,30,20,0.28)'; c.beginPath(); c.ellipse(X + h2 * TILE, Y + h3 * TILE, 2.4, 1.6, 0, 0, 6.3); c.fill(); c.fillStyle = 'rgba(255,240,210,0.12)'; c.beginPath(); c.ellipse(X + h3 * TILE, Y + h * 2 * TILE, 2, 1.3, 0, 0, 6.3); c.fill(); } break; }
        case T.PLAZA: case T.ARENA: {
          c.strokeStyle = t === T.ARENA ? 'rgba(20,0,0,0.35)' : 'rgba(10,10,20,0.3)'; c.lineWidth = 1;
          const off = (ty % 2) * 8; for (let k = 0; k < 2; k++) { c.strokeRect(X + ((off + k * 16) % 32), Y + k * 16, 16, 16); }
          c.fillStyle = `rgba(255,255,255,${(h * 0.06).toFixed(3)})`; c.fillRect(X + 1, Y + 1, 14, 14); break;
        }
        case T.MUD: case T.REED: {
          if (h < 0.4) { c.fillStyle = 'rgba(20,30,20,0.35)'; c.beginPath(); c.ellipse(X + h2 * TILE, Y + h3 * TILE, 5, 2.5, 0, 0, 6.3); c.fill(); }
          if (t === T.REED) for (let k = 0; k < 4; k++) { const rx = X + 5 + k * 6 + h2 * 3, ry = Y + 26 - h3 * 4; c.strokeStyle = '#6a8a4a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx + (k % 2 ? 2 : -2), ry - 16); c.stroke(); c.fillStyle = '#8a6a3a'; c.beginPath(); c.ellipse(rx + (k % 2 ? 2 : -2), ry - 17, 1.6, 3.5, 0, 0, 6.3); c.fill(); }
          break;
        }
        case T.WATER: {
          c.strokeStyle = 'rgba(180,230,255,0.16)'; c.lineWidth = 1.2; if (h < 0.35) { c.beginPath(); c.arc(X + h2 * TILE, Y + h3 * TILE, 5, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
          if (z === 2 && h > 0.9) { c.fillStyle = '#3f7a4a'; c.beginPath(); c.arc(X + 16, Y + 16, 6, 0.4, Math.PI * 2); c.lineTo(X + 16, Y + 16); c.fill(); if (h > 0.97) { c.fillStyle = '#ffb8d8'; c.beginPath(); c.arc(X + 18, Y + 14, 2.4, 0, 6.3); c.fill(); } }
          // shoreline foam
          for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const n = this.tileAt(tx + dx, ty + dy); if (n !== T.WATER && n !== T.VOID) { c.strokeStyle = 'rgba(200,240,255,0.22)'; c.lineWidth = 2; c.beginPath(); if (dy) { c.moveTo(X + 2, Y + (dy < 0 ? 2 : 30)); c.lineTo(X + 30, Y + (dy < 0 ? 2 : 30)); } else { c.moveTo(X + (dx < 0 ? 2 : 30), Y + 2); c.lineTo(X + (dx < 0 ? 2 : 30), Y + 30); } c.stroke(); } }
          break;
        }
        case T.WALL: {
          const town = z === 0;
          c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(X, Y + 20, TILE, 12);
          c.fillStyle = town ? '#8a8aa0' : '#7a7488'; c.fillRect(X, Y - 6, TILE, 26);
          c.strokeStyle = 'rgba(20,16,30,0.45)'; c.lineWidth = 1; for (let r = 0; r < 3; r++) { c.beginPath(); c.moveTo(X, Y - 6 + r * 9); c.lineTo(X + TILE, Y - 6 + r * 9); c.stroke(); c.beginPath(); c.moveTo(X + ((r % 2) * 16 + 8), Y - 6 + r * 9); c.lineTo(X + ((r % 2) * 16 + 8), Y + 3 + r * 9); c.stroke(); }
          if (town) { c.fillStyle = '#343a52'; c.fillRect(X - 1, Y - 10, TILE + 2, 7); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(X - 1, Y - 10, TILE + 2, 2); }
          break;
        }
        case T.VOID: {
          c.fillStyle = 'rgba(0,0,0,0.25)'; if (h < 0.5) { c.beginPath(); c.ellipse(X + h2 * TILE, Y + h3 * TILE, 8, 5, h, 0, 6.3); c.fill(); }
          if (this.tileAt(tx, ty + 1) !== T.VOID && this.tileAt(tx, ty + 1) !== -1) { c.fillStyle = '#2a2638'; c.fillRect(X, Y + 18, TILE, 14); c.fillStyle = 'rgba(160,150,200,0.25)'; c.fillRect(X, Y + 18, TILE, 2); }
          break;
        }
      }
    }
    return cv;
  }
  private tileAt(x: number, y: number): number { const m = this.map; if (x < 0 || y < 0 || x >= m.w || y >= m.h) return -1; return m.tiles[y * m.w + x]; }

  /** Tall obstacles in the visible rect, for the y-sorted sprite pass. */
  objects(x0: number, y0: number, x1: number, y1: number, out: TileObj[]): void {
    const m = this.map;
    const tx0 = Math.max(0, Math.floor(x0 / TILE) - 1), ty0 = Math.max(0, Math.floor(y0 / TILE) - 1);
    const tx1 = Math.min(m.w - 1, Math.floor(x1 / TILE) + 1), ty1 = Math.min(m.h - 1, Math.floor(y1 / TILE) + 3);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * m.w + tx; const t = m.tiles[i]; if (!SOLID[t] || t === T.WALL || t === T.WATER || t === T.VOID || t === T.HOUSE || t === T.MOONTREE) continue;
      const z = m.zones[i]; const v = Math.floor(hash2(tx, ty, 17) * 6); const x = tx * TILE + TILE / 2 + (hash2(tx, ty, 19) - 0.5) * 8, y = ty * TILE + TILE - 2;
      let kind = 'tree';
      if (t === T.TREE) kind = z === 3 || (z === 1 && v === 5) ? 'pine' : 'tree';
      else if (t === T.MAPLE) kind = 'maple'; else if (t === T.DEADTREE) kind = 'deadtree'; else if (t === T.ROCK) kind = 'rock';
      else if (t === T.LANTERN) kind = 'lantern'; else if (t === T.JANGSEUNG) kind = 'jangseung'; else if (t === T.GRAVE) kind = 'grave';
      out.push({ kind, x, y, v, light: t === T.LANTERN ? '#ffcf7a' : undefined });
    }
  }
}
