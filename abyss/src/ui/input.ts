// Input: mouse (click-to-move/attack, hold to repeat, right-click skill), keyboard (1-5, Q/E/T, WASD, panels)
// and touch (virtual joystick, attack/skill buttons with auto-aim, tap-to-interact).
import { CLASSES, SKILLS } from '../data/classes';
import { MONSTERS } from '../data/monsters';
import { los } from '../sim/path';
import { rankOf } from '../sim/skills';
import type { Monster } from '../sim/types';
import type { App } from './app';
import type { Hover } from '../render/renderer';
import { HALF_H, HALF_W } from '../render/iso';

export function screenToWorldDir(u: number, v: number): { x: number; y: number } {
  const a = (u / HALF_W + v / HALF_H) / 2, b = (v / HALF_H - u / HALF_W) / 2;
  const l = Math.hypot(a, b) || 1;
  return { x: a / l, y: b / l };
}

export class Input {
  app: App;
  keys = new Set<string>();
  mouse = { x: 0, y: 0, down: false, right: false, shift: false, target: null as Hover | null, inside: false };
  joy = { id: -1, cx: 0, cy: 0, x: 0, y: 0, active: false };
  attackHeld = false;
  heldSkill = -1;
  lastTouchAt = 0;

  constructor(app: App) { this.app = app; }

  get g() { return this.app.g!; }
  get r() { return this.app.r!; }

  attach(cv: HTMLCanvasElement): void {
    cv.addEventListener('mousemove', (e) => { this.mouse.x = e.offsetX; this.mouse.y = e.offsetY; this.mouse.inside = true; this.mouse.shift = e.shiftKey; });
    cv.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    cv.addEventListener('mousedown', (e) => {
      if (performance.now() - this.lastTouchAt < 800) return;
      this.app.unlockAudio();
      this.mouse.x = e.offsetX; this.mouse.y = e.offsetY; this.mouse.inside = true; this.mouse.shift = e.shiftKey;
      this.app.hideTip();
      if (e.button === 2) { this.mouse.right = true; this.castAtCursor(this.g.hero.rmbSkill); return; }
      if (e.button !== 0) return;
      this.mouse.down = true;
      this.clickAt(e.offsetX, e.offsetY, e.shiftKey, true);
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) { this.mouse.down = false; this.mouse.target = null; } if (e.button === 2) this.mouse.right = false; });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; this.mouse.right = false; this.attackHeld = false; this.heldSkill = -1; });
    // touch on the play field (outside of buttons)
    cv.addEventListener('touchstart', (e) => {
      this.lastTouchAt = performance.now();
      this.app.unlockAudio();
      this.app.setTouchMode(true);
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        const rect = cv.getBoundingClientRect();
        const x = t.clientX - rect.left, y = t.clientY - rect.top;
        if (!this.joy.active && x < rect.width * 0.42 && y > rect.height * 0.45) { this.joy = { id: t.identifier, cx: x, cy: y, x, y, active: true }; this.app.showJoy(this.joy); continue; }
        this.clickAt(x, y, false, false);
      }
    }, { passive: false });
    cv.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== this.joy.id) continue;
        const rect = cv.getBoundingClientRect();
        this.joy.x = t.clientX - rect.left; this.joy.y = t.clientY - rect.top;
        this.app.showJoy(this.joy);
      }
    }, { passive: false });
    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) if (t.identifier === this.joy.id) { this.joy.active = false; this.joy.id = -1; this.app.showJoy(null); this.g?.setIntent(null); }
    };
    cv.addEventListener('touchend', end); cv.addEventListener('touchcancel', end);
  }

  /** Joystick zone also works when starting on the joystick element itself. */
  attachJoyZone(el: HTMLElement): void {
    el.addEventListener('touchstart', (e) => {
      e.preventDefault(); this.lastTouchAt = performance.now(); this.app.unlockAudio();
      const t = e.changedTouches[0];
      const rect = this.app.cv!.getBoundingClientRect();
      const x = t.clientX - rect.left, y = t.clientY - rect.top;
      this.joy = { id: t.identifier, cx: x, cy: y, x, y, active: true }; this.app.showJoy(this.joy);
    }, { passive: false });
    el.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) if (t.identifier === this.joy.id) { const rect = this.app.cv!.getBoundingClientRect(); this.joy.x = t.clientX - rect.left; this.joy.y = t.clientY - rect.top; this.app.showJoy(this.joy); }
    }, { passive: false });
    const end = (e: TouchEvent) => { for (const t of Array.from(e.changedTouches)) if (t.identifier === this.joy.id) { this.joy.active = false; this.app.showJoy(null); this.g?.setIntent(null); } };
    el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (!this.app.g || this.app.screen !== 'game') return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (k === 'tab' || k === 'alt' || k === ' ') e.preventDefault();
    if (!down) {
      this.keys.delete(k);
      if (k === 'alt') this.r.showAll = this.app.settings.showLabels;
      if (['1', '2', '3', '4', '5'].includes(k) && this.heldSkill === Number(k) - 1) this.heldSkill = -1;
      if (k === ' ') this.attackHeld = false;
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k) && !this.anyMoveKey()) this.g.setIntent(null);
      return;
    }
    if (e.repeat && !['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) return;
    this.app.unlockAudio();
    this.keys.add(k);
    const app = this.app;
    switch (k) {
      case '1': case '2': case '3': case '4': case '5': this.heldSkill = Number(k) - 1; this.castAtCursor(this.heldSkill); break;
      case 'q': this.g.usePotion('hp'); break;
      case 'e': this.g.usePotion('mp'); break;
      case 't': this.g.useScroll(); break;
      case 'i': case 'b': app.togglePanel('inv'); break;
      case 'c': app.togglePanel('char'); break;
      case 'k': app.togglePanel('skills'); break;
      case 'tab': case 'm': app.toggleMap(); break;
      case 'alt': this.r.showAll = true; break;
      case 'z': app.settings.showLabels = !app.settings.showLabels; this.r.showAll = app.settings.showLabels; break;
      case 'escape': app.escape(); break;
      case ' ': this.attackHeld = true; break;
    }
  }

  private anyMoveKey(): boolean {
    for (const k of ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']) if (this.keys.has(k)) return true;
    return false;
  }

  clickAt(x: number, y: number, shift: boolean, fromMouse: boolean): void {
    const g = this.g, r = this.r;
    if (!g || g.hero.dead) return;
    const hv = r.pick(g, x, y);
    const wp = r.cam.toWorld(x, y);
    this.mouse.target = hv;
    if (shift) { g.setIntent({ type: 'attackPoint', x: wp.x, y: wp.y }); return; }
    if (hv?.kind === 'monster') { g.setIntent({ type: 'attack', id: hv.id, hold: fromMouse }); return; }
    if (hv?.kind === 'drop' || hv?.kind === 'prop' || hv?.kind === 'npc' || hv?.kind === 'stairs') {
      g.setIntent({ type: 'interact', kind: hv.kind, id: hv.id, x: hv.x, y: hv.y });
      this.mouse.target = null;
      this.mouse.down = fromMouse ? false : this.mouse.down;
      return;
    }
    g.setIntent({ type: 'move', x: wp.x, y: wp.y });
    r.moveMarker = { x: wp.x, y: wp.y, t: 0.5 };
  }

  /** Aim point for a skill: cursor on desktop, auto-aim on touch. */
  aim(slot: number): { x: number; y: number; id: number } {
    const g = this.g, h = g.hero;
    const id = slot < 0 ? CLASSES[h.cls].basic : CLASSES[h.cls].skills[slot];
    const def = SKILLS[id];
    if (!this.app.touchMode && this.mouse.inside) {
      const wp = this.r.cam.toWorld(this.mouse.x, this.mouse.y);
      const hv = this.r.hover;
      return { x: wp.x, y: wp.y, id: hv?.kind === 'monster' ? hv.id : 0 };
    }
    // touch: joystick direction or facing
    let dir = { x: Math.cos(h.facing), y: Math.sin(h.facing) };
    if (this.joy.active) { const jx = this.joy.x - this.joy.cx, jy = this.joy.y - this.joy.cy; if (Math.hypot(jx, jy) > 12) dir = screenToWorldDir(jx, jy); }
    if (def.kind === 'move') {
      const m = def.id === 'leap' ? this.bestTarget(def.range, dir) : null;
      if (m) return { x: m.x, y: m.y, id: m.id };
      return { x: h.x + dir.x * def.range, y: h.y + dir.y * def.range, id: 0 };
    }
    const m = this.bestTarget(def.kind === 'melee' ? 3 : Math.min(def.range, 11), dir);
    if (m) return { x: m.x, y: m.y, id: m.id };
    return { x: h.x + dir.x * 4, y: h.y + dir.y * 4, id: 0 };
  }

  bestTarget(range: number, dir: { x: number; y: number }): Monster | null {
    const g = this.g, h = g.hero;
    let best: Monster | null = null, bs = 1e9;
    for (const m of g.world.monsters) {
      if (m.dead) continue;
      const dx = m.x - h.x, dy = m.y - h.y, d = Math.hypot(dx, dy);
      if (d > range) continue;
      if (!los(g.world, h.x, h.y, m.x, m.y)) continue;
      const dot = (dx * dir.x + dy * dir.y) / (d || 1);
      const s = d * (1.6 - dot * 0.6) - (m.rank !== 'normal' ? 0.5 : 0) + (MONSTERS[m.tpl].ai === 'boss' ? -1 : 0);
      if (s < bs) { bs = s; best = m; }
    }
    return best;
  }

  castAtCursor(slot: number): void {
    const g = this.g;
    if (!g || g.hero.dead || g.world.floor === 0) return;
    const a = this.aim(slot);
    g.cast(slot, a.x, a.y, a.id);
  }

  /** Touch attack button: attack the best target or break a nearby barrel. */
  touchAttack(): void {
    const g = this.g, h = g.hero;
    if (h.dead) return;
    let dir = { x: Math.cos(h.facing), y: Math.sin(h.facing) };
    if (this.joy.active) { const jx = this.joy.x - this.joy.cx, jy = this.joy.y - this.joy.cy; if (Math.hypot(jx, jy) > 12) dir = screenToWorldDir(jx, jy); }
    const basic = SKILLS[CLASSES[h.cls].basic];
    const m = this.bestTarget(basic.kind === 'melee' ? 6 : 11, dir);
    if (m) { g.setIntent({ type: 'attack', id: m.id, hold: false }); return; }
    const p = g.world.props.find((q) => !q.used && (q.kind === 'barrel' || q.kind === 'crate') && Math.hypot(q.x - h.x, q.y - h.y) < 3);
    if (p && g.world.floor > 0) { g.setIntent({ type: 'interact', kind: 'prop', id: p.id, x: p.x, y: p.y }); return; }
    if (g.world.floor > 0) g.setIntent({ type: 'attackPoint', x: h.x + dir.x * 2, y: h.y + dir.y * 2 });
  }

  /** Per-frame continuous controls. */
  frame(): void {
    const g = this.app.g;
    if (!g || g.hero.dead || this.app.paused) return;
    const h = g.hero;
    // keyboard / joystick movement
    let u = 0, v = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) v -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) v += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) u -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) u += 1;
    if (this.joy.active) { const jx = this.joy.x - this.joy.cx, jy = this.joy.y - this.joy.cy; if (Math.hypot(jx, jy) > 10) { u = jx; v = jy; } }
    const moving = u !== 0 || v !== 0;
    if (this.attackHeld && !h.act) {
      if (this.app.touchMode) this.touchAttack();
      else { const wp = this.r.cam.toWorld(this.mouse.x, this.mouse.y); g.setIntent({ type: 'attackPoint', x: wp.x, y: wp.y }); }
    } else if (moving) {
      const d = screenToWorldDir(u, v);
      if (!h.intent || h.intent.type === 'dir' || h.intent.type === 'move' || this.joy.active || this.anyMoveKey()) g.setIntent({ type: 'dir', dx: d.x, dy: d.y });
    }
    // held mouse: keep moving toward cursor / attacking
    if (this.mouse.down && !moving) {
      const t = this.mouse.target;
      if (t?.kind === 'monster') {
        const alive = g.world.monsters.some((m) => m.id === t.id && !m.dead);
        if (alive) { if (!h.intent || h.intent.type !== 'attack') g.setIntent({ type: 'attack', id: t.id, hold: true }); }
        else this.mouse.target = null;
      } else if (this.mouse.shift) {
        const wp = this.r.cam.toWorld(this.mouse.x, this.mouse.y);
        if (!h.act) g.setIntent({ type: 'attackPoint', x: wp.x, y: wp.y });
      } else if (!h.intent || h.intent.type === 'move') {
        const wp = this.r.cam.toWorld(this.mouse.x, this.mouse.y);
        g.setIntent({ type: 'move', x: wp.x, y: wp.y });
      }
    }
    if (this.mouse.right && !h.act) this.castAtCursor(h.rmbSkill);
    if (this.heldSkill >= 0 && !h.act) {
      const id = CLASSES[h.cls].skills[this.heldSkill];
      if (rankOf(g, this.heldSkill) > 0 && SKILLS[id].cd(1) === 0) this.castAtCursor(this.heldSkill);
    }
  }
}
