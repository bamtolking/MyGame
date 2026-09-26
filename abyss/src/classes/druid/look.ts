// druid: hero look — a weathered woodland druid with long hair and a braided beard, an antler headdress that
// grows with the helm tier (vine circlet → antlers → stag-skull crown → leaf-grown grove crown), leather/hide/bark
// armour and a wolf-pelt cloak by chest tier, a hide kilt, a belt with the carved totem (offhand) hanging at
// the hip, and druidic ornaments on the staff head. Also remaps the rig pose per skill (the engine has no
// per-skill pose hook) and adds a small cast flourish at the staff for each skill.
import { BASE_BY_ID } from '../../data/items';
import type { Hero } from '../../sim/types';
import type { Look, Pose } from '../../render/actors';
import { shade } from '../../render/iso';
import { CLASS_LOOK, DECOR, ITEM_KIND, OFFHAND_ART, type RigAnchors } from '../../render/registry';
import { DR } from './shared';

const TAU = Math.PI * 2;
const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
type C2D = CanvasRenderingContext2D;

/** Druid-specific state carried on the Look (the rig ignores unknown fields). */
interface DrState {
  /** Active skill ('' when idle, without the dr_ prefix) and its progress 0..1. */
  act: string; k: number;
  /** Chest, helm, glove, staff and totem tiers (-1 = none). */
  ct: number; ht: number; gt: number; wt: number; tt: number;
  /** Staff gem colour (rarity tinted) and whether the renewal buff is up. */
  gem: string; renew: boolean;
}
type DrLook = Look & { dr?: DrState };

// ------------------------------------------------------------------ palette (index = tier + 1)
/** Tunic / armour body: rough leather → jerkin → scaled hide → bark plates → storm hide → grove warden. */
const TUNIC = ['#7a5a3a', '#6c4d30', '#5f5a38', '#6a5234', '#434e40', '#2f4c30'];
const LEGS = ['#4a3a28', '#4a3826', '#433c2a', '#3e3424', '#343a32', '#263626'];
const BOOTS = ['#3a2a1a', '#4a3422', '#4a3a28', '#3e3020', '#4a4a44', '#5a5a50'];
/** Fur for mantle / cloak: brown wolf → grey wolf → white wolf. */
const FUR = ['#7a6248', '#7a6248', '#6e5a44', '#5e4a36', '#8e8a82', '#dcd8cc'];
const LINING = ['#3a5a2a', '#3a5a2a', '#3e5a2c', '#34502a', '#2e3e3a', '#2a5a34'];
/** Hide kilt strips. */
const KILT = ['#6a4a2e', '#6a4a2e', '#5e5234', '#6e5232', '#55584a', '#40603e'];
/** Staff gem by staff tier (oak, rune, –, arch, abyss). */
const GEM = ['#8ee060', '#5ee0b0', '#8ee060', '#b8ff70', '#a8d8ff'];
/** Cast glow at the staff head, by skill. */
const CAST: Record<string, string> = { thorn: '#a8ff70', tornado: '#d0ecd0', vines: '#8cff4a', wolves: '#78ebd7', renewal: '#b0ff90', storm: '#c8dcff' };

function tierOf(h: Hero, slot: 'gloves' | 'head' | 'offhand' | 'chest'): number {
  const it = h.equip[slot];
  return it && it.req <= h.level ? BASE_BY_ID[it.base]?.tier ?? -1 : -1;
}

ITEM_KIND.totem = 'totem';

CLASS_LOOK.druid = (h, common, ct) => {
  const a = h.act;
  const act = a ? a.skill.replace(/^dr_/, '') : '';
  const k = a ? Math.min(1, a.t / Math.max(1e-3, a.dur)) : 0;
  const i = clamp(ct, -1, 4) + 1;
  const tunic = TUNIC[i];
  const wt = common.weapon === 'staff' ? common.wTier ?? 0 : -1;
  const tt = common.offhand === 'totem' ? common.offTier ?? 0 : -1;
  const wIt = h.equip.weapon;
  const gem = wIt?.rarity === 'unique' ? '#ffd870' : GEM[clamp(wt, 0, 4)];
  // lean: head up for the sky spells, into the slam for the vines, forward as the wolves are sent
  let hunch = 0;
  if (act === 'renewal') hunch = -0.1 * ease(k * 3);
  else if (act === 'storm') hunch = -0.13 * ease(k * 2.5);
  else if (act === 'vines') hunch = k < 0.5 ? -0.07 * ease(k * 2) : 0.3 * (1 - ease((k - 0.5) * 1.6) * 0.6);
  else if (act === 'wolves') hunch = k < 0.45 ? -0.05 : 0.2 * (1 - ease((k - 0.45) * 1.6) * 0.5);
  else if (act === 'tornado') hunch = 0.13 * Math.sin(clamp(k, 0, 1) * Math.PI);
  else if (act === 'thorn') hunch = 0.06 * Math.sin(clamp(k, 0, 1) * Math.PI);
  const dr: DrState = { act, k, ct, ht: common.helm ?? -1, gt: tierOf(h, 'gloves'), wt, tt, gem, renew: h.buffs.some((b) => b.id === 'dr_renewal') };
  const L: DrLook = {
    skin: '#d2a07a', hair: '#4a2e1c', eyes: '#3f8a34',
    body: tunic, body2: ct >= 2 ? shade(tunic, -0.15) : '#c99672',
    legs: LEGS[i], head: 'human', build: 1.03, height: 1.02, hunch,
    ...common,
    boots: BOOTS[i],
    helm: -1, offhand: null, armorTier: -1, trim: undefined,
    wGlow: (act && CAST[act]) || common.wGlow || gem,
    glow: ct >= 4 ? 'rgba(120,255,120,0.55)' : undefined,
    decor: 'dr_druid',
    dr,
  };
  return L;
};

// ------------------------------------------------------------------ small drawing helpers
/** A leaf: two curves from the stem to the tip, with a midrib. */
export function leaf(c: C2D, x: number, y: number, len: number, ang: number, col: string, rib = true): void {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, w = len * 0.36;
  const tx = x + ux * len, ty = y + uy * len;
  c.fillStyle = col;
  c.beginPath(); c.moveTo(x, y);
  c.quadraticCurveTo(x + ux * len * 0.5 + nx * w, y + uy * len * 0.5 + ny * w, tx, ty);
  c.quadraticCurveTo(x + ux * len * 0.5 - nx * w, y + uy * len * 0.5 - ny * w, x, y);
  c.fill();
  if (rib && len > 2.5) { c.strokeStyle = shade(col.startsWith('#') ? col : '#6ab040', -0.35); c.lineWidth = Math.max(0.25, len * 0.07); c.beginPath(); c.moveTo(x, y); c.lineTo(x + ux * len * 0.8, y + uy * len * 0.8); c.stroke(); }
}

/** A tapered curve (thick at the start): drawn as a few strokes of shrinking width. */
function taper(c: C2D, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w0: number, w1: number, col: string): void {
  const n = 4;
  c.strokeStyle = col; c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const p = (t: number): [number, number] => [(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1];
    const [ax, ay] = p(t0), [bx, by] = p(t1), [mx, my] = p((t0 + t1) / 2);
    c.lineWidth = w0 + (w1 - w0) * ((t0 + t1) / 2);
    c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(2 * mx - (ax + bx) / 2, 2 * my - (ay + by) / 2, bx, by); c.stroke();
  }
}

/**
 * An antler seen from the side: the main beam sweeps up and back from (x,y), tines point forward/up.
 * `s` scales it, `n` tines (1..5), `col` bone colour.
 */
function antler(c: C2D, x: number, y: number, s: number, n: number, col: string, dark: string): void {
  const bx = x - 6 * s, by = y - 13 * s;          // beam tip
  const cx = x + 1.5 * s, cy = y - 9 * s;          // beam curve control
  const at = (t: number): [number, number] => [(1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * bx, (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * by];
  const w = 1.5 * s;
  // outline pass then bone pass
  for (const [col2, extra] of [[dark, 0.7], [col, 0]] as [string, number][]) {
    taper(c, x, y, cx, cy, bx, by, w + extra, w * 0.35 + extra, col2);
    for (let i = 0; i < n; i++) {
      const t = 0.3 + (i / Math.max(1, n)) * 0.62;
      const [px, py] = at(t);
      const len = (4.2 - i * 0.35) * s, ang = -1.25 + i * 0.28 - (i === n - 1 ? 0.2 : 0);
      const ex = px + Math.cos(ang) * len * 0.35 + len * 0.35, ey = py + Math.sin(ang) * len;
      taper(c, px, py, px + len * 0.45, py - len * 0.25, ex, ey, w * 0.8 + extra, w * 0.25 + extra, col2);
    }
    // brow tine pointing forward over the face
    taper(c, x + 0.3 * s, y - 1.4 * s, x + 3 * s, y - 2.2 * s, x + 4.6 * s, y - 4.2 * s, w * 0.8 + extra, w * 0.25 + extra, col2);
  }
  // highlight along the beam
  c.strokeStyle = 'rgba(255,255,240,0.35)'; c.lineWidth = w * 0.3;
  c.beginPath(); c.moveTo(x + 0.2 * s, y - 1 * s); c.quadraticCurveTo(cx - 0.3 * s, cy, bx + 0.6 * s, by + 1 * s); c.stroke();
}

/** Ragged fur edge along a polyline (tufts pointing along `down`). */
function furEdge(c: C2D, pts: number[], len: number, col: string, t: number, seed = 0): void {
  c.fillStyle = col;
  c.beginPath();
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3];
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const l = len * (0.7 + 0.3 * Math.sin(seed + i * 1.7)) , wob = Math.sin(t * 3 + i + seed) * 0.6;
    c.moveTo(x0, y0); c.lineTo(mx + wob, my + l); c.lineTo(x1, y1);
  }
  c.fill();
}

// ------------------------------------------------------------------ totem (offhand)
/**
 * The carved totem, hanging from its cord at (x,y) (the top of the cord). `s` scales it; tier: 0 wood, 2 beast,
 * 4 storm (odd tiers blend). `sway` rotates it. Also used, larger, for the inventory icon.
 */
export function drawTotem(c: C2D, x: number, y: number, s: number, tier: number, t: number, sway = 0, icon = false): void {
  c.save();
  c.translate(x, y); c.rotate(sway); c.scale(s, s);
  const beast = tier >= 2, storm = tier >= 4;
  const wood = storm ? '#3a2e2a' : beast ? '#6a4a2c' : '#a07848';
  const woodDk = shade(wood, -0.45), woodHi = shade(wood, 0.35);
  // cord
  c.strokeStyle = '#c8b088'; c.lineWidth = 0.6;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 2.2); c.stroke();
  // body: a carved post with two stacked faces
  const top = 2, bot = 13;
  const g = c.createLinearGradient(-2.4, 0, 2.4, 0);
  g.addColorStop(0, woodHi); g.addColorStop(0.5, wood); g.addColorStop(1, woodDk);
  c.fillStyle = g;
  c.beginPath(); c.moveTo(-2.1, top + 1); c.lineTo(2.1, top + 1); c.lineTo(2.3, bot - 1.5); c.lineTo(0, bot + 1); c.lineTo(-2.3, bot - 1.5); c.closePath(); c.fill();
  c.strokeStyle = woodDk; c.lineWidth = 0.35; c.stroke();
  // carved grooves and faces
  c.fillStyle = woodDk;
  c.fillRect(-2.1, 6.4, 4.2, 0.45); c.fillRect(-2.2, 10.2, 4.4, 0.4);
  const eye = storm ? '#9ad8ff' : beast ? '#ffb030' : '#1a120a';
  for (const [ey, r] of [[4.6, 0.55], [8.4, 0.5]] as [number, number][]) {
    if (storm || beast) { c.save(); c.shadowColor = eye; c.shadowBlur = icon ? 4 : 2; }
    c.fillStyle = eye; c.beginPath(); c.arc(-0.9, ey, r, 0, TAU); c.arc(0.9, ey, r, 0, TAU); c.fill();
    if (storm || beast) c.restore();
    c.fillStyle = woodDk; c.fillRect(-0.8, ey + 1.1, 1.6, 0.4);
  }
  // head piece
  if (beast && !storm) {
    // wolf head with ears and a fang row
    c.fillStyle = shade(wood, -0.1);
    c.beginPath(); c.moveTo(-2.6, top + 1.4); c.lineTo(-2.2, top - 2.6); c.lineTo(-1, top - 0.6); c.lineTo(1, top - 0.6); c.lineTo(2.2, top - 2.6); c.lineTo(2.6, top + 1.4); c.closePath(); c.fill();
    c.fillStyle = '#efe6cc'; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 1.1 - 0.4, top + 1.2); c.lineTo(i * 1.1, top + 2.3); c.lineTo(i * 1.1 + 0.4, top + 1.2); c.fill(); }
  } else if (storm) {
    // storm crystal crowning the post
    c.save(); c.shadowColor = '#a8d8ff'; c.shadowBlur = icon ? 6 : 3;
    const cg = c.createLinearGradient(0, top - 5, 0, top + 1);
    cg.addColorStop(0, '#ffffff'); cg.addColorStop(0.5, '#a8d8ff'); cg.addColorStop(1, '#3a6aa8');
    c.fillStyle = cg; c.beginPath(); c.moveTo(0, top - 5.2); c.lineTo(1.7, top - 1.6); c.lineTo(0.9, top + 1.2); c.lineTo(-0.9, top + 1.2); c.lineTo(-1.7, top - 1.6); c.closePath(); c.fill();
    c.restore();
    // lightning rune down the front
    c.strokeStyle = `rgba(170,220,255,${0.65 + 0.35 * Math.sin(t * 7)})`; c.lineWidth = 0.45;
    c.beginPath(); c.moveTo(0.4, 5.6); c.lineTo(-0.5, 7.6); c.lineTo(0.5, 7.9); c.lineTo(-0.4, 9.9); c.stroke();
  } else {
    // a knot of twine and a small carved cap
    c.fillStyle = woodHi; c.beginPath(); c.ellipse(0, top + 0.9, 2.3, 0.9, 0, 0, TAU); c.fill();
  }
  // feathers and beads hanging from the side
  const fcol = storm ? '#9aa4b0' : beast ? '#e8e0c8' : '#b04a30';
  c.strokeStyle = '#c8b088'; c.lineWidth = 0.35;
  c.beginPath(); c.moveTo(2.2, 3.6); c.quadraticCurveTo(3.6, 6, 3.2, 8.6); c.stroke();
  c.fillStyle = beast ? '#e8e0cc' : '#6a9a3a'; c.beginPath(); c.arc(3.3, 6.2, 0.55, 0, TAU); c.fill();
  c.save(); c.translate(3.2, 8.6); c.rotate(0.25 + Math.sin(t * 2.3) * 0.12);
  c.fillStyle = fcol; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(1.1, 2.4, 0, 5); c.quadraticCurveTo(-1.1, 2.4, 0, 0); c.fill();
  c.strokeStyle = shade(fcol, -0.4); c.lineWidth = 0.25; c.beginPath(); c.moveTo(0, 0.2); c.lineTo(0, 4.6); c.stroke();
  c.restore();
  if (beast) {
    // fur tuft under the head
    c.fillStyle = storm ? '#6a6a70' : '#8a7458';
    c.beginPath(); c.moveTo(-2.4, top + 2.2); c.lineTo(-3.2, top + 4.6); c.lineTo(-2.1, top + 3.8); c.lineTo(-2.4, top + 5.6); c.lineTo(-1.6, top + 3.4); c.closePath(); c.fill();
  }
  c.restore();
}

OFFHAND_ART.totem = {
  // held in the back hand (the druid's own look hangs it at the belt instead; this is the generic fallback)
  draw(c, x, y, tier, p) { drawTotem(c, x + 1, y - 2, 0.9, tier, p.t, Math.sin(p.t * 2) * 0.08); },
  icon(c, tier, gem) {
    c.save();
    // soft backing glow in the rarity colour
    const g = c.createRadialGradient(0, 0, 2, 0, 0, 27);
    g.addColorStop(0, gem === '#909090' ? 'rgba(140,200,110,0.28)' : gem + '66'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 27, 0, TAU); c.fill();
    // tilted across the slot so it fills it
    c.rotate(0.42);
    drawTotem(c, -1, -27, 4.1, tier, 0.4, 0, true);
    c.restore();
  },
};

// ------------------------------------------------------------------ pose remap
/** Rewrites the rig pose per skill (called from the decor's back layer, before the arms are drawn). */
function remapPose(p: Pose, s: DrState): void {
  const k = s.k;
  switch (s.act) {
    case 'thorn': p.cast = -1; p.atk = k; break;                                         // a one-handed flick of the staff
    case 'tornado':                                                                     // staff swings round, palm shoves the wind
      p.cast = -1; p.atk = k < 0.5 ? k * 0.9 : 0.45 + (k - 0.5) * 1.1;
      if (k > 0.3 && k < 0.88) p.block = 1;
      break;
    case 'vines':                                                                       // raise both hands … slam the staff down
      if (k < 0.5) p.cast = k * 1.2; else { p.cast = -1; p.atk = 0.9 + (k - 0.5) * 0.18; }
      break;
    case 'wolves':                                                                      // call them up … send them forth
      if (k < 0.45) p.cast = k * 1.1; else { p.cast = -1; p.atk = 0.42; p.block = 1; }
      break;
    case 'renewal': p.cast = Math.min(0.5, k * 1.4); break;                            // both arms raised to the sky, held
    case 'storm': p.cast = Math.min(0.5, k * 1.1); break;                              // staff thrust to the sky
  }
}

// ------------------------------------------------------------------ decor
DECOR.dr_druid = (c, L0, p, a, layer) => {
  const L = L0 as DrLook;
  const s = L.dr;
  if (!s) return;
  if (layer === 'back') {
    remapPose(p, s);
    drawBack(c, L, p, a, s);
  } else drawFront(c, L, p, a, s);
};

function walkSway(p: Pose): number { return p.moving ? Math.sin(p.walk * 4.2) : 0; }

function drawBack(c: C2D, L: DrLook, p: Pose, a: RigAnchors, s: DrState): void {
  const { hx, hy, headR: r, shX, shY, hipY } = a;
  const sw = walkSway(p), mv = p.moving ? 1 : 0;
  const i = clamp(s.ct, -1, 4) + 1;
  // ---- wolf-pelt cloak (chain and up), longer and paler with tier
  if (s.ct >= 1) {
    const fur = FUR[i], len = s.ct >= 3 ? 15 : 9;
    const flare = mv * (3.5 + Math.abs(sw) * 2) + Math.sin(p.t * 1.6) * 0.7;
    const top = shY - 0.5, bot = hipY + len;
    const g = c.createLinearGradient(-10, top, -4, bot);
    g.addColorStop(0, shade(fur, 0.05)); g.addColorStop(1, shade(fur, -0.4));
    c.fillStyle = g;
    c.beginPath(); c.moveTo(shX + 4, top);
    c.quadraticCurveTo(shX - 10, top + 1, -10.5 - flare * 0.5, hipY - 1);
    c.lineTo(-12 - flare, bot);
    c.lineTo(2 - flare * 0.3, bot - 1);
    c.lineTo(4, hipY); c.closePath(); c.fill();
    // lining along the trailing edge
    c.strokeStyle = LINING[i]; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(shX - 8, top + 3); c.quadraticCurveTo(-10.5 - flare * 0.5, hipY - 2, -11.6 - flare, bot - 0.6); c.stroke();
    const e: number[] = [];
    for (let k = 0; k <= 7; k++) { const t = k / 7; e.push(-12 - flare + t * (14 + flare * 0.7), bot - t * 1 + Math.sin(k * 2.1) * 0.5); }
    furEdge(c, e, 2.8, shade(fur, -0.3), p.t, 1);
    // fur texture strokes
    c.strokeStyle = shade(fur, 0.25); c.lineWidth = 0.4;
    c.beginPath(); for (let k = 0; k < 5; k++) { const x = shX - 8 - k * 0.7 - flare * 0.2 * k / 5, y = top + 4 + k * 3.5; c.moveTo(x, y); c.lineTo(x - 1.2, y + 2.6); } c.stroke();
  } else if (s.ct === 0) {
    // a short hide half-cape
    const flare = mv * 2.5;
    c.fillStyle = shade(FUR[i], -0.35);
    c.beginPath(); c.moveTo(shX + 2, shY + 0.5); c.quadraticCurveTo(shX - 9, shY + 3, -8 - flare, hipY - 4); c.lineTo(-1, hipY - 6); c.closePath(); c.fill();
  }
  // ---- long hair down the back, swaying
  const hs = Math.sin(p.t * 1.8) * 0.8 + mv * (1.5 + sw * 0.8);
  const hairG = c.createLinearGradient(hx - r, hy, hx - r * 2, shY + 14);
  hairG.addColorStop(0, L.hair ?? '#4a2e1c'); hairG.addColorStop(1, shade(L.hair ?? '#4a2e1c', -0.35));
  c.fillStyle = hairG;
  c.beginPath();
  c.moveTo(hx - r * 0.2, hy - r * 0.95);
  c.quadraticCurveTo(hx - r * 1.5, hy - r * 0.7, hx - r * 1.35 - hs * 0.3, hy + r * 1.2);
  c.quadraticCurveTo(hx - r * 1.9 - hs, shY + 7, hx - r * 1.55 - hs * 1.4, shY + 13);
  c.lineTo(hx - r * 1.0 - hs * 1.1, shY + 10.5);
  c.lineTo(hx - r * 0.75 - hs * 1.2, shY + 12.5);
  c.quadraticCurveTo(hx - r * 0.6, shY + 4, hx - r * 0.1, hy + r * 0.6);
  c.closePath(); c.fill();
  // ---- far antler (behind the head)
  if (s.ht >= 0) {
    const sc = [0.62, 0.78, 0.9, 1.02, 1.12][clamp(s.ht, 0, 4)];
    antler(c, hx - r * 0.55, hy - r * 0.75, sc * 0.92, clamp(s.ht + 1, 2, 5), shade(DR.bone, -0.28), '#3a2e22');
  }
}

/** The rig's front-arm elbow from shoulder and hand (the rig bends the forearm by 0.3 rad). */
function elbow(sx: number, sy: number, hx: number, hy: number, l1: number, l2: number, bend: number): [number, number] {
  const beta = Math.atan2(l2 * Math.sin(bend), l1 + l2 * Math.cos(bend));
  const ang = Math.atan2(hx - sx, hy - sy) - beta;
  return [sx + Math.sin(ang) * l1, sy + Math.cos(ang) * l1];
}

function drawFront(c: C2D, L: DrLook, p: Pose, a: RigAnchors, s: DrState): void {
  const { hx, hy, headR: r, shX, shY, hipY } = a;
  const sw = walkSway(p), mv = p.moving ? 1 : 0;
  const i = clamp(s.ct, -1, 4) + 1;
  const tunic = TUNIC[i];
  const t = p.t;
  // ---- hide kilt: leather strips from the belt to mid-thigh, flaring with the stride
  {
    const kb = hipY + 1, kl = 9.5, fl = mv * sw * 1.6;
    const strips = 5;
    for (let k = 0; k < strips; k++) {
      const u = k / (strips - 1);
      const x0 = -6.4 + u * 12.8, x1 = -7.6 + u * 15.2 + fl * (u - 0.3) + (k % 2 ? 0.4 : -0.3);
      const col = shade(KILT[i], k % 2 ? -0.2 : 0);
      c.fillStyle = col;
      c.beginPath(); c.moveTo(x0 - 1.6, kb); c.lineTo(x0 + 1.6, kb); c.lineTo(x1 + 1.5, kb + kl - (k % 2) * 1.2); c.lineTo(x1, kb + kl + 0.8 - (k % 2) * 1.2); c.lineTo(x1 - 1.5, kb + kl - (k % 2) * 1.2); c.closePath(); c.fill();
    }
    // fur trim along the kilt hem (hide armour and up)
    if (s.ct >= 1) {
      const e: number[] = [];
      for (let k = 0; k <= 7; k++) { const u = k / 7; e.push(-8 + u * 16 + fl * (u - 0.3), kb + kl - 1.6 + Math.sin(k * 1.9) * 0.3); }
      furEdge(c, e, 1.8, FUR[i], t, 3);
    }
  }
  // ---- belt with a bone buckle, a pouch and the totem
  {
    const by = hipY - 1.8;
    const bg = c.createLinearGradient(0, by, 0, by + 4.2);
    bg.addColorStop(0, '#6a4a2a'); bg.addColorStop(1, '#3a2614');
    c.fillStyle = bg; c.fillRect(-6.8, by, 13.6, 4.2);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-6.8, by + 3.4, 13.6, 0.8);
    // bone / antler buckle
    c.fillStyle = s.ct >= 3 ? '#d8c890' : DR.bone; c.beginPath(); c.ellipse(1.6, by + 2.1, 1.6, 1.9, 0, 0, TAU); c.fill();
    c.fillStyle = '#3a2614'; c.beginPath(); c.ellipse(1.6, by + 2.1, 0.7, 0.95, 0, 0, TAU); c.fill();
    // pouch on the front hip
    c.fillStyle = '#5a3e22'; c.beginPath(); c.moveTo(4, by + 3); c.lineTo(7.2, by + 3); c.lineTo(7, by + 7.4); c.quadraticCurveTo(5.6, by + 8.4, 4.2, by + 7.4); c.closePath(); c.fill();
    c.fillStyle = '#7a5632'; c.fillRect(4, by + 3, 3.2, 1.3);
    // the totem hangs from the belt at the side
    if (s.tt >= 0) {
      const swing = Math.sin(t * 2.1) * 0.06 + mv * Math.sin(p.walk * 4.2 + 0.8) * 0.22;
      drawTotem(c, -3.6, by + 2.4, 0.95, s.tt, t, swing);
    }
  }
  // ---- chest: laces / scales / bark plates / storm hide / moss runes (kept left of the weapon arm)
  {
    const top = shY + 3, bot = hipY - 2;
    if (s.ct <= 0) {
      // lacing down the front of the tunic
      c.strokeStyle = '#c8aa78'; c.lineWidth = 0.5;
      c.beginPath();
      for (let y = top + 1.5; y < bot - 1; y += 2.4) { c.moveTo(-1.6, y); c.lineTo(0.6, y + 1.2); c.moveTo(0.6, y); c.lineTo(-1.6, y + 1.2); }
      c.stroke();
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(-0.7, top, 0.6, bot - top);
    } else if (s.ct === 1) {
      // sewn hide scales
      c.fillStyle = 'rgba(0,0,0,0.22)';
      for (let y = top + 1; y < bot; y += 2.6) for (let x = -5 + ((y / 2.6) % 2) * 1.2; x < 1.5; x += 2.4) { c.beginPath(); c.arc(x, y, 1.2, 0, Math.PI); c.fill(); }
    } else if (s.ct === 2) {
      // overlapping bark plates
      for (let k = 0; k < 3; k++) {
        const y = top + 1 + k * 4.2;
        const bg = c.createLinearGradient(-5, y, 1.5, y + 3.6);
        bg.addColorStop(0, '#8a6a44'); bg.addColorStop(1, '#4a3420');
        c.fillStyle = bg; c.beginPath(); c.moveTo(-5.4 + k * 0.4, y); c.lineTo(1.6, y - 0.4); c.lineTo(1.8, y + 3.4); c.lineTo(-5.2 + k * 0.4, y + 3.8); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(30,18,8,0.55)'; c.lineWidth = 0.35; c.beginPath(); c.moveTo(-4 + k, y + 0.8); c.lineTo(-3.6 + k, y + 3); c.moveTo(-1 + k * 0.5, y + 0.5); c.lineTo(-0.8 + k * 0.5, y + 2.8); c.stroke();
        c.fillStyle = 'rgba(100,150,60,0.55)'; c.beginPath(); c.ellipse(-4.4 + k * 1.3, y + 3.3, 1.2, 0.5, 0, 0, TAU); c.fill(); // moss
      }
    } else {
      // storm hide / grove warden: a leather cuirass with a crossing strap and bronze or glowing studs
      c.strokeStyle = s.ct >= 4 ? 'rgba(20,40,20,0.6)' : 'rgba(20,20,20,0.45)'; c.lineWidth = 0.5;
      c.beginPath(); c.moveTo(-5.5, top + 5); c.quadraticCurveTo(-2, top + 7.5, 1.5, top + 5.5); c.stroke();
      const stud = s.ct >= 4 ? `rgba(150,255,130,${0.7 + 0.3 * Math.sin(t * 3)})` : '#b89a5a';
      c.fillStyle = stud;
      for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(-4.5 + k * 1.8, top + 9.5 + (k % 2) * 0.6, 0.55, 0, TAU); c.fill(); }
      if (s.ct >= 4) {
        // a glowing spiral rune over the heart
        c.save(); c.globalCompositeOperation = 'lighter';
        c.strokeStyle = `rgba(140,255,120,${0.55 + 0.35 * Math.sin(t * 2.4)})`; c.lineWidth = 0.6;
        c.beginPath(); for (let q = 0; q < 16; q++) { const an = q * 0.7, rr = 0.3 + q * 0.16; const x = -2 + Math.cos(an) * rr, y = top + 3.5 + Math.sin(an) * rr; if (q) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke();
        c.restore();
      }
    }
    // shoulder strap with a tooth necklace (all tiers)
    c.strokeStyle = '#4a3018'; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(shX - 5.5, shY + 2.5); c.quadraticCurveTo(-2.5, shY + 9, 1.8, hipY - 1.5); c.stroke();
    c.strokeStyle = '#c8b088'; c.lineWidth = 0.35;
    c.beginPath(); c.moveTo(shX - 3.5, shY + 1.8); c.quadraticCurveTo(shX - 1, shY + 6.5, shX + 3, shY + 2.6); c.stroke();
    c.fillStyle = DR.bone;
    for (let k = 0; k < 4; k++) { const u = (k + 0.5) / 4; const x = shX - 3.5 + u * 6.5, y = shY + 2 + Math.sin(u * Math.PI) * 3.6; c.beginPath(); c.moveTo(x - 0.45, y); c.lineTo(x, y + 1.5); c.lineTo(x + 0.45, y); c.fill(); }
  }
  // ---- fur mantle over the shoulders (leather and up), bark / bone pauldron on the near shoulder at higher tiers
  if (s.ct >= 0) {
    const fur = FUR[i];
    const g = c.createLinearGradient(0, shY - 2, 0, shY + 6);
    g.addColorStop(0, shade(fur, 0.2)); g.addColorStop(1, shade(fur, -0.2));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(shX - 8, shY + 4);
    c.quadraticCurveTo(shX - 7.5, shY - 1.8, shX - 2, shY - 1.2);
    c.quadraticCurveTo(shX + 3, shY - 0.4, shX + 7.8, shY + 2.4);
    c.lineTo(shX + 7.5, shY + 4.5); c.lineTo(shX - 8, shY + 5.5); c.closePath(); c.fill();
    const e: number[] = [];
    for (let k = 0; k <= 8; k++) { const u = k / 8; e.push(shX - 8.2 + u * 15.8, shY + 5 - u * 0.8 + Math.sin(k * 2.3) * 0.3); }
    furEdge(c, e, 2.2 + s.ct * 0.2, shade(fur, -0.05), t, 7);
    // fur strands
    c.strokeStyle = shade(fur, 0.35); c.lineWidth = 0.35;
    c.beginPath(); for (let k = 0; k < 7; k++) { const x = shX - 6.5 + k * 2.1; c.moveTo(x, shY + 0.4); c.lineTo(x + 0.7, shY + 3.2); } c.stroke();
    if (s.ct >= 2) {
      const px = shX + 5.2, py = shY + 1.6;
      if (s.ct === 2) {
        // bark pauldron
        const pg = c.createRadialGradient(px - 1, py - 1.2, 0.3, px, py, 4.8);
        pg.addColorStop(0, '#9a7a50'); pg.addColorStop(1, '#4a3420');
        c.fillStyle = pg; c.beginPath(); c.ellipse(px, py + 0.6, 4.4, 3.2, -0.2, Math.PI * 0.95, TAU * 1.02); c.lineTo(px + 3.8, py + 2.8); c.lineTo(px - 4, py + 2.8); c.fill();
        c.strokeStyle = 'rgba(30,18,8,0.6)'; c.lineWidth = 0.35; c.beginPath(); c.moveTo(px - 2, py - 1.6); c.lineTo(px - 1.5, py + 2.2); c.moveTo(px + 1, py - 2); c.lineTo(px + 1.4, py + 2.2); c.stroke();
      } else {
        // horn / antler-spiked pauldron
        const base = s.ct >= 4 ? '#3e5a3a' : '#5a5448';
        const pg = c.createRadialGradient(px - 1, py - 1.2, 0.3, px, py, 5);
        pg.addColorStop(0, shade(base, 0.45)); pg.addColorStop(1, shade(base, -0.35));
        c.fillStyle = pg; c.beginPath(); c.ellipse(px, py + 0.6, 4.6, 3.3, -0.2, Math.PI * 0.95, TAU * 1.02); c.lineTo(px + 4, py + 2.9); c.lineTo(px - 4.2, py + 2.9); c.fill();
        taper(c, px - 1.5, py - 1.6, px - 3, py - 4.5, px - 5.8, py - 5.8, 1.2, 0.3, DR.boneDk);
        taper(c, px + 0.8, py - 2, px + 0.4, py - 5.2, px - 1.4, py - 7, 1.2, 0.3, DR.bone);
        if (s.ct >= 4) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(140,255,120,${0.5 + 0.3 * Math.sin(t * 3 + 1)})`; c.beginPath(); c.arc(px, py + 0.8, 0.9, 0, TAU); c.fill(); c.restore(); }
      }
    }
  }
  // ---- seen from behind: the long hair falls over the back instead of the beard showing
  if (p.back) {
    const hs = Math.sin(p.t * 1.8) * 0.8 + mv * (1.5 + sw * 0.8);
    c.fillStyle = shade(L.hair ?? '#4a2e1c', -0.05);
    c.beginPath();
    c.moveTo(hx - r * 1.0, hy - r * 0.2);
    c.quadraticCurveTo(hx - r * 1.2 - hs * 0.5, shY + 6, hx - r * 0.9 - hs, shY + 12);
    c.lineTo(hx + r * 0.2 - hs * 0.6, shY + 11);
    c.quadraticCurveTo(hx + r * 0.5, shY + 4, hx + r * 0.8, hy + r * 0.1);
    c.closePath(); c.fill();
    c.strokeStyle = shade(L.hair ?? '#4a2e1c', 0.25); c.lineWidth = 0.4;
    c.beginPath(); for (let k = 0; k < 4; k++) { const x = hx - r * 0.6 + k * r * 0.35; c.moveTo(x, hy + r * 0.5); c.quadraticCurveTo(x - 1, shY + 5, x - 0.6 - hs * 0.6, shY + 10); } c.stroke();
  }
  // ---- beard (braided at the tip) and a braid over the shoulder
  if (!p.back) {
    const bc = shade(L.hair ?? '#4a2e1c', -0.08);
    c.fillStyle = bc;
    c.beginPath();
    c.moveTo(hx + r * 0.05, hy + r * 0.3);
    c.quadraticCurveTo(hx + r * 0.35, hy + r * 1.7, hx + r * 0.62, hy + r * 2.25);
    c.quadraticCurveTo(hx + r * 1.0, hy + r * 1.3, hx + r * 1.05, hy + r * 0.55);
    c.quadraticCurveTo(hx + r * 0.7, hy + r * 0.85, hx + r * 0.05, hy + r * 0.3);
    c.fill();
    // moustache
    c.beginPath(); c.moveTo(hx + r * 0.55, hy + r * 0.52); c.quadraticCurveTo(hx + r * 1.1, hy + r * 0.45, hx + r * 1.12, hy + r * 0.85); c.quadraticCurveTo(hx + r * 0.85, hy + r * 0.62, hx + r * 0.5, hy + r * 0.7); c.fill();
    c.fillStyle = s.ct >= 3 ? '#d8c890' : '#8ab050'; c.beginPath(); c.arc(hx + r * 0.62, hy + r * 2.05, r * 0.16, 0, TAU); c.fill(); // bead
    // braid from behind the ear down over the collarbone
    c.strokeStyle = shade(L.hair ?? '#4a2e1c', 0.1); c.lineWidth = 1.1; c.lineCap = 'round';
    const bx0 = hx - r * 0.55, by0 = hy + r * 0.4, bx1 = shX - 3.2, by1 = shY + 8.5 + mv * sw * 0.4;
    c.beginPath(); c.moveTo(bx0, by0); c.quadraticCurveTo(bx0 - 0.8, (by0 + by1) / 2, bx1, by1); c.stroke();
    c.strokeStyle = shade(L.hair ?? '#4a2e1c', -0.35); c.lineWidth = 0.4;
    for (let k = 1; k < 5; k++) { const u = k / 5; const x = bx0 + (bx1 - bx0) * u - 0.4 * Math.sin(u * Math.PI), y = by0 + (by1 - by0) * u; c.beginPath(); c.moveTo(x - 0.6, y - 0.3); c.lineTo(x + 0.6, y + 0.3); c.stroke(); }
    c.fillStyle = '#6aa040'; c.beginPath(); c.arc(bx1, by1 + 0.5, 0.6, 0, TAU); c.fill();
  }
  // ---- headdress: vine circlet → antlers → stag skull → leaf-grown grove crown
  drawHeaddress(c, a, s, t, p.back);
  // ---- bracer on the front forearm (gloves)
  if (s.gt >= 0 || s.ct >= 1) {
    const armL = 17 * a.height;
    const fsx = shX + 2, fsy = shY + 2.2;
    const [ex, ey] = elbow(fsx, fsy, a.fhx, a.fhy, armL * 0.52, armL * 0.5, 0.3);
    const ux = a.fhx - ex, uy = a.fhy - ey;
    const x0 = ex + ux * 0.4, y0 = ey + uy * 0.4, x1 = ex + ux * 0.85, y1 = ey + uy * 0.85;
    const col = s.gt >= 3 ? '#4e4a40' : s.gt >= 1 ? '#5a4a36' : '#6a4a2a';
    c.strokeStyle = shade(col, -0.4); c.lineWidth = 4.4; c.lineCap = 'butt';
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = col; c.lineWidth = 3.6; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = s.gt >= 3 ? DR.bone : '#c8aa78'; c.lineWidth = 0.45;
    c.beginPath(); c.moveTo(x0 + (x1 - x0) * 0.33 - uy * 0.12, y0 + (y1 - y0) * 0.33 + ux * 0.12); c.lineTo(x0 + (x1 - x0) * 0.33 + uy * 0.12, y0 + (y1 - y0) * 0.33 - ux * 0.12);
    c.moveTo(x0 + (x1 - x0) * 0.7 - uy * 0.12, y0 + (y1 - y0) * 0.7 + ux * 0.12); c.lineTo(x0 + (x1 - x0) * 0.7 + uy * 0.12, y0 + (y1 - y0) * 0.7 - ux * 0.12); c.stroke();
    // fur cuff at the elbow end
    c.fillStyle = FUR[clamp(s.gt, -1, 4) + 1]; c.beginPath(); c.arc(x0, y0, 2.1, 0, TAU); c.fill();
    c.lineCap = 'round';
  }
  // ---- staff head: a gnarled crook cradling a living gem, leaves and a vine winding down the shaft
  if (s.wt >= 0) drawStaffHead(c, a.fhx, a.fhy, s, p, L.wGlow ?? s.gem);
}

function drawHeaddress(c: C2D, a: RigAnchors, s: DrState, t: number, back: boolean): void {
  const { hx, hy, headR: r } = a;
  const ht = s.ht;
  if (ht < 0) {
    // vine circlet with three leaves and a small white flower
    c.strokeStyle = '#3e6a26'; c.lineWidth = 0.9;
    c.beginPath(); c.ellipse(hx - r * 0.05, hy - r * 0.42, r * 1.02, r * 0.3, -0.12, Math.PI * 0.95, TAU * 1.03); c.stroke();
    leaf(c, hx + r * 0.7, hy - r * 0.6, r * 0.75, -1.1, DR.leaf);
    leaf(c, hx + r * 0.1, hy - r * 0.78, r * 0.8, -1.8, '#6ac040');
    leaf(c, hx - r * 0.6, hy - r * 0.62, r * 0.7, -2.5, DR.leafDk);
    c.fillStyle = '#f4f0e0'; c.beginPath(); c.arc(hx + r * 0.95, hy - r * 0.4, r * 0.2, 0, TAU); c.fill();
    c.fillStyle = '#f0d040'; c.beginPath(); c.arc(hx + r * 0.95, hy - r * 0.4, r * 0.08, 0, TAU); c.fill();
    return;
  }
  const sc = [0.62, 0.78, 0.9, 1.02, 1.12][clamp(ht, 0, 4)];
  // band
  c.fillStyle = ht >= 3 ? '#3a3024' : '#5a3a20';
  c.beginPath(); c.ellipse(hx - r * 0.05, hy - r * 0.4, r * 1.06, r * 0.34, -0.12, Math.PI * 0.92, TAU * 1.04); c.lineTo(hx + r * 1.02, hy - r * 0.2); c.lineTo(hx - r * 1.05, hy - r * 0.15); c.fill();
  if (ht >= 2) {
    // stag skull brow piece over the forehead
    c.fillStyle = DR.bone;
    c.beginPath(); c.moveTo(hx - r * 0.2, hy - r * 1.05); c.quadraticCurveTo(hx + r * 0.9, hy - r * 1.2, hx + r * 1.35, hy - r * 0.35); c.lineTo(hx + r * 1.1, hy - r * 0.1); c.quadraticCurveTo(hx + r * 0.5, hy - r * 0.55, hx - r * 0.3, hy - r * 0.55); c.closePath(); c.fill();
    if (!back) { c.fillStyle = '#2a1e14'; c.beginPath(); c.ellipse(hx + r * 0.62, hy - r * 0.62, r * 0.2, r * 0.13, 0.2, 0, TAU); c.fill(); }
    if (ht >= 4 && !back) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(140,255,120,${0.7 + 0.3 * Math.sin(t * 4)})`; c.beginPath(); c.ellipse(hx + r * 0.62, hy - r * 0.62, r * 0.14, r * 0.09, 0.2, 0, TAU); c.fill(); c.restore(); }
  } else {
    // bone beads on the band
    c.fillStyle = DR.bone;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(hx - r * 0.45 + k * r * 0.55, hy - r * 0.32, r * 0.13, 0, TAU); c.fill(); }
  }
  // near antler
  antler(c, hx + r * 0.05, hy - r * 0.8, sc, clamp(ht + 1, 2, 5), DR.bone, '#4a3a28');
  if (ht >= 3) {
    // charms hanging from the antler: a feather and beads
    const ax = hx - r * 0.3, ay = hy - r * 1.6;
    c.strokeStyle = '#c8b088'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax - 0.6, ay + 4.2); c.stroke();
    c.fillStyle = '#b04a30'; c.beginPath(); c.arc(ax - 0.3, ay + 2, 0.45, 0, TAU); c.fill();
    c.save(); c.translate(ax - 0.6, ay + 4.2); c.rotate(0.2 + Math.sin(t * 2) * 0.15);
    c.fillStyle = '#e8e0c8'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(0.9, 1.8, 0, 3.8); c.quadraticCurveTo(-0.9, 1.8, 0, 0); c.fill();
    c.restore();
  }
  if (ht >= 4) {
    // leaves and moss growing on the antlers, and a few drifting motes of light
    leaf(c, hx - r * 0.8, hy - r * 2.1, r * 0.6, -2.2, DR.leaf);
    leaf(c, hx + r * 0.4, hy - r * 2.5, r * 0.55, -0.9, '#6ac040');
    leaf(c, hx - r * 1.2, hy - r * 2.9, r * 0.5, -2.6, DR.leafHi);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      const an = t * 1.3 + k * 2.1, x = hx - r * 0.4 + Math.cos(an) * r * 1.6, y = hy - r * 2.2 + Math.sin(an * 1.3) * r * 0.9;
      const gg = c.createRadialGradient(x, y, 0, x, y, 1.6);
      gg.addColorStop(0, 'rgba(200,255,160,0.95)'); gg.addColorStop(1, 'rgba(120,255,100,0)');
      c.fillStyle = gg; c.beginPath(); c.arc(x, y, 1.6, 0, TAU); c.fill();
    }
    c.restore();
  }
}

function drawStaffHead(c: C2D, x: number, y: number, s: DrState, p: Pose, glowCol: string): void {
  const wt = s.wt, t = p.t;
  const dark = wt >= 4;
  const bark = dark ? '#2e2420' : wt >= 3 ? '#5a3c22' : '#6a4a2a';
  const barkDk = shade(bark, -0.5);
  // vine winding down the shaft with a few leaves
  c.strokeStyle = dark ? '#3a5a3a' : '#3e7a2a'; c.lineWidth = 0.7;
  c.beginPath();
  for (let k = 0; k <= 16; k++) { const u = k / 16, yy = y - 23 + u * 16, xx = x + Math.sin(u * 9) * 1.3; if (k) c.lineTo(xx, yy); else c.moveTo(xx, yy); }
  c.stroke();
  leaf(c, x + 1.2, y - 19, 2.6, 0.4, DR.leaf, false);
  leaf(c, x - 1.2, y - 13.5, 2.4, 2.7, '#5aa838', false);
  // gnarled crook: two branches twisting up around the gem, plus a knot hiding the ferrule
  c.fillStyle = bark; c.beginPath(); c.ellipse(x, y - 25.2, 2.4, 3, 0, 0, TAU); c.fill();
  const gy = y - 31.5;
  for (const [col, w] of [[barkDk, 2.3], [bark, 1.5]] as [string, number][]) {
    taper(c, x - 0.6, y - 24, x - 5.2, y - 28, x - 2.6, gy - 4.6, w, w * 0.45, col);
    taper(c, x + 0.6, y - 24, x + 5, y - 29, x + 2.2, gy - 4.2, w, w * 0.45, col);
    taper(c, x - 2.6, gy - 4.6, x - 0.8, gy - 6.5, x + 0.4, gy - 5, w * 0.45, w * 0.25, col);
  }
  if (wt >= 3) {
    // antler tines crowning the staff
    taper(c, x + 2.2, gy - 4.2, x + 4.8, gy - 7, x + 3.6, gy - 10.5, 1.1, 0.3, DR.bone);
    taper(c, x - 2.6, gy - 4.6, x - 5.5, gy - 7.4, x - 5.4, gy - 10.8, 1.1, 0.3, DR.boneDk);
    // hanging feathers
    c.strokeStyle = '#c8b088'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(x + 4, y - 27.5); c.lineTo(x + 4.6, y - 22); c.stroke();
    c.save(); c.translate(x + 4.6, y - 22); c.rotate(0.15 + Math.sin(t * 2.2) * 0.2);
    c.fillStyle = dark ? '#8a94a0' : '#e8e0c8'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(1, 2, 0, 4.4); c.quadraticCurveTo(-1, 2, 0, 0); c.fill();
    c.restore();
  }
  leaf(c, x - 4.6, y - 28.5, 3, 2.6, DR.leaf);
  leaf(c, x + 4.4, y - 29.5, 2.8, -0.3, '#6ac040');
  // the gem: a living seed (green) or a storm crystal (abyss staff)
  const casting = p.cast >= 0 || s.act !== '';
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  c.save(); c.globalCompositeOperation = 'lighter';
  const R = (casting ? 9 : s.renew ? 7.5 : 6) + pulse * 1.5;
  const hg = c.createRadialGradient(x, gy, 0, x, gy, R);
  hg.addColorStop(0, hexA(glowCol, casting ? 0.75 : 0.45)); hg.addColorStop(1, hexA(glowCol, 0));
  c.fillStyle = hg; c.beginPath(); c.arc(x, gy, R, 0, TAU); c.fill();
  c.restore();
  const gr = 2.4 + Math.min(3, Math.max(0, wt)) * 0.25;
  const gg = c.createRadialGradient(x - gr * 0.35, gy - gr * 0.4, 0.2, x, gy, gr);
  gg.addColorStop(0, '#ffffff'); gg.addColorStop(0.35, s.gem); gg.addColorStop(1, shade(s.gem, -0.55));
  c.fillStyle = gg;
  if (dark) { c.beginPath(); c.moveTo(x, gy - gr * 1.5); c.lineTo(x + gr * 0.8, gy); c.lineTo(x, gy + gr * 1.2); c.lineTo(x - gr * 0.8, gy); c.closePath(); c.fill(); }
  else { c.beginPath(); c.ellipse(x, gy, gr * 0.85, gr, 0, 0, TAU); c.fill(); }
  // the crook's tip curls over the front of the gem
  c.strokeStyle = bark; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x + 2.2, gy - 4.2); c.quadraticCurveTo(x + 1.6, gy - 1.5, x + 2.4, gy + 0.6); c.stroke();
  if (casting) castFlourish(c, x, gy, s, p);
}

/** Per-skill energy at the staff head while casting. */
function castFlourish(c: C2D, x: number, y: number, s: DrState, p: Pose): void {
  const t = p.t, k = s.k;
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
  switch (s.act) {
    case 'thorn': {
      // a ring of green sparks tightening into the seed
      const rr = 7 * (1 - ease(k * 2)) + 1.5;
      c.fillStyle = 'rgba(190,255,140,0.9)';
      for (let q = 0; q < 6; q++) { const an = t * 8 + (q * TAU) / 6; c.beginPath(); c.arc(x + Math.cos(an) * rr, y + Math.sin(an) * rr * 0.8, 0.7, 0, TAU); c.fill(); }
      break;
    }
    case 'tornado': {
      // wind arcs whirling round the staff head
      c.strokeStyle = 'rgba(220,240,220,0.75)'; c.lineWidth = 0.8;
      for (let q = 0; q < 3; q++) {
        const an = -t * 14 + (q * TAU) / 3, rr = 5 + q * 1.6;
        c.beginPath(); c.ellipse(x, y + q * 1.5, rr, rr * 0.45, 0, an, an + 2.2); c.stroke();
      }
      break;
    }
    case 'vines': {
      // leaves spiralling up around the raised staff
      for (let q = 0; q < 4; q++) {
        const an = t * 6 + q * (TAU / 4), rr = 6;
        leaf(c, x + Math.cos(an) * rr, y + 4 + Math.sin(an) * rr * 0.4 - q * 1.5, 2.4, an + 1.6, 'rgba(150,255,90,0.85)', false);
      }
      break;
    }
    case 'wolves': {
      // spirit wisps curling up from the gem
      c.strokeStyle = `rgba(${DR.spirit},0.8)`; c.lineWidth = 1;
      for (let q = 0; q < 3; q++) {
        const ph = t * 5 + q * 2.1, len = 9 + q * 2;
        c.beginPath(); c.moveTo(x, y);
        c.bezierCurveTo(x + Math.sin(ph) * 5, y - len * 0.3, x - Math.sin(ph + 1) * 5, y - len * 0.7, x + Math.sin(ph + 2) * 3, y - len);
        c.stroke();
      }
      break;
    }
    case 'renewal': {
      // droplets of light falling from the gem, a soft halo
      c.strokeStyle = 'rgba(190,255,160,0.55)'; c.lineWidth = 0.8;
      c.beginPath(); c.arc(x, y, 6 + Math.sin(t * 5) * 0.8, 0, TAU); c.stroke();
      c.fillStyle = 'rgba(200,255,180,0.9)';
      for (let q = 0; q < 5; q++) { const f = (t * 1.6 + q / 5) % 1; c.beginPath(); c.ellipse(x - 4 + q * 2, y + 3 + f * 12, 0.5, 1.1, 0, 0, TAU); c.fill(); }
      break;
    }
    case 'storm': {
      // forked sparks crackling from the gem up into the sky
      c.strokeStyle = 'rgba(210,225,255,0.95)'; c.lineWidth = 0.8;
      const seed = Math.floor(t * 18);
      for (let q = 0; q < 2; q++) {
        let px = x, py = y - 2;
        c.beginPath(); c.moveTo(px, py);
        for (let j = 0; j < 5; j++) { px += Math.sin(seed * 7.1 + q * 3 + j * 2.3) * 3; py -= 3 + ((seed + j + q) % 3); c.lineTo(px, py); }
        c.stroke();
      }
      const gg = c.createRadialGradient(x, y, 0, x, y, 8);
      gg.addColorStop(0, 'rgba(230,240,255,0.8)'); gg.addColorStop(1, 'rgba(120,150,255,0)');
      c.fillStyle = gg; c.beginPath(); c.arc(x, y, 8, 0, TAU); c.fill();
      break;
    }
  }
  c.restore();
}

/** '#rrggbb' + alpha → rgba(); passes other colour strings through. */
function hexA(col: string, a: number): string {
  if (!col.startsWith('#') || col.length < 7) return col;
  const n = parseInt(col.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
