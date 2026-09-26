// monk: tuning constants shared by the simulation (sim.ts) and the visuals (look.ts / vfx.ts).

/** 연환권: the three strikes land at these fractions of the act (the pose throws three punches to match).
 *  Jab (front fist) → cross (back fist) → heavy palm (front); the last one knocks back and stuns. */
export const COMBO = { at: [0.2, 0.47, 0.8], kb: 1.5, stun: 0.4 };

/** 기공파: flight speed (tiles/s) and hit half-width (tiles). The range is the SkillDef range. */
export const WAVE = { speed: 12, r: 0.7 };

/** 진언: buff length (s), move speed and dodge bonus (points). Attack speed = SkillDef pct. */
export const MANTRA = { dur: 12, ms: 20, dodge: 15 };

/** 비연각: contact radius around the hero while flying through, and knockback. */
export const KICK = { contact: 0.5, kb: 1.4 };
/** Flying-kick progress along the path for act progress k (0..1): a fast launch that eases into the landing. */
export function kickEase(k: number): number {
  const x = k < 0 ? 0 : k > 1 ? 1 : k;
  return 1 - (1 - x) ** 1.7;
}

/** 칠성권: strikes, search radius around the target point, strike schedule (seconds into the act). */
export const SEVEN = { n: 7, r: 5, first: 0.06, every: 0.115 };
export const sevenAt = (i: number): number => SEVEN.first + i * SEVEN.every;
