// 절차적 스프라이트: 닌자 유닛(속성×등급, 신화), 몬스터 4종. 오프스크린 캔버스에 캐시.
import { ELEMENT_DEFS, MYTHICS, GRADE_HEX, isMythic, type Kind, type Grade, type Element, type MythicId } from '../data/units.ts';
import { MONSTER_DEFS, type MonsterType } from '../data/monsters.ts';

const cache = new Map<string, HTMLCanvasElement>();
export function clearSpriteCache(): void { cache.clear(); }

function make(key: string, px: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): HTMLCanvasElement {
  const k = `${key}@${px}`; let c = cache.get(k); if (c) return c;
  c = document.createElement('canvas'); c.width = px; c.height = px;
  const ctx = c.getContext('2d')!; ctx.save(); ctx.translate(px / 2, px / 2); ctx.scale(px / 64, px / 64);
  draw(ctx, 64); ctx.restore();
  cache.set(k, c); return c;
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

/** 유닛 스프라이트 (64 논리 단위, 중심 0,0) */
export function unitSprite(kind: Kind, grade: Grade, px: number): HTMLCanvasElement {
  return make(`u-${kind}-${grade}`, px, (ctx) => {
    const hex = isMythic(kind) ? MYTHICS[kind as MythicId].hex : ELEMENT_DEFS[kind as Element].hex;
    const glyph = isMythic(kind) ? MYTHICS[kind as MythicId].glyph : ELEMENT_DEFS[kind as Element].glyph;
    const gHex = GRADE_HEX[grade];
    // 등급 오라
    if (grade >= 2) {
      const grd = ctx.createRadialGradient(0, 2, 10, 0, 2, 30);
      grd.addColorStop(0, gHex + (grade === 4 ? '99' : '55')); grd.addColorStop(1, gHex + '00');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, 2, 30, 0, Math.PI * 2); ctx.fill();
    }
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 24, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
    // 몸통
    ctx.fillStyle = grade === 4 ? shade(hex, 0.45) : '#242a3d';
    ctx.beginPath(); ctx.moveTo(-11, 26); ctx.lineTo(-13, 8); ctx.quadraticCurveTo(0, 2, 13, 8); ctx.lineTo(11, 26); ctx.closePath(); ctx.fill();
    // 띠(속성색)
    ctx.strokeStyle = hex; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-12, 14); ctx.lineTo(12, 18); ctx.stroke();
    // 머리(두건)
    ctx.fillStyle = grade === 4 ? shade(hex, 0.5) : '#2c3450';
    ctx.beginPath(); ctx.arc(0, -4, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -4, 14, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    // 얼굴 틈
    ctx.fillStyle = '#f2cfa8'; ctx.beginPath(); ctx.ellipse(0, -3, 10, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    // 눈
    ctx.fillStyle = '#1a1a26'; ctx.beginPath(); ctx.ellipse(-4, -3, 1.8, 2.4, 0, 0, Math.PI * 2); ctx.ellipse(4, -3, 1.8, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    if (grade >= 3) { ctx.fillStyle = hex; ctx.beginPath(); ctx.ellipse(-4, -3, 1, 1.2, 0, 0, Math.PI * 2); ctx.ellipse(4, -3, 1, 1.2, 0, 0, Math.PI * 2); ctx.fill(); }
    // 머리띠 + 꼬리
    ctx.fillStyle = hex; ctx.fillRect(-15, -12, 30, 5);
    ctx.beginPath(); ctx.moveTo(-14, -11); ctx.quadraticCurveTo(-26, -14, -28, -4); ctx.lineTo(-24, -6); ctx.quadraticCurveTo(-22, -10, -14, -8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-14, -9); ctx.quadraticCurveTo(-24, -6, -27, 4); ctx.lineTo(-23, 3); ctx.quadraticCurveTo(-21, -3, -14, -7); ctx.closePath(); ctx.fill();
    // 이마 문양(속성 글자)
    ctx.fillStyle = '#fff'; ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(glyph, 0, -9.5);
    // 등급 장식
    if (grade === 1) { ctx.strokeStyle = gHex; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -4, 16.5, 0, Math.PI * 2); ctx.stroke(); }
    if (grade === 2) { ctx.strokeStyle = gHex; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, -4, 17, 0, Math.PI * 2); ctx.stroke(); star(ctx, 0, -24, 4, gHex); }
    if (grade === 3) { ctx.strokeStyle = gHex; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -4, 17.5, 0, Math.PI * 2); ctx.stroke(); star(ctx, -8, -24, 3.5, gHex); star(ctx, 0, -26, 4, gHex); star(ctx, 8, -24, 3.5, gHex); }
    if (grade === 4) {
      ctx.strokeStyle = hex; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = hex; ctx.font = 'bold 12px serif'; ctx.fillText(glyph, 0, -27);
    }
  });
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}

/** 몬스터 스프라이트 */
export function monsterSprite(type: MonsterType, px: number): HTMLCanvasElement {
  return make(`m-${type}`, px, (ctx) => {
    const d = MONSTER_DEFS[type]; const hex = d.hex;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 22, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (type === 'boss') {
      const grd = ctx.createRadialGradient(0, 0, 8, 0, 0, 32); grd.addColorStop(0, hex + '88'); grd.addColorStop(1, hex + '00');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI * 2); ctx.fill();
    }
    // 몸
    ctx.fillStyle = hex;
    ctx.beginPath();
    if (type === 'runner') { ctx.ellipse(0, 2, 13, 19, 0, 0, Math.PI * 2); }
    else if (type === 'brute') { ctx.roundRect(-19, -16, 38, 38, 9); }
    else if (type === 'boss') { ctx.moveTo(-22, 20); ctx.lineTo(-24, -10); ctx.lineTo(-10, -22); ctx.lineTo(10, -22); ctx.lineTo(24, -10); ctx.lineTo(22, 20); ctx.closePath(); }
    else { ctx.arc(0, 2, 17, 0, Math.PI * 2); }
    ctx.fill();
    ctx.strokeStyle = shade(hex, 0.6); ctx.lineWidth = 2.5; ctx.stroke();
    // 뿔
    ctx.fillStyle = shade(hex, 0.55);
    if (type === 'grunt' || type === 'boss') { const s = type === 'boss' ? 1.4 : 1; ctx.beginPath(); ctx.moveTo(-9 * s, -12 * s); ctx.lineTo(-14 * s, -24 * s); ctx.lineTo(-3 * s, -15 * s); ctx.closePath(); ctx.moveTo(9 * s, -12 * s); ctx.lineTo(14 * s, -24 * s); ctx.lineTo(3 * s, -15 * s); ctx.closePath(); ctx.fill(); }
    if (type === 'brute') { ctx.fillRect(-16, -22, 6, 8); ctx.fillRect(10, -22, 6, 8); }
    if (type === 'runner') { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-22, -4); ctx.lineTo(-30, -4); ctx.moveTo(-22, 4); ctx.lineTo(-32, 4); ctx.moveTo(-20, 12); ctx.lineTo(-28, 12); ctx.stroke(); }
    // 눈
    const ey = type === 'runner' ? -4 : -2;
    ctx.fillStyle = type === 'boss' ? '#fff27a' : '#fff'; ctx.beginPath(); ctx.ellipse(-6, ey, 4, 4.5, 0, 0, Math.PI * 2); ctx.ellipse(6, ey, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1020'; ctx.beginPath(); ctx.ellipse(-5, ey + 1, 2, 2.5, 0, 0, Math.PI * 2); ctx.ellipse(7, ey + 1, 2, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    // 화난 눈썹
    ctx.strokeStyle = '#1a1020'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-11, ey - 8); ctx.lineTo(-2, ey - 4); ctx.moveTo(11, ey - 8); ctx.lineTo(2, ey - 4); ctx.stroke();
    // 입
    ctx.beginPath(); ctx.moveTo(-6, 9); ctx.lineTo(-2, 7); ctx.lineTo(2, 9); ctx.lineTo(6, 7); ctx.stroke();
    if (type === 'boss') { // 왕관
      ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(-14, -20); ctx.lineTo(-10, -32); ctx.lineTo(-4, -24); ctx.lineTo(0, -34); ctx.lineTo(4, -24); ctx.lineTo(10, -32); ctx.lineTo(14, -20); ctx.closePath(); ctx.fill();
    }
  });
}

/** DOM용 작은 이미지(data URL) */
export function unitImg(kind: Kind, grade: Grade, px = 44): HTMLCanvasElement { return unitSprite(kind, grade, px * 2); }
