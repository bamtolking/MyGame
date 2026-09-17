// 손님 6종. 외형뿐 아니라 선호·주문·인내·식사·팁 데이터가 실제 주문 처리에 쓰인다.
import type { Family } from './foods';

export type CustomerType = 'slime' | 'goblin' | 'ghost' | 'bat' | 'golem' | 'witch';
export const CUSTOMER_TYPES: readonly CustomerType[] = ['slime', 'goblin', 'ghost', 'bat', 'golem', 'witch'] as const;

export interface CustomerDef {
  id: CustomerType;
  name: string;
  desc: string;
  /** 선호 계열과 그 확률. null이면 계열 무관 */
  prefFamily: Family | null;
  prefProb: number;
  /** 단계 성향: 'low' 낮은 단계 위주, 'mid' 그날 중간, 'high' 그날 가능한 최고 단계 위주 */
  tierBias: 'low' | 'mid' | 'high';
  /** 메뉴 2개를 주문할 확률 */
  twoItemProb: number;
  /** 대기줄 인내(초) */
  queuePatience: number;
  /** 착석 후 주문 인내 기본값(초) */
  basePatience: number;
  /** 주문 원료량 1 초과분마다 더해지는 인내(초) */
  patiencePerRaw: number;
  /** 식사 시간(초) */
  eatTime: number;
  /** 팁 비율 (판매액 대비) */
  tipRate: number;
  /** 색 (렌더용) */
  color: string;
  accent: string;
}

export const CUSTOMER_DEFS: Record<CustomerType, CustomerDef> = {
  slime: {
    id: 'slime', name: '초록 슬라임', desc: '간단한 메뉴를 빨리 먹고 떠나요. 기다림은 짧아요.',
    prefFamily: null, prefProb: 0, tierBias: 'low', twoItemProb: 0.15,
    queuePatience: 15, basePatience: 20, patiencePerRaw: 3, eatTime: 9, tipRate: 0.10,
    color: '#7ed957', accent: '#4ea832',
  },
  goblin: {
    id: 'goblin', name: '꼬마 도깨비', desc: '구이를 좋아해요. 한 번에 1~2개를 주문해요.',
    prefFamily: 'grill', prefProb: 0.75, tierBias: 'mid', twoItemProb: 0.5,
    queuePatience: 20, basePatience: 28, patiencePerRaw: 4, eatTime: 14, tipRate: 0.15,
    color: '#e05a5a', accent: '#a83a3a',
  },
  ghost: {
    id: 'ghost', name: '수줍은 유령', desc: '음료를 좋아하고 비교적 오래 기다려요.',
    prefFamily: 'drink', prefProb: 0.8, tierBias: 'mid', twoItemProb: 0.3,
    queuePatience: 30, basePatience: 40, patiencePerRaw: 5, eatTime: 17, tipRate: 0.15,
    color: '#dfe6ff', accent: '#9aa6d8',
  },
  bat: {
    id: 'bat', name: '박쥐 배달부', desc: '디저트를 좋아해요. 급하지만 팁이 후해요.',
    prefFamily: 'dessert', prefProb: 0.8, tierBias: 'low', twoItemProb: 0.2,
    queuePatience: 12, basePatience: 16, patiencePerRaw: 3, eatTime: 7, tipRate: 0.30,
    color: '#8a6fd8', accent: '#5b44a8',
  },
  golem: {
    id: 'golem', name: '돌골렘', desc: '양이 많아요. 오래 기다리지만 식사도 오래 해요.',
    prefFamily: null, prefProb: 0, tierBias: 'mid', twoItemProb: 0.85,
    queuePatience: 40, basePatience: 50, patiencePerRaw: 5, eatTime: 28, tipRate: 0.12,
    color: '#9c9585', accent: '#6b655a',
  },
  witch: {
    id: 'witch', name: '달빛 마녀', desc: '그날 가능한 가장 고급 메뉴를 원해요. 팁이 커요.',
    prefFamily: null, prefProb: 0, tierBias: 'high', twoItemProb: 0.25,
    queuePatience: 35, basePatience: 36, patiencePerRaw: 5, eatTime: 19, tipRate: 0.25,
    color: '#c58cf2', accent: '#7b46b8',
  },
};
