// Visual effects on the Painter: particles, attack/skill visuals, telegraphs, enemy projectiles, ground decals,
// temporary lights, floating numbers and the screen state they drive (trauma shake, zoom punch, shockwaves, flash).
import { SCENE, LIGHT, EMIT, type Painter } from './paint.ts';
import type { Art } from './art/index.ts';

export interface Pt { x: number; y: number }
export interface FxHost { entPos(kind: 'p' | 'm', id: number): Pt | null; serverTime(): number; me(): Pt | null; solidAt(x: number, y: number): boolean; players(): Pt[] }
type DrawFn = (p: Painter, k: number, t: number) => void;
interface Fx { t: number; dur: number; pass: 0 | 1 | 2; draw: DrawFn; step?: (dt: number) => boolean; delay: number }
export interface PartOpts {
  tex?: string; layer?: number; x: number; y: number; vx?: number; vy?: number; g?: number; drag?: number; life?: number; size?: number; grow?: number;
  rot?: number; spin?: number; col?: number; a?: number; add?: number; stretch?: number; home?: boolean; onDone?: () => void; fadeIn?: number; face?: boolean
}
class Part {
  tex = 'dot'; layer = EMIT; x = 0; y = 0; vx = 0; vy = 0; g = 0; drag = 0.9; life = 0.5; max = 0.5; size = 6; grow = 0; rot = 0; spin = 0; col = 0xffffff; a = 1; add = 1;
  stretch = 0; home = false; onDone?: () => void; fadeIn = 0; face = false;
}
interface Txt { x: number; y: number; s: string; color: string; size: number; t: number; dur: number; vx: number; vy: number; crit: boolean; rot: number }
interface EProj { x: number; y: number; vx: number; vy: number; r: number; t0: number; life: number; s: number; dead: boolean; trail: number }
interface Tele { sh: 0 | 1; x: number; y: number; r: number; x2: number; y2: number; t0: number; due: number; s: number }
interface Light { x: number; y: number; r: number; col: number; a: number; t: number; dur: number }
interface Wave { x: number; y: number; r1: number; s: number; t: number; dur: number }

export const TELE_COL = [0xff4646, 0xff963c, 0x8cff5a, 0x5adcff, 0xbe8cff, 0xff283c];
export const hexCol = (s: string): number => {
  if (s[0] === '#') return parseInt(s.length === 4 ? s.slice(1).split('').map(c => c + c).join('') : s.slice(1, 7), 16);
  const m = s.match(/\d+/g); return m ? (+m[0] << 16) | (+m[1] << 8) | +m[2] : 0xffffff;
};
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const easeOut3 = (k: number) => 1 - (1 - k) ** 3;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class FxSystem {
  fx: Fx[] = []; parts: Part[] = []; txt: Txt[] = []; eproj: EProj[] = []; tele: Tele[] = []; lights: Light[] = []; waves: Wave[] = [];
  private pool: Part[] = [];
  host: FxHost; art: Art; low = false; cap = 1400; time = 0; shakeOn = true;
  // screen state (read by the world renderer)
  trauma = 0; punch = 0; punchV = 0; ca = 0; flashA = 0; flashCol = 0xffffff; hitstop = 0; private stopCd = 0;
  constructor(host: FxHost, art: Art) { this.host = host; this.art = art; }

  // ---------- screen ----------
  shake(v: number): void { if (this.shakeOn) this.trauma = Math.min(1, this.trauma + v); }
  zoomPunch(v: number): void { this.punchV += v * 9; }
  chroma(v: number): void { this.ca = Math.max(this.ca, v); }
  flash(col: number, a: number): void { if (a >= this.flashA * 0.8) { this.flashA = Math.max(this.flashA, a); this.flashCol = col; } }
  /** Hit-stop: freeze the visuals for `sec`. Small stops are rate-limited so crowds of kills do not stutter. */
  stop(sec: number, force = false): void { if (this.stopCd > 0 && !force) return; this.hitstop = Math.max(this.hitstop, sec); this.stopCd = sec + 0.3; }
  /** Run fn after `sec` of visual time. */
  later(sec: number, fn: () => void): void { this.add(1, 0.001, () => {}, () => { fn(); return false; }, sec); }
  wave(x: number, y: number, r1: number, s: number, dur = 0.55): void { if (this.low) return; if (this.waves.length >= 4) this.waves.shift(); this.waves.push({ x, y, r1, s, t: 0, dur }); }
  light(x: number, y: number, r: number, col: number, a: number, dur: number): void { if (this.lights.length < 48) this.lights.push({ x, y, r, col, a, t: 0, dur }); }

  // ---------- primitives ----------
  add(pass: 0 | 1 | 2, dur: number, draw: DrawFn, step?: Fx['step'], delay = 0): void { this.fx.push({ t: 0, dur, pass, draw, step, delay }); }
  part(o: PartOpts): Part | null {
    if (this.parts.length >= (this.low ? this.cap * 0.4 : this.cap)) return null;
    const p = this.pool.pop() ?? new Part();
    p.tex = o.tex ?? 'dot'; p.layer = o.layer ?? EMIT; p.x = o.x; p.y = o.y; p.vx = o.vx ?? 0; p.vy = o.vy ?? 0; p.g = o.g ?? 0; p.drag = o.drag ?? 0.9;
    p.life = p.max = o.life ?? 0.5; p.size = o.size ?? 6; p.grow = o.grow ?? 0; p.rot = o.rot ?? Math.random() * 6.28; p.spin = o.spin ?? 0; p.col = o.col ?? 0xffffff;
    p.a = o.a ?? 1; p.add = o.add ?? (p.layer === EMIT ? 1 : 0); p.stretch = o.stretch ?? 0; p.home = o.home ?? false; p.onDone = o.onDone; p.fadeIn = o.fadeIn ?? 0; p.face = o.face ?? false;
    this.parts.push(p); return p;
  }
  /** Radial burst of glowing dots/sparks. */
  burst(x: number, y: number, n: number, cols: number[], speed = 160, size = 6, life = 0.5, tex = 'dot', g = 0, stretch = 0): void {
    if (this.low) n = Math.ceil(n / 2.5);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * rnd(0.35, 1), l = life * rnd(0.6, 1.25);
      this.part({ tex, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (g ? speed * 0.5 : 0), g, drag: 0.88, life: l, size: size * rnd(0.6, 1.3), col: cols[i % cols.length], stretch, face: stretch > 0 });
    }
  }
  sparks(x: number, y: number, n: number, col: number, speed = 420, dir?: number, spread = Math.PI, size = 10): void {
    if (this.low) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const a = dir == null ? Math.random() * Math.PI * 2 : dir + (Math.random() - 0.5) * spread; const s = speed * rnd(0.4, 1);
      this.part({ tex: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 0.84, life: rnd(0.14, 0.3), size, col: i % 3 ? col : 0xffffff, stretch: 0.004, face: true });
    }
  }
  /** Soft smoke/dust puffs (lit, normal blend). */
  smoke(x: number, y: number, n: number, col: number, speed = 60, size = 26, life = 0.8, a = 0.5): void {
    if (this.low) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) { const ang = Math.random() * Math.PI * 2, s = speed * rnd(0.3, 1); this.part({ tex: 'smoke', layer: SCENE, x: x + rnd(-6, 6), y: y + rnd(-4, 4), vx: Math.cos(ang) * s, vy: Math.sin(ang) * s * 0.6 - 12, drag: 0.9, life: life * rnd(0.7, 1.2), size: size * rnd(0.7, 1.2), grow: size * 1.2, col, a, spin: rnd(-1, 1) }); }
  }
  debris(x: number, y: number, n: number, tex: string, cols: number[], speed = 180, size = 8, life = 0.9, layer = SCENE): void {
    if (this.low) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, s = speed * rnd(0.4, 1); this.part({ tex, layer, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 520, drag: 0.94, life: life * rnd(0.7, 1.2), size: size * rnd(0.7, 1.2), col: cols[i % cols.length], spin: rnd(-12, 12) }); }
  }
  /** Expanding ring. */
  ring(x: number, y: number, r0: number, r1: number, dur: number, col: number, soft = false, pass: 0 | 1 = 1, a = 1): void {
    const tex = this.art.fx(soft ? 'ringSoft' : 'ring');
    this.add(pass, dur, (p, k) => { const r = r0 + (r1 - r0) * easeOut3(k); p.draw(EMIT, tex, x, y, (r * 2) / 128, (r * 2) / 128 * (pass === 0 ? 0.62 : 1), 0, col, a * (1 - k) * (1 - k * 0.3), 1); });
  }
  /** Soft additive glow that flares and fades. */
  glow(x: number, y: number, r: number, col: number, dur: number, a = 1, pass: 0 | 1 = 1): void {
    const tex = this.art.fx('soft'); this.add(pass, dur, (p, k) => { const s = r * 2 / 64 * (0.7 + easeOut(k) * 0.5); p.draw(EMIT, tex, x, y, s, s, 0, col, a * (1 - k) ** 1.6, 1); });
  }
  /** Ground decal (scorch/crack/ink) that fades out. */
  decal(x: number, y: number, tex: string, size: number, col: number, dur: number, a = 0.7, layer = SCENE, rot = Math.random() * 6.28): void {
    const t = this.art.fx(tex); const s = size / Math.max(t.w, t.h);
    this.add(0, dur, (p, k) => p.draw(layer, t, x, y, s * (k < 0.06 ? 0.8 + k / 0.06 * 0.2 : 1), s * 0.62 * (k < 0.06 ? 0.8 + k / 0.06 * 0.2 : 1), rot, col, a * (k > 0.6 ? (1 - k) / 0.4 : 1), layer === EMIT ? 1 : 0));
  }
  /** Rotating magic circle on the ground. */
  sigil(x: number, y: number, r: number, col: number, dur: number, tex = 'sigil', spin = 0.8, a = 0.9): void {
    const t = this.art.fx(tex);
    this.add(0, dur, (p, k, tt) => { const s = (r * 2) / t.w * (k < 0.15 ? easeOut(k / 0.15) : 1); const al = a * (k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1); p.draw(EMIT, t, x, y, s, s * 0.62, tt * spin, col, al, 1); });
  }
  /** Brush-stroke crescent slash. dir: +1 clockwise sweep, -1 counter-clockwise. */
  slash(x: number, y: number, ang: number, range: number, col: number, big = false, dir = 1): void {
    const tS = this.art.fx('slash'), tI = this.art.fx('slashInk'), beam = this.art.fx('beam'); const dur = big ? 0.26 : 0.2; const s = range * 2.15 / 128;
    this.add(1, dur, (p, k) => {
      const sweep = easeOut3(Math.min(1, k * 1.8)); const rot = ang + dir * (-1.0 + sweep * 1.15);
      const sc = s * (0.86 + sweep * 0.2), fade = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
      p.draw(SCENE, tI, x, y, sc * 1.02, sc * 1.02 * dir, rot, 0x1a1030, 0.45 * fade, 0);
      p.draw(EMIT, tS, x, y, sc, sc * dir, rot, col, 0.72 * fade, 1);
      p.draw(EMIT, tS, x, y, sc * 0.9, sc * 0.9 * dir, rot + dir * 0.06, 0xffffff, 0.4 * fade * fade, 1);
      const a1 = ang + dir * (-1.25 + sweep * 2.2); p.arc(EMIT, beam, x, y, range * 0.93, big ? 14 : 9, a1 - dir * 1.4, a1, 0xffffff, 0.6 * fade, 1);
    });
  }
  /** Jagged lightning between two points (glow + core). */
  bolt(x1: number, y1: number, x2: number, y2: number, col: number, width = 10, dur = 0.24, jag = 30): void {
    const pts: number[] = []; const n = Math.max(4, Math.min(12, Math.round(Math.hypot(x2 - x1, y2 - y1) / 40)));
    const nx = -(y2 - y1), ny = x2 - x1, L = Math.hypot(nx, ny) || 1;
    for (let i = 0; i <= n; i++) { const t = i / n, j = i === 0 || i === n ? 0 : (Math.random() - 0.5) * jag; pts.push(x1 + (x2 - x1) * t + nx / L * j, y1 + (y2 - y1) * t + ny / L * j); }
    const beam = this.art.fx('beam'), soft = this.art.fx('soft');
    this.add(1, dur, (p, k) => {
      const a = k < 0.15 ? 1 : (1 - k) / 0.85; const flick = Math.random() < 0.25 ? 0.55 : 1;
      for (let i = 0; i + 3 < pts.length; i += 2) { p.beam(EMIT, beam, pts[i], pts[i + 1], pts[i + 2], pts[i + 3], width * 3, col, a * 0.6 * flick, 1); p.beam(EMIT, beam, pts[i], pts[i + 1], pts[i + 2], pts[i + 3], width, 0xffffff, a * flick, 1); }
      p.draw(EMIT, soft, x2, y2, 1.4, 1.4, 0, col, a * 0.8, 1);
    });
  }
  /** Vertical light pillar with a glowing base. */
  pillar(x: number, y: number, col: number, dur = 1, w = 40, h = 260): void {
    const t = this.art.fx('pillar'), soft = this.art.fx('soft');
    this.add(1, dur, (p, k) => { const a = k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88; const sw = w / t.w * (1 - k * 0.4); p.draw(EMIT, t, x, y, sw, h / t.h, 0, col, a, 1); p.draw(EMIT, t, x, y, sw * 0.35, h / t.h * 0.9, 0, 0xffffff, a * 0.5, 1); p.draw(EMIT, soft, x, y, w / 22, w / 44, 0, col, a * 0.5, 1); });
  }
  /** "퇴마" seal stamp that slams down and fades. */
  stamp(x: number, y: number, size: number, dur = 0.7): void {
    const t = this.art.fx('seal'); const s0 = size / t.w;
    this.add(1, dur, (p, k) => { const s = s0 * (k < 0.12 ? 1.6 - easeOut(k / 0.12) * 0.6 : 1); p.draw(EMIT, t, x, y, s, s, -0.12, 0xffffff, k < 0.12 ? k / 0.12 : (1 - k) / 0.88, 0); });
  }
  /** Projectile that follows an entity (or a fixed point) and fires onArrive. */
  homing(from: Pt, to: { kind: 'p' | 'm'; id: number } | Pt, speed: number, style: 'arrow' | 'paper' | 'wisp' | 'pierce' | 'rain', onArrive?: (p: Pt) => void, curve = 0): void {
    let x = from.x, y = from.y; let last: Pt = 'id' in to ? (this.host.entPos(to.kind, to.id) ?? from) : to; const t0 = this.time;
    const side = curve * (Math.random() < 0.5 ? -1 : 1); let ang = Math.atan2(last.y - y, last.x - x);
    const A = this.art; const tArrow = A.fx('arrow'), tPaper = A.fx('paper'), tSoft = A.fx('soft'), tFlame = A.fx('flame'), tStreak = A.fx('streak'), tDot = A.fx('dot');
    this.add(1, 3, (p) => {
      if (style === 'arrow' || style === 'rain') { p.draw(EMIT, tStreak, x, y, (style === 'rain' ? 1.4 : 1.1), 0.9, ang, style === 'rain' ? 0xc8ffc0 : 0xfff2d0, 0.7, 1); p.draw(SCENE, tArrow, x, y, 0.95, 0.95, ang, 0xffffff, 1, 0); }
      else if (style === 'paper') { p.draw(EMIT, tSoft, x, y, 0.55, 0.55, 0, 0xff7ab8, 0.8, 1); p.draw(SCENE, tPaper, x, y, 0.9, 0.9, this.time * 16, 0xffffff, 1, 0); }
      else if (style === 'pierce') { p.draw(EMIT, tStreak, x, y, 2.2, 2.4, ang, 0xa6ff9e, 0.9, 1); p.draw(EMIT, tStreak, x, y, 1.6, 1.1, ang, 0xffffff, 1, 1); p.draw(EMIT, tSoft, x, y, 0.5, 0.5, 0, 0xa6ff9e, 0.8, 1); }
      else { p.draw(EMIT, tSoft, x, y, 0.8, 0.8, 0, 0x4f9cff, 0.9, 1); p.draw(EMIT, tFlame, x, y, 0.7, 0.7, ang - Math.PI / 2, 0x8fc8ff, 1, 1); p.draw(EMIT, tDot, x, y, 0.8, 0.8, 0, 0xffffff, 1, 1); }
    }, (dt) => {
      if ('id' in to) { const q = this.host.entPos(to.kind, to.id); if (q) last = q; }
      const dx = last.x - x, dy = last.y - y; const d = Math.hypot(dx, dy); const stepL = speed * dt;
      if (d <= stepL + 4 || this.time - t0 > 2.5) { onArrive?.(last); return false; }
      const k = Math.min(1, (this.time - t0) * 3); const px = -dy / d * side * (1 - k) * 0.9, py = dx / d * side * (1 - k) * 0.9;
      const mx = (dx / d + px), my = (dy / d + py); x += mx * stepL; y += my * stepL; ang = Math.atan2(my, mx);
      if (!this.low) {
        if (style === 'wisp' && Math.random() < 0.8) this.part({ tex: 'flame', x, y, vx: rnd(-10, 10), vy: -30, life: 0.3, size: rnd(8, 13), grow: -12, col: 0x5fa8ff, rot: 0 });
        else if (style === 'paper' && Math.random() < 0.5) this.part({ tex: 'dot', x, y, vx: rnd(-20, 20), vy: rnd(-20, 20), life: 0.35, size: 5, col: Math.random() < 0.5 ? 0xff7ab8 : 0xffe07a });
        else if (style === 'pierce' && Math.random() < 0.7) this.part({ tex: 'spark', x, y, vx: -mx * 60, vy: -my * 60, life: 0.2, size: 8, col: 0xa6ff9e, stretch: 0.01, face: true });
      }
      return true;
    });
  }
  telegraph(t: Omit<Tele, 't0'> & { t0?: number }): void { this.tele.push({ t0: this.host.serverTime(), ...t } as Tele); }
  enemyProj(x: number, y: number, vx: number, vy: number, r: number, life: number, s: number, t0: number): void { this.eproj.push({ x, y, vx, vy, r, life, s, t0, dead: false, trail: 0 }); }
  text(x: number, y: number, s: string, color: string, size = 15, crit = false, dur = 0.9): void {
    if (!crit && this.txt.length > 26) return; // keep crowds readable: plain numbers give way to crits and events
    if (this.txt.length > 60) this.txt.shift();
    this.txt.push({ x: x + rnd(-10, 10), y, s, color, size, t: 0, dur, vx: rnd(-18, 18), vy: crit ? -90 : -60, crit, rot: crit ? rnd(-0.12, 0.12) : 0 });
  }

  // ---------- simulation ----------
  update(dt: number, realDt: number): void {
    this.time += dt;
    // screen state runs on real time so hit-stop does not freeze the shake
    this.trauma = Math.max(0, this.trauma - realDt * 1.5); this.ca = Math.max(0, this.ca - realDt * 0.05); this.flashA = Math.max(0, this.flashA - realDt * 3.2);
    this.punchV += (-120 * this.punch - 14 * this.punchV) * realDt; this.punch += this.punchV * realDt;
    this.hitstop = Math.max(0, this.hitstop - realDt); this.stopCd = Math.max(0, this.stopCd - realDt);
    for (const w of this.waves) w.t += realDt; this.waves = this.waves.filter(w => w.t < w.dur);
    if (dt <= 0) return;
    let j = 0; for (const f of this.fx) { if (f.delay > 0) { f.delay -= dt; this.fx[j++] = f; continue; } f.t += dt; if (f.step && !f.step(dt)) continue; if (f.t < f.dur) this.fx[j++] = f; } this.fx.length = j;
    const me = this.host.me(); j = 0;
    for (const p of this.parts) {
      p.life -= dt;
      if (p.home && me) {
        const dx = me.x - p.x, dy = me.y - 18 - p.y; const d = Math.hypot(dx, dy);
        if (d < 16 && p.life < p.max - 0.25) { p.life = 0; p.onDone?.(); }
        else { const k = Math.min(1, (p.max - p.life) * 2.4); p.vx = p.vx * (1 - k * 0.2) + (dx / (d || 1)) * 5400 * k * dt; p.vy = p.vy * (1 - k * 0.2) + (dy / (d || 1)) * 5400 * k * dt; }
      }
      const dr = Math.pow(p.drag, dt * 60); p.vx *= dr; p.vy = p.vy * dr + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt; p.size = Math.max(0, p.size + p.grow * dt);
      if (p.life > 0) this.parts[j++] = p; else if (this.pool.length < 2000) this.pool.push(p);
    }
    this.parts.length = j;
    for (const t of this.txt) { t.t += dt; t.x += t.vx * dt; t.y += t.vy * dt; t.vy *= Math.pow(0.88, dt * 60); t.vx *= Math.pow(0.9, dt * 60); }
    this.txt = this.txt.filter(t => t.t < t.dur);
    for (const l of this.lights) l.t += dt; this.lights = this.lights.filter(l => l.t < l.dur);
    const now = this.host.serverTime(); const pl = this.host.players();
    for (const p of this.eproj) {
      const el = now - p.t0; if (el > p.life) { p.dead = true; continue; } if (el < 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (this.host.solidAt(p.x, p.y)) { p.dead = true; this.burst(p.x, p.y, 5, [0xffffff, 0xff9a9a], 90, 5, 0.25); continue; }
      for (const q of pl) if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 < (p.r + 12) ** 2) { p.dead = true; this.sparks(p.x, p.y, 6, 0xff8a8a, 260); this.glow(p.x, p.y, 30, 0xff6a6a, 0.2); break; }
      if (!this.low && p.s !== 1 && p.s !== 3 && p.s !== 5 && (p.trail += dt) > 0.03) { p.trail = 0; this.part({ tex: 'dot', x: p.x, y: p.y, life: 0.25, size: p.r * 1.2, grow: -p.r * 3, col: p.s === 2 ? 0xff8c32 : p.s === 4 ? 0xb48cff : 0x5ac8ff }); }
    }
    this.eproj = this.eproj.filter(p => !p.dead);
    this.tele = this.tele.filter(t => now < t.due + 0.05);
  }

  // ---------- drawing ----------
  /** Telegraphs, decals and ground effects (before sprites). */
  drawGround(p: Painter): void {
    const now = this.host.serverTime(); const A = this.art; const disc = A.fx('disc'), ring = A.fx('ring'), runes = A.fx('runes'), bar = A.fx('bar'), beam = A.fx('beam'), danger = A.fx('danger');
    for (const t of this.tele) {
      const k = Math.max(0, Math.min(1, (now - t.t0) / Math.max(0.05, t.due - t.t0))); const col = TELE_COL[t.s] ?? TELE_COL[0]; const pulse = 0.75 + 0.25 * Math.sin(this.time * 18);
      if (t.sh === 0) {
        const s = (t.r * 2) / 128; const sy = s * 0.62;
        p.draw(EMIT, disc, t.x, t.y, s, sy, 0, col, 0.13, 1);
        p.draw(EMIT, disc, t.x, t.y, s * k, sy * k, 0, col, 0.2 + k * 0.2, 1);
        p.draw(EMIT, ring, t.x, t.y, s, sy, 0, col, 0.75 * pulse, 1);
        if (t.r > 60) p.draw(EMIT, runes, t.x, t.y, s * 0.94, sy * 0.94, this.time * 0.6, col, 0.35, 1);
        if (k > 0.85) p.draw(EMIT, ring, t.x, t.y, s * (1 + (k - 0.85) * 0.6), sy * (1 + (k - 0.85) * 0.6), 0, 0xffffff, (k - 0.85) / 0.15 * 0.8, 1);
        p.draw(EMIT, danger, t.x, t.y - 4, 1.1, 1.1, 0, col, 0.75 * pulse, 1);
      } else {
        const L = Math.hypot(t.x2 - t.x, t.y2 - t.y), ex = t.x + (t.x2 - t.x) * k, ey = t.y + (t.y2 - t.y) * k;
        p.beam(EMIT, bar, t.x, t.y, t.x2, t.y2, t.r, col, 0.1, 1);
        if (k > 0.01) p.beam(EMIT, bar, t.x, t.y, ex, ey, t.r, col, 0.12 + k * 0.2, 1);
        const nx = -(t.y2 - t.y) / (L || 1) * t.r / 2, ny = (t.x2 - t.x) / (L || 1) * t.r / 2;
        p.beam(EMIT, beam, t.x + nx, t.y + ny, t.x2 + nx, t.y2 + ny, 7, col, pulse, 1); p.beam(EMIT, beam, t.x - nx, t.y - ny, t.x2 - nx, t.y2 - ny, 7, col, pulse, 1);
      }
    }
    for (const f of this.fx) if (f.pass === 0 && f.delay <= 0) f.draw(p, Math.min(1, f.t / f.dur), f.t);
  }
  /** Effects, projectiles and particles over the sprites. */
  drawTop(p: Painter): void {
    for (const f of this.fx) if (f.pass === 1 && f.delay <= 0) f.draw(p, Math.min(1, f.t / f.dur), f.t);
    const now = this.host.serverTime(); const A = this.art; const soft = A.fx('soft'), dot = A.fx('dot');
    for (const q of this.eproj) {
      if (now < q.t0) continue; const a = Math.atan2(q.vy, q.vx);
      switch (q.s) {
        case 1: p.draw(EMIT, soft, q.x, q.y, 0.6, 0.6, 0, 0x8a6aff, 0.5, 1); p.draw(SCENE, A.fx('feather'), q.x, q.y, 1.3, 1.3, a, 0x2a2036, 1, 0); break;
        case 3: p.draw(EMIT, soft, q.x, q.y, 0.7, 0.7, 0, 0xffd54a, 0.6, 1); p.draw(SCENE, A.fx('coin'), q.x, q.y, 1.1, 1.1, this.time * 9, 0xffffff, 1, 0); break;
        case 5: p.draw(EMIT, soft, q.x, q.y, 0.6, 0.6, 0, 0xff7a2a, 0.6, 1); p.draw(SCENE, A.fx('shard'), q.x, q.y, 1.5, 1.5, a, 0xc8d0dc, 1, 0); break;
        default: {
          const col = q.s === 2 ? 0xff8c32 : q.s === 4 ? 0xb48cff : 0x5ac8ff; const s = q.r / 9;
          p.draw(EMIT, soft, q.x, q.y, s * 0.9, s * 0.9, 0, col, 0.95, 1); p.draw(EMIT, dot, q.x, q.y, s * 1.1, s * 1.1, 0, 0xffffff, 1, 1);
        }
      }
    }
    for (const q of this.parts) {
      const k = Math.max(0, q.life / q.max); let a = q.a * Math.min(1, k * 1.8); if (q.fadeIn > 0) a *= Math.min(1, (q.max - q.life) / q.fadeIn);
      const t = A.fx(q.tex); const base = q.size / Math.max(t.w, t.h) * 2;
      if (q.stretch > 0) { const v = Math.hypot(q.vx, q.vy); p.draw(q.layer, t, q.x, q.y, base * (1 + v * q.stretch), base, Math.atan2(q.vy, q.vx), q.col, a, q.add); }
      else p.draw(q.layer, t, q.x, q.y, base, base, q.face ? Math.atan2(q.vy, q.vx) : q.rot, q.col, a, q.add);
    }
  }
  /** Temporary lights into the light map. */
  drawLights(p: Painter): void {
    const t = this.art.fx('light');
    for (const l of this.lights) { const k = l.t / l.dur; const s = l.r * 2 / 64; p.draw(LIGHT, t, l.x, l.y, s, s * 0.8, 0, l.col, l.a * (1 - k) * (1 - k), 1); }
    for (const q of this.eproj) if (q.s !== 1 && q.s !== 5) p.draw(LIGHT, t, q.x, q.y, 2.4, 2, 0, q.s === 2 ? 0xff8c32 : q.s === 3 ? 0xffd54a : q.s === 4 ? 0xb48cff : 0x5ac8ff, 0.5, 1);
  }
  /** Shockwaves in the format PostFx expects. */
  waveList(out: number[]): void { out.length = 0; for (const w of this.waves) { const k = w.t / w.dur; out.push(w.x, w.y, w.r1 * easeOut(k), w.s * (1 - k) * (1 - k)); } }
  /** Floating numbers on the 2D overlay. toScreen maps world → css px. */
  drawText(c: CanvasRenderingContext2D, toScreen: (x: number, y: number) => [number, number], scale: number): void {
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    for (const t of this.txt) {
      const k = t.t / t.dur; const pop = k < 0.1 ? 0.5 + (k / 0.1) * 0.9 : k < 0.22 ? 1.4 - ((k - 0.1) / 0.12) * 0.4 : 1;
      const [sx, sy] = toScreen(t.x, t.y); const size = Math.round(t.size * pop * scale); if (size < 4) continue;
      c.globalAlpha = k > 0.72 ? 1 - (k - 0.72) / 0.28 : 1;
      c.save(); c.translate(sx, sy); if (t.rot) c.rotate(t.rot);
      c.font = `${size}px "Black Han Sans", system-ui, sans-serif`;
      c.lineWidth = Math.max(3, size * 0.22); c.strokeStyle = t.crit ? 'rgba(60,8,0,0.92)' : 'rgba(14,8,26,0.9)'; c.strokeText(t.s, 0, 0);
      if (t.crit) { const g = c.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, '#fff6b0'); g.addColorStop(0.5, t.color); g.addColorStop(1, '#ff5a1f'); c.fillStyle = g; }
      else c.fillStyle = t.color;
      c.fillText(t.s, 0, 0); c.restore();
    }
    c.globalAlpha = 1;
  }
}
