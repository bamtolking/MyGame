// paladin: hand-drawn skill icons (64×64, origin at the centre).
import { drawWeapon } from '../../render/actors';
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

SKILL_ICON.pl_strike = {
  tint: ['#5e4a30', '#0e0a06'],
  draw(c, glow) {
    // a mace crashing down with a burst of holy light
    c.save();
    c.globalCompositeOperation = 'lighter';
    softGlow(c, 14, 15, 18, '255,200,90', 0.75);
    c.restore();
    c.save(); glow('#ffd070', 8); rays(c, 14, 15, 9, 20, 12, '#ffe6a0', 2.2, 0.2); c.restore();
    c.save();
    glow('rgba(0,0,0,0.85)', 5);
    c.translate(-24, -24); c.rotate(-Math.PI / 4);
    drawWeapon(c, 'mace', 0, 0, 0, 3, '#e8e4dc', undefined, 1.55);
    c.restore();
    c.save(); c.globalCompositeOperation = 'lighter'; holyStar(c, 15, 16, 7, 1); c.restore();
  },
};

SKILL_ICON.pl_zeal = {
  tint: ['#7a2416', '#140402'],
  draw(c, glow) {
    // three quick strikes: stacked golden crescents with sparks
    c.save();
    glow('#ffb640', 10);
    crescent(c, -9, -6, 21, -2.75, -1.05, 7);
    crescent(c, 1, 3, 21, -2.55, -0.8, 7.5);
    crescent(c, 10, 12, 21, -2.35, -0.55, 8);
    c.restore();
    c.save();
    c.globalCompositeOperation = 'lighter';
    holyStar(c, 21, 6, 6, 1); holyStar(c, 11, -3, 4.5, 0.9); holyStar(c, 1, -12, 3.5, 0.8);
    c.fillStyle = '#ffe6a0';
    for (const [x, y] of [[24, 16], [26, -2], [17, 20], [-20, -18]] as [number, number][]) { c.beginPath(); c.arc(x, y, 1.1, 0, TAU); c.fill(); }
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
