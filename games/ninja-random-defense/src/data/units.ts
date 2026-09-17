// 유닛 데이터. 5속성 × 4등급(수련생·닌자·상급닌자·현자) + 신화 4종(조합 전용). 수치는 여기만 고칩니다.
export type Element = 'fire' | 'ice' | 'bolt' | 'wind' | 'earth';
export type MythicId = 'dragon' | 'titan' | 'queen' | 'shadow';
export type Kind = Element | MythicId;
export type Grade = 0 | 1 | 2 | 3 | 4; // 4 = 신화

export const ELEMENTS: Element[] = ['fire', 'ice', 'bolt', 'wind', 'earth'];
export const MYTHIC_IDS: MythicId[] = ['dragon', 'titan', 'queen', 'shadow'];
export const GRADE_NAMES = ['일반', '희귀', '영웅', '전설', '신화'] as const;
export const GRADE_TITLES = ['수련생', '닌자', '상급닌자', '현자'] as const;
export const GRADE_HEX = ['#9aa3b5', '#4fa3ff', '#b46bff', '#ffa629', '#ff4d6d'] as const;
export const GRADE_MUL = [1, 3.3, 11, 36] as const;      // 등급별 공격력 배율 (3개 합산 3보다 조금 큼 → 합성이 이득)
export const RANGE_BY_GRADE = [0, 8, 16, 28] as const;   // 등급별 사거리 보너스

export interface ElementDef {
  el: Element; name: string; hex: string; glyph: string;
  dmg: number; period: number; range: number;
  desc: string;
  // 효과 파라미터 (등급 g에 따라 선형 증가)
  splash?: { r: number; rPer: number; ratio: number };          // 화염: 범위 피해
  slow?: { amt: number; amtPer: number; dur: number; cap: number }; // 얼음: 감속
  chain?: { n: number; nPer: number; ratio: number; r: number }; // 번개: 연쇄
  stun?: { dur: number; durPer: number; imm: number; bossMul: number }; // 대지: 기절
}

export const ELEMENT_DEFS: Record<Element, ElementDef> = {
  fire:  { el: 'fire',  name: '화염', hex: '#ff6b3d', glyph: '火', dmg: 9,  period: 1.0,  range: 105, desc: '맞은 적 주변에 범위 피해', splash: { r: 40, rPer: 8, ratio: 0.6 } },
  ice:   { el: 'ice',   name: '얼음', hex: '#5ec8ff', glyph: '氷', dmg: 7,  period: 0.9,  range: 110, desc: '적을 2초간 감속', slow: { amt: 0.25, amtPer: 0.08, dur: 2.0, cap: 0.55 } },
  bolt:  { el: 'bolt',  name: '번개', hex: '#ffd93d', glyph: '雷', dmg: 8,  period: 1.1,  range: 115, desc: '근처 적에게 연쇄', chain: { n: 2, nPer: 1, ratio: 0.7, r: 70 } },
  wind:  { el: 'wind',  name: '질풍', hex: '#7dff9a', glyph: '風', dmg: 4,  period: 0.35, range: 120, desc: '매우 빠른 단일 공격' },
  earth: { el: 'earth', name: '대지', hex: '#d9a066', glyph: '土', dmg: 16, period: 1.6,  range: 100, desc: '적을 잠시 기절 (보스 25%)', stun: { dur: 0.4, durPer: 0.1, imm: 2.5, bossMul: 0.25 } },
};

export interface MythicDef {
  id: MythicId; name: string; hex: string; glyph: string;
  recipe: [Element, Element, Element];   // 전설(현자) 3종
  dmg: number; period: number; range: number; desc: string;
  splash?: { r: number; ratio: number }; slow?: { amt: number; dur: number }; chain?: { n: number; ratio: number; r: number };
  stun?: { dur: number; imm: number; bossMul: number }; aura?: { r: number; slow: number }; bossMul?: number; slowedMul?: number;
}

export const MYTHICS: Record<MythicId, MythicDef> = {
  dragon: { id: 'dragon', name: '뇌룡', hex: '#9be7ff', glyph: '龍', recipe: ['bolt', 'ice', 'wind'], dmg: 700, period: 1.0, range: 170,
    desc: '8연쇄 번개. 감속된 적에게 1.5배', chain: { n: 8, ratio: 0.8, r: 90 }, slowedMul: 1.5 },
  titan:  { id: 'titan', name: '화산 거인', hex: '#ff8a3d', glyph: '巨', recipe: ['fire', 'earth', 'bolt'], dmg: 1300, period: 1.5, range: 150,
    desc: '넓은 범위 폭발 + 기절 0.5초', splash: { r: 90, ratio: 0.8 }, stun: { dur: 0.5, imm: 2.5, bossMul: 0.25 } },
  queen:  { id: 'queen', name: '눈보라 여왕', hex: '#c9f0ff', glyph: '雪', recipe: ['ice', 'wind', 'earth'], dmg: 600, period: 0.8, range: 170,
    desc: '주변 150 안 모든 적 35% 상시 감속, 공격 시 55% 감속', aura: { r: 150, slow: 0.35 }, slow: { amt: 0.55, dur: 2.5 } },
  shadow: { id: 'shadow', name: '그림자 왕', hex: '#b08cff', glyph: '影', recipe: ['fire', 'ice', 'wind'], dmg: 420, period: 0.3, range: 160,
    desc: '초고속 단일 공격, 보스에게 2배', bossMul: 2 },
};

export function unitName(kind: Kind, grade: Grade): string {
  if (grade === 4) return MYTHICS[kind as MythicId].name;
  return `${ELEMENT_DEFS[kind as Element].name} ${GRADE_TITLES[grade as 0 | 1 | 2 | 3]}`;
}
export function kindHex(kind: Kind): string { return (kind in MYTHICS) ? MYTHICS[kind as MythicId].hex : ELEMENT_DEFS[kind as Element].hex; }
export function kindGlyph(kind: Kind): string { return (kind in MYTHICS) ? MYTHICS[kind as MythicId].glyph : ELEMENT_DEFS[kind as Element].glyph; }
export function isMythic(kind: Kind): kind is MythicId { return kind in MYTHICS; }

export interface UnitStats { dmg: number; period: number; range: number; dps: number }
/** 등급·공격력 강화 반영 기본 능력치 */
export function unitStats(kind: Kind, grade: Grade, atkMul = 1): UnitStats {
  if (isMythic(kind)) { const m = MYTHICS[kind]; const dmg = m.dmg * atkMul; return { dmg, period: m.period, range: m.range, dps: dmg / m.period }; }
  const d = ELEMENT_DEFS[kind]; const g = grade as 0 | 1 | 2 | 3;
  const dmg = d.dmg * GRADE_MUL[g] * atkMul;
  return { dmg, period: d.period, range: d.range + RANGE_BY_GRADE[g], dps: dmg / d.period };
}

/** 효과 설명(패널 표시용) */
export function effectText(kind: Kind, grade: Grade): string {
  if (isMythic(kind)) return MYTHICS[kind].desc;
  const d = ELEMENT_DEFS[kind]; const g = grade as 0 | 1 | 2 | 3;
  if (d.splash) return `반경 ${d.splash.r + d.splash.rPer * g} 범위 피해 ${Math.round(d.splash.ratio * 100)}%`;
  if (d.slow) return `감속 ${Math.round(Math.min(d.slow.cap, d.slow.amt + d.slow.amtPer * g) * 100)}% ${d.slow.dur}초 (보스 최대 30%)`;
  if (d.chain) return `${d.chain.n + d.chain.nPer * g}연쇄, 연쇄마다 ${Math.round(d.chain.ratio * 100)}%`;
  if (d.stun) return `기절 ${(d.stun.dur + d.stun.durPer * g).toFixed(1)}초 (같은 적 ${d.stun.imm}초 면역, 보스 25%)`;
  return d.desc;
}

export const SELL_VALUE = [8, 25, 80, 260, 800] as const;
