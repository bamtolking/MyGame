// Achievements (업적): each unlocks exactly one cosmetic or title. Judged only when a run ends (GDD §9.5).
import type { RunState } from '../sim/types';
import type { Progress } from './progress';

export interface CosmeticDef { id: string; kind: 'hat' | 'trail' | 'jumpSound' | 'palette'; name: string; charId?: string }
export interface AchievementDef {
  id: string; group: 'dist' | 'collect' | 'skill' | 'mastery' | 'curious';
  name: string; desc: string; hidden?: boolean; hint?: string;
  reward: string;                          // cosmetic id or 'title:<text>'
  check: (p: Progress, s: RunState) => boolean;
}
export interface AchievementUnlock { id: string; name: string; reward: string }

export const COSMETICS: CosmeticDef[] = [
  { id: 'hat_gat', kind: 'hat', name: '갓' },
  { id: 'trail_star', kind: 'trail', name: '별가루 발자취' },
];

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'dist_1000', group: 'dist', name: '천 리 길도 한 걸음', desc: '한 판에 1,000m 달리기', reward: 'trail_star', check: (_p, s) => s.dist >= 1000 },
  { id: 'near_20', group: 'skill', name: '아슬아슬 달인', desc: '아슬아슬 누적 20번', reward: 'hat_gat', check: p => p.totals.nearMisses >= 20 },
];

export function evaluateAchievements(p: Progress, s: RunState): AchievementUnlock[] {
  const got: AchievementUnlock[] = [];
  for (const a of ACHIEVEMENTS) {
    if (p.achievements[a.id]) continue;
    let ok = false; try { ok = a.check(p, s); } catch { ok = false; }
    if (!ok) continue;
    p.achievements[a.id] = Date.now();
    if (!a.reward.startsWith('title:') && !p.cosmetics.owned.includes(a.reward)) p.cosmetics.owned.push(a.reward);
    got.push({ id: a.id, name: a.name, reward: a.reward });
  }
  return got;
}
