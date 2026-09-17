// 배치·이동·합성·판매·새로고침. 모든 함수는 상태를 검증한 뒤 원자적으로 변경합니다.
import type { GameState, Unit } from './types';
import { createUnit, removeUnit, unitById, unitPos, pushLog } from './state';
import { rollOffer } from './offer';
import { UNITS, GRADE_INVEST, MAX_GRADE, type Grade, unitStats } from '../data/units';
import { SUMMON_COST, REFRESH_COST, sellRefund, MOVE_COOLDOWN, MAX_UNITS } from '../data/economy';
import { mapSlots } from '../data/maps';

export interface Result { ok: boolean; error?: string; msg?: string; unitId?: number }

export function place(s: GameState, offerIdx: number, slot: number): Result {
  if (s.phase === 'won' || s.phase === 'lost') return { ok: false, error: '게임이 끝났습니다' };
  const kind = s.offer[offerIdx];
  if (!kind) return { ok: false, error: '후보를 먼저 선택하세요' };
  const slots = mapSlots(s.mapId);
  if (slot < 0 || slot >= slots.length) return { ok: false, error: '잘못된 위치' };
  if (s.slots[slot] != null) return { ok: false, error: '이미 유닛이 있는 칸입니다' };
  if (s.units.length >= MAX_UNITS) return { ok: false, error: `최대 ${MAX_UNITS}기까지 배치할 수 있습니다. 합성으로 칸을 비우세요` };
  if (s.gold < SUMMON_COST) return { ok: false, error: `골드 부족 (${SUMMON_COST} 필요, 보유 ${Math.floor(s.gold)})` };
  s.gold -= SUMMON_COST; s.stats.goldSpent += SUMMON_COST; s.stats.summons++;
  const u = createUnit(s, kind, 1, slot);
  const [x, y] = unitPos(s, u);
  s.events.push({ t: 'place', unit: u.id, x, y });
  s.offer = rollOffer(s);
  return { ok: true, unitId: u.id, msg: `${UNITS[kind].name} 배치` };
}

export function refresh(s: GameState): Result {
  if (s.phase === 'won' || s.phase === 'lost') return { ok: false, error: '게임이 끝났습니다' };
  if (s.refreshFree > 0) { s.refreshFree--; }
  else {
    if (s.gold < REFRESH_COST) return { ok: false, error: `골드 부족 (새로고침 ${REFRESH_COST} 골드)` };
    s.gold -= REFRESH_COST; s.stats.goldSpent += REFRESH_COST;
  }
  s.refreshCount++; s.stats.refreshes++;
  s.offer = rollOffer(s);
  return { ok: true, msg: s.refreshFree >= 0 ? '후보 새로고침' : '' };
}

export function move(s: GameState, unitId: number, slot: number): Result {
  const u = unitById(s, unitId); if (!u) return { ok: false, error: '유닛이 없습니다' };
  const slots = mapSlots(s.mapId);
  if (slot < 0 || slot >= slots.length) return { ok: false, error: '잘못된 위치' };
  if (slot === u.slot) return { ok: false, error: '같은 위치입니다' };
  if (u.moveCd > 0) return { ok: false, error: `이동 대기 ${u.moveCd.toFixed(1)}초` };
  const other = s.slots[slot];
  if (other != null) {
    const o = unitById(s, other)!;
    if (o.moveCd > 0) return { ok: false, error: `상대 유닛 이동 대기 ${o.moveCd.toFixed(1)}초` };
    o.slot = u.slot; s.slots[u.slot] = o.id; o.moveCd = MOVE_COOLDOWN;
  } else s.slots[u.slot] = null;
  u.slot = slot; s.slots[slot] = u.id; u.moveCd = MOVE_COOLDOWN;
  // 공격 대기시간은 유지(이동으로 초기화 불가). 회오리 끌기 진행은 위치가 바뀌므로 종료.
  u.pullT = 0; u.fireVortexT = 0;
  return { ok: true, msg: other != null ? '자리 교환' : '이동' };
}

export function canMerge(a: Unit, b: Unit): boolean { return a.id !== b.id && a.kind === b.kind && a.grade === b.grade && a.grade < MAX_GRADE; }
export function mergeCandidates(s: GameState, u: Unit): Unit[] { return s.units.filter(o => canMerge(u, o)); }

/** 합성 미리보기 문구 */
export function mergePreview(u: Unit): { grade: Grade; text: string } | null {
  if (u.grade >= MAX_GRADE) return null;
  const g = (u.grade + 1) as Grade; const a = unitStats(u.kind, u.grade); const b = unitStats(u.kind, g);
  const parts = [`피해 ${a.dmg.toFixed(0)}→${b.dmg.toFixed(0)}`, `사거리 ${a.range}→${b.range}`];
  if (b.cd < a.cd) parts.push(`간격 ${a.cd.toFixed(2)}→${b.cd.toFixed(2)}초`);
  if (g === 3) parts.push(UNITS[u.kind].g3);
  return { grade: g, text: parts.join(' · ') };
}

/** a(유지, 결과 위치) + b(소모) → a 등급 +1 */
export function merge(s: GameState, aId: number, bId: number): Result {
  const a = unitById(s, aId), b = unitById(s, bId);
  if (!a || !b) return { ok: false, error: '유닛이 없습니다' };
  if (a.id === b.id) return { ok: false, error: '같은 유닛입니다' };
  if (a.kind !== b.kind) return { ok: false, error: '같은 종류만 합성할 수 있습니다' };
  if (a.grade !== b.grade) return { ok: false, error: '같은 등급만 합성할 수 있습니다' };
  if (a.grade >= MAX_GRADE) return { ok: false, error: '이미 최고 등급입니다' };
  const [fx, fy] = unitPos(s, b);
  const invested = a.invested + b.invested;
  removeUnit(s, b);
  a.grade = (a.grade + 1) as Grade;
  a.invested = invested;              // 실제 투입 골드 합산(판매 환급 기준)
  a.cd = Math.max(a.cd, b.cd);        // 대기시간은 더 긴 쪽 유지(초기화 악용 방지)
  a.charge = Math.max(a.charge, b.charge); a.overcharged = a.overcharged || b.overcharged;
  a.kills += b.kills; a.dmg += b.dmg; a.pullT = 0; a.fireVortexT = 0;
  s.stats.merges++; s.stats.peakGrade = Math.max(s.stats.peakGrade, a.grade);
  const [x, y] = unitPos(s, a);
  s.events.push({ t: 'merge', unit: a.id, x, y, grade: a.grade, fromX: fx, fromY: fy });
  pushLog(s, `${UNITS[a.kind].name} ${a.grade}등급 합성!`, 'good');
  return { ok: true, unitId: a.id, msg: `${a.grade}등급 합성` };
}

export function sell(s: GameState, unitId: number): Result {
  const u = unitById(s, unitId); if (!u) return { ok: false, error: '유닛이 없습니다' };
  const refund = sellRefund(u.invested);
  const [x, y] = unitPos(s, u);
  removeUnit(s, u);
  s.gold += refund; s.stats.goldEarned += refund; s.stats.sells++;
  s.events.push({ t: 'sell', x, y, gold: refund });
  return { ok: true, msg: `판매 +${refund}` };
}
export function sellValue(u: Unit): number { return sellRefund(u.invested); }
export function investedFor(grade: Grade): number { return GRADE_INVEST[grade]; }
