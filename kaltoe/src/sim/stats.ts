// 스탯 합산: 캐릭터 + 복지(메타) + 모디파이어 + 점심 + 패시브 → 파생값.
import type { StatBlock, StatKey, WeaponStats } from '../content/types';
import { BALANCE } from '../content';
import type { Derived, Stats, World, WeaponInst } from './types';
import { clamp } from '../core/math';

export const BASE_HP = 100;
export const BASE_SPEED = 130;
export const BASE_MAGNET = 65;

export function zeroStats(): Stats {
  return {
    might: 0, area: 0, cooldown: 0, amount: 0, duration: 0, projSpeed: 0, moveSpeed: 0, maxHp: 0, armor: 0,
    recovery: 0, magnet: 0, luck: 0, growth: 0, greed: 0, curse: 0, revival: 0, reroll: 0, skip: 0, banish: 0,
    crit: 0, ultCharge: 0,
  };
}

export function addStats(into: Stats, b: StatBlock | undefined, mul = 1) {
  if (!b) return into;
  for (const k in b) {
    const v = b[k as StatKey];
    if (typeof v === 'number') into[k as StatKey] += v * mul;
  }
  return into;
}

/** base(패시브 제외 합산)를 다시 계산. 캐릭터·메타·모디파이어·점심·캐릭터 성장 보너스. */
export function recalcBase(w: World) {
  const s = zeroStats();
  addStats(s, w.cfg.character.stats);
  addStats(s, w.cfg.meta);
  for (const m of w.cfg.modifiers) addStats(s, m.stats);
  if (w.lunch) addStats(s, w.lunch.stats);
  const g = w.cfg.character.growth;
  if (g && g.every > 0) addStats(s, g.stats, Math.floor((w.player.level - 1) / g.every));
  w.base = s;
  recalcStats(w);
}

/** 패시브 포함 최종 스탯과 파생값 */
export function recalcStats(w: World) {
  const s = { ...w.base };
  for (const p of w.passives) addStats(s, p.def.perLevel, p.level);
  w.stats = s;
  const prevMax = w.d ? w.d.maxHp : 0;
  const glass = w.flags.has('glassCannon');
  const d: Derived = {
    mightMul: Math.max(0.1, 1 + s.might) * (glass ? 2 : 1),
    areaMul: Math.max(0.3, 1 + s.area),
    cdMul: 1 - clamp(s.cooldown, -0.5, 0.5),
    amountAdd: Math.floor(s.amount + 1e-6),
    durMul: Math.max(0.3, 1 + s.duration),
    projSpeedMul: Math.max(0.3, 1 + s.projSpeed),
    moveSpeed: BASE_SPEED * Math.max(0.4, 1 + s.moveSpeed),
    maxHp: Math.max(1, Math.round((BASE_HP + s.maxHp) * (glass ? 0.5 : 1))),
    armor: s.armor,
    recovery: w.flags.has('noHeal') ? 0 : s.recovery,
    magnetR: BASE_MAGNET * Math.max(0.5, 1 + s.magnet),
    luck: Math.max(0, 1 + s.luck),
    growthMul: Math.max(0, 1 + s.growth),
    greedMul: Math.max(0, 1 + s.greed),
    curse: Math.max(0, s.curse),
    crit: clamp(BALANCE.baseCrit + s.crit, 0, 1),
    ultMul: Math.max(0.1, 1 + s.ultCharge),
  };
  if (w.flags.has('oneHp')) { d.maxHp = 1; d.recovery = 0; }
  w.d = d;
  // 최대 체력이 늘면 늘어난 만큼 회복
  if (prevMax > 0 && d.maxHp > prevMax) w.player.hp += d.maxHp - prevMax;
  w.player.hp = Math.min(w.player.hp, d.maxHp);
}

/** 무기 레벨 누적 스탯 */
export function weaponStatsAt(def: WeaponInst['def'], level: number): WeaponStats {
  const st: WeaponStats = { ...def.base };
  for (let i = 0; i < level - 1 && i < def.levels.length; i++) {
    const dl = def.levels[i].delta as Record<string, number>;
    for (const k in dl) (st as unknown as Record<string, number>)[k] = ((st as unknown as Record<string, number>)[k] ?? 0) + dl[k];
  }
  return st;
}

export function maxLevelOf(def: WeaponInst['def']) { return def.evolved ? 1 : def.levels.length + 1; }
