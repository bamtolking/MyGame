// 관전용 압축 스냅샷 (멀티에서 2Hz 전송). 자기 판은 GameState를 직접 그리고, 남의 판은 이걸로 그립니다.
import type { GameState } from './types.ts';
import { ELEMENTS, MYTHIC_IDS, type Kind, type Grade } from '../data/units.ts';
import { aliveMonsters } from './state.ts';
import type { MonsterType } from '../data/monsters.ts';

const KINDS: Kind[] = [...ELEMENTS, ...MYTHIC_IDS];
const MTYPES: MonsterType[] = ['grunt', 'runner', 'brute', 'boss'];

/** [slot, kindIdx, grade][] / [typeIdx, dist(정수), hp%(0..100), speedPx, flags][] */
export interface BoardSnap { r: number; g: number; ph: string; n: number; k: number; bt: number; u: number[][]; m: number[][]; t: number }
export interface PlayerSummary { round: number; gold: number; phase: string; monsters: number; kills: number; damage: number; units: number; peak: number; mythics: number }

export function snapshot(s: GameState): BoardSnap {
  return {
    r: s.round, g: Math.floor(s.gold), ph: s.phase, n: aliveMonsters(s), k: s.stats.kills, t: Math.round(s.time * 10) / 10,
    bt: s.bossDeadline != null ? Math.max(0, Math.round(s.bossDeadline - s.time)) : -1,
    u: s.units.map(u => [u.slot, KINDS.indexOf(u.kind), u.grade]),
    m: s.monsters.filter(m => m.alive).map(m => [MTYPES.indexOf(m.type), Math.round(m.dist), Math.max(0, Math.round(m.hp / m.maxHp * 100)), Math.round(m.speed * (1 - Math.max(m.slowT > 0 ? m.slowAmt : 0, m.auraSlow))), (m.stunT > 0 ? 1 : 0) | (m.slowT > 0 || m.auraSlow > 0 ? 2 : 0)]),
  };
}
export function summary(s: GameState): PlayerSummary {
  return { round: s.round, gold: Math.floor(s.gold), phase: s.phase, monsters: aliveMonsters(s), kills: s.stats.kills, damage: Math.round(s.stats.damage), units: s.units.length, peak: s.stats.peakGrade, mythics: s.stats.mythics.length };
}
export interface ViewUnit { slot: number; kind: Kind; grade: Grade }
export interface ViewMonster { x: number; y: number; type: MonsterType; boss: boolean; hpPct: number; stunned: boolean; slowed: boolean; dist: number }
export function snapUnits(b: BoardSnap): ViewUnit[] { return b.u.map(([slot, k, g]) => ({ slot, kind: KINDS[k] ?? 'fire', grade: g as Grade })); }
export function snapMonsters(b: BoardSnap, elapsed: number, pathPos: (d: number) => { x: number; y: number }, pathLen: number): ViewMonster[] {
  return b.m.map(([t, d, hp, sp, fl]) => {
    const dist = (fl & 1) ? d : (d + sp * elapsed) % pathLen;
    const p = pathPos(dist); const type = MTYPES[t] ?? 'grunt';
    return { x: p.x, y: p.y, type, boss: type === 'boss', hpPct: hp / 100, stunned: !!(fl & 1), slowed: !!(fl & 2), dist };
  });
}
