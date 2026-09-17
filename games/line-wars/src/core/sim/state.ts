import type { Team, FactionId, Layer } from '../types.ts';

export type AiLevel = 'easy' | 'normal' | 'hard' | 'tutorial' | 'script';
export type MatchMode = '1v1' | '3v3' | 'practice';
export type Phase = 'setup' | 'countdown' | 'battle' | 'ended';

export interface RosterEntry {
  unitId: string;
  /** true once included in any dispatch snapshot -> cancel no longer allowed */
  dispatched: boolean;
}

export interface WaveRecord {
  idx: number;
  t: number;
  counts: Record<string, number>;
  value: number;
}

export interface Upgrades {
  attack: number;
  defense: number;
  support: number;
}

export interface Player {
  index: number;
  team: Team;
  slot: number; // position within team (0..2)
  faction: FactionId;
  name: string;
  isHuman: boolean;
  ai: AiLevel | null;
  credits: number;
  econLevel: number;
  tech: 1 | 2 | 3;
  upgrades: Upgrades;
  roster: (RosterEntry | null)[];
  nextDispatchAt: number;
  interval: number;
  waveCount: number;
  waves: WaveRecord[];
  /** how much has been bought / spent (stats) */
  spent: { units: number; econ: number; tech: number; upgrades: number; refunds: number };
  /** ally requests (team mode) */
  request: 'antiair' | 'frontline' | 'economy' | null;
  requestAt: number;
  aiState: Record<string, unknown>;
}

export type AttackPhase = 'idle' | 'windup' | 'recover';
export type MoveState = 'advance' | 'engage' | 'hold' | 'retreat' | 'lane' | 'dive';

export interface Unit {
  id: number;
  team: Team;
  owner: number;
  type: string;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  laneY: number;
  facing: number;
  hp: number;
  maxHp: number;
  armor: number;
  shield: number;
  shieldUntil: number;
  atkMult: number;
  supMult: number;
  layer: Layer;
  targetId: number; // >0 unit id, <0 building (-id), 0 none
  retargetT: number;
  move: MoveState;
  phase: AttackPhase;
  phaseT: number;
  cooldown: number;
  burstLeft: number;
  burstT: number;
  slowUntil: number;
  slowFactor: number;
  pool: number; // ability budget
  abilityT: number;
  flankLane: number; // 0 none, 1 top, 2 bottom
  stuckT: number;
  jitterT: number;
  jitterDir: number;
  sx: number; // stuck ref pos
  sy: number;
  wave: number;
  bornAt: number;
  dead: boolean;
  anim: number; // distance travelled (wheel/leg animation)
  flash: number; // hit flash timer (render-only, harmless in sim)
}

export interface Projectile {
  id: number;
  kind: 'shell' | 'arc' | 'bomb' | 'flak';
  team: Team;
  owner: number;
  ownerUnit: number;
  unitType: string;
  x: number;
  y: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  targetId: number;
  speed: number;
  t: number; // elapsed
  dur: number; // total flight time (arc/bomb)
  dmg: number;
  aoe: number;
  atkMult: number;
  dead: boolean;
}

export interface Building {
  id: number;
  team: Team;
  kind: 'core' | 'outpost';
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  armor: number;
  turret: { dmg: number; cycle: number; range: number };
  cooldown: number;
  targetId: number;
  facing: number;
  alive: boolean;
}

export interface Relay {
  progress: number; // -1..1 (team0 positive)
  owner: -1 | 0 | 1;
  contested: boolean;
  presence: [number, number];
}

export interface CannonState {
  used: boolean;
  pending: { x: number; y: number; at: number } | null;
}

export interface UnitTypeStats {
  dealt: number;
  taken: number;
  healed: number;
  shielded: number;
  kills: number;
  deaths: number;
  bought: number;
  spent: number;
}

export interface PlayerStats {
  byType: Record<string, UnitTypeStats>;
  buildingDamage: number;
}

export interface MatchResult {
  winner: -1 | 0 | 1;
  reason: 'core' | 'time' | 'draw-simul' | 'draw-time';
  t: number;
}

export type SimEvent =
  | { kind: 'shot'; x: number; y: number; tx: number; ty: number; unitType: string; team: Team; targetLayer: Layer }
  | { kind: 'hit'; x: number; y: number; amount: number; targetId: number; shield: boolean }
  | { kind: 'explosion'; x: number; y: number; r: number; power: number; team: Team }
  | { kind: 'death'; x: number; y: number; unitType: string; team: Team; layer: Layer }
  | { kind: 'spawn'; x: number; y: number; unitId: number }
  | { kind: 'dispatch'; player: number; count: number; t: number }
  | { kind: 'buildingDestroyed'; x: number; y: number; team: Team; building: 'core' | 'outpost' }
  | { kind: 'cannonWarn'; x: number; y: number; team: Team }
  | { kind: 'cannonFire'; x: number; y: number; team: Team }
  | { kind: 'relay'; owner: -1 | 0 | 1 }
  | { kind: 'repair'; x: number; y: number; tx: number; ty: number }
  | { kind: 'shieldOn'; x: number; y: number }
  | { kind: 'beam'; x: number; y: number; tx: number; ty: number; team: Team }
  | { kind: 'overtime'; mult: number }
  | { kind: 'ended'; result: MatchResult };

export interface MatchState {
  version: number;
  mode: MatchMode;
  seed: number;
  rngState: number;
  phase: Phase;
  phaseT: number; // seconds left in setup/countdown
  t: number;
  tick: number;
  players: Player[];
  units: Unit[];
  projectiles: Projectile[];
  buildings: Building[];
  relay: Relay;
  cannon: [CannonState, CannonState];
  overtimeMult: number;
  overtimeNext: number;
  result: MatchResult | null;
  nextId: number;
  stats: PlayerStats[];
  /** Fixed spending per team so AI cannot cheat: purely informative */
  paused: boolean;
  humanPlayer: number;
  tutorial: boolean;
}

export const SAVE_VERSION = 3;
