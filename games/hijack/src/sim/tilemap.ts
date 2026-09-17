// 타일 격자: 충돌, 시야, 경로 탐색(BFS 흐름장). 순수 로직.
import { RULES } from '../data/rules';

export const T = { FLOOR: 0, WALL: 1, PIT: 2, CRACK: 3, DOOR: 4, EXIT: 5, VENT: 6, FLOOR_ALT: 7 } as const;
export type TileId = (typeof T)[keyof typeof T];

export class TileMap {
  readonly w: number; readonly h: number;
  readonly tiles: Uint8Array;
  /** 타일이 바뀔 때마다 증가(렌더 캐시 무효화용) */
  version = 0;
  constructor(w: number, h: number, tiles?: Uint8Array) {
    this.w = w; this.h = h; this.tiles = tiles ?? new Uint8Array(w * h);
  }
  get(tx: number, ty: number): number {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return T.WALL;
    return this.tiles[ty * this.w + tx];
  }
  set(tx: number, ty: number, v: number): void {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return;
    this.tiles[ty * this.w + tx] = v; this.version++;
  }
  /** 걸을 수 없는 타일 */
  solidForWalk(tx: number, ty: number): boolean {
    const t = this.get(tx, ty);
    return t === T.WALL || t === T.PIT || t === T.CRACK || t === T.DOOR;
  }
  /** 직선 투사체를 막는 타일(구덩이는 통과) */
  solidForShot(tx: number, ty: number): boolean {
    const t = this.get(tx, ty);
    return t === T.WALL || t === T.CRACK || t === T.DOOR;
  }
  solidAtPoint(x: number, y: number, forShot = false): boolean {
    const s = RULES.tile; const tx = Math.floor(x / s), ty = Math.floor(y / s);
    return forShot ? this.solidForShot(tx, ty) : this.solidForWalk(tx, ty);
  }
  /** 정사각 히트박스(반지름 r)가 걷기 불가 타일과 겹치는가 */
  boxBlocked(x: number, y: number, r: number): boolean {
    const s = RULES.tile;
    const x0 = Math.floor((x - r) / s), x1 = Math.floor((x + r - 0.01) / s);
    const y0 = Math.floor((y - r) / s), y1 = Math.floor((y + r - 0.01) / s);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solidForWalk(tx, ty)) return true;
    return false;
  }
  /** 두 점 사이 직선 시야(투사체 기준 벽만 막음) */
  lineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    const s = RULES.tile;
    const dx = x1 - x0, dy = y1 - y0; const dist = Math.hypot(dx, dy);
    if (dist < 1) return true;
    const steps = Math.ceil(dist / (s * 0.35));
    for (let i = 1; i < steps; i++) {
      const t = i / steps; if (this.solidAtPoint(x0 + dx * t, y0 + dy * t, true)) return false;
    }
    return true;
  }
  /**
   * 플레이어 위치를 기준으로 한 BFS 거리장. 각 타일에 목표까지의 걸음 수(도달 불가 = -1).
   * 대각선은 두 직교 이웃이 모두 열려 있을 때만 허용(모서리 끼임 방지).
   */
  flowField(tx: number, ty: number, blocked?: Set<number>): Int32Array {
    const dist = new Int32Array(this.w * this.h).fill(-1);
    if (this.solidForWalk(tx, ty)) return dist;
    const isBlocked = (x: number, y: number): boolean => this.solidForWalk(x, y) || (!!blocked && blocked.has(y * this.w + x));
    const q: number[] = [ty * this.w + tx]; dist[ty * this.w + tx] = 0;
    let head = 0;
    while (head < q.length) {
      const cur = q[head++]; const cx = cur % this.w, cy = (cur / this.w) | 0; const d = dist[cur];
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const nx = cx + ox, ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
        if (isBlocked(nx, ny)) continue;
        if (ox && oy && (isBlocked(cx + ox, cy) || isBlocked(cx, cy + oy))) continue;
        const ni = ny * this.w + nx;
        if (dist[ni] !== -1) continue;
        dist[ni] = d + 1; q.push(ni);
      }
    }
    return dist;
  }
  /** 거리장에서 (tx,ty)의 가장 낮은 이웃 방향. 동률이면 목표점(goal)에 유클리드로 더 가까운 쪽(지그재그 방지). 없으면 null */
  nextStep(field: Int32Array, tx: number, ty: number, goal?: { x: number; y: number }): { tx: number; ty: number } | null {
    const here = field[ty * this.w + tx]; if (here <= 0) return null;
    let best: { tx: number; ty: number } | null = null; let bd = here; let be = Infinity;
    const s = RULES.tile;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const nx = tx + ox, ny = ty + oy;
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      if (ox && oy && (this.solidForWalk(tx + ox, ty) || this.solidForWalk(tx, ty + oy))) continue;
      const d = field[ny * this.w + nx];
      if (d < 0 || d > bd) continue;
      const eu = goal ? Math.hypot(nx * s + s / 2 - goal.x, ny * s + s / 2 - goal.y) : 0;
      if (d < bd || eu < be) { bd = d; be = eu; best = { tx: nx, ty: ny }; }
    }
    return best;
  }
  /** BFS 경로(타일 목록). 봇/테스트용 */
  path(sx: number, sy: number, tx: number, ty: number, blocked?: Set<number>): { tx: number; ty: number }[] | null {
    const field = this.flowField(tx, ty, blocked);
    if (field[sy * this.w + sx] < 0) return null;
    const out: { tx: number; ty: number }[] = []; let cx = sx, cy = sy; let guard = 0;
    const goal = { x: tx * RULES.tile + RULES.tile / 2, y: ty * RULES.tile + RULES.tile / 2 };
    while (!(cx === tx && cy === ty) && guard++ < 4000) {
      const n = this.nextStep(field, cx, cy, goal); if (!n) return null; out.push(n); cx = n.tx; cy = n.ty;
    }
    return out;
  }
}

/**
 * 원형 개체를 타일과 충돌시키며 이동. 축별 분리 이동으로 벽을 따라 미끄러짐.
 * 모서리에 걸리면 살짝 밀어 들러붙지 않게 함.
 */
export function moveWithCollision(map: TileMap, x: number, y: number, dx: number, dy: number, r: number): { x: number; y: number; hitX: boolean; hitY: boolean } {
  const hb = r * 0.82; let hitX = false, hitY = false;
  let nx = x + dx;
  if (map.boxBlocked(nx, y, hb)) {
    // 여러 단계로 접근해서 벽 바로 앞까지
    const steps = 4; nx = x;
    for (let i = 1; i <= steps; i++) { const tx = x + (dx * i) / steps; if (map.boxBlocked(tx, y, hb)) break; nx = tx; }
    hitX = true;
    // 모서리 미끄러짐: 위/아래로 살짝 비켜갈 수 있으면 비킴
    if (Math.abs(dy) < 0.01) {
      const nudge = hb * 0.5;
      if (!map.boxBlocked(x + dx, y - nudge, hb) && !map.boxBlocked(x, y - nudge, hb)) y -= Math.min(nudge, Math.abs(dx));
      else if (!map.boxBlocked(x + dx, y + nudge, hb) && !map.boxBlocked(x, y + nudge, hb)) y += Math.min(nudge, Math.abs(dx));
    }
  }
  let ny = y + dy;
  if (map.boxBlocked(nx, ny, hb)) {
    const steps = 4; ny = y;
    for (let i = 1; i <= steps; i++) { const ty = y + (dy * i) / steps; if (map.boxBlocked(nx, ty, hb)) break; ny = ty; }
    hitY = true;
    if (Math.abs(dx) < 0.01) {
      const nudge = hb * 0.5;
      if (!map.boxBlocked(nx - nudge, y + dy, hb) && !map.boxBlocked(nx - nudge, y, hb)) nx -= Math.min(nudge, Math.abs(dy));
      else if (!map.boxBlocked(nx + nudge, y + dy, hb) && !map.boxBlocked(nx + nudge, y, hb)) nx += Math.min(nudge, Math.abs(dy));
    }
  }
  return { x: nx, y: ny, hitX, hitY };
}
