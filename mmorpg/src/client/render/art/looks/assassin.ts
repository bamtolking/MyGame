// 자객: charcoal hood and close-fitting outfit, a teal scarf wrapped over the lower face with long tails, twin 비수 in reverse grip.
import { type Ctx, INK, vol, circle, ellipse, rrect, fillC, line, inkLine, eye, shade } from '../core.ts';
import { type ClassLook, type Pal, type Pose, pose, WALK } from '../rig.ts';

const PAL: Pal = { robe: '#30343f', lining: '#1c7f78', sash: '#2fd4c4', pants: '#23262f', shoe: '#121319', skin: '#ffe0c4', hair: '#15131c', iris: '#27c2b2', cuff: '#2fd4c4' };
/** Back-arm angle above which the back hand stabs across the chest. */
const STAB = 1.3;
const TEAL = '#2fd4c4', HOOD = '#2a2d37', WRAP = '#4a5560', BRASS = '#d2ad52';

/** 비수 in reverse grip: the grip runs through the fist, ring pommel on the thumb side, blade out of the pinky side along +x. */
function dagger(c: Ctx, skin: string): void {
  circle(c, -6.4, 0, 2.1); c.strokeStyle = INK; c.lineWidth = 2.6; c.stroke(); c.strokeStyle = BRASS; c.lineWidth = 1.2; c.stroke();
  inkLine(c, [-7.5, 1.8, -9.5, 6.5], TEAL, 1.3);
  rrect(c, -4.8, -1.6, 9, 3.2, 1.2); fillC(c, '#2a2230', INK, 1.1);
  rrect(c, 3.4, -3.2, 2.4, 6.4, 1); fillC(c, BRASS, INK, 1.1);
  c.beginPath(); c.moveTo(5.6, -2); c.lineTo(18.5, -1.6); c.lineTo(23.5, 0); c.lineTo(18.5, 1.6); c.lineTo(5.6, 2); c.closePath();
  const g = c.createLinearGradient(0, -2, 0, 2); g.addColorStop(0, '#f6fdff'); g.addColorStop(0.5, '#c4dde2'); g.addColorStop(1, '#5d8088'); c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
  line(c, [7, -0.5, 20, -0.2], 'rgba(255,255,255,0.95)', 0.8); line(c, [7, 1, 18, 0.9], 'rgba(47,212,196,0.7)', 0.7);
  circle(c, 0, 0, 3.5); vol(c, skin, -3, -3, 3, 3, 1.5); line(c, [-1.6, -2.2, -1.6, 2.2], 'rgba(18,12,28,0.45)', 0.7); line(c, [0.6, -2.6, 0.6, 2.6], 'rgba(18,12,28,0.45)', 0.7);
}
/** Sharp, angry eye: the upper lid is cut by a line slanting down toward the nose, the brow follows it. */
function sharpEye(c: Ctx, x: number, y: number, s: number, iris: string, p: Pose, far: boolean): void {
  if (p.eyes === 'blink' || p.eyes === 'hurt') { eye(c, x, y, s, iris, p.eyes, far); return; }
  const yl = y - s * (far ? 0.28 : 0.78), yr = y - s * (far ? 0.78 : 0.28); // lid line: high at the outer corner
  c.save(); c.beginPath(); c.moveTo(x - s * 1.2, yl); c.lineTo(x + s * 1.2, yr); c.lineTo(x + s * 1.2, y + s * 1.3); c.lineTo(x - s * 1.2, y + s * 1.3); c.closePath(); c.clip();
  ellipse(c, x, y, s * 0.88, s); c.fillStyle = '#fbfaff'; c.fill();
  const g = c.createLinearGradient(x, y - s, x, y + s); g.addColorStop(0, shade(iris, -0.45)); g.addColorStop(0.6, iris); g.addColorStop(1, shade(iris, 0.5));
  ellipse(c, x + s * 0.12, y + s * 0.12, s * 0.64, s * 0.84); c.fillStyle = g; c.fill();
  ellipse(c, x + s * 0.14, y + s * 0.16, s * 0.24, s * 0.4); c.fillStyle = INK; c.fill();
  circle(c, x - s * 0.18, y - s * 0.02, s * 0.24); c.fillStyle = '#fff'; c.fill(); circle(c, x + s * 0.36, y + s * 0.5, s * 0.11); c.fill();
  ellipse(c, x, y, s * 0.88, s); c.strokeStyle = INK; c.lineWidth = 1.3; c.stroke(); c.restore();
  line(c, [x - s * 1.2, yl - 0.4, x + s * 1.2, yr - 0.4], INK, 2.2);
}
/** Tapered cloth tail from (x0, y0) bending through (cx, cy) to a point at (x1, y1). */
function tail(c: Ctx, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w: number, col: string): void {
  const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
  c.beginPath(); c.moveTo(x0 + nx, y0 + ny); c.quadraticCurveTo(cx + nx * 1.2, cy + ny * 1.2, x1 + nx * 0.25, y1 + ny * 0.25); c.lineTo(x1 - nx * 0.3, y1 - ny * 0.3); c.quadraticCurveTo(cx - nx * 0.8, cy - ny * 0.8, x0 - nx, y0 - ny); c.closePath();
  vol(c, col, Math.min(x0, x1), Math.min(y0, y1) - 4, Math.max(x0, x1), Math.max(y0, y1) + 4, 1.6, INK, 0.25, -0.3);
}
// wpn / extra = world angle (radians, CCW from facing direction) of the front / back dagger blade
export const assassin: ClassLook = {
  pal: PAL,
  frames: {
    idle0: pose({ lean: 0.05, legF: 0.16, legB: -0.2, armF: 0.55, armB: 0.35, wpn: -2.35, extra: -2.1, eyes: 'fierce' }),
    idle1: pose({ lean: 0.05, bob: 1, legF: 0.16, legB: -0.2, armF: 0.6, armB: 0.38, wpn: -2.4, extra: -2.15, eyes: 'fierce', step: 0.3 }),
    blink: pose({ lean: 0.05, legF: 0.16, legB: -0.2, armF: 0.55, armB: 0.35, wpn: -2.35, extra: -2.1, eyes: 'blink' }),
    walk0: pose({ ...WALK(-1.6, 0.5, 1), lean: 0.13, wpn: -2.6, extra: -2.3, eyes: 'fierce' }), walk1: pose({ ...WALK(0, 0.05, 0), lean: 0.13, wpn: -2.45, extra: -2.3, eyes: 'fierce' }),
    walk2: pose({ ...WALK(-1.6, -0.5, -1), lean: 0.13, wpn: -2.3, extra: -2.4, eyes: 'fierce' }), walk3: pose({ ...WALK(0, -0.05, 0), lean: 0.13, wpn: -2.45, extra: -2.3, eyes: 'fierce' }),
    atk0: pose({ bob: 3.5, lean: 0.2, legF: 0.55, legB: -0.55, armF: 1.05, armB: -0.95, wpn: -2.2, extra: -2.9, eyes: 'fierce', step: -0.6 }),
    atk1: pose({ bob: 2.5, lean: 0.32, legF: 0.85, legB: -0.8, armF: 0.72, armB: 1.5, wpn: -0.42, extra: -0.06, eyes: 'fierce', step: 1.3 }),
    atk2: pose({ bob: 1.5, lean: 0.14, legF: 0.55, legB: -0.45, armF: 0.85, armB: 1.05, wpn: -2.3, extra: -0.75, eyes: 'fierce', step: 0.6 }),
    hurt: pose({ lean: -0.28, bob: 1.5, armF: -0.9, armB: -1.1, wpn: -2.9, extra: -2.4, eyes: 'hurt' }),
  },
  hem: 13, sashTails: false,
  back: (c, _P, p) => {
    // sash knot tails at the back hip + scarf tails streaming behind the neck; longer and flatter on the lunge
    const fl = Math.max(0, p.lean) * 30 + Math.abs(p.step) * 2, w = p.step * 1.6 + p.bob * 0.6;
    tail(c, -9, -7, -15 - fl * 0.3, -2 + w * 0.3, -18 - fl * 0.5, 7 - fl * 0.4, 2.2, shade(TEAL, -0.12));
    tail(c, -7, -27, -16 - fl * 0.3, -20 - w * 0.5, -27 - fl * 0.3, -10 - fl * 0.6 - w, 3, shade(TEAL, -0.18));
    tail(c, -7, -29, -20 - fl * 0.4, -30 + w, -35 - fl * 0.2, -22 - fl * 0.5 + w * 1.5, 3.6, TEAL);
  },
  leg: (c, P, back) => {
    rrect(c, -3.5, -2, 7, 12, 3.2); vol(c, back ? shade(P.pants, -0.25) : P.pants, -4, 0, 4, 12);
    rrect(c, -3.3, 7.5, 6.6, 7.5, 2); vol(c, back ? shade(WRAP, -0.3) : WRAP, -3.3, 7.5, 3.3, 15, 1.5);
    for (const y of [9.5, 12.2]) line(c, [-3, y + 1.4, 3, y - 0.6], back ? 'rgba(18,12,28,0.5)' : 'rgba(18,12,28,0.45)', 0.8);
    ellipse(c, 1.8, 16.4, 5, 2.8); vol(c, back ? shade(P.shoe, -0.2) : P.shoe, -3, 13, 7, 19, 1.8);
  },
  sleeve: (c, P, back) => {
    c.beginPath(); c.moveTo(-5, -1); c.lineTo(5, -1); c.lineTo(4.6, 13); c.lineTo(-4.6, 13); c.closePath(); vol(c, back ? shade(P.robe, -0.3) : shade(P.robe, 0.1), -5, 0, 5, 13);
    for (const y of [5.5, 8.6]) line(c, [-4.6, y + 1, 4.6, y - 0.8], back ? 'rgba(110,125,140,0.55)' : 'rgba(150,168,182,0.8)', 1.2);
  },
  torso: (c, _P, _p, sw) => {
    // teal piping along the opening + a leather cross strap with throwing blades
    c.beginPath(); c.moveTo(1, -22); c.quadraticCurveTo(5, -4, 9 + sw, 12); c.strokeStyle = TEAL; c.lineWidth = 1.2; c.stroke();
    c.beginPath(); c.moveTo(8.5, -23); c.lineTo(-11, -7); c.strokeStyle = INK; c.lineWidth = 5; c.stroke(); c.strokeStyle = '#4a3a34'; c.lineWidth = 3; c.stroke();
    for (const t of [0.3, 0.5]) { const x = 8.5 - 19.5 * t, y = -23 + 16 * t; c.beginPath(); c.moveTo(x - 1.2, y - 1.5); c.lineTo(x + 3.2, y - 6.5); c.lineTo(x + 1.6, y + 0.2); c.closePath(); fillC(c, '#dfeef2', INK, 0.9); }
  },
  face: (c, P, p, hx, hy) => { sharpEye(c, hx - 2.5, hy + 1.6, 3.9, P.iris, p, false); sharpEye(c, hx + 8.2, hy + 1.6, 3.5, P.iris, p, true); },
  hat: (c, P, _p, hx, hy, R) => {
    const wx = hx + 3.5, wy = hy + 2.8, wr = 12.8, wh = 8.2;
    // own fringe inside the face opening (hides the rig bangs)
    c.save(); c.beginPath(); c.ellipse(wx, wy, wr, wh, 0.05, 0, Math.PI * 2); c.clip();
    c.beginPath(); c.moveTo(hx - 11, hy - 9); c.lineTo(hx + 18, hy - 9); c.lineTo(hx + 17, hy - 3.5); c.lineTo(hx + 13.5, hy - 2.4); c.lineTo(hx + 11.5, hy - 4.8); c.lineTo(hx + 6.6, hy - 2.2);
    c.lineTo(hx + 3.6, hy - 5); c.lineTo(hx - 0.2, hy - 2.4); c.lineTo(hx - 3.4, hy - 5); c.lineTo(hx - 7.5, hy - 2.2); c.lineTo(hx - 11, hy - 3.5); c.closePath();
    vol(c, P.hair, hx - 10, hy - 8, hx + 16, hy, 1.6); c.restore();
    // hood with the face opening (even-odd cut)
    c.beginPath(); c.arc(hx - 0.5, hy - 1, R + 3, 0, Math.PI * 2); c.ellipse(wx, wy, wr, wh, 0.05, 0, Math.PI * 2);
    const g = c.createLinearGradient(hx - R, hy - R, hx + R, hy + R); g.addColorStop(0, shade(HOOD, 0.28)); g.addColorStop(0.5, HOOD); g.addColorStop(1, shade(HOOD, -0.3));
    c.fillStyle = g; c.fill('evenodd'); c.strokeStyle = INK; c.lineWidth = 2.2; c.stroke();
    c.beginPath(); c.ellipse(wx, wy, wr + 1.3, wh + 1.3, 0.05, Math.PI * 1.08, Math.PI * 1.92); c.strokeStyle = shade(TEAL, -0.15); c.lineWidth = 1.1; c.stroke();
    line(c, [hx - 13, hy - 6, hx - 7, hy - 15], 'rgba(170,180,210,0.3)', 1.3);
    // bandana scarf over the mouth and neck, point hanging in front (hides the collar)
    c.beginPath(); c.moveTo(hx - 10.5, hy + 5.8); c.quadraticCurveTo(hx + 1, hy + 4.6, hx + 6.6, hy + 5.4); c.quadraticCurveTo(hx + 12, hy + 4.4, hx + 16.8, hy + 6.2);
    c.quadraticCurveTo(hx + 17, hy + 13, hx + 11.5, hy + 17); c.lineTo(hx + 12, hy + 19.5); c.lineTo(hx + 1.2, hy + 28.5); c.lineTo(hx - 10, hy + 19.5);
    c.quadraticCurveTo(hx - 13.5, hy + 12, hx - 10.5, hy + 5.8); c.closePath();
    vol(c, TEAL, hx - 12, hy + 3, hx + 16, hy + 28, 2, INK, 0.3, -0.32);
    line(c, [hx - 9, hy + 17.5, hx + 2, hy + 18.8, hx + 11.5, hy + 17], 'rgba(18,12,28,0.4)', 1.1);
    line(c, [hx - 8, hy + 11, hx + 4, hy + 12, hx + 14, hy + 10], 'rgba(18,12,28,0.2)', 1);
    line(c, [hx - 7, hy + 8, hx + 5, hy + 7.4], 'rgba(255,255,255,0.4)', 1);
  },
  hand: (c, P, p, back) => {
    if (back && p.armB > STAB) return; // the stabbing back hand is drawn in front of the chest (front hook)
    const a = back ? p.armB : p.armF, w = back ? p.extra : p.wpn;
    c.save(); c.rotate(a - w - p.lean); dagger(c, back ? shade(P.skin, -0.2) : P.skin); c.restore();
  },
  front: (c, P, p) => {
    if (p.armB <= STAB) return;
    // cross-body stab: forearm, cuff, fist and dagger of the back arm over the chest
    c.save(); c.translate(-6, -20); c.rotate(-p.armB);
    c.beginPath(); c.moveTo(-4.9, 3); c.lineTo(4.9, 3); c.lineTo(4.6, 13); c.lineTo(-4.6, 13); c.closePath(); vol(c, shade(P.robe, -0.12), -5, 3, 5, 13);
    line(c, [-4.6, 9.6, 4.6, 7.8], 'rgba(150,168,182,0.7)', 1.2);
    rrect(c, -5.5, 11.5, 11, 3.2, 1.5); fillC(c, shade(P.cuff, -0.12), INK, 1.4);
    circle(c, 0, 17, 3.4); vol(c, shade(P.skin, -0.08), -3, 14, 3, 20, 1.6);
    c.translate(0, 17); c.rotate(p.armB - p.extra - p.lean); dagger(c, shade(P.skin, -0.08)); c.restore();
  },
  weaponIcon: (c, tc) => {
    // two 비수 crossed mid-blade (handles apart so it never reads as scissors)
    for (const s of [-1, 1]) {
      c.save(); c.translate(24, 19); c.rotate(s * 0.66); c.translate(0, 12);
      inkLine(c, [0, 11, s * 2.5, 16.5], TEAL, 1.5);
      c.beginPath(); c.moveTo(-3.2, -4); c.lineTo(-2.6, -24); c.lineTo(0, -31); c.lineTo(2.6, -24); c.lineTo(3.2, -4); c.closePath(); vol(c, tc, -3, -31, 3, -4, 1.7, INK, 0.5, -0.3);
      line(c, [0, -6, 0, -27], 'rgba(255,255,255,0.65)', 0.9);
      rrect(c, -2.3, 0, 4.6, 9, 1.8); vol(c, '#2a2230', -2.3, 0, 2.3, 9, 1.3); line(c, [-2.2, 3, 2.2, 5], TEAL, 1.1); line(c, [-2.2, 6, 2.2, 8], TEAL, 1.1);
      rrect(c, -7, -4.5, 14, 4.5, 2); vol(c, BRASS, -7, -4.5, 7, 0, 1.4);
      circle(c, 0, 10.4, 2.5); vol(c, BRASS, -2.5, 8, 2.5, 13, 1.3);
      c.restore();
    }
  },
};
