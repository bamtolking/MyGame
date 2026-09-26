// voidknight: skill visuals — the violet blade trail that follows the greatsword, cuts and the red life-stream of
// the drain strike, the black-violet crescent wave with its icy mist, the void pool whose tendrils seize and drag
// enemies, the dark-flame shroud (buff wisps), and the eclipse: a black dome swelling from the knight with a burning
// violet rim while the whole scene darkens (render/registry hooks).
import { screenDir } from '../../render/iso';
import { AREA_ART, BUFF_ART, EFFECT_ART, FX_EVENT, PROJ_ART } from '../../render/registry';
import { ECLIPSE, GRASP, VK, WAVE } from './shared';

const TAU = Math.PI * 2;
type C2D = CanvasRenderingContext2D;
const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Hero sprites are drawn at this scale (render/renderer ACTOR_SCALE). */
const ACTOR = 1.22;
const V = VK.vRGB, VH = VK.vHiRGB, VD = VK.vDkRGB;

/**
 * Particle spawning from draw callbacks is gated on render time advancing (at most ~60 spawns/s per emitter): the
 * renderer keeps drawing while the game is paused, and particles must not pile up then.
 */
const lastSpawn = new Map<number, number>();
function mayEmit(key: number, time: number): boolean {
  const last = lastSpawn.get(key);
  if (last !== undefined && time >= last && time - last < 1 / 60) return false;
  if (lastSpawn.size > 48) for (const [k, t] of lastSpawn) if (time - t > 2 || t > time) lastSpawn.delete(k);
  lastSpawn.set(key, time);
  return true;
}

// ------------------------------------------------------------------ shared drawing
function glow(c: C2D, x: number, y: number, r: number, rgb: string, a: number, core = true): void {
  if (a <= 0.005 || r <= 0.5) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  if (core) g.addColorStop(0, `rgba(255,248,255,${Math.min(1, a)})`);
  g.addColorStop(core ? 0.25 : 0, `rgba(${rgb},${a * 0.7})`); g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}

/** A tapered tendril along a quadratic curve: dark body with a violet rim. */
function tendril(c: C2D, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w: number, a: number, z: number): void {
  const n = 10;
  const L: number[] = [], R: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const px = u * u * x0 + 2 * u * t * cx + t * t * x1, py = u * u * y0 + 2 * u * t * cy + t * t * y1;
    const tx = 2 * u * (cx - x0) + 2 * t * (x1 - cx), ty = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
    const tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
    const hw = (w / 2) * (1 - t * 0.75);
    L.push(px + nx * hw, py + ny * hw); R.push(px - nx * hw, py - ny * hw);
  }
  c.beginPath(); c.moveTo(L[0], L[1]);
  for (let i = 2; i < L.length; i += 2) c.lineTo(L[i], L[i + 1]);
  for (let i = R.length - 2; i >= 0; i -= 2) c.lineTo(R[i], R[i + 1]);
  c.closePath();
  c.fillStyle = `rgba(9,4,15,${0.92 * a})`; c.fill();
  c.save(); c.globalCompositeOperation = 'lighter';
  c.strokeStyle = `rgba(${V},${0.75 * a})`; c.lineWidth = 0.9 * z; c.stroke();
  c.restore();
}

/** A clawed hand of the abyss at (x,y), reaching along `dir`: a dark palm and four hooked talons. open: 1 spread … 0 clenched. */
function claw(c: C2D, x: number, y: number, s: number, dir: number, open: number, a: number, z: number): void {
  c.save(); c.lineCap = 'round';
  const px = x - Math.cos(dir) * s * 0.25, py = y - Math.sin(dir) * s * 0.25;
  c.fillStyle = `rgba(9,4,15,${0.95 * a})`;
  c.beginPath(); c.ellipse(px, py, s * 0.42, s * 0.3, dir, 0, TAU); c.fill();
  for (let i = 0; i < 4; i++) {
    const spread = (i - 1.5) * (0.32 + 0.3 * open);
    const a0 = dir + spread;
    const bx = px + Math.cos(a0) * s * 0.3, by = py + Math.sin(a0) * s * 0.3;
    const mx = px + Math.cos(a0) * s * 0.85, my = py + Math.sin(a0) * s * 0.85;
    // talons hook inward as the hand clenches
    const hook = a0 - spread * (1.6 - open) + (1 - open) * 0.9 * (i < 2 ? 1 : -1);
    const tx = mx + Math.cos(hook) * s * 0.55, ty = my + Math.sin(hook) * s * 0.55;
    c.strokeStyle = `rgba(9,4,15,${0.95 * a})`; c.lineWidth = s * 0.2;
    c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(mx, my, tx, ty); c.stroke();
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(${VH},${0.6 * a})`; c.lineWidth = 0.55 * z;
    c.beginPath(); c.moveTo(mx, my); c.lineTo(tx, ty); c.stroke();
    c.restore();
  }
  c.restore();
}

/** A dark flame tongue: black core wrapped in a violet glow. */
function darkFlame(c: C2D, x: number, y: number, h: number, w: number, t: number, seed: number, a: number): void {
  const sway = Math.sin(t * 6 + seed * 3.1) * w * 0.7, hh = h * (0.7 + 0.3 * Math.sin(t * 9 + seed * 5.3));
  const path = (k: number) => {
    c.beginPath(); c.moveTo(x - w * k, y);
    c.quadraticCurveTo(x - w * 0.9 * k + sway * 0.4, y - hh * 0.55 * k, x + sway, y - hh * k);
    c.quadraticCurveTo(x + w * 0.9 * k + sway * 0.4, y - hh * 0.55 * k, x + w * k, y);
    c.closePath();
  };
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createLinearGradient(x, y, x, y - hh * 1.2);
  g.addColorStop(0, `rgba(${V},${0.7 * a})`); g.addColorStop(0.6, `rgba(${VD},${0.4 * a})`); g.addColorStop(1, `rgba(${VD},0)`);
  c.fillStyle = g; path(1.35); c.fill();
  c.restore();
  c.fillStyle = `rgba(8,3,14,${0.7 * a})`; path(0.5); c.fill();
}

// ------------------------------------------------------------------ blade trail (vertical crescent following the greatsword)
// Variants (sim n): 0 chop, 1 rising cut (drain), 2 wave chop, 3 eclipse slam.
const ARC = [
  { a0: -2.1, a1: 1.25, th: 0.3, body: V, edge: '255,245,255', dark: 0.35, shadow: '10,3,20' },
  { a0: 1.3, a1: -2.15, th: 0.34, body: V, edge: '255,190,212', dark: 0.45, shadow: '40,2,14' },
  { a0: -2.15, a1: 1.3, th: 0.4, body: V, edge: VK.mistRGB, dark: 0.45, shadow: '10,3,20' },
  { a0: -1.95, a1: 1.4, th: 0.5, body: V, edge: VH, dark: 0.55, shadow: '10,3,20' },
];
EFFECT_ART.vk_arc = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const v = ARC[Math.max(0, Math.min(3, (e.data as number) ?? 0))];
    const S = z * ACTOR;
    const flip = screenDir(e.ang).dx < 0 ? -1 : 1;
    const cx = sx + 2 * S * flip, cy = sy - 37 * S;
    const R = (e.power > 1 ? 47 : 43) * S, R0 = R * 0.42;
    const sweep = ease(k / 0.32), fade = k < 0.32 ? 1 : 1 - (k - 0.32) / 0.68;
    if (fade <= 0) return;
    const a0 = v.a0, a1 = v.a0 + (v.a1 - v.a0) * sweep;
    const n = 22, th = v.th * R;
    c.save();
    c.translate(cx, cy); c.scale(flip, 1);
    const shape = (outer: number, width: number) => {
      c.beginPath();
      for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); c.lineTo(Math.cos(a) * outer, Math.sin(a) * outer); }
      for (let i = n; i >= 0; i--) { const t = i / n, a = a0 + (a1 - a0) * t; const w = width * Math.pow(t, 0.7); c.lineTo(Math.cos(a) * (outer - w), Math.sin(a) * (outer - w)); }
      c.closePath();
    };
    // smoky void shadow of the stroke
    shape(R * 1.02, th * 1.25);
    c.fillStyle = `rgba(${v.shadow},${v.dark * fade})`; c.fill();
    c.globalCompositeOperation = 'lighter';
    shape(R, th);
    const g = c.createRadialGradient(0, 0, R0, 0, 0, R);
    g.addColorStop(0, `rgba(${v.body},0)`); g.addColorStop(0.7, `rgba(${v.body},${0.55 * fade})`); g.addColorStop(1, `rgba(${v.edge},${0.95 * fade})`);
    c.fillStyle = g; c.fill();
    // bright edge along the leading third
    const lead = Math.abs(a1 - a0) * 0.4 * Math.sign(a1 - a0);
    c.strokeStyle = `rgba(${v.edge},${0.9 * fade})`; c.lineWidth = (e.power > 1 ? 3.2 : 2.4) * z; c.lineCap = 'round';
    c.beginPath(); if (a1 > a0) c.arc(0, 0, R, a1 - lead, a1); else c.arc(0, 0, R, a1, a1 - lead); c.stroke();
    c.restore();
  },
};

FX_EVENT.vk_arc = (e, h) => {
  const ang = Math.atan2((e.y2 ?? e.y) - e.y, (e.x2 ?? e.x + 1) - e.x);
  const n = e.n ?? 0;
  h.fx.effect('vk_arc', e.x, e.y, n >= 2 ? 0.38 : 0.3, { ang, data: n, power: n >= 2 ? 1.3 : 1 });
  if (!h.low) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    h.fx.burst(e.x + dx * 0.9, e.y + dy * 0.9, n >= 2 ? 10 : 5, { dir: { x: dx, y: dy }, spread: 1.6, color: n === 1 ? '#ff5a78' : VK.ember, kind: 'spark', size: 1.4, speed: 3, up: 60, grav: 60, life: 0.45, add: true, z: 30 });
  }
};

// ------------------------------------------------------------------ cut / drain
FX_EVENT.vk_cut = (e, h) => {
  const dx = e.x - (e.x2 ?? e.x - 1), dy = e.y - (e.y2 ?? e.y), l = Math.hypot(dx, dy) || 1;
  h.fx.burst(e.x, e.y, 8, { dir: { x: dx / l, y: dy / l }, spread: 1.4, color: VK.ember, kind: 'streak', size: 1.4, speed: 6, up: 70, grav: 150, life: 0.32, add: true, z: 24 });
  h.fx.burst(e.x, e.y, h.low ? 1 : 3, { color: '#1a0e24', kind: 'smoke', size: 3.2, speed: 0.6, up: 20, life: 0.7, z: 22 });
};

/** Blood orbs flying from the victim (x,y) up and over into the knight (x2,y2). */
EFFECT_ART.vk_lifestream = {
  air(e, d) {
    const { c, z, cam, k } = d;
    const x0 = cam.sxOf(e.x, e.y), y0 = cam.syOf(e.x, e.y) - 22 * z;
    const x1 = cam.sxOf(e.x2 ?? e.x, e.y2 ?? e.y), y1 = cam.syOf(e.x2 ?? e.x, e.y2 ?? e.y) - 34 * z;
    const mx = (x0 + x1) / 2 + Math.sin(e.seed) * 10 * z, my = Math.min(y0, y1) - (26 + 8 * e.power) * z;
    const pt = (u: number): [number, number] => { const v = 1 - u; return [v * v * x0 + 2 * v * u * mx + u * u * x1, v * v * y0 + 2 * v * u * my + u * u * y1]; };
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    // the stream itself: a fading ribbon behind the leading orb
    const head = clamp01(k * 1.5), tail = clamp01(k * 1.5 - 0.55);
    if (head > tail) {
      const n = 14;
      for (let i = 0; i < n; i++) {
        const u0 = tail + (head - tail) * (i / n), u1 = tail + (head - tail) * ((i + 1) / n);
        const [ax, ay] = pt(u0), [bx, by] = pt(u1);
        const a = (i / n) * (1 - clamp01((k - 0.7) / 0.3));
        c.strokeStyle = `rgba(${VK.bloodRGB},${0.45 * a})`; c.lineWidth = (2 + 3 * a) * z;
        c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
      }
    }
    // orbs
    const orbs = 5 + e.power * 2;
    for (let i = 0; i < orbs; i++) {
      const u = clamp01(k * 1.55 - i * 0.075);
      if (u <= 0 || u >= 1) continue;
      const [ox, oy] = pt(u);
      const wob = Math.sin(e.seed + i * 2.1 + k * 20) * 2.5 * z;
      const r = (2.2 + (i % 3) * 0.7) * z * (1 - u * 0.35);
      glow(c, ox + wob, oy, r * 3.2, VK.bloodRGB, 0.8 * (1 - u * 0.5));
    }
    c.restore();
  },
  light(_e, k) { return k < 0.8 ? [1.4, VK.bloodRGB] : null; },
};

/** The stolen life arriving: a red spiral rising around the knight. */
EFFECT_ART.vk_drainHeal = {
  air(_e, d) {
    const { c, z, sx, sy, k } = d;
    const S = z * ACTOR, a = Math.sin(clamp01(k) * Math.PI);
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (let s = 0; s < 2; s++) {
      c.beginPath();
      for (let i = 0; i <= 16; i++) {
        const u = i / 16, ang = u * TAU * 1.3 + s * Math.PI + k * 8;
        const px = sx + Math.cos(ang) * 11 * S * (1 - u * 0.3), py = sy - (4 + u * 52 * k) * S + Math.sin(ang) * 4 * S;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.strokeStyle = `rgba(${VK.bloodRGB},${0.6 * a})`; c.lineWidth = 2.2 * z; c.stroke();
      c.strokeStyle = `rgba(255,190,200,${0.5 * a})`; c.lineWidth = 0.8 * z; c.stroke();
    }
    glow(c, sx, sy - 30 * S, 16 * S, VK.bloodRGB, 0.35 * a);
    c.restore();
  },
  light(_e, k) { return [1.6 * (1 - k), VK.bloodRGB]; },
};

FX_EVENT.vk_drain = (e, h) => {
  const x2 = e.x2 ?? e.x, y2 = e.y2 ?? e.y;
  const dx = x2 - e.x, dy = y2 - e.y, l = Math.hypot(dx, dy) || 1;
  const n = e.n ?? 1;
  h.fx.effect('vk_lifestream', e.x, e.y, 0.75, { x2, y2, power: n, seed: Math.random() * 6 });
  // the wound: blood torn out toward the knight, violet sparks from the cut
  h.fx.burst(e.x, e.y, h.low ? 5 : 11, { dir: { x: dx / l, y: dy / l }, spread: 1.5, color: '#9a0a1c', kind: 'drop', size: 1.7, speed: 3.5, up: 110, grav: 300, life: 0.8, z: 24, stain: 'splat' });
  h.fx.burst(e.x, e.y, 8, { color: VK.ember, kind: 'streak', size: 1.3, speed: 5, up: 80, grav: 120, life: 0.3, add: true, z: 26 });
  // life motes flying to the knight
  const m = h.low ? 4 : 9;
  for (let i = 0; i < m; i++) {
    const sp = 5 + Math.random() * 2.5, life = l / sp;
    h.fx.add({ x: e.x + (Math.random() - 0.5) * 0.3, y: e.y + (Math.random() - 0.5) * 0.3, z: 18 + Math.random() * 10, vx: (dx / l) * sp, vy: (dy / l) * sp, vz: 16 + Math.random() * 20, color: i % 3 ? '#ff4060' : '#ffc0cc', kind: 'dot', size: 1.4, life, add: true });
  }
  if (n > 0) h.delay(0.42, () => {
    h.fx.effect('vk_drainHeal', x2, y2, 0.6, {});
    h.fx.burst(x2, y2, h.low ? 5 : 12, { color: '#ff5a74', kind: 'star', size: 1.1, speed: 0.9, up: 90, grav: 10, life: 0.8, add: true, z: 20 });
  });
};

// ------------------------------------------------------------------ dark wave
/** Samples of the crescent in world space → screen, cached per draw (no allocation: fixed buffers). */
const WN = 16;
const WX = new Float32Array(WN + 1), WY = new Float32Array(WN + 1), WH = new Float32Array(WN + 1), WI = new Float32Array(WN + 1);
PROJ_ART.vk_wave = {
  light: [2.6, '150,100,255'],
  trail: ['110,70,220', 5],
  draw(p, d) {
    const { c, cam, z, fx } = d;
    const sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp, uy = p.vy / sp, nx = -uy, ny = ux;
    const w = p.data?.w ?? WAVE.w0;
    const life0 = p.data?.life0 ?? 0.7;
    const age = clamp01(p.age / life0);
    const fin = age > 0.85 ? (1 - age) / 0.15 : 1, start = clamp01(p.age / 0.08);
    const A = fin * (0.6 + 0.4 * start);
    // A standing crescent moon of void: both horns touch the ground at the band's ends, the outer arc (the cutting
    // edge) arches over the middle, the inner arc is lower and narrower, so the blade is thickest at its crown.
    const H = 50 * z * (0.75 + 0.25 * start);
    for (let i = 0; i <= WN; i++) {
      const s = (i / WN) * 2 - 1, bulge = 0.38 * (1 - s * s) - 0.12;
      const wx = p.x + nx * w * s + ux * bulge, wy = p.y + ny * w * s + uy * bulge;
      WX[i] = cam.sxOf(wx, wy); WY[i] = cam.syOf(wx, wy);
      const flick = 1 + 0.05 * Math.sin(d.time * 23 + i * 1.3);
      WH[i] = H * Math.sqrt(Math.max(0, 1 - s * s)) * flick;
      const si = s / 0.8;
      WI[i] = H * 0.58 * Math.sqrt(Math.max(0, 1 - si * si));
    }
    const mid = WN >> 1;
    const outer = () => { for (let i = 0; i <= WN; i++) c.lineTo(WX[i], WY[i] - WH[i]); };
    const blade = () => { c.beginPath(); outer(); for (let i = WN; i >= 0; i--) c.lineTo(WX[i], WY[i] - WI[i]); c.closePath(); };
    c.save();
    c.lineJoin = 'round'; c.lineCap = 'round';
    // shadow on the floor along its path
    c.beginPath(); for (let i = 0; i <= WN; i++) c.lineTo(WX[i], WY[i] + 1.5 * z);
    c.strokeStyle = `rgba(6,2,12,${0.4 * A})`; c.lineWidth = 7 * z; c.stroke();
    // under the arch: a veil of icy mist rising from the floor
    c.globalCompositeOperation = 'lighter';
    const base = Math.max(WY[0], WY[WN], WY[mid]), crown = WY[mid] - WH[mid];
    const vg = c.createLinearGradient(0, base, 0, WY[mid] - WI[mid]);
    vg.addColorStop(0, `rgba(${VK.mistRGB},${0.3 * A})`); vg.addColorStop(1, `rgba(${V},${0.04 * A})`);
    c.beginPath(); for (let i = 0; i <= WN; i++) c.lineTo(WX[i], WY[i] - WI[i]); for (let i = WN; i >= 0; i--) c.lineTo(WX[i], WY[i]); c.closePath();
    c.fillStyle = vg; c.fill();
    // wide violet glow around the cutting edge
    c.beginPath(); outer();
    c.strokeStyle = `rgba(${V},${0.28 * A})`; c.lineWidth = 9 * z; c.stroke();
    // the blade: a black-violet body…
    c.globalCompositeOperation = 'source-over';
    blade(); c.fillStyle = `rgba(10,3,20,${0.85 * A})`; c.fill();
    // …burning violet toward its edge
    c.globalCompositeOperation = 'lighter';
    const bg = c.createLinearGradient(0, WY[mid] - WI[mid], 0, crown);
    bg.addColorStop(0, `rgba(${VD},${0.1 * A})`); bg.addColorStop(0.6, `rgba(${V},${0.45 * A})`); bg.addColorStop(1, `rgba(${VH},${0.75 * A})`);
    blade(); c.fillStyle = bg; c.fill();
    // cutting edge: violet with a white-hot core; a thin frost line on the inner edge
    c.beginPath(); outer();
    c.strokeStyle = `rgba(${V},${0.9 * A})`; c.lineWidth = 2.8 * z; c.stroke();
    c.strokeStyle = `rgba(255,246,255,${0.9 * A})`; c.lineWidth = 1.1 * z; c.stroke();
    c.beginPath(); for (let i = 2; i <= WN - 2; i++) c.lineTo(WX[i], WY[i] - WI[i]);
    c.strokeStyle = `rgba(${VK.mistRGB},${0.55 * A})`; c.lineWidth = 1 * z; c.stroke();
    // frost where it grazes the floor
    c.beginPath(); for (let i = 1; i < WN; i++) c.lineTo(WX[i], WY[i]);
    c.strokeStyle = `rgba(${VK.mistRGB},${0.45 * A})`; c.lineWidth = 1.3 * z; c.stroke();
    c.restore();
    // icy mist and void motes shed behind it
    if (!mayEmit(p.id, d.time)) return;
    const n = fx.low ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const s = Math.random() * 2 - 1;
      const x = p.x + nx * w * s - ux * 0.25, y = p.y + ny * w * s - uy * 0.25;
      fx.add({ x, y, z: 2 + Math.random() * 10, vx: -ux * 0.8 + (Math.random() - 0.5) * 0.5, vy: -uy * 0.8 + (Math.random() - 0.5) * 0.5, vz: 6, color: i === 0 ? 'rgba(170,190,255,0.3)' : 'rgba(120,80,200,0.35)', kind: 'smoke', size: 2.2 + Math.random() * 1.5, life: 0.6, add: i === 1 });
    }
    if (!fx.low && Math.random() < 0.5) { const s = Math.random() * 2 - 1; fx.add({ x: p.x + nx * w * s, y: p.y + ny * w * s, z: 8 + Math.random() * 26, vz: 20, color: Math.random() < 0.5 ? '#e6f0ff' : VK.ember, kind: 'glint', size: 1.1, life: 0.35, add: true }); }
  },
};

FX_EVENT.vk_waveCast = (e, h) => {
  const ang = Math.atan2((e.y2 ?? e.y) - e.y, (e.x2 ?? e.x + 1) - e.x), dx = Math.cos(ang), dy = Math.sin(ang);
  h.fx.effect('shock', e.x + dx * 0.4, e.y + dy * 0.4, 0.4, { r: 1.7, c: '150,90,255' });
  h.fx.burst(e.x + dx * 0.6, e.y + dy * 0.6, h.low ? 4 : 9, { dir: { x: dx, y: dy }, spread: 1.2, color: 'rgba(190,210,255,0.6)', kind: 'smoke', size: 4, speed: 3, up: 20, life: 0.8, z: 10, drag: 2 });
  h.fx.burst(e.x + dx * 0.6, e.y + dy * 0.6, 8, { dir: { x: dx, y: dy }, spread: 1.4, color: '#e6f0ff', kind: 'ice', size: 1.3, speed: 6, up: 50, grav: 120, life: 0.45, add: true, z: 16 });
};

FX_EVENT.vk_waveHit = (e, h) => {
  const dx = (e.x2 ?? e.x) - e.x, dy = (e.y2 ?? e.y) - e.y, l = Math.hypot(dx, dy) || 1;
  h.fx.effect('burst', e.x, e.y, 0.3, { r: 0.8 });
  h.fx.burst(e.x, e.y, h.low ? 4 : 9, { dir: { x: dx / l, y: dy / l }, spread: 1.6, color: Math.random() < 0.5 ? '#d8e8ff' : '#c9a2ff', kind: 'ice', size: 1.5, speed: 5, up: 70, grav: 220, life: 0.6, add: true, z: 22 });
  h.fx.burst(e.x, e.y, h.low ? 1 : 3, { color: 'rgba(190,210,255,0.5)', kind: 'smoke', size: 3.5, speed: 0.8, up: 10, life: 0.9, z: 14 });
};

// ------------------------------------------------------------------ abyssal grasp
/** Opening / closing of the pool (0..1). */
function poolAmount(t: number, dur: number): number {
  return ease(t / 0.14) * (t > dur - 0.4 ? clamp01((dur - t) / 0.4) : 1);
}

AREA_ART.vk_grasp = {
  draw(a, d) {
    const { c, z, sx, sy, rx, time } = d;
    const amt = poolAmount(a.t, a.dur);
    if (amt <= 0) return;
    // the reach of the grasp: a faint dark disc with a violet rim, sweeping out as it opens
    const rr = rx * (0.25 + 0.75 * ease(a.t / 0.16));
    c.save();
    c.translate(sx, sy); c.scale(1, 0.5);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rr);
    g.addColorStop(0, `rgba(4,0,8,${0.75 * amt})`); g.addColorStop(0.3, `rgba(10,2,18,${0.5 * amt})`); g.addColorStop(0.92, `rgba(20,4,34,${0.25 * amt})`); g.addColorStop(1, 'rgba(20,4,34,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, rr, 0, TAU); c.fill();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(${V},${0.55 * amt})`; c.lineWidth = 2.2 * z;
    c.beginPath(); c.arc(0, 0, rr, 0, TAU); c.stroke();
    // swirling arms of the vortex at the centre
    const core = rx * 0.34 * amt;
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      for (let j = 0; j <= 12; j++) {
        const u = j / 12, ang = i * (TAU / 4) + time * 2.4 + u * 2.6;
        const r = core * (0.15 + u * 1.1);
        if (j === 0) c.moveTo(Math.cos(ang) * r, Math.sin(ang) * r); else c.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
      }
      c.strokeStyle = `rgba(${V},${0.6 * amt})`; c.lineWidth = 2.4 * z; c.stroke();
    }
    // runes crawling around the rim
    c.strokeStyle = `rgba(${VH},${0.5 * amt})`; c.lineWidth = 1.2 * z;
    c.beginPath();
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * TAU - time * 0.6, r0 = rr * 0.9;
      const px = Math.cos(ang) * r0, py = Math.sin(ang) * r0, tx = -Math.sin(ang) * 3.5 * z, ty = Math.cos(ang) * 3.5 * z;
      c.moveTo(px - tx, py - ty); c.lineTo(px + tx, py + ty);
      if (i % 2) { c.moveTo(px, py); c.lineTo(px - Math.cos(ang) * 4 * z, py - Math.sin(ang) * 4 * z); }
    }
    c.stroke();
    c.restore();
    // the maw itself: a black hole at the centre
    c.save(); c.translate(sx, sy); c.scale(1, 0.5);
    c.fillStyle = `rgba(0,0,0,${0.85 * amt})`; c.beginPath(); c.arc(0, 0, core * 0.55, 0, TAU); c.fill();
    c.restore();
  },
  air(a, d) {
    const { c, z, sx, sy, rx, cam, time } = d;
    const amt = poolAmount(a.t, a.dur);
    if (amt <= 0) return;
    const t = a.t, dd = a.data;
    // clawed hands clawing up out of the maw
    const hands = 7;
    const rise = ease((t - 0.02) / 0.14) * (t > 0.6 ? clamp01(1 - (t - 0.6) / 0.45) : 1);
    if (rise > 0) {
      for (let i = 0; i < hands; i++) {
        const ang = (i / hands) * TAU + 0.4;
        const r0 = rx * 0.2, bx = sx + Math.cos(ang) * r0, by = sy + Math.sin(ang) * r0 * 0.5;
        const hgt = (20 + ((i * 37) % 11)) * z * rise;
        const lean = Math.cos(ang) * 8 * z * rise;
        const tx = bx + lean, ty = by - hgt;
        tendril(c, bx, by, bx + lean * 0.2, by - hgt * 0.6, tx, ty, 5 * z, amt, z);
        claw(c, tx, ty, 8 * z, -Math.PI / 2 + Math.cos(ang) * 0.5, t < GRASP.seizeAt ? 1 : Math.max(0, 1 - (t - GRASP.seizeAt) * 5), amt, z);
      }
    }
    // tendrils lashing out to every seized enemy, following them as they are dragged in
    if (dd.seized) {
      const grow = ease((t - GRASP.seizeAt) / 0.07), back = t > 0.72 ? clamp01(1 - (t - 0.72) / 0.3) : 1;
      const n = Math.min(GRASP.maxDrawn, dd.n ?? 0);
      for (let i = 0; i < n; i++) {
        if (!dd['a' + i]) continue;
        const mx = cam.sxOf(dd['x' + i], dd['y' + i]), my = cam.syOf(dd['x' + i], dd['y' + i]) - 16 * z;
        const reach = grow * back;
        if (reach <= 0.02) continue;
        const tx = sx + (mx - sx) * reach, ty = sy - 2 * z + (my - sy + 2 * z) * reach;
        const wob = Math.sin(time * 9 + i * 1.7) * 6 * z;
        const cxp = (sx + tx) / 2 + wob, cyp = Math.min(sy, ty) - 22 * z * reach;
        tendril(c, sx, sy - 2 * z, cxp, cyp, tx, ty, 7 * z, amt, z);
        if (reach > 0.9) claw(c, tx, ty, 10 * z, Math.atan2(ty - cyp, tx - cxp), 0.2, amt, z);
      }
    }
    void rx;
  },
  light(a) { const amt = poolAmount(a.t, a.dur); return amt > 0.05 ? [2.2 + 1.5 * amt, '150,80,255'] : null; },
};

FX_EVENT.vk_graspCast = (e, h) => {
  const tx = e.x2 ?? e.x, ty = e.y2 ?? e.y;
  h.fx.burst(e.x, e.y, h.low ? 4 : 8, { color: VK.ember, kind: 'spark', size: 1.4, speed: 1.5, up: 60, grav: 20, life: 0.5, add: true, z: 36 });
  h.fx.effect('shock', tx, ty, 0.35, { r: 1.2, c: '140,70,255' });
};

FX_EVENT.vk_graspSeize = (e, h) => {
  const r = e.r ?? GRASP.r;
  h.fx.effect('shock', e.x, e.y, 0.5, { r: r * 1.05, c: '150,80,255' });
  h.fx.effect('dust', e.x, e.y, 0.6, { r: r * 0.5 });
  h.fx.stain(e.x, e.y, 'crack', 1.4);
  h.fx.burst(e.x, e.y, h.low ? 6 : 14, { color: '#140a1e', kind: 'smoke', size: 5, speed: 1.6, up: 30, life: 1.1, z: 4 });
  h.fx.burst(e.x, e.y, h.low ? 6 : 14, { color: VK.ember, kind: 'ember', size: 1.8, speed: 3, up: 120, grav: 60, life: 0.8, add: true, z: 6 });
  h.fx.burst(e.x, e.y, h.low ? 4 : 8, { color: '#2a2230', kind: 'shard', size: 2, speed: 3, up: 150, grav: 320, life: 0.9, z: 4 });
};

// ------------------------------------------------------------------ void shroud
EFFECT_ART.vk_shroudBurst = {
  ground(_e, d) {
    const { c, z, sx, sy, k, rx } = d;
    const ek = 1 - Math.pow(1 - k, 3);
    c.save(); c.translate(sx, sy); c.scale(1, 0.5);
    const rr = Math.max(1, rx * (0.3 + ek));
    const g = c.createRadialGradient(0, 0, rr * 0.4, 0, 0, rr);
    g.addColorStop(0, `rgba(6,0,12,${0.55 * (1 - k)})`); g.addColorStop(0.8, `rgba(20,4,36,${0.4 * (1 - k)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, rr, 0, TAU); c.fill();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(${V},${0.8 * (1 - k)})`; c.lineWidth = 3 * z * (1 - k * 0.6);
    c.beginPath(); c.arc(0, 0, rr * 0.92, 0, TAU); c.stroke();
    c.restore();
  },
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const S = z * ACTOR;
    // a column of dark flame bursting up around the knight
    const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
    const n = 11;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + e.seed + k * 2.2;
      const rr = (11 + (i % 3) * 3) * S * (0.7 + 0.5 * ease(k * 2));
      const px = sx + Math.cos(ang) * rr, py = sy + Math.sin(ang) * rr * 0.4;
      darkFlame(c, px, py, (26 + ((i * 29) % 23)) * S * (0.5 + 0.8 * ease(k * 3)), (4 + (i % 2) * 1.5) * S, e.t * 1.5 + e.seed, i, a);
    }
    c.save(); c.globalCompositeOperation = 'lighter';
    glow(c, sx, sy - 30 * S, 34 * S * (0.5 + k), V, 0.4 * a);
    c.restore();
  },
  light(_e, k) { return [3 * (1 - k), '150,80,255']; },
};

FX_EVENT.vk_shroud = (e, h) => {
  h.fx.effect('vk_shroudBurst', e.x, e.y, 0.8, { r: e.r ?? 2.2, seed: Math.random() * TAU });
  h.fx.effect('shock', e.x, e.y, 0.45, { r: (e.r ?? 2.2) * 1.2, c: '140,70,255' });
  h.fx.burst(e.x, e.y, h.low ? 4 : 8, { color: '#1a0c26', kind: 'smoke', size: 4, speed: 1.6, up: 30, life: 1, z: 2 });
  h.fx.burst(e.x, e.y, h.low ? 8 : 20, { color: VK.ember, kind: 'ember', size: 1.9, speed: 2.2, up: 130, grav: -20, life: 1, add: true, z: 12 });
};

/** Heartbeat pulse (lub-dub every 1.1 s) for the shroud's aura. */
function heartbeat(t: number): number {
  const p = t % 1.1;
  return Math.exp(-p * 14) + 0.6 * Math.exp(-Math.max(0, p - 0.2) * 14) * (p > 0.2 ? 1 : 0);
}

BUFF_ART.vk_shroud = (c, sx, sy, z, time, b, fx, h) => {
  const S = z * ACTOR;
  const fade = Math.min(1, b.t / 1, (b.dur - b.t) / 0.3 + 0.3);
  const beat = heartbeat(time);
  // the void pooling at the knight's feet, throbbing with a heartbeat
  c.save();
  c.translate(sx, sy); c.scale(1, 0.5);
  const R = 22 * S * (1 + 0.08 * beat);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
  g.addColorStop(0, `rgba(4,0,10,${0.55 * fade})`); g.addColorStop(0.75, `rgba(24,6,40,${0.35 * fade})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = `rgba(${V},${(0.25 + 0.45 * beat) * fade})`; c.lineWidth = (1.2 + 1.5 * beat) * z;
  c.beginPath(); c.arc(0, 0, R * 0.85, 0, TAU); c.stroke();
  c.restore();
  // dark flames licking up around the knight (they show past both sides of his silhouette)
  const n = 6;
  for (let i = 0; i < n; i++) {
    const ang = Math.PI * 0.95 + (i / (n - 1)) * Math.PI * 1.1 + Math.sin(time * 0.7 + i) * 0.12;
    const px = sx + Math.cos(ang) * 14 * S, py = sy - 1 * S + Math.sin(ang) * 5 * S;
    darkFlame(c, px, py, (20 + ((i * 7) % 3) * 8) * S * (1 + 0.18 * beat), 4.2 * S, time, i, 0.85 * fade);
  }
  // dark mist curling at the feet, violet wisps and embers rising around the knight
  if (!mayEmit(-1, time)) return;
  const p = fx.low ? 0.25 : 0.7;
  if (Math.random() < p * 0.6 * fade) {
    const a = Math.random() * TAU, r = 0.25 + Math.random() * 0.25;
    fx.add({ x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r, z: 1 + Math.random() * 6, vz: 6, vx: Math.cos(a) * 0.4, vy: Math.sin(a) * 0.4, color: '#140a1e', kind: 'smoke', size: 3 + Math.random() * 2, life: 0.9 });
  }
  if (Math.random() < p * fade) {
    const a = Math.random() * TAU, r = 0.22 + Math.random() * 0.2;
    fx.add({ x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r, z: 6 + Math.random() * 30, vz: 40, color: 'rgba(150,80,255,0.45)', kind: 'smoke', size: 1.8 + Math.random(), life: 0.7, add: true });
  }
  if (Math.random() < p * 0.8 * fade) {
    const a = Math.random() * TAU, r = 0.2 + Math.random() * 0.25;
    fx.add({ x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r, z: 10 + Math.random() * 40, vz: 45, color: Math.random() < 0.3 ? VK.violetHi : VK.ember, kind: 'ember', size: 1.4, life: 0.8, add: true });
  }
};

// ------------------------------------------------------------------ eclipse
/** Dark overlay strength over the whole screen (the eclipse darkens the scene for a moment). */
function eclipseDark(t: number): number { return t < 0.12 ? t / 0.12 : Math.max(0, 1 - (t - 0.12) / 1.3); }
/** Radius factor and opacity of the black dome. */
function eclipseDome(t: number): { r: number; a: number } {
  const g = clamp01(t / ECLIPSE.grow);
  const r = 1 - (1 - g) * (1 - g) * (1 - g);
  const a = t < 0.75 ? 1 : clamp01(1 - (t - 0.75) / 0.6);
  return { r: r * (1 + 0.04 * Math.max(0, t - ECLIPSE.grow)), a };
}

EFFECT_ART.vk_eclipse = {
  ground(e, d) {
    const { c, z, sx, sy, rx } = d;
    const { r, a } = eclipseDome(e.t);
    if (a <= 0) return;
    const R = Math.max(1, rx * r);
    c.save(); c.translate(sx, sy); c.scale(1, 0.5);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, `rgba(0,0,0,${0.8 * a})`); g.addColorStop(0.85, `rgba(10,2,18,${0.65 * a})`); g.addColorStop(1, `rgba(40,8,70,${0.3 * a})`);
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(${V},${0.9 * a})`; c.lineWidth = 4 * z;
    c.beginPath(); c.arc(0, 0, R, 0, TAU); c.stroke();
    c.strokeStyle = `rgba(255,235,255,${0.7 * a})`; c.lineWidth = 1.4 * z; c.stroke();
    c.restore();
  },
  air(e, d) {
    const { c, z, sx, sy, rx, cam } = d;
    const t = e.t;
    // the scene sinks into darkness for a moment
    const dk = eclipseDark(t);
    if (dk > 0) { c.fillStyle = `rgba(6,2,14,${0.5 * dk})`; c.fillRect(0, 0, cam.w, cam.h); }
    const { r, a } = eclipseDome(t);
    if (a <= 0) return;
    const S = z * ACTOR;
    const R = Math.max(1, rx * r), H = R * 0.85;
    // the black dome: its upper half rises over the ground ellipse; the knight at its heart stays in a clear hollow
    const dome = () => { c.beginPath(); c.ellipse(sx, sy, R, H, 0, Math.PI, TAU); c.ellipse(sx, sy, R, R * 0.5, 0, 0, Math.PI); c.closePath(); };
    const hy = sy - 30 * S;
    const clear = Math.min(0.6, (36 * S) / R);
    const g = c.createRadialGradient(sx, hy, 0, sx, hy, R * 1.05);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(clear, 'rgba(2,0,5,0)'); g.addColorStop(Math.min(0.95, clear + 0.15), `rgba(2,0,5,${0.62 * a})`);
    g.addColorStop(0.97, `rgba(8,1,16,${0.55 * a})`); g.addColorStop(1, `rgba(40,10,70,${0.4 * a})`);
    dome(); c.fillStyle = g; c.fill();
    // curvature: a faint reflected arc inside the upper-left of the sphere
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(${V},${0.22 * a})`; c.lineWidth = 5 * z;
    c.beginPath(); c.ellipse(sx, sy, R * 0.82, H * 0.8, 0, Math.PI * 1.08, Math.PI * 1.45); c.stroke();
    c.restore();
    // the burning violet corona along the dome's edge
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath(); c.ellipse(sx, sy, R, H, 0, Math.PI, TAU);
    c.strokeStyle = `rgba(${V},${0.65 * a})`; c.lineWidth = 8 * z; c.stroke();
    c.strokeStyle = `rgba(${VH},${0.9 * a})`; c.lineWidth = 2.6 * z; c.stroke();
    c.strokeStyle = `rgba(255,255,255,${0.75 * a})`; c.lineWidth = 0.9 * z; c.stroke();
    const n = d.fx.low ? 14 : 30;
    for (let i = 0; i < n; i++) {
      const th = Math.PI + ((i + 0.5 + 0.3 * Math.sin(i * 12.9)) / n) * Math.PI;
      const px = sx + Math.cos(th) * R, py = sy + Math.sin(th) * H;
      const nx = Math.cos(th) / R, ny = Math.sin(th) / H, nl = Math.hypot(nx, ny) || 1;
      const flick = 0.5 + 0.5 * Math.sin(t * (11 + (i % 5)) + i * 2.7);
      const L = (7 + 14 * flick + ((i * 7) % 5) * 2.5) * z * (0.6 + 0.4 * a);
      const tx = px + (nx / nl) * L - Math.sin(t * 7 + i) * 2 * z, ty = py + (ny / nl) * L - L * 0.35;
      const gg = c.createLinearGradient(px, py, tx, ty);
      gg.addColorStop(0, `rgba(${VH},${0.85 * a})`); gg.addColorStop(0.45, `rgba(${V},${0.5 * a})`); gg.addColorStop(1, `rgba(${VD},0)`);
      c.strokeStyle = gg; c.lineWidth = (3 + 2.5 * ((i * 5) % 3) / 2) * z;
      c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + (nx / nl) * L * 0.55 + Math.sin(t * 9 + i) * 3 * z, py + (ny / nl) * L * 0.5, tx, ty); c.stroke();
    }
    // the eclipsed sun hanging over the knight: a black disc in a white-violet corona with long rays
    const cy = sy - 92 * S;
    const sr = (9 + 4 * r) * S * (t < ECLIPSE.grow ? 0.5 + 0.5 * r : 1);
    glow(c, sx, cy, sr * 3.4, V, 0.75 * a, false);
    c.strokeStyle = `rgba(${VH},${0.55 * a})`; c.lineWidth = 1.2 * z;
    c.beginPath();
    for (let i = 0; i < 12; i++) { const ang = (i / 12) * TAU + t * 0.8, l = sr * (i % 2 ? 1.9 : 2.6); c.moveTo(sx + Math.cos(ang) * sr * 1.15, cy + Math.sin(ang) * sr * 1.15); c.lineTo(sx + Math.cos(ang) * l, cy + Math.sin(ang) * l); }
    c.stroke();
    c.restore();
    c.fillStyle = `rgba(0,0,0,${0.97 * a})`; c.beginPath(); c.arc(sx, cy, sr, 0, TAU); c.fill();
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(255,240,255,${0.95 * a})`; c.lineWidth = 1.8 * z; c.beginPath(); c.arc(sx, cy, sr, 0, TAU); c.stroke();
    c.strokeStyle = `rgba(${V},${0.8 * a})`; c.lineWidth = 4 * z; c.beginPath(); c.arc(sx, cy, sr + 2 * z, 0, TAU); c.stroke();
    c.restore();
  },
  light(e) { const { a } = eclipseDome(e.t); return a > 0.05 ? [2.4 * a, '150,80,255'] : null; },
};

FX_EVENT.vk_eclipse = (e, h) => {
  const r = e.r ?? ECLIPSE.r;
  h.fx.effect('vk_eclipse', e.x, e.y, ECLIPSE.fx, { r });
  h.fx.stain(e.x, e.y, 'crack', 1.8);
  h.fx.burst(e.x, e.y, h.low ? 10 : 26, { color: '#12081c', kind: 'smoke', size: 6, speed: r * 1.6, up: 40, life: 1.3, z: 8, drag: 1.5 });
  h.delay(ECLIPSE.grow * 0.9, () => {
    h.fx.effect('shock', e.x, e.y, 0.5, { r: r * 1.12, c: '170,100,255' });
    h.fx.burst(e.x, e.y, h.low ? 12 : 34, { color: VK.ember, kind: 'ember', size: 2, speed: r * 3.4, up: 90, grav: 40, life: 0.9, add: true, z: 12, drag: 1.2 });
    h.fx.burst(e.x, e.y, h.low ? 6 : 14, { color: VK.violetHi, kind: 'streak', size: 1.5, speed: r * 4, up: 60, grav: 60, life: 0.5, add: true, z: 16 });
  });
};

FX_EVENT.vk_eclipseHit = (e, h) => {
  const dx = e.x - (e.x2 ?? e.x), dy = e.y - (e.y2 ?? e.y), l = Math.hypot(dx, dy) || 1;
  h.fx.effect('burst', e.x, e.y, 0.35, { r: 0.9 });
  h.fx.burst(e.x, e.y, h.low ? 3 : 7, { dir: { x: dx / l, y: dy / l }, spread: 1.4, color: VK.ember, kind: 'streak', size: 1.3, speed: 5, up: 70, grav: 100, life: 0.35, add: true, z: 24 });
  h.fx.burst(e.x, e.y, h.low ? 1 : 3, { color: '#12081c', kind: 'smoke', size: 4, speed: 0.8, up: 30, life: 0.9, z: 20 });
};
