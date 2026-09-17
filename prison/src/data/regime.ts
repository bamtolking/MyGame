export type Activity = 'sleep' | 'eat' | 'free' | 'yard' | 'work' | 'shower' | 'lockup';
export const ACTIVITY_INFO: Record<Activity, { name: string; short: string; color: string; desc: string }> = {
  sleep: { name: '수면', short: '잠', color: '#3949ab', desc: '감방에서 잠. 수면 회복.' },
  eat: { name: '식사', short: '밥', color: '#ff9800', desc: '식당에서 식사. 식사 재고 필요.' },
  free: { name: '자유', short: '자유', color: '#26a69a', desc: '가장 급한 욕구를 스스로 해결(휴게실·샤워·운동장·식당).' },
  yard: { name: '운동', short: '운동', color: '#66bb6a', desc: '운동장에서 운동. 자유 욕구도 회복.' },
  work: { name: '노동', short: '일', color: '#8d6e63', desc: '작업장에서 노동, 수입 발생. 자리 없으면 자유 시간.' },
  shower: { name: '샤워', short: '샤워', color: '#29b6f6', desc: '샤워실에서 위생 회복.' },
  lockup: { name: '감금', short: '감금', color: '#546e7a', desc: '감방에 갇힘. 안전하지만 자유 욕구 상승.' },
};
export const DEFAULT_REGIME: Activity[] = [
  'sleep', 'sleep', 'sleep', 'sleep', 'sleep', 'sleep', // 0-5
  'shower', 'eat', 'work', 'work', 'work', 'free',      // 6-11
  'eat', 'work', 'work', 'yard', 'yard', 'free',        // 12-17
  'eat', 'free', 'free', 'lockup', 'sleep', 'sleep',    // 18-23
];
export const HOUR_SECONDS = 8; // real seconds per in-game hour at 1x
export const DAY_SECONDS = HOUR_SECONDS * 24;
