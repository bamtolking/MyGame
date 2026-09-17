/**
 * Player commands: validated, then applied to state. Nothing else mutates
 * credits / rosters. Returns a reason string on failure.
 */
import { unitDef, FACTIONS } from '../data/units.ts';
import { ECON, ROSTER } from '../data/balance.ts';
import type { MatchState, Player } from './state.ts';

export type Command =
  | { type: 'buy'; player: number; unitId: string; cell: number }
  | { type: 'cancel'; player: number; cell: number }
  | { type: 'sell'; player: number; cell: number }
  | { type: 'move'; player: number; from: number; to: number }
  | { type: 'econ'; player: number }
  | { type: 'tech'; player: number }
  | { type: 'upgrade'; player: number; kind: 'attack' | 'defense' | 'support' }
  | { type: 'cannon'; player: number; x: number; y: number }
  | { type: 'request'; player: number; ally: number; request: 'antiair' | 'frontline' | 'economy' | null };

export interface CmdResult {
  ok: boolean;
  reason?: string;
}

export function rosterPop(p: Player): number {
  let pop = 0;
  for (const e of p.roster) if (e) pop += unitDef(e.unitId).pop;
  return pop;
}

export function rosterValue(p: Player): number {
  let v = 0;
  for (const e of p.roster) if (e) v += unitDef(e.unitId).cost;
  return v;
}

export function econCost(level: number): number {
  return ECON.econBaseCost + ECON.econStepCost * level;
}

export function techCost(current: number): number | null {
  if (current >= 3) return null;
  return ECON.techCost[current + 1];
}

export function upgradeCost(level: number): number | null {
  if (level >= ECON.upgradeMax) return null;
  return ECON.upgradeCosts[level];
}

/** Explains why a purchase is impossible (null = possible). */
export function buyBlockReason(p: Player, unitId: string, cell?: number): string | null {
  const def = unitDef(unitId);
  if (!FACTIONS[p.faction].units.includes(unitId)) return '다른 진영 병종';
  if (def.tier > p.tech) return `${def.tier}단계 기술 필요`;
  if (p.credits < def.cost) return '자원 부족';
  if (rosterPop(p) + def.pop > ROSTER.popCap) return '인구수 초과';
  if (cell !== undefined) {
    if (cell < 0 || cell >= ROSTER.cols * ROSTER.rows) return '잘못된 칸';
    if (p.roster[cell]) return '이미 배치된 칸';
  }
  return null;
}

export function applyCommand(s: MatchState, c: Command): CmdResult {
  if (s.result) return { ok: false, reason: '경기 종료' };
  const p = s.players[c.player];
  if (!p) return { ok: false, reason: '플레이어 없음' };
  switch (c.type) {
    case 'buy': {
      const why = buyBlockReason(p, c.unitId, c.cell);
      if (why) return { ok: false, reason: why };
      const def = unitDef(c.unitId);
      p.credits -= def.cost;
      p.spent.units += def.cost;
      p.roster[c.cell] = { unitId: c.unitId, dispatched: false };
      const st = s.stats[p.index].byType;
      const ts = (st[c.unitId] ??= emptyTypeStats());
      ts.bought += 1;
      ts.spent += def.cost;
      return { ok: true };
    }
    case 'cancel': {
      const e = p.roster[c.cell];
      if (!e) return { ok: false, reason: '빈 칸' };
      if (e.dispatched) return { ok: false, reason: '이미 출격한 병력은 판매(70%)만 가능' };
      const def = unitDef(e.unitId);
      p.roster[c.cell] = null;
      p.credits += def.cost;
      p.spent.units -= def.cost;
      const ts = s.stats[p.index].byType[e.unitId];
      if (ts) {
        ts.bought -= 1;
        ts.spent -= def.cost;
      }
      return { ok: true };
    }
    case 'sell': {
      const e = p.roster[c.cell];
      if (!e) return { ok: false, reason: '빈 칸' };
      if (!e.dispatched) {
        // never dispatched -> treat as cancel (100%)
        return applyCommand(s, { type: 'cancel', player: c.player, cell: c.cell });
      }
      const def = unitDef(e.unitId);
      const refund = Math.floor(def.cost * ECON.sellRefund);
      p.roster[c.cell] = null;
      p.credits += refund;
      p.spent.refunds += refund;
      return { ok: true };
    }
    case 'move': {
      const n = ROSTER.cols * ROSTER.rows;
      if (c.from < 0 || c.from >= n || c.to < 0 || c.to >= n) return { ok: false, reason: '잘못된 칸' };
      if (c.from === c.to) return { ok: false, reason: '같은 칸' };
      const e = p.roster[c.from];
      if (!e) return { ok: false, reason: '빈 칸' };
      const other = p.roster[c.to];
      p.roster[c.to] = e;
      p.roster[c.from] = other ?? null; // swap allowed, free
      return { ok: true };
    }
    case 'econ': {
      if (p.econLevel >= ECON.econMaxLevel) return { ok: false, reason: '최대 단계' };
      const cost = econCost(p.econLevel);
      if (p.credits < cost) return { ok: false, reason: '자원 부족' };
      p.credits -= cost;
      p.spent.econ += cost;
      p.econLevel += 1;
      return { ok: true };
    }
    case 'tech': {
      const cost = techCost(p.tech);
      if (cost === null) return { ok: false, reason: '최대 단계' };
      if (p.credits < cost) return { ok: false, reason: '자원 부족' };
      p.credits -= cost;
      p.spent.tech += cost;
      p.tech = (p.tech + 1) as 1 | 2 | 3;
      return { ok: true };
    }
    case 'upgrade': {
      const lvl = p.upgrades[c.kind];
      const cost = upgradeCost(lvl);
      if (cost === null) return { ok: false, reason: '최대 단계' };
      if (p.credits < cost) return { ok: false, reason: '자원 부족' };
      p.credits -= cost;
      p.spent.upgrades += cost;
      p.upgrades[c.kind] = lvl + 1;
      return { ok: true };
    }
    case 'cannon': {
      return { ok: false, reason: 'handled by match' }; // Match.fireCannon validates zone/time
    }
    case 'request': {
      const ally = s.players[c.ally];
      if (!ally || ally.team !== p.team || ally.isHuman) return { ok: false, reason: '요청 대상 아님' };
      ally.request = c.request;
      ally.requestAt = s.t;
      return { ok: true };
    }
  }
  return { ok: false, reason: '알 수 없는 명령' };
}

export function emptyTypeStats() {
  return { dealt: 0, taken: 0, healed: 0, shielded: 0, kills: 0, deaths: 0, bought: 0, spent: 0 };
}
