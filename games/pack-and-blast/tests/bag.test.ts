import { describe, it, expect } from 'vitest';
import { rotateCells, sameCells, nextRot, type Rot } from '../src/core/shapes';
import { initialBag, checkPlacement, itemCells, freeCellCount, validateAll, type Item } from '../src/core/bag';
import { EQUIPMENT, EQUIP_IDS } from '../src/data/equipment';
import { createRun, placeItem, toBench, mergeItems, dismantleItem, addItem, getItem } from '../src/core/run';

const mk = (uid: string, id: Item['id'], x: number, y: number, rot: Rot = 0, loc: Item['loc'] = 'bag', grade: Item['grade'] = 1): Item => ({ uid, id, grade, rot, x, y, loc });

describe('모양 회전', () => {
  it('4번 회전하면 원래 모양으로 돌아온다 (12종 모두)', () => {
    for (const id of EQUIP_IDS) {
      const s = EQUIPMENT[id].shape;
      expect(sameCells(rotateCells(s, 0), s)).toBe(true);
      let r: Rot = 0; for (let i = 0; i < 4; i++) r = nextRot(r);
      expect(r).toBe(0);
      expect(sameCells(rotateCells(s, 3), rotateCells(rotateCells(rotateCells(s, 1), 1), 1))).toBe(true);
    }
  });
  it('회전 결과는 정규화되어 (0,0)에서 시작하고 이동하지 않는다', () => {
    for (const id of EQUIP_IDS) for (const r of [0, 1, 2, 3] as Rot[]) {
      const c = rotateCells(EQUIPMENT[id].shape, r);
      expect(Math.min(...c.map(p => p[0]))).toBe(0); expect(Math.min(...c.map(p => p[1]))).toBe(0);
      expect(c.length).toBe(EQUIPMENT[id].shape.length);
    }
  });
  it('기관총(L자)의 회전은 알려진 모양과 일치한다', () => {
    // [(0,0),(0,1),(0,2),(1,2)] 를 시계방향 90도 → 가로 3칸 + 왼쪽 아래... 정규화: [(0,0),(1,0),(2,0),(0,1)]? 실제 계산 검증
    const r1 = rotateCells(EQUIPMENT.mg.shape, 1);
    expect(r1).toEqual([[0, 0], [1, 0], [2, 0], [0, 1]]);
    const r2 = rotateCells(EQUIPMENT.mg.shape, 2);
    expect(r2).toEqual([[0, 0], [1, 0], [1, 1], [1, 2]]);
  });
});

describe('가방 배치', () => {
  const grid = initialBag();
  it('처음에는 네 모서리가 잠겨 21칸을 쓴다', () => {
    expect(freeCellCount(grid, [])).toBe(21);
  });
  it('가방 밖에는 놓을 수 없다', () => {
    const c = checkPlacement(grid, [], 'laser', 0, 2, 2); // 세로 4칸: y 2..5 → 5는 밖
    expect(c.ok).toBe(false); expect(c.reasons).toContain('가방 밖');
    expect(checkPlacement(grid, [], 'lens', 0, -1, 0).ok).toBe(false);
  });
  it('잠긴 칸에는 놓을 수 없다', () => {
    const c = checkPlacement(grid, [], 'lens', 0, 0, 0);
    expect(c.ok).toBe(false); expect(c.reasons).toContain('잠긴 칸');
  });
  it('다른 장비와 겹칠 수 없고, 문제 칸을 알려준다', () => {
    const items = [mk('a', 'shield', 1, 1)]; // (1,1),(2,1),(1,2),(2,2)
    const c = checkPlacement(grid, items, 'battery', 0, 2, 2); // (2,2),(2,3)
    expect(c.ok).toBe(false); expect(c.cells.find(x => x.x === 2 && x.y === 2)?.problem).toBe('occupied');
    expect(c.cells.find(x => x.x === 2 && x.y === 3)?.problem).toBeUndefined();
  });
  it('L자 장비의 빈 부분에는 다른 장비를 놓을 수 있다', () => {
    const items = [mk('mg', 'mg', 1, 0)]; // (1,0),(1,1),(1,2),(2,2) → (2,0),(2,1) 비어 있음
    expect(checkPlacement(grid, items, 'battery', 0, 2, 0).ok).toBe(true);
  });
  it('가장자리에서 회전하면 밖으로 나가는 경우를 올바르게 판단한다', () => {
    const okV = checkPlacement(grid, [], 'laser', 0, 1, 0); // 세로 4칸 y 0..3
    expect(okV.ok).toBe(true);
    const badH = checkPlacement(grid, [], 'laser', 1, 3, 1); // 가로 4칸 x 3..6
    expect(badH.ok).toBe(false);
    const okH = checkPlacement(grid, [], 'laser', 1, 1, 1);
    expect(okH.ok).toBe(true);
  });
  it('이동 중인 장비 자신의 칸은 비어 있는 것으로 본다', () => {
    const items = [mk('a', 'battery', 1, 1)];
    expect(checkPlacement(grid, items, 'battery', 0, 1, 2, 'a').ok).toBe(true);
    expect(checkPlacement(grid, items, 'battery', 0, 1, 2).ok).toBe(false);
  });
});

describe('판 상태에서의 배치·이동·합성·분해', () => {
  it('실패한 이동·회전은 원래 장비를 삭제하지 않는다', () => {
    const s = createRun(1, 'normal', false);
    const mg = s.items.find(i => i.id === 'mg')!;
    expect(placeItem(s, mg.uid, 1, 0, 0).ok).toBe(true);
    const before = JSON.stringify(s.items);
    const r = placeItem(s, mg.uid, 0, 0, 0); // 잠긴 칸
    expect(r.ok).toBe(false);
    expect(JSON.stringify(s.items)).toBe(before);
    expect(s.items.length).toBe(3);
  });
  it('가방↔작업대 이동 중 장비가 복제되지 않는다', () => {
    const s = createRun(2, 'normal', false);
    const n = s.items.length;
    const d = s.items.find(i => i.id === 'dagger')!;
    placeItem(s, d.uid, 1, 1, 0); toBench(s, d.uid); placeItem(s, d.uid, 2, 1, 1); toBench(s, d.uid);
    expect(s.items.length).toBe(n);
    expect(new Set(s.items.map(i => i.uid)).size).toBe(n);
  });
  it('같은 종류·같은 등급만 합성되고 결과 위치가 유효하며 복제·잘못된 삭제가 없다', () => {
    const s = createRun(3, 'normal', false);
    const mg = s.items.find(i => i.id === 'mg')!; placeItem(s, mg.uid, 1, 0, 0);
    const mg2 = addItem(s, 'mg', 1);
    const dag = s.items.find(i => i.id === 'dagger')!;
    expect(mergeItems(s, mg.uid, dag.uid).ok).toBe(false);
    const mg3 = addItem(s, 'mg', 2);
    expect(mergeItems(s, mg.uid, mg3.uid).ok).toBe(false);
    const n = s.items.length;
    expect(mergeItems(s, mg2.uid, mg.uid).ok).toBe(true); // 작업대 장비를 keep으로 넘겨도 가방 장비가 유지된다
    expect(s.items.length).toBe(n - 1);
    const kept = getItem(s, mg.uid)!;
    expect(kept.grade).toBe(2); expect(kept.loc).toBe('bag'); expect(kept.x).toBe(1);
    expect(getItem(s, mg2.uid)).toBeUndefined();
    expect(validateAll(s.grid, s.items).ok).toBe(true);
    // 3등급은 더 이상 합성 불가
    const a = addItem(s, 'lens', 3), b = addItem(s, 'lens', 3);
    expect(mergeItems(s, a.uid, b.uid).ok).toBe(false);
  });
  it('합성·분해를 반복해도 투입한 가치 이상의 부품이 생기지 않는다', () => {
    const s = createRun(4, 'normal', false);
    const p0 = s.parts;
    const a = addItem(s, 'battery', 1), b = addItem(s, 'battery', 1); // 분해 시 1+1=2
    mergeItems(s, a.uid, b.uid);
    const r = dismantleItem(s, a.uid);
    expect(r.ok && r.refund).toBe(2);
    expect(s.parts - p0).toBe(2);
    const c = addItem(s, 'ammo', 2), d = addItem(s, 'ammo', 2); // 2+2=4
    mergeItems(s, c.uid, d.uid);
    const r2 = dismantleItem(s, c.uid);
    expect(r2.ok && r2.refund).toBe(4);
  });
  it('점유 칸은 실제 모양을 따른다', () => {
    const cells = itemCells({ id: 'bomb', rot: 0, x: 2, y: 1 });
    expect(cells).toEqual([[2, 1], [3, 1], [2, 2], [3, 2], [2, 3]]);
  });
});
