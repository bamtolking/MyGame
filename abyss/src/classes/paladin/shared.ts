// paladin: tuning constants shared by the simulation (sim.ts) and the visuals (art.ts).

/** Zeal: the three strikes land at these fractions of the act (the pose swings three times to match). */
export const ZEAL_AT = [1 / 6, 1 / 2, 5 / 6];

/** Blessed hammer: an Archimedean spiral around the cast point, flown at constant speed. */
export const HAMMER = {
  /** Start / end radius (tiles). */
  r0: 0.5, r1: 4,
  /** Revolutions from r0 to r1, and the radius curve exponent (>1: tight first turn). */
  turns: 2.5, curve: 1.35,
  /** Flight speed along the spiral (tiles/s). */
  speed: 13,
  /** Hit radius and seconds before the same monster can be struck again. */
  hitR: 0.55, rehit: 0.3,
};

/** Holy aura: buff length, burn tick. Radius is the SkillDef range. */
export const AURA = { dur: 15, tick: 0.6 };

/** Charge: contact radius around the hero while dashing, stun, knockback and the landing burst radius. */
export const CHARGE = { contact: 0.45, stun: 0.8, kb: 1.6, burst: 1.3 };

/** Heavenly judgment: pillar count and spacing, seal radius, pillar radius, first delay, seal lifetime. */
export const JUDGMENT = { n: 7, every: 0.2, r: 3, pillarR: 1, first: 0.12, dur: 2 };
