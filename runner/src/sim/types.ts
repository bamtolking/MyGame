// Shared sim types. The sim is pure TS (no DOM), deterministic for a given seed + input stream.
import type { RngState } from './rng';
import type { Body } from './body';
import type { HazardKind, Solid } from './chunk';

export type PowerKind = 'giant' | 'dash' | 'magnet';
export type PickupType = 'jelly' | 'big' | 'coin' | 'potion' | 'bigPotion' | 'power' | 'letter' | 'bonusJelly';
export type Mode = 'endless' | 'stage' | 'daily' | 'tutorial';
export type Phase = 'countdown' | 'run' | 'dying' | 'over' | 'clear';
export type BonusStage = 'none' | 'lift' | 'sky';

export interface Hazard {
  id: number;
  kind: HazardKind;
  x0: number; x1: number; y0: number; y1: number;
  biome: string;
  broken: boolean;       // smashed by giant/dash or already hit once
  passed: boolean;       // counted for the clean streak
  near?: boolean;        // came within the near-miss margin without touching
  touched?: boolean;     // overlapped while invulnerable (no damage, but no streak credit either)
}

export interface Pickup {
  id: number;
  type: PickupType;
  x: number; y: number;
  power?: PowerKind;
  letter?: number;       // index into the bonus word
  taken: boolean;
  pulled: boolean;       // being magnet-pulled
  seen?: boolean;        // counted into jelliesSeen
}

export interface PlacedChunk {
  id: string;
  x: number;             // world x of the chunk's left edge
  width: number;
  tier: number;
  speed: number;         // px/s the player runs at inside this chunk (switches at x − TILE)
  biome: string;
  sky: boolean;          // bonus-time sky chunk
  finish?: boolean;      // stage finish chunk
}

export interface Level {
  chunks: PlacedChunk[];
  solids: Solid[];       // world coords, append order = x order
  hazards: Hazard[];
  pickups: Pickup[];
  genX: number;          // world x where the next chunk will be placed
  recent: string[];      // recently used chunk ids (no-repeat window)
  nextId: number;
  potionDebt: number;    // m since the last potion was placed
  powerDebt: number;     // m since the last power-up was placed
  letterDebt: number;    // m since the last letter was placed
  chunksPlaced: number;
  potionsPlaced: number;
  retiredGroundM: number; // ground metres of chunks already pruned behind the player
  stageLen: number;      // m; 0 = endless
  finishX: number;       // world x of the finish line (stage), else Infinity
  hazardRun: number;     // consecutive chunks with hazards (the director forces a breather)
}

export interface PowerState { giant: number; dash: number; magnet: number; after: number /* post-power grace i-frames */ }

export interface RunStats {
  jellies: number; bigJellies: number; coins: number; potions: number; powers: number; letters: number;
  hits: number; hitsBy: Record<string, number>; falls: number; smashed: number; bonusTimes: number;
  bestStreak: number; skillUses: number; jumps: number; airJumps: number; slides: number;
  jelliesSeen: number;   // jellies that scrolled past (for % collected)
  hpFromPotions: number; drained: number;
  nearMisses: number; maxTier: number; bonusJellies: number;
}

export interface RunState {
  version: number;
  seed: number;
  rng: RngState;
  mode: Mode;
  stageId: string | null;
  charId: string;         // character currently running (changes on relay)
  mainId: string;         // character that started the run
  partnerId: string | null;
  relayUsed: boolean;
  assist: boolean;
  trial: boolean;          // try-out run (no rewards/records); ends after TRIAL_T
  phase: Phase;
  t: number;             // run time (s), excludes countdown
  countdown: number;
  steps: number;
  body: Body;
  speed: number;         // current px/s (chunk speed × dash)
  baseSpeed: number;     // chunk speed without power
  tier: number;
  biome: string;
  hp: number; maxHp: number;
  iframes: number;       // s of invulnerability left
  hurtT: number;         // s since last hit (for flashes)
  power: PowerState;
  skillT: number;        // s until the character skill fires again
  skillActive: number;   // s left of an active timed skill
  shield: number;        // hits absorbed (skill)
  reviveLeft: number;
  rescue: number;        // s of pit-bounce bridge left
  letters: boolean[];
  bonusStage: BonusStage;
  bonusT: number;        // s left in the current bonus stage
  bonusSuper: boolean;   // entered below the low-HP line → longer + heal at the end
  streak: number;        // hazards cleared without a hit
  score: number;
  dist: number;          // m travelled (excludes bonus sky)
  level: Level;
  stats: RunStats;
  deathCause: string | null;
  lastHit: { kind: string; biome: string; x: number } | null;
  events: SimEvent[];
  inputJumpHeld: boolean;
  prevSlide: boolean;
  lowHpWarned: boolean;
  hitstop: number;       // steps of freeze left after taking damage
  log: number[];         // input log: [step, bits, step, bits, …] (bits: 1 jump press, 2 slide held, 4 jump held)
  lastBits: number;
  dyingT: number;
}

export interface RunInput { jump: boolean; slide: boolean; jumpHeld?: boolean }

export type SimEvent =
  | { t: 'jump'; n: 1 | 2 }
  | { t: 'land' }
  | { t: 'slide' }
  | { t: 'pickup'; type: PickupType; x: number; y: number; value: number; power?: PowerKind; letter?: number }
  | { t: 'hit'; kind: string; x: number; y: number; dmg: number; shielded: boolean }
  | { t: 'smash'; kind: string; x: number; y: number }
  | { t: 'power'; kind: PowerKind }
  | { t: 'powerEnd'; kind: PowerKind }
  | { t: 'bonusStart' }
  | { t: 'bonusEnd' }
  | { t: 'fall'; dmg: number }
  | { t: 'speedUp'; tier: number }
  | { t: 'biome'; id: string }
  | { t: 'skill'; kind: string }
  | { t: 'lowHp' }
  | { t: 'revive' }
  | { t: 'relay'; id: string }
  | { t: 'nearMiss'; x: number; y: number }
  | { t: 'death'; cause: string }
  | { t: 'clear' }
  | { t: 'streak'; n: number };
