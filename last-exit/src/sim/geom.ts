// 기하·타일 유틸리티 (순수 함수)
import { TILE } from '../data/balance';

export function len(x: number, y: number): number { return Math.hypot(x, y); }
export function norm(x: number, y: number): [number, number] { const l = Math.hypot(x, y); return l > 1e-6 ? [x / l, y / l] : [0, 0]; }
export function clamp(v: number, a: number, b: number): number { return v < a ? a : v > b ? b : v; }
export function dist(ax: number, ay: number, bx: number, by: number): number { return Math.hypot(bx - ax, by - ay); }
export function angleDiff(a: number, b: number): number { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

export type Grid = { w: number; h: number; rows: string[] };

/** 이동을 막는 타일: 벽 '#', 상자더미 'o', 닫힌 문은 호출측에서 처리 */
export function blocksMove(rows: string[], tx: number, ty: number, doorOpen = true): boolean {
  if (ty < 0 || ty >= rows.length || tx < 0 || tx >= rows[0].length) return true;
  const ch = rows[ty][tx];
  if (ch === '#' || ch === 'o' || ch === 'y') return true;
  if (ch === 'D' && !doorOpen) return true;
  return false;
}
/** 시야·탄환을 막는 타일: 벽만 (상자더미는 통과) */
export function blocksShot(rows: string[], tx: number, ty: number): boolean {
  if (ty < 0 || ty >= rows.length || tx < 0 || tx >= rows[0].length) return true;
  const ch = rows[ty][tx];
  return ch === '#' || ch === 'y';
}
export function tileAt(x: number, y: number): [number, number] { return [Math.floor(x / TILE), Math.floor(y / TILE)]; }
export function tileCenter(tx: number, ty: number): [number, number] { return [(tx + 0.5) * TILE, (ty + 0.5) * TILE]; }

/** 원이 이동 차단 타일과 겹치는지 */
export function circleBlocked(rows: string[], x: number, y: number, r: number, doorOpen = true): boolean {
  const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (!blocksMove(rows, tx, ty, doorOpen)) continue;
    // 정확한 원-사각형 검사
    const cx = clamp(x, tx * TILE, (tx + 1) * TILE), cy = clamp(y, ty * TILE, (ty + 1) * TILE);
    if ((cx - x) * (cx - x) + (cy - y) * (cy - y) < r * r) return true;
  }
  return false;
}

/** 축 분리 이동: x축 먼저, 막히면 그 축은 취소. 결과 좌표 반환 */
export function moveCircle(rows: string[], x: number, y: number, dx: number, dy: number, r: number, doorOpen = true): [number, number, boolean] {
  let nx = x, ny = y, hit = false;
  if (dx !== 0) { if (!circleBlocked(rows, x + dx, y, r, doorOpen)) nx = x + dx; else { hit = true; // 작은 단계로 붙이기
      const s = Math.sign(dx); let step = Math.abs(dx); while (step > 0.5) { step *= 0.5; if (!circleBlocked(rows, nx + s * step, y, r, doorOpen)) nx += s * step; } } }
  if (dy !== 0) { if (!circleBlocked(rows, nx, y + dy, r, doorOpen)) ny = y + dy; else { hit = true;
      const s = Math.sign(dy); let step = Math.abs(dy); while (step > 0.5) { step *= 0.5; if (!circleBlocked(rows, nx, ny + s * step, r, doorOpen)) ny += s * step; } } }
  return [nx, ny, hit];
}

/** 벽(#)만 고려한 시야선. 상자더미는 통과 */
export function hasLos(rows: string[], ax: number, ay: number, bx: number, by: number): boolean {
  const dx = bx - ax, dy = by - ay; const d = Math.hypot(dx, dy);
  if (d < 1) return true;
  const steps = Math.ceil(d / (TILE * 0.4));
  for (let i = 1; i < steps; i++) {
    const t = i / steps; const [tx, ty] = tileAt(ax + dx * t, ay + dy * t);
    if (blocksShot(rows, tx, ty)) return false;
  }
  const [tx, ty] = tileAt(bx, by);
  return !blocksShot(rows, tx, ty);
}

/** 플레이어 타일에서 BFS. 각 타일의 거리(타일 수). 도달 불가 = -1 */
export function flowField(rows: string[], px: number, py: number, doorOpen: boolean): Int16Array {
  const w = rows[0].length, h = rows.length; const f = new Int16Array(w * h).fill(-1);
  let [sx, sy] = tileAt(px, py);
  if (blocksMove(rows, sx, sy, doorOpen)) { const n = nearestWalkable(rows, px, py, doorOpen); if (!n) return f; [sx, sy] = n; }
  const q: number[] = [sy * w + sx]; f[sy * w + sx] = 0; let qi = 0;
  while (qi < q.length) {
    const i = q[qi++]; const x = i % w, y = (i - x) / w; const d = f[i];
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + ox, ny = y + oy; if (blocksMove(rows, nx, ny, doorOpen)) continue;
      const j = ny * w + nx; if (f[j] !== -1) continue; f[j] = d + 1; q.push(j);
    }
  }
  return f;
}

/** 흐름장에서 목표 방향 (단위 벡터). 대각선은 두 축이 모두 열려 있을 때만 */
export function flowDir(rows: string[], f: Int16Array, x: number, y: number, doorOpen: boolean): [number, number] {
  const w = rows[0].length; const [tx, ty] = tileAt(x, y);
  const cur = f[ty * w + tx]; if (cur < 0) return [0, 0];
  if (cur === 0) return [0, 0];
  let best = cur, bx = 0, by = 0;
  for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    const nx = tx + ox, ny = ty + oy; if (blocksMove(rows, nx, ny, doorOpen)) continue;
    if (ox && oy && (blocksMove(rows, tx + ox, ty, doorOpen) || blocksMove(rows, tx, ty + oy, doorOpen))) continue;
    const v = f[ny * w + nx]; if (v >= 0 && v < best) { best = v; bx = ox; by = oy; }
  }
  if (!bx && !by) return [0, 0];
  // 타일 중심으로 향하되 현재 위치 기준 방향 계산
  const [cx, cy] = tileCenter(tx + bx, ty + by);
  return norm(cx - x, cy - y);
}

/** 가장 가까운 이동 가능 타일 (나선 탐색) */
export function nearestWalkable(rows: string[], x: number, y: number, doorOpen = true, maxR = 8): [number, number] | null {
  const [tx, ty] = tileAt(x, y);
  if (!blocksMove(rows, tx, ty, doorOpen)) return [tx, ty];
  for (let r = 1; r <= maxR; r++) for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
    if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
    if (!blocksMove(rows, tx + ox, ty + oy, doorOpen)) return [tx + ox, ty + oy];
  }
  return null;
}

/** 물건을 떨어뜨릴 유효한 위치: 플레이어 근처, 벽·상자더미 밖, 시야선 확보 */
export function dropPosition(rows: string[], x: number, y: number, rng: () => number, doorOpen = true): [number, number] {
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2; const d = 26 + rng() * 22;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    if (!circleBlocked(rows, px, py, 8, doorOpen) && hasLos(rows, x, y, px, py)) return [px, py];
  }
  const n = nearestWalkable(rows, x, y, doorOpen); if (n) return tileCenter(n[0], n[1]);
  return [x, y];
}

/** 지도에서 문자 찾기 */
export function findTiles(rows: string[], ch: string): [number, number][] {
  const out: [number, number][] = [];
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) if (rows[y][x] === ch) out.push([x, y]);
  return out;
}
export function setTile(rows: string[], tx: number, ty: number, ch: string): void {
  const r = rows[ty]; rows[ty] = r.slice(0, tx) + ch + r.slice(tx + 1);
}
/** 벡터를 최대 길이로 제한 */
export function limit(x: number, y: number, max: number): [number, number] { const l = Math.hypot(x, y); return l > max ? [x / l * max, y / l * max] : [x, y]; }
