// 균일 격자 공간 해시. 매 스텝 적 위치로 다시 채우고 원 범위 질의에 쓴다.
export class SpatialGrid<T extends { x: number; y: number; r: number }> {
  private cells = new Map<number, T[]>();
  private pool: T[][] = [];
  constructor(public cell = 64) {}

  private key(cx: number, cy: number) { return ((cx + 32768) << 16) | ((cy + 32768) & 0xffff); }

  /** 이번에 넣은 객체의 최대 반지름(질의 여유폭) — 큰 보스의 가장자리도 놓치지 않게 */
  maxR = 0;

  clear() {
    for (const arr of this.cells.values()) { arr.length = 0; this.pool.push(arr); }
    this.cells.clear();
    this.maxR = 0;
  }

  insert(o: T) {
    if (o.r > this.maxR) this.maxR = o.r;
    const k = this.key(Math.floor(o.x / this.cell), Math.floor(o.y / this.cell));
    let arr = this.cells.get(k);
    if (!arr) { arr = this.pool.pop() ?? []; this.cells.set(k, arr); }
    arr.push(o);
  }

  /** (x,y) 반경 r 안에 "닿는"(중심거리 < r + o.r) 객체마다 fn 호출. fn이 true를 돌려주면 중단. */
  query(x: number, y: number, r: number, fn: (o: T) => boolean | void, pad = this.maxR) {
    const c = this.cell;
    const x0 = Math.floor((x - r - pad) / c), x1 = Math.floor((x + r + pad) / c);
    const y0 = Math.floor((y - r - pad) / c), y1 = Math.floor((y + r + pad) / c);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const arr = this.cells.get(this.key(cx, cy));
      if (!arr) continue;
      for (let i = 0; i < arr.length; i++) {
        const o = arr[i];
        const dx = o.x - x, dy = o.y - y, rr = r + o.r;
        if (dx * dx + dy * dy < rr * rr) { if (fn(o)) return; }
      }
    }
  }

  /** 같은/이웃 칸의 객체 (분리 계산용). fn이 true를 돌려주면 중단. */
  neighbors(o: T, fn: (n: T) => boolean | void) {
    const c = this.cell;
    const cx = Math.floor(o.x / c), cy = Math.floor(o.y / c);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const arr = this.cells.get(this.key(cx + dx, cy + dy));
      if (!arr) continue;
      for (let i = 0; i < arr.length; i++) if (arr[i] !== o && fn(arr[i])) return;
    }
  }
}
