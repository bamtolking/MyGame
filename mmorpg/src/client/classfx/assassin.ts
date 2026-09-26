// 자객: lightning-fast teal stabs that leave a sharp cut on the target; ult 그림자 난무 = black smoke and shadow clones bursting out,
// then a shadow clone flashes to every extra target on each stab while dark afterimages and teal wisps circle the assassin.
import { SCENE, EMIT, type Painter } from '../render/paint.ts';
import { type Tex, makeTex } from '../render/art/core.ts';
import type { ClassFx, FxCtx } from './types.ts';

const TEAL = 0x2fd4c4, PALE = 0xbffff4, SHADOW = 0x1a2230;
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** Thin lens-shaped cut, pointed at both ends (white, tinted at draw time), centred. */
let cutTex: Tex | null = null;
function cutT(): Tex {
  return cutTex ??= makeTex('fx:asnCut', 64, 12, 0.5, 0.5, 2, c => {
    c.fillStyle = 'rgba(255,255,255,0.28)'; c.beginPath(); c.moveTo(0, 6); c.quadraticCurveTo(36, -1, 64, 6); c.quadraticCurveTo(36, 13, 0, 6); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(1, 6); c.quadraticCurveTo(38, 2.6, 63, 6); c.quadraticCurveTo(38, 9.4, 1, 6); c.fill();
  });
}
/** A cut that slices across (x, y) along `ang`, growing from one end in the first quarter of its life. */
function cut(p: Painter, x: number, y: number, ang: number, len: number, k: number, a: number, w = 1): void {
  const g = easeOut(Math.min(1, k * 4)), fa = a * (k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7), L = len * g, dx = Math.cos(ang), dy = Math.sin(ang);
  const cx = x - dx * (len / 2 - L / 2), cy = y - dy * (len / 2 - L / 2), T = cutT();
  p.draw(EMIT, T, cx, cy, L / 64, w * 1.2, ang, TEAL, fa * 0.85, 1); p.draw(EMIT, T, cx, cy, L / 64, w * 0.5, ang, 0xffffff, fa, 1);
}
/** Stab impact: diagonal cut across the thrust + a few sparks. */
function strike(c: FxCtx, x: number, y: number, ang: number, dir: number, len = 44): void {
  const ca = ang + dir * 1.05; c.fx.add(1, 0.2, (p, k) => cut(p, x, y, ca, len, k, 1, 1.15));
  c.fx.sparks(x, y, 4, TEAL, 300, ang, 1.1, 7); c.fx.glow(x, y, 24, TEAL, 0.16, 0.35);
}
/** Shadow clone (dark afterimage of the assassin with a teal echo) that dashes in beside a target and stabs it. */
function clone(c: FxCtx, mx: number, my: number, delay: number, dir: number): void {
  const spr = c.art.player('assassin', 'atk1'), d = Math.sign(mx - c.x) || 1; // appear on the far side, facing back at the target
  const fl = -d, hy = my - 16;
  c.fx.add(1, 0.42, (p, k) => {
    const r = 46 - easeOut(Math.min(1, k * 4)) * 24 + (k > 0.6 ? (k - 0.6) * 24 : 0), a = k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9;
    const px = mx + d * r, py = my + 2;
    p.draw(EMIT, spr, px + d * 16, py, fl, 1, 0, TEAL, a * 0.1, 1, 1); p.draw(EMIT, spr, px + d * 7, py, fl, 1, 0, TEAL, a * 0.2, 1, 1);
    p.draw(SCENE, spr, px, py, fl, 1, 0, SHADOW, a * 0.85, 0);
  }, undefined, delay);
  c.fx.later(delay + 0.05, () => { strike(c, mx, hy, d > 0 ? Math.PI : 0, dir, 40); c.fx.smoke(mx + d * 30, my - 18, 2, SHADOW, 40, 18, 0.45, 0.45); });
}

export const assassin: ClassFx = {
  atkDur: 0.22, ultR: 160,
  atk: (c, e, ang) => {
    const dir = c.n % 2 ? 1 : -1; const q = e.tid ? c.entPos('m', e.tid) : null; const hx = q?.x ?? e.tx, hy = q ? q.y - 2 : e.ty - 16;
    // thrust streak from the hand to just past the target
    const sx = c.x + Math.cos(ang) * 12, sy = c.y - 24, ex = hx + Math.cos(ang) * 14, ey = hy + Math.sin(ang) * 14;
    const beam = c.art.fx('beam'), tip = c.art.fx('streak');
    c.fx.add(1, 0.13, (p, k) => {
      const h = easeOut(Math.min(1, k * 2.6)), t = k * k, a = 1 - k * 0.7;
      const x1 = sx + (ex - sx) * h, y1 = sy + (ey - sy) * h, x0 = sx + (ex - sx) * t, y0 = sy + (ey - sy) * t;
      p.beam(EMIT, beam, x0, y0, x1, y1, 8, TEAL, 0.5 * a, 1); p.beam(EMIT, beam, x0, y0, x1, y1, 2.6, 0xffffff, 0.85 * a, 1);
      p.draw(EMIT, tip, x1, y1, 0.55, 1.2, Math.atan2(ey - sy, ex - sx), PALE, a, 1);
    });
    c.fx.later(0.035, () => strike(c, hx, hy, ang, dir));
    // ult: shadow clones strike the extra targets
    const pts = e.pts ?? [];
    for (let i = 0; i + 1 < pts.length; i += 2) clone(c, pts[i], pts[i + 1], i * 0.025, -dir);
    c.snd.play('stab', c.mine ? 0.85 : c.vol * 0.6, c.x, c.y);
    if (c.mine) c.fx.zoomPunch(0.0025);
  },
  ult: (c, e) => {
    const x = e.x, y = e.y, big = c.mine ? 1 : 0.5;
    // black smoke bursting outward in a ring (leaves the assassin visible) + teal sparks
    for (let i = 0, n = Math.round(14 * big); i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(-0.2, 0.2), s = rnd(150, 240);
      c.fx.part({ tex: 'smoke', layer: SCENE, x: x + Math.cos(a) * 18, y: y - 16 + Math.sin(a) * 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.55 - 10, drag: 0.9, life: rnd(0.55, 0.8), size: rnd(26, 36), grow: 40, col: SHADOW, a: 0.62, spin: rnd(-1, 1) });
    }
    c.fx.sparks(x, y - 26, Math.round(14 * big), TEAL, 580); c.fx.burst(x, y - 24, Math.round(12 * big), [TEAL, TEAL, PALE], 320, 6, 0.6);
    c.fx.ring(x, y, 10, 130, 0.35, TEAL, false, 0, 0.75); c.fx.glow(x, y - 24, 80, TEAL, 0.4, 0.22); c.fx.light(x, y, 280, TEAL, 1, 0.7);
    // the assassin splits: six shadow clones burst outward and fade
    const spr = c.art.player('assassin', 'atk1');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.25, ca = Math.cos(a), sa = Math.sin(a), fl = ca < 0 ? -1 : 1;
      c.fx.add(1, 0.6, (p, k) => {
        const r = 12 + easeOut(Math.min(1, k * 2.2)) * 92, px = x + ca * r, py = y + sa * r * 0.55, al = k < 0.08 ? k / 0.08 : 1 - (k - 0.08) / 0.92;
        p.draw(EMIT, spr, px - ca * 10, py - sa * 5, fl, 1, 0, TEAL, al * 0.3, 1, 1); p.draw(SCENE, spr, px, py, fl, 1, 0, SHADOW, al * 0.8, 0);
      });
    }
    // a flurry of cuts around the assassin
    for (let i = 0; i < 7; i++) c.fx.later(0.06 + i * 0.06, () => { const a = rnd(0, 6.28), r = rnd(30, 95); const px = x + Math.cos(a) * r, py = y - 20 + Math.sin(a) * r * 0.6; c.fx.add(1, 0.24, (p, k) => cut(p, px, py, a + 1.3, 52, k, 0.9, 1.3)); c.fx.sparks(px, py, 3, TEAL, 260); });
    // climax: a huge teal X carved through the crowd
    for (const [i, a] of [[0, -0.5], [1, 0.62]]) c.fx.later(0.36 + i * 0.07, () => {
      c.fx.add(1, 0.34, (p, k) => cut(p, x, y - 24, a, 250, k, 0.95, 1.8));
      for (const t of [-0.35, 0, 0.35]) c.fx.sparks(x + Math.cos(a) * 250 * t, y - 24 + Math.sin(a) * 250 * t, 3, TEAL, 320, a + Math.PI / 2, 2.4, 8);
      if (i) { c.fx.light(x, y, 300, TEAL, 1, 0.4); c.snd.play('slash2', c.vol * 0.8, x, y); if (c.mine) { c.fx.shake(0.25); c.fx.zoomPunch(0.02); } }
    });
    c.snd.play('blink', c.vol * 0.7, x, y);
  },
  aura: (p, art, t, x, y) => {
    // slow teal ground ring
    p.draw(EMIT, art.fx('ringSoft'), x, y, 1.15, 0.6, 0, TEAL, 0.24 + 0.08 * Math.sin(t * 7), 1);
    // two dark afterimages circling; visible at the sides so they never darken the assassin
    for (let i = 0; i < 2; i++) {
      const an = t * 3.4 + i * Math.PI, cx = Math.cos(an), sn = Math.sin(an), px = x + cx * 46, py = y + sn * 12, fl = cx < 0 ? -1 : 1, a = cx * cx;
      const spr = art.player('assassin', i ? 'walk0' : 'walk2');
      p.draw(EMIT, spr, px - fl * 7, py, fl, 1, 0, TEAL, a * 0.26, 1, 1); p.draw(SCENE, spr, px, py, fl, 1, 0, SHADOW, a * 0.6, 0);
    }
    // teal wisps rising around the feet
    const flame = art.fx('flame');
    for (let i = 0; i < 6; i++) {
      const ph = (t * 1.3 + i / 6) % 1, an = i * 1.05 + t * 1.6, s = 0.5 * (1 - ph * 0.5);
      p.draw(EMIT, flame, x + Math.cos(an) * 24, y - 6 + Math.sin(an) * 9 - ph * 42, s, s * 1.2, 0, TEAL, 0.42 * Math.sin(ph * Math.PI), 1);
    }
    // flickering cuts from unseen shadows (two per 1/9 s slot)
    const slot = Math.floor(t * 9), f = t * 9 - slot;
    for (let i = 0; i < 2; i++) {
      const h = hash(slot * 2 + i), a = h * 6.28, r = 30 + hash(slot * 3 + i + 7) * 26;
      cut(p, x + Math.cos(a) * r, y - 22 + Math.sin(a) * r * 0.65, a + 1.2 + hash(slot + i * 13) * 1.4, 34, f, 0.75);
    }
  },
};
