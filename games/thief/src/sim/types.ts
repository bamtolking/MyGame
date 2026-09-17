import type { Rect, Vec } from './geom';
import type { WeaponId } from './constants';
import type { Rng } from './rng';

// ---------- Mission definition (authored data) ----------
export type TileCoord = [number, number]; // [col, row], may be fractional (tile centers)
export type LaserSource = { kind: 'generator'; id: string } | { kind: 'timer'; onSec: number; offSec: number; offsetSec: number };
export type EnemyKind = 'chaser' | 'turret' | 'heavy';

export interface MissionDef {
  id: string; index: number; title: string; subtitle: string; version: number; seed: number; seconds: number;
  grid: string[];
  spawn: TileCoord; exit: TileCoord;
  generators: { id: string; at: TileCoord; lasers: string[] }[];
  lasers: { id: string; from: TileCoord; to: TileCoord; source: LaserSource }[];
  plates: { id: string; at: TileCoord; label: string }[];
  vault: { at: TileCoord; plates: string[]; generators: string[] };
  enemies: { kind: EnemyKind; at: TileCoord; facing?: number }[];
  hints: string[];
  /** Optional design notes shown in the prep screen. */
  tips?: string[];
}

export interface MapData {
  def: MissionDef; width: number; height: number; bounds: Rect; solids: Rect[]; solidGrid: boolean[][]; cols: number; rows: number;
}

// ---------- Recording ----------
export type EndKind = 'finish' | 'death' | 'timeout' | 'escape';
export interface ShotRecord { t: number; x: number; y: number; w: WeaponId; a: number[] }
export interface Recording {
  v: 1; mapId: string; mapVersion: number; weapon: WeaponId; endKind: EndKind; endTick: number;
  /** flat [x0,y0,x1,y1,...] in 0.1px units, one entry per simulated tick */
  pos: number[];
  /** facing in degrees, one per tick */
  face: number[];
  shots: ShotRecord[];
  dashes: number[];
  createdAt: number;
}

// ---------- Per-tick input from the current player ----------
export interface PlayerInput { mx: number; my: number; dash: boolean; interact: boolean; finish: boolean }
export const NO_INPUT: PlayerInput = { mx: 0, my: 0, dash: false, interact: false, finish: false };

// ---------- Runtime state ----------
export type Owner = 'player' | 'ghost' | 'enemy';
export interface Projectile {
  id: number; owner: Owner; ghost: number; x: number; y: number; px: number; py: number; vx: number; vy: number;
  life: number; damage: number; radius: number; weapon: WeaponId | 'turret'; knockback: number;
}
export type EnemyState = 'idle' | 'chase' | 'investigate' | 'return' | 'windup' | 'cooldown';
export interface Enemy {
  id: number; kind: EnemyKind; x: number; y: number; hx: number; hy: number; facing: number; hp: number; maxHp: number; alive: boolean;
  state: EnemyState; stateTicks: number; targetX: number; targetY: number; contactCd: number; attackCd: number; hitFlash: number; kx: number; ky: number;
  lastSeenTicks: number; deathTick: number;
}
export interface Generator { id: string; x: number; y: number; hp: number; maxHp: number; alive: boolean; destroyedBy: string | null; lasers: string[]; hitFlash: number }
export type LaserPhase = 'off' | 'warn' | 'on';
export interface Laser { id: string; rect: Rect; horizontal: boolean; source: LaserSource; phase: LaserPhase; blink: number; generatorId: string | null }
export interface Plate { id: string; x: number; y: number; label: string; pressed: boolean; pressedBy: string[]; wasPressed: boolean }
export interface Vault { x: number; y: number; open: boolean; openTicks: number; corePresent: boolean; plates: string[]; generators: string[] }

export interface Player {
  x: number; y: number; facing: number; hp: number; alive: boolean; deathCause: string | null; hasCore: boolean;
  invuln: number; dashTicks: number; dashCd: number; dashDx: number; dashDy: number; fireCd: number;
  focusGenerator: string | null; targetKind: 'enemy' | 'generator' | null; targetId: number | string | null;
  moving: boolean; recoil: number; hitFlash: number; weapon: WeaponId; vx: number; vy: number; kx: number; ky: number;
  finishedAt: number; steps: number; grab: number;
}
export interface Ghost {
  slot: number; rec: Recording; x: number; y: number; facing: number; present: boolean; holding: boolean; shotCursor: number; dashCursor: number;
  spawnFx: number; lastTick: number; moving: boolean; recoil: number;
}
export interface ActorStats { kills: number; generators: number; damage: number; plateTicks: number; label: string }

export type GameEvent =
  | { kind: 'shot'; owner: Owner; ghost: number; x: number; y: number; weapon: WeaponId | 'turret'; angle: number }
  | { kind: 'hit'; x: number; y: number; target: 'enemy' | 'generator' | 'wall' | 'player'; owner: Owner; ghost: number }
  | { kind: 'enemyDied'; enemyKind: EnemyKind; x: number; y: number; by: string }
  | { kind: 'generatorDestroyed'; id: string; x: number; y: number; by: string; lasers: string[] }
  | { kind: 'laserChanged'; id: string; phase: LaserPhase }
  | { kind: 'plateChanged'; id: string; pressed: boolean; by: string[] }
  | { kind: 'vaultChanged'; open: boolean }
  | { kind: 'corePicked' }
  | { kind: 'playerHit'; cause: string; x: number; y: number }
  | { kind: 'playerDied'; cause: string }
  | { kind: 'dash'; owner: 'player' | 'ghost'; ghost: number; x: number; y: number }
  | { kind: 'ghostSpawn'; ghost: number; x: number; y: number }
  | { kind: 'ghostGone'; ghost: number; endKind: EndKind }
  | { kind: 'ghostHold'; ghost: number }
  | { kind: 'turretWarn'; enemyId: number }
  | { kind: 'heavyWindup'; enemyId: number }
  | { kind: 'timeWarning'; secondsLeft: number }
  | { kind: 'escape' }
  | { kind: 'timeout' }
  | { kind: 'finish' };

export interface Outcome { kind: EndKind; tick: number; cause: string | null }

export interface AttemptState {
  map: MapData; tick: number; maxTicks: number; seed: number; rng: Rng;
  player: Player; ghosts: Ghost[]; enemies: Enemy[]; projectiles: Projectile[];
  generators: Generator[]; lasers: Laser[]; plates: Plate[]; vault: Vault; exit: Vec;
  outcome: Outcome | null; recording: Recording; events: GameEvent[]; nextId: number;
  stats: Record<string, ActorStats>; damageTaken: number;
}

export interface AttemptOptions { weapon: WeaponId; ghosts: (Recording | null)[]; seed?: number; seconds?: number }
