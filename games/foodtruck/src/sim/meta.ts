// 영구 데이터(거점): 코인, 구매·강화, 가게 배치, 해금, 최고 기록, 정산 처리.
import { PRICES, SEATS, SAVE } from '../data/balance';
import { defaultLayout, addFurniture, moveFurniture } from './store';
import type { MetaState, ActionResult, RunState } from './types';
import type { DayResult } from './result';
import type { Cell } from '../data/store';

export function newMeta(): MetaState {
  const { furniture, nextId } = defaultLayout();
  return {
    coins: 0,
    seatsBought: 0,
    decorBought: 0,
    staffSpeedLevel: 0,
    layout: furniture,
    nextFurnitureId: nextId,
    unlockedDay: 1,
    best: {},
    tutorialDone: false,
    prepHintShown: false,
    settings: { volume: 0.7, muted: false },
    settledRunIds: [],
    runsPlayed: 0,
    lastDay: 1,
  };
}

/** 정산: 영업 실행 ID 기준 한 번만. 연습은 코인을 주지 않는다. */
export function settleRun(meta: MetaState, run: RunState, result: DayResult): { applied: boolean; coinsAdded: number } {
  if (run.settled || meta.settledRunIds.includes(run.runId)) return { applied: false, coinsAdded: 0 };
  run.settled = true;
  meta.settledRunIds.push(run.runId);
  if (meta.settledRunIds.length > SAVE.settledHistory) meta.settledRunIds.splice(0, meta.settledRunIds.length - SAVE.settledHistory);
  if (run.practice) return { applied: true, coinsAdded: 0 };
  meta.coins += result.income;
  meta.runsPlayed++;
  const key = String(run.dayId);
  const prev = meta.best[key];
  if (!prev) meta.best[key] = { stars: result.stars, income: result.income, served: result.served };
  else meta.best[key] = { stars: Math.max(prev.stars, result.stars), income: Math.max(prev.income, result.income), served: Math.max(prev.served, result.served) };
  if (result.unlocksNext) meta.unlockedDay = Math.max(meta.unlockedDay, Math.min(5, run.dayId + 1));
  return { applied: true, coinsAdded: result.income };
}

export function seatCount(meta: MetaState): number { return meta.layout.filter((f) => f.kind === 'seat').length; }

export function nextSeatPrice(meta: MetaState): number | null {
  return meta.seatsBought < PRICES.seat.length ? PRICES.seat[meta.seatsBought] : null;
}
export function nextDecorPrice(meta: MetaState): number | null {
  return meta.decorBought < PRICES.decorMax ? PRICES.decor : null;
}
export function nextSpeedPrice(meta: MetaState): number | null {
  return meta.staffSpeedLevel < PRICES.staffSpeed.length ? PRICES.staffSpeed[meta.staffSpeedLevel] : null;
}

export function buySeat(meta: MetaState): ActionResult {
  const price = nextSeatPrice(meta);
  if (price === null || seatCount(meta) >= SEATS.max) return { ok: false, reason: '좌석은 최대 4개예요.' };
  if (meta.coins < price) return { ok: false, reason: `코인이 부족해요. (${price} 필요)` };
  const r = addFurniture(meta.layout, 'seat', meta.nextFurnitureId);
  if (!r.ok) return { ok: false, reason: r.problems[0] };
  meta.coins -= price;
  meta.seatsBought++;
  meta.nextFurnitureId++;
  meta.layout = r.furniture;
  return { ok: true };
}

export function buyDecor(meta: MetaState): ActionResult {
  const price = nextDecorPrice(meta);
  if (price === null) return { ok: false, reason: '장식은 최대 2개예요.' };
  if (meta.coins < price) return { ok: false, reason: `코인이 부족해요. (${price} 필요)` };
  const r = addFurniture(meta.layout, 'decor', meta.nextFurnitureId);
  if (!r.ok) return { ok: false, reason: r.problems[0] };
  meta.coins -= price;
  meta.decorBought++;
  meta.nextFurnitureId++;
  meta.layout = r.furniture;
  return { ok: true };
}

export function buySpeed(meta: MetaState): ActionResult {
  const price = nextSpeedPrice(meta);
  if (price === null) return { ok: false, reason: '직원 속도는 최대 2단계예요.' };
  if (meta.coins < price) return { ok: false, reason: `코인이 부족해요. (${price} 필요)` };
  meta.coins -= price;
  meta.staffSpeedLevel++;
  return { ok: true };
}

export function moveLayout(meta: MetaState, id: number, to: Cell): { ok: boolean; problems: string[] } {
  const r = moveFurniture(meta.layout, id, to);
  if (r.ok) meta.layout = r.furniture;
  return { ok: r.ok, problems: r.problems };
}

/** 기본 배치로 되돌린다 (구매한 가구 수는 유지, 위치만 초기화) */
export function resetLayout(meta: MetaState): { ok: boolean; problems: string[] } {
  const base = defaultLayout();
  let furniture = base.furniture;
  let nextId = base.nextId;
  const extraSeats = seatCount(meta) - base.furniture.length;
  for (let i = 0; i < extraSeats; i++) { const r = addFurniture(furniture, 'seat', nextId); if (!r.ok) return { ok: false, problems: r.problems }; furniture = r.furniture; nextId++; }
  const decors = meta.layout.filter((f) => f.kind === 'decor').length;
  for (let i = 0; i < decors; i++) { const r = addFurniture(furniture, 'decor', nextId); if (!r.ok) return { ok: false, problems: r.problems }; furniture = r.furniture; nextId++; }
  meta.layout = furniture;
  meta.nextFurnitureId = nextId;
  return { ok: true, problems: [] };
}
