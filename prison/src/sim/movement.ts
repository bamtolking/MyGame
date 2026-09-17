import type { Vec } from './types';
export interface Mobile { x: number; y: number; path: Vec[] | null; pathI: number; target: Vec | null }
export const MOVING = 0, ARRIVED = 1, BLOCKED = 2;
/** Advance along the path. Returns ARRIVED when the path is finished (or there is none), BLOCKED if the next waypoint became impassable. */
export function moveAlong(e: Mobile, speed: number, dt: number, canEnter?: (x: number, y: number) => boolean): number {
  if (!e.path) return ARRIVED;
  let budget = speed * dt;
  while (budget > 0 && e.pathI < e.path.length) {
    const wp = e.path[e.pathI];
    if (canEnter && !canEnter(wp.x, wp.y)) { e.path = null; e.pathI = 0; return BLOCKED; }
    const tx = wp.x + 0.5, ty = wp.y + 0.5;
    const dx = tx - e.x, dy = ty - e.y; const d = Math.hypot(dx, dy);
    if (d <= budget) { e.x = tx; e.y = ty; budget -= d; e.pathI++; }
    else { e.x += dx / d * budget; e.y += dy / d * budget; budget = 0; }
  }
  if (e.pathI >= e.path.length) { e.path = null; e.pathI = 0; return ARRIVED; }
  return MOVING;
}
export function setPath(e: Mobile, path: Vec[] | null, target: Vec | null): void { e.path = path && path.length ? path : null; e.pathI = 0; e.target = target; }
export const tileX = (e: { x: number }): number => Math.floor(e.x);
export const tileY = (e: { y: number }): number => Math.floor(e.y);
