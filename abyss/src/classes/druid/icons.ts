// druid: hand-drawn skill icons (64×64, origin at the centre) for the basic attack and all five skills.
import { SKILL_ICON } from '../../render/registry';
import { leaf } from './look';
import { wolfShape } from './vfx';

const TAU = Math.PI * 2;
type C2D = CanvasRenderingContext2D;

function thornSeed(c: C2D, x: number, y: number, s: number, rot: number): void {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  c.fillStyle = '#e4f0b0';
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; c.beginPath(); c.moveTo(Math.cos(a - 0.28) * 4.6, Math.sin(a - 0.28) * 3.6); c.lineTo(Math.cos(a) * 10.5, Math.sin(a) * 8.5); c.lineTo(Math.cos(a + 0.28) * 4.6, Math.sin(a + 0.28) * 3.6); c.fill(); }
  const g = c.createRadialGradient(-2.5, -2.5, 0.5, 0, 0, 7);
  g.addColorStop(0, '#f0ffc8'); g.addColorStop(0.4, '#76c83c'); g.addColorStop(1, '#1e3a0e');
  c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 7, 5.2, 0, 0, TAU); c.fill();
  c.strokeStyle = '#1e3a0e'; c.lineWidth = 1; c.beginPath(); c.moveTo(-5.5, 0.4); c.quadraticCurveTo(0, 2.4, 5.5, 0.4); c.stroke();
  c.restore();
}

function boltPath(c: C2D, pts: number[]): void { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); }

SKILL_ICON.dr_thorn = {
  tint: ['#4e7c2c', '#0c1606'],
  draw(c, glow) {
    // leafy trail sweeping in from the lower left
    c.save();
    const cols = ['#3e7a2a', '#5aa838', '#7ed04a', '#a8e070'];
    for (let i = 0; i < 4; i++) leaf(c, -22 + i * 7, 20 - i * 7.5, 7 - i * 0.6, -0.9 + (i % 2 ? 0.9 : -0.6), cols[i]);
    c.strokeStyle = 'rgba(170,240,110,0.55)'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-26, 24); c.quadraticCurveTo(-10, 12, 4, -4); c.stroke();
    c.restore();
    glow('#9cff5a', 14);
    thornSeed(c, 9, -9, 1.35, -0.7);
  },
};

SKILL_ICON.dr_tornado = {
  tint: ['#6a7868', '#0e120e'],
  draw(c, glow) {
    // funnel: stacked, widening wind bands leaning with the storm
    glow('#c8e0c0', 8);
    for (let i = 0; i < 8; i++) {
      const u = i / 7, y = 22 - u * 46, rx = 4 + u * 20, x = Math.sin(u * 3) * 4 + u * 3;
      c.strokeStyle = `rgba(${220 - i * 6},${235 - i * 4},${215 - i * 6},${0.95 - u * 0.25})`; c.lineWidth = 3.2 - u * 1.2;
      c.beginPath(); c.ellipse(x, y, rx, rx * 0.28, 0, 0.3 + i * 0.5, 0.3 + i * 0.5 + 4.4); c.stroke();
    }
    c.shadowBlur = 0;
    // debris and leaves caught in it
    c.fillStyle = '#5a4430'; c.fillRect(-15, -6, 4, 2); c.fillRect(13, -14, 3.5, 2); c.fillRect(8, 8, 3, 1.8);
    leaf(c, -18, -18, 7, -2.4, '#7ed04a'); leaf(c, 18, -2, 6, 0.4, '#5aa838'); leaf(c, -9, 10, 5, 2.6, '#a8e070');
    // dust at the foot
    c.fillStyle = 'rgba(140,130,110,0.6)'; c.beginPath(); c.ellipse(0, 25, 13, 4, 0, 0, TAU); c.fill();
  },
};

SKILL_ICON.dr_vines = {
  tint: ['#3a6a1c', '#060e04'],
  draw(c, glow) {
    // poison glow at the ground
    const g = c.createRadialGradient(0, 24, 2, 0, 24, 30);
    g.addColorStop(0, 'rgba(150,255,80,0.55)'); g.addColorStop(1, 'rgba(150,255,80,0)');
    c.fillStyle = g; c.fillRect(-32, -6, 64, 38);
    // three thorny vines rising and curling
    const vines: [number, number, number, number][] = [[-14, 30, -22, -18], [2, 30, 14, -24], [16, 30, 22, -4]];
    for (const [x0, y0, x1, y1] of vines) {
      const cx1 = x0 + (x1 > x0 ? -12 : 12), cy1 = y0 - 18, cx2 = x1 + (x1 > x0 ? 10 : -10), cy2 = y1 + 14;
      for (const [col, w] of [['#0e1a06', 6.5], ['#3e7a22', 4.2]] as [string, number][]) {
        c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.bezierCurveTo(cx1, cy1, cx2, cy2, x1, y1); c.stroke();
      }
      c.strokeStyle = 'rgba(180,240,120,0.6)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x0 - 1, y0); c.bezierCurveTo(cx1 - 1, cy1, cx2 - 1, cy2, x1 - 1, y1); c.stroke();
      // thorns
      c.fillStyle = '#e8e0b0';
      for (let i = 1; i < 6; i++) {
        const u = i / 6, v = 1 - u;
        const px = v * v * v * x0 + 3 * v * v * u * cx1 + 3 * v * u * u * cx2 + u * u * u * x1, py = v * v * v * y0 + 3 * v * v * u * cy1 + 3 * v * u * u * cy2 + u * u * u * y1;
        const s = i % 2 ? 1 : -1;
        c.beginPath(); c.moveTo(px - 1.6, py); c.lineTo(px + s * 5.5, py - 2.6); c.lineTo(px + 1.6, py - 1.2); c.fill();
      }
      // curled tip
      c.strokeStyle = '#3e7a22'; c.lineWidth = 2.4; c.beginPath(); c.arc(x1 + (x1 > x0 ? -3.5 : 3.5), y1, 3.5, x1 > x0 ? 0 : Math.PI, x1 > x0 ? Math.PI * 1.5 : Math.PI * 2.5); c.stroke();
    }
    leaf(c, -4, 6, 8, -2.6, '#5aa838'); leaf(c, 10, 2, 7, -0.3, '#7ed04a');
    glow('#9cff5a', 8);
    c.fillStyle = '#b8ff70';
    for (const [x, y] of [[-24, 4], [24, 14], [-6, -12], [26, -18]] as [number, number][]) { c.beginPath(); c.arc(x, y, 2, 0, TAU); c.fill(); }
  },
};

SKILL_ICON.dr_wolves = {
  tint: ['#2a6a66', '#031212'],
  draw(c, glow) {
    // a pale moon and a spirit wolf leaping across it, a second one following behind
    const mg = c.createRadialGradient(8, -8, 2, 8, -8, 20);
    mg.addColorStop(0, 'rgba(220,255,250,0.55)'); mg.addColorStop(1, 'rgba(120,235,215,0)');
    c.fillStyle = mg; c.beginPath(); c.arc(8, -8, 20, 0, TAU); c.fill();
    c.save(); c.translate(-14, 22); c.scale(1.05, 1.05); c.rotate(-0.2);
    c.globalAlpha = 0.45;
    c.fillStyle = '#78ebd7'; c.strokeStyle = '#78ebd7'; wolfShape(c, 2.2, 0);
    c.restore();
    glow('#78ebd7', 12);
    c.save(); c.translate(-2, 19); c.scale(1.5, 1.5); c.rotate(-0.28);
    c.fillStyle = 'rgba(190,255,245,1)'; c.strokeStyle = 'rgba(190,255,245,1)'; wolfShape(c, 0.9, 1.2);
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(40,150,142,1)'; c.strokeStyle = 'rgba(40,150,142,1)'; wolfShape(c, 0.9, 0);
    c.fillStyle = 'rgba(150,245,230,0.55)'; c.strokeStyle = 'rgba(150,245,230,0.55)';
    c.save(); c.translate(1.5, -1.8); c.scale(0.82, 0.62); wolfShape(c, 0.9, 0); c.restore();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(15.6, -14.2 - Math.abs(Math.cos(0.9)) * 1.8, 1.1, 0, TAU); c.fill();
    c.restore();
    // wisps trailing the leap
    c.strokeStyle = 'rgba(160,255,240,0.7)'; c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(-30, 26); c.bezierCurveTo(-24, 16, -30, 10, -22, 2); c.stroke();
    c.beginPath(); c.moveTo(-18, 30); c.bezierCurveTo(-14, 24, -20, 20, -14, 14); c.stroke();
  },
};

SKILL_ICON.dr_renewal = {
  tint: ['#4e8e3c', '#061408'],
  draw(c, glow) {
    // a big leaf cupping falling drops of light
    glow('#b0ff90', 14);
    c.save(); c.translate(0, 8); c.rotate(-0.6);
    const g = c.createLinearGradient(-24, 0, 24, 0);
    g.addColorStop(0, '#2e6a1e'); g.addColorStop(0.5, '#6ac040'); g.addColorStop(1, '#b8f080');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-24, 0); c.quadraticCurveTo(0, -18, 26, 0); c.quadraticCurveTo(0, 18, -24, 0); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = '#1e4a12'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-24, 0); c.lineTo(22, 0); c.stroke();
    c.lineWidth = 1;
    for (let i = 0; i < 4; i++) { const x = -14 + i * 9; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 6, -7); c.moveTo(x, 0); c.lineTo(x + 6, 7); c.stroke(); }
    c.restore();
    // rain drops
    glow('#d8ffc0', 8);
    c.fillStyle = '#e0ffd0';
    for (const [x, y, s] of [[-16, -22, 1], [-2, -26, 1.2], [12, -18, 1], [22, -26, 0.8], [-24, -8, 0.8], [4, -12, 0.9]] as [number, number, number][]) {
      c.beginPath(); c.moveTo(x, y - 5 * s); c.quadraticCurveTo(x + 3 * s, y, x, y + 2.5 * s); c.quadraticCurveTo(x - 3 * s, y, x, y - 5 * s); c.fill();
    }
    // a small green cross of healing
    c.fillStyle = '#ffffff'; c.fillRect(17, 12, 10, 3); c.fillRect(20.5, 8.5, 3, 10);
  },
};

SKILL_ICON.dr_storm = {
  tint: ['#4a5670', '#07080e'],
  draw(c, glow) {
    // rain under the cloud
    c.strokeStyle = 'rgba(170,190,220,0.6)'; c.lineWidth = 1.4;
    for (let i = 0; i < 7; i++) { const x = -22 + i * 7.5; c.beginPath(); c.moveTo(x + 3, 0); c.lineTo(x, 12 + (i % 3) * 4); c.stroke(); }
    // the bolt: a classic zigzag glyph, blue-white hot
    glow('#9ab4ff', 18);
    const bg = c.createLinearGradient(0, -8, 0, 30);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#bcd0ff');
    c.fillStyle = bg;
    boltPath(c, [2, -8, -7, 10, 0, 10, -6, 30, 13, 3, 5, 3, 11, -8]); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(220,230,255,0.8)'; c.lineWidth = 1.2;
    boltPath(c, [-3, 16, -12, 22, -14, 28]); c.stroke();
    c.shadowBlur = 0;
    // the dark rolling cloud
    const puffs: [number, number, number][] = [[-16, -14, 11], [-2, -20, 13], [14, -15, 11], [24, -8, 8], [-24, -6, 8], [4, -8, 12], [-10, -6, 10]];
    for (const [x, y, r] of puffs) {
      const g = c.createRadialGradient(x - r * 0.3, y - r * 0.4, 1, x, y, r);
      g.addColorStop(0, '#8a94a6'); g.addColorStop(0.6, '#4a5262'); g.addColorStop(1, '#262a34');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    c.strokeStyle = 'rgba(200,210,230,0.5)'; c.lineWidth = 1.4;
    c.beginPath(); c.arc(-2, -20, 10, Math.PI * 1.1, Math.PI * 1.8); c.stroke();
    c.beginPath(); c.arc(14, -15, 8, Math.PI * 1.15, Math.PI * 1.8); c.stroke();
    // inner flash
    const fg = c.createRadialGradient(0, -8, 0, 0, -8, 14);
    fg.addColorStop(0, 'rgba(200,215,255,0.6)'); fg.addColorStop(1, 'rgba(200,215,255,0)');
    c.fillStyle = fg; c.beginPath(); c.arc(0, -8, 14, 0, TAU); c.fill();
  },
};
