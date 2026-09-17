// 터치·포인터 입력: 조작 영역에서 손가락을 누른 곳에 가상 조이스틱 생성. 버튼 입력과 분리.
export interface JoyState { id: number | null; ox: number; oy: number; x: number; y: number; active: boolean }

export class TouchInput {
  joy: JoyState = { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false };
  vec = { x: 0, y: 0 };
  dashQueued = false;
  deadzone = 8; radius = 46;
  /** 조작 영역 판정 (CSS px, 캔버스 기준) */
  moveZone: (x: number, y: number) => boolean = () => true;
  private el: HTMLElement;
  private onDown: (e: PointerEvent) => void; private onMove: (e: PointerEvent) => void; private onUp: (e: PointerEvent) => void;
  private onBlur: () => void;

  constructor(el: HTMLElement) {
    this.el = el;
    this.onDown = (e) => {
      if (this.joy.id !== null) return;
      const r = this.el.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
      if (!this.moveZone(x, y)) return;
      this.joy = { id: e.pointerId, ox: x, oy: y, x, y, active: true };
      try { this.el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      e.preventDefault();
    };
    this.onMove = (e) => {
      if (e.pointerId !== this.joy.id) return;
      const r = this.el.getBoundingClientRect(); this.joy.x = e.clientX - r.left; this.joy.y = e.clientY - r.top;
      this.update(); e.preventDefault();
    };
    this.onUp = (e) => { if (e.pointerId !== this.joy.id) return; this.release(); e.preventDefault(); };
    this.onBlur = () => this.release();
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('lostpointercapture', this.onUp as any);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.release(); });
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  private update(): void {
    const dx = this.joy.x - this.joy.ox, dy = this.joy.y - this.joy.oy; const d = Math.hypot(dx, dy);
    if (d < this.deadzone) { this.vec.x = 0; this.vec.y = 0; return; }
    const m = Math.min(1, (d - this.deadzone) / (this.radius - this.deadzone));
    this.vec.x = dx / d * m; this.vec.y = dy / d * m;
  }
  release(): void { this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false }; this.vec.x = 0; this.vec.y = 0; }
  queueDash(): void { this.dashQueued = true; }
  /** 스텝용 입력. 대시는 한 번만 소비 */
  consume(): { mx: number; my: number; dash: boolean } { const d = this.dashQueued; this.dashQueued = false; return { mx: this.vec.x, my: this.vec.y, dash: d }; }
  destroy(): void {
    this.el.removeEventListener('pointerdown', this.onDown); this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp); this.el.removeEventListener('pointercancel', this.onUp); window.removeEventListener('blur', this.onBlur);
  }
}

/** 키보드(PC 테스트용): WASD/화살표 이동, 스페이스 대시 */
export class KeyInput {
  keys = new Set<string>();
  dashQueued = false;
  constructor() {
    window.addEventListener('keydown', e => { if (e.repeat) return; this.keys.add(e.key.toLowerCase()); if (e.key === ' ' || e.key === 'Shift') { this.dashQueued = true; e.preventDefault(); } if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) e.preventDefault(); });
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }
  vec(): { x: number; y: number } {
    let x = 0, y = 0; const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) x -= 1; if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('w') || k.has('arrowup')) y -= 1; if (k.has('s') || k.has('arrowdown')) y += 1;
    const l = Math.hypot(x, y); return l > 0 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
  }
}
