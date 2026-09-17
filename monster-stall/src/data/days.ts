// 영업일 5개 + 연습(튜토리얼). 손님 구성·도착 패턴·주문 부담이 다르다.
import type { CustomerType } from './customers';
import type { Family } from './foods';

export type Star2Rule =
  | { kind: 'maxLeft'; value: number; label: string }     // 주문 대기 이탈 + 대기줄 이탈 합계 이하
  | { kind: 'minHappy'; value: number; label: string };   // 팁 100% 조건(인내 60% 이상 남김)으로 서빙한 손님 수 이상

export interface DayDef {
  id: number;
  name: string;
  subtitle: string;
  desc: string;
  /** 활성 단계 범위 */
  minTier: number;
  maxTier: number;
  /** 단계별 주문 가중치 (1..maxTier). 손님 성향으로 재가중된다 */
  tierWeights: number[];
  /** 한 주문의 원료량 상한 (n단계 = 2^(n-1)) */
  rawCap: number;
  /** 손님 수 */
  customerCount: number;
  /** 손님 종류 가중치 */
  customerWeights: Partial<Record<CustomerType, number>>;
  /** 도착 간격(초): 기본 간격과 흔들림. 첫 손님 도착 시각 */
  firstArrival: number;
  intervalBase: number;
  intervalJitter: number;
  /** 짧은 간격(burst) 확률 및 그때 간격 */
  burstProb: number;
  burstInterval: number;
  /** 두 명이 함께 도착하는 쌍의 수 */
  pairs: number;
  /** 계열 강제 가중치 (예: 비 오는 날 구이). null이면 손님 선호만 사용 */
  familyBias: Partial<Record<Family, number>> | null;
  /** 주문 인내 배율 */
  patienceMult: number;
  /** 목표 */
  targetServed: number;
  star2: Star2Rule;
  incomeGoal: number;
  /** 연출 */
  weather: 'clear' | 'busy' | 'rain' | 'moon' | 'festival';
}

export const DAYS: DayDef[] = [
  {
    id: 1, name: '골목 첫 영업', subtitle: '합성과 서빙 배우기',
    desc: '손님이 일정한 간격으로 8명 옵니다. 1~2단계 메뉴만 주문해요. 기본 좌석 2개로 충분합니다.',
    minTier: 1, maxTier: 2, tierWeights: [0.6, 0.4], rawCap: 4,
    customerCount: 8, customerWeights: { slime: 5, goblin: 3, ghost: 2 },
    firstArrival: 3, intervalBase: 16, intervalJitter: 3, burstProb: 0, burstInterval: 6, pairs: 0,
    familyBias: null, patienceMult: 1.0,
    targetServed: 4, star2: { kind: 'maxLeft', value: 1, label: '떠난 손님 1명 이하' }, incomeGoal: 120,
    weather: 'clear',
  },
  {
    id: 2, name: '퇴근길 북적북적', subtitle: '좌석 회전과 동선',
    desc: '12명이 짧은 간격으로 몰려옵니다. 간단한 주문이 많아 낮은 단계 음식을 남겨두는 게 중요해요.',
    minTier: 1, maxTier: 3, tierWeights: [0.55, 0.33, 0.12], rawCap: 6,
    customerCount: 12, customerWeights: { slime: 4, goblin: 3, bat: 2, ghost: 1, golem: 1 },
    firstArrival: 3, intervalBase: 10, intervalJitter: 3, burstProb: 0.4, burstInterval: 4, pairs: 0,
    familyBias: null, patienceMult: 1.0,
    targetServed: 6, star2: { kind: 'maxLeft', value: 3, label: '떠난 손님 3명 이하' }, incomeGoal: 240,
    weather: 'busy',
  },
  {
    id: 3, name: '비 오는 날의 포장마차', subtitle: '구이 수요 급증',
    desc: '비가 와서 따뜻한 구이 주문이 많아요. 음료·디저트도 조금은 나옵니다. 계열을 미리 준비해 보세요.',
    minTier: 1, maxTier: 3, tierWeights: [0.4, 0.4, 0.2], rawCap: 6,
    customerCount: 8, customerWeights: { goblin: 4, slime: 2, golem: 2, ghost: 1, bat: 1 },
    firstArrival: 3, intervalBase: 15, intervalJitter: 4, burstProb: 0.2, burstInterval: 5, pairs: 0,
    familyBias: { grill: 0.65, drink: 0.2, dessert: 0.15 }, patienceMult: 1.0,
    targetServed: 5, star2: { kind: 'maxLeft', value: 1, label: '떠난 손님 1명 이하' }, incomeGoal: 220,
    weather: 'rain',
  },
  {
    id: 4, name: '달빛 미식회', subtitle: '고급 메뉴의 밤',
    desc: '3~4단계 주문이 많고, 인내 시간은 넉넉합니다. 보드 공간을 아껴 고급 메뉴를 준비하세요.',
    minTier: 1, maxTier: 4, tierWeights: [0.1, 0.25, 0.4, 0.25], rawCap: 12,
    customerCount: 8, customerWeights: { witch: 4, ghost: 2, golem: 2, goblin: 1, bat: 1 },
    firstArrival: 4, intervalBase: 16, intervalJitter: 4, burstProb: 0.1, burstInterval: 6, pairs: 0,
    familyBias: null, patienceMult: 1.2,
    targetServed: 4, star2: { kind: 'minHappy', value: 3, label: '여유 있게(팁 100%) 서빙 3명 이상' }, incomeGoal: 450,
    weather: 'moon',
  },
  {
    id: 5, name: '만월 야시장', subtitle: '모든 것을 시험하는 밤',
    desc: '12명이 오고 일부는 둘이 함께 옵니다. 간단한 주문과 고급 주문이 섞여 우선순위 판단이 필요해요.',
    minTier: 1, maxTier: 4, tierWeights: [0.35, 0.3, 0.22, 0.13], rawCap: 10,
    customerCount: 12, customerWeights: { slime: 3, goblin: 2, ghost: 2, bat: 2, golem: 1, witch: 2 },
    firstArrival: 3, intervalBase: 11, intervalJitter: 3, burstProb: 0.25, burstInterval: 4, pairs: 3,
    familyBias: null, patienceMult: 1.15,
    targetServed: 6, star2: { kind: 'maxLeft', value: 3, label: '떠난 손님 3명 이하' }, incomeGoal: 360,
    weather: 'festival',
  },
];

/** 연습 영업(튜토리얼). 수입은 정산하지 않는다. */
export const TUTORIAL_DAY: DayDef = {
  id: 0, name: '연습 영업', subtitle: '짧은 체험',
  desc: '손님 한 명의 주문을 처리해 봅니다. 연습 수입은 저장되지 않아요.',
  minTier: 1, maxTier: 2, tierWeights: [0, 1], rawCap: 2,
  customerCount: 1, customerWeights: { slime: 1 },
  firstArrival: 1.5, intervalBase: 30, intervalJitter: 0, burstProb: 0, burstInterval: 0, pairs: 0,
  familyBias: { grill: 1 }, patienceMult: 10,
  targetServed: 1, star2: { kind: 'maxLeft', value: 0, label: '-' }, incomeGoal: 18,
  weather: 'clear',
};

export function dayDef(id: number): DayDef {
  if (id === 0) return TUTORIAL_DAY;
  const d = DAYS.find((x) => x.id === id);
  if (!d) throw new Error(`unknown day ${id}`);
  return d;
}
