// 악사: yellow 초립 straw hat with a paper peony, orange hanbok with 색동 cuffs and hem, 가야금 held across the body.
import { type Ctx, INK, vol, circle, ellipse, rrect, poly, fillC, line, inkLine, shade } from '../core.ts';
import { type ClassLook, type Pal, type Pose, pose, WALK, defaultFace } from '../rig.ts';

const PAL: Pal = { robe: '#f08a2c', lining: '#fbf0d8', sash: '#34509a', pants: '#eadcc0', shoe: '#4a2a1c', skin: '#ffe0c4', hair: '#1f1624', iris: '#c9782a', cuff: '#fbf0d8' };
const SAEKDONG = ['#e0344d', '#f2c84b', '#3fb07a', '#4a7bd8', '#f7f2e8'];
/** Gayageum placement in torso space: centre, angle, half-length, board width. */
const GX = 0, GY = -11, GA = 0.58, GH = 29, GW = 9.5;
const WOOD = '#c47a36';
/** Torso-space point on the gayageum at local (u along the strings, v across). */
const gpt = (u: number, v: number): [number, number] => [GX + Math.cos(GA) * u - Math.sin(GA) * v, GY + Math.sin(GA) * u + Math.cos(GA) * v];

function board(c: Ctx, L: number, W: number, wood: string, trim: string, strings: number, vib: number): void {
  const h = L / 2;
  // side thickness below the top face
  c.beginPath(); c.moveTo(-h + 2, W / 2 - 1); c.lineTo(h - 2, W / 2 - 1); c.quadraticCurveTo(h + 1, W / 2, h, W / 2 + 2.6); c.lineTo(-h + 3, W / 2 + 2.6); c.closePath(); vol(c, trim, -h, W / 2, h, W / 2 + 3, 1.6, INK, 0.1, -0.3);
  // top face with the 양이두 (ram-horn) tail
  c.beginPath(); c.moveTo(-h + 2, -W / 2); c.lineTo(h - 3, -W / 2); c.quadraticCurveTo(h + 1, -W / 2, h + 1, -W / 2 + 3); c.lineTo(h + 1, W / 2 - 2); c.quadraticCurveTo(h + 1, W / 2, h - 3, W / 2);
  c.lineTo(-h + 2, W / 2); c.quadraticCurveTo(-h - 3, W / 2 + 1.5, -h - 2.4, W / 2 - 2.2); c.quadraticCurveTo(-h + 2.5, 0, -h - 2.4, -W / 2 + 2.2); c.quadraticCurveTo(-h - 3, -W / 2 - 1.5, -h + 2, -W / 2); c.closePath();
  vol(c, wood, -h, -W / 2, -h + 10, W / 2 + 4, 1.9, INK, 0.3, -0.25);
  line(c, [-h + 6, -W / 2 + 1, h - 6, -W / 2 + 1], 'rgba(255,230,190,0.35)', 0.8);
  // head rail (현침) and tail rail
  rrect(c, h - 6.5, -W / 2 + 0.3, 2.6, W - 0.6, 1); fillC(c, trim, INK, 0.9);
  rrect(c, -h + 3, -W / 2 + 0.6, 2, W - 1.2, 1); fillC(c, trim, INK, 0.8);
  // strings (glowing while they ring)
  for (let i = 0; i < strings; i++) {
    const y = -W / 2 + 1.5 + (i * (W - 3)) / (strings - 1);
    if (vib > 0) { c.beginPath(); c.moveTo(-h + 4, y); for (let k = 1; k <= 12; k++) { const x = -h + 4 + (k / 12) * (L - 10); c.lineTo(x, y + Math.sin(k * 2.1 + i) * 0.45 * vib); } c.strokeStyle = 'rgba(255,214,140,0.8)'; c.lineWidth = 1.5; c.stroke(); }
    line(c, [-h + 4, y + 0.35, h - 5, y + 0.35], 'rgba(60,24,8,0.45)', 0.5); line(c, [-h + 4, y, h - 5, y], '#fffaf0', 0.55);
  }
  // 안족 bridges in a slanted row
  for (let i = 0; i < strings; i++) {
    const y = -W / 2 + 1.5 + (i * (W - 3)) / (strings - 1), x = -h * 0.3 + i * (L * 0.07);
    poly(c, [x - 1.5, y + 1.3, x, y - 1.5, x + 1.5, y + 1.3]); fillC(c, '#fff6e6', INK, 0.7);
  }
}
/** 부들: coloured cotton cords hanging from the tail. */
function cords(c: Ctx, x: number, y: number, sway: number, len: number): void {
  ['#e0344d', '#f2c84b', '#e0344d', '#4a7bd8'].forEach((col, i) => { const ox = x - 1.5 + i * 1.4, ex = ox - 2 + i * 0.6 - sway * (1 + i * 0.4); inkLine(c, [ox, y, ox - 1 - sway * 0.5, y + len * 0.5, ex, y + len - i * 1.6], col, 1.1); });
}
function gayageum(c: Ctx, p: Pose): void {
  const [tx, ty] = gpt(-GH + 1, 0); cords(c, tx, ty, p.step, 22);
  c.save(); c.translate(GX, GY); c.rotate(GA); board(c, GH * 2, GW, WOOD, shade(WOOD, -0.5), 5, p.extra); c.restore();
}
function sleeve(c: Ctx, P: Pal, back: boolean): void {
  c.beginPath(); c.moveTo(-5, -1); c.lineTo(5, -1); c.lineTo(6.8, 13); c.lineTo(-6.8, 13); c.closePath();
  vol(c, back ? shade(P.robe, -0.3) : P.robe, -6, 0, 6, 13); c.save(); c.clip();
  SAEKDONG.forEach((col, i) => { c.fillStyle = back ? shade(col, -0.3) : col; c.fillRect(-8, 5 + i * 1.6, 16, 1.6); }); c.restore();
  c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
}
/** Motion trail of the plucking hand from arm angle a0 to a1 (around the front shoulder). */
function swoosh(c: Ctx, a0: number, a1: number, k: number): void {
  const b0 = Math.PI / 2 - a0, b1 = Math.PI / 2 - a1, n = 8;
  for (let i = 0; i < n; i++) { const t = i / n; c.beginPath(); c.arc(6, -20, 19, b0 + (b1 - b0) * t, b0 + (b1 - b0) * (t + 1 / n) + 0.02, b1 < b0); c.strokeStyle = `rgba(255,${Math.round(190 + 50 * t)},${Math.round(80 + 110 * t)},${(0.3 + 0.7 * t) * k})`; c.lineWidth = 2 + t * 6.5; c.stroke(); }
}
function hand(c: Ctx, P: Pal, open: boolean): void {
  circle(c, 0, 17, 3.4); vol(c, P.skin, -3, 14, 3, 20, 1.6);
  if (open) for (const a of [-0.5, 0, 0.5]) { c.save(); c.translate(0, 17); c.rotate(a); ellipse(c, 0, 4.2, 1.1, 2); fillC(c, P.skin, INK, 1); c.restore(); }
  else { ellipse(c, 1.6, 20.2, 1.1, 2.1, -0.4); fillC(c, P.skin, INK, 1); }
}
export const musician: ClassLook = {
  pal: PAL,
  frames: {
    idle0: pose({ armF: 0.62, armB: -1.95 }), idle1: pose({ bob: 1, armF: 0.66, armB: -1.92, step: 0.3 }), blink: pose({ eyes: 'blink', armF: 0.62, armB: -1.95 }),
    walk0: pose({ ...WALK(-1.6, 0.5, 1), armF: 0.5, armB: -1.95 }), walk1: pose({ ...WALK(0, 0.05, 0), armF: 0.62, armB: -1.95 }), walk2: pose({ ...WALK(-1.6, -0.5, -1), armF: 0.74, armB: -1.95 }), walk3: pose({ ...WALK(0, -0.05, 0), armF: 0.62, armB: -1.95 }),
    atk0: pose({ lean: -0.14, armF: 2.05, armB: -1.88, eyes: 'fierce', step: -0.5 }),
    atk1: pose({ lean: 0.2, bob: 1.2, armF: 0.02, armB: -2.02, extra: 1, eyes: 'fierce', legF: 0.35, legB: -0.3, step: 1 }),
    atk2: pose({ lean: 0.08, bob: 0.5, armF: 0.95, armB: -1.97, extra: 0.6, eyes: 'fierce', step: 0.5 }),
    hurt: pose({ lean: -0.28, bob: 1.5, armF: -0.6, armB: -1.5, eyes: 'hurt' }),
  },
  sleeve: (c, P, back) => sleeve(c, P, back),
  torso: (c, _P, _p, sw) => {
    // 색동 band along the hem
    const hem = 19; c.save(); c.beginPath(); c.moveTo(-9, -24); c.lineTo(9, -24); c.quadraticCurveTo(13, -4, 16 + sw, hem); c.quadraticCurveTo(0, hem + 3, -15 + sw * 0.6, hem); c.quadraticCurveTo(-12, -4, -9, -24); c.closePath(); c.clip();
    SAEKDONG.slice(0, 4).forEach((col, i) => { c.beginPath(); c.moveTo(-20, hem - 5.5 + i * 1.7); c.quadraticCurveTo(0, hem - 2.5 + i * 1.7, 20 + sw, hem - 5.5 + i * 1.7); c.strokeStyle = col; c.lineWidth = 1.8; c.stroke(); });
    c.restore();
  },
  face: (c, P, p, hx, hy) => {
    defaultFace(c, P, p, hx, hy, p.eyes !== 'fierce');
    if (p.eyes === 'fierce') { c.beginPath(); c.moveTo(hx + 1, hy + 8.4); c.quadraticCurveTo(hx + 3.5, hy + 14, hx + 6, hy + 8.4); c.closePath(); fillC(c, '#b8323a', INK, 1.2); }
  },
  hat: (c, _P, _p, hx, hy) => {
    // 초립: fine yellow straw hat with a red band and a paper peony
    ellipse(c, hx + 1, hy - 12, 22, 5.4); vol(c, '#ecc45a', hx - 20, hy - 17, hx + 22, hy - 6, 1.8, INK, 0.25, -0.3);
    for (let i = -4; i <= 4; i++) line(c, [hx + 1 + i * 2.6, hy - 11.5, hx + 1 + i * 4.6, hy - 11.5 + (4.4 - Math.abs(i) * 0.5) * (i % 2 ? 0.8 : 1)], 'rgba(150,100,30,0.45)', 0.7);
    c.beginPath(); c.moveTo(hx - 8, hy - 12); c.lineTo(hx - 7, hy - 26); c.quadraticCurveTo(hx + 1, hy - 29, hx + 9, hy - 26); c.lineTo(hx + 10, hy - 12); c.closePath(); vol(c, '#e6b84a', hx - 8, hy - 29, hx + 10, hy - 12, 1.9, INK, 0.3, -0.25);
    for (let k = 0; k < 3; k++) line(c, [hx - 6.8, hy - 22 + k * 3, hx + 9.2, hy - 22 + k * 3], 'rgba(140,90,25,0.4)', 0.7);
    rrect(c, hx - 8.4, hy - 16.5, 18.8, 3.6, 1); fillC(c, '#d8323f', INK, 1);
    // peony
    const fx = hx + 8, fy = hy - 17;
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; circle(c, fx + Math.cos(a) * 2.6, fy + Math.sin(a) * 2.6, 2.2); fillC(c, k % 2 ? '#ff6f91' : '#f0476e', INK, 0.8); }
    circle(c, fx, fy, 1.6); fillC(c, '#ffe07a', INK, 0.7);
  },
  hand: () => {},
  front: (c, P, p) => {
    gayageum(c, p);
    if (p.extra > 0.8) swoosh(c, 2.05, p.armF, 1); else if (p.extra > 0) swoosh(c, 0.02, p.armF, 0.45);
    // back hand grips the upper end, the front arm plucks over the strings
    c.save(); c.translate(-6, -20); c.rotate(-p.armB); hand(c, { ...P, skin: shade(P.skin, -0.12) }, false); c.restore();
    c.save(); c.translate(6, -20); c.rotate(-p.armF); sleeve(c, P, false); rrect(c, -5.5, 11.5, 11, 3.2, 1.5); fillC(c, P.cuff, INK, 1.4); hand(c, P, p.extra > 0.8); c.restore();
  },
  weaponIcon: (c, tc) => {
    cords(c, 10.5, 33.5, 0.4, 11);
    c.save(); c.translate(26, 21); c.rotate(-0.7); board(c, 42, 12, WOOD, tc, 6, 0); c.restore();
  },
};
