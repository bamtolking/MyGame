// Monster art with animation frames: f = loop frame (0..3), st = 'm' move/idle, 'w' wind-up / cast, 'd' dash.
import { type Ctx, INK, vol, circle, ellipse, rrect, poly, fillC, line, inkLine, eye } from './core.ts';

export interface MonArt { w: number; h: number; foot: number; draw: (c: Ctx, f: number, st: string) => void; frames: number; flame?: boolean }

function flame(c: Ctx, x: number, y: number, r: number, f: number, outer: string, inner: string, core: string, lick = 1): void {
  const w = [0, 1, 0, -1][f] * 1.6 * lick, t = [0, -1.5, -0.5, 1][f] * lick;
  const g = c.createRadialGradient(x, y + r * 0.35, 1, x, y, r * 1.7); g.addColorStop(0, core); g.addColorStop(0.35, inner); g.addColorStop(1, outer);
  c.beginPath(); c.moveTo(x + w, y - r * 2 + t); c.bezierCurveTo(x + r * 0.6 + w, y - r * 1.2, x + r * 1.2, y - r * 0.4, x + r, y + r * 0.25);
  c.arc(x, y + r * 0.25, r, 0, Math.PI); c.bezierCurveTo(x - r * 1.2, y - r * 0.4, x - r * 0.4 + w * 0.5, y - r, x - r * 0.25 + w, y - r * 1.4 + t * 0.5);
  c.quadraticCurveTo(x - r * 0.05, y - r * 1.25, x + w, y - r * 2 + t); c.fillStyle = g; c.fill();
  c.beginPath(); c.ellipse(x, y + r * 0.1, r * 0.45, r * 0.6, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill();
}
function horn(c: Ctx, pts: number[], col = '#fff0b0'): void { poly(c, pts); vol(c, col, pts[0], pts[3], pts[4], pts[1], 1.6); }
function tigerCloth(c: Ctx, x: number, y: number, w: number, h: number): void { rrect(c, x, y, w, h, 3); vol(c, '#ffc53d', x, y, x + w, y + h, 1.6); for (let i = 1; i < w / 4.5; i++) line(c, [x + i * 4.5, y + 1, x + i * 4.5 + 1.5, y + h - 1], INK, 1.6); }
function club(c: Ctx, x: number, y: number, a: number, len: number, col: string, studs: number): void {
  c.save(); c.translate(x, y); c.rotate(a); rrect(c, -3.5, -len, 7 + len * 0.1, len, 4); vol(c, col, -4, -len, 6, 0, 2);
  for (let i = 0; i < studs; i++) { circle(c, -3.5, -len + 5 + i * (len - 8) / studs, 1.9); fillC(c, '#e8e4dc', INK, 1); circle(c, 4 + len * 0.1, -len + 8 + i * (len - 8) / studs, 1.9); fillC(c, '#e8e4dc', INK, 1); }
  c.restore();
}
export const MON_ART: Record<string, MonArt> = {
  wisp: { w: 40, h: 46, foot: 42, frames: 4, flame: true, draw: (c, f) => { flame(c, 20, 27, 11, f, 'rgba(60,140,255,0.1)', '#5fb6ff', '#f0f8ff'); eye(c, 16, 28, 2.4, '#1a3a7a'); eye(c, 23.5, 28, 2.2, '#1a3a7a', 'open', true); } },
  bogwisp: { w: 40, h: 46, foot: 42, frames: 4, flame: true, draw: (c, f, st) => { const r = st === 'w' ? 14 : 11; flame(c, 20, 27, r, f, 'rgba(100,255,80,0.1)', st === 'w' ? '#e8ff6a' : '#8dff5a', '#f8ffe8'); eye(c, 15.5, 27, 2.6, '#2a5a10', 'fierce'); eye(c, 24, 27, 2.4, '#2a5a10', 'fierce', true); c.beginPath(); c.arc(20, 33, 3, 0, Math.PI); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke(); } },
  foxfire: { w: 42, h: 48, foot: 44, frames: 4, flame: true, draw: (c, f) => { horn(c, [9, 22, 12, 8, 17, 19], '#ff8a2a'); horn(c, [32, 22, 29, 8, 24, 19], '#ff8a2a'); flame(c, 21, 29, 12, f, 'rgba(255,120,40,0.1)', '#ff9a3c', '#fff4d0'); ellipse(c, 15.5, 30, 2.8, 1.4, -0.3); c.fillStyle = INK; c.fill(); ellipse(c, 26.5, 30, 2.8, 1.4, 0.3); c.fill(); } },
  imp: { w: 46, h: 54, foot: 50, frames: 2, draw: (c, f, st) => {
    const l = f ? 2 : -2; rrect(c, 14 + l, 38, 6, 12, 3); vol(c, '#b8322a', 14, 38, 20, 50); rrect(c, 25 - l, 38, 6, 12, 3); vol(c, '#b8322a', 25, 38, 31, 50);
    ellipse(c, 23, 34, 12, 9); vol(c, '#e2473a', 11, 25, 35, 43); tigerCloth(c, 13, 35, 20, 7);
    circle(c, 23, 21, 12); vol(c, '#e2473a', 11, 9, 35, 33); horn(c, [20, 11, 23, 0, 26, 11], '#ffe08a');
    c.beginPath(); c.arc(23, 19, 12.5, Math.PI * 1.1, Math.PI * 1.9); c.fillStyle = '#3a2438'; c.fill();
    eye(c, 19, 22, 2.8, '#ffcc00', 'fierce'); eye(c, 27.5, 22, 2.6, '#ffcc00', 'fierce', true); poly(c, [19, 28, 21, 31.5, 23, 28, 25, 31.5, 27, 28]); fillC(c, '#fff', INK, 1);
    club(c, 36, 36, st === 'w' ? -2.3 : -0.5, 18, '#a8743a', 0); } },
  clubber: { w: 64, h: 70, foot: 66, frames: 2, draw: (c, f, st) => {
    const l = f ? 2.5 : -2.5, lean = st === 'd' ? 0.3 : st === 'w' ? -0.15 : 0; c.save(); c.translate(32, 60); c.rotate(lean); c.translate(-32, -60);
    rrect(c, 20 + l, 50, 9, 13, 3); vol(c, '#2a4f9a', 20, 50, 29, 63); rrect(c, 35 - l, 50, 9, 13, 3); vol(c, '#2a4f9a', 35, 50, 44, 63);
    ellipse(c, 32, 44, 18, 12); vol(c, '#3f73d8', 14, 32, 50, 56); tigerCloth(c, 17, 44, 30, 9);
    circle(c, 32, 27, 15); vol(c, '#3f73d8', 17, 12, 47, 42); horn(c, [20, 16, 16, 3, 25, 13]); horn(c, [44, 16, 48, 3, 39, 13]);
    c.beginPath(); c.arc(32, 25, 15.5, Math.PI * 1.15, Math.PI * 1.85); c.fillStyle = '#2b1f3a'; c.fill();
    eye(c, 26, 28, 3.4, '#ff3b3b', 'fierce'); eye(c, 38, 28, 3.2, '#ff3b3b', 'fierce', true); poly(c, [25, 35, 28, 39, 31, 35, 34, 39, 37, 35]); fillC(c, '#fff', INK, 1);
    club(c, 52, 42, st === 'w' ? -2.6 : st === 'd' ? 0.6 : -0.45, 30, '#a56a36', 4); c.restore(); } },
  toad: { w: 58, h: 50, foot: 46, frames: 2, draw: (c, f) => {
    const sq = f ? 1.08 : 0.94; c.save(); c.translate(29, 44); c.scale(1 / sq, sq); c.translate(-29, -44);
    ellipse(c, 29, 33, 21, 13); vol(c, '#5d7a3a', 8, 20, 50, 46); ellipse(c, 29, 39, 14, 5); fillC(c, '#e0d690', null);
    for (const [x, y] of [[17, 28], [34, 25], [26, 37], [40, 33], [15, 36], [44, 27]]) { circle(c, x, y, 2.3); fillC(c, '#86a352', null); }
    circle(c, 19, 19, 7); vol(c, '#5d7a3a', 12, 12, 26, 26, 2); circle(c, 39, 19, 7); vol(c, '#5d7a3a', 32, 12, 46, 26, 2);
    circle(c, 19, 19, 4.2); vol(c, '#ffc93a', 15, 15, 23, 23, 1.2); circle(c, 39, 19, 4.2); vol(c, '#ffc93a', 35, 15, 43, 23, 1.2); rrect(c, 18, 17, 2.2, 4, 1); c.fillStyle = INK; c.fill(); rrect(c, 38, 17, 2.2, 4, 1); c.fill();
    line(c, [16, 32, 29, 35, 42, 32], INK, 1.8); rrect(c, 6, 39, 11, 6, 3); vol(c, '#4d6a2e', 6, 39, 17, 45, 1.6); rrect(c, 41, 39, 11, 6, 3); vol(c, '#4d6a2e', 41, 39, 52, 45, 1.6); c.restore(); } },
  drowned: { w: 46, h: 62, foot: 58, frames: 4, draw: (c, f) => {
    const s = [0, 1.5, 0, -1.5][f];
    c.beginPath(); c.moveTo(10, 28); c.quadraticCurveTo(7 + s, 50, 13 + s, 56); c.quadraticCurveTo(18, 51, 22 + s, 57); c.quadraticCurveTo(27, 51, 31 + s, 57); c.quadraticCurveTo(39, 52, 36, 28); c.closePath();
    const g = c.createLinearGradient(0, 28, 0, 58); g.addColorStop(0, 'rgba(222,242,248,0.95)'); g.addColorStop(1, 'rgba(160,210,230,0.6)'); c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    circle(c, 23, 21, 11); vol(c, '#cfe6ee', 12, 10, 34, 32);
    c.beginPath(); c.moveTo(9, 38 + s); c.quadraticCurveTo(6, 9, 23, 7); c.quadraticCurveTo(40, 9, 37, 38 - s); c.quadraticCurveTo(32, 26, 30, 36); c.quadraticCurveTo(27, 21, 23, 31); c.quadraticCurveTo(19, 21, 16, 36); c.quadraticCurveTo(13, 26, 9, 38 + s); vol(c, '#141824', 6, 7, 40, 38);
    circle(c, 18.5, 25, 1.7); c.fillStyle = '#9fe8ff'; c.fill(); circle(c, 27.5, 25, 1.7); c.fill();
    for (const x of [12, 34]) { ellipse(c, x, 42 + f * 1.5, 1.4, 2.6); c.fillStyle = 'rgba(140,210,255,0.85)'; c.fill(); } } },
  egg: { w: 48, h: 64, foot: 60, frames: 4, draw: (c, f) => {
    const s = [0, 1.2, 0, -1.2][f];
    c.beginPath(); c.moveTo(11, 36); c.quadraticCurveTo(8 + s, 56, 12 + s, 59); c.quadraticCurveTo(24, 54, 36 + s, 59); c.quadraticCurveTo(40, 55, 37, 36); c.closePath(); vol(c, '#f2f0ff', 8, 36, 40, 59);
    line(c, [24, 37, 28, 46], '#b8b4d8', 2); ellipse(c, 24, 22, 13, 16); vol(c, '#fffdf6', 11, 6, 37, 38, 2.2, INK, 0.1, -0.12);
    ellipse(c, 19, 15, 3.5, 5.5); c.fillStyle = 'rgba(255,255,255,0.8)'; c.fill(); ellipse(c, 24, 29, 9, 4); c.fillStyle = 'rgba(190,186,230,0.35)'; c.fill(); } },
  skeleton: { w: 52, h: 62, foot: 58, frames: 2, draw: (c, f, st) => {
    const l = f ? 2 : -2; rrect(c, 17 + l, 46, 6, 12, 2); vol(c, '#e8e2cc', 17, 46, 23, 58, 1.6); rrect(c, 28 - l, 46, 6, 12, 2); vol(c, '#e8e2cc', 28, 46, 34, 58, 1.6);
    rrect(c, 13, 30, 25, 19, 4); vol(c, '#6b5a4a', 13, 30, 38, 49); for (let i = 0; i < 3; i++) line(c, [15, 35 + i * 4.5, 36, 35 + i * 4.5], '#9a8466', 2);
    circle(c, 25, 19, 11); vol(c, '#efe9d4', 14, 8, 36, 30); circle(c, 20.5, 19, 3.3); c.fillStyle = INK; c.fill(); circle(c, 29.5, 19, 3.3); c.fill(); circle(c, 20.5, 19, 1.2); c.fillStyle = '#ff4a4a'; c.fill(); circle(c, 29.5, 19, 1.2); c.fill();
    line(c, [20, 26, 30, 26], INK, 1.5); for (let i = 0; i < 5; i++) line(c, [21 + i * 2, 25, 21 + i * 2, 27.5], INK, 1);
    ellipse(c, 25, 9, 15, 4); c.fillStyle = 'rgba(18,12,28,0.85)'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke(); rrect(c, 19, 1, 12, 8, 3); fillC(c, '#1a1522', null);
    c.save(); c.translate(38, 38); c.rotate(st === 'w' ? -2.4 : -0.35); rrect(c, -1.5, -26, 3.5, 24, 1); const g = c.createLinearGradient(-2, 0, 2, 0); g.addColorStop(0, '#8a96a8'); g.addColorStop(0.5, '#e8eef8'); g.addColorStop(1, '#6a7688'); fillC(c, g, INK, 1.4); rrect(c, -4, -3, 9, 3, 1); fillC(c, '#6b5a4a', INK, 1); c.restore(); } },
  crow: { w: 54, h: 46, foot: 42, frames: 3, draw: (c, f) => {
    const up = [-8, 0, 7][f];
    poly(c, [27, 22, 4, 12 + up, 9, 22, 5, 28, 21, 27]); vol(c, '#1d1a2a', 4, 12, 27, 28, 1.8, INK, 0.25, -0.2); poly(c, [27, 22, 50, 12 + up, 45, 22, 49, 28, 33, 27]); vol(c, '#1d1a2a', 27, 12, 50, 28, 1.8, INK, 0.25, -0.2);
    ellipse(c, 27, 27, 10, 9); vol(c, '#26223a', 17, 18, 37, 36); circle(c, 27, 16, 7.5); vol(c, '#26223a', 20, 9, 35, 24); poly(c, [28, 16, 39, 18, 28, 20.5]); fillC(c, '#4a4560', INK, 1.4);
    circle(c, 25, 14.5, 2.1); c.fillStyle = '#ff3b3b'; c.fill(); for (const x of [23, 27, 31]) line(c, [x, 35, x - 1 + (x - 27) * 0.3, 41], '#e0c050', 1.5); } },
  foxmage: { w: 50, h: 66, foot: 62, frames: 2, draw: (c, f, st) => {
    const s = f ? 1 : -1; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(25, 50); c.quadraticCurveTo(9 - i * 4 + s, 44 - i * 6, 6 + i * 2 + s, 26 - i * 3); c.strokeStyle = INK; c.lineWidth = 7; c.stroke(); c.strokeStyle = '#ffb86b'; c.lineWidth = 4.6; c.stroke(); }
    poly(c, [13, 34, 37, 34, 41, 61, 9, 61]); vol(c, '#c9303f', 9, 34, 41, 61); rrect(c, 14, 32, 22, 11, 3); fillC(c, '#f7f3ea', INK, 1.6);
    circle(c, 25, 22, 11); vol(c, '#f7f3ea', 14, 11, 36, 33); horn(c, [15, 16, 16, 4, 22, 13], '#f7f3ea'); horn(c, [35, 16, 34, 4, 28, 13], '#f7f3ea');
    line(c, [18, 21, 22, 23], '#c9303f', 2); line(c, [32, 21, 28, 23], '#c9303f', 2); circle(c, 25, 27, 1.3); c.fillStyle = INK; c.fill(); line(c, [25, 13, 25, 17], '#c9303f', 1.6);
    if (st === 'w') { c.save(); c.translate(38, 30); circle(c, 0, -8, 6); const g = c.createRadialGradient(0, -8, 0, 0, -8, 8); g.addColorStop(0, '#fff4d0'); g.addColorStop(1, '#ff8a2a'); c.fillStyle = g; c.fill(); c.restore(); } } },
  jangseung: { w: 66, h: 104, foot: 100, frames: 2, draw: (c, f, st) => {
    const tilt = st === 'w' ? -0.18 : st === 'd' ? 0.25 : (f ? 0.05 : -0.05); c.save(); c.translate(33, 98); c.rotate(tilt); c.translate(-33, -98);
    rrect(c, 20, 24, 26, 74, 7); vol(c, '#9a6a3e', 20, 24, 46, 98); for (let i = 0; i < 7; i++) line(c, [23, 46 + i * 7, 43, 46 + i * 7], 'rgba(60,35,20,0.35)', 1.5);
    ellipse(c, 33, 20, 18, 9); vol(c, '#2b2233', 15, 11, 51, 29); rrect(c, 25, 4, 16, 14, 5); vol(c, '#2b2233', 25, 4, 41, 18);
    ellipse(c, 33, 33, 14, 12); fillC(c, '#c9523e', null); eye(c, 26, 30, 4, '#1b1426', 'fierce'); eye(c, 40, 30, 4, '#1b1426', 'fierce', true);
    ellipse(c, 33, 38, 4, 3.4); fillC(c, '#8a3322', null); rrect(c, 25, 42, 16, 6, 2); fillC(c, '#fff', INK, 1.2); poly(c, [26, 42, 27.5, 48, 29, 42]); fillC(c, '#fff', null); poly(c, [37, 42, 38.5, 48, 40, 42]); fillC(c, '#fff', null);
    c.fillStyle = INK; c.font = 'bold 8px serif'; c.textAlign = 'center'; ['天', '下', '大', '將', '軍'].forEach((ch, i) => c.fillText(ch, 33, 58 + i * 8.5));
    inkLine(c, [18, 58, 8, st === 'w' ? 44 : 70], '#9a6a3e', 5.5); inkLine(c, [48, 58, 58, st === 'w' ? 44 : 70], '#9a6a3e', 5.5); c.restore(); } },
  goldgob: { w: 56, h: 58, foot: 54, frames: 2, draw: (c, f) => {
    const l = f ? 2.5 : -2.5; ellipse(c, 14, 36, 11, 13); vol(c, '#b88a3a', 3, 23, 25, 49); circle(c, 14, 22, 4); vol(c, '#b88a3a', 10, 18, 18, 26, 1.6);
    for (const [x, y] of [[10, 31], [17, 37], [12, 42], [18, 29]]) { circle(c, x, y, 2.6); vol(c, '#ffe36b', x - 2, y - 2, x + 2, y + 2, 1); }
    rrect(c, 27 + l, 44, 6, 9, 3); vol(c, '#b8860b', 27, 44, 33, 53); rrect(c, 37 - l, 44, 6, 9, 3); vol(c, '#b8860b', 37, 44, 43, 53); ellipse(c, 35, 40, 12, 9); vol(c, '#ffcf3f', 23, 31, 47, 49);
    circle(c, 35, 25, 12); vol(c, '#ffcf3f', 23, 13, 47, 37); horn(c, [32, 14, 35, 3, 38, 14], '#fff6c8'); eye(c, 31, 26, 2.8, '#8a5a1a'); eye(c, 39.5, 26, 2.6, '#8a5a1a', 'open', true);
    c.beginPath(); c.arc(35, 30, 4, 0.1, Math.PI - 0.1); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke(); c.beginPath(); c.arc(35, 24, 12.5, Math.PI * 1.1, Math.PI * 1.9); c.fillStyle = '#8a5a1a'; c.fill(); } },
  boss_chief: { w: 130, h: 132, foot: 126, frames: 2, draw: (c, f, st) => {
    const b = f ? 1.5 : 0; rrect(c, 42, 102, 16, 22, 6); vol(c, '#a82a22', 42, 102, 58, 124); rrect(c, 72, 102, 16, 22, 6); vol(c, '#a82a22', 72, 102, 88, 124);
    ellipse(c, 65, 90 + b, 38, 25); vol(c, '#d9392e', 27, 65, 103, 115); tigerCloth(c, 30, 88 + b, 70, 15);
    circle(c, 65, 54 + b, 33); vol(c, '#d9392e', 32, 21, 98, 87, 2.6); horn(c, [38, 36, 26, 4, 49, 29]); horn(c, [92, 36, 104, 4, 81, 29]); horn(c, [55, 24, 65, 9, 75, 24], '#ffd54a');
    c.beginPath(); c.arc(65, 51 + b, 34, Math.PI * 1.12, Math.PI * 1.88); c.fillStyle = '#2b1f3a'; c.fill();
    eye(c, 52, 56 + b, 7, '#ffcc00', 'fierce'); eye(c, 78, 56 + b, 6.6, '#ffcc00', 'fierce', true);
    line(c, [46, 70 + b, 53, 65 + b, 59, 70 + b, 65, 65 + b, 71, 70 + b, 77, 65 + b, 84, 70 + b], INK, 2.8); poly(c, [48, 67 + b, 51, 76 + b, 54, 67 + b]); fillC(c, '#fff', INK, 1.2); poly(c, [76, 67 + b, 79, 76 + b, 82, 67 + b]); fillC(c, '#fff', INK, 1.2);
    c.save(); c.translate(110, 84); c.rotate(st === 'w' ? -2.3 : -0.55); rrect(c, -9, -58, 19, 64, 8); const g = c.createLinearGradient(-9, 0, 10, 0); g.addColorStop(0, '#ffe38a'); g.addColorStop(0.5, '#ffcf3f'); g.addColorStop(1, '#b8860b'); fillC(c, g, INK, 2.2);
    for (let i = 0; i < 5; i++) { circle(c, -10, -50 + i * 11, 3.3); fillC(c, '#fff8d0', INK, 1.2); circle(c, 11, -45 + i * 11, 3.3); fillC(c, '#fff8d0', INK, 1.2); } c.restore(); } },
  boss_imugi: { w: 150, h: 128, foot: 122, frames: 2, draw: (c, f, st) => {
    const sw = f ? 3 : -3; const body = '#2f8f86';
    for (let i = 0; i < 3; i++) { ellipse(c, 75 - i * 7 + (i === 1 ? sw : 0), 106 - i * 18, 54 - i * 11, 16 - i * 1.5); vol(c, body, 20, 88 - i * 18, 130, 122 - i * 18); ellipse(c, 75 - i * 7, 109 - i * 18, 38 - i * 9, 6); c.fillStyle = 'rgba(191,232,200,0.55)'; c.fill(); }
    c.beginPath(); c.moveTo(68, 56); c.quadraticCurveTo(76 + sw, 34, 94, 27); c.lineWidth = 25; c.strokeStyle = INK; c.stroke(); c.lineWidth = 20; c.strokeStyle = body; c.stroke();
    ellipse(c, 102, 25, 24, 16); vol(c, body, 78, 9, 126, 41, 2.4); ellipse(c, 118, 30 + (st === 'w' ? 3 : 0), 11, st === 'w' ? 9 : 7); vol(c, '#3aa89c', 107, 23, 129, 39, 2);
    if (st === 'w') { ellipse(c, 121, 34, 5, 4); c.fillStyle = '#5a0f1a'; c.fill(); }
    eye(c, 100, 20, 4.6, '#ffe066', 'fierce'); line(c, [118, 34, 140, 45, 133, 56], '#e8f4d0', 2.2); line(c, [118, 34, 136, 24, 146, 31], '#e8f4d0', 2.2);
    for (let i = 0; i < 5; i++) { poly(c, [84 + i * 8, 13 - (i % 2) * 2, 88 + i * 8, 2, 92 + i * 8, 13]); fillC(c, '#7fe0d0', INK, 1.2); } } },
  boss_reaper: { w: 96, h: 128, foot: 124, frames: 2, draw: (c, f, st) => {
    const fl = f ? -2 : 0; c.save(); c.translate(0, fl);
    c.beginPath(); c.moveTo(30, 44); c.lineTo(15, 120); c.quadraticCurveTo(48, 126, 81, 120); c.lineTo(66, 44); c.closePath(); vol(c, '#16131f', 15, 44, 81, 124, 2, '#5b4d8a', 0.18, -0.2);
    line(c, [48, 48, 48, 118], '#2a2440', 2); c.beginPath(); c.moveTo(38, 50); c.lineTo(48, 66); c.lineTo(58, 50); c.strokeStyle = INK; c.lineWidth = 4.5; c.stroke(); c.strokeStyle = '#e8e4f4'; c.lineWidth = 3; c.stroke();
    circle(c, 48, 36, 15.5); vol(c, '#f4f2fa', 33, 21, 63, 51); ellipse(c, 41.5, 36, 3.8, 1.8); c.fillStyle = INK; c.fill(); ellipse(c, 54.5, 36, 3.8, 1.8); c.fill(); ellipse(c, 48, 45, 3.2, 1.9); c.fillStyle = '#c01e3a'; c.fill();
    ellipse(c, 48, 23, 36, 8); c.fillStyle = 'rgba(12,10,20,0.92)'; c.fill(); c.strokeStyle = '#5b4d8a'; c.lineWidth = 1.6; c.stroke(); rrect(c, 36, 1, 24, 22, 8); vol(c, '#0e0c16', 36, 1, 60, 23, 1.6, '#5b4d8a');
    line(c, [14, 26, 22, 66], 'rgba(90,80,130,0.6)', 1.2); line(c, [82, 26, 74, 66], 'rgba(90,80,130,0.6)', 1.2);
    c.save(); c.translate(70, 72); c.rotate(st === 'w' ? -1.4 : 0); rrect(c, -2, -5, 22, 9, 3); fillC(c, '#e8dcc0', INK, 1.6); c.fillStyle = INK; c.fillRect(2, -1.5, 14, 1.3); if (st === 'w') { circle(c, 20, 0, 7); const g = c.createRadialGradient(20, 0, 0, 20, 0, 9); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(184,166,255,0)'); c.fillStyle = g; c.fill(); } c.restore();
    c.restore(); } },
  boss_gumiho: { w: 150, h: 128, foot: 124, frames: 3, draw: (c, f, st) => {
    const sp = st === 'w' ? 1.25 : 1; const sway = [0, 0.06, -0.06][f];
    for (let i = 0; i < 9; i++) { const a = (-Math.PI * 0.95 + (i / 8) * Math.PI * 0.9) * sp + sway * (i % 2 ? 1 : -1); c.beginPath(); c.moveTo(56, 80); c.quadraticCurveTo(56 + Math.cos(a) * 34, 68 + Math.sin(a) * 44, 56 + Math.cos(a) * 58, 66 + Math.sin(a) * 58);
      c.strokeStyle = INK; c.lineWidth = 15; c.stroke(); c.strokeStyle = i % 2 ? '#fff6ee' : '#ffe1c8'; c.lineWidth = 11.5; c.stroke(); circle(c, 56 + Math.cos(a) * 58, 66 + Math.sin(a) * 58, 6); c.fillStyle = '#ff9a3c'; c.fill(); }
    ellipse(c, 78, 92, 33, 20); vol(c, '#fff6ee', 45, 72, 111, 112); rrect(c, 58, 98, 10, 22, 5); vol(c, '#fff6ee', 58, 98, 68, 120); rrect(c, 90, 98, 10, 22, 5); vol(c, '#fff6ee', 90, 98, 100, 120);
    circle(c, 106, 63, 22); vol(c, '#fff6ee', 84, 41, 128, 85); horn(c, [90, 50, 90, 25, 103, 43], '#fff6ee'); horn(c, [116, 45, 125, 22, 125, 50], '#fff6ee');
    poly(c, [114, 70, 137, 70, 118, 79]); fillC(c, '#fff6ee', INK, 2); circle(c, 136, 70, 3.2); c.fillStyle = INK; c.fill();
    ellipse(c, 101, 61, 5, 2.4, -0.3); c.fillStyle = st === 'w' ? '#ff3b3b' : '#c01e3a'; c.fill(); ellipse(c, 114, 61, 5, 2.4, 0.3); c.fill(); line(c, [107, 50, 107, 55], '#c01e3a', 2.6); } },
  boss_bulgasari: { w: 196, h: 172, foot: 166, frames: 2, draw: (c, f, st) => {
    const l = f ? 3 : -3; const head = st === 'w' ? -8 : 0;
    rrect(c, 50 + l, 126, 30, 40, 9); vol(c, '#3a3d48', 50, 126, 80, 166); rrect(c, 118 - l, 126, 30, 40, 9); vol(c, '#3a3d48', 118, 126, 148, 166);
    ellipse(c, 98, 104, 72, 50); vol(c, '#5c616f', 26, 54, 170, 154, 2.6, INK, 0.18, -0.35);
    for (let i = 0; i < 18; i++) { const a = Math.PI + (i / 17) * Math.PI; const x = 98 + Math.cos(a) * 68, y = 100 + Math.sin(a) * 47; poly(c, [x - 5, y + 3, x + Math.cos(a) * 18, y + Math.sin(a) * 18, x + 5, y + 3]); vol(c, '#8a8f9e', x - 5, y - 10, x + 5, y + 3, 1.4); }
    for (const [x1, y1, x2, y2] of [[56, 102, 78, 114], [102, 124, 124, 108], [136, 96, 150, 114], [74, 128, 90, 118], [96, 84, 112, 96]]) { line(c, [x1, y1, x2, y2], '#ff7a2a', 3.4); line(c, [x1, y1, x2, y2], '#ffe08a', 1.2); }
    c.save(); c.translate(0, head); circle(c, 150, 72, 33); vol(c, '#4a4e5c', 117, 39, 183, 105, 2.6); ellipse(c, 170, 95, 10, 24, -0.3); vol(c, '#4a4e5c', 160, 72, 180, 118, 2.2); ellipse(c, 174, 117, 8, 6); vol(c, '#3a3d48', 166, 111, 182, 123, 2);
    eye(c, 145, 65, 7, '#ff2a2a', 'fierce'); eye(c, 162, 65, 6.6, '#ff2a2a', 'fierce', true); horn(c, [128, 45, 123, 24, 140, 41], '#8a8f9e'); horn(c, [166, 42, 175, 22, 171, 47], '#8a8f9e');
    poly(c, [134, 86, 138, 95, 142, 86]); fillC(c, '#fff', INK, 1.2); poly(c, [152, 86, 156, 95, 160, 86]); fillC(c, '#fff', INK, 1.2); c.restore();
    c.beginPath(); c.moveTo(28, 98); c.quadraticCurveTo(0, 80, 9, 56); c.strokeStyle = INK; c.lineWidth = 10; c.stroke(); c.strokeStyle = '#ff9a3c'; c.lineWidth = 6.5; c.stroke(); } },
};

