// World props: trees, rocks, lanterns, totems, graves, hanok houses, shrines, the moon tree, the altar.
import { type Ctx, INK, vol, circle, ellipse, rrect, poly, fillC, line, inkLine, eye, shade } from './core.ts';

export interface PropArt { w: number; h: number; foot: number; draw: (c: Ctx, v: number) => void }
function canopy(c: Ctx, x: number, y: number, r: number, pal: string[]): void {
  const blob = (bx: number, by: number, br: number, col: string) => { circle(c, bx, by, br); vol(c, col, bx - br, by - br, bx + br, by + br, 2.2, INK, 0.2, -0.3); };
  blob(x - r * 0.62, y + r * 0.2, r * 0.66, pal[0]); blob(x + r * 0.62, y + r * 0.22, r * 0.66, pal[0]); blob(x, y + r * 0.35, r * 0.6, pal[0]);
  blob(x - r * 0.3, y - r * 0.28, r * 0.64, pal[1]); blob(x + r * 0.35, y - r * 0.3, r * 0.58, pal[1]); blob(x, y - r * 0.62, r * 0.5, pal[2]);
  c.globalAlpha = 0.5; circle(c, x - r * 0.3, y - r * 0.72, r * 0.22); c.fillStyle = pal[3]; c.fill(); circle(c, x + r * 0.15, y - r * 0.9, r * 0.12); c.fill(); c.globalAlpha = 1;
}
function trunk(c: Ctx, x: number, top: number, bot: number, w: number, col = '#4a3024'): void { c.beginPath(); c.moveTo(x - w / 2, top); c.lineTo(x - w * 0.7, bot); c.quadraticCurveTo(x, bot + 3, x + w * 0.7, bot); c.lineTo(x + w / 2, top); c.closePath(); vol(c, col, x - w, top, x + w, bot, 2); }
const TREE_PAL = [['#173d2a', '#22583c', '#2f7550', '#8fd8a8'], ['#163627', '#1e4f37', '#2a6848', '#7cc89a'], ['#1b4531', '#276444', '#358a5c', '#a8e8bc']];
const MAPLE_PAL = [['#7a2418', '#b8452a', '#e0683a', '#ffc08a'], ['#8a3414', '#c8621f', '#f08a34', '#ffd89a'], ['#6a1a22', '#a82c36', '#d84a4a', '#ff9a8a']];
export const PROP_ART: Record<string, PropArt> = {
  tree: { w: 76, h: 100, foot: 96, draw: (c, v) => { trunk(c, 38, 60, 95, 11); canopy(c, 38, 44 - (v % 2) * 3, 27 + (v % 3) * 2, TREE_PAL[v % 3]); } },
  pine: { w: 68, h: 106, foot: 102, draw: (c, v) => { trunk(c, 34, 76, 101, 9); const d = v % 2 ? '#163a29' : '#1b4431';
    for (let i = 0; i < 4; i++) { const y = 10 + i * 17, hw = 12 + i * 7; poly(c, [34, y, 34 - hw, y + 26, 34 - hw * 0.4, y + 23, 34, y + 28, 34 + hw * 0.4, y + 23, 34 + hw, y + 26]); vol(c, i === 0 ? '#2f7550' : d, 34 - hw, y, 34 + hw, y + 28, 2, INK, 0.25, -0.25); }
    c.globalAlpha = 0.45; poly(c, [34, 12, 26, 34, 34, 30]); c.fillStyle = '#9fe0b8'; c.fill(); c.globalAlpha = 1; } },
  maple: { w: 76, h: 100, foot: 96, draw: (c, v) => { trunk(c, 38, 60, 95, 11, '#3e2a24'); canopy(c, 38, 44, 28, MAPLE_PAL[v % 3]); } },
  deadtree: { w: 70, h: 96, foot: 92, draw: (c) => { trunk(c, 35, 36, 91, 10, '#5a4a44'); for (const [a, b, x, y] of [[35, 58, 12, 38], [35, 48, 58, 26], [35, 40, 24, 14], [35, 44, 50, 10], [22, 46, 8, 48], [50, 30, 62, 22]]) inkLine(c, [a, b, x, y], '#6a5a54', 3.5); } },
  rock: { w: 58, h: 52, foot: 48, draw: (c, v) => { poly(c, [7, 44, 11, 20, 26, 7, 42, 11, 52, 30, 48, 46]); vol(c, v % 2 ? '#6e6874' : '#7c7068', 7, 7, 52, 46, 2.2, INK, 0.3, -0.35); line(c, [26, 24, 36, 38], 'rgba(18,12,28,0.35)', 2); poly(c, [14, 22, 26, 11, 34, 14, 20, 26]); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fill(); } },
  lantern: { w: 44, h: 76, foot: 72, draw: (c) => {
    rrect(c, 17, 46, 10, 24, 2); vol(c, '#8a8690', 17, 46, 27, 70, 1.8); rrect(c, 11, 42, 22, 6, 2); vol(c, '#9a96a0', 11, 42, 33, 48, 1.8);
    rrect(c, 13, 26, 18, 17, 3); vol(c, '#8a8690', 13, 26, 31, 43, 1.8); rrect(c, 16, 29, 12, 10, 2); const g = c.createRadialGradient(22, 34, 1, 22, 34, 8); g.addColorStop(0, '#fff6d0'); g.addColorStop(1, '#ffb040'); c.fillStyle = g; c.fill();
    poly(c, [6, 27, 22, 14, 38, 27]); vol(c, '#6a6670', 6, 14, 38, 27, 1.8); circle(c, 22, 12, 3.2); vol(c, '#8a8690', 19, 9, 25, 15, 1.4); } },
  jangseung: { w: 46, h: 88, foot: 84, draw: (c) => {
    rrect(c, 14, 20, 18, 62, 6); vol(c, '#9a6a3e', 14, 20, 32, 82); ellipse(c, 23, 17, 12, 5.5); vol(c, '#2b2233', 11, 12, 35, 23); rrect(c, 17, 5, 12, 11, 3); vol(c, '#2b2233', 17, 5, 29, 16);
    ellipse(c, 23, 29, 10, 9); fillC(c, '#d8a070', null); eye(c, 19, 27, 2.5, '#1b1426'); eye(c, 27.5, 27, 2.4, '#1b1426', 'open', true); ellipse(c, 23, 33, 3, 2); fillC(c, '#8a3322', null); rrect(c, 18, 36, 10, 3.4, 1); fillC(c, '#fff', INK, 1);
    c.fillStyle = INK; c.font = 'bold 7px serif'; c.textAlign = 'center'; ['地', '下', '女', '將'].forEach((ch, i) => c.fillText(ch, 23, 50 + i * 8)); } },
  grave: { w: 52, h: 44, foot: 40, draw: (c) => { ellipse(c, 26, 31, 21, 10); vol(c, '#3f5a3a', 5, 21, 47, 41); c.globalAlpha = 0.4; ellipse(c, 21, 27, 9, 4); c.fillStyle = '#8aaa7a'; c.fill(); c.globalAlpha = 1; rrect(c, 20, 9, 12, 19, 2); vol(c, '#a09aa6', 20, 9, 32, 28, 1.8); line(c, [23, 15, 29, 15], '#5a5660', 1.2); line(c, [23, 20, 29, 20], '#5a5660', 1.2); } },
  moontree: { w: 200, h: 224, foot: 204, draw: (c) => {
    rrect(c, 86, 120, 28, 86, 10); vol(c, '#5a4a6a', 86, 120, 114, 206, 2.4); inkLine(c, [100, 168, 66, 210], '#5a4a6a', 9); inkLine(c, [100, 168, 136, 210], '#5a4a6a', 9);
    const g = c.createRadialGradient(100, 86, 12, 100, 90, 100); g.addColorStop(0, '#f2f8ff'); g.addColorStop(0.45, '#aecdff'); g.addColorStop(1, '#4d6cc0');
    const blobs = [[54, 98, 42], [146, 98, 42], [100, 62, 50], [68, 54, 33], [132, 54, 33], [100, 108, 44], [100, 28, 26]];
    for (const [x, y, r] of blobs) { circle(c, x, y, r); c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.6; c.stroke(); }
    for (const [x, y, r] of blobs) { circle(c, x, y, r - 2.2); c.fillStyle = g; c.fill(); }
    const cols = ['#ff5a6a', '#ffd54a', '#7fe0a0', '#7fb8ff', '#e08aff', '#ffffff'];
    for (let i = 0; i < 22; i++) { const x = 40 + (i * 37) % 120, y = 64 + (i * 23) % 60; inkLine(c, [x, y, x + 2, y + 16], cols[i % cols.length], 2.4); }
    for (let i = 0; i < 26; i++) { circle(c, 28 + (i * 53) % 144, 22 + (i * 31) % 104, 1.8); c.fillStyle = '#fff'; c.fill(); } } },
  shrine: { w: 84, h: 88, foot: 84, draw: (c) => {
    for (const x of [14, 70]) { rrect(c, x - 3.5, 16, 7, 68, 2); vol(c, '#c8323a', x - 4, 16, x + 4, 84, 1.8); }
    rrect(c, 4, 11, 76, 7, 2); vol(c, '#c8323a', 4, 11, 80, 18, 1.8); rrect(c, 9, 23, 66, 5, 2); vol(c, '#c8323a', 9, 23, 75, 28, 1.6);
    for (let i = 0; i < 11; i++) { inkLine(c, [16 + i * 5.2, 28, 16 + i * 5.2, 10], '#c8323a', 1.6); poly(c, [14 + i * 5.2, 11, 16 + i * 5.2, 5, 18 + i * 5.2, 11]); fillC(c, '#c8323a', INK, 1); }
    circle(c, 42, 14, 5); vol(c, '#1c3a8a', 37, 9, 47, 19, 1.4); c.beginPath(); c.arc(42, 14, 5, Math.PI * 0.5, Math.PI * 1.5); c.fillStyle = '#c8323a'; c.fill();
    poly(c, [30, 84, 34, 56, 50, 54, 54, 84]); vol(c, '#8a8690', 30, 54, 54, 84, 1.8); circle(c, 42, 48, 8); const g = c.createRadialGradient(42, 48, 1, 42, 48, 9); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#8fc6ff'); fillC(c, g, INK, 2); } },
  altar: { w: 76, h: 70, foot: 66, draw: (c) => { poly(c, [8, 62, 15, 36, 61, 36, 68, 62]); vol(c, '#6a5a5a', 8, 36, 68, 62); rrect(c, 21, 15, 34, 23, 4); vol(c, '#7a6a6a', 21, 15, 55, 38); circle(c, 38, 26, 7); const g = c.createRadialGradient(38, 26, 1, 38, 26, 8); g.addColorStop(0, '#fff0d0'); g.addColorStop(1, '#ff5a3c'); fillC(c, g, INK, 2); } },
};
/** Hanok house: whitewashed walls, wooden frame, glowing paper windows, curved tiled roof with lifted eaves. */
export function drawHouse(c: Ctx, W: number, H: number, v: number): void {
  const ox = 8, top = 38;
  rrect(c, ox + 3, top + 4, W - 6, H - 4, 2); vol(c, '#ece3d0', ox, top, ox + W, top + H, 2.2, INK, 0.1, -0.2);
  for (let x = ox + 3; x < ox + W - 3; x += 16) inkLine(c, [x, top + 5, x, top + H], '#6a4a2a', 1.8);
  inkLine(c, [ox + 3, top + H * 0.55, ox + W - 3, top + H * 0.55], '#6a4a2a', 1.6);
  for (let i = 0; i < Math.floor((W - 20) / 22); i++) { const wx = ox + 12 + i * 22; rrect(c, wx, top + 12, 13, 12, 1); const g = c.createLinearGradient(0, top + 12, 0, top + 24); g.addColorStop(0, '#fff2c0'); g.addColorStop(1, '#ffb65a'); fillC(c, (i + v) % 3 === 0 ? '#3a3040' : g, INK, 1.4); line(c, [wx + 6.5, top + 12, wx + 6.5, top + 24], '#6a4a2a', 1); line(c, [wx, top + 18, wx + 13, top + 18], '#6a4a2a', 1); }
  rrect(c, ox + W / 2 - 9, top + H - 20, 18, 20, 2); vol(c, '#8a5a34', ox + W / 2 - 9, top + H - 20, ox + W / 2 + 9, top + H, 1.8);
  rrect(c, ox - 2, top + H - 2, W + 4, 6, 2); vol(c, '#8a8690', ox, top + H, ox + W, top + H + 6, 1.6);
  c.beginPath(); c.moveTo(ox - 10, top + 8); c.quadraticCurveTo(ox + W / 2, top + 22, ox + W + 10, top + 8); c.lineTo(ox + W - 10, top - 22); c.quadraticCurveTo(ox + W / 2, top - 33, ox + 10, top - 22); c.closePath();
  const g = c.createLinearGradient(0, top - 33, 0, top + 20); g.addColorStop(0, '#46506e'); g.addColorStop(1, '#1e2234'); c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.6; c.stroke();
  for (let x = ox + 2; x < ox + W; x += 6.5) line(c, [x, top - 24 + Math.abs(x - ox - W / 2) * 0.12, x + (x - ox - W / 2) * 0.05, top + 11 - Math.abs(x - ox - W / 2) * 0.1], 'rgba(8,10,22,0.55)', 1.3);
  inkLine(c, [ox + 8, top - 23, ox + W - 8, top - 23], '#f0ebe0', 2.4); circle(c, ox - 8, top + 7, 2.5); c.fillStyle = '#f0ebe0'; c.fill(); circle(c, ox + W + 8, top + 7, 2.5); c.fill();
}
export { shade };
