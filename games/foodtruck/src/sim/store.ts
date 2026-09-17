// 가게 격자: 가구 배치 검증, BFS 경로 탐색, 장식 보너스.
import { STORE, DEFAULT_LAYOUT, type Cell, type FurnitureKind } from '../data/store';
import { DECOR, SEATS } from '../data/balance';
import type { Furniture } from './types';

export function cellKey(c: Cell): string { return `${c.x},${c.y}`; }
export function sameCell(a: Cell, b: Cell): boolean { return a.x === b.x && a.y === b.y; }
export function inside(c: Cell): boolean { return c.x >= 0 && c.y >= 0 && c.x < STORE.cols && c.y < STORE.rows; }
export function isFixedCell(c: Cell): boolean { return sameCell(c, STORE.kitchen) || sameCell(c, STORE.entrance); }

export function neighbors4(c: Cell): Cell[] {
  return [
    { x: c.x + 1, y: c.y }, { x: c.x - 1, y: c.y },
    { x: c.x, y: c.y + 1 }, { x: c.x, y: c.y - 1 },
  ].filter(inside);
}

export function blockedSet(furniture: Furniture[]): Set<string> {
  const s = new Set<string>();
  for (const f of furniture) s.add(cellKey(f));
  return s;
}

/**
 * BFS. start에서 goal(c)이 참인 가장 가까운 칸까지의 경로를 돌려준다.
 * 경로는 start를 제외하고 도착 칸을 포함한다. start가 이미 goal이면 []. 없으면 null.
 */
export function bfsPath(start: Cell, blocked: Set<string>, goal: (c: Cell) => boolean): Cell[] | null {
  if (!inside(start) || blocked.has(cellKey(start))) return null;
  if (goal(start)) return [];
  const prev = new Map<string, string | null>();
  const q: Cell[] = [start];
  prev.set(cellKey(start), null);
  while (q.length) {
    const c = q.shift()!;
    for (const n of neighbors4(c)) {
      const k = cellKey(n);
      if (prev.has(k) || blocked.has(k)) continue;
      prev.set(k, cellKey(c));
      if (goal(n)) {
        const path: Cell[] = [];
        let cur: string | null = k;
        while (cur && cur !== cellKey(start)) {
          const [x, y] = cur.split(',').map(Number);
          path.push({ x, y });
          cur = prev.get(cur) ?? null;
        }
        return path.reverse();
      }
      q.push(n);
    }
  }
  return null;
}

/** 좌석 옆(상하좌우) 통행 가능한 칸까지의 최단 경로 */
export function pathToSeat(from: Cell, seat: Cell, furniture: Furniture[]): Cell[] | null {
  const blocked = blockedSet(furniture);
  const goal = (c: Cell) => Math.abs(c.x - seat.x) + Math.abs(c.y - seat.y) === 1;
  return bfsPath(from, blocked, goal);
}

export function pathBetween(from: Cell, to: Cell, furniture: Furniture[]): Cell[] | null {
  const blocked = blockedSet(furniture);
  return bfsPath(from, blocked, (c) => sameCell(c, to));
}

export function seatsOf(furniture: Furniture[]): Furniture[] {
  return furniture.filter((f) => f.kind === 'seat');
}

/** 좌석과 상하좌우로 인접한 장식 수 × 5초, 상한 10초. 같은 장식은 한 번만 센다. */
export function decorBonusForSeat(seat: Cell, furniture: Furniture[]): number {
  const seen = new Set<number>();
  let n = 0;
  for (const f of furniture) {
    if (f.kind !== 'decor' || seen.has(f.id)) continue;
    if (Math.abs(f.x - seat.x) + Math.abs(f.y - seat.y) === 1) { seen.add(f.id); n++; }
  }
  return Math.min(DECOR.capSec, n * DECOR.perDecorSec);
}

export interface LayoutCheck {
  ok: boolean;
  problems: string[];
  /** 좌석 id → 배식구에서의 경로 길이(칸 수) */
  kitchenSteps: Record<number, number>;
  entranceSteps: Record<number, number>;
}

export function validateLayout(furniture: Furniture[]): LayoutCheck {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const f of furniture) {
    if (!inside(f)) problems.push(`${f.kind === 'seat' ? '좌석' : '장식'}이 가게 밖에 있어요.`);
    if (isFixedCell(f)) problems.push('배식구나 출입구 위에는 놓을 수 없어요.');
    const k = cellKey(f);
    if (seen.has(k)) problems.push('가구가 겹쳐 있어요.');
    seen.add(k);
  }
  const seats = seatsOf(furniture);
  if (seats.length < SEATS.base) problems.push('좌석이 너무 적어요.');
  if (seats.length > SEATS.max) problems.push('좌석은 최대 4개예요.');
  const kitchenSteps: Record<number, number> = {};
  const entranceSteps: Record<number, number> = {};
  for (const s of seats) {
    const pk = pathToSeat(STORE.kitchen, s, furniture);
    const pe = pathToSeat(STORE.entrance, s, furniture);
    if (!pk) problems.push('배식구에서 갈 수 없는 좌석이 있어요.');
    else kitchenSteps[s.id] = pk.length;
    if (!pe) problems.push('출입구에서 갈 수 없는 좌석이 있어요.');
    else entranceSteps[s.id] = pe.length;
  }
  // 배식구↔출입구 통로가 막히면 안 된다
  if (!pathBetween(STORE.kitchen, STORE.entrance, furniture)) problems.push('배식구와 출입구 사이 통로가 막혔어요.');
  return { ok: problems.length === 0, problems: Array.from(new Set(problems)), kitchenSteps, entranceSteps };
}

/** 가구를 옮긴 새 배열을 돌려준다 (원본 보존). 검증 실패 시 error. */
export function moveFurniture(furniture: Furniture[], id: number, to: Cell): { ok: boolean; furniture: Furniture[]; problems: string[] } {
  const f = furniture.find((x) => x.id === id);
  if (!f) return { ok: false, furniture, problems: ['가구를 찾을 수 없어요.'] };
  if (!inside(to)) return { ok: false, furniture, problems: ['가게 밖이에요.'] };
  if (isFixedCell(to)) return { ok: false, furniture, problems: ['배식구나 출입구 위에는 놓을 수 없어요.'] };
  if (furniture.some((x) => x.id !== id && sameCell(x, to))) return { ok: false, furniture, problems: ['이미 가구가 있는 칸이에요.'] };
  const next = furniture.map((x) => (x.id === id ? { ...x, x: to.x, y: to.y } : x));
  const chk = validateLayout(next);
  return { ok: chk.ok, furniture: chk.ok ? next : furniture, problems: chk.problems };
}

/** 새 가구를 놓을 수 있는 첫 칸을 찾아 추가한다. */
export function addFurniture(furniture: Furniture[], kind: FurnitureKind, id: number): { ok: boolean; furniture: Furniture[]; problems: string[] } {
  // 배식구/출입구에서 먼 곳보다 가운데부터 시도 (플레이어가 옮기기 쉬움)
  const order: Cell[] = [];
  for (let y = 0; y < STORE.rows; y++) for (let x = 0; x < STORE.cols; x++) order.push({ x, y });
  order.sort((a, b) => (Math.abs(a.x - 2.5) + Math.abs(a.y - 1.5)) - (Math.abs(b.x - 2.5) + Math.abs(b.y - 1.5)));
  for (const c of order) {
    if (isFixedCell(c) || furniture.some((f) => sameCell(f, c))) continue;
    const next = [...furniture, { id, kind, x: c.x, y: c.y }];
    if (validateLayout(next).ok) return { ok: true, furniture: next, problems: [] };
  }
  return { ok: false, furniture, problems: ['놓을 자리가 없어요. 가구를 옮겨 공간을 만들어 주세요.'] };
}

export function defaultLayout(): { furniture: Furniture[]; nextId: number } {
  const furniture = DEFAULT_LAYOUT.map((f, i) => ({ id: i + 1, kind: f.kind, x: f.x, y: f.y }));
  return { furniture, nextId: furniture.length + 1 };
}

/** 경로 길이(칸 수)를 이동 시간(초)으로 */
export function travelTime(steps: number, speedCellsPerSec: number): number {
  return steps / speedCellsPerSec;
}
