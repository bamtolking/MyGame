import { seedRng, rngNext } from './rng';
import type { GameState, Unit, Enemy, RunStats, Status } from './types';
import type { UnitKind, Grade } from '../data/units';
import type { EnemyKind } from '../data/enemies';
import { ENEMIES } from '../data/enemies';
import type { MapId } from '../data/maps';
import { mapSlots, pathGeo, posAt } from '../data/maps';
import type { Difficulty } from '../data/waves';
import { DIFF } from '../data/waves';
import { START_GOLD, START_LIFE, PREP_FIRST } from '../data/economy';
import { GRADE_INVEST } from '../data/units';
import { rollOffer } from './offer';

export const STATE_VERSION = 1;

export function makeRunId(seed: number, now: number): string { return `run_${now.toString(36)}_${(seed >>> 0).toString(36)}`; }

export function newStats(): RunStats {
  return { dmgByKind: {}, kills: 0, combos: {}, summons: 0, merges: 0, sells: 0, goldEarned: 0, goldSpent: 0, playTime: 0, lifeLostBy: {}, peakGrade: 1, bossKills: [], refreshes: 0 };
}

export interface NewGameOpts { mapId: MapId; difficulty: Difficulty; seed: number; now?: number; tutorial?: boolean }
export function newGame(o: NewGameOpts): GameState {
  const s: GameState = {
    version: STATE_VERSION, runId: makeRunId(o.seed, o.now ?? Date.now()), mapId: o.mapId, difficulty: o.difficulty,
    seed: o.seed, rng: seedRng(o.seed), time: 0,
    phase: 'prep', wave: 1, prepT: PREP_FIRST, prepMax: PREP_FIRST, waveRt: null,
    life: START_LIFE, maxLife: START_LIFE, gold: START_GOLD,
    nextId: 1, units: [], slots: mapSlots(o.mapId).map(() => null),
    enemies: [], projectiles: [],
    offer: [], refreshFree: 2, refreshCount: 0, offerSerial: 0,
    combosSeen: [], events: [], stats: newStats(), log: [], rewardClaimed: false, tutorial: !!o.tutorial,
  };
  s.offer = rollOffer(s);
  return s;
}

export function createUnit(s: GameState, kind: UnitKind, grade: Grade, slot: number): Unit {
  const u: Unit = { id: s.nextId++, kind, grade, slot, invested: GRADE_INVEST[grade], cd: 0, moveCd: 0, charge: 0, overcharged: false, boost: 1, pulseT: 0, fireVortexT: 0, fireVortexCd: 0, pullT: 0, facing: -Math.PI / 2, kills: 0, dmg: 0, bornWave: s.wave };
  s.units.push(u); s.slots[slot] = u.id; return u;
}
export function removeUnit(s: GameState, u: Unit): void {
  if (s.slots[u.slot] === u.id) s.slots[u.slot] = null;
  const i = s.units.indexOf(u); if (i >= 0) s.units.splice(i, 1);
}
export function unitById(s: GameState, id: number | null | undefined): Unit | undefined { if (id == null) return undefined; return s.units.find(u => u.id === id); }
export function unitPos(s: GameState, u: Unit): [number, number] { const sl = mapSlots(s.mapId)[u.slot]; return [sl.x, sl.y]; }
export function enemyById(s: GameState, id: number): Enemy | undefined { const e = s.enemies.find(e => e.id === id); return e && e.alive ? e : undefined; }

export function emptyStatus(): Status { return { oil: 0, burn: 0, burnDps: 0, chill: 0, chillPct: 0, frozen: 0, freezeImmune: 0, mark: 0, shield: 0, shieldT: 0, igniteCd: 0, shardCd: 0, bossSlow: 0, bossSlowT: 0 }; }

export function spawnEnemy(s: GameState, kind: EnemyKind, hpMul: number, dist = 0, spawnedBy: number | null = null): Enemy {
  const d = ENEMIES[kind]; const diff = DIFF[s.difficulty];
  // 보스는 난이도 체력 배율을 절반만 적용(대신 패턴 빈도·부하 수가 늘어남)
  const hp = Math.round(d.hp * (d.boss ? 1 + (diff.hpMul - 1) * 0.5 : hpMul * diff.hpMul));
  const g = pathGeo(s.mapId); const [x, y] = posAt(g, dist);
  const e: Enemy = { id: s.nextId++, kind, hp, maxHp: hp, dist, speed: d.speed * diff.speedMul, x, y, alive: true, reward: Math.round(d.reward * diff.rewardMul), armor: d.armor, lifeDmg: d.lifeDmg, st: emptyStatus(), droneT: 1.5, wave: s.wave, spawnedBy, boss: d.boss ? { enraged: false, shieldTimer: 0, hasteTimer: 0, hasteT: 0, minionsDone: 0, telegraph: null } : null, pullBy: null, dotAcc: 0, dotT: 0 };
  s.enemies.push(e); return e;
}

export function pushLog(s: GameState, text: string, kind: 'info' | 'warn' | 'good' = 'info'): void {
  s.log.push(text); if (s.log.length > 40) s.log.shift();
  s.events.push({ t: 'msg', text, kind });
}
export function rand(s: GameState): number { return rngNext(s.rng); }
