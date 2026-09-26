// druid: tuning constants shared by the simulation (sim.ts) and the visuals (look.ts / vfx.ts).

/** Thorn seed (basic): flight speed (tiles/s) and hit radius. Life = skill range / speed. */
export const SEED = { speed: 14, r: 0.2 };

/** Tornado: forward speed, speed factor while churning through enemies, life (the SkillDef promises 1.6 s of
 *  travel), hit radius, re-hit interval, knockback along its path, the widest it may drift from the aim line
 *  (rad) and its sideways sway. */
export const TORNADO = { speed: 5.8, crowd: 0.42, life: 1.6, r: 0.72, rehit: 0.4, kb: 0.2, drift: 0.85, sway: 1.9, swayRate: 6.5 };

/** Thorny vines: radius, lifetime, damage tick, first damage tick, root on first contact (s), movement kept while
 *  entangled (0.5 = half speed), the fast step that roots and drags (s), max fields. The slow is done by the vines
 *  themselves (not the engine's chill, which would tint the victims frost-blue). */
export const VINES = { r: 2.6, dur: 4, tick: 0.5, first: 0.15, root: 0.5, slow: 0.5, step: 0.05, max: 2 };

/** Stems drawn in a vine field (the sim marks the ones that would grow out of a wall, see vineSpot). */
export const VINE_STEMS = 15;
/** Deterministic hash in [0,1) for stable layouts (vine stems, cloud puffs, rain streaks). Visual use only. */
export const hr = (i: number, s = 0): number => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
/** Where stem i of a vine field grows (offset from the centre in tiles), its height, curl seed and growth delay. */
export function vineSpot(a: { id: number; r: number; data: Record<string, number> }, i: number): { dx: number; dy: number; h: number; seed: number; delay: number } {
  const s = (a.data.seed ?? 0) + a.id;
  const ang = hr(i, s) * Math.PI * 2, rr = Math.sqrt(hr(i + 50, s)) * a.r * 0.92;
  return { dx: Math.cos(ang) * rr, dy: Math.sin(ang) * rr, h: 26 + hr(i + 90, s) * 20, seed: hr(i + 130, s), delay: hr(i + 170, s) * 0.3 };
}

/** Spirit wolves: run speed, lifetime, bite radius, turn rate (rad/s), launch fan (rad), retarget range. */
export const WOLVES = { speed: 9, life: 2.1, r: 0.34, turn: 7.5, fan: 0.8, seek: 7 };
export const wolfCount = (rank: number): number => (rank >= 6 ? 4 : 3);

/** Rain of renewal: healing time, area lifetime (a little longer so the last heal tick always lands),
 *  heal tick, and how long the regeneration buff lasts. */
export const RENEWAL = { heal: 4, dur: 4.3, tick: 0.25, regen: 10, show: 1 };
export const renewalRegen = (rank: number): number => 2 + 0.4 * rank;

/** Thunderstorm: radius, lifetime, strike interval, delay before the first bolt. */
export const STORM = { r: 4, dur: 6, tick: 0.35, first: 0.5 };

/** Colours shared by the art modules. */
export const DR = {
  leaf: '#7ed04a', leafHi: '#c6f28a', leafDk: '#2f6a22', moss: '#4a7a34',
  bark: '#5a3e24', barkDk: '#34220f', bone: '#e6dcc4', boneDk: '#a89878',
  spirit: '120,235,215', spiritHex: '#78ebd7', storm: '#5a6470', stormDk: '#2a2f38', bolt: '#e8f0ff',
  poison: '#9cff5a',
};
