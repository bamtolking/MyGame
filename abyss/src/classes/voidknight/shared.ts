// voidknight: tuning constants shared by the simulation (sim.ts) and the visuals (look.ts / vfx.ts).

/** Drain strike: fraction of the damage actually dealt that returns as life. */
export const DRAIN = { heal: 0.25 };

/** Dark wave: a crescent flying straight out (through walls), its half-width growing from w0 to w1 tiles. */
export const WAVE = {
  speed: 12,
  /** Half-width of the crescent at launch / at the end of its flight (tiles). */
  w0: 0.8, w1: 1.35,
  /** Depth of the hit band along the flight direction (tiles, each side of the crest). */
  band: 0.42,
  /** Slow applied to every enemy it cuts (seconds). */
  chill: 1.5,
  /** Launch offset in front of the knight (tiles). */
  from: 0.55,
};

/** Abyssal grasp: the hands rise at seizeAt, then drag the seized enemies to the pool's edge (stopR + their radius). */
export const GRASP = { r: 4, seizeAt: 0.14, dur: 1.25, stopR: 0.4, stun: (rank: number) => 1 + 0.1 * rank, maxDrawn: 12 };

/** Void shroud: buff length and fixed parts of its mods (damage bonus is the skill's pct). */
export const SHROUD = { dur: 10, lifeSteal: 6, dmgTaken: 15, color: '#b27bff' };

/** Eclipse: the sphere's radius, how long it takes to swell to full size (damage is dealt as its rim passes), fear. */
export const ECLIPSE = { r: 5, grow: 0.34, fear: 2, fx: 1.6 };

/** Palette shared by the look, effects and icons. */
export const VK = {
  violet: '#b27bff', violetHi: '#e6d0ff', violetDk: '#4a1a7a', ember: '#d38bff',
  blood: '#e0243c', bloodHi: '#ff7a8a',
  mist: '#bcd6ff',
  /** 'r,g,b' strings for gradients. */
  vRGB: '178,123,255', vHiRGB: '230,208,255', vDkRGB: '74,26,122', bloodRGB: '224,36,60', mistRGB: '188,214,255',
};
