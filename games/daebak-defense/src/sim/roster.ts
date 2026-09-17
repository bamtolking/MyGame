// Summon / merge / craft / relocate / sell / upgrade — all validated & atomic
import type { GameState, Grade, UnitKind, MythicId, Unit, SummonResult } from './types';
import { rngNext, rngInt, rngPick } from './rng';
import { UNIT_KINDS, UNITS, MYTHICS, MYTHIC_IDS, MAX_MYTHICS_ON_FIELD, SELL_VALUE, MOVE_COOLDOWN } from '../data/units';
import { BASE_ODDS, PITY_ODDS, ODDS_ORDER } from '../data/summon';
import { summonCost, SHARDS_PER_DESIGNATE, PITY_THRESHOLD, UPGRADES, upgradeCost } from '../data/economy';
import { createUnit, placeUnit, clearLoc, removeUnit, unitById, freeSlot, freeBench, fieldUnits, unitLabel, pushLog } from './state';
import { SLOTS } from '../data/map';

export type Result = { ok: true; msg?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

export function pityThreshold(s: GameState): number { return s.relics.includes('fate_dice') ? 10 : PITY_THRESHOLD; }
export function designateCost(s: GameState): number { return s.relics.includes('fate_dice') ? 4 : SHARDS_PER_DESIGNATE; }
export function currentOdds(s: GameState): { odds: Record<Grade, number>; pityActive: boolean; pity: number; threshold: number } {
  const th = pityThreshold(s);
  const pityActive = s.pity >= th;
  return { odds: pityActive ? PITY_ODDS : BASE_ODDS, pityActive, pity: s.pity, threshold: th };
}
export function currentSummonCost(s: GameState): number { return summonCost(s.summonCount, s.relics); }

/** Roll a grade from an odds table using the game RNG. */
export function rollGrade(s: GameState, odds: Record<Grade, number>): Grade {
  const r = rngNext(s.rng); let acc = 0;
  for (const g of ODDS_ORDER) { acc += odds[g]; if (r < acc) return g; }
  return 0;
}

export function canSummon(s: GameState): Result {
  if (s.phase === 'countdown' || s.phase === 'relic' || s.phase === 'won' || s.phase === 'lost') return fail('지금은 소환할 수 없습니다');
  if (freeBench(s) < 0 && freeSlot(s) < 0) return fail('대기석과 전장이 모두 가득 찼습니다. 합성하거나 판매하세요.');
  const cost = currentSummonCost(s);
  if (s.gold < cost) return fail(`골드가 부족합니다 (${cost} 필요)`);
  return { ok: true };
}

export function summon(s: GameState): Result & { result?: SummonResult } {
  const c = canSummon(s); if (!c.ok) return c;
  const cost = currentSummonCost(s);
  const { odds, pityActive } = currentOdds(s);
  s.gold -= cost; s.stats.goldSpent += cost; s.summonCount++; s.stats.summons++;
  const grade = rollGrade(s, odds);
  let kind: UnitKind; let designated = false;
  if (s.designatedKind) { kind = s.designatedKind; s.designatedKind = null; designated = true; }
  else kind = rngPick(s.rng, UNIT_KINDS);
  if (grade >= 2) s.pity = 0; else s.pity++;
  if (grade === 0) s.shards += s.relics.includes('fate_dice') ? 2 : 1;
  const u = createUnit(s, kind, grade);
  const b = freeBench(s);
  if (b >= 0) placeUnit(s, u, { t: 'b', idx: b }); else placeUnit(s, u, { t: 'f', slot: freeSlot(s) });
  if (grade > s.stats.peakGrade) s.stats.peakGrade = grade;
  const result: SummonResult = { grade, kind, pityUsed: pityActive, designated, unitId: u.id };
  s.lastResult = result;
  s.events.push({ t: 'summon', unit: u.id, grade });
  return { ok: true, result };
}

export function designateKind(s: GameState, kind: UnitKind): Result {
  if (s.designatedKind) return fail('이미 종류가 지정되어 있습니다');
  const cost = designateCost(s);
  if (s.shards < cost) return fail(`운명 조각이 부족합니다 (${cost} 필요)`);
  s.shards -= cost; s.designatedKind = kind;
  pushLog(s, `다음 소환 종류 지정: ${UNITS[kind].name}`, 'good');
  return { ok: true };
}

/** Merge preview: what would 3 ids produce? */
export function mergePreview(s: GameState, ids: number[]): { ok: boolean; error?: string; grade?: Grade; kind?: UnitKind | null; confirmed?: boolean; warnLocked?: string[] } {
  if (ids.length !== 3) return { ok: false, error: '유닛 3개를 선택하세요' };
  if (new Set(ids).size !== 3) return { ok: false, error: '같은 유닛을 중복 선택했습니다' };
  const us = ids.map(id => unitById(s, id));
  if (us.some(u => !u)) return { ok: false, error: '존재하지 않는 유닛' };
  const units = us as Unit[];
  if (units.some(u => u.mythic)) return { ok: false, error: '신화는 합성 재료가 될 수 없습니다' };
  const g = units[0].grade;
  if (units.some(u => u.grade !== g)) return { ok: false, error: '같은 등급끼리만 합성할 수 있습니다' };
  if (g >= 3) return { ok: false, error: '전설은 더 승급하지 않습니다 (신화는 조합창에서)' };
  const kinds = units.map(u => u.kind);
  let kind: UnitKind | null = null; let confirmed = false;
  if (kinds.every(k => k === kinds[0])) { kind = kinds[0]; confirmed = true; }
  else if (s.relics.includes('sorting_box')) {
    for (const k of kinds) if (kinds.filter(x => x === k).length >= 2) { kind = k; confirmed = true; break; }
  }
  const warnLocked = units.filter(u => u.locked).map(u => unitLabel(u));
  return { ok: true, grade: (g + 1) as Grade, kind, confirmed, warnLocked };
}

export function merge(s: GameState, ids: number[]): Result & { unitId?: number } {
  if (s.phase === 'won' || s.phase === 'lost' || s.phase === 'countdown') return fail('지금은 합성할 수 없습니다');
  const p = mergePreview(s, ids); if (!p.ok) return fail(p.error!);
  const units = ids.map(id => unitById(s, id)!);
  // result location: first unit that is on the field, else first unit's bench spot
  const anchor = units.find(u => u.loc.t === 'f') ?? units[0];
  const loc = { ...anchor.loc };
  const resultKind: UnitKind = p.kind ?? rngPick(s.rng, UNIT_KINDS);
  for (const u of units) removeUnit(s, u);   // atomic: all removed before creating
  const nu = createUnit(s, resultKind, p.grade!);
  placeUnit(s, nu, loc);
  s.stats.merges++;
  if (p.grade! > s.stats.peakGrade) s.stats.peakGrade = p.grade!;
  if (p.grade === 3) s.stats.legendMade++;
  const pos = loc.t === 'f' ? SLOTS[loc.slot] : { x: 200, y: 590 };
  s.events.push({ t: 'merge', unit: nu.id, grade: nu.grade, x: pos.x, y: pos.y });
  pushLog(s, `합성 완료: ${['일반', '희귀', '영웅', '전설'][nu.grade]} ${UNITS[nu.kind].name}${p.confirmed ? ' (확정)' : ' (무작위)'}`, 'good');
  return { ok: true, unitId: nu.id };
}

/** Auto pick 3 unlocked units of a grade, preferring same kind if kind given (returns ids or null). */
export function autoPick(s: GameState, grade: Grade, kind: UnitKind | null): number[] | null {
  const pool = s.units.filter(u => !u.mythic && u.grade === grade && !u.locked && (kind == null || u.kind === kind));
  // prefer bench units, then non-fav, then oldest
  pool.sort((a, b) => (a.loc.t === 'b' ? 0 : 1) - (b.loc.t === 'b' ? 0 : 1) || (a.fav ? 1 : 0) - (b.fav ? 1 : 0) || a.id - b.id);
  if (pool.length < 3) return null;
  return pool.slice(0, 3).map(u => u.id);
}

// ---- Mythic crafting ----
export interface RecipeStatus { id: MythicId; have: { kind: UnitKind; grade: Grade; unitId: number | null }[]; missing: number; cores: boolean; canCraft: boolean; reason: string }
export function recipeStatus(s: GameState, id: MythicId): RecipeStatus {
  const m = MYTHICS[id];
  const used = new Set<number>();
  const have = m.recipe.map(r => {
    // prefer locked/reserved units, then bench, then field
    const cands = s.units.filter(u => !u.mythic && u.kind === r.kind && u.grade === r.grade && !used.has(u.id))
      .sort((a, b) => (b.locked ? 1 : 0) - (a.locked ? 1 : 0) || (a.loc.t === 'b' ? 0 : 1) - (b.loc.t === 'b' ? 0 : 1) || a.id - b.id);
    const u = cands[0]; if (u) used.add(u.id);
    return { kind: r.kind, grade: r.grade, unitId: u ? u.id : null };
  });
  const missing = have.filter(h => h.unitId == null).length;
  const cores = s.cores >= 1;
  const onField = fieldUnits(s).filter(u => u.mythic);
  let reason = '';
  if (s.units.some(u => u.mythic === id)) reason = '이미 보유한 신화입니다 (중복 불가)';
  else if (onField.length >= MAX_MYTHICS_ON_FIELD && freeBench(s) < 0) reason = `신화는 전장에 최대 ${MAX_MYTHICS_ON_FIELD}기`;
  else if (missing > 0) reason = `재료 ${missing}개 부족`;
  else if (!cores) reason = '공방 핵 필요 (보스 처치 보상)';
  return { id, have, missing, cores, canCraft: reason === '', reason };
}

export function craftMythic(s: GameState, id: MythicId): Result & { unitId?: number } {
  if (s.phase === 'won' || s.phase === 'lost' || s.phase === 'countdown') return fail('지금은 조합할 수 없습니다');
  const st = recipeStatus(s, id); if (!st.canCraft) return fail(st.reason);
  const mats = st.have.map(h => unitById(s, h.unitId!)!);
  const anchor = mats.find(u => u.loc.t === 'f') ?? mats[0];
  const loc = { ...anchor.loc };
  const fieldMythics = fieldUnits(s).filter(u => u.mythic).length;
  s.cores -= 1;
  for (const u of mats) removeUnit(s, u);
  const nu = createUnit(s, MYTHICS[id].recipe[0].kind, 4, id);
  if (loc.t === 'f' && fieldMythics >= MAX_MYTHICS_ON_FIELD) { const b = freeBench(s); placeUnit(s, nu, { t: 'b', idx: b }); }
  else placeUnit(s, nu, loc);
  s.stats.mythicsMade.push(id);
  const pos = nu.loc.t === 'f' ? SLOTS[nu.loc.slot] : { x: 200, y: 590 };
  s.events.push({ t: 'mythic', unit: nu.id, id, x: pos.x, y: pos.y });
  pushLog(s, `신화 완성! ${MYTHICS[id].name}`, 'good');
  return { ok: true, unitId: nu.id };
}

/** Lock all currently matching ingredients for a recipe (reserve). Returns count locked. */
export function reserveRecipe(s: GameState, id: MythicId): number {
  const st = recipeStatus(s, id); let n = 0;
  for (const h of st.have) { const u = unitById(s, h.unitId ?? undefined); if (u && !u.locked) { u.locked = true; n++; } }
  return n;
}

// ---- Movement ----
export function moveUnit(s: GameState, id: number, to: { t: 'f'; slot: number } | { t: 'b'; idx: number }): Result {
  const u = unitById(s, id); if (!u) return fail('유닛 없음');
  if (s.phase === 'won' || s.phase === 'lost') return fail('게임이 끝났습니다');
  if (u.moveCd > 0) return fail(`재배치 대기 ${u.moveCd.toFixed(1)}초`);
  if (to.t === 'f') {
    if (to.slot < 0 || to.slot >= s.slots.length) return fail('잘못된 자리');
    const occ = s.slots[to.slot];
    if (occ != null && occ !== u.id) return swapUnits(s, u.id, occ);
    if (u.mythic && u.loc.t !== 'f') {
      const onField = fieldUnits(s).filter(x => x.mythic && x.id !== u.id).length;
      if (onField >= MAX_MYTHICS_ON_FIELD) return fail(`신화는 전장에 최대 ${MAX_MYTHICS_ON_FIELD}기`);
    }
  } else {
    if (to.idx < 0 || to.idx >= s.bench.length) return fail('잘못된 대기석');
    const occ = s.bench[to.idx];
    if (occ != null && occ !== u.id) return swapUnits(s, u.id, occ);
  }
  clearLoc(s, u); placeUnit(s, u, to);
  u.moveCd = MOVE_COOLDOWN; u.tele = 0; // cancels telegraphed attack without refunding cooldown
  return { ok: true };
}

export function swapUnits(s: GameState, a: number, b: number): Result {
  const ua = unitById(s, a), ub = unitById(s, b); if (!ua || !ub || a === b) return fail('교환 대상 오류');
  if (ua.moveCd > 0 || ub.moveCd > 0) return fail('재배치 대기 중인 유닛입니다');
  const la = { ...ua.loc }, lb = { ...ub.loc };
  clearLoc(s, ua); clearLoc(s, ub); placeUnit(s, ua, lb); placeUnit(s, ub, la);
  ua.moveCd = MOVE_COOLDOWN; ub.moveCd = MOVE_COOLDOWN; ua.tele = 0; ub.tele = 0;
  return { ok: true };
}

export function toggleLock(s: GameState, id: number): Result { const u = unitById(s, id); if (!u) return fail('유닛 없음'); u.locked = !u.locked; return { ok: true }; }
export function toggleFav(s: GameState, id: number): Result { const u = unitById(s, id); if (!u) return fail('유닛 없음'); u.fav = !u.fav; return { ok: true }; }

export function sellValue(u: Unit): number { return u.mythic ? 300 : SELL_VALUE[u.grade as Grade]; }
export function sellUnit(s: GameState, id: number): Result {
  const u = unitById(s, id); if (!u) return fail('유닛 없음');
  if (s.phase === 'won' || s.phase === 'lost') return fail('게임이 끝났습니다');
  const v = sellValue(u); removeUnit(s, u); s.gold += v; s.stats.goldEarned += v;
  pushLog(s, `${unitLabel(u)} 판매 +${v}`, 'info');
  return { ok: true };
}

export function buyUpgrade(s: GameState, id: 'atk' | 'spd' | 'life'): Result {
  const def = UPGRADES.find(d => d.id === id)!;
  const lv = s.upgrades[id];
  if (lv >= def.max) return fail('최대 단계입니다');
  const cost = upgradeCost(def, lv);
  if (s.gold < cost) return fail(`골드 부족 (${cost} 필요)`);
  s.gold -= cost; s.stats.goldSpent += cost; s.upgrades[id] = lv + 1;
  if (id === 'life') { s.maxLife += def.per; s.life += def.per; }
  s.events.push({ t: 'levelup' });
  return { ok: true };
}
