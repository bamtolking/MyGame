// 창술사: 상투 topknot with a red 머리띠, studded 두정갑 vest over a dark green robe, long spear with a jade blade and a red horsehair tassel.
import { type Ctx, INK, vol, circle, ellipse, rrect, fillC, line, inkLine, shade } from '../core.ts';
import { type ClassLook, type Pal, pose, WALK } from '../rig.ts';

const PAL: Pal = { robe: '#24553a', lining: '#eef4d4', sash: '#b8e04a', pants: '#26302a', shoe: '#18160f', skin: '#ffe0c4', hair: '#1a1524', iris: '#5e9c3a', cuff: '#b8e04a' };
const VEST = '#3a6f86', STUD = '#f0c860', LIME = '#b8e04a', RED = '#dc3440';
/** Spear length in art units: longer than the character is tall. */
const LEN = 98;

/** Spear along +x: tip at x = g, butt at g − LEN. (dx, dy) = direction the tassel hangs in (world-down, streaming back on a thrust). */
function drawSpear(c: Ctx, g: number, dx: number, dy: number, blade = '#8fdc62', len = LEN): void {
  const bb = g - 11, butt = g - len; // blade base
  inkLine(c, [butt + 2, 0, bb - 3, 0], '#6e2f22', 2.6);
  line(c, [butt + 4, -0.55, bb - 4, -0.55], 'rgba(255,214,180,0.4)', 0.8);
  rrect(c, butt, -1.9, 4.2, 3.8, 1.3); fillC(c, '#c9a54a', INK, 1.1);
  // red horsehair tassel (상모) under the blade
  const px = -dy, py = dx, sx = bb - 2.2, L = 12;
  const ex = sx + dx * L, ey = dy * L;
  c.beginPath(); c.moveTo(sx + px * 1.8, py * 1.8); c.quadraticCurveTo(sx + dx * L * 0.55 + px * 5, dy * L * 0.55 + py * 5, ex, ey);
  c.quadraticCurveTo(sx + dx * L * 0.55 - px * 5, dy * L * 0.55 - py * 5, sx - px * 1.8, -py * 1.8); c.closePath();
  vol(c, RED, sx - 5, -5, sx + 5, 8, 1.3, INK, 0.25, -0.35);
  for (const k of [-2.2, 0, 2.2]) line(c, [sx + dx * 4 + px * k * 0.6, dy * 4 + py * k * 0.6, sx + dx * (L - 1) + px * k * 1.1, dy * (L - 1) + py * k * 1.1], 'rgba(120,10,24,0.75)', 0.8);
  // socket collar
  rrect(c, bb - 3.6, -2.2, 4, 4.4, 1.2); fillC(c, '#e0bc54', INK, 1.2);
  // leaf-shaped jade blade with a centre ridge
  c.beginPath(); c.moveTo(bb, -1.8); c.quadraticCurveTo(bb + 4, -4.6, g, 0); c.quadraticCurveTo(bb + 4, 4.6, bb, 1.8); c.closePath();
  const gr = c.createLinearGradient(0, -3, 0, 3); gr.addColorStop(0, shade(blade, 0.6)); gr.addColorStop(0.45, blade); gr.addColorStop(1, shade(blade, -0.45));
  c.fillStyle = gr; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
  line(c, [bb + 0.5, 0, g - 1.5, 0], 'rgba(255,255,255,0.85)', 0.8);
}
/** Tapered cloth ribbon from (x0, y0) bending through (cx, cy) to a point at (x1, y1). */
function ribbon(c: Ctx, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w: number, col: string): void {
  const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
  c.beginPath(); c.moveTo(x0 + nx, y0 + ny); c.quadraticCurveTo(cx + nx * 1.1, cy + ny * 1.1, x1, y1); c.quadraticCurveTo(cx - nx * 0.9, cy - ny * 0.9, x0 - nx, y0 - ny); c.closePath();
  vol(c, col, Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), 1.5, INK, 0.2, -0.3);
}
export const spear: ClassLook = {
  pal: PAL,
  frames: {
    // wpn = spear angle in torso space; extra = grip → tip distance
    idle0: pose({ armF: 0.3, armB: -0.2, wpn: -1.3, extra: 70 }), idle1: pose({ bob: 1, armF: 0.32, armB: -0.18, wpn: -1.3, extra: 70 }), blink: pose({ eyes: 'blink', armF: 0.3, armB: -0.2, wpn: -1.3, extra: 70 }),
    walk0: pose({ ...WALK(-1.6, 0.5, 1), armF: 0.26, wpn: -1.22, extra: 68 }), walk1: pose({ ...WALK(0, 0.05, 0), armF: 0.3, wpn: -1.24, extra: 68 }),
    walk2: pose({ ...WALK(-1.6, -0.5, -1), armF: 0.36, wpn: -1.26, extra: 68 }), walk3: pose({ ...WALK(0, -0.05, 0), armF: 0.3, wpn: -1.24, extra: 68 }),
    atk0: pose({ lean: -0.12, armF: -0.45, armB: -0.45, wpn: 0, extra: 42, eyes: 'fierce', legF: 0.3, legB: -0.35, step: -0.5 }),
    atk1: pose({ lean: 0.1, bob: 1.5, armF: 1.67, armB: 1.6, wpn: -0.1, extra: 16.5, eyes: 'fierce', legF: 0.65, legB: -0.5, step: 1 }),
    atk2: pose({ lean: 0.05, bob: 1, armF: 0.4, armB: 0.1, wpn: -0.65, extra: 32, eyes: 'fierce', legF: 0.4, legB: -0.3, step: 0.5 }),
    hurt: pose({ lean: -0.28, bob: 1.5, armF: 0.2, armB: -1.1, eyes: 'hurt', wpn: -0.82, extra: 60 }),
  },
  back: (c, _P, p) => {
    // 머리띠 tails fluttering behind the head (stream back further on the lunge)
    const fl = Math.max(-6, p.lean * 40), w = p.step * 1.2 + p.bob * 0.8;
    ribbon(c, -11, -46.5, -21 - fl * 0.5, -46 + w, -26 - fl * 1.2, -32 - fl * 0.9 + w, 3.8, RED);
    ribbon(c, -11, -44, -18 - fl * 0.4, -38 - w * 0.4, -19 - fl * 1.1, -25 - fl * 0.9 - w * 0.5, 3.2, shade(RED, -0.1));
  },
  sleeve: (c, P, back) => {
    c.beginPath(); c.moveTo(-5, -1); c.lineTo(5, -1); c.lineTo(6.5, 13); c.lineTo(-6.5, 13); c.closePath(); vol(c, back ? shade(P.robe, -0.3) : P.robe, -6, 0, 6, 13);
    // studded shoulder guard
    c.beginPath(); c.moveTo(-6, -2.5); c.quadraticCurveTo(0, -6, 6, -2.5); c.lineTo(6.6, 5); c.quadraticCurveTo(0, 7.4, -6.6, 5); c.closePath(); vol(c, back ? shade(VEST, -0.3) : VEST, -6, -5, 6, 6, 1.7);
    c.beginPath(); c.moveTo(-6.2, 4.6); c.quadraticCurveTo(0, 7, 6.2, 4.6); c.strokeStyle = back ? shade(LIME, -0.3) : LIME; c.lineWidth = 1.3; c.stroke();
    for (const x of [-2.6, 2.6]) { circle(c, x, 1.4, 1); c.fillStyle = back ? shade(STUD, -0.3) : STUD; c.fill(); }
  },
  torso: (c, _P, _p, sw) => {
    // light 두정갑-style vest: studded panel, lime trim along the front edge and hem
    c.beginPath(); c.moveTo(-9.5, -24); c.lineTo(4, -24); c.quadraticCurveTo(7, -12, 9 + sw * 0.4, 2); c.quadraticCurveTo(-2, 3.5, -13 + sw * 0.3, 1.5); c.quadraticCurveTo(-12, -12, -9.5, -24); c.closePath();
    vol(c, VEST, -12, -24, 9, 2, 1.8);
    c.beginPath(); c.moveTo(4, -23.5); c.quadraticCurveTo(7, -12, 9 + sw * 0.4, 1.6); c.quadraticCurveTo(-2, 3, -12.6 + sw * 0.3, 1.2); c.strokeStyle = LIME; c.lineWidth = 1.8; c.stroke();
    c.beginPath(); c.moveTo(-14.6 + sw * 0.6, 16.5); c.quadraticCurveTo(0, 19.5, 15.6 + sw, 16.5); c.strokeStyle = INK; c.lineWidth = 3.6; c.stroke(); c.strokeStyle = LIME; c.lineWidth = 1.8; c.stroke();
    for (const [x, y] of [[-6.5, -19], [-2, -19.5], [-7.5, -14], [-3, -14], [1.5, -14.5], [-8.5, -1.5], [-4, -1], [0.5, -1], [5, -1]]) { circle(c, x, y, 1.05); c.fillStyle = STUD; c.fill(); c.strokeStyle = 'rgba(18,12,28,0.6)'; c.lineWidth = 0.6; c.stroke(); }
  },
  hat: (c, P, _p, hx, hy, R) => {
    // 상투 topknot with a gold 동곳 pin
    ellipse(c, hx - 2, hy - R - 3.6, 6, 6.4); vol(c, P.hair, hx - 8, hy - R - 10, hx + 4, hy - R + 3, 1.9);
    line(c, [hx - 5.5, hy - R - 7, hx - 1.5, hy - R - 8.2], 'rgba(150,140,190,0.5)', 1.1);
    inkLine(c, [hx - 10, hy - R - 3.6, hx + 6, hy - R - 2.2], '#e8bc50', 1.4); circle(c, hx + 6, hy - R - 2.2, 1.4); c.fillStyle = '#e8bc50'; c.fill();
    // red 머리띠 around the forehead, knotted at the back
    c.beginPath(); c.moveTo(hx - R + 1.4, hy - 5); c.quadraticCurveTo(hx + 2, hy - 13.5, hx + R - 1.2, hy - 6); c.strokeStyle = INK; c.lineWidth = 6; c.stroke(); c.strokeStyle = RED; c.lineWidth = 3.6; c.stroke();
    c.beginPath(); c.moveTo(hx - R + 3, hy - 6.4); c.quadraticCurveTo(hx + 2, hy - 13.4, hx + R - 3, hy - 7.6); c.strokeStyle = 'rgba(255,200,190,0.55)'; c.lineWidth = 0.9; c.stroke();
    ellipse(c, hx - R + 1, hy - 5, 2.8, 2.4, 0.4); vol(c, RED, hx - R - 2, hy - 8, hx - R + 4, hy - 2, 1.3);
  },
  hand: (c, P, p, back) => {
    if (back) return;
    const th = p.wpn + p.lean, flow = p.lean > 0.08 ? 1.6 : 0.3; // th = spear angle in world space
    let dx = Math.sin(th) - flow, dy = Math.cos(th); const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    c.save(); c.rotate(p.wpn + p.armF); const g = p.extra || 66; drawSpear(c, g, dx, dy);
    if (p.lean > 0.08) { for (const [w, h] of [[7, 1.1], [1.1, 5]]) { ellipse(c, g - 2, 0, w, h); c.fillStyle = 'rgba(255,255,240,0.95)'; c.fill(); } }
    c.restore();
    circle(c, 0, 0, 3.5); vol(c, P.skin, -3, -3, 3, 3, 1.6); line(c, [-1.6, -2, -1.6, 2], 'rgba(160,90,70,0.5)', 0.8);
  },
  weaponIcon: (c, tc) => {
    // diagonal spear, tip at the top right, tassel hanging from the socket
    c.save(); c.translate(41, 7); c.rotate(-Math.PI / 4); c.scale(1.35, 1.35);
    const dx = -1.0, dy = 0.7, L = Math.hypot(dx, dy); drawSpear(c, 0, dx / L, dy / L, tc, 37);
    c.restore();
  },
};
