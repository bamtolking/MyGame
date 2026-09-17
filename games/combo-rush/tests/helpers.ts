import { newGame, spawnEnemy, createUnit } from '../src/sim/state';
import { step, DT, dispatch } from '../src/sim/engine';
import type { GameState, Enemy } from '../src/sim/types';
import type { UnitKind, Grade } from '../src/data/units';
import type { EnemyKind } from '../src/data/enemies';
import type { MapId } from '../src/data/maps';
import type { Difficulty } from '../src/data/waves';

export function game(seed = 1, mapId: MapId = 'A', difficulty: Difficulty = 'normal', tutorial = false): GameState {
  return newGame({ mapId, difficulty, seed, now: 1000, tutorial });
}
/** 테스트용: 후보와 무관하게 유닛을 직접 배치 */
export function put(s: GameState, kind: UnitKind, grade: Grade, slot: number) { return createUnit(s, kind, grade, slot); }
export function run(s: GameState, seconds: number): void { const n = Math.round(seconds / DT); for (let i = 0; i < n; i++) step(s); }
export function spawnAt(s: GameState, kind: EnemyKind, dist: number, hpMul = 1): Enemy { return spawnEnemy(s, kind, hpMul, dist); }
/** 웨이브 상태로 강제 전환(적 수동 배치 테스트용) */
export function forceWave(s: GameState): void { s.phase = 'wave'; s.waveRt = { index: s.wave, queue: [], t: 0, spawned: 0, startedAt: s.time }; }
export function drain(s: GameState) { const e = s.events.slice(); s.events.length = 0; return e; }
export function place(s: GameState, offer: number, slot: number) { return dispatch(s, { type: 'place', offer, slot }); }
/** 적을 제자리에 고정(속도 0). 빙결과 달리 상태 효과로 집계되지 않음 */
export function pin(e: Enemy): Enemy { e.speed = 0; return e; }
