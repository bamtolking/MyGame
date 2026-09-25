export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const dist2 = (ax: number, ay: number, bx: number, by: number): number => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
export const dist = (ax: number, ay: number, bx: number, by: number): number => Math.sqrt(dist2(ax, ay, bx, by));
export const q8 = (v: number): number => Math.round(v * 8) / 8;
export function angLerp(a: number, b: number, t: number): number {
  let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t;
}
/** Distance from point p to segment ab. */
export function segDist2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax, vy = by - ay; const l2 = vx * vx + vy * vy;
  let t = l2 > 0 ? ((px - ax) * vx + (py - ay) * vy) / l2 : 0; t = clamp(t, 0, 1);
  return dist2(px, py, ax + vx * t, ay + vy * t);
}
export function fmtNum(n: number): string {
  if (n >= 1e8) return (n / 1e8).toFixed(n >= 1e9 ? 0 : 1) + '억';
  if (n >= 1e4) return (n / 1e4).toFixed(n >= 1e5 ? 0 : 1) + '만';
  return String(Math.floor(n));
}
