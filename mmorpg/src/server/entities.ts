import type { Profile, Stats } from '../shared/types.ts';
import type { MonsterDef } from '../shared/data/monsters.ts';
import type { Ev } from '../shared/protocol.ts';

export interface InputStep { s: number; x: number; y: number }

export interface Player {
  id: number; token: string; prof: Profile; stats: Stats; bot: boolean;
  x: number; y: number; face: number; moving: boolean; ix: number; iy: number;
  hp: number; shield: number; shieldT: number;
  down: boolean; downT: number; reviveP: number; safeT: number;
  inputs: InputStep[]; lastSeq: number; inBudget: number;
  atkT: number; cds: number[]; bladeHits: Map<number, number>; auraT: number; lastAtkT: number;
  ult: number; ultT: number; ultTick: number;
  /** Musician ult buff: seconds left and bonus attack speed. */
  buffT: number; buffAspd: number; clsT: number;
  lastHurtT: number; hurtFlagT: number;
  zone: number; wbDmg: number; wbT: number;
  invVer: number; talVer: number; questVer: number; statVer: number;
  priv: Ev[]; dmgAcc: Map<number, [number, number]>;
  chatT: number; actT: number; actBudget: number; tpT: number;
  surgeT: number; saveT: number; joinedT: number; online: boolean; lastHitBy: string; auto: boolean; volleys: Map<number, number>;
}

export interface BossState { patT: number; seq: number; enraged: boolean; castT: number; cast: string; scale: number; summons: number; hideT: number; dashT: number; dvx: number; dvy: number; engagedT: number }

export interface Monster {
  id: number; t: number; def: MonsterDef; x: number; y: number; vx: number; vy: number;
  hp: number; maxHp: number; lv: number; elite: boolean; r: number; dmg: number;
  st: 'idle' | 'chase' | 'wind' | 'dash' | 'recover' | 'cast' | 'flee'; stT: number;
  tgt: number; retT: number; atkT: number; slowT: number; slowMul: number; stunT: number; hitT: number;
  hx: number; hy: number; farT: number; left: boolean; lifeT: number;
  contrib: Map<number, number>; boss: BossState | null; summon: boolean; dead: boolean;
  dvx: number; dvy: number; lairIdx: number;
}

export interface Hazard { tag?: string; due: number; sh: 0 | 1; x: number; y: number; r: number; x2: number; y2: number; w: number; dmg: number; pct: number; src: number; hit?: (p: Player) => void }
export interface EProj { tag?: string; vid: number; x: number; y: number; vx: number; vy: number; r: number; life: number; dmg: number; pct: number }
export interface Sched { due: number; fn: () => void }
export interface WorldEvent { ev: Ev; x: number; y: number; all?: boolean }
