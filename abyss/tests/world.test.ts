import { describe, expect, it } from 'vitest';
import { generateFloor, generateTown } from '../src/sim/dungeon';
import { astar, los, walkable } from '../src/sim/path';
import { newWorld } from '../src/sim/dungeon';
import { T_DOWN, T_FLOOR, T_UP, T_WALL } from '../src/sim/types';
import { MONSTERS } from '../src/data/monsters';

describe('dungeon generation', () => {
  it('every floor has reachable up/down stairs, monsters on walkable tiles, and a boss on boss floors', () => {
    for (let floor = 1; floor <= 12; floor++) {
      for (let seed = 1; seed <= 6; seed++) {
        const w = generateFloor(floor, 0, seed * 1000 + floor);
        expect(w.up, `floor ${floor} seed ${seed} up`).not.toBeNull();
        expect(w.down, `floor ${floor} seed ${seed} down`).not.toBeNull();
        expect(w.tiles[Math.floor(w.up!.y) * w.w + Math.floor(w.up!.x)]).toBe(T_UP);
        expect(w.tiles[Math.floor(w.down!.y) * w.w + Math.floor(w.down!.x)]).toBe(T_DOWN);
        expect(walkable(w, Math.floor(w.start.x), Math.floor(w.start.y))).toBe(true);
        const p = astar(w, w.start.x, w.start.y, w.down!.x, w.down!.y, 100000);
        expect(p, `floor ${floor} seed ${seed} path to down`).not.toBeNull();
        expect(w.monsters.length).toBeGreaterThan(30);
        for (const m of w.monsters) {
          const ok = walkable(w, Math.floor(m.x), Math.floor(m.y), !!MONSTERS[m.tpl].flying);
          expect(ok, `${m.tpl} at ${m.x},${m.y}`).toBe(true);
        }
        if (floor % 3 === 0) {
          expect(w.bossId).toBeGreaterThan(0);
          expect(w.downSealed).toBe(true);
          const b = w.monsters.find((m) => m.id === w.bossId)!;
          expect(astar(w, w.start.x, w.start.y, b.x, b.y, 100000)).not.toBeNull();
        }
      }
    }
  });
  it('town has npcs, stairs and waypoint', () => {
    const t = generateTown(5);
    expect(t.npcs.length).toBe(4);
    expect(t.props.some((p) => p.kind === 'waypoint')).toBe(true);
    expect(t.tiles[5 * t.w + 23]).toBe(T_DOWN);
    expect(astar(t, t.start.x, t.start.y, 23.5, 5.5, 100000)).not.toBeNull();
    for (const n of t.npcs) expect(astar(t, t.start.x, t.start.y, n.x, n.y, 100000), n.name).not.toBeNull();
  });
});

describe('line of sight', () => {
  it('uses exact grid traversal; grazing a wall corner blocks', () => {
    const w = newWorld(1, 0, 1, 10, 10);
    w.tiles.fill(T_FLOOR);
    w.tiles[5 * 10 + 4] = T_WALL; // (4,5)
    expect(los(w, 5.52, 5.22, 2.2, 4.16)).toBe(false);
    expect(los(w, 5.5, 4.5, 2.5, 4.5)).toBe(true);
    expect(los(w, 5.5, 5.5, 2.5, 5.5)).toBe(false);
    expect(los(w, 1.5, 1.5, 8.5, 2.5)).toBe(true);
    expect(los(w, 1.5, 1.5, 8.5, 8.5)).toBe(false); // grazes the wall corner
    expect(los(w, 3.5, 6.5, 5.5, 4.5)).toBe(false); // exact corner through (4,5)
    expect(los(w, 5.5, 5.5, 5.5, 5.5)).toBe(true);
  });
});
