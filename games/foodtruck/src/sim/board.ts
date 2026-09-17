// 합성 보드: 생성·이동·합성·정리. 모든 함수는 보드를 제자리에서 변경하고 결과를 돌려준다.
import { BOARD } from '../data/balance';
import type { Family } from '../data/foods';
import type { Board, FoodItem, ActionResult } from './types';

export const BOARD_SIZE = BOARD.cols * BOARD.rows;

export function emptyBoard(): Board {
  return new Array(BOARD_SIZE).fill(null);
}

export function countEmpty(board: Board): number {
  let n = 0;
  for (const c of board) if (c === null) n++;
  return n;
}

/**
 * 안정적인 빈칸 선택 규칙: 아래 행부터, 왼쪽에서 오른쪽으로.
 * (생산 버튼이 보드 아래에 있어 새 음식이 손 가까이에서 나타난다.)
 */
export function findEmptyCell(board: Board): number {
  for (let y = BOARD.rows - 1; y >= 0; y--) {
    for (let x = 0; x < BOARD.cols; x++) {
      const i = y * BOARD.cols + x;
      if (board[i] === null) return i;
    }
  }
  return -1;
}

export function findFood(board: Board, id: number): number {
  for (let i = 0; i < board.length; i++) if (board[i]?.id === id) return i;
  return -1;
}

export function spawnFood(board: Board, family: Family, tier: number, nextId: { value: number }): { result: ActionResult; item?: FoodItem; index?: number } {
  const i = findEmptyCell(board);
  if (i < 0) return { result: { ok: false, reason: '보드에 빈칸이 없어요. 합치거나 정리해 주세요.' } };
  const item: FoodItem = { id: nextId.value++, family, tier };
  board[i] = item;
  return { result: { ok: true }, item, index: i };
}

export function canMerge(a: FoodItem | null, b: FoodItem | null, maxTier: number): ActionResult {
  if (!a || !b) return { ok: false, reason: '음식이 없어요.' };
  if (a.id === b.id) return { ok: false, reason: '같은 음식이에요. 다른 음식을 골라 주세요.' };
  if (a.family !== b.family) return { ok: false, reason: '다른 계열끼리는 합칠 수 없어요.' };
  if (a.tier !== b.tier) return { ok: false, reason: '같은 단계끼리만 합칠 수 있어요.' };
  if (a.tier >= maxTier) return { ok: false, reason: '오늘 만들 수 있는 최고 단계예요. 더 합칠 수 없어요.' };
  return { ok: true };
}

/** a와 b를 합쳐 b의 칸에 상위 음식을 만든다. */
export function mergeFoods(board: Board, idA: number, idB: number, maxTier: number, nextId: { value: number }): { result: ActionResult; item?: FoodItem; index?: number } {
  const ia = findFood(board, idA);
  const ib = findFood(board, idB);
  if (ia < 0 || ib < 0) return { result: { ok: false, reason: '음식이 없어요.' } };
  const a = board[ia]!;
  const b = board[ib]!;
  const chk = canMerge(a, b, maxTier);
  if (!chk.ok) return { result: chk };
  const item: FoodItem = { id: nextId.value++, family: a.family, tier: a.tier + 1 };
  board[ia] = null;
  board[ib] = item;
  return { result: { ok: true }, item, index: ib };
}

export function moveFood(board: Board, id: number, toIndex: number): ActionResult {
  const from = findFood(board, id);
  if (from < 0) return { ok: false, reason: '음식이 없어요.' };
  if (toIndex < 0 || toIndex >= board.length) return { ok: false, reason: '잘못된 칸이에요.' };
  if (board[toIndex] !== null) return { ok: false, reason: '빈칸이 아니에요.' };
  board[toIndex] = board[from];
  board[from] = null;
  return { ok: true };
}

export function discardFood(board: Board, id: number): { result: ActionResult; item?: FoodItem } {
  const i = findFood(board, id);
  if (i < 0) return { result: { ok: false, reason: '음식이 없어요.' } };
  const item = board[i]!;
  board[i] = null;
  return { result: { ok: true }, item };
}

/** 선택한 음식과 합칠 수 있는 음식 ID 목록 */
export function mergeCandidates(board: Board, id: number, maxTier: number): number[] {
  const i = findFood(board, id);
  if (i < 0) return [];
  const a = board[i]!;
  const out: number[] = [];
  for (const c of board) if (c && canMerge(a, c, maxTier).ok) out.push(c.id);
  return out;
}

/** 계열·단계별 개수 */
export function countByKey(board: Board): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of board) if (c) { const k = `${c.family}:${c.tier}`; out[k] = (out[k] || 0) + 1; }
  return out;
}

/** 요구 항목을 충족할 실제 음식 인스턴스를 고른다(각 인스턴스는 한 번만). 부족하면 null. */
export function pickFoodsFor(board: Board, items: Array<{ family: Family; tier: number }>): FoodItem[] | null {
  const used = new Set<number>();
  const out: FoodItem[] = [];
  for (const it of items) {
    let found: FoodItem | null = null;
    for (const c of board) {
      if (c && !used.has(c.id) && c.family === it.family && c.tier === it.tier) { found = c; break; }
    }
    if (!found) return null;
    used.add(found.id);
    out.push(found);
  }
  return out;
}
