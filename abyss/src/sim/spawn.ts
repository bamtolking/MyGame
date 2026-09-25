// Monster construction (used by the dungeon generator and by summoning at runtime).
import { MONSTERS, UNIQUE_MON_A, UNIQUE_MON_B } from '../data/monsters';
import { RANK_MULT, monsterDmgScale, monsterHpScale, monsterXpScale } from '../data/zones';
import type { Rng } from './rng';
import type { Elem, Monster, MonsterMod, MonsterRank, World } from './types';

export function makeMonster(w: World, tplId: string, lvl: number, rank: MonsterRank, mods: MonsterMod[], x: number, y: number, rng: Rng): Monster {
  const t = MONSTERS[tplId];
  const rm = RANK_MULT[rank];
  const has = (m: MonsterMod) => mods.includes(m);
  let hp = t.hp * monsterHpScale(lvl) * rm.hp;
  if (has('hardy')) hp *= 1.8;
  if (has('stone')) hp *= 1.2;
  let dmgMul = monsterDmgScale(lvl) * rm.dmg;
  if (has('strong')) dmgMul *= 1.5;
  const res: Record<Elem, number> = { phys: 0, fire: 0, cold: 0, light: 0, poison: 0, ...t.res };
  if (has('stone')) res.phys = Math.min(75, res.phys + 50);
  if (has('fireEnch')) res.fire = Math.max(res.fire, 75);
  if (has('coldEnch')) res.cold = Math.max(res.cold, 75);
  if (has('lightEnch')) res.light = Math.max(res.light, 75);
  const fast = has('fast');
  let name = t.name;
  if (rank === 'unique') name = `${rng.pick(UNIQUE_MON_A)} ${rng.pick(UNIQUE_MON_B)}`;
  const m: Monster = {
    id: w.nextId++, x, y, r: t.r * (rank === 'champion' || rank === 'unique' ? 1.1 : 1),
    tpl: tplId, lvl, name, rank, mods,
    hp: Math.max(1, Math.round(hp)), maxHp: Math.max(1, Math.round(hp)),
    dmg: [Math.max(1, Math.round(t.dmg[0] * dmgMul)), Math.max(1, Math.round(t.dmg[1] * dmgMul))],
    speed: t.speed * (fast ? 1.4 : 1) * (0.95 + rng.next() * 0.1),
    atkRate: t.atk * (fast ? 1.3 : 1),
    res, xp: Math.round(t.xp * monsterXpScale(lvl) * rm.xp),
    awake: false, dead: false, deadT: 0,
    act: null, atkCd: rng.range(0.2, 1), aiT: rng.range(0, 1),
    facing: rng.range(0, Math.PI * 2), anim: rng.range(0, 10), moving: false,
    hitT: 0, stunT: 0, freezeT: 0, chillT: 0, poison: null, burn: null,
    kbx: 0, kby: 0, fleeT: 0,
    packId: 0, leaderId: 0, homeX: x, homeY: y,
    timers: { special: t.special ? rng.range(1, t.special) : 0 },
    summoned: false, phase: 0, alpha: 1, lastHitBy: 0,
  };
  w.monsters.push(m);
  return m;
}

export const ALL_MODS: MonsterMod[] = ['fast', 'strong', 'stone', 'fireEnch', 'coldEnch', 'lightEnch', 'teleport', 'vampiric', 'multishot', 'hardy'];

export function rollMods(rng: Rng, n: number, ranged: boolean): MonsterMod[] {
  const pool = ALL_MODS.filter((m) => m !== 'multishot' || ranged);
  rng.shuffle(pool);
  return pool.slice(0, n);
}
