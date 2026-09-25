// Procedural world. Generated once on the server and shipped to clients (RLE) so collision is identical.
import { MAP_W, MAP_H, TILE } from './constants.ts';
import { fbm, hash2 } from './rng.ts';
import { ZONES } from './data/zones.ts';

export const T = {
  GRASS: 0, ROAD: 1, PLAZA: 2, MUD: 3, WATER: 4, TREE: 5, ROCK: 6, WALL: 7, HOUSE: 8, VOID: 9,
  LANTERN: 10, JANGSEUNG: 11, ARENA: 12, DEADTREE: 13, MAPLE: 14, REED: 15, GRAVE: 16, MOONTREE: 17, SHRUB: 18,
} as const;
const SOLID_LIST = [T.WATER, T.TREE, T.ROCK, T.WALL, T.HOUSE, T.VOID, T.LANTERN, T.JANGSEUNG, T.DEADTREE, T.MAPLE, T.GRAVE, T.MOONTREE];
export const SOLID = new Uint8Array(32); for (const s of SOLID_LIST) SOLID[s] = 1;

export type PropKind = 'house' | 'moontree' | 'shrine' | 'lair' | 'altar' | 'npc';
export interface Prop { k: PropKind; x: number; y: number; w: number; h: number; v?: number; name?: string }
export interface Shrine { id: number; x: number; y: number; zone: number; name: string }
export type NpcKind = 'smith' | 'talshop' | 'board' | 'priest';
export interface Npc { kind: NpcKind; x: number; y: number; name: string; title: string }
export interface Lair { zone: number; boss: number; x: number; y: number }
export interface MapMeta { seed: number; props: Prop[]; shrines: Shrine[]; npcs: Npc[]; lairs: Lair[]; altar: { x: number; y: number }; spawn: { x: number; y: number } }
export interface GameMap extends MapMeta { w: number; h: number; tiles: Uint8Array; zones: Uint8Array; levels: Uint8Array }

export const CX = 96, CY = 96;
const ROADS = { swamp: 40, temple: -62, valley: -155, altar: 128 } as const;
const toRad = (d: number) => (d * Math.PI) / 180;
export const polar = (deg: number, d: number): [number, number] => [CX + Math.cos(toRad(deg)) * d, CY + Math.sin(toRad(deg)) * d];
export const tileCenter = (tx: number, ty: number): [number, number] => [tx * TILE + TILE / 2, ty * TILE + TILE / 2];

const ALTAR_DEG = 128, ALTAR_D = 56, ALTAR_R = 15, ARENA_R = 12;

export function generateMap(seed: number): GameMap {
  const W = MAP_W, H = MAP_H; const N = W * H;
  const tiles = new Uint8Array(N), zones = new Uint8Array(N), levels = new Uint8Array(N);
  const [ax, ay] = polar(ALTAR_DEG, ALTAR_D);
  const idx = (x: number, y: number) => y * W + x;
  // ---- zones + base terrain ----
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y); const dx = x - CX, dy = y - CY; const d = Math.sqrt(dx * dx + dy * dy);
    const edge = 86 + (fbm(x / 14, y / 14, seed + 7) - 0.5) * 16;
    if (d > edge) { tiles[i] = T.VOID; zones[i] = 1; continue; }
    let zone: number;
    const forestR = 38 + (fbm(x / 10, y / 10, seed + 3) - 0.5) * 10;
    if (d < 13.5) zone = 0;
    else if ((x - ax) * (x - ax) + (y - ay) * (y - ay) < ALTAR_R * ALTAR_R) zone = 5;
    else if (d < forestR) zone = 1;
    else {
      let a = (Math.atan2(dy, dx) * 180) / Math.PI + (fbm(x / 16, y / 16, seed + 11) - 0.5) * 30;
      if (a > 180) a -= 360; if (a < -180) a += 360;
      if (a >= -15 && a < 128) zone = 2; else if (a >= -110 && a < -15) zone = 3; else zone = 4;
    }
    zones[i] = zone;
    const z = ZONES[zone];
    if (zone === 0 || zone === 5) levels[i] = 1;
    else if (zone === 1) levels[i] = Math.round(z.minLv + (z.maxLv - z.minLv) * Math.min(1, Math.max(0, (d - 13) / (forestR - 13))));
    else levels[i] = Math.round(z.minLv + (z.maxLv - z.minLv) * Math.min(1, Math.max(0, (d - forestR) / (edge - forestR - 4))));
    const n = fbm(x / 7, y / 7, seed + 21), h = hash2(x, y, seed);
    let t: number = T.GRASS;
    if (zone === 0) t = d < 11.2 ? T.PLAZA : T.GRASS;
    else if (zone === 1) { if (n > 0.61 || h < 0.018) t = T.TREE; else if (h > 0.965) t = T.SHRUB; }
    else if (zone === 2) { const w = fbm(x / 9, y / 9, seed + 31); if (w > 0.63) t = T.WATER; else if (w > 0.57) t = h < 0.35 ? T.REED : T.MUD; else if (h < 0.012) t = T.DEADTREE; else if (n > 0.68) t = T.TREE; }
    else if (zone === 3) {
      const ruin = (x % 11 === 0 || y % 11 === 0) && fbm(x / 5, y / 5, seed + 41) > 0.52 && h > 0.25;
      if (ruin) t = T.WALL; else if (h < 0.012) t = T.GRAVE; else if (h < 0.02) t = T.DEADTREE; else if (h > 0.994) t = T.LANTERN; else if (n > 0.7) t = T.TREE;
    } else if (zone === 4) { if (n > 0.64) t = T.ROCK; else if (h < 0.035 && n > 0.4) t = T.MAPLE; else if (h > 0.992) t = T.JANGSEUNG; }
    else if (zone === 5) t = T.GRASS;
    tiles[i] = t;
  }
  // ---- zone borders: a 2-tile barrier between hunting grounds; roads (carved below) are the only passages ----
  const border = new Uint8Array(N);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const z = zones[idx(x, y)]; if (z < 1 || tiles[idx(x, y)] === T.VOID) continue;
    for (let dy = -1; dy <= 1 && !border[idx(x, y)]; dy++) for (let dx = -1; dx <= 1; dx++) {
      const z2 = zones[idx(x + dx, y + dy)]; if (z2 < 1 || z2 === z || (z === 1 && z2 === 5) || (z === 5 && z2 === 1)) continue; // the altar stays open to the forest
      border[idx(x, y)] = 1; break;
    }
  }
  for (let i = 0; i < N; i++) if (border[i]) tiles[i] = zones[i] === 4 || zones[i] === 5 ? T.ROCK : zones[i] === 3 ? T.WALL : T.TREE;
  const set = (x: number, y: number, t: number) => { if (x >= 0 && y >= 0 && x < W && y < H) tiles[idx(x, y)] = t; };
  const get = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? tiles[idx(x, y)] : T.VOID);
  const clearDisc = (cx: number, cy: number, r: number, floor?: number) => {
    const zc = zones[idx(Math.round(cx), Math.round(cy))];
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r * r) continue; const t = get(x, y); if (t === T.VOID || zones[idx(x, y)] !== zc) continue; // never breach a zone border
      if (floor != null) set(x, y, floor); else if (SOLID[t] || t === T.REED) set(x, y, zones[idx(x, y)] === 2 ? T.MUD : T.GRASS);
    }
  };
  // ---- town wall ring (gates are carved by roads) ----
  for (let y = CY - 14; y <= CY + 14; y++) for (let x = CX - 14; x <= CX + 14; x++) {
    const d = Math.sqrt((x - CX) ** 2 + (y - CY) ** 2); if (d >= 12.2 && d < 13.3) set(x, y, T.WALL);
  }
  // ---- roads ----
  const carveRoad = (deg: number, d0: number, d1: number) => {
    for (let d = d0; d <= d1; d += 0.5) {
      const wig = (fbm(d / 6, deg, seed + 51) - 0.5) * 9 * Math.min(1, Math.max(0, (d - 14) / 10));
      const [px, py] = polar(deg + wig, d);
      for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
        if (ox * ox + oy * oy > 2.9) continue; const tx = Math.round(px + ox), ty = Math.round(py + oy);
        const t = get(tx, ty); if (t === T.VOID) continue; const z = zones[idx(tx, ty)];
        if (z === 0 && Math.sqrt((tx - CX) ** 2 + (ty - CY) ** 2) < 11.2) continue; // plaza stays plaza
        set(tx, ty, T.ROAD);
      }
    }
  };
  carveRoad(ROADS.swamp, 3, 78); carveRoad(ROADS.temple, 3, 78); carveRoad(ROADS.valley, 3, 78); carveRoad(ROADS.altar, 3, ALTAR_D - ARENA_R + 1);
  // ---- lairs, shrines, altar ----
  const props: Prop[] = []; const shrines: Shrine[] = []; const lairs: Lair[] = [];
  const addLair = (zone: number, deg: number, d: number) => {
    const [lx, ly] = polar(deg, d); const tx = Math.round(lx), ty = Math.round(ly);
    clearDisc(tx, ty, 7.5);
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; const sx = Math.round(tx + Math.cos(a) * 8.6), sy = Math.round(ty + Math.sin(a) * 8.6); if (get(sx, sy) !== T.ROAD && k % 2 === 0) set(sx, sy, zone === 4 ? T.JANGSEUNG : zone === 3 ? T.LANTERN : T.ROCK); }
    lairs.push({ zone, boss: ZONES[zone].boss, x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }); props.push({ k: 'lair', x: tx, y: ty, w: 1, h: 1, v: zone });
  };
  addLair(1, ROADS.swamp + 14, 32); addLair(2, ROADS.swamp, 76); addLair(3, ROADS.temple, 76); addLair(4, ROADS.valley, 76);
  const addShrine = (name: string, deg: number, d: number) => {
    const [sx, sy] = d === 0 ? [CX, CY + 5] : polar(deg, d); const tx = Math.round(sx), ty = Math.round(sy);
    if (d > 0) clearDisc(tx, ty, 3.2, T.PLAZA);
    shrines.push({ id: shrines.length, x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, zone: zones[idx(tx, ty)], name }); props.push({ k: 'shrine', x: tx, y: ty, w: 1, h: 1, v: shrines.length - 1, name });
  };
  addShrine('달빛 마을', 0, 0); addShrine('늪 어귀 신당', ROADS.swamp, 50); addShrine('산문 신당', ROADS.temple, 50); addShrine('골짜기 신당', ROADS.valley, 50); addShrine('제단 앞 신당', ROADS.altar, 29);
  const atx = Math.round(ax), aty = Math.round(ay);
  clearDisc(atx, aty, ARENA_R, T.ARENA);
  for (let k = 0; k < 16; k++) { if (k === 11 || k === 12 || k === 13) continue; const a = (k / 16) * Math.PI * 2; set(Math.round(atx + Math.cos(a) * (ARENA_R + 1.2)), Math.round(aty + Math.sin(a) * (ARENA_R + 1.2)), T.LANTERN); }
  props.push({ k: 'altar', x: atx, y: aty, w: 1, h: 1 });
  // ---- town buildings & npcs ----
  set(CX - 1, CY - 1, T.MOONTREE); set(CX, CY - 1, T.MOONTREE); set(CX - 1, CY, T.MOONTREE); set(CX, CY, T.MOONTREE);
  props.push({ k: 'moontree', x: CX - 1, y: CY - 1, w: 2, h: 2 });
  const houses: [number, number, number, number][] = [[6, -3, 4, 3], [-1, 8, 4, 2], [-10, 0, 4, 3], [-5, -10, 4, 3], [3, -9, 3, 2], [-9, 4, 3, 2], [6, 2, 3, 2]];
  for (const [ox, oy, w, h] of houses) {
    let ok = true;
    for (let y = CY + oy; y < CY + oy + h; y++) for (let x = CX + ox; x < CX + ox + w; x++) { const t = get(x, y); if (t !== T.PLAZA || Math.sqrt((x - CX) ** 2 + (y - CY) ** 2) > 11) ok = false; }
    if (!ok) continue;
    for (let y = CY + oy; y < CY + oy + h; y++) for (let x = CX + ox; x < CX + ox + w; x++) set(x, y, T.HOUSE);
    props.push({ k: 'house', x: CX + ox, y: CY + oy, w, h, v: props.length });
  }
  const npcs: Npc[] = [
    { kind: 'smith', x: (CX + 4.5) * TILE, y: (CY + 1.5) * TILE, name: '무쇠', title: '대장장이' },
    { kind: 'talshop', x: (CX - 5.5) * TILE, y: (CY - 1.5) * TILE, name: '청아', title: '부적상' },
    { kind: 'board', x: (CX + 2.5) * TILE, y: (CY + 4.5) * TILE, name: '방', title: '현상금 게시판' },
    { kind: 'priest', x: (CX - 2.5) * TILE, y: (CY - 4.5) * TILE, name: '월선', title: '신당 무당' },
  ];
  // ---- connectivity: unreachable walkable tiles become solid so nothing spawns in sealed pockets ----
  const seen = new Uint8Array(N); const q: number[] = [idx(CX, CY + 3)]; seen[q[0]] = 1;
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi]; const x = i % W, y = (i / W) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = idx(nx, ny);
      if (seen[j] || SOLID[tiles[j]]) continue; seen[j] = 1; q.push(j);
    }
  }
  for (let i = 0; i < N; i++) if (!seen[i] && !SOLID[tiles[i]]) tiles[i] = zones[i] === 2 ? T.WATER : zones[i] === 4 ? T.ROCK : T.TREE;
  return { w: W, h: H, tiles, zones, levels, seed, props, shrines, npcs, lairs, altar: { x: atx * TILE + TILE / 2, y: aty * TILE + TILE / 2 }, spawn: { x: CX * TILE, y: (CY + 3) * TILE } };
}

// ---- queries ----
export function tileAt(m: { w: number; h: number; tiles: Uint8Array }, px: number, py: number): number {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return T.VOID; return m.tiles[ty * m.w + tx];
}
export function zoneAt(m: GameMap, px: number, py: number): number {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return 1; return m.zones[ty * m.w + tx];
}
export function levelAt(m: GameMap, px: number, py: number): number {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return 1; return m.levels[ty * m.w + tx] || 1;
}
export const isWalkable = (m: { w: number; h: number; tiles: Uint8Array }, px: number, py: number): boolean => !SOLID[tileAt(m, px, py)];

// ---- wire encoding (RLE → base64) ----
export function rleEncode(a: Uint8Array): string {
  const out: number[] = [];
  for (let i = 0; i < a.length;) { const v = a[i]; let n = 1; while (i + n < a.length && a[i + n] === v && n < 255) n++; out.push(v, n); i += n; }
  return b64encode(new Uint8Array(out));
}
export function rleDecode(s: string, len: number): Uint8Array {
  const b = b64decode(s); const out = new Uint8Array(len); let o = 0;
  for (let i = 0; i < b.length; i += 2) { out.fill(b[i], o, o + b[i + 1]); o += b[i + 1]; }
  return out;
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function b64encode(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=');
  }
  return s;
}
export function b64decode(s: string): Uint8Array {
  const lut = new Uint8Array(128); for (let i = 0; i < 64; i++) lut[B64.charCodeAt(i)] = i;
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0; const out = new Uint8Array((s.length / 4) * 3 - pad); let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const n = (lut[s.charCodeAt(i)] << 18) | (lut[s.charCodeAt(i + 1)] << 12) | (lut[s.charCodeAt(i + 2)] << 6) | lut[s.charCodeAt(i + 3)];
    if (o < out.length) out[o++] = (n >> 16) & 255; if (o < out.length) out[o++] = (n >> 8) & 255; if (o < out.length) out[o++] = n & 255;
  }
  return out;
}
export interface WireMap extends MapMeta { tiles: string; zones: string }
export const mapToWire = (m: GameMap): WireMap => ({ seed: m.seed, props: m.props, shrines: m.shrines, npcs: m.npcs, lairs: m.lairs, altar: m.altar, spawn: m.spawn, tiles: rleEncode(m.tiles), zones: rleEncode(m.zones) });
export function mapFromWire(w: WireMap): GameMap {
  const N = MAP_W * MAP_H;
  return { ...w, w: MAP_W, h: MAP_H, tiles: rleDecode(w.tiles, N), zones: rleDecode(w.zones, N), levels: new Uint8Array(N) };
}
