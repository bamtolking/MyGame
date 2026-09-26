// Procedural inventory icons (cached canvases) for every item category, plus skill icons.
import { BASE_BY_ID, RARITY_COLOR, type ItemCat } from '../data/items';
import type { Item } from '../sim/types';
import { drawWeapon } from './actors';
import { ITEM_KIND, OFFHAND_ART, SKILL_ICON, WEAPON_ART } from './registry';

const cache = new Map<string, HTMLCanvasElement>();
const SZ = 64;
/** Icons are painted in a 64-unit space at this resolution multiplier (crisp on high-DPI screens). */
const RES = 2;

function metal(tier: number): string { return ['#a8a8a0', '#c8ccd4', '#9aa0b0', '#6a6e7e', '#6a2a2e'][Math.max(0, Math.min(4, tier))]; }

function drawCat(c: CanvasRenderingContext2D, cat: ItemCat, tier: number, rarity: string): void {
  const m = metal(tier);
  const gem = rarity === 'unique' ? '#e0a040' : rarity === 'rare' ? '#f0e060' : rarity === 'magic' ? '#6070ff' : '#909090';
  c.save();
  switch (cat) {
    case 'sword': case 'sword2h': case 'axe': case 'axe2h': case 'mace':
      c.translate(32, 32); c.rotate(-Math.PI / 4 - Math.PI);
      c.translate(0, cat.endsWith('2h') ? -18 : -14);
      drawWeapon(c, cat as never, 0, 0, 0, tier, m, rarity === 'unique' ? '#e0b050' : undefined, cat.endsWith('2h') ? 1.25 : 1.35);
      break;
    case 'staff': c.translate(34, 34); c.rotate(-Math.PI / 4); drawWeapon(c, 'staff', 0, 6, 0, tier, undefined, undefined, 1.25); break;
    case 'wand': c.translate(22, 42); c.rotate(-Math.PI * 0.75); drawWeapon(c, 'wand', 0, 0, 0, tier, undefined, gem, 1.8); break;
    case 'bow': {
      c.translate(32, 32); c.rotate(-Math.PI / 4);
      c.strokeStyle = ['#8a5a30', '#6a4020', '#4a3020', '#3a2a3a', '#2a1a2a'][tier]; c.lineWidth = 3.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-3, -24); c.quadraticCurveTo(14, 0, -3, 24); c.stroke();
      c.strokeStyle = '#e8e0c8'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-3, -24); c.lineTo(-3, 24); c.stroke();
      break;
    }
    case 'shield': {
      c.translate(32, 32);
      c.fillStyle = ['#6a4a2a', '#7a2a22', '#5a6070', '#3a3e4a', '#4a1414'][tier]; c.strokeStyle = tier >= 2 ? '#d8b860' : '#b0b0b0'; c.lineWidth = 2.4;
      c.beginPath();
      if (tier === 0) c.arc(0, 0, 18, 0, 7);
      else { c.moveTo(-17, -20); c.lineTo(17, -20); c.lineTo(17, 4); c.quadraticCurveTo(0, 26, 0, 26); c.quadraticCurveTo(0, 26, -17, 4); c.closePath(); }
      c.fill(); c.stroke();
      c.fillStyle = gem; c.beginPath(); c.arc(0, -2, 4, 0, 7); c.fill();
      break;
    }
    case 'quiver': {
      c.translate(32, 34); c.rotate(-0.4);
      c.fillStyle = ['#7a5230', '#6a4020', '#5a2a2a'][Math.min(2, Math.floor(tier / 2))]; c.fillRect(-8, -16, 16, 34);
      c.strokeStyle = '#3a2410'; c.lineWidth = 2; c.strokeRect(-8, -16, 16, 34);
      c.strokeStyle = '#e8e0d0'; c.lineWidth = 1.5; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 4, -16); c.lineTo(i * 5, -28); c.stroke(); c.fillStyle = '#c04040'; c.fillRect(i * 5 - 2, -30, 4, 4); }
      break;
    }
    case 'orb': {
      const g = c.createRadialGradient(28, 26, 2, 32, 32, 18);
      const col = ['#80c0ff', '#a0a0ff', '#c080ff', '#ff80c0', '#ff6060'][tier];
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, col); g.addColorStop(1, '#101030');
      c.fillStyle = g; c.beginPath(); c.arc(32, 32, 17, 0, 7); c.fill();
      break;
    }
    case 'helm': {
      c.translate(32, 36);
      c.fillStyle = tier === 0 ? '#6a4a2a' : m;
      c.beginPath(); c.arc(0, 0, 18, Math.PI, 0); c.lineTo(18, 8); c.lineTo(-18, 8); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(-18, 2, 36, 4);
      if (tier >= 1) { c.fillStyle = '#1a1414'; c.fillRect(-12, -2, 24, 4); c.fillStyle = tier === 0 ? '#6a4a2a' : m; c.fillRect(-2, -4, 4, 14); }
      if (tier === 2 || tier >= 4) { c.strokeStyle = tier >= 4 ? '#2a1010' : '#e0d8c0'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-14, -10); c.quadraticCurveTo(-26, -18, -22, -30); c.moveTo(14, -10); c.quadraticCurveTo(26, -18, 22, -30); c.stroke(); }
      break;
    }
    case 'chest': {
      c.translate(32, 32);
      c.fillStyle = ['#6a4a2a', '#8a8f96', '#b0b4bc', '#4e525e', '#5a1a1a'][tier];
      c.beginPath(); c.moveTo(-20, -18); c.lineTo(-8, -22); c.quadraticCurveTo(0, -16, 8, -22); c.lineTo(20, -18); c.lineTo(22, -2); c.lineTo(15, -4); c.lineTo(15, 22); c.lineTo(-15, 22); c.lineTo(-15, -4); c.lineTo(-22, -2); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1.2; c.stroke();
      if (tier === 1) { c.strokeStyle = 'rgba(255,255,255,0.25)'; for (let y = -14; y < 20; y += 4) { c.beginPath(); c.moveTo(-14, y); c.lineTo(14, y); c.stroke(); } }
      if (tier >= 3) { c.strokeStyle = '#d8b050'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -16); c.lineTo(0, 20); c.stroke(); }
      break;
    }
    case 'gloves': {
      c.translate(32, 34);
      c.fillStyle = tier <= 0 ? '#7a5230' : m;
      c.beginPath(); c.moveTo(-12, 16); c.lineTo(-12, -4); c.lineTo(-10, -18); c.lineTo(-6, -18); c.lineTo(-5, -6); c.lineTo(-3, -22); c.lineTo(1, -22); c.lineTo(2, -7); c.lineTo(4, -20); c.lineTo(8, -20); c.lineTo(8, -4); c.lineTo(14, -8); c.lineTo(16, -4); c.lineTo(12, 6); c.lineTo(12, 16); c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(-12, 10, 24, 6);
      break;
    }
    case 'boots': {
      c.translate(32, 34);
      c.fillStyle = tier <= 0 ? '#6a4628' : m;
      c.beginPath(); c.moveTo(-10, -22); c.lineTo(6, -22); c.lineTo(6, 6); c.lineTo(20, 12); c.lineTo(20, 20); c.lineTo(-10, 20); c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-10, 16, 30, 4); c.fillRect(-10, -22, 16, 4);
      break;
    }
    case 'belt': {
      c.translate(32, 32);
      c.fillStyle = tier <= 1 ? '#6a4628' : m; c.fillRect(-24, -6, 48, 12);
      c.strokeStyle = '#d8c070'; c.lineWidth = 2.5; c.strokeRect(-6, -8, 12, 16);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(-24, 3, 48, 3);
      break;
    }
    case 'ring': {
      c.translate(32, 34);
      c.strokeStyle = rarity === 'unique' ? '#e0b050' : '#c8c8c0'; c.lineWidth = 5;
      c.beginPath(); c.ellipse(0, 4, 13, 11, 0, 0, 7); c.stroke();
      c.fillStyle = gem; c.beginPath(); c.moveTo(0, -16); c.lineTo(7, -8); c.lineTo(0, -1); c.lineTo(-7, -8); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(-2, -12, 3, 3);
      break;
    }
    case 'spear': case 'claw': case 'knuckle': case 'scythe': {
      const kind = ITEM_KIND[cat] ?? cat;
      const art = WEAPON_ART[kind];
      c.translate(32, 32);
      if (art?.icon) art.icon(c, tier, gem);
      else { c.rotate(-Math.PI / 4 - Math.PI); c.translate(0, -16); drawWeapon(c, kind, 0, 0, 0, tier, m, rarity === 'unique' ? '#e0b050' : undefined, 1.25); }
      break;
    }
    case 'pouch': case 'skull': case 'totem': {
      const art = OFFHAND_ART[ITEM_KIND[cat] ?? cat];
      c.translate(32, 32);
      if (art) art.icon(c, tier, gem);
      else { c.fillStyle = '#6a5040'; c.beginPath(); c.arc(0, 0, 16, 0, 7); c.fill(); c.fillStyle = gem; c.beginPath(); c.arc(0, 0, 5, 0, 7); c.fill(); }
      break;
    }
    case 'amulet': {
      c.translate(32, 30);
      c.strokeStyle = '#c8b070'; c.lineWidth = 2; c.beginPath(); c.moveTo(-16, -22); c.quadraticCurveTo(0, 6, 16, -22); c.stroke();
      c.fillStyle = '#c8a040'; c.beginPath(); c.arc(0, 8, 11, 0, 7); c.fill();
      c.fillStyle = gem; c.beginPath(); c.arc(0, 8, 6.5, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(-2, 6, 2, 0, 7); c.fill();
      break;
    }
  }
  c.restore();
}

export function itemIcon(it: Item): HTMLCanvasElement {
  const b = BASE_BY_ID[it.base];
  const key = `${it.base}|${it.rarity}`;
  let cv = cache.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = SZ * RES; cv.height = SZ * RES;
  const c = cv.getContext('2d')!;
  c.scale(RES, RES);
  drawCat(c, b.cat, b.tier, it.rarity);
  cache.set(key, cv);
  return cv;
}

const urlCache = new Map<string, string>();
export function itemIconUrl(it: Item): string {
  const key = `${it.base}|${it.rarity}`;
  let u = urlCache.get(key);
  if (!u) { u = itemIcon(it).toDataURL(); urlCache.set(key, u); }
  return u;
}

export function rarityBorder(it: Item): string { return RARITY_COLOR[it.rarity]; }

// ---------------------------------------------------------------- skill icons
const skillCache = new Map<string, string>();
export function skillIconUrl(icon: string): string {
  let u = skillCache.get(icon);
  if (u) return u;
  const cv = document.createElement('canvas'); cv.width = 64 * RES; cv.height = 64 * RES;
  const c = cv.getContext('2d')!;
  c.scale(RES, RES);
  const bg = c.createRadialGradient(32, 32, 4, 32, 32, 44);
  const tint: Record<string, [string, string]> = {
    sword: ['#5a4a3a', '#1a120c'], bash: ['#8a5a2a', '#1a0e06'], cleave: ['#6a6a7a', '#141418'], warcry: ['#a07a20', '#201404'], leap: ['#7a5a3a', '#180e06'], berserk: ['#a02010', '#200404'],
    arrow: ['#4a5a3a', '#101408'], multishot: ['#5a7a3a', '#0e1606'], explode: ['#a05a20', '#200c02'], rain: ['#6a6a5a', '#141410'], dash: ['#2a3a4a', '#06080e'], strafe: ['#7a7a30', '#161606'],
    bolt: ['#5a3a8a', '#0e0618'], fireball: ['#c05010', '#200600'], frostnova: ['#3a7ab0', '#061020'], chain: ['#b0a020', '#181600'], teleport: ['#5a4ab0', '#0a0620'], meteor: ['#b03010', '#200400'],
  };
  const custom = SKILL_ICON[icon];
  const [a, bcol] = custom?.tint ?? tint[icon] ?? ['#444', '#111'];
  bg.addColorStop(0, a); bg.addColorStop(1, bcol);
  c.fillStyle = bg; c.fillRect(0, 0, 64, 64);
  c.translate(32, 32);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const glow = (col: string, blur = 10) => { c.shadowColor = col; c.shadowBlur = blur * RES; }; // shadowBlur ignores the transform
  switch (icon) {
    case 'sword': c.rotate(Math.PI * 0.75); drawWeapon(c, 'sword', 0, -14, 0, 1, '#d0d0d0', undefined, 1.3); break;
    case 'bash': glow('#ffd080'); c.rotate(Math.PI * 0.6); drawWeapon(c, 'mace', 0, -12, 0, 2, '#e0e0e0', undefined, 1.3); c.rotate(-Math.PI * 0.6); c.strokeStyle = '#ffe0a0'; c.lineWidth = 2.5; for (let i = 0; i < 5; i++) { const an = -Math.PI / 2 + (i - 2) * 0.5; c.beginPath(); c.moveTo(Math.cos(an) * 16, Math.sin(an) * 16 + 12); c.lineTo(Math.cos(an) * 24, Math.sin(an) * 24 + 12); c.stroke(); } break;
    case 'cleave': c.strokeStyle = '#e8e8ff'; c.lineWidth = 5; glow('#a0a0ff'); c.beginPath(); c.arc(0, 0, 20, 0.3, Math.PI * 1.8); c.stroke(); c.fillStyle = '#e8e8ff'; c.beginPath(); c.moveTo(20, -8); c.lineTo(26, 2); c.lineTo(14, 0); c.fill(); break;
    case 'warcry': glow('#ffc040', 14); c.fillStyle = '#ffd060'; c.beginPath(); c.moveTo(-14, -8); c.lineTo(-2, -8); c.lineTo(10, -18); c.lineTo(10, 18); c.lineTo(-2, 8); c.lineTo(-14, 8); c.closePath(); c.fill(); c.strokeStyle = '#ffd060'; c.lineWidth = 2.5; for (const r of [16, 22]) { c.beginPath(); c.arc(8, 0, r, -0.6, 0.6); c.stroke(); } break;
    case 'leap': c.strokeStyle = '#e0c090'; c.lineWidth = 3; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(-22, 16); c.quadraticCurveTo(0, -30, 20, 12); c.stroke(); c.setLineDash([]); glow('#ffa040'); c.fillStyle = '#ffb060'; c.beginPath(); c.ellipse(18, 16, 12, 5, 0, 0, 7); c.fill(); break;
    case 'berserk': glow('#ff2010', 16); c.fillStyle = '#ff4020'; c.beginPath(); c.moveTo(0, -24); c.quadraticCurveTo(18, -4, 10, 16); c.quadraticCurveTo(4, 6, 0, 22); c.quadraticCurveTo(-4, 6, -10, 16); c.quadraticCurveTo(-18, -4, 0, -24); c.fill(); c.fillStyle = '#ffd060'; c.beginPath(); c.arc(-5, 0, 2.5, 0, 7); c.arc(5, 0, 2.5, 0, 7); c.fill(); break;
    case 'arrow': c.rotate(-Math.PI / 4); c.strokeStyle = '#c8a070'; c.lineWidth = 3; c.beginPath(); c.moveTo(-22, 0); c.lineTo(16, 0); c.stroke(); c.fillStyle = '#e0e0e0'; c.beginPath(); c.moveTo(16, -6); c.lineTo(26, 0); c.lineTo(16, 6); c.fill(); c.fillStyle = '#e8e0d0'; c.beginPath(); c.moveTo(-22, 0); c.lineTo(-28, -6); c.lineTo(-16, 0); c.lineTo(-28, 6); c.fill(); break;
    case 'multishot': for (const an of [-0.45, 0, 0.45]) { c.save(); c.rotate(an - Math.PI / 4); c.strokeStyle = '#d0c090'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-18, 0); c.lineTo(16, 0); c.stroke(); c.fillStyle = '#e8e8e8'; c.beginPath(); c.moveTo(16, -4); c.lineTo(24, 0); c.lineTo(16, 4); c.fill(); c.restore(); } break;
    case 'explode': c.rotate(-Math.PI / 4); c.strokeStyle = '#c8a070'; c.lineWidth = 3; c.beginPath(); c.moveTo(-24, 0); c.lineTo(6, 0); c.stroke(); glow('#ff8020', 18); c.fillStyle = '#ffa030'; c.beginPath(); for (let i = 0; i < 12; i++) { const r = i % 2 ? 7 : 15; const an = (i / 12) * Math.PI * 2; c.lineTo(14 + Math.cos(an) * r, Math.sin(an) * r); } c.fill(); c.fillStyle = '#fff0a0'; c.beginPath(); c.arc(14, 0, 5, 0, 7); c.fill(); break;
    case 'rain': c.strokeStyle = '#e0d8c0'; c.lineWidth = 2; for (let i = 0; i < 7; i++) { const x = -20 + i * 7, y = -20 + (i % 3) * 8; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 4, y + 18); c.stroke(); } c.fillStyle = 'rgba(200,200,180,0.4)'; c.beginPath(); c.ellipse(0, 18, 22, 7, 0, 0, 7); c.fill(); break;
    case 'dash': glow('#60a0c0'); c.fillStyle = 'rgba(80,140,180,0.5)'; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(-14 + i * 10, 0, 6, 16, 0, 0, 7); c.fill(); } c.fillStyle = '#a0e0ff'; c.beginPath(); c.ellipse(16, 0, 7, 17, 0, 0, 7); c.fill(); break;
    case 'strafe': c.strokeStyle = '#e0d890'; c.lineWidth = 2; for (let i = 0; i < 8; i++) { const an = (i / 8) * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(an) * 6, Math.sin(an) * 6); c.lineTo(Math.cos(an) * 24, Math.sin(an) * 24); c.stroke(); } glow('#ffff80'); c.fillStyle = '#ffffa0'; c.beginPath(); c.arc(0, 0, 6, 0, 7); c.fill(); break;
    case 'bolt': glow('#b080ff', 16); c.fillStyle = '#d0b0ff'; c.beginPath(); c.arc(0, 0, 12, 0, 7); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(-3, -3, 4, 0, 7); c.fill(); break;
    case 'fireball': glow('#ff6010', 20); { const g = c.createRadialGradient(4, -4, 1, 0, 0, 20); g.addColorStop(0, '#fff8c0'); g.addColorStop(0.4, '#ffa030'); g.addColorStop(1, '#a02000'); c.fillStyle = g; c.beginPath(); c.arc(4, -4, 16, 0, 7); c.fill(); c.fillStyle = 'rgba(255,120,30,0.6)'; c.beginPath(); c.moveTo(-6, 6); c.lineTo(-26, 22); c.lineTo(-2, 14); c.fill(); } break;
    case 'frostnova': glow('#80c0ff', 12); c.strokeStyle = '#c0e8ff'; c.lineWidth = 2.5; for (let i = 0; i < 8; i++) { const an = (i / 8) * Math.PI * 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(an) * 24, Math.sin(an) * 24); c.stroke(); c.beginPath(); c.moveTo(Math.cos(an) * 14 + Math.cos(an + 1.2) * 5, Math.sin(an) * 14 + Math.sin(an + 1.2) * 5); c.lineTo(Math.cos(an) * 14, Math.sin(an) * 14); c.lineTo(Math.cos(an) * 14 + Math.cos(an - 1.2) * 5, Math.sin(an) * 14 + Math.sin(an - 1.2) * 5); c.stroke(); } break;
    case 'chain': glow('#ffff60', 14); c.strokeStyle = '#ffffa0'; c.lineWidth = 3; c.beginPath(); c.moveTo(-22, -18); c.lineTo(-6, -4); c.lineTo(-12, 2); c.lineTo(6, 14); c.lineTo(2, 20); c.lineTo(22, 22); c.stroke(); break;
    case 'teleport': glow('#8080ff', 14); c.strokeStyle = '#b0b0ff'; c.lineWidth = 2.5; for (const r of [8, 15, 22]) { c.beginPath(); c.ellipse(0, 0, r, r * 0.45, 0, 0, 7); c.stroke(); } c.fillStyle = '#e0e0ff'; c.fillRect(-2, -24, 4, 24); break;
    default: custom?.draw(c, glow); break;
    case 'meteor': glow('#ff4010', 18); c.fillStyle = 'rgba(255,120,30,0.6)'; c.beginPath(); c.moveTo(12, -12); c.lineTo(-24, -28); c.lineTo(4, -2); c.fill(); { const g = c.createRadialGradient(10, 6, 1, 10, 6, 14); g.addColorStop(0, '#fff0b0'); g.addColorStop(0.5, '#ff7020'); g.addColorStop(1, '#801000'); c.fillStyle = g; c.beginPath(); c.arc(10, 6, 13, 0, 7); c.fill(); } break;
  }
  u = cv.toDataURL();
  skillCache.set(icon, u);
  return u;
}
