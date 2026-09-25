// 꾸미기: 상자 스킨과 고양이 모자. 집사 레벨이 오르면 하나씩 풀린다. 점수에는 영향 없음.

export interface BoxSkin {
  id: string;
  ko: string;
  en: string;
  level: number;
  /** 안쪽 뒷면 위/아래, 벽, 벽 테두리, 날개(없으면 ''), 도장 색 */
  back: [string, string];
  wall: string;
  edge: string;
  flap: string;
  stamp: string;
  /** 뒷면 무늬 */
  pattern: 'corrugated' | 'stripes' | 'weave' | 'planks' | 'tiles' | 'glass' | 'stars' | 'shine';
}

export const BOXES: BoxSkin[] = [
  { id: 'cardboard', ko: '종이 상자', en: 'Cardboard Box', level: 1, back: ['#C98E55', '#AE733F'], wall: '#D69C5E', edge: '#9C6632', flap: '#DDA567', stamp: '#7A2E1E', pattern: 'corrugated' },
  { id: 'gift', ko: '선물 상자', en: 'Gift Box', level: 2, back: ['#FF9DB0', '#F07790'], wall: '#FFB3C2', edge: '#C94E68', flap: '#FFC6D2', stamp: '#FFFFFF', pattern: 'stripes' },
  { id: 'basket', ko: '빨래 바구니', en: 'Laundry Basket', level: 4, back: ['#8FC9F2', '#6AAEE0'], wall: '#A6D6F7', edge: '#3F7FB8', flap: '', stamp: '#FFFFFF', pattern: 'weave' },
  { id: 'wood', ko: '나무 상자', en: 'Wooden Crate', level: 6, back: ['#B98352', '#9A6A3E'], wall: '#C99462', edge: '#6E4724', flap: '', stamp: '#4A2E14', pattern: 'planks' },
  { id: 'bath', ko: '욕조', en: 'Bathtub', level: 8, back: ['#E8F4FA', '#CDE6F2'], wall: '#FFFFFF', edge: '#9BB8C8', flap: '', stamp: '#6FA9C9', pattern: 'tiles' },
  { id: 'bowl', ko: '어항', en: 'Fishbowl', level: 10, back: ['#9EE3F0', '#5BC0DA'], wall: '#C9F1F8', edge: '#4FA3BC', flap: '', stamp: '#FFFFFF', pattern: 'glass' },
  { id: 'night', ko: '밤하늘 상자', en: 'Starry Box', level: 14, back: ['#3B3F8C', '#23255E'], wall: '#555AB0', edge: '#1B1C47', flap: '#6A6FCB', stamp: '#FFE46B', pattern: 'stars' },
  { id: 'golden', ko: '황금 상자', en: 'Golden Box', level: 18, back: ['#F5C74A', '#D99A1E'], wall: '#FFD76A', edge: '#A26E08', flap: '#FFE08A', stamp: '#FFFFFF', pattern: 'shine' },
];

export interface Hat { id: string; ko: string; en: string; level: number }

export const HATS: Hat[] = [
  { id: 'none', ko: '없음', en: 'None', level: 1 },
  { id: 'bow', ko: '리본', en: 'Bow', level: 3 },
  { id: 'party', ko: '파티 모자', en: 'Party Hat', level: 5 },
  { id: 'flower', ko: '꽃', en: 'Flower', level: 7 },
  { id: 'shades', ko: '선글라스', en: 'Sunglasses', level: 9 },
  { id: 'phones', ko: '헤드폰', en: 'Headphones', level: 12 },
  { id: 'frog', ko: '개구리 모자', en: 'Frog Hat', level: 16 },
  { id: 'halo', ko: '천사 링', en: 'Halo', level: 20 },
];

export function boxById(id: string): BoxSkin { return BOXES.find(b => b.id === id) ?? BOXES[0]; }
export function hatById(id: string): Hat { return HATS.find(h => h.id === id) ?? HATS[0]; }

/** 레벨 보상 목록 (레벨 순) */
export function rewardsAt(level: number): Array<{ kind: 'box' | 'hat'; id: string }> {
  return [
    ...BOXES.filter(b => b.level === level && b.level > 1).map(b => ({ kind: 'box' as const, id: b.id })),
    ...HATS.filter(h => h.level === level && h.level > 1).map(h => ({ kind: 'hat' as const, id: h.id })),
  ];
}

/** 다음에 풀릴 보상 (없으면 null) */
export function nextReward(level: number): { level: number; kind: 'box' | 'hat'; id: string } | null {
  for (let l = level + 1; l <= 40; l++) {
    const r = rewardsAt(l);
    if (r.length) return { level: l, ...r[0] };
  }
  return null;
}
