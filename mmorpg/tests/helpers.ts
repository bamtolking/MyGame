import { World } from '../src/server/world.ts';
import { GameServer, type ProfileStore } from '../src/server/server.ts';
import { newProfile } from '../src/shared/data/items.ts';
import { CLASSES } from '../src/shared/data/classes.ts';
import { generateMap, type GameMap } from '../src/shared/map.ts';
import type { ClassId, Profile } from '../src/shared/types.ts';
import type { Player } from '../src/server/entities.ts';

let cached: GameMap | null = null;
export const MAP = () => (cached ??= generateMap(20260925));
export function mkWorld(o: Partial<{ wbFirst: number; wbInterval: number }> = {}): World {
  return new World({ seed: 20260925, channel: 1, name: 't', online: true, wbInterval: o.wbInterval ?? 99999, wbFirst: o.wbFirst ?? 99999, map: MAP() });
}
export function mkPlayer(w: World, cls: ClassId = 'sword', level = 1, at?: [number, number], name = '테스터'): Player {
  const prof: Profile = newProfile(name, CLASSES[cls], 0); prof.level = level; prof.shrines = [0, 1, 2, 3, 4];
  const p = w.addPlayer('tok_' + Math.random().toString(36).slice(2) + 'abcdefghij', prof, false);
  if (at) { p.x = at[0]; p.y = at[1]; p.zone = zoneOf(w, at); }
  w.recompute(p); p.hp = p.stats.maxHp; p.safeT = 0; return p;
}
export function zoneOf(w: World, [x, y]: [number, number]): number { return w.map.zones[Math.floor(y / 32) * w.map.w + Math.floor(x / 32)]; }
/** A walkable spot in `zone` far enough from town. */
export function spotIn(w: World, zone: number, nth = 0, awayFrom?: [number, number], minDist = 0): [number, number] {
  const m = w.map; let k = 0;
  for (let ty = 5; ty < m.h - 5; ty += 2) for (let tx = 5; tx < m.w - 5; tx += 2) {
    const ok = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]].every(([dx, dy]) => { const i = (ty + dy) * m.w + tx + dx; return m.zones[i] === zone && (m.tiles[i] === 0 || m.tiles[i] === 1 || m.tiles[i] === 2 || m.tiles[i] === 3 || m.tiles[i] === 12); });
    if (ok && awayFrom && Math.hypot(tx * 32 + 16 - awayFrom[0], ty * 32 + 16 - awayFrom[1]) < minDist) continue;
    if (ok && k++ === nth * 37) return [tx * 32 + 16, ty * 32 + 16];
  }
  throw new Error('no spot in zone ' + zone);
}
export function run(w: World, seconds: number): void { for (let i = 0; i < seconds * 20; i++) w.step(); }
export class MemStore implements ProfileStore { m = new Map<string, Profile>(); load(t: string) { const p = this.m.get(t); return p ? JSON.parse(JSON.stringify(p)) : null; } save(t: string, p: Profile) { this.m.set(t, JSON.parse(JSON.stringify(p))); } }
export function mkServer(bots = 0, store = new MemStore()) {
  let W: World | null = null;
  const gs = new GameServer({ seed: 20260925, channels: 2, name: 'test', online: true, bots, wbInterval: 99999, wbFirst: 99999, store, now: () => (W ? W.time : 0) + 1000 });
  W = gs.worlds[0];
  return { gs, store };
}
export class FakeConn { msgs: any[] = []; bins: Uint8Array[] = []; closed = false; send(d: string | Uint8Array) { if (typeof d === 'string') this.msgs.push(JSON.parse(d)); else this.bins.push(d); } close() { this.closed = true; } of(t: string) { return this.msgs.filter(m => m.t === t); } }
