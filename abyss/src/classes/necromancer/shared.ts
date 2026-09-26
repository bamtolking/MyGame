// necromancer: tuning constants shared by the simulation (sim.ts) and the visuals (vfx.ts / look.ts).

/** Bone bolt (basic): flight speed (tiles/s) and hit radius. */
export const BOLT = { speed: 15, r: 0.2 };

/** Bone spear: flight speed, hit radius (fat, so it skewers a whole line) and a small shove. */
export const SPEAR = { speed: 21, r: 0.3, kb: 0.35 };

/** Corpse explosion: corpse search radius around the target, blast radius, corpse count, share of the
 *  corpse's life dealt, delay between consecutive blasts (s) and how long a corpse swells before it pops. */
export const CORPSE = { search: 3.2, radius: 2.6, max: 3, hpPct: 0.4, stagger: 0.13, swell: 0.1 };

/** Skeletal mage: lifetime, seconds between bolts, time spent climbing out of the ground before the first
 *  bolt, targeting range, bolt speed, max mages, chill on hit and how long it takes to crumble at the end. */
export const MAGE = { dur: 14, every: 0.8, rise: 0.6, range: 7, speed: 12, max: 3, chill: 1, crumble: 0.55 };

/** Bone armor: buff length and the sampling interval of the ring that watches for melee hits (thorn shards). */
export const ARMOR = { dur: 12, watch: 0.05 };

/** Plague: cloud radius, lifetime, damage tick, slow per tick and how long the poison lingers after
 *  the last tick (the cloud keeps refreshing it while an enemy stays inside). */
export const PLAGUE = { r: 3.4, dur: 5, tick: 0.5, slow: 0.6, linger: 1 };

/** Share of the poison roll that drives the engine's 3 s poison so it drains `pct` every tick while refreshed. */
export const PLAGUE_POISON_MULT = 3 / PLAGUE.tick;
