// Procedurally drawn sprites (no external assets). Cached per key on offscreen canvases.
import type { UnitKind, MythicId, EnemyType } from '../sim/types';

type Ctx = CanvasRenderingContext2D;
const cache = new Map<string, HTMLCanvasElement>();
export const SPR = 56; // sprite canvas size (logical px); units are drawn ~40px tall

export function clearSpriteCache(): void { cache.clear(); }

function make(key: string, size: number, draw: (c: Ctx) => void, dpr: number): HTMLCanvasElement {
  const k = `${key}@${dpr}`;
  let cv = cache.get(k);
  if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = size * dpr; cv.height = size * dpr;
  const c = cv.getContext('2d')!; c.scale(dpr, dpr); c.lineJoin = 'round'; c.lineCap = 'round';
  draw(c); cache.set(k, cv); return cv;
}

// ---------- helpers ----------
function circle(c: Ctx, x: number, y: number, r: number, fill: string, stroke?: string, lw = 1.5) {
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string, stroke?: string, lw = 1.5, rot = 0) {
  c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string, lw = 1.5) {
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function eyes(c: Ctx, x: number, y: number, gap: number, r: number, angry = false) {
  circle(c, x - gap, y, r, '#fff'); circle(c, x + gap, y, r, '#fff');
  circle(c, x - gap + 0.5, y + 0.3, r * 0.55, '#222'); circle(c, x + gap + 0.5, y + 0.3, r * 0.55, '#222');
  if (angry) { c.strokeStyle = '#222'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - gap - r, y - r - 1); c.lineTo(x - gap + r * 0.6, y - r + 1); c.moveTo(x + gap + r, y - r - 1); c.lineTo(x + gap - r * 0.6, y - r + 1); c.stroke(); }
}
function smile(c: Ctx, x: number, y: number, w: number) { c.strokeStyle = '#222'; c.lineWidth = 1.3; c.beginPath(); c.arc(x, y, w, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
const OUT = '#2b1d14';

// ---------- units ----------
const GRADE_COLORS = ['#9e9e9e', '#42a5f5', '#ab47bc', '#ffb300', '#ff1744'];
export const GRADE_HEX = GRADE_COLORS;

function drawGradeDeco(c: Ctx, grade: number) {
  const cx = 28, base = 46;
  if (grade === 1) { // 희귀: silver band + gem
    c.strokeStyle = '#cfd8dc'; c.lineWidth = 2.5; c.beginPath(); c.ellipse(cx, base, 15, 4, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#42a5f5'; c.beginPath(); c.moveTo(cx, 30); c.lineTo(cx + 3, 33); c.lineTo(cx, 36); c.lineTo(cx - 3, 33); c.closePath(); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 0.8; c.stroke();
  } else if (grade === 2) { // 영웅: gold trim + star
    c.strokeStyle = '#ffca28'; c.lineWidth = 3; c.beginPath(); c.ellipse(cx, base, 16, 4.5, 0, 0, Math.PI * 2); c.stroke();
    star(c, cx + 14, 12, 4, '#ffca28');
  } else if (grade === 3) { // 전설: crown + aura
    const g = c.createRadialGradient(cx, 30, 6, cx, 30, 26); g.addColorStop(0, 'rgba(255,179,0,0.0)'); g.addColorStop(0.7, 'rgba(255,179,0,0.18)'); g.addColorStop(1, 'rgba(255,179,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(cx, 30, 26, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ffb300'; c.lineWidth = 3; c.beginPath(); c.ellipse(cx, base, 17, 5, 0, 0, Math.PI * 2); c.stroke();
    crown(c, cx, 7);
    star(c, cx + 16, 14, 3, '#fff59d'); star(c, cx - 17, 20, 2.5, '#fff59d');
  }
}
function star(c: Ctx, x: number, y: number, r: number, fill: string) {
  c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fillStyle = fill; c.fill();
}
function crown(c: Ctx, x: number, y: number) {
  c.fillStyle = '#ffca28'; c.strokeStyle = '#b8860b'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x - 9, y + 6); c.lineTo(x - 9, y - 2); c.lineTo(x - 4.5, y + 2); c.lineTo(x, y - 5); c.lineTo(x + 4.5, y + 2); c.lineTo(x + 9, y - 2); c.lineTo(x + 9, y + 6); c.closePath(); c.fill(); c.stroke();
  circle(c, x, y - 5, 1.6, '#ef5350');
}

function drawArcher(c: Ctx) {
  // wind-up key on back
  c.strokeStyle = '#8d6e63'; c.lineWidth = 3; c.beginPath(); c.moveTo(14, 26); c.lineTo(8, 26); c.stroke();
  c.strokeStyle = '#a1887f'; c.lineWidth = 2.5; c.beginPath(); c.ellipse(6, 26, 3.5, 5, 0, 0, Math.PI * 2); c.stroke();
  // tin body
  rrect(c, 15, 16, 24, 26, 7, '#d4a83f', OUT);
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(19, 19, 4, 18);
  // visor cap
  rrect(c, 13, 10, 28, 9, 4, '#5d4037', OUT); rrect(c, 11, 16, 32, 3, 1.5, '#3e2723');
  eyes(c, 27, 23, 4.5, 3); smile(c, 27, 27, 3);
  // crossbow on right
  c.strokeStyle = '#4e342e'; c.lineWidth = 3; c.beginPath(); c.moveTo(38, 30); c.lineTo(50, 30); c.stroke();
  c.strokeStyle = '#6d4c41'; c.lineWidth = 2; c.beginPath(); c.moveTo(45, 24); c.quadraticCurveTo(50, 30, 45, 36); c.stroke();
  c.strokeStyle = '#eee'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(45, 24); c.lineTo(45, 36); c.stroke();
  c.strokeStyle = '#ffb300'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(40, 30); c.lineTo(52, 30); c.stroke();
}
function drawRaccoon(c: Ctx) {
  // tail
  c.strokeStyle = OUT; c.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) { ellipse(c, 10 - i * 1.5, 38 - i * 5, 4.5, 3.5, i % 2 ? '#424242' : '#9e9e9e', OUT, 1, -0.6); }
  ellipse(c, 27, 30, 15, 13, '#8d8d8d', OUT); ellipse(c, 27, 34, 9, 7, '#cfcfcf');
  // ears
  c.beginPath(); c.moveTo(15, 20); c.lineTo(18, 10); c.lineTo(23, 19); c.closePath(); c.fillStyle = '#8d8d8d'; c.fill(); c.stroke();
  c.beginPath(); c.moveTo(39, 20); c.lineTo(36, 10); c.lineTo(31, 19); c.closePath(); c.fill(); c.stroke();
  // mask
  ellipse(c, 21, 24, 6, 4, '#3a3a3a'); ellipse(c, 33, 24, 6, 4, '#3a3a3a');
  eyes(c, 27, 24, 6, 2.6); circle(c, 27, 29, 1.8, '#222');
  // firecracker bundle
  rrect(c, 40, 22, 7, 16, 2, '#e53935', OUT); rrect(c, 40, 27, 7, 2, 0, '#ffeb3b');
  c.strokeStyle = '#795548'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(43.5, 22); c.quadraticCurveTo(46, 16, 49, 15); c.stroke(); circle(c, 49, 15, 2, '#ffab00');
}
function drawPenguin(c: Ctx) {
  ellipse(c, 28, 30, 13, 15, '#263238', OUT); ellipse(c, 28, 33, 8, 10, '#eceff1');
  // flippers
  ellipse(c, 15, 31, 3.5, 8, '#263238', OUT, 1.2, 0.3);
  // scarf
  rrect(c, 19, 21, 18, 4, 2, '#ef5350'); 
  eyes(c, 28, 20, 4, 2.6);
  c.fillStyle = '#ff9800'; c.beginPath(); c.moveTo(24, 24); c.lineTo(32, 24); c.lineTo(28, 28); c.closePath(); c.fill();
  ellipse(c, 23, 45, 5, 2.2, '#ff9800'); ellipse(c, 33, 45, 5, 2.2, '#ff9800');
  // ice wand
  c.strokeStyle = '#8d6e63'; c.lineWidth = 2; c.beginPath(); c.moveTo(41, 38); c.lineTo(47, 20); c.stroke();
  c.fillStyle = '#80deea'; c.strokeStyle = '#fff'; c.lineWidth = 1; c.beginPath(); c.moveTo(47, 12); c.lineTo(51, 19); c.lineTo(47, 24); c.lineTo(43, 19); c.closePath(); c.fill(); c.stroke();
}
function drawRabbit(c: Ctx) {
  // ears
  ellipse(c, 22, 12, 4, 11, '#fff8e1', OUT); ellipse(c, 34, 12, 4, 11, '#fff8e1', OUT);
  c.strokeStyle = '#ffd600'; c.lineWidth = 2; c.beginPath(); c.moveTo(22, 5); c.lineTo(20, 10); c.lineTo(24, 12); c.lineTo(21, 18); c.moveTo(34, 5); c.lineTo(32, 10); c.lineTo(36, 12); c.lineTo(33, 18); c.stroke();
  ellipse(c, 28, 31, 13, 13, '#fff8e1', OUT);
  // goggles
  c.strokeStyle = '#616161'; c.lineWidth = 2; c.beginPath(); c.arc(23, 27, 4.2, 0, Math.PI * 2); c.arc(33, 27, 4.2, 0, Math.PI * 2); c.stroke();
  eyes(c, 28, 27, 5, 2.4); circle(c, 28, 32, 1.4, '#e57373');
  c.strokeStyle = '#222'; c.lineWidth = 1; c.beginPath(); c.moveTo(24, 35); c.lineTo(20, 34); c.moveTo(32, 35); c.lineTo(36, 34); c.stroke();
  // lightning tail
  c.fillStyle = '#ffd600'; c.strokeStyle = '#f9a825'; c.lineWidth = 1; c.beginPath(); c.moveTo(42, 30); c.lineTo(50, 24); c.lineTo(46, 31); c.lineTo(52, 30); c.lineTo(43, 40); c.lineTo(46, 33); c.closePath(); c.fill(); c.stroke();
}
function drawMushroom(c: Ctx) {
  rrect(c, 21, 26, 14, 18, 5, '#f5e6c8', OUT);
  eyes(c, 28, 33, 3.5, 2.2); smile(c, 28, 36, 2.5);
  c.beginPath(); c.moveTo(10, 26); c.quadraticCurveTo(28, -4, 46, 26); c.closePath(); c.fillStyle = '#7cb342'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
  circle(c, 20, 18, 3, '#c5e1a5'); circle(c, 31, 12, 3.5, '#c5e1a5'); circle(c, 39, 21, 2.5, '#c5e1a5');
  // drips
  c.fillStyle = '#9ccc65'; c.beginPath(); c.moveTo(14, 26); c.lineTo(14, 32); c.arc(14, 32, 2, 0, Math.PI); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(42, 26); c.lineTo(42, 30); c.arc(42, 30, 1.6, 0, Math.PI); c.closePath(); c.fill();
}
function drawBear(c: Ctx) {
  circle(c, 16, 18, 5, '#8d6e63', OUT); circle(c, 38, 18, 5, '#8d6e63', OUT);
  ellipse(c, 27, 31, 15, 14, '#8d6e63', OUT); ellipse(c, 27, 36, 8, 6, '#d7ccc8');
  eyes(c, 27, 26, 5, 2.4); circle(c, 27, 34, 2.2, '#3e2723');
  // magnet (horseshoe)
  c.lineWidth = 5; c.strokeStyle = '#e53935'; c.beginPath(); c.arc(47, 32, 7, Math.PI * 0.9, Math.PI * 1.9); c.stroke();
  c.strokeStyle = '#90a4ae'; c.beginPath(); c.moveTo(40.5, 33); c.lineTo(40.5, 38); c.moveTo(53.5, 33); c.lineTo(53.5, 38); c.stroke();
}
function drawMechanic(c: Ctx) {
  // hat with pipe
  rrect(c, 17, 10, 22, 9, 3, '#b0885a', OUT); rrect(c, 36, 2, 5, 10, 1.5, '#78909c', OUT);
  circle(c, 38.5, 1, 3, 'rgba(255,255,255,0.7)');
  rrect(c, 18, 18, 20, 24, 6, '#ffe0b2', OUT);
  rrect(c, 20, 30, 16, 12, 3, '#546e7a');
  // goggles
  c.strokeStyle = '#37474f'; c.lineWidth = 2; c.beginPath(); c.arc(23, 22, 4, 0, Math.PI * 2); c.arc(33, 22, 4, 0, Math.PI * 2); c.stroke();
  circle(c, 23, 22, 2.6, '#80deea'); circle(c, 33, 22, 2.6, '#80deea'); smile(c, 28, 28, 2.5);
  // wrench
  c.strokeStyle = '#90a4ae'; c.lineWidth = 3; c.beginPath(); c.moveTo(40, 40); c.lineTo(50, 24); c.stroke(); circle(c, 51, 22, 4, '#90a4ae', '#546e7a'); circle(c, 51, 22, 1.6, '#ffe0b2');
}
function drawToad(c: Ctx) {
  ellipse(c, 28, 33, 17, 12, '#f9c74f', OUT); ellipse(c, 28, 38, 11, 6, '#fff3c4');
  circle(c, 20, 22, 5.5, '#f9c74f', OUT); circle(c, 36, 22, 5.5, '#f9c74f', OUT);
  circle(c, 20, 22, 3, '#fff'); circle(c, 36, 22, 3, '#fff'); circle(c, 20.5, 22.5, 1.6, '#222'); circle(c, 36.5, 22.5, 1.6, '#222');
  c.strokeStyle = '#222'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(21, 31); c.quadraticCurveTo(28, 35, 35, 31); c.stroke();
  circle(c, 15, 34, 2, '#e0a92f'); circle(c, 40, 30, 1.8, '#e0a92f');
  // coin
  circle(c, 46, 36, 6, '#ffd54f', '#b8860b', 1.5); c.fillStyle = '#b8860b'; c.font = 'bold 7px sans-serif'; c.textAlign = 'center'; c.fillText('金', 46, 38.5);
}

const UNIT_DRAW: Record<UnitKind, (c: Ctx) => void> = { archer: drawArcher, raccoon: drawRaccoon, penguin: drawPenguin, rabbit: drawRabbit, mushroom: drawMushroom, bear: drawBear, mechanic: drawMechanic, toad: drawToad };

function drawMythic(c: Ctx, id: MythicId) {
  if (id === 'storm') {
    // purple dragon coil
    c.strokeStyle = '#7c4dff'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(10, 40); c.quadraticCurveTo(20, 10, 30, 30); c.quadraticCurveTo(38, 44, 48, 22); c.stroke();
    c.strokeStyle = '#b388ff'; c.lineWidth = 3; c.beginPath(); c.moveTo(10, 40); c.quadraticCurveTo(20, 10, 30, 30); c.quadraticCurveTo(38, 44, 48, 22); c.stroke();
    circle(c, 48, 20, 8, '#7c4dff', OUT); eyes(c, 48, 19, 3, 2.2, true);
    c.fillStyle = '#ffd600'; c.beginPath(); c.moveTo(42, 8); c.lineTo(48, 2); c.lineTo(46, 9); c.lineTo(52, 8); c.lineTo(45, 14); c.closePath(); c.fill();
    c.strokeStyle = '#ffee58'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(6, 30); c.lineTo(10, 25); c.lineTo(7, 24); c.lineTo(12, 18); c.stroke();
  } else if (id === 'sun') {
    rrect(c, 8, 36, 40, 10, 4, '#5d4037', OUT);
    circle(c, 14, 44, 5, '#3e2723', OUT); circle(c, 42, 44, 5, '#3e2723', OUT);
    c.save(); c.translate(28, 32); c.rotate(-0.6); rrect(c, -8, -24, 16, 26, 5, '#ff9100', OUT); rrect(c, -5, -22, 4, 18, 2, 'rgba(255,255,255,0.4)'); c.restore();
    const g = c.createRadialGradient(28, 10, 2, 28, 10, 12); g.addColorStop(0, '#fff176'); g.addColorStop(1, 'rgba(255,145,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(28, 10, 12, 0, Math.PI * 2); c.fill();
    circle(c, 28, 10, 5, '#ffd600', '#ff6f00');
  } else if (id === 'chrono') {
    c.beginPath(); c.moveTo(14, 46); c.quadraticCurveTo(28, 6, 42, 46); c.closePath(); c.fillStyle = '#00acc1'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
    circle(c, 28, 16, 8, '#e0f7fa', OUT); eyes(c, 28, 16, 3, 2);
    circle(c, 40, 30, 8, '#fff', '#006064', 2); c.strokeStyle = '#006064'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(40, 30); c.lineTo(40, 25); c.moveTo(40, 30); c.lineTo(44, 31); c.stroke();
    c.strokeStyle = '#80deea'; c.lineWidth = 1.2; c.beginPath(); c.arc(28, 34, 16, 0.2, 2.9); c.stroke();
  } else {
    rrect(c, 12, 14, 32, 32, 8, '#ffd600', OUT); rrect(c, 17, 20, 22, 14, 4, '#fbc02d', OUT);
    eyes(c, 28, 26, 5, 2.8, true); c.fillStyle = '#5d4037'; c.fillRect(22, 31, 12, 2.5);
    rrect(c, 4, 22, 9, 20, 4, '#ffca28', OUT); rrect(c, 43, 22, 9, 20, 4, '#ffca28', OUT);
    crown(c, 28, 6);
  }
}

export function unitSprite(kind: UnitKind, grade: number, mythic: MythicId | null, dpr: number): HTMLCanvasElement {
  return make(`u:${mythic ?? kind}:${grade}`, SPR, c => {
    if (mythic) drawMythic(c, mythic); else { drawGradeDeco(c, grade); UNIT_DRAW[kind](c); if (grade === 3) crown(c, 28, 8); if (grade === 2) { c.fillStyle = '#ffca28'; c.fillRect(20, 44, 16, 2); } }
  }, dpr);
}

// ---------- enemies ----------
function drawEnemyBody(c: Ctx, type: EnemyType) {
  const cx = 28, cy = 30;
  switch (type) {
    case 'wisp': c.beginPath(); c.moveTo(cx, 8); c.quadraticCurveTo(44, 26, cx, 44); c.quadraticCurveTo(12, 26, cx, 8); c.fillStyle = '#4dd0e1'; c.fill(); c.strokeStyle = '#006064'; c.lineWidth = 1.5; c.stroke();
      c.beginPath(); c.moveTo(cx, 16); c.quadraticCurveTo(36, 28, cx, 40); c.quadraticCurveTo(20, 28, cx, 16); c.fillStyle = '#e0f7fa'; c.fill(); eyes(c, cx, 28, 4, 2.4, true); break;
    case 'fox': c.fillStyle = '#5e35b1'; c.strokeStyle = '#311b92'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(8, 40); c.lineTo(20, 22); c.lineTo(16, 10); c.lineTo(28, 20); c.lineTo(40, 10); c.lineTo(36, 22); c.lineTo(48, 40); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(8, 40); c.lineTo(2, 30); c.lineTo(10, 32); c.closePath(); c.fill(); eyes(c, 28, 28, 5, 2.4, true); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(24, 36); c.lineTo(27, 41); c.lineTo(30, 36); c.closePath(); c.fill(); break;
    case 'tortoise': c.fillStyle = '#6d4c41'; c.strokeStyle = '#3e2723'; c.lineWidth = 2;
      c.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; c.lineTo(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17); } c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = '#a1887f'; c.lineWidth = 1.2; c.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17); } c.stroke();
      circle(c, cx + 20, cy + 4, 6, '#8bc34a', '#33691e'); eyes(c, cx + 21, cy + 3, 2.2, 1.4); break;
    case 'troll': ellipse(c, cx, cy + 2, 17, 15, '#66bb6a', '#2e7d32'); circle(c, cx - 8, cy - 8, 5, '#a5d6a7'); circle(c, cx + 9, cy + 7, 4, '#a5d6a7'); circle(c, cx + 4, cy - 12, 3, '#a5d6a7');
      eyes(c, cx, cy - 2, 6, 3, true); c.fillStyle = '#fff'; c.fillRect(cx - 6, cy + 6, 4, 4); c.fillRect(cx + 3, cy + 6, 4, 4); break;
    case 'slime': case 'slimelet': { const r = type === 'slime' ? 16 : 10; c.beginPath(); c.moveTo(cx, cy - r - 4); c.quadraticCurveTo(cx + r + 4, cy + r * 0.2, cx, cy + r); c.quadraticCurveTo(cx - r - 4, cy + r * 0.2, cx, cy - r - 4); c.fillStyle = '#29b6f6'; c.fill(); c.strokeStyle = '#0277bd'; c.lineWidth = 1.5; c.stroke();
      circle(c, cx - r * 0.35, cy - r * 0.2, r * 0.25, 'rgba(255,255,255,0.7)'); eyes(c, cx, cy + 2, r * 0.35, r * 0.16); break; }
    case 'ghost': c.save(); c.translate(cx, cy); c.rotate(0.15); rrect(c, -11, -18, 22, 36, 3, '#fce4ec', '#ad1457', 1.5); c.fillStyle = '#c62828'; c.font = 'bold 12px serif'; c.textAlign = 'center'; c.fillText('符', 0, -4); c.restore();
      eyes(c, cx, cy + 8, 4, 2.2, true); break;
    case 'caster': ellipse(c, cx, cy, 8, 13, '#ab47bc', '#6a1b9a'); ellipse(c, cx - 12, cy - 6, 9, 4, 'rgba(225,190,231,0.7)', '#8e24aa', 1, -0.4); ellipse(c, cx + 12, cy - 6, 9, 4, 'rgba(225,190,231,0.7)', '#8e24aa', 1, 0.4);
      circle(c, cx, cy - 14, 6, '#ce93d8', '#6a1b9a'); eyes(c, cx, cy - 14, 2.6, 1.8, true); c.strokeStyle = '#6a1b9a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx, cy - 8); c.lineTo(cx, cy + 2); c.stroke();
      c.strokeStyle = '#8d6e63'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx + 10, cy + 14); c.lineTo(cx + 16, cy - 4); c.stroke(); circle(c, cx + 16, cy - 6, 3.5, '#ffd54f', '#f57f17'); break;
    case 'ogre': ellipse(c, cx, cy + 2, 19, 17, '#e53935', '#7f0000', 2); c.fillStyle = '#fff3e0'; c.strokeStyle = '#5d4037'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(cx - 12, cy - 10); c.lineTo(cx - 16, cy - 24); c.lineTo(cx - 6, cy - 14); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(cx + 12, cy - 10); c.lineTo(cx + 16, cy - 24); c.lineTo(cx + 6, cy - 14); c.closePath(); c.fill(); c.stroke();
      eyes(c, cx, cy - 2, 7, 3.2, true); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(cx - 8, cy + 8); c.lineTo(cx - 5, cy + 14); c.lineTo(cx - 2, cy + 8); c.closePath(); c.fill(); c.beginPath(); c.moveTo(cx + 8, cy + 8); c.lineTo(cx + 5, cy + 14); c.lineTo(cx + 2, cy + 8); c.closePath(); c.fill(); break;
    case 'courier': rrect(c, cx - 12, cy - 6, 24, 20, 6, '#ffd54f', '#f57f17', 1.5); c.fillStyle = '#f57f17'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText('$', cx, cy + 9);
      circle(c, cx, cy - 12, 7, '#ffe0b2', '#5d4037'); eyes(c, cx, cy - 12, 3, 1.8); c.strokeStyle = '#5d4037'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(cx - 8, cy + 14); c.lineTo(cx - 14, cy + 22); c.moveTo(cx + 8, cy + 14); c.lineTo(cx + 14, cy + 22); c.stroke(); break;
    case 'boss_flag': ellipse(c, cx, cy + 4, 20, 18, '#ef5350', '#7f0000', 2); crown(c, cx, cy - 20);
      eyes(c, cx, cy, 7, 3.5, true); c.fillStyle = '#7f0000'; c.fillRect(cx - 8, cy + 9, 16, 3);
      c.strokeStyle = '#5d4037'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(cx + 20, cy + 16); c.lineTo(cx + 20, cy - 26); c.stroke(); c.fillStyle = '#ffd600'; c.beginPath(); c.moveTo(cx + 20, cy - 26); c.lineTo(cx + 36, cy - 20); c.lineTo(cx + 20, cy - 14); c.closePath(); c.fill(); c.strokeStyle = '#7f0000'; c.lineWidth = 1; c.stroke(); break;
    case 'boss_cart': rrect(c, cx - 22, cy - 12, 44, 26, 5, '#8d6e63', '#3e2723', 2); rrect(c, cx - 18, cy - 8, 36, 8, 2, '#a1887f');
      circle(c, cx - 13, cy + 16, 7, '#4e342e', '#212121', 2); circle(c, cx + 13, cy + 16, 7, '#4e342e', '#212121', 2);
      for (let i = 0; i < 5; i++) { c.fillStyle = '#cfd8dc'; c.beginPath(); c.moveTo(cx - 18 + i * 9, cy - 12); c.lineTo(cx - 14 + i * 9, cy - 22); c.lineTo(cx - 10 + i * 9, cy - 12); c.closePath(); c.fill(); }
      eyes(c, cx, cy + 3, 8, 3, true); break;
    case 'boss_thief': c.beginPath(); c.moveTo(cx - 20, cy + 20); c.quadraticCurveTo(cx, -8, cx + 20, cy + 20); c.closePath(); c.fillStyle = '#5e35b1'; c.fill(); c.strokeStyle = '#311b92'; c.lineWidth = 2; c.stroke();
      circle(c, cx, cy - 8, 9, '#1a1a2e', '#311b92'); eyes(c, cx, cy - 8, 4, 2.6, true);
      circle(c, cx + 14, cy + 6, 9, '#fff8e1', '#4e342e', 2); c.strokeStyle = '#4e342e'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx + 14, cy + 6); c.lineTo(cx + 14, cy); c.moveTo(cx + 14, cy + 6); c.lineTo(cx + 19, cy + 8); c.stroke(); break;
    case 'boss_king': rrect(c, cx - 22, cy - 14, 44, 36, 10, '#ffab00', '#5d4037', 2.5); crown(c, cx, cy - 24);
      eyes(c, cx, cy - 2, 9, 4, true); c.fillStyle = '#5d4037'; c.beginPath(); c.moveTo(cx - 10, cy + 10); c.quadraticCurveTo(cx, cy + 4, cx + 10, cy + 10); c.lineTo(cx + 10, cy + 13); c.lineTo(cx - 10, cy + 13); c.closePath(); c.fill();
      rrect(c, cx + 16, cy - 2, 16, 18, 5, '#8d6e63', '#3e2723'); c.fillStyle = '#ffd54f'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText('$', cx + 24, cy + 11); break;
  }
}
export function enemySprite(type: EnemyType, dpr: number): HTMLCanvasElement {
  const size = type.startsWith('boss') ? 72 : SPR;
  return make(`e:${type}`, size, c => { if (size !== SPR) c.translate((size - SPR) / 2, (size - SPR) / 2); drawEnemyBody(c, type); }, dpr);
}
