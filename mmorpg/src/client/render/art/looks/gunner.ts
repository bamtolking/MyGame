// 포수: black felt 벙거지 with a hanging red tassel, vermilion jacket, leather bandolier with powder flasks, 조총 matchlock.
import { type Ctx, INK, vol, circle, ellipse, rrect, poly, fillC, line, glowDot } from '../core.ts';
import { type ClassLook, type Pal, type Pose, pose, WALK } from '../rig.ts';

const PAL: Pal = { robe: '#dc4128', lining: '#f1e4c8', sash: '#2a2026', pants: '#2b2a3e', shoe: '#2a1c16', skin: '#ffdcbf', hair: '#1e1620', iris: '#c8642e', cuff: '#231c2a' };
const WOOD = '#6e3a22', IRON = '#5a6274', BRASS = '#d8a84a';
/**
 * 조총 in gun space: x along the barrel (muzzle at +31.5), y down, origin at the wrist of the stock; drawn shifted so that
 * `hold` (the gun-space x under the hand) sits at the hand. `down` = world-down in gun space (the match cord hangs that way).
 * mode: 0 carry, 1 aim, 2 fire (serpentine snapped, flash in the pan, muzzle flash), 3 recover (smoke wisp).
 */
function musket(c: Ctx, hold: number, dx: number, dy: number, mode: number): void {
  c.save(); c.translate(-hold, 0);
  // match cord: from the serpentine back over the wrist, hanging in a loop toward world-down
  const jx = mode === 2 ? -1.5 : -3, jy = mode === 2 ? -3 : -6.4;
  c.beginPath(); c.moveTo(jx - 0.5, jy); c.bezierCurveTo(-9, -6, -9 + dx * 9, dy * 9, -6 + dx * 11, dy * 11 + 1); c.bezierCurveTo(-3 + dx * 8, dy * 8 + 2, -12 + dx * 3, 2 + dy * 3, -14, 1.5);
  c.strokeStyle = INK; c.lineWidth = 2.4; c.stroke(); c.strokeStyle = '#b08a5a'; c.lineWidth = 1.1; c.stroke();
  // stock: slanted tanegashima butt, wrist, long forestock
  c.beginPath(); c.moveTo(-17, -1.4); c.lineTo(-4, -1.6); c.lineTo(24.5, -1.3); c.quadraticCurveTo(26.2, 0.2, 24.5, 1.6); c.lineTo(3, 2.6); c.quadraticCurveTo(-0.5, 3.4, -3, 4); c.lineTo(-16.5, 7.8); c.quadraticCurveTo(-18.6, 3, -17, -1.4); c.closePath();
  vol(c, WOOD, -17, -2, -10, 8, 1.8, INK, 0.25, -0.35);
  line(c, [-14, 1.5, -4, 0.6, 22, 0.4], 'rgba(255,220,180,0.28)', 0.8);
  // barrel (octagonal iron, flared muzzle), sights, brass bands
  rrect(c, -7.5, -4.6, 38, 3.4, 1); vol(c, IRON, -7.5, -4.6, 30.5, -1.2, 1.6, INK, 0.4, -0.3);
  rrect(c, 29.2, -5.1, 2.6, 4.4, 0.8); vol(c, IRON, 29, -5, 32, -0.7, 1.4, INK, 0.4, -0.3);
  line(c, [-5.5, -3.8, 28.5, -3.8], 'rgba(255,255,255,0.55)', 0.8);
  poly(c, [27, -4.6, 28.2, -6.4, 29, -4.6]); fillC(c, BRASS, INK, 1); poly(c, [-3.6, -4.6, -2.6, -6, -1.6, -4.6]); fillC(c, BRASS, INK, 1);
  for (const bx of [7, 18]) { rrect(c, bx, -4.9, 1.8, 7.3, 0.6); fillC(c, BRASS, INK, 1); }
  // lock plate, pan, trigger, serpentine (용두) holding the glowing match
  rrect(c, -7, -1.4, 9.5, 3, 1); fillC(c, BRASS, INK, 1.1); circle(c, -4.5, 0.1, 0.7); c.fillStyle = INK; c.fill();
  rrect(c, -1.2, -2.4, 3.8, 1.8, 0.6); fillC(c, BRASS, INK, 1);
  line(c, [-3.2, 3.8, -3.6, 5.6, -2.6, 7], INK, 1.6);
  c.beginPath(); c.moveTo(-5.2, 0); c.quadraticCurveTo(-7.2, (jy - 0.5) * 0.6, jx - 0.8, jy - 0.4); c.strokeStyle = INK; c.lineWidth = 3; c.stroke(); c.strokeStyle = BRASS; c.lineWidth = 1.4; c.stroke();
  glowDot(c, jx + 0.4, jy - 0.3, mode === 2 ? 3 : 4.2, 'rgba(255,150,50,0.95)'); circle(c, jx + 0.4, jy - 0.3, 1); c.fillStyle = '#fff2b0'; c.fill();
  if (mode === 2) {
    // flash in the pan + muzzle blast
    glowDot(c, 0.8, -3.6, 5, 'rgba(255,210,120,0.9)');
    poly(c, [31.5, -6.4, 35, -9.5, 34.5, -5.4, 39.5, -3, 34.5, -0.6, 35, 3.5, 31.5, 0.6]); fillC(c, '#ff8a2a', INK, 1.2);
    poly(c, [31.8, -4.8, 35.5, -3, 31.8, -1]); c.fillStyle = '#fff4c0'; c.fill();
  }
  if (mode >= 2) {
    // gun smoke curling up from the muzzle (and the pan when firing)
    const puff = (x: number, y: number, r: number, a: number) => { circle(c, x, y, r); c.fillStyle = `rgba(236,230,222,${a})`; c.fill(); c.strokeStyle = `rgba(18,12,28,${a * 0.7})`; c.lineWidth = 1.1; c.stroke(); };
    if (mode === 3) { puff(29 + dy * -3, -8 - dy * 2, 2.6, 0.8); puff(26.5 + dy * -6, -12 - dy * 3, 2, 0.6); puff(28 + dy * -9, -15.5 - dy * 4, 1.4, 0.45); }
  }
  c.restore();
}
/** Gun angle in torso space per pose (wpn) and where along the gun the front hand holds it. */
const HOLD = [0, 14, 19, 13];
function gun(c: Ctx, p: Pose): void {
  const m = p.extra | 0, th = p.wpn; c.save(); c.rotate(p.armF + th);
  // aiming: the back hand grips the wrist of the stock from below (the real back arm is hidden behind the gun)
  if (m) { ellipse(c, -HOLD[m] - 1, 2.6, 3.4, 3); vol(c, '#e6bf9e', -HOLD[m] - 4, 0, -HOLD[m] + 2, 5.6, 1.3, INK, 0.1, -0.2); }
  const w = th + p.lean; musket(c, HOLD[m] ?? 0, Math.sin(w), Math.cos(w), m);
  // carrying: the back hand (arm hidden behind the body) wraps the forestock above the front hand
  if (!m && p.armB > 0.3) { rrect(c, 8.6, -3.2, 5.4, 5, 2.2); vol(c, '#ecc6a6', 8.4, -3.2, 14, 1.8, 1.3, INK, 0.15, -0.2); }
  // fingers wrapped over the stock
  rrect(c, -2.8, m ? -2.6 : -2.2, 5.6, 4.8, 2.2); vol(c, PAL.skin, -3, -2.6, 3, 2.4, 1.3, INK, 0.2, -0.15);
  c.restore();
}
function flask(c: Ctx, x: number, y: number, r: number): void {
  c.save(); c.translate(x, y); c.rotate(r); line(c, [0, -1.5, 0, 1], INK, 1.2);
  rrect(c, -1.9, 1, 3.8, 5.6, 1.4); vol(c, '#c8903e', -2, 1, 2, 6.6, 1.1, INK, 0.35, -0.3); rrect(c, -1.3, 0.2, 2.6, 1.6, 0.6); fillC(c, '#c8323a', INK, 0.8);
  c.restore();
}
export const gunner: ClassLook = {
  pal: PAL,
  frames: {
    idle0: pose({ armF: 0.3, armB: 0.45, wpn: -1.05 }), idle1: pose({ bob: 1, armF: 0.33, armB: 0.48, wpn: -1.05 }), blink: pose({ eyes: 'blink', armF: 0.3, armB: 0.45, wpn: -1.05 }),
    walk0: pose({ ...WALK(-1.6, 0.5, 1), armF: 0.12, armB: 0.45, wpn: -1.0 }), walk1: pose({ ...WALK(0, 0.05, 0), armF: 0.26, armB: 0.45, wpn: -1.0 }), walk2: pose({ ...WALK(-1.6, -0.5, -1), armF: 0.44, armB: 0.45, wpn: -1.0 }), walk3: pose({ ...WALK(0, -0.05, 0), armF: 0.28, armB: 0.45, wpn: -1.0 }),
    atk0: pose({ lean: 0.06, armF: 1.9, armB: 1.9, wpn: 0, extra: 1, eyes: 'fierce', legF: 0.3, legB: -0.3 }),
    atk1: pose({ lean: -0.13, bob: 0.5, armF: 1.95, armB: 1.95, wpn: -0.1, extra: 2, eyes: 'fierce', legF: 0.38, legB: -0.36, step: -0.8 }),
    atk2: pose({ lean: -0.04, armF: 1.7, armB: 1.7, wpn: 0.1, extra: 3, eyes: 'fierce', legF: 0.22, legB: -0.22, step: -0.3 }),
    hurt: pose({ lean: -0.28, bob: 1.5, armF: -0.7, armB: -1.1, eyes: 'hurt', wpn: -0.4 }),
  },
  hem: 12, sashTails: false,
  leg: (c, P, back) => {
    // dark trousers, white 행전 leg wraps, leather shoes
    rrect(c, -3.8, -2, 7.6, 17, 3.4); vol(c, back ? '#1f1e2e' : P.pants, -4, 0, 4, 16);
    rrect(c, -3.9, 6.5, 7.8, 6.5, 1.6); vol(c, back ? '#bdb4a2' : '#ece3d0', -4, 6.5, 4, 13, 1.4); line(c, [-3, 8.5, 3, 10.5], 'rgba(18,12,28,0.35)', 0.8);
    ellipse(c, 1.8, 16.5, 5.2, 3); vol(c, back ? '#1d140f' : P.shoe, -3, 13, 7, 19, 1.8);
  },
  torso: (c) => {
    // bandolier over the front shoulder with powder flasks, leather pouch at the hip
    c.beginPath(); c.moveTo(4, -24); c.lineTo(8.5, -23); c.lineTo(-6.5, -6); c.lineTo(-11, -7.5); c.closePath(); vol(c, '#7a4a26', -11, -24, 8, -6, 1.5, INK, 0.3, -0.3);
    for (const k of [0.2, 0.62]) { const x = 6 + (-8.6 - 6) * k, y = -23.5 + 16.5 * k; rrect(c, x - 1.6, y - 1.2, 3.2, 2.4, 0.6); fillC(c, BRASS, INK, 0.8); }
    flask(c, 2.2, -18, 0.15); flask(c, -1.6, -13.8, 0.12); flask(c, -5.4, -9.6, 0.1);
    rrect(c, 4.5, -7, 8, 8.5, 2.2); vol(c, '#8a5430', 4.5, -7, 12.5, 1.5, 1.5); rrect(c, 4.2, -7.4, 8.6, 3.4, 1.4); vol(c, '#6a3c20', 4, -7.4, 13, -4, 1.2); circle(c, 8.5, -4.2, 1); c.fillStyle = BRASS; c.fill();
  },
  hat: (c, _P, p, hx, hy) => {
    // 벙거지: wide black felt brim, low round crown, red band, brass knob; tassel roots at the knob
    c.beginPath(); c.ellipse(hx + 1, hy - 11.5, 25, 6, -0.05, 0, Math.PI * 2); vol(c, '#221c2c', hx - 24, hy - 17, hx + 26, hy - 6, 2, INK, 0.25, -0.25);
    c.beginPath(); c.ellipse(hx + 1, hy - 11.5, 21, 4.4, -0.05, 0.1, Math.PI - 0.1); c.strokeStyle = 'rgba(160,150,200,0.35)'; c.lineWidth = 0.9; c.stroke();
    c.beginPath(); c.ellipse(hx + 1, hy - 13, 12.5, 12, 0, Math.PI, 0); c.quadraticCurveTo(hx + 1, hy - 10.5, hx - 11.5, hy - 13); c.closePath(); vol(c, '#1e1826', hx - 12, hy - 25, hx + 14, hy - 12, 2, INK, 0.3, -0.2);
    rrect(c, hx - 11.2, hy - 17, 24.4, 3.4, 1.2); fillC(c, '#c8283e', INK, 1.2);
    // red horsehair tassel from the knob, swept back over the crown and hanging behind the brim
    const s = p.step * 1.2 - p.lean * 8;
    c.beginPath(); c.moveTo(hx + 1, hy - 27); c.quadraticCurveTo(hx - 9, hy - 28, hx - 13 + s * 0.5, hy - 17); c.quadraticCurveTo(hx - 15 + s, hy - 10, hx - 18 + s, hy - 3); c.quadraticCurveTo(hx - 14 + s, hy - 4.5, hx - 11.5 + s, hy - 6);
    c.quadraticCurveTo(hx - 9.5 + s * 0.5, hy - 12, hx - 8, hy - 18); c.quadraticCurveTo(hx - 5, hy - 23, hx + 1, hy - 23.5); c.closePath(); vol(c, '#e3304a', hx - 16, hy - 28, hx, hy - 4, 1.6, INK, 0.25, -0.35);
    for (const k of [0, 1]) line(c, [hx - 2 - k * 2, hy - 25.5 + k * 1.2, hx - 10 - k * 1.5 + s * 0.4, hy - 18 + k, hx - 14 - k * 1.2 + s, hy - 7 + k], 'rgba(120,10,30,0.7)', 0.9);
    circle(c, hx + 1, hy - 25.5, 3); vol(c, BRASS, hx - 2, hy - 28.5, hx + 4, hy - 22.5, 1.4, INK, 0.45, -0.3);
  },
  hand: (c, _P, p, back) => { if (!back) gun(c, p); },
  weaponIcon: (c, tc) => {
    c.save(); c.translate(24.5, 25); c.rotate(-0.72); c.scale(0.9, 0.9);
    c.beginPath(); c.moveTo(-26, -1.4); c.lineTo(-13, -1.6); c.lineTo(17, -1.3); c.quadraticCurveTo(19, 0.3, 17, 2); c.lineTo(-6, 3.2); c.quadraticCurveTo(-10, 4.2, -12, 5); c.lineTo(-25, 9.4); c.quadraticCurveTo(-27.8, 4, -26, -1.4); c.closePath();
    vol(c, WOOD, -26, -2, -18, 9, 1.8, INK, 0.3, -0.35);
    rrect(c, -16, -5.4, 40, 4, 1.2); vol(c, tc, -16, -5.4, 24, -1.4, 1.7, INK, 0.45, -0.3); rrect(c, 22.5, -6, 3, 5.2, 0.8); vol(c, tc, 22.5, -6, 25.5, -0.8, 1.4, INK, 0.45, -0.3);
    line(c, [-14, -4.4, 22, -4.4], 'rgba(255,255,255,0.6)', 0.9);
    for (const bx of [-1, 11]) { rrect(c, bx, -5.8, 2, 8.4, 0.6); fillC(c, BRASS, INK, 1); }
    rrect(c, -15, -1.4, 9, 3.2, 1); fillC(c, BRASS, INK, 1.1);
    c.beginPath(); c.moveTo(-13.5, 0); c.quadraticCurveTo(-15.5, -4.4, -11.5, -7.2); c.strokeStyle = INK; c.lineWidth = 3; c.stroke(); c.strokeStyle = BRASS; c.lineWidth = 1.4; c.stroke();
    glowDot(c, -10.8, -7.6, 5, 'rgba(255,150,50,0.95)'); circle(c, -10.8, -7.6, 1.2); c.fillStyle = '#fff2b0'; c.fill();
    c.restore();
  },
};
