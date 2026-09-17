// 장비 모양의 회전·정규화. 순수 함수.
import type { Cell } from '../data/equipment';

export type Rot = 0 | 1 | 2 | 3;

/** 90도 시계방향 회전을 rot번 적용한 뒤 (minX, minY)가 (0,0)이 되도록 정규화한다. 결과는 정렬되어 비교 가능. */
export function rotateCells(cells: readonly Cell[], rot: Rot): Cell[] {
  let cur: Cell[] = cells.map(c => [c[0], c[1]] as Cell);
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) cur = cur.map(([x, y]) => [-y, x] as Cell);
  return normalize(cur);
}

export function normalize(cells: readonly Cell[]): Cell[] {
  let mx = Infinity, my = Infinity;
  for (const [x, y] of cells) { if (x < mx) mx = x; if (y < my) my = y; }
  const out = cells.map(([x, y]) => [x - mx, y - my] as Cell);
  out.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return out;
}

export function sameCells(a: readonly Cell[], b: readonly Cell[]): boolean {
  if (a.length !== b.length) return false;
  const na = normalize(a), nb = normalize(b);
  for (let i = 0; i < na.length; i++) if (na[i][0] !== nb[i][0] || na[i][1] !== nb[i][1]) return false;
  return true;
}

export function boundsOf(cells: readonly Cell[]): { w: number; h: number } {
  let w = 0, h = 0;
  for (const [x, y] of cells) { if (x + 1 > w) w = x + 1; if (y + 1 > h) h = y + 1; }
  return { w, h };
}

export function nextRot(r: Rot): Rot { return ((r + 1) % 4) as Rot; }
