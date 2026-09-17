'use strict';
// ===================== 터치 조작 (모바일) =====================
const IS_TOUCH = (() => {
  try { const f = localStorage.getItem('ce_touch'); if (f === '1') return true; if (f === '0') return false; } catch (e) { }
  return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints > 1 && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
})();
const TouchCtl = {
  enabled: false, joy: { id: null, bx: 0, by: 0, dx: 0, dy: 0, mag: 0 }, held: {}, released: [], tapAttack: null, fsDone: false,
  init() {
    this.enabled = IS_TOUCH; if (!this.enabled) return;
    document.body.classList.add('touch');
    this.build();
    window.addEventListener('resize', () => this.layout());
    // 캔버스 터치: 라벨 탭 → 줍기, 그 외 → 그 방향으로 기본 공격
    const c = Game.canvas;
    c.addEventListener('touchstart', e => {
      e.preventDefault(); const t = e.changedTouches[0]; const s = Game.viewScale; Input.mouse.x = t.clientX * s; Input.mouse.y = t.clientY * s;
      if (Game.state !== 'play' || Game.paused) return;
      Game.updateHover();
      if (Game.hoverDrop) { const d = Game.hoverDrop, p = Game.player; if (dist(d.x, d.y, p.x, p.y) < 90) World.pickup(d); else p.autoTarget = d; }
      else this.tapAttack = { id: t.identifier, x: t.clientX * s, y: t.clientY * s };
    }, { passive: false });
    c.addEventListener('touchmove', e => { e.preventDefault(); if (!this.tapAttack) return; for (const t of e.changedTouches) if (t.identifier === this.tapAttack.id) { const s = Game.viewScale; this.tapAttack.x = t.clientX * s; this.tapAttack.y = t.clientY * s; } }, { passive: false });
    const endTap = e => { if (!this.tapAttack) return; for (const t of e.changedTouches) if (t.identifier === this.tapAttack.id) this.tapAttack = null; };
    c.addEventListener('touchend', endTap); c.addEventListener('touchcancel', endTap);
    document.addEventListener('touchend', () => { if (this.fsDone) return; this.fsDone = true; this.fullscreen(); }, { once: true });
  },
  fullscreen() {
    try {
      const d = document.documentElement;
      if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen().catch(() => { });
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => { });
    } catch (e) { }
  },
  build() {
    const ui = document.createElement('div'); ui.id = 'touch-ui';
    ui.innerHTML = `<div id="joy-zone"><div id="joy-base"><div id="joy-knob"></div></div></div><div id="tbtns"></div>`;
    document.body.appendChild(ui);
    const zone = ui.querySelector('#joy-zone'), base = ui.querySelector('#joy-base'), knob = ui.querySelector('#joy-knob');
    const R = 52;
    const setKnob = (dx, dy) => { knob.style.left = (60 + dx) + 'px'; knob.style.top = (60 + dy) + 'px'; };
    zone.addEventListener('touchstart', e => {
      e.preventDefault(); if (this.joy.id !== null) return; const t = e.changedTouches[0];
      this.joy.id = t.identifier; this.joy.bx = t.clientX; this.joy.by = t.clientY; this.joy.dx = this.joy.dy = this.joy.mag = 0;
      base.style.display = 'block'; base.style.left = t.clientX + 'px'; base.style.top = t.clientY + 'px'; setKnob(0, 0);
    }, { passive: false });
    zone.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== this.joy.id) continue;
        const ox = t.clientX - this.joy.bx, oy = t.clientY - this.joy.by; const l = Math.hypot(ox, oy);
        const m = Math.min(1, l / R); const k = l > R ? R / l : 1; setKnob(ox * k, oy * k);
        this.joy.mag = m < 0.15 ? 0 : m;
        this.joy.dx = l > 0 ? ox / l * this.joy.mag : 0; this.joy.dy = l > 0 ? oy / l * this.joy.mag : 0;
      }
    }, { passive: false });
    const endJoy = e => { for (const t of e.changedTouches) if (t.identifier === this.joy.id) { this.joy.id = null; this.joy.dx = this.joy.dy = this.joy.mag = 0; base.style.display = 'none'; } };
    zone.addEventListener('touchend', endJoy); zone.addEventListener('touchcancel', endJoy);
    const bt = ui.querySelector('#tbtns');
    const defs = [{ a: 'skill0', cls: 'primary' }, { a: 'skill1' }, { a: 'skill2' }, { a: 'skill3' }, { a: 'skill4' }, { a: 'skill5' }, { a: 'dodge', ico: '💨' }, { a: 'potion', ico: '🧪' }, { a: 'ult', ico: '★' }];
    for (const d of defs) {
      const b = document.createElement('div'); b.className = 'tbtn ' + (d.cls || '') + (d.a.startsWith('skill') ? ' skill' : ' special'); b.dataset.action = d.a; if (d.a.startsWith('skill')) b.dataset.slot = d.a.slice(5);
      b.innerHTML = `<div class="ico">${d.ico || ''}</div><div class="cd"></div><div class="cnt"></div>`;
      b.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; this.held[d.a] = { id: t.identifier, sx: t.clientX, sy: t.clientY, x: t.clientX, y: t.clientY, drag: false, t: performance.now() }; b.classList.add('held'); }, { passive: false });
      b.addEventListener('touchmove', e => { e.preventDefault(); const h = this.held[d.a]; if (!h) return; for (const t of e.changedTouches) if (t.identifier === h.id) { h.x = t.clientX; h.y = t.clientY; if (dist(h.sx, h.sy, h.x, h.y) > 22) h.drag = true; } }, { passive: false });
      const end = e => { const h = this.held[d.a]; if (!h) return; for (const t of e.changedTouches) if (t.identifier === h.id) { this.released.push({ action: d.a, drag: h.drag, dx: h.x - h.sx, dy: h.y - h.sy, tap: !h.drag && performance.now() - h.t < 500 }); delete this.held[d.a]; b.classList.remove('held'); } };
      b.addEventListener('touchend', end); b.addEventListener('touchcancel', end);
      bt.appendChild(b);
    }
    this.layout();
  },
  layout() {
    const small = window.innerHeight < 420;
    const P = small ? 60 : 70, S = small ? 44 : 50, r1 = small ? 82 : 96, r2 = small ? 136 : 158;
    const cx = P / 2 + 14, cy = P / 2 + 22;
    const at = (r, a, s) => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180), s];
    const pos = { skill0: [cx, cy, P], skill1: at(r1, 0, S), skill2: at(r1, 22.5, S), skill3: at(r1, 45, S), skill4: at(r1, 67.5, S), skill5: at(r1, 90, S), dodge: at(r2, 12, S), potion: at(r2, 45, S), ult: at(r2, 78, S) };
    document.querySelectorAll('#tbtns .tbtn').forEach(b => { const [x, y, s] = pos[b.dataset.action]; b.style.width = b.style.height = s + 'px'; b.style.right = (x - s / 2) + 'px'; b.style.bottom = (y - s / 2) + 'px'; });
  },
  autoAim(range = 560) {
    const p = Game.player; let best = null, bd = range;
    for (const m of World.monsters) { if (!m.alive) continue; const d = dist(p.x, p.y, m.x, m.y); if (d < bd && World.lineClear(p.x, p.y, m.x, m.y)) { bd = d; best = m; } }
    if (best) return { x: best.x, y: best.y, mon: best };
    const a = this.joy.mag > 0 ? Math.atan2(this.joy.dy, this.joy.dx) : p.facing;
    return { x: p.x + Math.cos(a) * 220, y: p.y + Math.sin(a) * 220, mon: null };
  },
  aimFromDrag(dx, dy, sk) {
    const p = Game.player; const l = Math.hypot(dx, dy) || 1; const d = sk.def;
    const maxR = (d.aoe && d.aoe.maxRange) || (d.ground && d.ground.maxRange) || (d.storm && d.storm.maxRange) || (d.proj && d.proj.range) || (d.beam && d.beam.range) || (d.dash && d.dash.dist) || 300;
    const r = clamp(l * 2.6, 40, maxR);
    return { x: p.x + dx / l * r, y: p.y + dy / l * r };
  },
  placement(sk) { return ['aoe', 'ground', 'storm'].includes(sk.def.kind); },
  update(p) {
    Game.aimPreview = null;
    for (const a in this.held) {
      if (!a.startsWith('skill')) continue;
      const slot = +a.slice(5); const sk = computeSkill(p, slot); if (!sk) continue; const h = this.held[a];
      if (h.drag) {
        const aim = this.aimFromDrag(h.x - h.sx, h.y - h.sy, sk); const d = sk.def;
        const r = d.aoe ? d.aoe.radius * sk.aoeMult : d.ground ? d.ground.radius * sk.aoeMult : d.storm ? d.storm.radius * sk.aoeMult : 0;
        Game.aimPreview = { x: aim.x, y: aim.y, r, color: d.color };
        if (!this.placement(sk)) Skills.use(p, slot, aim.x, aim.y); else p.facing = angleTo(p.x, p.y, aim.x, aim.y);
      } else if (!this.placement(sk)) { const t = this.autoAim(); Skills.use(p, slot, t.x, t.y); }
    }
    if (this.tapAttack && !this.held.skill0) { const wm = Game.screenToWorld(this.tapAttack.x, this.tapAttack.y); Skills.use(p, 0, wm.x, wm.y); }
    for (const r of this.released) {
      if (r.action.startsWith('skill')) {
        const slot = +r.action.slice(5); const sk = computeSkill(p, slot);
        if (!sk) { if (r.tap) UI.togglePanel('gems'); continue; }
        const aim = r.drag ? this.aimFromDrag(r.dx, r.dy, sk) : this.autoAim();
        Skills.use(p, slot, aim.x, aim.y);
      } else if (r.action === 'dodge') p.tryDodge(this.joy.dx, this.joy.dy);
      else if (r.action === 'potion') p.usePotion();
      else if (r.action === 'ult') Ult.use(p);
    }
    this.released = [];
  },
  updateHUD(p) {
    document.querySelectorAll('#tbtns .tbtn.skill').forEach(b => {
      const i = +b.dataset.slot; const g = p.sockets[i].main; const ico = b.querySelector('.ico'); const cd = b.querySelector('.cd');
      if (!g) { ico.textContent = ''; cd.style.height = '0'; b.classList.remove('has', 'nores'); return; }
      const def = GEMS[g.id]; ico.textContent = def.icon; ico.style.color = def.color; b.classList.add('has');
      const rem = p.cooldowns[i] || 0; cd.style.height = (def.cd ? clamp(rem / def.cd, 0, 1) * 100 : 0) + '%';
      const sk = computeSkill(p, i); b.classList.toggle('nores', !!sk && p.res < sk.cost && !p.stats.flags.has('blood_magic'));
    });
    const s = p.stats; const q = a => document.querySelector(`#tbtns .tbtn[data-action="${a}"]`);
    q('potion').querySelector('.cnt').textContent = p.potion.charges; q('potion').classList.toggle('nores', p.potion.charges <= 0);
    q('dodge').querySelector('.cd').style.height = clamp(p.dodge.cd / s.dodgeCd, 0, 1) * 100 + '%';
    const u = CLASSES[p.cls].ult; q('ult').querySelector('.cd').style.height = clamp(p.ult.cd / u.cd, 0, 1) * 100 + '%'; q('ult').classList.toggle('active', p.ult.active);
  },
};
