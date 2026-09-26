// 수문장: steel 투구 with a red 삭모 plume and studded neck guards, navy 두정갑 with brass studs, big round 태극 shield, iron 철퇴.
import { type Ctx, INK, vol, circle, ellipse, rrect, poly, fillC, line, inkLine, shade } from '../core.ts';
import { type ClassLook, type Pal, pose, WALK } from '../rig.ts';

const PAL: Pal = { robe: '#2b3b7c', lining: '#c8323a', sash: '#e2a93a', pants: '#252a46', shoe: '#1a1620', skin: '#ffdcbf', hair: '#1c1624', iris: '#b8862a', cuff: '#c8323a' };
const GOLD = '#f2c14a', STUD = '#ffd866', STEEL = '#a4b0c6', IRON = '#5d6579', RED = '#d23440', CRIMSON = '#b8283a', NAVY = '#26336a', WOOD = '#6e4526';
const HEM = 14;

/** Round shield centred at the origin: rim (gold) with rivets, crimson field, gold/navy 태극 boss.
 *  f < 1 turns the face toward the facing direction (the rim edge shows on the back side). */
function shield(c: Ctx, r: number, f: number, rim = GOLD): void {
  const oval = (x: number, y: number, rr: number) => ellipse(c, x, y, rr * f, rr);
  if (f < 0.98) { // disc thickness
    const t = 1.4 + (1 - f) * 7; c.beginPath(); c.ellipse(-t, 0, r * f, r, 0, -Math.PI / 2, Math.PI / 2, true); c.lineTo(0, r); c.ellipse(0, 0, r * f, r, 0, Math.PI / 2, -Math.PI / 2, true); c.closePath();
    vol(c, shade(rim, -0.45), -r - t, -r, 0, r, 2, INK, 0.1, -0.3);
  }
  oval(0, 0, r); vol(c, rim, -r * f, -r, r * f, r, 2, INK, 0.4, -0.35);
  const ri = r - 3.3; oval(0, 0, ri); const g = c.createRadialGradient(-ri * 0.35 * f, -ri * 0.4, 1, 0, 0, ri); g.addColorStop(0, shade(CRIMSON, 0.25)); g.addColorStop(1, shade(CRIMSON, -0.3)); fillC(c, g, INK, 1.3);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + 0.26; circle(c, Math.cos(a) * (r - 1.65) * f, Math.sin(a) * (r - 1.65), 0.8); c.fillStyle = shade(rim, -0.55); c.fill(); }
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; circle(c, Math.cos(a) * (ri - 2.6) * f, Math.sin(a) * (ri - 2.6), 1.1); fillC(c, STUD, INK, 0.8); }
  // 태극 boss
  const R = r * 0.42; const sc = (fn: () => void) => { c.save(); c.scale(f, 1); fn(); c.restore(); };
  sc(() => circle(c, 0, 0, R + 1.3)); fillC(c, '#fff1c8', INK, 1.1);
  sc(() => circle(c, 0, 0, R)); c.fillStyle = NAVY; c.fill();
  sc(() => { c.beginPath(); c.arc(0, 0, R, Math.PI, 0); c.arc(R / 2, 0, R / 2, 0, Math.PI); c.arc(-R / 2, 0, R / 2, 0, Math.PI, true); c.closePath(); }); c.fillStyle = GOLD; c.fill();
  sc(() => circle(c, 0, 0, R)); c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
  // glint on the rim
  c.beginPath(); c.ellipse(0, 0, (r - 1) * f, r - 1, 0, Math.PI * 1.08, Math.PI * 1.42); c.strokeStyle = 'rgba(255,255,240,0.85)'; c.lineWidth = 1.2; c.stroke();
}
/** 철퇴: wooden haft through the fist, flanged iron head up (−y). */
function mace(c: Ctx, skin: string): void {
  inkLine(c, [0, 7, 0, -12], WOOD, 2.4); inkLine(c, [0, 6, 1.8, 10.5], RED, 1.1);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; poly(c, [Math.cos(a - 0.3) * 3.4, -16 + Math.sin(a - 0.3) * 3.4, Math.cos(a) * 7, -16 + Math.sin(a) * 7, Math.cos(a + 0.3) * 3.4, -16 + Math.sin(a + 0.3) * 3.4]); vol(c, IRON, -7, -23, 7, -9, 1.2, INK, 0.35, -0.3); }
  circle(c, 0, -16, 4.4); vol(c, IRON, -4.4, -20.4, 4.4, -11.6, 1.5, INK, 0.45, -0.3);
  poly(c, [-1.2, -20, 0, -23.5, 1.2, -20]); fillC(c, IRON, INK, 1);
  rrect(c, -2.2, -12.2, 4.4, 2.2, 0.8); fillC(c, GOLD, INK, 0.9);
  circle(c, -1.4, -17.4, 1.1); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fill();
  circle(c, 0, 0, 3.4); vol(c, skin, -3, -3, 3, 3, 1.5); line(c, [-2.4, -1, 2.4, -1], 'rgba(18,12,28,0.4)', 0.7); line(c, [-2.4, 1.2, 2.4, 1.2], 'rgba(18,12,28,0.4)', 0.7);
}
const robe = (c: Ctx, sw: number) => { c.beginPath(); c.moveTo(-9, -24); c.lineTo(9, -24); c.quadraticCurveTo(13, -4, 16 + sw, HEM); c.quadraticCurveTo(0, HEM + 3, -15 + sw * 0.6, HEM); c.quadraticCurveTo(-12, -4, -9, -24); c.closePath(); };
const stud = (c: Ctx, x: number, y: number, r = 0.85) => { circle(c, x, y, r); c.fillStyle = STUD; c.fill(); circle(c, x + 0.35, y + 0.35, r * 0.5); c.fillStyle = 'rgba(90,50,10,0.55)'; c.fill(); };

// wpn = world tilt of the mace (radians, + = forward); extra = shield turn (0 face-on … 1 turned to the front) and ≥ 1 = slam streaks
export const guardian: ClassLook = {
  pal: PAL,
  frames: {
    idle0: pose({ armF: 0.3, armB: -0.28, wpn: -0.45, extra: 0.4 }), idle1: pose({ bob: 1, armF: 0.33, armB: -0.25, wpn: -0.42, extra: 0.4 }), blink: pose({ eyes: 'blink', armF: 0.3, armB: -0.28, wpn: -0.45, extra: 0.4 }),
    walk0: pose({ ...WALK(-1.6, 0.5, 1), armF: 0.14, armB: 0.3, wpn: -0.3, extra: 0.4 }), walk1: pose({ ...WALK(0, 0.05, 0), armF: 0.28, armB: -0.1, wpn: -0.4, extra: 0.4 }),
    walk2: pose({ ...WALK(-1.6, -0.5, -1), armF: 0.44, armB: -0.55, wpn: -0.5, extra: 0.4 }), walk3: pose({ ...WALK(0, -0.05, 0), armF: 0.3, armB: -0.15, wpn: -0.4, extra: 0.4 }),
    atk0: pose({ bob: 1.5, lean: -0.16, armF: -0.45, armB: 0.35, wpn: -0.1, extra: 0.05, eyes: 'fierce', legF: 0.35, legB: -0.35, step: -0.6 }),
    atk1: pose({ bob: 1.5, lean: 0.26, armF: 1.5, armB: -0.75, wpn: -0.9, extra: 1, eyes: 'fierce', legF: 0.7, legB: -0.5, step: 1 }),
    atk2: pose({ bob: 1, lean: 0.1, armF: 0.95, armB: -0.4, wpn: -0.6, extra: 0.7, eyes: 'fierce', legF: 0.4, legB: -0.3, step: 0.5 }),
    hurt: pose({ lean: -0.28, bob: 1.5, armF: -0.6, armB: -1.1, wpn: -0.35, extra: 0.1, eyes: 'hurt' }),
  },
  hem: HEM, sashTails: false,
  leg: (c, P, back) => {
    rrect(c, -3.8, -2, 7.6, 12, 3.4); vol(c, back ? shade(P.pants, -0.25) : P.pants, -4, 0, 4, 12);
    // 목화: tall black boot with a turned-up toe, red top band
    c.beginPath(); c.moveTo(-4.1, 5.5); c.lineTo(4.3, 5.5); c.lineTo(4.5, 13.5); c.quadraticCurveTo(8.8, 13.6, 7.8, 18.8); c.lineTo(-3.6, 19.2); c.quadraticCurveTo(-4.8, 15, -4.1, 5.5); c.closePath();
    vol(c, back ? '#120e18' : '#241d2e', -4, 5, 8, 19, 1.8, INK, 0.25, -0.2);
    rrect(c, -4.4, 4.6, 9.1, 2.6, 1); fillC(c, back ? shade(RED, -0.3) : RED, INK, 1.1);
    line(c, [-3.2, 18.4, 7.2, 18.2], back ? '#8a8272' : '#e8dcc0', 1);
  },
  sleeve: (c, P, back) => {
    c.beginPath(); c.moveTo(-5, -1); c.lineTo(5, -1); c.lineTo(6.5, 13); c.lineTo(-6.5, 13); c.closePath(); vol(c, back ? shade(P.robe, -0.3) : P.robe, -6, 0, 6, 13);
    for (const [x, y] of [[-3, 8], [0, 9.5], [3, 8]]) { circle(c, x, y, 0.75); c.fillStyle = back ? shade(STUD, -0.35) : STUD; c.fill(); }
    // 견갑: studded shoulder guard
    c.beginPath(); c.moveTo(-7.6, 5.2); c.quadraticCurveTo(-8.4, -5, 0, -5.4); c.quadraticCurveTo(8.4, -5, 7.6, 5.2); c.quadraticCurveTo(0, 8, -7.6, 5.2); c.closePath();
    vol(c, back ? shade(NAVY, -0.3) : NAVY, -8, -5, 8, 7, 1.8, INK, 0.35, -0.25);
    c.beginPath(); c.moveTo(-7.2, 4.2); c.quadraticCurveTo(0, 7, 7.2, 4.2); c.strokeStyle = back ? shade(RED, -0.3) : RED; c.lineWidth = 1.6; c.stroke();
    for (const [x, y] of [[-4, 1], [0, 2], [4, 1], [-2, -2.2], [2, -2.2]]) { circle(c, x, y, 0.85); c.fillStyle = back ? shade(STUD, -0.35) : STUD; c.fill(); }
  },
  torso: (c, _P, _p, sw) => {
    // 두정갑: quilted panels, rows of brass studs (not over the red lining), gold hem band
    c.save(); robe(c, sw); c.clip();
    for (const y of [-15, -4, 6]) { c.beginPath(); c.moveTo(-20, y); c.quadraticCurveTo(0, y + 2, 22 + sw, y); c.strokeStyle = 'rgba(10,8,30,0.5)'; c.lineWidth = 1; c.stroke(); }
    for (let row = 0; row < 8; row++) for (let col = 0; col < 9; col++) {
      const y = -21.5 + row * 5, k = (y + 24) / (HEM + 24), x = -17 + col * 4.4 + (row % 2) * 2.2 + sw * k;
      const l0 = 1 + k * 8 + sw * k - 1, l1 = 6 + k * 9 + sw * k + 1.2; if (x > l0 && x < l1) continue;
      stud(c, x, y);
    }
    c.beginPath(); c.moveTo(-20, HEM - 2.2); c.quadraticCurveTo(0, HEM + 1, 22 + sw, HEM - 2.2); c.strokeStyle = INK; c.lineWidth = 4.4; c.stroke(); c.strokeStyle = GOLD; c.lineWidth = 2.4; c.stroke();
    c.restore();
    c.beginPath(); c.moveTo(1, -22); c.quadraticCurveTo(5, -4, 9 + sw, HEM - 1); c.strokeStyle = GOLD; c.lineWidth = 1.3; c.stroke();
  },
  hat: (c, _P, p, hx, hy) => {
    const s = p.step * 1.2 - p.lean * 10;
    // 삭모: red horsehair plume from the spike, streaming back behind the helmet
    c.beginPath(); c.moveTo(hx + 1, hy - 27); c.quadraticCurveTo(hx - 10, hy - 30, hx - 17 + s * 0.5, hy - 21); c.quadraticCurveTo(hx - 22 + s, hy - 13, hx - 23 + s, hy - 3);
    c.quadraticCurveTo(hx - 18 + s, hy - 7, hx - 15 + s * 0.6, hy - 12); c.quadraticCurveTo(hx - 9, hy - 21, hx - 1, hy - 23); c.closePath();
    vol(c, '#e3304a', hx - 22, hy - 30, hx, hy - 4, 1.7, INK, 0.25, -0.35);
    for (const k of [0, 1]) line(c, [hx - 2 - k * 2, hy - 26 + k * 1.4, hx - 12 - k + s * 0.4, hy - 22 + k * 1.5, hx - 19 - k * 1.5 + s, hy - 9 + k], 'rgba(120,10,30,0.7)', 0.9);
    // 드림: studded neck guard behind, narrow cheek guard in front
    c.beginPath(); c.moveTo(hx - 17, hy - 9); c.quadraticCurveTo(hx - 21, hy + 3, hx - 19, hy + 14); c.quadraticCurveTo(hx - 14, hy + 15.5, hx - 9, hy + 13); c.quadraticCurveTo(hx - 9.5, hy + 2, hx - 8, hy - 8); c.closePath();
    vol(c, STEEL, hx - 20, hy - 9, hx - 8, hy + 14, 1.8, INK, 0.2, -0.4);
    for (const y of [0, 6]) { c.beginPath(); c.moveTo(hx - 20.4, hy + y); c.quadraticCurveTo(hx - 14.5, hy + y + 1.6, hx - 8.8, hy + y - 0.6); c.strokeStyle = 'rgba(30,34,56,0.65)'; c.lineWidth = 1; c.stroke(); }
    c.beginPath(); c.moveTo(hx - 19, hy + 12.4); c.quadraticCurveTo(hx - 14, hy + 13.8, hx - 9.4, hy + 11.4); c.strokeStyle = RED; c.lineWidth = 1.8; c.stroke();
    for (const [x, y] of [[-16, -3.5], [-12, -3.5], [-16.5, 3], [-12, 3], [-16.5, 9], [-12, 9]]) { circle(c, hx + x, hy + y, 0.85); c.fillStyle = GOLD; c.fill(); }
    c.beginPath(); c.moveTo(hx + 13.4, hy - 8); c.quadraticCurveTo(hx + 14.6, hy - 1, hx + 14, hy + 5.5); c.quadraticCurveTo(hx + 16.4, hy + 6.6, hx + 18.4, hy + 5); c.quadraticCurveTo(hx + 18.8, hy - 1, hx + 17.6, hy - 8); c.closePath();
    vol(c, STEEL, hx + 13, hy - 8, hx + 19, hy + 6, 1.6, INK, 0.2, -0.4);
    circle(c, hx + 16, hy - 1.5, 0.85); c.fillStyle = GOLD; c.fill(); c.beginPath(); c.moveTo(hx + 14.2, hy + 4.4); c.quadraticCurveTo(hx + 16.3, hy + 5.4, hx + 18.2, hy + 4); c.strokeStyle = RED; c.lineWidth = 1.4; c.stroke();
    // steel bowl with plate seams and a gold brow band
    c.beginPath(); c.ellipse(hx + 0.5, hy - 8, 17.4, 16, 0, Math.PI, 0); c.closePath(); vol(c, STEEL, hx - 16, hy - 24, hx + 17, hy - 8, 2, INK, 0.35, -0.35);
    for (const k of [-9, 0, 9]) { c.beginPath(); c.moveTo(hx + 0.5 + k * 0.25, hy - 23.6); c.quadraticCurveTo(hx + 0.5 + k * 1.05, hy - 18, hx + 0.5 + k * 1.3, hy - 9); c.strokeStyle = 'rgba(30,34,56,0.6)'; c.lineWidth = 1; c.stroke(); }
    for (const [x, y] of [[-8, -15], [3.5, -18], [11, -14], [-3.5, -19]]) { circle(c, hx + x, hy + y, 0.8); c.fillStyle = GOLD; c.fill(); }
    c.beginPath(); c.ellipse(hx - 4, hy - 17, 7, 3.2, -0.5, Math.PI * 1.05, Math.PI * 1.7); c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 1.4; c.stroke();
    rrect(c, hx - 17.8, hy - 12, 36.6, 4.6, 1.6); vol(c, GOLD, hx - 18, hy - 12, hx + 19, hy - 7.4, 1.5, INK, 0.4, -0.3);
    for (let i = 0; i < 6; i++) { circle(c, hx - 13 + i * 5.6, hy - 9.7, 0.7); c.fillStyle = '#8a5a1c'; c.fill(); }
    // 첨: short visor over the brow
    c.beginPath(); c.moveTo(hx + 4, hy - 8.5); c.quadraticCurveTo(hx + 14, hy - 6.2, hx + 22, hy - 7.6); c.lineTo(hx + 21.2, hy - 5.2); c.quadraticCurveTo(hx + 13, hy - 3.6, hx + 4, hy - 6.4); c.closePath(); vol(c, IRON, hx + 4, hy - 9, hx + 22, hy - 4, 1.4, INK, 0.3, -0.3);
    // spike with a gold cup
    rrect(c, hx - 0.6, hy - 28.5, 2.6, 6, 1); vol(c, GOLD, hx - 0.6, hy - 28.5, hx + 2, hy - 22.5, 1.1, INK, 0.4, -0.3);
    ellipse(c, hx + 0.7, hy - 23.4, 4, 1.8); vol(c, GOLD, hx - 3.3, hy - 25.2, hx + 4.7, hy - 21.6, 1.1, INK, 0.4, -0.3);
  },
  hand: (c, P, p, back) => { if (back) { c.save(); c.rotate(p.wpn - p.lean + p.armB); mace(c, shade(P.skin, -0.2)); c.restore(); } },
  front: (c, _P, p) => {
    const a = p.armF, L = p.extra >= 1 ? 19 : 14, x = 6 + Math.sin(a) * L, y = -20 + Math.cos(a) * L, f = 1 - Math.min(1, p.extra) * 0.3;
    c.save(); c.translate(x, y); c.rotate(a > 1 ? -0.08 : (0.3 - a) * 0.12); shield(c, 15, f); c.restore();
  },
  weaponIcon: (c, tc) => { c.save(); c.translate(24, 24); c.rotate(-0.12); shield(c, 20, 1, tc); c.restore(); },
};
