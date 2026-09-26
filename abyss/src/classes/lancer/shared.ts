// lancer: tuning constants shared by the simulation (sim.ts) and the visuals (look.ts / vfx.ts).

/** Basic thrust: a single straight stab at the primary target. */
export const THRUST = { extra: 0.25 };

/** Piercing thrust: width of the struck line (tiles, added to the monster radius). Length is the SkillDef range. */
export const PIERCE = { width: 0.5, kb: 0.25 };

/**
 * Whirling spear: knockback strength (radius is the SkillDef range) and the whirl window as fractions of the act:
 * the lance turns a full circle from k0 to k1 (look.ts), the blade-path effect is emitted at k0 with the same
 * duration (vfx.ts), and the hit lands at the act's hitAt (0.5, inside the window).
 */
export const SWEEP = { kb: 1.1, k0: 0.3, k1: 0.8 };

/** Lightning javelin: flight speed, hit radius, side-arc search radius, arcs per hit and their share of the damage. */
export const JAVELIN = { speed: 17, r: 0.32, arcR: 4, arcN: 2, arcPct: 0.45 };

/** Dragon's descent: landing radius, stun and knockback. Leap range and flight time live in the SkillDef. */
export const DRAGON = { r: 2.8, stun: 0.6, kb: 0.8 };

/**
 * Storm thrusts: eight cone thrusts, then a lightning wave. The renderer animates a channel act with a 7 Hz
 * thrust cycle (strike at mid-cycle), so the thrusts land at (i + 0.5) / 7 s and the wave rides the ninth thrust.
 */
export const STORM = { n: 8, rate: 7, half: 0.55, waveSpeed: 11, waveLife: 0.5, waveR: 0.8 };
export const stormAt = (i: number): number => (i + 0.5) / STORM.rate;
/** Aim-angle offsets of the eight thrust streaks inside the cone (art only; every thrust strikes the whole cone). */
export const STORM_FAN = [-0.12, 0.3, -0.38, 0.08, 0.42, -0.26, 0.18, -0.04];
