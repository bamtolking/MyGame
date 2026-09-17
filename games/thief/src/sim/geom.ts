export interface Vec { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

export const len = (x: number, y: number): number => Math.hypot(x, y);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function normalize(x: number, y: number): Vec {
  const l = Math.hypot(x, y); if (l < 1e-6) return { x: 0, y: 0 };
  return { x: x / l, y: y / l };
}

export function circleRectOverlap(cx: number, cy: number, r: number, rc: Rect): boolean {
  const nx = clamp(cx, rc.x, rc.x + rc.w); const ny = clamp(cy, rc.y, rc.y + rc.h);
  const dx = cx - nx, dy = cy - ny; return dx * dx + dy * dy < r * r;
}
export function pointInRect(px: number, py: number, rc: Rect): boolean {
  return px >= rc.x && px <= rc.x + rc.w && py >= rc.y && py <= rc.y + rc.h;
}

/** Move a circle by (dx,dy) through solid rects, sliding along walls. Axis-separated so diagonal wall contact slides naturally. */
export function moveCircle(pos: Vec, r: number, dx: number, dy: number, solids: readonly Rect[], bounds: Rect): Vec {
  // Solids we already overlap (e.g. after a knockback or a laser that just turned on) are excluded from the axis
  // passes: otherwise sliding along them would fling us to their far edge. The residual pass pushes us out gently.
  let pre: Rect[] | null = null;
  for (const s of solids) if (circleRectOverlap(pos.x, pos.y, r, s)) { (pre ??= []).push(s); }
  let x = pos.x + dx; const y0 = pos.y;
  if (dx !== 0) for (const s of solids) if ((!pre || !pre.includes(s)) && circleRectOverlap(x, y0, r, s)) { x = dx > 0 ? s.x - r : s.x + s.w + r; }
  x = clamp(x, bounds.x + r, bounds.x + bounds.w - r);
  let y = y0 + dy;
  if (dy !== 0) for (const s of solids) if ((!pre || !pre.includes(s)) && circleRectOverlap(x, y, r, s)) { y = dy > 0 ? s.y - r : s.y + s.h + r; }
  y = clamp(y, bounds.y + r, bounds.y + bounds.h - r);
  // Residual overlap (corners, or a solid that appeared around us such as a laser turning on): push out along the
  // smallest penetration so nobody is ever teleported through a wall.
  for (let pass = 0; pass < 2; pass++) for (const s of solids) {
    if (!circleRectOverlap(x, y, r, s)) continue;
    const inside = x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h;
    if (inside) {
      const l = x - s.x + r, rt = s.x + s.w - x + r, t = y - s.y + r, b = s.y + s.h - y + r; const m = Math.min(l, rt, t, b);
      if (m === l) x = s.x - r; else if (m === rt) x = s.x + s.w + r; else if (m === t) y = s.y - r; else y = s.y + s.h + r;
    } else {
      const nx = clamp(x, s.x, s.x + s.w), ny = clamp(y, s.y, s.y + s.h); const ox = x - nx, oy = y - ny; const d = Math.hypot(ox, oy);
      if (d > 1e-6) { x = nx + (ox / d) * r; y = ny + (oy / d) * r; }
    }
  }
  x = clamp(x, bounds.x + r, bounds.x + bounds.w - r); y = clamp(y, bounds.y + r, bounds.y + bounds.h - r);
  return { x, y };
}

/** Segment vs rect intersection (slab test). Returns true if the segment crosses the rect. */
export function segmentHitsRect(ax: number, ay: number, bx: number, by: number, rc: Rect): boolean {
  let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay;
  const check = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
    return true;
  };
  if (!check(-dx, ax - rc.x)) return false;
  if (!check(dx, rc.x + rc.w - ax)) return false;
  if (!check(-dy, ay - rc.y)) return false;
  if (!check(dy, rc.y + rc.h - ay)) return false;
  return t0 <= t1;
}
export function lineOfSight(a: Vec, b: Vec, solids: readonly Rect[]): boolean {
  for (const s of solids) if (segmentHitsRect(a.x, a.y, b.x, b.y, s)) return false;
  return true;
}
/** Angle difference wrapped to [-PI, PI]. */
export function angleDiff(a: number, b: number): number { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
