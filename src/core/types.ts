export type Team = 0 | 1;
export type FactionId = 'iron' | 'gale';
export type Tier = 1 | 2 | 3;
export type Layer = 'ground' | 'air';
export type TargetMode = 'ground' | 'air' | 'both';

/** Defensive tags: what a unit *is* (used by attacker bonuses). */
export type ArmorTag = 'light' | 'medium' | 'armored' | 'mechanical' | 'biological' | 'structure';
/** Role tags: used for AI analysis, flanker targeting and result tips. */
export type RoleTag =
  | 'tank'
  | 'ranged'
  | 'aoe'
  | 'antiarmor'
  | 'antiair'
  | 'support'
  | 'artillery'
  | 'flanker'
  | 'air';

export type AttackKind =
  | 'hitscan' // instant, visual tracer (rifles)
  | 'projectile' // homing shell to target
  | 'arc' // ballistic to a ground position, AoE on impact
  | 'cone' // instant cone AoE in facing direction
  | 'bomb' // dropped from above onto target position, AoE
  | 'beam'; // instant line, pierces

export interface WeaponDef {
  kind: AttackKind;
  targets: TargetMode;
  dmg: number;
  /** total attack cycle seconds (windup + recover + cooldown) */
  cycle: number;
  windup: number;
  recover: number;
  range: number;
  minRange?: number;
  /** AoE radius for arc/bomb/projectile splash */
  aoe?: number;
  /** cone half-angle in radians (cone kind) */
  coneHalf?: number;
  /** projectile speed (world units/s) */
  projSpeed?: number;
  /** number of shots in a burst (hitscan) and interval */
  burst?: number;
  burstGap?: number;
  /** damage multipliers vs armor tags */
  bonus?: Partial<Record<ArmorTag, number>>;
  /** multiplier applied when the target is air / ground (specialists) */
  vsAir?: number;
  vsGround?: number;
  /** beam: extra pierce targets and their damage fraction */
  pierce?: number;
  pierceFrac?: number;
  /** slow applied on hit (fraction, seconds) */
  slow?: { factor: number; duration: number };
  /** prefer air targets when available */
  preferAir?: boolean;
}

export interface AbilityDef {
  kind: 'repair' | 'shield';
  /** hp per second (repair) or shield amount (shield) */
  amount: number;
  range: number;
  /** total budget per unit life */
  pool: number;
  /** max simultaneous sources on the same target (repair) */
  stackCap?: number;
  /** shield: seconds between pulses, targets per pulse, shield duration */
  interval?: number;
  maxTargets?: number;
  duration?: number;
}

export interface UnitDef {
  id: string;
  faction: FactionId;
  name: string;
  short: string;
  cost: number;
  pop: number;
  tier: Tier;
  hp: number;
  armor: number;
  speed: number;
  radius: number;
  layer: Layer;
  armorTags: ArmorTag[];
  roles: RoleTag[];
  weapon?: WeaponDef;
  ability?: AbilityDef;
  /** ranged units that back away from melee attackers (hit-and-run) */
  kite?: boolean;
  /** movement behaviour */
  behavior: 'assault' | 'ranged' | 'artillery' | 'support' | 'flank' | 'interceptor' | 'bomber';
  strengths: string;
  weaknesses: string;
  desc: string;
}

export interface FactionDef {
  id: FactionId;
  name: string;
  tagline: string;
  desc: string;
  units: string[];
}

export interface Vec2 {
  x: number;
  y: number;
}
