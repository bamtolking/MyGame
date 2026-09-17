// Touch/mouse input: one finger pans (select tool) or draws a rectangle (build tools); two fingers pinch-zoom & pan; wheel zooms.
import type { Renderer } from '../render/renderer';

export interface InputHandlers {
  isDrawTool(): boolean;
  onTap(tx: number, ty: number, wx: number, wy: number): void;
  onRectPreview(rect: { x0: number; y0: number; x1: number; y1: number } | null): void;
  onRect(x0: number, y0: number, x1: number, y1: number): void;
  onCamChange(): void;
}
export class Input {
  pointers = new Map<number, { x: number; y: number }>();
  start: { x: number; y: number; camX: number; camY: number; t: number; draw: boolean } | null = null;
  rect: { x0: number; y0: number; x1: number; y1: number } | null = null;
  pinch: { d0: number; zoom0: number; wx: number; wy: number } | null = null;
  ignoreUntilUp = false; moved = false;
  constructor(public canvas: HTMLCanvasElement, public r: Renderer, public h: InputHandlers) {
    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('pointermove', e => this.move(e));
    canvas.addEventListener('pointerup', e => this.up(e));
    canvas.addEventListener('pointercancel', e => this.up(e));
    canvas.addEventListener('wheel', e => { e.preventDefault(); const p = this.pos(e); const k = Math.pow(1.1, -e.deltaY / 100); this.zoomAt(p.x, p.y, this.r.cam.zoom * k); }, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  private pos(e: { clientX: number; clientY: number }): { x: number; y: number } { const b = this.canvas.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; }
  private zoomAt(px: number, py: number, zoom: number): void {
    const w = this.r.screenToTile(px, py); this.r.cam.zoom = Math.max(5, Math.min(64, zoom));
    this.r.cam.x = w.x - (px - this.r.cw / 2) / this.r.cam.zoom; this.r.cam.y = w.y - (py - this.r.ch / 2) / this.r.cam.zoom; this.h.onCamChange();
  }
  private down(e: PointerEvent): void {
    e.preventDefault(); try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const p = this.pos(e); this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]; const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; const w = this.r.screenToTile(mid.x, mid.y);
      this.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom0: this.r.cam.zoom, wx: w.x, wy: w.y };
      this.start = null; if (this.rect) { this.rect = null; this.h.onRectPreview(null); }
      return;
    }
    if (this.pointers.size > 2) return;
    this.moved = false; this.ignoreUntilUp = false;
    this.start = { x: p.x, y: p.y, camX: this.r.cam.x, camY: this.r.cam.y, t: performance.now(), draw: this.h.isDrawTool() };
    if (this.start.draw) { const t = this.r.screenToTile(p.x, p.y); this.rect = { x0: Math.floor(t.x), y0: Math.floor(t.y), x1: Math.floor(t.x), y1: Math.floor(t.y) }; this.h.onRectPreview(this.rect); }
  }
  private move(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.pos(e); this.pointers.set(e.pointerId, p);
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y) || 1; const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.r.cam.zoom = Math.max(5, Math.min(64, this.pinch.zoom0 * d / this.pinch.d0));
      this.r.cam.x = this.pinch.wx - (mid.x - this.r.cw / 2) / this.r.cam.zoom; this.r.cam.y = this.pinch.wy - (mid.y - this.r.ch / 2) / this.r.cam.zoom; this.h.onCamChange();
      return;
    }
    if (!this.start || this.ignoreUntilUp) return;
    const dx = p.x - this.start.x, dy = p.y - this.start.y;
    if (Math.hypot(dx, dy) > 6) this.moved = true;
    if (this.start.draw) { if (this.rect) { const t = this.r.screenToTile(p.x, p.y); this.rect.x1 = Math.floor(t.x); this.rect.y1 = Math.floor(t.y); this.h.onRectPreview(this.rect); } }
    else { this.r.cam.x = this.start.camX - dx / this.r.cam.zoom; this.r.cam.y = this.start.camY - dy / this.r.cam.zoom; this.h.onCamChange(); }
  }
  private up(e: PointerEvent): void {
    const p = this.pointers.get(e.pointerId); this.pointers.delete(e.pointerId);
    if (this.pinch) { if (this.pointers.size < 2) { this.pinch = null; this.ignoreUntilUp = this.pointers.size > 0; } return; }
    if (!this.start || !p) { if (this.pointers.size === 0) this.ignoreUntilUp = false; return; }
    const st = this.start; this.start = null;
    if (this.ignoreUntilUp) { this.ignoreUntilUp = false; if (this.rect) { this.rect = null; this.h.onRectPreview(null); } return; }
    const quick = performance.now() - st.t < 600;
    if (st.draw && this.rect) {
      const r = this.rect; this.rect = null; this.h.onRectPreview(null);
      this.h.onRect(r.x0, r.y0, r.x1, r.y1);
      return;
    }
    if (!this.moved && quick) { const t = this.r.screenToTile(p.x, p.y); this.h.onTap(Math.floor(t.x), Math.floor(t.y), t.x, t.y); }
  }
}
