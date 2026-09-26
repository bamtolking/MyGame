// Wire protocol. Client→server: small JSON messages. Server→client: binary snapshots (10 Hz) + JSON messages.
import type { ClassId, MeState, RosterEntry, TalKind, GearSlot } from './types.ts';
import type { WireMap } from './map.ts';
import { POS_Q } from './constants.ts';

export type C2S =
  | { t: 'hello'; v: number; token: string; name: string; cls: ClassId }
  | { t: 'i'; s: number; x: number; y: number }
  | { t: 'ult' }
  | { t: 'cls'; cls: ClassId }
  | { t: 'equip'; uid: number }
  | { t: 'unequip'; slot: GearSlot }
  | { t: 'sell'; uids: number[] }
  | { t: 'enhance'; uid: number }
  | { t: 'talslot'; slot: number; uid: number | null }
  | { t: 'merge'; uid: number }
  | { t: 'buytal'; kind?: TalKind }
  | { t: 'sellTal'; uid: number }
  | { t: 'respawn' }
  | { t: 'tp'; shrine: number }
  | { t: 'chat'; text: string }
  | { t: 'emote'; e: number }
  | { t: 'autosell'; r: number }
  | { t: 'auto'; on: boolean }
  | { t: 'ping'; n: number };

export type Ev =
  | { k: 'atk'; p: number; tx: number; ty: number; tid?: number; pts?: number[] }
  | { k: 'tal'; p: number; tk: number; x: number; y: number; tx?: number; ty?: number; pts?: number[]; n?: number; r?: number }
  | { k: 'ult'; p: number; x: number; y: number; tx?: number; ty?: number }
  /** A timed sub-hit of an ultimate (a thrust, a lightning strike, a rocket, a tiger dash): at (x, y), optionally to (x2, y2). */
  | { k: 'uhit'; p: number; x: number; y: number; x2?: number; y2?: number }
  /** Class change in town. */
  | { k: 'cls'; p: number; c: ClassId }
  /** A new class became available to this player (private). */
  | { k: 'unlock'; c: ClassId }
  | { k: 'dmg'; id: number; v: number; cr?: 1; big?: 1 }
  | { k: 'hurt'; v: number }
  | { k: 'die'; id: number; t: number; x: number; y: number; el?: 1 }
  | { k: 'proj'; x: number; y: number; vx: number; vy: number; r: number; life: number; s: number }
  | { k: 'tele'; sh: 0 | 1; x: number; y: number; r: number; x2?: number; y2?: number; d: number; s?: number }
  | { k: 'boom'; x: number; y: number; r: number; s: number }
  | { k: 'loot'; x: number; y: number; g: number; xp: number; it?: number; tl?: number; sh?: number }
  | { k: 'lvl'; p: number; l: number }
  | { k: 'heal'; p: number; v: number }
  | { k: 'shield'; p: number }
  | { k: 'down'; p: number }
  | { k: 'rev'; p: number; by: number }
  | { k: 'mon'; id: number; a: 'wind' | 'dash' | 'roar' | 'blink' | 'summon'; x?: number; y?: number; tx?: number; ty?: number }
  | { k: 'emote'; p: number; e: number }
  | { k: 'quest'; title: string; done: 1 }
  | { k: 'toast'; text: string; c?: string };

export interface BossInfo { id: number; type: number; hp: number; maxHp: number; enr?: 1 }
export interface WorldBossState { state: 'idle' | 'warn' | 'fight'; t: number; top?: { name: string; dmg: number }[]; myDmg?: number }

export type S2C =
  | { t: 'welcome'; id: number; channel: number; tick: number; map: WireMap; roster: RosterEntry[]; me: MeState; online: boolean; server: string; wb: WorldBossState }
  | { t: 'me'; d: Partial<MeState> }
  | { t: 'ev'; tick: number; e: Ev[] }
  | { t: 'roster'; add?: RosterEntry[]; del?: number[] }
  | { t: 'chat'; id: number; name: string; text: string; sys?: 1 }
  | { t: 'ann'; text: string; kind: 'info' | 'boss' | 'legend' | 'event' }
  | { t: 'boss'; b: BossInfo | null }
  | { t: 'wb'; w: WorldBossState }
  | { t: 'pong'; n: number; tick: number }
  | { t: 'err'; msg: string; fatal?: 1 };

// ---- binary snapshot ----
export const SNAP = 1;
export const PF = { DOWN: 1, SHIELD: 2, WHIRL: 4, MOVING: 8, SAFE: 16, BOT: 32, REVIVING: 64, HURT: 128 } as const;
export const MF = { ELITE: 1, SLOW: 2, WIND: 4, DASH: 8, LEFT: 16, HIT: 32, CAST: 64, HIDE: 128 } as const;
export interface SnapPlayer { id: number; x: number; y: number; hp: number; f: number; face: number }
export interface SnapMon { id: number; t: number; x: number; y: number; hp: number; f: number }
export interface Snapshot { tick: number; ack: number; players: SnapPlayer[]; mons: SnapMon[] }

const qp = (v: number) => Math.max(0, Math.min(65535, Math.round(v * POS_Q)));
export function encodeSnap(tick: number, ack: number, players: SnapPlayer[], mons: SnapMon[]): Uint8Array {
  const buf = new ArrayBuffer(1 + 4 + 2 + 2 + players.length * 9 + 2 + mons.length * 9);
  const v = new DataView(buf); let o = 0;
  v.setUint8(o, SNAP); o += 1; v.setUint32(o, tick >>> 0); o += 4; v.setUint16(o, ack & 0xffff); o += 2;
  v.setUint16(o, players.length); o += 2;
  for (const p of players) { v.setUint16(o, p.id); v.setUint16(o + 2, qp(p.x)); v.setUint16(o + 4, qp(p.y)); v.setUint8(o + 6, p.hp); v.setUint8(o + 7, p.f); v.setUint8(o + 8, p.face); o += 9; }
  v.setUint16(o, mons.length); o += 2;
  for (const m of mons) { v.setUint16(o, m.id); v.setUint8(o + 2, m.t); v.setUint16(o + 3, qp(m.x)); v.setUint16(o + 5, qp(m.y)); v.setUint8(o + 7, m.hp); v.setUint8(o + 8, m.f); o += 9; }
  return new Uint8Array(buf);
}
export function decodeSnap(data: ArrayBuffer | Uint8Array): Snapshot {
  const u = data instanceof Uint8Array ? data : new Uint8Array(data);
  const v = new DataView(u.buffer, u.byteOffset, u.byteLength); let o = 1;
  const tick = v.getUint32(o); o += 4; const ack = v.getUint16(o); o += 2;
  const np = v.getUint16(o); o += 2; const players: SnapPlayer[] = new Array(np);
  for (let i = 0; i < np; i++) { players[i] = { id: v.getUint16(o), x: v.getUint16(o + 2) / POS_Q, y: v.getUint16(o + 4) / POS_Q, hp: v.getUint8(o + 6), f: v.getUint8(o + 7), face: v.getUint8(o + 8) }; o += 9; }
  const nm = v.getUint16(o); o += 2; const mons: SnapMon[] = new Array(nm);
  for (let i = 0; i < nm; i++) { mons[i] = { id: v.getUint16(o), t: v.getUint8(o + 2), x: v.getUint16(o + 3) / POS_Q, y: v.getUint16(o + 5) / POS_Q, hp: v.getUint8(o + 7), f: v.getUint8(o + 8) }; o += 9; }
  return { tick, ack, players, mons };
}
export const EMOTES = ['👍', 'ㅋㅋ', '도와줘!', '고마워', '가자!', '❤️', '😭', '🔥'];
