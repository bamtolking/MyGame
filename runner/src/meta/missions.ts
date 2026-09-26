// Missions: 3 active at a time (independent slots — one hard goal never blocks the others). Completing one
// gives rank XP + coins and is replaced immediately. No timers, no streaks that break.
import type { RunState } from '../sim/types';

export type MissionScope = 'run' | 'total';
export interface MissionTemplate {
  id: string;
  scope: MissionScope;       // 'run' = within one run; 'total' = accumulated across runs
  text: (n: number) => string;
  /** targets by difficulty level 0..2 */
  targets: [number, number, number];
  measure: (s: RunState) => number;
  /** optional condition for a run to count at all */
  when?: (s: RunState) => boolean;
}

export const MISSIONS: MissionTemplate[] = [
  { id: 'jelly_run', scope: 'run', text: n => `한 판에 젤리 ${n}개 먹기`, targets: [150, 350, 600], measure: s => s.stats.jellies },
  { id: 'dist_run', scope: 'run', text: n => `한 판에 ${n}m 달리기`, targets: [400, 900, 1600], measure: s => Math.floor(s.dist) },
  { id: 'dist_nofall', scope: 'run', text: n => `구덩이에 한 번도 안 빠지고 ${n}m`, targets: [300, 700, 1200], measure: s => (s.stats.falls === 0 ? Math.floor(s.dist) : 0) },
  { id: 'streak', scope: 'run', text: n => `연속 무피격 ${n}회`, targets: [10, 25, 45], measure: s => s.stats.bestStreak },
  { id: 'near', scope: 'run', text: n => `한 판에 아슬아슬 ${n}번`, targets: [3, 8, 15], measure: s => s.stats.nearMisses },
  { id: 'airjump', scope: 'run', text: n => `한 판에 2단 점프 ${n}번`, targets: [15, 35, 60], measure: s => s.stats.airJumps },
  { id: 'slide', scope: 'run', text: n => `한 판에 슬라이드 ${n}번`, targets: [10, 25, 45], measure: s => s.stats.slides },
  { id: 'bonus_tot', scope: 'total', text: n => `보너스 타임 ${n}번 (누적)`, targets: [1, 3, 6], measure: s => s.stats.bonusTimes },
  { id: 'potion_tot', scope: 'total', text: n => `물약 ${n}개 먹기 (누적)`, targets: [8, 20, 45], measure: s => s.stats.potions },
  { id: 'smash_tot', scope: 'total', text: n => `거대화·질주로 장애물 ${n}개 부수기 (누적)`, targets: [5, 15, 35], measure: s => s.stats.smashed },
  { id: 'coin_tot', scope: 'total', text: n => `코인 ${n}개 줍기 (누적)`, targets: [60, 180, 400], measure: s => s.stats.coins },
  { id: 'big_tot', scope: 'total', text: n => `곰젤리 ${n}개 먹기 (누적)`, targets: [30, 90, 200], measure: s => s.stats.bigJellies },
  { id: 'letters_tot', scope: 'total', text: n => `보너스 글자 ${n}개 모으기 (누적)`, targets: [10, 25, 50], measure: s => s.stats.letters },
  { id: 'score_run', scope: 'run', text: n => `한 판에 ${n.toLocaleString('ko-KR')}점`, targets: [8000, 20000, 40000], measure: s => s.score + Math.floor(s.dist) },
  { id: 'jellypct', scope: 'run', text: n => `젤리 ${n}% 이상 먹고 500m 넘기기`, targets: [80, 88, 94], measure: s => (s.dist >= 500 && s.stats.jelliesSeen > 0 ? Math.floor(100 * s.stats.jellies / s.stats.jelliesSeen) : 0) },
];
export const MISSION_BY_ID: Record<string, MissionTemplate> = Object.fromEntries(MISSIONS.map(m => [m.id, m]));

export interface ActiveMission { id: string; level: number; progress: number; target: number; runsWithout: number }

export const MISSION_REWARD = [{ xp: 1, coins: 40 }, { xp: 2, coins: 90 }, { xp: 3, coins: 160 }];
export const RANK_XP = (rank: number) => 3 + rank * 2;   // xp needed to go from rank → rank+1
export const RANK_REWARD = (rank: number) => 100 + rank * 50;

/** Deterministic mission draw (so the same save always offers the same next mission). */
export function drawMission(exclude: string[], rank: number, counter: number): ActiveMission {
  const pool = MISSIONS.filter(m => !exclude.includes(m.id));
  const m = pool[(counter * 7 + rank * 3) % pool.length];
  const level = Math.min(2, Math.floor(rank / 3) + (counter % 3 === 2 ? 1 : 0));
  return { id: m.id, level, progress: 0, target: m.targets[level], runsWithout: 0 };
}

export function missionText(a: ActiveMission): string { return MISSION_BY_ID[a.id]?.text(a.target) ?? a.id; }

/** Apply a finished run. Returns indices of missions completed by this run. */
export function applyRunToMissions(active: ActiveMission[], s: RunState): number[] {
  const done: number[] = [];
  active.forEach((a, i) => {
    const t = MISSION_BY_ID[a.id]; if (!t) return;
    if (t.when && !t.when(s)) { a.runsWithout++; return; }
    const v = t.measure(s);
    const before = a.progress;
    a.progress = t.scope === 'run' ? Math.max(a.progress, v) : a.progress + v;
    if (a.progress > before) a.runsWithout = 0; else a.runsWithout++;
    if (a.progress >= a.target) done.push(i);
  });
  return done;
}
