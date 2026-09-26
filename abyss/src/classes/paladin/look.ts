// paladin: hero look — armour tinted by chest tier, a white tabard with a gold cross/sun emblem, a crimson
// cape, the paladin's own helms (coif → nasal helm → plumed sallet → great helm → gilded crowned helm),
// armoured forearms, pauldrons and a heraldic shield. Also remaps the rig pose for multi-strike skills.
import { BASE_BY_ID } from '../../data/items';
import type { Hero } from '../../sim/types';
import { drawWeapon, type Look, type Pose } from '../../render/actors';
import { shade } from '../../render/iso';
import { CLASS_LOOK, DECOR, OFFHAND_ART, type RigAnchors } from '../../render/registry';
import { ZEAL_AT } from './shared';

const TAU = Math.PI * 2;
const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));

/** Paladin-specific state carried on the Look (the rig ignores unknown fields). */
interface PlState {
  /** Active skill act ('' when idle) and its progress 0..1. */
  act: string; k: number;
  /** Chest, helm and glove tiers (-1 = none). */
  ct: number; ht: number; gt: number;
  shield: boolean; aura: boolean;
}
type PlLook = Look & { pl?: PlState };

// ------------------------------------------------------------------ palette
export const GOLD = '#e2b44a', GOLD_HI = '#fff0b0', GOLD_DK = '#8a6420';
const CLOTH = '#efe8d6';
/** Armour colour by chest tier (-1 none, 0 quilted/leather, 1 chain, 2 plate, 3 gothic, 4 holy). */
const ARMOR = ['#a8987a', '#8c7454', '#9ea4ae', '#c4c9d2', '#b3b9c7', '#e6dcbc'];
const armorOf = (ct: number) => ARMOR[Math.max(-1, Math.min(4, ct)) + 1];
const STEEL = ['#8a6a48', '#b8bec8', '#c8cdd6', '#c0c6d2', '#ece2c2'];
const steelOf = (t: number) => STEEL[Math.max(0, Math.min(4, t))];

function tierOf(h: Hero, slot: 'gloves' | 'head' | 'offhand'): number {
  const it = h.equip[slot];
  return it && it.req <= h.level ? BASE_BY_ID[it.base]?.tier ?? -1 : -1;
}

CLASS_LOOK.paladin = (h, common, ct) => {
  const a = h.act;
  const act = a ? a.skill.replace(/^pl_/, '') : '';
  const aura = h.buffs.some((b) => b.id === 'pl_aura');
  const ht = common.helm ?? -1;
  const armor = armorOf(ct);
  const pl: PlState = { act, k: a ? Math.min(1, a.t / Math.max(1e-3, a.dur)) : 0, ct, ht, gt: tierOf(h, 'gloves'), shield: common.offhand === 'shield', aura };
  const L: PlLook = {
    skin: '#e4b690', hair: '#d6ae62', beard: ht < 0 ? '#b88a48' : undefined, eyes: '#3a5a8a',
    body: armor, body2: armor,
    legs: ct >= 1 ? shade(armor, -0.28) : '#4e3e2c',
    head: 'human', build: 1.12, height: 1.02,
    ...common,
    boots: ct >= 2 ? shade(armor, -0.42) : common.boots ?? '#3a2a1c',
    helm: -1,
    offhand: 'pl_shield', offTier: common.offTier ?? 0,
    wGlow: common.wGlow ?? (aura || act === 'judgment' || act === 'zeal' ? '#ffd46a' : undefined),
    trim: ct >= 2 ? GOLD : undefined,
    armorTier: ct,
    glow: '#ffd070',
    decor: 'pl_knight',
    pl,
  };
  if (ht >= 0) L.hair = undefined;
  return L;
};

// ------------------------------------------------------------------ small drawing helpers
/** A limb segment drawn like the rig's (outline, body, lit highlight). */
function seg(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, col: string): void {
  c.lineCap = 'round';
  c.strokeStyle = shade(col, -0.4); c.lineWidth = w + 0.9;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.strokeStyle = col; c.lineWidth = w;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  const l = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / l, ny = (x1 - x0) / l;
  const s = nx + ny < 0 ? 1 : -1, o = w * 0.22 * s;
  c.strokeStyle = shade(col, 0.35); c.lineWidth = w * 0.3;
  c.beginPath(); c.moveTo(x0 + nx * o, y0 + ny * o); c.lineTo(x1 + nx * o, y1 + ny * o); c.stroke();
}

/** Solves the elbow of a two-segment arm from shoulder and hand (the rig bends the forearm by `bend`). */
function elbow(sx: number, sy: number, hx: number, hy: number, l1: number, l2: number, bend: number): { ex: number; ey: number; a: number } {
  const beta = Math.atan2(l2 * Math.sin(bend), l1 + l2 * Math.cos(bend));
  const a = Math.atan2(hx - sx, hy - sy) - beta;
  return { ex: sx + Math.sin(a) * l1, ey: sy + Math.cos(a) * l1, a };
}

/** Gold cross with flared arms (the order's sign). `s` = half height. */
function crossPath(c: CanvasRenderingContext2D, x: number, y: number, s: number, flare = 0.35): void {
  const w = s * 0.24, arm = s * 0.72, up = s * 0.8, dn = s * 1.15, f = s * flare;
  c.beginPath();
  c.moveTo(x - w, y - up + f * 0.4); c.lineTo(x - w - f * 0.5, y - up); c.lineTo(x + w + f * 0.5, y - up); c.lineTo(x + w, y - up + f * 0.4);
  c.lineTo(x + w, y - w); c.lineTo(x + arm - f * 0.4, y - w); c.lineTo(x + arm, y - w - f * 0.5); c.lineTo(x + arm, y + w + f * 0.5); c.lineTo(x + arm - f * 0.4, y + w);
  c.lineTo(x + w, y + w); c.lineTo(x + w, y + dn - f * 0.4); c.lineTo(x + w + f * 0.5, y + dn); c.lineTo(x - w - f * 0.5, y + dn); c.lineTo(x - w, y + dn - f * 0.4);
  c.lineTo(x - w, y + w); c.lineTo(x - arm + f * 0.4, y + w); c.lineTo(x - arm, y + w + f * 0.5); c.lineTo(x - arm, y - w - f * 0.5); c.lineTo(x - arm + f * 0.4, y - w);
  c.lineTo(x - w, y - w); c.closePath();
}

/** The order's emblem: cross, ring (tier ≥2), sun rays (tier ≥3), radiance (tier 4 / glowing). */
export function emblem(c: CanvasRenderingContext2D, x: number, y: number, s: number, tier: number, t: number, glow = 0): void {
  c.save();
  if (tier >= 3 || glow > 0) {
    // sun rays
    c.fillStyle = tier >= 4 ? '#ffe690' : GOLD;
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (tier >= 4 ? t * 0.3 : 0), r0 = s * 0.75, r1 = s * (i % 2 ? 1.35 : 1.65);
      c.beginPath(); c.moveTo(x + Math.cos(a - 0.12) * r0, y + Math.sin(a - 0.12) * r0); c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); c.lineTo(x + Math.cos(a + 0.12) * r0, y + Math.sin(a + 0.12) * r0); c.fill();
    }
  }
  if (tier >= 2) { c.strokeStyle = GOLD_DK; c.lineWidth = s * 0.3; c.beginPath(); c.arc(x, y, s * 0.72, 0, TAU); c.stroke(); c.strokeStyle = GOLD; c.lineWidth = s * 0.18; c.stroke(); }
  crossPath(c, x, y, s);
  const g = c.createLinearGradient(x - s, y - s, x + s, y + s);
  g.addColorStop(0, GOLD_HI); g.addColorStop(0.45, GOLD); g.addColorStop(1, GOLD_DK);
  c.fillStyle = g; c.fill();
  c.strokeStyle = 'rgba(70,40,10,0.75)'; c.lineWidth = Math.max(0.35, s * 0.08); c.stroke();
  if (tier >= 4) { c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, s * 0.2, 0, TAU); c.fill(); }
  if (glow > 0) {
    c.globalCompositeOperation = 'lighter';
    const gg = c.createRadialGradient(x, y, 0, x, y, s * 2.4);
    gg.addColorStop(0, `rgba(255,240,180,${0.8 * glow})`); gg.addColorStop(0.4, `rgba(255,200,90,${0.35 * glow})`); gg.addColorStop(1, 'rgba(255,180,60,0)');
    c.fillStyle = gg; c.beginPath(); c.arc(x, y, s * 2.4, 0, TAU); c.fill();
  }
  c.restore();
}

// ------------------------------------------------------------------ pose remap (engine has no per-skill pose hook)
function remapPose(p: Pose, s: PlState): void {
  if (s.act === 'zeal' && p.atk >= 0) {
    // three swings, each centred on its strike time (strikes at 1/6, 1/2, 5/6 of the act)
    const n = ZEAL_AT.length;
    p.atk = Math.min(0.999, (p.atk * n) % 1);
  } else if (s.act === 'charge') {
    // shield forward, mace cocked back, slammed down as the charge lands
    p.block = 1;
    p.atk = s.k < 0.72 ? 0.3 + s.k * 0.06 : 0.34 + ((s.k - 0.72) / 0.28) * 0.4;
  } else if (s.act === 'judgment') {
    // weapon raised straight to the sky (the windup peak of the swing, held; just below the smear window)
    p.cast = -1;
    p.atk = 0.35 * ease(s.k / 0.45);
  }
}

// ------------------------------------------------------------------ cape
function capeBehind(c: CanvasRenderingContext2D, p: Pose, a: RigAnchors, s: PlState): void {
  const b = a.build;
  const mv = p.moving ? 1 : 0;
  const ph = p.walk * 4.2;
  const fl = mv ? Math.sin(ph * 0.5 + 0.6) * 1.6 : Math.sin(p.t * 1.7) * 0.5;
  const trail = mv * 5 + (s.act === 'charge' ? 7 : 0);
  const lift = s.act === 'charge' ? 6 : mv * 2;
  const x0 = a.shX - 5.2 * b, y0 = a.shY + 1.2, x1 = a.shX + 3.2, y1 = a.shY + 0.6;
  const bl = -11 * b - trail + fl, blY = -2.5 - lift, br = 2.5 - trail * 0.25;
  const col = s.ct >= 4 ? '#8e1a22' : '#8a1a1c';
  const g = c.createLinearGradient(bl, 0, x1, 0);
  g.addColorStop(0, shade(col, -0.62)); g.addColorStop(0.6, shade(col, -0.25)); g.addColorStop(1, col);
  c.fillStyle = g;
  c.beginPath(); c.moveTo(x0, y0);
  c.quadraticCurveTo(-10 * b - trail * 0.55, a.hipY - 3, bl, blY);
  // wavy hem
  const hx = (bl + br) / 2;
  c.quadraticCurveTo((bl + hx) / 2, blY + 2.2 + fl * 0.3, hx, -2 - lift * 0.5);
  c.quadraticCurveTo((hx + br) / 2, -0.6 - lift * 0.3, br, -2.2);
  c.quadraticCurveTo(4.5, a.hipY + 2, x1, y1);
  c.closePath(); c.fill();
  // folds
  c.strokeStyle = 'rgba(20,0,4,0.45)'; c.lineWidth = 0.8;
  for (const f of [0.3, 0.6]) { c.beginPath(); c.moveTo(x0 + (x1 - x0) * f, y0 + 1); c.quadraticCurveTo(-6 * b * f - trail * 0.3, a.hipY + 2, bl + (br - bl) * f + fl * 0.5, -2.6 - lift * 0.7); c.stroke(); }
  if (s.ct >= 2) {
    c.strokeStyle = GOLD; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(bl, blY); c.quadraticCurveTo((bl + hx) / 2, blY + 2.2 + fl * 0.3, hx, -2 - lift * 0.5); c.quadraticCurveTo((hx + br) / 2, -0.6 - lift * 0.3, br, -2.2); c.stroke();
  }
}

function capeOver(c: CanvasRenderingContext2D, p: Pose, a: RigAnchors, s: PlState): void {
  // seen from behind: the cape hides the back
  const b = a.build;
  const mv = p.moving ? 1 : 0;
  const sw = mv ? Math.sin(p.walk * 4.2) : 0;
  const fl = mv ? sw * 1.2 : Math.sin(p.t * 1.7) * 0.4;
  const x0 = a.shX - 7.2 * b, x1 = a.shX + 7.2 * b, y0 = a.shY + 0.5;
  const bl = -9.5 * b + fl * 0.6, br = 9.5 * b + fl, by = -3 - mv * 1.5;
  const col = '#8a1a1c';
  const g = c.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, shade(col, 0.12)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.45));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(x0, y0 + 1);
  c.quadraticCurveTo(a.shX, y0 - 2.5, x1, y0 + 1);
  c.quadraticCurveTo(x1 + 2, a.hipY, br, by);
  c.quadraticCurveTo(br * 0.5, by + 1.8, 0, by - 0.6);
  c.quadraticCurveTo(bl * 0.5, by + 1.8, bl, by);
  c.quadraticCurveTo(x0 - 2, a.hipY, x0, y0 + 1);
  c.fill();
  c.strokeStyle = 'rgba(20,0,4,0.45)'; c.lineWidth = 0.8;
  for (const f of [-0.45, 0, 0.45]) { c.beginPath(); c.moveTo(a.shX + f * 9 * b, y0 + 4); c.quadraticCurveTo(f * 10 * b + fl * 0.4, a.hipY + 4, f * 12 * b + fl, by + 0.3); c.stroke(); }
  if (s.ct >= 2) {
    c.strokeStyle = GOLD; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(br, by); c.quadraticCurveTo(br * 0.5, by + 1.8, 0, by - 0.6); c.quadraticCurveTo(bl * 0.5, by + 1.8, bl, by); c.stroke();
  }
  if (s.ct >= 3) emblem(c, a.shX + 0.5, a.shY + 12, 3.6, s.ct, p.t, s.aura ? 0.5 : 0);
  // collar / mantle
  c.fillStyle = s.ct >= 2 ? shade(armorOf(s.ct), -0.1) : '#6a5238';
  c.beginPath(); c.ellipse(a.shX, a.shY + 1.6, 6.6 * b, 2.4, 0, 0, TAU); c.fill();
}

// ------------------------------------------------------------------ tabard + belt
function tabard(c: CanvasRenderingContext2D, p: Pose, a: RigAnchors, s: PlState): void {
  const b = a.build;
  const sw = p.moving ? Math.sin(p.walk * 4.2) : 0;
  const cx = a.shX * 0.6 + 0.3;
  const y0 = a.shY + 2.4, yw = a.hipY - 0.6, y1 = a.hipY + 10.5;
  const tw = 4.1 * b, ww = 4.3 * b, hw = 5.4 * b;
  const flapL = -sw * 1.3, flapR = sw * 1.8;
  const g = c.createLinearGradient(cx - hw, 0, cx + hw, 0);
  g.addColorStop(0, '#fffaf0'); g.addColorStop(0.5, CLOTH); g.addColorStop(1, '#b3aa94');
  c.fillStyle = g;
  // body panel (neck scoop) down to the waist, then two flaps over the thighs
  c.beginPath();
  c.moveTo(cx - tw, y0); c.quadraticCurveTo(cx, y0 + 2.6, cx + tw, y0);
  c.lineTo(cx + ww, yw);
  c.lineTo(cx + hw + flapR, y1 - 0.8); c.quadraticCurveTo(cx + hw * 0.55 + flapR, y1 + 1, cx + 0.35 + flapR * 0.3, y1);
  c.lineTo(cx + 0.2, yw + 2.5); c.lineTo(cx - 0.2, yw + 2.5);
  c.lineTo(cx - 0.35 + flapL * 0.3, y1); c.quadraticCurveTo(cx - hw * 0.55 + flapL, y1 + 1, cx - hw + flapL, y1 - 0.8);
  c.lineTo(cx - ww, yw); c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(60,50,30,0.55)'; c.lineWidth = 0.6; c.stroke();
  // cloth folds on the flaps
  c.strokeStyle = 'rgba(120,105,80,0.45)'; c.lineWidth = 0.6;
  c.beginPath(); c.moveTo(cx - hw * 0.5, yw + 2); c.lineTo(cx - hw * 0.55 + flapL * 0.8, y1 - 0.5); c.moveTo(cx + hw * 0.5, yw + 2); c.lineTo(cx + hw * 0.6 + flapR * 0.8, y1 - 0.5); c.stroke();
  if (s.ct >= 0) {
    // gold trim
    c.strokeStyle = s.ct >= 3 ? GOLD : '#c89a3a'; c.lineWidth = s.ct >= 3 ? 0.9 : 0.6;
    c.beginPath();
    c.moveTo(cx - tw, y0); c.quadraticCurveTo(cx, y0 + 2.6, cx + tw, y0);
    c.moveTo(cx + hw + flapR, y1 - 0.8); c.quadraticCurveTo(cx + hw * 0.55 + flapR, y1 + 1, cx + 0.35 + flapR * 0.3, y1);
    c.moveTo(cx - 0.35 + flapL * 0.3, y1); c.quadraticCurveTo(cx - hw * 0.55 + flapL, y1 + 1, cx - hw + flapL, y1 - 0.8);
    c.stroke();
    if (s.ct >= 3) {
      // embroidered hem diamonds
      c.fillStyle = GOLD;
      for (const side of [-1, 1]) for (let i = 1; i <= 2; i++) {
        const fx = side < 0 ? flapL : flapR;
        const x = cx + side * hw * (0.3 + i * 0.25) + fx * 0.8, y = y1 - 1.6 + i * 0.25;
        c.beginPath(); c.moveTo(x, y - 0.9); c.lineTo(x + 0.6, y); c.lineTo(x, y + 0.9); c.lineTo(x - 0.6, y); c.fill();
      }
    }
  }
  // emblem on the chest
  const glow = (s.aura ? 0.35 + 0.2 * Math.sin(p.t * 3) : 0) + (p.cast >= 0 || s.act === 'judgment' ? 0.6 : 0);
  emblem(c, cx - 1, a.shY + 8.4, s.ct >= 3 ? 3.4 : 3.1, Math.max(0, s.ct), p.t, glow);
  // belt
  const bc = s.ct >= 3 ? '#5a3418' : '#4a3020';
  c.fillStyle = shade(bc, -0.25); c.fillRect(cx - ww - 0.4, yw - 1.3, (ww + 0.4) * 2, 2.6);
  c.fillStyle = bc; c.fillRect(cx - ww - 0.4, yw - 1.3, (ww + 0.4) * 2, 1.3);
  c.fillStyle = s.ct >= 2 ? GOLD : '#b08a4a';
  c.fillRect(cx - 0.9, yw - 1.7, 2.8, 3.4);
  c.fillStyle = shade(bc, -0.4); c.fillRect(cx - 0.1, yw - 0.8, 1.2, 1.6);
  if (s.ct >= 2) { c.fillStyle = GOLD; for (const x of [-3.2, -1.8, 3.4, 4.8]) { c.beginPath(); c.arc(cx + x * b * 0.8, yw - 0.1, 0.45, 0, TAU); c.fill(); } }
}

// ------------------------------------------------------------------ helms
function plume(c: CanvasRenderingContext2D, x: number, y: number, r: number, p: Pose, col: string, len: number): void {
  const sway = p.moving ? Math.sin(p.walk * 4.2) * 0.12 : Math.sin(p.t * 2) * 0.05;
  const bx = x - r * 0.15, by = y - r * 1.05;
  const tipX = bx - r * (1.6 + len * 0.9), tipY = by + r * (0.8 + len * 0.6) + sway * r * 4;
  const g = c.createLinearGradient(bx, by - r, tipX, tipY);
  g.addColorStop(0, shade(col, 0.25)); g.addColorStop(1, shade(col, -0.35));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(bx + r * 0.35, by + r * 0.1);
  c.bezierCurveTo(bx + r * 0.2, by - r * (1.4 + len * 0.3), bx - r * (1.2 + len * 0.5), by - r * (1.3 + len * 0.2) + sway * r * 3, tipX, tipY);
  c.bezierCurveTo(bx - r * (0.9 + len * 0.4), by - r * 0.1 + sway * r * 2, bx - r * 0.4, by + r * 0.1, bx - r * 0.1, by + r * 0.35);
  c.closePath(); c.fill();
  c.strokeStyle = shade(col, -0.45); c.lineWidth = 0.35;
  for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx - r * (0.6 + i * 0.3), by - r * (0.9 - i * 0.1), tipX + r * (0.8 - i * 0.3), tipY - r * (0.9 - i * 0.35)); c.stroke(); }
}

function helm(c: CanvasRenderingContext2D, p: Pose, a: RigAnchors, s: PlState): void {
  const t = s.ht;
  if (t < 0) return;
  const x = a.hx, y = a.hy, r = a.headR;
  const st = steelOf(t);
  const mg = (x0: number, x1: number, base: string) => { const g = c.createLinearGradient(x0, y - r, x1, y + r); g.addColorStop(0, shade(base, 0.45)); g.addColorStop(0.5, base); g.addColorStop(1, shade(base, -0.45)); return g; };
  if (t === 2) plume(c, x, y, r, p, '#f2eee4', 0.4);
  if (t === 3) plume(c, x, y - r * 0.15, r, p, '#b41c22', 0.8);
  if (t >= 4) plume(c, x, y - r * 0.2, r, p, '#fff1c8', 1.1);
  if (p.back && t <= 2) {
    // seen from behind: hair (cap) or the mail coif covers the back of the head and the neck
    c.fillStyle = t === 0 ? '#c9a05a' : '#8c9098';
    c.beginPath(); c.arc(x, y, r * 1.02, 0, TAU); c.fill();
    c.fillRect(x - r * 0.8, y, r * 1.6, r * 1.3);
    if (t > 0) { c.fillStyle = 'rgba(255,255,255,0.16)'; for (let yy = 0.1; yy < 1.3; yy += 0.28) c.fillRect(x - r * 0.95, y + r * yy, r * 1.9, r * 0.07); }
  }
  if (t === 0) {
    // padded arming cap with a mail skirt
    c.fillStyle = mg(x - r, x + r, '#7a5a38');
    c.beginPath(); c.arc(x, y - r * 0.08, r * 1.08, Math.PI * 0.92, TAU * 1.01); c.lineTo(x + r * 0.95, y + r * 0.05); c.lineTo(x - r * 1.05, y + r * 0.1); c.fill();
    c.strokeStyle = '#4a3420'; c.lineWidth = 0.4;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(x + i * r * 0.45, y - r * 1.05); c.quadraticCurveTo(x + i * r * 0.55, y - r * 0.4, x + i * r * 0.6, y + r * 0.02); c.stroke(); }
    c.fillStyle = '#8a8e96';
    c.beginPath(); c.moveTo(x - r * 1.05, y + r * 0.05); c.lineTo(x - r * 0.35, y + r * 0.2); c.lineTo(x - r * 0.3, y + r * 1.05); c.lineTo(x - r * 1.1, y + r * 0.9); c.fill();
    return;
  }
  if (t <= 2) {
    // mail coif under the helm (back of the head and neck)
    c.fillStyle = '#8c9098';
    c.beginPath(); c.moveTo(x - r * 1.1, y - r * 0.2); c.lineTo(x - r * 0.1, y + r * 0.15); c.lineTo(x + (p.back ? r * 1.0 : r * 0.1), y + r * 1.25); c.lineTo(x - r * 1.15, y + r * 1.15); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.18)'; for (let yy = 0.3; yy < 1.1; yy += 0.28) c.fillRect(x - r * 1.05, y + r * yy, r * 1.0, r * 0.07);
    // dome
    c.fillStyle = mg(x - r, x + r, st);
    c.beginPath(); c.arc(x, y - r * 0.12, r * 1.12, Math.PI * 0.94, TAU * 1.03);
    if (t === 2) { c.lineTo(x + r * 1.1, y + r * 0.2); c.lineTo(x - r * 0.9, y + r * 0.3); c.quadraticCurveTo(x - r * 1.6, y + r * 0.5, x - r * 1.5, y + r * 0.25); }
    else { c.lineTo(x + r * 1.08, y + r * 0.1); c.lineTo(x - r * 1.1, y + r * 0.12); }
    c.closePath(); c.fill();
    c.strokeStyle = shade(st, -0.55); c.lineWidth = 0.4; c.stroke();
    // brow band
    c.fillStyle = t === 2 ? GOLD : '#b8903e';
    c.beginPath(); c.moveTo(x - r * 1.1, y - r * 0.02); c.lineTo(x + r * 1.1, y - r * 0.05); c.lineTo(x + r * 1.1, y + r * 0.2); c.lineTo(x - r * 1.1, y + r * 0.24); c.fill();
    // ridge
    c.strokeStyle = shade(st, 0.5); c.lineWidth = 0.5; c.beginPath(); c.arc(x, y - r * 0.12, r * 0.95, Math.PI * 1.25, Math.PI * 1.7); c.stroke();
    if (!p.back) {
      // nasal guard
      c.fillStyle = mg(x + r * 0.5, x + r * 0.8, st);
      c.fillRect(x + r * 0.58, y - r * 0.1, r * 0.22, r * 0.75);
      if (t === 2) {
        // cheek guard with a cross cut-out
        c.fillStyle = mg(x - r * 0.3, x + r * 0.6, st);
        c.beginPath(); c.moveTo(x - r * 0.25, y + r * 0.18); c.lineTo(x + r * 0.42, y + r * 0.18); c.lineTo(x + r * 0.32, y + r * 1.0); c.lineTo(x - r * 0.3, y + r * 0.95); c.fill();
        c.fillStyle = GOLD; c.fillRect(x + r * 0.02, y + r * 0.35, r * 0.1, r * 0.45); c.fillRect(x - r * 0.1, y + r * 0.47, r * 0.34, r * 0.1);
      }
    }
    return;
  }
  // great helm (3) / gilded crowned helm (4): covers the whole head
  const gild = t >= 4;
  const base = gild ? '#e8dcb8' : st;
  const top = y - r * 1.2, bot = y + r * 1.34, lx = x - r * 1.14, rx = x + r * 1.3;
  c.fillStyle = mg(lx, rx, base);
  c.beginPath();
  c.moveTo(lx, bot); c.lineTo(lx - r * 0.04, y - r * 0.3);
  c.quadraticCurveTo(lx, top, x + r * 0.05, top - r * 0.02);
  c.quadraticCurveTo(rx, top + r * 0.02, rx, y - r * 0.2);
  c.lineTo(rx + r * 0.08, y + r * 0.35); c.lineTo(rx - r * 0.12, bot - r * 0.05);
  c.quadraticCurveTo(x, bot + r * 0.2, lx, bot);
  c.closePath(); c.fill();
  c.strokeStyle = shade(base, -0.6); c.lineWidth = 0.45; c.stroke();
  // horizontal banding
  c.strokeStyle = gild ? GOLD : shade(base, -0.3); c.lineWidth = gild ? 0.9 : 0.5;
  c.beginPath(); c.moveTo(lx, top + r * 0.55); c.quadraticCurveTo(x, top + r * 0.35, rx, top + r * 0.55); c.stroke();
  c.beginPath(); c.moveTo(lx + r * 0.02, bot - r * 0.2); c.quadraticCurveTo(x, bot, rx - r * 0.1, bot - r * 0.25); c.stroke();
  // specular
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(x - r * 0.45, y - r * 0.35, r * 0.18, r * 0.55, -0.2, 0, TAU); c.fill();
  if (!p.back) {
    // eye slit and breaths: the slit and a gold bar form the order's cross on the face
    const sy = y - r * 0.12;
    c.fillStyle = '#0c0a0a'; c.fillRect(x - r * 0.05, sy, r * 1.34, r * 0.24);
    c.fillStyle = gild ? '#ffe070' : GOLD;
    c.fillRect(x + r * 0.7, top + r * 0.3, r * 0.2, bot - top - r * 0.5);
    c.fillRect(x - r * 0.05, sy - r * 0.1, r * 1.34, r * 0.1);
    c.fillStyle = '#1a1414'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x + r * 1.0, sy + r * (0.55 + i * 0.25), r * 0.06, 0, TAU); c.fill(); }
    if (gild || s.aura) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const eg = c.createRadialGradient(x + r * 0.75, sy + r * 0.12, 0, x + r * 0.75, sy + r * 0.12, r * 0.75);
      eg.addColorStop(0, gild ? 'rgba(255,236,160,0.7)' : 'rgba(255,220,130,0.45)'); eg.addColorStop(1, 'rgba(255,200,80,0)');
      c.fillStyle = eg; c.fillRect(x - r * 0.1, sy - r * 0.7, r * 1.8, r * 1.6);
      c.restore();
    }
  }
  if (gild) {
    // crown crest and small wings
    c.fillStyle = mg(x - r, x + r, GOLD);
    c.beginPath(); c.moveTo(x - r * 0.9, top + r * 0.25);
    for (let i = 0; i <= 4; i++) { const px = x - r * 0.9 + (i * r * 1.9) / 4; c.lineTo(px - r * 0.12, top - r * (i % 2 ? 0.25 : 0.55)); c.lineTo(px + r * 0.12, top + r * 0.05); }
    c.lineTo(x + r, top + r * 0.3); c.closePath(); c.fill();
    c.fillStyle = '#ff4a5a'; c.beginPath(); c.arc(x + r * 0.05, top + r * 0.08, r * 0.14, 0, TAU); c.fill();
    const flap = Math.sin(p.t * 2.4) * 0.08;
    for (const [wx, sc] of [[lx + r * 0.1, 1], [rx - r * 0.2, 0.75]] as [number, number][]) {
      c.save(); c.translate(wx, y - r * 0.3); c.rotate(-0.35 - flap); c.scale(sc, sc);
      c.fillStyle = '#fff6dc'; c.strokeStyle = GOLD; c.lineWidth = 0.35;
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-r * 0.9, -r * 1.2, -r * 0.35, -r * 2.1); c.quadraticCurveTo(-r * 0.2, -r * 1.3, r * 0.2, -r * 0.2); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-r * 0.1, -r * 0.3); c.lineTo(-r * 0.45, -r * 1.5); c.moveTo(r * 0.05, -r * 0.3); c.lineTo(-r * 0.2, -r * 1.2); c.stroke();
      c.restore();
    }
    // halo
    c.save(); c.globalCompositeOperation = 'lighter';
    const hy = top - r * 0.95 + Math.sin(p.t * 2) * 0.4;
    c.strokeStyle = 'rgba(255,225,140,0.75)'; c.lineWidth = 0.9;
    c.beginPath(); c.ellipse(x - r * 0.1, hy, r * 1.05, r * 0.3, -0.12, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(255,200,90,0.3)'; c.lineWidth = 2.2; c.stroke();
    c.restore();
  } else {
    // crest ridge
    c.fillStyle = GOLD; c.fillRect(x - r * 0.15, top - r * 0.1, r * 0.3, r * 0.3);
  }
}

// ------------------------------------------------------------------ arms, pauldrons
/** Colour of the forearm guard: gloves tier first, else the chest armour. */
function vambrace(s: PlState): string {
  const t = s.gt >= 0 ? s.gt : s.ct >= 1 ? Math.min(4, s.ct) : -1;
  return t < 0 ? '#7a5634' : t === 0 ? '#6e4a2c' : steelOf(t);
}

function frontArm(c: CanvasRenderingContext2D, L: PlLook, p: Pose, a: RigAnchors, s: PlState): void {
  const b = a.build, armL = 17 * a.height, armW = 3.8 * b;
  const sx = a.shX + 2, sy = a.shY + 2.2;
  const { ex, ey, a: ang } = elbow(sx, sy, a.fhx, a.fhy, armL * 0.52, armL * 0.5, 0.3);
  const upper = L.body2 ?? L.body;
  seg(c, sx, sy, ex, ey, armW, upper);
  spaulder(c, sx, sy, ang, armW, s);
  const vb = vambrace(s);
  seg(c, ex, ey, a.fhx, a.fhy, armW * 0.9 + 0.35, vb);
  if (s.ct >= 1 || s.gt >= 1) {
    // couter (elbow plate)
    c.fillStyle = shade(s.ct >= 1 ? armorOf(s.ct) : vb, 0.15); c.beginPath(); c.arc(ex, ey, armW * 0.55, 0, TAU); c.fill();
    if (s.ct >= 3) { c.strokeStyle = GOLD; c.lineWidth = 0.5; c.stroke(); }
  }
  // cuff ring near the wrist
  const cx = ex + (a.fhx - ex) * 0.72, cy = ey + (a.fhy - ey) * 0.72;
  c.strokeStyle = s.gt >= 3 || s.ct >= 3 ? GOLD : shade(vb, -0.35); c.lineWidth = 0.8;
  const nx = -(a.fhy - ey), ny = a.fhx - ex, nl = Math.hypot(nx, ny) || 1;
  c.beginPath(); c.moveTo(cx + (nx / nl) * armW * 0.5, cy + (ny / nl) * armW * 0.5); c.lineTo(cx - (nx / nl) * armW * 0.5, cy - (ny / nl) * armW * 0.5); c.stroke();
  const wk = L.weapon ?? 'none';
  if (wk !== 'none') drawWeapon(c, wk, a.fhx, a.fhy, ang + 0.65, L.wTier ?? 0, L.wColor, L.wGlow);
  // gauntleted fist wraps the grip
  c.fillStyle = shade(vb, -0.1); c.beginPath(); c.arc(a.fhx, a.fhy, armW * 0.52, 0, TAU); c.fill();
  c.fillStyle = shade(vb, 0.3); c.beginPath(); c.arc(a.fhx - armW * 0.15, a.fhy - armW * 0.15, armW * 0.22, 0, TAU); c.fill();
  // holy light gathering on the weapon while casting / judging / under the aura
  const casting = p.cast >= 0 || s.act === 'judgment';
  if (wk !== 'none' && (casting || s.aura)) {
    const tip = 22;
    const tx = a.fhx + Math.sin(ang + 0.65) * tip, ty = a.fhy + Math.cos(ang + 0.65) * tip;
    const k = casting ? (s.act === 'judgment' ? 0.6 + 0.4 * ease(s.k / 0.4) : 0.5 + 0.5 * Math.sin(Math.min(1, Math.max(0, p.cast)) * Math.PI)) : 0.22 + 0.08 * Math.sin(p.t * 4);
    c.save(); c.globalCompositeOperation = 'lighter';
    const R = 7 + 7 * k;
    const g = c.createRadialGradient(tx, ty, 0, tx, ty, R);
    g.addColorStop(0, `rgba(255,255,235,${0.95 * k})`); g.addColorStop(0.3, `rgba(255,210,110,${0.6 * k})`); g.addColorStop(1, 'rgba(255,170,40,0)');
    c.fillStyle = g; c.beginPath(); c.arc(tx, ty, R, 0, TAU); c.fill();
    if (casting) {
      c.strokeStyle = `rgba(255,240,190,${0.8 * k})`; c.lineWidth = 0.6;
      for (let i = 0; i < 4; i++) { const aa = p.t * 5 + (i * TAU) / 4; c.beginPath(); c.moveTo(tx + Math.cos(aa) * R * 0.3, ty + Math.sin(aa) * R * 0.3); c.lineTo(tx + Math.cos(aa) * R * 0.95, ty + Math.sin(aa) * R * 0.95); c.stroke(); }
    }
    if (s.act === 'judgment' && s.k > 0.3) {
      // a thread of light rising to the sky
      const bh = 60, lg = c.createLinearGradient(tx, ty - bh, tx, ty);
      lg.addColorStop(0, 'rgba(255,240,190,0)'); lg.addColorStop(1, `rgba(255,240,190,${0.8 * k})`);
      c.fillStyle = lg; c.fillRect(tx - 1.4, ty - bh, 2.8, bh);
    }
    c.restore();
  }
}

/** Layered shoulder guard following the upper arm (sx,sy shoulder, a arm angle in the rig's sin/cos convention). */
function spaulder(c: CanvasRenderingContext2D, sx: number, sy: number, a: number, armW: number, s: PlState): void {
  if (s.ct < 1) return;
  const col = s.ct >= 4 ? '#eee2c0' : armorOf(s.ct);
  const trim = s.ct >= 3 ? GOLD : shade(col, -0.5);
  const lames = s.ct >= 2 ? 3 : 2;
  const W = armW * (s.ct >= 3 ? 0.95 : 0.82);
  c.save();
  c.translate(sx, sy); c.rotate(-a);
  // lames from the elbow side up, each overlapping the one below
  for (let i = lames; i >= 1; i--) {
    const y = armW * (0.25 + i * 0.62), w = W * (1.02 - i * 0.07);
    const g = c.createLinearGradient(-w, 0, w, 0);
    g.addColorStop(0, shade(col, 0.4)); g.addColorStop(0.5, shade(col, -0.05 * i)); g.addColorStop(1, shade(col, -0.45));
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-w, y - armW * 0.35); c.quadraticCurveTo(0, y - armW * 0.62, w, y - armW * 0.35); c.lineTo(w * 0.96, y + armW * 0.28); c.quadraticCurveTo(0, y + armW * 0.02, -w * 0.96, y + armW * 0.28); c.closePath(); c.fill();
    c.strokeStyle = trim; c.lineWidth = s.ct >= 3 ? 0.55 : 0.4; c.stroke();
  }
  // shoulder cap
  const g = c.createRadialGradient(-W * 0.35, -armW * 0.2, 0.2, 0, armW * 0.1, W * 1.25);
  g.addColorStop(0, shade(col, 0.6)); g.addColorStop(0.55, col); g.addColorStop(1, shade(col, -0.45));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(-W * 1.08, armW * 0.45); c.quadraticCurveTo(-W * 1.15, -armW * 0.75, 0, -armW * 0.82); c.quadraticCurveTo(W * 1.15, -armW * 0.75, W * 1.08, armW * 0.45); c.quadraticCurveTo(0, armW * 0.12, -W * 1.08, armW * 0.45); c.closePath(); c.fill();
  c.strokeStyle = trim; c.lineWidth = s.ct >= 3 ? 0.75 : 0.45; c.stroke();
  // ridge highlight and rivets
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 0.5;
  c.beginPath(); c.moveTo(-W * 0.55, -armW * 0.45); c.quadraticCurveTo(-W * 0.2, -armW * 0.62, W * 0.2, -armW * 0.6); c.stroke();
  if (s.ct >= 2) { c.fillStyle = s.ct >= 3 ? GOLD : shade(col, -0.4); for (const x of [-0.7, 0.7]) { c.beginPath(); c.arc(x * W, armW * 0.18, 0.42, 0, TAU); c.fill(); } }
  if (s.ct >= 4) { c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, -armW * 0.3, 0.7, 0, TAU); c.fill(); }
  c.restore();
}

// ------------------------------------------------------------------ decor entry
/** Anchors of the current rig pass, for the shield callback that runs later in the same drawBiped call. */
let rig: { a: RigAnchors; s: PlState } | null = null;

DECOR.pl_knight = (c, L0, p, a, layer) => {
  const L = L0 as PlLook, s = L.pl;
  if (!s) return;
  if (layer === 'back') {
    remapPose(p, s);
    rig = { a: { ...a }, s };
    if (!p.back) capeBehind(c, p, a, s);
    return;
  }
  c.save();
  if (p.back) capeOver(c, p, a, s);
  else tabard(c, p, a, s);
  helm(c, p, a, s);
  frontArm(c, L, p, a, s);
  c.restore();
};

// ------------------------------------------------------------------ shield
/** Heraldic shield face, origin at its centre. tier 0 round buckler, 1-3 heater shields, 4 gilded aegis. */
export function shieldFace(c: CanvasRenderingContext2D, tier: number, t: number, k = 1): void {
  c.save(); c.scale(k, k);
  const rim = tier >= 2 ? GOLD : '#9a9ca4';
  if (tier <= 0) {
    const g = c.createRadialGradient(-2, -2, 1, 0, 0, 8);
    g.addColorStop(0, '#9a7040'); g.addColorStop(1, '#5a3c1e');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(40,24,10,0.6)'; c.lineWidth = 0.5; for (const x of [-3.5, 0, 3.5]) { c.beginPath(); c.moveTo(x, -6.5); c.lineTo(x, 6.5); c.stroke(); }
    c.strokeStyle = rim; c.lineWidth = 1.3; c.beginPath(); c.arc(0, 0, 6.8, 0, TAU); c.stroke();
    crossPath(c, 0, 0.2, 4.2, 0.2); c.fillStyle = '#d8b04a'; c.fill();
    c.fillStyle = '#b0b4bc'; c.beginPath(); c.arc(0, 0, 1.4, 0, TAU); c.fill();
    c.restore(); return;
  }
  const w = tier >= 3 ? 8 : 7.2, top = tier >= 3 ? -10.5 : -9.5, bot = tier >= 3 ? 14 : 12.5;
  const path = () => { c.beginPath(); c.moveTo(-w, top); c.quadraticCurveTo(0, top - 1.6, w, top); c.lineTo(w, 1.5); c.quadraticCurveTo(w * 0.8, bot * 0.7, 0, bot); c.quadraticCurveTo(-w * 0.8, bot * 0.7, -w, 1.5); c.closePath(); };
  const field = tier >= 4 ? '#f4ead0' : '#ece6d6';
  const g = c.createLinearGradient(-w, top, w, bot);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, field); g.addColorStop(1, shade(field, -0.35));
  path(); c.fillStyle = g; c.fill();
  if (tier === 3) {
    // crimson chief
    c.save(); path(); c.clip(); c.fillStyle = '#9a1c22'; c.fillRect(-w, top - 2, w * 2, 5.2); c.restore();
  }
  path(); c.strokeStyle = shade(rim, -0.35); c.lineWidth = 2.1; c.stroke(); c.strokeStyle = rim; c.lineWidth = 1.2; c.stroke();
  emblem(c, 0, 1.6, tier >= 3 ? 4.6 : 4.1, tier, t, tier >= 4 ? 0.45 + 0.15 * Math.sin(t * 3) : 0);
  if (tier >= 2) { c.fillStyle = GOLD; for (const [x, y] of [[-w + 1.3, top + 1.4], [w - 1.3, top + 1.4], [-w + 1.2, 1], [w - 1.2, 1]]) { c.beginPath(); c.arc(x, y, 0.55, 0, TAU); c.fill(); } }
  c.restore();
}

OFFHAND_ART.pl_shield = {
  draw(c, x, y, tier, p) {
    const r = rig;
    // armoured back forearm (the rig paints it bare), solved from the stashed shoulder
    if (r) {
      const a = r.a, b = a.build, armL = 17 * a.height, armW = 3.8 * b;
      const { ex, ey } = elbow(a.shX - 2 * b, a.shY + 2, x, y, armL * 0.52, armL * 0.5, 0.35);
      seg(c, ex, ey, x, y, armW * 0.9 + 0.35, shade(vambrace(r.s), -0.3));
      if (!r.s.shield) { c.fillStyle = shade(vambrace(r.s), -0.35); c.beginPath(); c.arc(x, y, armW * 0.5, 0, TAU); c.fill(); return; }
    }
    c.save();
    c.translate(x + 3, y - 3 - (p.block ?? 0) * 6);
    c.scale(0.92, 1);
    shieldFace(c, tier, p.t);
    c.restore();
  },
  icon(c, tier) { shieldFace(c, tier, 0, 1.9); },
};
