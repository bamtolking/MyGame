// monk: hero look — a saffron martial monk. By chest tier: shirtless (no chest) → plain saffron wrap robe → maroon
// kasaya over the shoulder → crimson kasaya with a gold ring and border → gold patchwork kasaya with a shoulder guard →
// celestial white-and-gold robe. A sash with hanging tails, prayer beads, a bald head crowned by helm tier (cloth
// headband → iron circlet → bronze circlet → golden fillet → phoenix crown), wrapped forearms with bracers by glove
// tier, and fist weapons by weapon tier (cloth wraps → iron knuckles → tiger claws → golden dragon → heaven gauntlet).
// The monk's own arms are drawn here (the rig's arms stay at rest, tucked behind the torso and under the sash) so
// every skill gets a readable pose: alternating punches, twin palms, prayer hands, a flying guard, seven flash strikes.
import { BASE_BY_ID } from '../../data/items';
import type { Look, Pose } from '../../render/actors';
import { shade } from '../../render/iso';
import { CLASS_LOOK, DECOR, ITEM_KIND, OFFHAND_ART, WEAPON_ART, type RigAnchors } from '../../render/registry';
import type { EquipSlot, Hero } from '../../sim/types';
import { COMBO, SEVEN, sevenAt } from './shared';

type C2D = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
export const ease = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const outCubic = (x: number): number => 1 - (1 - clamp01(x)) ** 3;

/** Hex colour lightened (k > 0) or darkened (k < 0), kept as hex so it can be shaded again. */
export function tone(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number): string => { const x = Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)); return Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0'); };
  return '#' + ch((n >> 16) & 255) + ch((n >> 8) & 255) + ch(n & 255);
}

// ================================================================ palette
export const GOLD = '#f0b848', GOLD_HI = '#fff0b8', GOLD_DK = '#9a6a1c';
const SKIN = '#d9a273';

interface Garb {
  top: string; trim: string; kasaya: string; kTrim: string;
  sash: string; sashEnd: string; pants: string; bead: string; beadHi: string;
}
/** Index = chest tier + 1 (no chest … celestial robe). */
const GARB: Garb[] = [
  { top: '', trim: '', kasaya: '', kTrim: '', sash: '#8a2a16', sashEnd: '#6a1e0e', pants: '#c2a47a', bead: '#5a3218', beadHi: '#8a5a30' },
  { top: '#dd7f2c', trim: '#f3c078', kasaya: '', kTrim: '', sash: '#6e3316', sashEnd: '#52240e', pants: '#cdb48a', bead: '#5a3218', beadHi: '#8a5a30' },
  { top: '#e2791f', trim: '#f6c27a', kasaya: '#86281a', kTrim: '#a8442a', sash: '#5e1a10', sashEnd: '#461208', pants: '#c9ae82', bead: '#4a2a16', beadHi: '#7a4a28' },
  { top: '#e8711a', trim: '#ffcf7a', kasaya: '#a3261c', kTrim: '#e2b44a', sash: '#7e1a12', sashEnd: '#e2b44a', pants: '#ccb088', bead: '#6a3a1c', beadHi: '#a0683a' },
  { top: '#ee7612', trim: '#ffd98a', kasaya: '#ad1f1a', kTrim: '#f2c14e', sash: '#8e1a10', sashEnd: '#f2c14e', pants: '#d2b88e', bead: '#c8903e', beadHi: '#ffe1a0' },
  { top: '#f5eddd', trim: '#ffd76a', kasaya: '#e9b23e', kTrim: '#fff0b0', sash: '#c8922a', sashEnd: '#fff0b0', pants: '#f7f2e6', bead: '#ffd66a', beadHi: '#fffbe0' },
];
/** Bracer colour by glove tier (none: bare wraps). */
const BRACER = ['#7a4e2c', '#8b909a', '#8b909a', '#c3c8d2', '#3a2618'];
/** Foot colour by boot tier (none: bare feet). */
const FEET = ['#a8844e', '#5a4430', '#5a4430', '#3e2c1e', '#2c1e16'];
const WRAP = '#efe6d3';
/** Shin wraps under the robe (the rig's legs). */
const LEG_WRAP = '#e2d7bf';

// ================================================================ state carried on the Look
/** Monk-specific state carried on the Look (the rig ignores unknown fields). */
export interface MkState {
  /** Active skill ('' when idle), its progress 0..1 and time (s). */
  act: string; k: number; t: number;
  /** Chest, helm, glove, boot and weapon tiers (-1 = none). */
  ct: number; ht: number; gt: number; bt: number; wt: number;
  /** Weapon rarity glow. */
  glow?: string;
  /** Mantra buff visibility 0..1. */
  mantra: number;
  /** Which hand throws the basic palm strike (0 front, 1 back): alternates every strike. */
  hand: number;
}
export type MkLook = Look & { mk?: MkState };

/** The hero last dressed (render-side reference for effects that follow him, e.g. the mantra circle). */
export let heroRef: Hero | null = null;
let lastAct: unknown = null;
let palmHand = 1;

function tierOf(h: Hero, slot: EquipSlot): number {
  const it = h.equip?.[slot];
  return it && it.req <= h.level ? BASE_BY_ID[it.base]?.tier ?? -1 : -1;
}

CLASS_LOOK.monk = (h, common, ct) => {
  heroRef = h;
  const a = h.act;
  if (a !== lastAct) { lastAct = a; if (a && (a.skill === 'mk_palm' || a.skill === 'kick')) palmHand ^= 1; }
  const act = a ? a.skill : '';
  const k = a ? clamp01(a.t / Math.max(1e-3, a.dur)) : 0;
  const mb = h.buffs?.find((b) => b.id === 'mk_mantra');
  const mantra = mb ? Math.min(1, (mb.dur - mb.t) / 0.4, mb.t / 0.8) : 0;
  const t = Math.max(-1, Math.min(4, ct));
  const G = GARB[t + 1];
  const bt = tierOf(h, 'boots');
  const wt = common.weapon === 'knuckle' ? Math.max(0, Math.min(4, common.wTier ?? 0)) : -1;
  const s: MkState = {
    act, k, t: a ? a.t : 0,
    ct: t, ht: common.helm ?? -1, gt: tierOf(h, 'gloves'), bt, wt,
    glow: common.wGlow, mantra, hand: palmHand,
  };
  // flying kick: the torso leans back over the kicking leg (same envelope as the kick leg in computeArms)
  const kick = act === 'mk_kick' ? (k < 0.1 ? outCubic(k / 0.1) : k > 0.85 ? 1 - ease((k - 0.85) / 0.15) : 1) : 0;
  const L: MkLook = {
    // under a robe only the shins show: white leg wraps (gaiters); bare-chested, plain trousers
    skin: SKIN, body: t < 0 ? SKIN : G.top, legs: t < 0 ? G.pants : t >= 4 ? G.pants : LEG_WRAP,
    hunch: -0.42 * kick,
    boots: bt >= 0 ? FEET[Math.min(4, bt)] : tone(SKIN, -0.08),
    head: 'human', helm: -1,
    eyes: mantra > 0.3 || act === 'mk_seven' ? '#ffc640' : '#2a180e',
    build: 1.02, height: 1.0,
    // the rig only needs a melee 'punch' weapon for its body lean; the fists are drawn with the monk's own arms
    weapon: 'mk_fist', wTier: Math.max(0, wt), wGlow: common.wGlow,
    offhand: 'mk_arm', offTier: 0,
    armorTier: -1, decor: 'mk_garb',
    mk: s,
  };
  return L;
};

// ================================================================ arm poses
// Angles use the rig's convention: 0 = hanging straight down, π/2 = pointing forward, π = straight up.
const FIST = 0, PALM = 1, PRAY = 2, OPEN = 3;
interface ArmPose { u: number; f: number; hand: number; glow: number }
const A = (u: number, f: number, hand = FIST, glow = 0): ArmPose => ({ u, f, hand, glow });
function lerpArm(a: ArmPose, b: ArmPose, t: number): ArmPose {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return { u: a.u + (b.u - a.u) * t, f: a.f + (b.f - a.f) * t, hand: t < 0.5 ? a.hand : b.hand, glow: a.glow + (b.glow - a.glow) * t };
}
const READY_F = A(0.85, 1.78, PALM), READY_B = A(0.6, 2.45);
const EXT_F = A(1.5, 1.56), EXT_B = A(1.42, 1.5);
const CHAMB_F = A(-0.45, 1.38), CHAMB_B = A(-0.3, 1.45);
const PRAY_F = A(0.3, 2.78, PRAY), PRAY_B = A(0.52, 2.58, PRAY);
const GATHER_F = A(-0.62, 0.95, PALM), GATHER_B = A(-0.5, 1.05, PALM);
const KICK_F = A(0.95, 2.62), KICK_B = A(-1.2, -0.85, OPEN);
const HIT_F = A(0.35, 2.7), HIT_B = A(0.3, 2.55);

export interface Arms {
  F: ArmPose; B: ArmPose;
  /** Motion smear of each fist (0..1) while it snaps out. */
  sF: number; sB: number;
  /** Flying-kick leg extension 0..1, gathered chi between the hands 0..1, strike flash 0..1. */
  kick: number; chi: number; flash: number;
}

/** Chamber (pull back), extension and smear of an arm striking at k0 (units of the act, fractions or seconds). */
function strike(k: number, k0: number, pre: number, hold: number, post: number): [number, number, number] {
  const s0 = k0 - pre, s1 = k0 - pre * 0.35;
  if (k < s0) return [0, 0, 0];
  if (k < s1) return [ease((k - s0) / (s1 - s0)), 0, 0];
  if (k < k0) { const x = (k - s1) / (k0 - s1); return [1 - x, outCubic(x), 1]; }
  if (k < k0 + hold) return [0, 1, 1 - (k - k0) / hold];
  if (k < k0 + hold + post) return [0, 1 - ease((k - k0 - hold) / post), 0];
  return [0, 0, 0];
}
const maxS = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];
function strikeArm(ready: ArmPose, chamb: ArmPose, ext: ArmPose, s: [number, number, number], hikite: number): ArmPose {
  return lerpArm(lerpArm(ready, chamb, Math.max(s[0], hikite)), ext, s[1]);
}

function armRest(p: Pose): number { return 0.12 + (p.moving ? -Math.sin(p.walk * 4.2) * 0.35 : Math.sin(p.t * 2) * 0.03); }

/** Both arms for this frame (computed from the original pose, before the rig's arms are parked). */
export function computeArms(p: Pose, s: MkState): Arms {
  const br = Math.sin(p.t * 2.2) * 0.045;
  // lead hand: an open palm with bare wraps, a fist once real knuckles are worn (so the weapon shows)
  const rF = { ...READY_F, u: READY_F.u + br, f: READY_F.f - br * 0.6, hand: s.wt >= 1 ? FIST : PALM };
  const rB = { ...READY_B, u: READY_B.u - br * 0.5, f: READY_B.f + br * 0.4 };
  const o: Arms = { F: rF, B: rB, sF: 0, sB: 0, kick: 0, chi: 0, flash: 0 };
  let act = s.act, k = s.k;
  // previews (title portraits) animate the pose without an act
  if (!act && p.atk >= 0) { act = 'mk_palm'; k = p.atk; }
  else if (!act && p.cast >= 0) { act = 'mk_mantra'; k = p.cast; }
  if (p.dead >= 0 || (p.moving && !act)) {
    const ar = armRest(p);
    o.F = A(ar, ar + 0.3); o.B = A(ar + 0.1, ar + 0.45);
    return o;
  }
  switch (act) {
    case '': {
      if (p.hit > 0) { const h = Math.min(1, p.hit * 6); o.F = lerpArm(rF, HIT_F, h); o.B = lerpArm(rB, HIT_B, h); }
      break;
    }
    case 'mk_combo': {
      const [a0, a1, a2] = COMBO.at;
      const jab = strike(k, a0, 0.16, 0.05, 0.12);
      const heavy = strike(k, a2, 0.22, 0.1, 0.12);
      const cross = strike(k, a1, 0.17, 0.05, 0.13);
      const fs = maxS(jab, heavy);
      const exF = heavy[1] > 0 || heavy[0] > 0 ? { ...EXT_F, u: 1.42, hand: PALM } : EXT_F;
      o.F = strikeArm(rF, CHAMB_F, exF, fs, cross[1] * 0.75);
      o.B = strikeArm(rB, CHAMB_B, EXT_B, cross, Math.max(jab[1] * 0.35, heavy[1] * 0.9, heavy[0] * 0.4));
      o.sF = fs[2]; o.sB = cross[2];
      break;
    }
    case 'mk_wave': {
      // gather chi at the hip, then thrust both palms
      if (k < 0.36) { const x = ease(k / 0.36); o.F = lerpArm(rF, GATHER_F, x); o.B = lerpArm(rB, GATHER_B, x); o.chi = x; }
      else if (k < 0.5) { const x = outCubic((k - 0.36) / 0.14); o.F = lerpArm(GATHER_F, A(1.46, 1.5, PALM), x); o.B = lerpArm(GATHER_B, A(1.36, 1.44, PALM), x); o.chi = 1; o.sF = o.sB = 1; }
      else if (k < 0.72) { o.F = A(1.46, 1.5, PALM); o.B = A(1.36, 1.44, PALM); o.chi = 1 - (k - 0.5) / 0.22; }
      else { const x = ease((k - 0.72) / 0.28); o.F = lerpArm(A(1.46, 1.5, PALM), rF, x); o.B = lerpArm(A(1.36, 1.44, PALM), rB, x); }
      break;
    }
    case 'mk_mantra': {
      const x = k < 0.3 ? ease(k / 0.3) : k < 0.8 ? 1 : 1 - ease((k - 0.8) / 0.2);
      o.F = lerpArm(rF, PRAY_F, x); o.B = lerpArm(rB, PRAY_B, x);
      o.chi = x * (0.6 + 0.4 * Math.sin(Math.min(1, k * 2) * Math.PI));
      break;
    }
    case 'mk_kick': {
      const x = k < 0.12 ? ease(k / 0.12) : k > 0.88 ? 1 - ease((k - 0.88) / 0.12) : 1;
      o.F = lerpArm(rF, KICK_F, x); o.B = lerpArm(rB, KICK_B, x);
      o.kick = k < 0.1 ? outCubic(k / 0.1) : k > 0.85 ? 1 - ease((k - 0.85) / 0.15) : 1;
      break;
    }
    case 'mk_seven': {
      const t = s.t, last = sevenAt(SEVEN.n - 1);
      if (t > last + 0.1) {
        const x = ease((t - last - 0.1) / 0.1);
        o.F = lerpArm(EXT_F, PRAY_F, x); o.B = lerpArm(CHAMB_B, PRAY_B, x); o.chi = x;
        break;
      }
      let fS: [number, number, number] = [0, 0, 0], bS: [number, number, number] = [0, 0, 0];
      for (let i = 0; i < SEVEN.n; i++) {
        const c = strike(t, sevenAt(i), 0.07, 0.035, 0.045);
        if (i % 2 === 0) fS = maxS(fS, c); else bS = maxS(bS, c);
        const since = t - sevenAt(i);
        if (since >= 0) o.flash = Math.max(o.flash, 1 - since / 0.09);
      }
      o.F = strikeArm(rF, CHAMB_F, EXT_F, fS, bS[1] * 0.8);
      o.B = strikeArm(rB, CHAMB_B, EXT_B, bS, fS[1] * 0.8);
      o.sF = fS[2]; o.sB = bS[2];
      break;
    }
    default: {
      // palm strike (basic, barrel kicks, previews): the hands alternate
      const st = strike(k, 0.5, 0.42, 0.18, 0.3);
      const back = act === 'mk_palm' && s.hand === 1;
      const hik = Math.max(st[0] * 0.25, st[1] * 0.85);
      if (back) { o.B = strikeArm(rB, CHAMB_B, { ...EXT_B, hand: PALM }, st, 0); o.F = lerpArm(rF, CHAMB_F, hik); o.sB = st[2]; }
      else { o.F = strikeArm(rF, CHAMB_F, { ...EXT_F, hand: PALM }, st, 0); o.B = lerpArm(rB, CHAMB_B, hik); o.sF = st[2]; }
    }
  }
  return o;
}

// ================================================================ drawing helpers
/** A limb segment drawn like the rig's (outline, body, lit highlight). */
function seg(c: C2D, x0: number, y0: number, x1: number, y1: number, w: number, col: string): void {
  c.lineCap = 'round';
  c.strokeStyle = shade(col, -0.4); c.lineWidth = w + 0.9;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.strokeStyle = col; c.lineWidth = w;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  if (w > 2.2) {
    const l = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / l, ny = (x1 - x0) / l;
    const s = nx + ny < 0 ? 1 : -1, o = w * 0.22 * s;
    c.strokeStyle = shade(col, 0.3); c.lineWidth = w * 0.3;
    c.beginPath(); c.moveTo(x0 + nx * o, y0 + ny * o); c.lineTo(x1 + nx * o, y1 + ny * o); c.stroke();
  }
}

/** Rounded rectangle path (without CanvasRenderingContext2D.roundRect, which older mobile browsers lack). */
function rrect(c: C2D, x: number, y: number, w: number, h: number, r: number): void {
  const q = Math.min(r, w / 2, h / 2);
  c.moveTo(x + q, y); c.lineTo(x + w - q, y); c.quadraticCurveTo(x + w, y, x + w, y + q);
  c.lineTo(x + w, y + h - q); c.quadraticCurveTo(x + w, y + h, x + w - q, y + h);
  c.lineTo(x + q, y + h); c.quadraticCurveTo(x, y + h, x, y + h - q);
  c.lineTo(x, y + q); c.quadraticCurveTo(x, y, x + q, y); c.closePath();
}

function glowDot(c: C2D, x: number, y: number, r: number, col: string, a: number): void {
  if (a <= 0.01 || r <= 0) return;
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,252,235,${Math.min(1, a)})`); g.addColorStop(0.35, `rgba(${col},${a * 0.6})`); g.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.restore();
}

// ================================================================ fist weapons
const KN_METAL = ['#e9dfca', '#666b76', '#b87a34', '#e6b340', '#f3ecdc'];

/**
 * Fist weapon in the hand's local frame: origin at the centre of the fist, +y out of the knuckles (the punch
 * direction), +x across the back of the hand. `dk` darkens it for the far arm. Also the WEAPON_ART / icon art.
 */
export function knuckle(c: C2D, tier: number, dk: number, time: number, glow?: string): void {
  const col = (hex: string): string => (dk ? tone(hex, dk) : hex);
  c.lineJoin = 'round'; c.lineCap = 'round';
  switch (tier) {
    case 0: { // cloth wraps binding the fist, a loose end fluttering behind the wrist
      c.fillStyle = col(WRAP); c.strokeStyle = col('#a89a80'); c.lineWidth = 0.5;
      c.beginPath(); rrect(c, -2.5, -2.1, 5, 4.6, 1.6); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-2.4, -0.6); c.lineTo(2.4, 0.4); c.moveTo(-2.4, 0.9); c.lineTo(2.4, 1.9); c.stroke();
      const w = Math.sin(time * 9) * 0.9;
      c.strokeStyle = col(WRAP); c.lineWidth = 1.1;
      c.beginPath(); c.moveTo(1.8, -1.8); c.quadraticCurveTo(3.4 + w, -4, 2.4 - w, -6.4); c.stroke();
      break;
    }
    case 1: { // iron knuckle-duster: a bar with four studs across the knuckles
      c.fillStyle = col('#4e525c'); c.beginPath(); rrect(c, -2.9, 1.3, 5.8, 1.9, 0.7); c.fill();
      c.fillStyle = col('#7c828e');
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-2.1 + i * 1.4, 3.3, 0.78, 0, TAU); c.fill(); }
      c.fillStyle = col('#b6bcc8'); for (let i = 0; i < 4; i++) c.fillRect(-2.35 + i * 1.4, 2.9, 0.45, 0.35);
      c.fillStyle = col('#3c4048'); c.fillRect(2.2, -1.8, 0.9, 3.2); // grip bar along the palm edge
      break;
    }
    case 2: { // tiger fist: striped bronze plate on the back of the hand, three hooked claws
      c.fillStyle = col('#ece4d4');
      for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 1.5 - 0.5, 2); c.quadraticCurveTo(i * 1.8 + 0.1, 5.2, i * 1.2 + 1.3, 6.6); c.lineTo(i * 1.5 + 0.55, 2); c.closePath(); c.fill(); }
      const g = c.createLinearGradient(-2.6, 0, 2.6, 0);
      g.addColorStop(0, col('#f2a64a')); g.addColorStop(0.6, col('#c46a1e')); g.addColorStop(1, col('#7a3a10'));
      c.fillStyle = g; c.beginPath(); c.moveTo(-2.7, -2); c.lineTo(2.7, -2); c.lineTo(3, 2.4); c.quadraticCurveTo(0, 3.4, -3, 2.4); c.closePath(); c.fill();
      c.strokeStyle = col('#1e120a'); c.lineWidth = 0.55;
      for (let i = 0; i < 3; i++) { const y = -1.3 + i * 1.3; c.beginPath(); c.moveTo(-2.7, y); c.quadraticCurveTo(-1.2, y + 0.9, -0.2, y + 0.2); c.moveTo(2.8, y + 0.3); c.quadraticCurveTo(1.4, y + 1, 0.5, y + 0.5); c.stroke(); }
      break;
    }
    case 3: { // golden dragon: the dragon's head rides the fist, jaws open past the knuckles, a horn sweeping back
      const g = c.createLinearGradient(-3, 0, 3, 0);
      g.addColorStop(0, col(GOLD_HI)); g.addColorStop(0.45, col(GOLD)); g.addColorStop(1, col(GOLD_DK));
      c.fillStyle = col('#8a5a16');
      c.beginPath(); c.moveTo(1.2, -1); c.quadraticCurveTo(3.8, -3.2, 2.6, -6.6); c.quadraticCurveTo(2.2, -3.6, 0, -1.6); c.closePath(); c.fill(); // horn
      c.fillStyle = g;
      c.beginPath(); c.moveTo(-2.8, -2.3); c.lineTo(2.7, -2.1); c.quadraticCurveTo(3.4, 1.4, 2.4, 3.2); c.lineTo(1.4, 5.8); c.lineTo(0.4, 3.6); c.lineTo(-0.4, 3.6); c.lineTo(-1.6, 5.2); c.lineTo(-2.6, 3); c.quadraticCurveTo(-3.3, 0.6, -2.8, -2.3); c.closePath(); c.fill();
      c.strokeStyle = col('#6a4210'); c.lineWidth = 0.4; c.stroke();
      c.strokeStyle = col('#fff2c0'); c.lineWidth = 0.35;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-0.2, -1.4 + i * 1.2, 1.5, 0.3, Math.PI - 0.3); c.stroke(); } // scales
      c.fillStyle = col('#fffbe8'); c.beginPath(); c.moveTo(0.5, 3.6); c.lineTo(0.9, 4.6); c.lineTo(1.2, 3.6); c.fill(); // fang
      c.save(); if (!dk) { c.shadowColor = '#ff3020'; c.shadowBlur = 3; }
      c.fillStyle = col('#e02818'); c.beginPath(); c.arc(1.5, 1.2, 0.72, 0, TAU); c.fill(); // eye gem
      c.restore();
      break;
    }
    default: { // heaven gauntlet: white-gold plates banded in gold, cloud flanges at the wrist, pointed gold knuckle
      // caps and a sapphire set in the back of the hand
      c.fillStyle = col(GOLD_DK);
      c.beginPath(); c.moveTo(-2.9, -2.6); c.quadraticCurveTo(-5, -2.9, -4.7, -4.9); c.quadraticCurveTo(-3.5, -3.6, -1.9, -3.3); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(2.9, -2.6); c.quadraticCurveTo(5, -2.9, 4.7, -4.9); c.quadraticCurveTo(3.5, -3.6, 1.9, -3.3); c.closePath(); c.fill();
      c.fillStyle = col(GOLD);
      c.beginPath(); c.moveTo(-2.7, -2.4); c.quadraticCurveTo(-4.4, -2.8, -4.3, -4.3); c.quadraticCurveTo(-3.3, -3.3, -2, -3.1); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(2.7, -2.4); c.quadraticCurveTo(4.4, -2.8, 4.3, -4.3); c.quadraticCurveTo(3.3, -3.3, 2, -3.1); c.closePath(); c.fill();
      const g = c.createLinearGradient(-2.8, -2, 2.8, 3);
      g.addColorStop(0, col('#fffdf4')); g.addColorStop(0.5, col('#eadcb8')); g.addColorStop(1, col('#a88a4c'));
      c.fillStyle = g; c.beginPath(); rrect(c, -2.8, -3, 5.6, 6.2, 1.9); c.fill();
      c.strokeStyle = col(GOLD_DK); c.lineWidth = 0.5; c.stroke();
      c.strokeStyle = col(GOLD); c.lineWidth = 0.55;
      c.beginPath(); c.moveTo(-2.7, -1.2); c.quadraticCurveTo(0, -0.5, 2.7, -1.2); c.moveTo(-2.7, 1.3); c.quadraticCurveTo(0, 2, 2.7, 1.3); c.stroke();
      c.fillStyle = col(GOLD);
      for (let i = 0; i < 4; i++) { const x = -2.1 + i * 1.4; c.beginPath(); c.moveTo(x - 0.62, 2.9); c.lineTo(x, 4.5); c.lineTo(x + 0.62, 2.9); c.closePath(); c.fill(); }
      c.fillStyle = col('#fff4c8'); for (let i = 0; i < 4; i++) c.fillRect(-2.3 + i * 1.4, 3, 0.3, 0.6);
      c.fillStyle = col('#1e4c9a'); c.beginPath(); c.arc(1, 0.1, 1.05, 0, TAU); c.fill();
      c.fillStyle = col('#7ac8ff'); c.beginPath(); c.arc(0.85, -0.05, 0.62, 0, TAU); c.fill();
      c.fillStyle = '#ffffff'; c.fillRect(0.55, -0.45, 0.32, 0.32);
      if (!dk) glowDot(c, 1, 0.1, 2.8 + 0.4 * Math.sin(time * 5), '120,190,255', 0.55);
    }
  }
  if (glow && !dk && tier >= 1) glowDot(c, 0, 2.6, 4.6, glow === '#e0b050' ? '255,190,90' : glow === '#f0e070' ? '255,235,130' : '130,150,255', 0.24);
}

/** The bare or wrapped fist (drawn under the weapon). Local frame as knuckle(). */
function fistShape(c: C2D, skin: string, wrapped: boolean): void {
  c.fillStyle = shade(skin, -0.35); c.beginPath(); rrect(c, -2.55, -2.2, 5.1, 4.9, 1.7); c.fill();
  c.fillStyle = skin; c.beginPath(); rrect(c, -2.2, -1.9, 4.4, 4.3, 1.5); c.fill();
  c.strokeStyle = shade(skin, -0.3); c.lineWidth = 0.4;
  c.beginPath(); c.moveTo(-1.8, 1.4); c.lineTo(1.9, 1.4); c.moveTo(-0.6, 1.4); c.lineTo(-0.6, 2.4); c.moveTo(0.6, 1.4); c.lineTo(0.6, 2.4); c.stroke();
  if (wrapped) { c.fillStyle = WRAP; c.fillRect(-2.3, -1.9, 4.6, 1.8); }
}

/** Open palm: heel of the hand leading, fingers pointing along +x. */
function palmShape(c: C2D, skin: string, cuff: string | null): void {
  c.fillStyle = shade(skin, -0.35);
  c.beginPath(); rrect(c, -2.2, -0.2, 5.2, 3.1, 1.2); c.fill();
  c.strokeStyle = shade(skin, -0.35); c.lineWidth = 1.3; c.lineCap = 'round';
  c.beginPath(); for (let i = 0; i < 4; i++) { const y = 0.35 + i * 0.72; c.moveTo(2.6, y); c.lineTo(5 - Math.abs(i - 1.3) * 0.5, y + (i - 1.5) * 0.18); } c.stroke();
  c.fillStyle = skin; c.beginPath(); rrect(c, -1.9, 0.1, 4.7, 2.5, 1); c.fill();
  c.strokeStyle = skin; c.lineWidth = 0.75;
  c.beginPath(); for (let i = 0; i < 4; i++) { const y = 0.35 + i * 0.72; c.moveTo(2.4, y); c.lineTo(4.8 - Math.abs(i - 1.3) * 0.5, y + (i - 1.5) * 0.18); } c.stroke();
  c.lineWidth = 1.1; c.beginPath(); c.moveTo(-0.4, 2.5); c.lineTo(0.9, 3.8); c.stroke(); // thumb
  if (cuff) { c.fillStyle = cuff; c.fillRect(-2.3, -1.4, 4.6, 1.5); }
}

/** Prayer hand: flat, fingers continuing the forearm (+y). */
function prayShape(c: C2D, skin: string, cuff: string | null): void {
  c.fillStyle = shade(skin, -0.35); c.beginPath(); rrect(c, -1.6, -0.3, 3.2, 6.4, 1.5); c.fill();
  c.fillStyle = skin; c.beginPath(); rrect(c, -1.3, 0, 2.6, 5.8, 1.3); c.fill();
  c.strokeStyle = shade(skin, -0.25); c.lineWidth = 0.3; c.beginPath(); c.moveTo(-0.4, 2.8); c.lineTo(-0.4, 5.4); c.moveTo(0.4, 2.8); c.lineTo(0.4, 5.4); c.stroke();
  if (cuff) { c.fillStyle = cuff; c.fillRect(-1.7, -1.3, 3.4, 1.5); }
}

function openShape(c: C2D, skin: string): void {
  c.fillStyle = shade(skin, -0.35); c.beginPath(); rrect(c, -1.8, -0.2, 3.6, 3.4, 1.2); c.fill();
  c.strokeStyle = shade(skin, -0.35); c.lineWidth = 1.2; c.lineCap = 'round';
  c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(-1.1 + i * 0.75, 2.6); c.lineTo(-1.5 + i * 1.1, 5.2); } c.stroke();
  c.fillStyle = skin; c.beginPath(); rrect(c, -1.5, 0.1, 3, 2.9, 1); c.fill();
  c.strokeStyle = skin; c.lineWidth = 0.7;
  c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(-1.1 + i * 0.75, 2.6); c.lineTo(-1.5 + i * 1.1, 5); } c.stroke();
}

// ================================================================ arms
/** Shoulder, elbow and hand of an arm pose. */
function armJoints(sx: number, sy: number, P: ArmPose, a: RigAnchors): [number, number, number, number] {
  const armL = 17 * a.height;
  const ex = sx + Math.sin(P.u) * armL * 0.52, ey = sy + Math.cos(P.u) * armL * 0.52;
  return [ex, ey, ex + Math.sin(P.f) * armL * 0.5, ey + Math.cos(P.f) * armL * 0.5];
}

/** The robe's wide short sleeve: flaring from the shoulder, its lower edge hanging with the cloth's weight, a dark
 *  opening at the hem (trimmed from the maroon kasaya tier up) and a fold. */
function sleeve(c: C2D, sx: number, sy: number, ex: number, ey: number, w: number, s: MkState, dk: number): void {
  const G = GARB[s.ct + 1];
  const L = Math.hypot(ex - sx, ey - sy) || 1, ux = (ex - sx) / L, uy = (ey - sy) / L;
  // normal pointing to the lower side of the arm (screen +y), where the cloth sags
  let nx = -uy, ny = ux;
  if (ny < 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
  const len = L * (s.ct >= 4 ? 0.64 : 0.54);
  const hx = sx + ux * len, hy = sy + uy * len;
  const w0 = w * 0.6, w1 = w * (s.ct >= 4 ? 1.02 : 0.9), sag = w * 0.5;
  const top = tone(G.top, dk);
  // hem corners: upper (−n) and lower (+n, sagging down and a little back)
  const ax = hx - nx * w1, ay = hy - ny * w1;
  const bx = hx + nx * w1 - ux * sag * 0.3, by = hy + ny * w1 + sag;
  const g = c.createLinearGradient(sx - nx * w1, sy - ny * w1, sx + nx * w1, sy + ny * w1);
  g.addColorStop(0, tone(top, 0.14)); g.addColorStop(0.55, top); g.addColorStop(1, tone(top, -0.28));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(sx - nx * w0, sy - ny * w0);
  c.lineTo(ax, ay);
  c.quadraticCurveTo(hx + ux * w * 0.25 + nx * w1 * 0.2, hy + uy * w * 0.25 + ny * w1 * 0.2 + sag * 0.6, bx, by);
  c.quadraticCurveTo(sx + nx * w0 * 1.3 + ux * len * 0.4, sy + ny * w0 * 1.3 + uy * len * 0.4 + sag * 0.3, sx + nx * w0, sy + ny * w0);
  // round over the shoulder cap
  const a0 = Math.atan2(ny, nx);
  c.arc(sx, sy, w0, a0, a0 + Math.PI, ux * ny - uy * nx < 0);
  c.closePath();
  c.fill();
  c.strokeStyle = tone(top, -0.5); c.lineWidth = 0.5; c.stroke();
  // the dark opening at the hem, then the hem trim
  c.lineCap = 'round';
  c.strokeStyle = tone(top, -0.55); c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(hx + ux * w * 0.25 + nx * w1 * 0.2, hy + uy * w * 0.25 + ny * w1 * 0.2 + sag * 0.6, bx, by); c.stroke();
  if (s.ct >= 1) {
    c.strokeStyle = tone(s.ct >= 3 ? G.kTrim : G.trim, dk); c.lineWidth = s.ct >= 3 ? 0.9 : 0.7;
    c.beginPath(); c.moveTo(ax - ux * 0.9, ay - uy * 0.9); c.quadraticCurveTo(hx - ux * 0.6 + nx * w1 * 0.2, hy - uy * 0.6 + ny * w1 * 0.2 + sag * 0.6, bx - ux * 0.9, by - uy * 0.9); c.stroke();
  }
  // a fold running down the sleeve
  c.strokeStyle = tone(top, -0.3); c.lineWidth = 0.45;
  c.beginPath(); c.moveTo(sx + nx * w0 * 0.3, sy + ny * w0 * 0.3); c.quadraticCurveTo(hx + nx * w1 * 0.2, hy + ny * w1 * 0.2, hx + nx * w1 * 0.45 - ux * 0.4, hy + ny * w1 * 0.45 + sag * 0.5); c.stroke();
}

function drawArm(c: C2D, sx: number, sy: number, P: ArmPose, far: boolean, s: MkState, a: RigAnchors, time: number, smear: number): void {
  const w = 3.8 * a.build;
  const dk = far ? -0.3 : 0;
  const skin = tone(SKIN, dk);
  const [ex, ey, hx, hy] = armJoints(sx, sy, P, a);
  // motion smear: pale fists trailing back toward the shoulder while the punch snaps out
  if (smear > 0.05 && P.hand !== PRAY) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 1; i <= 3; i++) {
      const q = i * 0.16;
      const px = hx + (sx - hx) * q, py = hy + (sy - hy) * q;
      c.globalAlpha = smear * 0.22 * (1 - i / 4);
      c.fillStyle = '#fff4d8'; c.beginPath(); c.ellipse(px, py, 3.2, 2.4, 0, 0, TAU); c.fill();
    }
    c.globalAlpha = smear * 0.35;
    c.strokeStyle = '#fff8e8'; c.lineWidth = 2.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(hx + (sx - hx) * 0.55, hy + (sy - hy) * 0.55); c.lineTo(hx, hy); c.stroke();
    c.restore();
  }
  // upper arm (bare) and the robe's short, flared sleeve over the shoulder
  seg(c, sx, sy, ex, ey, w, skin);
  if (s.ct >= 0) sleeve(c, sx, sy, ex, ey, w, s, dk);
  else if (!far) {
    // bare shoulder: a hint of the deltoid
    c.strokeStyle = shade(skin, -0.25); c.lineWidth = 0.4; c.beginPath(); c.arc(sx + (ex - sx) * 0.3, sy + (ey - sy) * 0.3, w * 0.45, -0.4, 1.4); c.stroke();
  }
  // forearm: skin, cloth wraps from mid-forearm to the wrist, bracer by glove tier
  seg(c, ex, ey, hx, hy, w * 0.9, skin);
  const fl = Math.hypot(hx - ex, hy - ey) || 1, ux = (hx - ex) / fl, uy = (hy - ey) / fl, nx = -uy, ny = ux;
  const w0x = ex + (hx - ex) * 0.38, w0y = ey + (hy - ey) * 0.38;
  const wrap = tone(WRAP, dk);
  c.lineCap = 'butt';
  c.strokeStyle = shade(wrap, -0.3); c.lineWidth = w * 0.9 + 0.9; c.beginPath(); c.moveTo(w0x, w0y); c.lineTo(hx, hy); c.stroke();
  c.strokeStyle = wrap; c.lineWidth = w * 0.9 + 0.2; c.beginPath(); c.moveTo(w0x, w0y); c.lineTo(hx, hy); c.stroke();
  c.strokeStyle = shade(wrap, -0.22); c.lineWidth = 0.4;
  c.beginPath();
  for (let i = 0; i < 4; i++) {
    const q = 0.44 + i * 0.14, px = ex + (hx - ex) * q, py = ey + (hy - ey) * q, hw = w * 0.48;
    c.moveTo(px + nx * hw - ux * 0.7, py + ny * hw - uy * 0.7); c.lineTo(px - nx * hw + ux * 0.7, py - ny * hw + uy * 0.7);
  }
  c.stroke();
  if (s.gt >= 0) {
    const bc = tone(BRACER[Math.min(4, s.gt)], dk);
    const b0x = ex + (hx - ex) * 0.5, b0y = ey + (hy - ey) * 0.5, b1x = ex + (hx - ex) * 0.86, b1y = ey + (hy - ey) * 0.86;
    c.strokeStyle = shade(bc, -0.4); c.lineWidth = w * 0.9 + 1.5; c.beginPath(); c.moveTo(b0x, b0y); c.lineTo(b1x, b1y); c.stroke();
    c.strokeStyle = bc; c.lineWidth = w * 0.9 + 0.7; c.beginPath(); c.moveTo(b0x, b0y); c.lineTo(b1x, b1y); c.stroke();
    c.strokeStyle = shade(bc, 0.35); c.lineWidth = 0.6; c.beginPath(); c.moveTo(b0x + nx * w * 0.2, b0y + ny * w * 0.2); c.lineTo(b1x + nx * w * 0.2, b1y + ny * w * 0.2); c.stroke();
    if (s.gt >= 3) {
      c.strokeStyle = tone(s.gt >= 4 ? '#e8a838' : GOLD, dk); c.lineWidth = 0.7;
      for (const [px, py] of [[b0x, b0y], [b1x, b1y]]) { c.beginPath(); c.moveTo(px + nx * (w * 0.5 + 0.4), py + ny * (w * 0.5 + 0.4)); c.lineTo(px - nx * (w * 0.5 + 0.4), py - ny * (w * 0.5 + 0.4)); c.stroke(); }
    }
  }
  c.lineCap = 'round';
  // hand, in its local frame (+y along the forearm)
  c.save();
  c.translate(hx, hy); c.rotate(-P.f);
  const cuff = s.wt >= 1 ? tone(KN_METAL[s.wt], dk) : null;
  if (P.hand === FIST) {
    c.translate(0, 1.9);
    fistShape(c, skin, s.wt === 0);
    if (s.wt >= 0) knuckle(c, s.wt, dk, time, s.glow);
  } else if (P.hand === PALM) palmShape(c, skin, cuff);
  else if (P.hand === PRAY) prayShape(c, skin, cuff);
  else openShape(c, skin);
  c.restore();
  // gathered chi / glowing hands
  if (P.glow > 0) glowDot(c, hx, hy, 6 + P.glow * 5, '255,200,90', P.glow);
}

// ================================================================ robe, sash, beads, head
function robeTop(c: C2D, a: RigAnchors, p: Pose, s: MkState): void {
  const G = GARB[s.ct + 1], b = a.build, { shX, shY, hipY } = a;
  const g = c.createLinearGradient(-9 * b, 0, 9 * b, 0);
  g.addColorStop(0, tone(G.top, 0.2)); g.addColorStop(0.5, G.top); g.addColorStop(1, tone(G.top, -0.35));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(shX - 7.7 * b, shY + 2.6);
  c.quadraticCurveTo(shX - 6.4, shY - 1.6, shX - 2.4, shY - 1.1);
  c.lineTo(shX + 3, shY - 0.7);
  c.quadraticCurveTo(shX + 7.4, shY - 0.6, shX + 7.9 * b, shY + 2.8);
  c.quadraticCurveTo(8.2 * b, (shY + hipY) / 2, 7.3 * b, hipY + 0.5);
  c.lineTo(-7.3 * b, hipY + 0.5);
  c.quadraticCurveTo(-8.3 * b, (shY + hipY) / 2, shX - 7.7 * b, shY + 2.6);
  c.closePath(); c.fill();
  c.strokeStyle = tone(G.top, -0.55); c.lineWidth = 0.6; c.stroke();
  if (p.back) {
    // seen from behind: the collar at the nape and a centre seam
    c.strokeStyle = tone(G.trim, -0.1); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(shX - 3.2, shY - 0.6); c.quadraticCurveTo(shX, shY + 1.4, shX + 3.2, shY - 0.4); c.stroke();
    c.strokeStyle = tone(G.top, -0.4); c.lineWidth = 0.6; c.beginPath(); c.moveTo(shX * 0.6, shY + 2); c.lineTo(0, hipY - 1); c.stroke();
    return;
  }
  // crossed collar: skin in the V, the overlapping flap running down to the sash
  c.fillStyle = SKIN;
  c.beginPath(); c.moveTo(shX + 0.4, shY - 0.6); c.lineTo(shX + 5, shY - 0.2); c.lineTo(shX + 3.4, shY + 7.2); c.closePath(); c.fill();
  c.strokeStyle = shade(SKIN, -0.3); c.lineWidth = 0.45; c.beginPath(); c.moveTo(shX + 2.2, shY + 2.4); c.quadraticCurveTo(shX + 3.2, shY + 3.4, shX + 4.4, shY + 2.2); c.stroke();
  c.strokeStyle = G.trim; c.lineWidth = s.ct >= 2 ? 1.5 : 1.1;
  c.beginPath(); c.moveTo(shX - 0.1, shY - 0.9); c.lineTo(shX + 3.4, shY + 7.4); c.quadraticCurveTo(4.6 * b, hipY - 6, 5.6 * b, hipY - 1); c.stroke();
  c.beginPath(); c.moveTo(shX + 5.4, shY - 0.4); c.lineTo(shX + 3.6, shY + 6.8); c.stroke();
  // folds
  c.strokeStyle = tone(G.top, -0.3); c.lineWidth = 0.55;
  c.beginPath(); c.moveTo(shX - 4.5, shY + 4); c.quadraticCurveTo(-3.8, hipY - 8, -4.4, hipY - 1.5); c.moveTo(shX + 6.2, shY + 5); c.quadraticCurveTo(6.4 * b, hipY - 7, 6.6 * b, hipY - 2); c.stroke();
  if (s.ct >= 4) {
    // celestial robe: golden cloud scroll on the breast
    c.strokeStyle = GOLD; c.lineWidth = 0.6;
    c.beginPath(); c.arc(shX - 3, shY + 9, 1.6, Math.PI * 0.2, Math.PI * 1.7); c.arc(shX - 0.4, shY + 9.6, 1.2, Math.PI, Math.PI * 2.4); c.stroke();
  }
}

/** Bare torso (no chest armour): chest and stomach lines on the rig's skin torso. */
function bareTorso(c: C2D, a: RigAnchors, p: Pose): void {
  const { shX, shY, hipY } = a;
  c.strokeStyle = shade(SKIN, -0.28); c.lineWidth = 0.55; c.lineCap = 'round';
  c.beginPath();
  if (!p.back) {
    c.moveTo(shX - 4.8, shY + 6.4); c.quadraticCurveTo(shX - 1.4, shY + 8.4, shX + 1.2, shY + 6.2);
    c.moveTo(shX + 1.6, shY + 6.4); c.quadraticCurveTo(shX + 4.2, shY + 8.2, shX + 6.4, shY + 5.8);
    c.moveTo(shX * 0.5 + 1.3, shY + 8.6); c.lineTo(1.1, hipY - 3);
    for (let i = 0; i < 2; i++) { const y = shY + 11 + i * 2.6; c.moveTo(-1.2, y); c.quadraticCurveTo(1.2, y + 0.6, 3.6, y); }
  } else {
    c.moveTo(shX * 0.6, shY + 3); c.lineTo(0, hipY - 2);
    c.moveTo(shX - 5, shY + 5); c.quadraticCurveTo(shX - 2, shY + 7, shX - 0.5, shY + 4);
    c.moveTo(shX + 5, shY + 5); c.quadraticCurveTo(shX + 2, shY + 7, shX + 0.5, shY + 4);
  }
  c.stroke();
  c.fillStyle = 'rgba(255,230,200,0.18)'; c.beginPath(); c.ellipse(shX - 3, shY + 5, 2.4, 1.4, -0.3, 0, TAU); c.fill();
}

function kasaya(c: C2D, a: RigAnchors, p: Pose, s: MkState, time: number): void {
  const G = GARB[s.ct + 1];
  if (!G.kasaya) return;
  const b = a.build, { shX, shY, hipY } = a;
  // a broad band from the far shoulder across the chest to the front hip (mirrored across the back when seen from behind)
  const m = p.back ? -1 : 1;
  const P0x = shX - 7.4 * m, P0y = shY + 1.2, P1x = shX - 2.6 * m, P1y = shY - 1.2;
  const Q1x = 7.4 * b * m, Q1y = hipY - 5.6, Q0x = 3.2 * m, Q0y = hipY + 0.2;
  c.fillStyle = G.kasaya;
  c.beginPath(); c.moveTo(P0x, P0y); c.quadraticCurveTo(shX - 5 * m, shY - 1.8, P1x, P1y); c.lineTo(Q1x, Q1y); c.quadraticCurveTo(7.8 * b * m, hipY - 1.5, 6.2 * b * m, hipY + 0.6); c.lineTo(Q0x, Q0y); c.closePath(); c.fill();
  // shading across the band
  c.save(); c.clip();
  c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.moveTo(P0x, P0y); c.lineTo(Q0x, Q0y); c.lineTo(Q0x + 2.2 * m, Q0y - 1.4); c.lineTo(P0x + 2.4 * m, P0y - 0.6); c.fill();
  if (s.ct >= 3) {
    // patchwork: gold seams across and along the band
    c.strokeStyle = G.kTrim; c.lineWidth = 0.5;
    c.beginPath();
    for (let i = 1; i < 4; i++) { const q = i / 4; const x0 = P0x + (Q0x - P0x) * q, y0 = P0y + (Q0y - P0y) * q, x1 = P1x + (Q1x - P1x) * q, y1 = P1y + (Q1y - P1y) * q; c.moveTo(x0, y0); c.lineTo(x1, y1); }
    const mx0 = (P0x + P1x) / 2, my0 = (P0y + P1y) / 2, mx1 = (Q0x + Q1x) / 2, my1 = (Q0y + Q1y) / 2; c.moveTo(mx0, my0); c.lineTo(mx1, my1);
    c.stroke();
  } else {
    c.strokeStyle = tone(G.kasaya, -0.35); c.lineWidth = 0.5;
    c.beginPath(); c.moveTo((P0x + P1x) / 2, (P0y + P1y) / 2 + 1); c.quadraticCurveTo((P0x + Q1x) / 2, (P0y + Q1y) / 2 + 2, (Q0x + Q1x) / 2 - 0.5 * m, (Q0y + Q1y) / 2); c.stroke();
  }
  c.restore();
  c.strokeStyle = G.kTrim; c.lineWidth = s.ct >= 2 ? 1 : 0.7;
  c.beginPath(); c.moveTo(P0x, P0y); c.lineTo(Q0x, Q0y); c.moveTo(P1x, P1y); c.lineTo(Q1x, Q1y); c.stroke();
  if (s.ct >= 2 && !p.back) {
    // gold ring clasp on the breast
    const rx = shX + 1.3, ry = shY + 3.2;
    c.strokeStyle = GOLD_DK; c.lineWidth = 1.3; c.beginPath(); c.arc(rx, ry, 1.6, 0, TAU); c.stroke();
    c.strokeStyle = s.ct >= 4 ? '#fff4c8' : GOLD; c.lineWidth = 0.8; c.stroke();
    if (s.ct >= 4) glowDot(c, rx, ry, 4.5, '255,220,120', 0.35 + 0.15 * Math.sin(time * 3));
  }
}

/** Lower robe panel. front=false: the back panel (drawn behind the legs). `long` (0..1): during the flying kick the
 *  front panel hangs to the ground over both of the rig's legs, so only the monk's own kicking leg shows. */
function skirt(c: C2D, a: RigAnchors, p: Pose, s: MkState, front: boolean, flow: number, long = 0): void {
  const G = GARB[s.ct + 1];
  if (!G.top) return;
  const b = a.build, { hipY } = a;
  const sw = p.moving ? Math.sin(p.walk * 4.2) : 0;
  const breeze = Math.sin(p.t * 1.6) * 0.4;
  const col = front ? G.top : tone(G.top, -0.3);
  const len = s.ct >= 4 ? 12 : 10.5;
  if (front) {
    const L = (u: number, v: number): number => u + (v - u) * long;
    const hx = L(9.4 * b + sw * 1.8 + breeze - flow * 7, 7.6 * b), hy = L(hipY + len + 0.5 - flow * 3, -0.8);
    const bx = L(-1.5 + sw * 0.6 - flow * 6, -9.6 * b - Math.sin(p.t * 30) * 0.8), by = L(hipY + len + 0.8 - flow * 2, -1.8);
    const x0 = L(-1.8, -7.2 * b);
    const g = c.createLinearGradient(-4, 0, 10, 0);
    g.addColorStop(0, tone(G.top, 0.08)); g.addColorStop(1, tone(G.top, -0.32));
    c.fillStyle = g;
    c.beginPath(); c.moveTo(x0, hipY - 1.5); c.lineTo(7.3 * b, hipY - 1.5);
    c.quadraticCurveTo(8.9 * b, hipY + 3, hx, hy);
    c.quadraticCurveTo((hx + bx) / 2, hy + 1.6, bx, by);
    c.quadraticCurveTo(L(-2.4, -8.6 * b), hipY + 4, x0, hipY - 1.5); c.closePath(); c.fill();
    c.strokeStyle = tone(G.top, -0.5); c.lineWidth = 0.55; c.stroke();
    c.strokeStyle = tone(G.top, -0.28);
    c.beginPath(); c.moveTo(2.5, hipY); c.quadraticCurveTo(3 + sw, hipY + 5, 3.5 + sw * 1.4 - flow * 5, hy - 0.4); c.moveTo(5.8 * b, hipY); c.quadraticCurveTo(6.8 * b, hipY + 5, 7.2 * b + sw * 1.6 - flow * 6, hy - 0.2); c.stroke();
    if (s.ct >= 2) { c.strokeStyle = G.trim; c.lineWidth = 0.9; c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo((hx + bx) / 2, hy + 1.6, bx, by); c.stroke(); }
  } else {
    const hx = -9 * b - sw * 1.4 + breeze * 0.5 - flow * 9, hy = hipY + len - flow * 3.5;
    c.fillStyle = col;
    c.beginPath(); c.moveTo(-7.2 * b, hipY - 1.5); c.lineTo(2.4, hipY - 1.5);
    c.quadraticCurveTo(2.8, hipY + 5, 1.5 - flow * 4, hipY + len + 0.2 - flow * 2);
    c.quadraticCurveTo((hx + 1.5) / 2, hipY + len + 1.8, hx, hy);
    c.quadraticCurveTo(-8.6 * b, hipY + 3, -7.2 * b, hipY - 1.5); c.closePath(); c.fill();
    c.strokeStyle = tone(G.top, -0.6); c.lineWidth = 0.55; c.stroke();
    if (s.ct >= 2) { c.strokeStyle = tone(G.trim, -0.3); c.lineWidth = 0.9; c.beginPath(); c.moveTo(1.5 - flow * 4, hipY + len + 0.2 - flow * 2); c.quadraticCurveTo((hx + 1.5) / 2, hipY + len + 1.8, hx, hy); c.stroke(); }
  }
}

function sashTail(c: C2D, x: number, y: number, len: number, w: number, p: Pose, ph: number, flow: number, col: string, end: string): void {
  const sw = p.moving ? Math.sin(p.walk * 4.2 + ph) : 0;
  const wave = Math.sin(p.t * 2.4 + ph) * 0.7 + sw * 1.2;
  const ex = x + 1.2 + wave - flow * len * 0.95, ey = y + len * (1 - flow * 0.75);
  const cx = x + 1.8 + wave * 0.4 - flow * len * 0.4, cy = y + len * 0.5;
  c.strokeStyle = shade(col, -0.35); c.lineWidth = w + 0.8; c.lineCap = 'butt';
  c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(cx, cy, ex, ey); c.stroke();
  c.strokeStyle = col; c.lineWidth = w;
  c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(cx, cy, ex, ey); c.stroke();
  // fringed end
  const dx = ex - cx, dy = ey - cy, dl = Math.hypot(dx, dy) || 1;
  c.strokeStyle = end; c.lineWidth = w; c.beginPath(); c.moveTo(ex - (dx / dl) * 1.6, ey - (dy / dl) * 1.6); c.lineTo(ex, ey); c.stroke();
  c.lineCap = 'round';
}

function sash(c: C2D, a: RigAnchors, p: Pose, s: MkState, flow: number, time: number): void {
  const G = GARB[s.ct + 1], b = a.build, { hipY } = a;
  const y = hipY - 3.4;
  c.fillStyle = shade(G.sash, -0.25); c.fillRect(-7.4 * b, y, 14.8 * b, 4);
  c.fillStyle = G.sash; c.fillRect(-7.4 * b, y, 14.8 * b, 2.6);
  c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(-7.4 * b, y + 0.4, 14.8 * b, 0.6);
  if (s.ct >= 3) { c.fillStyle = G.sashEnd; c.fillRect(-7.4 * b, y - 0.2, 14.8 * b, 0.5); c.fillRect(-7.4 * b, y + 3.7, 14.8 * b, 0.5); }
  if (p.back) {
    // knot at the back with the tails hanging over the robe
    sashTail(c, -0.5, y + 2, 9, 2.4, p, 0.5, flow, G.sash, G.sashEnd);
    sashTail(c, 0.8, y + 2, 7.5, 2.2, p, 1.9, flow, tone(G.sash, -0.1), G.sashEnd);
    c.fillStyle = tone(G.sash, 0.1); c.beginPath(); c.ellipse(0, y + 1.8, 2.2, 1.8, 0, 0, TAU); c.fill();
    return;
  }
  // knot at the front hip; the two tails hang over the robe's front edge
  const kx = 6 * b, ky = y + 1.8;
  sashTail(c, kx - 0.4, ky, 11, 2.7, p, 0, flow, G.sash, G.sashEnd);
  sashTail(c, kx + 1.2, ky, 8.6, 2.4, p, 1.7, flow, tone(G.sash, -0.12), G.sashEnd);
  c.fillStyle = shade(G.sash, -0.3); c.beginPath(); c.ellipse(kx, ky, 2.5, 2.1, 0.3, 0, TAU); c.fill();
  c.fillStyle = tone(G.sash, 0.12); c.beginPath(); c.ellipse(kx - 0.2, ky - 0.3, 2, 1.6, 0.3, 0, TAU); c.fill();
  if (s.ct >= 4) glowDot(c, kx, ky, 4, '255,220,140', 0.2 + 0.1 * Math.sin(time * 2));
}

function beads(c: C2D, a: RigAnchors, p: Pose, s: MkState, time: number, lit: number): void {
  if (p.back) return;
  const G = GARB[s.ct + 1], { shX, shY } = a;
  const n = 9, big = s.ct >= 3 ? 1.1 : 0.9;
  // a U of beads over the chest: from the nape side down to the breastbone and up to the throat
  const x0 = shX - 1.8, y0 = shY - 0.4, x1 = shX + 3.2, y1 = shY + 9.4, x2 = shX + 5.6, y2 = shY + 0.2;
  const cx = 2 * x1 - (x0 + x2) / 2, cy = 2 * y1 - (y0 + y2) / 2;
  const pt = (q: number): [number, number] => { const u = 1 - q; return [u * u * x0 + 2 * u * q * cx + q * q * x2, u * u * y0 + 2 * u * q * cy + q * q * y2]; };
  c.strokeStyle = 'rgba(40,20,10,0.6)'; c.lineWidth = 0.35;
  c.beginPath(); for (let i = 0; i <= 12; i++) { const [x, y] = pt(i / 12); if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke();
  for (let i = 0; i < n; i++) {
    const [x, y] = pt((i + 0.5) / n);
    const r = i === Math.floor(n / 2) ? big * 1.4 : big;
    c.fillStyle = shade(G.bead, -0.35); c.beginPath(); c.arc(x, y + 0.15, r, 0, TAU); c.fill();
    c.fillStyle = G.bead; c.beginPath(); c.arc(x - 0.1, y - 0.05, r * 0.85, 0, TAU); c.fill();
    c.fillStyle = G.beadHi; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.35, r * 0.3, 0, TAU); c.fill();
  }
  // tassel below the guru bead
  const [gx, gy] = pt(0.5);
  const tcol = s.ct >= 2 ? GOLD : '#b8322a';
  c.strokeStyle = tcol; c.lineWidth = 0.9;
  const sway = Math.sin(time * 2.2) * 0.4;
  c.beginPath(); c.moveTo(gx, gy + 1.2); c.lineTo(gx + sway, gy + 3.6); c.stroke();
  c.fillStyle = tcol; c.beginPath(); c.moveTo(gx - 0.9 + sway, gy + 3.2); c.lineTo(gx + 0.9 + sway, gy + 3.2); c.lineTo(gx + 1.2 + sway * 1.3, gy + 5.6); c.lineTo(gx - 1.2 + sway * 1.3, gy + 5.6); c.closePath(); c.fill();
  if (s.ct >= 4 || lit > 0) {
    const a0 = Math.max(lit, s.ct >= 4 ? 0.3 + 0.15 * Math.sin(time * 3) : 0);
    for (let i = 0; i < n; i += 2) { const [x, y] = pt((i + 0.5) / n); glowDot(c, x, y, 2.6, '255,210,110', a0 * 0.7); }
  }
}

/** Front shoulder guard (chest tier 3) or a golden cloud mantle (tier 4). */
function shoulderPiece(c: C2D, a: RigAnchors, s: MkState): void {
  if (s.ct < 3) return;
  const sx = a.shX + 2.4, sy = a.shY + 1.4;
  const g = c.createLinearGradient(sx - 4, sy - 3, sx + 4, sy + 3);
  if (s.ct >= 4) { g.addColorStop(0, '#fffbe8'); g.addColorStop(0.5, '#f4d88a'); g.addColorStop(1, '#b88a2a'); }
  else { g.addColorStop(0, GOLD_HI); g.addColorStop(0.5, GOLD); g.addColorStop(1, GOLD_DK); }
  c.fillStyle = g;
  c.beginPath(); c.moveTo(sx - 4.4, sy + 0.6); c.quadraticCurveTo(sx - 3.6, sy - 3.4, sx + 0.4, sy - 3.2); c.quadraticCurveTo(sx + 4.6, sy - 2.6, sx + 4.8, sy + 1.4);
  c.quadraticCurveTo(sx + 2.6, sy + 0.2, sx + 0.8, sy + 2.2); c.quadraticCurveTo(sx - 1.6, sy - 0.2, sx - 4.4, sy + 0.6); c.closePath(); c.fill();
  c.strokeStyle = '#6a4210'; c.lineWidth = 0.4; c.stroke();
  if (s.ct >= 4) { c.strokeStyle = '#fff6d0'; c.lineWidth = 0.5; c.beginPath(); c.arc(sx, sy - 0.8, 1.4, Math.PI * 0.1, Math.PI * 1.6); c.arc(sx + 2.4, sy - 0.2, 1, Math.PI, Math.PI * 2.3); c.stroke(); }
  else { c.fillStyle = '#c02a1a'; c.beginPath(); c.arc(sx + 0.3, sy - 0.8, 0.8, 0, TAU); c.fill(); }
}

/** Bald head: scalp sheen and the three ordination marks; eye glow. */
function headDetails(c: C2D, a: RigAnchors, p: Pose, s: MkState, eyeGlow: number): void {
  const { hx, hy, headR: r } = a;
  c.save();
  c.beginPath(); c.arc(hx, hy, r, 0, TAU); c.clip();
  const g = c.createRadialGradient(hx - r * 0.35, hy - r * 0.6, 0, hx - r * 0.35, hy - r * 0.6, r * 0.8);
  g.addColorStop(0, 'rgba(255,245,225,0.55)'); g.addColorStop(1, 'rgba(255,245,225,0)');
  c.fillStyle = g; c.fillRect(hx - r, hy - r, r * 2, r * 2);
  c.restore();
  if (s.ht < 0) {
    c.fillStyle = shade(SKIN, -0.3);
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(hx - r * 0.1 + i * r * 0.28, hy - r * 0.72 + Math.abs(i - 1) * r * 0.06, r * 0.07, 0, TAU); c.fill(); }
  }
  if (!p.back && eyeGlow > 0) glowDot(c, hx + r * 0.64, hy - r * 0.1, 3.2 * eyeGlow + 1.5, '255,200,80', eyeGlow);
}

/** Headwear by helm tier (drawn over the head); `back` draws the ribbons that trail behind the head. */
function headwear(c: C2D, a: RigAnchors, p: Pose, s: MkState, time: number, back: boolean, flow: number): void {
  const t = s.ht;
  if (t < 0) return;
  const { hx, hy, headR: r } = a;
  const by = hy - r * 0.32;
  if (back) {
    // ribbons / band tails fluttering behind the head (cloth band, bronze circlet, crown)
    if (t === 1 || t === 3) return;
    const col = t === 0 ? '#b8322a' : t === 2 ? '#9a2a1c' : '#e8b440';
    const sw = p.moving ? Math.sin(p.walk * 4.2) : 0;
    for (let i = 0; i < 2; i++) {
      const w = Math.sin(time * 5 + i * 1.3) * 1.2 + sw;
      const len = (t === 4 ? 9 : 7.5) - i * 1.6;
      const x0 = hx - r * 0.9, y0 = by + 0.6 + i * 0.6;
      c.strokeStyle = shade(col, -0.3 * i); c.lineWidth = 1.4 - i * 0.2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 - len * 0.5, y0 + 1 + w, x0 - len - flow * 4, y0 + 2.4 + w * 1.5 - flow * 2); c.stroke();
    }
    return;
  }
  c.save();
  const band = (col: string, hi: string, w: number): void => {
    c.strokeStyle = shade(col, -0.35); c.lineWidth = w + 0.6;
    c.beginPath(); c.ellipse(hx + r * 0.02, by, r * 1.03, r * 0.34, -0.1, Math.PI * 0.95, Math.PI * 2.05); c.stroke();
    c.strokeStyle = col; c.lineWidth = w;
    c.beginPath(); c.ellipse(hx + r * 0.02, by, r * 1.03, r * 0.34, -0.1, Math.PI * 0.95, Math.PI * 2.05); c.stroke();
    c.strokeStyle = hi; c.lineWidth = w * 0.3;
    c.beginPath(); c.ellipse(hx + r * 0.02, by - w * 0.2, r * 1.03, r * 0.34, -0.1, Math.PI * 1.1, Math.PI * 1.7); c.stroke();
  };
  const front = p.back ? hx - r * 0.2 : hx + r * 0.72;
  switch (t) {
    case 0: band('#b8322a', '#e86a50', 1.5); break;
    case 1: {
      band('#6e737e', '#c4c8d2', 1.2);
      if (!p.back) { c.fillStyle = '#8a8f9a'; c.fillRect(front - 1, by - 1.6, 2, 2.2); c.fillStyle = '#d0d4dc'; c.fillRect(front - 0.6, by - 1.2, 0.6, 0.8); }
      break;
    }
    case 2: {
      band('#b87a34', '#f0c078', 1.3);
      if (!p.back) { c.fillStyle = '#7a4a1a'; c.beginPath(); c.arc(front, by - 0.4, 1.3, 0, TAU); c.fill(); c.fillStyle = '#d8281c'; c.beginPath(); c.arc(front, by - 0.4, 0.85, 0, TAU); c.fill(); c.fillStyle = '#ffb0a0'; c.fillRect(front - 0.4, by - 0.9, 0.35, 0.35); }
      break;
    }
    case 3: {
      // golden fillet with curled ends over the brow
      band(GOLD, GOLD_HI, 1.25);
      if (!p.back) {
        c.strokeStyle = GOLD; c.lineWidth = 0.8; c.lineCap = 'round';
        c.beginPath(); c.arc(front - 0.2, by - 1.3, 1.1, Math.PI * 0.5, Math.PI * 2.1); c.stroke();
        c.beginPath(); c.arc(front + 1.1, by - 0.9, 0.8, Math.PI * 1.3, Math.PI * 2.8); c.stroke();
      }
      break;
    }
    default: {
      // phoenix crown: gold circlet, rising flame crest, a glowing jewel
      band(GOLD, '#fff6d0', 1.4);
      const cx = p.back ? hx - r * 0.1 : hx + r * 0.3, cy = by - 0.8;
      const g = c.createLinearGradient(cx, cy - 7, cx, cy);
      g.addColorStop(0, '#fff6d0'); g.addColorStop(1, GOLD);
      c.fillStyle = g;
      c.beginPath(); c.moveTo(cx - 3.6, cy + 0.6);
      c.quadraticCurveTo(cx - 3.2, cy - 3, cx - 1.6, cy - 4.4); c.quadraticCurveTo(cx - 1.4, cy - 2.4, cx - 0.6, cy - 2);
      c.quadraticCurveTo(cx - 0.4, cy - 5.6, cx + 0.8, cy - 7.2); c.quadraticCurveTo(cx + 1.2, cy - 4, cx + 1.6, cy - 2.2);
      c.quadraticCurveTo(cx + 2.8, cy - 3.6, cx + 3.8, cy - 3.8); c.quadraticCurveTo(cx + 3, cy - 1.6, cx + 3.6, cy + 0.6); c.closePath(); c.fill();
      c.strokeStyle = GOLD_DK; c.lineWidth = 0.35; c.stroke();
      if (!p.back) { c.fillStyle = '#7ad0ff'; c.beginPath(); c.arc(cx + 0.2, cy - 0.6, 0.9, 0, TAU); c.fill(); glowDot(c, cx + 0.2, cy - 0.6, 5, '140,210,255', 0.45 + 0.2 * Math.sin(time * 4)); }
    }
  }
  c.restore();
}

/** The flying-kick leg (the front leg thrust out at hip height), drawn over the robe while the monk kicks: a tapered
 *  trouser thigh, a wrapped shin and the blade of the foot leading, with air peeling off the sole at full extension. */
function kickLeg(c: C2D, a: RigAnchors, s: MkState, x: number, time: number): void {
  if (x <= 0.02) return;
  const G = GARB[s.ct + 1], b = a.build, hy = a.hipY + 1;
  const legW = 4.6 * b;
  const kx = 0.5 + 10.2 * x, ky = hy + 8 * (1 - x) - 1.2 * x;
  const fx = kx + 10.4 * x + 1.5 * (1 - x), fy = ky + 9 * (1 - x) - 1.4 * x;
  const pants = G.pants;
  // thigh: wide at the hip, tapering into the knee
  const tl = Math.hypot(kx - 0.5, ky - hy) || 1, tnx = -(ky - hy) / tl, tny = (kx - 0.5) / tl;
  const tg = c.createLinearGradient(0.5 + tnx * legW, hy + tny * legW, 0.5 - tnx * legW, hy - tny * legW);
  tg.addColorStop(0, tone(pants, -0.3)); tg.addColorStop(0.6, pants); tg.addColorStop(1, tone(pants, 0.18));
  c.fillStyle = tg;
  c.beginPath();
  c.moveTo(0.5 + tnx * legW * 0.62, hy + tny * legW * 0.62);
  c.quadraticCurveTo((0.5 + kx) / 2 + tnx * legW * 0.62, (hy + ky) / 2 + tny * legW * 0.62, kx + tnx * legW * 0.45, ky + tny * legW * 0.45);
  c.lineTo(kx - tnx * legW * 0.45, ky - tny * legW * 0.45);
  c.quadraticCurveTo((0.5 + kx) / 2 - tnx * legW * 0.55, (hy + ky) / 2 - tny * legW * 0.55, 0.5 - tnx * legW * 0.55, hy - tny * legW * 0.55);
  c.closePath(); c.fill();
  c.strokeStyle = tone(pants, -0.45); c.lineWidth = 0.5; c.stroke();
  // shin: bound in cloth wraps from knee to ankle
  seg(c, kx, ky, fx, fy, legW * 0.8, WRAP);
  const sl = Math.hypot(fx - kx, fy - ky) || 1, ux = (fx - kx) / sl, uy = (fy - ky) / sl, nx = -uy, ny = ux, hw = legW * 0.42;
  c.strokeStyle = shade(WRAP, -0.25); c.lineWidth = 0.4;
  c.beginPath();
  for (let i = 0; i < 4; i++) { const q = 0.18 + i * 0.2, px = kx + (fx - kx) * q, py = ky + (fy - ky) * q; c.moveTo(px + nx * hw - ux * 0.8, py + ny * hw - uy * 0.8); c.lineTo(px - nx * hw + ux * 0.8, py - ny * hw + uy * 0.8); }
  c.stroke();
  // the foot: sole forward, toes pulled back (a side kick lands with the blade of the foot)
  const foot = s.bt >= 0 ? FEET[Math.min(4, s.bt)] : tone(SKIN, -0.08);
  c.save(); c.translate(fx, fy); c.rotate(Math.atan2(fy - ky, fx - kx));
  c.fillStyle = shade(foot, -0.35); c.beginPath(); c.ellipse(1.5, -1, 2.2, 3.6, 0, 0, TAU); c.fill();
  c.fillStyle = foot; c.beginPath(); c.ellipse(1.1, -1, 1.85, 3.1, 0, 0, TAU); c.fill();
  c.strokeStyle = shade(foot, -0.5); c.lineWidth = 0.7; c.beginPath(); c.ellipse(1.5, -1, 2.2, 3.6, 0, -1.1, 1.1); c.stroke();
  if (x > 0.6) {
    // air peeling off the sole
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    const k = (x - 0.6) / 0.4, ph = (time * 9) % 1;
    for (let i = 0; i < 3; i++) {
      c.strokeStyle = `rgba(255,244,220,${0.5 * k * (1 - i * 0.25)})`; c.lineWidth = 0.7;
      const r = 4.2 + i * 1.6 + ph * 1.2;
      c.beginPath(); c.arc(-0.5, -1, r, -0.75, 0.75); c.stroke();
    }
  }
  c.restore();
}

// ================================================================ decor hooks
interface Cur { a: RigAnchors; s: MkState; arms: Arms; flow: number }
let cur: Cur | null = null;

DECOR.mk_garb = (c, L0, p, a, layer) => {
  const L = L0 as MkLook, s = L.mk;
  if (!s) return;
  if (layer === 'back') {
    const arms = computeArms(p, s);
    const flow = s.act === 'mk_kick' ? arms.kick : s.act === 'mk_seven' ? 0.35 : 0;
    cur = { a: { ...a }, s, arms, flow };
    // park the rig's own arms at rest (tucked behind the torso and under the sash): the monk draws his own
    p.atk = -1; p.cast = -1; p.block = 0;
    headwear(c, a, p, s, p.t, true, flow);
    if (!p.back) skirt(c, a, p, s, false, flow);
    return;
  }
  const st = cur && cur.s === s ? cur : { a, s, arms: computeArms(p, s), flow: 0 };
  const { arms, flow } = st;
  c.save();
  if (s.ct < 0) bareTorso(c, a, p);
  else robeTop(c, a, p, s);
  kasaya(c, a, p, s, p.t);
  if (p.back) skirt(c, a, p, s, false, flow);
  skirt(c, a, p, s, true, flow * (1 - arms.kick * 0.8), arms.kick);
  sash(c, a, p, s, flow, p.t);
  const lit = Math.max(s.mantra * 0.6, arms.chi * (s.act === 'mk_mantra' ? 1 : 0));
  beads(c, a, p, s, p.t, lit);
  shoulderPiece(c, a, s);
  headDetails(c, a, p, s, Math.max(s.mantra, s.act === 'mk_seven' ? 1 : 0));
  headwear(c, a, p, s, p.t, false, flow);
  kickLeg(c, a, s, arms.kick, p.t);
  const F = arms.chi > 0 && s.act === 'mk_wave' ? { ...arms.F, glow: arms.chi } : arms.F;
  drawArm(c, a.shX + 2, a.shY + 2.2, F, false, s, a, p.t, arms.sF);
  // chi gathered between the palms (wave) / light at the joined hands (mantra, seven's salute)
  if (arms.chi > 0) {
    const [, , fx, fy] = armJoints(a.shX + 2, a.shY + 2.2, arms.F, a);
    const [, , bx, by] = armJoints(a.shX - 2 * a.build, a.shY + 2, arms.B, a);
    const mx = (fx + bx) / 2, my = (fy + by) / 2;
    const big = s.act === 'mk_wave';
    glowDot(c, mx, my, big ? 5 + arms.chi * 7 : 3 + arms.chi * 4, '255,196,80', big ? arms.chi : arms.chi * 0.75);
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(255,236,170,${0.6 * arms.chi})`; c.lineWidth = 0.6;
    for (let i = 0; i < 3; i++) { const an = p.t * 7 + (i * TAU) / 3; c.beginPath(); c.arc(mx, my, 4 + arms.chi * 2, an, an + 1.3); c.stroke(); }
    c.restore();
  }
  // seven-sided strike: the body burns with golden light at every flash-step
  if (s.act === 'mk_seven' && arms.flash > 0) glowDot(c, a.shX + 1, a.shY + 8, 12 + arms.flash * 6, '255,200,90', 0.3 * arms.flash);
  c.restore();
};

/** The back arm: drawn in the rig's back-arm slot (after its parked arm, before the torso covers the shoulder). */
OFFHAND_ART.mk_arm = {
  draw(c, _x, _y, _tier, p) {
    const q = cur;
    if (!q) return;
    const B = q.arms.chi > 0 && q.s.act === 'mk_wave' ? { ...q.arms.B, glow: q.arms.chi * 0.7 } : q.arms.B;
    drawArm(c, q.a.shX - 2 * q.a.build, q.a.shY + 2, B, true, q.s, q.a, p.t, q.arms.sB);
  },
  icon(c, tier, gem) { WEAPON_ART.knuckle.icon?.(c, tier, gem); },
};

// ================================================================ weapons
/** The rig's own weapon slot: a melee 'punch' kind that draws nothing (the monk's arms draw the fists). */
WEAPON_ART.mk_fist = { draw() { /* the fists are drawn with the monk's arms */ }, style: 'punch' };

ITEM_KIND.knuckle = 'knuckle';
WEAPON_ART.knuckle = {
  style: 'punch',
  draw(c, tier, _steel, _edge, L, glow) {
    const k = L(1);
    c.save(); c.scale(k, k); c.translate(0, 2);
    fistShape(c, SKIN, tier === 0);
    knuckle(c, tier, 0, 0, glow);
    c.restore();
  },
  icon(c, tier, gem) { knuckleIcon(c, tier, gem); },
};

/** Inventory icon: the pair of fist weapons, one crossed over the other. */
function knuckleIcon(c: C2D, tier: number, gem: string): void {
  const t = Math.max(0, Math.min(4, tier));
  const one = (x: number, y: number, ang: number, s: number, dk: number): void => {
    c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s);
    if (t === 0) {
      // a rolled bandage with its loose end
      c.fillStyle = tone(WRAP, dk - 0.1); c.beginPath(); c.ellipse(0, 0, 3.4, 3.4, 0, 0, TAU); c.fill();
      c.fillStyle = tone(WRAP, dk); c.beginPath(); c.ellipse(-0.3, -0.3, 3, 3, 0, 0, TAU); c.fill();
      c.strokeStyle = tone('#b8ab90', dk); c.lineWidth = 0.35;
      for (const r of [1, 1.8, 2.5]) { c.beginPath(); c.arc(-0.3, -0.3, r, 0, TAU); c.stroke(); }
      c.fillStyle = tone(WRAP, dk); c.beginPath(); c.moveTo(1.6, 2.4); c.quadraticCurveTo(4, 5, 2.4, 8.4); c.lineTo(4.2, 8.8); c.quadraticCurveTo(5.8, 4.6, 3.2, 1.4); c.closePath(); c.fill();
      c.strokeStyle = tone('#b8ab90', dk); c.stroke();
    } else if (t === 1) {
      // an iron knuckle-duster: four finger rings, studs along the top, a curved palm grip
      const iron = tone('#8a909c', dk), dark = tone('#353940', dk), hi = tone('#d4dae4', dk);
      c.scale(0.62, 0.62);
      c.fillStyle = dark; c.beginPath(); c.moveTo(-7.4, 2.4); c.quadraticCurveTo(0, 8.6, 7.4, 2.4); c.lineTo(6.6, 5); c.quadraticCurveTo(0, 10.6, -6.6, 5); c.closePath(); c.fill();
      c.fillStyle = iron; c.beginPath(); c.moveTo(-6.8, 2.8); c.quadraticCurveTo(0, 8.4, 6.8, 2.8); c.lineTo(6.4, 3.8); c.quadraticCurveTo(0, 9.2, -6.4, 3.8); c.closePath(); c.fill();
      for (let i = 0; i < 4; i++) {
        const rx = -5.1 + i * 3.4;
        c.fillStyle = iron; c.beginPath(); c.moveTo(rx - 1.1, -2.1); c.lineTo(rx, -4.6); c.lineTo(rx + 1.1, -2.1); c.closePath(); c.fill();
        c.strokeStyle = dark; c.lineWidth = 2.2; c.beginPath(); c.arc(rx, 0, 1.9, 0, TAU); c.stroke();
        c.strokeStyle = iron; c.lineWidth = 1.4; c.stroke();
        c.strokeStyle = hi; c.lineWidth = 0.5; c.beginPath(); c.arc(rx, 0, 1.9, Math.PI * 1.05, Math.PI * 1.6); c.stroke();
        c.fillStyle = dark; c.fillRect(rx - 0.4, 1.8, 0.8, 1.6);
      }
    } else {
      c.translate(0, -1.5);
      if (t >= 2) { c.fillStyle = tone('#a06a3a', dk); c.beginPath(); rrect(c, -2.4, -3.2, 4.8, 3.6, 1); c.fill(); }
      knuckle(c, t, dk, 0.4, undefined);
    }
    c.restore();
  };
  one(-5, 3, -0.6, 3.2, -0.25);
  one(5, -2, 0.5, 3.6, 0);
  void gem;
}

