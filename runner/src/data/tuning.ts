// Run rules & balance numbers (HP, damage, items, scoring, pacing). Physics/game-feel lives in physics.ts.

// ---- HP ("체력"): drains over time, hits take chunks, potions refill ----
export const BASE_MAX_HP = 100;
export const DRAIN_BY_TIER = [0.95, 1.05, 1.18, 1.32, 1.48, 1.66]; // HP/s at each difficulty tier
export const LATE_DRAIN_START = 300;    // s — after this, drain climbs so runs always end (soft cap)
export const LATE_DRAIN_PER_S = 0.025;  // extra HP/s added per second past LATE_DRAIN_START
export const HIT_DAMAGE = 15;
export const FALL_DAMAGE = 20;
export const HIT_IFRAMES = 1.2;
export const FALL_IFRAMES = 1.6;
export const RESCUE_BOUNCE_V = 1250;    // px/s upward after a pit fall
export const RESCUE_BRIDGE_T = 1.4;     // s the pit is "bridged" after the bounce
export const LOW_HP_FRAC = 0.2;

// ---- Items ----
export const POTION_HEAL = 14;
export const MINI_POTION_HEAL = 8;       // 꿀물 한 방울 (companion 깍순이)
export const BIG_POTION_HEAL = 32;
export const POTION_GAP_M = 170;        // a potion slot is filled once this many metres passed since the last potion
export const BIG_POTION_EVERY = 4;      // every Nth potion is a big one
export const POWER_GAP_M = 120;
export const LETTER_GAP_M = 70;
export const POWER_DUR: Record<'giant' | 'dash' | 'magnet', number> = { giant: 4.5, dash: 3.2, magnet: 7 };
export const POWER_AFTER_IFRAMES = 1.0; // grace after giant/dash ends
export const DASH_MUL = 1.7;
export const MAGNET_R = 190;
export const MAGNET_PULL_V = 1100;

// ---- Bonus time ----
export const BONUS_WORD = ['보', '름', '달', '잔', '치'];   // 보름달 잔치 (full-moon feast)
export const BONUS_T = 10;
export const SUPER_BONUS_MUL = 1.5;     // entering bonus below LOW_HP_FRAC lasts longer…
export const SUPER_BONUS_HEAL = 0.15;   // …and heals this fraction of max HP at the end
export const BONUS_LIFT_T = 0.7;
export const BONUS_RETURN_IFRAMES = 1.5;
export const FLY_THRUST = 5200;         // px/s² while holding jump in the sky
export const FLY_GRAVITY = 2400;
export const FLY_MAX_V = 700;

// ---- Scoring (flat — nothing is ever upgraded) ----
export const SCORE = {
  jelly: 10, big: 60, coin: 5, letter: 50, bonusJelly: 20, smash: 30, nearMiss: 25, perMeter: 1,
  moonCake: 500, line: 100, pouch: 200,
} as const;
export const STREAK_STEP = 10;          // every 10 hazards cleared without a hit…
export const STREAK_BONUS = 0.1;        // …jelly score +10 %,
export const STREAK_MAX = 0.5;          // capped at +50 %

// ---- Difficulty pacing (endless) ----
export const TIER_EVERY_M = 300;
export const BIOME_EVERY_M = 600;
export const NO_REPEAT = 8;             // a chunk id cannot reappear within the last N chunks
export const COUNTDOWN_T = 1.5;
export const RUN_CAP_T = 600;           // hard stop (10 min) — a run always ends
