import { describe, it, expect } from 'vitest';
import { DAYS, dayDef } from '../src/data/days';
import { TIME, rawCostOfTier } from '../src/data/balance';
import { seedRng } from '../src/sim/rng';
import { generateSchedule, generateOrder } from '../src/sim/orders';
import { CUSTOMER_TYPES } from '../src/data/customers';

describe('주문 생성', () => {
  it('같은 시드는 같은 일정과 주문을 만든다', () => {
    for (const d of DAYS) {
      const a = generateSchedule(d, seedRng(123));
      const b = generateSchedule(d, seedRng(123));
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      const c = generateSchedule(d, seedRng(124));
      expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
    }
  });

  it('활성 단계 범위 안의 메뉴만 주문하고 원료량 상한을 지킨다', () => {
    for (const d of DAYS) for (let seed = 1; seed <= 40; seed++) {
      const sch = generateSchedule(d, seedRng(seed));
      expect(sch.length).toBe(d.customerCount);
      for (const s of sch) {
        expect(s.order.items.length).toBeGreaterThanOrEqual(1);
        expect(s.order.items.length).toBeLessThanOrEqual(2);
        for (const it of s.order.items) { expect(it.tier).toBeGreaterThanOrEqual(d.minTier); expect(it.tier).toBeLessThanOrEqual(d.maxTier); }
        expect(s.order.rawCost).toBe(s.order.items.reduce((a, it) => a + rawCostOfTier(it.tier), 0));
        expect(s.order.rawCost).toBeLessThanOrEqual(d.rawCap);
        expect(s.order.price).toBeGreaterThan(0);
      }
    }
  });

  it('마지막 손님은 신규 손님 중단 시각(150초) 이전에 온다', () => {
    for (const d of DAYS) for (let seed = 1; seed <= 20; seed++) {
      const sch = generateSchedule(d, seedRng(seed));
      expect(sch[sch.length - 1].at).toBeLessThanOrEqual(TIME.lastArrival);
      for (let i = 1; i < sch.length; i++) expect(sch[i].at).toBeGreaterThanOrEqual(sch[i - 1].at);
    }
  });

  it('비 오는 날은 구이 주문 비중이 높지만 다른 계열도 나온다', () => {
    const d = dayDef(3);
    const count = { grill: 0, drink: 0, dessert: 0 };
    for (let seed = 1; seed <= 60; seed++) for (const s of generateSchedule(d, seedRng(seed))) for (const it of s.order.items) count[it.family]++;
    const total = count.grill + count.drink + count.dessert;
    expect(count.grill / total).toBeGreaterThan(0.5);
    expect(count.drink).toBeGreaterThan(0);
    expect(count.dessert).toBeGreaterThan(0);
  });

  it('달빛 미식회는 3~4단계 비중이 높고, 마녀는 높은 단계를 선호한다', () => {
    const d = dayDef(4);
    let hi = 0, total = 0;
    for (let seed = 1; seed <= 60; seed++) for (const s of generateSchedule(d, seedRng(seed))) for (const it of s.order.items) { total++; if (it.tier >= 3) hi++; }
    expect(hi / total).toBeGreaterThan(0.5);
    const rng = seedRng(5); let witchHi = 0, n = 0;
    for (let i = 0; i < 200; i++) { const o = generateOrder('witch', d, rng); n += o.items.length; witchHi += o.items.filter((it) => it.tier >= 3).length; }
    expect(witchHi / n).toBeGreaterThan(0.7);
    // 1일차에서는 마녀도 2단계 이하만 주문
    const d1 = dayDef(1);
    for (let i = 0; i < 100; i++) for (const it of generateOrder('witch', d1, rng).items) expect(it.tier).toBeLessThanOrEqual(2);
  });

  it('손님 선호가 실제 주문 계열에 반영되고 항상 같은 주문만 반복하지는 않는다', () => {
    const d = dayDef(2);
    const rng = seedRng(9);
    let goblinGrill = 0, ghostDrink = 0, batDessert = 0; const N = 300;
    const distinct = new Set<string>();
    for (let i = 0; i < N; i++) {
      const g = generateOrder('goblin', d, rng); if (g.items[0].family === 'grill') goblinGrill++;
      const h = generateOrder('ghost', d, rng); if (h.items[0].family === 'drink') ghostDrink++;
      const b = generateOrder('bat', d, rng); if (b.items[0].family === 'dessert') batDessert++;
      distinct.add(JSON.stringify(g.items));
    }
    expect(goblinGrill / N).toBeGreaterThan(0.6);
    expect(ghostDrink / N).toBeGreaterThan(0.65);
    expect(batDessert / N).toBeGreaterThan(0.65);
    expect(distinct.size).toBeGreaterThan(3);
    for (const t of CUSTOMER_TYPES) expect(generateOrder(t, d, rng).items.length).toBeGreaterThan(0);
  });

  it('만월 야시장에는 함께 오는 쌍이 있고, 각자 주문한다', () => {
    const d = dayDef(5);
    const sch = generateSchedule(d, seedRng(3));
    const paired = sch.filter((s) => s.pairWith !== null);
    expect(paired.length).toBe(d.pairs * 2);
    for (const s of paired) { const o = sch[s.pairWith!]; expect(Math.abs(o.at - s.at)).toBeLessThan(1.5); expect(o.order).toBeDefined(); }
  });

  it('연습 영업은 고정 주문(치즈 꼬치 1개)', () => {
    const o = generateOrder('slime', dayDef(0), seedRng(1));
    expect(o.items).toEqual([{ family: 'grill', tier: 2 }]);
  });
});
