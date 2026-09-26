// Shared sim types. The sim is pure TS (no DOM), deterministic for a given seed + input stream.
import type { RngState } from './rng';
import type { Body } from './body';
import type { HazardKind, Solid } from './chunk';

export type PowerKind = 'giant' | 'dash' | 'magnet';
export type PickupType = 'jelly' | 'big' | 'coin' | 'potion' | 'bigPotion' | 'miniPotion' | 'power' | 'letter' | 'bonusJelly' | 'moonCake' | 'pouch';
export type Mode = 'endless' | 'stage' | 'daily' | 'tutorial';
export type Phase = 'countdown' | 'run' | 'dying' | 'over' | 'clear';
export type BonusStage = 'none' | 'lift' | 'sky';
export interface AssistOpts { noHitDamage?: boolean; halfDrain?: boolean; autoSlide?: boolean }

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
  pouch?: number;        // golden pouch index 0..2 (stage only)
  taken: boolean;
  pulled: boolean;       // being magnet-pulled
  seen?: boolean;        // counted into jelliesSeen
  chunk?: number;        // serial of the placed chunk it belongs to
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
  main: boolean;         // part of the course (landing / sky are inserted, not main)
  serial: number;        // unique per placement
  index: number;         // main-course index (−1 for inserted chunks)
  genBefore: GenState | null; // generator state right before this main chunk (to re-place it after a teleport)
  jellyTotal: number; jellyGot: number;
  line: 0 | 1 | 2;       // 한 줄 완성: 0 not eligible · 1 pending · 2 evaluated
}

/** Everything that decides the next main chunk and slot fills — snapshot-able so the course is input-independent. */
export interface GenState {
  mainIndex: number; mainM: number;
  potionDebt: number; powerDebt: number; letterDebt: number;
  potionsPlaced: number; powersPlaced: number; lastPower: PowerKind | null; pouchesPlaced: number;
  recent: string[]; lastUsed: Record<string, number>; recentFam: string[];
  hazardRun: number; calmM: number; setpieceM: number; lastTier: number; courseIdx: number;
}

export interface Level {
  chunks: PlacedChunk[];
  solids: Solid[];       // world coords, append order = x order
  hazards: Hazard[];
  pickups: Pickup[];
  genX: number;          // world x where the next chunk will be placed
  nextId: number;
  serial: number;
  gen: GenState;
  stageLen: number;      // m; 0 = endless
  finishX: number;       // world x of the finish line (stage), else Infinity
  course: string[] | null; // frozen course (stage / tutorial)
  skyPlaced: number;
  warnedSerial: number;  // last chunk for which a speed-up warning was emitted
}

export interface PowerState { giant: number; dash: number; magnet: number; after: number /* post-power grace i-frames */ }

export interface RunStats {
  jellies: number; bigJellies: number; coins: number; potions: number; powers: number; letters: number;
  hits: number; hitsBy: Record<string, number>; falls: number; smashed: number; bonusTimes: number;
  bestStreak: number; skillUses: number; jumps: number; airJumps: number; slides: number;
  jelliesSeen: number;   // jellies that scrolled past (for % collected)
  hpFromPotions: number; drained: number;
  nearMisses: number; maxTier: number; bonusJellies: number;
  lines: number; moonCakes: number; pouches: number; fastFalls: number; maxFlow: number; superBonus: number;
  relayDist: number; miniPotions: number; pitsGuarded: number; shieldsUsed: number;
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
  companionId: string | null;
  assistOpts: AssistOpts;
  assist: boolean;         // any assist option on (records are marked, never punished)
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
  freeze: number;        // steps of relay hand-over freeze
  pouchesGot: number;    // bitmask of golden pouches collected this run
  compT: number;         // companion timer
  pitGuardLeft: number;  // 해돌이: pits that still cost nothing
  relayStartDist: number;
  rewinds: number;       // tutorial replays
  log: number[];         // input log: [step, bits, step, bits, …] (bits: 1 jump press, 2 slide held, 4 jump held)
  lastBits: number;
  dyingT: number;
}

export interface RunInput { jump: boolean; slide: boolean; jumpHeld?: boolean }

export type SimEvent =
  | { t: 'jump'; n: 1 | 2 }
  | { t: 'land' }
  | { t: 'slide' }
  | { t: 'pickup'; type: PickupType; x: number; y: number; value: number; power?: PowerKind; letter?: number; pouch?: number }
  | { t: 'line'; x: number; y: number; value: number }
  | { t: 'fastFall' }
  | { t: 'speedUpSoon'; tier: number }
  | { t: 'rewind'; kind: string }
  | { t: 'drop'; x: number; y: number }
  | { t: 'hit'; kind: string; x: number; y: number; dmg: number; shielded: boolean }
  | { t: 'smash'; kind: string; x: number; y: number }
  | { t: 'power'; kind: PowerKind }
  | { t: 'powerEnd'; kind: PowerKind }
  | { t: 'bonusStart'; super: boolean }
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
