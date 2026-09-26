// 화공: black two-tier 정자관, ivory 학창의 robe with black edging and ink splashes, a silk scroll slung on the back,
// and a huge calligraphy brush (bamboo handle, ink-soaked tip) in the front hand.
import { type Ctx, INK, vol, circle, ellipse, rrect, fillC, line, inkLine, shade } from '../core.ts';
import { type ClassLook, type Pal, type Pose, pose, WALK } from '../rig.ts';

const PAL: Pal = { robe: '#efe4cf', lining: '#1f1a28', sash: '#c8323a', pants: '#d6cdbb', shoe: '#1a1420', skin: '#ffe0c4', hair: '#15111c', iris: '#51607e', cuff: '#1f1a28' };
const SUMI = '#15101d', SILK = '#46597f', RED = '#c8323a';
/** Local unit vector of a screen direction (drips fall down and ink flies forward whatever the arm/brush angle). */
function dirLocal(c: Ctx, x: number, y: number): [number, number] { const m = c.getTransform(); const lx = m.d * x - m.c * y, ly = -m.b * x + m.a * y; const L = Math.hypot(lx, ly) || 1; return [lx / L, ly / L]; }
function drop(c: Ctx, x: number, y: number, dx: number, dy: number, r: number): void {
  // teardrop pointing back along (dx, dy)
  c.beginPath(); c.moveTo(x - dx * r * 2.6, y - dy * r * 2.6); c.quadraticCurveTo(x - dy * r * 1.2, y + dx * r * 1.2, x + dx * r, y + dy * r); c.quadraticCurveTo(x + dy * r * 1.2, y - dx * r * 1.2, x - dx * r * 2.6, y - dy * r * 2.6);
  c.fillStyle = SUMI; c.fill(); c.strokeStyle = 'rgba(214,220,255,0.55)'; c.lineWidth = 0.7; c.stroke();
}
/** Inky splat: a blob with satellite drops. */
function splat(c: Ctx, x: number, y: number, s: number, a = 0.9): void {
  c.globalAlpha = a; c.fillStyle = SUMI;
  ellipse(c, x, y, 1.9 * s, 1.5 * s, 0.4); c.fill(); circle(c, x + 2.3 * s, y - 1.2 * s, 0.7 * s); c.fill(); circle(c, x - 1.8 * s, y + 1.7 * s, 0.55 * s); c.fill(); circle(c, x + 1.1 * s, y + 2.2 * s, 0.4 * s); c.fill();
  c.globalAlpha = 1;
}
/** The big brush (붓), pointing along −y from the hand. extra: 0 hanging drip, 1 flick (ink smear + flying drops), 2 dripping. */
function brush(c: Ctx, p: Pose): void {
  c.save(); c.rotate(Math.PI / 2 - p.wpn);
  const TIP = 38; const [ux, uy] = dirLocal(c, 1, 0), [dx, dy] = dirLocal(c, 0, 1);
  /** Point at a screen-space offset (sx, sy) from the brush tip. */
  const S = (sx: number, sy: number): [number, number] => [1 + ux * sx + dx * sy, -TIP + uy * sx + dy * sy];
  if (p.extra) {
    // the stroke just painted: a tapered ink crescent from above the head down to the tip (bold on the strike, fading after)
    const k = p.extra === 1 ? 1 : 0.55; const P = (sx: number, sy: number) => S(sx * k + (1 - k) * -2, sy * (p.extra === 1 ? 1 : 0.75));
    c.beginPath(); c.moveTo(...P(3.5, 1.5)); c.bezierCurveTo(...P(9, -18), ...P(6.5, -50), ...P(-15, -66)); c.bezierCurveTo(...P(-4.5, -52), ...P(-6, -20), ...P(-5, 0.5)); c.closePath();
    c.globalAlpha = p.extra === 1 ? 1 : 0.55; c.fillStyle = SUMI; c.fill(); c.strokeStyle = 'rgba(220,226,255,0.85)'; c.lineWidth = 1.2; c.stroke();
    for (const [o, w] of [[0, 0.9], [2.2, 0.6]]) { c.beginPath(); c.moveTo(...P(-0.5 + o, -8)); c.bezierCurveTo(...P(2.5 + o, -22), ...P(1 + o * 0.6, -40), ...P(-8, -55)); c.strokeStyle = 'rgba(239,228,207,0.5)'; c.lineWidth = w; c.stroke(); }
    c.globalAlpha = 1;
  }
  // bamboo handle, butt cap and red cord
  inkLine(c, [0, 11.5, ux * 1.4 + dx * 4, 11.5 + uy * 1.4 + dy * 4, dx * 7.5, 11.5 + dy * 7.5], RED, 1.2); circle(c, dx * 8.5, 11.5 + dy * 8.5, 1.6); fillC(c, RED, INK, 0.9);
  rrect(c, -2.3, -16, 4.6, 27, 2); const g = c.createLinearGradient(-2.3, 0, 2.3, 0); g.addColorStop(0, '#f0d890'); g.addColorStop(0.45, '#cfa650'); g.addColorStop(1, '#8a6428'); c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
  for (const y of [-8, 1]) { line(c, [-1.8, y, 1.8, y], '#6a4a1c', 1.2); line(c, [-1.5, y - 1.1, 1.3, y - 1.1], 'rgba(255,245,210,0.75)', 0.6); }
  rrect(c, -2.9, 9.5, 5.8, 3.4, 1.3); fillC(c, '#2a1d2a', INK, 1.1);
  // ferrule
  rrect(c, -3.8, -20, 7.6, 5.2, 1.6); fillC(c, '#241c2c', INK, 1.4); line(c, [-3.3, -17.4, 3.3, -17.4], '#e2b64c', 1.1);
  // bristles: cream root, ink-soaked belly and tip
  c.beginPath(); c.moveTo(-4, -19.5); c.bezierCurveTo(-9.6, -22, -8.8, -29.5, -3, -34.2); c.quadraticCurveTo(-0.4, -36.4, 1, -TIP); c.quadraticCurveTo(1.7, -34.6, 3.6, -33); c.bezierCurveTo(9, -28.6, 9.6, -22, 4, -19.5); c.closePath();
  const b = c.createLinearGradient(0, -19.5, 0, -TIP); b.addColorStop(0, '#f5ecd8'); b.addColorStop(0.13, '#d8cfc2'); b.addColorStop(0.25, '#4a3f52'); b.addColorStop(0.36, SUMI); b.addColorStop(1, SUMI);
  c.fillStyle = b; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.7; c.stroke();
  line(c, [-1.8, -20.3, -2.6, -22.4], 'rgba(120,104,92,0.6)', 0.7); line(c, [1.6, -20.3, 2.3, -22.4], 'rgba(120,104,92,0.6)', 0.7);
  c.beginPath(); c.moveTo(-5.8, -24.5); c.quadraticCurveTo(-5.4, -30.5, -1.8, -33.6); c.strokeStyle = 'rgba(205,215,255,0.75)'; c.lineWidth = 1.2; c.stroke(); // wet gloss
  // drips and spatter (screen-space directions)
  if (p.extra === 1) { for (const [sx, sy, r] of [[-7, 3, 1.3], [6, 4.5, 1.1], [-3, 7, 0.8], [7, -9, 1]]) { const [x, y] = S(sx, sy), L = Math.hypot(sx, sy); drop(c, x, y, (ux * sx + dx * sy) / L, (uy * sx + dy * sy) / L, r); } }
  else {
    const x0 = dx > 0 ? 6.9 : -6.9, y0 = -25;
    drop(c, x0 + dx * 2.4, y0 + dy * 2.4, dx, dy, 1.2);
    if (p.extra === 2) { drop(c, 1 + dx * 4.5, -TIP + dy * 4.5, dx, dy, 1.3); drop(c, 1 + dx * 10, -TIP + dy * 10, dx, dy, 0.9); }
  }
  c.restore();
}
/** Pose with the brush at screen angle F (0 = forward, −π/2 = straight up) whatever the arm angle and lean. */
const bp = (F: number, o: Partial<Pose>): Pose => pose({ ...o, wpn: -F - (o.armF ?? 0.3) + (o.lean ?? 0) });
export const painter: ClassLook = {
  pal: PAL,
  frames: {
    idle0: bp(-1.1, { armF: 0.25, armB: -0.15 }), idle1: bp(-1.1, { bob: 1, armF: 0.28, armB: -0.12 }), blink: bp(-1.1, { eyes: 'blink', armF: 0.25, armB: -0.15 }),
    walk0: bp(-0.96, WALK(-1.6, 0.5, 1)), walk1: bp(-1.1, WALK(0, 0.05, 0)), walk2: bp(-1.3, WALK(-1.6, -0.5, -1)), walk3: bp(-1.18, WALK(0, -0.05, 0)),
    atk0: bp(-2.3, { lean: -0.12, armF: -2.2, armB: 0.5, eyes: 'fierce', legF: 0.2, legB: -0.2, step: -0.5 }),
    atk1: bp(1.3, { lean: 0.15, bob: 1, armF: 2.3, armB: -0.7, extra: 1, eyes: 'fierce', legF: 0.5, legB: -0.4, step: 1 }),
    atk2: bp(1.42, { lean: 0.1, bob: 1.5, armF: 1.6, armB: -0.4, extra: 2, eyes: 'fierce', legF: 0.4, legB: -0.3, step: 0.6 }),
    hurt: bp(-2.1, { lean: -0.28, bob: 1.5, armF: -0.9, armB: -1.1, eyes: 'hurt' }),
  },
  back: (c) => {
    // silk-covered scroll (두루마리) slung across the back, top poking out behind the head
    c.save(); c.translate(-13, -20); c.rotate(-0.42);
    for (const y of [-29, 20]) { rrect(c, -2.2, y, 4.4, 6, 1.8); vol(c, '#7a4a28', -2.2, y, 2.2, y + 6, 1.3); }
    rrect(c, -4.6, -25, 9.2, 46, 4.2); vol(c, SILK, -4.6, -25, 4.6, 21, 1.9);
    for (const y of [-24.5, 20.5]) { ellipse(c, 0, y, 4.2, 1.6); fillC(c, '#f3ead6', INK, 1); }
    line(c, [-2.6, -21, -2.6, 17], 'rgba(255,255,255,0.3)', 1.1);
    for (let y = -19; y < 18; y += 6) line(c, [-3.4, y, 3.4, y + 2.2], 'rgba(226,182,76,0.4)', 0.8);
    rrect(c, -5, -12, 10, 2.8, 1); fillC(c, RED, INK, 1);
    c.restore();
  },
  sleeve: (c, P, back) => {
    c.beginPath(); c.moveTo(-5, -1); c.lineTo(5, -1); c.quadraticCurveTo(7.6, 5, 7.6, 13); c.lineTo(-7.6, 13); c.quadraticCurveTo(-7.2, 5, -5, -1); c.closePath();
    vol(c, back ? shade(P.robe, -0.3) : P.robe, -7, 0, 7, 13);
    rrect(c, -7.6, 10.2, 15.2, 3.6, 1.4); fillC(c, back ? shade(P.cuff, -0.3) : P.cuff, INK, 1.3);
    if (!back) splat(c, 2.5, 4.5, 0.75);
  },
  torso: (c, _P, _p, sw) => {
    // black 학창의 hem band + ink splashes, clipped to the robe
    const hem = 19; c.save(); c.beginPath(); c.moveTo(-9, -24); c.lineTo(9, -24); c.quadraticCurveTo(13, -4, 16 + sw, hem); c.quadraticCurveTo(0, hem + 3, -15 + sw * 0.6, hem); c.quadraticCurveTo(-12, -4, -9, -24); c.closePath(); c.clip();
    c.beginPath(); c.moveTo(-20, hem - 4.5); c.quadraticCurveTo(0, hem - 1.5, 20 + sw, hem - 4.5); c.lineTo(20 + sw, hem + 6); c.lineTo(-20, hem + 6); c.closePath(); c.fillStyle = '#1f1a28'; c.fill();
    splat(c, -8, 9, 1); splat(c, -4, 14, 0.6); splat(c, 12 + sw * 0.5, 4, 0.7);
    c.restore();
    // scroll strap across the chest
    inkLine(c, [8, -23, -1, -15, -12, -5], '#6a4a2a', 1.8);
  },
  hat: (c, _P, _p, hx, hy) => {
    // 정자관: two stacked black horsehair tiers, each with an M (山) crest; the taller back tier shows above the front one
    const tier = (x0: number, x1: number, yb: number, ys: number, yt: number, yv: number, col: string) => {
      const w = x1 - x0, pts = [x0, yb, x0 + 0.6, ys, x0 + w * 0.27, yt, x0 + w * 0.5, yv, x0 + w * 0.73, yt, x1 - 0.6, ys, x1, yb];
      c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath();
      vol(c, col, x0, yt, x1, yb, 1.9, INK, 0.3, -0.25);
      c.save(); c.clip(); for (let k = -24; k < 30; k += 3.2) { line(c, [x0 + k, yb, x0 + k + 12, yt], 'rgba(160,150,200,0.13)', 0.6); line(c, [x0 + k, yt, x0 + k + 12, yb], 'rgba(160,150,200,0.1)', 0.6); } c.restore();
      line(c, pts.slice(2, 12).map((v, i) => i % 2 ? v + 0.9 : v), 'rgba(196,186,236,0.5)', 0.8);
    };
    tier(hx - 8.5, hx + 11.5, hy - 17, hy - 21, hy - 29.5, hy - 23.5, '#2e2742');
    tier(hx - 14, hx + 16, hy - 9.5, hy - 17, hy - 24.5, hy - 18.5, '#1c1728');
    rrect(c, hx - 14.5, hy - 12.5, 31, 3.6, 1.4); fillC(c, '#2a2338', INK, 1.3); line(c, [hx - 13, hy - 11.4, hx + 15, hy - 11.4], 'rgba(196,186,236,0.35)', 0.7);
  },
  hand: (c, _P, p, back) => { if (!back) brush(c, p); },
  weaponIcon: (c, tc) => {
    c.save(); c.translate(20, 29); c.rotate(0.78);
    inkLine(c, [0, 20, 3, 23, 1.2, 25.5], RED, 1.3);
    rrect(c, -3.3, -7, 6.6, 28, 3); vol(c, tc, -3.3, -7, 3.3, 21, 1.8, INK, 0.45, -0.3);
    for (const y of [0, 9]) { line(c, [-2.7, y, 2.7, y], shade(tc, -0.45), 1.3); line(c, [-2.4, y - 1.3, 2.2, y - 1.3], 'rgba(255,255,255,0.55)', 0.8); }
    rrect(c, -5.2, -12, 10.4, 6.4, 1.8); fillC(c, '#241c2c', INK, 1.5); line(c, [-4.6, -8.8, 4.6, -8.8], '#e2b64c', 1.3);
    c.beginPath(); c.moveTo(-5.4, -11.5); c.bezierCurveTo(-11.6, -15, -10.8, -24.5, -4, -30); c.quadraticCurveTo(-0.6, -32.8, 1.2, -36.5); c.quadraticCurveTo(2, -32, 4.6, -29.4); c.bezierCurveTo(11, -24, 11.6, -15, 5.4, -11.5); c.closePath();
    const b = c.createLinearGradient(0, -11.5, 0, -36.5); b.addColorStop(0, '#f5ecd8'); b.addColorStop(0.14, '#d8cfc2'); b.addColorStop(0.26, '#4a3f52'); b.addColorStop(0.38, SUMI); b.addColorStop(1, SUMI); c.fillStyle = b; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    c.beginPath(); c.moveTo(-7.2, -18); c.quadraticCurveTo(-6.6, -25, -2.4, -29.5); c.strokeStyle = 'rgba(205,215,255,0.8)'; c.lineWidth = 1.5; c.stroke();
    c.restore();
    drop(c, 44, 11.5, 0, 1, 1.7); splat(c, 38, 41, 1.3, 0.85);
  },
};
