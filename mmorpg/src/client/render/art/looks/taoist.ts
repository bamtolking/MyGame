// 도사: black 도관 crown with a gold hairpin over a top bun, long tied-back hair, violet-grey 도포 with 八卦 trim,
// peach-wood sword (도목검) with a talisman tied to the pommel, a fan of yellow 부적 in the back hand.
import { type Ctx, INK, vol, circle, ellipse, rrect, fillC, line, inkLine, glowDot } from '../core.ts';
import { type ClassLook, type Pal, type Pose, pose, WALK } from '../rig.ts';

const PAL: Pal = { robe: '#6a5f9e', lining: '#f1ecfa', sash: '#2c2240', pants: '#2d2740', shoe: '#1a1424', skin: '#ffe0c4', hair: '#1a1524', iris: '#8a62e0', cuff: '#c6b2ff' };
const TRIM = '#c6b2ff', PAPER = '#ffe27a', RED = '#d0283c';
/** One 부적: yellow slip with a red seal scrawl, drawn upright (top at -h). */
function talisman(c: Ctx, w: number, h: number): void {
  rrect(c, -w / 2, -h, w, h, 0.8); vol(c, PAPER, -w / 2, -h, w / 2, 0, 1.2, INK, 0.3, -0.18);
  line(c, [0, -h + 2, 0, -2.5], RED, 0.9); line(c, [-w * 0.25, -h + 4.2, w * 0.25, -h + 4.2], RED, 0.8); line(c, [-w * 0.25, -h * 0.5, w * 0.22, -h * 0.5 + 1.2, -w * 0.2, -h * 0.35], RED, 0.8);
}
/** 八卦 mark: three bars (b = bit mask, 1 = solid) across a trim band, centred at the origin. */
function trigram(c: Ctx, b: number, s: number): void {
  for (let i = 0; i < 3; i++) { const y = (i - 1) * s * 0.9; if (b & (1 << i)) line(c, [-s, y, s, y], INK, 0.8); else { line(c, [-s, y, -s * 0.2, y], INK, 0.8); line(c, [s * 0.2, y, s, y], INK, 0.8); } }
}
function peachSword(c: Ctx, p: Pose): void {
  c.save(); c.rotate(Math.PI / 2 - p.wpn); // blade along -y
  // grip, pommel, guard
  rrect(c, -1.9, -1, 3.8, 8.5, 1.4); fillC(c, '#3a1c1c', INK, 1.3); line(c, [-1.6, 1.5, 1.6, 2.6], RED, 0.9); line(c, [-1.6, 4.2, 1.6, 5.3], RED, 0.9);
  circle(c, 0, 8.3, 1.9); vol(c, '#e2b64c', -2, 6.5, 2, 10, 1.2);
  // talisman tied to the pommel: hangs in world space
  c.save(); c.translate(0, 9.5); c.rotate(-(Math.PI / 2 - p.wpn) + p.armF - p.lean + p.step * 0.12);
  inkLine(c, [0, 0, 0.6, 4], RED, 1.1); c.translate(0.8, 3.6); c.rotate(-0.08); c.scale(1, -1); talisman(c, 4.6, 11); c.restore();
  ellipse(c, 0, -1.6, 5.4, 2.1); vol(c, '#7a2e22', -5, -3.5, 5, 0.5, 1.3);
  // peach-wood blade with a carved groove and red script
  c.beginPath(); c.moveTo(-2.3, -3); c.lineTo(-2, -26); c.lineTo(0, -31.5); c.lineTo(2, -26); c.lineTo(2.3, -3); c.closePath();
  const g = c.createLinearGradient(-2.4, 0, 2.4, 0); g.addColorStop(0, '#e8a070'); g.addColorStop(0.45, '#b8623a'); g.addColorStop(1, '#6e301c');
  c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
  line(c, [0, -4, 0, -27], 'rgba(70,22,10,0.55)', 0.8); line(c, [-1.3, -5, -1.2, -25], 'rgba(255,220,190,0.6)', 0.7);
  for (let i = 0; i < 4; i++) line(c, [-0.9, -8 - i * 4.6, 0.9, -9.2 - i * 4.6], RED, 0.9);
  if (p.extra >= 1) { glowDot(c, 0, -30, 11, 'rgba(196,160,255,0.95)'); c.save(); c.translate(0, -30); for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(-1.4, 0); c.lineTo(0, -7.5 + (i % 2) * 3); c.lineTo(1.4, 0); c.closePath(); c.fillStyle = '#f6f0ff'; c.fill(); } c.restore(); line(c, [-5, -36, -1.5, -32, -3.5, -30.5, 0, -28], '#f4ecff', 1); }
  c.restore();
}
/** Fan of talismans in the back hand; `rel` bends the fan relative to the forearm, `n` papers. */
function fan(c: Ctx, rel: number, n: number, glow: boolean): void {
  c.save(); c.rotate(Math.PI + rel); // papers point along the forearm, past the hand
  if (glow) glowDot(c, 0, -10, 14, 'rgba(180,140,255,0.75)');
  for (let i = 0; i < n; i++) { c.save(); c.translate(0, 1.5); c.rotate((i - (n - 1) / 2) * 0.32); c.translate(0, -2); talisman(c, 5.2, 14); c.restore(); }
  c.restore();
}
export const taoist: ClassLook = {
  pal: PAL,
  frames: {
    idle0: pose({ armF: 0.3, armB: -0.35, wpn: 0.5 }), idle1: pose({ bob: 1, armF: 0.34, armB: -0.32, wpn: 0.52 }), blink: pose({ eyes: 'blink', armF: 0.3, armB: -0.35, wpn: 0.5 }),
    walk0: pose({ ...WALK(-1.6, 0.5, 1), wpn: 0.6 }), walk1: pose({ ...WALK(0, 0.05, 0), wpn: 0.6 }), walk2: pose({ ...WALK(-1.6, -0.5, -1), wpn: 0.6 }), walk3: pose({ ...WALK(0, -0.05, 0), wpn: 0.6 }),
    atk0: pose({ lean: -0.14, armF: -0.5, armB: -2.55, wpn: 0.55, eyes: 'fierce', legF: 0.25, legB: -0.25, extra: 0.5 }),
    atk1: pose({ lean: 0.1, bob: 1.5, armF: 1.55, armB: 1.3, wpn: -0.1, eyes: 'fierce', legF: 0.55, legB: -0.4, step: 1, extra: 1 }),
    atk2: pose({ lean: 0.1, bob: 1, armF: 0.85, armB: -0.6, wpn: -1.7, eyes: 'fierce', legF: 0.4, legB: -0.3, step: 0.5, extra: 0.9 }),
    hurt: pose({ lean: -0.28, bob: 1.5, armF: -0.9, armB: -1.1, eyes: 'hurt', wpn: 0.9 }),
  },
  sashTails: true,
  back: (c, P, p) => {
    // long hair tied back from the bun, with a violet ribbon
    const s = p.step * 1.5 - p.lean * 8;
    c.beginPath(); c.moveTo(-6, -56); c.quadraticCurveTo(-20, -48, -18 - s, -26); c.quadraticCurveTo(-17 - s, -14, -20 - s * 1.4, -6); c.lineTo(-13 - s, -10); c.quadraticCurveTo(-11, -30, -2, -50); c.closePath(); vol(c, P.hair, -20, -56, -4, -6);
    inkLine(c, [-15, -45, -22 - s, -37], TRIM, 2); inkLine(c, [-14, -44, -19 - s, -32], '#8a62e0', 1.8);
  },
  sleeve: (c, P, back) => {
    // wide 도포 sleeve with a lavender trim band
    c.beginPath(); c.moveTo(-5, -1); c.lineTo(5, -1); c.quadraticCurveTo(8, 6, 8.5, 13.5); c.lineTo(-8.5, 13.5); c.quadraticCurveTo(-7, 6, -5, -1); c.closePath(); vol(c, back ? '#4a4274' : P.robe, -8, 0, 8, 14);
    rrect(c, -8.6, 10.2, 17.2, 3.6, 1.2); fillC(c, back ? '#8f7fc0' : TRIM, INK, 1.2);
  },
  torso: (c, _P, _p, sw) => {
    // trigram trim along the front opening and a small 太極 emblem on the chest
    c.beginPath(); c.moveTo(1, -22); c.quadraticCurveTo(5, -4, 9 + sw, 18); c.lineTo(5.6 + sw, 18); c.quadraticCurveTo(2, -4, -1.8, -21); c.closePath(); fillC(c, TRIM, INK, 1.2);
    const B = [7, 0, 5, 2, 3, 6, 1, 4]; for (let i = 0; i < 4; i++) { const t = 0.28 + i * 0.2; c.save(); c.translate(-0.3 + t * 5 + t * t * (3 + sw), -22 + t * 40); c.rotate(-0.2); trigram(c, B[i], 1.1); c.restore(); }
    c.beginPath(); c.moveTo(-15 + sw * 0.6, 19); c.quadraticCurveTo(-4, 21.5, 7 + sw, 19.6); c.lineTo(7 + sw, 16.2); c.quadraticCurveTo(-4, 18, -14.6 + sw * 0.6, 15.8); c.closePath(); fillC(c, TRIM, INK, 1.2);
    for (let i = 0; i < 4; i++) { c.save(); c.translate(-11 + i * 5 + sw * 0.7, 17.8 + (i === 0 ? -0.4 : 0.2)); trigram(c, B[i + 4], 1.1); c.restore(); }
    circle(c, -4.5, -16, 3.3); c.fillStyle = '#f4f0ff'; c.fill(); c.beginPath(); c.arc(-4.5, -16, 3.3, -Math.PI / 2, Math.PI / 2); c.arc(-4.5, -14.35, 1.65, Math.PI / 2, -Math.PI / 2, true); c.arc(-4.5, -17.65, 1.65, Math.PI / 2, -Math.PI / 2); c.fillStyle = INK; c.fill();
    circle(c, -4.5, -16, 3.3); c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
  },
  hat: (c, _P, _p, hx, hy) => {
    // top bun under a small black 도관 crown, a gold hairpin through it (ends stick out on both sides)
    circle(c, hx - 1, hy - 16, 6); vol(c, '#1a1524', hx - 7, hy - 22, hx + 5, hy - 10, 1.8);
    inkLine(c, [hx - 13, hy - 18.5, hx + 11, hy - 21], '#f0c050', 1.3); circle(c, hx + 11.5, hy - 21, 1.9); vol(c, '#f0c050', hx + 10, hy - 22.5, hx + 13, hy - 19.5, 1);
    c.beginPath(); c.moveTo(hx - 6.5, hy - 13); c.lineTo(hx - 8.5, hy - 26); c.quadraticCurveTo(hx - 5, hy - 24, hx - 1, hy - 28.5); c.quadraticCurveTo(hx + 3, hy - 24, hx + 6.5, hy - 26); c.lineTo(hx + 5, hy - 13); c.quadraticCurveTo(hx - 1, hy - 11.5, hx - 6.5, hy - 13); c.closePath();
    vol(c, '#241c34', hx - 8, hy - 28, hx + 7, hy - 12, 1.9, INK, 0.32, -0.2);
    line(c, [hx - 6.8, hy - 15.5, hx + 4.8, hy - 15.5], '#8a62e0', 1.1); line(c, [hx - 1, hy - 26, hx - 1, hy - 17], 'rgba(170,150,220,0.45)', 0.8);
    circle(c, hx - 1, hy - 20.5, 1.7); c.fillStyle = '#b89cff'; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
  },
  hand: (c, _P, p, back) => {
    if (!back) { peachSword(c, p); return; }
    // extra: 0 rest, 0.5 charged (raised, glowing), 1 cast (papers thrown), 0.9 after the cast
    if (p.extra >= 1) return; // atk1: the papers are in flight (see front)
    const up = p.extra > 0.2 && p.extra < 0.8;
    fan(c, up ? 0.2 : p.extra >= 0.8 ? 0.5 : 0.8, p.extra >= 0.8 ? 2 : 4, up);
  },
  front: (c, _P, p) => {
    if (p.extra < 1) return; // atk1: three talismans flicked forward past the raised sword, crackling (the chain bolt starts here)
    glowDot(c, 29.5, -28, 13, 'rgba(176,136,255,0.62)');
    for (const [x0, y0, x1, y1] of [[17, -25, 23, -25.3], [19, -32.5, 25, -32.8], [21, -28.8, 27, -29]]) line(c, [x0, y0, x1, y1], 'rgba(236,228,255,0.75)', 1);
    for (const [x, y, r] of [[28, -25, 1.52], [29.5, -32.5, 1.4], [31.5, -28.8, 1.62]]) { c.save(); c.translate(x, y); c.rotate(r); c.translate(0, 4.6); talisman(c, 4, 9.2); c.restore(); }
    line(c, [33, -36, 35, -32.5, 33.3, -31, 36, -27.5], '#f4ecff', 1.1);
  },
  weaponIcon: (c, tc) => {
    // talisman on a red cord from the pommel, then the diagonal peach-wood sword over it
    inkLine(c, [11, 38, 16, 42.5, 23.5, 35.5], RED, 1.2); c.save(); c.translate(26.5, 47.5); c.rotate(-0.22); talisman(c, 7.5, 13); c.restore();
    c.save(); c.translate(26, 22); c.rotate(0.78);
    c.beginPath(); c.moveTo(-3.2, 8); c.lineTo(-2.8, -15); c.lineTo(0, -21.5); c.lineTo(2.8, -15); c.lineTo(3.2, 8); c.closePath(); vol(c, tc, -3, -21, 3, 8, 1.8, INK, 0.4, -0.35);
    line(c, [0.2, 6, 0, -17], 'rgba(60,20,10,0.4)', 0.9); line(c, [-1.6, 5, -1.5, -14], 'rgba(255,240,220,0.45)', 0.8); for (let i = 0; i < 3; i++) line(c, [-1.2, 2.5 - i * 5.5, 1.2, 1.2 - i * 5.5], RED, 1.2);
    ellipse(c, 0, 9.5, 7, 2.6); vol(c, '#7a2e22', -7, 7, 7, 12, 1.4); rrect(c, -2.2, 11, 4.4, 9, 1.6); fillC(c, '#3a1c1c', INK, 1.3); line(c, [-1.8, 14, 1.8, 15.2], RED, 1); line(c, [-1.8, 17, 1.8, 18.2], RED, 1);
    circle(c, 0, 21.2, 2.3); vol(c, '#e2b64c', -2, 19, 2, 23.5, 1.2);
    c.restore();
  },
};
