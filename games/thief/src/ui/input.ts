// Touch joystick (spawns where the finger lands) + latched buttons + keyboard fallback for desktop testing.
import type { PlayerInput } from '../sim/types';
import type { JoystickView } from '../render/renderer';

export class TouchInput {
  joy: JoystickView = { active: false, ox: 0, oy: 0, dx: 0, dy: 0 };
  private pointerId: number | null = null; private latch = { dash: false, interact: false, finish: false };
  private keys = new Set<string>(); enabled = true; radius = 46;
  constructor(private canvas: HTMLCanvasElement) {
    const c = canvas;
    c.addEventListener('pointerdown', (e) => { if (!this.enabled || this.pointerId !== null) return; if (e.pointerType === 'mouse' && e.button !== 0) return; this.pointerId = e.pointerId; const r = c.getBoundingClientRect(); this.joy = { active: true, ox: e.clientX - r.left, oy: e.clientY - r.top, dx: 0, dy: 0 }; try { c.setPointerCapture(e.pointerId); } catch { /* ignore */ } e.preventDefault(); });
    c.addEventListener('pointermove', (e) => { if (e.pointerId !== this.pointerId) return; const r = c.getBoundingClientRect(); let dx = e.clientX - r.left - this.joy.ox, dy = e.clientY - r.top - this.joy.oy; const d = Math.hypot(dx, dy); if (d > this.radius) { dx = (dx / d) * this.radius; dy = (dy / d) * this.radius; } this.joy.dx = dx / this.radius; this.joy.dy = dy / this.radius; e.preventDefault(); });
    const end = (e: PointerEvent): void => { if (e.pointerId !== this.pointerId) return; this.release(); };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end); c.addEventListener('lostpointercapture', end);
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => { if (!this.enabled) return; const k = e.key.toLowerCase(); this.keys.add(k); if (k === ' ' || k === 'shift') { this.latch.dash = true; e.preventDefault(); } if (k === 'e') this.latch.interact = true; if (k === 'f') this.latch.finish = true; });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.release());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.release(); });
  }
  release(): void { this.pointerId = null; this.joy = { active: false, ox: 0, oy: 0, dx: 0, dy: 0 }; this.keys.clear(); }
  press(b: 'dash' | 'interact' | 'finish'): void { if (this.enabled) this.latch[b] = true; }
  /** Read and clear latched buttons; movement is continuous. Dead zone 0.18, magnitude preserved up to 1. */
  consume(): PlayerInput {
    let mx = this.joy.active ? this.joy.dx : 0, my = this.joy.active ? this.joy.dy : 0;
    if (!this.joy.active) { if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1; if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1; if (this.keys.has('w') || this.keys.has('arrowup')) my -= 1; if (this.keys.has('s') || this.keys.has('arrowdown')) my += 1; }
    const d = Math.hypot(mx, my);
    if (d < 0.18) { mx = 0; my = 0; } else if (d > 1) { mx /= d; my /= d; } else { const k = Math.min(1, (d - 0.18) / 0.6) / d; mx *= k; my *= k; }
    const out: PlayerInput = { mx, my, dash: this.latch.dash, interact: this.latch.interact, finish: this.latch.finish };
    this.latch = { dash: false, interact: false, finish: false };
    return out;
  }
}
