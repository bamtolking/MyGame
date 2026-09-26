// paladin: hand-drawn skill icons (64×64, origin at the centre).
import { SKILL_ICON } from '../../render/registry';
import { emblem, shieldFace } from './look';
import { hammerShape, holyStar, runeRing } from './vfx';

const TAU = Math.PI * 2;
type C2D = CanvasRenderingContext2D;

function rays(c: C2D, x: number, y: number, r0: number, r1: number, n: number, col: string, w: number, rot = 0): void {
  c.strokeStyle = col; c.lineWidth = w;
  c.beginPath();
  for (let i = 0; i < n; i++) { const a = rot + (i / n) * TAU, rr = i % 2 ? r1 * 0.7 : r1; c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.stroke();
}

function softGlow(c: C2D, x: number, y: number, r: number, col: string, a = 1): void {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,252,236,${a})`); g.addColorStop(0.35, `rgba(${col},${a * 0.7})`); g.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}

/** Golden crescent slash: centre (x,y), radius r, from a0 to a1. */
function crescent(c: C2D, x: number, y: number, r: number, a0: number, a1: number, th: number): void {
  const g = c.createLinearGradient(x + Math.cos(a0) * r, y + Math.sin(a0) * r, x + Math.cos(a1) * r, y + Math.sin(a1) * r);
  g.addColorStop(0, 'rgba(255,190,70,0)'); g.addColorStop(0.55, 'rgba(255,205,100,0.95)'); g.addColorStop(1, '#fffdf2');
  c.fillStyle = g;
  c.beginPath();
  const n = 18;
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  for (let i = n; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / n, w = th * Math.sin((i / n) * Math.PI * 0.9 + 0.1); c.lineTo(x + Math.cos(a) * (r - w), y + Math.sin(a) * (r - w)); }
  c.closePath(); c.fill();
}

/**
 * A flanged war mace drawn along +y from the grip (origin): pommel, leather grip, gilded collar, steel haft and a
 * six-flanged head seen from the side. `len` = grip to head centre.
 */
function flangedMace(c: C2D, len: number, s = 1, hs = s): void {
  const steel = (x0: number, x1: number) => { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#fbf6ea'); g.addColorStop(0.45, '#c9ccd4'); g.addColorStop(1, '#5d6070'); return g; };
  // haft
  c.fillStyle = steel(-1.6 * s, 1.6 * s); c.fillRect(-1.5 * s, -2 * s, 3 * s, len - 4 * s);
  // grip wrap + pommel
  c.fillStyle = '#5a3418'; c.fillRect(-1.9 * s, -9 * s, 3.8 * s, 9 * s);
  c.strokeStyle = '#2e1a0a'; c.lineWidth = 0.7 * s;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-1.9 * s, (-8 + i * 2.2) * s); c.lineTo(1.9 * s, (-7 + i * 2.2) * s); c.stroke(); }
  const gold = c.createLinearGradient(-3 * s, 0, 3 * s, 0); gold.addColorStop(0, '#fff2b8'); gold.addColorStop(0.5, '#e2b44a'); gold.addColorStop(1, '#7a5418');
  c.fillStyle = gold; c.beginPath(); c.arc(0, -10.5 * s, 2.6 * s, 0, TAU); c.fill();
  c.fillRect(-2.8 * s, -0.5 * s, 5.6 * s, 2 * s);
  // collar under the head
  c.fillRect(-2.6 * hs, len - 9 * hs, 5.2 * hs, 2.2 * hs);
  // head: six flanges (three visible each side) around a core
  const hy = len;
  c.fillStyle = steel(-7 * hs, 7 * hs);
  c.beginPath(); c.ellipse(0, hy, 3.4 * hs, 7 * hs, 0, 0, TAU); c.fill();
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const y0 = hy - 6.5 * hs + i * 1.2 * hs, y1 = hy + 6.5 * hs - (2 - i) * 1.2 * hs, out = (7.8 - i * 1.6) * hs * side;
    c.fillStyle = i === 0 ? (side < 0 ? '#f2eee2' : '#6a6e7c') : i === 1 ? (side < 0 ? '#d8dbe2' : '#8a8e9a') : '#b6bac4';
    c.beginPath(); c.moveTo(side * 1.5 * hs, y0); c.quadraticCurveTo(out, y0 + 1.5 * hs, out, hy); c.quadraticCurveTo(out, y1 - 1.5 * hs, side * 1.5 * hs, y1); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(30,30,40,0.55)'; c.lineWidth = 0.5 * hs; c.stroke();
  }
  // gilded crown and finial on the head
  c.fillStyle = gold; c.fillRect(-3 * hs, hy - 8.6 * hs, 6 * hs, 1.8 * hs); c.fillRect(-3 * hs, hy + 6.8 * hs, 6 * hs, 1.8 * hs);
  c.beginPath(); c.moveTo(-1.6 * hs, hy + 8.6 * hs); c.lineTo(0, hy + 12 * hs); c.lineTo(1.6 * hs, hy + 8.6 * hs); c.fill();
  // a small cross engraved on the core
  c.fillStyle = '#fff6d0'; c.fillRect(-0.45 * hs, hy - 3 * hs, 0.9 * hs, 6 * hs); c.fillRect(-1.8 * hs, hy - 1.4 * hs, 3.6 * hs, 0.9 * hs);
}

SKILL_ICON.pl_strike = {
  tint: ['#5e4a30', '#0e0a06'],
  draw(c, glow) {
    // a flanged mace crashing down onto a burst of holy light
    c.save();
    c.globalCompositeOperation = 'lighter';
    softGlow(c, 12, 14, 22, '255,200,90', 0.8);
    c.restore();
    c.save(); glow('#ffd070', 8); rays(c, 12, 14, 8, 24, 14, '#ffe6a0', 2, 0.2); c.restore();
    // impact cracks
    c.save(); c.strokeStyle = 'rgba(40,24,8,0.7)'; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(12, 16); c.lineTo(22, 22); c.lineTo(27, 21); c.moveTo(12, 16); c.lineTo(6, 26); c.moveTo(12, 16); c.lineTo(24, 11); c.stroke(); c.restore();
    c.save();
    glow('rgba(0,0,0,0.85)', 6);
    c.translate(-18, -20); c.rotate(-0.72);
    flangedMace(c, 30, 1, 1.45);
    c.restore();
    c.save(); c.globalCompositeOperation = 'lighter'; holyStar(c, 13, 15, 8, 1);
    c.fillStyle = '#fff0c0'; for (const [x, y] of [[24, 4], [28, 14], [4, 24], [20, 26]] as [number, number][]) { c.beginPath(); c.arc(x, y, 1.1, 0, TAU); c.fill(); }
    c.restore();
  },
};

SKILL_ICON.pl_zeal = {
  tint: ['#7a2416', '#140402'],
  draw(c, glow) {
    // three quick blows: stacked golden crescents cut by a flanged mace, with sparks
    c.save();
    glow('#ffb640', 10);
    crescent(c, -7, -8, 22, -2.8, -1.05, 7);
    crescent(c, 3, 1, 22, -2.6, -0.8, 7.5);
    crescent(c, 12, 10, 22, -2.4, -0.55, 8);
    c.restore();
    c.save();
    glow('rgba(0,0,0,0.8)', 5);
    c.translate(-22, 22); c.rotate(-2.35);
    flangedMace(c, 24, 0.8, 1.05);
    c.restore();
    c.save();
    c.globalCompositeOperation = 'lighter';
    holyStar(c, 23, 5, 6, 1); holyStar(c, 13, -4, 4.5, 0.9); holyStar(c, 3, -13, 3.5, 0.8);
    c.fillStyle = '#ffe6a0';
    for (const [x, y] of [[26, 16], [27, -4], [18, 22], [-8, -24]] as [number, number][]) { c.beginPath(); c.arc(x, y, 1.1, 0, TAU); c.fill(); }
    c.restore();
  },
};

SKILL_ICON.pl_hammer = {
  tint: ['#a8822a', '#1a1204'],
  draw(c, glow) {
    // spiral trail
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.lineWidth = 3;
    for (let i = 0; i < 40; i++) {
      const t0 = i / 40, t1 = (i + 1) / 40;
      const a0 = 1.2 + t0 * TAU * 1.4, a1 = 1.2 + t1 * TAU * 1.4, r0 = 4 + t0 * 22, r1 = 4 + t1 * 22;
      c.strokeStyle = `rgba(255,214,120,${0.12 + t0 * 0.75})`;
      c.beginPath(); c.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0 * 0.8); c.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1 * 0.8); c.stroke();
    }
    softGlow(c, 0, -2, 22, '255,205,100', 0.8);
    c.restore();
    c.save();
    glow('#ffd070', 12);
    c.translate(0, 2);
    hammerShape(c, -0.55, 2.2, false);
    c.restore();
    c.save(); c.globalCompositeOperation = 'lighter'; holyStar(c, -6, -8, 5, 0.9); c.restore();
  },
};

SKILL_ICON.pl_aura = {
  tint: ['#b0842a', '#1c1204'],
  draw(c, glow) {
    // rune circle on the ground
    c.save();
    c.translate(0, 14); c.scale(1, 0.45);
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(0, 0, 4, 0, 0, 27);
    g.addColorStop(0, 'rgba(255,210,110,0.1)'); g.addColorStop(0.85, 'rgba(255,210,110,0.4)'); g.addColorStop(1, 'rgba(255,210,110,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 27, 0, TAU); c.fill();
    c.strokeStyle = '#ffe0a0'; c.lineWidth = 2.2; c.beginPath(); c.arc(0, 0, 25, 0, TAU); c.stroke();
    c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 19, 0, TAU); c.stroke();
    runeRing(c, 22, 0.3, 12, 1.8, '#fff0c0', 1);
    c.restore();
    // flames rising along the ring
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + 0.3, x = Math.cos(a) * 25, y = 14 + Math.sin(a) * 11, h = 7 + (i % 3) * 3;
      const fg = c.createLinearGradient(x, y - h, x, y);
      fg.addColorStop(0, 'rgba(255,160,60,0)'); fg.addColorStop(1, 'rgba(255,200,90,0.85)');
      c.fillStyle = fg; c.beginPath(); c.moveTo(x - 2.2, y); c.quadraticCurveTo(x - 1, y - h * 0.6, x, y - h); c.quadraticCurveTo(x + 1, y - h * 0.6, x + 2.2, y); c.fill();
    }
    softGlow(c, 0, -6, 24, '255,200,90', 0.8);
    c.restore();
    c.save(); glow('#ffd070', 10); emblem(c, 0, -6, 9, 4, 0.2, 0.2); c.restore();
  },
};

SKILL_ICON.pl_charge = {
  tint: ['#3e4c68', '#080a12'],
  draw(c, glow) {
    // speed streaks
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const y = -20 + i * 7, len = 18 + ((i * 7) % 5) * 4;
      const g = c.createLinearGradient(-30, 0, -30 + len, 0);
      g.addColorStop(0, 'rgba(255,214,120,0)'); g.addColorStop(1, 'rgba(255,230,160,0.8)');
      c.strokeStyle = g; c.lineWidth = i % 2 ? 1.5 : 2.5;
      c.beginPath(); c.moveTo(-30, y); c.lineTo(-30 + len, y); c.stroke();
    }
    softGlow(c, 16, 0, 20, '255,200,90', 0.9);
    c.restore();
    // burst ahead of the shield
    rays(c, 18, 0, 10, 26, 10, 'rgba(255,236,170,0.9)', 2, 0.15);
    c.save(); glow('rgba(0,0,0,0.7)', 6); c.translate(4, 1); c.rotate(0.12); shieldFace(c, 2, 0, 2.05); c.restore();
  },
};

SKILL_ICON.pl_judgment = {
  tint: ['#caa650', '#241804'],
  draw(c, glow) {
    // seal on the ground
    c.save();
    c.translate(0, 18); c.scale(1, 0.4);
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = '#ffe6a8'; c.lineWidth = 2.4; c.beginPath(); c.arc(0, 0, 27, 0, TAU); c.stroke();
    c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 20, 0, TAU); c.stroke();
    c.beginPath();
    for (let i = 0; i <= 7; i++) { const a = ((i * 3) % 7) / 7 * TAU - Math.PI / 2; const x = Math.cos(a) * 20, y = Math.sin(a) * 20; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.stroke();
    c.restore();
    // pillars of light falling from the sky
    c.save(); c.globalCompositeOperation = 'lighter';
    const beams: [number, number, number][] = [[-17, 4, 0.55], [15, 5, 0.6], [-6, 6, 0.8], [6, 7, 0.75], [0, 10, 1]];
    for (const [x, w, a] of beams) {
      const g = c.createLinearGradient(0, -32, 0, 20);
      g.addColorStop(0, 'rgba(255,240,190,0)'); g.addColorStop(0.6, `rgba(255,230,160,${0.55 * a})`); g.addColorStop(1, `rgba(255,252,236,${a})`);
      c.fillStyle = g; c.fillRect(x - w / 2, -32, w, 50);
      const g2 = c.createRadialGradient(x, 18, 0, x, 18, w * 1.6);
      g2.addColorStop(0, `rgba(255,252,236,${a})`); g2.addColorStop(1, 'rgba(255,210,110,0)');
      c.fillStyle = g2; c.beginPath(); c.ellipse(x, 18, w * 1.6, w * 0.7, 0, 0, TAU); c.fill();
    }
    c.restore();
    c.save(); glow('#fff0c0', 12); holyStar(c, 0, -18, 7, 1); c.restore();
  },
};
