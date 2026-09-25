import type { TalKind } from '../types.ts';

/** Auto-cast talisman skills. Arrays are indexed by talisman level-1 (1..5). */
export interface TalDef {
  kind: TalKind; name: string; glyph: string; color: string; brief: string;
  cd: number[]; dmg: number[]; count: number[]; radius: number[]; extra: number[];
}
export const TALS: Record<TalKind, TalDef> = {
  blades: { kind: 'blades', name: '칼바람 부적', glyph: '風', color: '#9fd7ff', brief: '몸 주위를 도는 칼날이 닿는 적을 벱니다.',
    cd: [0, 0, 0, 0, 0], dmg: [0.55, 0.65, 0.8, 0.95, 1.15], count: [2, 3, 3, 4, 5], radius: [72, 76, 80, 86, 92], extra: [0.5, 0.5, 0.45, 0.42, 0.38] },
  wisp: { kind: 'wisp', name: '도깨비불 부적', glyph: '火', color: '#6fb6ff', brief: '가까운 적에게 날아가 터지는 도깨비불을 날립니다.',
    cd: [1.7, 1.6, 1.5, 1.35, 1.2], dmg: [1.25, 1.35, 1.5, 1.7, 2.0], count: [1, 2, 2, 3, 4], radius: [52, 54, 58, 62, 68], extra: [380, 390, 400, 410, 420] },
  thunder: { kind: 'thunder', name: '뇌전 부적', glyph: '雷', color: '#ffe066', brief: '주변의 적 여럿에게 벼락을 내리고, 옆의 적에게 번집니다.',
    cd: [2.4, 2.2, 2.0, 1.8, 1.6], dmg: [1.5, 1.65, 1.8, 2.0, 2.4], count: [2, 3, 3, 4, 5], radius: [420, 430, 440, 450, 460], extra: [110, 115, 120, 125, 130] },
  frost: { kind: 'frost', name: '서리 부적', glyph: '氷', color: '#bff3ff', brief: '주변에 냉기를 터뜨려 피해를 주고 느리게 합니다.',
    cd: [4.0, 3.7, 3.4, 3.1, 2.8], dmg: [1.0, 1.2, 1.4, 1.6, 2.0], count: [1, 1, 1, 1, 1], radius: [130, 140, 150, 165, 180], extra: [2, 2.2, 2.4, 2.6, 3] },
  aura: { kind: 'aura', name: '결계 부적', glyph: '界', color: '#ffb36b', brief: '발밑의 결계가 안에 들어온 적을 계속 태웁니다.',
    cd: [0.5, 0.5, 0.5, 0.5, 0.5], dmg: [0.35, 0.4, 0.48, 0.56, 0.7], count: [1, 1, 1, 1, 1], radius: [95, 105, 115, 125, 140], extra: [0, 0, 0, 0, 0] },
  pierce: { kind: 'pierce', name: '파마 부적', glyph: '貫', color: '#a6ff9e', brief: '가장 가까운 적 방향으로 모든 것을 꿰뚫는 화살을 쏩니다.',
    cd: [1.3, 1.2, 1.1, 1.0, 0.9], dmg: [1.3, 1.5, 1.7, 1.9, 2.3], count: [1, 1, 2, 2, 3], radius: [22, 22, 24, 24, 26], extra: [520, 540, 560, 580, 600] },
  bell: { kind: 'bell', name: '방울 부적', glyph: '鈴', color: '#fff1a8', brief: '나와 주변 동료의 체력을 회복합니다.',
    cd: [7, 6.5, 6, 5.5, 5], dmg: [0.06, 0.07, 0.08, 0.1, 0.12], count: [1, 1, 1, 1, 1], radius: [260, 270, 280, 290, 300], extra: [0, 0, 0, 0, 0] },
  guard: { kind: 'guard', name: '금강 부적', glyph: '剛', color: '#e0c3ff', brief: '나와 주변 동료에게 피해를 막는 보호막을 씌웁니다.',
    cd: [11, 10.5, 10, 9.5, 9], dmg: [0.12, 0.14, 0.16, 0.19, 0.22], count: [1, 1, 1, 1, 1], radius: [220, 230, 240, 250, 260], extra: [5, 5, 5, 5.5, 6] },
};
export const TAL_KINDS: TalKind[] = ['blades', 'wisp', 'thunder', 'frost', 'aura', 'pierce', 'bell', 'guard'];
export const TAL_IDX: Record<TalKind, number> = Object.fromEntries(TAL_KINDS.map((k, i) => [k, i])) as Record<TalKind, number>;
export function talDesc(kind: TalKind, lv: number): string {
  const d = TALS[kind]; const i = Math.max(0, Math.min(4, lv - 1)); const pct = (v: number) => Math.round(v * 100) + '%';
  switch (kind) {
    case 'blades': return `칼날 ${d.count[i]}개 · 공격력의 ${pct(d.dmg[i])}`;
    case 'wisp': return `${d.cd[i]}초마다 ${d.count[i]}발 · 공격력의 ${pct(d.dmg[i])} 폭발`;
    case 'thunder': return `${d.cd[i]}초마다 ${d.count[i]}번 낙뢰 · 공격력의 ${pct(d.dmg[i])}`;
    case 'frost': return `${d.cd[i]}초마다 반경 ${d.radius[i]} · 공격력의 ${pct(d.dmg[i])} · ${d.extra[i]}초 감속`;
    case 'aura': return `반경 ${d.radius[i]} · 0.5초마다 공격력의 ${pct(d.dmg[i])}`;
    case 'pierce': return `${d.cd[i]}초마다 ${d.count[i]}발 관통 · 공격력의 ${pct(d.dmg[i])}`;
    case 'bell': return `${d.cd[i]}초마다 최대 체력의 ${pct(d.dmg[i])} 회복(동료 포함)`;
    case 'guard': return `${d.cd[i]}초마다 최대 체력의 ${pct(d.dmg[i])} 보호막 ${d.extra[i]}초(동료 포함)`;
  }
}
