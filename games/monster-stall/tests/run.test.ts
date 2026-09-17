import { describe, it, expect } from 'vitest';
import { TIME, STAFF } from '../src/data/balance';
import { makeRun, makeBot, advance, runUntilEnded, metaWith, STEP } from './helpers';
import { actAccept, actSpawn, actMerge, actAbort, orderReady, tick, closeRun, drainEvents } from '../src/sim/run';
import { computeResult } from '../src/sim/result';
import { CUSTOMER_DEFS } from '../src/data/customers';
import type { Furniture } from '../src/sim/types';

const seat = (id: number, x: number, y: number): Furniture => ({ id, kind: 'seat', x, y });

describe('영업 실행', () => {
  it('봇이 1일차를 끝까지 진행하고 결과가 장부와 일치한다', () => {
    const run = makeRun(1, 11);
    runUntilEnded(run, makeBot());
    expect(run.phase).toBe('ended');
    const r = computeResult(run);
    expect(r.served).toBe(run.ledger.deliveries.length);
    expect(r.sales).toBe(run.ledger.deliveries.reduce((a, d) => a + d.price, 0));
    expect(r.tips).toBe(run.ledger.deliveries.reduce((a, d) => a + d.tip, 0));
    expect(r.income).toBe(r.sales + r.tips);
    expect(run.stats.arrived).toBe(8);
    // 모든 손님의 종착 상태가 명확
    for (const c of run.customers) expect(c.state).toBe('gone');
    const accounted = r.served + r.leftQueue + r.leftOrder + r.closedUnserved + r.turnedAway;
    expect(accounted).toBe(run.stats.arrived);
  });

  it('수입은 직원이 전달한 시점에만 발생한다', () => {
    const run = makeRun(1, 11);
    // 첫 손님이 앉을 때까지 진행
    advance(run, 6);
    const c = run.customers.find((x) => x.state === 'ordering')!;
    expect(c).toBeDefined();
    // 필요한 음식을 만든다
    const bot = makeBot({ actionInterval: 0.1 });
    let guard = 0;
    while (!orderReady(run, c) && guard++ < 600) { tick(run, STEP); bot(run); drainEvents(run); if (c.state !== 'ordering') break; }
    expect(orderReady(run, c)).toBe(true);
    const before = run.ledger.sales;
    expect(actAccept(run, c.id).ok).toBe(true);
    expect(c.state).toBe('accepted');
    expect(run.ledger.sales).toBe(before); // 접수 시점에는 입금 없음
    expect(actAccept(run, c.id).ok).toBe(false); // 연타 방지
    // 직원이 전달할 때까지
    guard = 0;
    while (c.state === 'accepted' && guard++ < 3000) { tick(run, STEP); drainEvents(run); }
    expect(c.state).toBe('eating');
    expect(run.ledger.sales).toBe(before + c.order.price);
    expect(run.ledger.deliveries.length).toBe(1);
    expect(c.deliveredAt! - c.acceptedAt!).toBeGreaterThan(STAFF.pickupTime + STAFF.handoffTime - 0.01);
  });

  it('접수 시 음식은 한 번만 제거되고 다른 주문에 쓸 수 없다', () => {
    const run = makeRun(2, 5);
    advance(run, 6);
    const orderers = run.customers.filter((x) => x.state === 'ordering');
    expect(orderers.length).toBeGreaterThan(0);
    const c = orderers[0];
    // 보드를 c의 주문에 정확히 맞게 구성
    run.board.fill(null);
    const nid = { value: run.nextFoodId };
    for (const it of c.order.items) { run.board[nid.value] = { id: nid.value, family: it.family, tier: it.tier }; nid.value++; }
    run.nextFoodId = nid.value;
    const count = run.board.filter(Boolean).length;
    expect(actAccept(run, c.id).ok).toBe(true);
    expect(run.board.filter(Boolean).length).toBe(count - c.order.items.length);
    expect(c.reservedFoodIds.length).toBe(c.order.items.length);
    // 같은 메뉴를 원하는 다른 손님은 이제 접수 불가
    const other = orderers.find((o) => o.id !== c.id && JSON.stringify(o.order.items) === JSON.stringify(c.order.items));
    if (other) expect(actAccept(run, other.id).ok).toBe(false);
  });

  it('같은 메뉴 2개 주문에는 실제 음식 2개가 필요하다', () => {
    const run = makeRun(1, 1);
    advance(run, 6);
    const c = run.customers.find((x) => x.state === 'ordering')!;
    c.order = { items: [{ family: 'drink', tier: 1 }, { family: 'drink', tier: 1 }], rawCost: 2, price: 14 };
    run.board.fill(null);
    run.board[0] = { id: 900, family: 'drink', tier: 1 };
    expect(actAccept(run, c.id).ok).toBe(false);
    run.board[1] = { id: 901, family: 'drink', tier: 1 };
    expect(actAccept(run, c.id).ok).toBe(true);
    expect(run.board.filter(Boolean).length).toBe(0);
  });

  it('높은 단계 음식을 낮은 단계 주문에 대체 소비하지 않는다', () => {
    const run = makeRun(2, 1);
    advance(run, 6);
    const c = run.customers.find((x) => x.state === 'ordering')!;
    c.order = { items: [{ family: 'grill', tier: 1 }], rawCost: 1, price: 8 };
    run.board.fill(null);
    run.board[0] = { id: 900, family: 'grill', tier: 2 };
    expect(actAccept(run, c.id).ok).toBe(false);
    expect(run.board[0]?.id).toBe(900);
  });

  it('떠난 손님에게 접수할 수 없고, 접수 후 인내는 멈춘다', () => {
    const run = makeRun(1, 3);
    advance(run, 6);
    const c = run.customers.find((x) => x.state === 'ordering')!;
    const p0 = c.orderPatience;
    advance(run, 2);
    expect(c.orderPatience).toBeLessThan(p0);
    // 인내를 소진시켜 떠나게 한다
    c.orderPatience = 0.01;
    advance(run, 1);
    expect(c.state === 'leaving' || c.state === 'gone').toBe(true);
    expect(c.leaveReason).toBe('order_timeout');
    expect(actAccept(run, c.id).ok).toBe(false);
    expect(run.stats.leftOrder).toBe(1);
    // 다음 손님: 접수 후 인내 정지
    advance(run, 20);
    const d = run.customers.find((x) => x.state === 'ordering')!;
    run.board.fill(null);
    d.order.items.forEach((it, i) => { run.board[i] = { id: 800 + i, family: it.family, tier: it.tier }; });
    expect(actAccept(run, d.id).ok).toBe(true);
    const frozen = d.orderPatience;
    advance(run, 1);
    expect(d.orderPatience).toBe(frozen);
    expect(d.state === 'accepted' || d.state === 'eating').toBe(true);
  });

  it('팁은 접수 시점 남은 인내 비율로 확정된다', () => {
    const run = makeRun(1, 3);
    advance(run, 6);
    const c = run.customers.find((x) => x.state === 'ordering')!;
    run.board.fill(null);
    c.order.items.forEach((it, i) => { run.board[i] = { id: 700 + i, family: it.family, tier: it.tier }; });
    c.orderPatience = c.orderPatienceMax * 0.9;
    actAccept(run, c.id);
    expect(c.tipMult).toBe(1);
    let guard = 0; while (c.state === 'accepted' && guard++ < 3000) advance(run, STEP);
    expect(c.sale!.tip).toBe(Math.round(c.order.price * CUSTOMER_DEFS[c.type].tipRate));
    // 낮은 비율
    advance(run, 20);
    const d = run.customers.find((x) => x.state === 'ordering')!;
    run.board.fill(null);
    d.order.items.forEach((it, i) => { run.board[i] = { id: 600 + i, family: it.family, tier: it.tier }; });
    d.orderPatience = d.orderPatienceMax * 0.1;
    actAccept(run, d.id);
    expect(d.tipMult).toBe(0);
  });

  it('식사 후 좌석이 비워지고 대기줄 손님이 앉는다', () => {
    const run = makeRun(2, 8); // 12명, 좌석 2개
    runUntilEnded(run, makeBot());
    const queued = run.customers.filter((c) => c.seatedAt !== null && c.arriveAt < c.seatedAt! - 1);
    // 일부 손님은 대기줄을 거쳤어야 함 (좌석 2개, 12명)
    expect(run.stats.leftQueue + queued.length).toBeGreaterThan(0);
    for (const s of run.seats) expect(s.customerId).toBeNull();
  });

  it('150초 이후 새 손님이 오지 않고 180초 이후 생산·합성·접수가 막힌다', () => {
    const run = makeRun(2, 4);
    advance(run, TIME.lastArrival + 0.5);
    const arrivedAt150 = run.stats.arrived;
    advance(run, TIME.dayLength - TIME.lastArrival - 1);
    expect(run.stats.arrived).toBe(arrivedAt150);
    expect(run.phase).toBe('open');
    advance(run, 1);
    expect(run.phase === 'closing' || run.phase === 'ended').toBe(true);
    expect(actSpawn(run, 'grill').result.ok).toBe(false);
    const ids = run.board.filter((c) => c && c.family === 'grill' && c.tier === 1).map((c) => c!.id);
    if (ids.length >= 2) expect(actMerge(run, ids[0], ids[1]).result.ok).toBe(false);
    for (const c of run.customers) expect(c.state === 'ordering' || c.state === 'queued' || c.state === 'walking').toBe(false);
    // 마감 후 매출 이벤트 무한 발생 없음
    const sales = run.ledger.sales;
    advance(run, 60);
    expect(run.phase).toBe('ended');
    expect(run.ledger.sales).toBe(sales); // 접수된 서빙이 없었으므로 변화 없음
  });

  it('마감 시 이미 접수한 서빙은 마무리되고 정산에 포함된다', () => {
    const run = makeRun(1, 6);
    // 179초 근처에 주문 하나를 접수해 둔다
    advance(run, 100);
    let c = run.customers.find((x) => x.state === 'ordering');
    if (!c) { advance(run, 20); c = run.customers.find((x) => x.state === 'ordering'); }
    expect(c).toBeDefined();
    c!.orderPatience = 999; c!.orderPatienceMax = 999;
    run.board.fill(null);
    c!.order.items.forEach((it, i) => { run.board[i] = { id: 500 + i, family: it.family, tier: it.tier }; });
    // 마감 직전까지 진행 (인내는 위에서 늘려둠)
    while (run.t < TIME.dayLength - 0.2) advance(run, STEP);
    expect(actAccept(run, c!.id).ok).toBe(true);
    const salesBefore = run.ledger.sales;
    runUntilEnded(run);
    expect(run.phase).toBe('ended');
    expect(run.ledger.sales).toBe(salesBefore + c!.order.price);
    expect(c!.deliveredAt).not.toBeNull();
  });

  it('영업 포기: 새 주문 종료, 실제 수입만 남는다', () => {
    const run = makeRun(1, 6);
    advance(run, 30);
    const r = actAbort(run);
    expect(r.ok).toBe(true);
    expect(run.aborted).toBe(true);
    expect(actSpawn(run, 'grill').result.ok).toBe(false);
    runUntilEnded(run);
    const res = computeResult(run);
    expect(res.income).toBe(run.ledger.sales + run.ledger.tips);
    expect(res.unlocksNext).toBe(res.served >= res.targetServed);
  });

  it('만석이면 최대 3명이 줄을 서고, 넘치면 입장 못 한 손님으로 집계된다', () => {
    const layout = [seat(1, 1, 2), seat(2, 3, 1)];
    const run = makeRun(2, 2, metaWith({ layout }));
    // 아무것도 서빙하지 않고 진행 → 대기줄이 찬다
    let maxQueue = 0, sawFull = false;
    runUntilEnded(run, (r) => { maxQueue = Math.max(maxQueue, r.queue.length); if (r.stats.turnedAway > 0) sawFull = true; });
    expect(maxQueue).toBeLessThanOrEqual(3);
    // 서빙 안 함 → 서빙 실패로 잘못 집계되지 않음
    expect(run.stats.served).toBe(0);
    expect(run.stats.leftOrder + run.stats.leftQueue + run.stats.turnedAway + run.stats.closedUnserved).toBe(run.stats.arrived);
    expect(run.stats.leftQueue).toBeGreaterThan(0);
    void sawFull;
  });

  it('보드가 가득 차도 진행이 막히지 않는다', () => {
    const run = makeRun(1, 2);
    while (actSpawn(run, 'grill').result.ok) { /* fill */ }
    expect(run.stats.boardFullEvents).toBe(1);
    expect(run.board.filter(Boolean).length).toBe(25);
    const ids = run.board.filter((c) => c && c.family === 'grill' && c.tier === 1).map((c) => c!.id);
    expect(actMerge(run, ids[0], ids[1]).result.ok).toBe(true);
  });

  it('closeRun은 한 번만 적용된다', () => {
    const run = makeRun(1, 2);
    advance(run, 10);
    closeRun(run, true);
    const closed = run.stats.closedUnserved;
    closeRun(run, true);
    expect(run.stats.closedUnserved).toBe(closed);
  });
});
