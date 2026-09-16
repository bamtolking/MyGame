import type { Unit } from './state.ts';

/** Uniform grid spatial hash for neighbour queries. Rebuilt every tick. */
export class SpatialHash {
  cell: number;
  cols: number;
  rows: number;
  buckets: Unit[][];
  constructor(w: number, h: number, cell = 80) {
    this.cell = cell;
    this.cols = Math.ceil(w / cell) + 1;
    this.rows = Math.ceil(h / cell) + 1;
    this.buckets = new Array(this.cols * this.rows);
    for (let i = 0; i < this.buckets.length; i++) this.buckets[i] = [];
  }
  clear() {
    for (const b of this.buckets) b.length = 0;
  }
  insert(u: Unit) {
    const cx = Math.max(0, Math.min(this.cols - 1, (u.x / this.cell) | 0));
    const cy = Math.max(0, Math.min(this.rows - 1, (u.y / this.cell) | 0));
    this.buckets[cy * this.cols + cx].push(u);
  }
  /** Calls fn for every unit within radius r of (x,y) (coarse: cell test then exact). */
  query(x: number, y: number, r: number, fn: (u: Unit, d2: number) => void) {
    const x0 = Math.max(0, ((x - r) / this.cell) | 0);
    const x1 = Math.min(this.cols - 1, ((x + r) / this.cell) | 0);
    const y0 = Math.max(0, ((y - r) / this.cell) | 0);
    const y1 = Math.min(this.rows - 1, ((y + r) / this.cell) | 0);
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const b = this.buckets[cy * this.cols + cx];
        for (let i = 0; i < b.length; i++) {
          const u = b[i];
          const dx = u.x - x;
          const dy = u.y - y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= r2) fn(u, d2);
        }
      }
    }
  }
}
