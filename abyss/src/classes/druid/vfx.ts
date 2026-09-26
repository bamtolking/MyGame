// druid: skill visuals — the thorn seed and its leafy trail, the wandering tornado funnel with debris, writhing
// thorny vines with poison motes, translucent running spirit wolves, the rain of renewal, and the rolling
// thunderstorm with forked bolts (render/registry hooks: PROJ_ART / AREA_ART / EFFECT_ART / FX_EVENT / BUFF_ART).
import { RX } from '../../render/iso';
import type { Fx } from '../../render/fx';
import { AREA_ART, BUFF_ART, EFFECT_ART, FX_EVENT, PROJ_ART, type FxHost } from '../../render/registry';
import { leaf } from './look';
import { DR, RENEWAL, STORM, VINE_STEMS, hr, vineSpot } from './shared';

const TAU = Math.PI * 2;
const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
type C2D = CanvasRenderingContext2D;

function glow(c: C2D, x: number, y: number, r: number, col: string, a: number, sy = 1): void {
  if (a <= 0.003 || r <= 0.5) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r, r * sy, 0, 0, TAU); c.fill();
}

const LEAF_COLS = ['#7ed04a', '#5aa838', '#a8e070', '#3e7a2a', '#c6d860'];
/** A handful of leaf flakes. */
function leaves(fx: Fx, x: number, y: number, n: number, o: { speed?: number; up?: number; z?: number; life?: number; dir?: { x: number; y: number }; spread?: number } = {}): void {
  for (let i = 0; i < n; i++) fx.burst(x, y, 1, { color: LEAF_COLS[i % LEAF_COLS.length], kind: 'shard', size: 1.5, speed: o.speed ?? 3, up: o.up ?? 60, grav: 70, drag: 2.2, life: o.life ?? 1.1, z: o.z ?? 16, dir: o.dir, spread: o.spread });
}

// ================================================================== thorn seed
PROJ_ART.dr_seed = {
  light: [1.9, '140,230,90'],
  trail: ['150,230,90', 3.4],
  draw(p, d) {
    const { c, z, sx, sy, fx, ang, time } = d;
    const A = ease(p.age / 0.06);
    c.save(); c.translate(sx, sy);
    // a green comet tail streaming behind the seed (screen-space heading)
    c.globalCompositeOperation = 'lighter';
    c.save(); c.rotate(ang);
    const L = 30 * z, W = 4.6 * z, wob = Math.sin(time * 40 + p.id) * 1.2 * z;
    const tg = c.createLinearGradient(-L, 0, 4 * z, 0);
    tg.addColorStop(0, 'rgba(70,190,50,0)'); tg.addColorStop(0.65, `rgba(130,230,80,${0.5 * A})`); tg.addColorStop(1, `rgba(225,255,175,${0.95 * A})`);
    c.fillStyle = tg;
    c.beginPath(); c.moveTo(3 * z, -W); c.quadraticCurveTo(-L * 0.45, -W * 0.9 + wob, -L, wob * 0.5); c.quadraticCurveTo(-L * 0.45, W * 0.9 + wob, 3 * z, W); c.closePath(); c.fill();
    c.restore();
    glow(c, 0, 0, 15 * z, '150,240,100', 0.5 * A);
    glow(c, 0, 0, 5.5 * z, '235,255,205', 0.85 * A);
    c.globalCompositeOperation = 'source-over';
    // three leaves spiralling round the flight line behind it
    const ux = Math.cos(ang), uy = Math.sin(ang);
    for (let i = 0; i < 3; i++) {
      const ph = time * 17 + i * 2.1 + p.id, back = (9 + i * 7.5) * z, off = Math.sin(ph) * 5.5 * z;
      c.globalAlpha = A * (1 - i * 0.27) * (0.65 + 0.35 * Math.cos(ph));
      leaf(c, -ux * back - uy * off, -uy * back + ux * off, (5.6 - i * 0.9) * z, ang + Math.PI + Math.sin(ph) * 0.9, LEAF_COLS[i], false);
    }
    c.globalAlpha = 1;
    // the seed: a spinning thorny husk
    c.rotate((p.data?.spin ?? 0) + p.age * 22); c.scale(z * 1.25, z * 1.25);
    c.fillStyle = '#26400f';
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; c.beginPath(); c.moveTo(Math.cos(a - 0.36) * 2.6, Math.sin(a - 0.36) * 2.2); c.lineTo(Math.cos(a) * 6, Math.sin(a) * 4.9); c.lineTo(Math.cos(a + 0.36) * 2.6, Math.sin(a + 0.36) * 2.2); c.fill(); }
    c.fillStyle = '#e2eeae';
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; c.beginPath(); c.moveTo(Math.cos(a - 0.26) * 2.6, Math.sin(a - 0.26) * 2.2); c.lineTo(Math.cos(a) * 5.4, Math.sin(a) * 4.4); c.lineTo(Math.cos(a + 0.26) * 2.6, Math.sin(a + 0.26) * 2.2); c.fill(); }
    const g = c.createRadialGradient(-1, -1, 0.3, 0, 0, 3.4);
    g.addColorStop(0, '#eaffb8'); g.addColorStop(0.45, '#6ab834'); g.addColorStop(1, '#22400e');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 3.4, 2.6, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(30,60,10,0.85)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(-2.6, 0); c.quadraticCurveTo(0, 1, 2.6, 0); c.stroke();
    c.restore();
    if (Math.random() < (fx.low ? 0.15 : 0.5)) fx.add({ x: p.x, y: p.y, z: 18, vx: -p.vx * 0.08 + (Math.random() - 0.5), vy: -p.vy * 0.08 + (Math.random() - 0.5), vz: -8, grav: 50, drag: 2, color: LEAF_COLS[(Math.random() * 4) | 0], kind: 'shard', size: 1.3, life: 0.6 });
    if (!fx.low && Math.random() < 0.35) fx.add({ x: p.x, y: p.y, z: 18, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, vz: (Math.random() - 0.5) * 10, color: '#c8ff90', kind: 'dot', size: 1, life: 0.35, add: true });
  },
};

FX_EVENT.dr_seedCast = (e, h) => {
  const dir = { x: e.x2 ?? 1, y: e.y2 ?? 0 };
  h.fx.burst(e.x + dir.x * 0.5, e.y + dir.y * 0.5, h.low ? 3 : 6, { dir, spread: 0.9, color: '#b8ff80', kind: 'spark', size: 1.3, speed: 5, up: 30, life: 0.3, add: true, z: 34 });
  if (!h.low) leaves(h.fx, e.x + dir.x * 0.5, e.y + dir.y * 0.5, 2, { dir, spread: 1, speed: 2.5, z: 34, life: 0.8 });
};
FX_EVENT.dr_seedHit = (e, h) => {
  const l = Math.hypot(e.x2 ?? 0, e.y2 ?? 0) || 1;
  const dir = { x: (e.x2 ?? 0) / l, y: (e.y2 ?? 0) / l };
  h.fx.effect('dr_leafPop', e.x, e.y, 0.25, { r: 0.7 });
  leaves(h.fx, e.x, e.y, h.low ? 3 : 6, { dir, spread: 1.8, speed: 3.5, up: 80, z: 20 });
  h.fx.burst(e.x, e.y, h.low ? 2 : 5, { dir, spread: 1.4, color: '#6a4a2a', kind: 'shard', size: 1.4, speed: 4, up: 90, grav: 260, life: 0.6, z: 20 });
};
EFFECT_ART.dr_leafPop = {
  air(e, d) {
    const { c, sx, sy, k, rx, z } = d;
    c.globalCompositeOperation = 'lighter';
    glow(c, sx, sy - 20 * z, rx * (0.4 + k * 0.8), '160,255,110', 0.7 * (1 - k), 0.8);
  },
};

// ================================================================== tornado
/** Funnel ring radius (px at zoom 1) at height h (0 = ground). */
const funnelR = (h: number) => 3.5 + h * 0.3 + (h > 50 ? (h - 50) * 0.25 : 0);

PROJ_ART.dr_tornado = {
  light: [1.4, '150,190,150'],
  trail: ['60,70,60', 0.05],
  draw(p, d) {
    const { c, z, sx, fx, time } = d;
    const gy = d.sy + 18 * z;
    const fadeIn = ease(p.age / 0.2), fadeOut = ease(p.life / 0.3);
    const A = Math.min(fadeIn, fadeOut);
    const H = 84 * (0.6 + 0.4 * fadeIn);
    const lean = Math.sin(time * 3 + p.id) * 6;      // the top of the funnel drifts behind the base
    const N = fx.low ? 7 : 11;
    c.save();
    // ground dust skirt
    glow(c, sx, gy, 22 * z, '120,110,90', 0.35 * A, 0.45);
    // funnel body: a translucent silhouette between the left and right ring edges
    const xs: number[] = [], ys: number[] = [], rs: number[] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, h = u * H;
      const wob = Math.sin(time * 7 + i * 0.8 + p.id) * (1.5 + u * 4) + lean * u * u;
      xs.push(sx + wob * z); ys.push(gy - h * z); rs.push(funnelR(h) * z * (0.8 + 0.2 * Math.sin(time * 11 + i)));
    }
    const bg = c.createLinearGradient(0, gy, 0, gy - H * z);
    bg.addColorStop(0, `rgba(80,94,70,${0.86 * A})`); bg.addColorStop(0.45, `rgba(114,142,106,${0.74 * A})`); bg.addColorStop(1, `rgba(168,196,156,${0.38 * A})`);
    c.fillStyle = bg;
    c.beginPath();
    for (let i = 0; i <= N; i++) c.lineTo(xs[i] - rs[i], ys[i]);
    for (let i = N; i >= 0; i--) c.lineTo(xs[i] + rs[i], ys[i]);
    c.closePath(); c.fill();
    // a faint green heart of living wind
    c.globalCompositeOperation = 'lighter';
    const mid = Math.floor(N * 0.45);
    glow(c, xs[mid], ys[mid], H * 0.34 * z, '140,225,110', 0.2 * A, 1.7);
    c.globalCompositeOperation = 'source-over';
    // twisting darker streaks inside the funnel
    c.lineCap = 'round';
    for (let q = 0; q < 3; q++) {
      c.strokeStyle = `rgba(56,66,54,${0.45 * A})`; c.lineWidth = (2.2 - q * 0.5) * z;
      c.beginPath();
      for (let i = 0; i <= N; i++) { const x = xs[i] + Math.sin(time * 9 + i * 0.9 + q * 2.1) * rs[i] * 0.6; if (i) c.lineTo(x, ys[i]); else c.moveTo(x, ys[i]); }
      c.stroke();
    }
    // spinning wind bands (front arcs bright, back arcs faint)
    c.lineCap = 'round';
    for (let i = 0; i <= N; i++) {
      const rx = rs[i], ry = rx * 0.32, rot = time * (13 - i * 0.4) + i * 1.3;
      for (let j = 0; j < 3; j++) {
        const an = rot + (j * TAU) / 3, front = Math.sin(an + 0.6) > 0;
        c.strokeStyle = front ? `rgba(214,244,200,${0.8 * A})` : `rgba(150,190,140,${0.3 * A})`;
        c.lineWidth = (front ? 1.7 + (i / N) * 1.5 : 1) * z;
        c.beginPath(); c.ellipse(xs[i], ys[i], rx, ry, 0, an, an + 1.2); c.stroke();
      }
    }
    // debris and leaves whirling round the funnel
    const D = fx.low ? 7 : 16;
    for (let j = 0; j < D; j++) {
      const u = hr(j, p.id) * 0.85 + 0.05, h = u * H;
      const an = time * (9 - u * 4) + j * 2.4;
      const rr = funnelR(h) * z * 1.15;
      const wob = Math.sin(time * 7 + u * N * 0.8 + p.id) * (1.5 + u * 4) + lean * u * u;
      const x = sx + wob * z + Math.cos(an) * rr, y = gy - h * z + Math.sin(an) * rr * 0.32;
      if (j % 3 === 0) { c.fillStyle = `rgba(80,60,40,${A})`; c.save(); c.translate(x, y); c.rotate(an * 1.7); c.fillRect(-2 * z, -0.7 * z, 4 * z, 1.4 * z); c.restore(); }
      else { c.globalAlpha = A; leaf(c, x, y, 5.2 * z, an * 2, LEAF_COLS[j % LEAF_COLS.length], false); c.globalAlpha = 1; }
    }
    c.restore();
    if (Math.random() < (fx.low ? 0.25 : 0.6)) fx.add({ x: p.x + (Math.random() - 0.5) * 0.5, y: p.y + (Math.random() - 0.5) * 0.5, z: 2, vz: 25, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, color: '#8a8070', kind: 'smoke', size: 4, life: 0.7 });
    if (!fx.low && Math.random() < 0.25) fx.add({ x: p.x, y: p.y, z: 10 + Math.random() * 50, vz: 30, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, grav: 60, drag: 1.5, color: LEAF_COLS[(Math.random() * 5) | 0], kind: 'shard', size: 1.4, life: 1 });
  },
};
FX_EVENT.dr_tornadoCast = (e, h) => {
  h.fx.effect('dust', e.x, e.y, 0.5, { r: 1.2 });
  h.fx.burst(e.x, e.y, h.low ? 4 : 9, { color: '#8a8070', kind: 'smoke', size: 4, speed: 2.5, up: 30, life: 0.8, z: 4 });
  if (!h.low) leaves(h.fx, e.x, e.y, 5, { speed: 3, up: 90, z: 10 });
};
FX_EVENT.dr_tornadoHit = (e, h) => {
  h.fx.burst(e.x, e.y, h.low ? 2 : 5, { color: '#8a8070', kind: 'smoke', size: 3.5, speed: 1.5, up: 40, life: 0.6, z: 14 });
  h.fx.burst(e.x, e.y, h.low ? 2 : 4, { color: '#dfe8dc', kind: 'streak', size: 1.1, speed: 6, up: 60, life: 0.25, add: true, z: 24 });
  if (!h.low) leaves(h.fx, e.x, e.y, 2, { speed: 4, up: 120, z: 24 });
};
FX_EVENT.dr_tornadoEnd = (e, h) => {
  h.fx.burst(e.x, e.y, h.low ? 4 : 10, { color: '#8a8070', kind: 'smoke', size: 5, speed: 2.2, up: 50, life: 1, z: 10 });
  leaves(h.fx, e.x, e.y, h.low ? 3 : 7, { speed: 3.5, up: 140, z: 30, life: 1.4 });
};

// ================================================================== thorny vines
// scratch buffers for stem sampling (no per-frame allocation)
const VX = new Float32Array(9), VY = new Float32Array(9), VNX = new Float32Array(9), VNY = new Float32Array(9), VW = new Float32Array(9);

/**
 * One bramble stem growing from (x,y) screen to height hgt: a tapered, bark-dark stem with hooked thorns, a leaf or
 * two and a curled tip, swaying with time. `spring` (0..1) adds the overshoot wobble of a stem that just burst up.
 */
function vine(c: C2D, x: number, y: number, hgt: number, z: number, grow: number, t: number, seed: number, front: boolean, thick = 1, spring = 0): void {
  if (grow <= 0.02) return;
  const H = hgt * grow * (1 + 0.14 * spring), sway = Math.sin(t * 2.6 + seed * 6) * 5 * z * grow, side = seed > 0.5 ? 1 : -1;
  const curl = side * (5 + seed * 5) * z;
  const x1 = x + sway + curl * 0.6, y1 = y - H;
  const cx1 = x - curl * 0.8, cy1 = y - H * 0.35, cx2 = x + curl * 1.2 + sway, cy2 = y - H * 0.75;
  const K = 8, w0 = 3.3 * z * thick * (0.55 + 0.45 * grow), w1 = 0.55 * z;
  for (let k = 0; k <= K; k++) {
    const u = k / K, v = 1 - u;
    VX[k] = v * v * v * x + 3 * v * v * u * cx1 + 3 * v * u * u * cx2 + u * u * u * x1;
    VY[k] = v * v * v * y + 3 * v * v * u * cy1 + 3 * v * u * u * cy2 + u * u * u * y1;
    VW[k] = w0 + (w1 - w0) * Math.pow(u, 0.8);
  }
  for (let k = 0; k <= K; k++) {
    const a = Math.max(0, k - 1), b = Math.min(K, k + 1);
    const tx = VX[b] - VX[a], ty = VY[b] - VY[a], l = Math.hypot(tx, ty) || 1;
    VNX[k] = -ty / l; VNY[k] = tx / l;
  }
  const body = (extra: number) => {
    c.beginPath();
    for (let k = 0; k <= K; k++) { const w = VW[k] + extra; if (k) c.lineTo(VX[k] + VNX[k] * w, VY[k] + VNY[k] * w); else c.moveTo(VX[k] + VNX[k] * w, VY[k] + VNY[k] * w); }
    for (let k = K; k >= 0; k--) { const w = VW[k] + extra; c.lineTo(VX[k] - VNX[k] * w, VY[k] - VNY[k] * w); }
    c.closePath(); c.fill();
  };
  const col = front ? '#3c6a22' : '#2c5018';
  // hooked thorns (drawn first so the stem covers their roots)
  c.fillStyle = '#16240a';
  c.beginPath();
  for (let k = 1; k < K; k++) {
    const s = k % 2 ? 1 : -1, w = VW[k], len = (2.2 + w / z * 0.55) * z;
    const bx = VX[k] + VNX[k] * w * s, by = VY[k] + VNY[k] * w * s;
    const tx = VX[k + 1] - VX[k - 1], ty = VY[k + 1] - VY[k - 1], tl = Math.hypot(tx, ty) || 1;
    c.moveTo(bx - (tx / tl) * 1.5 * z, by - (ty / tl) * 1.5 * z);
    c.lineTo(bx + VNX[k] * s * len + (tx / tl) * len * 0.55, by + VNY[k] * s * len + (ty / tl) * len * 0.55);
    c.lineTo(bx + (tx / tl) * 1.5 * z, by + (ty / tl) * 1.5 * z);
  }
  c.fill();
  c.fillStyle = '#e4dba8';
  c.beginPath();
  for (let k = 1; k < K; k++) {
    const s = k % 2 ? 1 : -1, w = VW[k], len = (2.2 + w / z * 0.55) * z * 0.82;
    const bx = VX[k] + VNX[k] * w * s, by = VY[k] + VNY[k] * w * s;
    const tx = VX[k + 1] - VX[k - 1], ty = VY[k + 1] - VY[k - 1], tl = Math.hypot(tx, ty) || 1;
    c.moveTo(bx - (tx / tl) * 0.9 * z, by - (ty / tl) * 0.9 * z);
    c.lineTo(bx + VNX[k] * s * len + (tx / tl) * len * 0.55, by + VNY[k] * s * len + (ty / tl) * len * 0.55);
    c.lineTo(bx + (tx / tl) * 0.9 * z, by + (ty / tl) * 0.9 * z);
  }
  c.fill();
  // the stem: dark rim, body, and a lit edge
  c.fillStyle = '#101c06'; body(0.9 * z);
  c.fillStyle = col; body(0);
  c.strokeStyle = front ? 'rgba(175,235,110,0.55)' : 'rgba(140,200,90,0.35)'; c.lineWidth = 0.8 * z; c.lineCap = 'round';
  c.beginPath();
  for (let k = 0; k < K; k++) { const w = VW[k] * 0.45; if (k) c.lineTo(VX[k] - VNX[k] * w, VY[k] - VNY[k] * w); else c.moveTo(VX[k] - VNX[k] * w, VY[k] - VNY[k] * w); }
  c.stroke();
  // leaves
  if (grow > 0.55) {
    leaf(c, VX[4], VY[4], 5 * z * thick, side > 0 ? -0.35 : -2.8, front ? '#5aa838' : '#3e7a2a', false);
    if (thick >= 1) leaf(c, VX[6], VY[6], 4 * z, side > 0 ? -2.6 : -0.5, front ? '#7ec84a' : '#4a8a30', false);
  }
  // curled tip
  c.strokeStyle = col; c.lineWidth = 1.3 * z;
  c.beginPath(); c.arc(x1 - side * 2 * z, y1, 2 * z, side > 0 ? 0 : Math.PI, side > 0 ? Math.PI * 1.4 : Math.PI * 2.4); c.stroke();
}

const vineLayout = vineSpot;
/** Stems that would sprout out of a wall are skipped (the sim marks them in data.wall). */
const walled = (a: { data: Record<string, number> }, i: number): boolean => (((a.data.wall ?? 0) >> i) & 1) === 1;
const vineGrow = (at: number, dur: number, delay: number) => ease((at - delay) / 0.3) * (1 - ease((at - (dur - 0.45)) / 0.45));
/** Overshoot wobble right after a stem bursts from the ground. */
const vineSpring = (at: number, delay: number) => { const u = at - delay - 0.25; return u > 0 ? Math.sin(u * 11) * Math.exp(-u * 4) : 0; };
/** A bramble tuft: a main stem and a thinner one leaning the other way. */
function tuft(c: C2D, x: number, y: number, h: number, z: number, grow: number, t: number, seed: number, front: boolean, spring: number): void {
  vine(c, x - 2 * z, y + 1 * z, h * 0.62, z, grow, t + 1.7, 1 - seed, front, 0.72, spring);
  vine(c, x, y, h, z, grow, t, seed, front, 1, spring);
}

AREA_ART.dr_vines = {
  light: (a) => [a.r * 0.8 * (1 - ease((a.t - a.dur + 0.6) / 0.6)), '120,230,70'],
  draw(a, d) {
    const { c, cam, z, sx, sy, rx, fx, time } = d;
    const fade = ease(a.t / 0.25) * (1 - ease((a.t - a.dur + 0.5) / 0.5));
    // churned earth and a sickly green glow
    c.save(); c.translate(sx, sy); c.scale(1, 0.5);
    const g = c.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx);
    g.addColorStop(0, `rgba(30,40,14,${0.55 * fade})`); g.addColorStop(0.75, `rgba(40,60,18,${0.35 * fade})`); g.addColorStop(1, 'rgba(30,40,10,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill();
    c.globalCompositeOperation = 'lighter';
    const pulse = 0.6 + 0.4 * Math.sin(time * 3 + a.id);
    const g2 = c.createRadialGradient(0, 0, rx * 0.3, 0, 0, rx);
    g2.addColorStop(0, 'rgba(90,200,40,0)'); g2.addColorStop(0.85, `rgba(110,230,60,${0.22 * fade * pulse})`); g2.addColorStop(1, 'rgba(110,230,60,0)');
    c.fillStyle = g2; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill();
    c.restore();
    // roots creeping outward on the floor
    c.save(); c.strokeStyle = `rgba(40,70,20,${0.8 * fade})`; c.lineWidth = 1.6 * z; c.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const an = hr(i, a.id) * TAU, len = a.r * ease(a.t / 0.4) * (0.7 + 0.3 * hr(i + 7, a.id));
      c.beginPath(); c.moveTo(sx, sy);
      for (let k = 1; k <= 4; k++) { const rr = (len * k) / 4, aa = an + Math.sin(k * 1.7 + i) * 0.3; c.lineTo(cam.sxOf(a.x + Math.cos(aa) * rr, a.y + Math.sin(aa) * rr), cam.syOf(a.x + Math.cos(aa) * rr, a.y + Math.sin(aa) * rr)); }
      c.stroke();
    }
    c.restore();
    // stems in the back part of the field (the front part is drawn over the actors, see air)
    const n = fx.low ? 8 : VINE_STEMS;
    for (let i = 0; i < n; i++) {
      const v = vineLayout(a, i);
      if (v.dx + v.dy > a.r * 0.35 || walled(a, i)) continue;
      tuft(c, cam.sxOf(a.x + v.dx, a.y + v.dy), cam.syOf(a.x + v.dx, a.y + v.dy), v.h * z, z, vineGrow(a.t, a.dur, v.delay), time, v.seed, false, vineSpring(a.t, v.delay));
    }
    // poison motes and spores
    if (Math.random() < (fx.low ? 0.2 : 0.55) * fade) {
      const an = Math.random() * TAU, rr = Math.sqrt(Math.random()) * a.r;
      fx.add({ x: a.x + Math.cos(an) * rr, y: a.y + Math.sin(an) * rr, z: 4, vz: 14 + Math.random() * 14, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, color: Math.random() < 0.6 ? DR.poison : '#d0ff80', kind: 'dot', size: 1.1 + Math.random() * 0.8, life: 1.4, add: true });
    }
  },
  air(a, d) {
    const { c, cam, z, fx, time } = d;
    const n = fx.low ? 8 : VINE_STEMS;
    for (let i = 0; i < n; i++) {
      const v = vineLayout(a, i);
      if (v.dx + v.dy <= a.r * 0.35 || walled(a, i)) continue;
      tuft(c, cam.sxOf(a.x + v.dx, a.y + v.dy), cam.syOf(a.x + v.dx, a.y + v.dy), v.h * 0.8 * z, z, vineGrow(a.t, a.dur, v.delay), time, v.seed, true, vineSpring(a.t, v.delay));
    }
  },
};

FX_EVENT.dr_vinesCast = (e, h) => {
  const r = e.r ?? 2.6;
  h.fx.effect('shock', e.x, e.y, 0.45, { r: r * 1.05, c: '120,230,60' });
  h.fx.effect('dust', e.x, e.y, 0.6, { r: r * 0.8 });
  h.fx.stain(e.x, e.y, 'crack', r * 0.55);
  h.fx.burst(e.x, e.y, h.low ? 6 : 14, { color: '#4a3a24', kind: 'shard', size: 1.8, speed: r * 2, up: 140, grav: 320, life: 0.9, z: 4 });
  h.fx.burst(e.x, e.y, h.low ? 3 : 7, { color: '#5a4a34', kind: 'smoke', size: 5, speed: r * 1.2, up: 20, life: 0.9, z: 4 });
  leaves(h.fx, e.x, e.y, h.low ? 4 : 9, { speed: r * 1.6, up: 110, z: 8 });
};
FX_EVENT.dr_vineGrab = (e, h) => {
  h.fx.effect('dr_vineGrab', e.x, e.y, 0.65, { r: e.r ?? 0.4 });
  h.fx.burst(e.x, e.y, h.low ? 2 : 5, { color: DR.poison, kind: 'dot', size: 1.5, speed: 1.2, up: 50, life: 0.8, add: true, z: 10 });
};
FX_EVENT.dr_vineWrap = (e, h) => { h.fx.effect('dr_vineWrap', e.x, e.y, 0.58, { r: e.r ?? 0.4 }); };

/** Coils of vine wrapped round an actor's legs (air layer, so it sits over the monster). */
function coils(c: C2D, sx: number, sy: number, z: number, rx: number, hgt: number, grow: number, t: number, a: number): void {
  if (grow <= 0.02 || a <= 0) return;
  c.globalAlpha = a;
  c.lineCap = 'round';
  const turns = 2.2, n = 22, top = hgt * grow;
  for (const [col, w] of [['#16280c', 2.8], ['#3a6a24', 1.8]] as [string, number][]) {
    c.strokeStyle = col; c.lineWidth = w * z;
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const u = i / n, an = u * turns * TAU + t * 0.8;
      const x = sx + Math.cos(an) * rx * (1 - u * 0.25), y = sy - u * top + Math.sin(an) * rx * 0.35;
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.stroke();
  }
  c.fillStyle = '#d8d0a0';
  for (let i = 2; i < n; i += 4) {
    const u = i / n, an = u * turns * TAU + t * 0.8;
    if (Math.sin(an) < 0) continue;   // only thorns on the near side
    const x = sx + Math.cos(an) * rx * (1 - u * 0.25), y = sy - u * top + Math.sin(an) * rx * 0.35;
    c.beginPath(); c.moveTo(x - 0.7 * z, y); c.lineTo(x + 0.4 * z, y - 2.6 * z); c.lineTo(x + 0.8 * z, y); c.fill();
  }
  c.globalAlpha = 1;
}
EFFECT_ART.dr_vineGrab = {
  ground(e, d) {
    const { c, sx, sy, z, k } = d;
    const R = Math.max(0.35, e.r) * RX * z;
    c.globalCompositeOperation = 'lighter';
    glow(c, sx, sy, R * 1.8, '120,230,60', 0.5 * (1 - k), 0.5);
  },
  air(e, d) {
    const { c, sx, sy, z, k, time } = d;
    const R = Math.max(0.35, e.r) * RX * z * 0.85;
    coils(c, sx, sy, z, R, 20 * z, ease(k / 0.35), time * 2, k > 0.8 ? (1 - k) / 0.2 : 1);
  },
};
EFFECT_ART.dr_vineWrap = {
  air(e, d) {
    const { c, sx, sy, z, k } = d;
    const R = Math.max(0.35, e.r) * RX * z * 0.85;
    coils(c, sx, sy, z, R, 16 * z, 1, 0.3 + (e.seed % 3), k > 0.85 ? (1 - k) / 0.15 : 1);
  },
};

// ================================================================== spirit wolves
/**
 * A running wolf silhouette, facing +x, feet at y = 0 (units: px at zoom 1). ph: gait phase. `grow` widens every
 * stroke and outlines the fills (used for the glowing rim pass under the body pass).
 */
export function wolfShape(c: C2D, ph: number, grow: number): void {
  const s = Math.sin(ph), s2 = Math.sin(ph + 1.6);
  const bodyY = -11 + Math.abs(Math.cos(ph)) * -1.8;
  const leg = (x: number, a: number, w: number) => {
    const kx = x + Math.sin(a) * 5, ky = bodyY + 5.5;
    c.lineWidth = w + grow; c.beginPath(); c.moveTo(x, bodyY + 1); c.lineTo(kx, ky); c.lineTo(kx + Math.sin(a * 1.4) * 4 + 1, 0 - Math.max(0, -Math.cos(a)) * 2); c.stroke();
  };
  const shape = () => { c.fill(); if (grow > 0) { c.lineWidth = grow; c.stroke(); } };
  c.lineCap = 'round'; c.lineJoin = 'round';
  leg(7, s2 * 0.9, 1.8); leg(-7, -s * 0.9, 1.8);
  // tail streaming back
  c.beginPath(); c.moveTo(-9, bodyY - 1.5); c.quadraticCurveTo(-15, bodyY - 5 + s * 1.5, -21, bodyY - 2 + s * 2.5); c.quadraticCurveTo(-15, bodyY + 1.5, -9, bodyY + 1); shape();
  // body: deep chest, tucked waist, long muzzle
  c.beginPath();
  c.moveTo(-10, bodyY - 1);
  c.quadraticCurveTo(-4, bodyY - 5.2, 6, bodyY - 4.6);
  c.quadraticCurveTo(10, bodyY - 4.4, 11.5, bodyY - 5.5);
  c.lineTo(15.5, bodyY - 5.2); c.lineTo(20, bodyY - 3.6);
  c.lineTo(19.5, bodyY - 2.2); c.lineTo(15, bodyY - 1.6);
  c.quadraticCurveTo(12, bodyY + 3.2, 7, bodyY + 3.4);
  c.quadraticCurveTo(0, bodyY + 1.2, -5, bodyY + 2.6);
  c.quadraticCurveTo(-9, bodyY + 3, -10, bodyY - 1);
  shape();
  // ears
  c.beginPath(); c.moveTo(12, bodyY - 5.2); c.lineTo(12.6, bodyY - 9.5); c.lineTo(14.4, bodyY - 5.6); c.closePath(); shape();
  leg(6, -s2 * 0.9, 2.2); leg(-6.5, s * 0.9, 2.2);
}

PROJ_ART.dr_wolf = {
  light: [2, '120,235,215'],
  trail: [DR.spirit, 1.6],
  draw(p, d) {
    const { c, z, sx, fx, ang } = d;
    const gy = d.sy + 18 * z;
    const A = Math.min(ease(p.age / 0.22), ease(p.life / 0.22));   // materialise out of the mist
    const ph = p.age * 17 + (p.data?.i ?? 0);
    const flip = Math.cos(ang) < 0;
    const tilt = Math.max(-0.35, Math.min(0.35, Math.sin(ang) * 0.45));
    const k = 1.3 * z;
    c.save();
    c.translate(sx, gy);
    c.globalCompositeOperation = 'lighter';
    glow(c, 0, -12 * k, 22 * k, DR.spirit, 0.2 * A, 0.55);
    c.globalCompositeOperation = 'source-over';
    c.scale(flip ? -k : k, k); c.rotate(tilt);
    c.globalAlpha = 0.9 * A;
    // glowing rim, then the translucent body over it
    c.fillStyle = 'rgba(150,240,222,0.9)'; c.strokeStyle = 'rgba(150,240,222,0.9)';
    wolfShape(c, ph, 1.4);
    c.fillStyle = 'rgba(34,128,122,0.8)'; c.strokeStyle = 'rgba(34,128,122,0.8)';
    wolfShape(c, ph, 0);
    // light along the back
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(110,230,210,0.3)'; c.strokeStyle = 'rgba(110,230,210,0.3)';
    c.save(); c.translate(1.5, -1.8); c.scale(0.82, 0.62); wolfShape(c, ph, 0); c.restore();
    // eye
    const ey = -14.2 + Math.abs(Math.cos(ph)) * -1.8;
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(15.6, ey, 0.95, 0, TAU); c.fill();
    glow(c, 15.6, ey, 3.2, '220,255,250', 0.8);
    c.restore();
    if (Math.random() < (fx.low ? 0.2 : 0.6)) fx.add({ x: p.x - p.vx * 0.03, y: p.y - p.vy * 0.03, z: 6 + Math.random() * 14, vz: 18, vx: -p.vx * 0.1, vy: -p.vy * 0.1, drag: 3, color: Math.random() < 0.5 ? DR.spiritHex : '#d0fff4', kind: 'dot', size: 1.2, life: 0.5, add: true });
  },
};
FX_EVENT.dr_wolvesCast = (e, h) => {
  h.fx.effect('dr_spiritRing', e.x, e.y, 0.6, { r: 1.8 });
  h.fx.burst(e.x, e.y, h.low ? 6 : 12, { color: DR.spiritHex, kind: 'dot', size: 1.6, speed: 3, up: 70, life: 0.8, add: true, z: 20 });
};
FX_EVENT.dr_wolfBite = (e, h) => {
  const l = Math.hypot(e.x2 ?? 0, e.y2 ?? 0) || 1;
  const dir = { x: (e.x2 ?? 1) / l, y: (e.y2 ?? 0) / l };
  h.fx.effect('dr_bite', e.x, e.y, 0.32, { ang: Math.atan2(dir.y, dir.x) });
  h.fx.burst(e.x, e.y, h.low ? 5 : 12, { dir, spread: 2.2, color: DR.spiritHex, kind: 'dot', size: 1.5, speed: 3, up: 70, life: 0.7, add: true, z: 18 });
};
FX_EVENT.dr_wolfFade = (e, h) => {
  h.fx.burst(e.x, e.y, h.low ? 4 : 9, { color: DR.spiritHex, kind: 'dot', size: 1.4, speed: 1.5, up: 60, life: 0.9, add: true, z: 12 });
};
EFFECT_ART.dr_spiritRing = {
  ground(e, d) {
    const { c, sx, sy, rx, k } = d;
    c.globalCompositeOperation = 'lighter';
    const rr = rx * (0.3 + ease(k) * 0.9);
    c.strokeStyle = `rgba(${DR.spirit},${0.8 * (1 - k)})`; c.lineWidth = 3 * d.z * (1 - k);
    c.beginPath(); c.ellipse(sx, sy, rr, rr * 0.5, 0, 0, TAU); c.stroke();
    glow(c, sx, sy, rr, DR.spirit, 0.3 * (1 - k), 0.5);
  },
  light: (_e, k) => [2.5 * (1 - k), DR.spirit],
};
EFFECT_ART.dr_bite = {
  air(e, d) {
    const { c, sx, sy, z, k } = d;
    // two fang crescents snapping shut on the target
    const y = sy - 22 * z, gap = 9 * z * (1 - ease(k / 0.4)), a = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
    c.globalCompositeOperation = 'lighter';
    glow(c, sx, y, 16 * z, DR.spirit, 0.5 * a);
    c.translate(sx, y);
    c.fillStyle = `rgba(220,255,250,${0.95 * a})`;
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(-10 * z, s * gap); c.quadraticCurveTo(0, s * (gap + 6 * z), 10 * z, s * gap);
      c.quadraticCurveTo(0, s * (gap + 2.5 * z), -10 * z, s * gap); c.fill();
      for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 3.6 * z - 1.2 * z, s * (gap + 1.2 * z)); c.lineTo(i * 3.6 * z, s * (gap - 2.8 * z)); c.lineTo(i * 3.6 * z + 1.2 * z, s * (gap + 1.2 * z)); c.fill(); }
    }
  },
};

// ================================================================== rain of renewal
AREA_ART.dr_renewal = {
  light: (a) => [a.r * 1.2 * (1 - ease((a.t - a.dur + 0.6) / 0.6)) * ease(a.t / 0.3), '150,255,130'],
  draw(a, d) {
    const { c, sx, sy, rx, z, time, fx } = d;
    const fade = ease(a.t / 0.35) * (1 - ease((a.t - RENEWAL.heal) / (a.dur - RENEWAL.heal + 0.01)));
    c.save();
    c.globalCompositeOperation = 'lighter';
    // soft green pool of light and a slowly turning ring of runes/leaves
    glow(c, sx, sy, rx, '120,240,110', 0.26 * fade, 0.5);
    c.strokeStyle = `rgba(170,255,140,${0.22 * fade})`; c.lineWidth = 3 * z;
    c.beginPath(); c.ellipse(sx, sy, rx * 0.92, rx * 0.46, 0, 0, TAU); c.stroke();
    c.globalCompositeOperation = 'source-over';
    // leaves turning slowly on the rim of the rain
    const nl = fx.low ? 8 : 16;
    for (let i = 0; i < nl; i++) {
      const an = (i / nl) * TAU + time * 0.35;
      c.globalAlpha = fade * (0.55 + 0.45 * Math.sin(an));
      leaf(c, sx + Math.cos(an) * rx * 0.92, sy + Math.sin(an) * rx * 0.46, 5 * z, an + Math.PI * 0.5, LEAF_COLS[i % LEAF_COLS.length], false);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'lighter';
    // puddle ripples where the drops land
    const n = fx.low ? 5 : 10;
    for (let i = 0; i < n; i++) {
      const slot = Math.floor(time * 2.2 + hr(i, 3)), f = (time * 2.2 + hr(i, 3)) % 1;
      const an = hr(slot * 7 + i, 5) * TAU, rr = Math.sqrt(hr(slot * 3 + i, 9)) * rx * 0.9;
      const px = sx + Math.cos(an) * rr, py = sy + Math.sin(an) * rr * 0.5;
      c.strokeStyle = `rgba(190,255,180,${0.5 * (1 - f) * fade})`; c.lineWidth = 0.8 * z;
      c.beginPath(); c.ellipse(px, py, (1.5 + f * 6) * z, (0.7 + f * 3) * z, 0, 0, TAU); c.stroke();
    }
    c.restore();
    // healing motes rising around the druid
    if (Math.random() < (fx.low ? 0.2 : 0.45) * fade) {
      const an = Math.random() * TAU, rr = Math.random() * a.r * 0.5;
      fx.add({ x: a.x + Math.cos(an) * rr, y: a.y + Math.sin(an) * rr, z: 4, vz: 30 + Math.random() * 20, color: Math.random() < 0.5 ? '#9cff70' : '#d8ffc0', kind: Math.random() < 0.4 ? 'star' : 'dot', size: 1, life: 1.1, add: true });
    }
  },
  air(a, d) {
    const { c, sx, sy, rx, z, time, fx } = d;
    const fade = ease(a.t / 0.35) * (1 - ease((a.t - RENEWAL.heal) / (a.dur - RENEWAL.heal + 0.01)));
    if (fade <= 0.01) return;
    const top = 120 * z;
    c.save();
    // a faint green mist canopy the rain falls from
    c.globalCompositeOperation = 'lighter';
    glow(c, sx, sy - top, rx * 1.05, '120,210,110', 0.24 * fade, 0.35);
    glow(c, sx, sy - top + 6 * z, rx * 0.6, '190,255,170', 0.16 * fade, 0.3);
    // rain streaks
    c.strokeStyle = `rgba(170,255,170,${0.6 * fade})`; c.lineWidth = 1.1 * z; c.lineCap = 'round';
    c.beginPath();
    const n = fx.low ? 22 : 48;
    for (let i = 0; i < n; i++) {
      const f = (time * 1.9 + hr(i, 1)) % 1, slot = Math.floor(time * 1.9 + hr(i, 1));
      const an = hr(i * 13 + slot, 2) * TAU, rr = Math.sqrt(hr(i * 7 + slot, 4)) * rx * 0.95;
      const px = sx + Math.cos(an) * rr, gy = sy + Math.sin(an) * rr * 0.5;
      const y = gy - top * (1 - f);
      c.moveTo(px + 1.5 * z, y - 12 * z); c.lineTo(px, y);
    }
    c.stroke();
    // leaves drifting down
    c.globalCompositeOperation = 'source-over';
    const m = fx.low ? 3 : 6;
    for (let i = 0; i < m; i++) {
      const f = (time * 0.45 + hr(i, 11)) % 1, slot = Math.floor(time * 0.45 + hr(i, 11));
      const an = hr(i * 5 + slot, 12) * TAU, rr = Math.sqrt(hr(i * 3 + slot, 13)) * rx * 0.8;
      const px = sx + Math.cos(an) * rr + Math.sin(time * 2.5 + i) * 7 * z, gy = sy + Math.sin(an) * rr * 0.5;
      c.globalAlpha = fade * Math.min(1, (1 - f) * 4);
      leaf(c, px, gy - top * 0.9 * (1 - f), 4 * z, time * 2 + i, LEAF_COLS[i % LEAF_COLS.length], false);
    }
    c.restore();
  },
};
FX_EVENT.dr_renewalCast = (e, h) => {
  h.fx.effect('shock', e.x, e.y, 0.6, { r: (e.r ?? 3) * 1.1, c: '150,255,120' });
  h.fx.effect('dr_bloom', e.x, e.y, 1.6, { r: e.r ?? 3 });
  h.fx.burst(e.x, e.y, h.low ? 6 : 12, { color: '#b0ff80', kind: 'star', size: 1.2, speed: 1.4, up: 110, grav: 15, life: 1.3, add: true, z: 10 });
  leaves(h.fx, e.x, e.y, h.low ? 3 : 6, { speed: 2.5, up: 150, z: 60, life: 1.6 });
};
EFFECT_ART.dr_bloom = {
  // a ring of small flowers opening on the ground round the druid
  ground(e, d) {
    const { c, cam, z, k } = d;
    const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    const n = 12;
    for (let i = 0; i < n; i++) {
      const an = (i / n) * TAU + e.seed, rr = e.r * (0.55 + 0.35 * hr(i, e.seed));
      const x = cam.sxOf(e.x + Math.cos(an) * rr, e.y + Math.sin(an) * rr), y = cam.syOf(e.x + Math.cos(an) * rr, e.y + Math.sin(an) * rr);
      const open = ease((k - hr(i + 20, e.seed) * 0.25) / 0.3);
      if (open <= 0) continue;
      c.globalAlpha = a;
      leaf(c, x - 2 * z, y, 4 * z * open, Math.PI + 0.4, '#4a8a2a', false);
      leaf(c, x + 2 * z, y, 4 * z * open, -0.4, '#5aa838', false);
      c.fillStyle = i % 3 === 0 ? '#f4f0e0' : i % 3 === 1 ? '#f0a0c0' : '#e8e070';
      for (let q = 0; q < 5; q++) { const pa = (q / 5) * TAU; c.beginPath(); c.ellipse(x + Math.cos(pa) * 1.6 * z * open, y - 2 * z + Math.sin(pa) * 0.9 * z * open, 1.2 * z * open, 0.8 * z * open, pa, 0, TAU); c.fill(); }
      c.fillStyle = '#f0c040'; c.beginPath(); c.arc(x, y - 2 * z, 0.7 * z * open, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
  },
};
BUFF_ART.dr_renewal = (c, sx, sy, z, time, b, fx, h) => {
  const a = Math.min(1, b.t / 1, (b.dur - b.t) / 0.4 + 0.2);
  c.save();
  c.globalCompositeOperation = 'lighter';
  glow(c, sx, sy, 20 * z, '130,255,110', 0.2 * a, 0.5);
  // three leaves circling the druid at waist height
  c.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 3; i++) {
    const an = time * 1.6 + (i * TAU) / 3;
    const x = sx + Math.cos(an) * 15 * z, y = sy - 22 * z + Math.sin(an) * 5 * z + Math.sin(time * 3 + i) * 2 * z;
    if (Math.sin(an) < 0) c.globalAlpha = 0.45 * a; else c.globalAlpha = 0.9 * a;
    leaf(c, x, y, 4 * z, an + Math.PI / 2, LEAF_COLS[i], false);
  }
  c.restore();
  if (Math.random() < (fx.low ? 0.05 : 0.14) * a) fx.add({ x: h.x + (Math.random() - 0.5) * 0.7, y: h.y + (Math.random() - 0.5) * 0.7, z: 6 + Math.random() * 20, vz: 26, color: '#b8ff90', kind: 'dot', size: 1.1, life: 1, add: true });
};

// ================================================================== thunderstorm
/** The rolling cloud: a dark domed mass of soft puffs at height `top` over (sx,sy), lit from inside by `flash`. */
function cloud(c: C2D, sx: number, sy: number, rx: number, top: number, time: number, a: number, seed: number, low: boolean, flash: number): void {
  const cy = sy - top, ry = rx * 0.4;
  // the base mass
  const g = c.createRadialGradient(sx, cy, rx * 0.05, sx, cy, rx);
  g.addColorStop(0, `rgba(20,23,32,${0.9 * a})`); g.addColorStop(0.6, `rgba(28,32,42,${0.75 * a})`); g.addColorStop(1, 'rgba(30,34,44,0)');
  c.fillStyle = g; c.beginPath(); c.ellipse(sx, cy, rx, ry, 0, 0, TAU); c.fill();
  // rolling puffs: slow counter-rotating layers, domed in the middle, lighter on top
  const n = low ? 8 : 15;
  for (let i = 0; i < n; i++) {
    const u = hr(i, seed), v = hr(i + 40, seed);
    const an = u * TAU + time * (0.16 + v * 0.14) * (i % 2 ? 1 : -1);
    const rr = Math.sqrt(v) * 0.74;
    const px = sx + Math.cos(an) * rx * rr, py = cy + Math.sin(an) * ry * rr - (1 - rr) * ry * 0.45;
    const pr = rx * (0.2 + hr(i + 80, seed) * 0.13) * (1 + 0.07 * Math.sin(time * 1.7 + i));
    const lit = 0.5 - 0.5 * Math.sin(an);
    const r0 = Math.round(34 + lit * 34), g0 = Math.round(38 + lit * 36), b0 = Math.round(48 + lit * 42);
    const pg = c.createRadialGradient(px, py - pr * 0.25, pr * 0.05, px, py, pr);
    pg.addColorStop(0, `rgba(${r0 + 14},${g0 + 14},${b0 + 16},${0.92 * a})`); pg.addColorStop(0.6, `rgba(${r0},${g0},${b0},${0.75 * a})`); pg.addColorStop(1, `rgba(${r0},${g0},${b0},0)`);
    c.fillStyle = pg; c.beginPath(); c.ellipse(px, py, pr, pr * 0.62, 0, 0, TAU); c.fill();
    // a lit cap on top of each puff (the cloud's billowing crown)
    const cr = pr * 0.55, cyy = py - pr * 0.32;
    const cg = c.createRadialGradient(px - cr * 0.2, cyy - cr * 0.3, cr * 0.05, px, cyy, cr);
    cg.addColorStop(0, `rgba(${r0 + 60},${g0 + 62},${b0 + 66},${0.55 * a * (0.4 + lit * 0.6)})`); cg.addColorStop(1, `rgba(${r0 + 30},${g0 + 30},${b0 + 34},0)`);
    c.fillStyle = cg; c.beginPath(); c.ellipse(px, cyy, cr, cr * 0.7, 0, 0, TAU); c.fill();
  }
  // heavy dark underside
  const ug = c.createLinearGradient(0, cy, 0, cy + ry * 0.9);
  ug.addColorStop(0, `rgba(14,16,22,${0.5 * a})`); ug.addColorStop(1, 'rgba(14,16,22,0)');
  c.fillStyle = ug; c.beginPath(); c.ellipse(sx, cy + ry * 0.25, rx * 0.85, ry * 0.6, 0, 0, Math.PI); c.fill();
  // lightning lighting it from inside
  c.save(); c.globalCompositeOperation = 'lighter';
  if (flash > 0.01) glow(c, sx, cy, rx * 0.85, '150,170,255', 0.5 * flash * a, 0.42);
  // sheet lightning flickering inside the cloud at a wandering spot
  const slot = Math.floor(time * 7), fl = Math.max(0, Math.sin(time * 7 * Math.PI));
  if (hr(slot, seed) > 0.45) {
    const an = hr(slot + 3, seed) * TAU, rr = Math.sqrt(hr(slot + 5, seed)) * 0.6;
    glow(c, sx + Math.cos(an) * rx * rr, cy + Math.sin(an) * ry * rr, rx * 0.35, '170,190,255', 0.45 * fl * a, 0.55);
  }
  c.restore();
}

const stormFade = (a: { t: number; dur: number }) => ease(a.t / 0.6) * (1 - ease((a.t - a.dur + 0.7) / 0.7));

AREA_ART.dr_storm = {
  light: (a) => [a.r * 0.4 * stormFade(a), '110,125,170'],
  draw(a, d) {
    const { c, sx, sy, rx, z, time, fx } = d;
    const f = stormFade(a);
    // the storm's shadow on the floor and its rim
    c.save();
    c.translate(sx, sy); c.scale(1, 0.5);
    const g = c.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx);
    g.addColorStop(0, `rgba(8,10,18,${0.45 * f})`); g.addColorStop(0.8, `rgba(10,14,24,${0.3 * f})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill();
    c.restore();
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(140,160,230,${0.35 * f})`; c.lineWidth = 1.2 * z; c.setLineDash([6 * z, 5 * z]); c.lineDashOffset = -time * 20 * z;
    c.beginPath(); c.ellipse(sx, sy, rx, rx * 0.5, 0, 0, TAU); c.stroke();
    c.restore();
    // splashes
    if (Math.random() < (fx.low ? 0.3 : 0.8) * f) {
      const an = Math.random() * TAU, rr = Math.sqrt(Math.random()) * a.r;
      fx.add({ x: a.x + Math.cos(an) * rr, y: a.y + Math.sin(an) * rr, z: 1, vz: 40, grav: 300, color: '#a8b8d0', kind: 'drop', size: 1, life: 0.25 });
    }
  },
  air(a, d) {
    const { c, sx, sy, rx, z, time, fx } = d;
    const f = stormFade(a);
    if (f <= 0.01) return;
    const top = 118 * z;
    // rain from the cloud
    c.save();
    c.strokeStyle = `rgba(170,185,210,${0.4 * f})`; c.lineWidth = 0.9 * z; c.lineCap = 'round';
    c.beginPath();
    const n = fx.low ? 20 : 44;
    for (let i = 0; i < n; i++) {
      const fr = (time * 2.6 + hr(i, 21)) % 1, slot = Math.floor(time * 2.6 + hr(i, 21));
      const an = hr(i * 11 + slot, 22) * TAU, rr = Math.sqrt(hr(i * 5 + slot, 23)) * rx * 0.95;
      const px = sx + Math.cos(an) * rr, gy = sy + Math.sin(an) * rr * 0.5, y = gy - (top - 10 * z) * (1 - fr);
      c.moveTo(px + 3 * z, y - 13 * z); c.lineTo(px, y);
    }
    c.stroke();
    // flicker between bolts: recent strike (data.n) or a random sheet-lightning glimmer
    const since = (a.t - STORM.first) % STORM.tick;
    const flash = (a.data.n ?? 0) > 0 ? Math.max(0, 1 - since / 0.18) : 0;
    const glim = Math.max(0, Math.sin(time * 17 + a.id) * Math.sin(time * 5.3)) * 0.35;
    cloud(c, sx, sy, rx * (0.6 + 0.4 * f), top, time, f, hr(a.id, 1), fx.low, Math.max(flash, glim));
    c.restore();
  },
};

FX_EVENT.dr_stormCast = (e, h) => {
  h.fx.effect('dr_gather', e.x, e.y, 0.7, { r: e.r ?? 4 });
  h.fx.burst(e.x, e.y, h.low ? 6 : 14, { color: '#6a6a70', kind: 'smoke', size: 6, speed: 3, up: 60, life: 1.1, z: 30 });
};
EFFECT_ART.dr_gather = {
  ground(e, d) {
    const { c, sx, sy, rx, z, k } = d;
    // wind rushing inward: a dark ring contracting to the storm's heart
    const rr = rx * (1.2 - ease(k) * 0.9);
    c.strokeStyle = `rgba(30,34,44,${0.5 * (1 - k)})`; c.lineWidth = 5 * z;
    c.beginPath(); c.ellipse(sx, sy, rr, rr * 0.5, 0, 0, TAU); c.stroke();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(150,170,230,${0.4 * (1 - k)})`; c.lineWidth = 1.5 * z;
    c.beginPath(); c.ellipse(sx, sy, rr * 0.95, rr * 0.475, 0, 0, TAU); c.stroke();
  },
};

/** A forked bolt between two screen points (jagged, re-rolled a few times a second). */
function bolt(c: C2D, x0: number, y0: number, x1: number, y1: number, z: number, seed: number, a: number, low: boolean): void {
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; };
  const segs: number[][] = [];
  const main: number[] = [x0, y0];
  const n = 10, L = Math.hypot(x1 - x0, y1 - y0);
  for (let i = 1; i < n; i++) { const u = i / n; main.push(x0 + (x1 - x0) * u + rnd() * L * 0.14 * (1 - u * 0.5), y0 + (y1 - y0) * u + rnd() * L * 0.04); }
  main.push(x1, y1);
  segs.push(main);
  const nb = low ? 1 : 3;
  for (let b = 0; b < nb; b++) {
    const j = 2 + Math.floor((rnd() + 0.5) * (n - 4));
    let bx = main[j * 2], by = main[j * 2 + 1];
    const br = [bx, by];
    const dir = rnd() > 0 ? 1 : -1;
    for (let q = 0; q < 4; q++) { bx += dir * (6 + (rnd() + 0.5) * 12) * z; by += (8 + (rnd() + 0.5) * 12) * z; br.push(bx, by); }
    segs.push(br);
  }
  c.lineJoin = 'round'; c.lineCap = 'round';
  for (const [w, col] of [[20, `rgba(90,120,255,${0.28 * a})`], [8, `rgba(160,185,255,${0.65 * a})`], [3.4, `rgba(255,255,255,${a})`]] as [number, string][]) {
    c.strokeStyle = col;
    for (let si = 0; si < segs.length; si++) {
      const pts = segs[si];
      c.lineWidth = w * z * (si ? 0.55 : 1);
      c.beginPath(); c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.stroke();
    }
  }
}

FX_EVENT.dr_bolt = (e, h) => {
  const hit = (e.r ?? 1) > 0;
  h.fx.effect('dr_bolt', e.x, e.y, 0.34, { r: 1, power: hit ? 1 : 0.6, seed: Math.floor(Math.random() * 99999) });
  h.fx.effect('shock', e.x, e.y, 0.3, { r: 1.2, c: '170,190,255' });
  h.fx.stain(e.x, e.y, 'scorch', hit ? 0.45 : 0.3);
  h.fx.burst(e.x, e.y, h.low ? 5 : 12, { color: '#dfe8ff', kind: 'streak', size: 1.3, speed: 6, up: 120, grav: 250, life: 0.35, add: true, z: 4 });
  if (!h.low) h.fx.burst(e.x, e.y, 5, { color: '#3a3430', kind: 'smoke', size: 4, speed: 1, up: 40, life: 0.8, z: 6 });
};
EFFECT_ART.dr_bolt = {
  // a strike lights up the whole storm for a moment (and the bolt itself, which reaches far above the floor)
  light: (e, k) => [7.5 * Math.pow(1 - k, 1.5) * e.power, '170,190,255'],
  ground(e, d) {
    const { c, sx, sy, z, k } = d;
    c.globalCompositeOperation = 'lighter';
    glow(c, sx, sy, 30 * z * (0.6 + k * 0.6), '190,210,255', 0.8 * (1 - k) * e.power, 0.5);
  },
  air(e, d) {
    const { c, sx, sy, z, k, time } = d;
    // bright for the first frames, then a couple of after-flickers
    const a = k < 0.35 ? 1 : (Math.sin(k * 60) > 0 ? 0.7 : 0.15) * (1 - k);
    if (a <= 0.02) return;
    const top = sy - 118 * z;
    const x0 = sx + (hr(e.seed, 1) - 0.5) * 40 * z;
    c.globalCompositeOperation = 'lighter';
    bolt(c, x0, top, sx, sy - 6 * z, z, Math.floor(e.seed) + Math.floor(time * 30) * 7, a * e.power, false);
    glow(c, x0, top, 40 * z, '170,190,255', 0.6 * a * e.power, 0.5);
    glow(c, sx, sy - 10 * z, 24 * z, '220,230,255', 0.9 * a * e.power, 0.7);
  },
};
