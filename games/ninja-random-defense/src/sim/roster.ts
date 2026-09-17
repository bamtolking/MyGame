// 소환 / 합성 / 조합 / 판매 / 이동 / 강화 / 골드 주고받기 — 모두 검증 후 원자적으로 처리
import type { GameState, Unit, Kind, Grade, Element } from './types.ts';
import { rngNext, rngPick } from './rng.ts';
import { ELEMENTS, MYTHICS, MYTHIC_IDS, SELL_VALUE, isMythic, unitName, type MythicId } from '../data/units.ts';
import { SUMMON_COST, SUMMON_ODDS, SUMMON_LV_COST, MAX_SUMMON_LV, MAX_ATK_LV, atkUpgradeCost, MIN_SEND_GOLD } from '../data/economy.ts';
import { SLOT_COUNT, SLOT_ORDER, FIELD_W, FIELD_H } from '../data/board.ts';
import { createUnit, removeUnit, unitById, freeSlot, pushLog, isAlive, label } from './state.ts';

export type Result = { ok: true; msg?: string; unitId?: number; grade?: Grade; kind?: Kind; count?: number } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

export function currentOdds(s: GameState): [number, number, number, number] { return SUMMON_ODDS[Math.min(MAX_SUMMON_LV, Math.max(1, s.summonLv)) - 1]; }
export function rollGrade(s: GameState, odds: readonly number[]): Grade {
  const r = rngNext(s.rng); let acc = 0;
  for (let g = 0; g < odds.length; g++) { acc += odds[g]; if (r < acc) return g as Grade; }
  return 0;
}

/** 길에 가까운 빈 자리부터 채움 */
export function bestFreeSlot(s: GameState): number { for (const i of SLOT_ORDER) if (s.slots[i] == null) return i; return -1; }

export function canSummon(s: GameState): Result {
  if (!isAlive(s)) return fail('게임이 끝났습니다');
  if (freeSlot(s) < 0) return fail('자리가 가득 찼습니다. 합성하거나 판매하세요.');
  if (s.gold < SUMMON_COST) return fail(`골드 부족 (${SUMMON_COST} 필요)`);
  return { ok: true };
}
export function summon(s: GameState): Result {
  const c = canSummon(s); if (!c.ok) return c;
  s.gold -= SUMMON_COST; s.stats.goldSpent += SUMMON_COST; s.stats.summons++;
  const grade = rollGrade(s, currentOdds(s));
  const kind = rngPick(s.rng, ELEMENTS);
  const slot = bestFreeSlot(s);
  const u = createUnit(s, kind, grade, slot);
  s.stats.gradeCount[grade]++;
  s.events.push({ t: 'summon', slot, grade, kind });
  if (grade >= 2) pushLog(s, `${unitName(kind, grade)} 소환!`, 'good');
  return { ok: true, unitId: u.id, grade, kind };
}

/** 합성 가능 여부: 같은 등급(0~2) 3개. same=true면 같은 속성 3개(확정) */
export function mergeCandidates(s: GameState, u: Unit, same: boolean): Unit[] {
  if (isMythic(u.kind) || u.grade >= 3) return [];
  return s.units.filter(o => o.id !== u.id && o.grade === u.grade && !isMythic(o.kind) && (!same || o.kind === u.kind)).sort((a, b) => a.id - b.id);
}
export function canMerge(s: GameState, u: Unit): { confirmed: boolean; random: boolean } {
  return { confirmed: mergeCandidates(s, u, true).length >= 2, random: mergeCandidates(s, u, false).length >= 2 };
}

/** u를 기준으로 같은 등급 2개를 더 소모해 다음 등급 1개. random=false면 같은 속성만 사용(확정). */
export function mergeUnit(s: GameState, id: number, random = false): Result {
  if (!isAlive(s)) return fail('게임이 끝났습니다');
  const u = unitById(s, id); if (!u) return fail('유닛 없음');
  if (isMythic(u.kind)) return fail('신화는 합성할 수 없습니다');
  if (u.grade >= 3) return fail('전설은 합성이 아니라 조합(신화)으로만 승급합니다');
  const same = mergeCandidates(s, u, true);
  let mats: Unit[]; let confirmed: boolean;
  if (same.length >= 2) { mats = same.slice(0, 2); confirmed = true; }
  else if (random) { const any = mergeCandidates(s, u, false); if (any.length < 2) return fail('같은 등급 유닛이 3개 필요합니다'); mats = any.slice(0, 2); confirmed = false; }
  else return fail(`같은 속성·등급 유닛이 3개 필요합니다 (${same.length + 1}/3)`);
  const grade = (u.grade + 1) as Grade;
  const kind: Kind = confirmed ? u.kind : rngPick(s.rng, ELEMENTS);
  const slot = u.slot;
  removeUnit(s, u); for (const m of mats) removeUnit(s, m);
  const nu = createUnit(s, kind, grade, slot);
  s.stats.merges++;
  s.events.push({ t: 'merge', slot, grade, kind, confirmed });
  pushLog(s, `합성: ${unitName(kind, grade)}${confirmed ? '' : ' (무작위)'}`, grade >= 2 ? 'good' : 'info');
  return { ok: true, unitId: nu.id, grade, kind };
}

/** 확정 합성을 가능한 만큼 반복. 낮은 등급부터. */
export function autoMerge(s: GameState): Result {
  if (!isAlive(s)) return fail('게임이 끝났습니다');
  let n = 0; let guard = 0;
  while (guard++ < 200) {
    let did = false;
    for (const g of [0, 1, 2] as Grade[]) {
      for (const el of ELEMENTS) {
        const group = s.units.filter(u => u.grade === g && u.kind === el).sort((a, b) => a.id - b.id);
        if (group.length >= 3) { const r = mergeUnit(s, group[0].id, false); if (r.ok) { n++; did = true; break; } }
      }
      if (did) break;
    }
    if (!did) break;
  }
  if (n === 0) return fail('확정 합성할 수 있는 조합이 없습니다 (같은 속성·등급 3개)');
  return { ok: true, count: n, msg: `${n}회 합성` };
}

export interface RecipeStatus { id: MythicId; have: { el: Element; unitId: number | null }[]; missing: number; canCraft: boolean; reason: string }
export function recipeStatus(s: GameState, id: MythicId): RecipeStatus {
  const used = new Set<number>();
  const have = MYTHICS[id].recipe.map(el => {
    const u = s.units.filter(x => x.kind === el && x.grade === 3 && !used.has(x.id)).sort((a, b) => a.id - b.id)[0];
    if (u) used.add(u.id);
    return { el, unitId: u ? u.id : null };
  });
  const missing = have.filter(h => h.unitId == null).length;
  return { id, have, missing, canCraft: missing === 0, reason: missing ? `전설 재료 ${missing}개 부족` : '' };
}
export function craft(s: GameState, id: MythicId): Result {
  if (!isAlive(s)) return fail('게임이 끝났습니다');
  if (!MYTHIC_IDS.includes(id)) return fail('알 수 없는 신화');
  const st = recipeStatus(s, id); if (!st.canCraft) return fail(st.reason);
  const mats = st.have.map(h => unitById(s, h.unitId!)!);
  const slot = mats[0].slot;
  for (const m of mats) removeUnit(s, m);
  const nu = createUnit(s, id, 4, slot);
  s.stats.crafts++; s.stats.mythics.push(id);
  s.events.push({ t: 'mythic', slot, kind: id });
  pushLog(s, `신화 완성! ${MYTHICS[id].name}`, 'good');
  return { ok: true, unitId: nu.id, grade: 4, kind: id };
}

export function sellValue(u: Unit): number { return SELL_VALUE[u.grade]; }
export function sell(s: GameState, id: number): Result {
  if (!isAlive(s)) return fail('게임이 끝났습니다');
  const u = unitById(s, id); if (!u) return fail('유닛 없음');
  const v = sellValue(u); removeUnit(s, u); s.gold += v; s.stats.goldEarned += v;
  pushLog(s, `${label(u)} 판매 +${v}`, 'info');
  return { ok: true, msg: `+${v} 골드` };
}

export function move(s: GameState, id: number, slot: number): Result {
  if (!isAlive(s)) return fail('게임이 끝났습니다');
  const u = unitById(s, id); if (!u) return fail('유닛 없음');
  if (slot < 0 || slot >= SLOT_COUNT) return fail('잘못된 자리');
  if (u.slot === slot) return { ok: true };
  const occ = s.slots[slot];
  if (occ != null) { const o = unitById(s, occ)!; const from = u.slot; s.slots[from] = o.id; s.slots[slot] = u.id; u.slot = slot; o.slot = from; }
  else { s.slots[u.slot] = null; s.slots[slot] = u.id; u.slot = slot; }
  return { ok: true };
}

export function upgradeSummon(s: GameState): Result {
  if (!isAlive(s)) return fail('게임이 끝났습니다');
  if (s.summonLv >= MAX_SUMMON_LV) return fail('소환 레벨 최대');
  const cost = SUMMON_LV_COST[s.summonLv - 1];
  if (s.gold < cost) return fail(`골드 부족 (${cost} 필요)`);
  s.gold -= cost; s.stats.goldSpent += cost; s.summonLv++;
  s.events.push({ t: 'levelup', what: 'summon' });
  pushLog(s, `소환 레벨 ${s.summonLv}! 높은 등급 확률 상승`, 'good');
  return { ok: true };
}
export function upgradeAtk(s: GameState): Result {
  if (!isAlive(s)) return fail('게임이 끝났습니다');
  if (s.atkLv >= MAX_ATK_LV) return fail('공격력 강화 최대');
  const cost = atkUpgradeCost(s.atkLv);
  if (s.gold < cost) return fail(`골드 부족 (${cost} 필요)`);
  s.gold -= cost; s.stats.goldSpent += cost; s.atkLv++;
  s.events.push({ t: 'levelup', what: 'atk' });
  return { ok: true };
}

export function sendGold(s: GameState, amount: number): Result {
  if (!isAlive(s)) return fail('게임이 끝났습니다');
  amount = Math.floor(amount);
  if (!(amount >= MIN_SEND_GOLD)) return fail(`최소 ${MIN_SEND_GOLD} 골드`);
  if (s.gold < amount) return fail('골드 부족');
  s.gold -= amount; s.stats.goldSent += amount;
  return { ok: true };
}
export function receiveGold(s: GameState, amount: number): Result {
  amount = Math.floor(amount); if (!(amount > 0)) return fail('잘못된 금액');
  s.gold += amount; s.stats.goldReceived += amount; s.stats.goldEarned += amount;
  s.events.push({ t: 'gold', amount, x: FIELD_W / 2, y: FIELD_H / 2 });
  return { ok: true };
}
