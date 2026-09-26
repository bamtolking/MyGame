import { describe, it, expect } from 'vitest';
import { encodeSnap, decodeSnap } from '../src/shared/protocol.ts';
import { rleEncode, rleDecode, b64encode, b64decode, generateMap, SOLID, T, mapToWire, mapFromWire, isWalkable } from '../src/shared/map.ts';
import { stepPlayer, circleHits } from '../src/shared/movement.ts';
import { Rng } from '../src/shared/rng.ts';
import { xpNeed } from '../src/shared/data/xp.ts';
import { MONSTERS } from '../src/shared/data/monsters.ts';
import { ZONES } from '../src/shared/data/zones.ts';
import { MAIN_QUESTS } from '../src/shared/data/quests.ts';
import { computeStats, newProfile, makeItem } from '../src/shared/data/items.ts';
import { CLASSES, CLASS_IDS } from '../src/shared/data/classes.ts';
import { PLAYER_R } from '../src/shared/constants.ts';
import { MAP, mkWorld, mkPlayer, spotIn } from './helpers.ts';

describe('protocol', () => {
  it('binary snapshot round-trips (1/8 px precision)', () => {
    const players = [{ id: 7, x: 1234.625, y: 5000.125, hp: 200, f: 9, face: 64 }, { id: 65535, x: 0, y: 6143.875, hp: 0, f: 255, face: 255 }];
    const mons = Array.from({ length: 300 }, (_, i) => ({ id: i + 1, t: i % 18, x: i * 10.5, y: 6000 - i * 3.25, hp: i % 256, f: i % 256 }));
    const s = decodeSnap(encodeSnap(123456, 70000, players, mons));
    expect(s.tick).toBe(123456); expect(s.ack).toBe(70000 & 0xffff);
    expect(s.players).toEqual(players); expect(s.mons).toEqual(mons);
    expect(encodeSnap(1, 1, players, mons).length).toBe(1 + 4 + 2 + 2 + 2 * 9 + 2 + 300 * 9);
  });
  it('RLE + base64 are lossless', () => {
    const r = new Rng(3); const a = new Uint8Array(5000).map(() => (r.next() < 0.8 ? 3 : r.int(0, 255)));
    expect(rleDecode(rleEncode(a), a.length)).toEqual(a);
    for (const n of [0, 1, 2, 3, 4, 5]) { const b = new Uint8Array(n).map((_, i) => i * 77); expect(b64decode(b64encode(b))).toEqual(b); }
  });
});

describe('world map', () => {
  const m = MAP();
  it('is deterministic for a seed and survives the wire', () => {
    const m2 = generateMap(20260925); expect(Buffer.from(m2.tiles).equals(Buffer.from(m.tiles))).toBe(true);
    const w = mapFromWire(JSON.parse(JSON.stringify(mapToWire(m)))); expect(Buffer.from(w.tiles).equals(Buffer.from(m.tiles))).toBe(true); expect(Buffer.from(w.zones).equals(Buffer.from(m.zones))).toBe(true);
  });
  it('every walkable tile is reachable from the town spawn', () => {
    const seen = new Uint8Array(m.w * m.h); const q = [Math.floor(m.spawn.y / 32) * m.w + Math.floor(m.spawn.x / 32)]; seen[q[0]] = 1;
    for (let i = 0; i < q.length; i++) { const c = q[i]; for (const n of [c + 1, c - 1, c + m.w, c - m.w]) if (!seen[n] && !SOLID[m.tiles[n]]) { seen[n] = 1; q.push(n); } }
    let unreachable = 0; for (let i = 0; i < m.tiles.length; i++) if (!SOLID[m.tiles[i]] && !seen[i]) unreachable++;
    expect(unreachable).toBe(0);
  });
  it('hunting zones only connect through roads (no accidental walk into a high-level zone)', () => {
    let bad = 0;
    for (let y = 0; y < m.h - 1; y++) for (let x = 0; x < m.w - 1; x++) {
      const i = y * m.w + x; if (SOLID[m.tiles[i]]) continue;
      for (const j of [i + 1, i + m.w]) { if (SOLID[m.tiles[j]]) continue; const a = m.zones[i], b = m.zones[j]; if (a === b || a + b <= 1 || (a * b === 5)) continue; if (m.tiles[i] !== T.ROAD && m.tiles[j] !== T.ROAD) bad++; }
    }
    expect(bad).toBe(0);
  });
  it('spawn, shrines, lairs, npcs and the altar stand on walkable ground in the right zones', () => {
    expect(isWalkable(m, m.spawn.x, m.spawn.y)).toBe(true);
    for (const s of m.shrines) expect(isWalkable(m, s.x, s.y + 40)).toBe(true);
    for (const l of m.lairs) { expect(isWalkable(m, l.x, l.y)).toBe(true); expect(m.zones[Math.floor(l.y / 32) * m.w + Math.floor(l.x / 32)]).toBe(l.zone); }
    expect(isWalkable(m, m.altar.x, m.altar.y)).toBe(true);
    for (const z of [1, 2, 3, 4]) expect(ZONES[z].mobs.length).toBe(3);
    expect(m.lairs.map(l => MONSTERS[l.boss].zone)).toEqual([1, 2, 3, 4]);
  });
});

describe('movement & prediction', () => {
  const m = MAP();
  it('stepPlayer never ends inside a wall (random walk 20k steps)', () => {
    const r = new Rng(9); let x = m.spawn.x, y = m.spawn.y;
    for (let i = 0; i < 20000; i++) { const ix = r.int(-127, 127), iy = r.int(-127, 127); [x, y] = stepPlayer(m, x, y, ix, iy, 150 + r.int(0, 60), PLAYER_R); expect(circleHits(m, x, y, PLAYER_R)).toBe(false); }
  });
  it('client prediction replays the server exactly (same inputs → same position)', () => {
    const w = mkWorld(); const p = mkPlayer(w, 'archer', 5, [m.spawn.x, m.spawn.y]); const r = new Rng(4);
    const inputs: [number, number, number][] = []; let cx = p.x, cy = p.y;
    for (let s = 1; s <= 600; s++) { const ix = r.int(-127, 127), iy = r.int(-127, 127); inputs.push([s, ix, iy]); w.queueInput(p, s, ix, iy); w.step(); [cx, cy] = stepPlayer(m, cx, cy, ix, iy, p.stats.move, PLAYER_R); }
    expect(p.lastSeq).toBe(600); expect(p.x).toBe(cx); expect(p.y).toBe(cy);
  });
  it('server rejects speed hacks: a flood of inputs moves at most ~1 step per tick', () => {
    const w = mkWorld(); const [sx, sy] = spotIn(w, 0); const p = mkPlayer(w, 'sword', 1, [w.map.spawn.x, w.map.spawn.y]);
    const x0 = p.x; for (let i = 0; i < 12; i++) w.queueInput(p, i + 1, 127, 0); w.step();
    expect(p.x - x0).toBeLessThanOrEqual(p.stats.move * 0.05 * 3 + 0.01);
    let moved = 0; const xs = p.x; for (let t = 0; t < 20; t++) { for (let i = 0; i < 12; i++) w.queueInput(p, 100 + t * 12 + i, 127, 0); w.step(); } moved = p.x - xs;
    expect(moved).toBeLessThanOrEqual(p.stats.move * 1.0 * 1.2 + 20); void sx; void sy;
  });
});

describe('data sanity', () => {
  it('xp curve is increasing; quests reference real zones; stats are finite', () => {
    for (let l = 1; l < 29; l++) expect(xpNeed(l + 1)).toBeGreaterThan(xpNeed(l));
    expect(xpNeed(30)).toBe(0);
    for (const q of MAIN_QUESTS) expect(ZONES[q.zone]).toBeTruthy();
    const r = new Rng(1);
    for (const cls of CLASS_IDS) for (let lv = 1; lv <= 30; lv += 7) {
      const p = newProfile('x', CLASSES[cls], 0); p.level = lv; p.equip.weapon = makeItem(r, 9, 'weapon', lv, 4); p.equip.armor = makeItem(r, 10, 'armor', lv, 4);
      const s = computeStats(p); for (const v of Object.values(s)) expect(Number.isFinite(v)).toBe(true);
      expect(s.crit).toBeLessThanOrEqual(0.75); expect(s.dr).toBeLessThanOrEqual(0.7);
    }
  });
});
