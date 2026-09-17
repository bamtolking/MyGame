// 터치 조이스틱 + 행동 버튼 + 키보드(PC 테스트용) + 캔버스 탭.
export class Input {
  constructor({ joy, knob, actionBtn, canvas }) {
    this.jx = 0; this.jy = 0;          // 조이스틱 벡터
    this.keys = new Set();
    this.actionHeld = false;
    this.onTap = null;                 // (screenX, screenY)
    this.onHover = null;               // (screenX, screenY | null)
    this.onKey = null;                 // (key)
    this.enabled = false;
    const R = 40;
    let joyId = null, cx = 0, cy = 0;
    const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; };
    joy.addEventListener('pointerdown', (e) => {
      if (joyId !== null) return;
      joyId = e.pointerId; joy.setPointerCapture(e.pointerId);
      const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      move(e); e.preventDefault();
    });
    const move = (e) => {
      if (e.pointerId !== joyId) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      setKnob(dx, dy);
      const dead = 6;
      this.jx = Math.abs(dx) < dead && Math.abs(dy) < dead ? 0 : dx / R;
      this.jy = Math.abs(dx) < dead && Math.abs(dy) < dead ? 0 : dy / R;
    };
    joy.addEventListener('pointermove', move);
    const end = (e) => { if (e.pointerId !== joyId) return; joyId = null; this.jx = this.jy = 0; setKnob(0, 0); };
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);

    const down = (e) => { this.actionHeld = true; e.preventDefault(); actionBtn.setPointerCapture?.(e.pointerId); };
    const up = () => { this.actionHeld = false; };
    actionBtn.addEventListener('pointerdown', down);
    actionBtn.addEventListener('pointerup', up); actionBtn.addEventListener('pointercancel', up); actionBtn.addEventListener('lostpointercapture', up);
    actionBtn.addEventListener('contextmenu', (e) => e.preventDefault());

    // 캔버스 탭 (짧게, 거의 움직이지 않은 터치)
    let tap = null;
    canvas.addEventListener('pointerdown', (e) => { tap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() }; });
    canvas.addEventListener('pointermove', (e) => { if (this.onHover && e.pointerType === 'mouse') this.onHover(e.clientX, e.clientY); });
    canvas.addEventListener('pointerleave', () => { if (this.onHover) this.onHover(null, null); });
    canvas.addEventListener('pointerup', (e) => {
      if (!tap || tap.id !== e.pointerId) return;
      const ok = performance.now() - tap.t < 400 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 12;
      tap = null;
      if (ok && this.onTap) this.onTap(e.clientX, e.clientY);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (!this.enabled || e.target.tagName === 'INPUT') return;
      this.keys.add(e.code);
      if (e.code === 'Space') { this.actionHeld = true; e.preventDefault(); }
      if (!e.repeat && this.onKey) this.onKey(e.key.toLowerCase(), e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); if (e.code === 'Space') this.actionHeld = false; });
    window.addEventListener('blur', () => { this.keys.clear(); this.actionHeld = false; });
  }
  vector() {
    let x = this.jx, y = this.jy;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { mx: Math.round(x * 100) / 100, my: Math.round(y * 100) / 100, action: this.actionHeld };
  }
}
