// 절차적 벡터 스프라이트. 유닛 8종×3등급, 적 7종. 외부 이미지 없이 Canvas 로 그려 캐시합니다.
import type { UnitKind, Grade } from '../data/units';
import { UNITS } from '../data/units';
import type { EnemyKind } from '../data/enemies';
import { ENEMIES } from '../data/enemies';

type C = CanvasRenderingContext2D;
const OUT = '#1a1230';
export const GRADE_HEX: Record<Grade, string> = { 1: '#b0bec5', 2: '#42a5f5', 3: '#ffb300' };

function rr(c: C, x: number, y: number, w: number, h: number, r: number, fill: string, stroke = OUT, lw = 1.6): void {
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function circ(c: C, x: number, y: number, r: number, fill: string, stroke = OUT, lw = 1.6): void {
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function poly(c: C, pts: number[], fill: string, stroke = OUT, lw = 1.6): void {
  c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function shade(hex: string, k: number): string { // k<1 어둡게, k>1 밝게
  const n = parseInt(hex.slice(1), 16); const r = Math.min(255, Math.round(((n >> 16) & 255) * k)), g = Math.min(255, Math.round(((n >> 8) & 255) * k)), b = Math.min(255, Math.round((n & 255) * k));
  return `rgb(${r},${g},${b})`;
}
function eyes(c: C, x: number, y: number, gap: number, r: number, col = '#fff', pupil = OUT): void {
  circ(c, x - gap, y, r, col, OUT, 1.2); circ(c, x + gap, y, r, col, OUT, 1.2); circ(c, x - gap + 0.5, y + 0.5, r * 0.45, pupil, ''); circ(c, x + gap + 0.5, y + 0.5, r * 0.45, pupil, '');
}
function visor(c: C, x: number, y: number, w: number, h: number, col: string): void { rr(c, x - w / 2, y - h / 2, w, h, 3, col, OUT, 1.4); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(x - w / 2 + 2, y - h / 2 + 1.5, w * 0.4, 1.6); }
function wheels(c: C, y: number, w: number): void { circ(c, -w, y, 4, '#37474f', OUT, 1.4); circ(c, w, y, 4, '#37474f', OUT, 1.4); circ(c, -w, y, 1.4, '#90a4ae', ''); circ(c, w, y, 1.4, '#90a4ae', ''); }

/** 유닛 스프라이트(중심 0,0, 대략 반경 20). 공격 방향은 렌더러가 회전 없이 포탑 부분만 따로 그림. */
export function drawUnit(c: C, kind: UnitKind, g: Grade): void {
  const d = UNITS[kind]; const col = d.color, col2 = d.color2; const dark = shade(col, 0.7), light = shade(col, 1.25);
  c.lineJoin = 'round'; c.lineCap = 'round';
  // 등급 받침(발판)
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(0, 17, 15 + g * 1.5, 5, 0, 0, Math.PI * 2); c.fill();
  switch (kind) {
    case 'flame': {
      rr(c, -9, 0, 18, 12, 4, '#546e7a'); wheels(c, 12, 8);
      rr(c, -11, -12, 22, 15, 5, col); c.fillStyle = light; c.fillRect(-9, -10, 10, 3);
      rr(c, 8, -8, 8, 8, 2, '#37474f'); // 연료탱크
      visor(c, -2, -5, 10, 5, '#ffe082');
      if (g >= 2) { rr(c, -15, -13, 6, 8, 2, dark); rr(c, 9, -13, 6, 8, 2, dark); }
      if (g >= 3) { poly(c, [-6, -13, 0, -22, 6, -13], col2); poly(c, [-3, -13, 0, -18, 3, -13], '#fff59d', ''); }
      break;
    }
    case 'oil': {
      rr(c, -10, -6, 20, 20, 5, '#5d4037'); wheels(c, 14, 8);
      rr(c, -8, -16, 16, 14, 4, col); c.fillStyle = light; c.fillRect(-6, -14, 8, 2.5);
      rr(c, -7, -8, 14, 3, 1, dark, '');
      c.fillStyle = '#212121'; c.beginPath(); c.ellipse(0, 12, 6, 2.5, 0, 0, Math.PI * 2); c.fill();
      eyes(c, 0, -10, 3.5, 2);
      if (g >= 2) { rr(c, -15, -12, 6, 12, 2, col); rr(c, 9, -12, 6, 12, 2, col); }
      if (g >= 3) { rr(c, -6, -22, 12, 7, 3, '#4e342e'); circ(c, -8, -18, 2.2, '#212121', ''); circ(c, 8, -18, 2.2, '#212121', ''); }
      break;
    }
    case 'vortex': {
      c.strokeStyle = 'rgba(179,157,219,0.5)'; c.lineWidth = 2.2; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, -2, 14 + i * 2.5 + g * 1.5, i * 2.1, i * 2.1 + 2.4); c.stroke(); }
      c.beginPath(); c.moveTo(0, 16); c.quadraticCurveTo(-14, 2, -4, -8); c.quadraticCurveTo(6, -18, 12, -6); c.quadraticCurveTo(14, 8, 0, 16); c.fillStyle = col; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(-2, -7, 5, 3, -0.6, 0, Math.PI * 2); c.fill();
      eyes(c, 2, -3, 3.5, 2.2, '#fff', '#4527a0');
      if (g >= 2) { c.strokeStyle = col2; c.lineWidth = 2; c.beginPath(); c.arc(0, -2, 19, 0.3, 2.2); c.stroke(); c.beginPath(); c.arc(0, -2, 19, 3.4, 5.4); c.stroke(); }
      if (g >= 3) { poly(c, [-8, -14, -3, -22, 0, -15, 3, -23, 8, -14], '#e1bee7'); }
      break;
    }
    case 'frost': {
      poly(c, [-11, 14, 11, 14, 8, -2, -8, -2], col); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-6, 0, 4, 12);
      circ(c, 0, -6, 9, '#e1f5fe'); eyes(c, 0, -6, 3.5, 2, '#fff', '#01579b');
      poly(c, [-9, -10, 0, -23, 9, -10], '#81d4fa'); poly(c, [-4, -12, 0, -19, 4, -12], '#fff', '');
      rr(c, 10, -14, 3, 26, 1.5, '#b3e5fc'); poly(c, [11.5, -20, 8, -14, 15, -14], '#e1f5fe'); // 얼음 지팡이
      if (g >= 2) { for (const a of [0.4, 2.2, 4.0]) { const x = Math.cos(a) * 17, y = -4 + Math.sin(a) * 12; poly(c, [x, y - 4, x + 3, y, x, y + 4, x - 3, y], '#e1f5fe'); } }
      if (g >= 3) { poly(c, [-12, -10, -6, -26, 0, -14, 6, -26, 12, -10], '#4fc3f7'); c.strokeStyle = '#fff'; c.lineWidth = 1.2; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.beginPath(); c.moveTo(0, -18); c.lineTo(Math.cos(a) * 5, -18 + Math.sin(a) * 5); c.stroke(); } }
      break;
    }
    case 'laser': {
      rr(c, -8, 2, 16, 11, 3, '#455a64'); wheels(c, 13, 7);
      rr(c, -9, -14, 18, 17, 4, '#78909c'); c.fillStyle = '#b0bec5'; c.fillRect(-7, -12, 8, 2.5);
      rr(c, -3, -20, 6, 10, 2, col); circ(c, 0, -20, 4, col2); circ(c, 0, -20, 1.8, '#fff', '');
      visor(c, 0, -6, 12, 5, '#ff8a80');
      if (g >= 2) { rr(c, -12, -10, 4, 10, 1.5, col); rr(c, 8, -10, 4, 10, 1.5, col); }
      if (g >= 3) { rr(c, -5, -24, 10, 8, 3, dark); circ(c, 0, -22, 5, col2); circ(c, 0, -22, 2.2, '#fff', ''); poly(c, [-13, -2, -18, 6, -13, 6], '#ef5350'); poly(c, [13, -2, 18, 6, 13, 6], '#ef5350'); }
      break;
    }
    case 'tesla': {
      rr(c, -10, 0, 20, 13, 4, '#5d4037'); wheels(c, 13, 8);
      rr(c, -7, -8, 14, 10, 3, '#8d6e63'); eyes(c, 0, -3, 3.5, 2);
      rr(c, -3, -20, 6, 13, 2, '#b0bec5'); for (let i = 0; i < 3; i++) { rr(c, -6, -19 + i * 4, 12, 2.2, 1, col, OUT, 1); }
      circ(c, 0, -22, 4, col2); circ(c, 0, -22, 1.8, '#fff', '');
      if (g >= 2) { rr(c, -14, -14, 4, 10, 1.5, '#b0bec5'); rr(c, 10, -14, 4, 10, 1.5, '#b0bec5'); circ(c, -12, -16, 2.5, col); circ(c, 12, -16, 2.5, col); }
      if (g >= 3) { c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-4, -26); c.lineTo(-1, -23); c.lineTo(-3, -21); c.stroke(); c.beginPath(); c.moveTo(5, -27); c.lineTo(2, -24); c.lineTo(4, -22); c.stroke(); circ(c, 0, -25, 5.5, col2); circ(c, 0, -25, 2.5, '#fff', ''); }
      break;
    }
    case 'bomber': {
      rr(c, -10, -2, 20, 15, 4, '#607d8b'); wheels(c, 13, 8);
      rr(c, -8, -14, 16, 14, 4, col); c.fillStyle = shade(col, 1.2); c.fillRect(-6, -12, 7, 2.5);
      // 박격포 포신(뒤로 기울어짐)
      c.save(); c.translate(6, -12); c.rotate(-0.7); rr(c, -3, -12, 6, 16, 2, '#37474f'); c.restore();
      circ(c, -6, 2, 4, '#263238'); c.strokeStyle = col2; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-6, -2); c.lineTo(-4, -5); c.stroke(); // 허리 폭탄
      visor(c, -2, -8, 10, 5, '#b3e5fc');
      if (g >= 2) { c.save(); c.translate(-8, -12); c.rotate(-0.9); rr(c, -2.5, -10, 5, 13, 2, '#37474f'); c.restore(); }
      if (g >= 3) { rr(c, -12, -20, 24, 6, 3, '#455a64'); for (let i = -8; i <= 8; i += 8) circ(c, i, -17, 2.5, col2, OUT, 1); }
      break;
    }
    case 'engineer': {
      c.fillStyle = 'rgba(102,187,106,0.25)'; c.beginPath(); c.arc(0, -2, 18 + g, 0, Math.PI * 2); c.fill();
      circ(c, 0, -2, 12, col); c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.ellipse(-3, -7, 5, 3, -0.5, 0, Math.PI * 2); c.fill();
      eyes(c, 0, -3, 4, 2.3, '#fff', '#1b5e20');
      rr(c, -4, 6, 8, 9, 2, '#fdd835'); c.fillStyle = OUT; c.fillRect(-2, 8, 4, 1.6); c.fillRect(-2, 11, 4, 1.6); // 배터리
      c.strokeStyle = '#eceff1'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(10, 2); c.lineTo(16, -8); c.stroke(); circ(c, 16, -9, 3, '#eceff1', OUT, 1.2); // 렌치
      if (g >= 2) { rr(c, -14, 4, 6, 8, 2, '#fdd835'); rr(c, -14, 6, 6, 1.5, 0.5, OUT, ''); }
      if (g >= 3) { c.strokeStyle = '#b2ff59'; c.lineWidth = 2; c.beginPath(); c.arc(0, -2, 17, 0, Math.PI * 2); c.stroke(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; circ(c, Math.cos(a) * 17, -2 + Math.sin(a) * 17, 2.5, '#fdd835', OUT, 1); } }
      break;
    }
  }
}

/** 적 스프라이트(중심 0,0). 진행 방향은 렌더러가 회전. */
export function drawEnemy(c: C, kind: EnemyKind): void {
  const d = ENEMIES[kind]; const col = d.color, col2 = d.color2;
  c.lineJoin = 'round'; c.lineCap = 'round';
  switch (kind) {
    case 'gearbug': {
      c.strokeStyle = OUT; c.lineWidth = 1.8; for (const s of [-1, 1]) for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 4, s * 4); c.lineTo(i * 5 + 2, s * 10); c.stroke(); }
      c.beginPath(); c.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke();
      circ(c, -2, 0, 5, col2); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.fillStyle = col2; c.fillRect(-2 + Math.cos(a) * 5 - 1, Math.sin(a) * 5 - 1, 2, 2); } circ(c, -2, 0, 1.6, col, '');
      circ(c, 9, 0, 3.5, shade(col, 1.15)); circ(c, 10, -1, 1, '#fff', ''); break;
    }
    case 'sparkrat': {
      c.strokeStyle = col2; c.lineWidth = 2; c.beginPath(); c.moveTo(-8, 0); c.lineTo(-13, -4); c.lineTo(-16, 2); c.lineTo(-20, -2); c.stroke();
      c.beginPath(); c.ellipse(0, 0, 9, 5.5, 0, 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
      circ(c, 6, -4, 2.5, col); circ(c, 6, 4, 2.5, col); circ(c, 8, 0, 3.5, shade(col, 1.1)); circ(c, 9.5, -1, 0.9, OUT, '');
      c.strokeStyle = '#fff176'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-3, -6); c.lineTo(-1, -9); c.lineTo(-2, -6.5); c.stroke(); break;
    }
    case 'boltant': {
      c.strokeStyle = OUT; c.lineWidth = 1.3; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 3, -2); c.lineTo(i * 3 + 1, -6); c.stroke(); c.beginPath(); c.moveTo(i * 3, 2); c.lineTo(i * 3 + 1, 6); c.stroke(); }
      circ(c, -5, 0, 4, col); circ(c, 0, 0, 3, col); rr(c, 3, -3, 6, 6, 1.2, col2); circ(c, 6, 0, 1.4, '#cfd8dc', ''); break;
    }
    case 'scrapturtle': {
      for (const s of [-1, 1]) { rr(c, -9, s * 8 - 3, 6, 6, 2, shade(col, 0.8)); rr(c, 4, s * 8 - 3, 6, 6, 2, shade(col, 0.8)); }
      c.beginPath(); c.ellipse(0, 0, 13, 10, 0, 0, Math.PI * 2); c.fillStyle = col2; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.8; c.stroke();
      for (const [x, y] of [[-5, -4], [4, -4], [-5, 4], [4, 4], [0, 0]]) rr(c, x - 3, y - 3, 6, 6, 1.5, col, OUT, 1.1);
      for (const [x, y] of [[-8, 0], [8, -6], [8, 6]]) circ(c, x, y, 1.2, '#cfd8dc', '');
      circ(c, 14, 0, 4, shade(col, 1.1)); circ(c, 15.5, -1, 1, OUT, ''); break;
    }
    case 'repairdrone': {
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.4; for (const [x, y] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) { c.beginPath(); c.ellipse(x, y, 6, 2, 0, 0, Math.PI * 2); c.stroke(); circ(c, x, y, 1.5, '#37474f', ''); }
      c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.moveTo(-8, -8); c.lineTo(8, 8); c.moveTo(8, -8); c.lineTo(-8, 8); c.stroke();
      rr(c, -6, -6, 12, 12, 3, col); circ(c, 0, 0, 3, '#fff'); circ(c, 0, 0, 1.4, col2, '');
      c.strokeStyle = '#eceff1'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 6); c.lineTo(0, 11); c.stroke(); circ(c, 0, 12, 2.2, '#eceff1', OUT, 1); break;
    }
    case 'boss_golem': {
      for (const s of [-1, 1]) rr(c, -6, s * 14 - 6, 14, 12, 4, shade(col, 0.75));
      rr(c, -16, -13, 30, 26, 7, col); c.fillStyle = shade(col, 1.2); c.fillRect(-13, -10, 10, 4);
      for (const [x, y] of [[-12, 6], [8, -9], [10, 8]]) rr(c, x - 3, y - 3, 6, 6, 1.5, '#616161', OUT, 1.1);
      circ(c, -2, 0, 7, '#3e2723'); circ(c, -2, 0, 5, col2); circ(c, -2, 0, 2.5, '#fff59d', ''); // 용광로 코어
      rr(c, 14, -8, 10, 16, 3, shade(col, 0.9)); circ(c, 19, -3, 2, '#ff7043', ''); circ(c, 19, 3, 2, '#ff7043', '');
      break;
    }
    case 'boss_core': {
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 24, 9, 0.5, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.ellipse(0, 0, 24, 9, -0.5, 0, Math.PI * 2); c.stroke();
      poly(c, [0, -18, 15, -6, 12, 12, -12, 12, -15, -6], col); poly(c, [0, -12, 8, -5, 6, 6, -6, 6, -8, -5], shade(col, 1.25), '');
      circ(c, 0, 0, 6, col2); circ(c, 0, 0, 2.6, '#fff', '');
      eyes(c, 0, -6, 5, 2.4, '#fff', '#4a148c');
      for (const a of [0.3, 2.4, 4.2]) circ(c, Math.cos(a) * 24, Math.sin(a) * 9, 3, '#ff4081', OUT, 1.1);
      break;
    }
  }
}

// ---------- 캐시 ----------
const cache = new Map<string, HTMLCanvasElement>();
export function sprite(key: string, size: number, scale: number, draw: (c: C) => void): HTMLCanvasElement {
  const k = `${key}@${scale.toFixed(2)}`; let cv = cache.get(k); if (cv) return cv;
  cv = document.createElement('canvas'); const px = Math.ceil(size * scale); cv.width = px; cv.height = px;
  const c = cv.getContext('2d')!; c.scale(scale, scale); c.translate(size / 2, size / 2); draw(c);
  cache.set(k, cv); return cv;
}
export function unitSprite(kind: UnitKind, g: Grade, scale: number): HTMLCanvasElement { return sprite(`u:${kind}:${g}`, 64, scale, c => drawUnit(c, kind, g)); }
export function enemySprite(kind: EnemyKind, scale: number): HTMLCanvasElement { return sprite(`e:${kind}`, 64, scale, c => drawEnemy(c, kind)); }
export function clearSpriteCache(): void { cache.clear(); }
