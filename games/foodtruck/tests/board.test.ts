import { describe, it, expect } from 'vitest';
import { emptyBoard, spawnFood, mergeFoods, moveFood, discardFood, countEmpty, findEmptyCell, mergeCandidates, pickFoodsFor, BOARD_SIZE } from '../src/sim/board';
import { makeRun, makeBot, advance, metaWith } from './helpers';
import { actSpawn, actMerge, actDiscard, actMove } from '../src/sim/run';

describe('합성 보드', () => {
  it('같은 계열·같은 단계만 합성된다', () => {
    const b = emptyBoard(); const id = { value: 1 };
    const a = spawnFood(b, 'grill', 1, id).item!;
    const c = spawnFood(b, 'grill', 1, id).item!;
    const d = spawnFood(b, 'drink', 1, id).item!;
    const e = spawnFood(b, 'grill', 2, id).item!;
    expect(mergeFoods(b, a.id, d.id, 4, id).result.ok).toBe(false); // 다른 계열
    expect(mergeFoods(b, a.id, e.id, 4, id).result.ok).toBe(false); // 다른 단계
    const r = mergeFoods(b, a.id, c.id, 4, id);
    expect(r.result.ok).toBe(true);
    expect(r.item).toMatchObject({ family: 'grill', tier: 2 });
    expect(b.filter(Boolean).length).toBe(3); // 4개 → 3개
  });

  it('같은 인스턴스를 자기 자신과 합칠 수 없다', () => {
    const b = emptyBoard(); const id = { value: 1 };
    const a = spawnFood(b, 'grill', 1, id).item!;
    const r = mergeFoods(b, a.id, a.id, 4, id);
    expect(r.result.ok).toBe(false);
    expect(b.filter(Boolean).length).toBe(1);
  });

  it('최고 단계(그날 상한)에서 합성이 막힌다', () => {
    const b = emptyBoard(); const id = { value: 1 };
    const a = spawnFood(b, 'dessert', 2, id).item!;
    const c = spawnFood(b, 'dessert', 2, id).item!;
    expect(mergeFoods(b, a.id, c.id, 2, id).result.ok).toBe(false); // 1일차 상한 2
    expect(mergeFoods(b, a.id, c.id, 3, id).result.ok).toBe(true);
    const x = spawnFood(b, 'dessert', 4, id).item!;
    const y = spawnFood(b, 'dessert', 4, id).item!;
    expect(mergeFoods(b, x.id, y.id, 4, id).result.ok).toBe(false);
  });

  it('합성 결과는 두 번째로 선택한 칸에 생성된다', () => {
    const b = emptyBoard(); const id = { value: 1 };
    const a = spawnFood(b, 'drink', 1, id); const c = spawnFood(b, 'drink', 1, id);
    const r = mergeFoods(b, a.item!.id, c.item!.id, 4, id);
    expect(r.index).toBe(c.index);
    expect(b[a.index!]).toBeNull();
  });

  it('합성·이동·정리 중 음식이 복제되지 않는다 (ID 유일)', () => {
    const b = emptyBoard(); const id = { value: 1 };
    for (let i = 0; i < 10; i++) spawnFood(b, 'grill', 1, id);
    for (let k = 0; k < 4; k++) {
      const ids = b.filter((c) => c && c.tier === 1).map((c) => c!.id);
      mergeFoods(b, ids[0], ids[1], 4, id);
    }
    moveFood(b, b.find(Boolean)!.id, findEmptyCell(b));
    const seen = new Set<number>();
    for (const c of b) if (c) { expect(seen.has(c.id)).toBe(false); seen.add(c.id); }
    const total1 = b.filter((c) => c && c.tier === 1).length; const total2 = b.filter((c) => c && c.tier === 2).length;
    expect(total1 + total2 * 2).toBe(10); // 원료 보존
    const anyId = b.find(Boolean)!.id;
    discardFood(b, anyId);
    expect(b.some((c) => c?.id === anyId)).toBe(false);
  });

  it('빈칸이 없으면 생성이 막히고, 정리·합성은 가능하다', () => {
    const b = emptyBoard(); const id = { value: 1 };
    for (let i = 0; i < BOARD_SIZE; i++) expect(spawnFood(b, 'grill', 1, id).result.ok).toBe(true);
    expect(countEmpty(b)).toBe(0);
    expect(spawnFood(b, 'grill', 1, id).result.ok).toBe(false);
    const ids = b.map((c) => c!.id);
    expect(mergeFoods(b, ids[0], ids[1], 4, id).result.ok).toBe(true);
    expect(countEmpty(b)).toBe(1);
    expect(discardFood(b, ids[2]).result.ok).toBe(true);
    expect(countEmpty(b)).toBe(2);
  });

  it('빈칸 선택 규칙은 안정적이다 (아래 행부터 왼쪽→오른쪽)', () => {
    const b = emptyBoard(); const id = { value: 1 };
    expect(spawnFood(b, 'grill', 1, id).index).toBe(20);
    expect(spawnFood(b, 'grill', 1, id).index).toBe(21);
  });

  it('합성 후보와 주문용 음식 선택', () => {
    const b = emptyBoard(); const id = { value: 1 };
    const a = spawnFood(b, 'grill', 1, id).item!;
    spawnFood(b, 'grill', 1, id); spawnFood(b, 'grill', 2, id); spawnFood(b, 'drink', 1, id);
    expect(mergeCandidates(b, a.id, 4).length).toBe(1);
    expect(pickFoodsFor(b, [{ family: 'grill', tier: 1 }, { family: 'grill', tier: 1 }])!.length).toBe(2);
    expect(pickFoodsFor(b, [{ family: 'grill', tier: 2 }, { family: 'grill', tier: 2 }])).toBeNull();
    // 높은 단계를 낮은 단계 주문에 대체 소비하지 않는다
    expect(pickFoodsFor(b, [{ family: 'drink', tier: 1 }, { family: 'drink', tier: 1 }])).toBeNull();
  });

  it('영업 중 조작은 실행 상태를 통해 계수된다', () => {
    const run = makeRun(1, 7);
    const before = run.board.filter(Boolean).length;
    expect(before).toBe(6); // 시작 음식 6개
    const r = actSpawn(run, 'drink');
    expect(r.result.ok).toBe(true);
    expect(run.stats.ops.spawn).toBe(1);
    const drinks = run.board.filter((c) => c && c.family === 'drink' && c.tier === 1).map((c) => c!.id);
    expect(actMerge(run, drinks[0], drinks[1]).result.ok).toBe(true);
    expect(run.stats.ops.merge).toBe(1);
    const any = run.board.find(Boolean)!;
    expect(actMove(run, any.id, findEmptyCell(run.board)).ok).toBe(true);
    expect(actDiscard(run, any.id).result.ok).toBe(true);
    expect(run.board.some((c) => c?.id === any.id)).toBe(false);
  });

  it('시작 음식은 실행당 한 번만 지급된다', () => {
    const run = makeRun(1, 7);
    expect(run.startFoodsGiven).toBe(true);
    expect(run.board.filter(Boolean).length).toBe(6);
  });
});
