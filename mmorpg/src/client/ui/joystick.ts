// Floating virtual joystick (touch/mouse drag anywhere on the play area) + keyboard.
// All maths runs in #app-local coordinates (toLocal), so it also works when the layout is rotated (see orient.ts).
import { toLocal } from './orient.ts';

export class Joystick {
  x = 0; y = 0; active = false; private id = -1; private ox = 0; private oy = 0; private t0 = 0; private moved = 0;
  private keys = new Set<string>(); base: HTMLElement; knob: HTMLElement; onTap: (x: number, y: number) => void = () => {};
  constructor(area: HTMLElement, base: HTMLElement, knob: HTMLElement) {
    this.base = base; this.knob = knob;
    area.addEventListener('pointerdown', (e) => {
      if (this.id !== -1) return; this.id = e.pointerId; [this.ox, this.oy] = toLocal(e.clientX, e.clientY); this.t0 = performance.now(); this.moved = 0;
      try { area.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      this.active = true; this.show(this.ox, this.oy); e.preventDefault();
    });
    area.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.id) return; const [lx, ly] = toLocal(e.clientX, e.clientY); const dx = lx - this.ox, dy = ly - this.oy; const d = Math.hypot(dx, dy); this.moved = Math.max(this.moved, d);
      const R = 52; const k = d > R ? R / d : 1; this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      if (d < 7) { this.x = 0; this.y = 0; return; }
      const mag = Math.min(1, d / 44); this.x = (dx / d) * mag; this.y = (dy / d) * mag;
      if (d > R * 1.8) { this.ox += dx * (1 - R * 1.8 / d); this.oy += dy * (1 - R * 1.8 / d); this.show(this.ox, this.oy); }
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.id) return; this.id = -1; this.active = false; this.x = 0; this.y = 0; this.base.classList.remove('on');
      if (this.moved < 10 && performance.now() - this.t0 < 350) this.onTap(e.clientX, e.clientY);
    };
    area.addEventListener('pointerup', end); area.addEventListener('pointercancel', end);
    window.addEventListener('keydown', (e) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') return; this.keys.add(e.key.toLowerCase()); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }
  /** Place the stick at an #app-local point (the base's parent fills #app). */
  private show(x: number, y: number) { const p = this.base.parentElement!; this.base.style.left = `${x - p.offsetLeft}px`; this.base.style.top = `${y - p.offsetTop}px`; this.base.classList.add('on'); this.knob.style.transform = 'translate(0,0)'; }
  /** Stick vector (keyboard overrides when held). */
  read(): { x: number; y: number } {
    let kx = 0, ky = 0; const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) kx--; if (k.has('d') || k.has('arrowright')) kx++; if (k.has('w') || k.has('arrowup')) ky--; if (k.has('s') || k.has('arrowdown')) ky++;
    if (kx || ky) { const l = Math.hypot(kx, ky); return { x: kx / l, y: ky / l }; }
    return { x: this.x, y: this.y };
  }
}
