// lancer: skill visuals — thrust streaks, the piercing beam, the whirl ring, the lightning javelin and its arcs,
// the dragon's descent (landing seal, wind trail, sky bolt, ground lightning, crater) and the storm thrust fan
// with its rolling lightning wave (render/registry hooks).
import type { Camera } from '../../render/iso';
import { RX } from '../../render/iso';
import { EFFECT_ART, FX_EVENT, PROJ_ART, type FxHost } from '../../render/registry';
import type { Effect } from '../../render/fx';
import { WHIRL0, drawLance } from './look';
import { STORM_FAN } from './shared';

type C2D = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const ease = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
/** Storm palette as 'r,g,b'. */
const BLUE = '120,190,255', PALE = '190,232,255', WHITE = '240,250,255';
const ELEM: Record<string, string> = { phys: '200,228,255', fire: '255,150,60', cold: '150,215,255', light: '255,245,150', poison: '150,255,120' };
/** Height of the lance at the hero's chest (iso px at zoom 1, rig × actor scale) and at a target's centre. */
const CHEST = 44, TARGET = 32;

/** Seeded jitter generator for flickering bolts (stable within one frame). */
function rng(seed: number): () => number {
  let s = Math.floor(Math.abs(seed)) % 233280 || 7;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; };
}

/** Jagged polyline between two screen points (`n` segments, `jag` px of sideways jitter). */
function boltPath(c: C2D, x0: number, y0: number, x1: number, y1: number, n: number, jag: number, rnd: () => number): void {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  c.moveTo(x0, y0);
  for (let i = 1; i < n; i++) { const t = i / n, o = rnd() * jag * 2 * Math.sin(t * Math.PI); c.lineTo(x0 + dx * t + nx * o, y0 + dy * t + ny * o); }
  c.lineTo(x1, y1);
}

/** Glow-layered stroke of the current path: wide blue haze, blue body, white core. */
function strokeBolt(c: C2D, z: number, a: number, w = 1): void {
  c.strokeStyle = `rgba(70,130,255,${0.22 * a})`; c.lineWidth = 12 * z * w; c.stroke();
  c.strokeStyle = `rgba(${PALE},${0.55 * a})`; c.lineWidth = 4.5 * z * w; c.stroke();
  c.strokeStyle = `rgba(255,255,255,${0.95 * a})`; c.lineWidth = 1.6 * z * w; c.stroke();
}

function glowDisc(c: C2D, x: number, y: number, r: number, col: string, a: number, sy = 1): void {
  if (a <= 0 || r <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.3, `rgba(${col},${a * 0.6})`); g.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r, r * sy, 0, 0, TAU); c.fill();
}

const scr = (cam: Camera, x: number, y: number, h: number, z: number): [number, number] => [cam.sxOf(x, y), cam.syOf(x, y) - h * z];

// ================================================================ thrust streaks
/** A spear-shaped light streak from (x,y) to (x2,y2) at chest height. power: width scale, heavy: long pierce. */
EFFECT_ART.ln_streak = {
  air(e, d) {
    const { c, cam, z, k } = d;
    const [x0, y0] = scr(cam, e.x, e.y, CHEST, z);
    const [x1, y1] = scr(cam, e.x2 ?? e.x, e.y2 ?? e.y, TARGET, z);
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
    const grow = ease(Math.min(1, k / 0.28)), fade = k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7;
    const hx = x0 + dx * (0.2 + 0.8 * grow) + ux * 4 * z, hy = y0 + dy * (0.2 + 0.8 * grow) + uy * 4 * z;
    const tx = x0 + dx * (0.12 + 0.55 * grow * (0.5 + k)), ty = y0 + dy * (0.12 + 0.55 * grow * (0.5 + k));
    const w = 3.2 * z * e.power * (1 + k * 0.6);
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(tx, ty, hx, hy);
    g.addColorStop(0, `rgba(${e.c},0)`); g.addColorStop(0.7, `rgba(${e.c},${0.5 * fade})`); g.addColorStop(1, `rgba(${WHITE},${0.95 * fade})`);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(tx, ty); c.lineTo(hx - ux * 10 * z - uy * w, hy - uy * 10 * z + ux * w); c.lineTo(hx, hy); c.lineTo(hx - ux * 10 * z + uy * w, hy - uy * 10 * z - ux * w); c.closePath(); c.fill();
    c.strokeStyle = `rgba(255,255,255,${0.9 * fade})`; c.lineWidth = 1.1 * z; c.lineCap = 'round';
    c.beginPath(); c.moveTo(lerp(tx, hx, 0.35), lerp(ty, hy, 0.35)); c.lineTo(hx, hy); c.stroke();
    // tip star at full extension
    if (k > 0.15 && k < 0.6) {
      const f = 1 - Math.abs(k - 0.3) / 0.3;
      glowDisc(c, hx, hy, 8 * z * e.power, e.c, 0.6 * f);
      c.fillStyle = `rgba(255,255,255,${0.9 * f})`;
      c.beginPath(); c.moveTo(hx - uy * 7 * z, hy + ux * 7 * z); c.lineTo(hx + ux * 1.2 * z, hy + uy * 1.2 * z); c.lineTo(hx + uy * 7 * z, hy - ux * 7 * z); c.lineTo(hx - ux * 1.2 * z, hy - uy * 1.2 * z); c.closePath(); c.fill();
    }
    c.restore();
  },
};
FX_EVENT.ln_thrust = (e, host) => {
  const c = ELEM[e.c ?? 'phys'] ?? ELEM.phys;
  host.fx.effect('ln_streak', e.x, e.y, 0.2, { x2: e.x2, y2: e.y2, c, power: 1 });
  const dx = (e.x2 ?? e.x) - e.x, dy = (e.y2 ?? e.y) - e.y;
  host.fx.burst(e.x2 ?? e.x, e.y2 ?? e.y, host.low ? 2 : 4, { dir: { x: dx, y: dy }, spread: 0.7, color: '#e2f4ff', kind: 'streak', size: 1, speed: 5, up: 30, grav: 80, life: 0.2, add: true, z: TARGET });
};

// ================================================================ piercing thrust
EFFECT_ART.ln_pierce = {
  ground(e, d) {
    // a scar of light along the floor under the thrust line
    const { c, cam, z, k } = d;
    const [x0, y0] = scr(cam, e.x, e.y, 0, z), [x1, y1] = scr(cam, e.x2 ?? e.x, e.y2 ?? e.y, 0, z);
    const a = (1 - k) * 0.55;
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    c.strokeStyle = `rgba(${BLUE},${a * 0.5})`; c.lineWidth = 9 * z; c.beginPath(); c.moveTo(lerp(x0, x1, 0.15), lerp(y0, y1, 0.15)); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = `rgba(${PALE},${a})`; c.lineWidth = 2 * z; c.stroke();
    c.restore();
  },
  air(e, d) {
    const { c, cam, z, k } = d;
    const [x0, y0] = scr(cam, e.x, e.y, CHEST, z);
    const [x1, y1] = scr(cam, e.x2 ?? e.x, e.y2 ?? e.y, TARGET, z);
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
    const grow = ease(Math.min(1, k / 0.16)), fade = k < 0.22 ? 1 : Math.max(0, 1 - (k - 0.22) / 0.78);
    const hx = x0 + dx * (0.15 + 0.85 * grow) + ux * 8 * z, hy = y0 + dy * (0.15 + 0.85 * grow) + uy * 8 * z;
    const sx = lerp(x0, x1, 0.12), sy = lerp(y0, y1, 0.12);
    const W = (4 + 5 * k) * z;
    c.save(); c.globalCompositeOperation = 'lighter';
    // outer haze: a long lance-shaped wedge
    const g = c.createLinearGradient(sx, sy, hx, hy);
    g.addColorStop(0, `rgba(${BLUE},0)`); g.addColorStop(0.55, `rgba(${BLUE},${0.45 * fade})`); g.addColorStop(1, `rgba(${WHITE},${0.9 * fade})`);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(hx - ux * 22 * z + nx * W, hy - uy * 22 * z + ny * W); c.lineTo(hx + ux * 6 * z, hy + uy * 6 * z); c.lineTo(hx - ux * 22 * z - nx * W, hy - uy * 22 * z - ny * W); c.closePath(); c.fill();
    // bright core line
    c.strokeStyle = `rgba(255,255,255,${fade})`; c.lineWidth = 1.8 * z * (1 - k * 0.5); c.lineCap = 'round';
    c.beginPath(); c.moveTo(lerp(sx, hx, 0.2), lerp(sy, hy, 0.2)); c.lineTo(hx + ux * 4 * z, hy + uy * 4 * z); c.stroke();
    // air rings (sonic cones) around the line
    for (let i = 0; i < 3; i++) {
      const at = 0.3 + i * 0.28, kk = clamp01((k - i * 0.05) / 0.5);
      if (kk <= 0 || at > grow + 0.05) continue;
      const px = lerp(sx, hx, at), py = lerp(sy, hy, at);
      const R = (5 + 9 * kk) * z;
      c.strokeStyle = `rgba(${PALE},${0.6 * (1 - kk)})`; c.lineWidth = 1.2 * z;
      c.save(); c.translate(px, py); c.rotate(Math.atan2(uy, ux)); c.beginPath(); c.ellipse(0, 0, R * 0.32, R, 0, 0, TAU); c.stroke(); c.restore();
    }
    // tip flare
    if (k < 0.5) {
      const f = 1 - k / 0.5;
      glowDisc(c, hx, hy, 12 * z, BLUE, 0.6 * f);
      c.fillStyle = `rgba(255,255,255,${f})`;
      c.beginPath(); c.moveTo(hx - nx * 12 * z, hy - ny * 12 * z); c.lineTo(hx + ux * 2 * z, hy + uy * 2 * z); c.lineTo(hx + nx * 12 * z, hy + ny * 12 * z); c.lineTo(hx - ux * 2 * z, hy - uy * 2 * z); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(hx - ux * 14 * z, hy - uy * 14 * z); c.lineTo(hx + nx * 1.6 * z, hy + ny * 1.6 * z); c.lineTo(hx + ux * 18 * z, hy + uy * 18 * z); c.lineTo(hx - nx * 1.6 * z, hy - ny * 1.6 * z); c.closePath(); c.fill();
    }
    c.restore();
  },
  light(e, k) { return k < 0.6 ? [2.6 * (1 - k), BLUE] : null; },
};

FX_EVENT.ln_pierce = (e, host) => {
  const fx = host.fx, x2 = e.x2 ?? e.x, y2 = e.y2 ?? e.y;
  const dx = x2 - e.x, dy = y2 - e.y, l = Math.hypot(dx, dy) || 1;
  fx.effect('ln_pierce', e.x, e.y, 0.42, { x2, y2 });
  // light at the tip for the darkness pass
  fx.effect('ln_flash', x2, y2, 0.25, { r: 0.9, c: BLUE });
  fx.effect('shock', x2, y2, 0.3, { r: 0.9, c: PALE });
  const n = host.low ? 5 : 12;
  for (let i = 0; i < n; i++) {
    const t = 0.2 + (i / n) * 0.8, sp = 6 + Math.random() * 6;
    fx.add({ x: e.x + dx * t, y: e.y + dy * t, z: lerp(CHEST, TARGET, t) + (Math.random() - 0.5) * 8, vx: (dx / l) * sp + (Math.random() - 0.5), vy: (dy / l) * sp + (Math.random() - 0.5), vz: (Math.random() - 0.3) * 30, color: Math.random() < 0.5 ? '#d6f0ff' : '#7ab8ff', kind: 'streak', size: 1.1, life: 0.25 + Math.random() * 0.15, add: true, drag: 2 });
  }
  fx.burst(x2, y2, host.low ? 3 : 7, { dir: { x: dx, y: dy }, spread: 1.1, color: '#9a8a78', kind: 'smoke', size: 3, speed: 1.2, up: 20, life: 0.6, z: 6 });
};

// ================================================================ generic flash (also a light source)
EFFECT_ART.ln_flash = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    c.save(); c.globalCompositeOperation = 'lighter';
    glowDisc(c, sx, sy - (e.power > 1 ? 34 : 22) * z, (12 + 16 * k) * z * e.r, e.c, 0.5 * (1 - k), 0.8);
    c.restore();
  },
  light(e, k) { return [2 * e.r * (1 - k), e.c]; },
};

// ================================================================ whirling spear
/** Polyline along an arc of the unit-ellipse space from a0 to a1 (either direction). */
function arcPath(c: C2D, R: number, a0: number, a1: number, n = 12): void {
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; if (i) c.lineTo(Math.cos(a) * R, Math.sin(a) * R); else c.moveTo(Math.cos(a) * R, Math.sin(a) * R); }
}

/**
 * The blade's path around the lancer. It turns with the lance in the hand: e.ang is the start heading (the rig's
 * whirl start, mirrored when the hero faces left), e.power the turning time (s), e.heavy a mirrored (anticlockwise)
 * turn; the rest of the effect's duration is the fade.
 */
EFFECT_ART.ln_whirl = {
  ground(e, d) {
    const { c, z, sx, sy, k, rx } = d;
    // wind swirl scoured into the floor
    const a = (1 - k) * 0.5, dir = e.heavy ? -1 : 1;
    c.save(); c.translate(sx, sy); c.scale(1, 0.5); c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    c.strokeStyle = `rgba(${PALE},${a * 0.8})`; c.lineWidth = 1.4 * z;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a0 = e.ang + (i / 6) * TAU + dir * k * 2.5, R = rx * (0.45 + 0.1 * (i % 3)) * (0.8 + k * 0.4);
      arcPath(c, R, a0, a0 + dir * 1.1, 6);
    }
    c.stroke();
    const g = c.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx);
    g.addColorStop(0, `rgba(${BLUE},0)`); g.addColorStop(0.85, `rgba(${BLUE},${0.22 * (1 - k)})`); g.addColorStop(1, `rgba(${BLUE},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill();
    c.restore();
  },
  air(e, d) {
    const { c, z, sx, sy, rx } = d;
    const cy = sy - 16 * z;
    const R = rx * 0.96;
    const T = Math.max(0.05, e.power), dir = e.heavy ? -1 : 1;
    const turn = ease(Math.min(1, e.t / T)) * TAU * 1.08;
    if (turn < 0.05) return;
    const head = e.ang + dir * turn;
    const span = Math.min(turn, Math.PI * 1.35), tail = head - dir * span;
    const fade = e.t < T ? 1 : Math.max(0, 1 - (e.t - T) / Math.max(0.05, e.dur - T));
    c.save(); c.translate(sx, cy); c.scale(1, 0.5); c.globalCompositeOperation = 'lighter';
    // crescent: thin at the tail, full width right behind the head
    const n = 28, thick = 0.28 * R;
    c.beginPath();
    for (let i = 0; i <= n; i++) { const t = i / n, a = tail + (head - tail) * t; c.lineTo(Math.cos(a) * R, Math.sin(a) * R); }
    for (let i = n; i >= 0; i--) { const t = i / n, a = tail + (head - tail) * t, w = thick * Math.pow(t, 0.9); c.lineTo(Math.cos(a) * (R - w), Math.sin(a) * (R - w)); }
    c.closePath();
    const g = c.createRadialGradient(0, 0, R * 0.55, 0, 0, R);
    g.addColorStop(0, `rgba(${BLUE},0)`); g.addColorStop(0.72, `rgba(${e.c},${0.5 * fade})`); g.addColorStop(1, `rgba(${WHITE},${0.95 * fade})`);
    c.fillStyle = g; c.fill();
    // leading edge
    c.strokeStyle = `rgba(255,255,255,${0.9 * fade})`; c.lineWidth = 2.6 * z; c.lineCap = 'round';
    c.beginPath(); arcPath(c, R, head - dir * Math.min(span, 1.1), head); c.stroke();
    // outer gust arcs trailing the head
    c.strokeStyle = `rgba(${PALE},${0.45 * fade})`; c.lineWidth = 1.2 * z;
    c.beginPath();
    for (const [off, rr] of [[0.6, 1.12], [1.5, 1.2], [2.4, 1.08]] as [number, number][]) if (off < span) arcPath(c, R * rr, head - dir * (off + 0.7), head - dir * off, 6);
    c.stroke();
    // the spearhead glint at the head of the arc
    const hx = Math.cos(head) * R, hy = Math.sin(head) * R;
    c.restore();
    if (fade > 0.2) { c.save(); c.globalCompositeOperation = 'lighter'; glowDisc(c, sx + hx, cy + hy * 0.5, 10 * z, e.c, 0.8 * fade); c.restore(); }
  },
  light(e, k) { return k < 0.7 ? [e.r * 1.1 * (1 - k), BLUE] : null; },
};

FX_EVENT.ln_sweep = (e, host) => {
  const fx = host.fx, r = e.r ?? 2.9;
  const fa = Math.atan2((e.y2 ?? e.y) - e.y, (e.x2 ?? e.x) - e.x);
  // the renderer mirrors the rig when the hero faces screen-left (screen dx ∝ cos − sin)
  const flip = Math.cos(fa) - Math.sin(fa) < 0;
  const turn = Math.max(0.1, (e.n ?? 250) / 1000);
  fx.effect('ln_whirl', e.x, e.y, turn + 0.3, { r, ang: flip ? Math.PI - WHIRL0 : WHIRL0, heavy: flip, power: turn, c: ELEM[e.c ?? 'phys'] ?? ELEM.phys });
  fx.effect('shock', e.x, e.y, 0.4 + turn * 0.5, { r: r * 1.15, c: PALE });
  fx.effect('dust', e.x, e.y, 0.6 + turn * 0.5, { r: r * 0.85 });
  const n = host.low ? 8 : 20, dir = flip ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + Math.random() * 0.3, rr = r * (0.55 + Math.random() * 0.45), sp = 5 + Math.random() * 4;
    // tangential gusts turning the same way as the blade (world space: iso keeps the handedness)
    const burst = (): void => fx.add({ x: e.x + Math.cos(a) * rr, y: e.y + Math.sin(a) * rr, z: 6 + Math.random() * 24, vx: -dir * Math.sin(a) * sp + Math.cos(a) * 1.5, vy: dir * Math.cos(a) * sp + Math.sin(a) * 1.5, vz: 10 + Math.random() * 20, color: Math.random() < 0.6 ? '#d8eeff' : '#8ec4ff', kind: 'streak', size: 1.1, life: 0.3 + Math.random() * 0.2, add: true, drag: 3 });
    // spread over the turn so the gusts follow the blade round
    const at = (i / n) * turn * 0.8;
    if (at < 0.02) burst(); else host.delay(at, burst);
  }
  fx.burst(e.x, e.y, host.low ? 4 : 10, { color: '#7a6e62', kind: 'smoke', size: 4, speed: r * 1.6, up: 16, life: 0.8, z: 4 });
};

// ================================================================ lightning javelin
PROJ_ART.ln_javelin = {
  light: [3.2, '140,200,255'],
  trail: ['150,215,255', 4],
  draw(p, d) {
    const { c, z, sx, fx, time, ang } = d;
    // released overhead: starts at hand height and settles toward the enemies' centre as it flies
    const sy = d.sy - (8 + 30 * Math.exp(-p.age * 6)) * z;
    const tier = p.data?.tier ?? 2;
    const th = Math.PI / 2 - ang; // rig convention: local +y along the flight
    const fadeIn = Math.min(1, p.age / 0.05);
    const rnd = rng(p.id * 131 + Math.floor(time * 30) * 17);
    const arc = (w: number, a: number): void => {
      const x0 = (-40 + rnd() * 24) * z, x1 = x0 + (20 + rnd() * 16) * z;
      c.beginPath(); c.moveTo(x0, rnd() * 5 * z);
      for (let s2 = 1; s2 <= 5; s2++) c.lineTo(x0 + ((x1 - x0) * s2) / 5, rnd() * 10 * z);
      c.strokeStyle = `rgba(${PALE},${0.45 * a})`; c.lineWidth = 2 * z * w; c.stroke();
      c.strokeStyle = `rgba(255,255,255,${0.9 * a})`; c.lineWidth = 0.7 * z * w; c.stroke();
    };
    c.save(); c.translate(sx, sy);
    // electric haze and arcs behind the spear
    c.save(); c.rotate(ang); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round'; c.lineCap = 'round';
    const g = c.createRadialGradient(0, 0, 2 * z, 0, 0, 34 * z);
    g.addColorStop(0, `rgba(210,240,255,${0.3 * fadeIn})`); g.addColorStop(0.45, `rgba(${BLUE},${0.16 * fadeIn})`); g.addColorStop(1, 'rgba(60,110,255,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(-6 * z, 0, 36 * z, 10 * z, 0, 0, TAU); c.fill();
    for (let i = 0; i < (fx.low ? 1 : 3); i++) arc(1, fadeIn);
    c.restore();
    // the spear itself, tip slightly ahead of the projectile point
    c.save(); c.rotate(-th); c.scale(z, z); c.translate(0, -30);
    drawLance(c, tier, 1, { charge: 1, t: time, low: true });
    c.restore();
    // one arc crossing in front of the shaft
    if (!fx.low) { c.save(); c.rotate(ang); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round'; c.lineCap = 'round'; arc(0.8, fadeIn); c.restore(); }
    c.restore();
    if (Math.random() < (fx.low ? 0.25 : 0.8)) {
      fx.add({ x: p.x + (Math.random() - 0.5) * 0.4, y: p.y + (Math.random() - 0.5) * 0.4, z: 40 + (Math.random() - 0.5) * 12, vx: -p.vx * 0.08 + (Math.random() - 0.5) * 2, vy: -p.vy * 0.08 + (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 40 - 30, color: Math.random() < 0.5 ? '#eaf8ff' : '#8ad8ff', kind: Math.random() < 0.5 ? 'glint' : 'spark', size: 1 + Math.random() * 0.6, life: 0.2 + Math.random() * 0.15, add: true });
    }
  },
};

FX_EVENT.ln_javelinThrow = (e, host) => {
  const fx = host.fx, dx = (e.x2 ?? e.x) - e.x, dy = (e.y2 ?? e.y) - e.y;
  fx.effect('ln_flash', e.x + dx * 0.5, e.y + dy * 0.5, 0.22, { r: 1.1, c: BLUE, power: 2 });
  fx.burst(e.x + dx * 0.5, e.y + dy * 0.5, host.low ? 4 : 10, { dir: { x: dx, y: dy }, spread: 1.2, color: '#bfe6ff', kind: 'streak', size: 1.1, speed: 7, up: 60, grav: 60, life: 0.25, add: true, z: 34 });
};

FX_EVENT.ln_javelinHit = (e, host) => {
  const fx = host.fx;
  fx.burst(e.x, e.y, host.low ? 3 : 7, { color: Math.random() < 0.5 ? '#eaf8ff' : '#8ad8ff', kind: 'streak', size: 1.1, speed: 6, up: 70, grav: 120, life: 0.28, add: true, z: 22 });
  if (!host.low) fx.burst(e.x, e.y, 3, { color: '#ffffff', kind: 'glint', size: 1.2, speed: 2, up: 40, life: 0.2, add: true, z: 26 });
};

/** A side bolt jumping from one enemy to another (a lighter-weight cousin of the core 'lightning' effect). */
EFFECT_ART.ln_bolt = {
  air(e, d) {
    const { c, cam, z, k } = d;
    const x0 = cam.sxOf(e.x2 ?? e.x, e.y2 ?? e.y), y0 = cam.syOf(e.x2 ?? e.x, e.y2 ?? e.y) - 24 * z;
    const x1 = cam.sxOf(e.x, e.y), y1 = cam.syOf(e.x, e.y) - 22 * z;
    const a = k < 0.15 ? 1 : 1 - (k - 0.15) / 0.85;
    const rnd = rng(e.seed * 97 + Math.floor(e.t * 30) * 13);
    const L = Math.hypot(x1 - x0, y1 - y0);
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath(); boltPath(c, x0, y0, x1, y1, Math.max(4, Math.round(L / (9 * z))), 7 * z, rnd); strokeBolt(c, z, a, 0.6);
    if (!e.heavy) { const m = 0.3 + (rnd() + 0.5) * 0.4; const bx = lerp(x0, x1, m), by = lerp(y0, y1, m); c.beginPath(); boltPath(c, bx, by, bx + rnd() * 26 * z, by + rnd() * 26 * z, 3, 4 * z, rnd); strokeBolt(c, z, a * 0.6, 0.35); }
    glowDisc(c, x1, y1, 10 * z, BLUE, 0.55 * a, 0.8);
    c.restore();
  },
  light(_e, k) { return k < 0.6 ? [1.5 * (1 - k), BLUE] : null; },
};

FX_EVENT.ln_arc = (e, host) => {
  const fx = host.fx, x2 = e.x2 ?? e.x, y2 = e.y2 ?? e.y;
  // effect anchored at the struck enemy (its light); the bolt comes from x2/y2
  fx.effect('ln_bolt', x2, y2, 0.28, { x2: e.x, y2: e.y, heavy: host.low });
  fx.burst(x2, y2, host.low ? 2 : 4, { color: '#dff4ff', kind: 'streak', size: 1, speed: 4, up: 50, grav: 100, life: 0.25, add: true, z: 22 });
};

EFFECT_ART.ln_spearBurst = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const cy = sy - 18 * z;
    c.save(); c.globalCompositeOperation = 'lighter';
    glowDisc(c, sx, cy, (12 + 30 * ease(k)) * z, BLUE, 0.9 * (1 - k), 0.8);
    const rnd = rng(e.seed * 1000 + Math.floor(e.t * 30));
    c.lineJoin = 'round';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + rnd() * 0.8, L = (14 + 24 * k) * z * (0.6 + rnd());
      c.beginPath(); boltPath(c, sx, cy, sx + Math.cos(a) * L, cy + Math.sin(a) * L * 0.7, 4, 5 * z, rnd);
      strokeBolt(c, z, 1 - k, 0.45);
    }
    c.restore();
  },
  light(_e, k) { return [2.6 * (1 - k), BLUE]; },
};

FX_EVENT.ln_javelinEnd = (e, host) => {
  const fx = host.fx;
  fx.effect('ln_spearBurst', e.x, e.y, 0.3, {});
  fx.burst(e.x, e.y, host.low ? 5 : 12, { color: '#bfe6ff', kind: 'spark', size: 1.3, speed: 4, up: 70, grav: 140, life: 0.4, add: true, z: 18 });
  if (e.n) { fx.burst(e.x, e.y, host.low ? 3 : 7, { color: '#5a5048', kind: 'shard', size: 1.8, speed: 3, up: 90, grav: 260, life: 0.8, z: 16 }); fx.stain(e.x, e.y, 'ash', 0.3); }
};

// ================================================================ dragon's descent
/** Landing seal: a rune circle converging on the target while the lancer is in the air. */
EFFECT_ART.ln_mark = {
  ground(e, d) {
    const { c, z, sx, sy, k, rx } = d;
    const a = Math.min(1, k / 0.15) * (k > 0.92 ? (1 - k) / 0.08 : 1);
    const R = rx * (1.25 - 0.25 * ease(k));
    c.save(); c.translate(sx, sy); c.scale(1, 0.5); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, `rgba(${BLUE},${0.28 * a * k})`); g.addColorStop(0.8, `rgba(${BLUE},${0.1 * a})`); g.addColorStop(1, `rgba(${BLUE},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
    c.strokeStyle = `rgba(${PALE},${0.8 * a})`; c.lineWidth = 2 * z; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.stroke();
    c.strokeStyle = `rgba(${BLUE},${0.7 * a})`; c.lineWidth = 1 * z; c.beginPath(); c.arc(0, 0, R * 0.82, 0, TAU); c.stroke();
    // eight bolt glyphs rotating on the ring
    const rot = e.t * 1.6;
    c.fillStyle = `rgba(${PALE},${0.85 * a})`;
    for (let i = 0; i < 8; i++) {
      const an = rot + (i / 8) * TAU, px = Math.cos(an) * R * 0.91, py = Math.sin(an) * R * 0.91, s = R * 0.07;
      c.save(); c.translate(px, py); c.rotate(an + Math.PI / 2);
      c.beginPath(); c.moveTo(s * 0.3, -s); c.lineTo(-s * 0.35, s * 0.1); c.lineTo(s * 0.1, s * 0.1); c.lineTo(-s * 0.3, s); c.lineTo(s * 0.4, -s * 0.2); c.lineTo(0, -s * 0.2); c.closePath(); c.fill();
      c.restore();
    }
    // spokes converging to the centre as the landing nears
    c.strokeStyle = `rgba(${PALE},${0.5 * a * k})`; c.lineWidth = 1.2 * z;
    c.beginPath();
    for (let i = 0; i < 4; i++) { const an = -rot * 0.5 + (i / 4) * TAU; c.moveTo(Math.cos(an) * R * 0.8, Math.sin(an) * R * 0.8); c.lineTo(Math.cos(an) * R * 0.8 * (1 - k), Math.sin(an) * R * 0.8 * (1 - k)); }
    c.stroke();
    c.restore();
  },
  air(e, d) {
    // a thin column of light marking where the lance will fall
    const { c, z, sx, sy, k } = d;
    const a = ease(k) * (k > 0.92 ? (1 - k) / 0.08 : 1);
    if (a <= 0) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    const H = 150 * z, w = (2 + 4 * k) * z;
    const g = c.createLinearGradient(sx, sy - H, sx, sy);
    g.addColorStop(0, `rgba(${BLUE},0)`); g.addColorStop(1, `rgba(${PALE},${0.5 * a})`);
    c.fillStyle = g; c.fillRect(sx - w / 2, sy - H, w, H);
    c.restore();
  },
  light(_e, k) { return [1.4 + 1.2 * k, BLUE]; },
};

FX_EVENT.ln_dragonMark = (e, host) => {
  host.fx.effect('ln_mark', e.x, e.y, 0.72, { r: e.r ?? 2.8 });
};

FX_EVENT.ln_dragonJump = (e, host) => {
  const fx = host.fx;
  fx.effect('shock', e.x, e.y, 0.35, { r: 1.6, c: PALE });
  fx.effect('dust', e.x, e.y, 0.5, { r: 1.3 });
  fx.burst(e.x, e.y, host.low ? 5 : 12, { color: '#7a6e62', kind: 'smoke', size: 4, speed: 2.4, up: 30, life: 0.7, z: 4 });
  const n = host.low ? 6 : 14;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, r = Math.random() * 0.5;
    fx.add({ x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r, z: 4 + Math.random() * 20, vz: 260 + Math.random() * 160, vx: Math.cos(a) * 0.6, vy: Math.sin(a) * 0.6, color: Math.random() < 0.5 ? '#d8eeff' : '#8ec4ff', kind: 'streak', size: 1.2, life: 0.3 + Math.random() * 0.15, add: true });
  }
};

/** Hero lift in iso px while leaping (renderer: sin(k·π)·44, scaled by the actor scale). */
const LIFT = 44 * 1.22;

FX_EVENT.ln_dragonTrail = (e, host) => {
  const fx = host.fx, k = e.r ?? 0;
  const lift = Math.sin(k * Math.PI) * LIFT;
  const down = k > 0.5;
  const n = host.low ? 1 : 3;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, r = 0.25 + Math.random() * 0.35;
    // wind streaks rushing past the body (down while rising, up while falling)
    fx.add({ x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r, z: lift + 10 + Math.random() * 50, vz: down ? 380 : -300, color: i % 2 ? '#cfe6ff' : '#7ab4ff', kind: 'streak', size: 1 + Math.random() * 0.5, life: 0.16 + Math.random() * 0.08, add: true });
  }
  if (down && !host.low) fx.add({ x: e.x + (Math.random() - 0.5) * 0.3, y: e.y + (Math.random() - 0.5) * 0.3, z: lift + Math.random() * 30, vz: 60, color: '#eaf8ff', kind: 'glint', size: 1.3, life: 0.2, add: true });
};

/** The sky bolt that follows the lance into the ground. */
EFFECT_ART.ln_skyBolt = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const a = k < 0.1 ? 1 : Math.max(0, 1 - (k - 0.1) / 0.9);
    const flick = 0.75 + 0.25 * Math.sin(e.t * 90);
    const rnd = rng(e.seed * 977 + Math.floor(e.t * 28) * 31);
    const top = sy - 420 * z;
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round'; c.lineCap = 'round';
    // main channel with two branches
    c.beginPath(); boltPath(c, sx + rnd() * 60 * z, top, sx, sy - 6 * z, 14, 16 * z, rnd); strokeBolt(c, z, a * flick, 1.5 * e.power);
    for (let b = 0; b < 2; b++) {
      const by = sy - (120 + rnd() * 200) * z, bx = sx + rnd() * 30 * z;
      c.beginPath(); boltPath(c, bx, by, bx + (b ? 1 : -1) * (40 + rnd() * 40) * z, by + (50 + rnd() * 50) * z, 5, 8 * z, rnd); strokeBolt(c, z, a * 0.7 * flick, 0.7);
    }
    // flash at the ground
    glowDisc(c, sx, sy - 10 * z, (26 + 22 * k) * z * Math.min(1, e.power + 0.3), BLUE, 0.55 * a, 0.6);
    c.restore();
  },
  light(e, k) { return [4.5 * (1 - k) * e.power, '160,210,255']; },
};

/** Lightning crawling outward over the ground from the impact. */
EFFECT_ART.ln_groundBolts = {
  ground(e, d) {
    const { c, z, sx, sy, k, rx } = d;
    const a = 1 - k;
    const rnd = rng(e.seed * 331 + Math.floor(e.t * 24) * 7);
    const reach = rx * ease(Math.min(1, k / 0.35));
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round';
    const n = 7;
    for (let i = 0; i < n; i++) {
      const an = (i / n) * TAU + e.seed, L = reach * (0.7 + 0.3 * Math.sin(i * 2.1 + e.seed));
      c.beginPath(); boltPath(c, sx, sy, sx + Math.cos(an) * L, sy + Math.sin(an) * L * 0.5, 6, 6 * z, rnd);
      strokeBolt(c, z, a * 0.9, 0.55);
    }
    // expanding ring of light
    c.translate(sx, sy); c.scale(1, 0.5);
    c.strokeStyle = `rgba(${PALE},${0.8 * a})`; c.lineWidth = 3 * z * a;
    c.beginPath(); c.arc(0, 0, Math.max(1, rx * (0.2 + 0.95 * ease(k))), 0, TAU); c.stroke();
    c.restore();
  },
};

/** The glowing crater left behind (fades over a few seconds). */
EFFECT_ART.ln_crater = {
  ground(e, d) {
    const { c, z, sx, sy, k, rx } = d;
    const a = k < 0.05 ? k / 0.05 : 1 - k;
    c.save(); c.translate(sx, sy); c.scale(1, 0.5);
    const R = rx * 0.55;
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, `rgba(4,6,12,${0.75 * a})`); g.addColorStop(0.7, `rgba(14,18,30,${0.45 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
    // glowing blue fissures, cooling
    const heat = Math.max(0, 1 - k * 2.2);
    if (heat > 0) {
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = `rgba(${BLUE},${0.8 * heat})`; c.lineWidth = 1.4 * z;
      const rnd = rng(e.seed * 71 + 5);
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        let an = (i / 6) * TAU + rnd(), x = 0, y = 0;
        c.moveTo(0, 0);
        for (let s = 1; s <= 3; s++) { an += rnd() * 0.8; x += Math.cos(an) * R * 0.33; y += Math.sin(an) * R * 0.33; c.lineTo(x, y); }
      }
      c.stroke();
    }
    c.restore();
    void z;
  },
};

FX_EVENT.ln_dragonLand = (e, host) => {
  const fx = host.fx, r = e.r ?? 2.8, low = host.low;
  const seed = Math.random() * 10;
  fx.effect('ln_skyBolt', e.x, e.y, 0.5, { power: 1, seed });
  fx.effect('ln_groundBolts', e.x, e.y, 0.5, { r, seed });
  fx.effect('ln_crater', e.x, e.y, 3.2, { r, seed });
  fx.effect('shock', e.x, e.y, 0.5, { r: r * 1.3, c: PALE });
  fx.effect('dust', e.x, e.y, 0.8, { r: r * 0.95 });
  fx.stain(e.x, e.y, 'crack', r * 0.7);
  fx.burst(e.x, e.y, low ? 10 : 26, { color: '#cfeaff', kind: 'streak', size: 1.4, speed: r * 4, up: 120, grav: 200, life: 0.5, add: true, z: 8 });
  fx.burst(e.x, e.y, low ? 5 : 12, { color: '#4a4036', kind: 'shard', size: 2, speed: r * 2.4, up: 170, grav: 320, life: 0.9, z: 4 });
  fx.burst(e.x, e.y, low ? 6 : 14, { color: '#6a6258', kind: 'smoke', size: 5, speed: r * 1.8, up: 20, life: 1.1, z: 4 });
  host.shake(0.7);
  // an after-flicker: a second, thinner bolt a heartbeat later
  host.delay(0.09, () => { fx.effect('ln_skyBolt', e.x + (Math.random() - 0.5) * 0.4, e.y + (Math.random() - 0.5) * 0.4, 0.22, { power: 0.55, seed: seed + 3 }); });
};

// ================================================================ storm thrusts
/** Ground fan showing the struck cone, flickering with every thrust. */
EFFECT_ART.ln_stormCone = {
  ground(e, d) {
    const { c, z, sx, sy, k, rx } = d;
    const a = Math.min(1, k / 0.08) * (k > 0.85 ? (1 - k) / 0.15 : 1);
    const beat = Math.pow(1 - ((e.t * 7) % 1), 3);
    const half = 0.55;
    c.save(); c.translate(sx, sy); c.scale(1, 0.5); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(0, 0, rx * 0.15, 0, 0, rx);
    g.addColorStop(0, `rgba(${BLUE},0)`); g.addColorStop(0.55, `rgba(${BLUE},${(0.16 + 0.2 * beat) * a})`); g.addColorStop(1, `rgba(${PALE},${(0.3 + 0.35 * beat) * a})`);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, rx, e.ang - half, e.ang + half); c.closePath(); c.fill();
    c.strokeStyle = `rgba(${PALE},${(0.6 + 0.3 * beat) * a})`; c.lineWidth = 1.8 * z; c.beginPath(); c.arc(0, 0, rx, e.ang - half, e.ang + half); c.stroke();
    // radial speed lines inside the fan
    c.strokeStyle = `rgba(${PALE},${0.35 * beat * a})`; c.lineWidth = 1 * z;
    c.beginPath();
    for (let i = 0; i < 5; i++) { const an = e.ang - half + (i + 0.5) / 5 * half * 2; c.moveTo(Math.cos(an) * rx * 0.3, Math.sin(an) * rx * 0.3); c.lineTo(Math.cos(an) * rx * 0.92, Math.sin(an) * rx * 0.92); }
    c.stroke();
    c.restore();
  },
};

FX_EVENT.ln_stormThrust = (e, host) => {
  const fx = host.fx, i = e.n ?? 0;
  const x2 = e.x2 ?? e.x, y2 = e.y2 ?? e.y;
  const dx = x2 - e.x, dy = y2 - e.y;
  const off = (STORM_FAN[i % STORM_FAN.length] ?? 0) * 0.55 * 1.6;
  const co = Math.cos(off), so = Math.sin(off);
  const rx = dx * co - dy * so, ry = dx * so + dy * co;
  const shrink = 0.8 + ((i * 37) % 5) * 0.05;
  const col = ELEM[e.c ?? 'phys'] ?? ELEM.phys;
  fx.effect('ln_streak', e.x, e.y, 0.24, { x2: e.x + rx * shrink, y2: e.y + ry * shrink, c: i % 2 ? PALE : col, power: 0.9 });
  if (i === 0) {
    // cone in screen space: angle of the aim projected on the flat ellipse
    const sa = Math.atan2(dx + dy, dx - dy);
    fx.effect('ln_stormCone', e.x, e.y, 1.25, { r: Math.hypot(dx, dy), ang: sa });
  }
  if (!host.low || i % 2 === 0) fx.burst(e.x + rx * shrink, e.y + ry * shrink, 3, { dir: { x: rx, y: ry }, spread: 0.8, color: '#e2f4ff', kind: 'streak', size: 1, speed: 5, up: 30, grav: 60, life: 0.18, add: true, z: TARGET });
};

/** The rolling lightning wave: a crescent of lightning skimming the ground. */
PROJ_ART.ln_stormWave = {
  light: [3.6, '150,210,255'],
  trail: ['130,200,255', 1],
  draw(p, d) {
    const { c, cam, z, fx, time } = d;
    const a = Math.min(1, p.age / 0.06) * Math.min(1, p.life / 0.12);
    const va = Math.atan2(p.vy, p.vx), fxv = Math.cos(va), fyv = Math.sin(va), nx = -fyv, ny = fxv;
    const R = p.r + 0.35;
    const pt = (u: number, fwd: number): [number, number] => [cam.sxOf(p.x + nx * R * u + fxv * fwd, p.y + ny * R * u + fyv * fwd), cam.syOf(p.x + nx * R * u + fxv * fwd, p.y + ny * R * u + fyv * fwd)];
    const [ax, ay] = pt(-1, -0.25), [bx, by] = pt(1, -0.25), [mx, my] = pt(0, 0.55);
    // control point for a quadratic through the middle point
    const cx = 2 * mx - (ax + bx) / 2, cy = 2 * my - (ay + by) / 2;
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
    // ground glow
    const [gx, gy] = pt(0, 0.1);
    glowDisc(c, gx, gy, R * RX * z * 1.05, BLUE, 0.28 * a, 0.5);
    // the wave front, raised a little off the floor
    for (const [w, col] of [[12, `rgba(70,130,255,${0.2 * a})`], [5, `rgba(${PALE},${0.55 * a})`], [1.8, `rgba(255,255,255,${0.95 * a})`]] as [number, string][]) {
      c.strokeStyle = col; c.lineWidth = w * z;
      c.beginPath(); c.moveTo(ax, ay - 6 * z); c.quadraticCurveTo(cx, cy - 6 * z, bx, by - 6 * z); c.stroke();
    }
    // jagged lightning riding the crest and short bolts rising from it
    const rnd = rng(p.id * 53 + Math.floor(time * 30) * 11);
    const q = (t: number): [number, number] => { const u = 1 - t; return [u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by - 6 * z]; };
    c.beginPath();
    for (let i = 0; i <= 10; i++) { const [x, y] = q(i / 10); const o = rnd() * 7 * z; if (i) c.lineTo(x, y + o); else c.moveTo(x, y + o); }
    c.strokeStyle = `rgba(255,255,255,${0.8 * a})`; c.lineWidth = 1.2 * z; c.stroke();
    const rises = fx.low ? 2 : 4;
    for (let i = 0; i < rises; i++) {
      const [x, y] = q(0.1 + (i + 0.5) / rises * 0.8 + rnd() * 0.1);
      c.beginPath(); boltPath(c, x, y, x + rnd() * 10 * z, y - (16 + rnd() * 18) * z, 4, 4 * z, rnd);
      strokeBolt(c, z, a * 0.8, 0.4);
    }
    c.restore();
    if (Math.random() < (fx.low ? 0.3 : 0.9)) {
      const u = (Math.random() - 0.5) * 2;
      fx.add({ x: p.x + nx * R * u, y: p.y + ny * R * u, z: 6, vz: 60 + Math.random() * 60, vx: fxv * 3, vy: fyv * 3, color: Math.random() < 0.5 ? '#eaf8ff' : '#8ad8ff', kind: 'spark', size: 1.2, life: 0.3, add: true });
    }
  },
};

FX_EVENT.ln_stormWave = (e, host) => {
  const fx = host.fx, dx = (e.x2 ?? e.x) - e.x, dy = (e.y2 ?? e.y) - e.y;
  fx.effect('ln_flash', e.x + dx * 0.8, e.y + dy * 0.8, 0.3, { r: 1.2, c: BLUE, power: 2 });
  fx.effect('shock', e.x + dx * 0.8, e.y + dy * 0.8, 0.4, { r: 1.8, c: PALE });
  fx.burst(e.x + dx, e.y + dy, host.low ? 6 : 16, { dir: { x: dx, y: dy }, spread: 1.4, color: '#cfeaff', kind: 'streak', size: 1.3, speed: 9, up: 60, grav: 80, life: 0.35, add: true, z: 20 });
  host.shake(0.3);
};

export type { Effect, FxHost };
