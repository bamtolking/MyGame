// Keeps the hordes coming: population around each player, surges, lair bosses, treasure goblins.
import { circleHits } from '../shared/movement.ts';
import { zoneAt, levelAt } from '../shared/map.ts';
import { ZONES } from '../shared/data/zones.ts';
import { GOLD_GOBLIN } from '../shared/data/monsters.ts';
import type { World } from './world.ts';
import type { Player } from './entities.ts';

const TICK_SEC = 0.25; // director runs every 5 ticks

export function director(w: World): void {
  // ---- lair bosses ----
  w.lairs.forEach((l, i) => {
    if (l.mon && w.mons.has(l.mon)) return;
    l.respawnT -= TICK_SEC;
    if (l.respawnT <= 0) {
      const lair = w.map.lairs[i]; const m = w.spawnMonster(lair.boss, lair.x, lair.y, 1, { lair: i });
      if (m) { l.mon = m.id; if (w.time > 10) w.announce(`${m.def.name}이(가) ${ZONES[lair.zone].name}에 다시 나타났습니다!`, 'boss'); }
    }
  });
  // ---- population around players ----
  const fieldPlayers: Player[] = [];
  for (const p of w.players.values()) if (!p.down && p.zone >= 1 && p.zone <= 4) fieldPlayers.push(p);
  for (const p of fieldPlayers) {
    const z = ZONES[p.zone];
    let buddies = 0; for (const q of fieldPlayers) if (q !== p && (q.x - p.x) ** 2 + (q.y - p.y) ** 2 < 500 * 500) buddies++;
    const target = Math.round(z.density * (1 + 0.3 * Math.min(3, buddies))); // nearby players share one (bigger) horde
    const have = w.spatial.count(p.x, p.y, 700);
    if (have < target) {
      const k = Math.min(target - have, 2 + w.rng.int(0, 3));
      spawnPack(w, p, k, 540, 760, p.zone);
    }
    // surges: a ring of monsters closing in, every ~80-120 s per player
    p.surgeT -= TICK_SEC;
    if (p.surgeT <= 0) {
      p.surgeT = 80 + w.rng.range(0, 40);
      if (w.spatial.count(p.x, p.y, 500) < 60) {
        const n = 18 + Math.min(18, p.prof.level);
        let spawned = 0;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2; const r = 470 + w.rng.range(-30, 30);
          const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
          if (spawnAt(w, x, y, p.id, p.zone)) spawned++;
        }
        if (spawned > 6) w.toast(p, '요괴 떼가 몰려옵니다!', '#ff7b7b');
      }
    }
  }
  // ---- treasure goblin ----
  w.goldGobT -= TICK_SEC;
  if (w.goldGobT <= 0) {
    w.goldGobT = 170 + w.rng.range(0, 100);
    if (fieldPlayers.length && w.rng.chance(0.55)) {
      const p = w.rng.pick(fieldPlayers);
      for (let tries = 0; tries < 12; tries++) {
        const a = w.rng.range(0, Math.PI * 2); const x = p.x + Math.cos(a) * 420, y = p.y + Math.sin(a) * 420;
        if (circleHits(w.map, x, y, 16) || zoneAt(w.map, x, y) !== p.zone) continue;
        const m = w.spawnMonster(GOLD_GOBLIN, x, y, levelAt(w.map, x, y));
        if (m) { w.announce(`💰 황금 도깨비가 ${ZONES[p.zone].name}에 나타났습니다! 도망치기 전에 잡으세요!`, 'event'); break; }
      }
    }
  }
}

function spawnPack(w: World, p: Player, k: number, rMin: number, rMax: number, zone: number): void {
  for (let tries = 0; tries < 4; tries++) {
    const a = w.rng.range(0, Math.PI * 2); const r = w.rng.range(rMin, rMax);
    const cx = p.x + Math.cos(a) * r, cy = p.y + Math.sin(a) * r; if (zoneAt(w.map, cx, cy) !== zone) continue;
    for (let i = 0; i < k; i++) spawnAt(w, cx + w.rng.range(-60, 60), cy + w.rng.range(-60, 60), 0, zone);
    return;
  }
}
/** Spawns one zone monster at (x,y) — only inside `zone`, so a border never leaks a harder zone's monsters. */
function spawnAt(w: World, x: number, y: number, tgt: number, zone: number): boolean {
  const z = zoneAt(w.map, x, y); if (z !== zone || z < 1 || z > 4) return false;
  if (circleHits(w.map, x, y, 14)) return false;
  for (const q of w.players.values()) if ((q.x - x) ** 2 + (q.y - y) ** 2 < 380 * 380) return false; // never pop in on screen
  const zd = ZONES[z]; const t = w.rng.weighted(zd.mobs, zd.weights); const lv = levelAt(w.map, x, y);
  const m = w.spawnMonster(t, x, y, lv, { elite: w.rng.chance(0.03) });
  if (m && tgt) { m.tgt = tgt; m.st = 'chase'; }
  return !!m;
}
