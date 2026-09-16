export const START_GOLD = 110;
export const START_LIFE = 20;
export const BENCH_SIZE = 3;
export const PREP_TIME = 7;          // seconds between waves
export const EARLY_BONUS_PER_SEC = 2; // gold per remaining prep second
export const SUMMON_BASE = 30;
export const SUMMON_STEP = 2;         // + per summon so far
export const SUMMON_MAX = 100;
export const SHARDS_PER_DESIGNATE = 5;
export const PITY_THRESHOLD = 12;

export function summonCost(count: number, relics: string[] = []): number {
  const c = SUMMON_BASE + SUMMON_STEP * count;
  return Math.min(SUMMON_MAX, c);
}
export function waveReward(wave: number): number { return 30 + 4 * wave; }

export interface UpgradeDef { id: 'atk' | 'spd' | 'life'; name: string; desc: string; max: number; per: number; base: number; step: number }
export const UPGRADES: UpgradeDef[] = [
  { id: 'atk', name: '공방 담금질', desc: '모든 유닛 공격력 +6%/단계', max: 12, per: 0.06, base: 45, step: 25 },
  { id: 'spd', name: '태엽 조율', desc: '모든 유닛 공격 속도 +4%/단계 (버프 상한 별도)', max: 8, per: 0.04, base: 60, step: 35 },
  { id: 'life', name: '금고 보수', desc: '기지 생명 +3 (최대치도 증가)', max: 5, per: 3, base: 90, step: 60 },
];
export function upgradeCost(def: UpgradeDef, level: number): number { return def.base + def.step * level; }

export const SKILL_COOLDOWN = { bomb: 60, freeze: 50 };
export const SKILL_BOMB = { radius: 60, dmg: 140, perWave: 0.08, bossMul: 0.35 };
export const SKILL_FREEZE = { radius: 70, dur: 2.0, bossSlow: 0.4, bossDur: 2.0, resist: 4.0 };
export const EXTRA_ORDER_WAVES: Record<number, { gold: number; shards: number }> = { 15: { gold: 90, shards: 3 }, 25: { gold: 140, shards: 4 }, 35: { gold: 200, shards: 5 } };
export const COURIER_WAVES: Record<number, number> = { 6: 45, 14: 70, 24: 95, 33: 130 }; // wave -> reward
export const OVERHEAT_WAVES: number[] = [12, 22, 32];
export const OVERHEAT_BONUS = 0.4;
