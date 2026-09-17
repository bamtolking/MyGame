// 영업 실행 엔진: 손님 도착·대기줄·착석·주문·서빙 접수·직원 이동·전달·결제·식사·퇴장·마감.
import { TIME, QUEUE_MAX, STAFF, CUSTOMER_WALK_SPEED, BOARD, TIP } from '../data/balance';
import { CUSTOMER_DEFS } from '../data/customers';
import { FAMILIES, type Family } from '../data/foods';
import { dayDef } from '../data/days';
import { STORE, type Cell } from '../data/store';
import { seedRng, hashSeed } from './rng';
import { emptyBoard, spawnFood, mergeFoods, moveFood, discardFood, pickFoodsFor, findFood, countEmpty } from './board';
import { pathToSeat, pathBetween, decorBonusForSeat, seatsOf } from './store';
import { generateSchedule } from './orders';
import type { RunState, MetaState, Customer, Seat, Staff, Mover, ScheduledArrival, ActionResult, LeaveReason, FoodItem } from './types';

export interface CreateRunOpts {
  dayId: number;
  seed: number;
  meta: MetaState;
  practice?: boolean;
  runId?: string;
}

export function createRun(opts: CreateRunOpts): RunState {
  const day = dayDef(opts.dayId);
  const rng = seedRng(hashSeed(`${opts.dayId}:${opts.seed}`));
  const schedule = generateSchedule(day, rng);
  const furniture = opts.meta.layout.map((f) => ({ ...f }));
  const seats: Seat[] = seatsOf(furniture).map((f) => ({
    id: f.id, x: f.x, y: f.y, customerId: null, decorBonus: decorBonusForSeat(f, furniture),
  }));
  const staff: Staff = { pos: { ...STORE.kitchen }, path: [], pathIdx: 0, phase: 'idle', carrying: null, timer: 0 };
  const run: RunState = {
    runId: opts.runId ?? `${opts.dayId}-${opts.seed}-${Date.now().toString(36)}`,
    dayId: opts.dayId,
    seed: opts.seed,
    practice: !!opts.practice,
    phase: 'open',
    t: 0,
    minTier: day.minTier,
    maxTier: day.maxTier,
    board: emptyBoard(),
    nextFoodId: 1,
    nextCustomerId: 1,
    schedule,
    scheduleIndex: 0,
    customers: [],
    queue: [],
    seats,
    furniture,
    servingQueue: [],
    staff,
    staffSpeedLevel: opts.meta.staffSpeedLevel,
    ledger: { sales: 0, tips: 0, deliveries: [], soldByKey: {} },
    stats: { arrived: 0, served: 0, happyServed: 0, turnedAway: 0, leftQueue: 0, leftOrder: 0, closedUnserved: 0, boardFullEvents: 0, ops: { spawn: 0, merge: 0, move: 0, discard: 0, accept: 0 }, rawDemand: 0 },
    startFoodsGiven: false,
    settled: false,
    aborted: false,
    rng,
    events: [],
  };
  giveStartFoods(run);
  return run;
}

/** 시작 음식: 계열별 1단계 2개. 영업 실행당 한 번만. 연습 영업은 지급하지 않는다. */
export function giveStartFoods(run: RunState): void {
  if (run.startFoodsGiven) return;
  run.startFoodsGiven = true;
  if (run.practice) return;
  const nid = { value: run.nextFoodId };
  for (const fam of FAMILIES) for (let i = 0; i < BOARD.startFoodsPerFamily; i++) spawnFood(run.board, fam, 1, nid);
  run.nextFoodId = nid.value;
}

export function staffSpeed(run: RunState): number {
  return STAFF.baseSpeed * STAFF.speedMult[Math.max(0, Math.min(2, run.staffSpeedLevel))];
}

export function customerById(run: RunState, id: number): Customer | undefined {
  return run.customers.find((c) => c.id === id);
}

export function seatById(run: RunState, id: number): Seat | undefined {
  return run.seats.find((s) => s.id === id);
}

function freeSeat(run: RunState): Seat | undefined {
  return run.seats.find((s) => s.customerId === null);
}

function roundCell(c: Cell): Cell { return { x: Math.round(c.x), y: Math.round(c.y) }; }

/** 경로를 따라 dist만큼 이동. 도착하면 true. */
export function advanceMover(m: Mover, dist: number): boolean {
  while (dist > 0 && m.pathIdx < m.path.length) {
    const target = m.path[m.pathIdx];
    const dx = target.x - m.pos.x;
    const dy = target.y - m.pos.y;
    const d = Math.hypot(dx, dy);
    if (d <= dist) {
      m.pos = { x: target.x, y: target.y };
      dist -= d;
      m.pathIdx++;
    } else {
      m.pos = { x: m.pos.x + (dx / d) * dist, y: m.pos.y + (dy / d) * dist };
      dist = 0;
    }
  }
  return m.pathIdx >= m.path.length;
}

export function orderPatienceFor(run: RunState, c: Customer, seat: Seat): number {
  const def = CUSTOMER_DEFS[c.type];
  const day = dayDef(run.dayId);
  const base = def.basePatience + def.patiencePerRaw * Math.max(0, c.order.rawCost - 1);
  return Math.round((base * day.patienceMult + seat.decorBonus) * 10) / 10;
}

function seatCustomer(run: RunState, c: Customer, seat: Seat): void {
  seat.customerId = c.id;
  c.seatId = seat.id;
  const path = pathToSeat(STORE.entrance, seat, run.furniture);
  c.pos = { ...STORE.entrance };
  c.path = path ?? [];
  c.pathIdx = 0;
  c.state = 'walking';
  if (c.path.length === 0) sitDown(run, c, seat);
}

function sitDown(run: RunState, c: Customer, seat: Seat): void {
  c.accessCell = c.path.length ? { ...c.path[c.path.length - 1] } : { ...STORE.entrance };
  c.pos = { x: seat.x, y: seat.y };
  c.state = 'ordering';
  c.seatedAt = run.t;
  c.orderPatienceMax = orderPatienceFor(run, c, seat);
  c.orderPatience = c.orderPatienceMax;
  run.events.push({ kind: 'seated', customerId: c.id });
}

function leaveSeat(run: RunState, c: Customer, reason: LeaveReason): void {
  const seat = c.seatId != null ? seatById(run, c.seatId) : undefined;
  if (seat && seat.customerId === c.id) seat.customerId = null;
  c.leaveReason = reason;
  const from = c.accessCell ?? roundCell(c.pos);
  const path = pathBetween(from, STORE.entrance, run.furniture);
  c.pos = { ...from };
  c.path = path ?? [];
  c.pathIdx = 0;
  c.state = c.path.length === 0 ? 'gone' : 'leaving';
  run.events.push({ kind: 'left', customerId: c.id, reason });
}

function arriveCustomer(run: RunState, s: ScheduledArrival, pairId: number | null): Customer {
  const def = CUSTOMER_DEFS[s.type];
  const c: Customer = {
    id: run.nextCustomerId++,
    type: s.type,
    arriveAt: run.t,
    order: { items: s.order.items.map((it) => ({ ...it })), rawCost: s.order.rawCost, price: s.order.price },
    state: 'queued',
    leaveReason: null,
    seatId: null,
    accessCell: null,
    queuePatienceMax: def.queuePatience,
    queuePatience: def.queuePatience,
    orderPatienceMax: 0,
    orderPatience: 0,
    seatedAt: null,
    acceptedAt: null,
    deliveredAt: null,
    tipMult: 0,
    reservedFoodIds: [],
    eatTimer: 0,
    sale: null,
    pairWith: pairId,
    pos: { ...STORE.entrance },
    path: [],
    pathIdx: 0,
  };
  run.customers.push(c);
  run.stats.arrived++;
  run.stats.rawDemand += c.order.rawCost;
  const seat = freeSeat(run);
  if (seat) {
    seatCustomer(run, c, seat);
  } else if (run.queue.length < QUEUE_MAX) {
    run.queue.push(c.id);
    run.events.push({ kind: 'queue', customerId: c.id });
  } else {
    c.state = 'gone';
    c.leaveReason = 'full';
    run.stats.turnedAway++;
  }
  run.events.push({ kind: 'arrive', customerId: c.id });
  return c;
}

export function tipMultFor(ratio: number): number {
  if (ratio >= TIP.fullRatio) return 1;
  if (ratio >= TIP.halfRatio) return 0.5;
  return 0;
}

export function tipFor(c: Customer, mult: number): number {
  return Math.round(c.order.price * CUSTOMER_DEFS[c.type].tipRate * mult);
}

function deliver(run: RunState, c: Customer): void {
  const tip = tipFor(c, c.tipMult);
  c.state = 'eating';
  c.deliveredAt = run.t;
  c.eatTimer = CUSTOMER_DEFS[c.type].eatTime;
  c.sale = { price: c.order.price, tip };
  run.ledger.sales += c.order.price;
  run.ledger.tips += tip;
  for (const it of c.order.items) {
    const k = `${it.family}:${it.tier}`;
    run.ledger.soldByKey[k] = (run.ledger.soldByKey[k] || 0) + 1;
  }
  run.ledger.deliveries.push({
    customerId: c.id, type: c.type, price: c.order.price, tip,
    serviceWait: Math.round((run.t - (c.acceptedAt ?? run.t)) * 100) / 100,
    orderWait: Math.round(((c.acceptedAt ?? run.t) - (c.seatedAt ?? run.t)) * 100) / 100,
    items: c.order.items.map((it) => ({ ...it })), at: run.t,
  });
  run.stats.served++;
  if (c.tipMult >= 1) run.stats.happyServed++;
  run.events.push({ kind: 'delivered', customerId: c.id });
}

function tickStaff(run: RunState, dt: number): void {
  const st = run.staff;
  switch (st.phase) {
    case 'idle': {
      // 떠난 손님의 주문이 남아 있으면 버린다 (정상 흐름에서는 발생하지 않음)
      while (run.servingQueue.length) {
        const c = customerById(run, run.servingQueue[0]);
        if (c && c.state === 'accepted') break;
        run.servingQueue.shift();
      }
      if (run.servingQueue.length) {
        st.carrying = run.servingQueue[0];
        st.phase = 'pickup';
        st.timer = STAFF.pickupTime;
      }
      break;
    }
    case 'pickup': {
      st.timer -= dt;
      if (st.timer <= 0) {
        const c = st.carrying != null ? customerById(run, st.carrying) : undefined;
        const seat = c?.seatId != null ? seatById(run, c.seatId) : undefined;
        if (!c || !seat || c.state !== 'accepted') { st.phase = 'idle'; st.carrying = null; run.servingQueue = run.servingQueue.filter((id) => id !== st.carrying); break; }
        st.pos = { ...STORE.kitchen };
        st.path = pathToSeat(STORE.kitchen, seat, run.furniture) ?? [];
        st.pathIdx = 0;
        st.phase = 'toSeat';
      }
      break;
    }
    case 'toSeat': {
      if (advanceMover(st, staffSpeed(run) * dt)) { st.phase = 'handoff'; st.timer = STAFF.handoffTime; }
      break;
    }
    case 'handoff': {
      st.timer -= dt;
      if (st.timer <= 0) {
        const c = st.carrying != null ? customerById(run, st.carrying) : undefined;
        if (c && c.state === 'accepted') deliver(run, c);
        run.servingQueue = run.servingQueue.filter((id) => id !== st.carrying);
        st.carrying = null;
        const back = pathBetween(roundCell(st.pos), STORE.kitchen, run.furniture) ?? [];
        st.pos = roundCell(st.pos);
        st.path = back;
        st.pathIdx = 0;
        st.phase = back.length ? 'returning' : 'idle';
      }
      break;
    }
    case 'returning': {
      if (advanceMover(st, staffSpeed(run) * dt)) { st.phase = 'idle'; st.pos = { ...STORE.kitchen }; }
      break;
    }
  }
}

/** 게임 시간 dt(초)만큼 진행. 일시정지 중에는 호출하지 않는다. */
export function tick(run: RunState, dt: number): void {
  if (run.phase === 'ended' || dt <= 0) return;
  run.t += dt;

  // 1) 손님 도착 (영업 중, 150초 이전에 예정된 손님만)
  if (run.phase === 'open') {
    while (run.scheduleIndex < run.schedule.length && run.schedule[run.scheduleIndex].at <= run.t) {
      const idx = run.scheduleIndex++;
      const s = run.schedule[idx];
      if (s.at > TIME.lastArrival) continue;
      const pairCustomer = s.pairWith != null && s.pairWith < idx ? run.customers.find((c) => c.arriveAt === run.schedule[s.pairWith!].at && c.pairWith === null && c.type === run.schedule[s.pairWith!].type) : undefined;
      const c = arriveCustomer(run, s, pairCustomer ? pairCustomer.id : null);
      if (pairCustomer) pairCustomer.pairWith = c.id;
    }
  }

  // 2) 대기줄 인내
  for (const id of [...run.queue]) {
    const c = customerById(run, id)!;
    c.queuePatience -= dt;
    if (c.queuePatience <= 0) {
      run.queue = run.queue.filter((q) => q !== id);
      c.state = 'gone';
      c.leaveReason = 'queue_timeout';
      run.stats.leftQueue++;
      run.events.push({ kind: 'left', customerId: c.id, reason: 'queue_timeout' });
    }
  }

  // 3) 손님 상태
  for (const c of run.customers) {
    switch (c.state) {
      case 'walking': {
        if (advanceMover(c, CUSTOMER_WALK_SPEED * dt)) {
          const seat = seatById(run, c.seatId!)!;
          sitDown(run, c, seat);
        }
        break;
      }
      case 'ordering': {
        c.orderPatience -= dt;
        if (c.orderPatience <= 0) {
          c.orderPatience = 0;
          run.stats.leftOrder++;
          leaveSeat(run, c, 'order_timeout');
        }
        break;
      }
      case 'eating': {
        c.eatTimer -= dt;
        if (c.eatTimer <= 0) leaveSeat(run, c, 'served');
        break;
      }
      case 'leaving': {
        if (advanceMover(c, CUSTOMER_WALK_SPEED * dt)) c.state = 'gone';
        break;
      }
      default:
        break;
    }
  }

  // 4) 빈 좌석에 대기줄 손님 배정 (영업 중에만)
  if (run.phase === 'open') {
    while (run.queue.length) {
      const seat = freeSeat(run);
      if (!seat) break;
      const id = run.queue.shift()!;
      const c = customerById(run, id)!;
      seatCustomer(run, c, seat);
    }
  }

  // 5) 직원
  tickStaff(run, dt);

  // 6) 마감
  if (run.phase === 'open' && run.t >= TIME.dayLength) closeRun(run, false);
  if (run.phase === 'closing') {
    const pending = run.customers.some((c) => c.state === 'accepted');
    if (!pending && run.servingQueue.length === 0 && run.staff.phase === 'idle') {
      for (const c of run.customers) {
        if (c.state === 'eating' || c.state === 'leaving') {
          const seat = c.seatId != null ? seatById(run, c.seatId) : undefined;
          if (seat && seat.customerId === c.id) seat.customerId = null;
          c.state = 'gone';
          if (!c.leaveReason) c.leaveReason = 'served';
        }
      }
      run.phase = 'ended';
      run.events.push({ kind: 'ended' });
    }
  }
}

/** 마감: 새 손님·생산·합성·접수 종료. 미확정 주문은 마감 처리. 접수된 서빙은 계속 진행. */
export function closeRun(run: RunState, aborted: boolean): void {
  if (run.phase !== 'open') return;
  run.phase = 'closing';
  run.aborted = aborted;
  for (const id of run.queue) {
    const c = customerById(run, id)!;
    c.state = 'gone';
    c.leaveReason = 'closed';
    run.stats.closedUnserved++;
  }
  run.queue = [];
  for (const c of run.customers) {
    if (c.state === 'walking' || c.state === 'ordering') {
      run.stats.closedUnserved++;
      if (c.state === 'walking') {
        const seat = c.seatId != null ? seatById(run, c.seatId) : undefined;
        if (seat && seat.customerId === c.id) seat.customerId = null;
        c.state = 'gone';
        c.leaveReason = 'closed';
      } else {
        leaveSeat(run, c, 'closed');
      }
    }
  }
  run.events.push({ kind: 'closed' });
}

// ---------- 플레이어 조작 ----------

function requireOpen(run: RunState): ActionResult {
  if (run.phase !== 'open') return { ok: false, reason: '영업이 끝났어요. 남은 서빙만 마무리합니다.' };
  return { ok: true };
}

export function actSpawn(run: RunState, family: Family): { result: ActionResult; item?: FoodItem; index?: number } {
  const g = requireOpen(run);
  if (!g.ok) return { result: g };
  const nid = { value: run.nextFoodId };
  const r = spawnFood(run.board, family, 1, nid);
  run.nextFoodId = nid.value;
  if (!r.result.ok) { run.stats.boardFullEvents++; return r; }
  run.stats.ops.spawn++;
  run.events.push({ kind: 'spawn', family, tier: 1 });
  return r;
}

export function actMerge(run: RunState, idA: number, idB: number): { result: ActionResult; item?: FoodItem; index?: number } {
  const g = requireOpen(run);
  if (!g.ok) return { result: g };
  const nid = { value: run.nextFoodId };
  const r = mergeFoods(run.board, idA, idB, run.maxTier, nid);
  run.nextFoodId = nid.value;
  if (r.result.ok) { run.stats.ops.merge++; run.events.push({ kind: 'merge', family: r.item!.family, tier: r.item!.tier }); }
  return r;
}

export function actMove(run: RunState, id: number, toIndex: number): ActionResult {
  const g = requireOpen(run);
  if (!g.ok) return g;
  const r = moveFood(run.board, id, toIndex);
  if (r.ok) run.stats.ops.move++;
  return r;
}

export function actDiscard(run: RunState, id: number): { result: ActionResult; item?: FoodItem } {
  const g = requireOpen(run);
  if (!g.ok) return { result: g };
  const r = discardFood(run.board, id);
  if (r.result.ok) run.stats.ops.discard++;
  return r;
}

/** 주문에 필요한 음식이 모두 보드에 있는가 */
export function orderReady(run: RunState, c: Customer): boolean {
  return c.state === 'ordering' && pickFoodsFor(run.board, c.order.items) !== null;
}

/** 주문 카드 탭: 음식 재확인 → 예약 → 보드에서 제거 → 서빙 대기열 등록. 중복 접수 불가. */
export function actAccept(run: RunState, customerId: number): ActionResult {
  const g = requireOpen(run);
  if (!g.ok) return g;
  const c = customerById(run, customerId);
  if (!c) return { ok: false, reason: '손님이 없어요.' };
  if (c.state !== 'ordering') return { ok: false, reason: c.state === 'accepted' ? '이미 접수한 주문이에요.' : '주문을 받을 수 없는 손님이에요.' };
  const foods = pickFoodsFor(run.board, c.order.items);
  if (!foods) return { ok: false, reason: '주문에 필요한 음식이 아직 부족해요.' };
  // 예약: 모두 보드에 있는지 재확인 후 한 번에 제거
  for (const f of foods) if (findFood(run.board, f.id) < 0) return { ok: false, reason: '음식이 바뀌었어요. 다시 시도해 주세요.' };
  for (const f of foods) run.board[findFood(run.board, f.id)] = null;
  c.reservedFoodIds = foods.map((f) => f.id);
  c.state = 'accepted';
  c.acceptedAt = run.t;
  c.tipMult = tipMultFor(c.orderPatienceMax > 0 ? c.orderPatience / c.orderPatienceMax : 0);
  run.servingQueue.push(c.id);
  run.stats.ops.accept++;
  run.events.push({ kind: 'accepted', customerId: c.id });
  return { ok: true };
}

export function actAbort(run: RunState): ActionResult {
  if (run.phase !== 'open') return { ok: false, reason: '이미 마감 중이에요.' };
  closeRun(run, true);
  return { ok: true };
}

/** 특정 음식(계열·단계)을 기다리는 주문 손님 ID */
export function ordersWaitingFor(run: RunState, family: Family, tier: number): Customer[] {
  return run.customers.filter((c) => c.state === 'ordering' && c.order.items.some((it) => it.family === family && it.tier === tier));
}

export function activeOrders(run: RunState): Customer[] {
  return run.customers.filter((c) => c.state === 'ordering' || c.state === 'accepted');
}

export function emptyCells(run: RunState): number { return countEmpty(run.board); }

export function timeLeft(run: RunState): number { return Math.max(0, TIME.dayLength - run.t); }

export function drainEvents(run: RunState) {
  const ev = run.events;
  run.events = [];
  return ev;
}
