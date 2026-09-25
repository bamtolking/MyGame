// Procedural floors (rooms+corridors, catacombs, cellular caves, abyss with lava) and the hand-laid town.
import { MONSTERS, BOSS_OF_FLOOR } from '../data/monsters';
import { ZONES, floorMonsterLevel, floorName, zoneOfFloor } from '../data/zones';
import { Rng } from './rng';
import { makeMonster, rollMods } from './spawn';
import { isWalkTile, walkable } from './path';
import {
  T_DOWN, T_FLOOR, T_LAVA, T_UP, T_VOID, T_WALL,
  type Decal, type Prop, type PropKind, type Vec, type World,
} from './types';

interface Rect { x: number; y: number; w: number; h: number }
const cx = (r: Rect) => Math.floor(r.x + r.w / 2);
const cy = (r: Rect) => Math.floor(r.y + r.h / 2);

export function newWorld(floor: number, diff: number, seed: number, W: number, H: number): World {
  return {
    floor, zone: zoneOfFloor(floor), diff, seed, w: W, h: H,
    tiles: new Uint8Array(W * H), vari: new Uint8Array(W * H), block: new Uint8Array(W * H), explored: new Uint8Array(W * H),
    monsters: [], props: [], npcs: [], drops: [], projs: [], areas: [], decals: [],
    start: { x: 0, y: 0 }, up: null, down: null, downSealed: false, bossId: 0,
    flow: new Uint16Array(W * H).fill(65535), flowTile: -1, flowT: 0,
    nextId: 1, mlvl: floorMonsterLevel(Math.max(1, floor), diff), name: floorName(floor),
    bossRoom: null, bossTriggered: false,
  };
}

// ---------------------------------------------------------------- layout helpers
function carveRect(t: Uint8Array, W: number, x: number, y: number, w: number, h: number, v = T_FLOOR) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) t[yy * W + xx] = v;
}
function carveLine(t: Uint8Array, W: number, H: number, x0: number, y0: number, x1: number, y1: number, cw: number) {
  const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
  let x = x0, y = y0;
  for (;;) {
    for (let a = 0; a < cw; a++) for (let b = 0; b < cw; b++) {
      const xx = Math.min(W - 3, Math.max(2, x + a)), yy = Math.min(H - 3, Math.max(2, y + b));
      t[yy * W + xx] = T_FLOOR;
    }
    if (x === x1 && y === y1) break;
    if (x !== x1) x += dx; else y += dy;
  }
}
function corridor(rng: Rng, t: Uint8Array, W: number, H: number, a: Rect, b: Rect, cw: number) {
  const ax = cx(a), ay = cy(a), bx = cx(b), by = cy(b);
  if (rng.chance(0.5)) { carveLine(t, W, H, ax, ay, bx, ay, cw); carveLine(t, W, H, bx, ay, bx, by, cw); }
  else { carveLine(t, W, H, ax, ay, ax, by, cw); carveLine(t, W, H, ax, by, bx, by, cw); }
}

function buildWalls(t: Uint8Array, W: number, H: number) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (t[y * W + x] !== T_VOID) continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const v = t[ny * W + nx];
      if (v !== T_VOID && v !== T_WALL) { near = true; break; }
    }
    if (near) t[y * W + x] = T_WALL;
  }
}

/** 4-connected flood fill over walkable tiles (respecting blocking props). Returns visited mask and count. */
function flood(w: World, sx: number, sy: number): { seen: Uint8Array; n: number } {
  const W = w.w, seen = new Uint8Array(w.w * w.h);
  if (!walkable(w, sx, sy)) return { seen, n: 0 };
  const q = [sy * W + sx]; seen[q[0]] = 1; let n = 0;
  while (q.length) {
    const c = q.pop()!; n++;
    const x = c % W, y = (c / W) | 0;
    const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of nb) {
      if (!walkable(w, nx, ny)) continue;
      const i = ny * W + nx;
      if (!seen[i]) { seen[i] = 1; q.push(i); }
    }
  }
  return { seen, n };
}
function walkCount(w: World): number {
  let n = 0;
  for (let i = 0; i < w.tiles.length; i++) if (isWalkTile(w.tiles[i]) && !w.block[i]) n++;
  return n;
}

/** BFS distance (4-conn) from a tile over walkable tiles. */
function bfsDist(w: World, sx: number, sy: number): Int32Array {
  const W = w.w, d = new Int32Array(w.w * w.h).fill(-1);
  const q = [sy * W + sx]; d[q[0]] = 0; let head = 0;
  while (head < q.length) {
    const c = q[head++]; const x = c % W, y = (c / W) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (!walkable(w, nx, ny)) continue;
      const i = ny * W + nx;
      if (d[i] < 0) { d[i] = d[c] + 1; q.push(i); }
    }
  }
  return d;
}

// ---------------------------------------------------------------- room layouts
interface RoomCfg { W: number; H: number; rooms: number; min: number; max: number; cw: [number, number]; extra: number }
const ROOM_CFG: Record<string, RoomCfg> = {
  cathedral: { W: 72, H: 72, rooms: 13, min: 6, max: 12, cw: [2, 2], extra: 0.25 },
  catacombs: { W: 70, H: 70, rooms: 19, min: 4, max: 8, cw: [1, 2], extra: 0.35 },
  abyss: { W: 74, H: 74, rooms: 11, min: 8, max: 14, cw: [2, 3], extra: 0.25 },
};

function roomsLayout(rng: Rng, w: World, cfg: RoomCfg, boss: boolean): Rect[] {
  const { W, H } = cfg;
  const t = w.tiles;
  const rooms: Rect[] = [];
  const overlaps = (r: Rect) => rooms.some((o) => r.x < o.x + o.w + 3 && r.x + r.w + 3 > o.x && r.y < o.y + o.h + 3 && r.y + r.h + 3 > o.y);
  if (boss) {
    const s = 15;
    const side = rng.int(4);
    const x = side === 0 ? 4 : side === 1 ? W - s - 5 : rng.irange(4, W - s - 5);
    const y = side === 2 ? 4 : side === 3 ? H - s - 5 : rng.irange(4, H - s - 5);
    rooms.push({ x, y, w: s, h: s });
  }
  for (let tries = 0; tries < 900 && rooms.length < cfg.rooms; tries++) {
    const rw = rng.irange(cfg.min, cfg.max), rh = rng.irange(cfg.min, cfg.max);
    const r = { x: rng.irange(3, W - rw - 4), y: rng.irange(3, H - rh - 4), w: rw, h: rh };
    if (!overlaps(r)) rooms.push(r);
  }
  for (const r of rooms) carveRect(t, W, r.x, r.y, r.w, r.h);
  // minimum spanning tree over room centers, plus a few loops
  const inTree = new Set([0]);
  while (inTree.size < rooms.length) {
    let best = Infinity, ba = 0, bb = 0;
    for (const a of inTree) for (let b = 0; b < rooms.length; b++) {
      if (inTree.has(b)) continue;
      const d = Math.hypot(cx(rooms[a]) - cx(rooms[b]), cy(rooms[a]) - cy(rooms[b]));
      if (d < best) { best = d; ba = a; bb = b; }
    }
    corridor(rng, t, W, H, rooms[ba], rooms[bb], rng.irange(cfg.cw[0], cfg.cw[1]));
    inTree.add(bb);
  }
  for (let i = 0; i < rooms.length; i++) {
    if (!rng.chance(cfg.extra)) continue;
    const near = rooms.map((r, j) => ({ j, d: Math.hypot(cx(r) - cx(rooms[i]), cy(r) - cy(rooms[i])) })).filter((o) => o.j !== i).sort((a, b) => a.d - b.d).slice(0, 3);
    const o = rng.pick(near);
    corridor(rng, t, W, H, rooms[i], rooms[o.j], rng.irange(cfg.cw[0], cfg.cw[1]));
  }
  return rooms;
}

function cavesLayout(rng: Rng, w: World): Rect[] {
  const W = w.w, H = w.h;
  let best: Uint8Array | null = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    let c = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const edge = x < 3 || y < 3 || x >= W - 3 || y >= H - 3;
      c[y * W + x] = edge || rng.chance(0.45) ? 1 : 0;
    }
    for (let it = 0; it < 5; it++) {
      const n = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) { n[y * W + x] = 1; continue; }
        let k = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && c[(y + dy) * W + x + dx]) k++;
        n[y * W + x] = k >= 5 || (it < 2 && k <= 1) ? 1 : 0;
      }
      c = n;
    }
    // widen: open single-tile pinches
    const t = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) t[i] = c[i] ? T_VOID : T_FLOOR;
    w.tiles.set(t);
    // largest 4-connected region
    let bestN = 0, bestSeen: Uint8Array | null = null;
    const global = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (t[i] !== T_FLOOR || global[i]) continue;
      const f = flood(w, i % W, (i / W) | 0);
      for (let j = 0; j < W * H; j++) if (f.seen[j]) global[j] = 1;
      if (f.n > bestN) { bestN = f.n; bestSeen = f.seen; }
    }
    if (bestSeen && bestN > W * H * 0.3) {
      for (let i = 0; i < W * H; i++) w.tiles[i] = bestSeen[i] ? T_FLOOR : T_VOID;
      best = w.tiles; break;
    }
  }
  if (!best) { // fallback: rooms
    return roomsLayout(rng, w, { ...ROOM_CFG.cathedral, W, H }, false);
  }
  // spots via dart throwing
  const spots: Rect[] = [];
  for (let tries = 0; tries < 3000 && spots.length < 26; tries++) {
    const x = rng.irange(3, W - 4), y = rng.irange(3, H - 4);
    if (w.tiles[y * W + x] !== T_FLOOR) continue;
    let open = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (w.tiles[(y + dy) * W + x + dx] === T_FLOOR) open++;
    if (open < 9) continue;
    if (spots.some((s) => Math.hypot(s.x - x, s.y - y) < 7)) continue;
    spots.push({ x: x - 1, y: y - 1, w: 3, h: 3 });
  }
  return spots;
}

function addPools(rng: Rng, w: World, count: number, avoid: Vec[], maxR: number) {
  const W = w.w;
  for (let p = 0; p < count; p++) {
    const x = rng.irange(4, w.w - 5), y = rng.irange(4, w.h - 5);
    if (w.tiles[y * W + x] !== T_FLOOR) continue;
    if (avoid.some((a) => Math.hypot(a.x - x, a.y - y) < 6)) continue;
    const r = rng.range(1.2, maxR);
    const changed: number[] = [];
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 2 || yy < 2 || xx >= w.w - 2 || yy >= w.h - 2) continue;
      const i = yy * W + xx;
      if (w.tiles[i] !== T_FLOOR) continue;
      if (Math.hypot(dx * 1.1, dy) + rng.range(-0.6, 0.6) <= r) { w.tiles[i] = T_LAVA; changed.push(i); }
    }
    const total = walkCount(w);
    const f = flood(w, Math.floor(avoid[0].x), Math.floor(avoid[0].y));
    if (f.n < total) for (const i of changed) w.tiles[i] = T_FLOOR;
  }
}

// ---------------------------------------------------------------- props & decoration
function addProp(w: World, kind: PropKind, x: number, y: number, blocks: boolean, extra: Partial<Prop> = {}): Prop {
  const p: Prop = { id: w.nextId++, kind, x, y, blocks, used: false, hp: 1, light: 0, face: 0, variant: 0, data: {}, ...extra };
  w.props.push(p);
  if (blocks) w.block[Math.floor(y) * w.w + Math.floor(x)] = kind === 'pillar' || kind === 'tree' || kind === 'statue' || kind === 'house' || kind === 'rock' ? 2 : 1;
  return p;
}

/** Places a blocking prop only if every walkable tile stays reachable from start. */
function tryBlocking(w: World, kind: PropKind, tx: number, ty: number, total: { n: number }, extra: Partial<Prop> = {}): Prop | null {
  const i = ty * w.w + tx;
  if (!walkable(w, tx, ty) || w.tiles[i] !== T_FLOOR) return null;
  if (Math.hypot(tx + 0.5 - w.start.x, ty + 0.5 - w.start.y) < 2.5) return null;
  if (w.down && Math.hypot(tx + 0.5 - w.down.x, ty + 0.5 - w.down.y) < 2) return null;
  if (w.up && Math.hypot(tx + 0.5 - w.up.x, ty + 0.5 - w.up.y) < 2) return null;
  w.block[i] = 1;
  const f = flood(w, Math.floor(w.start.x), Math.floor(w.start.y));
  if (f.n < total.n - 1) { w.block[i] = 0; return null; }
  w.block[i] = 0;
  total.n -= 1;
  return addProp(w, kind, tx + 0.5, ty + 0.5, true, extra);
}

function wallAdjacent(w: World, x: number, y: number): boolean {
  const W = w.w;
  return w.tiles[y * W + x + 1] === T_WALL || w.tiles[y * W + x - 1] === T_WALL || w.tiles[(y + 1) * W + x] === T_WALL || w.tiles[(y - 1) * W + x] === T_WALL;
}

function randomRoomTile(rng: Rng, w: World, r: Rect, edge: boolean): { x: number; y: number } | null {
  for (let k = 0; k < 30; k++) {
    const x = rng.irange(r.x, r.x + r.w - 1), y = rng.irange(r.y, r.y + r.h - 1);
    if (!walkable(w, x, y) || w.tiles[y * w.w + x] !== T_FLOOR) continue;
    if (edge && !wallAdjacent(w, x, y)) continue;
    return { x, y };
  }
  return null;
}

function decorate(rng: Rng, w: World, rooms: Rect[], startRoom: number, bossRoomIdx: number) {
  const W = w.w;
  const zone = w.zone;
  const total = { n: walkCount(w) };
  // wall torches on walls with visible faces
  for (let y = 2; y < w.h - 2; y++) for (let x = 2; x < W - 2; x++) {
    if (w.tiles[y * W + x] !== T_WALL) continue;
    const southFloor = isWalkTile(w.tiles[(y + 1) * W + x]);
    const eastFloor = isWalkTile(w.tiles[y * W + x + 1]);
    if (!southFloor && !eastFloor) continue;
    if (!rng.chance(zone === 3 ? 0.035 : 0.06)) continue;
    const face = southFloor && (!eastFloor || rng.chance(0.5)) ? 0 : 1;
    if (w.props.some((p) => p.kind === 'torch' && Math.abs(p.x - x) + Math.abs(p.y - y) < 5)) continue;
    addProp(w, 'torch', x + 0.5, y + 0.5, false, { face, light: 4.8 });
  }
  rooms.forEach((r, ri) => {
    const big = r.w >= 9 && r.h >= 9;
    // zone flavor
    if (zone === 1 && big && ri !== bossRoomIdx && rng.chance(0.7)) {
      for (let y = r.y + 2; y < r.y + r.h - 2; y += 3) {
        tryBlocking(w, 'pillar', r.x + 1, y, total);
        tryBlocking(w, 'pillar', r.x + r.w - 2, y, total);
      }
      const horiz = r.w >= r.h;
      w.decals.push(horiz ? { x: r.x + 2, y: cy(r) - 0.5, kind: 'rug', v: rng.int(3), rot: 0, w: r.w - 4, h: 2 } : { x: cx(r) - 0.5, y: r.y + 2, kind: 'rug', v: rng.int(3), rot: 0, w: 2, h: r.h - 4 });
    }
    if (zone === 1 && rng.chance(0.5)) { const p = randomRoomTile(rng, w, r, true); if (p) tryBlocking(w, 'candle', p.x, p.y, total, { light: 3.2 }); }
    if (zone === 1 && big && rng.chance(0.3)) { const p = randomRoomTile(rng, w, r, false); if (p) tryBlocking(w, 'statue', p.x, p.y, total); }
    if (zone === 2) {
      const n = rng.int(3);
      for (let k = 0; k < n; k++) { const p = randomRoomTile(rng, w, r, true); if (p) tryBlocking(w, 'sarco', p.x, p.y, total, { hp: 1 }); }
      if (rng.chance(0.6)) { const p = randomRoomTile(rng, w, r, false); if (p) w.decals.push({ x: p.x, y: p.y, kind: 'web', v: rng.int(3), rot: rng.range(0, 6) }); }
      if (rng.chance(0.4)) { const p = randomRoomTile(rng, w, r, true); if (p) tryBlocking(w, 'candle', p.x, p.y, total, { light: 3.2 }); }
    }
    if (zone === 3) {
      if (rng.chance(0.55)) { const p = randomRoomTile(rng, w, r, false); if (p) tryBlocking(w, 'crystal', p.x, p.y, total, { light: 3.6, variant: rng.int(3) }); }
      if (rng.chance(0.5)) { const p = randomRoomTile(rng, w, r, false); if (p) tryBlocking(w, 'rock', p.x, p.y, total, { variant: rng.int(3) }); }
      if (rng.chance(0.3)) { const p = randomRoomTile(rng, w, r, false); if (p) addProp(w, 'lavavent', p.x + 0.5, p.y + 0.5, false, { light: 3.2 }); }
    }
    if (zone === 4) {
      if (big && ri !== startRoom && rng.chance(0.6)) w.decals.push({ x: cx(r) - 1.5, y: cy(r) - 1.5, kind: 'pentagram', v: 0, rot: 0, w: 3, h: 3 });
      if (rng.chance(0.6)) { const p = randomRoomTile(rng, w, r, true); if (p) tryBlocking(w, 'brazier', p.x, p.y, total, { light: 5 }); }
      if (rng.chance(0.4)) { const p = randomRoomTile(rng, w, r, false); if (p) addProp(w, 'spikes', p.x + 0.5, p.y + 0.5, false); }
    }
    // barrels / crates
    const nb = ri === startRoom ? rng.int(2) : rng.int(3);
    for (let k = 0; k < nb; k++) {
      const p = randomRoomTile(rng, w, r, true);
      if (p) tryBlocking(w, rng.chance(0.7) ? 'barrel' : 'crate', p.x, p.y, total, { hp: 1, variant: rng.int(3) });
    }
    // floor decals
    const nd = Math.floor((r.w * r.h) / 14);
    for (let k = 0; k < nd; k++) {
      const x = r.x + rng.range(0, r.w), y = r.y + rng.range(0, r.h);
      const kinds: Decal['kind'][] = zone === 4 ? ['blood', 'crack', 'skull', 'bones'] : zone === 3 ? ['crack', 'rubble', 'bones'] : zone === 2 ? ['bones', 'skull', 'rubble', 'blood', 'moss'] : ['blood', 'bones', 'crack', 'rubble', 'moss'];
      w.decals.push({ x, y, kind: rng.pick(kinds), v: rng.int(4), rot: rng.range(0, Math.PI * 2) });
    }
  });
  // chests and shrines in rooms away from start
  const far = rooms.map((r, i) => i).filter((i) => i !== startRoom && i !== bossRoomIdx);
  rng.shuffle(far);
  const nChest = rng.irange(2, 3);
  for (let k = 0; k < nChest && k < far.length; k++) {
    const p = randomRoomTile(rng, w, rooms[far[k]], true);
    if (p) tryBlocking(w, 'chest', p.x, p.y, total);
  }
  const nShrine = rng.chance(0.75) ? (rng.chance(0.35) ? 2 : 1) : 0;
  for (let k = 0; k < nShrine && k + nChest < far.length; k++) {
    const p = randomRoomTile(rng, w, rooms[far[k + nChest]], false);
    if (p) tryBlocking(w, 'shrine', p.x, p.y, total, { variant: rng.int(6), light: 3 });
  }
}

// ---------------------------------------------------------------- monsters
function populate(rng: Rng, w: World, rooms: Rect[], startRoom: number, bossRoomIdx: number) {
  const z = ZONES[w.zone];
  const lvl = w.mlvl;
  const pool = z.monsters.filter((id) => MONSTERS[id].weight > 0);
  const target = 52 + w.floor * 2 + w.diff * 6;
  let count = 0, pack = 1;
  const spots = rooms.map((r, i) => ({ r, i })).filter((o) => o.i !== startRoom && o.i !== bossRoomIdx && Math.hypot(cx(o.r) - w.start.x, cy(o.r) - w.start.y) > 9);
  rng.shuffle(spots);
  const place = (tplId: string, x: number, y: number, rank: 'normal' | 'champion' | 'unique' | 'minion', mods: ReturnType<typeof rollMods>, packId: number) => {
    for (let k = 0; k < 12; k++) {
      const px = Math.floor(x + rng.range(-2.2, 2.2)), py = Math.floor(y + rng.range(-2.2, 2.2));
      if (!walkable(w, px, py, !!MONSTERS[tplId].flying)) continue;
      if (Math.hypot(px - w.start.x, py - w.start.y) < 8) continue;
      const m = makeMonster(w, tplId, lvl, rank, mods, px + 0.5, py + 0.5, rng);
      m.packId = packId;
      count++;
      return m;
    }
    return null;
  };
  const eliteN = w.floor >= 2 ? (rng.chance(0.55) ? 2 : 1) : rng.chance(0.4) ? 1 : 0;
  const uniqueN = w.floor >= 2 || w.diff > 0 ? 1 : 0;
  const modN = 1 + w.diff;
  let si = 0;
  // uniques first (farther spots)
  for (let u = 0; u < uniqueN && si < spots.length; u++, si++) {
    const s = spots[si].r;
    const tpl = rng.pick(pool);
    const boss = place(tpl, cx(s), cy(s), 'unique', rollMods(rng, modN + 1, !!MONSTERS[tpl].proj), pack);
    if (boss) { const n = rng.irange(3, 5); for (let k = 0; k < n; k++) { const m = place(tpl, cx(s), cy(s), 'minion', [], pack); if (m) m.leaderId = boss.id; } }
    pack++;
  }
  for (let e = 0; e < eliteN && si < spots.length; e++, si++) {
    const s = spots[si].r;
    const tpl = rng.pick(pool);
    const mods = rollMods(rng, modN, !!MONSTERS[tpl].proj);
    const n = rng.irange(3, 4);
    for (let k = 0; k < n; k++) place(tpl, cx(s), cy(s), 'champion', mods, pack);
    pack++;
  }
  let guard = 0;
  while (count < target && guard++ < 400) {
    const s = spots.length ? spots[si++ % spots.length].r : null;
    if (!s) break;
    const tpl = rng.weighted(pool, (id) => MONSTERS[id].weight);
    const t = MONSTERS[tpl];
    const n = rng.irange(t.pack[0], t.pack[1]);
    const ox = s.x + rng.range(0, s.w), oy = s.y + rng.range(0, s.h);
    let leader = 0;
    if (t.leader && rng.chance(0.6)) { const l = place(t.leader, ox, oy, 'normal', [], pack); if (l) leader = l.id; }
    for (let k = 0; k < n; k++) { const m = place(tpl, ox, oy, 'normal', [], pack); if (m) m.leaderId = leader; }
    pack++;
  }
  // boss
  const bossTpl = BOSS_OF_FLOOR[w.floor];
  if (bossTpl && bossRoomIdx >= 0) {
    const r = rooms[bossRoomIdx];
    const b = makeMonster(w, bossTpl, lvl + 2, 'boss', [], cx(r) + 0.5, cy(r) - 2.5, rng);
    b.name = MONSTERS[bossTpl].name;
    w.bossId = b.id;
    w.downSealed = true;
  }
}

// ---------------------------------------------------------------- public
export function generateFloor(floor: number, diff: number, seed: number): World {
  const rng = new Rng(seed);
  const zone = ZONES[zoneOfFloor(floor)];
  const isBoss = !!BOSS_OF_FLOOR[floor];
  const cfg = zone.gen === 'caves' ? { W: 76, H: 76 } : ROOM_CFG[zone.gen];
  const w = newWorld(floor, diff, seed, cfg.W, cfg.H);
  let rooms: Rect[];
  let bossRoomIdx = -1;
  if (zone.gen === 'caves') {
    rooms = cavesLayout(rng, w);
    if (!rooms.length) {
      for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === T_FLOOR) { rooms.push({ x: (i % w.w) - 1, y: ((i / w.w) | 0) - 1, w: 3, h: 3 }); break; }
    }
    if (isBoss) {
      // carve a big chamber at the tile farthest from a random spot
      const s = rooms[0];
      const d = bfsDist(w, cx(s), cy(s));
      let bi = 0;
      for (let i = 0; i < d.length; i++) if (d[i] > d[bi]) bi = i;
      let bx = bi % w.w, by = (bi / w.w) | 0;
      bx = Math.min(w.w - 11, Math.max(10, bx)); by = Math.min(w.h - 11, Math.max(10, by));
      for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) if (Math.hypot(dx, dy) <= 7.2) w.tiles[(by + dy) * w.w + bx + dx] = T_FLOOR;
      // make sure the chamber joins the cave
      carveLine(w.tiles, w.w, w.h, bx, by, bi % w.w, (bi / w.w) | 0, 2);
      rooms.push({ x: bx - 7, y: by - 7, w: 15, h: 15 });
      bossRoomIdx = rooms.length - 1;
    }
  } else {
    rooms = roomsLayout(rng, w, cfg as RoomCfg, isBoss);
    if (isBoss) bossRoomIdx = 0;
  }
  // choose start: room farthest from the boss room (or random), down stairs: farthest room from start
  let startRoom = 0;
  if (bossRoomIdx >= 0) {
    const b = rooms[bossRoomIdx];
    let bd = -1;
    rooms.forEach((r, i) => { if (i === bossRoomIdx) return; const d = Math.hypot(cx(r) - cx(b), cy(r) - cy(b)); if (d > bd) { bd = d; startRoom = i; } });
  } else startRoom = rng.int(rooms.length);
  const sr = rooms[startRoom];
  const upX = cx(sr), upY = cy(sr);
  // flood from start to find reachable + farthest
  const d = bfsDist(w, upX, upY);
  // remove unreachable floor
  for (let i = 0; i < d.length; i++) if (w.tiles[i] === T_FLOOR && d[i] < 0) w.tiles[i] = T_VOID;
  let downRoom = -1;
  if (bossRoomIdx >= 0) downRoom = bossRoomIdx;
  else {
    let bd = -1;
    rooms.forEach((r, i) => { if (i === startRoom) return; const dd = d[cy(r) * w.w + cx(r)]; if (dd > bd) { bd = dd; downRoom = i; } });
  }
  const dr = rooms[downRoom >= 0 ? downRoom : startRoom];
  let downX = cx(dr), downY = cy(dr);
  if (bossRoomIdx >= 0) { downY = cy(dr) + 3; }
  if (w.tiles[downY * w.w + downX] !== T_FLOOR) { // pick nearest floor tile in that room
    let best = Infinity;
    for (let y = dr.y; y < dr.y + dr.h; y++) for (let x = dr.x; x < dr.x + dr.w; x++) if (w.tiles[y * w.w + x] === T_FLOOR) { const dd = Math.hypot(x - downX, y - downY); if (dd < best) { best = dd; downX = x; downY = y; } }
  }
  w.tiles[upY * w.w + upX] = T_UP;
  w.tiles[downY * w.w + downX] = T_DOWN;
  w.up = { x: upX + 0.5, y: upY + 0.5 };
  w.down = { x: downX + 0.5, y: downY + 0.5 };
  // spawn point next to up stairs
  const around: [number, number][] = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [0, 2], [2, 0]];
  let st = { x: upX + 0.5, y: upY + 1.5 };
  for (const [ax, ay] of around) if (w.tiles[(upY + ay) * w.w + upX + ax] === T_FLOOR) { st = { x: upX + ax + 0.5, y: upY + ay + 0.5 }; break; }
  w.start = st;
  if (bossRoomIdx >= 0) w.bossRoom = rooms[bossRoomIdx];
  // lava / hazards
  if (zone.gen === 'caves') addPools(rng, w, 10, [w.start, w.down, ...(w.bossRoom ? [{ x: cx(w.bossRoom), y: cy(w.bossRoom) }] : [])], 3.2);
  if (zone.gen === 'abyss') addPools(rng, w, 14, [w.start, w.down], 2.6);
  buildWalls(w.tiles, w.w, w.h);
  for (let i = 0; i < w.vari.length; i++) w.vari[i] = rng.int(256);
  decorate(rng, w, rooms, startRoom, bossRoomIdx);
  if (bossRoomIdx >= 0) {
    const r = rooms[bossRoomIdx];
    const total = { n: walkCount(w) };
    tryBlocking(w, 'bigchest', cx(r) + 2, cy(r) + 3, total);
    for (const [ox, oy] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) tryBlocking(w, zone.gen === 'caves' ? 'crystal' : 'brazier', cx(r) + ox, cy(r) + oy, total, { light: 5, variant: 1 });
  }
  populate(rng, w, rooms, startRoom, bossRoomIdx);
  return w;
}

/** The town hub: hand-laid houses, square, dungeon entrance, NPCs. */
export function generateTown(seed: number): World {
  const rng = new Rng(seed);
  const W = 46, H = 46;
  const w = newWorld(0, 0, seed, W, H);
  const t = w.tiles;
  carveRect(t, W, 3, 3, W - 6, H - 6);
  for (let i = 0; i < W * H; i++) w.vari[i] = rng.int(180);
  // palisade/walls ring
  buildWalls(t, W, H);
  for (let i = 0; i < W * H; i++) if (t[i] === T_WALL) w.vari[i] = 220 + rng.int(30);
  // houses (wall blocks, style by vari: <100 plaster house)
  const houses: [number, number, number, number][] = [[8, 9, 6, 5], [31, 9, 6, 5], [17, 31, 10, 5], [34, 31, 5, 4], [6, 31, 5, 4]];
  for (const [x, y, hw, hh] of houses) {
    for (let yy = y; yy < y + hh; yy++) for (let xx = x; xx < x + hw; xx++) { t[yy * W + xx] = T_WALL; w.vari[yy * W + xx] = rng.int(90); }
  }
  // ruined cathedral facade (stone) north with the dungeon entrance in front
  for (let x = 17; x <= 29; x++) for (let y = 3; y <= 4; y++) { if (x >= 22 && x <= 24 && y === 4) continue; t[y * W + x] = T_WALL; w.vari[y * W + x] = 110 + rng.int(60); }
  t[5 * W + 23] = T_DOWN;
  w.down = { x: 23.5, y: 5.5 };
  // dirt paths (vari 200+ on floor)
  const path = (x0: number, y0: number, x1: number, y1: number) => {
    let x = x0, y = y0;
    for (let k = 0; k < 200; k++) {
      for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const i = (y + b) * W + x + a; if (t[i] === T_FLOOR) w.vari[i] = 200 + rng.int(40); }
      if (x === x1 && y === y1) break;
      if (x !== x1 && (y === y1 || rng.chance(0.5))) x += Math.sign(x1 - x); else y += Math.sign(y1 - y);
    }
  };
  path(22, 6, 22, 22); path(22, 22, 11, 15); path(22, 22, 33, 15); path(22, 22, 22, 36); path(22, 24, 36, 29); path(22, 24, 8, 36);
  // square: flagstones 18..27 x 18..26 (vari 180-199)
  for (let y = 18; y <= 26; y++) for (let x = 17; x <= 28; x++) { const i = y * W + x; if (t[i] === T_FLOOR && Math.hypot(x - 22.5, y - 22) < 5.6) w.vari[i] = 180 + rng.int(20); }
  w.start = { x: 24.5, y: 21.5 };
  w.up = null;
  const total = { n: walkCount(w) };
  addProp(w, 'well', 22.5, 22.5, true); w.block[22 * W + 22] = 1;
  total.n -= 1;
  addProp(w, 'waypoint', 26.5, 19.5, false, { light: 3.5 });
  tryBlocking(w, 'stash', 19, 25, total);
  // lamps
  for (const [x, y] of [[20, 10], [25, 14], [18, 19], [27, 25], [15, 28], [30, 28], [24, 8]]) tryBlocking(w, 'lamp', x, y, total, { light: 5.5 });
  // graveyard
  for (let k = 0; k < 9; k++) tryBlocking(w, 'grave', 31 + (k % 3) * 2, 5 + Math.floor(k / 3) * 2, total, { variant: rng.int(3) });
  for (const [x, y] of [[20, 6], [26, 6]]) tryBlocking(w, 'statue', x, y, total);
  // trees along the edges
  for (let k = 0; k < 90; k++) {
    const e = rng.int(4);
    const x = e === 0 ? rng.irange(3, 6) : e === 1 ? rng.irange(W - 7, W - 4) : rng.irange(3, W - 4);
    const y = e === 2 ? rng.irange(3, 6) : e === 3 ? rng.irange(H - 7, H - 4) : rng.irange(3, H - 4);
    if (y <= 7 && x >= 16 && x <= 30) continue;
    tryBlocking(w, 'tree', x, y, total, { variant: rng.int(4) });
  }
  // fences and carts
  for (let x = 8; x <= 13; x++) tryBlocking(w, 'fence', x, 16, total);
  tryBlocking(w, 'cart', 15, 12, total);
  for (let k = 0; k < 6; k++) tryBlocking(w, rng.chance(0.5) ? 'barrel' : 'crate', rng.pick([14, 30, 16, 29]), rng.irange(9, 14), total, { variant: rng.int(3), hp: 999 });
  // grass decals
  for (let k = 0; k < 140; k++) w.decals.push({ x: rng.range(3, W - 3), y: rng.range(3, H - 3), kind: rng.chance(0.7) ? 'grass' : 'flowers', v: rng.int(4), rot: 0 });
  // NPCs
  const npc = (kind: 'smith' | 'healer' | 'elder' | 'gambler', name: string, x: number, y: number) => {
    w.npcs.push({ id: w.nextId++, kind, name, x, y, r: 0.35, facing: Math.PI / 2, anim: rng.range(0, 5), hx: x, hy: y, wanderT: rng.range(2, 6), tx: x, ty: y });
  };
  npc('smith', '대장장이 브론', 11.5, 15.5);
  npc('healer', '치유사 아델라', 33.5, 15.5);
  npc('elder', '장로 오윈', 20.5, 20.5);
  npc('gambler', '떠돌이 상인 가브', 36.5, 36.5);
  for (let i = 0; i < w.explored.length; i++) w.explored[i] = 1;
  return w;
}
