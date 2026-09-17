// 음식 계열 3개 × 4단계 = 메뉴 12종. 모든 단계는 그 자체로 판매 가능한 메뉴다.

export type Family = 'grill' | 'drink' | 'dessert';
export const FAMILIES: readonly Family[] = ['grill', 'drink', 'dessert'] as const;

export interface FoodDef {
  family: Family;
  tier: number; // 1..4
  name: string;
  price: number;
  desc: string;
}

export interface FamilyDef {
  id: Family;
  name: string;
  short: string;
  color: string; // 대표 색 (UI 강조)
}

export const FAMILY_DEFS: Record<Family, FamilyDef> = {
  grill: { id: 'grill', name: '구이', short: '구이', color: '#f28b3a' },
  drink: { id: 'drink', name: '음료', short: '음료', color: '#5cc8f2' },
  dessert: { id: 'dessert', name: '디저트', short: '디저트', color: '#f2a6d2' },
};

const TABLE: Record<Family, Array<{ name: string; price: number; desc: string }>> = {
  grill: [
    { name: '불씨 꼬치', price: 8, desc: '숯불에 살짝 구운 기본 꼬치.' },
    { name: '치즈 꼬치', price: 18, desc: '치즈를 얹어 노릇하게 녹인 꼬치.' },
    { name: '화염 모둠구이', price: 40, desc: '불꽃이 춤추는 푸짐한 모둠 접시.' },
    { name: '용의 만찬', price: 90, desc: '전설의 용도 줄 서는 최고급 구이.' },
  ],
  drink: [
    { name: '반짝 소다', price: 7, desc: '톡 쏘는 기본 탄산 한 잔.' },
    { name: '별빛 에이드', price: 16, desc: '별가루를 띄운 상큼한 에이드.' },
    { name: '달빛 셰이크', price: 36, desc: '층층이 쌓인 부드러운 셰이크.' },
    { name: '은하수 특제잔', price: 80, desc: '은하수가 소용돌이치는 특별한 잔.' },
  ],
  dessert: [
    { name: '별 쿠키', price: 9, desc: '바삭한 별 모양 쿠키.' },
    { name: '샌드 쿠키', price: 20, desc: '크림을 사이에 끼운 쿠키 샌드.' },
    { name: '호박 케이크', price: 44, desc: '폭신한 호박 케이크 한 조각.' },
    { name: '무지개 파이', price: 98, desc: '일곱 색이 겹친 꿈같은 파이.' },
  ],
};

export function foodDef(family: Family, tier: number): FoodDef {
  const row = TABLE[family][tier - 1];
  if (!row) throw new Error(`invalid food ${family} ${tier}`);
  return { family, tier, ...row };
}

export function foodKey(family: Family, tier: number): string {
  return `${family}:${tier}`;
}

export const ALL_FOODS: FoodDef[] = FAMILIES.flatMap((f) => [1, 2, 3, 4].map((t) => foodDef(f, t)));
