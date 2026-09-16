import type { EnemyType } from '../sim/types';

export interface Group { type: EnemyType; n: number; gap: number; delay: number }
export interface WaveDef { groups: Group[]; boss?: EnemyType; intro?: EnemyType }

const g = (type: EnemyType, n: number, gap: number, delay = 0): Group => ({ type, n, gap, delay });

/** Enemy HP multiplier by wave (applies to non-boss enemies; bosses use BOSS_HP_MUL). */
export function hpMul(wave: number): number {
  const w = wave - 1;
  return 1 + 0.15 * w + 0.0095 * w * w;
}
export const BOSS_HP_MUL = 1.5;
export const ENEMY_SPEED_MUL = 1.15;   // global pacing knob (applies to all enemies incl. bosses)
export const SPAWN_GAP_MUL = 0.85;     // global spawn gap scale
export const TOTAL_WAVES = 40;

export const WAVES: WaveDef[] = [
  /* 1 */ { groups: [g('wisp', 6, 1.3)], intro: 'wisp' },
  /* 2 */ { groups: [g('wisp', 9, 1.1)] },
  /* 3 */ { groups: [g('fox', 5, 0.8), g('wisp', 5, 1.1, 5)], intro: 'fox' },
  /* 4 */ { groups: [g('tortoise', 3, 2.0), g('wisp', 7, 1.0, 3)], intro: 'tortoise' },
  /* 5 */ { groups: [g('troll', 3, 2.0), g('fox', 5, 0.7, 6)], intro: 'troll' },
  /* 6 */ { groups: [g('slime', 4, 1.6), g('wisp', 6, 1.0, 4)], intro: 'slime' },
  /* 7 */ { groups: [g('ghost', 4, 1.5), g('fox', 6, 0.7, 5)], intro: 'ghost' },
  /* 8 */ { groups: [g('caster', 2, 6.0, 1), g('wisp', 8, 1.0), g('tortoise', 3, 2.0, 6)], intro: 'caster' },
  /* 9 */ { groups: [g('ogre', 1, 1, 4), g('fox', 6, 0.7), g('wisp', 8, 1.0, 7)], intro: 'ogre' },
  /* 10 */ { groups: [g('wisp', 6, 0.8, 1), g('boss_flag', 1, 1, 0)], boss: 'boss_flag' },
  /* 11 */ { groups: [g('wisp', 10, 0.9), g('fox', 6, 0.7, 6), g('slime', 3, 1.5, 10)] },
  /* 12 */ { groups: [g('tortoise', 5, 1.6), g('troll', 3, 2.0, 5), g('caster', 1, 1, 8)] },
  /* 13 */ { groups: [g('ghost', 6, 1.2), g('fox', 8, 0.6, 6)] },
  /* 14 */ { groups: [g('slime', 6, 1.3), g('ogre', 1, 1, 9)] },
  /* 15 */ { groups: [g('wisp', 12, 0.8), g('tortoise', 4, 1.6, 7), g('caster', 2, 5, 4)] },
  /* 16 */ { groups: [g('fox', 12, 0.6), g('ghost', 4, 1.4, 6)] },
  /* 17 */ { groups: [g('troll', 6, 1.6), g('caster', 2, 6, 3), g('ogre', 1, 1, 12)] },
  /* 18 */ { groups: [g('slime', 8, 1.2), g('tortoise', 4, 1.6, 8)] },
  /* 19 */ { groups: [g('ogre', 3, 4, 2), g('wisp', 10, 0.8), g('fox', 6, 0.6, 10)] },
  /* 20 */ { groups: [g('tortoise', 4, 1.2, 1), g('boss_cart', 1, 1, 0)], boss: 'boss_cart' },
  /* 21 */ { groups: [g('wisp', 14, 0.7), g('slime', 5, 1.4, 5), g('ghost', 4, 1.4, 12)] },
  /* 22 */ { groups: [g('fox', 14, 0.55), g('caster', 2, 6, 2)] },
  /* 23 */ { groups: [g('tortoise', 8, 1.3), g('troll', 4, 1.8, 6)] },
  /* 24 */ { groups: [g('ghost', 8, 1.1), g('ogre', 2, 5, 6)] },
  /* 25 */ { groups: [g('wisp', 12, 0.7), g('fox', 8, 0.6, 6), g('slime', 6, 1.3, 10), g('caster', 2, 6, 5)] },
  /* 26 */ { groups: [g('troll', 8, 1.4), g('ghost', 4, 1.4, 6), g('caster', 2, 6, 3)] },
  /* 27 */ { groups: [g('ogre', 4, 3.5, 2), g('tortoise', 6, 1.4, 4)] },
  /* 28 */ { groups: [g('fox', 16, 0.5), g('slime', 8, 1.2, 6)] },
  /* 29 */ { groups: [g('ogre', 3, 4, 3), g('ghost', 6, 1.2), g('caster', 3, 5, 2), g('wisp', 8, 0.8, 10)] },
  /* 30 */ { groups: [g('fox', 6, 0.7, 1), g('boss_thief', 1, 1, 0)], boss: 'boss_thief' },
  /* 31 */ { groups: [g('wisp', 16, 0.65), g('tortoise', 6, 1.3, 6), g('troll', 4, 1.6, 12)] },
  /* 32 */ { groups: [g('slime', 10, 1.1), g('ghost', 6, 1.2, 6), g('caster', 2, 6, 4)] },
  /* 33 */ { groups: [g('fox', 18, 0.5), g('ogre', 3, 4, 6)] },
  /* 34 */ { groups: [g('tortoise', 10, 1.2), g('caster', 3, 5, 3), g('troll', 5, 1.6, 10)] },
  /* 35 */ { groups: [g('ogre', 5, 3, 2), g('ghost', 8, 1.1), g('fox', 8, 0.6, 12)] },
  /* 36 */ { groups: [g('slime', 12, 1.0), g('troll', 6, 1.5, 6), g('caster', 3, 5, 4)] },
  /* 37 */ { groups: [g('wisp', 20, 0.6), g('fox', 12, 0.55, 8), g('ghost', 6, 1.2, 14)] },
  /* 38 */ { groups: [g('ogre', 6, 3, 1), g('tortoise', 8, 1.3), g('caster', 3, 5, 5)] },
  /* 39 */ { groups: [g('fox', 10, 0.6), g('tortoise', 6, 1.4, 4), g('troll', 4, 1.6, 8), g('slime', 6, 1.3, 12), g('ghost', 6, 1.2, 16), g('caster', 2, 6, 6), g('ogre', 3, 4, 14)] },
  /* 40 */ { groups: [g('boss_king', 1, 1, 0)], boss: 'boss_king' },
];

/** Extra order: stronger extra group appended to a wave (위험한 추가 주문). */
export const EXTRA_GROUPS: Record<number, Group[]> = {
  15: [g('ogre', 2, 3, 6), g('ghost', 4, 1.2, 3)],
  25: [g('ogre', 3, 3, 6), g('troll', 4, 1.4, 3)],
  35: [g('ogre', 4, 2.5, 6), g('caster', 2, 5, 2), g('fox', 8, 0.5, 4)],
};
