// monk: hand-drawn skill icons (64×64, origin at the centre) for the palm strike and the five skills.
import { SKILL_ICON } from '../../render/registry';
import { GOLD, GOLD_DK, GOLD_HI, knuckle } from './look';
import { figure, palmGlyph } from './vfx';

type C2D = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

function ring(c: C2D, x: number, y: number, rx: number, ry: number, rot: number, col: string, w: number): void {
  c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.stroke();
}

function goldFill(c: C2D, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, GOLD_HI); g.addColorStop(0.5, GOLD); g.addColorStop(1, GOLD_DK);
  return g;
}

/** A wrapped fist seen from the side, knuckles toward +x (icon scale). */
function iconFist(c: C2D, x: number, y: number, s: number, tier: number): void {
  c.save(); c.translate(x, y); c.scale(s, s); c.rotate(-Math.PI / 2);
  // forearm with wraps
  c.fillStyle = '#b8805a'; c.fillRect(-2.3, -9, 4.6, 8);
  c.fillStyle = '#efe6d3'; c.fillRect(-2.5, -6.5, 5, 5.5);
  c.strokeStyle = '#a89a80'; c.lineWidth = 0.35;
  for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-2.5, -6 + i * 1.8); c.lineTo(2.5, -5.2 + i * 1.8); c.stroke(); }
  c.fillStyle = '#8a5a38'; c.beginPath(); c.moveTo(-2.7, -1.4); c.lineTo(2.7, -1.4); c.lineTo(2.9, 4); c.quadraticCurveTo(0, 5.2, -2.9, 4); c.closePath(); c.fill();
  c.fillStyle = '#d9a273'; c.beginPath(); c.moveTo(-2.3, -1.2); c.lineTo(2.3, -1.2); c.lineTo(2.5, 3.6); c.quadraticCurveTo(0, 4.6, -2.5, 3.6); c.closePath(); c.fill();
  knuckle(c, tier, 0, 0.3);
  c.restore();
}

// ---- 장타: a golden palm print over a white shock ring
SKILL_ICON.mk_palm = {
  tint: ['#8a4a18', '#1a0a04'],
  draw(c, glow) {
    c.save();
    ring(c, 2, 2, 24, 10, -0.5, 'rgba(255,250,235,0.35)', 2);
    ring(c, 2, 2, 17, 7, -0.5, 'rgba(255,250,235,0.6)', 2.2);
    for (let i = 0; i < 5; i++) {
      const a = -2.2 + i * 0.35;
      c.strokeStyle = 'rgba(255,236,190,0.7)'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(Math.cos(a) * 20, Math.sin(a) * 20); c.lineTo(Math.cos(a) * 28, Math.sin(a) * 28); c.stroke();
    }
    glow('#ffb040', 16);
    c.fillStyle = goldFill(c, -14, -18, 14, 18); c.strokeStyle = c.fillStyle;
    palmGlyph(c, 1, 2, 22);
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(255,252,235,0.75)'; c.strokeStyle = 'rgba(255,252,235,0.75)';
    palmGlyph(c, 1, 2, 12);
    c.restore();
  },
};

// ---- 연환권: three fists in a blur, the last one bursting
SKILL_ICON.mk_combo = {
  tint: ['#8a3a14', '#1c0804'],
  draw(c, glow) {
    c.save();
    c.strokeStyle = 'rgba(255,236,190,0.55)'; c.lineWidth = 1.4; c.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const y = -18 + i * 7; c.beginPath(); c.moveTo(-28, y); c.lineTo(-10 + (i % 2) * 6, y); c.stroke(); }
    c.globalAlpha = 0.35; iconFist(c, -12, -12, 1.9, 0);
    c.globalAlpha = 0.6; iconFist(c, -4, 10, 1.9, 0);
    c.globalAlpha = 1;
    glow('#ffc060', 18);
    c.fillStyle = 'rgba(255,240,200,0.95)';
    c.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, r = i % 2 ? 7 : 17; c.lineTo(20 + Math.cos(a) * r, -1 + Math.sin(a) * r); }
    c.closePath(); c.fill();
    c.shadowBlur = 0;
    iconFist(c, 8, -1, 2.3, 1);
    c.restore();
  },
};

// ---- 기공파: a golden crescent wave with a palm at its heart
SKILL_ICON.mk_wave = {
  tint: ['#a06818', '#1a1004'],
  draw(c, glow) {
    c.save();
    c.strokeStyle = 'rgba(255,230,170,0.5)'; c.lineWidth = 1.5; c.lineCap = 'round';
    for (let i = 0; i < 5; i++) { const y = -16 + i * 8; c.beginPath(); c.moveTo(-28, y); c.lineTo(-14 - (i % 2) * 5, y); c.stroke(); }
    glow('#ffb040', 20);
    for (let k = 0; k < 3; k++) {
      const off = -k * 7, a = [1, 0.55, 0.3][k];
      c.fillStyle = `rgba(255,${200 + k * 12},${90 + k * 30},${a})`;
      c.beginPath(); c.moveTo(off - 2, -26); c.quadraticCurveTo(off + 26, 0, off - 2, 26); c.quadraticCurveTo(off + 12, 0, off - 2, -26); c.closePath(); c.fill();
    }
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(255,252,235,0.9)'; c.strokeStyle = 'rgba(255,252,235,0.9)';
    c.beginPath(); c.moveTo(-2, -26); c.quadraticCurveTo(24, 0, -2, 26); c.lineWidth = 1.6; c.stroke();
    c.fillStyle = goldFill(c, -14, -10, 4, 10); c.strokeStyle = c.fillStyle;
    palmGlyph(c, -4, 1, 11);
    c.restore();
  },
};

// ---- 진언: prayer hands before a golden mantra wheel
SKILL_ICON.mk_mantra = {
  tint: ['#b07a20', '#1e1206'],
  draw(c, glow) {
    c.save();
    glow('#ffc050', 14);
    c.strokeStyle = 'rgba(255,214,120,0.9)'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, -2, 24, 0, TAU); c.stroke();
    c.lineWidth = 1; c.beginPath(); c.arc(0, -2, 20, 0, TAU); c.stroke();
    c.shadowBlur = 0;
    c.strokeStyle = 'rgba(255,240,200,0.85)'; c.lineWidth = 1.3;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; c.beginPath(); c.moveTo(Math.cos(a) * 20.5, -2 + Math.sin(a) * 20.5); c.lineTo(Math.cos(a) * 23.5, -2 + Math.sin(a) * 23.5); c.stroke(); }
    // lotus petals behind the hands
    c.fillStyle = 'rgba(255,190,90,0.45)';
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.beginPath(); c.ellipse(Math.cos(a) * 11, -2 + Math.sin(a) * 11, 7, 3.4, a, 0, TAU); c.fill(); }
    // joined palms
    glow('#fff0b0', 12);
    const skin = c.createLinearGradient(-8, -20, 8, 20);
    skin.addColorStop(0, '#f2c898'); skin.addColorStop(1, '#b8784a');
    c.fillStyle = skin;
    c.beginPath(); c.moveTo(0, -21); c.quadraticCurveTo(-7, -16, -7.5, 2); c.quadraticCurveTo(-7, 12, -3, 16); c.lineTo(3, 16); c.quadraticCurveTo(7, 12, 7.5, 2); c.quadraticCurveTo(7, -16, 0, -21); c.closePath(); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = '#7a4a28'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(0, -20); c.lineTo(0, 15); c.stroke();
    c.fillStyle = '#efe6d3'; c.fillRect(-8, 14, 16, 8);
    c.strokeStyle = '#a89a80'; c.lineWidth = 0.6; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-8, 15.5 + i * 2.4); c.lineTo(8, 16.5 + i * 2.4); c.stroke(); }
    // bead string draped over the hands
    for (let i = 0; i < 7; i++) { const a = Math.PI * (0.15 + i * 0.12); c.fillStyle = i === 3 ? '#c8903e' : '#6a3a1c'; c.beginPath(); c.arc(Math.cos(a) * 9, 8 + Math.sin(a) * 5, 1.9, 0, TAU); c.fill(); }
    c.restore();
  },
};

// ---- 비연각: the flying kick silhouette, a swallow-tail streak behind it
SKILL_ICON.mk_kick = {
  tint: ['#7a4a20', '#140a04'],
  draw(c, glow) {
    c.save();
    c.strokeStyle = 'rgba(255,240,210,0.55)'; c.lineWidth = 1.5; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-30, -10 + i * 7); c.quadraticCurveTo(-18, -12 + i * 7, -8, -8 + i * 6); c.stroke(); }
    // swallow-tail streak
    c.fillStyle = 'rgba(255,190,90,0.45)';
    c.beginPath(); c.moveTo(18, -2); c.lineTo(-30, -18); c.lineTo(-20, -3); c.lineTo(-30, 12); c.closePath(); c.fill();
    glow('#ffb040', 16);
    c.translate(-2, 26); c.scale(1.05, 1.05);
    const g = c.createLinearGradient(0, -58, 0, -20);
    g.addColorStop(0, '#fff6d8'); g.addColorStop(1, '#ffb048');
    c.fillStyle = g; c.strokeStyle = g;
    figure(c, 'kick');
    c.shadowBlur = 0;
    // impact at the foot
    c.fillStyle = 'rgba(255,252,240,0.95)';
    c.beginPath(); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, r = i % 2 ? 2.4 : 7; c.lineTo(24 + Math.cos(a) * r, -34.6 + Math.sin(a) * r); } c.closePath(); c.fill();
    c.restore();
  },
};

// ---- 칠성권: the seven stars of the Dipper linked by golden strikes around a burst
SKILL_ICON.mk_seven = {
  tint: ['#6a2a12', '#12060a'],
  draw(c, glow) {
    c.save();
    const S: [number, number][] = [[-22, -12], [-12, -16], [-3, -12], [5, -6], [6, 8], [20, 10], [22, -4]];
    // afterimage fists converging on the centre
    glow('#ffb040', 10);
    c.strokeStyle = 'rgba(255,200,100,0.75)'; c.lineWidth = 2.4; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); S.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.lineTo(S[3][0], S[3][1]); c.stroke();
    c.strokeStyle = 'rgba(255,250,235,0.9)'; c.lineWidth = 0.9; c.stroke();
    c.shadowBlur = 0;
    // stars
    for (const [i, [x, y]] of S.entries()) {
      glow('#fff0b0', 8);
      c.fillStyle = i === 3 ? '#ffffff' : '#ffe6a0';
      const r = i === 3 ? 6 : 4.2;
      c.beginPath(); for (let j = 0; j < 8; j++) { const a = (j / 8) * TAU + 0.2, rr = j % 2 ? r * 0.3 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill();
    }
    c.shadowBlur = 0;
    // a golden dragon fist driving up into the constellation, bursting on the bowl star
    c.save(); c.translate(-8, 16); c.rotate(-0.6);
    c.strokeStyle = 'rgba(255,220,150,0.6)'; c.lineWidth = 1.3; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const y = -4 + i * 4; c.beginPath(); c.moveTo(-30, y); c.lineTo(-16 + (i % 2) * 3, y); c.stroke(); }
    glow('#ffb040', 12);
    iconFist(c, 0, 0, 2.3, 3);
    c.restore();
    c.shadowBlur = 0;
    glow('#fff4c8', 14);
    c.fillStyle = 'rgba(255,252,240,0.95)';
    c.beginPath(); for (let j = 0; j < 16; j++) { const a = (j / 16) * TAU + 0.1, rr = j % 2 ? 2.2 : 8.5; c.lineTo(5 + Math.cos(a) * rr, 7 + Math.sin(a) * rr); } c.closePath(); c.fill();
    c.shadowBlur = 0;
    c.restore();
  },
};
