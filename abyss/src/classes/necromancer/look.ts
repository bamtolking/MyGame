// necromancer: hero look — a pale grave-priest in a layered dark robe that gathers bone as the chest tier rises
// (bead necklace → rib-cage cuirass → skull pauldrons → a mantle of rib spikes and bone tassets → a black lich
// robe with glowing runes), a deep hood whose headgear follows the helm tier (bone beads → finger-bone circlet →
// ram horns → beast-skull mask → lich crown), a bone wand or a reaper's scythe in the front hand and a glowing
// skull in the other. Also the per-skill pose remap and the scythe / skull item art (WEAPON_ART / OFFHAND_ART).
import { BASE_BY_ID } from '../../data/items';
import type { EquipSlot, Hero } from '../../sim/types';
import type { Look, Pose } from '../../render/actors';
import { shade } from '../../render/iso';
import { CLASS_LOOK, DECOR, ITEM_KIND, OFFHAND_ART, WEAPON_ART, type RigAnchors } from '../../render/registry';

type C2D = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

// ------------------------------------------------------------------ palette
export const BONE = '#e3d9c1', BONE_HI = '#fbf6e6', BONE_MID = '#c4b898', BONE_DK = '#7c7159', BONE_LINE = '#3a3226';
/** Spectral green of necromantic magic (rgb triple for rgba()). */
export const SOUL = '#8effc2', SOUL_RGB = '142,255,194';
const SKIN = '#d3cebf', SKIN_DK = '#948f84';
/** Robe / torso / hood colours by chest tier (-1 none … 4 lich robe). */
const ROBE = ['#4d5249', '#435047', '#3c4a42', '#35443d', '#303c3f', '#342a47'];
const TORSO = ['#57584d', '#4b554b', '#445047', '#3c4840', '#363f44', '#3b2f4f'];
const HOOD = ['#565c52', '#4a574e', '#435248', '#3b4a42', '#374249', '#3d3052'];
const SLEEVE = ['#5c6257', '#515f54', '#4a584e', '#435147', '#3c484c', '#433659'];
const BACK_SLEEVE = ['#3a3f36', '#323d35', '#2d3830', '#28332d', '#242d31', '#2a2138'];
const TRIM = ['#6a6858', '#7a7054', '#86806a', '#6e9a78', '#5fae80', '#72e0a0'];

/** Necromancer state carried on the Look (the rig ignores unknown fields). */
interface NcState {
  /** Active skill ('' idle, skill id without the nc_ prefix) and its progress 0..1. */
  act: string; k: number;
  /** Chest, helm, glove and boot tiers (-1 = none). */
  ct: number; ht: number; gt: number; bt: number;
  /** Weapon family in the front hand, its tier and rarity glow. */
  wk: 'wand' | 'scythe' | 'none' | 'other'; wt: number; wg?: string;
  /** Skull tier in the back hand (-1 = none). */
  ot: number;
  armor: boolean;
}
export type NcLook = Look & { nc?: NcState };

function slotTier(h: Hero, s: EquipSlot): number {
  const it = h.equip[s];
  return it && it.req <= h.level ? BASE_BY_ID[it.base]?.tier ?? -1 : -1;
}

ITEM_KIND.scythe = 'scythe';
ITEM_KIND.skull = 'skull';

// The rig animates the arms from these invisible weapon kinds; the wand / scythe itself is painted by the decor.
const nothing = (): void => { /* drawn by the decor */ };
WEAPON_ART.nc_grip = { style: 'thrust', draw: nothing };
WEAPON_ART.nc_gripHeavy = { style: 'thrust', heavy: true, draw: nothing };
WEAPON_ART.nc_gripSlam = { style: 'slash', heavy: true, draw: nothing };

CLASS_LOOK.necromancer = (h, common, ct) => {
  const a = h.act;
  const act = a ? a.skill.replace(/^nc_/, '') : '';
  const k = a ? clamp01(a.t / Math.max(1e-3, a.dur)) : 0;
  const t = Math.max(-1, Math.min(4, ct));
  const w = common.weapon ?? 'none';
  const wk: NcState['wk'] = w === 'wand' ? 'wand' : w === 'scythe' ? 'scythe' : w === 'none' ? 'none' : 'other';
  let grip = 'nc_grip';
  if (act === 'spear') grip = 'nc_gripHeavy';
  else if (act === 'corpse' || act === 'armor') grip = 'nc_gripSlam';
  const casting = act === 'mage' || act === 'plague';
  const ht = common.helm ?? -1;
  const L: NcLook = {
    skin: SKIN, eyes: '#b4ffd8', hair: undefined, beard: undefined,
    body: TORSO[t + 1], body2: ROBE[t + 1], legs: '#1c1d1a',
    boots: '#1e1b17',
    head: 'human', helm: -1, build: 0.97, height: 1.05,
    robe: ROBE[t + 1],
    weapon: wk === 'other' ? w : grip, wTier: common.wTier ?? 0, wGlow: common.wGlow,
    offhand: 'nc_rig', offTier: 0,
    armorTier: -1, trim: undefined,
    glow: casting || t >= 3 ? SOUL : undefined,
    decor: 'nc_bone',
    nc: {
      act, k, ct: t, ht, gt: slotTier(h, 'gloves'), bt: slotTier(h, 'boots'),
      wk, wt: common.wTier ?? 0, wg: common.wGlow,
      ot: common.offhand === 'skull' ? common.offTier ?? 0 : -1,
      armor: h.buffs.some((b) => b.id === 'nc_armor'),
    },
  };
  return L;
};

// ------------------------------------------------------------------ small helpers
/** A limb segment drawn like the rig's (outline, body, lit highlight). */
function seg(c: C2D, x0: number, y0: number, x1: number, y1: number, w: number, col: string): void {
  c.lineCap = 'round';
  c.strokeStyle = shade(col, -0.45); c.lineWidth = w + 0.9;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.strokeStyle = col; c.lineWidth = w;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  const l = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / l, ny = (x1 - x0) / l;
  const s = nx + ny < 0 ? 1 : -1, o = w * 0.22 * s;
  c.strokeStyle = shade(col, 0.25); c.lineWidth = w * 0.28;
  c.beginPath(); c.moveTo(x0 + nx * o, y0 + ny * o); c.lineTo(x1 + nx * o, y1 + ny * o); c.stroke();
}

/** Solves the elbow of a two-segment arm from shoulder and hand (the rig bends the forearm by `bend`). */
function elbow(sx: number, sy: number, hx: number, hy: number, l1: number, l2: number, bend: number): { ex: number; ey: number } {
  const d = Math.hypot(hx - sx, hy - sy);
  const beta = Math.atan2(l2 * Math.sin(bend), l1 + l2 * Math.cos(bend));
  const a = Math.atan2(hx - sx, hy - sy) - (d < l1 + l2 - 0.01 ? beta : 0);
  return { ex: sx + Math.sin(a) * l1, ey: sy + Math.cos(a) * l1 };
}

/** A glowing soft disc (additive). */
export function glowDot(c: C2D, x: number, y: number, r: number, rgb: string, a: number): void {
  if (a <= 0.01 || r <= 0.1) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${Math.min(1, a)})`); g.addColorStop(0.25, `rgba(${rgb},${a * 0.75})`); g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}

/** A knobbly bone from (x0,y0) to (x1,y1). */
export function boneStick(c: C2D, x0: number, y0: number, x1: number, y1: number, w: number, col = BONE): void {
  const l = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / l * w * 0.55, ny = (x1 - x0) / l * w * 0.55;
  c.lineCap = 'round';
  c.strokeStyle = BONE_LINE; c.lineWidth = w + 0.7;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.fillStyle = BONE_LINE;
  for (const [x, y] of [[x0, y0], [x1, y1]]) { c.beginPath(); c.arc(x + nx, y + ny, w * 0.72 + 0.35, 0, TAU); c.arc(x - nx, y - ny, w * 0.72 + 0.35, 0, TAU); c.fill(); }
  c.strokeStyle = col; c.lineWidth = w;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.fillStyle = col;
  for (const [x, y] of [[x0, y0], [x1, y1]]) { c.beginPath(); c.arc(x + nx, y + ny, w * 0.72, 0, TAU); c.arc(x - nx, y - ny, w * 0.72, 0, TAU); c.fill(); }
  c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = w * 0.3;
  c.beginPath(); c.moveTo(x0 + nx * 0.4, y0 + ny * 0.4); c.lineTo(x1 + nx * 0.4, y1 + ny * 0.4); c.stroke();
}

/**
 * A front-facing skull centred at (x,y), radius r (cranium). eyes: glow colour of the sockets ('' = dark),
 * jaw: 0..1 how far the jaw hangs open, col: bone colour.
 */
export function skull(c: C2D, x: number, y: number, r: number, o: { eyes?: string; eyeA?: number; jaw?: number; col?: string; line?: number } = {}): void {
  const col = o.col ?? BONE;
  const jaw = (o.jaw ?? 0) * r * 0.35;
  c.save(); c.translate(x, y);
  const g = c.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r * 1.25);
  g.addColorStop(0, shade(col, 0.45)); g.addColorStop(0.55, col); g.addColorStop(1, shade(col, -0.45));
  // jaw (behind the cranium's cheek line)
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-r * 0.55, r * 0.35); c.lineTo(-r * 0.5, r * 0.8 + jaw); c.quadraticCurveTo(0, r * 1.12 + jaw, r * 0.5, r * 0.8 + jaw); c.lineTo(r * 0.55, r * 0.35); c.closePath();
  c.fill();
  // cranium + cheekbones
  c.beginPath();
  c.moveTo(-r * 0.62, r * 0.55);
  c.quadraticCurveTo(-r * 1.02, r * 0.2, -r * 0.98, -r * 0.3);
  c.quadraticCurveTo(-r * 0.9, -r * 1.02, 0, -r * 1.02);
  c.quadraticCurveTo(r * 0.9, -r * 1.02, r * 0.98, -r * 0.3);
  c.quadraticCurveTo(r * 1.02, r * 0.2, r * 0.62, r * 0.55);
  c.quadraticCurveTo(0, r * 0.68, -r * 0.62, r * 0.55);
  c.closePath(); c.fill();
  c.strokeStyle = BONE_LINE; c.lineWidth = o.line ?? Math.max(0.35, r * 0.09); c.stroke();
  // sockets, nose, teeth
  c.fillStyle = '#17120d';
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * r * 0.38, r * 0.02, r * 0.28, r * 0.31, s * -0.25, 0, TAU); c.fill(); }
  c.beginPath(); c.moveTo(0, r * 0.28); c.lineTo(r * 0.11, r * 0.5); c.lineTo(-r * 0.11, r * 0.5); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(30,22,14,0.8)'; c.lineWidth = Math.max(0.25, r * 0.06);
  c.beginPath(); c.moveTo(-r * 0.4, r * 0.66 + jaw * 0.2); c.lineTo(r * 0.4, r * 0.66 + jaw * 0.2); c.stroke();
  for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * r * 0.15, r * 0.58); c.lineTo(i * r * 0.15, r * 0.8 + jaw * 0.6); c.stroke(); }
  if (jaw > 0.1) { c.fillStyle = 'rgba(10,6,4,0.85)'; c.fillRect(-r * 0.36, r * 0.68, r * 0.72, jaw * 0.9); }
  if (o.eyes) {
    const a = o.eyeA ?? 1;
    c.globalCompositeOperation = 'lighter';
    for (const s of [-1, 1]) {
      const eg = c.createRadialGradient(s * r * 0.38, r * 0.04, 0, s * r * 0.38, r * 0.04, r * 0.55);
      eg.addColorStop(0, `rgba(255,255,255,${0.9 * a})`); eg.addColorStop(0.3, `rgba(${o.eyes},${0.85 * a})`); eg.addColorStop(1, `rgba(${o.eyes},0)`);
      c.fillStyle = eg; c.beginPath(); c.arc(s * r * 0.38, r * 0.04, r * 0.55, 0, TAU); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  }
  c.restore();
}

// ------------------------------------------------------------------ weapons (painted by the decor)
/** Bone wand, local frame: origin in the fist, +y along the wand. glowK 0..1 lights the tip. */
export function boneWand(c: C2D, tier: number, s: number, glowK: number, time: number, rim?: string): void {
  const len = (12 + Math.min(3, tier) * 0.8) * s;
  const dark = tier >= 3;
  const col = dark ? '#58505e' : tier >= 2 ? '#ddd6c4' : BONE;
  // pommel knuckle and a leather-wrapped grip
  c.fillStyle = dark ? '#6a6070' : BONE_MID; c.strokeStyle = BONE_LINE; c.lineWidth = 0.4 * s;
  c.beginPath(); c.arc(-0.5 * s, -3.4 * s, 1.1 * s, 0, TAU); c.arc(0.6 * s, -3.4 * s, 1.1 * s, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#3b2a1e'; c.fillRect(-1.25 * s, -2.8 * s, 2.5 * s, 5.8 * s);
  c.strokeStyle = '#7a5a38'; c.lineWidth = 0.45 * s;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-1.25 * s, (-2.3 + i * 1.4) * s); c.lineTo(1.25 * s, (-1.5 + i * 1.4) * s); c.stroke(); }
  // shaft: a single long bone, flared at the joint below the head
  const g = c.createLinearGradient(-1.2 * s, 0, 1.2 * s, 0);
  g.addColorStop(0, shade(dark ? '#58505e' : '#e3d9c1', 0.35)); g.addColorStop(0.5, col); g.addColorStop(1, shade(dark ? '#58505e' : '#e3d9c1', -0.4));
  c.fillStyle = g; c.strokeStyle = BONE_LINE; c.lineWidth = 0.45 * s;
  c.beginPath();
  c.moveTo(-1.05 * s, 3 * s); c.quadraticCurveTo(-0.6 * s, len * 0.55, -0.8 * s, len - 2.6 * s); c.lineTo(-1.6 * s, len - 1.4 * s);
  c.lineTo(1.6 * s, len - 1.4 * s); c.lineTo(0.8 * s, len - 2.6 * s); c.quadraticCurveTo(0.6 * s, len * 0.55, 1.05 * s, 3 * s); c.closePath();
  c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 0.35 * s;
  c.beginPath(); c.moveTo(-0.5 * s, 3.5 * s); c.quadraticCurveTo(-0.2 * s, len * 0.55, -0.4 * s, len - 3 * s); c.stroke();
  if (tier >= 2) { c.strokeStyle = `rgba(${SOUL_RGB},0.8)`; c.lineWidth = 0.4 * s; c.beginPath(); c.moveTo(0, 4.5 * s); c.lineTo(0.5 * s, 6 * s); c.lineTo(-0.4 * s, 7.4 * s); c.lineTo(0.3 * s, 9 * s); c.stroke(); }
  // head: a small skull on top (crowned by a soul crystal on the better wands)
  c.save(); c.translate(0, len + 1.1 * s); c.rotate(Math.PI);
  if (tier >= 2) {
    c.fillStyle = tier >= 3 ? '#7dffb0' : '#b6ffda';
    c.beginPath(); c.moveTo(0, -(tier >= 3 ? 7.2 : 5.6) * s); c.lineTo(1.2 * s, -3.2 * s); c.lineTo(0, -2 * s); c.lineTo(-1.2 * s, -3.2 * s); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.moveTo(0, -(tier >= 3 ? 6.6 : 5) * s); c.lineTo(0.4 * s, -3.4 * s); c.lineTo(-0.2 * s, -3.2 * s); c.closePath(); c.fill();
  }
  skull(c, 0, 0.2 * s, (tier >= 2 ? 2.4 : 2.1) * s, { col: dark ? '#8a8292' : undefined, eyes: tier >= 2 || glowK > 0.05 ? SOUL_RGB : undefined, eyeA: Math.min(1, (tier >= 2 ? 0.45 : 0) + glowK) });
  c.restore();
  if (rim) { c.globalCompositeOperation = 'lighter'; glowDot(c, 0, len, 5 * s, rim === '#e0b050' ? '255,200,90' : rim === '#f0e070' ? '240,230,120' : '130,150,255', 0.25); c.globalCompositeOperation = 'source-over'; }
  if (glowK > 0.02 || tier >= 3) {
    c.globalCompositeOperation = 'lighter';
    const a = Math.max(glowK, tier >= 3 ? 0.25 + 0.08 * Math.sin(time * 3) : 0);
    const fl = 1 + 0.12 * Math.sin(time * 31);
    glowDot(c, 0, len + 1.2 * s, (5 + 8 * a) * s * fl, SOUL_RGB, 0.9 * a);
    c.globalCompositeOperation = 'source-over';
  }
}

/** Scythe in world-ish axes: origin at the grip, up is -y, the blade reaches forward (+x). s: scale. */
export function drawScythe(c: C2D, tier: number, s: number, glowK: number, time: number, rim?: string): void {
  const top = -40 * s, butt = 17 * s;
  const t4 = tier >= 4, t3 = tier >= 3;
  // snath: wood (tier ≤2), blackened with bone rings (3), a column of vertebrae (4)
  const wood = t4 ? '#221f29' : t3 ? '#2b2522' : '#5a4330';
  c.lineCap = 'round';
  c.strokeStyle = '#100c0a'; c.lineWidth = 3.1 * s;
  c.beginPath(); c.moveTo(0.4 * s, butt); c.quadraticCurveTo(-1.6 * s, (top + butt) / 2, 0.6 * s, top); c.stroke();
  c.strokeStyle = wood; c.lineWidth = 2.2 * s;
  c.beginPath(); c.moveTo(0.4 * s, butt); c.quadraticCurveTo(-1.6 * s, (top + butt) / 2, 0.6 * s, top); c.stroke();
  c.strokeStyle = t4 ? 'rgba(200,190,255,0.25)' : 'rgba(255,230,200,0.18)'; c.lineWidth = 0.6 * s;
  c.beginPath(); c.moveTo(-0.2 * s, butt - 2 * s); c.quadraticCurveTo(-2.1 * s, (top + butt) / 2, -0.1 * s, top + 2 * s); c.stroke();
  const xAt = (y: number) => -1.6 * s * Math.sin(Math.PI * (butt - y) / (butt - top)) * 0.9 + 0.4 * s;
  if (t3) {
    // bone rings (and on the soul reaper, green runes burning between them)
    for (const y of [butt - 4 * s, -2 * s, top + 9 * s]) { const x = xAt(y); c.fillStyle = BONE; c.fillRect(x - 2 * s, y - 1 * s, 4 * s, 2 * s); c.strokeStyle = BONE_LINE; c.lineWidth = 0.35 * s; c.strokeRect(x - 2 * s, y - 1 * s, 4 * s, 2 * s); }
    if (t4) {
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = `rgba(${SOUL_RGB},${0.55 + 0.25 * Math.sin(time * 3)})`; c.lineWidth = 0.5 * s;
      for (const y0 of [8 * s, -10 * s, -24 * s]) { const x = xAt(y0); c.beginPath(); c.moveTo(x - 0.6 * s, y0 - 2 * s); c.lineTo(x + 0.6 * s, y0); c.lineTo(x - 0.6 * s, y0 + 2 * s); c.stroke(); }
      c.globalCompositeOperation = 'source-over';
    }
  } else {
    c.fillStyle = '#2e2218'; c.fillRect(-1.6 * s, -4 * s, 3.2 * s, 7 * s);
  }
  // the second handle (nib)
  c.strokeStyle = '#140f0b'; c.lineWidth = 2 * s;
  c.beginPath(); c.moveTo(-0.6 * s, -15 * s); c.lineTo(4.2 * s, -17.5 * s); c.stroke();
  c.strokeStyle = t4 ? BONE : wood; c.lineWidth = 1.3 * s;
  c.beginPath(); c.moveTo(-0.6 * s, -15 * s); c.lineTo(4.2 * s, -17.5 * s); c.stroke();
  // butt spike
  if (t3) { c.fillStyle = BONE; c.beginPath(); c.moveTo(-1.2 * s, butt - 0.5 * s); c.lineTo(1.4 * s, butt - 0.5 * s); c.lineTo(0.3 * s, butt + 5 * s); c.closePath(); c.fill(); }
  // blade: long crescent sweeping forward and down from the top
  const bx = 0.6 * s, by = top;
  const L = (t4 ? 31 : t3 ? 28 : 25) * s;
  const blade = new Path2D();
  blade.moveTo(bx - 2.5 * s, by - 1.5 * s);
  blade.quadraticCurveTo(bx + L * 0.55, by - 7 * s, bx + L, by + 9 * s);            // outer back edge to the tip
  blade.quadraticCurveTo(bx + L * 0.55, by + 0.5 * s, bx + 1 * s, by + 4.5 * s);    // cutting edge back to the heel
  blade.closePath();
  const bg = c.createLinearGradient(bx, by - 6 * s, bx + 4 * s, by + 8 * s);
  if (t4) { bg.addColorStop(0, '#5c5a66'); bg.addColorStop(0.5, '#23222a'); bg.addColorStop(1, '#0e0d12'); }
  else if (t3) { bg.addColorStop(0, BONE_HI); bg.addColorStop(0.5, BONE); bg.addColorStop(1, BONE_DK); }
  else { bg.addColorStop(0, '#d0d4dc'); bg.addColorStop(0.5, '#8e939c'); bg.addColorStop(1, '#4e525a'); }
  c.fillStyle = bg; c.fill(blade);
  c.strokeStyle = t3 && !t4 ? BONE_LINE : '#15161a'; c.lineWidth = 0.55 * s; c.stroke(blade);
  // cutting edge highlight (spectral on the soul reaper)
  c.strokeStyle = t4 ? `rgba(${SOUL_RGB},0.95)` : t3 ? 'rgba(255,250,235,0.9)' : 'rgba(240,244,255,0.9)'; c.lineWidth = (t4 ? 1 : 0.7) * s;
  c.beginPath(); c.moveTo(bx + L - 0.5 * s, by + 8.4 * s); c.quadraticCurveTo(bx + L * 0.55, by + 0.9 * s, bx + 2 * s, by + 4.2 * s); c.stroke();
  if (t3 && !t4) {
    // serrations along the bone edge
    c.fillStyle = BONE_DK;
    for (let i = 1; i < 5; i++) { const u = i / 5; const ex = bx + 2 * s + (L - 2 * s) * u, ey = by + 4.2 * s + (4.5 * s) * u * u - Math.sin(u * Math.PI) * 3.8 * s; c.beginPath(); c.moveTo(ex - 1 * s, ey); c.lineTo(ex, ey + 1.6 * s); c.lineTo(ex + 1 * s, ey); c.fill(); }
  }
  // binding / skull at the joint
  if (t3) skull(c, bx - 0.3 * s, by + 1.2 * s, 2.3 * s, { col: t4 ? '#d8cfb8' : BONE, eyes: SOUL_RGB, eyeA: t4 ? 0.8 + 0.2 * Math.sin(time * 4) : 0.4 + 0.6 * glowK });
  else { c.fillStyle = '#2a2018'; c.fillRect(bx - 2.2 * s, by - 1 * s, 4.4 * s, 3.4 * s); c.fillStyle = '#7a6040'; c.fillRect(bx - 2.2 * s, by + 0.2 * s, 4.4 * s, 0.8 * s); }
  if (rim) { c.globalCompositeOperation = 'lighter'; glowDot(c, bx + L * 0.6, by + 2 * s, 9 * s, rim === '#e0b050' ? '255,200,90' : rim === '#f0e070' ? '240,230,120' : '130,150,255', 0.22); c.globalCompositeOperation = 'source-over'; }
  if (t4 || glowK > 0.02) {
    c.globalCompositeOperation = 'lighter';
    const a = Math.max(t4 ? 0.3 + 0.12 * Math.sin(time * 3) : 0, glowK);
    c.strokeStyle = `rgba(${SOUL_RGB},${0.45 * a})`; c.lineWidth = 3.2 * s;
    c.beginPath(); c.moveTo(bx + L - 0.5 * s, by + 8.4 * s); c.quadraticCurveTo(bx + L * 0.55, by + 0.9 * s, bx + 2 * s, by + 4.2 * s); c.stroke();
    glowDot(c, bx + 1 * s, by + 1 * s, (5 + 8 * glowK) * s, SOUL_RGB, 0.7 * a);
    c.globalCompositeOperation = 'source-over';
  }
}

/** A skull held in the palm (x,y = hand). tier 0 shrunken skull, 2 hex skull, 4 lich skull. glowK 0..1. */
export function heldSkull(c: C2D, x: number, y: number, tier: number, glowK: number, time: number, s = 1): void {
  const bob = Math.sin(time * 2.4) * 0.5 * s;
  const cx = x + 1.6 * s, cy = y - 3.6 * s + bob;
  const r = (tier >= 4 ? 3.3 : tier >= 2 ? 3.1 : 2.8) * s;
  const pulse = 0.55 + 0.45 * Math.sin(time * 3.1);
  c.globalCompositeOperation = 'lighter';
  glowDot(c, cx, cy, (7 + 7 * glowK + (tier >= 4 ? 3 : 0)) * s, SOUL_RGB, 0.18 + 0.1 * pulse * (tier / 4) + 0.55 * glowK);
  c.globalCompositeOperation = 'source-over';
  if (tier >= 4) {
    // crown of bone spikes, green soul flames licking out of the top
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const fx = cx + (i - 1) * 1.6 * s, fh = (3 + Math.sin(time * 9 + i * 2) * 1.2 + glowK * 3) * s;
      const g = c.createLinearGradient(fx, cy - r - fh, fx, cy - r * 0.6);
      g.addColorStop(0, `rgba(${SOUL_RGB},0)`); g.addColorStop(1, `rgba(${SOUL_RGB},0.8)`);
      c.fillStyle = g; c.beginPath(); c.moveTo(fx - 1 * s, cy - r * 0.6); c.quadraticCurveTo(fx - 0.5 * s, cy - r - fh * 0.6, fx + Math.sin(time * 7 + i) * 0.8 * s, cy - r - fh); c.quadraticCurveTo(fx + 0.6 * s, cy - r - fh * 0.5, fx + 1 * s, cy - r * 0.6); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  }
  skull(c, cx, cy, r, {
    col: tier >= 4 ? '#e8e2d2' : tier >= 2 ? '#ded4ba' : '#b9a57e',
    eyes: tier >= 2 || glowK > 0.05 ? SOUL_RGB : undefined, eyeA: Math.min(1, (tier >= 2 ? 0.45 + 0.25 * pulse : 0) + glowK),
    jaw: glowK * 0.8,
  });
  if (tier <= 1) {
    // shrunken skull: stitched mouth and a tuft of hair
    c.strokeStyle = '#3a2a18'; c.lineWidth = 0.35 * s;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(cx + i * 0.8 * s, cy + r * 0.55); c.lineTo(cx + i * 0.8 * s, cy + r * 0.95); c.stroke(); }
    c.strokeStyle = '#231a12'; c.lineWidth = 0.6 * s;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(cx - 0.5 * s + i * 0.5 * s, cy - r * 0.95); c.quadraticCurveTo(cx - 2 * s + i * s, cy - r * 1.4, cx - 3 * s + i * 0.8 * s, cy - r * 1.1 + Math.sin(time * 2 + i) * 0.4 * s); c.stroke(); }
  } else if (tier >= 2 && tier < 4) {
    // carved hex runes on the brow
    c.strokeStyle = `rgba(${SOUL_RGB},${0.55 + 0.3 * pulse})`; c.lineWidth = 0.4 * s;
    c.beginPath(); c.moveTo(cx - 1.2 * s, cy - r * 0.55); c.lineTo(cx, cy - r * 0.85); c.lineTo(cx + 1.2 * s, cy - r * 0.55); c.moveTo(cx, cy - r * 0.85); c.lineTo(cx, cy - r * 0.35); c.stroke();
  } else {
    // lich skull: bone crown
    c.fillStyle = BONE_HI; c.strokeStyle = BONE_LINE; c.lineWidth = 0.35 * s;
    for (let i = -2; i <= 2; i++) { const bx = cx + i * r * 0.36, h = (i === 0 ? 3.2 : Math.abs(i) === 1 ? 2.4 : 1.6) * s; c.beginPath(); c.moveTo(bx - 0.7 * s, cy - r * 0.8); c.lineTo(bx, cy - r * 0.8 - h); c.lineTo(bx + 0.7 * s, cy - r * 0.8); c.closePath(); c.fill(); c.stroke(); }
    c.fillStyle = '#62ffb0'; c.beginPath(); c.arc(cx, cy - r * 0.62, 0.7 * s, 0, TAU); c.fill();
  }
  // fingers curled around it
  c.fillStyle = shade(SKIN, -0.25);
  for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(cx - r * 0.5 + i * r * 0.5, cy + r * 0.95, 0.8 * s, 0.6 * s, 0, 0, TAU); c.fill(); }
}

// ------------------------------------------------------------------ pose remap (engine has no per-skill pose hook)
/** How brightly the wand / skull burns for the current act. */
function glowOf(s: NcState): { w: number; o: number } {
  const k = s.k;
  switch (s.act) {
    case 'bolt': return { w: Math.max(0, 1 - Math.abs(k - 0.48) * 3.2), o: 0 };
    case 'spear': return { w: k < 0.5 ? ease(k / 0.5) : 1 - ease((k - 0.5) / 0.4), o: k < 0.55 ? 0.8 * ease(k / 0.4) : 0.8 * (1 - ease((k - 0.55) / 0.4)) };
    case 'corpse': return { w: k < 0.5 ? 0.3 + 0.7 * ease(k / 0.45) : 1 - ease((k - 0.5) / 0.45), o: 0.4 };
    case 'mage': return { w: 0.6 * ease(k / 0.6), o: ease(k / 0.6) };
    case 'armor': return { w: 0.3, o: k < 0.7 ? ease(k / 0.4) : 1 - ease((k - 0.7) / 0.3) };
    case 'plague': return { w: 0.5, o: k < 0.6 ? ease(k / 0.5) : 1 - ease((k - 0.6) / 0.4) };
    default: return { w: 0, o: 0 };
  }
}

function remapPose(p: Pose, s: NcState): void {
  if (s.wk === 'other') return;
  const k = s.k;
  switch (s.act) {
    // flick / hurl: the rig's thrust (pull back, snap out at the release, recover)
    case 'bolt': case 'spear':
      if (p.cast >= 0) { p.atk = Math.min(0.999, p.cast); p.cast = -1; }
      break;
    // detonate: raise the hand high, then slam it down at the corpses
    case 'corpse': p.cast = -1; p.atk = Math.min(0.999, k); break;
    // both arms raised overhead while the bones gather, then lowered
    case 'armor': p.cast = -1; p.atk = k < 0.72 ? 0.37 * ease(k / 0.45) : 0.37 * (1 - ease((k - 0.72) / 0.28)); break;
    // raise the dead: the hands lift slowly as the mage climbs out
    case 'mage': if (p.cast >= 0) p.cast = 0.5 * ease(k / 0.75); break;
    // release the plague: gather low, then shove both hands forward at the target and hold
    case 'plague':
      if (p.cast >= 0) p.cast = k < 0.42 ? 0.06 * ease(k / 0.42) : k < 0.58 ? 0.06 + 0.24 * ease((k - 0.42) / 0.16) : 0.3 - 0.14 * ease((k - 0.58) / 0.42);
      break;
    // idle / walking: the skull is carried out in front like a lantern (the rig lifts the back arm for 'block')
    case '': if (s.ot >= 0 && !p.back && p.dead < 0) p.block = 1; break;
  }
}

// ------------------------------------------------------------------ cape & mantle
const HEM = [0, 3.2, 0.8, 4.4, 1.2, 3.6, 0.4, 2.8];
function capeShape(c: C2D, p: Pose, a: RigAnchors, s: NcState, over: boolean): void {
  const b = a.build;
  const sw = p.moving ? Math.sin(p.walk * 4.2) : 0;
  const trail = p.moving ? 4.5 : 0, flut = Math.sin(p.t * 2.1) * 0.7;
  const top = a.shY + 0.5;
  const x0 = a.shX - 6.5 * b, x1 = a.shX + (over ? 6 * b : 3);
  const hemY = -1.5;
  const hl = -13 * b - trail - flut - sw * 1.2, hr = over ? 9 * b - trail * 0.3 : 3 - trail * 0.4;
  const col = ROBE[s.ct + 1];
  const g = c.createLinearGradient(x0, top, hl, 0);
  g.addColorStop(0, shade(col, over ? 0.12 : -0.2)); g.addColorStop(1, shade(col, over ? -0.3 : -0.55));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(x1, top);
  c.quadraticCurveTo(a.shX, top - 1.6, x0, top + 1);
  c.quadraticCurveTo(x0 - 5 * b - trail * 0.4, a.hipY, hl, hemY - 5);
  const n = HEM.length;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const x = hl + (hr - hl) * u;
    c.lineTo(x, hemY - HEM[i] * (s.ct >= 4 ? 0.6 : 1) - (i % 2 ? Math.sin(p.t * 3 + i) * 0.5 : 0));
  }
  c.lineTo(hr, hemY - 2);
  c.closePath(); c.fill();
  // folds
  c.strokeStyle = shade(col, -0.6); c.lineWidth = 0.6;
  for (const u of [0.25, 0.5, 0.75]) { c.beginPath(); c.moveTo(x0 + (x1 - x0) * u, top + 2); c.quadraticCurveTo(x0 - 3 * b + (x1 - x0) * u * 0.5 - trail * 0.3, a.hipY, hl + (hr - hl) * u, hemY - 3); c.stroke(); }
  if (s.ct >= 3) {
    c.strokeStyle = TRIM[s.ct + 1]; c.lineWidth = 0.8;
    c.beginPath();
    for (let i = 0; i < n; i++) { const u = i / (n - 1); const x = hl + (hr - hl) * u; const y = hemY - HEM[i] * (s.ct >= 4 ? 0.6 : 1) - 1.6; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.stroke();
  }
}

/** Rib spikes rising behind the shoulders (chest tier ≥3). */
function mantle(c: C2D, p: Pose, a: RigAnchors, s: NcState): void {
  if (s.ct < 3) return;
  const n = s.ct >= 4 ? 5 : 4;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const bx = a.shX - 6 + u * 7, by = a.shY + 1.5;
    const ang = -2.55 + u * 0.95 + Math.sin(p.t * 1.3 + i) * 0.02;
    const len = (s.ct >= 4 ? 13 : 10) * (0.75 + 0.35 * Math.sin(u * Math.PI));
    const tx = bx + Math.cos(ang) * len, ty = by + Math.sin(ang) * len;
    // curved rib, tapering
    c.strokeStyle = BONE_LINE; c.lineWidth = 2.6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + Math.cos(ang + 0.5) * len * 0.6, by + Math.sin(ang + 0.5) * len * 0.6, tx, ty); c.stroke();
    c.strokeStyle = BONE; c.lineWidth = 1.7;
    c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + Math.cos(ang + 0.5) * len * 0.6, by + Math.sin(ang + 0.5) * len * 0.6, tx, ty); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 0.5;
    c.beginPath(); c.moveTo(bx, by - 0.4); c.quadraticCurveTo(bx + Math.cos(ang + 0.5) * len * 0.6, by + Math.sin(ang + 0.5) * len * 0.6 - 0.4, tx, ty); c.stroke();
    if (s.ct >= 4) {
      c.globalCompositeOperation = 'lighter';
      glowDot(c, tx, ty, 3.2 + Math.sin(p.t * 5 + i * 1.7) * 0.8, SOUL_RGB, 0.55);
      c.globalCompositeOperation = 'source-over';
    }
  }
}

// ------------------------------------------------------------------ robe front
/** Torso half-width band at height y (the rig's torso trapezoid: hips ±ww, shoulders shX±sw2). */
function torsoAt(a: RigAnchors, y: number): { x0: number; x1: number } {
  const b = a.build, ww = 6.2 * b, sw2 = 7.4 * b;
  const u = clamp01((y - (a.hipY + 2)) / (a.shY + 2 - (a.hipY + 2)));
  return { x0: -ww + (a.shX - sw2 + ww) * u, x1: ww + (a.shX + sw2 - ww) * u };
}

function robeFront(c: C2D, p: Pose, a: RigAnchors, s: NcState): void {
  const ct = s.ct, b = a.build;
  const sw = p.moving ? Math.sin(p.walk * 4.2) : 0;
  // front panel of the robe: a darker overlap with a trim line down to the hem
  const tr = TRIM[ct + 1];
  c.strokeStyle = shade(ROBE[ct + 1], -0.55); c.lineWidth = 1.1;
  c.beginPath(); c.moveTo(a.shX + 4.6 * b, a.shY + 4); c.quadraticCurveTo(6.5 * b, a.hipY + 4, 8.2 * b + (p.moving ? sw * 2.2 : 0), -2); c.stroke();
  if (ct >= 2) {
    c.strokeStyle = tr; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(a.shX + 4 * b, a.shY + 4.5); c.quadraticCurveTo(5.9 * b, a.hipY + 4, 7.6 * b + (p.moving ? sw * 2.2 : 0), -2.2); c.stroke();
    c.beginPath(); c.moveTo(-10 * b + (p.moving ? sw * 1.5 : 0), -2.6); c.lineTo(10 * b + (p.moving ? sw * 2.5 : 0), -2.6); c.stroke();
  }
  // glowing runes down the lich robe
  if (ct >= 4) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const pulse = 0.6 + 0.4 * Math.sin(p.t * 2.6);
    c.strokeStyle = `rgba(${SOUL_RGB},${0.55 * pulse})`; c.lineWidth = 0.6;
    for (let i = 0; i < 4; i++) {
      const y = a.hipY + 3 + i * 4.2, x = 5.2 * b + i * 0.55 * b + (p.moving ? sw * 0.5 * i : 0);
      c.beginPath();
      if (i % 2) { c.moveTo(x - 1, y - 1.2); c.lineTo(x + 1, y); c.lineTo(x - 1, y + 1.2); c.moveTo(x + 1, y - 1.3); c.lineTo(x + 1, y + 1.3); }
      else { c.moveTo(x, y - 1.4); c.lineTo(x, y + 1.4); c.moveTo(x - 1.1, y - 0.5); c.lineTo(x + 1.1, y + 0.4); }
      c.stroke();
    }
    c.restore();
  }
  // belt with a skull buckle and hanging charms
  const by = a.hipY - 0.2;
  const band = torsoAt(a, by);
  c.fillStyle = '#231a14'; c.fillRect(band.x0 - 0.3, by - 1.5, band.x1 - band.x0 + 0.6, 2.8);
  c.fillStyle = '#3e2e20'; c.fillRect(band.x0 - 0.3, by - 1.5, band.x1 - band.x0 + 0.6, 0.9);
  skull(c, band.x1 - 1.2, by + 0.1, 1.6, { eyes: ct >= 3 ? SOUL_RGB : undefined, eyeA: 0.5 });
  // dangling bones (tassets from tier 3, a single charm before)
  const nb = ct >= 3 ? 3 : ct >= 0 ? 1 : 0;
  for (let i = 0; i < nb; i++) {
    const x0 = band.x1 - 3.2 - i * 2.4, y0 = by + 1.2;
    const swing = (p.moving ? -sw * 0.25 : 0) + Math.sin(p.t * 2 + i) * 0.04;
    const len = ct >= 3 ? 5.2 - (i % 2) * 1.4 : 3.6;
    const x1 = x0 + Math.sin(swing) * len, y1 = y0 + Math.cos(swing) * len;
    c.strokeStyle = '#1a140e'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(x0, y0 - 0.6); c.lineTo(x0, y0 + 0.4); c.stroke();
    boneStick(c, x0, y0 + 0.4, x1, y1, ct >= 3 ? 0.7 : 0.6);
  }
  // rib-cage cuirass over the chest (tier ≥1): ribs arcing from the spine forward to the sternum
  if (ct >= 1) {
    const n = ct >= 2 ? 4 : 3;
    const top = a.shY + 4.6;
    const bot = a.hipY - 3.2;
    for (let i = 0; i < n; i++) {
      const y = top + ((bot - top) * i) / (n - 1);
      const t = torsoAt(a, y);
      const xs = t.x0 + 1.6, xe = t.x1 - 0.6;
      const w = (ct >= 3 ? 1.15 : 0.95) - i * 0.07;
      // the hollow under each rib
      c.strokeStyle = 'rgba(8,10,8,0.45)'; c.lineWidth = w + 0.6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(xs + 0.5, y + 0.9); c.quadraticCurveTo((xs + xe) / 2, y - 1.1, xe - 0.4, y + 2.7); c.stroke();
      c.strokeStyle = BONE_LINE; c.lineWidth = w + 0.8;
      c.beginPath(); c.moveTo(xs, y - 0.4); c.quadraticCurveTo((xs + xe) / 2, y - 2.6, xe, y + 1.4); c.stroke();
      c.strokeStyle = ct >= 4 ? '#d8d0bf' : BONE; c.lineWidth = w;
      c.beginPath(); c.moveTo(xs, y - 0.4); c.quadraticCurveTo((xs + xe) / 2, y - 2.6, xe, y + 1.4); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = w * 0.3;
      c.beginPath(); c.moveTo(xs + 1, y - 1.1); c.quadraticCurveTo((xs + xe) / 2, y - 3.1, xe - 1, y + 0.6); c.stroke();
    }
    // sternum
    const t0 = torsoAt(a, top - 1), t1 = torsoAt(a, bot + 1);
    boneStick(c, t0.x1 - 0.8, top - 1.2, t1.x1 - 0.8, bot + 1.8, 1.1, BONE_MID);
    if (ct >= 3) {
      // a soul gem set in the breastbone
      c.save(); c.globalCompositeOperation = 'lighter';
      glowDot(c, t0.x1 - 1, top + 3.5, 4.2 + Math.sin(p.t * 3) * 0.6, SOUL_RGB, 0.7);
      c.restore();
      c.fillStyle = '#baffd8'; c.beginPath(); c.arc(t0.x1 - 1, top + 3.5, 0.9, 0, TAU); c.fill();
    }
  } else {
    // quilted / plain robe: crossed wrap lines
    c.strokeStyle = shade(TORSO[ct + 1], -0.5); c.lineWidth = 0.7;
    for (let i = 0; i < 3; i++) { const y = a.shY + 6 + i * 3.4; const t = torsoAt(a, y); c.beginPath(); c.moveTo(t.x0 + 1, y); c.lineTo(t.x1 - 0.5, y + 0.8); c.stroke(); }
  }
  // necklace of bone beads / finger bones
  const nx = a.shX + 3.2, ny = a.shY + 2.8;
  c.strokeStyle = '#1a140e'; c.lineWidth = 0.4;
  c.beginPath(); c.moveTo(a.shX - 1, a.shY + 0.8); c.quadraticCurveTo(nx - 0.5, ny + 1.6, a.shX + 5, a.shY + 1.2); c.stroke();
  for (let i = 0; i < 5; i++) {
    const u = i / 4, x = a.shX - 0.5 + u * 5.2, y = a.shY + 1.1 + Math.sin(u * Math.PI) * 2.2;
    c.fillStyle = i === 2 ? BONE_HI : BONE_MID;
    c.beginPath(); c.ellipse(x, y, i === 2 ? 0.9 : 0.6, i === 2 ? 1.3 : 0.6, 0, 0, TAU); c.fill();
  }
}

// ------------------------------------------------------------------ head: hood & headgear
function hood(c: C2D, p: Pose, a: RigAnchors, s: NcState): void {
  const x = a.hx, y = a.hy, r = a.headR;
  const col = HOOD[s.ct + 1];
  const g = c.createLinearGradient(x + r, y - r * 1.4, x - r * 1.6, y + r * 1.8);
  g.addColorStop(0, shade(col, 0.22)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.5));
  c.fillStyle = g;
  if (p.back) {
    c.beginPath();
    c.moveTo(x + r * 1.1, y + r * 0.2);
    c.quadraticCurveTo(x + r * 1.3, y - r * 1.4, x - r * 0.1, y - r * 1.45);
    c.quadraticCurveTo(x - r * 1.35, y - r * 1.35, x - r * 1.5, y - r * 0.2);
    c.quadraticCurveTo(x - r * 1.6, y + r * 1.4, x - r * 0.8, y + r * 2.1);
    c.lineTo(x + r * 0.9, y + r * 2.0);
    c.quadraticCurveTo(x + r * 1.3, y + r * 1.0, x + r * 1.1, y + r * 0.2);
    c.closePath(); c.fill();
    c.strokeStyle = shade(col, -0.6); c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(x - r * 0.1, y - r * 1.3); c.quadraticCurveTo(x - r * 0.3, y + r * 0.2, x - r * 0.1, y + r * 1.9); c.stroke();
    return;
  }
  // cowl: over the top, down the back to the shoulders, a deep opening around the face
  c.beginPath();
  c.moveTo(x + r * 1.1, y - r * 0.3);                                     // rim tip over the brow
  c.quadraticCurveTo(x + r * 0.9, y - r * 1.32, x - r * 0.15, y - r * 1.36);
  c.quadraticCurveTo(x - r * 1.15, y - r * 1.36, x - r * 1.42, y - r * 0.5);
  c.quadraticCurveTo(x - r * 1.7, y + r * 0.9, x - r * 1.25, y + r * 2.1);  // back drape
  c.lineTo(x + r * 0.3, y + r * 2.05);                                    // collar
  c.quadraticCurveTo(x + r * 0.3, y + r * 1.35, x + r * 0.5, y + r * 1.1);  // under the chin
  c.quadraticCurveTo(x - r * 0.12, y + r * 0.5, x + r * 0.02, y - r * 0.35); // inner edge of the opening
  c.quadraticCurveTo(x + r * 0.35, y - r * 0.82, x + r * 1.1, y - r * 0.3);
  c.closePath(); c.fill();
  c.strokeStyle = shade(col, -0.65); c.lineWidth = 0.55; c.stroke();
  // fold lines
  c.strokeStyle = shade(col, -0.4); c.lineWidth = 0.5;
  c.beginPath(); c.moveTo(x - r * 0.4, y - r * 1.15); c.quadraticCurveTo(x - r * 1.05, y - r * 0.2, x - r * 0.9, y + r * 1.9); c.stroke();
  c.beginPath(); c.moveTo(x - r * 0.9, y - r * 0.9); c.quadraticCurveTo(x - r * 1.35, y + r * 0.2, x - r * 1.15, y + r * 1.4); c.stroke();
  // lit rim of the opening (trimmed from tier 3)
  c.strokeStyle = s.ct >= 3 ? TRIM[s.ct + 1] : shade(col, 0.35); c.lineWidth = s.ct >= 3 ? 0.8 : 0.55;
  c.beginPath(); c.moveTo(x + r * 1.1, y - r * 0.3); c.quadraticCurveTo(x + r * 0.35, y - r * 0.82, x + r * 0.02, y - r * 0.35); c.quadraticCurveTo(x - r * 0.12, y + r * 0.5, x + r * 0.5, y + r * 1.1); c.stroke();
  // the brow sinks into the hood's shadow (the pale jaw stays lit); the eyes burn through it
  const sg = c.createLinearGradient(x + r * 0.6, y - r * 0.8, x + r * 0.62, y + r * 0.45);
  sg.addColorStop(0, 'rgba(6,8,8,0.8)'); sg.addColorStop(0.6, 'rgba(6,8,8,0.35)'); sg.addColorStop(1, 'rgba(6,8,8,0)');
  c.fillStyle = sg;
  c.beginPath(); c.moveTo(x + r * 1.1, y - r * 0.3); c.quadraticCurveTo(x + r * 0.35, y - r * 0.82, x + r * 0.02, y - r * 0.35); c.lineTo(x + r * 0.15, y + r * 0.45); c.lineTo(x + r * 1.3, y + r * 0.45); c.closePath(); c.fill();
  if (s.ht < 3) {
    const e = 0.75 + 0.25 * Math.sin(p.t * 2.3);
    c.save(); c.globalCompositeOperation = 'lighter';
    glowDot(c, x + r * 0.64, y - r * 0.1, r * 0.6, SOUL_RGB, 0.9 * e);
    c.restore();
    c.fillStyle = '#eafff4'; c.fillRect(x + r * 0.56, y - r * 0.17, r * 0.22, r * 0.14);
    // sunken cheek line
    c.strokeStyle = 'rgba(70,64,54,0.55)'; c.lineWidth = r * 0.07;
    c.beginPath(); c.moveTo(x + r * 0.45, y + r * 0.15); c.quadraticCurveTo(x + r * 0.55, y + r * 0.5, x + r * 0.8, y + r * 0.62); c.stroke();
  }
}

function headgear(c: C2D, p: Pose, a: RigAnchors, s: NcState): void {
  const x = a.hx, y = a.hy, r = a.headR, ht = s.ht;
  hood(c, p, a, s);
  if (ht < 0) return;
  if (ht === 0) {
    // bone beads strung along the hood rim
    for (let i = 0; i < 6; i++) {
      const u = i / 5;
      const bx = x + r * (1.08 - u * 1.0) - Math.sin(u * Math.PI) * r * 0.08, by = y - r * (0.3 + Math.sin(u * Math.PI) * 0.55) - u * r * 0.05;
      if (p.back && u < 0.5) continue;
      c.fillStyle = i % 2 ? BONE_MID : BONE; c.beginPath(); c.arc(bx, by, r * 0.13, 0, TAU); c.fill();
    }
    if (!p.back) boneStick(c, x - r * 1.35, y + r * 0.3, x - r * 1.5, y + r * 1.25, 0.6);
    return;
  }
  // circlet of finger bones around the brow (tier ≥1)
  const cy0 = y - r * 0.62;
  c.strokeStyle = '#1a140e'; c.lineWidth = r * 0.3;
  c.beginPath(); c.moveTo(x - r * 1.45, cy0 + r * 0.05); c.quadraticCurveTo(x - r * 0.2, cy0 - r * 0.28, x + r * 1.02, cy0 + r * 0.26); c.stroke();
  for (let i = 0; i < 7; i++) {
    const u = i / 6, bx = x - r * 1.4 + u * r * 2.35, by = cy0 + r * 0.05 - Math.sin(u * Math.PI) * r * 0.2 + u * r * 0.18;
    c.fillStyle = i % 2 ? BONE : BONE_MID; c.beginPath(); c.ellipse(bx, by - r * 0.12, r * 0.12, r * 0.25, -0.1, 0, TAU); c.fill();
  }
  if (ht === 2 || ht >= 4) {
    // swept-back horns of bone rising from the temples (the far one darker, behind)
    const hx = x - r * 0.15, hy = y - r * 0.85;
    for (const [ox, sc, col] of [[-0.45, 0.82, '#a89d85'], [0, 1, BONE]] as [number, number, string][]) {
      const bx = hx + ox * r, by = hy + ox * r * 0.2;
      const tx = bx - r * 2.0 * sc, ty = by - r * 1.25 * sc;
      const g = c.createLinearGradient(bx, by, tx, ty);
      g.addColorStop(0, shade(col, -0.25)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, 0.4));
      c.fillStyle = g; c.strokeStyle = BONE_LINE; c.lineWidth = 0.45;
      c.beginPath();
      c.moveTo(bx + r * 0.3, by + r * 0.05);
      c.quadraticCurveTo(bx - r * 1.0 * sc, by + r * 0.05, tx, ty);
      c.quadraticCurveTo(bx - r * 0.75 * sc, by - r * 0.75 * sc, bx - r * 0.2, by - r * 0.4);
      c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(58,50,38,0.55)'; c.lineWidth = 0.35;
      for (let i = 1; i < 4; i++) { const u = i / 4; const px = bx + (tx - bx) * u * 0.9, py = by + (ty - by) * u * 0.9 - r * 0.1; c.beginPath(); c.moveTo(px + r * 0.12, py - r * 0.28 * (1 - u)); c.lineTo(px - r * 0.05, py + r * 0.25 * (1 - u)); c.stroke(); }
    }
  }
  if (ht >= 3 && !p.back) {
    // beast-skull mask over the upper face, eyes burning inside the sockets
    const mx = x + r * 0.62, my = y - r * 0.2;
    const g = c.createLinearGradient(mx - r, my - r, mx + r, my + r);
    g.addColorStop(0, BONE_HI); g.addColorStop(0.5, ht >= 4 ? '#d6ccb6' : BONE); g.addColorStop(1, BONE_DK);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(mx - r * 0.75, my - r * 0.7);
    c.quadraticCurveTo(mx + r * 0.3, my - r * 0.95, mx + r * 0.8, my - r * 0.45);
    c.lineTo(mx + r * 1.15, my + r * 0.25); // snout
    c.lineTo(mx + r * 1.1, my + r * 0.62);
    c.lineTo(mx + r * 0.45, my + r * 0.58);
    c.quadraticCurveTo(mx - r * 0.2, my + r * 0.62, mx - r * 0.7, my + r * 0.25);
    c.closePath(); c.fill();
    c.strokeStyle = BONE_LINE; c.lineWidth = 0.5; c.stroke();
    // teeth along the snout's edge
    c.fillStyle = BONE_HI;
    for (let i = 0; i < 4; i++) { const tx = mx + r * (0.5 + i * 0.16); c.beginPath(); c.moveTo(tx - r * 0.06, my + r * 0.58); c.lineTo(tx, my + r * 0.82); c.lineTo(tx + r * 0.06, my + r * 0.58); c.fill(); }
    c.fillStyle = '#120d09';
    c.beginPath(); c.ellipse(mx + r * 0.1, my - r * 0.08, r * 0.3, r * 0.24, 0.2, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(mx + r * 0.95, my + r * 0.18); c.lineTo(mx + r * 0.78, my + r * 0.32); c.lineTo(mx + r * 0.98, my + r * 0.38); c.fill();
    const e = 0.75 + 0.25 * Math.sin(p.t * 2.3);
    c.save(); c.globalCompositeOperation = 'lighter';
    glowDot(c, mx + r * 0.1, my - r * 0.08, r * 0.75, SOUL_RGB, 0.95 * e);
    c.restore();
    c.strokeStyle = 'rgba(58,50,38,0.6)'; c.lineWidth = 0.35;
    c.beginPath(); c.moveTo(mx - r * 0.3, my - r * 0.62); c.lineTo(mx - r * 0.1, my - r * 0.35); c.lineTo(mx - r * 0.3, my - r * 0.15); c.stroke();
  }
  if (ht >= 4) {
    // lich crown: tall bone spikes with soul-fire on the tips
    for (let i = 0; i < 5; i++) {
      const u = i / 4, bx = x - r * 1.1 + u * r * 1.9, by = cy0 - Math.sin(u * Math.PI) * r * 0.2 + u * r * 0.12 - r * 0.15;
      const hh = r * (0.85 + Math.sin(u * Math.PI) * 0.8);
      const lean = (u - 0.5) * 0.35;
      c.fillStyle = BONE; c.strokeStyle = BONE_LINE; c.lineWidth = 0.4;
      c.beginPath(); c.moveTo(bx - r * 0.2, by); c.lineTo(bx + Math.sin(lean) * hh, by - hh); c.lineTo(bx + r * 0.2, by); c.closePath(); c.fill(); c.stroke();
      c.save(); c.globalCompositeOperation = 'lighter';
      glowDot(c, bx + Math.sin(lean) * hh, by - hh - r * 0.15, r * (0.55 + 0.15 * Math.sin(p.t * 7 + i * 2)), SOUL_RGB, 0.75);
      c.restore();
    }
    c.fillStyle = '#62ffb0'; c.beginPath(); c.arc(x + r * 0.15, cy0 - r * 0.25, r * 0.16, 0, TAU); c.fill();
  }
}

// ------------------------------------------------------------------ front arm, pauldrons, held weapon
/** Layered bone plates capping the shoulder (chest tier ≥2), spikes from tier 3, a small skull on the front one. */
function pauldron(c: C2D, sx: number, sy: number, a: number, armW: number, s: NcState, t: number, back: boolean): void {
  if (s.ct < 2) return;
  const W = armW * (s.ct >= 3 ? 1.08 : 0.98);
  const col = back ? '#a69a80' : s.ct >= 4 ? '#ddd4bf' : BONE;
  c.save(); c.translate(sx, sy); c.rotate(-a);
  if (s.ct >= 3) {
    // spikes rising off the cap
    c.fillStyle = back ? '#8e8470' : BONE_MID; c.strokeStyle = BONE_LINE; c.lineWidth = 0.4;
    for (let i = 0; i < 3; i++) { const x = (i - 1) * W * 0.55; c.beginPath(); c.moveTo(x - 0.7, -armW * 0.35); c.lineTo(x - 0.9 - i * 0.4, -armW * (1.35 + (i === 1 ? 0.45 : 0.1))); c.lineTo(x + 0.7, -armW * 0.35); c.closePath(); c.fill(); c.stroke(); }
  }
  for (let i = 1; i >= 0; i--) {
    const y = armW * (0.1 + i * 0.72), w = W * (1.05 - i * 0.14);
    const g = c.createLinearGradient(-w, 0, w, 0);
    g.addColorStop(0, shade(col, 0.35)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.45));
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-w, y - armW * 0.2); c.quadraticCurveTo(0, y - armW * 0.95, w, y - armW * 0.2); c.lineTo(w * 0.88, y + armW * 0.38); c.quadraticCurveTo(0, y + armW * 0.05, -w * 0.88, y + armW * 0.38); c.closePath(); c.fill();
    c.strokeStyle = BONE_LINE; c.lineWidth = 0.45; c.stroke();
    c.strokeStyle = 'rgba(58,50,38,0.45)'; c.lineWidth = 0.3;
    c.beginPath(); c.moveTo(-w * 0.5, y - armW * 0.45); c.quadraticCurveTo(0, y - armW * 0.75, w * 0.5, y - armW * 0.45); c.stroke();
  }
  c.restore();
  if (!back && s.ct >= 3) {
    const px = sx + Math.sin(a) * armW * 0.75, py = sy + Math.cos(a) * armW * 0.75;
    skull(c, px + 0.4, py - 0.3, armW * 0.6, { col: s.ct >= 4 ? '#ddd4bf' : BONE, eyes: SOUL_RGB, eyeA: s.ct >= 4 ? 0.75 + 0.25 * Math.sin(t * 2.5) : 0.35 });
  }
}

/**
 * A robed arm: pale bandaged forearm, then one flowing sleeve fitted over the upper arm and flaring into a bell
 * below the elbow (the side toward the ground droops). Returns the upper-arm angle (rig convention).
 */
function sleeveArm(c: C2D, sx: number, sy: number, ex: number, ey: number, hx: number, hy: number, armW: number, sleeve: string, ct: number, skin: string): number {
  const fl = Math.hypot(hx - ex, hy - ey) || 1, ux = (hx - ex) / fl, uy = (hy - ey) / fl;
  seg(c, ex, ey, hx, hy, armW * 0.74, skin);
  c.strokeStyle = 'rgba(120,110,90,0.8)'; c.lineWidth = 0.45;
  for (let i = 1; i < 3; i++) { const u = 0.6 + i * 0.12; const qx = ex + (hx - ex) * u, qy = ey + (hy - ey) * u; c.beginPath(); c.moveTo(qx - uy * armW * 0.4 - ux * 0.4, qy + ux * armW * 0.4 - uy * 0.4); c.lineTo(qx + uy * armW * 0.4 + ux * 0.4, qy - ux * armW * 0.4 + uy * 0.4); c.stroke(); }
  const nx = -uy, ny = ux;                      // forearm normal
  const cu = 0.62, cx = ex + (hx - ex) * cu, cy = ey + (hy - ey) * cu;
  const w0 = armW * 0.62, w1 = armW * 1.28;
  const dropA = ny > 0 ? 2.8 : 0.6, dropB = ny > 0 ? 0.6 : 2.8;
  const ang = Math.atan2(ex - sx, ey - sy);
  const dux = Math.sin(ang), duy = Math.cos(ang);
  const unx = -duy, uny = dux;                  // upper-arm normal (same side as the forearm normal)
  const wu = (armW + 0.9) / 2;
  const sg = c.createLinearGradient(sx - unx * wu * 2, sy - uny * wu * 2, sx + unx * wu * 2, sy + uny * wu * 2);
  sg.addColorStop(0, shade(sleeve, 0.25)); sg.addColorStop(0.5, sleeve); sg.addColorStop(1, shade(sleeve, -0.35));
  c.fillStyle = sg;
  c.beginPath();
  c.moveTo(sx + unx * wu, sy + uny * wu);
  c.lineTo(ex + nx * w0, ey + ny * w0);
  c.quadraticCurveTo(cx + nx * w1 * 0.8 - ux * 1.5, cy + ny * w1 * 0.8 - uy * 1.5, cx + nx * w1, cy + ny * w1 + dropA);
  c.quadraticCurveTo(cx + ux * 1.2, cy + uy * 1.2 + (dropA + dropB) * 0.5 + 0.8, cx - nx * w1, cy - ny * w1 + dropB);
  c.quadraticCurveTo(cx - nx * w1 * 0.8 - ux * 1.5, cy - ny * w1 * 0.8 - uy * 1.5, ex - nx * w0, ey - ny * w0);
  c.lineTo(sx - unx * wu, sy - uny * wu);
  c.quadraticCurveTo(sx - dux * wu * 1.7, sy - duy * wu * 1.7, sx + unx * wu, sy + uny * wu);
  c.closePath(); c.fill();
  c.strokeStyle = shade(sleeve, -0.6); c.lineWidth = 0.5; c.stroke();
  c.strokeStyle = shade(sleeve, -0.45); c.lineWidth = 0.45;
  c.beginPath(); c.moveTo(ex, ey); c.quadraticCurveTo(cx + nx * w1 * 0.3, cy + ny * w1 * 0.3, cx + nx * w1 * 0.45, cy + ny * w1 * 0.45 + dropA * 0.5); c.stroke();
  c.strokeStyle = ct >= 2 ? TRIM[ct + 1] : shade(sleeve, 0.3); c.lineWidth = ct >= 2 ? 0.8 : 0.6;
  c.beginPath(); c.moveTo(cx + nx * w1, cy + ny * w1 + dropA); c.quadraticCurveTo(cx + ux * 1.2, cy + uy * 1.2 + (dropA + dropB) * 0.5 + 0.8, cx - nx * w1, cy - ny * w1 + dropB); c.stroke();
  return ang;
}

function frontArm(c: C2D, L: NcLook, p: Pose, a: RigAnchors, s: NcState): void {
  const b = a.build, armL = 17 * a.height, armW = 3.8 * b;
  const sx = a.shX + 2, sy = a.shY + 2.2;
  const hx = a.fhx, hy = a.fhy;
  const thrust = (L.weapon === 'nc_grip' || L.weapon === 'nc_gripHeavy') && p.atk >= 0;
  const { ex, ey } = elbow(sx, sy, hx, hy, armL * 0.52, armL * 0.5, thrust ? 0.05 : 0.3);
  const fa = Math.atan2(hx - ex, hy - ey);
  const ang = sleeveArm(c, sx, sy, ex, ey, hx, hy, armW, SLEEVE[s.ct + 1], s.ct, SKIN);
  if (s.ct >= 2) pauldron(c, sx, sy, ang, armW, s, p.t, false);
  else { c.fillStyle = shade(SLEEVE[s.ct + 1], 0.12); c.beginPath(); c.ellipse(sx, sy + 0.4, armW * 0.8, armW * 0.6, 0, Math.PI, TAU); c.fill(); }
  const fl = Math.hypot(hx - ex, hy - ey) || 1, ux = (hx - ex) / fl, uy = (hy - ey) / fl;
  // the weapon, then the fist over its grip
  const gl = glowOf(s);
  if (s.wk === 'wand') {
    c.save(); c.translate(hx, hy); c.rotate(-(fa + 0.2));
    boneWand(c, s.wt, 1, gl.w, p.t, s.wg);
    c.restore();
  } else if (s.wk === 'scythe') {
    const tilt = Math.max(-0.3, Math.min(0.95, 0.05 + (fa - 0.42) * 0.45));
    c.save(); c.translate(hx, hy); c.rotate(tilt);
    drawScythe(c, s.wt, 0.9, gl.w, p.t, s.wg);
    c.restore();
  } else if (s.wk === 'none' && gl.w > 0.02) {
    c.save(); c.globalCompositeOperation = 'lighter'; glowDot(c, hx, hy, 5 + 5 * gl.w, SOUL_RGB, 0.9 * gl.w); c.restore();
  }
  const glove = s.gt >= 1 ? '#3a3230' : shade(SKIN, -0.12);
  c.fillStyle = glove; c.beginPath(); c.arc(hx, hy, armW * 0.5, 0, TAU); c.fill();
  c.fillStyle = s.gt >= 3 ? BONE : shade(SKIN, 0.2); c.beginPath(); c.arc(hx - armW * 0.14, hy - armW * 0.16, armW * 0.2, 0, TAU); c.fill();
  if (s.gt >= 3) { c.fillStyle = BONE; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(hx + (i - 1) * armW * 0.3 + ux * 1.2, hy + (i - 1) * 0.2 + uy * 1.2, 0.45, 0, TAU); c.fill(); } }
}

// ------------------------------------------------------------------ decor entry + the mid-layer offhand hook
/** Anchors and state of the current rig pass, for the offhand callback that runs later in the same drawBiped. */
let rig: { a: RigAnchors; s: NcState } | null = null;

DECOR.nc_bone = (c, L0, p, a, layer) => {
  const L = L0 as NcLook, s = L.nc;
  if (!s) return;
  if (layer === 'back') {
    remapPose(p, s);
    rig = { a: { ...a }, s };
    if (!p.back) { mantle(c, p, a, s); capeShape(c, p, a, s, false); }
    return;
  }
  c.save();
  if (p.back) { capeShape(c, p, a, s, true); mantle(c, p, a, s); }
  else robeFront(c, p, a, s);
  headgear(c, p, a, s);
  frontArm(c, L, p, a, s);
  c.restore();
  rig = null;
};

/** Called by the rig right after the back arm (before the torso): back pauldron and the skull in the back hand. */
OFFHAND_ART.nc_rig = {
  draw(c, x, y, _tier, p) {
    const r = rig;
    if (!r) return;
    const s = r.s, a = r.a;
    c.save();
    const bsx = a.shX - 2 * a.build, bsy = a.shY + 2, armL = 17 * a.height, armW = 3.8 * a.build;
    const { ex, ey } = elbow(bsx, bsy, x, y, armL * 0.52, armL * 0.5, 0.35);
    const ang = sleeveArm(c, bsx, bsy, ex, ey, x, y, armW, BACK_SLEEVE[s.ct + 1], s.ct, SKIN_DK);
    if (s.ct >= 2) pauldron(c, bsx, bsy, ang, armW, s, p.t, true);
    if (s.ot >= 0) heldSkull(c, x, y, s.ot, glowOf(s).o, p.t);
    c.restore();
  },
  icon(c, tier, gem) { skullIcon(c, tier, gem); },
};

// ------------------------------------------------------------------ item art (inventory icons + fallbacks)
function skullIcon(c: C2D, tier: number, gem: string): void {
  c.save();
  c.globalCompositeOperation = 'lighter';
  glowDot(c, 0, 2, 28, SOUL_RGB, tier >= 4 ? 0.45 : tier >= 2 ? 0.3 : 0.12);
  c.globalCompositeOperation = 'source-over';
  if (tier >= 4) {
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const fx = (i - 1) * 7, fh = 14 + (i === 1 ? 6 : 0);
      const g = c.createLinearGradient(fx, -30, fx, -8);
      g.addColorStop(0, `rgba(${SOUL_RGB},0)`); g.addColorStop(1, `rgba(${SOUL_RGB},0.85)`);
      c.fillStyle = g; c.beginPath(); c.moveTo(fx - 4, -10); c.quadraticCurveTo(fx - 2, -10 - fh * 0.6, fx + 1, -10 - fh); c.quadraticCurveTo(fx + 3, -10 - fh * 0.5, fx + 4, -10); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  }
  skull(c, 0, 2, 15, { col: tier >= 4 ? '#ece6d6' : tier >= 2 ? '#ddd3b8' : '#b8a47c', eyes: tier >= 2 ? SOUL_RGB : undefined, eyeA: 0.9, jaw: tier >= 4 ? 0.3 : 0, line: 1.1 });
  if (tier <= 1) {
    c.strokeStyle = '#3a2a18'; c.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 3.5, 11); c.lineTo(i * 3.5, 16); c.stroke(); }
    c.strokeStyle = '#241a10'; c.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-4 + i * 3, -12); c.quadraticCurveTo(-10 + i * 3, -20, -14 + i * 4, -16 + i); c.stroke(); }
    c.fillStyle = 'rgba(120,255,170,0.5)'; for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * 5.7, 2.6, 1.3, 0, TAU); c.fill(); }
  } else if (tier < 4) {
    c.strokeStyle = `rgba(${SOUL_RGB},0.9)`; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-6, -7); c.lineTo(0, -12); c.lineTo(6, -7); c.moveTo(0, -12); c.lineTo(0, -4); c.moveTo(-9, -3); c.lineTo(-6, -7); c.moveTo(9, -3); c.lineTo(6, -7); c.stroke();
  } else {
    c.fillStyle = BONE_HI; c.strokeStyle = BONE_LINE; c.lineWidth = 0.8;
    for (let i = -2; i <= 2; i++) { const bx = i * 5.4, h = i === 0 ? 12 : Math.abs(i) === 1 ? 9 : 6; c.beginPath(); c.moveTo(bx - 2.4, -11); c.lineTo(bx, -11 - h); c.lineTo(bx + 2.4, -11); c.closePath(); c.fill(); c.stroke(); }
    c.fillStyle = '#62ffb0'; c.beginPath(); c.arc(0, -8.5, 2, 0, TAU); c.fill();
  }
  // rarity gem set in the brow
  if (gem !== '#909090') { c.fillStyle = gem; c.beginPath(); c.arc(0, tier >= 4 ? -3 : -5, 1.8, 0, TAU); c.fill(); }
  c.restore();
}

OFFHAND_ART.skull = {
  draw(c, x, y, tier, p) { heldSkull(c, x, y, tier, p.cast >= 0 ? 0.6 : 0, p.t); },
  icon(c, tier, gem) { skullIcon(c, tier, gem); },
};

/** Inventory icon of a scythe (64×64, origin at the centre): a diagonal snath and a wide crescent blade. */
function scytheIcon(c: C2D, tier: number, gem: string): void {
  const t3 = tier >= 3, t4 = tier >= 4;
  c.save();
  c.lineCap = 'round';
  if (t4) { c.globalCompositeOperation = 'lighter'; glowDot(c, -2, -14, 30, SOUL_RGB, 0.35); c.globalCompositeOperation = 'source-over'; }
  // snath
  const x0 = -19, y0 = 28, x1 = 13, y1 = -22;
  c.strokeStyle = '#0e0b09'; c.lineWidth = 5.2;
  c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(-6, 4, x1, y1); c.stroke();
  c.strokeStyle = t4 ? '#2a2632' : t3 ? '#342c26' : '#6e5236'; c.lineWidth = 3.4;
  c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(-6, 4, x1, y1); c.stroke();
  c.strokeStyle = 'rgba(255,240,220,0.3)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x0 - 1, y0 - 1.5); c.quadraticCurveTo(-7.5, 3, x1 - 1.2, y1 - 0.5); c.stroke();
  // nib handle
  c.strokeStyle = '#0e0b09'; c.lineWidth = 3.6; c.beginPath(); c.moveTo(-6, 8); c.lineTo(1, 13); c.stroke();
  c.strokeStyle = t3 ? BONE : '#8a6a44'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-6, 8); c.lineTo(1, 13); c.stroke();
  if (t3) for (const [x, y] of [[-15, 21], [-3, 1], [8, -14]] as [number, number][]) { c.fillStyle = BONE; c.strokeStyle = BONE_LINE; c.lineWidth = 0.8; c.beginPath(); c.ellipse(x, y, 3.2, 2, -0.9, 0, TAU); c.fill(); c.stroke(); }
  if (t4) { c.strokeStyle = `rgba(${SOUL_RGB},0.9)`; c.lineWidth = 1; c.beginPath(); c.moveTo(-10, 14); c.lineTo(-7, 10); c.lineTo(-10, 7); c.moveTo(2, -6); c.lineTo(5, -10); c.lineTo(2, -13); c.stroke(); }
  // blade
  const blade = new Path2D();
  blade.moveTo(x1 + 3, y1 - 3);
  blade.quadraticCurveTo(-6, -33, -28, -10);
  blade.quadraticCurveTo(-8, -21, x1 - 1, y1 + 4);
  blade.closePath();
  const bg = c.createLinearGradient(0, -30, 0, -12);
  if (t4) { bg.addColorStop(0, '#6a6878'); bg.addColorStop(0.5, '#2a2934'); bg.addColorStop(1, '#101016'); }
  else if (t3) { bg.addColorStop(0, BONE_HI); bg.addColorStop(0.55, BONE); bg.addColorStop(1, BONE_DK); }
  else { bg.addColorStop(0, '#e2e6ee'); bg.addColorStop(0.55, '#9aa0aa'); bg.addColorStop(1, '#565a62'); }
  c.fillStyle = bg; c.fill(blade);
  c.strokeStyle = t3 && !t4 ? BONE_LINE : '#121318'; c.lineWidth = 1.1; c.stroke(blade);
  c.strokeStyle = t4 ? `rgba(${SOUL_RGB},1)` : 'rgba(255,255,255,0.9)'; c.lineWidth = t4 ? 1.8 : 1.2;
  c.beginPath(); c.moveTo(-27, -10.5); c.quadraticCurveTo(-8, -20.5, x1 - 2, y1 + 3.5); c.stroke();
  if (t4) { c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(${SOUL_RGB},0.4)`; c.lineWidth = 5; c.beginPath(); c.moveTo(-27, -10.5); c.quadraticCurveTo(-8, -20.5, x1 - 2, y1 + 3.5); c.stroke(); c.globalCompositeOperation = 'source-over'; }
  if (t3 && !t4) { c.fillStyle = BONE_DK; for (let i = 1; i < 5; i++) { const u = i / 5; const ex = -27 + (x1 - 2 + 27) * u, ey = -10.5 + (y1 + 3.5 + 10.5) * u - Math.sin(u * Math.PI) * 5.5; c.beginPath(); c.moveTo(ex - 1.6, ey); c.lineTo(ex, ey + 2.6); c.lineTo(ex + 1.6, ey); c.fill(); } }
  // the joint: a skull on the better scythes, a binding otherwise
  if (t3) skull(c, x1 + 1, y1 + 1, 4.6, { col: t4 ? '#d8cfb8' : BONE, eyes: SOUL_RGB, eyeA: 0.9, line: 0.7 });
  else { c.fillStyle = '#2a2018'; c.fillRect(x1 - 3, y1 - 2, 6, 5); c.fillStyle = '#8a6a44'; c.fillRect(x1 - 3, y1, 6, 1.2); }
  if (gem !== '#909090') { c.fillStyle = gem; c.beginPath(); c.arc(-4.5, 5.5, 2, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(-5.1, 4.9, 0.7, 0, TAU); c.fill(); }
  c.restore();
}

WEAPON_ART.scythe = {
  style: 'slash', heavy: true,
  // generic rig fallback (the necromancer's own look paints the scythe itself): snath out of the fist along +y
  draw(c, tier, _steel, _edge, L, glow) {
    c.save(); c.rotate(Math.PI); c.scale(L(1), L(1));
    drawScythe(c, tier, 0.8, 0, 0, glow);
    c.restore();
  },
  icon(c, tier, gem) { scytheIcon(c, tier, gem); },
};
