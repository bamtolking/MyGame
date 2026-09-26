// 궁사: 전립 with a red 상모 tassel, leather vest, quiver, 각궁 (double-curved composite bow).
import { type Ctx, INK, vol, circle, ellipse, rrect, poly, fillC, line, inkLine } from '../core.ts';
import { type ClassLook, type Pal, type Pose, pose, WALK } from '../rig.ts';

const PAL: Pal = { robe: '#2a8a67', lining: '#e9dfc4', sash: '#8a5a34', pants: '#3a3128', shoe: '#2a1f16', skin: '#ffdcbf', hair: '#2a1d18', iris: '#5aa06a', cuff: '#7a4a28' };
function bow(c: Ctx, p: Pose): void {
  // 각궁: double-curved composite bow, held vertically in the front hand
  c.save(); c.rotate(p.armF - Math.PI / 2 + 0.05);
  const draw = p.extra; const back = 10 + draw * 12;
  c.beginPath(); c.moveTo(-1, -24); c.bezierCurveTo(-8, -18, -4, -6, -3, 0); c.bezierCurveTo(-4, 6, -8, 18, -1, 24);
  c.strokeStyle = INK; c.lineWidth = 5.2; c.stroke(); c.strokeStyle = '#6a3a22'; c.lineWidth = 3.2; c.stroke(); c.strokeStyle = '#e8d4a8'; c.lineWidth = 1.1; c.stroke();
  inkLine(c, [-1, -24, 1, -28], '#e8d4a8', 1.4); inkLine(c, [-1, 24, 1, 28], '#e8d4a8', 1.4);
  c.beginPath(); c.moveTo(-1, -24); c.lineTo(-back + 8 - (draw ? 0 : 7), 0); c.lineTo(-1, 24); c.strokeStyle = 'rgba(240,236,220,0.95)'; c.lineWidth = 1; c.stroke();
  if (draw > 0.5) { inkLine(c, [-back + 1, 0, 14, 0], '#e8dcc0', 1.3); poly(c, [14, -2.2, 19, 0, 14, 2.2]); fillC(c, '#cfd8e6', INK, 1); poly(c, [-back + 1, -2.5, -back + 5, 0, -back + 1, 2.5]); fillC(c, '#d23a4f', INK, 0.8); }
  c.restore();
}
export const archer: ClassLook = {
  pal: PAL,
  frames: {

    idle0: pose({ armF: 0.25, wpn: 0 }), idle1: pose({ bob: 1, armF: 0.28 }), blink: pose({ eyes: 'blink', armF: 0.25 }),
    walk0: pose(WALK(-1.6, 0.5, 1)), walk1: pose(WALK(0, 0.05, 0)), walk2: pose(WALK(-1.6, -0.5, -1)), walk3: pose(WALK(0, -0.05, 0)),
    atk0: pose({ lean: -0.06, armF: 1.57, armB: 1.9, extra: 1, eyes: 'fierce', legF: 0.3, legB: -0.3 }),
    atk1: pose({ lean: -0.14, armF: 1.62, armB: 0.9, extra: 0, eyes: 'fierce', legF: 0.3, legB: -0.3 }),
    atk2: pose({ lean: -0.04, armF: 1.1, armB: 0.3, eyes: 'fierce', legF: 0.15, legB: -0.15 }),
    hurt: pose({ lean: -0.28, bob: 1.5, armF: -0.6, armB: -1.1, eyes: 'hurt' }),
  },
  hem: 12, sashTails: false,
  back: (c) => { c.save(); c.rotate(-0.35); rrect(c, -15, -30, 7, 22, 3); vol(c, '#7a4a28', -15, -30, -8, -8); for (let i = 0; i < 3; i++) { inkLine(c, [-13 + i * 2, -30, -15 + i * 2.5, -38], '#efe2c0', 1.2); poly(c, [-16 + i * 2.5, -38, -14 + i * 2.5, -41, -12 + i * 2.5, -38]); fillC(c, '#d8d0c0', INK, 1); } c.restore(); },
  torso: (c) => { rrect(c, -9, -23, 18, 17, 4); vol(c, '#8a5a34', -9, -23, 9, -6, 1.8); for (const [x, y] of [[-5, -18], [4, -18], [-5, -11], [4, -11]]) { circle(c, x, y, 1.1); c.fillStyle = '#e8c878'; c.fill(); } },
  hat: (c, _P, _p, hx, hy) => {
    // 전립 with red 상모 tassel
    ellipse(c, hx + 1, hy - 11, 21, 5); vol(c, '#2a2230', hx - 20, hy - 16, hx + 22, hy - 6, 1.8);
    c.beginPath(); c.ellipse(hx + 1, hy - 13, 12.5, 11, 0, Math.PI, 0); c.closePath(); vol(c, '#1f1a28', hx - 12, hy - 24, hx + 13, hy - 13, 1.8);
    rrect(c, hx - 11, hy - 16, 24, 3, 1); c.fillStyle = '#4a7bd8'; c.fill();
    for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.28; inkLine(c, [hx + 1, hy - 24, hx + 1 + Math.cos(a) * 9, hy - 26 + Math.sin(a) * 9], '#e0344d', 2.2); }
    circle(c, hx + 1, hy - 26, 4.5); vol(c, '#e0344d', hx - 3, hy - 30, hx + 5, hy - 22, 1.6); circle(c, hx + 1, hy - 24.5, 1.8); c.fillStyle = '#f2c84b'; c.fill();
  },
  hand: (c, _P, p, back) => { if (!back) bow(c, p); },
  weaponIcon: (c, tc) => { c.beginPath(); c.moveTo(20, 6); c.bezierCurveTo(8, 10, 18, 22, 10, 24); c.bezierCurveTo(18, 26, 8, 38, 20, 42); c.strokeStyle = INK; c.lineWidth = 6; c.stroke(); c.strokeStyle = tc; c.lineWidth = 3.4; c.stroke(); line(c, [20, 6, 20, 42], '#f7f2e0', 1.1); inkLine(c, [12, 24, 40, 24], '#e9dcc0', 1.4); poly(c, [42, 24, 37, 21, 37, 27]); fillC(c, '#dfe6ee', INK, 1); },
};
