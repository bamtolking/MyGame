// 영업 결과 계산: 실제 전달된 판매액·팁, 별, 해금, 관측 기반 조언.
import { dayDef, type DayDef } from '../data/days';
import { foodDef, FAMILY_DEFS, type Family } from '../data/foods';
import type { RunState } from './types';

export interface DayResult {
  dayId: number;
  practice: boolean;
  aborted: boolean;
  served: number;
  targetServed: number;
  sales: number;
  tips: number;
  income: number;
  incomeGoal: number;
  happyServed: number;
  leftQueue: number;
  leftOrder: number;
  closedUnserved: number;
  turnedAway: number;
  arrived: number;
  topFood: { key: string; name: string; count: number } | null;
  star1: boolean;
  star2: boolean;
  star3: boolean;
  stars: number;
  star2Label: string;
  unlocksNext: boolean;
  avgServiceWait: number;
  avgOrderWait: number;
  maxServiceWait: number;
  advice: string[];
}

export function computeResult(run: RunState): DayResult {
  const day = dayDef(run.dayId);
  const s = run.stats;
  const income = run.ledger.sales + run.ledger.tips;
  let topFood: DayResult['topFood'] = null;
  for (const [k, n] of Object.entries(run.ledger.soldByKey)) {
    if (!topFood || n > topFood.count) {
      const [fam, tier] = k.split(':');
      topFood = { key: k, name: foodDef(fam as Family, Number(tier)).name, count: n };
    }
  }
  const left = s.leftQueue + s.leftOrder;
  const star1 = s.served >= day.targetServed;
  const star2 = day.star2.kind === 'maxLeft' ? left <= day.star2.value : s.happyServed >= day.star2.value;
  const star3 = income >= day.incomeGoal;
  const stars = (star1 ? 1 : 0) + (star1 && star2 ? 1 : 0) + (star1 && star3 ? 1 : 0);
  const d = run.ledger.deliveries;
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const avgServiceWait = Math.round(avg(d.map((x) => x.serviceWait)) * 10) / 10;
  const avgOrderWait = Math.round(avg(d.map((x) => x.orderWait)) * 10) / 10;
  const maxServiceWait = Math.round(Math.max(0, ...d.map((x) => x.serviceWait)) * 10) / 10;
  return {
    dayId: run.dayId, practice: run.practice, aborted: run.aborted,
    served: s.served, targetServed: day.targetServed,
    sales: run.ledger.sales, tips: run.ledger.tips, income, incomeGoal: day.incomeGoal,
    happyServed: s.happyServed, leftQueue: s.leftQueue, leftOrder: s.leftOrder, closedUnserved: s.closedUnserved,
    turnedAway: s.turnedAway, arrived: s.arrived, topFood,
    star1, star2, star3, stars, star2Label: day.star2.label,
    unlocksNext: star1 && !run.practice && run.dayId >= 1 && run.dayId < 5,
    avgServiceWait, avgOrderWait, maxServiceWait,
    advice: buildAdvice(run, day, { avgServiceWait, maxServiceWait, left }),
  };
}

/** 실제 기록에서 확인 가능한 조언만 만든다. */
export function buildAdvice(run: RunState, day: DayDef, m: { avgServiceWait: number; maxServiceWait: number; left: number }): string[] {
  const s = run.stats;
  const out: string[] = [];
  if (run.ledger.deliveries.length >= 2 && m.avgServiceWait >= 4.5) {
    out.push(`서빙 대기 시간이 평균 ${m.avgServiceWait}초(최대 ${m.maxServiceWait}초)로 길었어요. 좌석을 배식구 가까이 옮기거나 직원 속도를 강화해 보세요.`);
  }
  if (s.leftOrder >= 1) {
    out.push(`주문을 기다리다 떠난 손님이 ${s.leftOrder}명이었어요. 주문 카드가 뜨면 그 계열부터 만들어 보세요.`);
  }
  if (s.leftQueue >= 1) {
    out.push(`대기줄에서 포기한 손님이 ${s.leftQueue}명이었어요. 좌석을 늘리거나 서빙을 빨리 마쳐 좌석을 비워 보세요.`);
  }
  if (s.turnedAway >= 1) {
    out.push(`가게가 가득 차 들어오지 못한 손님이 ${s.turnedAway}명 있었어요.`);
  }
  if (s.boardFullEvents >= 3) {
    out.push(`보드가 가득 차 생산이 막힌 경우가 ${s.boardFullEvents}번 있었어요. 주문에 맞춰 만들고 합쳐서 공간을 확보해 보세요.`);
  }
  // 오늘 가장 많이 나온 주문 (도착한 손님 기준)
  const demand: Record<string, number> = {};
  for (const c of run.customers) for (const it of c.order.items) { const k = `${it.family}:${it.tier}`; demand[k] = (demand[k] || 0) + 1; }
  let topK: string | null = null;
  for (const [k, n] of Object.entries(demand)) if (!topK || n > demand[topK]) topK = k;
  if (topK && demand[topK] >= 2) {
    const [fam, tier] = topK.split(':');
    out.push(`오늘은 ${FAMILY_DEFS[fam as Family].name} ${tier}단계(${foodDef(fam as Family, Number(tier)).name}) 주문이 ${demand[topK]}건으로 가장 많았어요.`);
  }
  if (s.closedUnserved >= 1) {
    out.push(`마감 시각에 처리하지 못한 주문·대기 손님이 ${s.closedUnserved}명이었어요. 150초 이후엔 새 손님이 오지 않으니 남은 주문에 집중해 보세요.`);
  }
  if (out.length === 0) {
    out.push(`기록상 눈에 띄는 문제는 없었어요. 도전 수입 목표는 ${day.incomeGoal}코인이에요.`);
  }
  return out;
}
