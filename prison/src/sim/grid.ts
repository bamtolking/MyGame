// Grid helpers: passability, security flood fill (which tiles connect to the outside), room detection, A* pathfinding.
import type { GameState, Room, Vec } from './types';
import { STRUCT_INDEX } from '../data/structures';
import { ROOMS, roomDef } from '../data/rooms';
import { OBJ_BY_ID } from '../data/objects';

export const T_GRASS = 0, T_DIRT = 1, T_ROAD = 2;
export const S_NONE = 0, S_WALL = STRUCT_INDEX.wall, S_FENCE = STRUCT_INDEX.fence, S_DOOR = STRUCT_INDEX.door, S_JAILDOOR = STRUCT_INDEX.jaildoor;

export type Mover = 'staff' | 'prisoner' | 'escaper';

export const idx = (s: GameState, x: number, y: number): number => y * s.w + x;
export const inBounds = (s: GameState, x: number, y: number): boolean => x >= 0 && y >= 0 && x < s.w && y < s.h;
export const isBorder = (s: GameState, x: number, y: number): boolean => x === 0 || y === 0 || x === s.w - 1 || y === s.h - 1;
export const isSolid = (st: number): boolean => st === S_WALL || st === S_FENCE;

/** Can a mover of the given kind step onto tile (x,y)? */
export function passable(s: GameState, x: number, y: number, mover: Mover): boolean {
  if (!inBounds(s, x, y)) return false;
  const st = s.struct[y * s.w + x];
  if (st === S_NONE) return true;
  if (st === S_WALL || st === S_FENCE) return false;
  if (st === S_DOOR) return mover !== 'escaper' || !s.lockdown ? true : false;
  if (st === S_JAILDOOR) return mover !== 'escaper';
  return true;
}

/** Flood fill from the map border through escaper-passable tiles. Marks tiles an escaping prisoner could reach the outside from. */
export function computeSecurity(s: GameState): void {
  const { w, h } = s; const ins = s.cache.insecure; ins.fill(0);
  const stack: number[] = [];
  const push = (x: number, y: number) => { const i = y * w + x; if (ins[i]) return; const st = s.struct[i]; if (st === S_WALL || st === S_FENCE || st === S_JAILDOOR) return; ins[i] = 1; stack.push(i); };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop()!; const x = i % w, y = (i - x) / w;
    if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
  }
  s.cache.dirtySecurity = false;
}
export const isInsecure = (s: GameState, x: number, y: number): boolean => s.cache.insecure[y * s.w + x] === 1;

/** Connected components of same-zone tiles (4-neighbour, not crossing walls/fences/doors). */
export function detectRooms(s: GameState): void {
  const { w, h } = s; const roomAt = s.cache.roomAt; roomAt.fill(-1);
  const rooms: Room[] = []; const old = s.cache.rooms;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; const z = s.zone[i];
    if (z === 0 || roomAt[i] >= 0 || s.struct[i] !== S_NONE) continue;
    const id = rooms.length; const tiles: number[] = []; const stack = [i]; roomAt[i] = id;
    while (stack.length) {
      const j = stack.pop()!; tiles.push(j); const jx = j % w, jy = (j - jx) / w;
      const nb = [[jx - 1, jy], [jx + 1, jy], [jx, jy - 1], [jx, jy + 1]];
      for (const [nx, ny] of nb) { if (!inBounds(s, nx, ny)) continue; const k = ny * w + nx; if (roomAt[k] >= 0 || s.zone[k] !== z || s.struct[k] !== S_NONE) continue; roomAt[k] = id; stack.push(k); }
    }
    let sx = 0, sy = 0; const objs: number[] = [];
    for (const t of tiles) { sx += t % w; sy += Math.floor(t / w); const o = s.objAt[t]; if (o >= 0) { const ob = s.cache.objIndex.get(o); if (ob && ob.built) objs.push(o); } }
    rooms.push({ id, zone: z, tiles, objs, valid: false, secure: false, issues: [], cx: sx / tiles.length + 0.5, cy: sy / tiles.length + 0.5 });
  }
  for (const r of rooms) validateRoom(s, r);
  s.cache.rooms = rooms; s.cache.dirtyRooms = false;
  void old;
}

export function validateRoom(s: GameState, r: Room): void {
  const def = roomDef(r.zone); const issues: string[] = [];
  let secure = true; for (const t of r.tiles) if (s.cache.insecure[t]) { secure = false; break; }
  r.secure = secure;
  if (!secure) issues.push(def.outdoor ? '울타리/벽으로 밀폐되지 않음' : '벽으로 밀폐되지 않음 (외부와 연결됨)');
  if (r.tiles.length < def.minTiles) issues.push(`너무 작음 (${r.tiles.length}/${def.minTiles}칸)`);
  const counts: Record<string, number> = {};
  for (const o of r.objs) { const ob = s.cache.objIndex.get(o)!; counts[ob.type] = (counts[ob.type] || 0) + 1; }
  for (const [k, n] of Object.entries(def.needs)) if ((counts[k] || 0) < n) issues.push(`${OBJ_BY_ID[k].name} ${n - (counts[k] || 0)}개 부족`);
  r.issues = issues; r.valid = issues.length === 0;
}

export function roomOf(s: GameState, x: number, y: number): Room | null { if (!inBounds(s, x, y)) return null; const id = s.cache.roomAt[y * s.w + x]; return id >= 0 ? s.cache.rooms[id] : null; }
export const validRooms = (s: GameState, zone: string): Room[] => { const zi = ROOMS.findIndex(r => r.id === zone); return s.cache.rooms.filter(r => r.zone === zi && r.valid); };
export function nearestRoom(s: GameState, zone: string, x: number, y: number, pred?: (r: Room) => boolean): Room | null {
  let best: Room | null = null, bd = Infinity;
  for (const r of validRooms(s, zone)) { if (pred && !pred(r)) continue; const d = (r.cx - x) ** 2 + (r.cy - y) ** 2; if (d < bd) { bd = d; best = r; } }
  return best;
}
export function randomTileIn(s: GameState, r: Room, rnd: () => number): Vec { const t = r.tiles[Math.floor(rnd() * r.tiles.length)]; return { x: t % s.w, y: Math.floor(t / s.w) }; }

// ---------- A* ----------
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
let gScore: Float32Array | null = null, cameFrom: Int32Array | null = null, closed: Uint8Array | null = null, gen = 0, genArr: Uint32Array | null = null;
function ensure(n: number): void { if (!gScore || gScore.length !== n) { gScore = new Float32Array(n); cameFrom = new Int32Array(n); closed = new Uint8Array(n); genArr = new Uint32Array(n); gen = 0; } }

/** A* from (sx,sy) to (tx,ty). Returns tile-center waypoints (excluding start) or null. maxNodes bounds the search. */
export function findPath(s: GameState, sx: number, sy: number, tx: number, ty: number, mover: Mover, maxNodes = 6000): Vec[] | null {
  return findPathTo(s, sx, sy, mover, (x, y) => x === tx && y === ty, (x, y) => Math.max(Math.abs(x - tx), Math.abs(y - ty)) + 0.41 * Math.min(Math.abs(x - tx), Math.abs(y - ty)), maxNodes);
}
/** Generic A-star / Dijkstra to the first tile satisfying goal(). heuristic may be 0 for Dijkstra. */
export function findPathTo(s: GameState, sx: number, sy: number, mover: Mover, goal: (x: number, y: number) => boolean, heur: (x: number, y: number) => number, maxNodes = 6000): Vec[] | null {
  const { w, h } = s; const n = w * h; ensure(n); gen++; if (gen === 0xffffffff) { genArr!.fill(0); gen = 1; }
  const G = gScore!, CF = cameFrom!, CL = closed!, GA = genArr!;
  if (!inBounds(s, sx, sy)) return null;
  const start = sy * w + sx;
  if (goal(sx, sy)) return [];
  // binary heap of [f, idx]
  const heapF: number[] = [], heapI: number[] = [];
  const hpush = (f: number, i: number) => { heapF.push(f); heapI.push(i); let k = heapF.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heapF[p] <= heapF[k]) break; [heapF[p], heapF[k]] = [heapF[k], heapF[p]]; [heapI[p], heapI[k]] = [heapI[k], heapI[p]]; k = p; } };
  const hpop = (): number => { const top = heapI[0]; const lf = heapF.pop()!, li = heapI.pop()!; if (heapF.length) { heapF[0] = lf; heapI[0] = li; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heapF.length && heapF[l] < heapF[m]) m = l; if (r < heapF.length && heapF[r] < heapF[m]) m = r; if (m === k) break; [heapF[m], heapF[k]] = [heapF[k], heapF[m]]; [heapI[m], heapI[k]] = [heapI[k], heapI[m]]; k = m; } } return top; };
  GA[start] = gen; G[start] = 0; CF[start] = -1; CL[start] = 0; hpush(heur(sx, sy), start);
  let expanded = 0;
  while (heapF.length) {
    const cur = hpop(); if (GA[cur] === gen && CL[cur]) continue; CL[cur] = 1;
    const cx = cur % w, cy = (cur - cx) / w;
    if (goal(cx, cy)) { const path: Vec[] = []; let i = cur; while (i !== start && i !== -1) { path.push({ x: i % w, y: Math.floor(i / w) }); i = CF[i]; } path.reverse(); return path; }
    if (++expanded > maxNodes) return null;
    for (let d = 0; d < 8; d++) {
      const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (!passable(s, nx, ny, mover)) continue;
      if (d >= 4) { if (!passable(s, cx + DIRS[d][0], cy, mover) || !passable(s, cx, cy + DIRS[d][1], mover)) continue; }
      const ni = ny * w + nx; const cost = d >= 4 ? 1.4142 : 1;
      // doors are slightly slower so paths prefer open floor
      const stc = s.struct[ni]; const extra = stc === S_DOOR || stc === S_JAILDOOR ? 0.6 : 0;
      const ng = G[cur] + cost + extra;
      if (GA[ni] !== gen) { GA[ni] = gen; G[ni] = ng; CF[ni] = cur; CL[ni] = 0; hpush(ng + heur(nx, ny), ni); }
      else if (ng < G[ni] && !CL[ni]) { G[ni] = ng; CF[ni] = cur; hpush(ng + heur(nx, ny), ni); }
    }
  }
  return null;
}

/** Path to any tile adjacent (8-neighbour) to (tx,ty), or to the tile itself if allowed & passable. */
export function findPathAdjacent(s: GameState, sx: number, sy: number, tx: number, ty: number, mover: Mover, allowOn: boolean): Vec[] | null {
  return findPathTo(s, sx, sy, mover, (x, y) => (allowOn && x === tx && y === ty) || (Math.abs(x - tx) <= 1 && Math.abs(y - ty) <= 1 && !(x === tx && y === ty)), (x, y) => Math.max(0, Math.max(Math.abs(x - tx), Math.abs(y - ty)) - 1));
}
/** Path for an escaper to the nearest border tile. */
export function findEscapePath(s: GameState, sx: number, sy: number): Vec[] | null {
  return findPathTo(s, sx, sy, 'escaper', (x, y) => isBorder(s, x, y), (x, y) => Math.min(x, y, s.w - 1 - x, s.h - 1 - y), 8000);
}
/** Path from position to the entrance (road). */
export function findPathToEntry(s: GameState, sx: number, sy: number, mover: Mover): Vec[] | null { return findPath(s, sx, sy, s.entry.x, s.entry.y, mover, 9000); }

/** Straight-line free check between tile centers (used for fight adjacency). */
export const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);
