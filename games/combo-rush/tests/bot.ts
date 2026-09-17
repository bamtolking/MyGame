// 헤드리스 봇: 실제 액션(dispatch)만 사용해 한 판을 자동 플레이합니다. 밸런스 확인용.
import { newGame } from '../src/sim/state';
import { step, dispatch } from '../src/sim/engine';
import type { GameState, Unit } from '../src/sim/types';
import { UNIT_KINDS, type UnitKind } from '../src/data/units';
import { mapSlots, pathGeo, posAt, type MapId } from '../src/data/maps';
import type { Difficulty } from '../src/data/waves';
import { SUMMON_COST, MAX_UNITS, REFRESH_COST } from '../src/data/economy';
import { mergeCandidates } from '../src/sim/roster';

export type Strategy = 'mixed' | 'random' | `mono_${UnitKind}` | 'engineer_spam';
export interface BotResult { strategy: Strategy; seed: number; mapId: MapId; difficulty: Difficulty; won: boolean; wave: number; life: number; time: number; peakGrade: number; units: string[]; combos: Record<string, number>; goldAt: Record<number, number>; kills: number; gradesAt: Record<number, string> }

const ATTACK: UnitKind[] = ['flame', 'frost', 'laser', 'tesla', 'bomber'];
/** 칸의 가치: 반경 100 안 경로 길이 */
function slotValue(mapId: MapId): number[] {
  const g = pathGeo(mapId); return mapSlots(mapId).map(s => { let n = 0; for (let d = 0; d < g.len; d += 5) { const [x, y] = posAt(g, d); if (Math.hypot(x - s.x, y - s.y) <= 100) n++; } return n; });
}
function bestFreeSlot(s: GameState, vals: number[], near?: Unit): number {
  const slots = mapSlots(s.mapId); let best = -1, bv = -1;
  for (const sl of slots) { if (s.slots[sl.id] != null) continue; let v = vals[sl.id]; if (near) { const ns = slots[near.slot]; v += Math.max(0, 60 - Math.hypot(ns.x - sl.x, ns.y - sl.y) / 2); } if (v > bv) { bv = v; best = sl.id; } }
  return best;
}
function tryMerge(s: GameState, vals: number[]): boolean {
  for (const u of s.units) { const c = mergeCandidates(s, u); if (!c.length) continue; const o = c[0]; const keep = vals[u.slot] >= vals[o.slot] ? u : o; const gone = keep === u ? o : u; if (dispatch(s, { type: 'merge', a: keep.id, b: gone.id }).ok) return true; }
  return false;
}
const PARTNER: Partial<Record<UnitKind, UnitKind[]>> = { flame: ['oil', 'vortex'], oil: ['flame'], vortex: ['bomber', 'flame'], bomber: ['vortex'], frost: ['laser', 'tesla'], laser: ['frost', 'engineer'], tesla: ['frost'], engineer: ['laser'] };
interface Brain { focus: UnitKind[] }
function pickOffer(s: GameState, strat: Strategy, brain: Brain): number | null {
  const owned = new Map<UnitKind, number>(); for (const u of s.units) owned.set(u.kind, (owned.get(u.kind) || 0) + 1);
  if (strat === 'random') return 0;
  if (strat.startsWith('mono_')) { const k = strat.slice(5) as UnitKind; const i = s.offer.indexOf(k); return i >= 0 ? i : null; }
  if (strat === 'engineer_spam') { const i = s.offer.indexOf('engineer'); if (i >= 0 && s.units.length < 10) return i; const a = s.offer.findIndex(k => k === 'laser'); return a >= 0 ? a : (s.offer.findIndex(k => ATTACK.includes(k))); }
  // mixed: 집중 종류(최대 5)를 정해 그 안에서만 모으고, 연계 짝을 챙깁니다.
  const attackers = s.units.filter(u => ATTACK.includes(u.kind)).length;
  const score = (k: UnitKind) => {
    let v = 0; const n = owned.get(k) || 0; const inFocus = brain.focus.includes(k);
    if (inFocus) v += 6; else if (brain.focus.length >= 5) v -= 12;
    if (n % 2 === 1) v += 5;
    if (ATTACK.includes(k)) v += 2; else if (attackers < 2) v -= 8;
    for (const f of brain.focus) if (PARTNER[f]?.includes(k)) v += 3;
    if (n >= 4) v -= 4;
    return v;
  };
  let best = -1, bs = -99; s.offer.forEach((k, i) => { const v = score(k); if (v > bs) { bs = v; best = i; } });
  if (bs < -5) return null;
  return best;
}
function sellWeakest(s: GameState, brain: Brain): boolean {
  const owned = new Map<UnitKind, number>(); for (const u of s.units) owned.set(u.kind, (owned.get(u.kind) || 0) + 1);
  const cands = s.units.filter(u => u.grade === 1 && (owned.get(u.kind) || 0) % 2 === 1).sort((a, b) => (brain.focus.includes(a.kind) ? 1 : 0) - (brain.focus.includes(b.kind) ? 1 : 0) || a.dmg - b.dmg);
  if (!cands.length) return false;
  return dispatch(s, { type: 'sell', id: cands[0].id }).ok;
}
export function runBot(strat: Strategy, seed: number, mapId: MapId = 'A', difficulty: Difficulty = 'normal', maxSeconds = 1500): BotResult {
  const s = newGame({ mapId, difficulty, seed, now: 1 }); const vals = slotValue(mapId); const brain: Brain = { focus: [] };
  const goldAt: Record<number, number> = {}; const gradesAt: Record<number, string> = {}; let lastWave = 0; let tick = 0;
  while (s.phase !== 'won' && s.phase !== 'lost' && s.time < maxSeconds) {
    if (s.wave !== lastWave) { lastWave = s.wave; goldAt[s.wave] = Math.floor(s.gold); gradesAt[s.wave] = s.units.map(u => u.grade).sort().join(''); }
    if (tick % 30 === 0) {
      while (tryMerge(s, vals)) { /* 반복 */ }
      let guard = 0;
      while (s.gold >= SUMMON_COST && guard++ < 8) {
        if (s.units.length >= MAX_UNITS) { if (strat === 'mixed' && s.gold >= SUMMON_COST * 2 + 10 && sellWeakest(s, brain)) continue; if (strat !== 'mixed' && s.gold >= 60) { const g1 = s.units.find(u => u.grade === 1); if (g1 && dispatch(s, { type: 'sell', id: g1.id }).ok) continue; } break; }
        const i = pickOffer(s, strat, brain);
        if (i == null) { if (s.refreshFree > 0 || s.gold >= SUMMON_COST + REFRESH_COST + 15) { dispatch(s, { type: 'refresh' }); continue; } break; }
        const kind = s.offer[i]; const near = s.units.find(u => PARTNER[kind]?.includes(u.kind)) || s.units.find(u => u.kind === kind);
        const slot = bestFreeSlot(s, vals, near); if (slot < 0) break;
        if (!dispatch(s, { type: 'place', offer: i, slot }).ok) break;
        if (strat === 'mixed' && !brain.focus.includes(kind) && brain.focus.length < 5) brain.focus.push(kind);
        while (tryMerge(s, vals)) { /* */ }
      }
      if (s.phase === 'prep' && s.prepT < 3.5) dispatch(s, { type: 'early' });
    }
    step(s); tick++;
  }
  return { strategy: strat, seed, mapId, difficulty, won: s.phase === 'won', wave: s.wave, life: s.life, time: s.time, peakGrade: s.stats.peakGrade, units: s.units.map(u => `${u.kind}${u.grade}`), combos: s.stats.combos, goldAt, kills: s.stats.kills, gradesAt };
}
export const ALL_KINDS = UNIT_KINDS;
