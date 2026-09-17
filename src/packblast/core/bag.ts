// 가방 격자와 배치 유효성. 순수 함수. 실제 점유 칸 기준으로만 판정한다.
import { EQUIPMENT, type Cell, type EquipId, type Grade } from '../data/equipment';
import { BALANCE } from '../data/balance';
import { rotateCells, type Rot } from './shapes';

export type Loc = 'bag' | 'bench';

export interface Item {
  uid: string;
  id: EquipId;
  grade: Grade;
  rot: Rot;
  x: number;   // 가방 안일 때 기준 칸(정규화된 모양의 (0,0))의 위치
  y: number;
  loc: Loc;
}

export interface BagGrid { size: number; locked: boolean[] }

export function cellIndex(x: number, y: number, size = BALANCE.bagSize): number { return y * size + x; }

export function initialBag(): BagGrid {
  const size = BALANCE.bagSize;
  const locked = new Array(size * size).fill(false);
  for (const [x, y] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]) locked[cellIndex(x, y, size)] = true;
  return { size, locked };
}

export function lockedIndices(grid: BagGrid): number[] { return grid.locked.map((l, i) => (l ? i : -1)).filter(i => i >= 0); }

/** 장비의 실제 점유 칸(절대 좌표). */
export function itemCells(item: Pick<Item, 'id' | 'rot' | 'x' | 'y'>): Cell[] {
  return rotateCells(EQUIPMENT[item.id].shape, item.rot).map(([cx, cy]) => [cx + item.x, cy + item.y] as Cell);
}

export function occupancy(items: readonly Item[], grid: BagGrid): Map<number, string> {
  const m = new Map<number, string>();
  for (const it of items) if (it.loc === 'bag') for (const [x, y] of itemCells(it)) m.set(cellIndex(x, y, grid.size), it.uid);
  return m;
}

export type CellProblem = 'outside' | 'locked' | 'occupied';
export const PROBLEM_TEXT: Record<CellProblem, string> = { outside: '가방 밖', locked: '잠긴 칸', occupied: '다른 장비와 겹침' };

export interface PlacementCheck {
  ok: boolean;
  cells: { x: number; y: number; problem?: CellProblem; withUid?: string }[];
  reasons: string[];
}

/**
 * 배치 검사. ignoreUid는 이동 중인 장비(자기 자신의 기존 칸은 비어 있는 것으로 본다).
 * 가방 밖·잠긴 칸·다른 장비 위에는 놓을 수 없다. L자 빈 공간은 점유하지 않는다.
 */
export function checkPlacement(grid: BagGrid, items: readonly Item[], id: EquipId, rot: Rot, x: number, y: number, ignoreUid?: string): PlacementCheck {
  const occ = occupancy(items.filter(i => i.uid !== ignoreUid), grid);
  const cells = itemCells({ id, rot, x, y });
  const out: PlacementCheck = { ok: true, cells: [], reasons: [] };
  const seen = new Set<CellProblem>();
  for (const [cx, cy] of cells) {
    let problem: CellProblem | undefined; let withUid: string | undefined;
    if (cx < 0 || cy < 0 || cx >= grid.size || cy >= grid.size) problem = 'outside';
    else if (grid.locked[cellIndex(cx, cy, grid.size)]) problem = 'locked';
    else { const u = occ.get(cellIndex(cx, cy, grid.size)); if (u) { problem = 'occupied'; withUid = u; } }
    if (problem) { out.ok = false; seen.add(problem); }
    out.cells.push({ x: cx, y: cy, problem, withUid });
  }
  out.reasons = [...seen].map(p => PROBLEM_TEXT[p]);
  return out;
}

export function freeCellCount(grid: BagGrid, items: readonly Item[]): number {
  const occ = occupancy(items, grid);
  let n = 0;
  for (let i = 0; i < grid.size * grid.size; i++) if (!grid.locked[i] && !occ.has(i)) n++;
  return n;
}

export function itemAt(grid: BagGrid, items: readonly Item[], x: number, y: number): Item | undefined {
  if (x < 0 || y < 0 || x >= grid.size || y >= grid.size) return undefined;
  const uid = occupancy(items, grid).get(cellIndex(x, y, grid.size));
  return uid ? items.find(i => i.uid === uid) : undefined;
}

/** 모든 가방 장비의 배치가 서로 겹치지 않고 유효한지 (저장 복원·출발 검사용). */
export function validateAll(grid: BagGrid, items: readonly Item[]): { ok: boolean; badUids: string[] } {
  const bad: string[] = [];
  const seen = new Map<number, string>();
  for (const it of items) {
    if (it.loc !== 'bag') continue;
    for (const [x, y] of itemCells(it)) {
      const idx = cellIndex(x, y, grid.size);
      if (x < 0 || y < 0 || x >= grid.size || y >= grid.size || grid.locked[idx] || (seen.has(idx) && seen.get(idx) !== it.uid)) { if (!bad.includes(it.uid)) bad.push(it.uid); }
      seen.set(idx, it.uid);
    }
  }
  return { ok: bad.length === 0, badUids: bad };
}
