// Painter: the drawing backend used by the world renderer. Three layers are composited as
//   final = scene × light × 2 × (1 − emit.a) + emit.rgb
// so the scene is lit by a colour light map and emissive effects glow in the dark. GLPainter (gl.ts) adds bloom and
// screen effects; CanvasPainter below is the Canvas2D fallback with the same API (multiply lighting, no bloom).
import { type Tex, canvas, silhouette, tinted } from './art/core.ts';

export const SCENE = 0, LIGHT = 1, EMIT = 2;
/** Camera: world point at the screen centre, css px per world unit, rotation in radians. */
export interface Cam { x: number; y: number; zoom: number; rot: number }
export interface PostFx {
  bloom: number; ca: number; vignette: number; desat: number; grain: number; time: number;
  flash: number; flashCol: number; tint: number;
  /** Shockwaves, flat [x, y, radius, strength] in world units. */
  waves: number[];
}
export interface Painter {
  readonly kind: 'gl' | '2d'; readonly canvas: HTMLCanvasElement; lost: boolean;
  W: number; H: number; dpr: number;
  stats: { draws: number; quads: number; uploads: number };
  resize(W: number, H: number, dpr: number): void;
  /** Starts a frame. `ambient` is the light-map base as a multiplier per channel (1 = unlit scene colours). */
  begin(cam: Cam, ambient: [number, number, number], bg: number): void;
  /** Texture anchored at (x, y). sx/sy scale the texture's world size (negative flips), col is a 0xRRGGBB tint,
   *  add = 1 blends additively, flash whitens (0..1), dis dissolves (0..1, glowing edge on EMIT). */
  /** `gy` squashes vertically after the rotation: a flat decal spinning on the ground plane (a circle stays the same ellipse). */
  draw(layer: number, t: Tex, x: number, y: number, sx: number, sy: number, rot: number, col: number, a: number, add: number, flash?: number, dis?: number, gy?: number): void;
  /** Texture stretched from (x0, y0) to (x1, y1), w world units thick. */
  beam(layer: number, t: Tex, x0: number, y0: number, x1: number, y1: number, w: number, col: number, a: number, add: number): void;
  /** Band along an arc (radius r, thickness w) from angle a0 to a1; alpha ramps up from the a0 end. */
  arc(layer: number, t: Tex, x: number, y: number, r: number, w: number, a0: number, a1: number, col: number, a: number, add: number): void;
  /** Solo image on the scene layer (terrain): source rect in image pixels, destination rect in world units. */
  image(cv: HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
  end(post: PostFx): void;
  resetAtlas(): void;
  destroy(): void;
}
export const noPost = (): PostFx => ({ bloom: 0, ca: 0, vignette: 0, desat: 0, grain: 0, time: 0, flash: 0, flashCol: 0xffffff, tint: 0xffffff, waves: [] });
export const css = (col: number, a = 1): string => `rgba(${(col >> 16) & 255},${(col >> 8) & 255},${col & 255},${a})`;
const hex = (col: number): string => '#' + (col & 0xffffff).toString(16).padStart(6, '0');

type Ctx = CanvasRenderingContext2D;
interface Cmd { t: Tex; x: number; y: number; sx: number; sy: number; rot: number; col: number; a: number; add: number; flash: number; dis: number; kind: 0 | 1 | 2; x1: number; y1: number; w: number; gy: number }

/** Canvas2D fallback. Scene draws go straight to the canvas, light to a quarter-res canvas multiplied on top, emit is replayed last. */
export class CanvasPainter implements Painter {
  readonly kind = '2d' as const; readonly canvas: HTMLCanvasElement; lost = false;
  W = 1; H = 1; dpr = 1; stats = { draws: 0, quads: 0, uploads: 0 };
  private c: Ctx; private lcv = canvas(1, 1); private lc: Ctx; private emit: Cmd[] = [];
  private m = [1, 0, 0, 1, 0, 0]; private lm = [1, 0, 0, 1, 0, 0];
  private flashCache = new Map<number, HTMLCanvasElement>(); private tintCache = new Map<string, HTMLCanvasElement>();
  private vig: HTMLCanvasElement | null = null;
  constructor(cv: HTMLCanvasElement) { this.canvas = cv; this.c = cv.getContext('2d', { alpha: false })!; this.lc = this.lcv.getContext('2d')!; }
  resize(W: number, H: number, dpr: number): void {
    this.W = W; this.H = H; this.dpr = dpr; this.canvas.width = Math.round(W * dpr); this.canvas.height = Math.round(H * dpr);
    this.lcv.width = Math.ceil(W / 4); this.lcv.height = Math.ceil(H / 4); this.vig = null;
  }
  begin(cam: Cam, ambient: [number, number, number], bg: number): void {
    this.stats.draws = this.stats.quads = 0; this.emit.length = 0;
    const s = cam.zoom * this.dpr, cs = Math.cos(cam.rot) * s, sn = Math.sin(cam.rot) * s, cx = this.canvas.width / 2, cy = this.canvas.height / 2;
    this.m = [cs, sn, -sn, cs, cx - (cs * cam.x - sn * cam.y), cy - (sn * cam.x + cs * cam.y)];
    const k = 1 / (4 * this.dpr); this.lm = this.m.map(v => v * k);
    const c = this.c; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.fillStyle = css(bg); c.fillRect(0, 0, this.canvas.width, this.canvas.height); c.imageSmoothingEnabled = true;
    const lc = this.lc; lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalCompositeOperation = 'source-over'; lc.globalAlpha = 1;
    const f = (v: number) => Math.round(Math.min(1, v) * 255); lc.fillStyle = `rgb(${f(ambient[0])},${f(ambient[1])},${f(ambient[2])})`; lc.fillRect(0, 0, this.lcv.width, this.lcv.height);
  }
  private src(t: Tex, col: number, flash: number): HTMLCanvasElement {
    if (flash > 0.5) { let f = this.flashCache.get(t.id); if (!f) { f = silhouette(t); this.flashCache.set(t.id, f); if (this.flashCache.size > 400) this.flashCache.clear(); } return f; }
    if ((col & 0xffffff) === 0xffffff) return t.cv;
    const key = t.id + ':' + col; let v = this.tintCache.get(key);
    if (!v) { v = tinted(t, hex(col)); this.tintCache.set(key, v); if (this.tintCache.size > 300) this.tintCache.clear(); }
    return v;
  }
  private put(c: Ctx, m: number[], cmd: Cmd): void {
    const { t, x, y, sx, sy, rot } = cmd; let a = cmd.a; if (cmd.dis > 0) a *= 1 - cmd.dis;
    if (a <= 0.003) return;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const la = sx * cs, lb = sx * sn * cmd.gy, lc = -sy * sn, ld = sy * cs * cmd.gy;
    c.setTransform(m[0] * la + m[2] * lb, m[1] * la + m[3] * lb, m[0] * lc + m[2] * ld, m[1] * lc + m[3] * ld, m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]);
    c.globalAlpha = Math.min(1, a); c.globalCompositeOperation = cmd.add ? 'lighter' : 'source-over';
    const dx = -t.ax * t.w, dy = -t.ay * t.h; const sc = cmd.dis > 0 ? 1 + cmd.dis * 0.25 : 1;
    c.drawImage(this.src(t, cmd.col, cmd.flash), dx * sc, dy * sc, t.w * sc, t.h * sc);
    if (cmd.flash > 0 && cmd.flash <= 0.5) { c.globalAlpha = Math.min(1, a) * cmd.flash * 2; c.drawImage(this.src(t, 0xffffff, 1), dx, dy, t.w, t.h); }
    this.stats.quads++;
  }
  private run(cmd: Cmd, c: Ctx, m: number[]): void {
    if (cmd.kind === 0) this.put(c, m, cmd);
    else if (cmd.kind === 1) { const dx = cmd.x1 - cmd.x, dy = cmd.y1 - cmd.y, L = Math.hypot(dx, dy); if (L < 0.01) return; this.put(c, m, { ...cmd, kind: 0, sx: L / cmd.t.w, sy: cmd.w / cmd.t.h, rot: Math.atan2(dy, dx) }); }
    else {
      // arc band: stroke in segments with rising alpha
      c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); c.globalCompositeOperation = cmd.add ? 'lighter' : 'source-over'; c.lineCap = 'round';
      const n = 6, a0 = cmd.rot, a1 = cmd.x1; c.lineWidth = cmd.w; c.strokeStyle = css(cmd.col);
      for (let i = 0; i < n; i++) { c.globalAlpha = Math.min(1, cmd.a * (i + 1) / n); c.beginPath(); c.arc(cmd.x, cmd.y, cmd.y1, a0 + (a1 - a0) * i / n, a0 + (a1 - a0) * (i + 1) / n, a1 < a0); c.stroke(); }
    }
  }
  private cmd(layer: number, cmd: Cmd): void {
    if (layer === EMIT) { this.emit.push(cmd); return; }
    if (layer === LIGHT) { cmd.add = 1; this.run(cmd, this.lc, this.lm); return; }
    this.run(cmd, this.c, this.m);
  }
  draw(layer: number, t: Tex, x: number, y: number, sx: number, sy: number, rot: number, col: number, a: number, add: number, flash = 0, dis = 0, gy = 1): void {
    this.cmd(layer, { t, x, y, sx, sy, rot, col, a, add, flash, dis, kind: 0, x1: 0, y1: 0, w: 0, gy });
  }
  beam(layer: number, t: Tex, x0: number, y0: number, x1: number, y1: number, w: number, col: number, a: number, add: number): void {
    this.cmd(layer, { t, x: x0, y: y0, sx: 1, sy: 1, rot: 0, col, a, add, flash: 0, dis: 0, kind: 1, x1, y1, w, gy: 1 });
  }
  arc(layer: number, t: Tex, x: number, y: number, r: number, w: number, a0: number, a1: number, col: number, a: number, add: number): void {
    this.cmd(layer, { t, x, y, sx: 1, sy: 1, rot: a0, col, a, add, flash: 0, dis: 0, kind: 2, x1: a1, y1: r, w, gy: 1 });
  }
  image(cv: HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void {
    const c = this.c, m = this.m; c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.drawImage(cv, sx, sy, sw, sh, dx, dy, dw, dh); this.stats.draws++;
  }
  end(post: PostFx): void {
    const c = this.c, W = this.canvas.width, H = this.canvas.height;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'multiply'; c.drawImage(this.lcv, 0, 0, W, H);
    c.globalCompositeOperation = 'source-over';
    for (const cmd of this.emit) this.run(cmd, c, this.m);
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
    if ((post.tint & 0xffffff) !== 0xffffff) { c.globalCompositeOperation = 'multiply'; c.fillStyle = css(post.tint); c.fillRect(0, 0, W, H); }
    if (post.desat > 0) { c.globalCompositeOperation = 'saturation'; c.globalAlpha = post.desat; c.fillStyle = '#808080'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    c.globalCompositeOperation = 'source-over';
    if (post.vignette > 0) {
      if (!this.vig) { this.vig = canvas(256, 256); const v = this.vig.getContext('2d')!; const g = v.createRadialGradient(128, 128, 60, 128, 128, 182); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(4,2,12,0.85)'); v.fillStyle = g; v.fillRect(0, 0, 256, 256); }
      c.globalAlpha = Math.min(1, post.vignette); c.drawImage(this.vig, 0, 0, W, H); c.globalAlpha = 1;
    }
    if (post.flash > 0) { c.fillStyle = css(post.flashCol, Math.min(1, post.flash)); c.fillRect(0, 0, W, H); }
    this.stats.draws += this.stats.quads;
  }
  resetAtlas(): void { this.flashCache.clear(); this.tintCache.clear(); }
  destroy(): void { this.resetAtlas(); }
}
