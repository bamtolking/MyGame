// 검객: 갓 with an amber bead strap, navy robe, 환도 (curved single-edged sword).
import { type Ctx, INK, vol, circle, ellipse, rrect, fillC, line, inkLine } from '../core.ts';
import { type ClassLook, type Pal, pose, WALK } from '../rig.ts';

const PAL: Pal = { robe: '#2c4790', lining: '#dcdff0', sash: '#c8323a', pants: '#262036', shoe: '#17111f', skin: '#ffe0c4', hair: '#1a1524', iris: '#5b7bd0', cuff: '#1c2c5c' };
function drawSword(c: Ctx, wpn: number): void {
  c.save(); c.rotate(-wpn - Math.PI / 2 + Math.PI); // blade points forward along -y after rotation
  rrect(c, -2, -1, 4, 9, 1.5); fillC(c, '#2a1d2a', INK, 1.4); inkLine(c, [0, 8, 3, 13], '#d23a4f', 1.6);
  ellipse(c, 0, -1.5, 5.5, 2); fillC(c, '#e2b64c', INK, 1.4);
  c.beginPath(); c.moveTo(-2.2, -3); c.quadraticCurveTo(-3.6, -20, -1.2, -38); c.quadraticCurveTo(1.6, -24, 2.4, -3); c.closePath();
  const g = c.createLinearGradient(-3, 0, 3, 0); g.addColorStop(0, '#9fb3d8'); g.addColorStop(0.5, '#f4f8ff'); g.addColorStop(1, '#6f82a8'); c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
  line(c, [-1.4, -6, -2.2, -30], 'rgba(255,255,255,0.9)', 0.9);
  c.restore();
}
export const sword: ClassLook = {
  pal: PAL,
  frames: {

    idle0: pose({ wpn: 0.5 }), idle1: pose({ bob: 1, armF: 0.34, wpn: 0.52 }), blink: pose({ eyes: 'blink', wpn: 0.5 }),
    walk0: pose({ ...WALK(-1.6, 0.5, 1), wpn: 0.6 }), walk1: pose({ ...WALK(0, 0.05, 0), wpn: 0.6 }), walk2: pose({ ...WALK(-1.6, -0.5, -1), wpn: 0.6 }), walk3: pose({ ...WALK(0, -0.05, 0), wpn: 0.6 }),
    atk0: pose({ lean: -0.14, armF: -2.5, armB: 0.4, wpn: 0.3, eyes: 'fierce', legF: 0.25, legB: -0.25 }),
    atk1: pose({ lean: 0.22, bob: 1.5, armF: 1.35, armB: -0.6, wpn: 0.35, eyes: 'fierce', legF: 0.6, legB: -0.45, step: 1 }),
    atk2: pose({ lean: 0.12, bob: 1, armF: 2.15, armB: -0.4, wpn: 0.6, eyes: 'fierce', legF: 0.45, legB: -0.3 }),
    hurt: pose({ lean: -0.28, bob: 1.5, armF: -0.9, armB: -1.1, eyes: 'hurt', wpn: 0.9 }),
  },
  hat: (c, _P, _p, hx, hy) => {
    // 갓 + amber bead strap (갓끈)
    for (let i = 0; i < 7; i++) { const t = i / 6; const bx = hx - 9 + t * 5, by = hy + 5 + t * 23; circle(c, bx, by, i % 2 ? 1.5 : 2); c.fillStyle = i % 2 ? '#3a2a1a' : '#f0a83c'; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke(); }
    ellipse(c, hx + 1, hy - 12, 26, 6.2); c.fillStyle = 'rgba(16,12,24,0.8)'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.8; c.stroke();
    ellipse(c, hx + 1, hy - 12, 22, 4.6); c.strokeStyle = 'rgba(150,140,190,0.35)'; c.lineWidth = 0.8; c.stroke();
    c.beginPath(); c.moveTo(hx - 8, hy - 12); c.lineTo(hx - 7, hy - 28); c.quadraticCurveTo(hx + 1, hy - 31, hx + 9, hy - 28); c.lineTo(hx + 10, hy - 12); c.closePath(); vol(c, '#1a1522', hx - 8, hy - 30, hx + 10, hy - 12, 2, INK, 0.3, -0.2);
    rrect(c, hx - 8.5, hy - 16, 19, 3.2, 1); c.fillStyle = '#3a3050'; c.fill();
  },
  hand: (c, _P, p, back) => { if (!back) drawSword(c, p.wpn); },
  weaponIcon: (c, tc) => { c.save(); c.translate(24, 24); c.rotate(-0.8); c.beginPath(); c.moveTo(-3, 9); c.lineTo(-3, -16); c.quadraticCurveTo(0, -23, 3.5, -19); c.lineTo(3, 9); c.closePath(); vol(c, tc, -3, -22, 4, 9, 1.8, INK, 0.45, -0.3); line(c, [0.5, 7, 0.5, -17], 'rgba(255,255,255,0.6)', 0.9); rrect(c, -7, 8, 14, 4, 2); vol(c, '#c9a54a', -7, 8, 7, 12, 1.4); rrect(c, -2.5, 12, 5, 10, 2); vol(c, '#4a2c1c', -2.5, 12, 2.5, 22, 1.4); c.restore(); },
};
