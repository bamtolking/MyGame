// Uniform-grid spatial hash for monsters, rebuilt every tick.
import { WORLD_W, WORLD_H } from '../shared/constants.ts';
import type { Monster } from './entities.ts';

const CELL = 128;
const GW = Math.ceil(WORLD_W / CELL), GH = Math.ceil(WORLD_H / CELL);

export class Spatial {
  heads = new Int32Array(GW * GH).fill(-1);
  next: Int32Array = new Int32Array(4096);
  items: Monster[] = [];
  rebuild(mons: Iterable<Monster>): void {
    this.heads.fill(-1); this.items.length = 0;
    for (const m of mons) {
      if (m.dead) continue; const i = this.items.length; this.items.push(m);
      if (i >= this.next.length) { const n = new Int32Array(this.next.length * 2); n.set(this.next); this.next = n; }
      const c = this.cell(m.x, m.y); this.next[i] = this.heads[c]; this.heads[c] = i;
    }
  }
  private cell(x: number, y: number): number {
    const cx = Math.min(GW - 1, Math.max(0, Math.floor(x / CELL))), cy = Math.min(GH - 1, Math.max(0, Math.floor(y / CELL))); return cy * GW + cx;
  }
  /** Calls fn for every live monster whose center is within r (+ its radius if `pad`) of (x,y). */
  each(x: number, y: number, r: number, fn: (m: Monster, d2: number) => void, pad = true): void {
    const rr = r + (pad ? 64 : 0);
    const x0 = Math.max(0, Math.floor((x - rr) / CELL)), x1 = Math.min(GW - 1, Math.floor((x + rr) / CELL));
    const y0 = Math.max(0, Math.floor((y - rr) / CELL)), y1 = Math.min(GH - 1, Math.floor((y + rr) / CELL));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      for (let i = this.heads[cy * GW + cx]; i !== -1; i = this.next[i]) {
        const m = this.items[i]; if (m.dead) continue;
        const dx = m.x - x, dy = m.y - y; const d2 = dx * dx + dy * dy; const lim = pad ? r + m.r : r;
        if (d2 <= lim * lim) fn(m, d2);
      }
    }
  }
  nearest(x: number, y: number, r: number): Monster | null {
    let best: Monster | null = null, bd = Infinity;
    this.each(x, y, r, (m, d2) => { const e = Math.sqrt(d2) - m.r; if (e < bd) { bd = e; best = m; } });
    return best;
  }
  count(x: number, y: number, r: number): number { let n = 0; this.each(x, y, r, () => { n++; }, false); return n; }
  list(x: number, y: number, r: number, pad = true): Monster[] { const out: Monster[] = []; this.each(x, y, r, m => { out.push(m); }, pad); return out; }
  rect(x: number, y: number, hw: number, hh: number, out: Monster[]): void {
    const x0 = Math.max(0, Math.floor((x - hw) / CELL)), x1 = Math.min(GW - 1, Math.floor((x + hw) / CELL));
    const y0 = Math.max(0, Math.floor((y - hh) / CELL)), y1 = Math.min(GH - 1, Math.floor((y + hh) / CELL));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++)
      for (let i = this.heads[cy * GW + cx]; i !== -1; i = this.next[i]) { const m = this.items[i]; if (!m.dead && Math.abs(m.x - x) <= hw && Math.abs(m.y - y) <= hh) out.push(m); }
  }
}
