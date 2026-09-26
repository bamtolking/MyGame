// 무녀: white 고깔 hood with paper flowers, red robe, 색동 rainbow sleeves, bells and a fan.
import { type Ctx, INK, vol, circle, line, inkLine, shade } from '../core.ts';
import { type ClassLook, type Pal, pose, WALK } from '../rig.ts';

const PAL: Pal = { robe: '#cf3148', lining: '#f7f2e8', sash: '#f2c84b', pants: '#efe6d6', shoe: '#8a2030', skin: '#ffe3cc', hair: '#1a1320', iris: '#c24c4c', cuff: '#f7f2e8' };
const SAEKDONG = ['#e0344d', '#f2c84b', '#3fb07a', '#4a7bd8', '#f7f2e8', '#b04ad8'];
function bells(c: Ctx): void {
  inkLine(c, [0, 0, 0, -9], '#6a4a2a', 2); for (const [x, y] of [[0, -12], [-3.4, -10.5], [3.4, -10.5], [-2, -14.5], [2, -14.5], [0, -17]]) { circle(c, x, y, 2.4); vol(c, '#f2c84b', x - 2, y - 2, x + 2, y + 2, 1.1); }
  inkLine(c, [1, 0, 5, 8], '#e0344d', 1.4); inkLine(c, [-1, 0, -3, 9], '#4a7bd8', 1.4);
}
function fan(c: Ctx, open: number): void {
  const spread = 0.6 + open * 1.5; c.save(); c.rotate(-0.4 - open * 0.8);
  c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 15, -Math.PI / 2 - spread / 2, -Math.PI / 2 + spread / 2); c.closePath();
  const g = c.createRadialGradient(0, 0, 3, 0, 0, 15); g.addColorStop(0, '#f7f2e8'); g.addColorStop(0.55, '#f2c84b'); g.addColorStop(0.8, '#e0344d'); g.addColorStop(1, '#4a7bd8'); c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
  for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 - spread / 2 + (spread * i) / 5; line(c, [0, 0, Math.cos(a) * 14, Math.sin(a) * 14], 'rgba(18,12,28,0.5)', 0.8); }
  c.restore();
}
export const shaman: ClassLook = {
  pal: PAL,
  frames: {

    idle0: pose({ armF: 0.35, armB: 0.2 }), idle1: pose({ bob: 1, armF: 0.4, armB: 0.25, step: 0.4 }), blink: pose({ eyes: 'blink', armF: 0.35, armB: 0.2 }),
    walk0: pose(WALK(-1.6, 0.5, 1)), walk1: pose(WALK(0, 0.05, 0)), walk2: pose(WALK(-1.6, -0.5, -1)), walk3: pose(WALK(0, -0.05, 0)),
    atk0: pose({ lean: -0.08, armF: -2.7, armB: 1.0, extra: 0.4, eyes: 'fierce', step: -0.6 }),
    atk1: pose({ lean: 0.18, bob: 1, armF: 1.3, armB: -0.7, extra: 1, eyes: 'fierce', legF: 0.4, legB: -0.3, step: 1 }),
    atk2: pose({ lean: 0.08, armF: 0.7, armB: -0.2, extra: 1, eyes: 'fierce', step: 0.5 }),
    hurt: pose({ lean: -0.28, bob: 1.5, armF: -1, armB: -1.2, eyes: 'hurt' }),
  },
  hairBack: false,
  back: (c, P, p) => { c.beginPath(); c.moveTo(-10, -44); c.quadraticCurveTo(-19, -20, -13 - p.step * 2, -4); c.lineTo(-6, -8); c.quadraticCurveTo(-9, -24, -3, -40); c.closePath(); vol(c, P.hair, -18, -44, -4, -4); inkLine(c, [-14 - p.step * 2, -6, -18 - p.step * 3, 6], '#e0344d', 2.2); },
  sleeve: (c, _P, back) => {
    c.beginPath(); c.moveTo(-5, -1); c.lineTo(5, -1); c.lineTo(5.5, 13); c.lineTo(-5.5, 13); c.closePath(); c.save(); c.clip();
    SAEKDONG.forEach((col, i) => { c.fillStyle = back ? shade(col, -0.3) : col; c.fillRect(-7, -1 + i * 2.4, 14, 2.4); }); c.restore();
    c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
  },
  torso: (c, _P, _p, sw) => { for (let i = 0; i < 5; i++) { const col = ['#4a7bd8', '#e0344d', '#f2c84b', '#f7f2e8', '#1c1726'][i]; inkLine(c, [-4 + i * 2.2, -6, -6 + i * 2.6 - sw * (1 + i * 0.3), 12 + i * 1.5], col, 2); } },
  hat: (c, _P, p, hx, hy, R) => {
    // 고깔 white peaked hood with paper flowers, long ribbons
    c.beginPath(); c.moveTo(hx - R - 1, hy + 2); c.quadraticCurveTo(hx - 13, hy - 20, hx + 5, hy - 42); c.quadraticCurveTo(hx + 16, hy - 18, hx + R + 1, hy + 1); c.quadraticCurveTo(hx + 2, hy - 8, hx - R - 1, hy + 2); c.closePath();
    vol(c, '#f7f4ee', hx - R, hy - 42, hx + R, hy, 2, INK, 0.1, -0.22);
    for (const k of [-6, 0, 6]) line(c, [hx + k * 0.6, hy - 6, hx + 3 + k * 0.2, hy - 36], 'rgba(120,110,140,0.35)', 0.8);
    for (const [fx, fy, col] of [[hx - 6, hy - 10, '#e0344d'], [hx + 7, hy - 12, '#f2c84b'], [hx + 1, hy - 20, '#4a7bd8']] as [number, number, string][]) { for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; circle(c, fx + Math.cos(a) * 1.9, fy + Math.sin(a) * 1.9, 1.5); c.fillStyle = col; c.fill(); } circle(c, fx, fy, 1); c.fillStyle = '#fff'; c.fill(); }
    inkLine(c, [hx + 13, hy - 2, hx + 18 - p.step * 3, hy + 22], '#e0344d', 2); inkLine(c, [hx + 15, hy, hx + 21 - p.step * 4, hy + 18], '#4a7bd8', 1.8);
  },
  hand: (c, _P, p, back) => { if (back) fan(c, p.extra); else bells(c); },
  weaponIcon: (c, tc) => { line(c, [24, 44, 24, 22], '#7a4a28', 3); for (const [x, y] of [[24, 16], [17, 20], [31, 20], [20, 11], [28, 11]]) { circle(c, x, y, 4.6); vol(c, tc, x - 4, y - 4, x + 4, y + 4, 1.5, INK, 0.5, -0.3); } },
};
