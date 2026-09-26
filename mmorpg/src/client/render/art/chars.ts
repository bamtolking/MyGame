// Player characters and NPCs: a small 2D rig (legs, torso with lean, head, arms) posed per frame.
// Everything class-specific (headgear, weapon, armour, extras) comes from the class's look in ./looks/.
import type { ClassId } from '../../../shared/types.ts';
import { type Ctx, INK, vol, circle, ellipse, rrect, poly, fillC, line, inkLine, eye, blush, shade } from './core.ts';
import { type ClassLook, type Pal, type Pose, pose, defaultFace } from './rig.ts';
import { LOOKS } from './looks/index.ts';

export { CHAR_W, CHAR_H, CHAR_FOOT, FRAME_NAMES, type Pose } from './rig.ts';
export { LOOKS };

/** Draws a character facing right in a CHAR_W×CHAR_H box with the feet at (39, CHAR_FOOT). */
export function drawChar(c: Ctx, cls: ClassId, p: Pose): void {
  const L = LOOKS[cls] ?? LOOKS.sword, P = L.pal; const cx = 39, hip = 70;
  const leg = (x: number, a: number, back: boolean) => {
    c.save(); c.translate(x, hip); c.rotate(-a);
    if (L.leg) L.leg(c, P, back);
    else { rrect(c, -3.6, -2, 7.2, 17, 3.4); vol(c, back ? shade(P.pants, -0.25) : P.pants, -4, 0, 4, 16); ellipse(c, 1.8, 16.5, 5.2, 3); vol(c, back ? shade(P.shoe, -0.2) : P.shoe, -3, 13, 7, 19, 1.8); }
    c.restore();
  };
  leg(cx - 4, p.legB, true); leg(cx + 4, p.legF, false);
  c.save(); c.translate(cx, hip + p.bob); c.rotate(p.lean);
  // ---- behind the torso: class extras, back arm ----
  L.back?.(c, P, p);
  arm(c, L, P, -6, -20, p.armB, true, p);
  // ---- torso / robe ----
  const hem = L.hem ?? 19; const sw = p.step * 2.4;
  c.beginPath(); c.moveTo(-9, -24); c.lineTo(9, -24); c.quadraticCurveTo(13, -4, 16 + sw, hem); c.quadraticCurveTo(0, hem + 3, -15 + sw * 0.6, hem); c.quadraticCurveTo(-12, -4, -9, -24); c.closePath();
  vol(c, P.robe, -14, -24, 16, hem);
  // front opening shows the lining
  c.beginPath(); c.moveTo(1, -22); c.quadraticCurveTo(5, -4, 9 + sw, hem - 1); c.lineTo(15 + sw, hem - 1); c.quadraticCurveTo(10, -6, 6, -22); c.closePath(); fillC(c, P.lining, INK, 1.4);
  L.torso?.(c, P, p, sw);
  // sash + collar
  rrect(c, -11, -9, 22, 5, 2); fillC(c, P.sash, INK, 1.6);
  if (L.sashTails !== false) { inkLine(c, [5, -6, 8 + sw, 8], P.sash, 2.6); inkLine(c, [7, -6, 11 + sw, 5], P.sash, 2.2); }
  c.beginPath(); c.moveTo(-6, -24); c.lineTo(1, -14); c.lineTo(7, -24); c.strokeStyle = INK; c.lineWidth = 4.2; c.stroke(); c.strokeStyle = '#fbf8f0'; c.lineWidth = 2.4; c.stroke();
  // ---- head ----
  head(c, L, P, p);
  // ---- front arm + weapon ----
  arm(c, L, P, 6, -20, p.armF, false, p);
  L.front?.(c, P, p);
  c.restore();
}

function arm(c: Ctx, L: ClassLook, P: Pal, sx: number, sy: number, a: number, back: boolean, p: Pose): void {
  c.save(); c.translate(sx, sy); c.rotate(-a);
  if (L.sleeve) L.sleeve(c, P, back);
  else { c.beginPath(); c.moveTo(-5, -1); c.lineTo(5, -1); c.lineTo(6.5, 13); c.lineTo(-6.5, 13); c.closePath(); vol(c, back ? shade(P.robe, -0.3) : P.robe, -6, 0, 6, 13); }
  rrect(c, -5.5, 11.5, 11, 3.2, 1.5); fillC(c, back ? shade(P.cuff, -0.3) : P.cuff, INK, 1.4);
  circle(c, 0, 17, 3.4); vol(c, back ? shade(P.skin, -0.2) : P.skin, -3, 14, 3, 20, 1.6);
  c.translate(0, 17);
  L.hand(c, P, p, back);
  c.restore();
}
function head(c: Ctx, L: ClassLook, P: Pal, p: Pose): void {
  const hx = 2, hy = -41, R = 15.5;
  // back hair
  if (L.hairBack !== false) { c.beginPath(); c.arc(hx - 1, hy + 1, R + 1.2, Math.PI * 0.55, Math.PI * 1.55); c.closePath(); vol(c, P.hair, hx - R, hy - R, hx, hy + R); }
  circle(c, hx, hy, R); const g = c.createRadialGradient(hx - 5, hy - 6, 3, hx, hy, R); g.addColorStop(0, shade(P.skin, 0.25)); g.addColorStop(1, shade(P.skin, -0.12)); c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.2; c.stroke();
  // bangs
  c.beginPath(); c.moveTo(hx - R + 1, hy - 1); c.quadraticCurveTo(hx - R + 2, hy - R - 2, hx + 2, hy - R); c.quadraticCurveTo(hx + R + 1, hy - R + 2, hx + R - 1, hy - 3);
  c.lineTo(hx + 9, hy - 7); c.lineTo(hx + 6, hy - 3); c.lineTo(hx + 2, hy - 8); c.lineTo(hx - 3, hy - 3); c.lineTo(hx - 6, hy - 8); c.lineTo(hx - 10, hy - 1); c.closePath(); vol(c, P.hair, hx - R, hy - R, hx + R, hy);
  // face
  if (L.face) L.face(c, P, p, hx, hy); else defaultFace(c, P, p, hx, hy);
  L.hat(c, P, p, hx, hy, R);
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
  const P = { ...LOOKS[cls].pal, skin: '#ffe0c4', hair: kind === 'smith' ? '#e6e0d4' : '#1c1726', iris: kind === 'talshop' ? '#8a5ad8' : '#8a6a4a' };
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
