// 경영 효과 검증: 같은 주문·같은 손님 조건에서 배치·장식·직원 속도가 실제 결과를 바꾸는지.
import { describe, it, expect } from 'vitest';
import { STAFF, DECOR } from '../src/data/balance';
import { STORE } from '../src/data/store';
import { makeRun, advance, metaWith, STEP } from './helpers';
import { actAccept, tick, drainEvents } from '../src/sim/run';
import { pathToSeat } from '../src/sim/store';
import type { Furniture, RunState } from '../src/sim/types';

const seat = (id: number, x: number, y: number): Furniture => ({ id, kind: 'seat', x, y });
const decor = (id: number, x: number, y: number): Furniture => ({ id, kind: 'decor', x, y });

/** 첫 손님을 앉히고 주문 음식을 보드에 넣은 뒤 접수 → 전달까지 걸린 시간 */
function deliveryTime(run: RunState): { wait: number; steps: number } {
  advance(run, 6);
  const c = run.customers.find((x) => x.state === 'ordering')!;
  expect(c).toBeDefined();
  run.board.fill(null);
  c.order.items.forEach((it, i) => { run.board[i] = { id: 100 + i, family: it.family, tier: it.tier }; });
  expect(actAccept(run, c.id).ok).toBe(true);
  const t0 = run.t;
  let guard = 0;
  while (c.state === 'accepted' && guard++ < 5000) { tick(run, STEP); drainEvents(run); }
  const seatF = run.furniture.find((f) => f.id === c.seatId)!;
  const steps = pathToSeat(STORE.kitchen, seatF, run.furniture)!.length;
  return { wait: run.t - t0, steps };
}

export const EXPERIMENT_LOG: string[] = [];

describe('실험 A: 좌석 위치에 따른 실제 전달 시간', () => {
  it('배식구 가까운 좌석이 먼 좌석보다 빨리 전달된다 (같은 시드·같은 주문)', () => {
    // 첫 손님은 첫 번째 빈 좌석(id 1)에 앉는다.
    const near = makeRun(1, 21, metaWith({ layout: [seat(1, 1, 0), seat(2, 4, 3)] }));
    const far = makeRun(1, 21, metaWith({ layout: [seat(1, 5, 2), seat(2, 4, 3)] }));
    const a = deliveryTime(near);
    const b = deliveryTime(far);
    EXPERIMENT_LOG.push(`A: near steps=${a.steps} wait=${a.wait.toFixed(2)}s / far steps=${b.steps} wait=${b.wait.toFixed(2)}s`);
    expect(a.steps).toBe(0);
    expect(b.steps).toBeGreaterThanOrEqual(6);
    expect(b.wait).toBeGreaterThan(a.wait + 2);
    // 기대값: 고정 시간 + 경로/속도
    const expectedNear = STAFF.pickupTime + STAFF.handoffTime;
    const expectedFar = expectedNear + b.steps / STAFF.baseSpeed;
    expect(Math.abs(a.wait - expectedNear)).toBeLessThan(0.15);
    expect(Math.abs(b.wait - expectedFar)).toBeLessThan(0.15);
  });
});

describe('실험 B: 장식 인접 여부에 따른 주문 인내 시간', () => {
  it('장식이 인접한 좌석의 손님은 인내 시간이 +5초/+10초 늘어난다', () => {
    const base = makeRun(1, 21, metaWith({ layout: [seat(1, 2, 2), seat(2, 4, 1)] }));
    const one = makeRun(1, 21, metaWith({ layout: [seat(1, 2, 2), seat(2, 4, 1), decor(3, 2, 1)] }));
    const two = makeRun(1, 21, metaWith({ layout: [seat(1, 2, 2), seat(2, 4, 1), decor(3, 2, 1), decor(4, 3, 2)] }));
    const three = makeRun(1, 21, metaWith({ layout: [seat(1, 2, 2), seat(2, 4, 1), decor(3, 2, 1), decor(4, 3, 2), decor(5, 1, 2)] }));
    const diag = makeRun(1, 21, metaWith({ layout: [seat(1, 2, 2), seat(2, 4, 1), decor(3, 3, 3)] }));
    const first = (r: RunState) => { advance(r, 6); return r.customers.find((c) => c.state === 'ordering')!; };
    const p0 = first(base).orderPatienceMax, p1 = first(one).orderPatienceMax, p2 = first(two).orderPatienceMax, p3 = first(three).orderPatienceMax, pd = first(diag).orderPatienceMax;
    EXPERIMENT_LOG.push(`B: patience none=${p0}s one=${p1}s two=${p2}s three=${p3}s diagonal=${pd}s`);
    expect(p1 - p0).toBeCloseTo(DECOR.perDecorSec, 5);
    expect(p2 - p0).toBeCloseTo(DECOR.capSec, 5);
    expect(p3 - p0).toBeCloseTo(DECOR.capSec, 5); // 상한
    expect(pd).toBe(p0); // 대각선은 인접 아님
  });
});

describe('실험 C: 직원 속도 강화에 따른 이동 시간', () => {
  it('같은 경로에서 강화 단계가 높을수록 전달이 빠르다', () => {
    const layout = [seat(1, 5, 2), seat(2, 4, 3)];
    const r0 = deliveryTime(makeRun(1, 21, metaWith({ layout, speed: 0 })));
    const r1 = deliveryTime(makeRun(1, 21, metaWith({ layout, speed: 1 })));
    const r2 = deliveryTime(makeRun(1, 21, metaWith({ layout, speed: 2 })));
    EXPERIMENT_LOG.push(`C: steps=${r0.steps} speed0=${r0.wait.toFixed(2)}s speed1=${r1.wait.toFixed(2)}s speed2=${r2.wait.toFixed(2)}s`);
    expect(r0.steps).toBe(r1.steps);
    expect(r1.wait).toBeLessThan(r0.wait);
    expect(r2.wait).toBeLessThan(r1.wait);
    const fixed = STAFF.pickupTime + STAFF.handoffTime;
    expect(Math.abs((r1.wait - fixed) * STAFF.speedMult[1] - (r0.wait - fixed))).toBeLessThan(0.15);
    expect(Math.abs((r2.wait - fixed) * STAFF.speedMult[2] - (r0.wait - fixed))).toBeLessThan(0.15);
  });
});
