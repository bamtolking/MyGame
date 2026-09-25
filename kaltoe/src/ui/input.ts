// 입력: 떠다니는 가상 조이스틱(터치/마우스) + 키보드(WASD/방향키)
import type { Joy } from '../render/renderer';

const R = 52;
const MOVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];

export class Input {
  joy: Joy = { active: false, bx: 0, by: 0, kx: 0, ky: 0 };
  private pid: number | null = null;
  private keys = new Set<string>();
  onUlt: (() => void) | null = null;
  onPause: (() => void) | null = null;
  onFirstMove: (() => void) | null = null;
  enabled = true;
  fixed = false;

  constructor(private el: HTMLElement) {
    el.addEventListener('pointerdown', this.down, { passive: false });
    window.addEventListener('pointermove', this.move, { passive: false });
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
    window.addEventListener('keydown', this.kd);
    window.addEventListener('keyup', this.ku);
    window.addEventListener('blur', () => { this.keys.clear(); this.release(); });
  }

  private down = (e: PointerEvent) => {
    if (!this.enabled || this.pid !== null) return;
    if ((e.target as HTMLElement).closest('button, input, textarea, select, .no-joy, .screen, .modal-wrap')) return;
    e.preventDefault();
    this.pid = e.pointerId;
    const r = this.el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (this.fixed) {
      this.joy.bx = 90; this.joy.by = r.height - 110;
    } else { this.joy.bx = x; this.joy.by = y; }
    this.joy.kx = x; this.joy.ky = y;
    this.joy.active = true;
    this.clampKnob();
  };

  private move = (e: PointerEvent) => {
    if (e.pointerId !== this.pid) return;
    e.preventDefault();
    const r = this.el.getBoundingClientRect();
    this.joy.kx = e.clientX - r.left; this.joy.ky = e.clientY - r.top;
    this.clampKnob(true);
    if (this.onFirstMove && Math.hypot(this.joy.kx - this.joy.bx, this.joy.ky - this.joy.by) > 8) { this.onFirstMove(); this.onFirstMove = null; }
  };

  private up = (e: PointerEvent) => { if (e.pointerId === this.pid) this.release(); };

  release() { this.pid = null; this.joy.active = false; }

  private clampKnob(follow = false) {
    const j = this.joy;
    const dx = j.kx - j.bx, dy = j.ky - j.by;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      if (follow && !this.fixed) {
        // 손가락을 따라 베이스가 끌려옴
        j.bx = j.kx - dx / d * R; j.by = j.ky - dy / d * R;
      } else { j.kx = j.bx + dx / d * R; j.ky = j.by + dy / d * R; }
    }
  }

  // e.code(물리 키)로 판정: 한글 입력 상태에서도 WASD가 동작하고 키가 끼지 않는다
  private kd = (e: KeyboardEvent) => {
    const k = e.code;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT') return;
    if (this.enabled && (MOVE_KEYS.includes(k) || k === 'Space')) e.preventDefault();
    this.keys.add(k);
    if (e.repeat) return;
    if (!this.enabled && k !== 'Escape' && k !== 'KeyP') return;
    if (k === 'Space' || k === 'KeyE') this.onUlt?.();
    if (k === 'Escape' || k === 'KeyP') this.onPause?.();
    if (this.onFirstMove && this.enabled && MOVE_KEYS.includes(k)) { this.onFirstMove(); this.onFirstMove = null; }
  };
  private ku = (e: KeyboardEvent) => { this.keys.delete(e.code); };

  /** 이동 벡터(-1..1) */
  vector(): [number, number] {
    let x = 0, y = 0;
    if (!this.enabled) return [0, 0];
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (x || y) { const L = Math.hypot(x, y); return [x / L, y / L]; }
    if (this.joy.active) {
      const dx = (this.joy.kx - this.joy.bx) / R, dy = (this.joy.ky - this.joy.by) / R;
      const L = Math.hypot(dx, dy);
      if (L < 0.12) return [0, 0];
      const k = Math.min(1, (L - 0.12) / 0.7) / L;
      return [dx * k, dy * k];
    }
    return [0, 0];
  }
}
