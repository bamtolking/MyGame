// Procedural character art: a posable humanoid rig (heroes, NPCs, most monsters) and custom creature bodies.
// Coordinates: origin at the feet, facing right (+x), up is -y. Units are iso pixels at zoom 1.
import { shade } from './iso';

export interface Pose {
  t: number; walk: number; moving: boolean;
  atk: number; cast: number; hit: number; dead: number;
  flip: boolean; back: boolean; alpha: number; frozen: boolean; chill: boolean;
  special?: string; phase?: number; block?: number;
}

export type WeaponKind = 'sword' | 'axe' | 'mace' | 'sword2h' | 'axe2h' | 'bow' | 'staff' | 'wand' | 'spear' | 'club' | 'cleaver' | 'crozier' | 'claws' | 'hammer' | 'none';

export interface Look {
  skin: string; body: string; body2?: string; legs: string; boots?: string;
  head: 'human' | 'skull' | 'goat' | 'imp' | 'zombie' | 'ghoul' | 'demon' | 'hood' | 'none' | 'woman' | 'old';
  hair?: string; helm?: number; helmColor?: string;
  build?: number; height?: number; hunch?: number;
  robe?: string; cloak?: string; apron?: string;
  weapon?: WeaponKind; wTier?: number; wColor?: string; wGlow?: string;
  offhand?: 'shield' | 'quiver' | 'orb' | null; offTier?: number; offColor?: string;
  bones?: boolean; eyes?: string; horns?: string; mitre?: boolean; beard?: string; tail?: string; wings?: string;
  feathers?: boolean; digitigrade?: boolean; zombieArms?: boolean; trim?: string; glow?: string; hat?: string;
}

const TAU = Math.PI * 2;
const ease = (x: number) => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);

function limb(c: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, w: number, col: string): [number, number] {
  const ex = x + Math.sin(ang) * len, ey = y + Math.cos(ang) * len;
  c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke();
  return [ex, ey];
}

function eyesAt(c: CanvasRenderingContext2D, x: number, y: number, col: string, r = 1.1, gap = 3): void {
  c.save();
  c.shadowColor = col; c.shadowBlur = 4;
  c.fillStyle = col;
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.arc(x + gap, y, r, 0, TAU); c.fill();
  c.restore();
}

// ------------------------------------------------------------------ weapons
export function drawWeapon(c: CanvasRenderingContext2D, kind: WeaponKind, x: number, y: number, ang: number, tier: number, col?: string, glow?: string, k = 1): void {
  c.save();
  c.translate(x, y); c.rotate(-ang);
  // local: +y points along the arm (out of the hand)
  const steel = col ?? ['#b8b8b0', '#c8ccd4', '#9aa0b0', '#5a5e6e', '#402024'][Math.max(0, Math.min(4, tier))];
  const edge = shade(steel.startsWith('#') ? steel : '#b8b8b0', 0.35);
  if (glow) { c.shadowColor = glow; c.shadowBlur = 6; }
  const L = (n: number) => n * k;
  switch (kind) {
    case 'sword': case 'sword2h': {
      const len = L(kind === 'sword2h' ? 30 : 21 + tier * 1.2), w = L(kind === 'sword2h' ? 3.6 : 2.8);
      c.fillStyle = steel; c.beginPath(); c.moveTo(-w / 2, 2); c.lineTo(w / 2, 2); c.lineTo(w / 2 * 0.8, len); c.lineTo(0, len + 3); c.lineTo(-w / 2 * 0.8, len); c.closePath(); c.fill();
      c.fillStyle = edge; c.fillRect(-0.4, 3, 0.8, len - 2);
      c.fillStyle = tier >= 3 ? '#c8a040' : '#6a5030'; c.fillRect(L(-4.5), 0, L(9), L(2));
      c.fillStyle = '#4a3020'; c.fillRect(L(-1), L(-5), L(2), L(5));
      c.fillStyle = tier >= 3 ? '#e0c050' : '#8a7050'; c.beginPath(); c.arc(0, L(-5.5), L(1.4), 0, TAU); c.fill();
      break;
    }
    case 'axe': case 'axe2h': {
      const len = L(kind === 'axe2h' ? 30 : 22);
      c.fillStyle = '#5a3a20'; c.fillRect(L(-1.1), L(-3), L(2.2), len);
      c.fillStyle = steel;
      const hx = len - L(6);
      c.beginPath(); c.moveTo(L(1), hx - L(5)); c.quadraticCurveTo(L(kind === 'axe2h' ? 14 : 10), hx - L(8), L(kind === 'axe2h' ? 13 : 9), hx + L(4)); c.quadraticCurveTo(L(6), hx + L(2), L(1), hx + L(4)); c.closePath(); c.fill();
      if (kind === 'axe2h') { c.beginPath(); c.moveTo(L(-1), hx - L(4)); c.quadraticCurveTo(L(-10), hx - L(6), L(-9), hx + L(3)); c.lineTo(L(-1), hx + L(3)); c.fill(); }
      c.strokeStyle = edge; c.lineWidth = 0.8; c.beginPath(); c.moveTo(L(kind === 'axe2h' ? 13 : 9), hx - L(5)); c.lineTo(L(kind === 'axe2h' ? 13 : 9), hx + L(3)); c.stroke();
      break;
    }
    case 'mace': case 'club': case 'hammer': {
      const len = L(kind === 'hammer' ? 24 : 20);
      c.fillStyle = kind === 'club' ? '#6a4a2a' : '#4a3a2a'; c.fillRect(L(-1.2), L(-3), L(2.4), len);
      if (kind === 'club') { c.fillStyle = '#7a5a36'; c.beginPath(); c.ellipse(0, len, L(3.8), L(6), 0, 0, TAU); c.fill(); }
      else if (kind === 'hammer') { c.fillStyle = steel; c.fillRect(L(-6), len - L(3), L(12), L(7)); c.fillStyle = edge; c.fillRect(L(-6), len - L(3), L(12), L(1)); }
      else {
        c.fillStyle = steel; c.beginPath(); c.arc(0, len, L(4.2), 0, TAU); c.fill();
        c.fillStyle = edge; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; c.beginPath(); c.moveTo(Math.cos(a) * L(3.5), len + Math.sin(a) * L(3.5)); c.lineTo(Math.cos(a) * L(6.5), len + Math.sin(a) * L(6.5)); c.lineTo(Math.cos(a + 0.4) * L(3.5), len + Math.sin(a + 0.4) * L(3.5)); c.fill(); }
      }
      break;
    }
    case 'spear': {
      c.fillStyle = '#6a4a2a'; c.fillRect(L(-0.8), L(-12), L(1.6), L(34));
      c.fillStyle = steel; c.beginPath(); c.moveTo(L(-2), L(22)); c.lineTo(L(2), L(22)); c.lineTo(0, L(30)); c.closePath(); c.fill();
      break;
    }
    case 'cleaver': {
      c.fillStyle = '#4a3020'; c.fillRect(L(-1.3), L(-3), L(2.6), L(10));
      c.fillStyle = steel; c.beginPath(); c.moveTo(L(-2), L(6)); c.lineTo(L(12), L(6)); c.lineTo(L(12), L(26)); c.lineTo(L(-2), L(22)); c.closePath(); c.fill();
      c.fillStyle = 'rgba(140,20,20,0.7)'; c.beginPath(); c.moveTo(L(8), L(16)); c.lineTo(L(12), L(14)); c.lineTo(L(12), L(26)); c.lineTo(L(6), L(24)); c.fill();
      break;
    }
    case 'staff': case 'crozier': {
      c.fillStyle = '#5a3e24'; c.fillRect(L(-1), L(-26), L(2), L(40));
      if (kind === 'crozier') {
        c.strokeStyle = '#c8b060'; c.lineWidth = L(1.8); c.beginPath(); c.arc(L(3), L(-26), L(4), Math.PI, TAU * 0.95); c.stroke();
        c.fillStyle = '#b060ff'; c.shadowColor = '#b060ff'; c.shadowBlur = 8; c.beginPath(); c.arc(L(3), L(-26), L(1.8), 0, TAU); c.fill();
      } else {
        const gc = glow ?? ['#80a0ff', '#a080ff', '#60e0ff', '#ff8040', '#ff3060'][Math.max(0, Math.min(4, tier))];
        c.fillStyle = '#8a7050'; c.beginPath(); c.moveTo(L(-3), L(-26)); c.lineTo(L(3), L(-26)); c.lineTo(0, L(-31)); c.fill();
        c.fillStyle = gc; c.shadowColor = gc; c.shadowBlur = 10; c.beginPath(); c.arc(0, L(-30), L(2.6), 0, TAU); c.fill();
      }
      break;
    }
    case 'wand': {
      c.fillStyle = '#d8d0c0'; c.fillRect(L(-0.8), 0, L(1.6), L(14));
      c.fillStyle = glow ?? '#a0c0ff'; c.shadowColor = glow ?? '#a0c0ff'; c.shadowBlur = 8; c.beginPath(); c.arc(0, L(15), L(2), 0, TAU); c.fill();
      break;
    }
    case 'claws': {
      c.strokeStyle = '#e8e0d0'; c.lineWidth = L(1); for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * L(1.5), 0); c.lineTo(i * L(2.2), L(6)); c.stroke(); }
      break;
    }
  }
  c.restore();
}

function drawBow(c: CanvasRenderingContext2D, x: number, y: number, draw: number, tier: number, k = 1): void {
  c.save(); c.translate(x, y);
  const h = 17 * k;
  c.strokeStyle = ['#8a5a30', '#6a4020', '#4a3020', '#3a2a3a', '#2a1a2a'][Math.max(0, Math.min(4, tier))]; c.lineWidth = 2.2 * k; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-2 * k, -h); c.quadraticCurveTo(7 * k, 0, -2 * k, h); c.stroke();
  c.strokeStyle = 'rgba(230,230,210,0.8)'; c.lineWidth = 0.6;
  const px = -2 * k - draw * 9 * k;
  c.beginPath(); c.moveTo(-2 * k, -h); c.lineTo(px, 0); c.lineTo(-2 * k, h); c.stroke();
  if (draw > 0.2) { c.strokeStyle = '#d8c8a0'; c.lineWidth = 1; c.beginPath(); c.moveTo(px, 0); c.lineTo(px + 18 * k, 0); c.stroke(); c.fillStyle = '#c0c0c0'; c.beginPath(); c.moveTo(px + 18 * k, -1.5); c.lineTo(px + 21 * k, 0); c.lineTo(px + 18 * k, 1.5); c.fill(); }
  c.restore();
}

function drawShield(c: CanvasRenderingContext2D, x: number, y: number, tier: number, col?: string): void {
  c.save(); c.translate(x, y);
  const base = col ?? ['#6a4a2a', '#7a2a22', '#5a6070', '#3a3e4a', '#4a1414'][Math.max(0, Math.min(4, tier))];
  c.fillStyle = base; c.strokeStyle = tier >= 2 ? '#c8b060' : '#a0a0a0'; c.lineWidth = 1.2;
  c.beginPath();
  if (tier <= 0) c.arc(0, 0, 7, 0, TAU);
  else { c.moveTo(-7, -9); c.lineTo(7, -9); c.lineTo(7, 2); c.quadraticCurveTo(0, 13, 0, 13); c.quadraticCurveTo(0, 13, -7, 2); c.closePath(); }
  c.fill(); c.stroke();
  c.fillStyle = tier >= 3 ? '#e0c050' : '#c0c0c0'; c.beginPath(); c.arc(0, -1, 1.8, 0, TAU); c.fill();
  if (tier >= 2) { c.strokeStyle = 'rgba(255,220,120,0.5)'; c.beginPath(); c.moveTo(0, -8); c.lineTo(0, 10); c.moveTo(-6, -2); c.lineTo(6, -2); c.stroke(); }
  c.restore();
}

// ------------------------------------------------------------------ heads
function drawHead(c: CanvasRenderingContext2D, L: Look, x: number, y: number, r: number, p: Pose): void {
  const skin = L.skin;
  switch (L.head) {
    case 'skull': {
      c.fillStyle = skin; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.fillRect(x - r * 0.1, y + r * 0.4, r * 1.1, r * 0.8);
      if (!p.back) { c.fillStyle = '#1a1410'; c.beginPath(); c.arc(x + r * 0.25, y - r * 0.05, r * 0.28, 0, TAU); c.arc(x + r * 0.78, y - r * 0.05, r * 0.24, 0, TAU); c.fill(); if (L.eyes) eyesAt(c, x + r * 0.25, y - r * 0.05, L.eyes, 0.7, r * 0.53); c.fillStyle = '#1a1410'; for (let i = 0; i < 3; i++) c.fillRect(x + r * (0.2 + i * 0.28), y + r * 0.7, r * 0.12, r * 0.4); }
      break;
    }
    case 'goat': {
      c.fillStyle = skin; c.beginPath(); c.ellipse(x, y, r * 1.05, r, 0, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(x + r * 0.3, y - r * 0.3); c.lineTo(x + r * 2, y + r * 0.2); c.lineTo(x + r * 1.8, y + r * 0.9); c.lineTo(x + r * 0.2, y + r * 0.8); c.fill();
      c.strokeStyle = L.horns ?? '#d8c8a0'; c.lineWidth = r * 0.45; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - r * 0.1, y - r * 0.6); c.quadraticCurveTo(x - r * 1.6, y - r * 2, x - r * 1.9, y - r * 0.3); c.stroke();
      if (!p.back) eyesAt(c, x + r * 0.7, y - r * 0.1, L.eyes ?? '#ff4020', 0.8, 0);
      break;
    }
    case 'imp': {
      c.fillStyle = skin; c.beginPath(); c.ellipse(x + r * 0.2, y, r * 1.15, r * 1.05, 0, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(x - r * 0.6, y - r * 0.4); c.lineTo(x - r * 1.9, y - r * 1.3); c.lineTo(x - r * 0.5, y + r * 0.2); c.fill();
      if (!p.back) { eyesAt(c, x + r * 0.5, y - r * 0.2, L.eyes ?? '#ffe040', 0.9, r * 0.6); c.fillStyle = '#2a0a06'; c.fillRect(x + r * 0.4, y + r * 0.5, r * 0.9, r * 0.25); c.fillStyle = '#fff'; c.fillRect(x + r * 0.5, y + r * 0.5, r * 0.15, r * 0.25); c.fillRect(x + r * 0.95, y + r * 0.5, r * 0.15, r * 0.25); }
      if (L.feathers) { const cols = ['#e0c040', '#40a0e0', '#e04040']; cols.forEach((cc, i) => { c.strokeStyle = cc; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - r * 0.3 + i * 2, y - r * 0.8); c.lineTo(x - r * 0.6 + i * 3, y - r * 2.4); c.stroke(); }); }
      break;
    }
    case 'zombie': case 'ghoul': {
      c.fillStyle = skin; c.beginPath(); c.ellipse(x + r * 0.15, y + (L.head === 'ghoul' ? r * 0.2 : 0), r * 1.0, r * 1.05, 0.2, 0, TAU); c.fill();
      if (!p.back) {
        c.fillStyle = '#1a1a10'; c.beginPath(); c.arc(x + r * 0.35, y - r * 0.1, r * 0.25, 0, TAU); c.arc(x + r * 0.85, y - r * 0.05, r * 0.2, 0, TAU); c.fill();
        if (L.eyes) eyesAt(c, x + r * 0.35, y - r * 0.1, L.eyes, 0.6, r * 0.5);
        c.fillStyle = '#3a1010'; c.beginPath(); c.ellipse(x + r * 0.7, y + r * 0.55, r * 0.35, r * 0.2 + (L.head === 'ghoul' ? r * 0.15 : 0), 0, 0, TAU); c.fill();
      }
      if (L.hair) { c.fillStyle = L.hair; c.beginPath(); c.arc(x - r * 0.2, y - r * 0.5, r * 0.7, Math.PI, TAU); c.fill(); }
      break;
    }
    case 'demon': {
      c.fillStyle = skin; c.beginPath(); c.ellipse(x + r * 0.1, y, r * 1.05, r * 1.1, 0, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(x + r * 0.2, y + r * 0.2); c.lineTo(x + r * 1.5, y + r * 0.6); c.lineTo(x + r * 0.3, y + r * 1.1); c.fill();
      c.strokeStyle = L.horns ?? '#2a1a14'; c.lineWidth = r * 0.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - r * 0.2, y - r * 0.7); c.quadraticCurveTo(x - r * 0.4, y - r * 2.3, x + r * 0.9, y - r * 2.2); c.stroke();
      c.beginPath(); c.moveTo(x - r * 0.6, y - r * 0.5); c.quadraticCurveTo(x - r * 1.8, y - r * 1.7, x - r * 1.2, y - r * 2.4); c.stroke();
      if (!p.back) eyesAt(c, x + r * 0.35, y - r * 0.15, L.eyes ?? '#ffcc20', 1, r * 0.55);
      break;
    }
    case 'hood': {
      c.fillStyle = L.robe ?? L.body; c.beginPath(); c.moveTo(x - r * 1.2, y + r * 1.2); c.quadraticCurveTo(x - r * 1.3, y - r * 1.6, x + r * 0.3, y - r * 1.3); c.quadraticCurveTo(x + r * 1.5, y - r * 0.6, x + r * 1.2, y + r * 1.2); c.closePath(); c.fill();
      if (!p.back) { c.fillStyle = '#080608'; c.beginPath(); c.ellipse(x + r * 0.5, y + r * 0.1, r * 0.6, r * 0.8, 0, 0, TAU); c.fill(); if (L.eyes) eyesAt(c, x + r * 0.25, y, L.eyes, 0.8, r * 0.55); }
      break;
    }
    case 'woman': case 'human': case 'old': {
      c.fillStyle = skin; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      if (!p.back) {
        c.beginPath(); c.moveTo(x + r * 0.7, y - r * 0.1); c.lineTo(x + r * 1.25, y + r * 0.25); c.lineTo(x + r * 0.8, y + r * 0.45); c.fill();
        c.fillStyle = '#1a1210'; c.fillRect(x + r * 0.45, y - r * 0.2, r * 0.22, r * 0.22);
      }
      if (L.beard) { c.fillStyle = L.beard; c.beginPath(); c.moveTo(x - r * 0.1, y + r * 0.2); c.quadraticCurveTo(x + r * 0.9, y + r * 2.4, x + r * 1.0, y + r * 0.4); c.closePath(); c.fill(); }
      if (L.hair && (L.helm === undefined || L.helm < 0)) {
        c.fillStyle = L.hair;
        c.beginPath(); c.arc(x - r * 0.1, y - r * 0.15, r * 1.02, Math.PI * 0.85, TAU * 0.98); c.fill();
        if (L.head === 'woman') { c.beginPath(); c.moveTo(x - r, y - r * 0.2); c.quadraticCurveTo(x - r * 1.5, y + r * 2.2, x - r * 0.2, y + r * 2.4); c.lineTo(x - r * 0.1, y); c.fill(); }
        if (p.back) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
      }
      break;
    }
  }
  // helmets
  if (L.helm !== undefined && L.helm >= 0) {
    const hc = L.helmColor ?? ['#6a4a2a', '#9aa0a8', '#8a8e98', '#6a6e7a', '#3a1a1a'][Math.min(4, L.helm)];
    c.fillStyle = hc;
    c.beginPath(); c.arc(x, y - r * 0.1, r * 1.12, Math.PI * 0.92, TAU * 1.02); c.lineTo(x + r * 1.1, y + r * 0.1); c.lineTo(x - r * 1.1, y + r * 0.1); c.fill();
    c.fillStyle = shade(hc.startsWith('#') ? hc : '#888888', 0.3); c.fillRect(x - r * 1.1, y - r * 0.05, r * 2.2, r * 0.3);
    if (L.helm >= 1 && !p.back) { c.fillStyle = hc; c.fillRect(x + r * 0.55, y - r * 0.1, r * 0.25, r * 0.9); }
    if (L.helm >= 3) { c.fillStyle = hc; c.beginPath(); c.arc(x, y + r * 0.3, r * 1.05, 0, Math.PI); c.fill(); if (!p.back) { c.fillStyle = '#0a0808'; c.fillRect(x + r * 0.1, y + r * 0.05, r * 0.95, r * 0.2); } }
    if (L.helm === 2 || L.helm >= 4) {
      c.strokeStyle = L.helm >= 4 ? '#1a0a08' : '#d8d0b8'; c.lineWidth = r * 0.35; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - r * 0.6, y - r * 0.8); c.quadraticCurveTo(x - r * 1.8, y - r * 1.2, x - r * 1.5, y - r * 2.3); c.stroke();
      c.beginPath(); c.moveTo(x + r * 0.4, y - r * 0.9); c.quadraticCurveTo(x + r * 1.2, y - r * 1.8, x + r * 0.6, y - r * 2.4); c.stroke();
    }
    if (L.helm >= 4 && !p.back) eyesAt(c, x + r * 0.35, y + r * 0.12, '#ff3010', 0.7, r * 0.5);
  }
  if (L.mitre) {
    c.fillStyle = '#e8e0d0'; c.beginPath(); c.moveTo(x - r * 0.9, y - r * 0.6); c.lineTo(x - r * 0.2, y - r * 3.2); c.lineTo(x + r * 0.3, y - r * 2.4); c.lineTo(x + r * 0.9, y - r * 3.0); c.lineTo(x + r * 0.9, y - r * 0.6); c.closePath(); c.fill();
    c.fillStyle = '#a02a8a'; c.fillRect(x - r * 0.15, y - r * 2.6, r * 0.35, r * 2);
    c.fillStyle = '#c8a040'; c.fillRect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 0.3);
  }
  if (L.hat) {
    c.fillStyle = L.hat; c.beginPath(); c.moveTo(x - r * 1.6, y - r * 0.5); c.lineTo(x + r * 1.6, y - r * 0.5); c.lineTo(x + r * 0.2, y - r * 1.0); c.lineTo(x - r * 0.9, y - r * 3.4); c.lineTo(x - r * 0.6, y - r * 1.0); c.closePath(); c.fill();
  }
}

// ------------------------------------------------------------------ biped rig
export function drawBiped(c: CanvasRenderingContext2D, L: Look, p: Pose): void {
  const b = L.build ?? 1, hgt = L.height ?? 1, hunch = L.hunch ?? 0;
  const legL = 21 * hgt, torsoH = 17 * hgt, armL = 17 * hgt, headR = 5.6 * (L.head === 'imp' ? 1.2 : 1) * Math.sqrt(hgt);
  const phase = p.walk * 4.2;
  const sw = p.moving ? Math.sin(phase) : 0;
  const bob = p.moving ? Math.abs(Math.cos(phase)) * 1.6 : Math.sin(p.t * 2) * 0.4;
  const hipY = -legL + bob * 0.5;
  const shX = hunch * 14, shY = hipY - torsoH + hunch * 5;
  const legW = (L.bones ? 2.2 : 4.6) * b;
  const armW = (L.bones ? 2 : 3.8) * b;
  const dark = (col: string) => shade(col, -0.3);
  // wings
  if (L.wings) {
    const f = Math.sin(p.t * 3) * 0.2;
    c.fillStyle = L.wings;
    for (const s of [1, 0.7]) {
      c.beginPath(); c.moveTo(shX - 3, shY + 4);
      c.quadraticCurveTo(shX - 26 * s, shY - 22 * s - f * 20, shX - 34 * s, shY - 4 * s);
      c.quadraticCurveTo(shX - 22 * s, shY + 2, shX - 20 * s, shY + 14 * s);
      c.quadraticCurveTo(shX - 12, shY + 8, shX - 3, shY + 10); c.fill();
      c.fillStyle = shade(L.wings, -0.3);
    }
  }
  // tail
  if (L.tail) { c.strokeStyle = L.tail; c.lineWidth = 3 * b; c.lineCap = 'round'; c.beginPath(); c.moveTo(-3, hipY + 2); c.quadraticCurveTo(-16, hipY + 6 + Math.sin(p.t * 3) * 3, -20, hipY - 6); c.stroke(); }
  // cloak (behind)
  if (L.cloak) {
    c.fillStyle = dark(L.cloak);
    c.beginPath(); c.moveTo(shX - 5 * b, shY + 1); c.quadraticCurveTo(-12 * b - (p.moving ? 4 : 0), hipY + 6, -9 * b - (p.moving ? 5 + sw * 2 : 0), -1); c.lineTo(3, -2); c.lineTo(shX + 2, shY + 3); c.fill();
  }
  // quiver on back
  if (L.offhand === 'quiver') {
    c.save(); c.translate(shX - 6 * b, shY + 3); c.rotate(-0.5);
    c.fillStyle = '#5a3a1e'; c.fillRect(-2.5, -4, 5, 15);
    c.strokeStyle = '#d8d0c0'; c.lineWidth = 0.8; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 1.4, -4); c.lineTo(i * 1.6, -9); c.stroke(); }
    c.restore();
  }
  // back arm
  const armRest = 0.12 + (p.moving ? -sw * 0.35 : Math.sin(p.t * 2) * 0.03);
  let backA = armRest + 0.1;
  if (L.zombieArms) backA = 1.35 + Math.sin(p.t * 3) * 0.1;
  if (p.cast >= 0) backA = 1.2 + ease(p.cast * 2) * 0.6;
  if (L.weapon === 'bow') backA = 1.45;
  const bsx = shX - 2 * b, bsy = shY + 2;
  const [bex, bey] = limb(c, bsx, bsy, backA, armL * 0.52, armW, dark(L.bones ? L.skin : L.body2 ?? L.body));
  const [bhx, bhy] = limb(c, bex, bey, backA + (L.weapon === 'bow' ? 0.2 : 0.35), armL * 0.5, armW * 0.9, dark(L.skin));
  if (L.offhand === 'shield') drawShield(c, bhx + 3, bhy - 3 - (p.block ?? 0) * 6, L.offTier ?? 0, L.offColor);
  if (L.offhand === 'orb') { c.save(); c.shadowColor = L.offColor ?? '#80c0ff'; c.shadowBlur = 10; c.fillStyle = L.offColor ?? '#80c0ff'; c.beginPath(); c.arc(bhx + 3, bhy - 5 + Math.sin(p.t * 3) * 1.5, 3, 0, TAU); c.fill(); c.restore(); }
  if (p.cast >= 0 && L.weapon !== 'staff' && L.weapon !== 'crozier') { c.save(); c.shadowColor = L.glow ?? '#80a0ff'; c.shadowBlur = 12; c.fillStyle = L.glow ?? '#c0d0ff'; c.beginPath(); c.arc(bhx, bhy, 2.5 + p.cast * 2, 0, TAU); c.fill(); c.restore(); }
  // legs
  const legCol = L.bones ? L.skin : L.legs;
  const digit = !!L.digitigrade;
  const drawLeg = (s: number, col: string) => {
    const a = s * 0.5;
    const lift = p.moving ? Math.max(0, -s) * 0.7 : 0;
    const [kx, ky] = limb(c, 0, hipY, a, legL * 0.5, legW, col);
    const [fx, fy] = limb(c, kx, ky, digit ? a + 0.6 - lift : a * 0.3 - lift, legL * 0.52, legW * 0.85, col);
    c.fillStyle = L.bones ? L.skin : L.boots ?? shade(col, -0.35);
    c.beginPath(); c.ellipse(fx + 2, fy, legW * 0.95, legW * 0.5, 0, 0, TAU); c.fill();
  };
  if (!L.robe) drawLeg(-sw, dark(legCol));
  if (!L.robe) drawLeg(sw, legCol);
  // torso
  if (L.bones) {
    c.strokeStyle = L.skin; c.lineWidth = 2.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, hipY); c.lineTo(shX, shY); c.stroke();
    for (let i = 0; i < 4; i++) { const yy = shY + 3 + i * 3; const xx = shX * (1 - (i + 1) / 5); c.beginPath(); c.moveTo(xx - 5, yy + 1); c.quadraticCurveTo(xx, yy - 1.5, xx + 5, yy + 1); c.stroke(); }
    c.beginPath(); c.ellipse(0, hipY, 4, 2, 0, 0, TAU); c.stroke();
    if (L.robe) { c.fillStyle = L.robe; c.beginPath(); c.moveTo(shX - 6, shY + 1); c.lineTo(shX + 6, shY + 1); c.lineTo(9 + (p.moving ? sw * 2 : 0), -1); c.lineTo(-9, -1); c.closePath(); c.fill(); }
  } else {
    const ww = 6.2 * b, sw2 = 7.4 * b;
    if (L.robe) {
      c.fillStyle = L.robe;
      c.beginPath(); c.moveTo(shX - sw2, shY + 1); c.lineTo(shX + sw2 * 0.9, shY + 1);
      c.quadraticCurveTo(8 * b, hipY, 10 * b + (p.moving ? sw * 2.5 : 0), -1);
      c.lineTo(-10 * b + (p.moving ? sw * 1.5 : 0), -1); c.quadraticCurveTo(-8 * b, hipY, shX - sw2, shY + 1); c.fill();
      c.fillStyle = shade(L.robe, -0.25); c.fillRect(-10 * b, -3, 20 * b, 2);
      if (L.trim) { c.fillStyle = L.trim; c.fillRect(-1, shY + 2, 2.5, -shY - 3); }
    }
    c.fillStyle = L.body;
    c.beginPath(); c.moveTo(-ww, hipY + 2); c.lineTo(ww, hipY + 2); c.lineTo(shX + sw2, shY + 2); c.quadraticCurveTo(shX, shY - 3, shX - sw2, shY + 2); c.closePath(); c.fill();
    if (L.body2) { c.fillStyle = L.body2; c.fillRect(-ww, hipY - 1, ww * 2, 3.2); }
    if (L.trim && !L.robe) { c.strokeStyle = L.trim; c.lineWidth = 1; c.beginPath(); c.moveTo(shX - sw2 + 1, shY + 2.5); c.quadraticCurveTo(shX, shY - 1.5, shX + sw2 - 1, shY + 2.5); c.stroke(); }
    if (L.apron) { c.fillStyle = L.apron; c.beginPath(); c.moveTo(shX - 2, shY + 5); c.lineTo(shX + ww, shY + 5); c.lineTo(ww + 3, -3); c.lineTo(-2, -3); c.fill(); }
    // shading
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.moveTo(-ww, hipY + 2); c.lineTo(-ww * 0.2, hipY + 2); c.lineTo(shX - sw2 * 0.3, shY + 2); c.lineTo(shX - sw2, shY + 2); c.fill();
    if (L.glow) { c.save(); c.shadowColor = L.glow; c.shadowBlur = 10; c.fillStyle = L.glow; c.globalAlpha = 0.8; c.beginPath(); c.arc(shX + 1, shY + 7, 2.2, 0, TAU); c.fill(); c.restore(); }
  }
  // head
  const hx = shX + 1.5 + hunch * 5, hy = shY - headR + 0.5 + hunch * 3;
  drawHead(c, L, hx, hy, headR, p);
  // front arm + weapon
  let a = armRest;
  if (L.zombieArms) a = 1.4 + Math.sin(p.t * 3 + 1) * 0.1;
  const wk = L.weapon ?? 'none';
  if (wk === 'staff' || wk === 'crozier') a = 0.55;
  if (wk === 'bow') a = 1.55;
  if (p.atk >= 0) {
    if (wk === 'bow') a = 1.55;
    else if (wk === 'staff' || wk === 'crozier' || wk === 'wand') a = 0.5 + Math.sin(ease(p.atk) * Math.PI) * 1.2;
    else {
      const e = p.atk < 0.45 ? ease(p.atk / 0.45) : 1;
      const f = p.atk >= 0.45 ? ease((p.atk - 0.45) / 0.25) : 0;
      a = armRest + e * 2.6 - f * 2.9;
    }
  }
  if (p.cast >= 0 && wk !== 'bow') a = 1.3 + ease(p.cast * 2) * 0.8;
  const fsx = shX + 2, fsy = shY + 2.2;
  const [ex, ey] = limb(c, fsx, fsy, a, armL * 0.52, armW, L.bones ? L.skin : L.body2 ?? L.body);
  const fa = a + (wk === 'bow' ? 0.05 : 0.3);
  const [hx2, hy2] = limb(c, ex, ey, fa, armL * 0.5, armW * 0.9, L.skin);
  if (wk === 'bow') drawBow(c, hx2 + 1, hy2, p.atk >= 0 ? Math.sin(Math.min(1, p.atk * 1.8) * Math.PI / 2) * (p.atk < 0.55 ? 1 : 0) : 0.15, L.wTier ?? 0);
  else if (wk === 'staff' || wk === 'crozier') drawWeapon(c, wk, hx2, hy2, 0, L.wTier ?? 0, L.wColor, L.wGlow);
  else if (wk !== 'none') drawWeapon(c, wk, hx2, hy2, fa + 0.35, L.wTier ?? 0, L.wColor, L.wGlow);
  if (wk === 'none' && L.zombieArms) { c.fillStyle = L.skin; c.beginPath(); c.arc(hx2, hy2, 2, 0, TAU); c.fill(); }
}

// ------------------------------------------------------------------ creatures
function drawBat(c: CanvasRenderingContext2D, L: Look, p: Pose): void {
  const y = -24 + Math.sin(p.t * 5) * 3;
  const f = Math.sin(p.t * 22) * 0.9;
  c.fillStyle = L.body;
  for (const s of [-1, 1]) {
    c.beginPath(); c.moveTo(0, y);
    c.quadraticCurveTo(s * 10, y - 10 * f - 4, s * 17, y - 4 * f);
    c.lineTo(s * 13, y + 2); c.lineTo(s * 9, y - 1); c.lineTo(s * 6, y + 3); c.closePath(); c.fill();
  }
  c.fillStyle = shade(L.body, -0.2); c.beginPath(); c.ellipse(0, y + 1, 3.5, 4.5, 0, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(-2.5, y - 3); c.lineTo(-2, y - 7); c.lineTo(-0.5, y - 3.5); c.moveTo(2.5, y - 3); c.lineTo(2, y - 7); c.lineTo(0.5, y - 3.5); c.fill();
  eyesAt(c, -1.2, y - 1, L.eyes ?? '#ff3030', 0.7, 2.4);
}

function drawSpider(c: CanvasRenderingContext2D, L: Look, p: Pose): void {
  const ph = p.walk * 9;
  c.strokeStyle = shade(L.body, -0.2); c.lineWidth = 1.5; c.lineCap = 'round';
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    const w = p.moving ? Math.sin(ph + i * 1.3 + (s > 0 ? Math.PI : 0)) * 2 : 0;
    const bx = 2 - i * 2.2, by = -6;
    c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + s * 5 + w, by - 5 * s * 0.3 - 5); c.lineTo(bx + s * 10 + w * 1.5, 0 + (s < 0 ? -1 : 1)); c.stroke();
  }
  c.fillStyle = L.body; c.beginPath(); c.ellipse(-6, -8, 7, 6, 0.2, 0, TAU); c.fill();
  c.fillStyle = L.body2 ?? '#8a2a2a'; c.beginPath(); c.moveTo(-8, -11); c.lineTo(-5, -8); c.lineTo(-8, -5); c.lineTo(-11, -8); c.fill();
  c.fillStyle = shade(L.body, 0.1); c.beginPath(); c.ellipse(3, -7, 4, 3.5, 0, 0, TAU); c.fill();
  eyesAt(c, 4.5, -8, L.eyes ?? '#ff4040', 0.6, 1.6);
}

function drawQuad(c: CanvasRenderingContext2D, L: Look, p: Pose, kind: 'hound' | 'lizard'): void {
  const ph = p.walk * 6;
  const low = kind === 'lizard';
  const bodyY = low ? -7 : -14;
  const len = low ? 16 : 14;
  // tail
  c.strokeStyle = L.body; c.lineWidth = low ? 4 : 2.5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-len * 0.6, bodyY); c.quadraticCurveTo(-len * 1.2, bodyY + (low ? 3 : -8) + Math.sin(p.t * 4) * 2, -len * (low ? 1.7 : 1.1), bodyY + (low ? 5 : -12)); c.stroke();
  // legs
  const leg = (x: number, s: number, col: string) => {
    const a = p.moving ? Math.sin(ph + s) * 0.6 : 0;
    c.strokeStyle = col; c.lineWidth = low ? 3 : 3.2;
    const kx = x + Math.sin(a) * 5, ky = bodyY + (low ? 3 : 6);
    c.beginPath(); c.moveTo(x, bodyY); c.lineTo(kx, ky); c.lineTo(kx + (low ? 3 : 1), 0); c.stroke();
  };
  leg(len * 0.4, Math.PI, shade(L.body, -0.3)); leg(-len * 0.4, 0, shade(L.body, -0.3));
  // body
  const atkLunge = p.atk >= 0 ? Math.sin(p.atk * Math.PI) * 4 : 0;
  c.fillStyle = L.body; c.beginPath(); c.ellipse(atkLunge * 0.3, bodyY, len * 0.75, low ? 4.5 : 6, 0, 0, TAU); c.fill();
  if (L.body2) { c.fillStyle = L.body2; for (let i = 0; i < (low ? 5 : 4); i++) { c.beginPath(); c.arc(-len * 0.5 + i * 4, bodyY - (low ? 2 : 4), low ? 1.2 : 1.6, 0, TAU); c.fill(); } }
  if (kind === 'hound') { c.save(); c.shadowColor = '#ff5010'; c.shadowBlur = 8; c.fillStyle = '#ff6a20'; for (let i = 0; i < 4; i++) { const fx = -8 + i * 4, fl = 3 + Math.sin(p.t * 12 + i) * 1.5; c.beginPath(); c.moveTo(fx - 1.5, bodyY - 5); c.lineTo(fx, bodyY - 5 - fl); c.lineTo(fx + 1.5, bodyY - 5); c.fill(); } c.restore(); }
  leg(len * 0.4 + 2, 0, L.body); leg(-len * 0.4 + 2, Math.PI, L.body);
  // head
  const hx = len * 0.75 + atkLunge, hy = bodyY - (low ? 1 : 3);
  c.fillStyle = L.body; c.beginPath(); c.ellipse(hx, hy, low ? 5 : 5, low ? 3.2 : 4, 0.1, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(hx + 2, hy - 2); c.lineTo(hx + (low ? 9 : 8), hy + 1); c.lineTo(hx + 2, hy + 3); c.fill();
  if (kind === 'hound') { c.beginPath(); c.moveTo(hx - 2, hy - 3); c.lineTo(hx - 4, hy - 8); c.lineTo(hx, hy - 4); c.fill(); }
  eyesAt(c, hx + 1.5, hy - 1, L.eyes ?? '#ffd020', 0.7, 0);
  if (p.atk >= 0 && p.atk < 0.7) { c.fillStyle = '#300808'; c.beginPath(); c.moveTo(hx + 3, hy + 1); c.lineTo(hx + 9, hy + 1 + p.atk * 4); c.lineTo(hx + 3, hy + 3); c.fill(); }
}

function drawWraith(c: CanvasRenderingContext2D, L: Look, p: Pose): void {
  const y = -10 + Math.sin(p.t * 2.2) * 2.5;
  const g = c.createLinearGradient(0, y - 30, 0, y + 10);
  g.addColorStop(0, L.body); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(-7, y - 22);
  c.quadraticCurveTo(-11, y - 5, -6 + Math.sin(p.t * 4) * 3, y + 8);
  c.quadraticCurveTo(0, y + 2, 6 + Math.sin(p.t * 4 + 1) * 3, y + 9);
  c.quadraticCurveTo(10, y - 5, 7, y - 22); c.closePath(); c.fill();
  // hood
  c.fillStyle = shade(L.body, -0.2); c.beginPath(); c.ellipse(1, y - 26, 6.5, 7.5, 0, 0, TAU); c.fill();
  c.fillStyle = '#05070c'; c.beginPath(); c.ellipse(2.5, y - 25, 4, 5, 0, 0, TAU); c.fill();
  eyesAt(c, 1, y - 26, L.eyes ?? '#a0e0ff', 0.9, 3);
  // claws reaching
  const reach = p.atk >= 0 ? Math.sin(p.atk * Math.PI) * 8 : 0;
  c.strokeStyle = shade(L.body, 0.2); c.lineWidth = 2; c.lineCap = 'round';
  c.beginPath(); c.moveTo(5, y - 17); c.quadraticCurveTo(12 + reach, y - 14, 14 + reach, y - 8); c.stroke();
  c.lineWidth = 0.8; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(14 + reach, y - 8); c.lineTo(17 + reach, y - 6 + i * 2); c.stroke(); }
}

function drawFlame(c: CanvasRenderingContext2D, L: Look, p: Pose, big = 1): void {
  const y = -18 * big + Math.sin(p.t * 3) * 2;
  c.save();
  c.shadowColor = L.body; c.shadowBlur = 14;
  for (let i = 0; i < 3; i++) {
    const s = (1 - i * 0.28) * big;
    c.fillStyle = i === 0 ? L.body : i === 1 ? L.body2 ?? '#ffd040' : '#fff8d0';
    c.beginPath(); c.moveTo(-8 * s, y + 6 * s);
    for (let k = 0; k <= 6; k++) { const a = k / 6; c.lineTo(-8 * s + 16 * s * a + Math.sin(p.t * 9 + k * 2) * 1.5, y - (8 + Math.sin(a * Math.PI) * 10 + Math.sin(p.t * 12 + k) * 3) * s); }
    c.lineTo(8 * s, y + 6 * s); c.quadraticCurveTo(0, y + 12 * s, -8 * s, y + 6 * s); c.fill();
  }
  c.restore();
  c.fillStyle = '#3a0a00'; c.beginPath(); c.arc(-2 * big, y - 2 * big, 1.3 * big, 0, TAU); c.arc(3 * big, y - 2 * big, 1.3 * big, 0, TAU); c.fill();
}

function drawEye(c: CanvasRenderingContext2D, L: Look, p: Pose): void {
  const y = -26 + Math.sin(p.t * 1.8) * 3;
  c.strokeStyle = L.body; c.lineWidth = 2; c.lineCap = 'round';
  for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.3; c.beginPath(); c.moveTo(Math.sin(a) * 6, y + 6); c.quadraticCurveTo(Math.sin(a) * 10 + Math.sin(p.t * 3 + i) * 3, y + 14, Math.sin(a) * 8 + Math.sin(p.t * 2 + i) * 4, y + 22); c.stroke(); }
  c.fillStyle = L.body; c.beginPath(); c.arc(0, y, 10, 0, TAU); c.fill();
  c.fillStyle = '#e8e0d0'; c.beginPath(); c.arc(2, y, 7.5, 0, TAU); c.fill();
  c.strokeStyle = '#a02020'; c.lineWidth = 0.5; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-4, y - 4 + i * 2); c.quadraticCurveTo(-1, y - 3 + i * 2, 1, y - 1 + i); c.stroke(); }
  c.save(); c.shadowColor = L.eyes ?? '#ffff60'; c.shadowBlur = 8; c.fillStyle = L.eyes ?? '#e0e060'; c.beginPath(); c.arc(4, y, 3.6, 0, TAU); c.fill(); c.restore();
  c.fillStyle = '#000'; c.beginPath(); c.ellipse(4.6, y, 1, 2.8, 0, 0, TAU); c.fill();
  c.fillStyle = shade(L.body, -0.2); c.beginPath(); c.arc(0, y, 10, Math.PI * 1.15, Math.PI * 1.85); c.fill();
}

function drawBeast(c: CanvasRenderingContext2D, L: Look, p: Pose): void {
  // soul eater: hulking hunched beast walking on knuckles
  const ph = p.walk * 3.5;
  const sw = p.moving ? Math.sin(ph) : 0;
  const lunge = p.atk >= 0 ? Math.sin(p.atk * Math.PI) * 5 : 0;
  c.strokeStyle = shade(L.body, -0.3); c.lineWidth = 6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-6, -16); c.lineTo(-8 - sw * 4, -7); c.lineTo(-7 - sw * 4, 0); c.stroke();
  c.beginPath(); c.moveTo(8, -24); c.lineTo(15 + sw * 4 + lunge, -10); c.lineTo(15 + sw * 4 + lunge, 0); c.stroke();
  c.fillStyle = L.body; c.beginPath(); c.ellipse(1 + lunge * 0.3, -22, 15, 11, -0.3, 0, TAU); c.fill();
  c.fillStyle = shade(L.body, 0.15); for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-8 + i * 4, -30 + i); c.lineTo(-6 + i * 4, -39 + i * 1.5); c.lineTo(-4 + i * 4, -29 + i); c.fill(); }
  c.strokeStyle = L.body; c.lineWidth = 6;
  c.beginPath(); c.moveTo(-4, -16); c.lineTo(-3 + sw * 4, -7); c.lineTo(-2 + sw * 4, 0); c.stroke();
  c.beginPath(); c.moveTo(10, -22); c.lineTo(18 - sw * 4 + lunge, -10); c.lineTo(19 - sw * 4 + lunge, 0); c.stroke();
  // head with glowing maw
  const hx = 15 + lunge, hy = -24;
  c.fillStyle = L.body; c.beginPath(); c.ellipse(hx, hy, 7, 6, 0, 0, TAU); c.fill();
  c.save(); c.shadowColor = L.body2 ?? '#60f0a0'; c.shadowBlur = 10; c.fillStyle = L.body2 ?? '#60f0a0';
  c.beginPath(); c.ellipse(hx + 4, hy + 2.5, 3.5, 1.5 + (p.atk >= 0 ? 2 : Math.sin(p.t * 3) * 0.5 + 0.5), 0, 0, TAU); c.fill(); c.restore();
  eyesAt(c, hx + 1, hy - 3, L.eyes ?? '#60f0a0', 0.9, 3.5);
}

// ------------------------------------------------------------------ public
export function drawCreature(c: CanvasRenderingContext2D, art: string, L: Look, p: Pose): void {
  switch (art) {
    case 'bat': drawBat(c, L, p); break;
    case 'spider': drawSpider(c, L, p); break;
    case 'hound': drawQuad(c, L, p, 'hound'); break;
    case 'lizard': drawQuad(c, L, p, 'lizard'); break;
    case 'wraith': drawWraith(c, L, p); break;
    case 'fireSpirit': drawFlame(c, L, p); break;
    case 'eye': drawEye(c, L, p); break;
    case 'soulEater': drawBeast(c, L, p); break;
    case 'ignira': {
      drawFlame(c, { ...L, body: '#ff5010', body2: '#ffb030' }, { ...p, t: p.t * 0.8 }, 1.4);
      drawBiped(c, { ...L, robe: undefined }, { ...p, moving: false });
      break;
    }
    default: drawBiped(c, L, p);
  }
}

export const FLYING_ARTS = new Set(['bat', 'wraith', 'fireSpirit', 'eye', 'witch', 'ignira']);

/** Monster art presets. */
export function monsterLook(art: string, color: string, color2: string): Look {
  switch (art) {
    case 'zombie': return { skin: '#8a9670', body: '#4a3e30', body2: '#3a3024', legs: '#3a3228', head: 'zombie', hair: '#2a2a1a', hunch: 0.35, zombieArms: true, weapon: 'none', eyes: '#c0e060' };
    case 'skeleton': return { skin: color, body: color, legs: color, head: 'skull', bones: true, weapon: 'sword', wTier: 0, wColor: '#8a8070', offhand: 'shield', offTier: 0, offColor: '#5a4a30', eyes: '#ff5020' };
    case 'skelArcher': return { skin: color, body: color, legs: color, head: 'skull', bones: true, weapon: 'bow', wTier: 1, eyes: '#ff5020' };
    case 'skelMage': return { skin: color, body: color, legs: color, head: 'hood', robe: '#28306a', bones: true, weapon: 'staff', wTier: 2, wGlow: '#60a0ff', eyes: '#80c0ff', glow: '#6080ff' };
    case 'fallen': return { skin: color, body: color, body2: '#4a2a14', legs: shade(color, -0.2), head: 'imp', build: 0.8, height: 0.72, hunch: 0.25, weapon: 'spear', wTier: 0, eyes: '#ffe040' };
    case 'shaman': return { skin: color, body: '#4a2a14', legs: shade(color, -0.2), head: 'imp', build: 0.8, height: 0.78, hunch: 0.3, weapon: 'staff', wTier: 3, wGlow: '#ff8020', feathers: true, eyes: '#ffe040', glow: '#ff8020' };
    case 'ghoul': return { skin: color, body: '#5a5a4a', legs: '#4a4a3a', head: 'ghoul', hunch: 0.4, build: 0.95, weapon: 'claws', eyes: '#e0e0a0' };
    case 'brute': return { skin: color, body: color, body2: '#5a2a20', legs: '#6a5a4a', head: 'zombie', build: 1.6, height: 1.05, hunch: 0.25, weapon: 'cleaver', wTier: 1, apron: 'rgba(90,30,24,0.8)' };
    case 'goatman': return { skin: color, body: color2, body2: '#6a4a2a', legs: color, head: 'goat', digitigrade: true, weapon: 'axe', wTier: 1, horns: '#d0c0a0', eyes: '#ff3010', tail: color };
    case 'goatArcher': return { skin: color, body: color2, legs: color, head: 'goat', digitigrade: true, weapon: 'bow', wTier: 2, horns: '#d0c0a0', eyes: '#ff3010' };
    case 'troll': return { skin: color, body: color, body2: '#3a2a1a', legs: color2, head: 'ghoul', build: 1.5, height: 1.05, hunch: 0.45, weapon: 'club', eyes: '#ffe060' };
    case 'knight': return { skin: '#4a2020', body: '#2a2226', body2: '#1a1418', legs: '#2a2226', head: 'human', helm: 4, helmColor: '#2a1c1c', build: 1.2, weapon: 'sword2h', wTier: 4, wGlow: '#ff2010', trim: '#c02020', offhand: null };
    case 'witch': return { skin: '#d8a0a8', body: color, legs: color, head: 'woman', hair: '#1a0a14', robe: color, weapon: 'none', glow: color2, eyes: '#ff3060' };
    case 'ordes': return { skin: '#e0d8c4', body: '#e0d8c4', legs: '#e0d8c4', head: 'skull', bones: true, robe: '#4a1a5a', mitre: true, weapon: 'crozier', eyes: '#c060ff', glow: '#b060ff', height: 1.1 };
    case 'gromak': return { skin: '#b08070', body: '#b08070', body2: '#5a2a1a', legs: '#5a4a3a', head: 'zombie', build: 1.9, height: 1.05, hunch: 0.2, weapon: 'cleaver', wTier: 2, apron: 'rgba(120,20,16,0.85)', eyes: '#ff3010' };
    case 'ignira': return { skin: '#ffb070', body: '#c03010', legs: '#c03010', head: 'woman', hair: '#ff6010', weapon: 'none', glow: '#ffd040', eyes: '#fff080' };
    case 'malegath': return { skin: '#8a1a14', body: '#6a1410', body2: '#2a0a08', legs: '#4a0e0a', head: 'demon', horns: '#1a0a06', wings: '#3a0a0a', build: 1.6, height: 1.2, hunch: 0.15, weapon: 'claws', eyes: '#ffd020', glow: '#ff6010', tail: '#5a1410', digitigrade: true };
    default: return { skin: color, body: color, legs: color2, head: 'human', eyes: color2 };
  }
}

export function npcLook(kind: string): Look {
  switch (kind) {
    case 'smith': return { skin: '#d0a080', body: '#6a4a30', body2: '#3a2a1a', legs: '#3a3028', head: 'human', hair: '#3a2a1a', beard: '#4a3220', build: 1.3, apron: '#4a3a2a', weapon: 'hammer', wTier: 1 };
    case 'healer': return { skin: '#e8c0a0', body: '#e8e0d0', legs: '#8a7a6a', head: 'woman', hair: '#8a4a20', robe: '#5a7a5a', trim: '#e8d8a0', weapon: 'none' };
    case 'elder': return { skin: '#d8b098', body: '#6a6258', legs: '#4a4238', head: 'old', hair: '#c8c8c8', beard: '#e0e0e0', robe: '#5a5248', weapon: 'staff', wTier: 0, wGlow: '#a0a0a0', hunch: 0.15 };
    case 'gambler': return { skin: '#c89878', body: '#4a2a5a', legs: '#2a1a2a', head: 'hood', robe: '#3a1a4a', trim: '#e0c050', weapon: 'none', eyes: '#ffd060' };
    default: return { skin: '#d0a080', body: '#666', legs: '#444', head: 'human' };
  }
}
