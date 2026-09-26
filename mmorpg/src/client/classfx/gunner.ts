// 포수: matchlock shot = muzzle flash + smoke, a fast piercing tracer and a small blast at the target;
// ult 신기전 = a hwacha rocket cart pops up behind the gunner and 16 fire-arrow rockets arc onto the crowd and explode.
import { CLASSES, ATK } from '../../shared/data/classes.ts';
import { SCENE, EMIT, LIGHT } from '../render/paint.ts';
import { type Tex, type Ctx, makeTex, INK, vol, circle, rrect, poly, fillC, line } from '../render/art/core.ts';
import type { ClassFx, FxCtx } from './types.ts';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const ORANGE = 0xff7a2a, GOLD = 0xffd070, HOT = 0xfff0c8;
const easeBack = (k: number) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;

// ---------- custom textures ----------
let rocketT: Tex | null = null, hwachaT: Tex | null = null;
/** 신기전 fire arrow: fletching, bamboo shaft, red paper powder tube, iron head. Anchor = rear of the tube (the nozzle). */
const rocketTex = (): Tex => rocketT ??= makeTex('gunner:rocket', 46, 10, 27 / 46, 0.5, 3, (c: Ctx) => {
  poly(c, [0.5, 1.5, 8, 5, 0.5, 8.5, 3, 5]); fillC(c, '#e9e2d2', INK, 1);
  line(c, [2, 5, 40, 5], INK, 2.6); line(c, [2, 5, 40, 5], '#d8b878', 1.2);
  rrect(c, 27, 2.2, 11, 5.6, 1.6); vol(c, '#d2323c', 27, 2.2, 38, 7.8, 1.2, INK, 0.35, -0.3);
  for (const x of [30, 34.5]) line(c, [x, 2.4, x, 7.6], '#f2c84b', 0.9);
  poly(c, [38.5, 3, 45.5, 5, 38.5, 7]); fillC(c, '#c4ccd8', INK, 1);
});
/** 화차: two-wheeled cart with a tilted rack of rocket tubes (faces right). Anchor = ground under the wheel. */
const RACK_X = 36, RACK_Y = 27, RACK_A = -0.6;
const hwachaTex = (): Tex => hwachaT ??= makeTex('gunner:hwacha', 72, 60, 0.5, 0.95, 3, (c: Ctx) => {
  line(c, [3, 51, 44, 43], INK, 5.4); line(c, [3, 51, 44, 43], '#8a5a34', 3);
  rrect(c, 13, 37, 36, 6.5, 2); vol(c, '#7a4a2a', 13, 37, 49, 43.5, 1.8);
  rrect(c, 41, 22, 4.5, 17, 1.2); vol(c, '#6a3e22', 41, 22, 45.5, 39, 1.5);
  c.save(); c.translate(RACK_X, RACK_Y); c.rotate(RACK_A);
  for (let i = 0; i < 5; i++) { const y = -7.6 + i * 3.8; line(c, [-24, y, -16, y], INK, 2.2); line(c, [-24, y, -16, y], '#d8b878', 1); poly(c, [-25, y - 1.8, -20, y, -25, y + 1.8]); fillC(c, '#ece6d8', INK, 0.8); }
  rrect(c, -17, -10, 34, 20, 2); vol(c, '#8a5430', -17, -10, 17, 10, 2);
  for (let i = 1; i < 5; i++) line(c, [-15.5, -10 + i * 4, 15.5, -10 + i * 4], 'rgba(40,18,8,0.55)', 0.9);
  for (const x of [-9, 6]) { rrect(c, x, -10.6, 2.6, 21.2, 0.6); fillC(c, '#4a4e5c', INK, 1); }
  for (let i = 0; i < 5; i++) { const y = -7.6 + i * 3.8; rrect(c, 16, y - 1.5, 6, 3, 0.8); fillC(c, '#d2323c', INK, 0.8); poly(c, [22, y - 1.5, 26, y, 22, y + 1.5]); fillC(c, '#c4ccd8', INK, 0.8); }
  c.restore();
  circle(c, 29, 45.5, 11.5); c.strokeStyle = INK; c.lineWidth = 5.6; c.stroke(); c.strokeStyle = '#8a5a34'; c.lineWidth = 3.2; c.stroke();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; line(c, [29, 45.5, 29 + Math.cos(a) * 10, 45.5 + Math.sin(a) * 10], '#6a3e22', 1.8); }
  circle(c, 29, 45.5, 3); vol(c, '#4a4e5c', 26, 42.5, 32, 48.5, 1.4);
});
// rack mouth relative to the cart anchor (art units)
const MOUTH_X = RACK_X + Math.cos(RACK_A) * 22 - 36, MOUTH_Y = RACK_Y + Math.sin(RACK_A) * 22 - 57;

// ---------- basic attack ----------
function muzzle(c: FxCtx, mx: number, my: number, ang: number): void {
  const A = c.art, star = A.fx('star'), flame = A.fx('flame'), soft = A.fx('soft'); const dx = Math.cos(ang), dy = Math.sin(ang);
  c.fx.add(1, 0.13, (p, k) => {
    const a = 1 - k, s = 0.75 + k * 0.45;
    p.draw(EMIT, soft, mx + dx * 10, my + dy * 10, 1.2 * s, 1.2 * s, 0, ORANGE, 0.4 * a, 1);
    p.draw(EMIT, flame, mx + dx * 20 * s, my + dy * 20 * s, 0.95 * s, 1.1 * s, ang + Math.PI / 2, 0xffa040, 0.95 * a, 1);
    p.draw(EMIT, flame, mx + dx * 14 * s, my + dy * 14 * s, 0.5 * s, 0.7 * s, ang + Math.PI / 2, HOT, a, 1);
    p.draw(EMIT, star, mx + dx * 5, my + dy * 5, 0.8 * s, 0.42 * s, ang, HOT, a, 1);
  });
  for (let i = 0; i < 3; i++) { const v = rnd(30, 75); c.fx.part({ tex: 'smoke', layer: SCENE, x: mx + dx * rnd(4, 16), y: my + dy * rnd(4, 16), vx: dx * v + rnd(-10, 10), vy: dy * v - rnd(12, 30), drag: 0.93, life: rnd(0.6, 0.95), size: rnd(9, 13), grow: 22, col: 0xdcd4cc, a: 0.42, spin: rnd(-1, 1) }); }
  c.fx.sparks(mx + dx * 8, my + dy * 8, 4, GOLD, 380, ang, 0.5, 8);
  c.fx.light(mx, my, 130, ORANGE, 0.9, 0.16);
}
/** Bullet streak racing from the muzzle to the end of the pierce line at bullet speed. */
function tracer(c: FxCtx, mx: number, my: number, ux: number, uy: number, L: number): void {
  const A = c.art, streak = A.fx('streak'), soft = A.fx('soft'), beam = A.fx('beam'); const ang = Math.atan2(uy, ux), T = L / ATK.bulletSpeed, TAIL = 150, F = 0.14;
  c.fx.add(1, T + F, (p, _k, t) => {
    const hd = Math.min(L, t * ATK.bulletSpeed), tl = Math.min(hd, Math.max(0, t * ATK.bulletSpeed - TAIL)); const fade = t > T ? Math.max(0, 1 - (t - T) / F) : 1;
    const hx = mx + ux * hd, hy = my + uy * hd;
    p.beam(EMIT, beam, mx, my, hx, hy, 3, ORANGE, 0.22 * (1 - t / (T + F)), 1);
    if (hd - tl > 2) { p.draw(EMIT, streak, hx, hy, (hd - tl) / 64, 12 / 8, ang, ORANGE, 0.6 * fade, 1); p.draw(EMIT, streak, hx, hy, (hd - tl) / 64, 3.6 / 8, ang, HOT, fade, 1); }
    if (t < T) p.draw(EMIT, soft, hx, hy, 0.42, 0.42, 0, GOLD, 0.8, 1);
  });
}
/** Small blast (r = ATK.musketBurst) where the bullet meets its target. */
function blast(c: FxCtx, x: number, y: number, ang: number): void {
  c.fx.ring(x, y, 8, ATK.musketBurst, 0.26, 0xffa048, false, 1, 0.75); c.fx.glow(x, y, 44, ORANGE, 0.26, 0.45);
  for (let i = 0; i < 4; i++) c.fx.part({ tex: 'flame', x: x + rnd(-10, 10), y: y + rnd(-5, 7), vx: rnd(-40, 40), vy: rnd(-95, -40), drag: 0.9, life: rnd(0.2, 0.32), size: rnd(10, 14), grow: -16, col: i % 2 ? GOLD : ORANGE, rot: rnd(-0.2, 0.2) });
  c.fx.sparks(x, y, 7, 0xffb050, 380, ang, 1.7, 9); c.fx.smoke(x, y, 2, 0x4a403c, 40, 18, 0.6, 0.35); c.fx.light(x, y, 150, ORANGE, 0.9, 0.25);
}

// ---------- ultimate ----------
/** One hwacha per caster: faces the first rocket's target; `fired` = cart time of the last launch (mouth flare). */
interface Rig { face: number; set: boolean; t: number; fired: number }
const rigs = new Map<number, Rig>();
function boom(c: FxCtx, x: number, y: number): void {
  const soft = c.art.fx('soft');
  c.fx.add(1, 0.45, (p, k) => { const e = 1 - (1 - k) ** 3; p.draw(EMIT, soft, x, y - 18, 0.8 + e * 1.5, 0.7 + e * 1.3, 0, 0xff4a12, 0.26 * (1 - k) ** 1.4, 1); if (k < 0.3) p.draw(EMIT, soft, x, y - 16, 0.5 + e * 0.9, 0.45 + e * 0.8, 0, 0xffb060, 0.26 * (1 - k / 0.3), 1); });
  c.fx.ring(x, y, 10, 72, 0.42, 0xff7a30, false, 0, 0.5);
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + rnd(-1.3, 1.3); c.fx.part({ tex: 'flame', x: x + rnd(-16, 16), y: y - rnd(4, 16), vx: Math.cos(a) * rnd(40, 120), vy: Math.sin(a) * rnd(60, 150), drag: 0.9, life: rnd(0.3, 0.5), size: rnd(13, 19), grow: -20, col: [0xff4a14, 0xff7424, 0xff9a30][i % 3], a: 0.45, rot: rnd(-0.3, 0.3) }); }
  c.fx.burst(x, y - 14, 9, [0xffb040, 0xff6a20, 0xffc870], 360, 6, 0.55, 'spark', 380, 0.012);
  c.fx.debris(x, y - 6, 4, 'shard', [0x2a201a, 0x5a4432], 250, 6, 0.8);
  c.fx.smoke(x, y - 20, 4, 0x4a4040, 50, 28, 1.1, 0.42);
  c.fx.decal(x, y, 'scorch', 104, 0x140a06, 2.4, 0.5);
  c.fx.light(x, y, 230, ORANGE, 1, 0.45);
  if (c.mine) { c.fx.shake(0.07); c.fx.wave(x, y - 10, 100, 8, 0.4); }
}
/** Fire arrow flying from (ax, ay) in an arc onto the ground point (bx, by) over T seconds, then exploding. */
function rocket(c: FxCtx, ax: number, ay: number, bx: number, by: number, T: number, dist: number): void {
  const A = c.art, rt = rocketTex(), flame = A.fx('flame'), soft = A.fx('soft'), beam = A.fx('beam');
  const h = 60 + dist * 0.42, ex = bx, ey = by - 10;
  const pos = (k: number, o: number[]) => { o[0] = ax + (ex - ax) * k; o[1] = ay + (ey - ay) * k - h * 4 * k * (1 - k); };
  const P = [0, 0], Q = [0, 0], trail: number[] = []; let el = 0, acc = 0;
  c.fx.add(1, T + 5, (p, _k, t) => {
    const k = Math.min(1, t / T); pos(k, P); pos(Math.min(1, k + 0.02), Q); if (k >= 0.98) { pos(0.98, Q); Q[0] = P[0] + (P[0] - Q[0]); Q[1] = P[1] + (P[1] - Q[1]); }
    const ang = Math.atan2(Q[1] - P[1], Q[0] - P[0]), cs = Math.cos(ang), sn = Math.sin(ang); const n = trail.length;
    for (let i = 2; i < n; i += 2) { const a = i / n; p.beam(EMIT, beam, trail[i - 2], trail[i - 1], trail[i], trail[i + 1], 3 + a * 9, ORANGE, a * 0.6, 1); }
    p.draw(EMIT, soft, P[0] - cs * 4, P[1] - sn * 4, 0.5, 0.5, 0, ORANGE, 0.38, 1);
    p.draw(EMIT, flame, P[0] - cs * 7, P[1] - sn * 7, 0.4, 0.48 + Math.random() * 0.2, ang - Math.PI / 2, 0xffa040, 0.85, 1);
    p.draw(SCENE, rt, P[0], P[1], 0.9, 0.9, ang, 0xffffff, 1, 0);
  }, (dt) => {
    el += dt; const k = Math.min(1, el / T); pos(k, P); trail.push(P[0], P[1]); if (trail.length > 20) trail.splice(0, 2);
    if (!c.fx.low && (acc += dt) > 0.022) {
      acc = 0; c.fx.part({ tex: 'smoke', layer: SCENE, x: P[0], y: P[1], vx: rnd(-10, 10), vy: rnd(-16, -4), drag: 0.92, life: rnd(0.4, 0.65), size: rnd(8, 11), grow: 20, col: 0xbcb4ac, a: 0.36, spin: rnd(-1, 1) });
      if (Math.random() < 0.5) c.fx.part({ tex: 'dot', x: P[0], y: P[1], vx: rnd(-40, 40), vy: rnd(-20, 40), g: 200, drag: 0.9, life: rnd(0.2, 0.35), size: rnd(2.5, 4), col: Math.random() < 0.5 ? GOLD : ORANGE });
    }
    if (el >= T) { boom(c, bx, by); return false; }
    return true;
  });
}

export const gunner: ClassFx = {
  atkDur: 0.34, ultR: 190,
  atk: (c, e, ang) => {
    // the muzzle of the recoil frame (sprite faces the shot horizontally)
    const f = Math.cos(ang) < 0 ? -1 : 1, mx = c.x + f * 21, my = c.y - 34;
    const q0 = e.tid ? c.entPos('m', e.tid) : null; const tx = q0?.x ?? e.tx, ty = q0?.y ?? e.ty - 16;
    let ux = tx - mx, uy = ty - my; const d = Math.hypot(ux, uy);
    if (d < 40) { ux = Math.cos(ang); uy = Math.sin(ang); } else { ux /= d; uy /= d; }
    const a2 = Math.atan2(uy, ux), L = Math.max(CLASSES.gunner.range - 12, d + 20);
    c.fx.later(0.05, () => { // lands on the recoil frame
      muzzle(c, mx, my, a2); tracer(c, mx, my, ux, uy, L); c.snd.play('musket', c.vol, c.x, c.y);
      c.fx.later(d / ATK.bulletSpeed, () => { const q = e.tid ? c.entPos('m', e.tid) : null; blast(c, q?.x ?? tx, q?.y ?? ty, a2); });
      if (c.mine) { c.fx.zoomPunch(0.006); c.fx.shake(0.04); }
    });
  },
  ult: (c, e) => {
    const rig: Rig = { face: 1, set: false, t: 0, fired: -1 }; rigs.set(c.id, rig);
    const tex = hwachaTex(), soft = c.art.fx('soft'), lt = c.art.fx('light'), x = e.x, y = e.y, DUR = 2.3, S = 1;
    c.fx.add(0, DUR, (p, k, t) => {
      rig.t = t; const pop = t < 0.2 ? Math.max(0.01, easeBack(t / 0.2)) : 1, a = k > 0.85 ? (1 - k) / 0.15 : 1, f = rig.face;
      const hx = x - f * 26, hy = y + 3; p.draw(SCENE, tex, hx, hy, S * f * pop, S * pop, 0, 0xffffff, a, 0);
      const fl = rig.fired >= 0 ? Math.max(0, 1 - (t - rig.fired) / 0.15) : 0; const s = (0.7 + fl * 0.5) * pop;
      p.draw(EMIT, soft, hx + f * MOUTH_X * S, hy + MOUTH_Y * S, s, s, 0, ORANGE, (0.22 + fl * 0.4) * a, 1);
      p.draw(LIGHT, lt, hx + f * 10, hy - 24, 3.4, 2.8, 0, 0xffa060, (0.55 + fl * 0.4) * a, 1);
    });
    c.fx.smoke(x - 16, y, 6, 0x9a8a78, 90, 28, 1.0, 0.42); c.fx.burst(x, y - 24, 16, [GOLD, ORANGE, 0xffffff], 360, 6, 0.6, 'spark', 300, 0.01);
    c.fx.ring(x, y, 12, 130, 0.5, ORANGE, false, 0, 0.8); c.fx.light(x, y, 260, ORANGE, 1, 0.6);
    c.fx.later(DUR + 0.2, () => { if (rigs.get(c.id) === rig) rigs.delete(c.id); });
  },
  uhit: (c, e) => {
    if (e.x2 == null || e.y2 == null) return;
    const rig = rigs.get(c.id); if (rig) { if (!rig.set) { rig.face = e.x2 < e.x ? -1 : 1; rig.set = true; } rig.fired = rig.t; }
    const ax = e.x, ay = e.y - 30, dist = Math.hypot(e.x2 - e.x, e.y2 - e.y), T = Math.max(0.1, dist / 900);
    c.fx.part({ tex: 'smoke', layer: SCENE, x: ax + rnd(-6, 6), y: ay - 4, vx: rnd(-25, 25), vy: rnd(-40, -20), drag: 0.92, life: rnd(0.5, 0.7), size: 11, grow: 20, col: 0xa89e94, a: 0.28, spin: rnd(-1, 1) });
    c.fx.glow(ax, ay - 4, 18, ORANGE, 0.12, 0.22); c.fx.sparks(ax, ay, 3, GOLD, 220, Math.PI / 2, 1.4, 6);
    rocket(c, ax, ay, e.x2, e.y2, T, dist);
    c.fx.later(Math.max(0, T - 0.065), () => c.snd.play('rocket', c.vol, e.x2!, e.y2!));
  },
};
