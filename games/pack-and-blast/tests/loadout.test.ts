import { describe, it, expect } from 'vitest';
import { computeAdjacency, computeLoadout } from '../src/core/loadout';
import type { Item } from '../src/core/bag';
import type { Rot } from '../src/core/shapes';
import { EQUIPMENT } from '../src/data/equipment';

const mk = (uid: string, id: Item['id'], x: number, y: number, rot: Rot = 0, grade: Item['grade'] = 1, loc: Item['loc'] = 'bag'): Item => ({ uid, id, grade, rot, x, y, loc });

describe('인접 판정', () => {
  it('상하좌우 연결만 인정하고 대각선은 제외한다', () => {
    // 렌즈 (1,1) 과 렌즈 (2,2): 대각선
    const adj = computeAdjacency([mk('a', 'lens', 1, 1), mk('b', 'lens', 2, 2)]);
    expect(adj.a).toEqual([]);
    const adj2 = computeAdjacency([mk('a', 'lens', 1, 1), mk('b', 'lens', 2, 1)]);
    expect(adj2.a).toEqual(['b']); expect(adj2.b).toEqual(['a']);
  });
  it('외접 사각형이 가까워도 실제 칸이 닿지 않으면 인접이 아니다', () => {
    // mg L자: (1,0),(1,1),(1,2),(2,2). 렌즈를 (2,0)에 두면 (1,0)과 인접. (3,1)에 두면 안 닿음.
    expect(computeAdjacency([mk('mg', 'mg', 1, 0), mk('l', 'lens', 3, 1)]).mg).toEqual([]);
    expect(computeAdjacency([mk('mg', 'mg', 1, 0), mk('l', 'lens', 2, 0)]).mg).toEqual(['l']);
  });
  it('여러 칸이 맞닿아도 같은 쌍은 한 번만', () => {
    // 탄약상자 2x2 (1,1) 와 방패 2x2 (3,1): 두 칸이 맞닿음
    const adj = computeAdjacency([mk('a', 'ammo', 1, 1), mk('b', 'shield', 3, 1)]);
    expect(adj.a).toEqual(['b']);
  });
  it('작업대 장비는 연결 계산에서 제외된다', () => {
    const lo = computeLoadout([mk('mg', 'mg', 1, 0), mk('bat', 'battery', 2, 0, 0, 1, 'bench')]);
    expect(lo.weapons[0].links.length).toBe(0);
    expect(lo.weapons[0].interval).toBe(EQUIPMENT.mg.weapon!.interval[0]);
  });
});

describe('지원 효과 계산', () => {
  it('배터리는 기계 장비의 실제 공격 간격을 줄인다', () => {
    const lo = computeLoadout([mk('mg', 'mg', 1, 0), mk('bat', 'battery', 2, 0)]);
    const w = lo.weapons[0];
    expect(w.interval).toBeCloseTo(0.16 * 0.82, 5);
    expect(w.links[0].applied).toBe(true);
    // 산탄총(탄도만)에는 적용되지 않고 이유가 남는다
    const lo2 = computeLoadout([mk('sg', 'shotgun', 1, 1), mk('bat', 'battery', 1, 2)]);
    expect(lo2.weapons[0].interval).toBe(0.9);
    expect(lo2.weapons[0].links[0].applied).toBe(false);
    expect(lo2.weapons[0].links[0].reason).toContain('태그 불일치');
  });
  it('같은 종류 지원은 가장 강한 하나만 적용되고, 다른 종류는 함께 적용된다', () => {
    // mg (1,0)~(2,2). 배터리1 (2,0)-(2,1) 1등급, 배터리2 (0,1)-(0,2) 2등급, 냉각기 (3,2)-(3,3)-(4,3)
    const lo = computeLoadout([mk('mg', 'mg', 1, 0), mk('b1', 'battery', 2, 0, 0, 1), mk('b2', 'battery', 0, 1, 0, 2), mk('c', 'cooler', 3, 2, 0, 1)]);
    const w = lo.weapons[0];
    expect(w.interval).toBeCloseTo(0.16 * 0.74, 5); // 2등급만
    expect(w.links.filter(l => l.type === 'battery' && l.applied).length).toBe(1);
    expect(w.links.find(l => l.supportUid === 'b1')!.applied).toBe(false);
    expect(w.heat!.coolRate).toBeCloseTo(EQUIPMENT.mg.weapon!.heat![0].coolRate * 1.6, 5);
  });
  it('장비를 옮기면 이전 연결이 사라지고 회전·이동을 반복해도 효과가 누적되지 않는다', () => {
    const items = [mk('mg', 'mg', 1, 0), mk('bat', 'battery', 2, 0)];
    const a = computeLoadout(items).weapons[0].interval;
    items[1].x = 3; items[1].y = 3;
    expect(computeLoadout(items).weapons[0].interval).toBe(0.16);
    items[1].x = 2; items[1].y = 0;
    for (let i = 0; i < 10; i++) { items[0].rot = ((items[0].rot + 1) % 4) as Rot; items[0].rot = 0; computeLoadout(items); }
    expect(computeLoadout(items).weapons[0].interval).toBeCloseTo(a, 9);
  });
  it('탄약상자·렌즈·냉각기는 태그에 맞는 무기에만 적용된다', () => {
    const lo = computeLoadout([mk('laser', 'laser', 1, 0), mk('lens', 'lens', 2, 0), mk('ammo', 'ammo', 2, 1)]);
    const w = lo.weapons[0];
    expect(w.lensMul).toBe(0.4);
    expect(w.ammoEvery).toBeUndefined(); // 레이저는 탄도가 아님
    const lo2 = computeLoadout([mk('sg', 'shotgun', 1, 1), mk('ammo', 'ammo', 1, 2)]);
    expect(lo2.weapons[0].ammoEvery).toBe(4);
  });
  it('보호막·회복은 가방 안 생존 장비의 합이고 작업대 장비는 제외', () => {
    const lo = computeLoadout([mk('s1', 'shield', 1, 1), mk('s2', 'shield', 3, 1, 0, 2), mk('m', 'medkit', 1, 3), mk('m2', 'medkit', 0, 0, 0, 1, 'bench')]);
    expect(lo.shield).toBe(80); expect(lo.heal).toBe(12);
  });
});
