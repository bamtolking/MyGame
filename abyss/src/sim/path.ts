// Grid helpers: walkability, circle-vs-grid collision, line of sight, A* and the monster flow field.
import { T_DOOR, T_DOWN, T_FLOOR, T_LAVA, T_UP, T_WATER, type World } from './types';
// Note: flying monsters may cross lava/water; nothing may cross walls or void.

export const isWalkTile = (t: number) => t === T_FLOOR || t === T_UP || t === T_DOWN || t === T_DOOR;

export function walkable(w: World, tx: number, ty: number, fly = false): boolean {
  if (tx < 0 || ty < 0 || tx >= w.w || ty >= w.h) return false;
  const i = ty * w.w + tx;
  const t = w.tiles[i];
  if (w.block[i]) return false;
  return isWalkTile(t) || (fly && (t === T_LAVA || t === T_WATER));
}

/** Blocks sight and projectiles: walls, void and tall props. */
export function opaque(w: World, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= w.w || ty >= w.h) return true;
  const i = ty * w.w + tx;
  const t = w.tiles[i];
  if (w.block[i] === 2) return true;
  return !(isWalkTile(t) || t === T_LAVA || t === T_WATER);
}

export function circleFree(w: World, x: number, y: number, r: number, fly = false): boolean {
  const x0 = Math.floor(x - r), x1 = Math.floor(x + r), y0 = Math.floor(y - r), y1 = Math.floor(y + r);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (walkable(w, tx, ty, fly)) continue;
      const cx = x < tx ? tx : x > tx + 1 ? tx + 1 : x;
      const cy = y < ty ? ty : y > ty + 1 ? ty + 1 : y;
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy < r * r - 1e-6) return false;
    }
  }
  return true;
}

/** Moves a circle by (dx,dy) sliding along blocked tiles. Returns true if it moved at all. */
export function moveCircle(w: World, e: { x: number; y: number }, r: number, dx: number, dy: number, fly = false): boolean {
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return false;
  const steps = Math.max(1, Math.ceil(len / 0.2));
  const sx = dx / steps, sy = dy / steps;
  const ox = e.x, oy = e.y;
  for (let s = 0; s < steps; s++) {
    let nx = e.x + sx, ny = e.y + sy;
    if (circleFree(w, nx, ny, r, fly)) { e.x = nx; e.y = ny; continue; }
    // push out of each overlapping blocked tile
    for (let it = 0; it < 3; it++) {
      let pushed = false;
      const x0 = Math.floor(nx - r), x1 = Math.floor(nx + r), y0 = Math.floor(ny - r), y1 = Math.floor(ny + r);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (walkable(w, tx, ty, fly)) continue;
          const cx = nx < tx ? tx : nx > tx + 1 ? tx + 1 : nx;
          const cy = ny < ty ? ty : ny > ty + 1 ? ty + 1 : ny;
          let ddx = nx - cx, ddy = ny - cy;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 >= r * r) continue;
          const d = Math.sqrt(d2);
          if (d < 1e-6) { ddx = -sx; ddy = -sy; const l = Math.hypot(ddx, ddy) || 1; nx += (ddx / l) * 0.05; ny += (ddy / l) * 0.05; }
          else { const p = r - d + 1e-4; nx += (ddx / d) * p; ny += (ddy / d) * p; }
          pushed = true;
        }
      }
      if (!pushed) break;
    }
    if (circleFree(w, nx, ny, r, fly)) { e.x = nx; e.y = ny; }
    else if (circleFree(w, e.x + sx, e.y, r, fly)) e.x += sx;
    else if (circleFree(w, e.x, e.y + sy, r, fly)) e.y += sy;
  }
  return Math.abs(e.x - ox) + Math.abs(e.y - oy) > 1e-5;
}

/** Sight line: exact grid traversal (DDA). Start and end tiles are not tested; touching a wall corner blocks. */
export function los(w: World, x0: number, y0: number, x1: number, y1: number): boolean {
  let tx = Math.floor(x0), ty = Math.floor(y0);
  const ex = Math.floor(x1), ey = Math.floor(y1);
  const dx = x1 - x0, dy = y1 - y0;
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  let tmx = dx !== 0 ? (sx > 0 ? tx + 1 - x0 : x0 - tx) * tdx : Infinity;
  let tmy = dy !== 0 ? (sy > 0 ? ty + 1 - y0 : y0 - ty) * tdy : Infinity;
  for (let guard = 0; (tx !== ex || ty !== ey) && guard < 400; guard++) {
    if (Math.abs(tmx - tmy) < 1e-9) {
      if (opaque(w, tx + sx, ty) || opaque(w, tx, ty + sy)) return false;
      tx += sx; ty += sy; tmx += tdx; tmy += tdy;
    } else if (tmx < tmy) { tx += sx; tmx += tdx; } else { ty += sy; tmy += tdy; }
    if (tmx > 1 + 1e-9 && tmy > 1 + 1e-9 && (tx !== ex || ty !== ey)) break;
    if (tx === ex && ty === ey) break;
    if (opaque(w, tx, ty)) return false;
  }
  return true;
}

/** Clear straight walk for a circle of radius r. */
export function walkLine(w: World, x0: number, y0: number, x1: number, y1: number, r: number, fly = false): boolean {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.ceil(d / 0.2);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (!circleFree(w, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, fly)) return false;
  }
  return true;
}

// ---------------------------------------------------------------- binary heap on (index, priority)
class Heap {
  idx: Int32Array; pri: Float64Array; n = 0;
  constructor(cap: number) { this.idx = new Int32Array(cap); this.pri = new Float64Array(cap); }
  push(i: number, p: number) {
    if (this.n >= this.idx.length) { const ni = new Int32Array(this.idx.length * 2); ni.set(this.idx); this.idx = ni; const np = new Float64Array(this.pri.length * 2); np.set(this.pri); this.pri = np; }
    let k = this.n++;
    while (k > 0) { const p2 = (k - 1) >> 1; if (this.pri[p2] <= p) break; this.idx[k] = this.idx[p2]; this.pri[k] = this.pri[p2]; k = p2; }
    this.idx[k] = i; this.pri[k] = p;
  }
  pop(): number {
    const top = this.idx[0]; const li = this.idx[--this.n]; const lp = this.pri[this.n];
    let k = 0;
    for (;;) {
      let c = 2 * k + 1; if (c >= this.n) break;
      if (c + 1 < this.n && this.pri[c + 1] < this.pri[c]) c++;
      if (this.pri[c] >= lp) break;
      this.idx[k] = this.idx[c]; this.pri[k] = this.pri[c]; k = c;
    }
    this.idx[k] = li; this.pri[k] = lp;
    return top;
  }
}

const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];
const COST = [10, 10, 10, 10, 14, 14, 14, 14];

/** A* over tiles (8-way, no corner cutting). Returns tile-center waypoints excluding the start, or null. */
export function astar(w: World, sx: number, sy: number, gx: number, gy: number, maxNodes = 6000): { x: number; y: number }[] | null {
  const W = w.w, H = w.h;
  sx = Math.floor(sx); sy = Math.floor(sy); gx = Math.floor(gx); gy = Math.floor(gy);
  if (!walkable(w, gx, gy)) return null;
  if (sx === gx && sy === gy) return [];
  const N = W * H;
  const g = new Float64Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = new Heap(1024);
  const s = sy * W + sx, goal = gy * W + gx;
  g[s] = 0;
  const hfn = (x: number, y: number) => { const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return 10 * (dx + dy) - 6 * Math.min(dx, dy); };
  heap.push(s, hfn(sx, sy));
  let expanded = 0;
  while (heap.n > 0) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    if (cur === goal) break;
    closed[cur] = 1;
    if (++expanded > maxNodes) return null;
    const cx = cur % W, cy = (cur / W) | 0;
    for (let d = 0; d < 8; d++) {
      const nx = cx + DX[d], ny = cy + DY[d];
      if (!walkable(w, nx, ny)) continue;
      if (d >= 4 && (!walkable(w, cx + DX[d], cy) || !walkable(w, cx, cy + DY[d]))) continue;
      const ni = ny * W + nx;
      const ng = g[cur] + COST[d];
      if (ng < g[ni]) { g[ni] = ng; from[ni] = cur; heap.push(ni, ng + hfn(nx, ny)); }
    }
  }
  if (from[goal] < 0) return null;
  const out: { x: number; y: number }[] = [];
  for (let c = goal; c !== s; c = from[c]) out.push({ x: (c % W) + 0.5, y: ((c / W) | 0) + 0.5 });
  out.reverse();
  return out;
}

/** Dijkstra distance field from (tx,ty), in tenths of a tile, capped at maxCost. 65535 = unreachable. */
export function computeFlow(w: World, tx: number, ty: number, maxCost = 420): void {
  const W = w.w, H = w.h;
  const f = w.flow;
  f.fill(65535);
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return;
  const heap = new Heap(2048);
  const s = ty * W + tx;
  f[s] = 0; heap.push(s, 0);
  while (heap.n > 0) {
    const cur = heap.pop();
    const cd = f[cur];
    const cx = cur % W, cy = (cur / W) | 0;
    for (let d = 0; d < 8; d++) {
      const nx = cx + DX[d], ny = cy + DY[d];
      if (!walkable(w, nx, ny) && !(nx === tx && ny === ty)) continue;
      if (d >= 4 && (!walkable(w, cx + DX[d], cy) || !walkable(w, cx, cy + DY[d]))) continue;
      const ni = ny * W + nx;
      const nd = cd + COST[d];
      if (nd < f[ni] && nd <= maxCost) { f[ni] = nd; heap.push(ni, nd); }
    }
  }
}

/** Direction (unit vector) down the flow field from a position, or null if not reachable. */
export function flowDir(w: World, x: number, y: number, fly: boolean): { x: number; y: number } | null {
  const W = w.w;
  const cx = Math.floor(x), cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= W || cy >= w.h) return null;
  let best = w.flow[cy * W + cx], bx = -1, by = -1;
  for (let d = 0; d < 8; d++) {
    const nx = cx + DX[d], ny = cy + DY[d];
    if (!walkable(w, nx, ny, fly)) continue;
    if (d >= 4 && (!walkable(w, cx + DX[d], cy, fly) || !walkable(w, cx, cy + DY[d], fly))) continue;
    const v = w.flow[ny * W + nx];
    if (v < best) { best = v; bx = nx; by = ny; }
  }
  if (bx < 0) return null;
  const dx = bx + 0.5 - x, dy = by + 0.5 - y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}

/** Nearest walkable tile center to (x,y) within radius (spiral search). */
export function nearestWalkable(w: World, x: number, y: number, maxR = 6, fly = false): { x: number; y: number } | null {
  const cx = Math.floor(x), cy = Math.floor(y);
  if (walkable(w, cx, cy, fly)) return { x: cx + 0.5, y: cy + 0.5 };
  let best: { x: number; y: number } | null = null, bd = Infinity;
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!walkable(w, cx + dx, cy + dy, fly)) continue;
        const d = Math.hypot(cx + dx + 0.5 - x, cy + dy + 0.5 - y);
        if (d < bd) { bd = d; best = { x: cx + dx + 0.5, y: cy + dy + 0.5 }; }
      }
    }
    if (best) return best;
  }
  return null;
}
