// 새 판 만들기
import { makeRng } from '../core/rng';
import { SpatialGrid } from '../core/grid';
import { BALANCE, ULTIMATE, WEAPON } from '../content';
import type { Enemy, RunConfig, RunStats, World } from './types';
import { recalcBase, zeroStats } from './stats';
import { addWeapon } from './levelup';

export function emptyRunStats(): RunStats {
  return {
    kills: 0, eliteKills: 0, bossKills: [], evolves: [], maxed: [], ultUses: 0, chests: 0, coins: 0, damageTaken: 0,
    lunch: null, pickups: {}, maxNoHit: 0, weaponKills: {}, weaponDmg: {}, levelAt: {}, killsAt: {}, cleared: false,
    overtimeSec: 0, killedBy: null,
  };
}

export function createWorld(cfg: RunConfig): World {
  const heat = BALANCE.heatLevels.slice(0, cfg.heat);
  const mods = [...heat, ...cfg.modifiers];
  let enemyHpMul = 1, enemySpeedMul = 1, enemyDmgMul = 1, spawnMul = 1, xpMul = 1, coinMul = cfg.stage.coinMul ?? 1;
  const flags = new Set<string>();
  for (const m of mods) {
    enemyHpMul *= m.enemyHpMul ?? 1; enemySpeedMul *= m.enemySpeedMul ?? 1; enemyDmgMul *= m.enemyDamageMul ?? 1;
    spawnMul *= m.spawnMul ?? 1; xpMul *= m.xpMul ?? 1; coinMul *= m.coinMul ?? 1;
    for (const f of m.flags ?? []) flags.add(f);
  }
  const ult = ULTIMATE.get(cfg.character.ultimate)!;
  const w: World = {
    cfg: { ...cfg, modifiers: mods },
    rng: makeRng(cfg.seed),
    fxRng: makeRng(cfg.seed ^ 0x5bd1e995),
    t: 0, clockT: 0, step: 0, phase: 'play',
    player: {
      x: 0, y: 0, r: 12, hp: 100, fx: 1, fy: 0, mx: 0, my: 0, moving: false,
      level: 1, xp: 0, xpNext: BALANCE.xpToLevel(1), hurtT: 0, invulnT: 0,
      ult: 0, ultMax: ult.charge, ultActiveT: 0, clockT: 0,
      revivals: 0, rerolls: 0, skips: 0, banishes: 0, noHitT: 0, walk: 0,
    },
    base: zeroStats(), stats: zeroStats(), d: null as unknown as World['d'],
    weapons: [], passives: [], banished: new Set(), lunch: null, ultimate: ult,
    enemies: [], bullets: [], ebullets: [], blasts: [], zones: [], beams: [], rings: [], pickups: [],
    grid: new SpatialGrid<Enemy>(64),
    nextUid: 1, spawnAcc: 0, eventIdx: 0, seenEnemies: new Set(),
    bossAlive: null, finalBossSpawned: false, finalBossDead: false, yageun: false, overtime: false, cleared: false,
    levelQueue: 0, choices: [], chest: null, chestQueue: [], lunchChoices: [],
    events: [], viewW: 440, viewH: 800, hitStop: 0,
    stats_: emptyRunStats(),
    enemyHpMul, enemySpeedMul, enemyDmgMul, spawnMul, xpMul, coinMul, flags,
    lastHour: 9, lunchOffered: false, gemCount: 0, refillAcc: 0, damageMulT: 0, damageMulAmt: 0, fireMulT: 0, fireMul: 1,
  };
  recalcBase(w);
  w.player.hp = w.d.maxHp;
  w.player.revivals = Math.floor(w.stats.revival);
  w.player.rerolls = Math.floor(w.stats.reroll);
  w.player.skips = Math.floor(w.stats.skip);
  w.player.banishes = Math.floor(w.stats.banish);
  const sw = WEAPON.get(cfg.character.startWeapon);
  if (sw) addWeapon(w, sw);
  return w;
}
