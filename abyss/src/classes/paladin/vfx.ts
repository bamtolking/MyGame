// paladin: skill visuals — the spinning blessed hammer, the aura's rune ring, the judgment seal and its
// pillars of light, strike flashes, charge dust/impact, and the aura buff glow (render/registry hooks).
import { RX, screenDir } from '../../render/iso';
import { AREA_ART, BUFF_ART, EFFECT_ART, FX_EVENT, PROJ_ART, type FxHost } from '../../render/registry';
import { JUDGMENT } from './shared';

const TAU = Math.PI * 2;
const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const G = { gold: '#ffd46a', pale: '#fff2c4', white: '#fffbee', amber: '#ffb24a', dust: '#8e7c60' };

// ------------------------------------------------------------------ shared drawing
/** A ring of small runes laid flat on the ground. Call inside a (1, 0.5)-scaled, centred transform. */
export function runeRing(c: CanvasRenderingContext2D, R: number, rot: number, n: number, size: number, col: string, lw: number): void {
  c.strokeStyle = col; c.lineWidth = lw;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU, px = Math.cos(a) * R, py = Math.sin(a) * R;
    const tx = -Math.sin(a), ty = Math.cos(a), nx = Math.cos(a), ny = Math.sin(a);
    const s = size;
    switch (i % 4) {
      case 0: // ᛏ-like
        c.moveTo(px - nx * s, py - ny * s); c.lineTo(px + nx * s, py + ny * s);
        c.moveTo(px + nx * s, py + ny * s); c.lineTo(px + nx * s * 0.3 + tx * s * 0.7, py + ny * s * 0.3 + ty * s * 0.7);
        c.moveTo(px + nx * s, py + ny * s); c.lineTo(px + nx * s * 0.3 - tx * s * 0.7, py + ny * s * 0.3 - ty * s * 0.7);
        break;
      case 1: // diamond
        c.moveTo(px + nx * s, py + ny * s); c.lineTo(px + tx * s * 0.6, py + ty * s * 0.6); c.lineTo(px - nx * s, py - ny * s); c.lineTo(px - tx * s * 0.6, py - ty * s * 0.6); c.closePath();
        break;
      case 2: // cross
        c.moveTo(px - nx * s, py - ny * s); c.lineTo(px + nx * s, py + ny * s);
        c.moveTo(px - tx * s * 0.6, py - ty * s * 0.6); c.lineTo(px + tx * s * 0.6, py + ty * s * 0.6);
        break;
      default: // ᚱ-like hook
        c.moveTo(px - nx * s, py - ny * s); c.lineTo(px + nx * s, py + ny * s);
        c.lineTo(px + tx * s * 0.7, py + ty * s * 0.7); c.lineTo(px - tx * s * 0.2, py - ty * s * 0.2); c.lineTo(px - nx * s + tx * s * 0.7, py - ny * s + ty * s * 0.7);
    }
  }
  c.stroke();
}

function flatCircle(c: CanvasRenderingContext2D, r: number): void { c.beginPath(); c.arc(0, 0, Math.max(0.1, r), 0, TAU); }

/** A 4-point holy star (long vertical ray). */
export function holyStar(c: CanvasRenderingContext2D, x: number, y: number, s: number, a: number): void {
  c.fillStyle = `rgba(255,251,238,${a})`;
  c.beginPath(); c.moveTo(x, y - s * 1.6); c.lineTo(x + s * 0.13, y - s * 0.13); c.lineTo(x + s, y); c.lineTo(x + s * 0.13, y + s * 0.13); c.lineTo(x, y + s * 1.1); c.lineTo(x - s * 0.13, y + s * 0.13); c.lineTo(x - s, y); c.lineTo(x - s * 0.13, y - s * 0.13); c.closePath(); c.fill();
}

function glowDisc(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a: number, rx = 1, ry = 1): void {
  if (a <= 0 || r <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,252,236,${a})`); g.addColorStop(0.3, `rgba(${col},${a * 0.6})`); g.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r * rx, r * ry, 0, 0, TAU); c.fill();
}

// ------------------------------------------------------------------ blessed hammer
export function hammerShape(c: CanvasRenderingContext2D, ang: number, k: number, ghost: boolean): void {
  c.save(); c.rotate(ang); c.scale(k, k);
  if (ghost) {
    c.fillStyle = 'rgba(255,215,120,1)';
    c.fillRect(-7, -6.5, 14, 6); c.fillRect(-1.1, -1, 2.2, 12);
    c.restore(); return;
  }
  // haft
  c.fillStyle = '#6e4e2a'; c.fillRect(-1.2, -1, 2.4, 12);
  c.fillStyle = '#a07a44'; c.fillRect(-1.2, -1, 0.8, 12);
  c.fillStyle = '#e2b44a'; c.fillRect(-1.5, 3.5, 3, 1.2); c.fillRect(-1.5, 7.5, 3, 1.2);
  c.beginPath(); c.arc(0, 12, 1.8, 0, TAU); c.fill();
  // head
  const g = c.createLinearGradient(0, -7, 0, 0);
  g.addColorStop(0, '#fff6cc'); g.addColorStop(0.45, '#e8bc52'); g.addColorStop(1, '#8a6420');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(-7, -6); c.lineTo(-5.8, -7); c.lineTo(5.8, -7); c.lineTo(7, -6); c.lineTo(7, -0.4); c.lineTo(5.8, 0.4); c.lineTo(-5.8, 0.4); c.lineTo(-7, -0.4); c.closePath(); c.fill();
  c.strokeStyle = '#6a4a14'; c.lineWidth = 0.5; c.stroke();
  // striking faces and the cross on the cheek
  c.fillStyle = '#fff0b8'; c.fillRect(-7.6, -5.6, 1.2, 5); c.fillRect(6.4, -5.6, 1.2, 5);
  c.fillStyle = '#fffdf0'; c.fillRect(-0.5, -6.2, 1, 5.4); c.fillRect(-2.2, -4.3, 4.4, 1);
  c.restore();
}

PROJ_ART.pl_hammer = {
  light: [3, '255,214,130'],
  trail: ['255,210,110', 9],
  draw(p, d) {
    const { c, z, sx, sy, time, fx } = d;
    const spin = time * 17 + p.id * 1.7;
    const fadeIn = Math.min(1, p.age / 0.12);
    c.save(); c.translate(sx, sy);
    c.globalCompositeOperation = 'lighter';
    const pulse = 0.85 + 0.15 * Math.sin(time * 30 + p.id);
    glowDisc(c, 0, 0, 26 * z * pulse * fadeIn, '255,200,90', 0.8 * fadeIn);
    for (const [back, al] of [[0.6, 0.16], [0.3, 0.32]] as [number, number][]) { c.globalAlpha = al * fadeIn; hammerShape(c, spin - back, z * 1.5, true); }
    c.globalAlpha = fadeIn; c.globalCompositeOperation = 'source-over';
    hammerShape(c, spin, z * 1.5, false);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 * fadeIn;
    holyStar(c, 0, -2 * z, 7 * z * pulse, 0.8);
    c.restore();
    if (Math.random() < (fx.low ? 0.2 : 0.65)) {
      fx.add({ x: p.x + (Math.random() - 0.5) * 0.3, y: p.y + (Math.random() - 0.5) * 0.3, z: 18 + (Math.random() - 0.5) * 12, vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.5) * 1.2, vz: 15 + Math.random() * 25, color: Math.random() < 0.5 ? G.pale : G.gold, kind: Math.random() < 0.5 ? 'glint' : 'spark', size: 0.9 + Math.random() * 0.6, life: 0.35 + Math.random() * 0.2, add: true });
    }
  },
};

// ------------------------------------------------------------------ holy aura ring (follows the hero)
AREA_ART.pl_auraRing = {
  draw(a, d) {
    const { c, z, sx, sy, time, fx } = d;
    const fade = Math.min(1, a.t / 0.45) * Math.max(0, Math.min(1, (a.dur - a.t) / 1.2));
    if (fade <= 0) return;
    const since = a.tick - a.tickT;                        // seconds since the last burn tick
    const flash = Math.max(0, 1 - since / 0.28);
    const R = d.rx * (0.92 + 0.08 * ease(a.t / 0.45));
    c.translate(sx, sy); c.scale(1, 0.5);
    c.globalCompositeOperation = 'lighter';
    // soft glowing band just inside the rim (a stroke, not a full disc: far fewer pixels to blend)
    c.strokeStyle = `rgba(255,205,100,${(0.1 + 0.1 * flash) * fade})`; c.lineWidth = R * 0.16; flatCircle(c, R * 0.9); c.stroke();
    c.strokeStyle = `rgba(255,215,120,${(0.12 + 0.12 * flash) * fade})`; c.lineWidth = R * 0.07; flatCircle(c, R * 0.94); c.stroke();
    c.strokeStyle = `rgba(255,214,120,${(0.55 + 0.35 * flash) * fade})`; c.lineWidth = 2.4 * z; flatCircle(c, R * 0.97); c.stroke();
    c.strokeStyle = `rgba(255,236,170,${0.4 * fade})`; c.lineWidth = 1 * z; flatCircle(c, R * 0.83); c.stroke();
    runeRing(c, R * 0.9, time * 0.35, 20, R * 0.042, `rgba(255,228,150,${(0.6 + 0.3 * flash) * fade})`, 1.1 * z);
    // inner counter-rotating sunburst
    c.strokeStyle = `rgba(255,220,140,${0.18 * fade})`; c.lineWidth = 1.2 * z;
    c.beginPath();
    for (let i = 0; i < 16; i++) { const an = -time * 0.5 + (i / 16) * TAU; c.moveTo(Math.cos(an) * R * 0.3, Math.sin(an) * R * 0.3); c.lineTo(Math.cos(an) * R * (i % 2 ? 0.55 : 0.68), Math.sin(an) * R * (i % 2 ? 0.55 : 0.68)); }
    c.stroke();
    c.strokeStyle = `rgba(255,230,160,${0.3 * fade})`; c.lineWidth = 1 * z; flatCircle(c, R * 0.3); c.stroke();
    // holy flames licking up from the ring
    const n = fx.low ? 0.25 : 0.9 + flash * 2;
    for (let i = 0; i < 3; i++) {
      if (Math.random() > n / 3) continue;
      const an = Math.random() * TAU, rr = a.r * (0.93 + Math.random() * 0.08);
      fx.add({ x: a.x + Math.cos(an) * rr, y: a.y + Math.sin(an) * rr, z: 2, vz: 40 + Math.random() * 40, grav: -20, color: Math.random() < 0.55 ? '#ffd070' : '#ff9a3a', kind: 'ember', size: 1.4 + Math.random() * 1.2, life: 0.45 + Math.random() * 0.3, add: true });
    }
  },
  light(a) {
    const fade = Math.min(1, a.t / 0.45) * Math.max(0, Math.min(1, (a.dur - a.t) / 1.2));
    return fade > 0 ? [2.4 * fade, '255,205,120'] : null;
  },
};

// ------------------------------------------------------------------ judgment seal
const JUDG_END = JUDGMENT.first + JUDGMENT.every * (JUDGMENT.n - 1);
function sealFade(t: number, dur: number): number {
  if (t < JUDG_END + 0.2) return 1;
  return Math.max(0, 1 - (t - JUDG_END - 0.2) / Math.max(0.1, dur - JUDG_END - 0.2));
}
AREA_ART.pl_judgment = {
  draw(a, d) {
    const { c, z, sx, sy, time } = d;
    const ap = Math.min(1, a.t / 0.22);
    const pop = ap < 1 ? 0.55 + 0.55 * ease(ap) : 1.1 - 0.1 * Math.min(1, (a.t - 0.22) / 0.2);
    const fade = sealFade(a.t, a.dur) * Math.min(1, ap * 2);
    if (fade <= 0) return;
    const R = d.rx * pop;
    const lit = a.data.n ?? 0;
    const rot = time * 0.25 + a.id;
    c.translate(sx, sy); c.scale(1, 0.5);
    // a faint dark underlay makes the gold read on bright floors
    c.fillStyle = `rgba(20,12,0,${0.25 * fade})`; flatCircle(c, R); c.fill();
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, `rgba(255,236,170,${0.25 * fade})`); g.addColorStop(0.6, `rgba(255,200,90,${0.08 * fade})`); g.addColorStop(0.97, `rgba(255,220,130,${0.3 * fade})`); g.addColorStop(1, 'rgba(255,220,130,0)');
    c.fillStyle = g; flatCircle(c, R); c.fill();
    c.strokeStyle = `rgba(255,222,140,${0.85 * fade})`; c.lineWidth = 2.6 * z; flatCircle(c, R * 0.98); c.stroke();
    c.lineWidth = 1 * z; flatCircle(c, R * 0.91); c.stroke();
    flatCircle(c, R * 0.74); c.stroke();
    runeRing(c, R * 0.825, -rot * 0.6, 24, R * 0.035, `rgba(255,236,170,${0.75 * fade})`, 1 * z);
    // heptagram through seven nodes; a node lights up as its pillar falls
    const nodes: [number, number][] = [];
    for (let i = 0; i < 7; i++) { const an = rot + (i / 7) * TAU - Math.PI / 2; nodes.push([Math.cos(an) * R * 0.62, Math.sin(an) * R * 0.62]); }
    c.strokeStyle = `rgba(255,226,150,${0.55 * fade})`; c.lineWidth = 1.2 * z;
    c.beginPath(); for (let i = 0; i <= 7; i++) { const [x, y] = nodes[(i * 3) % 7]; if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke();
    for (let i = 0; i < 7; i++) {
      const [x, y] = nodes[i];
      const on = i < lit;
      c.strokeStyle = `rgba(255,236,170,${(on ? 0.95 : 0.5) * fade})`; c.lineWidth = 1.2 * z;
      c.beginPath(); c.arc(x, y, R * 0.07, 0, TAU); c.stroke();
      if (on) { glowDisc(c, x, y, R * 0.16, '255,210,110', 0.9 * fade); }
    }
    // centre sun
    glowDisc(c, 0, 0, R * 0.28, '255,210,110', 0.5 * fade);
    c.strokeStyle = `rgba(255,240,190,${0.6 * fade})`; c.lineWidth = 1.2 * z;
    c.beginPath(); for (let i = 0; i < 12; i++) { const an = -rot + (i / 12) * TAU; c.moveTo(Math.cos(an) * R * 0.12, Math.sin(an) * R * 0.12); c.lineTo(Math.cos(an) * R * (i % 2 ? 0.22 : 0.3), Math.sin(an) * R * (i % 2 ? 0.22 : 0.3)); } c.stroke();
  },
  air(a, d) {
    // light pouring down on the seal from the heavens
    const { c, z, sx, sy } = d;
    const fade = sealFade(a.t, a.dur) * Math.min(1, a.t / 0.25);
    if (fade <= 0) return;
    const R = d.rx, top = sy - 520 * z;
    c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(0, top, 0, sy);
    g.addColorStop(0, 'rgba(255,230,160,0)'); g.addColorStop(0.7, `rgba(255,225,150,${0.07 * fade})`); g.addColorStop(1, `rgba(255,236,180,${0.16 * fade})`);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(sx - R * 0.45, top); c.lineTo(sx + R * 0.45, top); c.lineTo(sx + R, sy); c.lineTo(sx - R, sy); c.closePath(); c.fill();
  },
  light(a) {
    const f = sealFade(a.t, a.dur) * Math.min(1, a.t / 0.25);
    return f > 0 ? [3.6 * f, '255,230,160'] : null;
  },
};

// ------------------------------------------------------------------ timed effects
/** Pillar of light slamming down (air) with an impact ring (ground). */
EFFECT_ART.pl_pillar = {
  ground(e, d) {
    const { c, z, sx, sy, k, rx } = d;
    const ek = 1 - Math.pow(1 - k, 3);
    c.translate(sx, sy); c.scale(1, 0.5); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx * 1.4);
    g.addColorStop(0, `rgba(255,250,225,${0.85 * (1 - k)})`); g.addColorStop(0.4, `rgba(255,210,110,${0.4 * (1 - k)})`); g.addColorStop(1, 'rgba(255,200,90,0)');
    c.fillStyle = g; flatCircle(c, rx * 1.4); c.fill();
    c.strokeStyle = `rgba(255,236,170,${0.9 * (1 - k)})`; c.lineWidth = 3 * z * (1 - k) + 0.5;
    flatCircle(c, rx * (0.35 + 1.25 * ek)); c.stroke();
  },
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const fall = Math.min(1, k / 0.09);
    const top = sy - 620 * z, bot = top + (sy - top) * fall;
    const wide = (k < 0.12 ? 1 : Math.max(0, 1 - (k - 0.12) / 0.88)) * e.r;
    const W = 30 * z * wide;
    if (W <= 0.2) return;
    c.globalCompositeOperation = 'lighter';
    // soft outer shaft
    const hg = c.createLinearGradient(sx - W, 0, sx + W, 0);
    hg.addColorStop(0, 'rgba(255,200,90,0)'); hg.addColorStop(0.5, `rgba(255,214,120,${0.55 * wide})`); hg.addColorStop(1, 'rgba(255,200,90,0)');
    c.fillStyle = hg; c.fillRect(sx - W, top, W * 2, bot - top);
    // bright core fading toward the sky
    const vg = c.createLinearGradient(0, top, 0, bot);
    vg.addColorStop(0, 'rgba(255,250,230,0)'); vg.addColorStop(0.55, `rgba(255,250,230,${0.7 * wide})`); vg.addColorStop(1, `rgba(255,255,245,${wide})`);
    c.fillStyle = vg; c.fillRect(sx - W * 0.28, top, W * 0.56, bot - top);
    if (fall >= 1) {
      glowDisc(c, sx, sy - 10 * z, 42 * z * (1 - k * 0.6), '255,210,110', 0.9 * (1 - k), 1.2, 0.8);
      if (k < 0.35) holyStar(c, sx, sy - 14 * z, 18 * z * (1 - k), 1 - k / 0.35);
    }
  },
  light(e, k) { return k < 0.8 ? [3.4 * (1 - k), '255,238,190'] : null; },
};

/** Holy cross-star flash at a struck enemy. */
EFFECT_ART.pl_cross = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const s = 16 * z * e.r * (0.6 + 0.6 * ease(Math.min(1, k * 2)));
    c.globalCompositeOperation = 'lighter';
    glowDisc(c, sx, sy - 22 * z, s * 1.4, '255,205,100', 0.7 * (1 - k));
    holyStar(c, sx, sy - 22 * z, s, 0.95 * (1 - k));
  },
  light(e, k) { return k < 0.6 ? [1.4 * e.r * (1 - k), '255,220,140'] : null; },
};

/** Zeal: a golden crescent blooming outward from the strike direction, studded with glints. */
EFFECT_ART.pl_arc = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const R = e.r * RX * z;
    const sd = screenDir(e.ang);
    const base = Math.atan2(sd.dy / 0.55, sd.dx);
    const grow = ease(Math.min(1, k / 0.35)), fade = k < 0.35 ? 1 : 1 - (k - 0.35) / 0.65;
    const span = 2.5 * (0.35 + 0.65 * grow);
    const a0 = base - span / 2, a1 = base + span / 2;
    const th = R * 0.3 * (0.6 + 0.4 * fade);
    c.translate(sx, sy - 24 * z); c.scale(1, 0.55);
    c.globalCompositeOperation = 'lighter';
    c.beginPath();
    const n = 20;
    for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; c.lineTo(Math.cos(a) * R, Math.sin(a) * R); }
    for (let i = n; i >= 0; i--) { const t = i / n, a = a0 + (a1 - a0) * t, w = th * Math.sin(Math.PI * t); c.lineTo(Math.cos(a) * (R - w), Math.sin(a) * (R - w)); }
    c.closePath();
    const g = c.createRadialGradient(0, 0, R * 0.55, 0, 0, R);
    g.addColorStop(0, 'rgba(255,190,70,0)'); g.addColorStop(0.7, `rgba(255,196,80,${0.65 * fade})`); g.addColorStop(1, `rgba(255,248,215,${0.95 * fade})`);
    c.fillStyle = g; c.fill();
    c.strokeStyle = `rgba(255,236,170,${0.9 * fade})`; c.lineWidth = 1.6 * z;
    c.beginPath(); c.arc(0, 0, R, a0, a1); c.stroke();
    c.scale(1, 1 / 0.55);
    for (let i = 0; i < 3; i++) {
      const a = base + (i - 1) * span * 0.36;
      holyStar(c, Math.cos(a) * R, Math.sin(a) * R * 0.55, (3.5 + (i === 1 ? 2.5 : 0)) * z * (0.5 + grow * 0.7), fade * 0.9);
    }
  },
  light(e, k) { return k < 0.5 ? [1.6 * (1 - k * 2), '255,214,120'] : null; },
};

/** Small golden ring flaring outward (hammer strikes, hammer cast). */
EFFECT_ART.pl_ring = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const ek = 1 - Math.pow(1 - k, 2);
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(255,226,150,${0.9 * (1 - k)})`; c.lineWidth = 2.2 * z * (1 - k) + 0.4;
    const r = (5 + 20 * ek) * z * e.r;
    c.beginPath(); c.ellipse(sx, sy - 18 * z, r, r * 0.55, 0, 0, TAU); c.stroke();
    glowDisc(c, sx, sy - 18 * z, 14 * z * e.r * (1 - k), '255,210,110', 0.8 * (1 - k));
  },
};

/** Golden rings rising around the paladin when the aura is raised. */
EFFECT_ART.pl_auraRise = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    c.globalCompositeOperation = 'lighter';
    const col = c.createLinearGradient(0, sy - 120 * z, 0, sy);
    col.addColorStop(0, 'rgba(255,220,130,0)'); col.addColorStop(1, `rgba(255,220,130,${0.22 * (1 - k)})`);
    c.fillStyle = col; c.fillRect(sx - 22 * z, sy - 120 * z, 44 * z, 120 * z);
    c.lineWidth = 1.8 * z;
    for (let i = 0; i < 3; i++) {
      const kk = (k * 1.6 + i / 3) % 1;
      c.strokeStyle = `rgba(255,228,150,${(1 - kk) * (1 - k) * 0.9})`;
      c.beginPath(); c.ellipse(sx, sy - kk * 90 * z, (30 - kk * 12) * z, (13 - kk * 5) * z, 0, 0, TAU); c.stroke();
    }
  },
  light(e, k) { return [2.4 * (1 - k), '255,215,130']; },
};

/** Light spearing up from the raised weapon (judgment cast). */
EFFECT_ART.pl_upbeam = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const w = 8 * z * (1 - k), base = sy - 92 * z, top = base - 620 * z;
    if (w <= 0.2) return;
    c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(0, top, 0, base);
    g.addColorStop(0, 'rgba(255,240,190,0)'); g.addColorStop(1, `rgba(255,248,220,${0.9 * (1 - k)})`);
    c.fillStyle = g; c.fillRect(sx - w / 2, top, w, base - top);
    c.fillStyle = `rgba(255,214,120,${0.25 * (1 - k)})`; c.fillRect(sx - w * 1.6, top, w * 3.2, base - top);
    glowDisc(c, sx, base, 22 * z * (1 - k * 0.5), '255,214,120', 0.9 * (1 - k));
  },
  light(e, k) { return [2.6 * (1 - k), '255,230,160']; },
};

/** A big white-gold flash on the ground and in the air. */
EFFECT_ART.pl_flash = {
  ground(e, d) {
    const { c, sx, sy, k, rx } = d;
    c.globalCompositeOperation = 'lighter';
    c.translate(sx, sy); c.scale(1, 0.5);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx * 1.15);
    g.addColorStop(0, `rgba(255,250,228,${0.9 * (1 - k)})`); g.addColorStop(0.5, `rgba(255,214,120,${0.45 * (1 - k)})`); g.addColorStop(1, 'rgba(255,200,90,0)');
    c.fillStyle = g; flatCircle(c, rx * 1.15); c.fill();
  },
  air(e, d) {
    const { c, z, sx, sy, k, rx } = d;
    c.globalCompositeOperation = 'lighter';
    glowDisc(c, sx, sy - 26 * z, Math.max(24 * z, rx * 0.7), '255,214,120', 0.6 * (1 - k) * (1 - k), 1, 0.8);
  },
  light(e, k) { return [e.r * 2.2 * (1 - k), '255,236,180']; },
};

/** Golden afterimage of the charging paladin. */
EFFECT_ART.pl_afterglow = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(sx, sy - 58 * z, sx, sy);
    g.addColorStop(0, 'rgba(255,214,120,0)'); g.addColorStop(0.45, `rgba(255,214,120,${0.8 * (1 - k)})`); g.addColorStop(1, `rgba(255,236,170,${0.25 * (1 - k)})`);
    c.fillStyle = g; c.beginPath(); c.ellipse(sx, sy - 27 * z, 13 * z, 30 * z, 0, 0, TAU); c.fill();
  },
};

// ------------------------------------------------------------------ fx events from the simulation
const dirOf = (e: { x: number; y: number; x2?: number; y2?: number }, away = true): { x: number; y: number } => {
  const dx = (e.x - (e.x2 ?? e.x)) * (away ? 1 : -1), dy = (e.y - (e.y2 ?? e.y)) * (away ? 1 : -1), l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
};
const n = (h: FxHost, v: number) => (h.low ? Math.ceil(v / 2) : v);

FX_EVENT.pl_smite = (e, h) => {
  h.fx.effect('pl_cross', e.x, e.y, 0.18, { r: 0.55 });
  h.fx.burst(e.x, e.y, n(h, 6), { dir: dirOf(e), spread: 1.8, color: G.pale, kind: 'glint', size: 1.2, speed: 3, up: 70, life: 0.35, add: true, z: 24 });
};

FX_EVENT.pl_zeal = (e, h) => {
  const last = (e.n ?? 0) >= 2;
  h.fx.effect('pl_cross', e.x, e.y, last ? 0.3 : 0.22, { r: last ? 1.05 : 0.8 });
  h.fx.burst(e.x, e.y, n(h, 8), { dir: dirOf(e), spread: 1.5, color: G.gold, kind: 'streak', size: 1.3, speed: 7, up: 90, grav: 180, life: 0.35, add: true, z: 24, drag: 3 });
  h.fx.burst(e.x, e.y, n(h, 6), { color: G.pale, kind: 'star', size: 1.2, speed: 1.6, up: 80, grav: 30, life: 0.6, add: true, z: 26 });
  if (last) h.fx.effect('shock', e.x, e.y, 0.3, { r: 1.2, c: '255,215,120' });
};

FX_EVENT.pl_zealArc = (e, h) => {
  h.fx.effect('pl_arc', e.x, e.y, 0.26, { ang: Math.atan2((e.y2 ?? e.y) - e.y, (e.x2 ?? e.x + 1) - e.x), r: e.r ?? 1.5 });
};

FX_EVENT.pl_hammerCast = (e, h) => {
  h.fx.effect('pl_ring', e.x, e.y, 0.32, { r: 1.2 });
  h.fx.burst(e.x, e.y, n(h, 10), { color: G.gold, kind: 'star', size: 1.3, speed: 2.5, up: 80, grav: 40, life: 0.6, add: true, z: 20 });
};

FX_EVENT.pl_hammerHit = (e, h) => {
  h.fx.effect('pl_ring', e.x, e.y, 0.25, { r: 0.8 });
  h.fx.effect('pl_cross', e.x, e.y, 0.16, { r: 0.5 });
  h.fx.burst(e.x, e.y, n(h, 6), { dir: dirOf(e), spread: 2, color: G.pale, kind: 'streak', size: 1.2, speed: 6, up: 80, grav: 160, life: 0.3, add: true, z: 20 });
  h.fx.burst(e.x, e.y, n(h, 3), { color: G.gold, kind: 'glint', size: 1.3, speed: 2, up: 60, life: 0.3, add: true, z: 22 });
};

FX_EVENT.pl_auraCast = (e, h) => {
  const r = e.r ?? 2.6;
  h.fx.effect('shock', e.x, e.y, 0.6, { r: r * 1.1, c: '255,215,120' });
  h.fx.effect('pl_auraRise', e.x, e.y, 1.1);
  h.fx.burst(e.x, e.y, n(h, 20), { color: G.gold, kind: 'star', size: 1.3, speed: 2.6, up: 120, grav: 20, life: 1.1, add: true, z: 6 });
  for (let i = 0; i < n(h, 18); i++) {
    const a = (i / 18) * TAU;
    h.fx.add({ x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r, z: 2, vz: 60 + Math.random() * 60, grav: -20, color: i % 2 ? '#ffd070' : '#ff9a3a', kind: 'ember', size: 2, life: 0.7, add: true });
  }
};

FX_EVENT.pl_auraBurn = (e, h) => {
  h.fx.burst(e.x, e.y, n(h, 5), { color: Math.random() < 0.5 ? '#ffc860' : '#ff9a40', kind: 'ember', size: 1.8, speed: 0.8, up: 90, grav: -30, life: 0.6, add: true, z: 12 });
};

FX_EVENT.pl_chargeTrail = (e, h) => {
  const d = dirOf(e);
  h.fx.effect('pl_afterglow', e.x, e.y, 0.26);
  for (let i = 0; i < (h.low ? 1 : 3); i++) {
    h.fx.add({ x: e.x + (Math.random() - 0.5) * 0.5, y: e.y + (Math.random() - 0.5) * 0.5, z: 2 + Math.random() * 3, vx: -d.x * 1.5 + (Math.random() - 0.5), vy: -d.y * 1.5 + (Math.random() - 0.5), vz: 12, color: G.dust, kind: 'smoke', size: 4 + Math.random() * 2, life: 0.7 });
    h.fx.add({ x: e.x + (Math.random() - 0.5) * 0.6, y: e.y + (Math.random() - 0.5) * 0.6, z: 8 + Math.random() * 40, vx: -d.x * 9, vy: -d.y * 9, color: i % 2 ? G.gold : G.pale, kind: 'streak', size: 1.2, life: 0.22, add: true });
  }
  if (!h.low) h.fx.add({ x: e.x, y: e.y, z: 20 + Math.random() * 20, vx: -d.x * 2 + (Math.random() - 0.5) * 2, vy: -d.y * 2 + (Math.random() - 0.5) * 2, vz: 30, color: G.gold, kind: 'spark', size: 1.3, life: 0.5, add: true });
};

FX_EVENT.pl_chargeHit = (e, h) => {
  const d = dirOf(e, false);
  h.fx.effect('pl_ring', e.x, e.y, 0.25, { r: 0.9 });
  h.fx.burst(e.x, e.y, n(h, 10), { dir: d, spread: 1.4, color: '#fff0c0', kind: 'streak', size: 1.4, speed: 8, up: 100, grav: 220, life: 0.35, add: true, z: 22, drag: 2 });
  h.fx.burst(e.x, e.y, n(h, 4), { color: G.gold, kind: 'glint', size: 1.3, speed: 2, up: 60, life: 0.3, add: true, z: 24 });
};

FX_EVENT.pl_chargeImpact = (e, h) => {
  const r = e.r ?? 1.3, hit = (e.n ?? 0) > 0;
  h.fx.effect('shock', e.x, e.y, 0.45, { r: r * 1.7, c: '255,220,140' });
  h.fx.effect('dust', e.x, e.y, 0.7, { r: r * 1.2 });
  h.fx.effect('pl_flash', e.x, e.y, 0.3, { r: r * 0.9 });
  if (hit) h.fx.effect('pl_cross', e.x, e.y, 0.32, { r: 1.3 });
  h.fx.stain(e.x, e.y, 'crack', r * 0.6);
  h.fx.burst(e.x, e.y, n(h, 12), { color: G.dust, kind: 'smoke', size: 5, speed: r * 2.2, up: 20, life: 0.9, z: 4 });
  h.fx.burst(e.x, e.y, n(h, 8), { color: '#5a4c3a', kind: 'shard', size: 1.8, speed: r * 2.5, up: 140, grav: 320, life: 0.8, z: 4 });
  h.fx.burst(e.x, e.y, n(h, 14), { color: G.gold, kind: 'star', size: 1.3, speed: 3, up: 110, grav: 60, life: 0.8, add: true, z: 12 });
};

FX_EVENT.pl_judgmentCast = (e, h) => {
  h.fx.effect('pl_upbeam', e.x, e.y, 0.6);
  h.fx.burst(e.x, e.y, n(h, 12), { color: G.pale, kind: 'star', size: 1.4, speed: 1.2, up: 160, grav: -20, life: 0.9, add: true, z: 60 });
  if (e.x2 !== undefined && e.y2 !== undefined) h.fx.effect('shock', e.x2, e.y2, 0.5, { r: e.r ?? 3, c: '255,235,170' });
};

FX_EVENT.pl_pillar = (e, h) => {
  const r = e.r ?? 1;
  h.fx.effect('pl_pillar', e.x, e.y, 0.6, { r });
  h.fx.burst(e.x, e.y, n(h, 14), { color: G.white, kind: 'streak', size: 1.3, speed: 3.5, up: 260, grav: 200, life: 0.5, add: true, z: 4 });
  h.fx.burst(e.x, e.y, n(h, 8), { color: G.gold, kind: 'glint', size: 1.4, speed: 3, up: 80, life: 0.4, add: true, z: 14 });
  h.fx.burst(e.x, e.y, n(h, 5), { color: '#b8a888', kind: 'smoke', size: 4, speed: 1.8, up: 30, life: 0.8, z: 4 });
  h.fx.stain(e.x, e.y, 'scorch', r * 0.4);
};

FX_EVENT.pl_judgmentEnd = (e, h) => {
  const r = e.r ?? 3;
  h.fx.effect('shock', e.x, e.y, 0.7, { r: r * 1.35, c: '255,236,170' });
  h.fx.effect('pl_flash', e.x, e.y, 0.45, { r });
  h.fx.effect('dust', e.x, e.y, 0.8, { r: r * 0.95 });
  h.fx.burst(e.x, e.y, n(h, 30), { color: G.pale, kind: 'star', size: 1.5, speed: 3.5, up: 170, grav: 40, life: 1.2, add: true, z: 8 });
};

// ------------------------------------------------------------------ aura buff: soft light + rising motes
BUFF_ART.pl_aura = (c, sx, sy, z, time, b, fx, hero) => {
  const fade = Math.min(1, (b.dur - b.t) / 0.5) * Math.min(1, b.t / 1.2);
  if (fade <= 0) return;
  c.save(); c.globalCompositeOperation = 'lighter';
  const pulse = 0.8 + 0.2 * Math.sin(time * 3);
  const g = c.createRadialGradient(sx, sy - 28 * z, 0, sx, sy - 28 * z, 36 * z);
  g.addColorStop(0, `rgba(255,226,140,${0.2 * fade * pulse})`); g.addColorStop(1, 'rgba(255,200,90,0)');
  c.fillStyle = g; c.beginPath(); c.ellipse(sx, sy - 28 * z, 26 * z, 40 * z, 0, 0, TAU); c.fill();
  c.restore();
  if (Math.random() < (fx.low ? 0.12 : 0.4) * fade) {
    fx.add({ x: hero.x + (Math.random() - 0.5) * 1.3, y: hero.y + (Math.random() - 0.5) * 1.3, z: 2 + Math.random() * 16, vz: 26 + Math.random() * 26, grav: -4, color: Math.random() < 0.6 ? G.gold : G.white, kind: Math.random() < 0.5 ? 'star' : 'spark', size: 0.9 + Math.random() * 0.7, life: 1 + Math.random() * 0.6, add: true });
  }
};

