// 경제·라운드 상수
export const START_GOLD = 100;
export const SUMMON_COST = 20;
export const TOTAL_ROUNDS = 40;
export const ROUND_TIME = 25;        // 초. 라운드 간격 (몬스터는 계속 남아 누적)
export const COUNTDOWN = 3;          // 시작 카운트다운
export const BOSS_TIME = 60;         // 보스 제한시간(초) — 넘기면 탈락
export const FINAL_TIME = BOSS_TIME + 1; // 마지막 라운드 길이(멀티 종료 시점)
export const MAX_PLAYERS = 4;
export const MIN_SEND_GOLD = 10;

/** 소환 확률 (등급 0~3), 소환 레벨 1~5 */
export const SUMMON_ODDS: [number, number, number, number][] = [
  [0.62, 0.28, 0.085, 0.015],
  [0.52, 0.32, 0.13, 0.03],
  [0.42, 0.34, 0.18, 0.06],
  [0.32, 0.34, 0.24, 0.10],
  [0.22, 0.33, 0.30, 0.15],
];
export const SUMMON_LV_COST = [120, 260, 520, 1000]; // Lv1→2, 2→3, 3→4, 4→5
export const MAX_SUMMON_LV = 5;

export const ATK_PER_LV = 0.08;
export const MAX_ATK_LV = 15;
export function atkUpgradeCost(lv: number): number { return 60 + 45 * lv; }

export function roundIncome(r: number): number { return 25 + 3 * r; }
export function killGold(r: number, boss: boolean): number { return boss ? 100 * Math.max(1, Math.round(r / 10)) : 1 + Math.floor(r / 8); }
