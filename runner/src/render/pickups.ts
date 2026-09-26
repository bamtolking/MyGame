// Pickup + power-up art and names. Pickups are drawn inside their pickup box (never bigger than what collects).
import type { Pickup, PowerKind } from '../sim/types';
import { BONUS_WORD } from '../data/tuning';
import { rr, shade } from './characters';

export const LETTER_COLORS = ['#ff5d8f', '#ffb627', '#4cc9f0', '#80ed99', '#b388ff', '#ff8c42', '#f15bb5'];
export const POWER_NAME: Record<PowerKind, string> = { giant: '거대화!', dash: '질주!', magnet: '자석!' };
export const POWER_DESC: Record<PowerKind, string> = { giant: '장애물을 부수며 달려요', dash: '빠르게, 무적으로', magnet: '젤리가 끌려와요' };
export const POWER_COLOR: Record<PowerKind, string> = { giant: '#ff8c42', dash: '#4cc9f0', magnet: '#b388ff' };
export const POWER_ICON: Record<PowerKind, string> = { giant: '巨', dash: '≫', magnet: 'U' };


export function heart(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  c.beginPath(); c.moveTo(x, y + s * 0.45);
  c.bezierCurveTo(x - s * 0.9, y - s * 0.1, x - s * 0.45, y - s * 0.75, x, y - s * 0.3);
  c.bezierCurveTo(x + s * 0.45, y - s * 0.75, x + s * 0.9, y - s * 0.1, x, y + s * 0.45); c.fill();
}

export function drawPickup(c: CanvasRenderingContext2D, p: Pickup, x: number, y: number, t: number): void {
  switch (p.type) {
    case 'jelly': case 'bonusJelly': {
      const col = p.type === 'bonusJelly' ? '#ff9ad5' : '#ffd23f';
      c.fillStyle = col; c.beginPath(); c.ellipse(x, y, 8, 10, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = shade(col, -0.35); c.lineWidth = 1.5; c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(x - 3, y - 4, 2.5, 3.5, -0.4, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'big': {
      // a round "bear" jelly with ears
      c.fillStyle = '#ff5d8f';
      c.beginPath(); c.arc(x - 9, y - 11, 6, 0, Math.PI * 2); c.arc(x + 9, y - 11, 6, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(x, y, 15, 14, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#b3244f'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(x - 5, y - 2, 2, 0, Math.PI * 2); c.arc(x + 5, y - 2, 2, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.ellipse(x - 7, y - 7, 3, 4, -0.5, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'coin': {
      const w = Math.abs(Math.cos(t * 4 + x * 0.02)) * 12 + 2;
      c.fillStyle = '#ffc300'; c.beginPath(); c.ellipse(x, y, w, 13, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#b07d00'; c.lineWidth = 2; c.stroke();
      if (w > 7) { c.fillStyle = '#fff3b0'; c.font = '900 13px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('₩', x, y + 1); }
      break;
    }
    case 'potion': case 'bigPotion': {
      const s = p.type === 'bigPotion' ? 1.35 : 1;
      c.save(); c.translate(x, y); c.scale(s, s);
      c.fillStyle = 'rgba(128,237,153,0.35)'; c.beginPath(); c.arc(0, 2, 20 + Math.sin(t * 5) * 2, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e8fff0'; rr(c, -5, -18, 10, 8, 2); c.fill();
      c.fillStyle = '#2ec4b6'; c.beginPath(); c.arc(0, 2, 13, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#137a70'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#ff4d6d'; heart(c, 0, 3, 13);
      c.restore();
      break;
    }
    case 'power': {
      const col = POWER_COLOR[p.power!];
      c.fillStyle = col; c.beginPath(); c.arc(x, y, 18 + Math.sin(t * 6) * 1.5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#fff'; c.font = '900 18px system-ui, "Noto Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(POWER_ICON[p.power!], x, y + 1);
      break;
    }
    case 'letter': {
      const col = LETTER_COLORS[p.letter ?? 0];
      c.fillStyle = col; rr(c, x - 18, y - 18, 36, 36, 10); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 3; rr(c, x - 18, y - 18, 36, 36, 10); c.stroke();
      c.fillStyle = '#fff'; c.font = '900 22px system-ui, "Noto Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(BONUS_WORD[p.letter ?? 0], x, y + 1);
      break;
    }
  }
}

