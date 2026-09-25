// Player characters and NPCs: a small 2D rig (legs, torso with lean, head, hat, arms, weapon) posed per frame.
import type { ClassId } from '../../../shared/types.ts';
import { type Ctx, INK, vol, circle, ellipse, rrect, poly, fillC, line, inkLine, eye, blush, shade } from './core.ts';

export interface Pose { bob: number; lean: number; legF: number; legB: number; armF: number; armB: number; wpn: number; eyes: 'open' | 'blink' | 'hurt' | 'fierce'; step: number; extra: number }
const P0: Pose = { bob: 0, lean: 0, legF: 0, legB: 0, armF: 0.3, armB: -0.2, wpn: 0, eyes: 'open', step: 0, extra: 0 };
const pose = (o: Partial<Pose>): Pose => ({ ...P0, ...o });
const WALK = (bob: number, lf: number, step: number): Partial<Pose> => ({ bob, lean: 0.07, legF: lf, legB: -lf, armF: -lf * 0.9 + 0.2, armB: lf * 0.9 - 0.1, step });
export const FRAMES: Record<ClassId, Record<string, Pose>> = {
  sword: {
    idle0: pose({ wpn: 0.5 }), idle1: pose({ bob: 1, armF: 0.34, wpn: 0.52 }), blink: pose({ eyes: 'blink', wpn: 0.5 }),
    walk0: pose({ ...WALK(-1.6, 0.5, 1), wpn: 0.6 }), walk1: pose({ ...WALK(0, 0.05, 0), wpn: 0.6 }), walk2: pose({ ...WALK(-1.6, -0.5, -1), wpn: 0.6 }), walk3: pose({ ...WALK(0, -0.05, 0), wpn: 0.6 }),
    atk0: pose({ lean: -0.14, armF: -2.5, armB: 0.4, wpn: 0.3, eyes: 'fierce', legF: 0.25, legB: -0.25 }),
    atk1: pose({ lean: 0.22, bob: 1.5, armF: 1.35, armB: -0.6, wpn: 0.35, eyes: 'fierce', legF: 0.6, legB: -0.45, step: 1 }),
    atk2: pose({ lean: 0.12, bob: 1, armF: 2.15, armB: -0.4, wpn: 0.6, eyes: 'fierce', legF: 0.45, legB: -0.3 }),
    hurt: pose({ lean: -0.28, bob: 1.5, armF: -0.9, armB: -1.1, eyes: 'hurt', wpn: 0.9 }),
  },
  archer: {
    idle0: pose({ armF: 0.25, wpn: 0 }), idle1: pose({ bob: 1, armF: 0.28 }), blink: pose({ eyes: 'blink', armF: 0.25 }),
    walk0: pose(WALK(-1.6, 0.5, 1)), walk1: pose(WALK(0, 0.05, 0)), walk2: pose(WALK(-1.6, -0.5, -1)), walk3: pose(WALK(0, -0.05, 0)),
    atk0: pose({ lean: -0.06, armF: 1.57, armB: 1.9, extra: 1, eyes: 'fierce', legF: 0.3, legB: -0.3 }),
    atk1: pose({ lean: -0.14, armF: 1.62, armB: 0.9, extra: 0, eyes: 'fierce', legF: 0.3, legB: -0.3 }),
    atk2: pose({ lean: -0.04, armF: 1.1, armB: 0.3, eyes: 'fierce', legF: 0.15, legB: -0.15 }),
    hurt: pose({ lean: -0.28, bob: 1.5, armF: -0.6, armB: -1.1, eyes: 'hurt' }),
  },
  shaman: {
    idle0: pose({ armF: 0.35, armB: 0.2 }), idle1: pose({ bob: 1, armF: 0.4, armB: 0.25, step: 0.4 }), blink: pose({ eyes: 'blink', armF: 0.35, armB: 0.2 }),
    walk0: pose(WALK(-1.6, 0.5, 1)), walk1: pose(WALK(0, 0.05, 0)), walk2: pose(WALK(-1.6, -0.5, -1)), walk3: pose(WALK(0, -0.05, 0)),
    atk0: pose({ lean: -0.08, armF: -2.7, armB: 1.0, extra: 0.4, eyes: 'fierce', step: -0.6 }),
    atk1: pose({ lean: 0.18, bob: 1, armF: 1.3, armB: -0.7, extra: 1, eyes: 'fierce', legF: 0.4, legB: -0.3, step: 1 }),
    atk2: pose({ lean: 0.08, armF: 0.7, armB: -0.2, extra: 1, eyes: 'fierce', step: 0.5 }),
    hurt: pose({ lean: -0.28, bob: 1.5, armF: -1, armB: -1.2, eyes: 'hurt' }),
  },
};
export const CHAR_W = 78, CHAR_H = 96, CHAR_FOOT = 90;
const PAL = {
  sword: { robe: '#2c4790', lining: '#dcdff0', sash: '#c8323a', pants: '#262036', shoe: '#17111f', skin: '#ffe0c4', hair: '#1a1524', iris: '#5b7bd0', cuff: '#1c2c5c' },
  archer: { robe: '#2a8a67', lining: '#e9dfc4', sash: '#8a5a34', pants: '#3a3128', shoe: '#2a1f16', skin: '#ffdcbf', hair: '#2a1d18', iris: '#5aa06a', cuff: '#7a4a28' },
  shaman: { robe: '#cf3148', lining: '#f7f2e8', sash: '#f2c84b', pants: '#efe6d6', shoe: '#8a2030', skin: '#ffe3cc', hair: '#1a1320', iris: '#c24c4c', cuff: '#f7f2e8' },
};
const SAEKDONG = ['#e0344d', '#f2c84b', '#3fb07a', '#4a7bd8', '#f7f2e8', '#b04ad8'];

/** Draws a character facing right in a CHAR_W×CHAR_H box with the feet at (39, CHAR_FOOT). */
export function drawChar(c: Ctx, cls: ClassId, p: Pose): void {
  const P = PAL[cls]; const cx = 39, hip = 70;
  const leg = (x: number, a: number, back: boolean) => {
    c.save(); c.translate(x, hip); c.rotate(-a);
    rrect(c, -3.6, -2, 7.2, 17, 3.4); vol(c, back ? shade(P.pants, -0.25) : P.pants, -4, 0, 4, 16);
    ellipse(c, 1.8, 16.5, 5.2, 3); vol(c, back ? shade(P.shoe, -0.2) : P.shoe, -3, 13, 7, 19, 1.8);
    c.restore();
  };
  leg(cx - 4, p.legB, true); leg(cx + 4, p.legF, false);
  c.save(); c.translate(cx, hip + p.bob); c.rotate(p.lean);
  // ---- behind the torso: back arm, hair, quiver, fan ----
  if (cls === 'archer') { c.save(); c.rotate(-0.35); rrect(c, -15, -30, 7, 22, 3); vol(c, '#7a4a28', -15, -30, -8, -8); for (let i = 0; i < 3; i++) { inkLine(c, [-13 + i * 2, -30, -15 + i * 2.5, -38], '#efe2c0', 1.2); poly(c, [-16 + i * 2.5, -38, -14 + i * 2.5, -41, -12 + i * 2.5, -38]); fillC(c, '#d8d0c0', INK, 1); } c.restore(); }
  if (cls === 'shaman') { c.beginPath(); c.moveTo(-10, -44); c.quadraticCurveTo(-19, -20, -13 - p.step * 2, -4); c.lineTo(-6, -8); c.quadraticCurveTo(-9, -24, -3, -40); c.closePath(); vol(c, P.hair, -18, -44, -4, -4); inkLine(c, [-14 - p.step * 2, -6, -18 - p.step * 3, 6], '#e0344d', 2.2); }
  arm(c, cls, P, -6, -20, p.armB, true, p);
  // ---- torso / robe ----
  const hem = cls === 'archer' ? 12 : 19; const sw = p.step * 2.4;
  c.beginPath(); c.moveTo(-9, -24); c.lineTo(9, -24); c.quadraticCurveTo(13, -4, 16 + sw, hem); c.quadraticCurveTo(0, hem + 3, -15 + sw * 0.6, hem); c.quadraticCurveTo(-12, -4, -9, -24); c.closePath();
  vol(c, P.robe, -14, -24, 16, hem);
  // front opening shows the lining
  c.beginPath(); c.moveTo(1, -22); c.quadraticCurveTo(5, -4, 9 + sw, hem - 1); c.lineTo(15 + sw, hem - 1); c.quadraticCurveTo(10, -6, 6, -22); c.closePath(); fillC(c, P.lining, INK, 1.4);
  if (cls === 'archer') { rrect(c, -9, -23, 18, 17, 4); vol(c, '#8a5a34', -9, -23, 9, -6, 1.8); for (const [x, y] of [[-5, -18], [4, -18], [-5, -11], [4, -11]]) { circle(c, x, y, 1.1); c.fillStyle = '#e8c878'; c.fill(); } }
  if (cls === 'shaman') { for (let i = 0; i < 5; i++) { const col = ['#4a7bd8', '#e0344d', '#f2c84b', '#f7f2e8', '#1c1726'][i]; inkLine(c, [-4 + i * 2.2, -6, -6 + i * 2.6 - sw * (1 + i * 0.3), 12 + i * 1.5], col, 2); } }
  // sash + collar
  rrect(c, -11, -9, 22, 5, 2); fillC(c, P.sash, INK, 1.6);
  if (cls !== 'archer') { inkLine(c, [5, -6, 8 + sw, 8], P.sash, 2.6); inkLine(c, [7, -6, 11 + sw, 5], P.sash, 2.2); }
  c.beginPath(); c.moveTo(-6, -24); c.lineTo(1, -14); c.lineTo(7, -24); c.strokeStyle = INK; c.lineWidth = 4.2; c.stroke(); c.strokeStyle = '#fbf8f0'; c.lineWidth = 2.4; c.stroke();
  // ---- head ----
  head(c, cls, P, p);
  // ---- front arm + weapon ----
  arm(c, cls, P, 6, -20, p.armF, false, p);
  c.restore();
}

function arm(c: Ctx, cls: ClassId, P: typeof PAL.sword, sx: number, sy: number, a: number, back: boolean, p: Pose): void {
  c.save(); c.translate(sx, sy); c.rotate(-a);
  const sleeve = back ? shade(P.robe, -0.3) : P.robe;
  if (cls === 'shaman') { // 색동 rainbow sleeve
    c.beginPath(); c.moveTo(-5, -1); c.lineTo(5, -1); c.lineTo(5.5, 13); c.lineTo(-5.5, 13); c.closePath(); c.save(); c.clip();
    SAEKDONG.forEach((col, i) => { c.fillStyle = back ? shade(col, -0.3) : col; c.fillRect(-7, -1 + i * 2.4, 14, 2.4); }); c.restore();
    c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
  } else { c.beginPath(); c.moveTo(-5, -1); c.lineTo(5, -1); c.lineTo(6.5, 13); c.lineTo(-6.5, 13); c.closePath(); vol(c, sleeve, -6, 0, 6, 13); }
  rrect(c, -5.5, 11.5, 11, 3.2, 1.5); fillC(c, back ? shade(P.cuff, -0.3) : P.cuff, INK, 1.4);
  circle(c, 0, 17, 3.4); vol(c, back ? shade(P.skin, -0.2) : P.skin, -3, 14, 3, 20, 1.6);
  c.translate(0, 17);
  if (cls === 'sword' && !back) sword(c, p.wpn);
  if (cls === 'archer') { if (!back) bow(c, p); }
  if (cls === 'shaman') { if (back) fan(c, p.extra); else bells(c); }
  c.restore();
}
function sword(c: Ctx, wpn: number): void {
  c.save(); c.rotate(-wpn - Math.PI / 2 + Math.PI); // blade points forward along -y after rotation
  rrect(c, -2, -1, 4, 9, 1.5); fillC(c, '#2a1d2a', INK, 1.4); inkLine(c, [0, 8, 3, 13], '#d23a4f', 1.6);
  ellipse(c, 0, -1.5, 5.5, 2); fillC(c, '#e2b64c', INK, 1.4);
  c.beginPath(); c.moveTo(-2.2, -3); c.quadraticCurveTo(-3.6, -20, -1.2, -38); c.quadraticCurveTo(1.6, -24, 2.4, -3); c.closePath();
  const g = c.createLinearGradient(-3, 0, 3, 0); g.addColorStop(0, '#9fb3d8'); g.addColorStop(0.5, '#f4f8ff'); g.addColorStop(1, '#6f82a8'); c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
  line(c, [-1.4, -6, -2.2, -30], 'rgba(255,255,255,0.9)', 0.9);
  c.restore();
}
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
function head(c: Ctx, cls: ClassId, P: typeof PAL.sword, p: Pose): void {
  const hx = 2, hy = -41, R = 15.5;
  // back hair
  if (cls !== 'shaman') { c.beginPath(); c.arc(hx - 1, hy + 1, R + 1.2, Math.PI * 0.55, Math.PI * 1.55); c.closePath(); vol(c, P.hair, hx - R, hy - R, hx, hy + R); }
  circle(c, hx, hy, R); const g = c.createRadialGradient(hx - 5, hy - 6, 3, hx, hy, R); g.addColorStop(0, shade(P.skin, 0.25)); g.addColorStop(1, shade(P.skin, -0.12)); c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.2; c.stroke();
  // bangs
  c.beginPath(); c.moveTo(hx - R + 1, hy - 1); c.quadraticCurveTo(hx - R + 2, hy - R - 2, hx + 2, hy - R); c.quadraticCurveTo(hx + R + 1, hy - R + 2, hx + R - 1, hy - 3);
  c.lineTo(hx + 9, hy - 7); c.lineTo(hx + 6, hy - 3); c.lineTo(hx + 2, hy - 8); c.lineTo(hx - 3, hy - 3); c.lineTo(hx - 6, hy - 8); c.lineTo(hx - 10, hy - 1); c.closePath(); vol(c, P.hair, hx - R, hy - R, hx + R, hy);
  // face
  eye(c, hx - 2.5, hy + 2.5, 3.6, P.iris, p.eyes, false); eye(c, hx + 8, hy + 2.5, 3.3, P.iris, p.eyes, true); blush(c, hx - 4, hy + 9); blush(c, hx + 10, hy + 9);
  if (p.eyes === 'fierce') line(c, [hx + 1.5, hy + 10.5, hx + 5.5, hy + 10], INK, 1.5); else if (p.eyes === 'hurt') { ellipse(c, hx + 3.5, hy + 10.5, 2, 1.6); c.fillStyle = INK; c.fill(); }
  else { c.beginPath(); c.arc(hx + 3.5, hy + 8.5, 2.4, 0.2, Math.PI - 0.2); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke(); }
  // hats
  if (cls === 'sword') {
    // 갓 + amber bead strap (갓끈)
    for (let i = 0; i < 7; i++) { const t = i / 6; const bx = hx - 9 + t * 5, by = hy + 5 + t * 23; circle(c, bx, by, i % 2 ? 1.5 : 2); c.fillStyle = i % 2 ? '#3a2a1a' : '#f0a83c'; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke(); }
    ellipse(c, hx + 1, hy - 12, 26, 6.2); c.fillStyle = 'rgba(16,12,24,0.8)'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.8; c.stroke();
    ellipse(c, hx + 1, hy - 12, 22, 4.6); c.strokeStyle = 'rgba(150,140,190,0.35)'; c.lineWidth = 0.8; c.stroke();
    c.beginPath(); c.moveTo(hx - 8, hy - 12); c.lineTo(hx - 7, hy - 28); c.quadraticCurveTo(hx + 1, hy - 31, hx + 9, hy - 28); c.lineTo(hx + 10, hy - 12); c.closePath(); vol(c, '#1a1522', hx - 8, hy - 30, hx + 10, hy - 12, 2, INK, 0.3, -0.2);
    rrect(c, hx - 8.5, hy - 16, 19, 3.2, 1); c.fillStyle = '#3a3050'; c.fill();
  } else if (cls === 'archer') {
    // 전립 with red 상모 tassel
    ellipse(c, hx + 1, hy - 11, 21, 5); vol(c, '#2a2230', hx - 20, hy - 16, hx + 22, hy - 6, 1.8);
    c.beginPath(); c.ellipse(hx + 1, hy - 13, 12.5, 11, 0, Math.PI, 0); c.closePath(); vol(c, '#1f1a28', hx - 12, hy - 24, hx + 13, hy - 13, 1.8);
    rrect(c, hx - 11, hy - 16, 24, 3, 1); c.fillStyle = '#4a7bd8'; c.fill();
    for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.28; inkLine(c, [hx + 1, hy - 24, hx + 1 + Math.cos(a) * 9, hy - 26 + Math.sin(a) * 9], '#e0344d', 2.2); }
    circle(c, hx + 1, hy - 26, 4.5); vol(c, '#e0344d', hx - 3, hy - 30, hx + 5, hy - 22, 1.6); circle(c, hx + 1, hy - 24.5, 1.8); c.fillStyle = '#f2c84b'; c.fill();
  } else {
    // 고깔 white peaked hood with paper flowers, long ribbons
    c.beginPath(); c.moveTo(hx - R - 1, hy + 2); c.quadraticCurveTo(hx - 13, hy - 20, hx + 5, hy - 42); c.quadraticCurveTo(hx + 16, hy - 18, hx + R + 1, hy + 1); c.quadraticCurveTo(hx + 2, hy - 8, hx - R - 1, hy + 2); c.closePath();
    vol(c, '#f7f4ee', hx - R, hy - 42, hx + R, hy, 2, INK, 0.1, -0.22);
    for (const k of [-6, 0, 6]) line(c, [hx + k * 0.6, hy - 6, hx + 3 + k * 0.2, hy - 36], 'rgba(120,110,140,0.35)', 0.8);
    for (const [fx, fy, col] of [[hx - 6, hy - 10, '#e0344d'], [hx + 7, hy - 12, '#f2c84b'], [hx + 1, hy - 20, '#4a7bd8']] as [number, number, string][]) { for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; circle(c, fx + Math.cos(a) * 1.9, fy + Math.sin(a) * 1.9, 1.5); c.fillStyle = col; c.fill(); } circle(c, fx, fy, 1); c.fillStyle = '#fff'; c.fill(); }
    inkLine(c, [hx + 13, hy - 2, hx + 18 - p.step * 3, hy + 22], '#e0344d', 2); inkLine(c, [hx + 15, hy, hx + 21 - p.step * 4, hy + 18], '#4a7bd8', 1.8);
  }
}

// ---------------- NPCs ----------------
export function drawNpc(c: Ctx, kind: string, f: number): void {
  const cls: ClassId = kind === 'priest' ? 'shaman' : kind === 'talshop' ? 'archer' : 'sword';
  const pz = pose({ bob: f ? 1 : 0, armF: kind === 'smith' ? (f ? -1.9 : 0.4) : 0.3, armB: -0.2, eyes: f === 2 ? 'blink' : 'open' });
  if (kind === 'board') { board(c); return; }
  drawNpcBody(c, kind, cls, pz);
}
function drawNpcBody(c: Ctx, kind: string, cls: ClassId, p: Pose): void {
  const cx = 39, hip = 70; const robe = kind === 'smith' ? '#5a4032' : kind === 'talshop' ? '#6a44a8' : '#c8323a';
  for (const [x, back] of [[cx - 4, true], [cx + 4, false]] as [number, boolean][]) { c.save(); c.translate(x, hip); rrect(c, -3.6, -2, 7.2, 17, 3.4); vol(c, back ? '#1e1a26' : '#2a2436', -4, 0, 4, 16); ellipse(c, 1.8, 16.5, 5.2, 3); vol(c, '#1a1420', -3, 13, 7, 19, 1.8); c.restore(); }
  c.save(); c.translate(cx, hip + p.bob);
  c.beginPath(); c.moveTo(-10, -24); c.lineTo(10, -24); c.quadraticCurveTo(14, -4, 16, 18); c.quadraticCurveTo(0, 21, -15, 18); c.quadraticCurveTo(-13, -4, -10, -24); c.closePath(); vol(c, robe, -15, -24, 16, 18);
  if (kind === 'smith') { rrect(c, -9, -20, 18, 30, 4); vol(c, '#3a3036', -9, -20, 9, 10, 1.8); }
  rrect(c, -11, -9, 22, 5, 2); fillC(c, kind === 'priest' ? '#f2c84b' : '#2a2230', INK, 1.4);
  const P = { ...PAL[cls], skin: '#ffe0c4', hair: kind === 'smith' ? '#e6e0d4' : '#1c1726', iris: kind === 'talshop' ? '#8a5ad8' : '#8a6a4a' };
  const hx = 2, hy = -41, R = 15.5;
  circle(c, hx, hy, R); vol(c, P.skin, hx - R, hy - R, hx + R, hy + R, 2.2, INK, 0.2, -0.12);
  c.beginPath(); c.arc(hx, hy - 1, R + 0.5, Math.PI * 1.02, Math.PI * 1.98); c.closePath(); vol(c, P.hair, hx - R, hy - R, hx + R, hy);
  eye(c, hx - 2.5, hy + 2.5, 3.3, P.iris, p.eyes); eye(c, hx + 8, hy + 2.5, 3, P.iris, p.eyes, true); blush(c, hx - 4, hy + 9); blush(c, hx + 10, hy + 9);
  c.beginPath(); c.arc(hx + 3.5, hy + 8.5, 2.4, 0.2, Math.PI - 0.2); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
  if (kind === 'smith') { line(c, [hx - 8, hy + 12, hx + 3, hy + 16, hx + 12, hy + 12], '#e6e0d4', 3); c.save(); c.translate(6, -20); c.rotate(-p.armF); rrect(c, -5, -1, 10, 14, 3); vol(c, robe, -5, 0, 5, 13); circle(c, 0, 16, 3.4); vol(c, P.skin, -3, 13, 3, 19, 1.6); c.translate(0, 16); c.rotate(0.3); inkLine(c, [0, 0, 0, -16], '#7a5a3a', 2.6); rrect(c, -6, -22, 12, 7, 2); vol(c, '#8a8f9e', -6, -22, 6, -15, 1.6); c.restore(); }
  if (kind === 'talshop') { for (let i = 0; i < 3; i++) { c.save(); c.translate(12 + i * 4, -16 + i * 2); c.rotate(0.2 * i); rrect(c, -3, -6, 6, 12, 1); fillC(c, '#ffe89a', INK, 1); line(c, [-1.5, -2, 1.5, -2], '#c8323a', 1); c.restore(); } ellipse(c, hx + 1, hy - 13, 12, 3.5); fillC(c, '#1c1726', INK, 1.5); rrect(c, hx - 3, hy - 24, 7, 11, 2); fillC(c, '#1c1726', INK, 1.5); }
  if (kind === 'priest') { ellipse(c, hx + 1, hy - 12, 20, 5); vol(c, '#c8323a', hx - 18, hy - 17, hx + 20, hy - 7, 1.8); rrect(c, hx - 7, hy - 26, 16, 14, 5); vol(c, '#c8323a', hx - 7, hy - 26, hx + 9, hy - 12, 1.8); for (const [x, y] of [[14, -18], [17, -14], [13, -13]]) { circle(c, x, y, 2.3); vol(c, '#f2c84b', x - 2, y - 2, x + 2, y + 2, 1); } }
  c.restore();
}
function board(c: Ctx): void {
  rrect(c, 16, 44, 5, 40, 2); vol(c, '#6a4a2a', 16, 44, 21, 84, 1.6); rrect(c, 57, 44, 5, 40, 2); vol(c, '#6a4a2a', 57, 44, 62, 84, 1.6);
  rrect(c, 10, 22, 58, 36, 4); vol(c, '#9a6a3e', 10, 22, 68, 58); poly(c, [6, 24, 39, 10, 72, 24]); vol(c, '#3e4660', 6, 10, 72, 24, 1.8);
  for (const [x, y, r] of [[15, 27, -0.1], [30, 28, 0.06], [46, 27, 0.1], [22, 40, 0.08], [40, 40, -0.06], [55, 39, 0.04]]) { c.save(); c.translate(x + 5, y + 6); c.rotate(r); rrect(c, -5, -6, 10, 12, 1); fillC(c, '#f4ecd0', INK, 1); line(c, [-3, -2, 3, -2], '#c8323a', 1); line(c, [-3, 1, 2, 1], 'rgba(18,12,28,0.4)', 0.8); c.restore(); }
}
