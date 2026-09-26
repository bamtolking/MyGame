// lancer: hand-drawn skill icons (64×64, origin at the centre) for all six skills.
import { SKILL_ICON } from '../../render/registry';
import { drawLance } from './look';

type C2D = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/** A lance centred at (x,y), pointing along `rot` (0 = up, clockwise), scaled by s. */
function lance(c: C2D, x: number, y: number, rot: number, s: number, tier: number, charge = 0): void {
  c.save(); c.translate(x, y); c.rotate(rot + Math.PI); c.translate(0, -11 * s);
  drawLance(c, tier, s, { charge, t: 0.3 });
  c.restore();
}

function bolt(c: C2D, pts: number[], w: number, col: string): void {
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.strokeStyle = 'rgba(90,150,255,0.45)'; c.lineWidth = w * 3; c.stroke();
  c.strokeStyle = col; c.lineWidth = w; c.stroke();
  c.strokeStyle = '#ffffff'; c.lineWidth = w * 0.4; c.stroke();
}

function star(c: C2D, x: number, y: number, r: number, col: string): void {
  c.fillStyle = col;
  c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.18, y - r * 0.18); c.lineTo(x + r, y); c.lineTo(x + r * 0.18, y + r * 0.18); c.lineTo(x, y + r); c.lineTo(x - r * 0.18, y + r * 0.18); c.lineTo(x - r, y); c.lineTo(x - r * 0.18, y - r * 0.18); c.closePath(); c.fill();
}

// ---- basic: a straight thrust with speed lines
SKILL_ICON.ln_thrust = {
  tint: ['#2e4c7a', '#0a1222'],
  draw(c, glow) {
    c.strokeStyle = 'rgba(190,225,255,0.55)'; c.lineWidth = 1.6;
    for (const o of [-7, 0, 7]) { c.beginPath(); c.moveTo(-26 + o * 0.7, 10 + o * 0.7 + 8); c.lineTo(-6 + o * 0.7, -10 + o * 0.7 + 8); c.stroke(); }
    lance(c, -2, 2, Math.PI / 4, 0.95, 1);
    glow('#bfe4ff', 12);
    star(c, 21, -21, 9, '#eaf6ff');
    c.shadowBlur = 0;
  },
};

// ---- piercing thrust: a beam skewering a line of foes
SKILL_ICON.ln_pierce = {
  tint: ['#3a66ac', '#081020'],
  draw(c, glow) {
    c.rotate(-0.35);
    // targets on the line
    for (const x of [-12, 2, 16]) {
      c.fillStyle = 'rgba(10,14,26,0.85)'; c.beginPath(); c.ellipse(x, 0, 5.2, 9, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(10,14,26,0.85)'; c.beginPath(); c.arc(x, -11, 3.6, 0, TAU); c.fill();
    }
    glow('#8ad8ff', 14);
    const g = c.createLinearGradient(-30, 0, 30, 0);
    g.addColorStop(0, 'rgba(120,190,255,0)'); g.addColorStop(0.6, 'rgba(160,215,255,0.85)'); g.addColorStop(1, '#ffffff');
    c.fillStyle = g; c.beginPath(); c.moveTo(-30, -1.5); c.lineTo(22, -3.6); c.lineTo(31, 0); c.lineTo(22, 3.6); c.lineTo(-30, 1.5); c.closePath(); c.fill();
    c.shadowBlur = 0;
    // sonic rings
    c.strokeStyle = 'rgba(220,240,255,0.8)'; c.lineWidth = 1.4;
    for (const [x, r] of [[-5, 7], [9, 9.5], [22, 12]] as [number, number][]) { c.beginPath(); c.ellipse(x, 0, r * 0.3, r, 0, 0, TAU); c.stroke(); }
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(20, -5); c.lineTo(31, 0); c.lineTo(20, 5); c.closePath(); c.fill();
  },
};

// ---- whirling spear: the lance spinning at the centre of a full-circle gust
SKILL_ICON.ln_sweep = {
  tint: ['#35597f', '#0a1420'],
  draw(c, glow) {
    // wind swirl
    c.strokeStyle = 'rgba(170,210,255,0.35)'; c.lineWidth = 1.3;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(0, 0, 8 + i * 5, i * 1.7, i * 1.7 + 1.9); c.stroke(); }
    glow('#9ad0ff', 12);
    // two crescents chasing each other round the circle
    for (const rot of [0, Math.PI]) {
      c.save(); c.rotate(rot);
      const R = 25;
      c.beginPath(); c.arc(0, 0, R, -2.9, -0.4); c.arc(0, 0, R - 6, -0.4, -2.9, true); c.closePath();
      const g = c.createLinearGradient(-R, 0, R, -R * 0.5);
      g.addColorStop(0, 'rgba(120,180,255,0)'); g.addColorStop(1, 'rgba(235,248,255,0.95)');
      c.fillStyle = g; c.fill();
      c.restore();
    }
    c.shadowBlur = 0;
    // the lance across the middle, mid-spin
    lance(c, 0, 0, Math.PI * 0.62, 0.8, 2, 0.3);
    c.fillStyle = '#eaf6ff'; c.beginPath(); c.arc(0, 0, 2, 0, TAU); c.fill();
  },
};

// ---- lightning javelin: a spear coiled in lightning; bolts leap from its head to two more foes
/** Dark bust of a foe (head and shoulders) centred at (x,y). */
function foe(c: C2D, x: number, y: number, s: number): void {
  c.fillStyle = 'rgba(5,8,20,0.92)';
  c.beginPath(); c.arc(x, y - 6 * s, 3.8 * s, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(x - 7.5 * s, y + 6 * s); c.quadraticCurveTo(x - 6.5 * s, y - 2 * s, x, y - 2 * s); c.quadraticCurveTo(x + 6.5 * s, y - 2 * s, x + 7.5 * s, y + 6 * s); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(150,210,255,0.55)'; c.lineWidth = 0.8; c.stroke();
}

SKILL_ICON.ln_javelin = {
  tint: ['#4a6cbc', '#0a0e24'],
  draw(c, glow) {
    foe(c, -17, -19, 0.85); foe(c, 22, 8, 0.85);
    // speed lines behind the throw
    c.strokeStyle = 'rgba(190,225,255,0.45)'; c.lineWidth = 1.3; c.lineCap = 'round';
    for (const o of [-6, 0, 6]) { c.beginPath(); c.moveTo(-30 + o, 18 + o); c.lineTo(-18 + o, 6 + o); c.stroke(); }
    glow('#8ad8ff', 12);
    // the two arcs leaping from the spearhead
    bolt(c, [11, -15, 5, -20, 0, -16, -6, -22, -12, -21], 1.3, '#cdeeff');
    bolt(c, [15, -11, 20, -6, 16, -2, 21, 1], 1.3, '#cdeeff');
    c.shadowBlur = 0;
    // the javelin (tip at about (14,-14))
    lance(c, -4, 4, Math.PI * 0.25, 0.8, 3, 1);
    // lightning coiled round the shaft
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round';
    const pts: number[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, bx = -20 + 30 * t, by = 20 - 30 * t, w = Math.sin(t * Math.PI * 4.5) * (2.5 + (i % 2) * 0.6);
      pts.push(bx + 0.707 * w, by + 0.707 * w);
    }
    bolt(c, pts, 0.75, '#bfe8ff');
    c.restore();
    glow('#ffffff', 12);
    star(c, 14, -14, 7.5, '#ffffff');
    c.shadowBlur = 0;
  },
};

/** A bat-like dragon wing (side = 1 right, -1 left) spread from (x,y). */
function wing(c: C2D, x: number, y: number, side: number, s: number): void {
  const tips: [number, number][] = [[27, -20], [29, -6], [25, 5], [17, 10]];
  c.beginPath(); c.moveTo(x, y);
  c.quadraticCurveTo(x + side * 10 * s, y - 16 * s, x + side * tips[0][0] * s, y + tips[0][1] * s);
  for (let i = 1; i < tips.length; i++) {
    const [px, py] = tips[i - 1], [tx, ty] = tips[i];
    c.quadraticCurveTo(x + side * (px + tx) * 0.42 * s, y + (py + ty) * 0.5 * s + 2 * s, x + side * tx * s, y + ty * s);
  }
  c.quadraticCurveTo(x + side * 8 * s, y + 6 * s, x, y + 4 * s);
  c.closePath();
  const g = c.createLinearGradient(x, y, x + side * 28 * s, y - 10 * s);
  g.addColorStop(0, 'rgba(60,110,200,0.95)'); g.addColorStop(1, 'rgba(20,40,90,0.9)');
  c.fillStyle = g; c.fill();
  c.strokeStyle = 'rgba(170,215,255,0.9)'; c.lineWidth = 1; c.stroke();
  c.strokeStyle = 'rgba(170,215,255,0.55)'; c.lineWidth = 0.8;
  for (const [tx, ty] of tips) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + side * tx * s, y + ty * s); c.stroke(); }
}

// ---- dragon's descent: the lance plunging point-down between dragon wings, lightning bursting below
SKILL_ICON.ln_dragon = {
  tint: ['#2c4c8e', '#060a1a'],
  draw(c, glow) {
    // speed lines from the sky
    c.strokeStyle = 'rgba(200,230,255,0.45)'; c.lineWidth = 1.2;
    for (const x of [-22, -12, 12, 22]) { c.beginPath(); c.moveTo(x, -30); c.lineTo(x, -6 - Math.abs(x) * 0.2); c.stroke(); }
    wing(c, -1, -8, -1, 0.92); wing(c, 1, -8, 1, 0.92);
    // impact burst
    glow('#8ad8ff', 16);
    c.strokeStyle = '#cfeeff'; c.lineWidth = 2;
    for (let i = 0; i < 7; i++) { const a = Math.PI + (i / 6) * Math.PI; c.beginPath(); c.moveTo(Math.cos(a) * 7, 23 + Math.sin(a) * 3); c.lineTo(Math.cos(a) * 21, 23 + Math.sin(a) * 9); c.stroke(); }
    c.fillStyle = 'rgba(200,236,255,0.9)'; c.beginPath(); c.ellipse(0, 24, 13, 4.5, 0, 0, TAU); c.fill();
    c.shadowBlur = 0;
    glow('#bfe4ff', 9);
    lance(c, 0, 0, Math.PI, 0.9, 3, 0.8);
    c.shadowBlur = 0;
  },
};

// ---- storm thrusts: a fan of eight thrusts and the lightning wave
SKILL_ICON.ln_storm = {
  tint: ['#3a5ca4', '#080c1e'],
  draw(c, glow) {
    const ox = -24, oy = 10;
    glow('#8ad8ff', 10);
    for (let i = 0; i < 8; i++) {
      const a = -0.95 + (i / 7) * 0.9, L = 30 + (i % 3) * 5;
      const x1 = ox + Math.cos(a) * L, y1 = oy + Math.sin(a) * L;
      const g = c.createLinearGradient(ox, oy, x1, y1);
      g.addColorStop(0, 'rgba(140,200,255,0)'); g.addColorStop(1, 'rgba(240,250,255,0.95)');
      c.strokeStyle = g; c.lineWidth = 2; c.beginPath(); c.moveTo(ox, oy); c.lineTo(x1, y1); c.stroke();
      c.fillStyle = '#ffffff'; c.save(); c.translate(x1, y1); c.rotate(a); c.beginPath(); c.moveTo(3.5, 0); c.lineTo(-3, -1.8); c.lineTo(-3, 1.8); c.closePath(); c.fill(); c.restore();
    }
    // the wave
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(90,150,255,0.5)'; c.lineWidth = 7; c.beginPath(); c.arc(-8, 0, 34, -0.75, 0.6); c.stroke();
    c.strokeStyle = '#dff4ff'; c.lineWidth = 2.4; c.stroke();
    c.shadowBlur = 0;
    bolt(c, [24, -24, 20, -16, 26, -8, 22, 0, 27, 8, 22, 18], 1.1, '#eaf8ff');
  },
};
