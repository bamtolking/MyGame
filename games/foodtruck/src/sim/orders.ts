// 주문 생성과 손님 도착 일정. 시드로 재현 가능하며 그날 활성 단계만 요구한다.
import { CUSTOMER_DEFS, type CustomerType } from '../data/customers';
import { FAMILIES, foodDef, type Family } from '../data/foods';
import type { DayDef } from '../data/days';
import { TIME, rawCostOfTier } from '../data/balance';
import { rngNext, rngWeighted, type RngState } from './rng';
import type { Order, OrderItem, ScheduledArrival } from './types';

export function orderRawCost(items: OrderItem[]): number {
  return items.reduce((s, it) => s + rawCostOfTier(it.tier), 0);
}

export function orderPrice(items: OrderItem[]): number {
  return items.reduce((s, it) => s + foodDef(it.family, it.tier).price, 0);
}

export function makeOrder(items: OrderItem[]): Order {
  return { items, rawCost: orderRawCost(items), price: orderPrice(items) };
}

function familyDistribution(type: CustomerType, day: DayDef): number[] {
  const def = CUSTOMER_DEFS[type];
  let base: number[];
  if (def.prefFamily) {
    base = FAMILIES.map((f) => (f === def.prefFamily ? def.prefProb : (1 - def.prefProb) / 2));
  } else {
    base = FAMILIES.map(() => 1 / 3);
  }
  if (day.familyBias) {
    const bias = FAMILIES.map((f) => day.familyBias![f] ?? 0);
    const sum = bias.reduce((a, b) => a + b, 0) || 1;
    return base.map((b, i) => 0.5 * b + 0.5 * (bias[i] / sum));
  }
  return base;
}

const TIER_BIAS: Record<'low' | 'mid' | 'high', number[]> = {
  low: [1, 0.45, 0.15, 0.05],
  mid: [1, 1, 0.9, 0.6],
  high: [0.15, 0.45, 1, 1.6],
};

function tierWeights(type: CustomerType, day: DayDef): number[] {
  const bias = TIER_BIAS[CUSTOMER_DEFS[type].tierBias];
  const w: number[] = [];
  for (let t = 1; t <= 4; t++) {
    if (t < day.minTier || t > day.maxTier) { w.push(0); continue; }
    w.push((day.tierWeights[t - 1] ?? 0) * bias[t - 1]);
  }
  return w;
}

function pickItem(type: CustomerType, day: DayDef, rng: RngState): OrderItem {
  const fam = FAMILIES[rngWeighted(rng, familyDistribution(type, day))] as Family;
  const tier = rngWeighted(rng, tierWeights(type, day)) + 1;
  return { family: fam, tier };
}

/** 손님 종류와 영업일 규칙에 맞는 주문 생성. 원료량 상한을 넘으면 단계를 낮춘다. */
export function generateOrder(type: CustomerType, day: DayDef, rng: RngState): Order {
  if (day.id === 0) return makeOrder([{ family: 'grill', tier: 2 }]);
  const def = CUSTOMER_DEFS[type];
  const items: OrderItem[] = [pickItem(type, day, rng)];
  if (rngNext(rng) < def.twoItemProb) {
    if (rngNext(rng) < 0.5) items.push({ ...items[0] });
    else items.push(pickItem(type, day, rng));
  }
  // 원료량 상한 적용
  let guard = 20;
  while (orderRawCost(items) > day.rawCap && guard-- > 0) {
    let hi = 0;
    for (let i = 1; i < items.length; i++) if (items[i].tier > items[hi].tier) hi = i;
    if (items[hi].tier > day.minTier) items[hi] = { ...items[hi], tier: items[hi].tier - 1 };
    else if (items.length > 1) items.pop();
    else break;
  }
  return makeOrder(items);
}

export function pickCustomerType(day: DayDef, rng: RngState): CustomerType {
  const types = Object.keys(day.customerWeights) as CustomerType[];
  const w = types.map((t) => day.customerWeights[t] ?? 0);
  return types[rngWeighted(rng, w)];
}

/** 도착 일정 생성. 마지막 도착은 신규 손님 중단 시각 이전으로 맞춘다. */
export function generateSchedule(day: DayDef, rng: RngState): ScheduledArrival[] {
  const n = day.customerCount;
  const times: number[] = [];
  let t = day.firstArrival;
  // 함께 오는 쌍: 인덱스 쌍을 미리 고른다 (연속 인덱스)
  const pairStarts = new Set<number>();
  if (day.pairs > 0) {
    const candidates: number[] = [];
    for (let i = 1; i < n - 1; i += 2) candidates.push(i);
    for (let p = 0; p < day.pairs && candidates.length; p++) {
      const k = Math.floor(rngNext(rng) * candidates.length);
      pairStarts.add(candidates[k]);
      candidates.splice(k, 1);
    }
  }
  for (let i = 0; i < n; i++) {
    if (i === 0) { times.push(t); continue; }
    if (pairStarts.has(i - 1)) { t += 0.8; times.push(t); continue; }
    const burst = rngNext(rng) < day.burstProb;
    const iv = burst ? day.burstInterval : day.intervalBase + (rngNext(rng) * 2 - 1) * day.intervalJitter;
    t += Math.max(1.5, iv);
    times.push(t);
  }
  const limit = TIME.lastArrival - 3;
  if (times[n - 1] > limit) {
    const scale = (limit - times[0]) / (times[n - 1] - times[0]);
    for (let i = 1; i < n; i++) times[i] = times[0] + (times[i] - times[0]) * scale;
  }
  const out: ScheduledArrival[] = [];
  for (let i = 0; i < n; i++) {
    const type = pickCustomerType(day, rng);
    const order = generateOrder(type, day, rng);
    const pairWith = pairStarts.has(i) ? i + 1 : pairStarts.has(i - 1) ? i - 1 : null;
    out.push({ at: Math.round(times[i] * 10) / 10, type, order, pairWith });
  }
  return out;
}
