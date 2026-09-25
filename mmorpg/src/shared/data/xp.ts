import { MAX_LEVEL } from '../constants.ts';
/** XP to go from `level` to level+1. Tuned with the balance sweep (docs/BALANCE.md). */
export function xpNeed(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  // cheap early levels (first-session pace), steeper after Lv18 (longer endgame climb)
  return Math.floor((40 * Math.pow(level, 2.95) + 50) * Math.min(1, 0.45 + 0.055 * level) * (1 + Math.max(0, level - 18) * 0.035));
}
