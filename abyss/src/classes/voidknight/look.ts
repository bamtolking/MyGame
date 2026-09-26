// voidknight: hero look — blackened armour that grows spikier with chest tier (padded gambeson → mail → black plate
// → spiked gothic plate → abyssal plate with glowing violet fissures), a tattered black cloak, a deep cowl or a
// horned helm by head tier (skullcap with nubs → horned bascinet → ram-horned great helm → spiked demon helm →
// crown of horns wreathed in violet flame), violet eyes burning in the dark, spiked pauldrons, a tattered tabard,
// and the knight's own greatsword / great axe (rust → steel → blackened steel with violet runes → serrated →
// obsidian with a void fissure). Also remaps the rig pose for the rising drain cut, the grasp yank and the eclipse's
// raised-sword slam, and keeps the empty back arm down while a two-handed weapon swings (see 'two-handed grip').
import { BASE_BY_ID } from '../../data/items';
import type { Hero } from '../../sim/types';
import { drawWeapon, type Look, type Pose } from '../../render/actors';
import { shade } from '../../render/iso';
import { CLASS_LOOK, DECOR, OFFHAND_ART, WEAPON_ART, type RigAnchors } from '../../render/registry';
import { VK } from './shared';

const TAU = Math.PI * 2;
type C2D = CanvasRenderingContext2D;
const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const clampT = (t: number) => Math.max(0, Math.min(4, t));

/** Voidknight-specific state carried on the Look (the rig ignores unknown fields). */
export interface VkState {
  /** Active skill ('' when idle) and its progress 0..1. */
  act: string; k: number;
  /** Chest, helm, glove and weapon tiers (-1 = none). */
  ct: number; ht: number; gt: number; wt: number;
  shroud: boolean;
  /** Channelling void (grasp / shroud / eclipse / wave): eyes and blade flare. */
  surge: number;
}
type VkLook = Look & { vk?: VkState };

// ------------------------------------------------------------------ palette
/** Armour by chest tier (-1 none, 0 gambeson, 1 mail, 2 black plate, 3 gothic, 4 abyssal). */
const ARMOR = ['#2b2430', '#342838', '#3c3c47', '#2f2e3a', '#26232f', '#1f1829'];
const armorOf = (ct: number) => ARMOR[Math.max(-1, Math.min(4, ct)) + 1];
/** Gauntlets by glove tier (-1 wraps, 0 leather, 1-4 blackened steel). */
const GAUNT = ['#3b3036', '#4a3a31', '#4e4e5a', '#3f3f4c', '#32303d', '#2a2338'];
const gauntOf = (gt: number, ct: number) => GAUNT[Math.max(-1, Math.min(4, gt >= 0 ? gt : ct >= 2 ? ct - 1 : -1)) + 1];
/** Weapon steel by weapon tier (rust → steel → blackened → darker → obsidian). */
const WSTEEL = ['#8e7866', '#a9aeb9', '#6c6c80', '#4b4959', '#3a3149'];
/** Helm metal by head tier. */
const HELM = ['#46404a', '#3c3a46', '#34323e', '#2a2833', '#231c2d'];
const HOOD = '#2a2031';
/** Common rarity glows (magic / rare / unique) mapped into the void palette. */
const RARITY_GLOW: Record<string, string> = { '#7c8cff': '#7a5cff', '#f0e070': '#c28cff', '#e0b050': '#d9a2ff' };

let NOW = 0;
/** Weapons the knight swings with both hands. */
const TWO_HANDED = new Set(['vk_sword', 'vk_axe', 'sword2h', 'axe2h']);
function tierOf(h: Hero, slot: 'gloves' | 'head' | 'boots'): number {
  const it = h.equip[slot];
  return it && it.req <= h.level ? BASE_BY_ID[it.base]?.tier ?? -1 : -1;
}

CLASS_LOOK.voidknight = (h, common, ct) => {
  NOW = performance.now() / 1000;
  const a = h.act;
  const act = a ? a.skill : '';
  const k = a ? Math.min(1, a.t / Math.max(1e-3, a.dur)) : 0;
  const shroud = h.buffs.some((b) => b.id === 'vk_shroud');
  const ht = common.helm ?? -1;
  const gt = tierOf(h, 'gloves'), bt = tierOf(h, 'boots');
  const wt = clampT(common.wTier ?? 0);
  const surge = act === 'vk_grasp' || act === 'vk_shroud' ? Math.sin(Math.min(1, k) * Math.PI)
    : act === 'vk_eclipse' ? ease(k / 0.6) * (k > 0.8 ? (1 - k) / 0.2 : 1)
      : act === 'vk_wave' ? Math.sin(Math.min(1, k) * Math.PI) * 0.8 : 0;
  const armor = armorOf(ct);
  const wk = common.weapon === 'sword2h' ? 'vk_sword' : common.weapon === 'axe2h' ? 'vk_axe' : common.weapon;
  const L: VkLook = {
    skin: gauntOf(gt, ct), head: 'none',
    body: armor,
    legs: ct >= 2 ? shade(armor, -0.12) : ct >= 0 ? '#2a2226' : '#2c2428',
    build: 1.15, height: 1.04,
    ...common,
    boots: bt >= 2 || ct >= 3 ? '#1e1b24' : bt >= 0 ? '#2a1e1a' : '#231a18',
    helm: -1,
    weapon: wk,
    // no offhand with a two-handed blade: the slot carries the grip hook (see 'two-handed grip' below)
    offhand: common.offhand || (TWO_HANDED.has(wk ?? '') ? 'vk_grip' : null),
    wColor: WSTEEL[wt],
    // rarity still shows as glow strength, but in the void's colours
    wGlow: shroud || surge > 0.2 ? VK.violet : common.wGlow ? RARITY_GLOW[common.wGlow] ?? VK.violet : wt >= 4 ? '#8a4ad8' : undefined,
    trim: ct >= 3 ? '#7040b0' : undefined,
    // the rig paints mail rings for tier 1; plate (ridge, pauldrons) is painted by the decor instead
    armorTier: ct === 1 ? 1 : -1,
    glow: shroud || surge > 0.1 || ct >= 4 ? VK.violet : undefined,
    decor: 'vk_knight',
    vk: { act, k, ct, ht, gt, wt, shroud, surge },
  };
  return L;
};

// ------------------------------------------------------------------ small drawing helpers
/** A limb segment drawn like the rig's (outline, body, lit highlight). */
function seg(c: C2D, x0: number, y0: number, x1: number, y1: number, w: number, col: string): void {
  c.lineCap = 'round';
  c.strokeStyle = shade(col, -0.45); c.lineWidth = w + 0.9;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.strokeStyle = col; c.lineWidth = w;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  const l = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / l, ny = (x1 - x0) / l;
  const s = nx + ny < 0 ? 1 : -1, o = w * 0.22 * s;
  c.strokeStyle = shade(col, 0.3); c.lineWidth = w * 0.28;
  c.beginPath(); c.moveTo(x0 + nx * o, y0 + ny * o); c.lineTo(x1 + nx * o, y1 + ny * o); c.stroke();
}

/** Elbow of a two-segment arm from shoulder and hand (the rig bends the forearm by `bend`). */
function elbow(sx: number, sy: number, hx: number, hy: number, l1: number, l2: number, bend: number): { ex: number; ey: number; a: number } {
  const beta = Math.atan2(l2 * Math.sin(bend), l1 + l2 * Math.cos(bend));
  const a = Math.atan2(hx - sx, hy - sy) - beta;
  return { ex: sx + Math.sin(a) * l1, ey: sy + Math.cos(a) * l1, a };
}

/** A tapered, slightly ridged horn along a quadratic curve from its base to the tip. */
export function horn(c: C2D, bx: number, by: number, cx: number, cy: number, ex: number, ey: number, w: number, col: string, ridges = true): void {
  const n = 9;
  const L: number[] = [], R: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const px = u * u * bx + 2 * u * t * cx + t * t * ex, py = u * u * by + 2 * u * t * cy + t * t * ey;
    const tx = 2 * u * (cx - bx) + 2 * t * (ex - cx), ty = 2 * u * (cy - by) + 2 * t * (ey - cy);
    const tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
    const hw = (w / 2) * Math.pow(1 - t, 0.85);
    L.push(px + nx * hw, py + ny * hw); R.push(px - nx * hw, py - ny * hw);
  }
  const g = c.createLinearGradient(bx, by, ex, ey);
  g.addColorStop(0, shade(col, -0.25)); g.addColorStop(0.55, col); g.addColorStop(1, shade(col, 0.45));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(L[0], L[1]);
  for (let i = 2; i < L.length; i += 2) c.lineTo(L[i], L[i + 1]);
  for (let i = R.length - 2; i >= 0; i -= 2) c.lineTo(R[i], R[i + 1]);
  c.closePath(); c.fill();
  c.strokeStyle = shade(col, -0.55); c.lineWidth = 0.35; c.stroke();
  // lit edge so dark horns still read against a dark floor
  c.strokeStyle = shade(col, 0.55); c.lineWidth = Math.max(0.3, w * 0.09);
  c.beginPath(); c.moveTo(L[0], L[1]); for (let i = 2; i < L.length - 2; i += 2) c.lineTo(L[i], L[i + 1]); c.stroke();
  if (ridges) {
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.3;
    c.beginPath();
    for (let i = 1; i < n - 2; i += 2) { c.moveTo(L[i * 2], L[i * 2 + 1]); c.lineTo(R[i * 2], R[i * 2 + 1]); }
    c.stroke();
  }
}

/** Two burning violet eyes (a soft halo plus a hot core). k: 0..1+ intensity. */
export function voidEyes(c: C2D, x: number, y: number, gap: number, s: number, k: number): void {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const ox of [0, gap]) {
    const g = c.createRadialGradient(x + ox, y, 0, x + ox, y, s * (3 + k * 2));
    g.addColorStop(0, `rgba(${VK.vHiRGB},${Math.min(1, 0.7 * k)})`); g.addColorStop(0.35, `rgba(${VK.vRGB},${0.45 * k})`); g.addColorStop(1, `rgba(${VK.vRGB},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(x + ox, y, s * (3 + k * 2), 0, TAU); c.fill();
  }
  c.fillStyle = '#fbf2ff';
  c.beginPath(); c.ellipse(x, y, s * 0.95, s * 0.55, -0.1, 0, TAU); c.ellipse(x + gap, y, s * 0.8, s * 0.5, -0.1, 0, TAU); c.fill();
  c.restore();
}

/** A flickering violet flame tongue rising from (x,y). */
function flameTongue(c: C2D, x: number, y: number, h: number, w: number, t: number, seed: number, a: number): void {
  const sway = Math.sin(t * 7 + seed * 3.1) * w * 0.6, hh = h * (0.75 + 0.25 * Math.sin(t * 11 + seed * 5.3));
  const g = c.createLinearGradient(x, y, x, y - hh);
  g.addColorStop(0, `rgba(${VK.vHiRGB},${0.85 * a})`); g.addColorStop(0.45, `rgba(${VK.vRGB},${0.6 * a})`); g.addColorStop(1, `rgba(${VK.vDkRGB},0)`);
  c.fillStyle = g;
  c.beginPath(); c.moveTo(x - w, y);
  c.quadraticCurveTo(x - w * 0.9 + sway * 0.4, y - hh * 0.55, x + sway, y - hh);
  c.quadraticCurveTo(x + w * 0.9 + sway * 0.4, y - hh * 0.55, x + w, y);
  c.closePath(); c.fill();
}

// ------------------------------------------------------------------ pose remap (the engine has no per-skill pose hook)
function remapPose(p: Pose, s: VkState): void {
  if (s.act === 'vk_drain' && p.atk >= 0) {
    // a rising cut: blade low in front, then ripped up and over (the swing played backwards)
    p.atk = Math.max(0, Math.min(0.999, 1 - p.atk));
  } else if (s.act === 'vk_eclipse') {
    // greatsword raised to the dark sky, held, then slammed down as the sphere erupts (hit at 60%)
    const k = s.k;
    p.cast = -1;
    p.atk = k < 0.5 ? 0.37 * ease(k / 0.42) : k < 0.62 ? 0.37 + ((k - 0.5) / 0.12) * 0.25 : Math.min(0.9, 0.62 + ((k - 0.62) / 0.38) * 0.25);
  } else if (s.act === 'vk_grasp' && p.cast >= 0) {
    // reach out, clench (hit at 55%), then yank the hands down and back
    const k = s.k;
    p.cast = k < 0.55 ? k : Math.max(0.02, 0.5 - (k - 0.55) * 1.4);
  }
}

// ------------------------------------------------------------------ cloak
/** Jagged, fluttering hem from (x0,y0) to (x1,y1) (appended to the current path). */
function hem(c: C2D, x0: number, y0: number, x1: number, y1: number, n: number, depth: number, t: number, mv: number, seed: number): void {
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
    const fl = Math.sin(t * (2.2 + mv * 3) + i * 1.7 + seed) * (0.8 + mv * 1.2);
    const tear = ((i * 37 + seed * 11) % 5) / 5;
    // a torn tooth hanging below, then back up into the notch
    const xm = x - ((x1 - x0) / n) * 0.5;
    c.lineTo(xm + fl * 0.6, y - 0.4 + depth * (0.55 + tear * 0.6) + fl * 0.25);
    c.lineTo(x + fl * 0.3, y - depth * (0.25 + tear * 0.35));
  }
}

function cloakBehind(c: C2D, p: Pose, a: RigAnchors, s: VkState): void {
  const b = a.build;
  const mv = p.moving ? 1 : 0;
  const ph = p.walk * 4.2;
  const fl = mv ? Math.sin(ph * 0.5 + 0.6) * 1.8 : Math.sin(p.t * 1.5) * 0.6;
  const trail = mv * 6 + (p.atk >= 0 ? Math.sin(Math.min(1, p.atk) * Math.PI) * 2.5 : 0);
  const lift = mv * 2.5;
  const x0 = a.shX - 5.6 * b, y0 = a.shY + 0.2, x1 = a.shX + 2.4, y1 = a.shY - 0.6;
  const bl = -13 * b - trail + fl, blY = -1.2 - lift, br = 3 - trail * 0.2, brY = -1;
  const g = c.createLinearGradient(0, a.shY, 0, 0);
  g.addColorStop(0, '#231a2a'); g.addColorStop(0.6, '#150f1a'); g.addColorStop(1, '#0c080f');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(x0, y0);
  c.quadraticCurveTo(-11 * b - trail * 0.55, a.hipY - 2, bl, blY);
  hem(c, bl, blY, br, brY, 7, 3.2, p.t, mv, 1);
  c.quadraticCurveTo(5, a.hipY + 3, x1, y1);
  c.closePath(); c.fill();
  // violet lining showing at the trailing edge
  c.strokeStyle = s.ct >= 2 || s.shroud ? '#4a2470' : '#2e1d3a'; c.lineWidth = 1.1;
  c.beginPath(); c.moveTo(x0 + 0.4, y0 + 0.6); c.quadraticCurveTo(-11 * b - trail * 0.55 + 0.6, a.hipY - 2, bl + 0.5, blY - 0.6); c.stroke();
  // folds and tears
  c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 0.7;
  for (const f of [0.28, 0.55, 0.8]) {
    c.beginPath(); c.moveTo(x0 + (x1 - x0) * f, y0 + 2);
    c.quadraticCurveTo(-7 * b * f - trail * 0.3, a.hipY + 2, bl + (br - bl) * f + fl * 0.5, -3.5 - lift * 0.7); c.stroke();
  }
  if (s.ct >= 4 || s.shroud) {
    // embers of void smouldering along the hem
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const f = (i + 0.5) / 5, x = bl + (br - bl) * f, y = blY + (brY - blY) * f + 1.5;
      const tw = 0.5 + 0.5 * Math.sin(p.t * 6 + i * 2.3);
      c.fillStyle = `rgba(${VK.vRGB},${0.35 * tw})`; c.beginPath(); c.arc(x, y, 1.6, 0, TAU); c.fill();
    }
    c.restore();
  }
}

function cloakOver(c: C2D, p: Pose, a: RigAnchors, s: VkState): void {
  // seen from behind: the cloak hides the back, its tattered hem swaying over the calves
  const b = a.build;
  const mv = p.moving ? 1 : 0;
  const sw = mv ? Math.sin(p.walk * 4.2) : 0;
  const fl = mv ? sw * 1.3 : Math.sin(p.t * 1.5) * 0.5;
  const x0 = a.shX - 7.6 * b, x1 = a.shX + 7.6 * b, y0 = a.shY + 0.4;
  const bl = -10.5 * b + fl * 0.6, br = 10.5 * b + fl, by = -2.5 - mv * 1.5;
  const g = c.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, '#2c2233'); g.addColorStop(0.5, '#1c1522'); g.addColorStop(1, '#0e0a12');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(x0, y0 + 1);
  c.quadraticCurveTo(a.shX, y0 - 2.6, x1, y0 + 1);
  c.quadraticCurveTo(x1 + 2.2, a.hipY, br, by);
  hem(c, br, by, bl, by, 8, 3.4, p.t, mv, 4);
  c.quadraticCurveTo(x0 - 2.2, a.hipY, x0, y0 + 1);
  c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.8;
  for (const f of [-0.5, -0.15, 0.2, 0.55]) { c.beginPath(); c.moveTo(a.shX + f * 9 * b, y0 + 4); c.quadraticCurveTo(f * 10 * b + fl * 0.4, a.hipY + 4, f * 12 * b + fl, by - 1); c.stroke(); }
  // a torn sigil of the void stitched on the back
  if (s.ct >= 2) {
    const cx = a.shX + 0.3, cy = a.shY + 11;
    c.strokeStyle = s.ct >= 4 || s.shroud ? `rgba(${VK.vRGB},0.85)` : '#4a2a62'; c.lineWidth = 0.9;
    c.beginPath(); c.arc(cx, cy, 3.1, 0, TAU); c.stroke();
    c.fillStyle = '#07050a'; c.beginPath(); c.arc(cx + 0.7, cy - 0.3, 2.3, 0, TAU); c.fill();
  }
  // mantle
  c.fillStyle = '#2a2032';
  c.beginPath(); c.ellipse(a.shX, a.shY + 1.6, 7.2 * b, 2.8, 0, 0, TAU); c.fill();
}

// ------------------------------------------------------------------ torso details, belt, tabard
function torsoPath(c: C2D, a: RigAnchors): void {
  const b = a.build, ww = 6.2 * b, sw2 = 7.4 * b;
  c.beginPath(); c.moveTo(-ww, a.hipY + 2); c.lineTo(ww, a.hipY + 2); c.lineTo(a.shX + sw2, a.shY + 2);
  c.quadraticCurveTo(a.shX, a.shY - 3, a.shX - sw2, a.shY + 2); c.closePath();
}

function chest(c: C2D, p: Pose, a: RigAnchors, s: VkState): void {
  const b = a.build, ww = 6.2 * b;
  const top = a.shY + 2, bot = a.hipY;
  c.save();
  torsoPath(c, a); c.clip();
  if (s.ct <= 0) {
    // gambeson: quilted diamonds
    c.strokeStyle = s.ct === 0 ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.3)'; c.lineWidth = 0.45;
    c.beginPath();
    for (let i = -4; i <= 4; i++) { c.moveTo(i * 3.2 - 8, top); c.lineTo(i * 3.2 + 8, bot + 3); c.moveTo(i * 3.2 + 8, top); c.lineTo(i * 3.2 - 8, bot + 3); }
    c.stroke();
  }
  if (s.ct >= 2) {
    // breastplate: a keeled chest with a lit flank and a hard lower edge, fluted from gothic tier
    const col = armorOf(s.ct);
    const bg = c.createLinearGradient(a.shX - 7, top, a.shX + 8, top + 8);
    bg.addColorStop(0, shade(col, 0.42)); bg.addColorStop(0.45, shade(col, 0.08)); bg.addColorStop(1, shade(col, -0.35));
    c.fillStyle = bg;
    c.beginPath(); c.moveTo(a.shX - 7.6 * b, top - 1);
    c.quadraticCurveTo(a.shX, top - 4, a.shX + 7.8 * b, top - 1);
    c.lineTo(ww + 0.6, bot - 7.5);
    c.quadraticCurveTo(0.8, bot - 3.2, -ww - 0.4, bot - 7.8);
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 0.6; c.stroke();
    c.strokeStyle = shade(col, 0.6); c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(a.shX + 1.2, top - 1.5); c.quadraticCurveTo(a.shX + 1.8, top + 6, 1.2, bot - 5); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.2)'; c.beginPath(); c.ellipse(a.shX - 2.6, top + 4.5, 1.5, 3.4, -0.25, 0, TAU); c.fill();
    if (s.ct >= 3) {
      c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.45;
      c.beginPath();
      for (const f of [-4.2, -2.2, 4.2]) { c.moveTo(a.shX + f, top + 0.5); c.quadraticCurveTo(a.shX + f * 1.1 + 0.8, top + 7, f * 0.8 + 1, bot - 6); }
      c.stroke();
    }
    // abdomen lames
    c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 0.6;
    for (let i = 0; i < 3; i++) { const y = bot - 1.5 - i * 2.4; c.beginPath(); c.moveTo(-ww, y + 0.6); c.quadraticCurveTo(0, y - 0.6, ww + 1, y + 0.4); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 0.4;
    for (let i = 0; i < 3; i++) { const y = bot - 1.0 - i * 2.4; c.beginPath(); c.moveTo(-ww, y + 0.6); c.quadraticCurveTo(0, y - 0.6, ww + 1, y + 0.4); c.stroke(); }
    // rivets along the breastplate edge
    c.fillStyle = s.ct >= 3 ? '#8a6ab0' : '#6a6878';
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(a.shX + 5.2 * b - i * 0.4, top + 2 + i * 3, 0.42, 0, TAU); c.fill(); }
  }
  if (s.ct >= 3) {
    // engraved void sigil: a ring swallowed by a black disc, fissure lines radiating
    const cx = a.shX + 1.2, cy = top + 6.2;
    const pulse = s.ct >= 4 ? 0.7 + 0.3 * Math.sin(p.t * 2.6) : 0.55;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(${VK.vRGB},${0.55 * pulse + (s.shroud ? 0.25 : 0)})`; c.lineWidth = 0.6;
    c.beginPath(); c.arc(cx, cy, 2.6, 0, TAU); c.stroke();
    c.beginPath();
    for (let i = 0; i < 6; i++) { const an = (i / 6) * TAU + 0.4; c.moveTo(cx + Math.cos(an) * 3.2, cy + Math.sin(an) * 3.2); c.lineTo(cx + Math.cos(an) * (4.6 + (i % 2) * 1.6), cy + Math.sin(an) * (4.6 + (i % 2) * 1.6)); }
    c.stroke();
    c.restore();
    c.fillStyle = '#060409'; c.beginPath(); c.arc(cx + 0.5, cy - 0.2, 1.8, 0, TAU); c.fill();
  }
  if (s.ct >= 4) {
    // glowing fissures across the abyssal plate
    const pulse = 0.65 + 0.35 * Math.sin(p.t * 3.1);
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round';
    for (const [w, col] of [[1.6, `rgba(${VK.vRGB},${0.35 * pulse})`], [0.55, `rgba(${VK.vHiRGB},${0.85 * pulse})`]] as [number, string][]) {
      c.strokeStyle = col; c.lineWidth = w;
      c.beginPath();
      c.moveTo(a.shX - 5, top + 3); c.lineTo(a.shX - 2.6, top + 6); c.lineTo(a.shX - 3.4, top + 9); c.lineTo(-1.5, bot - 3);
      c.moveTo(a.shX + 6.5, top + 9); c.lineTo(a.shX + 4, top + 11.5); c.lineTo(3.4, bot - 1.5);
      c.stroke();
    }
    c.restore();
  }
  c.restore();
  // baldric for the greatsword (under plate it is hidden by the collar)
  if (s.ct <= 1) {
    c.strokeStyle = '#1a1214'; c.lineWidth = 1.7;
    c.beginPath(); c.moveTo(a.shX - 5 * b, top); c.lineTo(ww * 0.8, bot - 1); c.stroke();
    c.strokeStyle = '#4a3428'; c.lineWidth = 1.1;
    c.beginPath(); c.moveTo(a.shX - 5 * b, top); c.lineTo(ww * 0.8, bot - 1); c.stroke();
    c.fillStyle = '#8a7a6a'; c.fillRect(a.shX - 0.6, top + 6.5, 1.8, 1.8);
  }
  // gorget / collar
  c.fillStyle = s.ct >= 2 ? shade(armorOf(s.ct), 0.12) : '#241a28';
  c.beginPath(); c.ellipse(a.shX + 1, a.shY + 1.6, 4.6 * b, 1.9, 0, 0, TAU); c.fill();
  if (s.ct >= 3) { c.strokeStyle = '#7040b0'; c.lineWidth = 0.5; c.stroke(); }
}

function beltAndTabard(c: C2D, p: Pose, a: RigAnchors, s: VkState): void {
  const b = a.build;
  const sw = p.moving ? Math.sin(p.walk * 4.2) : 0;
  const ww = 6.2 * b;
  const yw = a.hipY - 0.6;
  // tattered tabard hanging from the belt
  const cx = a.shX * 0.6 + 0.6, tw = 2.9 * b, y1 = a.hipY + 11;
  const flap = sw * 1.4 + Math.sin(p.t * 1.7) * 0.3;
  const g = c.createLinearGradient(cx - tw, 0, cx + tw, 0);
  g.addColorStop(0, '#3a2548'); g.addColorStop(0.5, '#2a1936'); g.addColorStop(1, '#140c1a');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(cx - tw, yw + 0.5); c.lineTo(cx + tw, yw + 0.5);
  c.lineTo(cx + tw * 1.08 + flap, y1 - 2);
  c.lineTo(cx + tw * 0.55 + flap, y1 + 0.8); c.lineTo(cx + tw * 0.2 + flap * 0.9, y1 - 1.6);
  c.lineTo(cx - tw * 0.2 + flap * 0.8, y1 + 1.2); c.lineTo(cx - tw * 0.6 + flap * 0.7, y1 - 1.4);
  c.lineTo(cx - tw * 1.02 + flap * 0.6, y1 + 0.2);
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.5; c.stroke();
  if (s.ct >= 1) {
    // a void eye stitched on the tabard
    const ey = yw + 5.2;
    c.strokeStyle = s.ct >= 3 || s.shroud ? VK.violet : '#6a4a86'; c.lineWidth = 0.55;
    c.beginPath(); c.ellipse(cx + flap * 0.3, ey, 1.9, 1.1, 0, 0, TAU); c.stroke();
    c.fillStyle = '#07050a'; c.beginPath(); c.arc(cx + flap * 0.3, ey, 0.8, 0, TAU); c.fill();
  }
  // belt
  const bc = '#1b1418';
  c.fillStyle = shade(bc, -0.2); c.fillRect(-ww - 0.4, yw - 1.3, (ww + 0.4) * 2, 2.8);
  c.fillStyle = '#2c2228'; c.fillRect(-ww - 0.4, yw - 1.3, (ww + 0.4) * 2, 1.1);
  // buckle: an iron ring holding a void gem (it glows under the shroud / from abyssal tier)
  c.fillStyle = s.ct >= 2 ? '#5a5668' : '#5a4a3a';
  c.beginPath(); c.arc(cx, yw, 1.7, 0, TAU); c.fill();
  const gl = s.shroud || s.ct >= 4 ? 1 : s.ct >= 2 ? 0.5 : 0;
  c.fillStyle = gl > 0 ? VK.violet : '#2a1a36';
  c.beginPath(); c.arc(cx, yw, 0.9, 0, TAU); c.fill();
  if (gl > 0) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const gg = c.createRadialGradient(cx, yw, 0, cx, yw, 4);
    gg.addColorStop(0, `rgba(${VK.vRGB},${0.5 * gl})`); gg.addColorStop(1, `rgba(${VK.vRGB},0)`);
    c.fillStyle = gg; c.beginPath(); c.arc(cx, yw, 4, 0, TAU); c.fill(); c.restore();
  }
}

// ------------------------------------------------------------------ head: cowl or horned helm
function hood(c: C2D, p: Pose, x: number, y: number, r: number, s: VkState, eyeK: number): void {
  const g = c.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, '#3a2c44'); g.addColorStop(0.5, HOOD); g.addColorStop(1, '#120c16');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(x - r * 1.35, y + r * 1.45);
  c.quadraticCurveTo(x - r * 1.6, y - r * 0.6, x - r * 0.75, y - r * 1.35);
  c.quadraticCurveTo(x - r * 0.1, y - r * 1.75, x + r * 0.55, y - r * 1.25);
  c.quadraticCurveTo(x + r * 1.35, y - r * 0.7, x + r * 1.25, y + r * 0.35);
  c.quadraticCurveTo(x + r * 1.3, y + r * 1.1, x + r * 1.0, y + r * 1.5);
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 0.4; c.stroke();
  if (p.back) {
    c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.5;
    c.beginPath(); c.moveTo(x - r * 0.1, y - r * 1.55); c.quadraticCurveTo(x - r * 0.35, y, x - r * 0.1, y + r * 1.4); c.stroke();
    return;
  }
  // the face is a void; only the eyes burn in it
  const fg = c.createRadialGradient(x + r * 0.6, y + r * 0.15, 0, x + r * 0.6, y + r * 0.15, r * 0.95);
  fg.addColorStop(0, '#000000'); fg.addColorStop(0.7, '#07040a'); fg.addColorStop(1, '#1a1220');
  c.fillStyle = fg;
  c.beginPath(); c.ellipse(x + r * 0.62, y + r * 0.18, r * 0.58, r * 0.86, 0.12, 0, TAU); c.fill();
  // lit fold of the cowl's rim
  c.strokeStyle = 'rgba(120,96,140,0.55)'; c.lineWidth = 0.55;
  c.beginPath(); c.ellipse(x + r * 0.62, y + r * 0.18, r * 0.6, r * 0.88, 0.12, Math.PI * 1.05, Math.PI * 1.75); c.stroke();
  voidEyes(c, x + r * 0.55, y + r * 0.02, r * 0.42, r * 0.16, eyeK);
  void s;
}

/** Helm shell shared by the closed helms (tiers 1-4). */
function helmShell(c: C2D, x: number, y: number, r: number, col: string, back: boolean): void {
  const g = c.createLinearGradient(x - r, y - r, x + r * 0.8, y + r);
  g.addColorStop(0, shade(col, 0.45)); g.addColorStop(0.45, col); g.addColorStop(1, shade(col, -0.5));
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y - r * 0.08, r * 1.14, Math.PI * 0.93, TAU * 1.015);
  c.lineTo(x + r * 1.16, y + r * 0.5);
  c.quadraticCurveTo(x + r * 1.12, y + r * 1.18, x + r * 0.45, y + r * 1.22);
  c.lineTo(x - r * 0.85, y + r * 1.12);
  c.quadraticCurveTo(x - r * 1.25, y + r * 0.6, x - r * 1.12, y - r * 0.12);
  c.closePath(); c.fill();
  c.strokeStyle = shade(col, -0.6); c.lineWidth = 0.45; c.stroke();
  // top ridge highlight
  c.strokeStyle = shade(col, 0.55); c.lineWidth = 0.5;
  c.beginPath(); c.arc(x, y - r * 0.08, r * 0.96, Math.PI * 1.2, Math.PI * 1.62); c.stroke();
  if (back) {
    c.strokeStyle = shade(col, -0.35); c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(x - r * 0.1, y - r * 1.2); c.quadraticCurveTo(x - r * 0.3, y, x - r * 0.15, y + r * 1.15); c.stroke();
  }
}

function helm(c: C2D, p: Pose, a: RigAnchors, s: VkState): void {
  const x = a.hx, y = a.hy, r = a.headR;
  const t = s.ht;
  const eyeK = 0.75 + (s.shroud ? 0.35 : 0) + s.surge * 0.6;
  if (t < 0) { hood(c, p, x, y, r, s, eyeK); return; }
  const col = HELM[clampT(t)];
  const hornCol = t >= 4 ? '#261d2c' : t === 3 ? '#302628' : t === 2 ? '#56463c' : '#5a4f4a';
  const back = p.back;
  // far horn first (behind the helm)
  const far = (bx: number, by: number, cx: number, cy: number, ex: number, ey: number, w: number) =>
    horn(c, x + bx * r, y + by * r, x + cx * r, y + cy * r, x + ex * r, y + ey * r, w * r, shade(hornCol, -0.35), false);
  const near = (bx: number, by: number, cx: number, cy: number, ex: number, ey: number, w: number) =>
    horn(c, x + bx * r, y + by * r, x + cx * r, y + cy * r, x + ex * r, y + ey * r, w * r, hornCol);
  if (t === 0) {
    // cowl under an iron skullcap with two blunt nubs
    hood(c, p, x, y, r, s, eyeK);
    far(-0.55, -0.95, -0.7, -1.4, -0.55, -1.75, 0.34);
    const g = c.createLinearGradient(x - r, y - r, x + r, y);
    g.addColorStop(0, shade(col, 0.45)); g.addColorStop(1, shade(col, -0.45));
    c.fillStyle = g;
    c.beginPath(); c.arc(x - r * 0.05, y - r * 0.35, r * 1.02, Math.PI * 0.98, TAU * 1.0); c.lineTo(x + r * 0.95, y - r * 0.2); c.lineTo(x - r * 1.05, y - r * 0.2); c.fill();
    c.fillStyle = shade(col, -0.3); c.fillRect(x - r * 1.05, y - r * 0.32, r * 2.0, r * 0.22);
    near(0.1, -1.05, 0.2, -1.5, 0.45, -1.8, 0.36);
    return;
  }
  if (t === 1) {
    // bascinet with a raised keel and short bull horns curving forward
    far(-0.3, -0.85, 0.25, -1.35, 0.5, -1.9, 0.44);
    helmShell(c, x, y, r, col, back);
    c.fillStyle = shade(col, 0.2);
    c.beginPath(); c.moveTo(x - r * 1.0, y - r * 0.6); c.quadraticCurveTo(x - r * 0.1, y - r * 1.55, x + r * 0.85, y - r * 0.75); c.quadraticCurveTo(x - r * 0.1, y - r * 1.25, x - r * 1.0, y - r * 0.6); c.fill();
    near(0.3, -0.8, 1.05, -1.0, 1.3, -1.75, 0.5);
  } else if (t === 2) {
    // ram horns curling back and down
    far(-0.55, -0.7, -2.0, -1.5, -1.55, 0.35, 0.52);
    helmShell(c, x, y, r, col, back);
    near(-0.2, -0.75, -1.85, -1.75, -1.35, 0.5, 0.6);
    c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 0.35;
    c.beginPath(); c.arc(x - r * 1.25, y - r * 0.55, r * 0.35, 0, TAU); c.stroke();
  } else if (t === 3) {
    // long demonic horns swept back and up, a ridge of spikes along the crown
    far(-0.45, -0.8, -1.9, -1.1, -1.75, -2.9, 0.5);
    helmShell(c, x, y, r, col, back);
    c.fillStyle = shade(col, -0.2);
    for (let i = 0; i < 3; i++) { const bx = x - r * (0.55 - i * 0.45), by = y - r * (1.1 + (i === 1 ? 0.1 : 0)); c.beginPath(); c.moveTo(bx - r * 0.18, by + r * 0.1); c.lineTo(bx - r * 0.05, by - r * (0.55 + (i === 1 ? 0.25 : 0))); c.lineTo(bx + r * 0.2, by + r * 0.1); c.fill(); }
    near(-0.05, -0.85, -1.55, -1.35, -1.35, -3.1, 0.58);
  } else {
    // crown of horns: two great horns rising and curling forward, a ring of smaller spikes, violet flame
    far(-0.4, -0.85, -1.45, -2.2, -0.35, -3.45, 0.58);
    helmShell(c, x, y, r, col, back);
    c.fillStyle = '#16121c';
    for (let i = 0; i < 4; i++) { const bx = x - r * (0.8 - i * 0.5), by = y - r * 1.05; const hh = r * (0.45 + (i === 1 || i === 2 ? 0.35 : 0)); c.beginPath(); c.moveTo(bx - r * 0.16, by + r * 0.12); c.lineTo(bx + r * 0.05, by - hh); c.lineTo(bx + r * 0.2, by + r * 0.12); c.fill(); }
    near(0.05, -0.9, -1.2, -2.35, 0.25, -3.6, 0.66);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) flameTongue(c, x - r * (0.55 - i * 0.5), y - r * 1.15, r * (1.1 + (i === 1 ? 0.5 : 0)), r * 0.28, p.t, i + 1, 0.45 + s.surge * 0.4 + (s.shroud ? 0.2 : 0));
    c.restore();
  }
  if (back) return;
  // visor: a black slit (T at tier 2, Y at tier 3, angular brows at tier 4) with the eyes burning inside
  c.fillStyle = '#030204';
  c.beginPath();
  if (t === 1) { c.rect(x + r * 0.22, y - r * 0.12, r * 0.96, r * 0.26); }
  else if (t === 2) { c.rect(x + r * 0.2, y - r * 0.14, r * 0.98, r * 0.26); c.rect(x + r * 0.8, y + r * 0.08, r * 0.16, r * 0.75); }
  else if (t === 3) { c.moveTo(x + r * 0.15, y - r * 0.25); c.lineTo(x + r * 1.18, y - r * 0.05); c.lineTo(x + r * 1.18, y + r * 0.14); c.lineTo(x + r * 0.95, y + r * 0.1); c.lineTo(x + r * 0.95, y + r * 0.95); c.lineTo(x + r * 0.78, y + r * 0.95); c.lineTo(x + r * 0.78, y + r * 0.08); c.lineTo(x + r * 0.2, y + r * 0.02); c.closePath(); }
  else { c.moveTo(x + r * 0.1, y - r * 0.35); c.lineTo(x + r * 0.62, y - r * 0.02); c.lineTo(x + r * 1.2, y - r * 0.32); c.lineTo(x + r * 1.2, y - r * 0.08); c.lineTo(x + r * 0.62, y + r * 0.2); c.lineTo(x + r * 0.12, y - r * 0.1); c.closePath(); }
  c.fill();
  // breaths: rivets on the cheek plate
  c.fillStyle = shade(col, -0.45);
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x + r * 0.7, y + r * (0.45 + i * 0.22), r * 0.06, 0, TAU); c.fill(); }
  voidEyes(c, x + r * 0.5, y - r * (t >= 4 ? 0.1 : 0.0), r * 0.42, r * 0.15, eyeK * (t >= 3 ? 1.15 : 1));
}

// ------------------------------------------------------------------ pauldrons, arms
/** Spiked shoulder guard following the upper arm (sx,sy shoulder, a arm angle in the rig's sin/cos convention). */
function pauldron(c: C2D, sx: number, sy: number, a: number, armW: number, s: VkState, dim = 0): void {
  if (s.ct < 0) return;
  const col = s.ct <= 0 ? '#3a2c30' : shade(armorOf(s.ct), dim);
  const W = armW * (s.ct >= 3 ? 0.98 : s.ct >= 2 ? 0.9 : 0.78);
  const edge = s.ct >= 3 ? '#6a3aa0' : s.ct >= 2 ? '#4a3a60' : shade(col, -0.65);
  c.save();
  c.translate(sx, sy); c.rotate(-a);
  // lames (short: they cover the top half of the upper arm)
  const lames = s.ct >= 2 ? 2 : 1;
  for (let i = lames; i >= 1; i--) {
    const y = armW * (0.1 + i * 0.5), w = W * (1.02 - i * 0.08);
    const g = c.createLinearGradient(-w, 0, w, 0);
    g.addColorStop(0, shade(col, 0.6)); g.addColorStop(0.55, shade(col, 0.22 - 0.06 * i)); g.addColorStop(1, shade(col, -0.3));
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-w, y - armW * 0.3); c.lineTo(w, y - armW * 0.3); c.lineTo(w * 0.92, y + armW * 0.26); c.lineTo(0, y + armW * 0.36); c.lineTo(-w * 0.92, y + armW * 0.26); c.closePath(); c.fill();
    c.strokeStyle = shade(col, -0.65); c.lineWidth = 0.4; c.stroke();
    // lit rolled rim along the lower edge (the part that shows under the helm at rest)
    c.strokeStyle = shade(col, 0.7); c.lineWidth = 0.4;
    c.beginPath(); c.moveTo(-w * 0.9, y + armW * 0.2); c.lineTo(0, y + armW * 0.3); c.lineTo(w * 0.5, y + armW * 0.26); c.stroke();
  }
  // cap: an angular plate with a raised keel
  const g = c.createLinearGradient(-W, -armW, W * 0.8, armW * 0.5);
  g.addColorStop(0, shade(col, 0.8)); g.addColorStop(0.35, shade(col, 0.3)); g.addColorStop(0.7, col); g.addColorStop(1, shade(col, -0.5));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(-W * 1.12, armW * 0.35); c.lineTo(-W * 1.0, -armW * 0.45); c.lineTo(-W * 0.35, -armW * 0.92); c.lineTo(W * 0.35, -armW * 0.92); c.lineTo(W * 1.0, -armW * 0.45); c.lineTo(W * 1.12, armW * 0.35); c.lineTo(0, armW * 0.1); c.closePath(); c.fill();
  c.strokeStyle = edge; c.lineWidth = s.ct >= 3 ? 0.55 : 0.45; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 0.5;
  c.beginPath(); c.moveTo(-W * 0.9, -armW * 0.4); c.lineTo(-W * 0.3, -armW * 0.8); c.lineTo(W * 0.3, -armW * 0.8); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.ellipse(-W * 0.35, -armW * 0.35, W * 0.28, armW * 0.18, -0.4, 0, TAU); c.fill();
  // spikes rising from the cap (gothic: three, abyssal: three long curved ones)
  const spikes = s.ct >= 3 ? 3 : s.ct >= 2 ? 1 : 0;
  if (spikes) {
    const sc = s.ct >= 4 ? 1.45 : s.ct >= 3 ? 1.15 : 1;
    const hc = s.ct >= 4 ? '#221a2c' : shade(col, 0.05);
    for (let i = 0; i < spikes; i++) {
      const off = spikes === 1 ? 0 : (i - 1) * W * 0.62;
      const lean = spikes === 1 ? -0.35 : (i - 1) * 0.55 - 0.25;
      const len = armW * (i === 1 || spikes === 1 ? 1.75 : 1.25) * sc;
      const bx = off, by = -armW * 0.72;
      const tx = bx + Math.sin(lean) * len - (s.ct >= 4 ? 1 : 0), ty = by - Math.cos(lean) * len;
      horn(c, bx, by, bx + Math.sin(lean) * len * 0.3 - 0.4 * sc, by - Math.cos(lean) * len * 0.62, tx, ty, armW * 0.5, hc, false);
    }
  }
  if (s.ct >= 4 || s.shroud) {
    // a void gem set in the cap
    c.fillStyle = VK.violet; c.beginPath(); c.arc(0, -armW * 0.18, 0.75, 0, TAU); c.fill();
    c.save(); c.globalCompositeOperation = 'lighter';
    const gg = c.createRadialGradient(0, -armW * 0.18, 0, 0, -armW * 0.18, 3.2);
    gg.addColorStop(0, `rgba(${VK.vRGB},0.6)`); gg.addColorStop(1, `rgba(${VK.vRGB},0)`);
    c.fillStyle = gg; c.beginPath(); c.arc(0, -armW * 0.18, 3.2, 0, TAU); c.fill(); c.restore();
  }
  c.restore();
}

/** Front arm geometry of the current rig pass (the rig bends the forearm by 0.3 rad for slashes and casts). */
function armGeo(a: RigAnchors): { sx: number; sy: number; ex: number; ey: number; ang: number; armW: number } {
  const b = a.build, armL = 17 * a.height, armW = 3.8 * b;
  const sx = a.shX + 2, sy = a.shY + 2.2;
  const { ex, ey, a: ang } = elbow(sx, sy, a.fhx, a.fhy, armL * 0.52, armL * 0.5, 0.3);
  return { sx, sy, ex, ey, ang, armW };
}

/** Upper arm and pauldron (under the helm while the arm hangs, over it once the arm is raised: see the decor entry). */
function upperArm(c: C2D, L: VkLook, a: RigAnchors, s: VkState): void {
  const { sx, sy, ex, ey, ang, armW } = armGeo(a);
  seg(c, sx, sy, ex, ey, armW, L.body);
  pauldron(c, sx, sy, ang, armW, s);
}

/** Forearm, gauntlet, weapon and fist (drawn after the head: a raised blade passes in front of the helm). */
function foreArm(c: C2D, L: VkLook, p: Pose, a: RigAnchors, s: VkState): void {
  const { sx, sy, ex, ey, ang, armW } = armGeo(a);
  const gc = L.skin;
  seg(c, ex, ey, a.fhx, a.fhy, armW * 0.9 + 0.35, gc);
  if (s.ct >= 1 || s.gt >= 1) {
    // couter with a small spike from gothic tier
    c.fillStyle = shade(s.ct >= 1 ? armorOf(s.ct) : gc, 0.12); c.beginPath(); c.arc(ex, ey, armW * 0.55, 0, TAU); c.fill();
    if (s.ct >= 3) {
      const dx = ex - sx, dy = ey - sy, l = Math.hypot(dx, dy) || 1;
      horn(c, ex, ey, ex + (dx / l) * 1.2 - 0.6, ey + (dy / l) * 1.2, ex + (dx / l) * 3 - 1.2, ey + (dy / l) * 2.6, armW * 0.5, '#1a1520', false);
    }
  }
  // gauntlet cuff (flared from glove tier 2)
  const cx = ex + (a.fhx - ex) * 0.7, cy = ey + (a.fhy - ey) * 0.7;
  const nx = -(a.fhy - ey), ny = a.fhx - ex, nl = Math.hypot(nx, ny) || 1;
  const cw = armW * (s.gt >= 2 ? 0.75 : 0.55);
  c.strokeStyle = s.gt >= 3 ? '#6a3aa0' : shade(gc, -0.4); c.lineWidth = s.gt >= 2 ? 1.2 : 0.8;
  c.beginPath(); c.moveTo(cx + (nx / nl) * cw, cy + (ny / nl) * cw); c.lineTo(cx - (nx / nl) * cw, cy - (ny / nl) * cw); c.stroke();
  const wk = L.weapon ?? 'none';
  if (wk !== 'none') drawWeapon(c, wk, a.fhx, a.fhy, ang + 0.65, L.wTier ?? 0, L.wColor, L.wGlow);
  // armoured fist around the grip
  c.fillStyle = shade(gc, -0.1); c.beginPath(); c.arc(a.fhx, a.fhy, armW * 0.54, 0, TAU); c.fill();
  c.fillStyle = shade(gc, 0.3); c.beginPath(); c.arc(a.fhx - armW * 0.15, a.fhy - armW * 0.15, armW * 0.22, 0, TAU); c.fill();
  // void gathering on the blade while channelling / under the shroud
  if (wk !== 'none' && (s.surge > 0.05 || s.shroud)) {
    const wa = ang + 0.65;
    const k = Math.max(s.surge, s.shroud ? 0.35 + 0.1 * Math.sin(p.t * 5) : 0);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const d = 9 + i * 6.5;
      const tx = a.fhx + Math.sin(wa) * d, ty = a.fhy + Math.cos(wa) * d;
      const R = (4 + i * 0.8) * (0.6 + 0.6 * k);
      const g = c.createRadialGradient(tx, ty, 0, tx, ty, R);
      g.addColorStop(0, `rgba(${VK.vHiRGB},${0.5 * k})`); g.addColorStop(0.4, `rgba(${VK.vRGB},${0.35 * k})`); g.addColorStop(1, `rgba(${VK.vRGB},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(tx, ty, R, 0, TAU); c.fill();
    }
    c.restore();
  }
}

// ------------------------------------------------------------------ two-handed grip
// On heavy weapons the rig swings the empty back arm up to chin height during every strike; under the knight's big
// helm its fist pokes out of the visor like a snout. For the back-arm pass the swing is hidden from the rig (the arm
// stays down behind the body) and handed back by the 'vk_grip' offhand hook, which the rig calls right after drawing
// the back arm and before the weapon arm reads the pose. The front decor layer restores it too, as a safety net.
let heldPose: Pose | null = null, heldAtk = -1;
function holdSwing(p: Pose, L: VkLook): void {
  heldPose = null;
  if (p.atk < 0 || L.offhand !== 'vk_grip') return;
  heldPose = p; heldAtk = p.atk; p.atk = -1;
}
function releaseSwing(p: Pose): void {
  if (heldPose !== p) return;
  p.atk = heldAtk; heldPose = null;
}
OFFHAND_ART.vk_grip = { draw(_c, _x, _y, _tier, p) { releaseSwing(p); }, icon() {} };

// ------------------------------------------------------------------ decor entry
DECOR.vk_knight = (c, L0, p, a, layer) => {
  const L = L0 as VkLook, s = L.vk;
  if (!s) return;
  if (layer === 'back') {
    remapPose(p, s);
    if (!p.back) cloakBehind(c, p, a, s);
    holdSwing(p, L);
    // the far pauldron's spikes poke out behind the shoulder line (the rig's back arm and torso cover its base)
    if (s.ct >= 2) {
      const sw = p.moving ? Math.sin(p.walk * 4.2) : 0;
      const armRest = 0.12 + (p.moving ? -sw * 0.35 : Math.sin(p.t * 2) * 0.03);
      let backA = armRest + 0.1;
      if (p.cast >= 0) backA = 1.2 + ease(p.cast * 2) * 0.6;
      if (p.atk >= 0 && (L.weapon ?? 'none') !== 'none') backA = 1.0 + Math.sin(Math.min(1, p.atk) * Math.PI) * 0.8;
      pauldron(c, a.shX - 2 * a.build, a.shY + 2, backA, 3.8 * a.build, s, -0.35);
    }
    return;
  }
  releaseSwing(p);
  c.save();
  if (p.back) cloakOver(c, p, a, s);
  else { chest(c, p, a, s); beltAndTabard(c, p, a, s); }
  // A lowered arm tucks its pauldron under the helm (spikes behind the head, eyes stay clear). A raised arm (overhead
  // chop, eclipse raise) is the arm nearest the camera crossing in front of the face: drawn under the helm, its elbow
  // would poke out of the visor like a snout.
  const g = armGeo(a);
  const raised = g.ey < g.sy - 1.5;
  if (!raised) upperArm(c, L, a, s);
  helm(c, p, a, s);
  if (raised) upperArm(c, L, a, s);
  foreArm(c, L, p, a, s);
  c.restore();
};

// ------------------------------------------------------------------ weapons
/**
 * The knight's greatsword (local space: origin in the fist, +y along the blade). Same proportions as the common
 * two-handed sword, detailed by tier: rusted and notched → plain steel → blackened with violet runes in the fuller
 * → serrated back edge and horned guard → obsidian blade split by a glowing void fissure.
 */
export function voidSword(c: C2D, tier: number, steel: string, k: number, t: number): void {
  const T = clampT(tier);
  const L = (n: number) => n * k;
  const len = L(30.5), w = L(T >= 3 ? 4.3 : 3.9);
  const blade = () => {
    c.beginPath(); c.moveTo(-w / 2, L(2)); c.lineTo(w / 2, L(2));
    if (T >= 3) for (let i = 0; i < 4; i++) { const yy = L(7 + i * 4.6); c.lineTo(w / 2, yy); c.lineTo(w / 2 + L(1), yy + L(1.5)); c.lineTo(w / 2 * 0.96, yy + L(2.6)); }
    c.lineTo(w / 2 * 0.82, len); c.lineTo(0, len + L(T >= 4 ? 5 : 3.4)); c.lineTo(-w / 2 * 0.82, len); c.closePath();
  };
  const g = c.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, shade(steel, 0.55)); g.addColorStop(0.42, steel); g.addColorStop(1, shade(steel, -0.55));
  c.fillStyle = g; blade(); c.fill();
  c.strokeStyle = shade(steel, -0.65); c.lineWidth = L(0.35); c.stroke();
  // fuller
  c.fillStyle = shade(steel, -0.4); c.fillRect(-L(0.55), L(4), L(1.1), len - L(8));
  c.fillStyle = 'rgba(255,255,255,0.42)'; c.fillRect(-w / 2 + L(0.3), L(3), L(0.45), len * 0.84);
  if (T === 0) {
    // rust blotches and edge notches
    c.fillStyle = 'rgba(120,60,24,0.55)';
    for (const [yy, rr] of [[8, 1.2], [15, 0.9], [21, 1.4], [26, 0.8]] as [number, number][]) { c.beginPath(); c.ellipse(L(((yy * 7) % 3) - 1) * 0.5, L(yy), L(rr), L(rr * 1.6), 0.3, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(20,14,12,0.9)';
    for (const yy of [11, 18, 24]) { c.beginPath(); c.moveTo(w / 2 + L(0.2), L(yy)); c.lineTo(w / 2 - L(0.9), L(yy + 0.7)); c.lineTo(w / 2 + L(0.2), L(yy + 1.4)); c.fill(); }
  }
  if (T >= 1) {
    // void light in the fuller (brighter with tier), runes from tier 2
    const pulse = 0.75 + 0.25 * Math.sin(t * 3 + tier);
    const a = [0, 0.18, 0.4, 0.62, 0.9][T] * pulse;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(${VK.vRGB},${a})`; c.fillRect(-L(0.45), L(4.5), L(0.9), len - L(9));
    if (T >= 2) {
      c.strokeStyle = `rgba(${VK.vHiRGB},${a})`; c.lineWidth = L(0.35);
      c.beginPath();
      for (let i = 0; i < 4; i++) { const yy = L(7 + i * 5.2); c.moveTo(-L(0.9), yy); c.lineTo(L(0.9), yy + L(1.2)); c.moveTo(0, yy - L(0.6)); c.lineTo(0, yy + L(1.8)); }
      c.stroke();
    }
    c.restore();
  }
  if (T >= 4) {
    // the void fissure through the obsidian: a jagged white-violet crack with a soft bloom
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round';
    const pulse = 0.7 + 0.3 * Math.sin(t * 4.2);
    for (const [lw, col] of [[L(2.2), `rgba(${VK.vRGB},${0.35 * pulse})`], [L(0.6), `rgba(${VK.vHiRGB},${0.95 * pulse})`]] as [number, string][]) {
      c.strokeStyle = col; c.lineWidth = lw;
      c.beginPath(); c.moveTo(0, L(3));
      for (let i = 1; i <= 8; i++) c.lineTo(L(((i * 53) % 7) / 7 - 0.5) * 1.2, L(3) + (len - L(1)) * (i / 8));
      c.stroke();
    }
    c.restore();
  }
  // crossguard
  const gm = T >= 2 ? '#2a2632' : T === 1 ? '#8a8e98' : '#5a4a3c';
  c.fillStyle = gm;
  if (T <= 1) c.fillRect(L(-5), 0, L(10), L(2.2));
  else {
    c.beginPath();
    const wing = T >= 4 ? 8 : T >= 3 ? 7 : 5.8, drop = T >= 3 ? 3.4 : 2.2;
    c.moveTo(L(-1.8), L(-0.4)); c.lineTo(L(-wing), L(-0.2 - (T >= 3 ? 1.6 : 0))); c.lineTo(L(-wing + 0.8), L(drop)); c.lineTo(L(-1.5), L(2.4));
    c.lineTo(L(1.5), L(2.4)); c.lineTo(L(wing - 0.8), L(drop)); c.lineTo(L(wing), L(-0.2 - (T >= 3 ? 1.6 : 0))); c.lineTo(L(1.8), L(-0.4));
    c.closePath(); c.fill();
    c.strokeStyle = T >= 3 ? '#6a3aa0' : '#16131a'; c.lineWidth = L(0.35); c.stroke();
  }
  if (T >= 2) {
    // void gem in the guard
    c.fillStyle = T >= 4 ? '#e6d0ff' : VK.violet; c.beginPath(); c.arc(0, L(1), L(1.05), 0, TAU); c.fill();
  }
  // grip and pommel
  c.fillStyle = T >= 2 ? '#1c161e' : '#3a2618'; c.fillRect(L(-1.1), L(-6), L(2.2), L(6));
  c.strokeStyle = T >= 2 ? '#3a2e48' : '#241408'; c.lineWidth = L(0.5);
  c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(L(-1.1), L(-5.5 + i * 1.4)); c.lineTo(L(1.1), L(-4.8 + i * 1.4)); } c.stroke();
  c.fillStyle = T >= 2 ? '#2a2632' : '#6a5a48';
  c.beginPath();
  if (T >= 3) { c.moveTo(0, L(-9.5)); c.lineTo(L(1.8), L(-6.8)); c.lineTo(0, L(-5.8)); c.lineTo(L(-1.8), L(-6.8)); c.closePath(); }
  else c.arc(0, L(-6.8), L(1.5), 0, TAU);
  c.fill();
  if (T >= 3) { c.fillStyle = VK.violet; c.beginPath(); c.arc(0, L(-7.1), L(0.6), 0, TAU); c.fill(); }
}

/**
 * The knight's great axe (local space as the sword: fist at the origin, +y up the haft to the head). A bearded
 * crescent blade with a smaller back blade, by tier: rusted and notched on a wooden haft → plain steel with iron bands
 * → blackened steel on a black haft, violet runes and a glowing edge, a spike on top → a hooked back beak and a
 * serrated beard → obsidian head split by a void fissure.
 */
export function voidAxe(c: C2D, tier: number, steel: string, k: number, t: number): void {
  const T = clampT(tier);
  const L = (n: number) => n * k;
  const len = L(31), hx = len - L(6);
  // haft (with a butt cap below the fist)
  const haft = T >= 2 ? '#1c1720' : T === 1 ? '#4a3222' : '#5a3a20';
  c.fillStyle = haft; c.fillRect(L(-1.15), L(-7), L(2.3), len + L(7));
  c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(L(-0.9), L(-6.5), L(0.5), len + L(5));
  c.fillStyle = T >= 1 ? '#3a3844' : '#2a1a10';
  for (const yy of [-1.5, 6, 13, 19]) c.fillRect(L(-1.35), L(yy), L(2.7), L(1.1));
  c.fillStyle = T >= 2 ? '#2a2632' : '#5a4a3c';
  c.beginPath();
  if (T >= 2) { c.moveTo(L(-1.4), L(-7)); c.lineTo(L(1.4), L(-7)); c.lineTo(0, L(-10.5)); c.closePath(); } else c.arc(0, L(-7.2), L(1.5), 0, TAU);
  c.fill();
  if (T >= 2) {
    // a violet rune line along the black haft
    const pulse = 0.7 + 0.3 * Math.sin(t * 3 + tier);
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(${VK.vRGB},${(T >= 4 ? 0.8 : 0.45) * pulse})`; c.lineWidth = L(0.45);
    c.beginPath(); c.moveTo(0, L(8)); c.lineTo(0, L(12)); c.moveTo(0, L(14.5)); c.lineTo(0, L(18)); c.stroke();
    c.restore();
  }
  // top spike
  if (T >= 2) { c.fillStyle = shade(steel, 0.15); c.beginPath(); c.moveTo(L(-1.3), len - L(0.5)); c.lineTo(0, len + L(T >= 4 ? 7 : 5)); c.lineTo(L(1.3), len - L(0.5)); c.closePath(); c.fill(); }
  // main blade: a bearded crescent; its cutting edge is the outer arc
  const front = () => {
    c.beginPath(); c.moveTo(L(1), hx - L(5));
    c.quadraticCurveTo(L(8), hx - L(6.5), L(13.5), hx - L(10.5));
    c.quadraticCurveTo(L(18), hx - L(2), L(13), hx + L(6.5));
    if (T >= 3) for (let i = 0; i < 3; i++) { const u = (i + 1) / 4; c.lineTo(L(13 - 11 * u), hx + L(6.5 - 3 * u) + L(i % 2 ? 0 : 1.2)); }
    c.quadraticCurveTo(L(7), hx + L(1.5), L(1), hx + L(3));
    c.closePath();
  };
  const back = () => {
    c.beginPath(); c.moveTo(L(-1), hx - L(4));
    if (T >= 3) { c.quadraticCurveTo(L(-6), hx - L(4), L(-11), hx + L(2.5)); c.quadraticCurveTo(L(-6), hx + L(0.5), L(-1), hx + L(2.5)); }
    else { c.quadraticCurveTo(L(-6), hx - L(5), L(-9.5), hx - L(6.5)); c.quadraticCurveTo(L(-11.5), hx, L(-9), hx + L(4)); c.quadraticCurveTo(L(-5), hx + L(1.5), L(-1), hx + L(3)); }
    c.closePath();
  };
  const mg = c.createLinearGradient(L(-10), 0, L(16), 0);
  mg.addColorStop(0, shade(steel, -0.35)); mg.addColorStop(0.35, shade(steel, 0.1)); mg.addColorStop(0.75, shade(steel, 0.4)); mg.addColorStop(1, shade(steel, -0.2));
  c.fillStyle = mg; back(); c.fill(); front(); c.fill();
  c.strokeStyle = shade(steel, -0.7); c.lineWidth = L(0.35); back(); c.stroke(); front(); c.stroke();
  // honed edge: a bright bevel along the crescent
  c.strokeStyle = shade(steel, 0.75); c.lineWidth = L(0.7);
  c.beginPath(); c.moveTo(L(13.5), hx - L(10.5)); c.quadraticCurveTo(L(18), hx - L(2), L(13), hx + L(6.5)); c.stroke();
  if (T === 0) {
    // rust and notches
    c.fillStyle = 'rgba(120,60,24,0.55)';
    for (const [xx, yy, rr] of [[6, -2, 1.4], [10, 2, 1], [-6, -1, 1.1]] as [number, number, number][]) { c.beginPath(); c.ellipse(L(xx), hx + L(yy), L(rr * 1.3), L(rr), 0.4, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(20,14,12,0.9)';
    for (const yy of [-5, 1]) { c.beginPath(); c.moveTo(L(16), hx + L(yy)); c.lineTo(L(14.4), hx + L(yy + 0.8)); c.lineTo(L(15.8), hx + L(yy + 1.6)); c.fill(); }
  }
  // socket collar where the head grips the haft (a void gem from tier 3)
  c.fillStyle = T >= 2 ? '#2a2632' : '#3a3844'; c.fillRect(L(-1.8), hx - L(5.5), L(3.6), L(9));
  c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = L(0.3); c.strokeRect(L(-1.8), hx - L(5.5), L(3.6), L(9));
  if (T >= 3) { c.fillStyle = T >= 4 ? VK.violetHi : VK.violet; c.beginPath(); c.arc(0, hx - L(1), L(1), 0, TAU); c.fill(); }
  if (T >= 2) {
    const pulse = 0.7 + 0.3 * Math.sin(t * 3.4 + tier);
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    // runes etched in the blade
    c.strokeStyle = `rgba(${VK.vHiRGB},${(T >= 4 ? 0.75 : 0.5) * pulse})`; c.lineWidth = L(0.4);
    c.beginPath();
    c.moveTo(L(5), hx - L(3)); c.lineTo(L(7), hx - L(1)); c.lineTo(L(5.5), hx + L(1));
    c.moveTo(L(9), hx - L(4.5)); c.lineTo(L(9.5), hx + L(0.5)); c.moveTo(L(8.2), hx - L(2)); c.lineTo(L(10.6), hx - L(2.6));
    c.stroke();
    // the edge burning violet
    for (const [lw, a] of [[L(2.2), 0.3], [L(0.8), 0.85]] as [number, number][]) {
      c.strokeStyle = `rgba(${lw > L(1) ? VK.vRGB : VK.vHiRGB},${a * pulse})`; c.lineWidth = lw;
      c.beginPath(); c.moveTo(L(13.5), hx - L(10.5)); c.quadraticCurveTo(L(18), hx - L(2), L(13), hx + L(6.5)); c.stroke();
    }
    if (T >= 4) {
      // void fissure through the obsidian head
      c.lineJoin = 'round';
      for (const [lw, col] of [[L(1.8), `rgba(${VK.vRGB},${0.4 * pulse})`], [L(0.55), `rgba(${VK.vHiRGB},${0.95 * pulse})`]] as [number, string][]) {
        c.strokeStyle = col; c.lineWidth = lw;
        c.beginPath(); c.moveTo(L(2), hx - L(0.5)); c.lineTo(L(5.5), hx - L(2.5)); c.lineTo(L(8), hx - L(1.2)); c.lineTo(L(11.5), hx - L(4)); c.lineTo(L(14.5), hx - L(3)); c.stroke();
      }
    }
    c.restore();
  }
}

WEAPON_ART.vk_sword = { style: 'slash', heavy: true, draw(c, tier, steel, _edge, L) { voidSword(c, tier, steel, L(1), NOW); } };
WEAPON_ART.vk_axe = { style: 'slash', heavy: true, draw(c, tier, steel, _edge, L) { voidAxe(c, tier, steel, L(1), NOW); } };
