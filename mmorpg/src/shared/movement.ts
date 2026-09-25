// Shared player movement (server authoritative + client prediction must match exactly).
import { TILE, DT } from './constants.ts';
import { SOLID } from './map.ts';

interface Grid { w: number; h: number; tiles: Uint8Array }
export function circleHits(m: Grid, x: number, y: number, r: number): boolean {
  const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE), y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
    if (!SOLID[m.tiles[ty * m.w + tx]]) continue;
    const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE)), cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
    const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}
const q8 = (v: number) => Math.round(v * 8) / 8;
/** Moves a circle by (dx,dy) with wall sliding. Result is on the 1/8 px grid. */
export function moveCircle(m: Grid, x: number, y: number, dx: number, dy: number, r: number): [number, number] {
  let nx = x, ny = y;
  if (dx !== 0) { if (!circleHits(m, q8(x + dx), y, r)) nx = q8(x + dx); else if (!circleHits(m, q8(x + dx * 0.5), y, r)) nx = q8(x + dx * 0.5); }
  if (dy !== 0) { if (!circleHits(m, nx, q8(y + dy), r)) ny = q8(y + dy); else if (!circleHits(m, nx, q8(y + dy * 0.5), r)) ny = q8(y + dy * 0.5); }
  // corner assist: blocked while pushing mostly along one axis → slide sideways if the way is open a bit to the side
  if (nx === x && dx !== 0 && Math.abs(dy) < Math.abs(dx) * 0.5) {
    const s = Math.abs(dx) * 0.7;
    for (const sg of [1, -1]) {
      if (circleHits(m, x + dx, ny + sg * r, r) || circleHits(m, x, q8(ny + sg * s), r)) continue;
      if (sg === 1 && !circleHits(m, x + dx, ny - r, r) && dy < 0) continue; // both sides open → respect the stick
      ny = q8(ny + sg * s); break;
    }
  } else if (ny === y && dy !== 0 && Math.abs(dx) < Math.abs(dy) * 0.5) {
    const s = Math.abs(dy) * 0.7;
    for (const sg of [1, -1]) {
      if (circleHits(m, x + sg * r, y + dy, r) || circleHits(m, q8(nx + sg * s), y, r)) continue;
      if (sg === 1 && !circleHits(m, x - r, y + dy, r) && dx < 0) continue;
      nx = q8(nx + sg * s); break;
    }
  }
  return [nx, ny];
}
/** One fixed step of player movement from a quantized stick input (ix, iy in -127..127). */
export function stepPlayer(m: Grid, x: number, y: number, ix: number, iy: number, speed: number, r: number): [number, number] {
  if (ix === 0 && iy === 0) return [x, y];
  const len = Math.sqrt(ix * ix + iy * iy); const k = len > 127 ? 127 / len : 1;
  const vx = (ix * k) / 127, vy = (iy * k) / 127;
  return moveCircle(m, x, y, vx * speed * DT, vy * speed * DT, r);
}
