// 경제·진행 수치. 변경 이유는 docs/DEVELOPMENT_NOTES.md 의 밸런스 기록에 남깁니다.
export const START_GOLD = 100;
export const START_LIFE = 20;
export const SUMMON_COST = 25;
export const REFRESH_FREE = 2;      // 한 판 무료 새로고침 횟수
export const REFRESH_COST = 12;     // 무료 소진 뒤 골드 비용
export const SELL_RATE = 0.6;       // 판매 환급 = 실제 투입 골드 × 비율(내림)
export const MAX_UNITS = 12;        // 최대 배치 유닛(맵의 배치 칸 수와 동일)
export const PREP_FIRST = 10;       // 첫 웨이브 전 준비 시간(초)
export const PREP_BETWEEN = 4;      // 웨이브 사이 준비 시간(초)
export const MOVE_COOLDOWN = 1.0;   // 같은 유닛 연속 이동 대기
export const TOTAL_WAVES = 18;
export const MID_BOSS_WAVE = 9;
export const FINAL_BOSS_WAVE = 18;
export function waveReward(w: number): number { return 12 + 2 * w; }
export function sellRefund(invested: number): number { return Math.floor(invested * SELL_RATE); }
