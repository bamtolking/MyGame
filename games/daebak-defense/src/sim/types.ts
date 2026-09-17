import type { RngState } from './rng';

export type Grade = 0 | 1 | 2 | 3; // 일반, 희귀, 영웅, 전설
export const GRADE_NAMES = ['일반', '희귀', '영웅', '전설', '신화'] as const;
export type UnitKind = 'archer' | 'raccoon' | 'penguin' | 'rabbit' | 'mushroom' | 'bear' | 'mechanic' | 'toad';
export type MythicId = 'storm' | 'sun' | 'chrono' | 'colossus';
export type EnemyType = 'wisp' | 'fox' | 'tortoise' | 'troll' | 'slime' | 'slimelet' | 'ghost' | 'caster' | 'ogre' | 'courier'
  | 'boss_flag' | 'boss_cart' | 'boss_thief' | 'boss_king';

export type UnitLoc = { t: 'f'; slot: number } | { t: 'b'; idx: number };

export interface Unit {
  id: number;
  kind: UnitKind;          // base kind (for mythic: the recipe's flavor kind, unused)
  mythic: MythicId | null;
  grade: Grade | 4;        // 4 = mythic
  loc: UnitLoc;
  locked: boolean;
  fav: boolean;
  cd: number;              // remaining attack cooldown (s)
  moveCd: number;          // remaining relocation cooldown (s)
  tele: number;            // telegraph timer for delayed attacks (sun cannon), 0 = none
  teleX: number; teleY: number;
  pulseT: number;          // colossus shockwave timer
  dmg: number;             // damage dealt (stat)
  kills: number;
  bornWave: number;
  lastShot: number;        // sim time of last attack (visual)
  lastTargetX: number; lastTargetY: number;
}

export interface Enemy {
  id: number;
  type: EnemyType;
  hp: number; maxHp: number;
  shield: number; maxShield: number;
  progress: number;        // distance along path
  baseSpeed: number;
  armor: number;           // base armor fraction 0..0.9
  slowAmt: number; slowT: number;      // strongest slow (fraction), remaining time
  corro: number; corroT: number; corroDps: number; // corrosion stacks (max 3)
  shockT: number;          // 전도 marker time (set by lightning on slowed target)
  pullCd: number;          // resistance to repeated pulls
  freezeT: number; freezeResist: number;
  weakT: number; weakAmt: number;
  pulledT: number;         // recently pulled (magnetic storm bonus)
  corroSrc: number; burnSrc: number; hasteMul: number;
  sinceHit: number;        // time since last damage (regen)
  burnT: number; burnDps: number;
  alive: boolean;
  reward: number;
  exitDmg: number;
  wave: number;
  isBoss: boolean;
  // boss state
  bossPhase: number;
  bossT: number;           // generic pattern timer
  bossStance: number;      // 0 = 방어, 1 = 취약 (cart / king)
  escortIds: number[];
  vulnT: number;           // 약화(취약) remaining
  hasteT: number;          // speed burst remaining
  casterT: number;         // support caster timer
  escortOf: number;        // parent boss id for escorts (buff), -1 none
  spawnDelay: number;      // for split children pop animation (visual)
  eventTag: string;        // 'courier' | 'extra' | ''
  x: number; y: number;    // cached position
}

export interface Projectile {
  id: number;
  kind: 'arrow' | 'cracker' | 'shard' | 'glob' | 'coin' | 'bolt' | 'sunshell' | 'skill_bomb' | 'skill_freeze';
  x: number; y: number;
  sx: number; sy: number;  // start
  tx: number; ty: number;  // target point
  targetId: number;        // -1 for ground
  t: number;               // 0..1 for lobbed, else unused
  dur: number;             // flight duration (lobbed)
  speed: number;           // for homing
  dmg: number;
  src: number;             // unit id or -1
  grade: number;
  radius: number;          // splash radius
  fx: number;              // extra param (slow amount / corrosion dps / etc.)
  fired: number;
}

export interface WaveRuntime {
  index: number;               // 1-based
  spawnQueue: { at: number; type: EnemyType; hpMul: number; tag: string }[];
  spawnT: number;              // time since wave start
  spawned: number;
  remaining: number;           // alive enemies of this wave
  extraAccepted: boolean;
  startedAt: number;
  overheatSlots: number[];     // 공방 과열 slots for this wave
  overheatT: number;           // remaining warn/active time
  courierAlive: boolean;
}

export type Phase = 'countdown' | 'prep' | 'wave' | 'relic' | 'won' | 'lost';

export interface RunStats {
  dmgByUnit: Record<string, number>;   // key: kind@grade or mythic id
  lifeLostBy: Record<string, number>;  // enemy type -> life lost
  killsBy: Record<string, number>;     // enemy type -> kills
  summons: number;
  merges: number;
  mythicsMade: string[];
  goldEarned: number;
  goldSpent: number;
  peakGrade: number;
  playTime: number;
  bossKills: number[];
  relics: string[];
  legendMade: number;
  couriersKilled: number;
  extraAccepted: number;
}

export interface SealState { slot: number; warnT: number; sealT: number }

export interface GameState {
  version: number;
  runId: string;
  seed: number;
  rng: RngState;
  time: number;
  phase: Phase;
  countdownT: number;
  prepT: number;
  prepMax: number;
  wave: number;            // current wave index (1..40); during prep, the NEXT wave index
  waveRt: WaveRuntime | null;
  life: number; maxLife: number;
  gold: number;
  shards: number;          // 운명 조각
  cores: number;           // 공방 핵
  summonCount: number;
  pity: number;            // consecutive sub-hero results
  designatedKind: UnitKind | null;
  nextId: number;
  units: Unit[];
  slots: (number | null)[];   // unit ids
  bench: (number | null)[];
  enemies: Enemy[];
  projectiles: Projectile[];
  relics: string[];
  relicOffer: string[] | null;
  upgrades: { atk: number; spd: number; life: number };
  skills: { bomb: number; freeze: number }; // remaining cooldown
  seals: SealState[];
  extraOffer: { wave: number; open: boolean; decided: boolean } | null;
  events: SimEvent[];      // transient events for renderer/audio (drained each frame)
  stats: RunStats;
  seenEnemies: string[];
  log: string[];           // recent short log (for HUD messages)
  lastResult: SummonResult | null;
  rewardClaimed: boolean;
  difficulty: 'normal';
}

export interface SummonResult { grade: Grade; kind: UnitKind; pityUsed: boolean; designated: boolean; unitId: number }

export type SimEvent =
  | { t: 'shoot'; unit: number; kind: string; x: number; y: number; tx: number; ty: number; grade: number }
  | { t: 'hit'; x: number; y: number; kind: string; dmg: number; enemy: number; crit?: boolean }
  | { t: 'explode'; x: number; y: number; r: number; kind: string }
  | { t: 'chain'; pts: number[]; conducted: boolean; grade: number }
  | { t: 'die'; x: number; y: number; type: EnemyType; boss: boolean }
  | { t: 'exit'; x: number; y: number; dmg: number }
  | { t: 'summon'; unit: number; grade: number }
  | { t: 'merge'; unit: number; grade: number; x: number; y: number }
  | { t: 'mythic'; unit: number; id: MythicId; x: number; y: number }
  | { t: 'pull'; from: number[]; x: number; y: number }
  | { t: 'wave'; index: number }
  | { t: 'boss'; type: EnemyType }
  | { t: 'msg'; text: string; kind?: 'info' | 'warn' | 'good' }
  | { t: 'relic'; id: string }
  | { t: 'skill'; kind: 'bomb' | 'freeze'; x: number; y: number; r: number }
  | { t: 'seal'; slot: number; phase: 'warn' | 'seal' }
  | { t: 'gold'; x: number; y: number; amount: number }
  | { t: 'shock'; x: number; y: number }
  | { t: 'won' } | { t: 'lost' } | { t: 'levelup' };
