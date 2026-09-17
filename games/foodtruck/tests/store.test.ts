import { describe, it, expect } from 'vitest';
import { STORE } from '../src/data/store';
import { validateLayout, pathToSeat, moveFurniture, decorBonusForSeat, defaultLayout, addFurniture, bfsPath, blockedSet } from '../src/sim/store';
import type { Furniture } from '../src/sim/types';
import { newMeta, buySeat, buyDecor, buySpeed, moveLayout, resetLayout } from '../src/sim/meta';

const seat = (id: number, x: number, y: number): Furniture => ({ id, kind: 'seat', x, y });
const decor = (id: number, x: number, y: number): Furniture => ({ id, kind: 'decor', x, y });

describe('가게 배치와 경로', () => {
  it('기본 배치는 유효하고 배식구·출입구에서 모든 좌석에 갈 수 있다', () => {
    const { furniture } = defaultLayout();
    const chk = validateLayout(furniture);
    expect(chk.ok).toBe(true);
    for (const f of furniture) { expect(chk.kitchenSteps[f.id]).toBeGreaterThanOrEqual(0); expect(chk.entranceSteps[f.id]).toBeGreaterThanOrEqual(0); }
  });

  it('BFS는 최단 경로를 찾고 막힌 칸을 통과하지 않는다', () => {
    const blocked = blockedSet([seat(1, 1, 0), seat(2, 1, 1), seat(3, 1, 2)]);
    const p = bfsPath({ x: 0, y: 0 }, blocked, (c) => c.x === 2 && c.y === 0)!;
    expect(p).not.toBeNull();
    // (0,0)→(0,1)→(0,2)→(0,3)→(1,3)→(2,3)→(2,2)→(2,1)→(2,0): 8칸
    expect(p.length).toBe(8);
    for (const c of p) expect(blocked.has(`${c.x},${c.y}`)).toBe(false);
  });

  it('출입구나 통로를 막는 배치는 거부되고 원래 상태가 보존된다', () => {
    // 배식구 (0,0)를 둘러싸기
    const bad = [seat(1, 1, 0), seat(2, 0, 1)];
    const chk = validateLayout(bad);
    expect(chk.ok).toBe(false);
    expect(chk.problems.length).toBeGreaterThan(0);
    // 고정 칸 위 배치
    expect(validateLayout([seat(1, STORE.kitchen.x, STORE.kitchen.y), seat(2, 3, 1)]).ok).toBe(false);
    expect(validateLayout([seat(1, STORE.entrance.x, STORE.entrance.y), seat(2, 3, 1)]).ok).toBe(false);
    // 겹침
    expect(validateLayout([seat(1, 2, 2), seat(2, 2, 2)]).ok).toBe(false);
    // moveFurniture 실패 시 원본 유지
    const good = [seat(1, 1, 2), seat(2, 3, 1)];
    const r = moveFurniture(good, 1, { x: 1, y: 0 }); // (0,0)를 가두려면 (0,1)도 막아야 하므로 이건 성공할 수 있음
    const r2 = moveFurniture(r.furniture, 2, { x: 0, y: 1 });
    expect(r2.ok).toBe(false);
    expect(r2.furniture).toBe(r.furniture);
  });

  it('가구를 옮기면 경로 길이가 다시 계산된다', () => {
    const near = [seat(1, 1, 0), seat(2, 3, 1)];
    const far = [seat(1, 5, 2), seat(2, 3, 1)];
    const pNear = pathToSeat(STORE.kitchen, near[0], near)!;
    const pFar = pathToSeat(STORE.kitchen, far[0], far)!;
    expect(pNear.length).toBe(0); // 배식구 바로 옆
    expect(pFar.length).toBeGreaterThan(4);
    const moved = moveFurniture(near, 1, { x: 5, y: 2 });
    expect(moved.ok).toBe(true);
    expect(pathToSeat(STORE.kitchen, moved.furniture[0], moved.furniture)!.length).toBe(pFar.length);
  });

  it('장식 효과는 상하좌우 인접만, 상한 10초, 중복 집계 없음', () => {
    const s = seat(1, 2, 2);
    expect(decorBonusForSeat(s, [s, decor(2, 2, 1)])).toBe(5);
    expect(decorBonusForSeat(s, [s, decor(2, 2, 1), decor(3, 3, 2)])).toBe(10);
    expect(decorBonusForSeat(s, [s, decor(2, 2, 1), decor(3, 3, 2), decor(4, 1, 2)])).toBe(10); // 상한
    expect(decorBonusForSeat(s, [s, decor(2, 3, 3)])).toBe(0); // 대각선
    expect(decorBonusForSeat(s, [s, decor(2, 2, 1), decor(2, 2, 1)])).toBe(5); // 같은 ID 중복 없음
  });

  it('구매: 코인 차감·상한·중복 방지, 가구가 실제 배치에 추가된다', () => {
    const m = newMeta();
    expect(buySeat(m).ok).toBe(false); // 코인 0
    m.coins = 500;
    expect(buySeat(m).ok).toBe(true); expect(m.coins).toBe(440); expect(m.layout.filter((f) => f.kind === 'seat').length).toBe(3);
    expect(buySeat(m).ok).toBe(true); expect(m.coins).toBe(320); expect(m.layout.filter((f) => f.kind === 'seat').length).toBe(4);
    expect(buySeat(m).ok).toBe(false); expect(m.coins).toBe(320); // 최대 4개
    expect(buyDecor(m).ok).toBe(true); expect(buyDecor(m).ok).toBe(true); expect(buyDecor(m).ok).toBe(false); expect(m.coins).toBe(240);
    expect(buySpeed(m).ok).toBe(true); expect(m.staffSpeedLevel).toBe(1); expect(m.coins).toBe(160);
    expect(buySpeed(m).ok).toBe(true); expect(m.staffSpeedLevel).toBe(2); expect(m.coins).toBe(0);
    expect(buySpeed(m).ok).toBe(false); expect(m.staffSpeedLevel).toBe(2);
    expect(validateLayout(m.layout).ok).toBe(true);
    const ids = new Set(m.layout.map((f) => f.id)); expect(ids.size).toBe(m.layout.length);
    // 재배치 초기화 후에도 가구 수 유지
    expect(resetLayout(m).ok).toBe(true);
    expect(m.layout.filter((f) => f.kind === 'seat').length).toBe(4);
    expect(m.layout.filter((f) => f.kind === 'decor').length).toBe(2);
  });

  it('메타 배치 이동은 검증을 거친다', () => {
    const m = newMeta();
    const first = m.layout[0];
    const r = moveLayout(m, first.id, { x: 4, y: 2 });
    expect(r.ok).toBe(true);
    expect(m.layout.find((f) => f.id === first.id)).toMatchObject({ x: 4, y: 2 });
    const bad = moveLayout(m, first.id, { x: STORE.entrance.x, y: STORE.entrance.y });
    expect(bad.ok).toBe(false);
    expect(m.layout.find((f) => f.id === first.id)).toMatchObject({ x: 4, y: 2 });
  });

  it('addFurniture는 유효한 칸을 찾는다', () => {
    const { furniture } = defaultLayout();
    const r = addFurniture(furniture, 'decor', 99);
    expect(r.ok).toBe(true);
    expect(validateLayout(r.furniture).ok).toBe(true);
  });
});
