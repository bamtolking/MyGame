// 18웨이브 구성(보통/어려움). 적 종류·수·간격·지연을 데이터로 관리.
import type { EnemyKind } from './enemies';
export type Difficulty = 'normal' | 'hard';
export interface Group { kind: EnemyKind; n: number; gap: number; delay: number }
export interface WaveDef { groups: Group[]; boss?: EnemyKind; intro?: EnemyKind }

const G = (kind: EnemyKind, n: number, gap: number, delay = 0): Group => ({ kind, n, gap, delay });

export const WAVES_NORMAL: WaveDef[] = [
  /* 1 */ { groups: [G('gearbug', 6, 1.4)] , intro: 'gearbug' },
  /* 2 */ { groups: [G('gearbug', 6, 1.2), G('sparkrat', 3, 0.8, 8)], intro: 'sparkrat' },
  /* 3 */ { groups: [G('boltant', 10, 0.5), G('gearbug', 4, 1.2, 7)], intro: 'boltant' },
  /* 4 */ { groups: [G('gearbug', 6, 1.0), G('scrapturtle', 1, 1, 3)], intro: 'scrapturtle' },
  /* 5 */ { groups: [G('sparkrat', 8, 0.6), G('gearbug', 4, 1.0, 6)] },
  /* 6 */ { groups: [G('gearbug', 5, 1.0), G('repairdrone', 1, 1, 2), G('boltant', 10, 0.45, 6)], intro: 'repairdrone' },
  /* 7 */ { groups: [G('scrapturtle', 2, 3, 0), G('gearbug', 6, 1.0, 2), G('sparkrat', 5, 0.5, 9)] },
  /* 8 */ { groups: [G('boltant', 16, 0.4), G('repairdrone', 1, 1, 3), G('gearbug', 4, 1.0, 9)] },
  /* 9 */ { groups: [G('boss_golem', 1, 1, 2), G('boltant', 6, 0.6, 8)], boss: 'boss_golem' },
  /* 10 */ { groups: [G('gearbug', 8, 0.9), G('sparkrat', 6, 0.5, 5), G('scrapturtle', 1, 1, 8)] },
  /* 11 */ { groups: [G('repairdrone', 2, 4, 1), G('gearbug', 8, 0.9), G('boltant', 10, 0.4, 7)] },
  /* 12 */ { groups: [G('scrapturtle', 3, 2.5), G('sparkrat', 8, 0.45, 4)] },
  /* 13 */ { groups: [G('boltant', 20, 0.35), G('repairdrone', 2, 5, 2)] },
  /* 14 */ { groups: [G('gearbug', 10, 0.8), G('scrapturtle', 2, 2, 5), G('sparkrat', 6, 0.4, 10)] },
  /* 15 */ { groups: [G('repairdrone', 2, 3, 0), G('scrapturtle', 3, 2.5, 2), G('gearbug', 8, 0.8, 4)] },
  /* 16 */ { groups: [G('sparkrat', 12, 0.4), G('boltant', 16, 0.35, 6), G('repairdrone', 1, 1, 8)] },
  /* 17 */ { groups: [G('scrapturtle', 4, 2), G('repairdrone', 2, 4, 3), G('gearbug', 10, 0.7, 5), G('sparkrat', 6, 0.4, 12)] },
  /* 18 */ { groups: [G('boss_core', 1, 1, 2), G('repairdrone', 1, 1, 6), G('gearbug', 6, 1.0, 10)], boss: 'boss_core' },
];

/** 어려움: 체력만 올리지 않고 지원형 추가·간격 단축·보스 패턴 빈도 상승(enemies.ts BOSS 참고). */
export const HARD_EXTRA: Record<number, Group[]> = {
  3: [G('sparkrat', 3, 0.6, 9)],
  5: [G('repairdrone', 1, 1, 3)],
  7: [G('repairdrone', 1, 1, 4)],
  9: [G('repairdrone', 1, 1, 5)],
  10: [G('boltant', 8, 0.4, 10)],
  12: [G('repairdrone', 2, 3, 1)],
  14: [G('repairdrone', 1, 1, 6), G('scrapturtle', 1, 1, 9)],
  16: [G('scrapturtle', 2, 2, 3)],
  17: [G('repairdrone', 1, 1, 8)],
  18: [G('repairdrone', 1, 1, 12), G('sparkrat', 6, 0.4, 14)],
};

export const DIFF: Record<Difficulty, { name: string; hpMul: number; speedMul: number; gapMul: number; rewardMul: number; desc: string }> = {
  normal: { name: '보통', hpMul: 1.0, speedMul: 1.0, gapMul: 1.0, rewardMul: 1.0, desc: '처음 배우기 좋은 구성.' },
  hard: { name: '어려움', hpMul: 1.3, speedMul: 1.08, gapMul: 0.85, rewardMul: 1.1, desc: '지원형이 늘고 간격이 짧아지며 보스 패턴이 잦아집니다.' },
};

/** 웨이브별 일반 적 체력 배율(보스 제외). */
export function hpMul(wave: number): number {
  return 1 + 0.17 * (wave - 1) + (wave >= 10 ? 0.5 : 0);
}
export function waveDef(wave: number, diff: Difficulty): WaveDef {
  const base = WAVES_NORMAL[wave - 1];
  if (diff === 'normal') return base;
  const extra = HARD_EXTRA[wave] || [];
  return { ...base, groups: [...base.groups, ...extra] };
}
