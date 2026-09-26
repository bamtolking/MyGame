// Missions: 3 active at a time (independent slots — one hard goal never blocks the others). Completing one
// gives rank XP + coins and is replaced immediately. No timers, no streaks that break. (GDD §9.3)
//
// Assignment rules (enforced by drawMission, tested in tests/meta.test.ts):
//   · at least one of the three can be finished in a typical single run (casual player, current main mode)
//   · never three missions with the same verb · at most one quirky (별난) mission
//   · nothing that needs a feature the player has not opened yet (`requires`, stage-only phase, availability)
//   · no chores ("get hit N times", "play N runs") and never a specific character
//   · deterministic: the same save always offers the same next mission (no Math.random)
import type { RunState, Mode } from '../sim/types';
import { newRun, stepRun } from '../sim/run';
import { STAGES, stagePouchTotal } from '../data/stages';
import { CHARACTERS } from '../data/characters';
// NOTE: circular import (progress.ts imports this module). Only used inside functions, never at module init.
import { featureOpen, stageCleared, stageUnlocked, starsOf, stageStarMask, type Progress } from './progress';

export type MissionScope = 'run' | 'total';
/** 'long' = a long-run mode is open (무한 달리기 or 오늘의 골목); the others follow GDD §9.3. */
export type MissionReq = 'world2' | 'relay' | 'stage' | 'daily' | 'long';
export type MissionVerb = 'run' | 'candy' | 'coin' | 'honey' | 'jump' | 'slide' | 'dodge' | 'feast' | 'power' | 'score' | 'stage' | 'avoid';

/** What a measure may look at besides the RunState (all optional so templates stay easy to call from tests). */
export interface MissionCtx {
  /** stretch distances from a deterministic replay of the run (lazy; only computed when a template asks) */
  trace: () => RunTrace;
  newStars: number;      // stage stars this run added to the save
  pouchesNew: number;    // golden pouches this run added (completed runs only)
  cleared: boolean;      // finished a stage (★1 flag reached)
}

export interface MissionTemplate {
  id: string;
  scope: MissionScope;       // 'run' = within one run; 'total' = accumulated across runs
  text: (n: number) => string;
  /** targets by difficulty level 0..2 */
  targets: [number, number, number];
  measure: (s: RunState, ctx?: MissionCtx) => number;
  /** optional condition for a run to count at all */
  when?: (s: RunState) => boolean;
  /** same-verb rule: never three active missions with one verb */
  verb: MissionVerb;
  /** 별난 미션 — at most one active */
  quirky?: boolean;
  /** feature that must be open before this template is offered */
  requires?: MissionReq;
  /** extra requirement for one difficulty level only (e.g. 3 feasts in a run need the relay partner) */
  levelRequires?: [MissionReq | null, MissionReq | null, MissionReq | null];
  /** only runs of these modes count (default: every booked mode) */
  modes?: Mode[];
  /** levels [0, quick) are finished in ONE typical casual run of a long mode (endless/daily) — bot-verified */
  quick: number;
  /** before any long mode opens only stage runs exist: levels [0, stageLevels) are doable within 10 W1 stage runs */
  stageLevels: number;
  /** levels [0, quickStage) are finished in ONE typical W1 stage run */
  quickStage: number;
  /** extra availability (e.g. enough stars / pouches left to collect) */
  available?: (p: Progress, target: number) => boolean;
}

const fmt = (n: number) => n.toLocaleString('ko-KR');
const m = (n: number) => `${fmt(n)} m`;
const dist = (s: RunState) => Math.floor(s.dist);

/** Stars still collectable on stages the player can open right now (★3 only where the stage has its 3 golden pouches). */
export function starsAvailable(p: Progress): number {
  let n = 0;
  for (const st of STAGES) {
    if (!stageUnlocked(p, st.id)) continue;
    const mask = p.starMask[st.id] ?? 0;
    n += (mask & 1 ? 0 : 1) + (mask & 2 ? 0 : 1) + (mask & 4 || stagePouchTotal(st) < 3 ? 0 : 1);
  }
  return n;
}
/** Golden pouches still to find on unlocked stages that have them. */
export function pouchesAvailable(p: Progress): number {
  let n = 0;
  for (const st of STAGES) {
    const total = Math.min(3, stagePouchTotal(st));
    if (!stageUnlocked(p, st.id) || !total) continue;
    const have = p.pouches[st.id] ?? 0;
    for (let i = 0; i < total; i++) if (!(have & (1 << i))) n++;
  }
  return n;
}

export const MISSIONS: MissionTemplate[] = [
  // Targets marked (GDD→) were lowered because the casual bot (jitter 9) could not reach the GDD value within 10 runs
  // (tests/missions.test.ts). quick / stageLevels / quickStage are bot-measured (see the header of that test).
  // ---- the original 15 (ids kept so saved missions stay valid) ----
  { id: 'jelly_run', scope: 'run', verb: 'candy', text: n => `한 판에 별사탕 ${fmt(n)}개 먹기`, targets: [150, 350, 600], measure: s => s.stats.jellies, quick: 3, stageLevels: 1, quickStage: 1 },
  { id: 'dist_run', scope: 'run', verb: 'run', text: n => `한 판에 ${m(n)} 달리기`, targets: [400, 900, 1600], measure: dist, requires: 'long', quick: 2, stageLevels: 0, quickStage: 0 },
  { id: 'dist_nofall', scope: 'run', verb: 'run', text: n => `구덩이에 안 빠지고 ${m(n)} 달리기`, targets: [300, 700, 1200], measure: s => runTrace(s).noFall, quick: 2, stageLevels: 1, quickStage: 1 },
  { id: 'streak', scope: 'run', verb: 'dodge', text: n => `위험물을 ${n}번 연달아 피하기`, targets: [10, 25, 45], measure: s => s.stats.bestStreak, quick: 2, stageLevels: 1, quickStage: 0 },
  { id: 'near', scope: 'run', verb: 'dodge', text: n => `한 판에 아슬아슬 ${n}번`, targets: [3, 6, 9], measure: s => s.stats.nearMisses, requires: 'long', quick: 1, stageLevels: 0, quickStage: 0 },   // GDD→ [3, 8, 15]
  { id: 'airjump', scope: 'run', verb: 'jump', text: n => `한 판에 2단 점프 ${n}번`, targets: [15, 25, 35], measure: s => s.stats.airJumps, requires: 'long', quick: 2, stageLevels: 0, quickStage: 0 },   // GDD→ [15, 35, 60]
  { id: 'slide', scope: 'run', verb: 'slide', text: n => `한 판에 슬라이드 ${n}번`, targets: [8, 13, 18], measure: s => s.stats.slides, requires: 'long', quick: 1, stageLevels: 0, quickStage: 0 },   // GDD→ [10, 25, 45]
  { id: 'bonus_tot', scope: 'total', verb: 'feast', text: n => `보름달 잔치 ${n}번 열기 (누적)`, targets: [1, 3, 6], measure: s => s.stats.bonusTimes, requires: 'long', quick: 1, stageLevels: 0, quickStage: 0 },
  { id: 'potion_tot', scope: 'total', verb: 'honey', text: n => `꿀물 ${n}개 마시기 (누적)`, targets: [8, 20, 45], measure: s => s.stats.potions + s.stats.miniPotions, quick: 0, stageLevels: 1, quickStage: 0 },
  { id: 'smash_tot', scope: 'total', verb: 'power', text: n => `왕만두·불꽃 질주로 장애물 ${n}개 부수기 (누적)`, targets: [5, 15, 35], measure: s => s.stats.smashed, quick: 2, stageLevels: 1, quickStage: 0 },
  { id: 'coin_tot', scope: 'total', verb: 'coin', text: n => `엽전 ${n}개 줍기 (누적)`, targets: [60, 180, 400], measure: s => s.stats.coins, requires: 'long', quick: 1, stageLevels: 0, quickStage: 0 },
  { id: 'big_tot', scope: 'total', verb: 'candy', text: n => `왕별사탕 ${n}개 먹기 (누적)`, targets: [30, 90, 200], measure: s => s.stats.bigJellies, quick: 2, stageLevels: 3, quickStage: 1 },
  { id: 'letters_tot', scope: 'total', verb: 'feast', text: n => `잔치 글자 ${n}개 모으기 (누적)`, targets: [10, 25, 50], measure: s => s.stats.letters, quick: 0, stageLevels: 1, quickStage: 0 },
  { id: 'score_run', scope: 'run', verb: 'score', text: n => `한 판에 ${fmt(n)}점`, targets: [8000, 20000, 40000], measure: s => s.score + dist(s), requires: 'long', quick: 2, stageLevels: 0, quickStage: 0 },
  { id: 'jellypct', scope: 'run', verb: 'candy', text: n => `별사탕 ${n}% 이상 먹고 500 m 넘기기`, targets: [80, 88, 93], measure: s => Math.max(0, s.stats.jellyPct500), requires: 'long', quick: 2, stageLevels: 0, quickStage: 0 },   // the rate AT 500 m (frozen by the sim): the mid-run toast and the booking read the same number · GDD→ [80, 88, 94] (bot at 500 m: 87–95 %, 94+ in 1 of 10)

  // ---- the 25 new templates (GDD §9.3 table) ----
  { id: 'line_run', scope: 'run', verb: 'candy', text: n => `한 판에 한 줄 완성 ${n}번`, targets: [2, 5, 9], measure: s => s.stats.lines, quick: 3, stageLevels: 3, quickStage: 2 },
  { id: 'big_run', scope: 'run', verb: 'candy', text: n => `한 판에 왕별사탕 ${n}개`, targets: [15, 35, 60], measure: s => s.stats.bigJellies, quick: 3, stageLevels: 2, quickStage: 2 },
  { id: 'power_run', scope: 'run', verb: 'power', text: n => `한 판에 파워업 ${n}개 먹기`, targets: [2, 4, 7], measure: s => s.stats.powers, quick: 3, stageLevels: 1, quickStage: 0 },
  { id: 'bonus_run', scope: 'run', verb: 'feast', text: n => `한 판에 보름달 잔치 ${n}번`, targets: [1, 2, 3], measure: s => s.stats.bonusTimes, requires: 'long', levelRequires: [null, null, 'relay'], quick: 1, stageLevels: 0, quickStage: 0 },   // 3 needs the relay partner's extra distance
  { id: 'tier_run', scope: 'run', verb: 'run', text: n => `속도 ${n}단계까지 달리기`, targets: [3, 5, 6], measure: s => s.stats.maxTier + 1, requires: 'long', quick: 2, stageLevels: 0, quickStage: 0 },
  { id: 'smash_run', scope: 'run', verb: 'power', text: n => `한 판에 장애물 ${n}개 부수기`, targets: [3, 8, 15], measure: s => s.stats.smashed, requires: 'long', quick: 3, stageLevels: 0, quickStage: 0 },
  { id: 'flow_run', scope: 'run', verb: 'dodge', text: n => `흐름 불꽃 ${n}단계 만들기`, targets: [2, 3, 5], measure: s => s.stats.maxFlow, quick: 2, stageLevels: 1, quickStage: 0 },
  { id: 'coin_run', scope: 'run', verb: 'coin', text: n => `한 판에 엽전 ${n}개`, targets: [20, 45, 80], measure: s => s.stats.coins, requires: 'long', quick: 2, stageLevels: 0, quickStage: 0 },
  { id: 'potion_run', scope: 'run', verb: 'honey', text: n => `한 판에 꿀물 ${n}개`, targets: [4, 7, 9], measure: s => s.stats.potions + s.stats.miniPotions, requires: 'long', quick: 1, stageLevels: 0, quickStage: 0 },   // GDD→ [4, 8, 12]
  { id: 'sky_run', scope: 'run', verb: 'feast', text: n => `잔치에서 하늘 별사탕 ${n}개`, targets: [30, 70, 120], measure: s => s.stats.bonusJellies, requires: 'long', quick: 2, stageLevels: 0, quickStage: 0 },
  { id: 'no_potion', scope: 'run', verb: 'avoid', quirky: true, text: n => `꿀물 없이 ${m(n)} 달리기`, targets: [300, 450, 600], measure: s => runTrace(s).noPotion, requires: 'long', quick: 0, stageLevels: 0, quickStage: 0 },   // GDD→ [300, 600, 1000] (1000 m exceeds the warmth budget)
  { id: 'no_air', scope: 'run', verb: 'avoid', quirky: true, text: n => `2단 점프 없이 ${m(n)} 달리기`, targets: [200, 400, 600], measure: s => runTrace(s).noAir, requires: 'long', quick: 0, stageLevels: 0, quickStage: 0 },   // GDD→ [200, 450, 800]
  // GDD "별사탕 하나도 안 먹고 n m [100, 200, 350]" is unreachable: candies line every path (best stretch a skipping bot found: 25 m).
  { id: 'no_jelly', scope: 'run', verb: 'avoid', quirky: true, text: n => `처음 500 m 동안 별사탕을 ${n}% 이상 남기기`, targets: [15, 25, 35], measure: s => runTrace(s).skip500, requires: 'long', quick: 0, stageLevels: 0, quickStage: 0 },
  { id: 'nohit_dist', scope: 'run', verb: 'dodge', text: n => `한 번도 안 부딪히고 ${m(n)} 달리기`, targets: [250, 550, 900], measure: s => runTrace(s).noHit, quick: 2, stageLevels: 1, quickStage: 0 },   // GDD→ [250, 600, 1100]
  { id: 'super_bonus', scope: 'total', verb: 'feast', quirky: true, text: n => `왕보름달 잔치 ${n}번 열기 (누적)`, targets: [1, 2, 3], measure: s => s.stats.superBonus, requires: 'long', levelRequires: [null, null, 'relay'], quick: 0, stageLevels: 0, quickStage: 0 },
  { id: 'fastfall_run', scope: 'run', verb: 'slide', text: n => `한 판에 빠른 낙하 ${n}번`, targets: [5, 15, 30], measure: s => s.stats.fastFalls, requires: 'world2', quick: 0, stageLevels: 0, quickStage: 0 },
  { id: 'relay_dist', scope: 'run', verb: 'run', text: n => `이어달리기 주자로 ${m(n)} 달리기`, targets: [200, 400, 550], measure: s => Math.floor(s.stats.relayDist), requires: 'relay', quick: 0, stageLevels: 0, quickStage: 0 },   // GDD→ [200, 500, 900]
  { id: 'dist_tot', scope: 'total', verb: 'run', text: n => `모두 합쳐 ${m(n)} 달리기`, targets: [3000, 8000, 14000], measure: dist, quick: 0, stageLevels: 0, quickStage: 0 },   // GDD→ [3000, 8000, 20000]
  { id: 'jelly_tot', scope: 'total', verb: 'candy', text: n => `별사탕 ${fmt(n)}개 먹기 (누적)`, targets: [1000, 3000, 8000], measure: s => s.stats.jellies, quick: 1, stageLevels: 1, quickStage: 0 },
  { id: 'near_tot', scope: 'total', verb: 'dodge', text: n => `아슬아슬 ${n}번 (누적)`, targets: [20, 40, 60], measure: s => s.stats.nearMisses, requires: 'long', quick: 0, stageLevels: 0, quickStage: 0 },   // GDD→ [20, 50, 120]
  { id: 'airjump_tot', scope: 'total', verb: 'jump', text: n => `2단 점프 ${n}번 (누적)`, targets: [100, 180, 250], measure: s => s.stats.airJumps, requires: 'long', quick: 0, stageLevels: 0, quickStage: 0 },   // GDD→ [100, 300, 700]
  { id: 'star_tot', scope: 'total', verb: 'stage', text: n => `골목 지도 별 ${n}개 더 모으기`, targets: [2, 4, 6], measure: (_s, c) => c?.newStars ?? 0, requires: 'stage', modes: ['stage'], quick: 0, stageLevels: 3, quickStage: 0, available: (p, n) => starsAvailable(p) >= n },
  { id: 'pouch_tot', scope: 'total', verb: 'stage', text: n => `황금 복주머니 ${n}개 찾기`, targets: [2, 5, 10], measure: (_s, c) => c?.pouchesNew ?? 0, requires: 'stage', modes: ['stage'], quick: 0, stageLevels: 3, quickStage: 0, available: (p, n) => pouchesAvailable(p) >= n },
  { id: 'clear_tot', scope: 'total', verb: 'stage', text: n => `골목 지도 스테이지 ${n}번 완주`, targets: [2, 4, 8], measure: (s, c) => (c ? (c.cleared ? 1 : 0) : (s.phase === 'clear' ? 1 : 0)), requires: 'stage', modes: ['stage'], quick: 0, stageLevels: 3, quickStage: 0, available: p => STAGES.some(st => stageUnlocked(p, st.id)) },
  { id: 'daily_dist', scope: 'run', verb: 'run', text: n => `오늘의 골목에서 ${m(n)} 달리기`, targets: [800, 1500, 2500], measure: dist, requires: 'daily', modes: ['daily'], quick: 0, stageLevels: 0, quickStage: 0 },
];
// (no prototype: an id like 'constructor' from an edited backup code must not "exist")
export const MISSION_BY_ID: Record<string, MissionTemplate> = Object.assign(Object.create(null), Object.fromEntries(MISSIONS.map(t => [t.id, t])));

export interface ActiveMission { id: string; level: number; progress: number; target: number; runsWithout: number }

/**
 * Reward per difficulty level. XP 1/2/3 as GDD §9.3; 엽전 lowered from the GDD's 40/90/160 to 15/35/60 because the
 * casual-bot economy sim (tests/missions.test.ts) books ~1.5 missions per run: with GDD values missions alone paid
 * ~120 엽전/run and the total came to ~500/run against the 120–180 target.
 */
export const MISSION_REWARD = [{ xp: 1, coins: 15 }, { xp: 2, coins: 35 }, { xp: 3, coins: 60 }];
export const RANK_MAX = 30;
export const RANK_XP = (rank: number) => Math.min(3 + Math.floor(rank / 3), 9);   // xp from rank → rank+1
/**
 * Economy knobs (tests/missions.test.ts "economy" reports the effect). GDD §9.4 asks 100 + 50r, but that sums to
 * 24,750 엽전 by rank 30 — more than everything the shop sells (10,800) — and paid ~250/run on its own in the sim.
 * 50 + 5r sums to 3,675 (≈ 35/run).
 */
export const ECONOMY = { rankBase: 50, rankPer: 5 };
/** coins on reaching rank+1 (r = the rank being left) */
export const RANK_REWARD = (rank: number) => ECONOMY.rankBase + rank * ECONOMY.rankPer;
/** Titles shown for every rank (index = rank). Ranks that unlock a character show the character instead. */
export const RANK_TITLES: string[] = [
  '첫 손님', '골목 새내기', '야시장 심부름꾼', '호떡 뒤집개', '꼬치 굽는 손', '떡꼬치 단골', '붕어빵 틀지기', '달고나 견습생',
  '포장마차 막내', '국물 지킴이', '야식 배달꾼', '골목 길잡이', '어묵 국물 달인', '초롱 든 주자', '다리 위 질주꾼', '보름달 손님',
  '강바람 주자', '불꽃놀이 구경꾼', '지붕길 날쌘돌이', '새벽 배달꾼', '이름난 주자', '도깨비 친구', '해태의 벗', '잔치 준비위원',
  '보름달 잔치꾼', '골목 대장', '야시장 명물', '전설의 배달꾼', '달빛 질주왕', '야시장 수호자', '야식 대질주 명인',
];
export interface RankRewardPreview { rank: number; xpNeeded: number; coins: number; unlocks: string[]; title: string; max: boolean }
/**
 * What reaching `rank` gives (UI: "다음 계급 보상" — call with p.rank + 1). `unlocks` are character ids (rank 5 꼬치,
 * rank 12 어묵이 — read from CHARACTERS so it follows the data). `xpNeeded` is the XP from rank−1 to rank.
 */
export function rankRewardPreview(rank: number): RankRewardPreview {
  const r = Math.max(1, Math.min(RANK_MAX, Math.floor(rank)));
  return {
    rank: r, xpNeeded: RANK_XP(r - 1), coins: RANK_REWARD(r - 1),
    unlocks: CHARACTERS.filter(c => c.unlock.kind === 'rank' && c.unlock.n === r).map(c => c.id),
    title: RANK_TITLES[r] ?? '', max: rank > RANK_MAX,
  };
}
/** Total XP from rank 0 to `rank` (207 to rank 30). */
export function rankXpTotal(rank = RANK_MAX): number { let t = 0; for (let r = 0; r < Math.min(rank, RANK_MAX); r++) t += RANK_XP(r); return t; }

// ---------------------------------------------------------------- eligibility
export function longModeOpen(p: Progress): boolean { return featureOpen(p, 'endless') || featureOpen(p, 'daily'); }
export function requirementMet(p: Progress, req: MissionReq | null | undefined): boolean {
  switch (req) {
    case undefined: case null: return true;
    case 'long': return longModeOpen(p);
    case 'stage': return featureOpen(p, 'map');
    case 'daily': return featureOpen(p, 'daily');
    case 'relay': return featureOpen(p, 'relay') && p.unlocked.length >= 2 && featureOpen(p, 'endless');
    case 'world2': return STAGES.some(st => st.world === 2 && stageCleared(p, st.id));
  }
}
/** Highest difficulty level of `t` that may be offered to this save right now (−1 = none). */
export function maxLevelFor(t: MissionTemplate, p: Progress): number {
  if (!requirementMet(p, t.requires)) return -1;
  let lv = longModeOpen(p) ? 2 : t.stageLevels - 1;
  while (lv >= 0 && ((t.levelRequires && !requirementMet(p, t.levelRequires[lv])) || (t.available && !t.available(p, t.targets[lv])))) lv--;
  return lv;
}
/** Can this mission (at its level) be finished in one typical run of the player's current main mode? */
export function isQuick(a: { id: string; level: number }, p: Progress): boolean {
  const t = MISSION_BY_ID[a.id]; if (!t) return false;
  return a.level < (longModeOpen(p) ? t.quick : t.quickStage);
}
function mix(a: number, b: number, c: number): number {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return h >>> 0;
}
/** Preferred difficulty for a rank: mostly 하 early, a mix mid-game, mostly 중/상 late. */
export function levelForRank(rank: number, roll: number): number {
  const r = roll % 100;
  if (rank < 3) return r < 80 ? 0 : 1;
  if (rank < 8) return r < 30 ? 0 : r < 80 ? 1 : 2;
  return r < 15 ? 0 : r < 60 ? 1 : 2;
}

/** How many levels of `t` count as "finished in one typical run" for this save's current main mode. */
export function quickLevels(t: MissionTemplate, p: Progress): number { return longModeOpen(p) ? t.quick : t.quickStage; }

/**
 * Deterministic mission draw (the same save always offers the same next mission).
 * `exclude`: ids that must not be drawn (all active ones). `others`: the missions that will stay active next to the new one
 * (for the verb / quirky / quick rules) — defaults to the excluded ids.
 *
 * Slot shape: exactly one "이번 판" mission — a 하-level mission a typical run finishes — and two goals that take a few
 * runs (중/상 by rank). The first draw without a quick mission among `others` is the quick one, so after any
 * completion / swap the set is back to one quick + two longer goals. This keeps the GDD rule (≥ 1 finishable in one run)
 * while pacing rank XP (all-quick sets would hand out ~2× the XP the rank curve is built for).
 */
export function drawMission(exclude: string[], p: Progress, counter: number, others?: ActiveMission[]): ActiveMission {
  const co: { id: string; level: number }[] = others ?? exclude.map(id => ({ id, level: 0 }));
  const verbs: Record<string, number> = {};
  let quirky = false; let quick = false;
  for (const a of co) {
    const t = MISSION_BY_ID[a.id]; if (!t) continue;
    verbs[t.verb] = (verbs[t.verb] ?? 0) + 1; if (t.quirky) quirky = true; if (isQuick(a, p)) quick = true;
  }
  const want = levelForRank(p.rank, mix(counter, p.rank, 7));
  const build = (mode: 'quick' | 'goal' | 'any') => {
    const pool: { t: MissionTemplate; level: number }[] = [];
    for (const t of MISSIONS) {
      if (exclude.includes(t.id) || (verbs[t.verb] ?? 0) >= 2 || (quirky && t.quirky)) continue;
      const max = maxLevelFor(t, p); if (max < 0) continue;
      const q = quickLevels(t, p);
      if (mode === 'quick') { if (q > 0) pool.push({ t, level: 0 }); continue; }
      const lo = mode === 'goal' ? q : 0;
      if (lo > max) continue;
      pool.push({ t, level: Math.max(lo, Math.min(want, max)) });
    }
    return pool;
  };
  let pool = build(quick ? 'goal' : 'quick');
  if (!pool.length) pool = build('any');
  // quirky missions are a seasoning, not the meal: half weight
  const weighted: { t: MissionTemplate; level: number }[] = [];
  for (const c of pool) { weighted.push(c); if (!c.t.quirky) weighted.push(c); }
  if (!weighted.length) {
    // safety net (should not happen: jelly_run / big_tot are always eligible): any unexcluded template at level 0
    const t = MISSIONS.find(x => !exclude.includes(x.id)) ?? MISSIONS[0];
    return { id: t.id, level: 0, progress: 0, target: t.targets[0], runsWithout: 0 };
  }
  const pick = weighted[mix(counter, p.rank * 131 + p.missionsDone, p.totals?.runs ?? 0) % weighted.length];
  return { id: pick.t.id, level: pick.level, progress: 0, target: pick.t.targets[pick.level], runsWithout: 0 };
}
/** Fills up to 3 slots. `avoid`: ids not to offer again right away (e.g. just completed). */
export function fillMissionSlots(active: ActiveMission[], p: Progress, nextCounter: () => number, avoid: string[] = []): void {
  while (active.length < 3) {
    const ids = active.map(a => a.id);
    let ex = [...ids, ...avoid];
    if (MISSIONS.length - ex.length < 6) ex = ids;   // never starve the pool
    active.push(drawMission(ex, p, nextCounter(), active.slice()));
  }
}

export function missionText(a: ActiveMission): string { return MISSION_BY_ID[a.id]?.text(a.target) ?? a.id; }
/** UI helpers */
export function missionTemplate(a: { id: string }): MissionTemplate | undefined { return MISSION_BY_ID[a.id]; }
export function missionReward(a: { level: number }): { xp: number; coins: number } { return MISSION_REWARD[Math.max(0, Math.min(2, a.level))]; }
/** Short label for the UI chips: '한 판' | '누적' | '별난'. */
export function missionTag(a: { id: string }): string { const t = MISSION_BY_ID[a.id]; return !t ? '' : t.quirky ? '별난' : t.scope === 'run' ? '한 판' : '누적'; }

// ---------------------------------------------------------------- stretch measures (deterministic replay)
/** Longest distance (m) run in one stretch without the event (from run start / previous event to the next event / run end).
 *  noJelly counts ground 별사탕 (incl. 왕별사탕) only — 하늘 별사탕 in the feast are a different pickup. */
export interface RunTrace {
  exact: boolean; noPotion: number; noAir: number; noJelly: number; noHit: number; noFall: number;
  /** % of the 별사탕 that scrolled past in the first 500 m and were left uneaten (0 if the run ended before 500 m) */
  skip500: number;
}
const traceCache = new WeakMap<RunState, { steps: number; t: RunTrace }>();
/**
 * The run's stretch measures. The sim has no "first X at" stats, so the run is re-simulated from its seed + input log
 * (the same machinery as ghosts: ~30–60 ms for a 3-minute run, only when an active mission asks). If the replay does
 * not reproduce the run exactly, falls back to whole-run values (never over-credits).
 */
export function runTrace(s: RunState): RunTrace {
  // mid-run (e.g. the HUD checking missions every 0.5 s): cheap conservative values, never a replay, never cached
  if (s.phase !== 'over' && s.phase !== 'clear') return conservativeTrace(s);
  const hit = traceCache.get(s); if (hit && hit.steps === s.steps) return hit.t;
  let t: RunTrace | null = null;
  // if the sim ever tracks these itself (recommended: RunStats.stretchM), use them and skip the replay
  const pre = (s.stats as unknown as { stretchM?: Partial<RunTrace> }).stretchM;
  if (pre && typeof pre.noHit === 'number' && typeof pre.noPotion === 'number' && typeof pre.noAir === 'number' && typeof pre.noJelly === 'number' && typeof pre.noFall === 'number') {
    t = { exact: true, noPotion: Math.floor(pre.noPotion), noAir: Math.floor(pre.noAir), noJelly: Math.floor(pre.noJelly), noHit: Math.floor(pre.noHit), noFall: Math.floor(pre.noFall), skip500: Math.floor(pre.skip500 ?? 0) };
    traceCache.set(s, { steps: s.steps, t }); return t;
  }
  if (s.steps > 0 && !s.trial) for (const nc of [false, true]) { t = replayTrace(s, nc); if (t) break; }
  if (!t) t = conservativeTrace(s);
  traceCache.set(s, { steps: s.steps, t });
  return t;
}
/** Whole-run values: a stretch is only credited when the event never happened (a lower bound of the real stretch). */
function conservativeTrace(s: RunState): RunTrace {
  const d = dist(s); const st = s.stats;
  return {
    exact: false, noPotion: st.potions + st.miniPotions === 0 ? d : 0, noAir: st.airJumps === 0 ? d : 0,
    noJelly: st.jellies === 0 ? d : 0, noHit: st.hits + st.shieldsUsed === 0 ? d : 0, noFall: st.falls === 0 ? d : 0, skip500: 0,
  };
}
function replayTrace(s: RunState, noCountdown: boolean): RunTrace | null {
  let r: RunState;
  try {
    r = newRun({ mode: s.mode, seed: s.seed, charId: s.mainId, partnerId: s.partnerId, companionId: s.companionId, stageId: s.stageId, assist: s.assistOpts, trial: s.trial, noCountdown });
  } catch { return null; }
  const keys = ['noPotion', 'noAir', 'noJelly', 'noHit', 'noFall'] as const;
  const count = (x: RunState) => {
    const st = x.stats;
    return [st.potions + st.miniPotions, st.airJumps, st.jellies, st.hits + st.shieldsUsed, st.falls];
  };
  let prev = count(r); const last = [0, 0, 0, 0, 0]; const best = [0, 0, 0, 0, 0];
  const log = s.log; let li = 0; let bits = 0; let skip500 = -1;
  for (let k = 0; k < s.steps; k++) {
    let jump = false;
    while (li < log.length && log[li] === k) { bits = log[li + 1]; jump = (bits & 1) === 1; li += 2; }
    stepRun(r, { jump, slide: (bits & 2) === 2, jumpHeld: (bits & 4) === 4 });
    r.events.length = 0;
    const now = count(r);
    for (let i = 0; i < 5; i++) if (now[i] !== prev[i]) { best[i] = Math.max(best[i], r.dist - last[i]); last[i] = r.dist; }
    prev = now;
    if (skip500 < 0 && r.dist >= 500) skip500 = r.stats.jelliesSeen > 0 ? Math.floor(100 * (r.stats.jelliesSeen - r.stats.jellies) / r.stats.jelliesSeen) : 0;
  }
  if (r.steps !== s.steps || r.dist !== s.dist || r.score !== s.score || r.stats.jellies !== s.stats.jellies) return null;
  const out = { exact: true, skip500: Math.max(0, skip500) } as RunTrace;
  keys.forEach((k, i) => { out[k] = Math.floor(Math.max(best[i], r.dist - last[i])); });
  return out;
}

// ---------------------------------------------------------------- live (mid-run) progress for the 1.5 s toast
const END_ONLY = new Set(['star_tot', 'pouch_tot', 'clear_tot']);
/**
 * What each active mission would show if the run ended now — call it a few times a second during a run and toast
 * ("미션 완료!") when `done` flips to true. Never mutates the missions; star/pouch/clear missions only move at run end.
 */
export function liveMissionProgress(active: ActiveMission[], s: RunState): { id: string; progress: number; target: number; done: boolean }[] {
  return active.map(a => {
    const t = MISSION_BY_ID[a.id];
    let v = 0;
    if (t && !s.trial && s.mode !== 'tutorial' && (!t.modes || t.modes.includes(s.mode)) && !END_ONLY.has(t.id)) {
      try { v = t.measure(s); } catch { v = 0; }   // stretch measures are cheap lower bounds until the run is over
    }
    const progress = !t ? a.progress : t.scope === 'run' ? Math.max(a.progress, v) : a.progress + v;
    return { id: a.id, progress, target: a.target, done: progress >= a.target };
  });
}

// ---------------------------------------------------------------- booking
/** Extra facts about a booked run that the RunState alone does not carry (applyRun passes them). */
export interface MissionRunCtx { newStars?: number; pouchesNew?: number; cleared?: boolean }

/**
 * Apply a finished run. Returns indices of missions completed by this run.
 * `p` (optional) is the save BEFORE this run's stars/pouches were booked, used when `ctx` is not given.
 */
export function applyRunToMissions(active: ActiveMission[], s: RunState, p?: Progress, ctx?: MissionRunCtx): number[] {
  const done: number[] = [];
  if (s.trial || s.mode === 'tutorial') return done;
  const cleared = ctx?.cleared ?? (s.mode === 'stage' && s.phase === 'clear');
  let newStars = ctx?.newStars; let pouchesNew = ctx?.pouchesNew;
  if ((newStars === undefined || pouchesNew === undefined) && s.mode === 'stage' && s.stageId && cleared) {
    const prevMask = p?.starMask[s.stageId] ?? 0; const prevP = p?.pouches[s.stageId] ?? 0;
    newStars ??= starsOf(prevMask | stageStarMask(s, prevP)) - starsOf(prevMask);
    pouchesNew ??= starsOf((prevP | (s.pouchesGot & 7)) & ~prevP);
  }
  const mc: MissionCtx = { trace: () => runTrace(s), newStars: newStars ?? 0, pouchesNew: pouchesNew ?? 0, cleared };
  active.forEach((a, i) => {
    const t = MISSION_BY_ID[a.id]; if (!t) return;
    if ((t.modes && !t.modes.includes(s.mode)) || (t.when && !t.when(s))) { a.runsWithout++; return; }
    const v = t.measure(s, mc);
    const before = a.progress;
    a.progress = t.scope === 'run' ? Math.max(a.progress, v) : a.progress + v;
    if (a.progress > before) a.runsWithout = 0; else a.runsWithout++;
    if (a.progress >= a.target) done.push(i);
  });
  return done;
}
