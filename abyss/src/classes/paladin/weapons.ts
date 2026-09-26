// paladin: the order's maces (render/registry WEAPON_ART). The engine draws every mace base as the same spiked
// ball; the paladin's look swaps the 'mace' kind for 'pl_mace', drawn per base tier: a banded wooden cudgel (club),
// a flanged iron mace (flail), a spiked morning star (morningStar), a gilded war hammer (warHammer) and, for
// anything beyond, a golden sun mace. Local space: origin in the fist, +y along the weapon (L scales lengths).
import { shade } from '../../render/iso';
import { WEAPON_ART } from '../../render/registry';

const TAU = Math.PI * 2;
type C2D = CanvasRenderingContext2D;
const GOLD = '#e2b44a';

/** Brushed metal across the local x axis (light edge → base → dark edge); plain colour for non-hex bases. */
function metal(c: C2D, x0: number, x1: number, base: string): CanvasGradient | string {
  if (!base.startsWith('#')) return base;
  const g = c.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, shade(base, 0.5)); g.addColorStop(0.45, base); g.addColorStop(1, shade(base, -0.45));
  return g;
}

/** Leather-wrapped grip below the fist and a round pommel; `gold` gilds the pommel. */
function grip(c: C2D, L: (n: number) => number, gold: boolean): void {
  c.fillStyle = '#4a2c16'; c.fillRect(L(-1.35), L(-3.4), L(2.7), L(6));
  c.strokeStyle = '#2a180a'; c.lineWidth = L(0.5);
  c.beginPath(); for (let i = 0; i < 3; i++) { c.moveTo(L(-1.35), L(-2.8 + i * 1.9)); c.lineTo(L(1.35), L(-1.9 + i * 1.9)); } c.stroke();
  c.fillStyle = gold ? GOLD : '#8a7456'; c.beginPath(); c.arc(0, L(-4.4), L(1.55), 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.arc(L(-0.5), L(-4.9), L(0.5), 0, TAU); c.fill();
}

/** Metal haft from the grip to y1. */
function haft(c: C2D, L: (n: number) => number, y1: number, steel: string, w = 2.2): void {
  c.fillStyle = metal(c, L(-w / 2), L(w / 2), steel); c.fillRect(L(-w / 2), L(2.4), L(w), y1 - L(2.4));
}

/** Six-flanged head seen from the side (three flanges each way) centred at y. */
function flanges(c: C2D, L: (n: number) => number, y: number, col: string, out = 5.4, half = 5): void {
  const core = metal(c, L(-2.6), L(2.6), col);
  c.fillStyle = core; c.beginPath(); c.ellipse(0, y, L(2.3), L(half), 0, 0, TAU); c.fill();
  for (const side of [-1, 1]) for (let i = 2; i >= 0; i--) {
    const o = L(out - i * 1.25) * side, y0 = y - L(half - 0.3 - i * 0.7), y1 = y + L(half - 0.3 - i * 0.7);
    c.fillStyle = i === 0 ? shade(col, side < 0 ? 0.45 : -0.4) : i === 1 ? shade(col, side < 0 ? 0.2 : -0.2) : col;
    c.beginPath(); c.moveTo(side * L(1.2), y0); c.quadraticCurveTo(o, y0 + L(1.2), o, y); c.quadraticCurveTo(o, y1 - L(1.2), side * L(1.2), y1); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(20,20,28,0.5)'; c.lineWidth = L(0.35); c.stroke();
  }
}

WEAPON_ART.pl_mace = {
  draw(c, tier, steel0, _edge, L) {
    const t = Math.max(0, Math.min(4, tier));
    const steel = steel0.startsWith('#') && steel0.length === 7 ? steel0 : '#b8bec8';
    if (t === 0) {
      // 곤봉: a knotted wooden cudgel swelling toward the end, two iron bands and studs
      grip(c, L, false);
      const g = c.createLinearGradient(L(-3.5), 0, L(3.5), 0);
      g.addColorStop(0, '#a8784a'); g.addColorStop(0.5, '#7a4e28'); g.addColorStop(1, '#4a2e14');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(L(-1.3), L(2.4)); c.lineTo(L(1.3), L(2.4));
      c.quadraticCurveTo(L(2.6), L(12), L(3.5), L(19.5)); c.quadraticCurveTo(L(3.4), L(23.5), 0, L(23.8));
      c.quadraticCurveTo(L(-3.4), L(23.5), L(-3.5), L(19.5)); c.quadraticCurveTo(L(-2.6), L(12), L(-1.3), L(2.4)); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(40,20,6,0.55)'; c.lineWidth = L(0.4);
      c.beginPath(); c.moveTo(L(-0.6), L(5)); c.quadraticCurveTo(L(-1.4), L(13), L(-1.2), L(21)); c.moveTo(L(1), L(8)); c.quadraticCurveTo(L(1.6), L(14), L(1.9), L(20)); c.stroke();
      for (const [y, w] of [[12.5, 2.5], [18.2, 3.3]] as [number, number][]) { c.fillStyle = metal(c, L(-w), L(w), steel); c.fillRect(L(-w - 0.2), L(y), L(2 * w + 0.4), L(1.5)); }
      c.fillStyle = shade(steel, 0.2);
      for (const [x, y] of [[-2.9, 15.6], [2.9, 15.6], [0, 15.9], [-2.2, 21.6], [2.2, 21.6]] as [number, number][]) { c.beginPath(); c.arc(L(x), L(y), L(0.75), 0, TAU); c.fill(); }
      return;
    }
    if (t === 1) {
      // 철퇴: a plain flanged iron mace
      grip(c, L, false);
      haft(c, L, L(15), steel);
      c.fillStyle = metal(c, L(-2), L(2), shade(steel, -0.15)); c.fillRect(L(-1.9), L(13.2), L(3.8), L(1.6));
      flanges(c, L, L(19.6), steel);
      c.fillStyle = metal(c, L(-1), L(1), steel); c.beginPath(); c.moveTo(L(-1.2), L(24.4)); c.lineTo(0, L(26.4)); c.lineTo(L(1.2), L(24.4)); c.fill();
      return;
    }
    if (t === 2) {
      // 모닝스타: spiked iron ball on a gilded collar
      grip(c, L, true);
      haft(c, L, L(16), steel);
      c.fillStyle = GOLD; c.fillRect(L(-2.2), L(14.2), L(4.4), L(1.8));
      const y = L(20.4), R = L(4.5);
      c.fillStyle = shade(steel, 0.35);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + 0.2, ca = Math.cos(a), sa = Math.sin(a);
        c.beginPath(); c.moveTo(ca * R * 0.7 - sa * L(1.2), y + sa * R * 0.7 + ca * L(1.2)); c.lineTo(ca * (R + L(3.4)), y + sa * (R + L(3.4))); c.lineTo(ca * R * 0.7 + sa * L(1.2), y + sa * R * 0.7 - ca * L(1.2)); c.fill();
      }
      const g = c.createRadialGradient(L(-1.6), y - L(1.6), L(0.4), 0, y, R);
      g.addColorStop(0, shade(steel, 0.55)); g.addColorStop(0.55, steel); g.addColorStop(1, shade(steel, -0.5));
      c.fillStyle = g; c.beginPath(); c.arc(0, y, R, 0, TAU); c.fill();
      c.strokeStyle = GOLD; c.lineWidth = L(0.9); c.beginPath(); c.ellipse(0, y, R * 0.98, R * 0.32, 0, 0, TAU); c.stroke();
      return;
    }
    if (t === 3) {
      // 전쟁 망치: a gilded war hammer — square striking face one side, a back beak, a top spike, a cross inlay
      grip(c, L, true);
      haft(c, L, L(18), steel, 2.4);
      c.fillStyle = GOLD; c.fillRect(L(-1.6), L(8), L(3.2), L(1)); c.fillRect(L(-1.6), L(12), L(3.2), L(1));
      const y0 = L(16), y1 = L(23.4);
      // back beak
      c.fillStyle = metal(c, L(-9), L(-2), shade(steel, -0.1));
      c.beginPath(); c.moveTo(L(-2.4), y0 + L(1.2)); c.quadraticCurveTo(L(-6.5), y0 + L(2.2), L(-9.4), y0 + L(4.9)); c.quadraticCurveTo(L(-6), y0 + L(4.6), L(-2.4), y1 - L(1.4)); c.closePath(); c.fill();
      // top spike
      c.fillStyle = metal(c, L(-1.4), L(1.4), steel);
      c.beginPath(); c.moveTo(L(-1.5), y1); c.lineTo(0, y1 + L(4.6)); c.lineTo(L(1.5), y1); c.fill();
      // head block with the striking face
      c.fillStyle = metal(c, L(-2.8), L(7.2), steel);
      c.beginPath(); c.moveTo(L(-2.8), y0 + L(0.6)); c.lineTo(L(5.6), y0); c.lineTo(L(7.2), y0 + L(0.8)); c.lineTo(L(7.2), y1 - L(0.8)); c.lineTo(L(5.6), y1); c.lineTo(L(-2.8), y1 - L(0.6)); c.closePath(); c.fill();
      c.strokeStyle = shade(steel, -0.55); c.lineWidth = L(0.4); c.stroke();
      c.fillStyle = shade(steel, 0.45); c.fillRect(L(6.1), y0 + L(0.9), L(0.9), y1 - y0 - L(1.8));
      // gold rims and the cross
      c.fillStyle = GOLD; c.fillRect(L(-2.8), y0 + L(0.5), L(10), L(0.8)); c.fillRect(L(-2.8), y1 - L(1.3), L(10), L(0.8));
      c.fillStyle = '#fff0b8'; c.fillRect(L(1.6), y0 + L(1.9), L(1), L(4.2)); c.fillRect(L(0.4), y0 + L(3.2), L(3.4), L(0.9));
      return;
    }
    // golden sun mace (anything above the listed bases)
    grip(c, L, true);
    haft(c, L, L(15.5), '#e8c870');
    c.fillStyle = GOLD; c.fillRect(L(-2), L(13.6), L(4), L(1.8));
    flanges(c, L, L(20), '#f0cf72', 5.8, 5.4);
    c.fillStyle = '#fff6d0'; c.beginPath(); c.arc(0, L(20), L(1.5), 0, TAU); c.fill();
    c.fillStyle = GOLD; c.beginPath(); c.moveTo(L(-1.3), L(25.2)); c.lineTo(0, L(28)); c.lineTo(L(1.3), L(25.2)); c.fill();
  },
};
