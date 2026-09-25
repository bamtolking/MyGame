// UI icons as cached data URLs, drawn with the same art as the world sprites.
import type { ClassId, GearSlot, TalKind } from '../../../shared/types.ts';
import { TALS } from '../../../shared/data/talismans.ts';
import { RARITY_COLORS } from '../../../shared/data/items.ts';
import { type Ctx, INK, canvas, vol, circle, rrect, poly, fillC, line, inkLine, glowDot, shade } from './core.ts';
import { FRAMES, drawChar, drawNpc } from './chars.ts';
import { MON_ART } from './mons.ts';

const cache = new Map<string, string>();
function icon(key: string, size: number, draw: (c: Ctx) => void): string {
  let u = cache.get(key); if (u) return u;
  const cv = canvas(size * 2, size * 2), c = cv.getContext('2d')!; c.scale(2, 2); c.lineJoin = 'round'; c.lineCap = 'round'; draw(c);
  u = cv.toDataURL(); cache.set(key, u); return u;
}
export function talIcon(kind: TalKind): string {
  const d = TALS[kind];
  return icon('tal:' + kind, 48, c => {
    glowDot(c, 24, 24, 24, d.color + '55');
    c.save(); c.translate(24, 25); c.rotate(-0.08);
    rrect(c, -13, -20, 26, 40, 2.5); const g = c.createLinearGradient(-13, -20, 13, 20); g.addColorStop(0, '#fff3b8'); g.addColorStop(0.6, '#f2d77a'); g.addColorStop(1, '#d8b458'); fillC(c, g, '#6a4a14', 1.8);
    rrect(c, -10, -17, 20, 34, 1.5); c.strokeStyle = '#c8323a'; c.lineWidth = 1.1; c.stroke();
    c.fillStyle = '#b8202e'; c.font = '900 19px "Nanum Myeongjo", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(d.glyph, 0, 0.5);
    line(c, [-6, 13, 6, 13], '#b8202e', 1.2); line(c, [-4, -13.5, 4, -13.5], '#b8202e', 1.2);
    c.restore(); circle(c, 40, 8, 4.6); vol(c, d.color, 36, 4, 44, 12, 1.4);
  });
}
/** Head-and-shoulders portrait. */
export function classIcon(cls: ClassId, size = 64): string {
  return icon(`cls:${cls}:${size}`, size, c => { c.save(); c.scale(size / 64, size / 64); c.translate(-11, -2); c.scale(1.05, 1.05); drawChar(c, cls, FRAMES[cls].idle0); c.restore(); });
}
export function npcIcon(kind: string): string { return icon('npc:' + kind, 56, c => { c.save(); c.scale(0.72, 0.72); c.translate(0, kind === 'board' ? -6 : 0); drawNpc(c, kind, 0); c.restore(); }); }
export function monIcon(key: string): string {
  const a = MON_ART[key] ?? MON_ART.imp; const s = Math.max(a.w, a.h);
  return icon('mon:' + key, 64, c => { c.save(); c.scale(62 / s, 62 / s); c.translate((s - a.w) / 2 + 1, (s - a.h) / 2 + 1); a.draw(c, 0, 'm'); c.restore(); });
}
export function itemIcon(slot: GearSlot, cls: ClassId, tier: number, rarity: number): string {
  const tc = ['#9a7a5a', '#b87a3a', '#b8c2cc', '#9fc4ff', '#ffe066'][tier] ?? '#b8c2cc'; const rc = RARITY_COLORS[rarity] ?? RARITY_COLORS[0];
  return icon(`it:${slot}:${cls}:${tier}:${rarity}`, 48, c => {
    if (rarity >= 2) glowDot(c, 24, 24, 26, rc + (rarity >= 4 ? '88' : '55'));
    if (slot === 'weapon') {
      if (cls === 'sword') { c.save(); c.translate(24, 24); c.rotate(-0.8); c.beginPath(); c.moveTo(-3, 9); c.lineTo(-3, -16); c.quadraticCurveTo(0, -23, 3.5, -19); c.lineTo(3, 9); c.closePath(); vol(c, tc, -3, -22, 4, 9, 1.8, INK, 0.45, -0.3); line(c, [0.5, 7, 0.5, -17], 'rgba(255,255,255,0.6)', 0.9); rrect(c, -7, 8, 14, 4, 2); vol(c, '#c9a54a', -7, 8, 7, 12, 1.4); rrect(c, -2.5, 12, 5, 10, 2); vol(c, '#4a2c1c', -2.5, 12, 2.5, 22, 1.4); c.restore(); }
      else if (cls === 'archer') { c.beginPath(); c.moveTo(20, 6); c.bezierCurveTo(8, 10, 18, 22, 10, 24); c.bezierCurveTo(18, 26, 8, 38, 20, 42); c.strokeStyle = INK; c.lineWidth = 6; c.stroke(); c.strokeStyle = tc; c.lineWidth = 3.4; c.stroke(); line(c, [20, 6, 20, 42], '#f7f2e0', 1.1); inkLine(c, [12, 24, 40, 24], '#e9dcc0', 1.4); poly(c, [42, 24, 37, 21, 37, 27]); fillC(c, '#dfe6ee', INK, 1); }
      else { line(c, [24, 44, 24, 22], '#7a4a28', 3); for (const [x, y] of [[24, 16], [17, 20], [31, 20], [20, 11], [28, 11]]) { circle(c, x, y, 4.6); vol(c, tc, x - 4, y - 4, x + 4, y + 4, 1.5, INK, 0.5, -0.3); } }
    } else if (slot === 'armor') { poly(c, [12, 9, 36, 9, 42, 41, 6, 41]); vol(c, tc, 6, 9, 42, 41, 2, INK, 0.3, -0.3); line(c, [18, 9, 24, 22, 30, 9], '#f4f1e8', 3); line(c, [7, 30, 41, 30], shade(tc, -0.5), 2.4); }
    else { circle(c, 24, 14, 7); vol(c, tc, 17, 7, 31, 21, 2, INK, 0.5, -0.3); rrect(c, 20, 20, 8, 6, 2); fillC(c, '#c8323a', INK, 1.4); for (let i = 0; i < 5; i++) line(c, [21 + i * 1.5, 26, 19 + i * 2.5, 42], '#c8323a', 1.5); }
    if (rarity >= 3) { circle(c, 40, 8, 4); vol(c, rc, 36, 4, 44, 12, 1.2); }
  });
}
export function emoteText(e: number): string { return ['👍', 'ㅋㅋ', '도와줘!', '고마워', '가자!', '❤️', '😭', '🔥'][e] ?? '?'; }
