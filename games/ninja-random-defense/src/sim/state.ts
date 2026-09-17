import type { GameState, Unit, Mode, Kind, Grade } from './types.ts';
import { rngCreate } from './rng.ts';
import { SLOT_COUNT } from '../data/board.ts';
import { START_GOLD, ATK_PER_LV, COUNTDOWN } from '../data/economy.ts';
import { unitStats, unitName } from '../data/units.ts';

export const STATE_VERSION = 1;

export function newGame(seed: number, mode: Mode = 'solo', gold = START_GOLD): GameState {
  return {
    version: STATE_VERSION, seed, rng: rngCreate(seed), mode,
    time: 0, phase: 'countdown', countdownT: COUNTDOWN,
    round: 0, roundT: 0, roundStartedAt: 0, spawnQueue: [],
    gold, summonLv: 1, atkLv: 0,
    units: [], slots: new Array(SLOT_COUNT).fill(null), monsters: [], nextId: 1,
    bossId: null, bossDeadline: null, bossRound: 0,
    eliminatedReason: '', eliminatedRound: 0,
    stats: { kills: 0, bossKills: 0, damage: 0, summons: 0, merges: 0, crafts: 0, goldEarned: 0, goldSpent: 0, goldSent: 0, goldReceived: 0, peakGrade: 0, mythics: [], roundReached: 0, playTime: 0, gradeCount: [0, 0, 0, 0, 0] },
    events: [], log: [],
  };
}

export function atkMul(s: GameState): number { return 1 + ATK_PER_LV * s.atkLv; }
export function statsOf(s: GameState, u: Unit) { return unitStats(u.kind, u.grade, atkMul(s)); }
export function unitById(s: GameState, id: number | null | undefined): Unit | undefined { return id == null ? undefined : s.units.find(u => u.id === id); }
export function unitAtSlot(s: GameState, slot: number): Unit | undefined { const id = s.slots[slot]; return id == null ? undefined : unitById(s, id); }
export function freeSlot(s: GameState): number { return s.slots.findIndex(x => x == null); }
export function freeSlotCount(s: GameState): number { return s.slots.filter(x => x == null).length; }
export function label(u: Unit): string { return unitName(u.kind, u.grade); }
export function isAlive(s: GameState): boolean { return s.phase === 'countdown' || s.phase === 'playing'; }
export function aliveMonsters(s: GameState): number { let n = 0; for (const m of s.monsters) if (m.alive) n++; return n; }

export function createUnit(s: GameState, kind: Kind, grade: Grade, slot: number): Unit {
  const u: Unit = { id: s.nextId++, kind, grade, slot, cd: 0.2, dmg: 0, kills: 0, born: s.round, lastShot: -9 };
  s.units.push(u); s.slots[slot] = u.id;
  if (grade > s.stats.peakGrade) s.stats.peakGrade = grade;
  return u;
}
export function removeUnit(s: GameState, u: Unit): void {
  const i = s.units.indexOf(u); if (i >= 0) s.units.splice(i, 1);
  if (s.slots[u.slot] === u.id) s.slots[u.slot] = null;
}
export function pushLog(s: GameState, text: string, kind: 'info' | 'good' | 'warn' | 'bad' = 'info'): void {
  s.log.push({ text, kind, time: s.time }); if (s.log.length > 60) s.log.shift();
}
