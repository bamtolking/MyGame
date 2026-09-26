// lancer: hero look — blue steel storm dragoon. Armour by chest tier (padded jack → blued mail → steel scale →
// cobalt plate with a dragon sigil → storm-dragon plate with glowing seams), dragoon helms by helm tier (arming cap →
// winged sallet → dragoon helm → dragon great helm with a plume → horned storm helm with a lightning crest),
// a long blue cloak, pauldrons, vambraces, and the lance (drawn by the decor so every skill can pose it freely:
// guard, level thrust, whirl, overhead javelin, point-down dragon dive).
import { BASE_BY_ID } from '../../data/items';
import type { Look, Pose } from '../../render/actors';
import { CLASS_LOOK, DECOR, ITEM_KIND, OFFHAND_ART, WEAPON_ART, type RigAnchors } from '../../render/registry';
import type { EquipSlot, Hero } from '../../sim/types';
import { STORM_FAN, SWEEP } from './shared';

type C2D = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const ease = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const tierOf = (t: number): number => Math.max(0, Math.min(4, t | 0));

/** Hex colour lightened (k > 0) or darkened (k < 0), still as hex (render/iso shade() returns rgb()). */
export function tone(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number): string => { const x = Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)); return Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0'); };
  return '#' + ch((n >> 16) & 255) + ch((n >> 8) & 255) + ch(n & 255);
}

// ================================================================ palette
export const STORM_CYAN = '#8ad8ff', STORM_WHITE = '#eaf8ff', SILVER = '#dfe8f2';
/** [torso, legs, trim, upper arm] by chest tier + 1 (none … storm-dragon plate). */
const ARMOR: [string, string, string, string][] = [
  ['#2e3f58', '#283446', '#6f8fb8', '#27364c'],
  ['#35506f', '#2b384c', '#8aa6c8', '#2d4460'],
  ['#6c7f99', '#394659', '#b8c8dc', '#56687f'],
  ['#7f98ba', '#46566e', '#d0dcea', '#62789a'],
  ['#3f6094', '#2e3e5a', '#d8e4f0', '#34507c'],
  ['#2a4f86', '#233250', STORM_CYAN, '#223f6c'],
];
const CLOAK = ['#26395c', '#27406a', '#223f70', '#1f3f78', '#1c3a74', '#173263'];
/** Helm steel by tier: [light, mid, dark]. */
const HELM: [string, string, string][] = [
  ['#5a6f92', '#3a4a66', '#222c3e'],
  ['#d4dde8', '#98a8bc', '#4c586c'],
  ['#c8d6e8', '#8298b6', '#3c4a62'],
  ['#9ab4dc', '#5a78a8', '#26365a'],
  ['#6a86b8', '#2c4270', '#121c34'],
];
const GLOVE = ['#4a3a2e', '#5a4636', '#8c9aae', '#8c9aae', '#6a86b0', '#34507c'];

// ================================================================ state carried on the Look
interface LnState {
  /** Active skill ('' idle; 'thrust', 'pierce', …) and its progress 0..1 / elapsed seconds. */
  act: string; k: number; at: number;
  ct: number; ht: number; gt: number;
  /** Lance tier (-1: unarmed). */
  wt: number;
  /** Rarity glow of the lance, if any. */
  wg?: string;
  /**
   * The aim as the side-view rig can show it: screen pitch of the facing below the horizontal (+ toward the viewer,
   * − away from it, clamped) and the foreshortened length of a level lance along it (1 across the screen … 0.5 straight
   * toward / away from the viewer, clamped). Level lances (thrusts, storm jabs, the javelin) tilt along it.
   */
  pitch: number; fore: number;
}
type LnLook = Look & { ln?: LnState };

function slotTier(h: Hero, s: EquipSlot): number {
  const it = h.equip[s];
  return it && it.req <= h.level ? BASE_BY_ID[it.base]?.tier ?? -1 : -1;
}

ITEM_KIND.spear = 'lance';

CLASS_LOOK.lancer = (h, common, ct) => {
  const t = Math.max(-1, Math.min(4, ct));
  const [body, legs, trim, arm] = ARMOR[t + 1];
  const a = h.act;
  const act = a ? a.skill.replace(/^ln_/, '') : '';
  const k = a ? clamp01(a.t / Math.max(1e-3, a.dur)) : 0;
  const ht = common.helm ?? -1;
  const lance = common.weapon === 'lance';
  const wt = lance ? tierOf(common.wTier ?? 0) : -1;
  // the rig only animates the arm/body; the lance itself is painted by the decor (weapon kinds below draw nothing)
  let weapon = lance ? 'ln_grip' : common.weapon ?? 'none';
  if (lance && act === 'javelin') weapon = 'ln_gripThrow';
  else if (lance && act === 'dragon') weapon = 'ln_gripDive';
  const bt = slotTier(h, 'boots');
  // screen direction of the aim (render/iso: x−y across, (x+y)/2 down) → pitch of a level lance and its length.
  // Only while acting: portraits (class select) animate attacks without an act and stay in pure side view.
  const f = a && Number.isFinite(h.facing) ? h.facing : -Math.PI / 4;
  const fx = Math.cos(f) - Math.sin(f), fy = (Math.cos(f) + Math.sin(f)) * 0.5;
  const pitch = Math.max(-AIM.pitch, Math.min(AIM.pitch, Math.atan2(fy, Math.abs(fx))));
  const fore = Math.max(AIM.fore, Math.min(1, Math.hypot(fx, fy) / Math.SQRT2));
  const L: LnLook = {
    skin: '#e2b896', hair: '#1c2231', eyes: '#3e7cc0', beard: undefined,
    body, body2: arm, legs,
    boots: bt >= 1 ? tone(HELM[Math.min(4, bt)][1], -0.35) : bt >= 0 ? '#3a2c24' : '#2e2622',
    head: 'human', helm: -1, build: 1.04, height: 1.12,
    weapon, wTier: common.wTier ?? 0, wGlow: common.wGlow,
    offhand: 'ln_rig', offTier: 0,
    armorTier: t === 1 ? 1 : -1, trim: undefined,
    decor: 'ln_dragoon', decorColor: trim, decorColor2: CLOAK[t + 1],
    ln: { act, k, at: a ? a.t : 0, ct: t, ht, gt: slotTier(h, 'gloves'), wt, wg: common.wGlow, pitch, fore },
  };
  if (ht >= 1) L.hair = undefined;
  return L;
};

// ================================================================ rig mirror (same maths as render/actors drawBiped)
function armRest(p: Pose): number {
  const sw = p.moving ? Math.sin(p.walk * 4.2) : 0;
  return 0.12 + (p.moving ? -sw * 0.35 : Math.sin(p.t * 2) * 0.03);
}
/** Front upper-arm angle a and forearm angle fa (0 = straight down, π/2 = forward). */
function frontArm(p: Pose, style: 'thrust' | 'slash', heavy: boolean): { a: number; fa: number } {
  const rest = armRest(p);
  let a = rest;
  if (p.atk >= 0) {
    const t = p.atk;
    if (style === 'thrust') {
      if (t < 0.4) a = rest + 0.5 - ease(t / 0.4) * 0.35;
      else if (t < 0.6) a = rest + 0.15 + ease((t - 0.4) / 0.2) * (1.45 - rest - 0.15);
      else a = 1.45 - ease((t - 0.6) / 0.4) * (1.45 - rest);
    } else {
      const up = heavy ? 2.9 : 2.6, dn = heavy ? 3.4 : 3.1;
      if (t < 0.4) a = rest + ease(t / 0.4) * up;
      else if (t < 0.6) a = rest + up - ease((t - 0.4) / 0.2) * dn;
      else a = rest - 0.5 + ease((t - 0.6) / 0.4) * 0.5;
    }
  }
  if (p.cast >= 0) a = 1.3 + ease(p.cast * 2) * 0.8;
  return { a, fa: style === 'thrust' && p.atk >= 0 ? a + 0.05 : a + 0.3 };
}
function backArm(p: Pose, heavy: boolean): number {
  let b = armRest(p) + 0.1;
  if (p.cast >= 0) b = 1.2 + ease(p.cast * 2) * 0.6;
  if (p.atk >= 0 && heavy) b = 1.0 + Math.sin(Math.min(1, p.atk) * Math.PI) * 0.8;
  if ((p.block ?? 0) > 0) b = 1.25; // the lancer's second hand on the shaft (see remapPose)
  return b;
}
/** Arm style and heaviness the rig uses for a weapon kind (mirrors render/actors drawBiped). */
const styleOf = (w: string): 'thrust' | 'slash' => (WEAPON_ART[w]?.style ?? (w === 'spear' ? 'thrust' : 'slash')) === 'thrust' ? 'thrust' : 'slash';
const HEAVY = new Set(['sword2h', 'axe2h', 'hammer', 'club', 'cleaver']);
const heavyOf = (w: string): boolean => HEAVY.has(w) || !!WEAPON_ART[w]?.heavy;

/** Hand position of the front arm, computed exactly like the rig. */
function handAt(a: RigAnchors, arm: { a: number; fa: number }): { ex: number; ey: number; hx: number; hy: number } {
  const armL = 17 * a.height;
  const sx = a.shX + 2, sy = a.shY + 2.2;
  const ex = sx + Math.sin(arm.a) * armL * 0.52, ey = sy + Math.cos(arm.a) * armL * 0.52;
  return { ex, ey, hx: ex + Math.sin(arm.fa) * armL * 0.5, hy: ey + Math.cos(arm.fa) * armL * 0.5 };
}

/** Dragon's descent pose timeline (fractions of the leap): arm up by `up`, lance upright until k0, plunged by k1. */
const DIVE = { up: 0.16, k0: 0.56, k1: 0.72, upright: 2.62 };
/** Aim tilt limits: the most a level lance tilts toward / away from the viewer, and its shortest foreshortened length. */
const AIM = { pitch: 1.1, fore: 0.6 };

// ================================================================ pose remap (engine has no per-skill pose hook)
/**
 * Rewrites p.atk (and p.block, which the rig uses to bring the back arm forward: here the second hand on the shaft)
 * for the lancer's skills. Runs in the decor's back layer, before the rig computes the arms.
 */
function remapPose(p: Pose, s: LnState): void {
  const k = s.k;
  const grip = (): void => { if (p.atk >= 0.56 && p.atk <= 0.74) p.block = 1; };
  switch (s.act) {
    case '': case 'thrust':
      grip();
      break;
    case 'pierce':
      // full extension exactly at the strike (k = 0.5), held while the streak flies, then recover
      if (p.atk >= 0) p.atk = k < 0.5 ? (k / 0.5) * 0.6 : k < 0.74 ? 0.6 : 0.6 + ((k - 0.74) / 0.26) * 0.4;
      grip();
      break;
    case 'sweep':
      // arm held out front while the lance whirls around the hand (see lanceSweep)
      if (p.atk >= 0) { const k1 = SWEEP.k1, k0 = SWEEP.k0 - 0.1; p.atk = k < k0 ? (k / k0) * 0.5 : k < k1 ? 0.5 : 0.5 + ((k - k1) / (1 - k1)) * 0.5; }
      break;
    case 'javelin':
      // overhand throw: cock high behind (slash windup), snap forward to release at k = 0.5, follow through
      if (p.atk >= 0) p.atk = k < 0.4 ? 0.4 * ease(k / 0.4) : k < 0.5 ? 0.4 + ((k - 0.4) / 0.1) * 0.07 : 0.47 + ((k - 0.5) / 0.5) * 0.53;
      break;
    case 'dragon':
      // leap: the renderer gives no attack pose. Going up the arm comes forward to shoulder height and carries the
      // lance upright (heavy-slash windup t = 0.2: arm level); over the top it is driven down in front (t 0.488 →
      // 0.52 lowers the arm from that same level angle to forward-down). The hand never goes overhead: at the top of
      // the leap an overhead lance would leave the renderer's actor box (see actorBox).
      p.atk = k < DIVE.up ? 0.2 * ease(k / DIVE.up) : k < DIVE.k0 ? 0.2 : k < DIVE.k1 ? 0.488 + ease((k - DIVE.k0) / (DIVE.k1 - DIVE.k0)) * 0.032 : 0.52;
      if (k > 0.6) p.block = 1;
      break;
    case 'storm':
      // both hands forward on a level lance; the nine 7 Hz thrusts piston the lance through the grip (heldLance)
      p.atk = 0.62; p.block = 1;
      break;
  }
}

// ================================================================ lance art
interface LanceSpec { shaft: string; shaftW: number; butt: number; head: number; tip: number; band: string; blade: string }
/** Local units: origin in the fist, +y toward the tip. */
const LANCE: LanceSpec[] = [
  { shaft: '#8a6440', shaftW: 1.8, butt: -22, head: 29, tip: 40, band: '#6a6e78', blade: '#c4c8ce' },
  { shaft: '#5e4028', shaftW: 1.9, butt: -22, head: 29, tip: 41, band: '#9aa4b2', blade: '#ccd4de' },
  { shaft: '#2a3a58', shaftW: 2.0, butt: -22, head: 28, tip: 42, band: '#c8d2de', blade: '#d6dfe9' },
  { shaft: '#23427a', shaftW: 2.1, butt: -22, head: 28, tip: 43, band: SILVER, blade: '#e0eaf6' },
  { shaft: '#1a2742', shaftW: 2.2, butt: -22, head: 27, tip: 44, band: '#b8c8e0', blade: '#eef6ff' },
];

export interface LanceOpts {
  /** Rarity glow colour. */
  glow?: string;
  /** Electric charge 0..1 (skills). Tier 4 always crackles a little. */
  charge?: number;
  /** Animation time (s). */
  t?: number;
  /** Low effects: skip the crackle. */
  low?: boolean;
  /** Socket gem colour (icons: rarity). */
  gem?: string;
}

function bladePath(c: C2D, tier: number, L: (n: number) => number, sp: LanceSpec): void {
  const h0 = L(sp.head), tip = L(sp.tip);
  c.beginPath();
  switch (tier) {
    case 0: { // leaf blade
      const w = L(2.5);
      c.moveTo(-L(1.1), h0); c.quadraticCurveTo(-w, h0 + (tip - h0) * 0.35, -L(0.4), tip - L(1.5)); c.lineTo(0, tip);
      c.lineTo(L(0.4), tip - L(1.5)); c.quadraticCurveTo(w, h0 + (tip - h0) * 0.35, L(1.1), h0); break;
    }
    case 1: { // partisan: broad blade with two flared lugs at the base
      const w = L(2.6);
      c.moveTo(-L(1.2), h0); c.lineTo(-L(4.2), h0 - L(1.2)); c.lineTo(-L(3.2), h0 + L(1.4)); c.lineTo(-w, h0 + L(2.2));
      c.lineTo(-L(0.5), tip - L(2)); c.lineTo(0, tip); c.lineTo(L(0.5), tip - L(2)); c.lineTo(w, h0 + L(2.2));
      c.lineTo(L(3.2), h0 + L(1.4)); c.lineTo(L(4.2), h0 - L(1.2)); c.lineTo(L(1.2), h0); break;
    }
    case 2: { // glaive-lance: long narrow blade, back hook
      const w = L(2.1);
      c.moveTo(-L(1.1), h0); c.lineTo(-L(3.6), h0 + L(0.4)); c.lineTo(-L(2.4), h0 + L(2.4)); c.lineTo(-w, h0 + L(3.6));
      c.lineTo(-L(0.5), tip - L(2.2)); c.lineTo(0, tip); c.lineTo(L(0.9), tip - L(3)); c.quadraticCurveTo(L(2.6), h0 + L(5), L(1.1), h0); break;
    }
    case 3: { // dragon lance: central blade with swept-back dragon-wing side blades
      const w = L(2.2);
      c.moveTo(-L(1.2), h0); c.quadraticCurveTo(-L(4.8), h0 + L(1), -L(5.6), h0 - L(3.2)); c.quadraticCurveTo(-L(3.2), h0 + L(1.4), -w, h0 + L(3.6));
      c.lineTo(-L(0.5), tip - L(2.4)); c.lineTo(0, tip); c.lineTo(L(0.5), tip - L(2.4)); c.lineTo(w, h0 + L(3.6));
      c.quadraticCurveTo(L(3.2), h0 + L(1.4), L(5.6), h0 - L(3.2)); c.quadraticCurveTo(L(4.8), h0 + L(1), L(1.2), h0); break;
    }
    default: { // storm lance: jagged lightning blade with crescent prongs
      c.moveTo(-L(1.2), h0); c.quadraticCurveTo(-L(5.4), h0 + L(0.2), -L(5.2), h0 + L(4.4)); c.quadraticCurveTo(-L(3.6), h0 + L(2), -L(2.3), h0 + L(3));
      c.lineTo(-L(1.2), h0 + L(6.5)); c.lineTo(-L(2.4), h0 + L(7.4)); c.lineTo(-L(0.9), h0 + L(11.5)); c.lineTo(-L(1.8), h0 + L(12));
      c.lineTo(0, tip); c.lineTo(L(1.6), tip - L(5.5)); c.lineTo(L(0.6), tip - L(6)); c.lineTo(L(2.2), h0 + L(6)); c.lineTo(L(1.1), h0 + L(5.4));
      c.lineTo(L(2.3), h0 + L(3)); c.quadraticCurveTo(L(3.6), h0 + L(2), L(5.2), h0 + L(4.4)); c.quadraticCurveTo(L(5.4), h0 + L(0.2), L(1.2), h0);
    }
  }
  c.closePath();
}

/** Tiny animated zigzag arcs crawling over the lance head. */
function crackle(c: C2D, L: (n: number) => number, sp: LanceSpec, t: number, n: number, a: number): void {
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
  let seed = Math.floor(t * 24) * 7 + 3;
  const rnd = (): number => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 - 0.5; };
  for (let i = 0; i < n; i++) {
    const y0 = L(sp.head - 8 + (rnd() + 0.5) * 18), len = L(6 + (rnd() + 0.5) * 8);
    c.strokeStyle = `rgba(140,220,255,${0.55 * a})`; c.lineWidth = L(1.3);
    c.beginPath(); c.moveTo(rnd() * L(3), y0);
    for (let s = 1; s <= 4; s++) c.lineTo(rnd() * L(7), y0 + (len * s) / 4);
    c.stroke();
    c.strokeStyle = `rgba(240,252,255,${0.9 * a})`; c.lineWidth = L(0.5); c.stroke();
  }
  c.restore();
}

/** The lance in local space (origin in the fist, +y toward the tip). `s` scales lengths. */
export function drawLance(c: C2D, tier: number, s: number, o: LanceOpts = {}): void {
  const T = tierOf(tier), sp = LANCE[T];
  const L = (n: number): number => n * s;
  const t = o.t ?? 0, charge = clamp01(o.charge ?? 0);
  const w = L(sp.shaftW);
  c.save();
  if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = 5; }
  // ---- shaft
  const sg = c.createLinearGradient(-w / 2, 0, w / 2, 0);
  sg.addColorStop(0, tone(sp.shaft, 0.4)); sg.addColorStop(0.45, sp.shaft); sg.addColorStop(1, tone(sp.shaft, -0.5));
  c.fillStyle = sg;
  c.beginPath(); c.moveTo(-w / 2, L(sp.butt)); c.lineTo(w / 2, L(sp.butt)); c.lineTo(w * 0.42, L(sp.head)); c.lineTo(-w * 0.42, L(sp.head)); c.closePath(); c.fill();
  c.shadowBlur = 0;
  if (T === 0) { // grain
    c.strokeStyle = 'rgba(40,24,10,0.35)'; c.lineWidth = L(0.3);
    c.beginPath(); c.moveTo(-w * 0.15, L(sp.butt + 3)); c.lineTo(w * 0.1, L(sp.head - 4)); c.stroke();
  }
  // grip wrap around the hand
  c.fillStyle = T >= 3 ? '#1a2238' : '#3e2c20';
  c.fillRect(-w * 0.62, -L(4), w * 1.24, L(9));
  c.strokeStyle = T >= 3 ? 'rgba(160,190,230,0.55)' : 'rgba(120,90,60,0.7)'; c.lineWidth = L(0.35);
  c.beginPath(); for (let y = -4; y < 5; y += 1.6) { c.moveTo(-w * 0.62, L(y)); c.lineTo(w * 0.62, L(y + 1.1)); } c.stroke();
  // bands
  c.fillStyle = sp.band;
  const bands = T === 0 ? [] : T === 1 ? [-12, 18] : T === 2 ? [-14, -6, 12, 20] : [-15, -8, 10, 16, 22];
  for (const y of bands) c.fillRect(-w * 0.62, L(y), w * 1.24, L(T >= 3 ? 1.1 : 0.9));
  // butt spike / ferrule
  c.fillStyle = T >= 3 ? sp.band : '#6a6e76';
  c.beginPath(); c.moveTo(-w * 0.62, L(sp.butt + 2.2)); c.lineTo(w * 0.62, L(sp.butt + 2.2)); c.lineTo(w * 0.35, L(sp.butt)); c.lineTo(0, L(sp.butt - (T >= 2 ? 3.2 : 1.6))); c.lineTo(-w * 0.35, L(sp.butt)); c.closePath(); c.fill();
  // storm runes glowing along the shaft
  if (T >= 4) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const pulse = 0.6 + 0.4 * Math.sin(t * 5);
    c.strokeStyle = `rgba(120,210,255,${0.55 * pulse + 0.35 * charge})`; c.lineWidth = L(0.55);
    c.beginPath();
    for (let y = -18; y < 24; y += 7) { c.moveTo(0, L(y)); c.lineTo(-w * 0.3, L(y + 1.5)); c.lineTo(w * 0.3, L(y + 3)); c.lineTo(0, L(y + 4.5)); }
    c.stroke(); c.restore();
  }
  // ---- tassel / ribbon under the head (tier 1-3)
  if (T >= 1 && T <= 3) {
    const sway = Math.sin(t * 3.2) * L(1.2);
    c.strokeStyle = T === 1 ? '#3a64a8' : '#2d5cb0'; c.lineWidth = L(T === 1 ? 1.4 : 1.1); c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, L(sp.head - 1.5)); c.quadraticCurveTo(-L(3) + sway, L(sp.head - 5), -L(4.5) + sway * 1.6, L(sp.head - 10)); c.stroke();
    c.beginPath(); c.moveTo(0, L(sp.head - 1.5)); c.quadraticCurveTo(-L(1.5) + sway, L(sp.head - 6), -L(2) + sway * 1.3, L(sp.head - 11)); c.stroke();
  }
  // ---- socket / collar
  const sock = c.createLinearGradient(-L(2), 0, L(2), 0);
  sock.addColorStop(0, tone(sp.band, 0.3)); sock.addColorStop(1, tone(sp.band, -0.45));
  c.fillStyle = sock;
  c.beginPath(); c.moveTo(-w * 0.5, L(sp.head - 3.5)); c.lineTo(w * 0.5, L(sp.head - 3.5)); c.lineTo(L(1.3), L(sp.head + 0.6)); c.lineTo(-L(1.3), L(sp.head + 0.6)); c.closePath(); c.fill();
  if (T >= 3) { // dragon-head collar with a sapphire
    c.fillStyle = tone(sp.band, -0.2);
    c.beginPath(); c.moveTo(-L(2.4), L(sp.head - 1.2)); c.lineTo(-L(1.2), L(sp.head - 3.6)); c.lineTo(L(1.2), L(sp.head - 3.6)); c.lineTo(L(2.4), L(sp.head - 1.2)); c.lineTo(0, L(sp.head + 0.8)); c.closePath(); c.fill();
    const gem = o.gem ?? (T >= 4 ? STORM_CYAN : '#3a7aff');
    c.save(); c.shadowColor = gem; c.shadowBlur = T >= 4 ? 6 : 3;
    c.fillStyle = gem; c.beginPath(); c.arc(0, L(sp.head - 1.6), L(0.95), 0, TAU); c.fill(); c.restore();
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(-L(0.4), L(sp.head - 2.2), L(0.4), L(0.4));
  }
  // ---- blade (a touch broader than the path's base proportions)
  c.save(); c.scale(1.18, 1);
  bladePath(c, T, L, sp);
  const bg = c.createLinearGradient(-L(3), 0, L(3), 0);
  bg.addColorStop(0, tone(sp.blade, 0.5)); bg.addColorStop(0.48, sp.blade); bg.addColorStop(0.52, tone(sp.blade, -0.25)); bg.addColorStop(1, tone(sp.blade, -0.55));
  if (o.glow || T >= 3 || charge > 0) { c.shadowColor = charge > 0.05 || T >= 4 ? STORM_CYAN : o.glow ?? '#6aa8ff'; c.shadowBlur = T >= 4 ? 7 + charge * 6 : 3 + charge * 8; }
  c.fillStyle = bg; c.fill();
  c.shadowBlur = 0;
  c.strokeStyle = T >= 4 ? 'rgba(160,230,255,0.9)' : 'rgba(30,40,60,0.55)'; c.lineWidth = L(0.35); c.stroke();
  // fuller / ridge
  c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = L(0.4);
  c.beginPath(); c.moveTo(-L(0.25), L(sp.head + 1)); c.lineTo(-L(0.1), L(sp.tip - 2.5)); c.stroke();
  if (T >= 2) { c.strokeStyle = 'rgba(40,60,100,0.5)'; c.beginPath(); c.moveTo(L(0.3), L(sp.head + 1.5)); c.lineTo(L(0.2), L(sp.tip - 3)); c.stroke(); }
  c.restore();
  // ---- electric glow on the head
  const e = Math.max(charge, T >= 4 ? 0.35 : T === 3 ? 0.12 : 0);
  if (e > 0) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const cy = L((sp.head + sp.tip) / 2), R = L(8 + 7 * e);
    const g = c.createRadialGradient(0, cy, 0, 0, cy, R);
    g.addColorStop(0, `rgba(200,240,255,${0.55 * e})`); g.addColorStop(0.4, `rgba(90,180,255,${0.3 * e})`); g.addColorStop(1, 'rgba(60,120,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, cy, R, 0, TAU); c.fill();
    c.restore();
    if (!o.low && (T >= 4 || charge > 0.15)) crackle(c, L, sp, t, charge > 0.5 ? 3 : T >= 4 ? 2 : 1, Math.max(e, 0.5));
  }
  c.restore();
}

// weapon kinds: 'lance' for items / generic draws; the grips animate the hero rig without painting (the decor paints the lance)
WEAPON_ART.lance = {
  style: 'thrust',
  draw(c, tier, _steel, _edge, L, glow) { drawLance(c, tier, L(1), { glow }); },
  icon(c, tier, gem) {
    c.save(); c.rotate(-Math.PI * 0.75); c.scale(1.3, 1); c.translate(0, -L0(tier) * 1.12);
    drawLance(c, tier, 1.12, { gem: gem === '#909090' ? undefined : gem, t: 0.4, low: false, charge: tier >= 4 ? 0.25 : 0 });
    c.restore();
  },
};
/** Centre offset of the lance along its axis (icons). */
function L0(tier: number): number { const sp = LANCE[tierOf(tier)]; return (sp.butt + sp.tip) / 2; }
const nothing = (): void => { /* painted by DECOR.ln_dragoon */ };
WEAPON_ART.ln_grip = { style: 'thrust', draw: nothing };
WEAPON_ART.ln_gripThrow = { style: 'slash', draw: nothing };
WEAPON_ART.ln_gripDive = { style: 'slash', heavy: true, draw: nothing };

// ================================================================ small drawing helpers
function seg(c: C2D, x0: number, y0: number, x1: number, y1: number, w: number, col: string): void {
  c.lineCap = 'round';
  c.strokeStyle = tone(col, -0.45); c.lineWidth = w + 0.9;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.strokeStyle = col; c.lineWidth = w;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  const l = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / l, ny = (x1 - x0) / l;
  const sg = nx + ny < 0 ? 1 : -1, o = w * 0.22 * sg;
  c.strokeStyle = tone(col, 0.35); c.lineWidth = w * 0.3;
  c.beginPath(); c.moveTo(x0 + nx * o, y0 + ny * o); c.lineTo(x1 + nx * o, y1 + ny * o); c.stroke();
}

function torsoPath(c: C2D, a: RigAnchors): void {
  const b = a.build, ww = 6.2 * b, sw2 = 7.4 * b;
  c.beginPath(); c.moveTo(-ww, a.hipY + 2); c.lineTo(ww, a.hipY + 2); c.lineTo(a.shX + sw2, a.shY + 2);
  c.quadraticCurveTo(a.shX, a.shY - 3, a.shX - sw2, a.shY + 2); c.closePath();
}

/** Storm-dragon sigil: a lightning bolt between two swept wings. */
export function sigil(c: C2D, x: number, y: number, s: number, col: string, glow: number): void {
  c.save();
  if (glow > 0) { c.shadowColor = STORM_CYAN; c.shadowBlur = 4 * glow; }
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(x + s * 0.25, y - s * 1.2); c.lineTo(x - s * 0.45, y + s * 0.1); c.lineTo(x + s * 0.05, y + s * 0.1);
  c.lineTo(x - s * 0.3, y + s * 1.25); c.lineTo(x + s * 0.5, y - s * 0.25); c.lineTo(x, y - s * 0.25); c.lineTo(x + s * 0.4, y - s * 1.2); c.closePath(); c.fill();
  for (const d of [-1, 1]) {
    c.beginPath(); c.moveTo(x + d * s * 0.45, y - s * 0.2);
    c.quadraticCurveTo(x + d * s * 1.3, y - s * 1.1, x + d * s * 1.7, y - s * 0.9);
    c.quadraticCurveTo(x + d * s * 1.25, y - s * 0.45, x + d * s * 1.5, y - s * 0.1);
    c.quadraticCurveTo(x + d * s * 1.0, y - s * 0.05, x + d * s * 0.5, y + s * 0.35); c.closePath(); c.fill();
  }
  c.restore();
}

// ================================================================ cloak
function cloakBehind(c: C2D, p: Pose, a: RigAnchors, s: LnState, col: string, trim: string): void {
  const b = a.build;
  const mv = p.moving ? 1 : 0;
  const ph = p.walk * 4.2;
  const air = s.act === 'dragon' ? Math.sin(s.k * Math.PI) : 0;
  const fall = s.act === 'dragon' && s.k > 0.5 ? (s.k - 0.5) * 2 : 0;
  const whirl = s.act === 'sweep' ? Math.sin(clamp01((s.k - SWEEP.k0) / (SWEEP.k1 - SWEEP.k0)) * Math.PI) : 0;
  const lunge = s.act === 'storm' || s.act === 'pierce' ? 1 : 0;
  const fl = mv ? Math.sin(ph * 0.5 + 0.6) * 1.8 : Math.sin(p.t * 1.6) * 0.6;
  const trail = mv * 6 + whirl * 8 + lunge * 3;
  const lift = mv * 2.5 + air * 10 + fall * 12 + whirl * 5;
  const x0 = a.shX - 5.4 * b, y0 = a.shY + 1, x1 = a.shX + 3.4, y1 = a.shY + 0.4;
  const bl = -12 * b - trail + fl, blY = -1.5 - lift, br = 3 - trail * 0.25;
  const g = c.createLinearGradient(bl, 0, x1, 0);
  g.addColorStop(0, tone(col, -0.6)); g.addColorStop(0.55, tone(col, -0.25)); g.addColorStop(1, col);
  c.fillStyle = g;
  c.beginPath(); c.moveTo(x0, y0);
  c.quadraticCurveTo(-11 * b - trail * 0.6, a.hipY - 2 - lift * 0.3, bl, blY);
  // dagged hem (points) from the back corner to the front
  const n = 5;
  for (let i = 1; i <= n; i++) {
    const u = i / n, x = lerp(bl, br, u), y = lerp(blY, -1.4 - lift * 0.35, u) + Math.sin(p.t * 3 + i) * 0.3 * (mv + air);
    const mx = lerp(bl, br, u - 0.5 / n), my = lerp(blY, -1.4 - lift * 0.35, u - 0.5 / n) - (s.ct >= 2 ? 2.4 : 1.1);
    c.lineTo(mx, my); c.lineTo(x, y);
  }
  c.quadraticCurveTo(4.5, a.hipY + 2, x1, y1);
  c.closePath(); c.fill();
  // folds
  c.strokeStyle = 'rgba(4,10,24,0.45)'; c.lineWidth = 0.8;
  for (const f of [0.28, 0.55, 0.8]) { c.beginPath(); c.moveTo(lerp(x0, x1, f), y0 + 1.5); c.quadraticCurveTo(-7 * b * f - trail * 0.3, a.hipY + 2, lerp(bl, br, f) + fl * 0.4, -2.5 - lift * 0.6); c.stroke(); }
  // hem trim
  if (s.ct >= 2) {
    c.save();
    if (s.ct >= 4) { c.globalCompositeOperation = 'lighter'; c.shadowColor = STORM_CYAN; c.shadowBlur = 4; }
    c.strokeStyle = s.ct >= 4 ? 'rgba(138,216,255,0.8)' : trim; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(bl, blY);
    for (let i = 1; i <= n; i++) {
      const u = i / n, x = lerp(bl, br, u), y = lerp(blY, -1.4 - lift * 0.35, u) + Math.sin(p.t * 3 + i) * 0.3 * (mv + air);
      const mx = lerp(bl, br, u - 0.5 / n), my = lerp(blY, -1.4 - lift * 0.35, u - 0.5 / n) - 2.4;
      c.lineTo(mx, my); c.lineTo(x, y);
    }
    c.stroke(); c.restore();
  }
}

function cloakOver(c: C2D, p: Pose, a: RigAnchors, s: LnState, col: string, trim: string): void {
  // seen from behind the cloak hides the back
  const b = a.build, mv = p.moving ? 1 : 0;
  const sw = mv ? Math.sin(p.walk * 4.2) : 0;
  const fl = mv ? sw * 1.2 : Math.sin(p.t * 1.6) * 0.4;
  const x0 = a.shX - 7.4 * b, x1 = a.shX + 7.4 * b, y0 = a.shY + 0.5;
  const bl = -9.5 * b + fl * 0.6, br = 9.5 * b + fl, by = -3 - mv * 1.5;
  const g = c.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, tone(col, 0.12)); g.addColorStop(0.5, col); g.addColorStop(1, tone(col, -0.45));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(x0, y0 + 1);
  c.quadraticCurveTo(a.shX, y0 - 2.5, x1, y0 + 1);
  c.quadraticCurveTo(x1 + 2, a.hipY, br, by);
  const n = 6;
  for (let i = 1; i <= n; i++) { const u = i / n; c.lineTo(lerp(br, bl, u - 0.5 / n), by - (s.ct >= 2 ? 2.2 : 1)); c.lineTo(lerp(br, bl, u), by + Math.sin(p.t * 3 + i) * 0.3); }
  c.quadraticCurveTo(x0 - 2, a.hipY, x0, y0 + 1);
  c.fill();
  c.strokeStyle = 'rgba(4,10,24,0.45)'; c.lineWidth = 0.8;
  for (const f of [-0.45, 0, 0.45]) { c.beginPath(); c.moveTo(a.shX + f * 9 * b, y0 + 4); c.quadraticCurveTo(f * 10 * b + fl * 0.4, a.hipY + 4, f * 12 * b + fl, by + 0.3); c.stroke(); }
  if (s.ct >= 3) sigil(c, a.shX + 0.5, a.shY + 11, 3.2, s.ct >= 4 ? STORM_CYAN : trim, s.ct >= 4 ? 1 : 0);
  // mantle over the shoulders
  c.fillStyle = tone(col, -0.2);
  c.beginPath(); c.moveTo(x0 - 0.5, y0 + 1.5); c.quadraticCurveTo(a.shX, y0 - 3.5, x1 + 0.5, y0 + 1.5); c.quadraticCurveTo(a.shX, y0 + 5, x0 - 0.5, y0 + 1.5); c.fill();
}

// ================================================================ torso, belt, tabard, pauldron, arms
function torsoDetails(c: C2D, p: Pose, a: RigAnchors, s: LnState, L: LnLook): void {
  const b = a.build, ww = 6.2 * b;
  const trim = L.decorColor ?? SILVER;
  const top = a.shY + 2, bot = a.hipY + 1;
  c.save();
  torsoPath(c, a); c.clip();
  if (s.ct <= 0) {
    // padded jack: quilted diamond stitching
    c.strokeStyle = 'rgba(10,18,34,0.45)'; c.lineWidth = 0.45;
    c.beginPath();
    for (let d = -24; d < 24; d += 3.2) { c.moveTo(-ww + d, top); c.lineTo(-ww + d + 14, bot); c.moveTo(ww + d, top); c.lineTo(ww + d - 14, bot); }
    c.stroke();
    c.fillStyle = 'rgba(160,190,230,0.12)'; c.fillRect(a.shX - 4, top, 2, bot - top);
  } else if (s.ct >= 2 && s.ct <= 3) {
    // steel scales (tier 2) / riveted lames (tier 3)
    if (s.ct === 2) {
      for (let row = 0, y = top + 2.5; y < bot + 2; y += 2.4, row++) {
        for (let x = -ww - 2 + (row % 2) * 1.4; x < ww + 3; x += 2.8) {
          c.fillStyle = 'rgba(20,30,50,0.35)'; c.beginPath(); c.arc(x, y + 0.5, 1.55, 0, Math.PI); c.fill();
          c.strokeStyle = 'rgba(230,240,255,0.35)'; c.lineWidth = 0.35; c.beginPath(); c.arc(x, y, 1.45, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
        }
      }
    } else {
      c.strokeStyle = 'rgba(8,14,30,0.5)'; c.lineWidth = 0.6;
      c.beginPath(); for (let y = a.hipY - 7; y < bot; y += 2.6) { c.moveTo(-ww, y); c.quadraticCurveTo(0, y + 1.2, ww + 2, y); } c.stroke();
      c.fillStyle = trim; for (let y = a.hipY - 7; y < bot; y += 2.6) { c.beginPath(); c.arc(-ww + 1.2, y + 0.6, 0.35, 0, TAU); c.arc(ww - 0.6, y + 0.6, 0.35, 0, TAU); c.fill(); }
    }
  } else if (s.ct >= 4) {
    // storm plate: dark lames with glowing seams
    c.strokeStyle = 'rgba(6,10,24,0.6)'; c.lineWidth = 0.7;
    c.beginPath(); for (let y = a.hipY - 8; y < bot; y += 2.6) { c.moveTo(-ww, y); c.quadraticCurveTo(0, y + 1.2, ww + 2, y); } c.stroke();
    c.save(); c.globalCompositeOperation = 'lighter';
    const pulse = 0.55 + 0.25 * Math.sin(p.t * 3.2);
    c.strokeStyle = `rgba(110,200,255,${pulse * 0.55})`; c.lineWidth = 0.5;
    c.beginPath(); for (let y = a.hipY - 8; y < bot; y += 2.6) { c.moveTo(-ww, y + 0.6); c.quadraticCurveTo(0, y + 1.8, ww + 2, y + 0.6); } c.stroke();
    c.restore();
  }
  if (s.ct >= 2) {
    // breastplate ridge & specular
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(a.shX + 0.8, top + 1); c.lineTo(0.8, a.hipY - 1); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.ellipse(a.shX - 2.5, top + 5, 1.6, 3.6, -0.2, 0, TAU); c.fill();
  }
  c.restore();
  // collar / gorget
  c.fillStyle = s.ct >= 2 ? tone(L.body, -0.15) : tone(L.body, -0.3);
  c.beginPath(); c.moveTo(a.shX - 4.2, a.shY + 1.2); c.quadraticCurveTo(a.shX + 0.5, a.shY - 2.2, a.shX + 5.2, a.shY + 1.2); c.quadraticCurveTo(a.shX + 0.5, a.shY + 3.2, a.shX - 4.2, a.shY + 1.2); c.fill();
  if (s.ct >= 3) { c.strokeStyle = trim; c.lineWidth = 0.6; c.stroke(); }
  // chest sigil
  if (s.ct >= 3) sigil(c, a.shX + 1.2, a.shY + 8, 2.6, s.ct >= 4 ? STORM_CYAN : trim, s.ct >= 4 ? 0.8 + 0.2 * Math.sin(p.t * 3) : 0);
  else if (s.ct >= 1) { c.save(); c.globalAlpha = 0.8; sigil(c, a.shX + 1.2, a.shY + 8, 2.1, s.ct >= 2 ? '#2d5cb0' : '#8aa6c8', 0); c.restore(); }
  // tabard panel over the front thigh (blue cloth, silver hem)
  const sw = p.moving ? Math.sin(p.walk * 4.2) : 0;
  const tx0 = -1.2, tx1 = 6.4 * b, ty0 = a.hipY + 0.6, ty1 = a.hipY + (s.ct >= 1 ? 10 : 7);
  c.fillStyle = s.ct >= 1 ? (L.decorColor2 ?? '#1f3f78') : tone(L.body, -0.15);
  c.beginPath(); c.moveTo(tx0, ty0); c.lineTo(tx1, ty0); c.lineTo(tx1 + 0.8 + sw * 1.2, ty1 - 1.5); c.lineTo((tx0 + tx1) / 2 + sw * 1.2, ty1); c.lineTo(tx0 + sw * 0.8, ty1 - 1.5); c.closePath(); c.fill();
  if (s.ct >= 1) { c.strokeStyle = s.ct >= 4 ? STORM_CYAN : trim; c.lineWidth = 0.6; c.stroke(); }
  // tassets (steel hip plates)
  if (s.ct >= 2) {
    const tc = s.ct >= 4 ? '#34507c' : tone(L.body, 0.05);
    for (let i = 0; i < 2; i++) {
      const y = a.hipY + 0.8 + i * 2.6;
      const g = c.createLinearGradient(-ww, 0, ww, 0); g.addColorStop(0, tone(tc, 0.3)); g.addColorStop(1, tone(tc, -0.4));
      c.fillStyle = g; c.beginPath(); c.moveTo(-ww - 0.6 + i * 0.4, y); c.lineTo(-1.6, y); c.lineTo(-2, y + 3); c.lineTo(-ww - 0.2 + i * 0.4, y + 3.2); c.closePath(); c.fill();
      c.strokeStyle = s.ct >= 3 ? trim : 'rgba(20,30,50,0.6)'; c.lineWidth = 0.4; c.stroke();
    }
  }
  // belt with a silver clasp
  c.fillStyle = '#231c26'; c.fillRect(-ww, a.hipY - 1.4, ww * 2, 2.8);
  c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(-ww, a.hipY - 1.4, ww * 2, 0.7);
  c.fillStyle = s.ct >= 4 ? STORM_CYAN : SILVER;
  c.beginPath(); c.moveTo(2.2, a.hipY - 2); c.lineTo(4.4, a.hipY); c.lineTo(2.2, a.hipY + 2); c.lineTo(0, a.hipY); c.closePath(); c.fill();
  c.fillStyle = '#1a2a4a'; c.beginPath(); c.arc(2.2, a.hipY, 0.7, 0, TAU); c.fill();
}

/** Layered dragon-scale pauldron following the front upper arm. */
function pauldron(c: C2D, a: RigAnchors, armA: number, s: LnState, L: LnLook): void {
  if (s.ct < 1) {
    // padded shoulder roll
    c.save(); c.translate(a.shX + 2, a.shY + 2.2); c.rotate(-armA);
    c.fillStyle = tone(L.body, -0.1); c.beginPath(); c.ellipse(0, 1, 3.4 * a.build, 2.6, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(10,18,34,0.5)'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-3, 1); c.lineTo(3, 1); c.stroke();
    c.restore(); return;
  }
  const col = s.ct >= 4 ? '#2c4a7c' : s.ct >= 3 ? '#4a6ea4' : s.ct >= 2 ? '#9ab0cc' : '#7c8ea8';
  const trim = s.ct >= 4 ? STORM_CYAN : s.ct >= 3 ? SILVER : tone(col, -0.5);
  const armW = 3.8 * a.build;
  const W = armW * (s.ct >= 3 ? 1.02 : 0.88);
  const lames = s.ct >= 2 ? 3 : 2;
  c.save();
  c.translate(a.shX + 2, a.shY + 2.2); c.rotate(-armA);
  for (let i = lames; i >= 1; i--) {
    const y = armW * (0.25 + i * 0.6), w = W * (1.02 - i * 0.07);
    const g = c.createLinearGradient(-w, 0, w, 0);
    g.addColorStop(0, tone(col, 0.4)); g.addColorStop(0.5, tone(col, -0.05 * i)); g.addColorStop(1, tone(col, -0.45));
    c.fillStyle = g;
    // scalloped lower edge (scales)
    c.beginPath(); c.moveTo(-w, y - armW * 0.35); c.quadraticCurveTo(0, y - armW * 0.62, w, y - armW * 0.35); c.lineTo(w * 0.96, y + armW * 0.2);
    for (let j = 3; j >= 0; j--) { const x = lerp(-w * 0.96, w * 0.96, j / 3); c.quadraticCurveTo(x + w * 0.32, y + armW * 0.55, x, y + armW * 0.2); }
    c.closePath(); c.fill();
    c.strokeStyle = trim; c.lineWidth = s.ct >= 3 ? 0.5 : 0.4; c.stroke();
  }
  // shoulder cap with a swept fin
  const g = c.createRadialGradient(-W * 0.35, -armW * 0.2, 0.2, 0, armW * 0.1, W * 1.25);
  g.addColorStop(0, tone(col, 0.6)); g.addColorStop(0.55, col); g.addColorStop(1, tone(col, -0.45));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(-W * 1.1, armW * 0.45); c.quadraticCurveTo(-W * 1.2, -armW * 0.8, 0, -armW * 0.85); c.quadraticCurveTo(W * 1.2, -armW * 0.8, W * 1.1, armW * 0.45); c.quadraticCurveTo(0, armW * 0.1, -W * 1.1, armW * 0.45); c.closePath(); c.fill();
  c.strokeStyle = trim; c.lineWidth = s.ct >= 3 ? 0.7 : 0.45; c.stroke();
  if (s.ct >= 3) {
    // back-swept dragon fin rising off the cap
    c.fillStyle = s.ct >= 4 ? '#1c3058' : tone(col, -0.15);
    c.beginPath(); c.moveTo(-W * 0.6, -armW * 0.6); c.quadraticCurveTo(-W * 0.3, -armW * 1.9, W * 0.9, -armW * 2.1); c.quadraticCurveTo(W * 0.1, -armW * 1.3, W * 0.5, -armW * 0.75); c.closePath(); c.fill();
    c.strokeStyle = trim; c.lineWidth = 0.5; c.stroke();
  }
  c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 0.5;
  c.beginPath(); c.moveTo(-W * 0.55, -armW * 0.45); c.quadraticCurveTo(-W * 0.2, -armW * 0.62, W * 0.2, -armW * 0.6); c.stroke();
  c.restore();
}

/** Vambrace over a forearm plus the gauntlet fist. */
function forearm(c: C2D, ex: number, ey: number, hx: number, hy: number, armW: number, s: LnState, dark: boolean): void {
  const gt = Math.max(s.gt, s.ct >= 3 ? 2 : -1);
  const col0 = GLOVE[Math.max(-1, Math.min(4, gt)) + 1];
  const col = dark ? tone(col0, -0.3) : col0;
  // vambrace from near the elbow to the wrist
  const v0 = s.ct >= 1 || gt >= 1 ? 0.1 : 0.32;
  const vx = lerp(ex, hx, v0), vy = lerp(ey, hy, v0);
  seg(c, vx, vy, lerp(ex, hx, 0.86), lerp(ey, hy, 0.86), armW * 0.92 + 0.4, col);
  if (gt >= 2) {
    c.strokeStyle = gt >= 4 ? 'rgba(138,216,255,0.8)' : tone(col, 0.45); c.lineWidth = 0.5;
    const nx = -(hy - ey), ny = hx - ex, nl = Math.hypot(nx, ny) || 1;
    const cx = lerp(ex, hx, 0.5), cy = lerp(ey, hy, 0.5), w = armW * 0.5;
    c.beginPath(); c.moveTo(cx + (nx / nl) * w, cy + (ny / nl) * w); c.lineTo(cx - (nx / nl) * w, cy - (ny / nl) * w); c.stroke();
  }
  // fist
  c.fillStyle = tone(col, -0.12); c.beginPath(); c.arc(hx, hy, armW * 0.55, 0, TAU); c.fill();
  c.fillStyle = tone(col, 0.3); c.beginPath(); c.arc(hx - armW * 0.15, hy - armW * 0.18, armW * 0.22, 0, TAU); c.fill();
}

// ================================================================ helms
/** Horsehair plume flowing back from the crest (x,y), drooping at the end, stirred by movement and wind. */
function plume(c: C2D, x: number, y: number, len: number, p: Pose, s: LnState, col: string, w: number): void {
  const mv = p.moving ? 1 : 0;
  const air = s.act === 'dragon' ? Math.sin(s.k * Math.PI) : 0;
  const whip = s.act === 'sweep' ? 1 : 0;
  const wave = Math.sin(p.t * 3.3) * 0.12 + (mv ? Math.sin(p.walk * 4.2 + 1) * 0.15 : 0);
  // droop: hangs when idle, streams back when moving / leaping (negative lifts it)
  const droop = 0.75 - mv * 0.35 - air * 1.1 - whip * 0.3 + wave;
  const ex = x - len * (0.95 - Math.abs(droop) * 0.15), ey = y + len * droop * 0.55;
  const cx = x - len * 0.45, cy = y - len * 0.28;
  const strands = [[0, 1], [-0.35, 0.8], [0.35, 0.85]];
  c.lineCap = 'round';
  for (const [o, sc] of strands) {
    const g = c.createLinearGradient(x, y, ex, ey);
    g.addColorStop(0, tone(col, 0.2 + o * 0.2)); g.addColorStop(1, tone(col, -0.5));
    c.fillStyle = g;
    const ww = w * sc;
    c.beginPath(); c.moveTo(x + 0.6, y - ww * 0.5);
    c.quadraticCurveTo(cx, cy - ww + o * ww, ex + o * 2, ey + o * 1.5);
    c.quadraticCurveTo(cx + ww * 0.4, cy + ww * 0.8 + o * ww, x - 0.4, y + ww * 0.45);
    c.closePath(); c.fill();
  }
  c.strokeStyle = 'rgba(255,255,255,0.2)'; c.lineWidth = 0.4;
  c.beginPath(); c.moveTo(x, y - w * 0.2); c.quadraticCurveTo(cx, cy - w * 0.4, ex + 1, ey); c.stroke();
}

/** Feathered steel wing swept back from the side of a helm: `n` curved blades fanning from up-back to back. */
function helmWing(c: C2D, x: number, y: number, r: number, size: number, col: string, edge: string, n: number): void {
  for (let i = n - 1; i >= 0; i--) {
    const f = n === 1 ? 0.5 : i / (n - 1);          // 0: top blade, 1: lowest blade
    const L = r * size * (2.3 - f * 0.7), rise = r * size * (1.05 - f * 0.9);
    const bx = x - r * 0.1, by = y - r * 0.55 + f * r * 0.5;
    const tx = bx - L, ty = by - rise;
    const w = r * (0.34 - f * 0.08) * Math.min(1.2, size);
    const g = c.createLinearGradient(bx, by, tx, ty);
    g.addColorStop(0, tone(col, 0.35)); g.addColorStop(0.6, col); g.addColorStop(1, tone(col, -0.35));
    c.fillStyle = g;
    c.beginPath(); c.moveTo(bx + w * 0.3, by - w);
    c.quadraticCurveTo(bx - L * 0.45, by - rise * 0.35 - w * 1.6, tx, ty);
    c.quadraticCurveTo(bx - L * 0.5, by - rise * 0.2 + w * 0.6, bx, by + w);
    c.closePath(); c.fill();
    c.strokeStyle = edge; c.lineWidth = 0.45; c.stroke();
    // quill line
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.35;
    c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx - L * 0.45, by - rise * 0.3 - w * 0.4, tx + L * 0.08, ty + rise * 0.05); c.stroke();
  }
}

function helm(c: C2D, p: Pose, a: RigAnchors, s: LnState, L: LnLook): void {
  const x = a.hx, y = a.hy, r = a.headR, ht = s.ht;
  const trim = L.decorColor ?? SILVER;
  if (ht < 0) {
    // bare head: a blue headband with two trailing tails
    c.fillStyle = '#2d5cb0';
    c.beginPath(); c.moveTo(x - r * 1.02, y - r * 0.35); c.quadraticCurveTo(x, y - r * 0.85, x + r * 1.0, y - r * 0.45); c.lineTo(x + r * 0.98, y - r * 0.2); c.quadraticCurveTo(x, y - r * 0.6, x - r * 1.0, y - r * 0.08); c.closePath(); c.fill();
    const wv = Math.sin(p.t * 4) * 0.8 + (p.moving ? 1.5 : 0);
    c.strokeStyle = '#2d5cb0'; c.lineWidth = 1; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - r * 0.95, y - r * 0.2); c.quadraticCurveTo(x - r * 1.8, y - r * 0.1 + wv, x - r * 2.5, y + r * 0.5 + wv); c.stroke();
    c.beginPath(); c.moveTo(x - r * 0.95, y - r * 0.15); c.quadraticCurveTo(x - r * 1.6, y + r * 0.3 + wv, x - r * 2.1, y + r * 0.95 + wv * 0.8); c.stroke();
    return;
  }
  const [hi, mid, dk] = HELM[tierOf(ht)];
  const dome = (): void => { c.beginPath(); c.arc(x, y - r * 0.1, r * 1.13, Math.PI * 0.9, TAU * 1.02); c.lineTo(x + r * 1.1, y + r * 0.12); c.lineTo(x - r * 1.14, y + r * 0.35); c.closePath(); };
  const metal = (): CanvasGradient => { const g = c.createRadialGradient(x - r * 0.45, y - r * 0.8, r * 0.1, x, y - r * 0.1, r * 1.3); g.addColorStop(0, hi); g.addColorStop(0.55, mid); g.addColorStop(1, dk); return g; };
  if (ht === 0) {
    // arming cap of blue-dyed leather, stitched ridge, cheek flap
    if (!p.back) {
      c.fillStyle = '#34445e'; c.beginPath(); c.moveTo(x - r * 0.35, y - r * 0.05); c.lineTo(x + r * 0.25, y + r * 0.1); c.lineTo(x + r * 0.2, y + r * 0.95); c.lineTo(x - r * 0.4, y + r * 0.9); c.closePath(); c.fill();
    }
    // cloth tails of the dyed band, then the cap
    const wv = Math.sin(p.t * 4) * 0.8 + (p.moving ? 1.5 : 0);
    c.strokeStyle = '#2d5cb0'; c.lineWidth = 1; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - r * 0.95, y - r * 0.05); c.quadraticCurveTo(x - r * 1.8, y + wv * 0.5, x - r * 2.4, y + r * 0.7 + wv); c.stroke();
    dome(); c.fillStyle = metal(); c.fill();
    c.strokeStyle = 'rgba(10,16,30,0.6)'; c.lineWidth = 0.5; c.stroke();
    c.strokeStyle = 'rgba(160,130,90,0.8)'; c.lineWidth = 0.5; c.setLineDash([0.8, 0.8]); c.beginPath(); c.arc(x, y - r * 0.1, r * 0.8, Math.PI * 1.08, TAU * 0.97); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#2d5cb0'; c.beginPath(); c.moveTo(x - r * 1.14, y - r * 0.02); c.quadraticCurveTo(x, y - r * 0.4, x + r * 1.12, y - r * 0.05); c.lineTo(x + r * 1.1, y + r * 0.2); c.quadraticCurveTo(x, y - r * 0.12, x - r * 1.14, y + r * 0.26); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.75, r * 0.32, r * 0.14, -0.4, 0, TAU); c.fill();
    return;
  }
  // wings / crest behind the dome
  if (ht === 1) helmWing(c, x, y, r, 0.7, hi, dk, 2);
  else if (ht === 2) { plume(c, x - r * 0.1, y - r * 1.12, r * 2.2, p, s, '#2d5cb0', r * 0.42); helmWing(c, x, y, r, 0.95, hi, dk, 3); }
  else if (ht >= 3) {
    plume(c, x - r * 0.15, y - r * 1.15, r * (ht >= 4 ? 2.6 : 3.1), p, s, ht >= 4 ? '#1c3a74' : '#2d5cb0', r * 0.55);
    helmWing(c, x, y, r, ht >= 4 ? 1.1 : 1.05, ht >= 4 ? mid : hi, ht >= 4 ? 'rgba(138,216,255,0.9)' : SILVER, 4);
  }
  if (ht >= 4) {
    // swept horns
    c.strokeStyle = '#141c30'; c.lineWidth = r * 0.36; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x + r * 0.2, y - r * 0.85); c.quadraticCurveTo(x - r * 0.6, y - r * 2.1, x - r * 2.2, y - r * 2.1); c.stroke();
    c.strokeStyle = '#6a7a98'; c.lineWidth = r * 0.12;
    c.beginPath(); c.moveTo(x + r * 0.1, y - r * 0.95); c.quadraticCurveTo(x - r * 0.6, y - r * 2.0, x - r * 2.0, y - r * 2.12); c.stroke();
  }
  if (p.back) {
    // seen from behind the helm's back shell hides the nape: a mail aventail (sallets) or a laminated neck guard
    const bg = c.createLinearGradient(x - r * 1.1, 0, x + r * 1.1, 0);
    bg.addColorStop(0, tone(mid, 0.25)); bg.addColorStop(0.5, mid); bg.addColorStop(1, dk);
    c.fillStyle = bg;
    c.beginPath(); c.moveTo(x - r * 1.14, y - r * 0.15); c.lineTo(x + r * 1.12, y - r * 0.15);
    c.quadraticCurveTo(x + r * 1.22, y + r * 0.75, x + r * 0.75, y + r * 1.28);
    c.quadraticCurveTo(x, y + r * 1.5, x - r * 0.85, y + r * 1.24);
    c.quadraticCurveTo(x - r * 1.3, y + r * 0.7, x - r * 1.14, y - r * 0.15); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(8,12,24,0.55)'; c.lineWidth = 0.45; c.stroke();
    if (ht <= 2) {
      // riveted mail rings
      c.fillStyle = 'rgba(230,240,255,0.35)';
      for (let row = 0; row < 3; row++) for (let i = -2; i <= 2; i++) c.fillRect(x + (i + (row % 2) * 0.5) * r * 0.36 - 0.3, y + r * (0.35 + row * 0.3), 0.6, 0.6);
    } else {
      c.strokeStyle = ht >= 4 ? 'rgba(138,216,255,0.75)' : trim; c.lineWidth = 0.45;
      c.beginPath();
      for (const f of [0.45, 0.85]) { c.moveTo(x - r * 1.05, y + r * f); c.quadraticCurveTo(x, y + r * (f + 0.28), x + r * 1.02, y + r * f); }
      c.stroke();
    }
  }
  dome(); c.fillStyle = metal(); c.fill();
  c.strokeStyle = ht >= 3 ? trim : 'rgba(10,16,30,0.6)'; c.lineWidth = ht >= 3 ? 0.55 : 0.5; c.stroke();
  // neck guard flaring back
  c.fillStyle = tone(mid, -0.15);
  c.beginPath(); c.moveTo(x - r * 0.6, y + r * 0.2); c.quadraticCurveTo(x - r * 1.5, y + r * 0.35, x - r * 1.7, y + r * 1.0); c.lineTo(x - r * 0.9, y + r * 0.95); c.closePath(); c.fill();
  // brow band
  c.fillStyle = ht >= 3 ? trim : tone(hi, 0.1);
  c.beginPath(); c.moveTo(x - r * 1.12, y - r * 0.05); c.quadraticCurveTo(x, y - r * 0.45, x + r * 1.12, y - r * 0.1); c.lineTo(x + r * 1.1, y + r * 0.12); c.quadraticCurveTo(x, y - r * 0.2, x - r * 1.12, y + r * 0.2); c.closePath(); c.fill();
  if (ht >= 4) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(138,216,255,${0.6 + 0.3 * Math.sin(p.t * 4)})`; c.lineWidth = 0.5; c.stroke(); c.restore(); }
  if (!p.back) {
    if (ht === 1) {
      // nasal: a tapered steel bar down the nose ridge from the brow band
      c.fillStyle = mid;
      c.beginPath(); c.moveTo(x + r * 0.8, y + r * 0.02); c.lineTo(x + r * 1.04, y + r * 0.0); c.lineTo(x + r * 1.2, y + r * 0.46); c.lineTo(x + r * 1.04, y + r * 0.52); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(x + r * 0.88, y + r * 0.04); c.lineTo(x + r * 1.08, y + r * 0.48); c.stroke();
    } else if (ht === 2) {
      // barbute faceplate: a shaped steel mask from brow to chin (brow ridge forward, chin swept back) with a T slot
      const g = c.createLinearGradient(x, y, x + r * 1.2, y + r * 1.1);
      g.addColorStop(0, hi); g.addColorStop(0.55, mid); g.addColorStop(1, dk);
      c.fillStyle = g;
      c.beginPath(); c.moveTo(x + r * 0.15, y + r * 0.05); c.lineTo(x + r * 1.12, y + r * 0.02);
      c.quadraticCurveTo(x + r * 1.24, y + r * 0.5, x + r * 1.02, y + r * 0.78); c.quadraticCurveTo(x + r * 0.9, y + r * 1.12, x + r * 0.55, y + r * 1.2);
      c.lineTo(x + r * 0.15, y + r * 1.14); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(12,18,34,0.6)'; c.lineWidth = 0.4; c.stroke();
      // T slot: a slim eye slit and a tapering breath slot, dark with a lit lower lip
      c.fillStyle = '#070a12';
      c.beginPath(); c.moveTo(x + r * 0.38, y + r * 0.16); c.lineTo(x + r * 1.16, y + r * 0.14); c.lineTo(x + r * 1.15, y + r * 0.27); c.lineTo(x + r * 0.84, y + r * 0.28);
      c.lineTo(x + r * 0.8, y + r * 0.78); c.quadraticCurveTo(x + r * 0.74, y + r * 0.84, x + r * 0.68, y + r * 0.78); c.lineTo(x + r * 0.66, y + r * 0.29); c.lineTo(x + r * 0.38, y + r * 0.3); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(235,245,255,0.55)'; c.lineWidth = 0.3;
      c.beginPath(); c.moveTo(x + r * 0.4, y + r * 0.32); c.lineTo(x + r * 0.64, y + r * 0.31); c.moveTo(x + r * 0.86, y + r * 0.3); c.lineTo(x + r * 1.12, y + r * 0.29); c.stroke();
      // rivets along the rim, silver edge at the chin
      c.fillStyle = SILVER;
      for (const [u, v] of [[0.25, 0.2], [0.25, 0.95], [0.98, 0.6]]) { c.beginPath(); c.arc(x + r * u, y + r * v, r * 0.06, 0, TAU); c.fill(); }
      c.strokeStyle = SILVER; c.lineWidth = 0.4; c.beginPath(); c.moveTo(x + r * 0.15, y + r * 1.14); c.lineTo(x + r * 0.55, y + r * 1.2); c.quadraticCurveTo(x + r * 0.9, y + r * 1.12, x + r * 1.02, y + r * 0.78); c.stroke();
    } else {
      // dragon-snout visor
      const g = c.createLinearGradient(x, y, x + r * 1.9, y + r * 0.8);
      g.addColorStop(0, mid); g.addColorStop(1, dk);
      c.fillStyle = g;
      c.beginPath(); c.moveTo(x - r * 0.1, y - r * 0.05); c.lineTo(x + r * 1.15, y - r * 0.02); c.lineTo(x + r * 1.95, y + r * 0.55); c.lineTo(x + r * 1.6, y + r * 0.72); c.lineTo(x + r * 1.1, y + r * 1.25); c.lineTo(x - r * 0.1, y + r * 1.2); c.closePath(); c.fill();
      c.strokeStyle = ht >= 4 ? 'rgba(138,216,255,0.85)' : SILVER; c.lineWidth = 0.45; c.stroke();
      // teeth line / breaths
      c.strokeStyle = 'rgba(8,10,20,0.8)'; c.lineWidth = 0.35;
      c.beginPath(); for (let i = 0; i < 3; i++) { const xx = x + r * (0.7 + i * 0.28); c.moveTo(xx, y + r * 0.7); c.lineTo(xx + r * 0.08, y + r * 1.05); } c.stroke();
      // eye slit
      if (ht >= 4) {
        c.save(); c.shadowColor = STORM_CYAN; c.shadowBlur = 6;
        c.fillStyle = `rgba(170,235,255,${0.85 + 0.15 * Math.sin(p.t * 5)})`;
        c.beginPath(); c.moveTo(x + r * 0.35, y + r * 0.2); c.lineTo(x + r * 1.25, y + r * 0.28); c.lineTo(x + r * 0.4, y + r * 0.42); c.closePath(); c.fill(); c.restore();
      } else { c.fillStyle = '#06080e'; c.beginPath(); c.moveTo(x + r * 0.35, y + r * 0.18); c.lineTo(x + r * 1.3, y + r * 0.26); c.lineTo(x + r * 0.4, y + r * 0.42); c.closePath(); c.fill(); }
    }
  }
  if (ht >= 4) {
    // lightning crest on top of the helm
    c.save(); c.globalCompositeOperation = 'lighter'; c.shadowColor = STORM_CYAN; c.shadowBlur = 5;
    c.fillStyle = `rgba(150,225,255,${0.7 + 0.25 * Math.sin(p.t * 6)})`;
    c.beginPath(); c.moveTo(x + r * 0.3, y - r * 1.15); c.lineTo(x - r * 0.1, y - r * 1.9); c.lineTo(x - r * 0.15, y - r * 1.5); c.lineTo(x - r * 0.7, y - r * 2.25); c.lineTo(x - r * 0.45, y - r * 1.2); c.closePath(); c.fill();
    c.restore();
  }
  // specular
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.75, r * 0.35, r * 0.16, -0.4, 0, TAU); c.fill();
}

// ================================================================ the lance in the hand
/**
 * How much the lance follows the aim (0 … 1) in the current pose: level thrusts and storm jabs fully, the javelin
 * partly (it is thrown from overhead), the guard, whirl and dive not at all.
 */
function aimWeight(p: Pose, s: LnState): number {
  switch (s.act) {
    case 'javelin': return 0.6;
    case 'storm': return 1;
    case 'dragon': case 'sweep': return 0;
    default: {
      if (p.atk < 0) return 0;
      const t = p.atk;
      return t < 0.3 ? ease(t / 0.3) : t < 0.75 ? 1 : 1 - ease((t - 0.75) / 0.25);
    }
  }
}

/** Lance direction (rig angle convention) for the current pose, tilted along the aim by `aim` (see aimWeight). */
function lanceAngle(p: Pose, s: LnState, arm: { a: number; fa: number }, aim: number): number {
  return lanceAngle0(p, s, arm) - s.pitch * aim;
}

function lanceAngle0(p: Pose, s: LnState, arm: { a: number; fa: number }): number {
  const guard = (p.moving ? 2.25 : 2.35) + Math.sin(p.t * 1.7) * 0.03;
  switch (s.act) {
    case 'javelin': return lerp(2.05, 1.72, ease(s.k / 0.45));
    case 'dragon': {
      // raised upright while soaring (a slight sway in the wind), then swung point-down in front for the plunge
      const k = s.k, up = DIVE.upright + Math.sin(p.t * 2.6) * 0.04;
      if (k < DIVE.k0) return lerp(guard, up, ease(k / DIVE.up));
      if (k < DIVE.k1) return lerp(up, 0.32, ease((k - DIVE.k0) / (DIVE.k1 - DIVE.k0)));
      return 0.32;
    }
    case 'storm': {
      const i = Math.min(STORM_FAN.length - 1, Math.floor(s.at * 7));
      return 1.56 + STORM_FAN[i] * 0.22;
    }
    default: {
      if (p.atk < 0) return guard;
      const t = p.atk;
      const level = 1.55 + (arm.a - 1.45) * 0.2;
      const w = t < 0.3 ? ease(t / 0.3) : t < 0.75 ? 1 : 1 - ease((t - 0.75) / 0.25);
      return lerp(guard, level, w);
    }
  }
}

/** Electric charge shown on the lance head for the current skill. */
function chargeOf(s: LnState): number {
  switch (s.act) {
    case 'javelin': return s.k < 0.5 ? 0.3 + 0.7 * ease(s.k / 0.5) : 0;
    case 'dragon': return 0.35 + 0.65 * ease((s.k - 0.4) / 0.5);
    case 'storm': return 0.45 + 0.55 * s.k;
    case 'pierce': return s.k > 0.35 && s.k < 0.8 ? 0.35 : 0;
    default: return 0;
  }
}

// ================================================================ the renderer's offscreen actor box
/**
 * In high quality the renderer paints each actor into a detached offscreen canvas and copies only a fixed box of it:
 * ±72 rig units around the feet for tall rigs, 128 above and 14 below, with the leap lift inside the box
 * (render/renderer drawActorAt). A lance at full reach pokes out of that box and would be sliced off, so on that
 * canvas the lance's reach along its axis is capped (reachCap). The class-select portraits (ui/app: canvases
 * .bigportrait and .tport, about ±30 rig units wide) crop the same way, so there the portrait canvas is the box.
 * Everywhere else (low quality, which draws straight to the screen around a centred hero, icons) nothing is capped.
 */
const BOX = { w: 144, h: 142, root: 72, pad: 1.5 };
/** Room kept past the lance tip for the head's glow (rig units). */
const TIP_GLOW = 6;
/**
 * The box in rig units: the canvas transform m (rig → device px), its scale s, the box size w × h, and how far the
 * lance may slide back through the grip to fit (the small portraits need much more than the actor box).
 */
interface ActorBox { m: DOMMatrix; s: number; w: number; h: number; slack: number }

function actorBox(c: C2D, a: RigAnchors): ActorBox | null {
  const cv = c.canvas as HTMLCanvasElement | undefined;
  if (!cv || typeof c.getTransform !== 'function') return null;
  // (the tile portraits are painted once, before their grid joins the page: recognise them by class, not by isConnected)
  const portrait = !!cv.classList && (cv.classList.contains('bigportrait') || cv.classList.contains('tport'));
  if (cv.isConnected !== false && !portrait) return null;
  const m = c.getTransform();
  const s = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
  if (!(s > 0)) return null;
  if (portrait) return { m, s, w: cv.width / s, h: cv.height / s, slack: 32 };
  // sanity check: the hip pivot sits on the box's centre line (± the attack lunge), in its lower half
  const bx = (m.c * a.hipY + m.e) / s, by = (m.d * a.hipY + m.f) / s;
  if (Math.abs(bx - BOX.root) > 9 || by < 40 || by > 125) return null;
  return { m, s, w: BOX.w, h: BOX.h, slack: 12 };
}

/** How far (rig units) the lance may reach from (x,y) along the unit direction (dx,dy) and stay inside the box. */
function reachCap(b: ActorBox | null, x: number, y: number, dx: number, dy: number): number {
  if (!b) return Infinity;
  const { m, s, w, h } = b;
  const bx = (m.a * x + m.c * y + m.e) / s, by = (m.b * x + m.d * y + m.f) / s;
  const vx = (m.a * dx + m.c * dy) / s, vy = (m.b * dx + m.d * dy) / s;
  let t = Infinity;
  if (vx > 1e-4) t = Math.min(t, (w - BOX.pad - bx) / vx); else if (vx < -1e-4) t = Math.min(t, (BOX.pad - bx) / vx);
  if (vy > 1e-4) t = Math.min(t, (h - BOX.pad - by) / vy); else if (vy < -1e-4) t = Math.min(t, (BOX.pad - by) / vy);
  return t;
}

/** Rig angle the whirl starts from (vfx.ts starts the blade-path effect at the same heading). */
export const WHIRL0 = -0.35;

/**
 * The whirl: the lance swings a full circle around the hand on a flat (iso) plane, foreshortened as it turns.
 * While it points away from the viewer it is painted in the back layer (behind the body), otherwise in front.
 */
function lanceSweep(c: C2D, hx: number, hy: number, s: LnState, L: LnLook, t: number, half: 'far' | 'near', low: boolean, box: ActorBox | null): void {
  const k = clamp01((s.k - SWEEP.k0) / (SWEEP.k1 - SWEEP.k0));
  const phi = WHIRL0 + ease(k) * TAU * 1.08;
  const dx = Math.cos(phi), dy = Math.sin(phi);
  if ((half === 'near') !== (dy >= 0)) return;
  const speed = Math.sin(k * Math.PI);
  const sx = dx, sy = dy * 0.45 - 0.12, len0 = Math.max(0.3, Math.hypot(sx, sy));
  const th = Math.atan2(sx, sy); // rig convention: direction (sin th, cos th)
  const sp = LANCE[tierOf(s.wt)];
  // foreshorten a little more if the tip would leave the actor box
  const len = Math.max(0.3, Math.min(len0, reachCap(box, hx, hy, sx / len0, sy / len0) / (sp.tip + TIP_GLOW)));
  const fit = len / len0;
  // motion trail: pale tapered strokes along the previous headings of the tip
  if (!low && speed > 0.2) {
    c.save(); c.lineCap = 'round';
    for (let i = 1; i <= 3; i++) {
      const pa = phi - i * 0.22 * speed, px = Math.cos(pa) * fit, py = (Math.sin(pa) * 0.45 - 0.12) * fit;
      if ((half === 'near') !== (Math.sin(pa) >= 0)) continue;
      c.strokeStyle = `rgba(200,235,255,${0.22 * speed * (1 - i * 0.25)})`; c.lineWidth = 3 - i * 0.6;
      c.beginPath(); c.moveTo(hx + px * 10, hy + py * 10); c.lineTo(hx + px * sp.tip, hy + py * sp.tip); c.stroke();
    }
    c.restore();
  }
  c.save(); c.translate(hx, hy); c.rotate(-th); c.scale(1, len);
  drawLance(c, s.wt, 1, { glow: L.wGlow, t, low, charge: 0.3 * speed });
  c.restore();
}

function heldLance(c: C2D, p: Pose, a: RigAnchors, s: LnState, L: LnLook, arm: { a: number; fa: number }, low: boolean, box: ActorBox | null): void {
  if (s.wt < 0) return;
  const hx = a.fhx, hy = a.fhy;
  if (s.act === 'sweep' && p.atk >= 0) { lanceSweep(c, hx, hy, s, L, p.t, 'near', low, box); return; }
  let alpha = 1;
  if (s.act === 'javelin' && s.k >= 0.5) {
    // thrown: a new lance crackles into the hand at the end of the act
    if (s.k < 0.8) return;
    alpha = ease((s.k - 0.8) / 0.2);
  }
  const aim = aimWeight(p, s);
  const th = lanceAngle(p, s, arm, aim);
  // a lance aimed toward / away from the viewer is foreshortened along its axis
  const fs = lerp(1, s.fore, aim);
  const charge = chargeOf(s);
  // slide the lance forward through the grip at the strike (the thrust reaches further than the arm)
  let slide = 0;
  if (p.atk >= 0 && (s.act === '' || s.act === 'thrust' || s.act === 'pierce')) slide = Math.sin(clamp01((p.atk - 0.4) / 0.35) * Math.PI) * (s.act === 'pierce' ? 7 : 4);
  if (s.act === 'dragon' && s.k > 0.7) slide = 5;
  let jab = 0;
  if (s.act === 'storm') {
    // piston: pull back, snap out, return — in step with the renderer's 7 Hz body lunge; the ninth jab is the big one
    const u = (s.at * 7) % 1, big = s.at * 7 >= 8 ? 1.6 : 1;
    const e = u < 0.4 ? -0.5 * ease(u / 0.4) : u < 0.6 ? -0.5 + 1.5 * ease((u - 0.4) / 0.2) : 1 - ease((u - 0.6) / 0.4);
    slide = e * 8 * big; jab = Math.max(0, e);
  }
  // keep the tip (and its glow) inside the actor box: at full reach the lance slides back through the grip instead
  const sp = LANCE[tierOf(s.wt)];
  slide = Math.min(slide, Math.max(-(box?.slack ?? 0), reachCap(box, hx, hy, Math.sin(th), Math.cos(th)) / fs - sp.tip - TIP_GLOW));
  c.save();
  c.translate(hx, hy); c.rotate(-th);
  if (fs < 0.999) c.scale(1, fs);
  if (alpha < 1) c.globalAlpha = alpha;
  c.translate(0, slide);
  // motion streak behind the tip while thrusting
  if ((p.atk >= 0.38 && p.atk <= 0.7 && s.act !== 'dragon' && s.act !== 'storm') || jab > 0.3) {
    const f = s.act === 'storm' ? jab : Math.sin(clamp01((p.atk - 0.38) / 0.32) * Math.PI);
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(0, sp.tip - 26, 0, sp.tip + 2);
    g.addColorStop(0, 'rgba(140,200,255,0)'); g.addColorStop(1, `rgba(220,245,255,${0.55 * f})`);
    c.fillStyle = g; c.beginPath(); c.moveTo(-3.2, sp.tip - 26); c.lineTo(3.2, sp.tip - 26); c.lineTo(0.6, sp.tip + 2); c.lineTo(-0.6, sp.tip + 2); c.closePath(); c.fill();
    c.restore();
  }
  drawLance(c, s.wt, 1, { glow: L.wGlow, charge, t: p.t, low });
  c.restore();
  if (alpha < 1 && !low) {
    // re-forming crackle: a few sparks of lightning knitting the new lance together
    c.save(); c.translate(hx, hy); c.rotate(-th); if (fs < 0.999) c.scale(1, fs);
    crackle(c, (n: number) => n, sp, p.t, 2, 1 - alpha);
    c.restore();
  }
  // storm: faint afterimage lances fanned through the cone (the thrusts are too fast to see)
  if (s.act === 'storm' && !low) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const n = Math.min(STORM_FAN.length, Math.floor(s.at * 7 + 0.5));
    for (let i = Math.max(0, n - 3); i < n; i++) {
      const age = s.at - (i + 0.5) / 7;
      const f = clamp01(1 - age / 0.35);
      if (f <= 0) continue;
      const ta = 1.52 + STORM_FAN[i] * 0.55 - s.pitch;
      const out = Math.min(8 * f, reachCap(box, hx, hy, Math.sin(ta), Math.cos(ta)) / fs - sp.tip - 4);
      c.save(); c.translate(hx, hy); c.rotate(-ta); if (fs < 0.999) c.scale(1, fs); c.translate(0, out);
      c.globalAlpha = 0.35 * f;
      c.fillStyle = '#bfe6ff'; c.beginPath(); c.moveTo(-1.2, sp.butt + 10); c.lineTo(1.2, sp.butt + 10); c.lineTo(0, sp.tip + 3); c.closePath(); c.fill();
      c.restore();
    }
    c.restore();
  }
}

// ================================================================ dragon's descent: spectral wings
/**
 * Wings of blue lightning unfurl behind the lancer during the leap: raised and spreading on the way up, swept back
 * like a stooping falcon in the dive, gone at the landing. Rig space (facing +x), root at the shoulders.
 */
function dragonWings(c: C2D, p: Pose, a: RigAnchors, s: LnState, low: boolean): void {
  const k = s.k;
  const on = clamp01((k - 0.06) / 0.14) * (k > 0.86 ? clamp01((0.98 - k) / 0.12) : 1);
  if (on <= 0.01) return;
  const open = Math.sin(clamp01(k / 0.5) * Math.PI * 0.5);
  const dive = ease(clamp01((k - 0.45) / 0.3));
  const flap = Math.sin(p.t * 10) * 0.08 * (1 - dive);
  const tips: [number, number][] = [[-1.0, -1.08], [-1.18, -0.6], [-1.05, -0.18], [-0.72, 0.14]];
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round'; c.lineCap = 'round';
  for (const [sc, al, dx] of [[0.74, 0.5, 3], [1, 1, 0]] as [number, number, number][]) {
    const span = 30 * sc * (0.45 + 0.55 * open);
    c.save();
    c.translate(a.shX - 2 + dx, a.shY + 3);
    c.rotate(0.22 * (1 - dive) - 0.5 * dive + flap * (dx ? -1 : 1));
    const P = (q: [number, number]): [number, number] => [q[0] * span, q[1] * span];
    const wr: [number, number] = [-0.38 * span, -0.98 * span];
    // membrane: leading edge to the wrist, fingers, scalloped trailing edge back to the root
    c.beginPath(); c.moveTo(0, 0);
    c.quadraticCurveTo(-0.05 * span, -0.75 * span, wr[0], wr[1]);
    c.lineTo(...P(tips[0]));
    for (let i = 1; i < tips.length; i++) {
      const [x0, y0] = P(tips[i - 1]), [x1, y1] = P(tips[i]);
      c.quadraticCurveTo((x0 + x1) / 2 * 0.72, (y0 + y1) / 2 * 0.72 + 0.04 * span, x1, y1);
    }
    c.quadraticCurveTo(-0.3 * span, 0.2 * span, 0, 0.12 * span); c.closePath();
    const g = c.createLinearGradient(0, 0, -span, -span * 0.7);
    g.addColorStop(0, `rgba(140,205,255,${0.55 * al * on})`); g.addColorStop(0.6, `rgba(60,130,255,${0.34 * al * on})`); g.addColorStop(1, `rgba(40,80,255,${0.12 * al * on})`);
    c.fillStyle = g; c.fill();
    // finger bones and the bright leading edge
    c.strokeStyle = `rgba(120,195,255,${0.6 * al * on})`; c.lineWidth = 0.7;
    c.beginPath(); for (const q of tips) { c.moveTo(wr[0], wr[1]); c.lineTo(...P(q)); } c.stroke();
    c.strokeStyle = `rgba(225,245,255,${0.85 * al * on})`; c.lineWidth = 1.1;
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-0.05 * span, -0.75 * span, wr[0], wr[1]); c.lineTo(...P(tips[0])); c.stroke();
    // lightning crawling along the leading edge
    if (!low && sc === 1) {
      let seed = Math.floor(p.t * 24) * 13 + 5;
      const rnd = (): number => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 - 0.5; };
      c.strokeStyle = `rgba(240,252,255,${0.9 * on})`; c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(wr[0] * 0.3, wr[1] * 0.3);
      for (let i = 1; i <= 5; i++) { const t = i / 5; c.lineTo(lerp(wr[0] * 0.3, tips[0][0] * span, t) + rnd() * 3, lerp(wr[1] * 0.3, tips[0][1] * span, t) + rnd() * 3); }
      c.stroke();
    }
    c.restore();
  }
  c.restore();
}

// ================================================================ decor entry
/** Anchors of the current rig pass for the back-hand callback (runs later in the same drawBiped call). */
let rig: { a: RigAnchors; s: LnState; L: LnLook } | null = null;

function offscreen(c: C2D): boolean {
  const at = (c as C2D & { getContextAttributes?: () => { alpha?: boolean } }).getContextAttributes?.();
  return at?.alpha !== false;
}

DECOR.ln_dragoon = (c, L0, p, a, layer) => {
  const L = L0 as LnLook, s = L.ln;
  if (!s) return;
  const cloak = L.decorColor2 ?? '#1f3f78', trim = L.decorColor ?? SILVER;
  const low = !offscreen(c);
  if (layer === 'back') {
    remapPose(p, s);
    rig = { a: { ...a }, s, L };
    if (!p.back && s.act === 'dragon') dragonWings(c, p, a, s, low);
    if (!p.back) cloakBehind(c, p, a, s, cloak, trim);
    // the far half of the whirling lance passes behind the body
    if (s.act === 'sweep' && p.atk >= 0 && s.wt >= 0) {
      const arm = frontArm(p, 'thrust', true), hp = handAt(a, arm);
      lanceSweep(c, hp.hx, hp.hy, s, L, p.t, 'far', low, low ? null : actorBox(c, a));
    }
    return;
  }
  const style = styleOf(L.weapon ?? 'none');
  const arm = frontArm(p, style, heavyOf(L.weapon ?? 'none'));
  c.save();
  if (p.back) { cloakOver(c, p, a, s, cloak, trim); if (s.act === 'dragon') dragonWings(c, p, a, s, low); }
  else torsoDetails(c, p, a, s, L);
  helm(c, p, a, s, L);
  // armoured front arm (the rig paints a plain one)
  const hp = handAt(a, arm);
  const armW = 3.8 * a.build;
  pauldron(c, a, arm.a, s, L);
  forearm(c, hp.ex, hp.ey, a.fhx, a.fhy, armW, s, false);
  heldLance(c, p, a, s, L, arm, low, low ? null : actorBox(c, a));
  // the fist closes over the shaft
  if (s.wt >= 0 && !(s.act === 'javelin' && s.k >= 0.5 && s.k < 0.8)) {
    const col = GLOVE[Math.max(-1, Math.min(4, Math.max(s.gt, s.ct >= 3 ? 2 : -1))) + 1];
    c.fillStyle = tone(col, -0.05); c.beginPath(); c.arc(a.fhx + 0.4, a.fhy - 0.2, armW * 0.42, -Math.PI * 0.2, Math.PI * 1.1); c.fill();
  }
  c.restore();
  rig = null;
};

/** Back hand: vambrace and gauntlet over the rig's bare back forearm. */
OFFHAND_ART.ln_rig = {
  draw(c, x, y, _tier, p) {
    const r = rig;
    if (!r) return;
    const a = r.a, b = a.build, armL = 17 * a.height, armW = 3.8 * b;
    const ba = backArm(p, heavyOf(r.L.weapon ?? 'none'));
    const ex = a.shX - 2 * b + Math.sin(ba) * armL * 0.52, ey = a.shY + 2 + Math.cos(ba) * armL * 0.52;
    forearm(c, ex, ey, x, y, armW, r.s, true);
  },
  icon() { /* not an item */ },
};
