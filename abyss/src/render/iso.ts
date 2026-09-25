// Isometric projection and camera.
export const TW = 64;         // tile width in iso pixels (zoom 1)
export const TH = 32;         // tile height
export const WALL_H = 58;     // wall height
export const HALF_W = TW / 2, HALF_H = TH / 2;
/** Pixels per world unit for radii (circle of radius r → ellipse rx = r*RX, ry = r*RX/2). */
export const RX = TW / Math.SQRT2;

export const isoX = (x: number, y: number) => (x - y) * HALF_W;
export const isoY = (x: number, y: number) => (x + y) * HALF_H;

export class Camera {
  x = 0; y = 0;           // world position at screen center
  zoom = 1;
  w = 800; h = 600;       // css pixels
  shake = 0; sx = 0; sy = 0;
  /** world → css pixel */
  sxOf(x: number, y: number): number { return (isoX(x, y) - isoX(this.x, this.y)) * this.zoom + this.w / 2 + this.sx; }
  syOf(x: number, y: number): number { return (isoY(x, y) - isoY(this.x, this.y)) * this.zoom + this.h / 2 + this.sy; }
  /** css pixel → world */
  toWorld(px: number, py: number): { x: number; y: number } {
    const ix = (px - this.w / 2 - this.sx) / this.zoom + isoX(this.x, this.y);
    const iy = (py - this.h / 2 - this.sy) / this.zoom + isoY(this.x, this.y);
    const a = ix / HALF_W, b = iy / HALF_H;
    return { x: (a + b) / 2, y: (b - a) / 2 };
  }
  /** World-space bounding box of the view (with margin in tiles). */
  bounds(margin: number): { x0: number; y0: number; x1: number; y1: number } {
    const c = [this.toWorld(0, 0), this.toWorld(this.w, 0), this.toWorld(0, this.h), this.toWorld(this.w, this.h)];
    return {
      x0: Math.floor(Math.min(...c.map((p) => p.x)) - margin), y0: Math.floor(Math.min(...c.map((p) => p.y)) - margin),
      x1: Math.ceil(Math.max(...c.map((p) => p.x)) + margin), y1: Math.ceil(Math.max(...c.map((p) => p.y)) + margin),
    };
  }
}

/** Screen-space direction of a world-space facing angle (for sprite flipping / aiming). */
export function screenDir(facing: number): { dx: number; dy: number } {
  const cx = Math.cos(facing), cy = Math.sin(facing);
  const dx = (cx - cy) * HALF_W, dy = (cx + cy) * HALF_H;
  const l = Math.hypot(dx, dy) || 1;
  return { dx: dx / l, dy: dy / l };
}

export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function shade(hex: string, k: number): string {
  // k in [-1,1]: darken/lighten
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (k >= 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  else { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
