// Pickup + power-up art and names (GDD 1.4 names, 11.4 rule "둥글고 빛나는 것 = 먹는 것"): every pickup is round,
// soft and glowing (hazards are angular and outlined). Each is pre-rendered once per resolution into a small
// sprite and blitted; per-frame work is a drawImage plus a cheap transform (spin / sway / pulse).
// Pickups are drawn inside their pickup box (never bigger than ≈40 px, the reach of player box + PICK_PAD).
import type { Pickup, PowerKind } from '../sim/types';
import { BONUS_WORD } from '../data/tuning';
import { makeCanvas, worldRes, SpriteCache, mix, rgba, lighten, darken } from './backdrops';

/** 보·름·달·잔·치 paper lanterns — one colour each */
export const LETTER_COLORS = ['#ff5d8f', '#ff9a3c', '#3fb8e8', '#4fc47e', '#a77bff'];
export const POWER_NAME: Record<PowerKind, string> = { giant: '왕만두!', dash: '불꽃 질주!', magnet: '엿가락 자석!' };
export const POWER_DESC: Record<PowerKind, string> = { giant: '커다래져서 장애물을 부숴요', dash: '빠르게, 무적으로 돌진!', magnet: '별사탕이 끌려와요' };
export const POWER_COLOR: Record<PowerKind, string> = { giant: '#ffab40', dash: '#ff5470', magnet: '#5fbfff' };
export const POWER_ICON: Record<PowerKind, string> = { giant: '만', dash: '불', magnet: '엿' };
/** body colours that other code (tests, fx) may want */
export const JELLY_COLOR = '#ffd23f';
export const BONUS_JELLY_COLOR = '#8ff0ff';
export const BIG_JELLY_COLOR = '#ff6fae';
const INK = '#2a1830';
const FONT = 'system-ui, "Noto Sans KR", "Apple SD Gothic Neo", sans-serif';

export function heart(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  c.beginPath(); c.moveTo(x, y + s * 0.45);
  c.bezierCurveTo(x - s * 0.9, y - s * 0.1, x - s * 0.45, y - s * 0.75, x, y - s * 0.3);
  c.bezierCurveTo(x + s * 0.45, y - s * 0.75, x + s * 0.9, y - s * 0.1, x, y + s * 0.45); c.fill();
}

// ---------------------------------------------------------------- sprite painters (origin = centre)
function glow(g: CanvasRenderingContext2D, r: number, col: string, a: number, r0 = 0): void {
  const gr = g.createRadialGradient(0, 0, r0, 0, 0, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
}
function starPath(g: CanvasRenderingContext2D, ro: number, ri: number, rot = -Math.PI / 2): void {
  g.beginPath(); for (let i = 0; i < 10; i++) { const a = rot + (i * Math.PI) / 5; const r = i % 2 ? ri : ro; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath();
}
function twinkle(g: CanvasRenderingContext2D, x: number, y: number, s: number, col = '#ffffff'): void {
  g.fillStyle = col; g.beginPath(); g.moveTo(x, y - s); g.quadraticCurveTo(x + s * 0.12, y - s * 0.12, x + s, y); g.quadraticCurveTo(x + s * 0.12, y + s * 0.12, x, y + s);
  g.quadraticCurveTo(x - s * 0.12, y + s * 0.12, x - s, y); g.quadraticCurveTo(x - s * 0.12, y - s * 0.12, x, y - s); g.fill();
}
/** soft rounded star candy (별사탕) */
function starCandy(g: CanvasRenderingContext2D, ro: number, body: string, rim: string, core: string): void {
  g.lineJoin = 'round';
  starPath(g, ro, ro * 0.56); g.strokeStyle = rim; g.lineWidth = 7; g.stroke();
  g.strokeStyle = body; g.lineWidth = 4; g.stroke(); g.fillStyle = body; g.fill();
  starPath(g, ro * 0.55, ro * 0.32); g.strokeStyle = core; g.lineWidth = 3; g.stroke(); g.fillStyle = core; g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(-ro * 0.3, -ro * 0.38, ro * 0.16, ro * 0.26, -0.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(ro * 0.28, -ro * 0.05, ro * 0.08, 0, Math.PI * 2); g.fill();
}

function paintJelly(g: CanvasRenderingContext2D, bonus: boolean): void {
  if (bonus) { glow(g, 14, '#bff8ff', 0.55, 4); starCandy(g, 9.5, BONUS_JELLY_COLOR, '#2a7fa8', '#e6fdff'); }
  else { glow(g, 14, '#fff0a0', 0.4, 4); starCandy(g, 9.5, JELLY_COLOR, '#c8552b', '#fff1a6'); g.fillStyle = 'rgba(255,120,150,0.55)'; g.beginPath(); g.arc(4, 4, 2, 0, Math.PI * 2); g.fill(); }
}
function paintBig(g: CanvasRenderingContext2D): void {
  glow(g, 21, '#ffc2de', 0.6, 6);
  starCandy(g, 15, BIG_JELLY_COLOR, '#a3245f', '#ffc2de');
  twinkle(g, 13, -13, 4.5); twinkle(g, -14, 9, 3.2); twinkle(g, 12, 12, 2.6, '#fff6c8');
}
function paintCoin(g: CanvasRenderingContext2D): void {
  // 엽전: gold coin with a square hole (the hole is truly see-through)
  g.fillStyle = '#9a6a0a'; g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.fill();
  const gr = g.createRadialGradient(-4, -4, 1, 0, 0, 11); gr.addColorStop(0, '#fff0a8'); gr.addColorStop(0.55, '#ffc93c'); gr.addColorStop(1, '#e09a14');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 10.5, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(154,106,10,0.7)'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, 7.8, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#9a6a0a'; g.fillRect(-4.6, -4.6, 9.2, 9.2);
  g.globalCompositeOperation = 'destination-out'; g.fillRect(-3.2, -3.2, 6.4, 6.4); g.globalCompositeOperation = 'source-over';
  g.fillStyle = 'rgba(154,106,10,0.75)'; for (const [x, y] of [[0, -6.3], [0, 6.3], [-6.3, 0], [6.3, 0]]) g.fillRect(x - 1.1, y - 1.1, 2.2, 2.2);
  g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(-5, -6, 1.6, 2.6, -0.7, 0, Math.PI * 2); g.fill();
}
function paintPotion(g: CanvasRenderingContext2D): void {
  // 꿀물: a glass cup of warm honey water with a heart
  glow(g, 20, '#ffcf6b', 0.5, 5);
  g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.moveTo(-10.5, -11); g.lineTo(10.5, -11); g.lineTo(8, 12); g.quadraticCurveTo(0, 14.5, -8, 12); g.closePath(); g.fill();
  const gr = g.createLinearGradient(0, -5, 0, 13); gr.addColorStop(0, '#ffc44d'); gr.addColorStop(1, '#e0781c');
  g.fillStyle = gr; g.beginPath(); g.moveTo(-9.6, -5); g.lineTo(9.6, -5); g.lineTo(7.6, 11); g.quadraticCurveTo(0, 13.4, -7.6, 11); g.closePath(); g.fill();
  g.fillStyle = '#ffe39a'; g.beginPath(); g.ellipse(0, -5, 9.6, 2.2, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#8a4a12'; g.lineWidth = 1.6; g.lineJoin = 'round'; g.beginPath(); g.moveTo(-10.5, -11); g.lineTo(-8, 12); g.quadraticCurveTo(0, 14.5, 8, 12); g.lineTo(10.5, -11); g.stroke();
  g.fillStyle = '#ff4d6d'; heart(g, 0, 4, 10);
  g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(-8, -9, 2.2, 14);
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-3, -14); g.quadraticCurveTo(-6, -17, -3, -20); g.moveTo(3, -14); g.quadraticCurveTo(0, -17, 3, -20); g.stroke();
}
function paintBigPotion(g: CanvasRenderingContext2D): void {
  // 꿀단지: a round honey jar with a tied cloth lid
  glow(g, 24, '#ffcf6b', 0.55, 6);
  const gr = g.createRadialGradient(-5, 0, 2, 0, 4, 16); gr.addColorStop(0, '#ffe08a'); gr.addColorStop(0.6, '#f5a623'); gr.addColorStop(1, '#c46a12');
  g.fillStyle = gr; g.beginPath(); g.ellipse(0, 5, 15, 13.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#d9861a'; g.fillRect(-8, -10, 16, 6);
  g.strokeStyle = '#7a3e0c'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(0, 5, 15, 13.5, 0, 0, Math.PI * 2); g.stroke();
  // cloth lid + string
  g.fillStyle = '#e0524f'; g.beginPath(); g.moveTo(-11, -8); g.quadraticCurveTo(0, -20, 11, -8); g.lineTo(13, -3); g.lineTo(8, -6); g.lineTo(3, -2); g.lineTo(-2, -6); g.lineTo(-7, -2); g.lineTo(-13, -3); g.closePath(); g.fill();
  g.fillStyle = '#fff1d6'; g.fillRect(-10, -9, 20, 2.4);
  // label with heart + honey drip
  g.fillStyle = '#fff4dc'; g.beginPath(); g.ellipse(0, 7, 7.5, 6.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ff4d6d'; heart(g, 0, 7.5, 9);
  g.fillStyle = '#ffd25a'; g.beginPath(); g.moveTo(9, -4); g.quadraticCurveTo(12, 2, 11, 4); g.arc(10.5, 4, 1.8, 0, Math.PI); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(-9, 1, 2.2, 5, 0.3, 0, Math.PI * 2); g.fill();
}
function paintMiniPotion(g: CanvasRenderingContext2D): void {
  // 꿀물 한 방울: a single honey drop
  glow(g, 14, '#ffcf6b', 0.5, 3);
  const gr = g.createRadialGradient(-2, 1, 1, 0, 3, 9); gr.addColorStop(0, '#ffe39a'); gr.addColorStop(1, '#e8891f');
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, -11); g.bezierCurveTo(3, -5, 8, -1, 8, 4); g.arc(0, 4, 8, 0, Math.PI); g.bezierCurveTo(-8, -1, -3, -5, 0, -11); g.fill();
  g.strokeStyle = '#8a4a12'; g.lineWidth = 1.2; g.stroke();
  g.fillStyle = '#ff4d6d'; heart(g, 0.5, 5, 6);
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.ellipse(-3.5, 0, 1.4, 3, 0.3, 0, Math.PI * 2); g.fill();
}
function paintMoonCake(g: CanvasRenderingContext2D): void {
  // 보름달 떡: a big round moon rice cake with a 떡살 flower stamp
  glow(g, 24, '#fff2b0', 0.75, 12);
  const gr = g.createRadialGradient(-5, -5, 2, 0, 0, 18); gr.addColorStop(0, '#fffdf0'); gr.addColorStop(0.7, '#ffefb8'); gr.addColorStop(1, '#f5cf6e');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 17, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#c99a2e'; g.lineWidth = 1.6; g.stroke();
  g.strokeStyle = 'rgba(201,154,46,0.6)'; g.lineWidth = 1.3; g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(214,160,60,0.45)';
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.ellipse(Math.cos(a) * 6.5, Math.sin(a) * 6.5, 3.4, 1.8, a, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#ff8fab'; g.beginPath(); g.arc(0, 0, 2.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(-8, -9, 2.4, 4, -0.7, 0, Math.PI * 2); g.fill();
  twinkle(g, 14, -14, 4);
}
function paintPouch(g: CanvasRenderingContext2D): void {
  // 황금 복주머니: golden lucky pouch with a red knot and tassels
  glow(g, 22, '#ffe08a', 0.6, 8);
  const gr = g.createRadialGradient(-5, 2, 2, 0, 5, 16); gr.addColorStop(0, '#fff0a0'); gr.addColorStop(0.55, '#ffcc33'); gr.addColorStop(1, '#d99a0f');
  g.fillStyle = gr; g.beginPath(); g.moveTo(-6, -7); g.bezierCurveTo(-17, -2, -16, 15, 0, 15); g.bezierCurveTo(16, 15, 17, -2, 6, -7); g.closePath(); g.fill();
  g.strokeStyle = '#8a5a08'; g.lineWidth = 1.5; g.stroke();
  // frilled top
  g.fillStyle = '#ffd84d'; g.beginPath(); g.moveTo(-6, -7); g.lineTo(-10, -15); g.quadraticCurveTo(-5, -12, -3, -16); g.quadraticCurveTo(0, -12, 3, -16); g.quadraticCurveTo(5, -12, 10, -15); g.lineTo(6, -7); g.closePath(); g.fill(); g.stroke();
  // cord + knot + tassel
  g.fillStyle = '#d32f2f'; g.fillRect(-7.5, -8.5, 15, 3.4);
  g.beginPath(); g.arc(8, -6, 2.8, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#d32f2f'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(8, -4); g.lineTo(11, 4); g.moveTo(9, -4); g.lineTo(13, 3); g.stroke();
  // 복 medallion
  g.fillStyle = '#fff4dc'; g.beginPath(); g.arc(0, 4, 6.5, 0, Math.PI * 2); g.fill();
  g.font = `900 8.5px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#b3261e'; g.fillText('복', 0, 4.5);
  g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(-9, 1, 1.8, 4, 0.3, 0, Math.PI * 2); g.fill();
  twinkle(g, -12, -12, 3.4);
}
function paintPower(g: CanvasRenderingContext2D, k: PowerKind): void {
  const col = POWER_COLOR[k];
  glow(g, 21, col, 0.55, 12);
  const gr = g.createRadialGradient(-5, -6, 2, 0, 0, 17); gr.addColorStop(0, lighten(col, 0.55)); gr.addColorStop(0.7, col); gr.addColorStop(1, darken(col, 0.2));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 16.5, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 2.6; g.stroke();
  if (k === 'giant') {
    // 왕만두: a plump pleated steamed dumpling
    g.fillStyle = '#fff8ec'; g.beginPath(); g.moveTo(-11, 6); g.bezierCurveTo(-12, -4, -5, -10, 0, -11); g.bezierCurveTo(5, -10, 12, -4, 11, 6); g.quadraticCurveTo(0, 10, -11, 6); g.fill();
    g.strokeStyle = '#c8a27a'; g.lineWidth = 1.3; g.stroke();
    g.beginPath(); g.moveTo(0, -11); g.quadraticCurveTo(-4, -5, -6, 1); g.moveTo(0, -11); g.quadraticCurveTo(0, -4, 0, 2); g.moveTo(0, -11); g.quadraticCurveTo(4, -5, 6, 1); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(-6, -2, 1.6, 3, 0.4, 0, Math.PI * 2); g.fill();
  } else if (k === 'dash') {
    // 불꽃: a flame
    g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(0, -13); g.bezierCurveTo(4, -6, 11, -2, 9, 5); g.bezierCurveTo(8, 11, 3, 12, 0, 12); g.bezierCurveTo(-5, 12, -10, 9, -9, 3); g.bezierCurveTo(-8, -2, -4, -3, -3, -8); g.bezierCurveTo(-1, -5, 0, -4, 0, -13); g.fill();
    g.strokeStyle = '#b3261e'; g.lineWidth = 1.3; g.stroke();
    g.fillStyle = '#fff6d0'; g.beginPath(); g.moveTo(0, -2); g.bezierCurveTo(4, 2, 5, 6, 3, 9); g.quadraticCurveTo(0, 11, -3, 9); g.bezierCurveTo(-5, 6, -2, 3, 0, -2); g.fill();
  } else {
    // 엿가락 자석: a U of twisted taffy with pale tips
    g.lineCap = 'round'; g.strokeStyle = '#7a3e0c'; g.lineWidth = 9; g.beginPath(); g.moveTo(-7, -9); g.lineTo(-7, 1); g.arc(0, 1, 7, Math.PI, 0, true); g.lineTo(7, -9); g.stroke();
    g.strokeStyle = '#f0b44a'; g.lineWidth = 6.5; g.stroke();
    g.strokeStyle = 'rgba(255,240,200,0.9)'; g.lineWidth = 1.5; g.beginPath();
    for (const [x, y] of [[-7, -5], [-7, 0], [7, -5], [7, 0]]) { g.moveTo(x - 3, y + 1.5); g.lineTo(x + 3, y - 1.5); }
    g.moveTo(-3, 6); g.lineTo(-1, 9); g.moveTo(3, 6); g.lineTo(1, 9); g.stroke();
    g.fillStyle = '#fff6e0'; g.beginPath(); g.arc(-7, -10, 3.3, 0, Math.PI * 2); g.arc(7, -10, 3.3, 0, Math.PI * 2); g.fill();
    g.lineCap = 'butt';
  }
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(-8, -9, 4, 2.2, -0.7, 0, Math.PI * 2); g.fill();
}
function paintLetter(g: CanvasRenderingContext2D, i: number): void {
  // 종이 등불: a round paper lantern with the letter in ink (origin = lantern centre)
  const col = LETTER_COLORS[i % LETTER_COLORS.length];
  glow(g, 24, col, 0.5, 10);
  g.fillStyle = INK; g.fillRect(-0.7, -21, 1.4, 5);
  const gr = g.createRadialGradient(0, -1, 2, 0, 0, 16); gr.addColorStop(0, '#fffbe8'); gr.addColorStop(0.55, mix(col, '#fff4d6', 0.55)); gr.addColorStop(1, col);
  g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 14, 14.5, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = rgba(darken(col, 0.35), 0.5); g.lineWidth = 1.1; g.beginPath();
  for (const k of [-0.62, 0.62]) { g.moveTo(0, -14.5); g.quadraticCurveTo(k * 20, 0, 0, 14.5); }
  g.stroke();
  g.strokeStyle = darken(col, 0.3); g.lineWidth = 1.4; g.beginPath(); g.ellipse(0, 0, 14, 14.5, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#5a3a2a'; g.beginPath(); g.moveTo(-8, -17); g.lineTo(8, -17); g.lineTo(6.5, -13); g.lineTo(-6.5, -13); g.closePath(); g.moveTo(-6.5, 13); g.lineTo(6.5, 13); g.lineTo(8, 17); g.lineTo(-8, 17); g.closePath(); g.fill();
  g.strokeStyle = darken(col, 0.2); g.lineWidth = 1.4; g.beginPath(); for (const x of [-2.5, 0, 2.5]) { g.moveTo(x, 17); g.lineTo(x * 1.3, 21.5); } g.stroke();
  g.font = `900 15px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK; g.fillText(BONUS_WORD[i] ?? '', 0, 1);
  g.fillStyle = 'rgba(255,255,255,0.65)'; g.beginPath(); g.ellipse(-8.5, -5, 1.7, 3.6, 0.35, 0, Math.PI * 2); g.fill();
}

const SPRITE_R: Record<string, number> = { jelly: 14, bonusJelly: 14, big: 22, coin: 13, potion: 21, bigPotion: 25, miniPotion: 14, moonCake: 25, pouch: 23, power: 22, letter: 25 };
const sprites = new SpriteCache(40);
function sprite(key: string, R: number, res: number, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  return sprites.get(`${key}|${res}`, () => { const [cv, g] = makeCanvas(R * 2, R * 2, res); g.translate(R, R); paint(g); return cv; });
}

export function drawPickup(c: CanvasRenderingContext2D, p: Pickup, x: number, y: number, t: number): void {
  const res = worldRes(c);
  switch (p.type) {
    case 'jelly': case 'bonusJelly': {
      const R = SPRITE_R.jelly; const spr = sprite(p.type, R, res, g => paintJelly(g, p.type === 'bonusJelly'));
      c.drawImage(spr, x - R, y - R, R * 2, R * 2); break;
    }
    case 'big': {
      const R = SPRITE_R.big; const spr = sprite('big', R, res, paintBig);
      c.save(); c.translate(x, y); c.rotate(Math.sin(t * 2.4 + x * 0.01) * 0.18); c.drawImage(spr, -R, -R, R * 2, R * 2); c.restore(); break;
    }
    case 'coin': {
      const R = SPRITE_R.coin; const spr = sprite('coin', R, res, paintCoin);
      const k = Math.cos(t * 4 + x * 0.02); const w = Math.max(0.14, Math.abs(k)) * R;
      if (Math.abs(k) < 0.5) { c.fillStyle = '#b07d0a'; c.fillRect(x - Math.max(1.5, w * 0.35), y - 11, Math.max(3, w * 0.7), 22); }
      c.drawImage(spr, x - w, y - R, w * 2, R * 2); break;
    }
    case 'potion': case 'bigPotion': case 'miniPotion': {
      const R = SPRITE_R[p.type]; const spr = sprite(p.type, R, res, p.type === 'potion' ? paintPotion : p.type === 'bigPotion' ? paintBigPotion : paintMiniPotion);
      c.drawImage(spr, x - R, y - R, R * 2, R * 2); break;
    }
    case 'moonCake': {
      const R = SPRITE_R.moonCake; const spr = sprite('moonCake', R, res, paintMoonCake);
      const s = 1 + Math.sin(t * 4) * 0.04; c.drawImage(spr, x - R * s, y - R * s, R * 2 * s, R * 2 * s); break;
    }
    case 'pouch': {
      const R = SPRITE_R.pouch; const spr = sprite('pouch', R, res, paintPouch);
      c.save(); c.translate(x, y - 12); c.rotate(Math.sin(t * 2.2 + x * 0.01) * 0.1); c.drawImage(spr, -R, -R + 12, R * 2, R * 2); c.restore(); break;
    }
    case 'power': {
      const k = p.power ?? 'giant'; const R = SPRITE_R.power; const spr = sprite(`pw-${k}`, R, res, g => paintPower(g, k));
      const s = 1 + Math.sin(t * 6) * 0.05; c.drawImage(spr, x - R * s, y - R * s, R * 2 * s, R * 2 * s); break;
    }
    case 'letter': {
      const i = p.letter ?? 0; const R = SPRITE_R.letter; const spr = sprite(`lt-${i}`, R, res, g => paintLetter(g, i));
      c.save(); c.translate(x, y - 20); c.rotate(Math.sin(t * 2 + x * 0.013) * 0.1); c.drawImage(spr, -R, -R + 20, R * 2, R * 2); c.restore(); break;
    }
  }
}

if (typeof window !== 'undefined') { const w = window as unknown as { __world?: Record<string, unknown> }; Object.assign((w.__world ??= {}), { drawPickup, LETTER_COLORS, POWER_COLOR }); }
