// A* on the tile grid (8-way, no corner cutting) + line-of-sight smoothing. Used by AI companions.
import { TILE, PLAYER_R } from './constants.ts';
import { SOLID, type GameMap } from './map.ts';
import { circleHits } from './movement.ts';

let gen = 0; let stamp: Uint32Array, g: Float32Array, came: Int32Array, closed: Uint32Array;
function ensure(n: number) { if (!stamp || stamp.length < n) { stamp = new Uint32Array(n); g = new Float32Array(n); came = new Int32Array(n); closed = new Uint32Array(n); } }

class Heap { k: number[] = []; v: number[] = [];
  push(key: number, val: number) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const pi = (i - 1) >> 1; if (k[pi] <= key) break; k[i] = k[pi]; v[i] = v[pi]; i = pi; } k[i] = key; v[i] = val; }
  pop(): number { const k = this.k, v = this.v; const top = v[0]; const lk = k.pop()!, lv = v.pop()!; if (k.length) { let i = 0; const n = k.length; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; } k[i] = lk; v[i] = lv; } return top; }
  get size() { return this.k.length; } }

export function findPath(m: GameMap, sx: number, sy: number, tx: number, ty: number, maxNodes = 15000): [number, number][] | null {
  const W = m.w, H = m.h; ensure(W * H); gen++;
  const s = Math.floor(sy / TILE) * W + Math.floor(sx / TILE);
  let t = Math.floor(ty / TILE) * W + Math.floor(tx / TILE);
  if (SOLID[m.tiles[t]]) { // nudge goal to nearest open tile
    const gx = t % W, gy = (t / W) | 0; let found = -1;
    for (let r = 1; r < 6 && found < 0; r++) for (let dy = -r; dy <= r && found < 0; dy++) for (let dx = -r; dx <= r; dx++) { const x = gx + dx, y = gy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue; if (!SOLID[m.tiles[y * W + x]]) { found = y * W + x; break; } }
    if (found < 0) return null; t = found;
  }
  const tgx = t % W, tgy = (t / W) | 0;
  const h = (i: number) => { const dx = Math.abs(i % W - tgx), dy = Math.abs(((i / W) | 0) - tgy); return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); };
  const open = new Heap(); stamp[s] = gen; g[s] = 0; came[s] = -1; open.push(h(s), s);
  let n = 0;
  while (open.size) {
    const cur = open.pop(); if (closed[cur] === gen) continue; closed[cur] = gen;
    if (cur === t) break; if (++n > maxNodes) return null;
    const cx = cur % W, cy = (cur / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx; if (SOLID[m.tiles[ni]] || closed[ni] === gen) continue;
      if (dx && dy && (SOLID[m.tiles[cy * W + nx]] || SOLID[m.tiles[ny * W + cx]])) continue;
      const ng = g[cur] + (dx && dy ? Math.SQRT2 : 1);
      if (stamp[ni] !== gen || ng < g[ni]) { stamp[ni] = gen; g[ni] = ng; came[ni] = cur; open.push(ng + h(ni), ni); }
    }
  }
  if (closed[t] !== gen) return null;
  const pts: [number, number][] = []; for (let i = t; i !== -1; i = came[i]) pts.push([(i % W) * TILE + TILE / 2, ((i / W) | 0) * TILE + TILE / 2]);
  pts.reverse(); pts[pts.length - 1] = [tx, ty];
  // smoothing: skip waypoints while there is a clear line
  const out: [number, number][] = []; let a: [number, number] = [sx, sy]; let i = 0;
  while (i < pts.length) { let j = pts.length - 1; while (j > i && !clear(m, a[0], a[1], pts[j][0], pts[j][1])) j--; out.push(pts[j]); a = pts[j]; i = j + 1; }
  return out;
}
export function clear(m: GameMap, ax: number, ay: number, bx: number, by: number): boolean {
  const d = Math.hypot(bx - ax, by - ay); const n = Math.ceil(d / 10);
  for (let k = 1; k <= n; k++) { const t = k / n; if (circleHits(m, ax + (bx - ax) * t, ay + (by - ay) * t, PLAYER_R + 1)) return false; }
  return true;
}
