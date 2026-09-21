// Prison policies the warden can set at any time.
export interface Policy { meal: 0 | 1 | 2; punish: 0 | 1 | 2; search: 0 | 1 | 2 }
export const DEFAULT_POLICY: Policy = { meal: 1, punish: 1, search: 0 };
export const MEAL_OPTIONS = [
  { name: '기본식', cost: 2, hunger: 60, recreation: 0, desc: '식재료 $2/인분. 배고픔 -60. 식중독 위험.' },
  { name: '표준식', cost: 3, hunger: 75, recreation: 8, desc: '식재료 $3/인분. 배고픔 -75, 여가 -8.' },
  { name: '고급식', cost: 5, hunger: 90, recreation: 16, desc: '식재료 $5/인분. 배고픔 -90, 여가 -16. 기분 개선.' },
];
export const PUNISH_OPTIONS = [
  { name: '3시간', hours: 3, desc: '짧은 징벌. 자유 욕구 부담 적음, 진정 효과 짧음.' },
  { name: '6시간', hours: 6, desc: '표준.' },
  { name: '12시간', hours: 12, desc: '긴 징벌. 오래 진정하지만 자유 욕구가 크게 오릅니다.' },
];
export const SEARCH_OPTIONS = [
  { name: '순찰만', times: [] as number[], desc: '정기 수색 없음. 순찰 중 우연히 발견할 수 있습니다.' },
  { name: '매일 수색', times: [6], desc: '매일 06:00 감방 수색. 터널 발견 확률 높음. 수감자 자유 욕구 +5.' },
  { name: '강화 수색', times: [6, 18], desc: '06:00·18:00 수색. 자유 욕구 +5씩. 교도관 3명 이상 권장.' },
];
export const POLICY_INFO = { meal: { name: '식사 품질', icon: '🍲' }, punish: { name: '징벌 시간', icon: '⛓' }, search: { name: '감방 수색', icon: '🔦' } } as const;
