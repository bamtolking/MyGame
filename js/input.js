'use strict';
const Input = {
  keys: {}, pressed: {}, mouse: { x: 0, y: 0, l: false, r: false, lp: false, rp: false, wheel: 0 },
  init(canvas) {
    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
      if (['tab', ' '].includes(k) || (e.code === 'Space')) e.preventDefault();
      if (typeof Game !== 'undefined') Game.onKey(k, e);
    });
    window.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouse.l = false; this.mouse.r = false; });
    canvas.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    canvas.addEventListener('mousedown', e => {
      Audio_.init();
      if (e.button === 0) { this.mouse.l = true; this.mouse.lp = true; }
      if (e.button === 2) { this.mouse.r = true; this.mouse.rp = true; }
      e.preventDefault();
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) this.mouse.l = false;
      if (e.button === 2) this.mouse.r = false;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    window.addEventListener('mousedown', () => Audio_.init(), { once: true });
    window.addEventListener('keydown', () => Audio_.init(), { once: true });
  },
  down(k) { return !!this.keys[k]; },
  wasPressed(k) { return !!this.pressed[k]; },
  endFrame() { this.pressed = {}; this.mouse.lp = false; this.mouse.rp = false; this.mouse.wheel = 0; },
};
