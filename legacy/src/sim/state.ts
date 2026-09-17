import { seedRng } from './rng';
import type { GameState, Unit, UnitKind, Grade, MythicId, UnitLoc, Enemy, RunStats } from './types';
import { SLOTS } from '../data/map';
import { START_GOLD, START_LIFE, BENCH_SIZE } from '../data/economy';
import { UNITS, MYTHICS, GRADE_MULT, GRADE_RANGE_BONUS, EFFECT_BY_GRADE, MECH_AURA_RANGE } from '../data/units';
import { SKILL_COOLDOWN } from '../data/economy';

export const STATE_VERSION = 3;

export function makeRunId(seed: number, now: number): string {
  return `run_${now.toString(36)}_${(seed >>> 0).toString(36)}`;
}

export function newStats(): RunStats {
  return { dmgByUnit: {}, lifeLostBy: {}, killsBy: {}, summons: 0, merges: 0, mythicsMade: [], goldEarned: 0, goldSpent: 0, peakGrade: 0, playTime: 0, bossKills: [], relics: [], legendMade: 0, couriersKilled: 0, extraAccepted: 0 };
}

export function newGame(seed: number, now = Date.now()): GameState {
  const s: GameState = {
    version: STATE_VERSION,
    runId: makeRunId(seed, now),
    seed, rng: seedRng(seed), time: 0,
    phase: 'countdown', countdownT: 3.0, prepT: 0, prepMax: 0,
    wave: 1, waveRt: null,
    life: START_LIFE, maxLife: START_LIFE,
    gold: START_GOLD, shards: 0, cores: 0,
    summonCount: 0, pity: 0, designatedKind: null,
    nextId: 1,
    units: [], slots: SLOTS.map(() => null), bench: Array(BENCH_SIZE).fill(null),
    enemies: [], projectiles: [],
    relics: [], relicOffer: null,
    upgrades: { atk: 0, spd: 0, life: 0 },
    skills: { bomb: 0, freeze: 0 },
    seals: [], extraOffer: null,
    events: [], stats: newStats(), seenEnemies: [], log: [], lastResult: null, rewardClaimed: false,
    difficulty: 'normal',
  };
  // Fixed starting support (not random): 일반 태엽 사수 + 일반 폭죽 너구리 on entrance slots
  const a = createUnit(s, 'archer', 0); placeUnit(s, a, { t: 'f', slot: 1 });
  const r = createUnit(s, 'raccoon', 0); placeUnit(s, r, { t: 'f', slot: 4 });
  return s;
}

export function createUnit(s: GameState, kind: UnitKind, grade: Grade | 4, mythic: MythicId | null = null): Unit {
  const u: Unit = {
    id: s.nextId++, kind, mythic, grade, loc: { t: 'b', idx: -1 }, locked: false, fav: false,
    cd: 0, moveCd: 0, tele: 0, teleX: 0, teleY: 0, pulseT: 0, dmg: 0, kills: 0, bornWave: s.wave, lastShot: -9, lastTargetX: 0, lastTargetY: 0,
  };
  s.units.push(u);
  return u;
}

export function placeUnit(s: GameState, u: Unit, loc: UnitLoc): void {
  if (loc.t === 'f') s.slots[loc.slot] = u.id; else s.bench[loc.idx] = u.id;
  u.loc = loc;
}
export function clearLoc(s: GameState, u: Unit): void {
  if (u.loc.t === 'f') { if (s.slots[u.loc.slot] === u.id) s.slots[u.loc.slot] = null; }
  else if (u.loc.idx >= 0 && s.bench[u.loc.idx] === u.id) s.bench[u.loc.idx] = null;
}
export function removeUnit(s: GameState, u: Unit): void {
  clearLoc(s, u);
  const i = s.units.indexOf(u); if (i >= 0) s.units.splice(i, 1);
}
export function unitById(s: GameState, id: number | null | undefined): Unit | undefined {
  if (id == null) return undefined;
  return s.units.find(u => u.id === id);
}
export function enemyById(s: GameState, id: number): Enemy | undefined { return s.enemies.find(e => e.id === id); }
export function freeSlot(s: GameState): number { return s.slots.findIndex(x => x === null); }
export function freeBench(s: GameState): number { return s.bench.findIndex(x => x === null); }
export function fieldUnits(s: GameState): Unit[] { return s.units.filter(u => u.loc.t === 'f'); }
export function unitPos(u: Unit): [number, number] | null {
  if (u.loc.t !== 'f') return null; const sl = SLOTS[u.loc.slot]; return [sl.x, sl.y];
}
export function unitLabel(u: Unit): string { return u.mythic ? MYTHICS[u.mythic].name : UNITS[u.kind].name; }
export function unitStatKey(u: Unit): string { return u.mythic ? `mythic:${u.mythic}` : `${u.kind}@${u.grade}`; }

/** Derived combat stats for a unit (no buffs). */
export interface UnitStats { atk: number; cd: number; range: number; splash: number; chain: number; slow: number; corroDps: number; pull: number; aura: number; auraRange: number; income: number }
export function baseStats(s: GameState, u: Unit): UnitStats {
  const atkMul = 1 + s.upgrades.atk * 0.06;
  if (u.mythic) {
    const m = MYTHICS[u.mythic];
    return { atk: m.atk * atkMul, cd: m.cd, range: m.range, splash: u.mythic === 'sun' ? 75 : 0, chain: u.mythic === 'storm' ? 8 : 0, slow: u.mythic === 'chrono' ? 0.35 : 0, corroDps: 0, pull: 0, aura: u.mythic === 'chrono' ? 0.30 : 0, auraRange: 100, income: u.mythic === 'colossus' ? 10 : 0 };
  }
  const d = UNITS[u.kind]; const g = u.grade as Grade;
  let auraRange = MECH_AURA_RANGE; let aura = d.aura ? EFFECT_BY_GRADE.aura[g] : 0;
  if (d.aura && s.relics.includes('overcharger')) { auraRange = 135; aura = Math.max(0.05, aura - 0.05); }
  return {
    atk: d.atk * GRADE_MULT[g] * atkMul, cd: d.cd, range: d.range + GRADE_RANGE_BONUS[g],
    splash: d.splash ? EFFECT_BY_GRADE.splash[g] : 0, chain: d.chain ? EFFECT_BY_GRADE.chain[g] : 0,
    slow: d.slow ? EFFECT_BY_GRADE.slow[g] : 0, corroDps: d.corroDps ? EFFECT_BY_GRADE.corroDps[g] : 0,
    pull: d.pull ? EFFECT_BY_GRADE.pull[g] + (s.relics.includes('magnetic_storm') ? 20 : 0) : 0,
    aura, auraRange, income: d.income ? EFFECT_BY_GRADE.income[g] : 0,
  };
}

export function skillCooldownMax(s: GameState, k: 'bomb' | 'freeze'): number {
  return SKILL_COOLDOWN[k] * (s.relics.includes('field_manual') ? 0.7 : 1);
}

export function pushLog(s: GameState, text: string, kind: 'info' | 'warn' | 'good' = 'info'): void {
  s.log.push(text); if (s.log.length > 30) s.log.shift();
  s.events.push({ t: 'msg', text, kind });
}
