// assassin: look, weapon/offhand art, projectile/area/effect visuals and skill icons (render/registry).
// Palette: shadow violet (#c890ff accent), black-violet cloth, dark leather, poison green, cold steel.
import { BASE_BY_ID } from '../../data/items';
import { drawBiped, drawWeapon, type Look, type Pose } from '../../render/actors';
import { screenDir, shade } from '../../render/iso';
import {
  AREA_ART, BUFF_ART, CLASS_LOOK, DECOR, EFFECT_ART, FX_EVENT, ITEM_KIND, OFFHAND_ART, PROJ_ART, SKILL_ICON, WEAPON_ART,
  type RigAnchors,
} from '../../render/registry';
import type { EquipSlot, Hero } from '../../sim/types';

type C2D = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const ease = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const tierOf = (t: number): number => Math.max(0, Math.min(4, t | 0));
/** Hex colour lightened (k > 0) or darkened (k < 0), still as hex (render/iso shade() returns rgb()). */
function tone(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number): string => { const x = Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)); return Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0'); };
  return '#' + ch((n >> 16) & 255) + ch((n >> 8) & 255) + ch(n & 255);
}
/** Deterministic 0..1 hash for per-index variation (art only). */
const hash = (n: number): number => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ================================================================ hero look
/** Extra per-frame fields the assassin's decor reads (the Look object is rebuilt every frame). */
interface AsLook extends Look {
  asHood: string; asScarf: string; asTrim: string; asMask: string; asLeather: string;
  asHelm: number; asCt: number; asGlove: number; asBoot: number;
  asKatar: number; asPouch: number;
  asAct: string; asK: number; asFade: number;
}

const CHEST = [
  // [torso, legs, trim]  — index = chest tier + 1 (no chest … shadow silk)
  ['#3e3440', '#3a3240', '#6a5a68'],
  ['#4e3a2c', '#3a3038', '#8a6a44'],
  ['#44332e', '#373040', '#9a8a7a'],
  ['#3c2a48', '#322a3c', '#9a6ac8'],
  ['#2c2536', '#2c2634', '#c8b8e0'],
  ['#221630', '#261c30', '#b070ff'],
];
const HOOD = ['#2e2436', '#30263a', '#2c2234', '#2a1f33', '#241a2c', '#1c1224'];
const SCARF = ['#5a2a7e', '#5e2c84', '#63308a', '#6a3294', '#7234a2', '#8a3ad0'];
const GLOVE = ['#4a3428', '#4a3428', '#5a4a44', '#7a7e8c', '#3a3446', '#2a1e36'];

let lastLook: AsLook | null = null;

function slotTier(h: Hero, s: EquipSlot): number {
  const it = h.equip[s];
  return it && it.req <= h.level ? BASE_BY_ID[it.base]?.tier ?? -1 : -1;
}

CLASS_LOOK.assassin = (h, common, ct) => {
  const t = Math.max(-1, Math.min(4, ct));
  const [body, legs, trim] = CHEST[t + 1];
  const off = h.equip.offhand && h.equip.offhand.req <= h.level ? BASE_BY_ID[h.equip.offhand.base] : null;
  const katar = common.weapon === 'katar';
  const a = h.act;
  const act = a ? a.skill : '';
  const k = a ? clamp01(a.t / Math.max(0.01, a.dur)) : 0;
  const smoke = h.buffs.find((b) => b.id === 'as_smoke');
  let fade = smoke ? Math.min(1, (smoke.dur - smoke.t) / 0.35, smoke.t / 0.5) * 0.62 : 0;
  if (act === 'as_shadow') fade = Math.max(fade, (1 - k) * 0.7);
  const helm = common.helm ?? -1;
  let wGlow = common.wGlow;
  if (act === 'as_venom') wGlow = '#6aff3a';
  else if (act === 'as_shadow') wGlow = '#b060ff';
  else if (!wGlow && (common.wTier ?? 0) >= 4) wGlow = '#8a40e0';
  const glow = act === 'as_smoke' ? '#9a88c0' : act === 'as_sentry' ? '#b890ff' : t >= 4 ? '#5a2a9a' : undefined;
  const bt = slotTier(h, 'boots');
  const L: AsLook = {
    skin: '#3b3140', body, body2: t >= 3 ? '#3e2458' : '#4a2a68', legs, boots: bt >= 3 ? '#2a2430' : bt >= 0 ? '#3a2a22' : '#2a2226',
    head: 'none', helm: -1, build: 0.93, height: 1.0, hunch: 0.1,
    weapon: common.weapon ?? 'none', wTier: common.wTier ?? 0, wGlow,
    offhand: 'as_rig', offTier: off?.cat === 'pouch' ? off.tier : -1,
    armorTier: -1, trim: t >= 1 ? trim : undefined, glow, eyes: '#d8a8ff', decor: 'as_garb',
    asHood: HOOD[Math.max(0, Math.min(5, helm + 1))], asScarf: SCARF[t + 1], asTrim: trim, asMask: helm >= 3 ? '#8a90a0' : '#3a2c48', asLeather: body,
    asHelm: helm, asCt: t, asGlove: slotTier(h, 'gloves'), asBoot: bt,
    asKatar: katar ? common.wTier ?? 0 : -1, asPouch: off?.cat === 'pouch' ? off.tier : -1,
    asAct: act, asK: k, asFade: fade,
  };
  lastLook = L;
  return L;
};

ITEM_KIND.claw = 'katar';
ITEM_KIND.pouch = 'pouch';

// ---------------------------------------------------------------- rig helpers (mirror the biped rig's arm math)
function armRest(p: Pose): number {
  const sw = p.moving ? Math.sin(p.walk * 4.2) : 0;
  return 0.12 + (p.moving ? -sw * 0.35 : Math.sin(p.t * 2) * 0.03);
}
/** Front upper-arm angle (0 = straight down, π/2 = forward). */
function frontArm(p: Pose, weapon: string): number {
  const rest = armRest(p);
  let a = rest;
  if (p.atk >= 0) {
    const t = p.atk;
    if (weapon === 'katar') {
      if (t < 0.4) a = rest + 0.5 - ease(t / 0.4) * 0.35;
      else if (t < 0.6) a = rest + 0.15 + ease((t - 0.4) / 0.2) * (1.6 - rest - 0.15);
      else a = 1.6 - ease((t - 0.6) / 0.4) * (1.6 - rest);
    } else if (t < 0.4) a = rest + ease(t / 0.4) * 2.6;
    else if (t < 0.6) a = rest + 2.6 - ease((t - 0.4) / 0.2) * 3.1;
    else a = rest - 0.5 + ease((t - 0.6) / 0.4) * 0.5;
  }
  if (p.cast >= 0) a = 1.3 + ease(p.cast * 2) * 0.8;
  return a;
}
/** Back forearm angle. */
function backForearm(p: Pose): number {
  let b = armRest(p) + 0.1;
  if (p.cast >= 0) b = 1.2 + ease(p.cast * 2) * 0.6;
  if ((p.block ?? 0) > 0) b = 1.25;
  return b + 0.35;
}

/** Offscreen actor canvases have an alpha channel; the main canvas (low quality path) does not. */
function offscreen(c: C2D): boolean {
  const at = (c as C2D & { getContextAttributes?: () => { alpha?: boolean } }).getContextAttributes?.();
  return at?.alpha === true;
}

// ---------------------------------------------------------------- legs: wraps, knee cops, greaves, thigh sheath
// The rig draws the legs outside its upper-body transform (lean + lunge around the hips) while every decor hook runs
// inside it, so the leg gear undoes that transform first. rigLean() mirrors drawBiped; legGear() checks the live
// canvas rotation against it and simply skips the gear if the rig ever changes (nothing floats off the legs).
function rigLean(L: Look, p: Pose): { lean: number; lunge: number } {
  const wk = L.weapon ?? 'none';
  const heavyW = wk === 'sword2h' || wk === 'axe2h' || wk === 'hammer' || wk === 'club' || wk === 'cleaver' || !!WEAPON_ART[wk]?.heavy;
  const melee = wk !== 'bow' && wk !== 'staff' && wk !== 'crozier' && wk !== 'wand';
  let lean = (L.hunch ?? 0) * 0.15, lunge = 0;
  if (p.atk >= 0 && melee && wk !== 'none') {
    const t = p.atk;
    if (t < 0.4) { lean -= ease(t / 0.4) * (heavyW ? 0.2 : 0.12); lunge = -ease(t / 0.4) * 1.5; }
    else if (t < 0.6) { const k = ease((t - 0.4) / 0.2); lean += -0.12 + k * (heavyW ? 0.42 : 0.3); lunge = -1.5 + k * (heavyW ? 6 : 4.5); }
    else { const k = ease((t - 0.6) / 0.4); lean += (heavyW ? 0.22 : 0.18) * (1 - k); lunge = (heavyW ? 4.5 : 3) * (1 - k); }
  } else if (p.atk >= 0 && wk === 'bow') lean -= 0.05;
  if (p.cast >= 0) lean -= 0.08 * Math.sin(Math.min(1, p.cast) * Math.PI);
  if (p.hit > 0) lean -= 0.18 * Math.min(1, p.hit * 6);
  return { lean, lunge };
}

interface LegPts { kx: number; ky: number; fx: number; fy: number; a: number; sa: number; w: number; hipY: number }
/** Hip → knee → ankle of one rig leg (mirrors drawBiped's drawLeg, non-digitigrade). */
function legPts(L: Look, p: Pose, hipY: number, front: boolean): LegPts {
  const b = L.build ?? 1, legL = 21 * (L.height ?? 1);
  const wk = L.weapon ?? 'none';
  const melee = wk !== 'bow' && wk !== 'staff' && wk !== 'crozier' && wk !== 'wand';
  const sw = p.moving ? Math.sin(p.walk * 4.2) : 0;
  const s = front ? sw : -sw;
  const stance = p.atk >= 0 && melee ? Math.sin(Math.min(1, p.atk) * Math.PI) * 0.25 : 0;
  const a = s * 0.5 + (front ? stance : -stance * 0.6);
  const lift = p.moving ? Math.max(0, -s) * 0.7 : 0;
  const kx = Math.sin(a) * legL * 0.5, ky = hipY + Math.cos(a) * legL * 0.5;
  const sa = a * 0.3 - lift;
  return { kx, ky, fx: kx + Math.sin(sa) * legL * 0.52, fy: ky + Math.cos(sa) * legL * 0.52, a, sa, w: 4.6 * b, hipY };
}

const WRAP = ['#7a6a58', '#4e3a2c', '#4a3a30', '#3a3440', '#2a2230', '#1e1628'];

function legGear(c: C2D, L: AsLook, p: Pose, a: RigAnchors, front: boolean): void {
  if (L.bones || L.digitigrade) return;
  const { lean, lunge } = rigLean(L, p);
  if (p.dead < 0 && typeof c.getTransform === 'function') {
    const m = c.getTransform();
    if (Math.abs(Math.atan2(m.b, m.d) - lean) > 0.03) return;
  }
  const g = legPts(L, p, a.hipY, front);
  c.save();
  c.translate(0, a.hipY); c.rotate(-lean); c.translate(0, -a.hipY); c.translate(-lunge, 0);
  c.lineCap = 'butt';
  const dk = (col: string): string => (front ? col : shade(col, -0.32));
  const bt = L.asBoot, ct = L.asCt;
  // shin frame: u along the shin (knee → ankle), n across it (+n = the side the hero faces)
  const ux = Math.sin(g.sa), uy = Math.cos(g.sa), nx = uy, ny = -ux;
  const sl = Math.hypot(g.fx - g.kx, g.fy - g.ky);
  const P = (s: number, o: number): [number, number] => [g.kx + ux * sl * s + nx * o, g.ky + uy * sl * s + ny * o];
  const hw = g.w * 0.85 / 2 + 0.45;
  // spiral wraps from mid-shin down to the boot
  const wrap = WRAP[Math.max(0, Math.min(5, bt + 1))];
  const s0 = bt < 0 ? 0.42 : 0.26;
  for (let s = s0; s < 0.86; s += 0.13) {
    const [x0, y0] = P(s, hw), [x1, y1] = P(s + 0.075, -hw);
    c.strokeStyle = dk(shade(wrap, -0.45)); c.lineWidth = 1.35; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = dk(wrap); c.lineWidth = 0.85; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  }
  if (bt >= 2) {
    // shin greave on the front of the leg: steel (2-3), abyssal black with a violet seam (4)
    const col = bt >= 4 ? '#2a2034' : bt >= 3 ? '#6a6e7c' : '#8a8e9a';
    const [ax, ay] = P(0.1, hw + 0.5), [bx, by] = P(0.1, -hw * 0.2), [cx, cy] = P(0.84, -hw * 0.1), [dx, dy] = P(0.84, hw + 0.2);
    const [tx, ty] = P(0.02, hw * 0.4);
    const gr = c.createLinearGradient(ax, ay, bx, by);
    gr.addColorStop(0, dk(shade(col, 0.5))); gr.addColorStop(0.5, dk(col)); gr.addColorStop(1, dk(shade(col, -0.5)));
    c.fillStyle = gr;
    c.beginPath(); c.moveTo(tx, ty); c.lineTo(ax, ay); c.lineTo(dx, dy); c.lineTo(cx, cy); c.lineTo(bx, by); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 0.4; c.stroke();
    if (bt >= 4 && front) {
      c.save(); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = `rgba(180,100,255,${0.55 + 0.25 * Math.sin(p.t * 3)})`; c.lineWidth = 0.5;
      const [e0x, e0y] = P(0.14, hw * 0.55), [e1x, e1y] = P(0.8, hw * 0.55);
      c.beginPath(); c.moveTo(e0x, e0y); c.lineTo(e1x, e1y); c.stroke();
      c.restore();
    }
  }
  // folded boot cuff at the ankle
  if (bt >= 0) {
    const bootCol = bt >= 3 ? '#2a2430' : '#3a2a22';
    const [c0x, c0y] = P(0.86, hw + 0.35), [c1x, c1y] = P(0.86, -hw - 0.35), [c2x, c2y] = P(0.99, -hw - 0.2), [c3x, c3y] = P(0.99, hw + 0.2);
    c.fillStyle = dk(shade(bootCol, 0.12));
    c.beginPath(); c.moveTo(c0x, c0y); c.lineTo(c1x, c1y); c.lineTo(c2x, c2y); c.lineTo(c3x, c3y); c.closePath(); c.fill();
    c.strokeStyle = dk(bt >= 3 ? '#8a8e9c' : '#6a5040'); c.lineWidth = 0.4; c.beginPath(); c.moveTo(c0x, c0y); c.lineTo(c1x, c1y); c.stroke();
  }
  // thigh: a strap above the knee; the front leg carries a sheathed dagger, hilt up by the belt
  const tux = Math.sin(g.a), tuy = Math.cos(g.a), tnx = tuy, tny = -tux;
  const tl = Math.hypot(g.kx, g.ky - g.hipY), thw = g.w / 2 + 0.45;
  const T = (s: number, o: number): [number, number] => [tux * tl * s + tnx * o, g.hipY + tuy * tl * s + tny * o];
  {
    const [x0, y0] = T(0.78, thw), [x1, y1] = T(0.8, -thw);
    c.strokeStyle = dk('#140e12'); c.lineWidth = 1.5; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = dk(ct >= 3 ? '#3a3040' : '#4a3426'); c.lineWidth = 0.9; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  }
  if (front) {
    const sheath = ct >= 4 ? '#2a1a3a' : ct >= 2 ? '#4a3a30' : '#6a4830';
    const metal = ct >= 3 ? '#c8c8d8' : '#b0946a';
    c.save();
    const [sx, sy] = T(0.3, thw * 0.3);
    c.translate(sx, sy); c.rotate(-g.a - 0.3);
    // hilt (grip, guard, pommel) poking up out of the sheath
    c.fillStyle = '#120c10'; c.fillRect(-0.7, -4, 1.4, 3.8);
    c.fillStyle = ct >= 4 ? '#5a2a8a' : '#6a3a28'; c.fillRect(-0.45, -3.6, 0.9, 0.5); c.fillRect(-0.45, -2.5, 0.9, 0.5);
    c.fillStyle = metal; c.fillRect(-1.7, -0.7, 3.4, 0.9);
    c.fillStyle = ct >= 4 ? '#c890ff' : '#e0d8c8'; c.beginPath(); c.arc(0, -4.4, 0.8, 0, TAU); c.fill();
    // sheath body with a lit edge and a metal chape at the tip
    const sg = c.createLinearGradient(-1.5, 0, 1.5, 0); sg.addColorStop(0, shade(sheath, 0.45)); sg.addColorStop(0.5, sheath); sg.addColorStop(1, shade(sheath, -0.5));
    c.fillStyle = sg;
    c.beginPath(); c.moveTo(-1.4, 0.2); c.lineTo(1.4, 0.2); c.lineTo(1, 5.4); c.lineTo(0, 6.8); c.lineTo(-1, 5.4); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 0.35; c.stroke();
    c.strokeStyle = 'rgba(255,235,210,0.3)'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(-1.1, 0.6); c.lineTo(-0.8, 5.2); c.stroke();
    c.fillStyle = metal; c.beginPath(); c.moveTo(-1, 5.1); c.lineTo(1, 5.1); c.lineTo(0, 6.8); c.closePath(); c.fill();
    c.fillRect(-1.4, 0.2, 2.8, 0.6);
    c.restore();
    // the two straps holding it round the thigh
    for (const s of [0.28, 0.55]) {
      const [x0, y0] = T(s, thw), [x1, y1] = T(s + 0.03, -thw);
      c.strokeStyle = '#140e12'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      c.strokeStyle = '#3a2a22'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    }
  }
  // knee cop (from light armour up): leather, steel, abyssal with a rune stud
  if (ct >= 1) {
    // a cupped plate over the front of the knee, pointed at the bottom, riveted at the top strap
    const col = ct >= 4 ? '#2a1e36' : ct >= 3 ? '#7a7e8c' : ct >= 2 ? '#5e4636' : '#6a4a32';
    c.save(); c.translate(g.kx, g.ky); c.rotate(-(g.a + g.sa) / 2); c.scale(0.8, 0.8);
    const kg = c.createLinearGradient(-1, 0, thw + 1.2, 0);
    kg.addColorStop(0, dk(shade(col, -0.5))); kg.addColorStop(0.6, dk(col)); kg.addColorStop(1, dk(shade(col, ct >= 3 ? 0.45 : 0.18)));
    c.fillStyle = kg;
    c.beginPath(); c.moveTo(-0.6, -2.6); c.quadraticCurveTo(thw + 1.6, -2.8, thw + 1.3, 0.2); c.quadraticCurveTo(thw + 0.9, 2.2, thw * 0.35, 3.3);
    c.quadraticCurveTo(-0.3, 1.6, -0.6, -2.6); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 0.35; c.stroke();
    c.strokeStyle = ct >= 3 ? 'rgba(255,255,255,0.55)' : 'rgba(255,230,200,0.3)'; c.lineWidth = 0.4;
    c.beginPath(); c.moveTo(thw * 0.5, -2.2); c.quadraticCurveTo(thw + 1, -1.4, thw + 0.6, 1.2); c.stroke();
    c.fillStyle = ct >= 3 ? '#d8d8e4' : '#b09060'; c.beginPath(); c.arc(thw * 0.55, -1.6, 0.42, 0, TAU); c.fill();
    if (ct >= 4 && front) { c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(190,110,255,0.9)'; c.beginPath(); c.arc(thw * 0.7, 0.3, 0.6, 0, TAU); c.fill(); }
    c.restore();
  }
  c.lineCap = 'round';
  c.restore();
}

// ---------------------------------------------------------------- decor: back layer
let cur: { L: AsLook; a: RigAnchors } | null = null;

function scarfTail(c: C2D, x: number, y: number, len: number, w: number, p: Pose, flow: number, ph: number, col: string, glowEdge: boolean): void {
  const n = 9;
  const L: [number, number][] = [], R: [number, number][] = [];
  let px = x, py = y;
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const wave = Math.sin(p.t * (5 + flow * 5) - s * 4.2 + ph) * s * (1.2 + flow * 2.2);
    const cx = x - s * len * (0.35 + 0.5 * flow);
    const cy = y + s * len * (0.9 - 0.62 * flow) + wave;
    const dx = cx - px, dy = cy - py, dl = Math.hypot(dx, dy) || 1;
    const nx = -dy / dl, ny = dx / dl, hw = (w * (1 - s * 0.55)) / 2;
    L.push([cx + nx * hw, cy + ny * hw]); R.push([cx - nx * hw, cy - ny * hw]);
    px = cx; py = cy;
  }
  const g = c.createLinearGradient(x, y, x - len * 0.6, y + len * 0.6);
  g.addColorStop(0, shade(col, -0.15)); g.addColorStop(1, shade(col, -0.55));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(L[0][0], L[0][1]);
  for (const q of L) c.lineTo(q[0], q[1]);
  // forked, frayed end
  const e = L.length - 1;
  c.lineTo((L[e][0] + R[e][0]) / 2 - 1.2, (L[e][1] + R[e][1]) / 2 + 1.6);
  for (let i = R.length - 1; i >= 0; i--) c.lineTo(R[i][0], R[i][1]);
  c.closePath(); c.fill();
  if (glowEdge) {
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(190,120,255,0.55)'; c.lineWidth = 0.6;
    c.beginPath(); L.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke(); c.restore();
  }
}

function drawBack(c: C2D, L: AsLook, p: Pose, a: RigAnchors): void {
  const atk = p.atk >= 0 ? Math.sin(Math.min(1, p.atk) * Math.PI) : 0;
  const flow = clamp01((p.moving ? 0.75 : 0.28) + atk * 0.45 + (L.asAct === 'as_shadow' ? 0.5 : 0));
  // short tattered half cape (reinforced armour and up)
  if (L.asCt >= 2) {
    const col = L.asCt >= 4 ? '#1a1024' : L.asCt >= 3 ? '#1e1a26' : '#2a2030';
    const sway = Math.sin(p.t * 3.1) * 0.8 + (p.moving ? -3 - Math.sin(p.walk * 4.2) * 1.2 : 0) - atk * 2;
    const hem = a.hipY + 8;
    const g = c.createLinearGradient(a.shX, a.shY, a.shX - 8, hem);
    g.addColorStop(0, shade(col, 0.12)); g.addColorStop(1, shade(col, -0.4));
    c.fillStyle = g;
    c.beginPath(); c.moveTo(a.shX - 5.5, a.shY + 0.5); c.lineTo(a.shX + 2.5, a.shY + 1.5);
    c.quadraticCurveTo(a.shX - 1, a.hipY, -2 + sway * 0.4, hem - 1);
    const n = 5;
    for (let i = 1; i <= n; i++) { const s = i / n; c.lineTo(-2 + sway * 0.4 - s * (9 - sway * 0.6), hem + (i % 2 ? 2.4 : -0.5) - s * 1.5); }
    c.quadraticCurveTo(a.shX - 9 + sway * 0.5, a.hipY - 4, a.shX - 5.5, a.shY + 0.5); c.fill();
    if (L.asCt >= 4) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(170,90,255,0.45)'; c.lineWidth = 0.7; c.stroke(); c.restore(); }
  }
  // scarf tails streaming from the back of the neck
  const nx = a.shX - 3.2, ny = a.shY - 0.8;
  const len = 17 + Math.max(0, L.asCt) * 1.6;
  scarfTail(c, nx, ny, len * 0.82, 2.4, p, flow, 1.7, tone(L.asScarf, -0.3), false);
  scarfTail(c, nx + 0.6, ny + 0.4, len, 3.1, p, flow, 0, L.asScarf, L.asCt >= 4);
}

// ---------------------------------------------------------------- decor: middle layer (offhand hook: after the back arm, before torso/head/front arm)
function bracer(c: C2D, hx: number, hy: number, ang: number, tier: number, dark: boolean): void {
  const dx = Math.sin(ang), dy = Math.cos(ang);
  const x0 = hx - dx * 1.4, y0 = hy - dy * 1.4, x1 = hx - dx * 6.8, y1 = hy - dy * 6.8;
  const col = GLOVE[tier + 1] ?? GLOVE[0];
  const base = dark ? shade(col, -0.3) : col;
  c.lineCap = 'butt';
  c.strokeStyle = '#120e14'; c.lineWidth = 4.9; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.strokeStyle = base; c.lineWidth = 4.1; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.strokeStyle = tier >= 2 ? 'rgba(255,255,255,0.35)' : 'rgba(255,230,200,0.16)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x0 - dy * 1.2, y0 + dx * 1.2); c.lineTo(x1 - dy * 1.2, y1 + dx * 1.2); c.stroke();
  // straps / plate edges
  c.strokeStyle = tier >= 3 ? '#c8b8e0' : '#1a1418'; c.lineWidth = 0.7;
  for (const s of [0.25, 0.7]) { const px = x0 + (x1 - x0) * s, py = y0 + (y1 - y0) * s; c.beginPath(); c.moveTo(px - dy * 2.1, py + dx * 2.1); c.lineTo(px + dy * 2.1, py - dx * 2.1); c.stroke(); }
  if (tier >= 4) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(180,100,255,0.8)'; c.beginPath(); c.arc((x0 + x1) / 2, (y0 + y1) / 2, 0.8, 0, TAU); c.fill(); c.restore(); }
  c.lineCap = 'round';
}

function knifeHandle(c: C2D, x: number, y: number, ang: number, s: number, blade: string, grip: string): void {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s);
  c.fillStyle = grip; c.fillRect(-0.7, -4.2, 1.4, 4.2);
  c.fillStyle = '#b8b0a0'; c.fillRect(-1.3, -0.3, 2.6, 0.8);
  c.fillStyle = blade; c.beginPath(); c.arc(0, -4.8, 0.9, 0, TAU); c.fill();
  c.restore();
}

/** The knife pouch hanging at the rear hip (also used by the pouch offhand art). */
function pouchAt(c: C2D, x: number, y: number, tier: number, sway: number): void {
  const t = tierOf(tier);
  const leather = t >= 4 ? '#2a1e36' : t >= 2 ? '#3a3a24' : '#5a3a22';
  c.save(); c.translate(x, y); c.rotate(sway);
  // belt loop
  c.fillStyle = '#1e1618'; c.fillRect(-0.9, -2.2, 1.8, 2.6);
  // knives sticking out, tilted back
  const blade = t >= 4 ? '#8a70b8' : '#c8c8d0';
  const grip = t >= 4 ? '#1a1020' : t >= 2 ? '#2a3a1e' : '#4a2a18';
  knifeHandle(c, -1.8, 0.2, -0.55, 0.9, blade, grip);
  knifeHandle(c, -0.2, 0, -0.35, 0.95, blade, grip);
  knifeHandle(c, 1.4, 0.3, -0.15, 0.85, blade, grip);
  // pouch body
  const g = c.createLinearGradient(-3.4, 0, 3.4, 0);
  g.addColorStop(0, shade(leather, 0.25)); g.addColorStop(0.6, leather); g.addColorStop(1, shade(leather, -0.45));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(-3.4, 0.4); c.lineTo(3.2, 0.2); c.quadraticCurveTo(3.8, 5.5, 2.2, 7); c.lineTo(-2.4, 7.2); c.quadraticCurveTo(-4, 5.6, -3.4, 0.4); c.fill();
  c.strokeStyle = shade(leather, -0.6); c.lineWidth = 0.5; c.stroke();
  // flap + clasp
  c.fillStyle = shade(leather, -0.2); c.beginPath(); c.moveTo(-3.5, 0.2); c.lineTo(3.3, 0); c.lineTo(2.4, 2.9); c.lineTo(-2.6, 3.1); c.closePath(); c.fill();
  const clasp = t >= 4 ? '#c890ff' : t >= 2 ? '#7aff5a' : '#b8a070';
  if (t >= 2) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = t >= 4 ? 'rgba(180,110,255,0.6)' : 'rgba(110,255,80,0.45)'; c.beginPath(); c.arc(0, 2.9, 1.8, 0, TAU); c.fill(); c.restore(); }
  c.fillStyle = clasp; c.beginPath(); c.arc(0, 2.9, 0.75, 0, TAU); c.fill();
  // stitches
  c.strokeStyle = 'rgba(255,230,190,0.22)'; c.lineWidth = 0.35; c.setLineDash([0.7, 0.7]);
  c.beginPath(); c.moveTo(-2.8, 4.2); c.quadraticCurveTo(0, 6.8, 2.6, 4.1); c.stroke(); c.setLineDash([]);
  c.restore();
}

/** Hood, cloth mask and glowing eyes (drawn before the torso so the collar overlaps it, and before the front arm). */
function drawHoodHead(c: C2D, L: AsLook, p: Pose, a: RigAnchors): void {
  const x = a.hx, y = a.hy, r = a.headR;
  const hood = L.asHood, ht = L.asHelm;
  // cowl: an overhanging brim over the eyes, a rounded crown and a peak that droops back behind the neck
  // (the peak trails further while running / lunging)
  const flow = clamp01((p.moving ? 0.7 : 0.15) + (p.atk >= 0 ? Math.sin(Math.min(1, p.atk) * Math.PI) * 0.5 : 0) + (L.asAct === 'as_shadow' ? 0.6 : 0));
  const sway = Math.sin(p.t * (2.2 + flow * 4)) * (0.08 + flow * 0.12);
  const tx = x - r * (2.05 + flow * 0.45), ty = y - r * (0.05 + flow * 0.35) + sway * r;
  const g = c.createLinearGradient(x - r, y - r * 1.5, x + r * 0.9, y + r * 1.3);
  g.addColorStop(0, shade(hood, 0.3)); g.addColorStop(0.45, hood); g.addColorStop(1, shade(hood, -0.55));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(x + r * 1.02, y + r * 1.3);
  c.quadraticCurveTo(x + r * 1.55, y + r * 0.25, x + r * 1.42, y - r * 0.62);   // cheek → brim tip
  c.quadraticCurveTo(x + r * 1.05, y - r * 1.45, x - r * 0.1, y - r * 1.42);    // crown
  c.quadraticCurveTo(x - r * 1.25, y - r * 1.38, x - r * 1.6, y - r * 0.72);
  c.quadraticCurveTo(x - r * 1.85, y - r * 0.38, tx, ty);                         // drooping peak
  c.quadraticCurveTo(x - r * 1.75, y + r * 0.05, x - r * 1.35, y + r * 0.5);
  c.quadraticCurveTo(x - r * 1.5, y + r * 1.15, x - r * 1.05, y + r * 1.6);
  c.lineTo(x + r * 0.35, y + r * 1.55);
  c.closePath(); c.fill();
  c.strokeStyle = shade(hood, -0.65); c.lineWidth = 0.6; c.stroke();
  // fold lines: crown seam, and the drape running into the peak
  c.strokeStyle = shade(hood, -0.45); c.lineWidth = 0.55;
  c.beginPath(); c.moveTo(x - r * 0.1, y - r * 1.4); c.quadraticCurveTo(x - r * 0.95, y - r * 0.9, x - r * 1.05, y + r * 1.3); c.stroke();
  c.beginPath(); c.moveTo(x - r * 1.45, y - r * 0.5); c.quadraticCurveTo(x - r * 1.75, y - r * 0.15, tx + r * 0.25, ty + r * 0.05); c.stroke();
  c.strokeStyle = shade(hood, 0.22); c.lineWidth = 0.45;
  c.beginPath(); c.moveTo(x + r * 0.55, y - r * 1.28); c.quadraticCurveTo(x - r * 0.45, y - r * 0.6, x - r * 0.3, y + r * 1.15); c.stroke();
  // helm tiers: leather band (1), steel circlet + gem (2), swept blades (3), demonic horns (4)
  if (ht >= 1) {
    c.strokeStyle = ht >= 2 ? '#2a2830' : '#2a1c16'; c.lineWidth = ht >= 2 ? 1.5 : 1.6;
    c.beginPath(); c.moveTo(x - r * 1.28, y - r * 0.5); c.quadraticCurveTo(x - r * 0.1, y - r * 1.02, x + r * 1.15, y - r * 0.6); c.stroke();
    c.strokeStyle = ht >= 2 ? '#8a8e9c' : '#5a4030'; c.lineWidth = 0.55;
    c.beginPath(); c.moveTo(x - r * 1.2, y - r * 0.62); c.quadraticCurveTo(x - r * 0.1, y - r * 1.12, x + r * 1.1, y - r * 0.72); c.stroke();
    if (ht >= 2 && !p.back) {
      c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = ht >= 4 ? 'rgba(255,110,230,0.9)' : 'rgba(190,120,255,0.9)';
      c.beginPath(); c.arc(x + r * 0.62, y - r * 0.9, r * 0.14, 0, TAU); c.fill(); c.restore();
    }
    if (ht >= 3) {
      c.fillStyle = ht >= 4 ? '#1a1420' : '#4a4e5a';
      for (const [ox, oy, ln] of [[-1.05, -0.62, 1.3], [-0.72, -0.8, 1.05]] as [number, number, number][]) {
        c.beginPath(); c.moveTo(x + r * ox, y + r * oy); c.quadraticCurveTo(x + r * (ox - ln * 0.6), y + r * (oy - ln * 0.5), x + r * (ox - ln), y + r * (oy - ln * 0.3)); c.lineTo(x + r * (ox + 0.25), y + r * (oy + 0.2)); c.fill();
      }
    }
  }
  if (ht >= 4) {
    c.fillStyle = '#1a1018';
    for (const s of [0, 1]) {
      const bx = x - r * (0.2 + s * 0.55), by = y - r * (1.2 - s * 0.1);
      c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx - r * 0.6, by - r * 1.3, bx - r * 1.5, by - r * 1.25); c.quadraticCurveTo(bx - r * 0.5, by - r * 0.9, bx + r * 0.35, by + r * 0.1); c.fill();
    }
  }
  if (p.back) {
    c.strokeStyle = shade(hood, -0.55); c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(x - r * 0.2, y - r * 1.4); c.quadraticCurveTo(x - r * 0.4, y - r * 0.2, x + r * 0.2, y + r * 1.3); c.stroke();
    return;
  }
  // face opening (deep shadow) under the brim
  c.fillStyle = '#060408';
  c.beginPath(); c.moveTo(x + r * 1.13, y + r * 1.0);
  c.quadraticCurveTo(x + r * 1.38, y + r * 0.05, x + r * 1.3, y - r * 0.5);
  c.quadraticCurveTo(x + r * 0.45, y - r * 0.72, x + r * 0.12, y + r * 0.2);
  c.quadraticCurveTo(x + r * 0.28, y + r * 0.95, x + r * 1.13, y + r * 1.0); c.fill();
  // hood rim (lit edge of the brim)
  c.strokeStyle = ht >= 3 ? 'rgba(200,184,224,0.6)' : shade(hood, 0.4); c.lineWidth = 0.6;
  c.beginPath(); c.moveTo(x + r * 1.36, y - r * 0.58); c.quadraticCurveTo(x + r * 0.45, y - r * 0.74, x + r * 0.12, y + r * 0.2); c.stroke();
  // glowing eyes (slanted slits)
  const eye = ht >= 4 ? '#ff70e0' : L.eyes ?? '#d8a8ff';
  c.save();
  c.globalCompositeOperation = 'lighter';
  const eg = c.createRadialGradient(x + r * 0.72, y - r * 0.12, 0, x + r * 0.72, y - r * 0.12, r * 0.95);
  eg.addColorStop(0, 'rgba(200,130,255,0.55)'); eg.addColorStop(1, 'rgba(120,40,200,0)');
  c.fillStyle = eg; c.beginPath(); c.arc(x + r * 0.72, y - r * 0.12, r * 0.95, 0, TAU); c.fill();
  c.shadowColor = eye; c.shadowBlur = 4;
  c.fillStyle = eye;
  for (const [ex, ey, s] of [[0.48, -0.1, 0.8], [0.98, -0.16, 1]] as [number, number, number][]) {
    c.beginPath(); c.ellipse(x + r * ex, y + r * ey, r * 0.21 * s, r * 0.075 * s, -0.28, 0, TAU); c.fill();
  }
  c.fillStyle = '#ffffff'; c.shadowBlur = 0;
  c.beginPath(); c.ellipse(x + r * 0.98, y - r * 0.16, r * 0.09, r * 0.035, -0.28, 0, TAU); c.fill();
  c.restore();
  // mask over the lower face: cloth wrap, or a steel face plate (helm 3+)
  const mg = c.createLinearGradient(x + r * 0.2, y, x + r * 1.2, y + r);
  if (ht >= 3) { mg.addColorStop(0, ht >= 4 ? '#3a2e44' : '#c8ccd8'); mg.addColorStop(1, ht >= 4 ? '#140e1a' : '#5a5e6e'); }
  else { mg.addColorStop(0, shade(L.asMask, 0.18)); mg.addColorStop(1, shade(L.asMask, -0.3)); }
  c.fillStyle = mg;
  c.beginPath(); c.moveTo(x + r * 0.16, y + r * 0.22);
  c.quadraticCurveTo(x + r * 0.7, y + r * 0.02, x + r * 1.3, y + r * 0.1);
  c.quadraticCurveTo(x + r * 1.28, y + r * 0.65, x + r * 1.1, y + r * 1.02);
  c.quadraticCurveTo(x + r * 0.5, y + r * 1.05, x + r * 0.2, y + r * 0.85); c.closePath(); c.fill();
  if (ht >= 3) {
    c.strokeStyle = ht >= 4 ? 'rgba(200,110,255,0.8)' : '#2a2c34'; c.lineWidth = 0.4;
    for (let i = 0; i < 3; i++) { const yy = y + r * (0.42 + i * 0.18); c.beginPath(); c.moveTo(x + r * 0.55, yy); c.lineTo(x + r * 1.15, yy - r * 0.04); c.stroke(); }
  } else {
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.4;
    c.beginPath(); c.moveTo(x + r * 0.35, y + r * 0.55); c.quadraticCurveTo(x + r * 0.8, y + r * 0.45, x + r * 1.22, y + r * 0.5); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.1)';
    c.beginPath(); c.moveTo(x + r * 0.3, y + r * 0.3); c.quadraticCurveTo(x + r * 0.8, y + r * 0.14, x + r * 1.25, y + r * 0.2); c.stroke();
  }
}

function drawMid(c: C2D, L: AsLook, p: Pose, a: RigAnchors, bx: number, by: number): void {
  // the back leg is already on the canvas here (the front one is not): its wraps go first
  legGear(c, L, p, a, false);
  const bfa = backForearm(p);
  bracer(c, bx, by, bfa, L.asGlove, true);
  // off-hand katar (twin blades)
  if (L.asKatar >= 0) drawWeapon(c, 'katar', bx, by, bfa + 0.35, L.asKatar, undefined, L.wGlow);
  // knife pouch on the rear hip
  if (L.asPouch >= 0) pouchAt(c, -6.4 * (L.build ?? 1), a.hipY + 1.6, L.asPouch, (p.moving ? Math.sin(p.walk * 4.2) * 0.12 : 0) + 0.12);
  // sash knot tails at the rear hip
  const sw = p.moving ? Math.sin(p.walk * 4.2 + 1) : Math.sin(p.t * 2.2) * 0.3;
  c.fillStyle = shade(L.body2 ?? '#5a2a7a', -0.2);
  c.beginPath(); c.moveTo(-3.5, a.hipY - 0.5); c.quadraticCurveTo(-7 - sw, a.hipY + 5, -6.5 - sw * 2, a.hipY + 10); c.lineTo(-4.8 - sw * 2, a.hipY + 9.4); c.quadraticCurveTo(-5 - sw, a.hipY + 4, -2, a.hipY + 0.5); c.fill();
  drawHoodHead(c, L, p, a);
}

// ---------------------------------------------------------------- decor: front layer
function pauldron(c: C2D, L: AsLook, a: RigAnchors, arm: number): void {
  const metal = L.asCt >= 3;
  const base = metal ? (L.asCt >= 4 ? '#2a2036' : '#4a4e5c') : tone(L.asLeather, 0.1);
  c.save(); c.translate(a.shX + 2.4, a.shY + 1.6); c.rotate(-(arm - 0.12) * 0.3);
  for (let i = 1; i >= 0; i--) {
    const w = 3.6 - i * 0.5, yy = i * 1.9;
    const g = c.createLinearGradient(-w, yy - 2, w, yy + 2);
    g.addColorStop(0, metal ? '#aeb2c0' : tone(base, 0.4)); g.addColorStop(0.5, base); g.addColorStop(1, '#141018');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-w, yy + 1.4); c.quadraticCurveTo(0, yy - 2.4, w, yy + 1.4); c.lineTo(w * 0.85, yy + 2.3); c.quadraticCurveTo(0, yy - 0.4, -w * 0.85, yy + 2.3); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 0.4; c.stroke();
  }
  c.strokeStyle = L.asTrim; c.lineWidth = 0.45;
  c.beginPath(); c.moveTo(-3.3, 1.2); c.quadraticCurveTo(0, -2.1, 3.3, 1.2); c.stroke();
  if (L.asCt >= 4) { c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(190,110,255,0.8)'; c.beginPath(); c.arc(0, -0.2, 0.65, 0, TAU); c.fill(); }
  c.restore();
}

/** Mirror of the rig's limb() so the front arm can be redrawn over the torso details. */
function limb(c: C2D, x: number, y: number, ang: number, len: number, w: number, col: string): [number, number] {
  const ex = x + Math.sin(ang) * len, ey = y + Math.cos(ang) * len;
  c.lineCap = 'round';
  c.strokeStyle = shade(col, -0.35); c.lineWidth = w + 0.9;
  c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke();
  c.strokeStyle = col; c.lineWidth = w;
  c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke();
  if (w > 2.2) {
    const nx = -Math.cos(ang), ny = Math.sin(ang);
    const o = w * 0.22, sgn = nx + ny < 0 ? 1 : -1;
    c.strokeStyle = shade(col, 0.28); c.lineWidth = w * 0.32;
    c.beginPath(); c.moveTo(x + nx * o * sgn, y + ny * o * sgn); c.lineTo(ex + nx * o * sgn, ey + ny * o * sgn); c.stroke();
  }
  return [ex, ey];
}

/** Leather jerkin details on the torso: front panel with lacing, a bandolier of throwing knives, studs, runes. */
function torsoDetails(c: C2D, L: AsLook, p: Pose, a: RigAnchors): void {
  const b = L.build ?? 1, ww = 6.2 * b, sw2 = 7.4 * b;
  const top = a.shY + 2, bot = a.hipY + 2;
  c.save();
  c.beginPath(); c.moveTo(-ww, bot); c.lineTo(ww, bot); c.lineTo(a.shX + sw2, top); c.quadraticCurveTo(a.shX, a.shY - 3, a.shX - sw2, top); c.closePath();
  c.clip();
  const leather = L.asLeather, t = L.asCt;
  // front overlap panel (not seen from behind)
  if (!p.back) {
  c.fillStyle = tone(leather, 0.1);
  c.beginPath(); c.moveTo(a.shX + 1.6, a.shY - 1); c.lineTo(a.shX + sw2 + 1, top - 1); c.lineTo(ww + 1, bot); c.lineTo(2.6, bot); c.closePath(); c.fill();
  c.strokeStyle = tone(leather, -0.55); c.lineWidth = 0.7;
  c.beginPath(); c.moveTo(a.shX + 1.6, a.shY - 1); c.lineTo(2.6, bot); c.stroke();
  if (t <= 1) {
    // lacing
    c.strokeStyle = t === 1 ? '#b89a70' : '#8a7458'; c.lineWidth = 0.4;
    for (let i = 0; i < 4; i++) {
      const s0 = 0.15 + i * 0.2, s1 = s0 + 0.14;
      const x0 = a.shX + 1.6 + (2.6 - a.shX - 1.6) * s0, y0 = a.shY - 1 + (bot - a.shY + 1) * s0;
      const x1 = a.shX + 1.6 + (2.6 - a.shX - 1.6) * s1, y1 = a.shY - 1 + (bot - a.shY + 1) * s1;
      c.beginPath(); c.moveTo(x0 - 1, y0); c.lineTo(x1 + 1, y1); c.moveTo(x0 + 1, y0); c.lineTo(x1 - 1, y1); c.stroke();
    }
  } else {
    // rivets down the panel edge
    c.fillStyle = t >= 3 ? '#c8c0d8' : '#9a8a78';
    for (let i = 0; i < 5; i++) { const s1 = 0.12 + i * 0.19; c.beginPath(); c.arc(a.shX + 2.4 + (2.6 - a.shX - 1.6) * s1, a.shY - 0.5 + (bot - a.shY + 1) * s1, 0.42, 0, TAU); c.fill(); }
  }
  }
  // bandolier: front shoulder → back hip, knives tucked in
  const bx0 = a.shX + sw2 * 0.75, by0 = top - 1.6, bx1 = -ww - 1, by1 = bot - 4;
  const dx = bx1 - bx0, dy = by1 - by0, dl = Math.hypot(dx, dy), ux = dx / dl, uy = dy / dl;
  c.lineCap = 'butt';
  c.strokeStyle = '#140e10'; c.lineWidth = 3.1; c.beginPath(); c.moveTo(bx0, by0); c.lineTo(bx1, by1); c.stroke();
  c.strokeStyle = t >= 3 ? '#2a2230' : '#3a2820'; c.lineWidth = 2.3; c.beginPath(); c.moveTo(bx0, by0); c.lineTo(bx1, by1); c.stroke();
  c.strokeStyle = 'rgba(255,230,200,0.18)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(bx0 - uy * 0.8, by0 + ux * 0.8); c.lineTo(bx1 - uy * 0.8, by1 + ux * 0.8); c.stroke();
  for (let i = 0; i < 3; i++) {
    const s1 = 0.22 + i * 0.2;
    const kx = bx0 + dx * s1, ky = by0 + dy * s1;
    // knife grip across the strap with a bright pommel
    c.strokeStyle = t >= 4 ? '#1a1020' : '#2a1a14'; c.lineWidth = 1.1;
    c.beginPath(); c.moveTo(kx + uy * 2.2, ky - ux * 2.2); c.lineTo(kx - uy * 1.6, ky + ux * 1.6); c.stroke();
    c.fillStyle = t >= 4 ? '#c890ff' : '#d8d4c8'; c.beginPath(); c.arc(kx + uy * 2.4, ky - ux * 2.4, 0.55, 0, TAU); c.fill();
  }
  c.fillStyle = t >= 2 ? '#b8a070' : '#8a7050'; c.fillRect(bx0 + dx * 0.08 - 1, by0 + dy * 0.08 - 1, 2, 2);
  if (t >= 4 && !p.back) {
    // abyss rune on the chest
    c.globalCompositeOperation = 'lighter';
    const rx = a.shX + 3.4, ry = a.shY + 8.5, pulse = 0.65 + 0.35 * Math.sin(p.t * 3);
    c.strokeStyle = `rgba(190,110,255,${0.85 * pulse})`; c.lineWidth = 0.55;
    c.beginPath(); c.moveTo(rx, ry - 2.4); c.lineTo(rx + 1.4, ry); c.lineTo(rx, ry + 2.4); c.lineTo(rx - 1.4, ry); c.closePath(); c.moveTo(rx, ry - 3.4); c.lineTo(rx, ry + 3.4); c.stroke();
  }
  c.restore();
  c.lineCap = 'round';
}

/** Front arm geometry as the rig draws it (shoulder, elbow, hand). */
function frontArmGeo(L: AsLook, a: RigAnchors, arm: number): { sx: number; sy: number; ex: number; ey: number; hx: number; hy: number; armL: number; armW: number } {
  const b = L.build ?? 1, hgt = L.height ?? 1;
  const armL = 17 * hgt, armW = 3.8 * b;
  const sx = a.shX + 2, sy = a.shY + 2.2;
  const ex = sx + Math.sin(arm) * armL * 0.52, ey = sy + Math.cos(arm) * armL * 0.52;
  const fa = arm + 0.3;
  return { sx, sy, ex, ey, hx: ex + Math.sin(fa) * armL * 0.5, hy: ey + Math.cos(fa) * armL * 0.5, armL, armW };
}
/** True when our mirror of the rig's arm lands on the rig's own hand (i.e. the arm can be redrawn exactly). */
function frontArmFits(L: AsLook, a: RigAnchors, arm: number): boolean {
  const q = frontArmGeo(L, a, arm);
  return Math.abs(q.hx - a.fhx) <= 0.35 && Math.abs(q.hy - a.fhy) <= 0.35;
}

/** Redraws the front arm (sleeve, wrapped forearm, bracer, katar) on top of the torso details. */
function frontArmRedraw(c: C2D, L: AsLook, a: RigAnchors, arm: number): boolean {
  if (!frontArmFits(L, a, arm)) return false; // rig changed: leave its arm alone
  const { sx, sy, ex, ey, hx, hy, armL, armW } = frontArmGeo(L, a, arm);
  const fa = arm + 0.3;
  limb(c, sx, sy, arm, armL * 0.52, armW, L.body2 ?? L.body);
  limb(c, ex, ey, fa, armL * 0.5, armW * 0.9, L.skin);
  bracer(c, hx, hy, fa, L.asGlove, false);
  const wk = L.weapon ?? 'none';
  if (wk !== 'none') drawWeapon(c, wk, hx, hy, fa + 0.35, L.wTier ?? 0, L.wColor, L.wGlow);
  return true;
}

function collar(c: C2D, L: AsLook, a: RigAnchors): void {
  const x = a.shX, y = a.shY;
  const g = c.createLinearGradient(x - 6, y - 2, x + 6, y + 3);
  g.addColorStop(0, shade(L.asScarf, 0.12)); g.addColorStop(0.6, L.asScarf); g.addColorStop(1, shade(L.asScarf, -0.5));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(x - 6.2, y + 0.9); c.quadraticCurveTo(x - 1, y - 3.2, x + 6.4, y + 0.1);
  c.lineTo(x + 6, y + 2.8); c.quadraticCurveTo(x, y + 1.6, x - 5.6, y + 3.4); c.closePath(); c.fill();
  c.strokeStyle = shade(L.asScarf, -0.55); c.lineWidth = 0.45;
  c.beginPath(); c.moveTo(x - 4.5, y + 1.6); c.quadraticCurveTo(x, y - 0.8, x + 5, y + 0.9); c.stroke();
}

function heldKnives(c: C2D, x: number, y: number, ang: number, t: number): void {
  for (let i = -1; i <= 1; i++) {
    c.save(); c.translate(x, y); c.rotate(-(ang + i * 0.42));
    c.fillStyle = '#2a2026'; c.fillRect(-0.6, -1.5, 1.2, 3);
    const g = c.createLinearGradient(-1, 0, 1, 0); g.addColorStop(0, '#f4f4ff'); g.addColorStop(1, '#6a6e7e');
    c.fillStyle = g; c.beginPath(); c.moveTo(-1, 1.5); c.lineTo(1, 1.5); c.lineTo(0, 8); c.closePath(); c.fill();
    c.restore();
  }
  // glint
  const gl = 0.5 + 0.5 * Math.sin(t * 20);
  c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,255,255,${0.5 + gl * 0.5})`;
  const gx = x + Math.sin(ang) * 6, gy = y + Math.cos(ang) * 6;
  c.fillRect(gx - 2.5, gy - 0.25, 5, 0.5); c.fillRect(gx - 0.25, gy - 2.5, 0.5, 5); c.restore();
}

function heldBomb(c: C2D, x: number, y: number, t: number): void {
  const bx = x + 1.2, by = y - 2;
  const g = c.createRadialGradient(bx - 1, by - 1, 0.2, bx, by, 3.3);
  g.addColorStop(0, '#8a8098'); g.addColorStop(0.5, '#3a3444'); g.addColorStop(1, '#121016');
  c.fillStyle = g; c.beginPath(); c.arc(bx, by, 3.2, 0, TAU); c.fill();
  c.strokeStyle = '#6a4a8a'; c.lineWidth = 0.6; c.beginPath(); c.arc(bx, by, 3.2, -0.3, 1.2); c.stroke();
  c.strokeStyle = '#8a7050'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(bx + 1, by - 3); c.quadraticCurveTo(bx + 2.5, by - 5, bx + 1.6, by - 6.2); c.stroke();
  c.save(); c.globalCompositeOperation = 'lighter';
  const f = 1.6 + Math.sin(t * 40) * 0.5;
  const sg = c.createRadialGradient(bx + 1.6, by - 6.2, 0, bx + 1.6, by - 6.2, f * 2.4);
  sg.addColorStop(0, 'rgba(255,250,220,1)'); sg.addColorStop(0.35, 'rgba(255,170,60,0.8)'); sg.addColorStop(1, 'rgba(255,90,20,0)');
  c.fillStyle = sg; c.beginPath(); c.arc(bx + 1.6, by - 6.2, f * 2.4, 0, TAU); c.fill(); c.restore();
}

function heldDevice(c: C2D, x: number, y: number, t: number): void {
  c.save(); c.translate(x + 1.5, y - 2.5); c.rotate(Math.sin(t * 6) * 0.1);
  const g = c.createLinearGradient(-3, 0, 3, 0); g.addColorStop(0, '#9aa0ae'); g.addColorStop(0.5, '#4a4e5a'); g.addColorStop(1, '#1a1a22');
  c.fillStyle = g; c.fillRect(-2.6, -3.4, 5.2, 6);
  c.fillStyle = '#2a2a32'; c.fillRect(-3, -4, 6, 1.2); c.fillRect(-3, 2.2, 6, 1.2);
  c.fillStyle = '#c8ccd8';
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 2.6, -2.8); c.lineTo(s * 5.2, -4.4); c.lineTo(s * 2.6, -0.8); c.fill(); }
  c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(190,120,255,${0.7 + 0.3 * Math.sin(t * 14)})`;
  c.beginPath(); c.arc(0, -0.4, 1.1, 0, TAU); c.fill();
  c.restore();
}

function drawFront(c: C2D, L: AsLook, p: Pose, a: RigAnchors): void {
  const arm = frontArm(p, L.weapon ?? 'none');
  const fa = arm + 0.3;
  torsoDetails(c, L, p, a);
  collar(c, L, a);
  // front leg gear, then the front arm is redrawn over it (skipped if the arm can't be redrawn, so it never covers the arm)
  if (frontArmFits(L, a, arm)) { legGear(c, L, p, a, true); frontArmRedraw(c, L, a, arm); }
  else bracer(c, a.fhx, a.fhy, fa, L.asGlove, false);
  if (L.asCt >= 2) pauldron(c, L, a, arm);
  const act = L.asAct, k = L.asK;
  if (act === 'as_knives' && k < 0.47) heldKnives(c, a.fhx, a.fhy, fa + 0.35, p.t);
  if (act === 'as_smoke' && k < 0.5) heldBomb(c, a.fhx, a.fhy, p.t);
  if (act === 'as_sentry' && k < 0.5) heldDevice(c, a.fhx, a.fhy, p.t);
  if (act === 'as_venom' || (L.asKatar >= 3 && L.asKatar < 4)) {
    // venom beading and dripping off the blade tip
    const wa = fa + 0.35, len = 3 + KATAR_LEN[tierOf(L.wTier ?? 0)];
    const tx = a.fhx + Math.sin(wa) * len, ty = a.fhy + Math.cos(wa) * len;
    const n = act === 'as_venom' ? 3 : 1;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const ph = (p.t * (act === 'as_venom' ? 2.2 : 0.8) + i / n) % 1;
      c.fillStyle = `rgba(120,255,80,${0.9 * (1 - ph)})`;
      c.beginPath(); c.ellipse(tx, ty + ph * 9, 0.7, 1.05, 0, 0, TAU); c.fill();
    }
    c.fillStyle = 'rgba(120,255,80,0.25)'; c.beginPath(); c.arc(tx, ty, act === 'as_venom' ? 2 : 1.2, 0, TAU); c.fill();
    c.restore();
  }
  // shadow step: violet wisps shed from the body as it materialises
  if (act === 'as_shadow') {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const yy = a.shY + 3 + i * 7, s = (1 - k) * 0.7;
      c.strokeStyle = `rgba(170,90,255,${s})`; c.lineWidth = 1.4 - i * 0.2;
      c.beginPath(); c.moveTo(-3, yy); c.quadraticCurveTo(-10 - k * 10, yy - 2, -16 - k * 18 - i * 2, yy + 1); c.stroke();
    }
    c.restore();
  }
  // smoke evasion: the body dissolves toward the feet (offscreen canvas only), wisps coil around it
  const f = L.asFade;
  if (f > 0.01) {
    if (offscreen(c)) {
      c.save(); c.globalCompositeOperation = 'destination-out';
      const g = c.createLinearGradient(0, -70, 0, 2);
      g.addColorStop(0, `rgba(0,0,0,${0.3 * f})`); g.addColorStop(0.55, `rgba(0,0,0,${0.5 * f})`); g.addColorStop(1, `rgba(0,0,0,${0.92 * f})`);
      c.fillStyle = g; c.fillRect(-45, -85, 90, 95);
      for (let i = 0; i < 4; i++) {
        c.fillStyle = `rgba(0,0,0,${0.3 * f})`;
        c.beginPath(); c.ellipse(Math.sin(p.t * 2.3 + i * 1.9) * 5, -6 - i * 12 + Math.sin(p.t * 1.7 + i) * 3, 13, 1.8, 0.1, 0, TAU); c.fill();
      }
      c.restore();
    }
    // smoke curling round the shins in front of the body (the BUFF_ART puffs sit behind it)
    c.save();
    for (let i = 0; i < 3; i++) {
      const ph = p.t * (0.8 + i * 0.23) + i * 2.1;
      const px = Math.sin(ph) * 7 + (i - 1) * 2, py = -3 - i * 5 - (Math.sin(ph * 0.7) + 1) * 2;
      const w = 16 + 5 * Math.sin(ph * 1.3 + i);
      puff(c, i + 1, px, py, w, w * 0.62, (0.38 - i * 0.07) * f, i % 2 === 0);
    }
    c.globalAlpha = 1;
    c.restore();
  }
}

DECOR.as_garb = (c, L0, p, a, layer) => {
  const L = L0 as AsLook;
  if (L.asHood === undefined) return;
  if (layer === 'back') {
    // twin blades: during the twin-claw rake and the shadow strike the off-hand katar jabs out as the main hand
    // recovers (the rig's back arm only knows 'rest' or 'raised', so this is a quick snap, like a smear frame)
    if ((L.asAct === 'as_slash' && p.atk >= 0.52 && p.atk < 0.8) || (L.asAct === 'as_shadow' && p.atk >= 0.46 && p.atk < 0.78)) p.block = 1;
    cur = { L, a }; drawBack(c, L, p, a);
  }
  else { drawFront(c, L, p, a); cur = null; }
};

// ================================================================ weapon: katar
const KATAR_BLADE = ['#b4b0a6', '#ccd0d8', '#aeb4c2', '#9aaa9e', '#4e3e6c'];
const KATAR_BAR = ['#4a3426', '#3a3038', '#2e2a34', '#1e2a1e', '#1a1020'];
const KATAR_GUARD = ['#6a5040', '#7a7a86', '#8a6a3a', '#c8a040', '#2a1a3a'];
const KATAR_LEN = [12, 13.5, 14, 15.5, 17];

function bladePath(c: C2D, t: number, base: number, len: number, w: number, L: (n: number) => number): void {
  c.beginPath();
  if (t === 3) {
    // wavy kris-like blade
    const n = 10;
    c.moveTo(-w / 2, base);
    for (let i = 1; i <= n; i++) { const s = i / n; c.lineTo(-(w / 2) * (1 - s * 0.85) + Math.sin(s * Math.PI * 3) * L(0.7), base + len * s * 0.92); }
    c.lineTo(0, base + len);
    for (let i = n; i >= 1; i--) { const s = i / n; c.lineTo((w / 2) * (1 - s * 0.85) + Math.sin(s * Math.PI * 3) * L(0.7), base + len * s * 0.92); }
    c.lineTo(w / 2, base);
  } else {
    c.moveTo(-w / 2, base); c.lineTo(w / 2, base);
    if (t === 2) { c.lineTo(w * 0.44, base + len * 0.42); c.lineTo(w * 0.95, base + len * 0.36); c.quadraticCurveTo(w * 0.8, base + len * 0.5, w * 0.34, base + len * 0.6); }
    c.lineTo(w * 0.3, base + len * 0.8); c.lineTo(0, base + len); c.lineTo(-w * 0.3, base + len * 0.8);
  }
  c.closePath();
}

function drawKatar(c: C2D, tier: number, steel: string, _edge: string, L: (n: number) => number, glow?: string): void {
  const t = tierOf(tier);
  const white = steel === '#ffffff';
  const len = L(KATAR_LEN[t]), w = L([3.6, 3.8, 4, 4.2, 4.4][t]), base = L(3);
  const bladeCol = white ? '#ffffff' : KATAR_BLADE[t];
  // side bars running back along the forearm + grips inside the fist
  c.fillStyle = white ? '#ffffff' : KATAR_BAR[t];
  c.fillRect(-L(2.7), -L(6.5), L(1.1), L(6.5) + base); c.fillRect(L(1.6), -L(6.5), L(1.1), L(6.5) + base);
  c.fillStyle = white ? '#ffffff' : shade(KATAR_BAR[t], 0.35);
  c.fillRect(-L(2.7), -L(1.8), L(5.4), L(0.8)); c.fillRect(-L(2.7), L(0.6), L(5.4), L(0.8));
  // blade(s)
  const fill = (): void => {
    if (white) { c.fillStyle = '#ffffff'; return; }
    const g = c.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, shade(bladeCol, 0.55)); g.addColorStop(0.48, bladeCol); g.addColorStop(0.52, shade(bladeCol, -0.2)); g.addColorStop(1, shade(bladeCol, -0.55));
    c.fillStyle = g;
  };
  if (t === 4) {
    for (const s of [-1, 1]) {
      c.save(); c.translate(s * w * 0.42, base); c.rotate(-s * 0.16);
      fill(); bladePath(c, 0, 0, len * 0.72, w * 0.55, L); c.fill();
      c.restore();
    }
  }
  fill(); bladePath(c, t, base, len, w, L); c.fill();
  if (!white) {
    // central ridge / fuller and a bright edge line
    c.strokeStyle = t === 3 ? 'rgba(120,255,90,0.9)' : 'rgba(255,255,255,0.55)'; c.lineWidth = L(0.45);
    c.beginPath(); c.moveTo(0, base + L(0.6)); c.lineTo(0, base + len * 0.84); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = L(0.35); bladePath(c, t, base, len, w, L); c.stroke();
    if (t === 4) {
      c.save(); c.globalCompositeOperation = 'lighter'; c.shadowBlur = 0;
      c.strokeStyle = `rgba(200,140,255,${glow ? 0.9 : 0.7})`; c.lineWidth = L(0.55); bladePath(c, t, base, len, w, L); c.stroke();
      c.restore();
    }
  }
  // guard plate
  c.fillStyle = white ? '#ffffff' : KATAR_GUARD[t];
  c.beginPath(); c.moveTo(-w / 2 - L(1.2), base - L(1.1)); c.lineTo(w / 2 + L(1.2), base - L(1.1)); c.lineTo(w / 2 + L(0.4), base + L(0.7)); c.lineTo(-w / 2 - L(0.4), base + L(0.7)); c.closePath(); c.fill();
  if (!white && t >= 3) { c.fillStyle = t >= 4 ? '#c890ff' : '#6aff3a'; c.beginPath(); c.arc(0, base - L(0.2), L(0.75), 0, TAU); c.fill(); }
}

WEAPON_ART.katar = {
  style: 'punch',
  draw: drawKatar,
  icon(c, tier, gem) {
    const t = tierOf(tier);
    const k = 2.55;
    c.save();
    c.rotate(-Math.PI * 0.75);
    c.translate(0, -((3 + KATAR_LEN[t] - 6.5) * k) / 2);
    if (t >= 4) { c.shadowColor = '#a060ff'; c.shadowBlur = 10; }
    else if (t === 3) { c.shadowColor = '#50e030'; c.shadowBlur = 6; }
    drawKatar(c, t, '#c8ccd4', '#e0e0e8', (n) => n * k, t >= 4 ? '#a060ff' : undefined);
    c.shadowBlur = 0;
    // rarity gem on the guard
    c.fillStyle = gem; c.beginPath(); c.arc(0, 3 * k - 1.2, 2.1, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(-0.7, 3 * k - 1.9, 0.7, 0, TAU); c.fill();
    c.restore();
  },
};

// ================================================================ offhand: knife pouch (+ the assassin's rig hook)
function pouchIcon(c: C2D, tier: number, gem: string): void {
  const t = tierOf(tier);
  c.save(); c.translate(-2, 4); c.rotate(-0.12);
  const blade = t >= 4 ? '#9a80c8' : t >= 2 ? '#b8d8b0' : '#d8d8e0';
  const grip = t >= 4 ? '#221428' : t >= 2 ? '#2a3a1e' : '#5a3418';
  // knives
  for (const [x, a] of [[-9, -0.4], [-2, -0.12], [5, 0.18], [11, 0.42]] as [number, number][]) {
    c.save(); c.translate(x, -8); c.rotate(a);
    c.fillStyle = blade; c.beginPath(); c.moveTo(-2, -4); c.lineTo(2, -4); c.lineTo(0.4, -20); c.lineTo(-0.6, -19); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(-0.3, -18, 0.8, 13);
    c.fillStyle = '#9a9080'; c.fillRect(-3, -4.5, 6, 2);
    c.fillStyle = grip; c.fillRect(-1.6, -2.5, 3.2, 8);
    c.restore();
  }
  // pouch
  const leather = t >= 4 ? '#2e2240' : t >= 2 ? '#3e4a2a' : '#6a4628';
  const g = c.createLinearGradient(-18, 0, 18, 0);
  g.addColorStop(0, shade(leather, 0.3)); g.addColorStop(0.55, leather); g.addColorStop(1, shade(leather, -0.5));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(-17, -6); c.lineTo(17, -7); c.quadraticCurveTo(20, 14, 12, 22); c.lineTo(-12, 23); c.quadraticCurveTo(-21, 14, -17, -6); c.fill();
  c.strokeStyle = shade(leather, -0.65); c.lineWidth = 1.4; c.stroke();
  c.strokeStyle = t >= 4 ? 'rgba(200,184,224,0.7)' : 'rgba(255,230,190,0.35)'; c.lineWidth = 0.9; c.setLineDash([2, 2]);
  c.beginPath(); c.moveTo(-14, 10); c.quadraticCurveTo(0, 22, 14, 9); c.stroke(); c.setLineDash([]);
  // flap
  c.fillStyle = shade(leather, -0.25);
  c.beginPath(); c.moveTo(-18, -7); c.lineTo(18, -8); c.lineTo(13, 6); c.quadraticCurveTo(0, 10, -13, 6); c.closePath(); c.fill();
  // venom vial / shadow clasp
  if (t >= 2 && t < 4) {
    c.fillStyle = 'rgba(140,255,100,0.9)'; c.fillRect(8, -2, 5, 11);
    c.fillStyle = '#d8d0c0'; c.fillRect(8, -4, 5, 2.5);
  }
  const cl = t >= 4 ? '#c890ff' : gem;
  if (t >= 4) { c.shadowColor = '#a060ff'; c.shadowBlur = 12; }
  c.fillStyle = cl; c.beginPath(); c.arc(0, 5, 3.6, 0, TAU); c.fill();
  c.shadowBlur = 0;
  c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(-1, 4, 1.2, 0, TAU); c.fill();
  c.restore();
}

OFFHAND_ART.pouch = {
  draw(c, _x, _y, tier, p) { pouchAt(c, -6, -20.5 + (p.moving ? Math.abs(Math.cos(p.walk * 4.2)) * 0.8 : 0), tier, 0.12); },
  icon: pouchIcon,
};
OFFHAND_ART.as_rig = {
  draw(c, x, y, _tier, p) { if (cur) drawMid(c, cur.L, p, cur.a, x, y); },
  icon: pouchIcon,
};

// ================================================================ ghost afterimage sprite (shadow step)
let ghostCv: HTMLCanvasElement | null = null;
let ghostFlip = false;
function renderGhost(flip: boolean): boolean {
  const L = lastLook;
  if (!L || typeof document === 'undefined') return false;
  if (!ghostCv) { ghostCv = document.createElement('canvas'); ghostCv.width = 180; ghostCv.height = 200; }
  const g = ghostCv.getContext('2d');
  if (!g) return false;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.clearRect(0, 0, 180, 200);
  g.setTransform(2, 0, 0, 2, 90, 186);
  const pose: Pose = { t: 0.3, walk: 0, moving: true, atk: 0.52, cast: -1, hit: 0, dead: -1, flip, back: false, alpha: 1, frozen: false, chill: false };
  drawBiped(g, { ...L, asFade: 0, asAct: '', wGlow: undefined } as AsLook, pose);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  const gr = g.createLinearGradient(0, 40, 0, 200);
  gr.addColorStop(0, 'rgba(220,170,255,0.92)'); gr.addColorStop(0.6, 'rgba(140,70,240,0.9)'); gr.addColorStop(1, 'rgba(60,20,130,0.6)');
  g.fillStyle = gr; g.fillRect(0, 0, 180, 200);
  g.globalCompositeOperation = 'source-over';
  ghostFlip = flip;
  return true;
}

// ================================================================ effects
const V = '170,100,255';

EFFECT_ART.as_claw = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const cy = sy - 24 * z;
    const sd = screenDir(e.ang);
    const base = Math.atan2(sd.dy, sd.dx) + (e.seed > 500 ? 1.1 : -1.1) + Math.PI / 2;
    const grow = ease(Math.min(1, k / 0.3)), fade = k < 0.35 ? 1 : 1 - (k - 0.35) / 0.65;
    c.save(); c.translate(sx, cy); c.rotate(base); c.globalCompositeOperation = 'lighter';
    for (let i = -1; i <= 1; i++) {
      const off = i * 4.2 * z, L = 17 * z * (1 - Math.abs(i) * 0.15);
      c.strokeStyle = `rgba(${V},${0.55 * fade})`; c.lineWidth = 3.4 * z; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-L, off); c.quadraticCurveTo(0, off - 3 * z, -L + 2 * L * grow, off); c.stroke();
      c.strokeStyle = `rgba(255,245,255,${0.95 * fade})`; c.lineWidth = 1.1 * z;
      c.beginPath(); c.moveTo(-L, off); c.quadraticCurveTo(0, off - 3 * z, -L + 2 * L * grow, off); c.stroke();
    }
    c.restore();
  },
};

EFFECT_ART.as_thrust = {
  air(e, d) {
    const { c, cam, z, k } = d;
    const x0 = cam.sxOf(e.x, e.y), y0 = cam.syOf(e.x, e.y) - 24 * z;
    const x1 = cam.sxOf(e.x2 ?? e.x, e.y2 ?? e.y), y1 = cam.syOf(e.x2 ?? e.x, e.y2 ?? e.y) - 22 * z;
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
    const ux = dx / l, uy = dy / l;
    const head = ease(Math.min(1, k / 0.25)), fade = 1 - k;
    const hx = x0 + dx * (0.25 + 0.95 * head), hy = y0 + dy * (0.25 + 0.95 * head);
    const tx = x0 + dx * (0.1 + 0.6 * head), ty = y0 + dy * (0.1 + 0.6 * head);
    c.save(); c.globalCompositeOperation = 'lighter';
    const w = 4.5 * z;
    c.fillStyle = `rgba(110,255,80,${0.55 * fade})`;
    c.beginPath(); c.moveTo(tx - uy * w * 0.2, ty + ux * w * 0.2); c.lineTo(hx + ux * 6 * z, hy + uy * 6 * z); c.lineTo(tx + uy * w * 0.2, ty - ux * w * 0.2); c.lineTo(tx - ux * 4 * z, ty - uy * 4 * z); c.closePath(); c.fill();
    c.strokeStyle = `rgba(230,255,220,${0.95 * fade})`; c.lineWidth = 1.3 * z; c.lineCap = 'round';
    c.beginPath(); c.moveTo(tx, ty); c.lineTo(hx + ux * 5 * z, hy + uy * 5 * z); c.stroke();
    c.restore();
  },
};

EFFECT_ART.as_venomSplash = {
  ground(e, d) {
    const { c, sx, sy, k, rx } = d;
    const rr = rx * (0.3 + ease(k) * 0.9);
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - k) * 0.8;
    c.strokeStyle = 'rgba(110,255,70,0.8)'; c.lineWidth = 2.2 * d.z * (1 - k);
    c.beginPath(); c.ellipse(sx, sy, rr, rr * 0.5, 0, 0, TAU); c.stroke();
    const g = c.createRadialGradient(sx, sy, 0, sx, sy, rr);
    g.addColorStop(0, 'rgba(80,220,40,0.35)'); g.addColorStop(1, 'rgba(80,220,40,0)');
    c.fillStyle = g; c.save(); c.translate(sx, sy); c.scale(1, 0.5); c.beginPath(); c.arc(0, 0, rr, 0, TAU); c.restore(); c.fill();
    c.restore();
  },
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const cy = sy - 20 * z;
    c.save(); c.globalCompositeOperation = 'lighter';
    // splash crown: arcs of venom thrown outward
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = e.seed + (i / n) * TAU;
      const dist = (6 + 18 * ease(k)) * z, up = Math.sin(k * Math.PI) * 10 * z;
      const x = sx + Math.cos(a) * dist, y = cy + Math.sin(a) * dist * 0.5 - up + k * k * 16 * z;
      c.fillStyle = `rgba(130,255,90,${0.85 * (1 - k)})`;
      c.beginPath(); c.ellipse(x, y, 1.6 * z * (1 - k * 0.5), 2.4 * z * (1 - k * 0.5), a, 0, TAU); c.fill();
    }
    if (k < 0.3) {
      const f = 1 - k / 0.3;
      const g = c.createRadialGradient(sx, cy, 0, sx, cy, 18 * z);
      g.addColorStop(0, `rgba(230,255,200,${0.9 * f})`); g.addColorStop(0.4, `rgba(100,255,60,${0.6 * f})`); g.addColorStop(1, 'rgba(40,160,20,0)');
      c.fillStyle = g; c.beginPath(); c.arc(sx, cy, 18 * z, 0, TAU); c.fill();
    }
    c.restore();
  },
  light: (_e, k) => [1.6 * (1 - k), '90,255,60'],
};

/** Lingering venom on a struck enemy: sickly mist and bubbles that rise and pop. */
EFFECT_ART.as_toxin = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const ph = clamp01(k * 1.25 - i * 0.12);
      const mx = sx + (hash(i * 7.3 + e.seed) - 0.5) * 16 * z, my = sy - (14 + ph * 22) * z;
      const mr = (9 + ph * 14) * z;
      const a = Math.sin(Math.min(1, ph * 1.2) * Math.PI) * 0.3;
      if (a <= 0.01) continue;
      const g = c.createRadialGradient(mx, my, 0, mx, my, mr);
      g.addColorStop(0, `rgba(110,220,60,${a})`); g.addColorStop(1, 'rgba(40,120,20,0)');
      c.fillStyle = g; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill();
    }
    const n = d.fx.low ? 4 : 8;
    for (let i = 0; i < n; i++) {
      const t0 = hash(i + e.seed) * 0.45;
      const kk = (k - t0) / 0.5;
      if (kk < 0 || kk > 1) continue;
      const x = sx + (hash(i * 3.1 + e.seed) - 0.5) * 24 * z + Math.sin(kk * 7 + i) * 2 * z;
      const y = sy - (12 + kk * 28 + hash(i * 1.9) * 8) * z;
      const r = (1.1 + hash(i * 5.3 + e.seed) * 1.5) * z * (0.7 + kk * 0.5);
      if (kk < 0.82) {
        c.strokeStyle = 'rgba(170,255,120,0.9)'; c.lineWidth = 0.7 * z;
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
        c.fillStyle = 'rgba(80,200,40,0.35)'; c.fill();
        c.fillStyle = 'rgba(240,255,230,0.9)'; c.fillRect(x - r * 0.45, y - r * 0.55, r * 0.35, r * 0.35);
      } else {
        const pk = (kk - 0.82) / 0.18;
        c.strokeStyle = `rgba(190,255,150,${1 - pk})`; c.lineWidth = 0.6 * z;
        c.beginPath(); c.arc(x, y, r * (1 + pk * 1.6), 0, TAU); c.stroke();
      }
    }
    c.restore();
  },
  light: (_e, k) => [1.1 * (1 - k), '90,255,60'],
};

EFFECT_ART.as_fan = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const sd = screenDir(e.ang);
    const base = Math.atan2(sd.dy, sd.dx);
    const span = e.power;
    c.save(); c.translate(sx, sy - 24 * z); c.scale(1, 0.62); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const r = (20 + i * 12 + ease(k) * 26) * z;
      c.strokeStyle = `rgba(225,225,255,${0.5 * (1 - k) * (1 - i * 0.25)})`; c.lineWidth = (1.6 - i * 0.3) * z;
      c.beginPath(); c.arc(0, 0, r, base - span / 2, base + span / 2); c.stroke();
    }
    c.restore();
  },
};

EFFECT_ART.as_smokeBurst = {
  ground(e, d) {
    const { c, z, sx, sy, k, rx } = d;
    const ek = 1 - Math.pow(1 - k, 3);
    c.save();
    c.globalAlpha = (1 - k) * 0.85;
    c.strokeStyle = 'rgba(150,136,180,0.8)'; c.lineWidth = 7 * z * (1 - k);
    c.beginPath(); c.ellipse(sx, sy, rx * ek, rx * 0.5 * ek, 0, 0, TAU); c.stroke();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = 'rgba(190,140,255,0.6)'; c.lineWidth = 1.6 * z;
    c.beginPath(); c.ellipse(sx, sy, rx * ek * 1.04, rx * 0.52 * ek, 0, 0, TAU); c.stroke();
    c.restore();
  },
  air(e, d) {
    const { c, z, sx, sy, k, rx } = d;
    // billow: a ring of puffs blasting out to the rim of the cloud (outer ones faster), plus a column that
    // mushrooms up out of the pop; they hand over to the lingering cloud as they thin out
    const low = d.fx.low;
    const n = low ? 7 : 14;
    const fade = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
    for (let i = 0; i < n; i++) {
      const h1 = hash(i + e.seed), h2 = hash(i * 2.1 + e.seed);
      const ek = 1 - Math.pow(1 - Math.min(1, k * (1.1 + h1 * 0.5)), 2.6);
      const an = (i / n) * TAU + e.seed + h2 * 0.4;
      const rr = rx * ek * (0.62 + 0.4 * h1);
      const pw = (26 + 50 * ek) * z * (0.75 + 0.5 * h2);
      puff(c, i, sx + Math.cos(an) * rr, sy + Math.sin(an) * rr * 0.5 - (6 + 16 * ek + 10 * h2 * ek) * z, pw, pw * 0.78, fade * 0.92, i % 2 === 0);
    }
    for (let i = 0; i < (low ? 2 : 4); i++) {
      const ek = 1 - Math.pow(1 - Math.min(1, k * 1.3), 2);
      const pw = (30 + 34 * ek + i * 6) * z;
      const ox = (hash(i * 3.7 + e.seed) - 0.5) * 18 * z;
      puff(c, i + 2, sx + ox, sy - (10 + (22 + i * 16) * ek) * z, pw, pw * 0.8, fade * (0.85 - i * 0.12), i % 2 === 1);
    }
    c.globalAlpha = 1;
    if (k > 0.35) return;
    const f = 1 - k / 0.35;
    c.save(); c.globalCompositeOperation = 'lighter';
    const cy = sy - 14 * z;
    const g = c.createRadialGradient(sx, cy, 0, sx, cy, 40 * z);
    g.addColorStop(0, `rgba(255,245,255,${0.9 * f})`); g.addColorStop(0.25, `rgba(200,160,255,${0.6 * f})`); g.addColorStop(1, 'rgba(120,80,200,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(sx, cy, 40 * z, 30 * z, 0, 0, TAU); c.fill();
    c.restore();
  },
  light: (_e, k) => [3.2 * (1 - k), '190,150,255'],
};

EFFECT_ART.as_ghost = {
  air(e, d) {
    if (!ghostCv) return;
    const { c, z, sx, sy, k } = d;
    const s = z * 1.22 * 0.5;
    const w = 180 * s, h = 200 * s;
    const drift = k * 10 * z;
    c.save(); c.globalCompositeOperation = 'lighter';
    const flip = ghostFlip;
    const copies = d.fx.low ? 1 : 3;
    for (let i = 0; i < copies; i++) {
      c.globalAlpha = (1 - k) * (i === 0 ? 0.8 : 0.35);
      const ox = (flip ? 1 : -1) * i * 6 * z * (0.5 + k);
      c.save(); c.translate(sx + ox, sy - drift); if (flip) c.scale(-1, 1);
      c.drawImage(ghostCv, -w / 2, -186 * s, w * (1 + k * 0.15), h * (1 - k * 0.1));
      c.restore();
    }
    c.restore();
  },
  light: (_e, k) => [2.2 * (1 - k), '160,90,255'],
};

EFFECT_ART.as_shadowTrail = {
  air(e, d) {
    const { c, cam, z, k } = d;
    const x0 = cam.sxOf(e.x, e.y), y0 = cam.syOf(e.x, e.y) - 22 * z;
    const x1 = cam.sxOf(e.x2 ?? e.x, e.y2 ?? e.y), y1 = cam.syOf(e.x2 ?? e.x, e.y2 ?? e.y) - 22 * z;
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
    if (l < 2) return;
    const nx = -dy / l, ny = dx / l;
    const tail = ease(Math.min(1, k * 1.6));
    const ax = x0 + dx * tail, ay = y0 + dy * tail;
    c.save();
    // dark smear
    c.globalAlpha = (1 - k) * 0.55;
    c.fillStyle = '#12061e';
    const w = 9 * z * (1 - k * 0.6);
    c.beginPath(); c.moveTo(ax + nx * w * 0.3, ay + ny * w * 0.3); c.quadraticCurveTo((ax + x1) / 2 + nx * w, (ay + y1) / 2 + ny * w, x1, y1); c.quadraticCurveTo((ax + x1) / 2 - nx * w, (ay + y1) / 2 - ny * w, ax - nx * w * 0.3, ay - ny * w * 0.3); c.fill();
    // violet core with a jagged edge
    c.globalAlpha = 1 - k; c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(${V},0.7)`; c.lineWidth = 3.5 * z * (1 - k); c.lineCap = 'round';
    c.beginPath(); c.moveTo(ax, ay);
    for (let i = 1; i <= 8; i++) { const s = i / 8; const j = Math.sin(e.seed + i * 2.7) * 3 * z * (1 - s); c.lineTo(ax + (x1 - ax) * s + nx * j, ay + (y1 - ay) * s + ny * j); }
    c.stroke();
    c.strokeStyle = `rgba(245,225,255,${0.9 * (1 - k)})`; c.lineWidth = 1 * z; c.beginPath(); c.moveTo(ax, ay); c.lineTo(x1, y1); c.stroke();
    c.restore();
  },
};

EFFECT_ART.as_shadowBurst = {
  ground(e, d) {
    const { c, sx, sy, k, rx, z } = d;
    const ek = 1 - Math.pow(1 - k, 2.5);
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k;
    const g = c.createRadialGradient(sx, sy, rx * ek * 0.5, sx, sy, Math.max(1, rx * ek));
    g.addColorStop(0, `rgba(${V},0)`); g.addColorStop(0.8, `rgba(${V},0.6)`); g.addColorStop(1, `rgba(${V},0)`);
    c.fillStyle = g; c.save(); c.translate(sx, sy); c.scale(1, 0.5); c.beginPath(); c.arc(0, 0, Math.max(1, rx * ek), 0, TAU); c.restore(); c.fill();
    // runic tick marks
    c.strokeStyle = 'rgba(220,180,255,0.8)'; c.lineWidth = 1.2 * z;
    for (let i = 0; i < 8; i++) { const a = e.seed + (i / 8) * TAU; const r0 = rx * ek * 0.75, r1 = rx * ek * 0.95; c.beginPath(); c.moveTo(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0 * 0.5); c.lineTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1 * 0.5); c.stroke(); }
    c.restore();
  },
  air(e, d) {
    const { c, sx, sy, k, z } = d;
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.max(0, 1 - k * 1.6);
    const g = c.createLinearGradient(sx, sy - 70 * z, sx, sy);
    g.addColorStop(0, `rgba(${V},0)`); g.addColorStop(0.6, `rgba(${V},0.5)`); g.addColorStop(1, 'rgba(225,190,255,0.6)');
    const w = 14 * z * (1 - k * 0.6);
    c.fillStyle = g; c.beginPath(); c.moveTo(sx - w, sy); c.quadraticCurveTo(sx - w * 0.5, sy - 40 * z, sx, sy - 70 * z); c.quadraticCurveTo(sx + w * 0.5, sy - 40 * z, sx + w, sy); c.closePath(); c.fill();
    c.restore();
  },
  light: (_e, k) => [2.6 * (1 - k), '170,100,255'],
};

EFFECT_ART.as_xslash = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const cy = sy - 24 * z;
    const R = 26 * z;
    c.save(); c.translate(sx, cy); c.globalCompositeOperation = 'lighter';
    const cut = (rot: number, delay: number): void => {
      const kk = clamp01((k - delay) / 0.22);
      if (kk <= 0) return;
      const fade = k < 0.45 ? 1 : 1 - (k - 0.45) / 0.55;
      c.save(); c.rotate(rot);
      const len = R * 2 * ease(kk);
      const w = 5 * z * (1 - Math.abs(0.5 - kk) * 0.6);
      // a black-violet rift under the glow, so the cut reads as a shadow blade even inside the crit flash
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = `rgba(22,4,40,${0.8 * fade})`;
      c.beginPath(); c.moveTo(-R * 1.08, 0); c.quadraticCurveTo(-R + len / 2, -w * 2.3, -R * 1.08 + len * 1.08, 0); c.quadraticCurveTo(-R + len / 2, w * 0.9, -R * 1.08, 0); c.fill();
      c.globalCompositeOperation = 'lighter';
      // glow body
      c.fillStyle = `rgba(${V},${0.55 * fade})`;
      c.beginPath(); c.moveTo(-R, 0); c.quadraticCurveTo(-R + len / 2, -w * 1.8, -R + len, 0); c.quadraticCurveTo(-R + len / 2, w * 0.6, -R, 0); c.fill();
      c.fillStyle = `rgba(255,248,255,${0.95 * fade})`;
      c.beginPath(); c.moveTo(-R, 0); c.quadraticCurveTo(-R + len / 2, -w * 0.7, -R + len, 0); c.quadraticCurveTo(-R + len / 2, w * 0.15, -R, 0); c.fill();
      c.restore();
    };
    const a0 = e.ang;
    cut(a0 + 0.75, 0);
    cut(a0 - 0.75, 0.1);
    // flash at the crossing
    if (k < 0.4) {
      const f = 1 - k / 0.4;
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 17 * z);
      g.addColorStop(0, `rgba(245,225,255,${0.85 * f})`); g.addColorStop(0.3, `rgba(${V},${0.6 * f})`); g.addColorStop(1, 'rgba(90,30,200,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, 17 * z, 0, TAU); c.fill();
    }
    c.restore();
  },
  light: (_e, k) => [2.4 * (1 - k), '190,120,255'],
};

EFFECT_ART.as_runeRing = {
  ground(e, d) {
    const { c, sx, sy, k, rx, z } = d;
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.sin(Math.min(1, k) * Math.PI) * 0.9;
    const rr = rx * (0.6 + 0.4 * ease(k * 2));
    c.strokeStyle = `rgba(${V},0.9)`; c.lineWidth = 1.4 * z;
    c.beginPath(); c.ellipse(sx, sy, rr, rr * 0.5, 0, 0, TAU); c.stroke();
    c.beginPath(); c.ellipse(sx, sy, rr * 0.7, rr * 0.35, 0, 0, TAU); c.stroke();
    for (let i = 0; i < 6; i++) {
      const a = e.seed + k * 2 + (i / 6) * TAU;
      c.beginPath(); c.moveTo(sx + Math.cos(a) * rr * 0.7, sy + Math.sin(a) * rr * 0.35); c.lineTo(sx + Math.cos(a + 0.5) * rr, sy + Math.sin(a + 0.5) * rr * 0.5); c.stroke();
    }
    c.restore();
  },
};

// ================================================================ fx events
FX_EVENT.as_rake = (e, host) => {
  const { fx, low } = host;
  const ang = Math.atan2(e.y - (e.y2 ?? e.y), e.x - (e.x2 ?? e.x));
  fx.effect('as_claw', e.x, e.y, 0.3, { ang, seed: Math.random() * 1000 });
  fx.burst(e.x, e.y, low ? 3 : 7, { dir: { x: Math.cos(ang), y: Math.sin(ang) }, spread: 1.6, color: '#e8d8ff', kind: 'spark', size: 1.3, speed: 4.5, up: 70, grav: 160, life: 0.3, add: true, z: 24 });
};

FX_EVENT.as_stab = (e, host) => {
  host.fx.effect('as_thrust', e.x, e.y, 0.2, { x2: e.x2, y2: e.y2 });
};

FX_EVENT.as_venom = (e, host) => {
  const { fx, low } = host;
  const ang = Math.atan2(e.y - (e.y2 ?? e.y), e.x - (e.x2 ?? e.x));
  const dir = { x: Math.cos(ang), y: Math.sin(ang) };
  fx.effect('as_venomSplash', e.x, e.y, 0.55, { r: 0.9, seed: Math.random() * 6 });
  fx.effect('as_toxin', e.x, e.y, 1.2, { seed: Math.random() * 50 });
  fx.burst(e.x, e.y, low ? 6 : 14, { dir, spread: 2.2, color: '#6aff3a', kind: 'drop', size: 1.7, speed: 4, up: 120, grav: 330, life: 0.8, z: 22 });
  fx.burst(e.x, e.y, low ? 3 : 7, { color: '#b8ff90', kind: 'dot', size: 1.4, speed: 0.8, up: 35, grav: -10, life: 1.1, add: true, z: 18 });
  fx.burst(e.x, e.y, low ? 1 : 3, { color: '#2a6a1a', kind: 'smoke', size: 4, speed: 0.4, up: 20, life: 1.2, z: 18 });
  fx.stain(e.x, e.y, 'slime', 0.32);
  // venom keeps dripping from the wound for a moment
  for (let i = 1; i <= (low ? 2 : 4); i++) {
    host.delay(i * 0.22, () => fx.add({ x: e.x + (Math.random() - 0.5) * 0.3, y: e.y + (Math.random() - 0.5) * 0.3, z: 20 + Math.random() * 8, vz: -10, grav: 280, color: '#6aff3a', kind: 'drop', size: 1.5, life: 0.6 }));
  }
};

FX_EVENT.as_throw = (e, host) => {
  const { fx, low } = host;
  const dx = (e.x2 ?? e.x + 1) - e.x, dy = (e.y2 ?? e.y) - e.y;
  const ang = Math.atan2(dy, dx);
  fx.effect('as_fan', e.x, e.y, 0.22, { ang, power: (e.n ?? 5) >= 7 ? 1.25 : 0.95 });
  fx.burst(e.x + dx * 0.4, e.y + dy * 0.4, low ? 3 : 7, { dir: { x: dx, y: dy }, spread: 1.1, color: '#f4f2ff', kind: 'glint', size: 1.1, speed: 7, up: 10, life: 0.16, add: true, z: 26 });
};

FX_EVENT.as_knifeHit = (e, host) => {
  const { fx, low } = host;
  const dx = e.x - (e.x2 ?? e.x), dy = e.y - (e.y2 ?? e.y);
  fx.burst(e.x, e.y, low ? 2 : 5, { dir: { x: -dx, y: -dy }, spread: 2, color: '#fff4dc', kind: 'streak', size: 1, speed: 5, up: 60, grav: 180, life: 0.22, add: true, z: 20 });
  fx.add({ x: e.x, y: e.y, z: 22, color: '#ffffff', kind: 'glint', size: 1.6, life: 0.12, add: true });
};

FX_EVENT.as_smokeBomb = (e, host) => {
  const { fx, low } = host;
  const r = e.r ?? 3.5;
  // the billow itself is drawn from the puff sprites (as_smokeBurst); the engine's flat 'smoke' discs read as balls here
  fx.effect('as_smokeBurst', e.x, e.y, 1.1, { r, seed: Math.random() * 50 });
  fx.burst(e.x, e.y, low ? 4 : 10, { color: '#8a7ea0', kind: 'ash', size: 1.2, speed: r * 1.1, up: 40, grav: 20, life: 1.1, z: 10 });
  fx.burst(e.x, e.y, low ? 5 : 12, { color: '#ffd8a0', kind: 'spark', size: 1.4, speed: 5, up: 130, grav: 220, life: 0.45, add: true, z: 12 });
  fx.burst(e.x, e.y, low ? 3 : 8, { color: '#c8a0ff', kind: 'glint', size: 1.2, speed: 3, up: 60, life: 0.35, add: true, z: 16 });
  fx.stain(e.x, e.y, 'ash', 0.6);
};

FX_EVENT.as_shadowStep = (e, host) => {
  const { fx, low } = host;
  const x2 = e.x2 ?? e.x, y2 = e.y2 ?? e.y;
  const ang = Math.atan2(y2 - e.y, x2 - e.x);
  const sd = screenDir(ang);
  if (renderGhost(sd.dx < 0)) fx.effect('as_ghost', e.x, e.y, 0.55, { ang });
  if (Math.hypot(x2 - e.x, y2 - e.y) > 0.3) fx.effect('as_shadowTrail', e.x, e.y, 0.4, { x2, y2, seed: Math.random() * 10 });
  fx.effect('as_shadowBurst', x2, y2, 0.45, { r: 1.3, seed: Math.random() * 6 });
  fx.burst(e.x, e.y, low ? 5 : 12, { color: '#2a0a3e', kind: 'smoke', size: 4.5, speed: 1.2, up: 50, life: 1, z: 20 });
  fx.burst(e.x, e.y, low ? 4 : 10, { color: '#b070ff', kind: 'streak', size: 1.2, speed: 4, up: 90, grav: 40, life: 0.4, add: true, z: 24 });
  fx.burst(x2, y2, low ? 5 : 14, { color: '#c890ff', kind: 'spark', size: 1.3, speed: 3.5, up: 80, grav: 60, life: 0.45, add: true, z: 20 });
  host.shake(0.12);
};

FX_EVENT.as_shadowSlash = (e, host) => {
  const { fx, low } = host;
  const dx = e.x - (e.x2 ?? e.x), dy = e.y - (e.y2 ?? e.y);
  const sd = screenDir(Math.atan2(dy, dx));
  fx.effect('as_xslash', e.x, e.y, 0.42, { ang: Math.atan2(sd.dy, sd.dx) });
  fx.effect('shock', e.x, e.y, 0.35, { r: 1.7, c: V });
  fx.burst(e.x, e.y, low ? 6 : 14, { dir: { x: dx, y: dy }, spread: 1.8, color: '#3a0a4e', kind: 'drop', size: 1.9, speed: 5.5, up: 110, grav: 320, life: 0.8, z: 24 });
  fx.burst(e.x, e.y, low ? 5 : 12, { dir: { x: dx, y: dy }, spread: 2.4, color: '#d8b0ff', kind: 'streak', size: 1.3, speed: 8, up: 70, grav: 150, life: 0.35, add: true, z: 24 });
  host.shake(0.3);
};

FX_EVENT.as_sentryDrop = (e, host) => {
  const { fx, low } = host;
  host.delay(0.2, () => {
    fx.effect('dust', e.x, e.y, 0.5, { r: 0.8 });
    fx.effect('as_runeRing', e.x, e.y, 0.7, { r: 0.75, seed: Math.random() * 6 });
    fx.burst(e.x, e.y, low ? 3 : 7, { color: '#fff0c8', kind: 'spark', size: 1.1, speed: 3, up: 80, grav: 260, life: 0.35, add: true, z: 6 });
    fx.burst(e.x, e.y, low ? 2 : 4, { color: '#5a5048', kind: 'smoke', size: 3.5, speed: 1, up: 15, life: 0.7, z: 3 });
  });
};

FX_EVENT.as_sentryShot = (e, host) => {
  const { fx, low } = host;
  const dx = (e.x2 ?? e.x) - e.x, dy = (e.y2 ?? e.y) - e.y;
  fx.burst(e.x, e.y, low ? 1 : 3, { dir: { x: dx, y: dy }, spread: 0.6, color: '#e8d8ff', kind: 'spark', size: 1, speed: 5, up: 25, life: 0.18, add: true, z: 20 });
};

FX_EVENT.as_sentryBreak = (e, host) => {
  const go = (): void => {
    const { fx, low } = host;
    fx.burst(e.x, e.y, low ? 3 : 7, { color: '#6a6e7a', kind: 'shard', size: 1.5, speed: 2.5, up: 110, grav: 300, life: 0.8, z: 12 });
    fx.burst(e.x, e.y, low ? 3 : 6, { color: '#c890ff', kind: 'spark', size: 1.1, speed: 2, up: 70, life: 0.4, add: true, z: 14 });
    fx.burst(e.x, e.y, low ? 1 : 3, { color: '#4a4450', kind: 'smoke', size: 3.5, speed: 0.6, up: 20, life: 0.8, z: 6 });
  };
  if ((e.r ?? 0) > 0) host.delay(e.r ?? 0, go); else go();
};

// ================================================================ projectiles
function spinKnife(c: C2D, glint: number): void {
  // local: blade along +x, handle along -x (1 unit = 1 px at zoom 1)
  // dark silhouette first so the steel reads on bright floors
  c.fillStyle = 'rgba(8,4,14,0.75)';
  c.beginPath(); c.moveTo(-6.4, -1.5); c.lineTo(0, -2.3); c.lineTo(8.3, -0.7); c.lineTo(9.8, 0.3); c.lineTo(0, 2.3); c.lineTo(-6.4, 1.5); c.closePath(); c.fill();
  c.fillStyle = '#2a1e26'; c.fillRect(-5, -0.9, 4.6, 1.8);
  c.fillStyle = '#6a3a9a'; c.fillRect(-4.2, -0.9, 0.8, 1.8); c.fillRect(-2.4, -0.9, 0.8, 1.8);
  c.strokeStyle = '#a8a298'; c.lineWidth = 0.7; c.beginPath(); c.arc(-6, 0, 1.2, 0, TAU); c.stroke();
  c.fillStyle = '#b4aea0'; c.fillRect(-0.6, -1.8, 1.2, 3.6);
  const g = c.createLinearGradient(0, -1.5, 0, 1.5); g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#d8dce8'); g.addColorStop(0.55, '#8a8ea0'); g.addColorStop(1, '#4a4e5e');
  c.fillStyle = g; c.beginPath(); c.moveTo(0.5, -1.5); c.lineTo(7.8, -0.25); c.lineTo(9.2, 0.3); c.lineTo(0.5, 1.5); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 0.35; c.beginPath(); c.moveTo(0.8, -1.3); c.lineTo(8, -0.15); c.stroke();
  if (glint > 0) {
    c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,255,255,${glint})`;
    c.fillRect(2, -3.5 * glint, 0.7, 7 * glint); c.fillRect(-1.5 * glint + 2.3, -0.35, 3 * glint, 0.7);
    c.globalCompositeOperation = 'source-over';
  }
}

PROJ_ART.as_knife = {
  draw(p, d) {
    const { c, z, sx, sy } = d;
    const spin = (p.data?.spin ?? 0) + (p.data?.rate ?? 26) * p.age;
    c.save(); c.translate(sx, sy); c.scale(z * 1.75, z * 1.75);
    // spin blur: a faint steel disc plus two bright swept arcs
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(190,185,235,0.1)';
    c.beginPath(); c.ellipse(0, 0, 9.4, 5.8, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(225,220,255,0.4)'; c.lineWidth = 1.1;
    c.beginPath(); c.ellipse(0, 0, 9, 5.6, 0, spin, spin + 1.9); c.stroke();
    c.beginPath(); c.ellipse(0, 0, 9, 5.6, 0, spin + Math.PI, spin + Math.PI + 1.9); c.stroke();
    c.globalCompositeOperation = 'source-over';
    c.scale(1, 0.62); c.rotate(spin);
    const gl = Math.max(0, Math.sin(spin * 0.5 + p.id) - 0.7) * 3.4;
    spinKnife(c, Math.min(1, gl));
    c.restore();
    if (!d.fx.low && Math.random() < 0.15) d.fx.add({ x: p.x, y: p.y, z: 18, color: '#ffffff', kind: 'glint', size: 1.1, life: 0.1, add: true });
  },
  trail: ['220,210,255', 1.6],
  light: [0.5, '190,180,255'],
};

PROJ_ART.as_sentryKnife = {
  draw(p, d) {
    const { c, z, sx, sy, ang } = d;
    c.save(); c.translate(sx, sy); c.rotate(ang); c.scale(z * 1.1, z * 1.1);
    c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(-12, 0, 4, 0); g.addColorStop(0, 'rgba(150,80,255,0)'); g.addColorStop(1, 'rgba(190,130,255,0.55)');
    c.fillStyle = g; c.beginPath(); c.moveTo(-13, 0); c.lineTo(3, -2.2); c.lineTo(3, 2.2); c.closePath(); c.fill();
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#2a2232'; c.fillRect(-4.5, -0.8, 4, 1.6);
    const bg = c.createLinearGradient(0, -1.3, 0, 1.3); bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.5, '#b8b4d0'); bg.addColorStop(1, '#4a4466');
    c.fillStyle = bg; c.beginPath(); c.moveTo(-0.5, -1.3); c.lineTo(6.5, -0.2); c.lineTo(7.5, 0); c.lineTo(6.5, 0.2); c.lineTo(-0.5, 1.3); c.closePath(); c.fill();
    const f = 0.6 + 0.4 * Math.sin(p.age * 60 + p.id);
    c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(230,200,255,${f})`;
    c.fillRect(5.2, -2.4 * f, 0.6, 4.8 * f); c.fillRect(4, -0.3, 3, 0.6);
    c.restore();
  },
  trail: ['190,150,255', 1.4],
  light: [0.8, '170,120,255'],
};

// ================================================================ smoke puff sprites (built once, then only drawImage per frame)
const PUFF = 112, PUFF_N = 4;
let puffCv: HTMLCanvasElement | null = null;
let puffTried = false;
function puffSheet(): HTMLCanvasElement | null {
  if (puffCv || puffTried) return puffCv;
  puffTried = true;
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = PUFF * PUFF_N; cv.height = PUFF;
  const g = cv.getContext('2d');
  if (!g) return null;
  for (let v = 0; v < PUFF_N; v++) {
    // a lumpy cumulus: one big core blob and a ring of smaller lobes (upper lobes bigger, flat-ish bottom)
    const ox = v * PUFF + PUFF / 2, oy = PUFF * 0.54;
    const n = 7 + v;
    for (let i = 0; i < n; i++) {
      const core = i === 0;
      const an = core ? 0 : (i / (n - 1)) * TAU + v * 0.9 + (Math.random() - 0.5) * 0.5;
      const dd = core ? 0 : PUFF * (0.16 + Math.random() * 0.1);
      const bx = ox + Math.cos(an) * dd, by = oy + Math.sin(an) * dd * 0.72;
      const up = Math.sin(an) < 0 ? 1.12 : 0.85;
      const br = PUFF * (core ? 0.27 : (0.13 + Math.random() * 0.08) * up);
      const gr = g.createRadialGradient(bx - br * 0.25, by - br * 0.3, br * 0.05, bx, by, br);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill();
    }
  }
  // colour it: moon-lit top, grey-violet body, dark bruised underside
  g.globalCompositeOperation = 'source-atop';
  const lg = g.createLinearGradient(0, PUFF * 0.12, 0, PUFF * 0.9);
  lg.addColorStop(0, '#c4bcd4'); lg.addColorStop(0.42, '#7c7292'); lg.addColorStop(0.75, '#4a4258'); lg.addColorStop(1, '#241e2e');
  g.fillStyle = lg; g.fillRect(0, 0, cv.width, PUFF);
  // grain so the puffs read as smoke rather than soft balls
  for (let i = 0; i < 520; i++) {
    const lit = Math.random() < 0.5;
    const x = Math.random() * cv.width, y = Math.random() * PUFF, s = 3 + Math.random() * 7;
    const gr = g.createRadialGradient(x, y, 0, x, y, s);
    gr.addColorStop(0, lit ? 'rgba(255,250,255,0.1)' : 'rgba(16,6,28,0.13)'); gr.addColorStop(1, lit ? 'rgba(255,250,255,0)' : 'rgba(16,6,28,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  puffCv = cv;
  return cv;
}
/** One smoke puff centred at (x,y), w×h px. */
function puff(c: C2D, v: number, x: number, y: number, w: number, h: number, alpha: number, flip: boolean): void {
  const cv = puffSheet();
  if (!cv || alpha <= 0.01 || w < 1) return;
  c.globalAlpha = Math.min(1, alpha);
  const sx0 = (Math.abs(v | 0) % PUFF_N) * PUFF;
  if (flip) { c.save(); c.translate(x, y); c.scale(-1, 1); c.drawImage(cv, sx0, 0, PUFF, PUFF, -w / 2, -h / 2, w, h); c.restore(); }
  else c.drawImage(cv, sx0, 0, PUFF, PUFF, x - w / 2, y - h / 2, w, h);
}

// ================================================================ areas
AREA_ART.as_smoke = {
  draw(a, d) {
    const { c, sx, sy, rx, time } = d;
    const al = Math.min(1, a.t / 0.25) * clamp01((a.dur - a.t) / 1.2);
    if (al <= 0) return;
    const grow = 0.6 + 0.4 * ease(a.t / 0.5);
    // dark ground haze
    const g = c.createRadialGradient(sx, sy, 0, sx, sy, rx * 1.05);
    g.addColorStop(0, `rgba(30,24,40,${0.6 * al})`); g.addColorStop(0.65, `rgba(44,36,56,${0.45 * al})`); g.addColorStop(1, 'rgba(44,36,56,0)');
    c.fillStyle = g; c.save(); c.translate(sx, sy); c.scale(1, 0.5); c.beginPath(); c.arc(0, 0, rx * 1.05 * grow, 0, TAU); c.restore(); c.fill();
    // ground-hugging banks of smoke rolling slowly round the rim
    const n = d.fx.low ? 5 : 9;
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1;
      const an = (i / n) * TAU + time * 0.12 * dir + a.id;
      const rr = rx * grow * (0.45 + 0.4 * hash(i + a.id));
      const bw = rx * (0.7 + 0.25 * hash(i * 3.1 + a.id));
      puff(c, i, sx + Math.cos(an) * rr, sy + Math.sin(an) * rr * 0.5 - bw * 0.12, bw, bw * 0.5, 0.55 * al, i % 2 === 0);
    }
    c.globalAlpha = 1;
  },
  air(a, d) {
    const { c, sx, sy, rx, z, time, fx } = d;
    const al = Math.min(1, a.t / 0.35) * clamp01((a.dur - a.t) / 1.2);
    if (al <= 0) return;
    const grow = 0.5 + 0.5 * ease(a.t / 0.6);
    const n = fx.low ? 6 : 14;
    for (let i = 0; i < n; i++) {
      const h1 = hash(i + a.id * 7), h2 = hash(i * 2.3 + a.id), h3 = hash(i * 5.7 + 1);
      // each puff rolls outward and upward, swelling and thinning, then respawns; rim puffs are denser
      const life = (time * (0.13 + h3 * 0.08) + h1) % 1;
      const an = h2 * TAU + time * 0.08 * (h1 > 0.5 ? 1 : -1);
      const rr = rx * grow * Math.min(1, 0.25 + 0.7 * h3 + life * 0.18);
      const px = sx + Math.cos(an) * rr, py = sy + Math.sin(an) * rr * 0.5 - (8 + 30 * life + 10 * h1) * z;
      const pw = (34 + 26 * h2 + 26 * life) * z * grow;
      const pa = Math.sin(life * Math.PI) * al * (0.42 + 0.2 * h3);
      puff(c, i + 1, px, py, pw, pw * 0.8, pa, h2 > 0.5);
    }
    c.globalAlpha = 1;
    // faint violet glimmers inside the cloud (shadow magic)
    if (!fx.low) {
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const ph = (time * 0.35 + hash(i * 9.1 + a.id)) % 1;
        const an = hash(i * 4.3 + a.id) * TAU + time * 0.3;
        const rr = rx * 0.7 * hash(i * 1.7 + 3);
        const px = sx + Math.cos(an) * rr, py = sy + Math.sin(an) * rr * 0.5 - (6 + ph * 40) * z;
        const s = Math.sin(ph * Math.PI) * al;
        c.fillStyle = `rgba(190,130,255,${0.6 * s})`;
        c.fillRect(px - 2.2 * z, py - 0.3 * z, 4.4 * z, 0.6 * z); c.fillRect(px - 0.3 * z, py - 2.2 * z, 0.6 * z, 4.4 * z);
      }
      c.globalCompositeOperation = 'source-over';
    }
  },
};

/** Blade sentry: tossed in, unfolds on a tripod, turret turns to its target, blade ring spins. */
function pylon(c: C2D, a: { t: number; dur: number; id: number; data: Record<string, number> }, time: number, deploy: number, fold: number, low: boolean): void {
  const aim = a.data.ang ?? 0;
  const sxv = Math.cos(aim) - Math.sin(aim), syv = (Math.cos(aim) + Math.sin(aim)) * 0.5;
  const since = a.t - (a.data.shot ?? -9);
  const recoil = since >= 0 && since < 0.1 ? 1 - since / 0.1 : 0;
  const s = deploy * (1 - fold * 0.6);
  const live = 1 - fold;
  // hexagonal base plate bolted to the floor, violet vents pulsing
  const pr = 7.6 * deploy;
  const hex = (r: number, dy: number): void => {
    c.beginPath();
    for (let i = 0; i < 6; i++) { const an = (i / 6) * TAU + Math.PI / 6; const px = Math.cos(an) * r, py = Math.sin(an) * r * 0.5 + dy; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
    c.closePath();
  };
  c.fillStyle = '#0e0c12'; hex(pr + 0.9, 0.9); c.fill();
  const pg = c.createLinearGradient(-pr, -pr * 0.5, pr, pr * 0.5); pg.addColorStop(0, '#7a7e8c'); pg.addColorStop(0.5, '#3a3c48'); pg.addColorStop(1, '#18181f');
  c.fillStyle = pg; hex(pr, 0); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 0.5; hex(pr * 0.62, -0.2); c.stroke();
  c.fillStyle = '#b8bcc8';
  for (let i = 0; i < 6; i++) { const an = (i / 6) * TAU; c.fillRect(Math.cos(an) * pr * 0.82 - 0.4, Math.sin(an) * pr * 0.41 - 0.4, 0.8, 0.8); }
  {
    const pulse = (0.55 + 0.45 * Math.sin(time * 5 + a.id)) * live + recoil * 0.5;
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(190,110,255,${Math.min(1, pulse)})`; c.lineWidth = 0.9;
    for (let i = 0; i < 3; i++) { const an = (i / 3) * TAU + 0.5; const cx = Math.cos(an) * pr * 0.72, cy = Math.sin(an) * pr * 0.36; c.beginPath(); c.moveTo(cx - Math.sin(an) * 1.6, cy + Math.cos(an) * 0.8); c.lineTo(cx + Math.sin(an) * 1.6, cy - Math.cos(an) * 0.8); c.stroke(); }
    c.restore();
  }
  // tripod legs
  const hub = -6 * s;
  const rot = (a.id % 7) * 0.4;
  const legs: [number, number][] = [];
  for (let i = 0; i < 3; i++) { const an = rot + (i / 3) * TAU; legs.push([Math.cos(an) * 9 * deploy, Math.sin(an) * 4.5 * deploy]); }
  legs.sort((p, q) => p[1] - q[1]);
  const leg = (lx: number, ly: number): void => {
    const kx = lx * 0.6, ky = hub * 0.45 + ly * 0.35 - 2.4;
    c.strokeStyle = '#121016'; c.lineWidth = 2.8; c.beginPath(); c.moveTo(0, hub); c.lineTo(kx, ky); c.lineTo(lx, ly); c.stroke();
    c.strokeStyle = '#6a6e7c'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, hub); c.lineTo(kx, ky); c.lineTo(lx, ly); c.stroke();
    c.fillStyle = '#c8ccd8'; c.beginPath(); c.arc(kx, ky, 0.8, 0, TAU); c.fill();
    c.fillStyle = '#9aa0ae'; c.beginPath(); c.moveTo(lx - 1.1, ly - 0.6); c.lineTo(lx, ly + 1.6); c.lineTo(lx + 1.1, ly - 0.6); c.fill();
  };
  leg(legs[0][0], legs[0][1]);
  // column with a glowing energy slit
  const top = hub - 11 * s;
  const cg = c.createLinearGradient(-3.2, 0, 3.2, 0); cg.addColorStop(0, '#a4aab8'); cg.addColorStop(0.4, '#50545f'); cg.addColorStop(1, '#141419');
  c.fillStyle = cg; c.fillRect(-3, top, 6, hub - top + 1);
  c.fillStyle = '#26262f'; c.fillRect(-3.6, hub - 1.6, 7.2, 2.4); c.fillRect(-3.6, top - 0.2, 7.2, 1.6);
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-2.4, top + 1.6, 0.7, hub - top - 3);
  {
    const glow = Math.min(1, (0.6 + 0.3 * Math.sin(time * 7 + a.id)) * live + recoil * 0.7);
    c.save(); c.globalCompositeOperation = 'lighter';
    const eg = c.createLinearGradient(0, top + 2, 0, hub - 2); eg.addColorStop(0, `rgba(230,190,255,${glow})`); eg.addColorStop(1, `rgba(140,60,240,${glow * 0.6})`);
    c.fillStyle = eg; c.fillRect(0.2, top + 2.2, 1.4, hub - top - 4.4);
    c.restore();
  }
  leg(legs[1][0], legs[1][1]); leg(legs[2][0], legs[2][1]);
  // turret head: housing + spinning disc of three sickle blades
  const hx = -sxv * recoil * 1.6, hy = top - 3.5 * s - syv * recoil * 1.6;
  const spin = time * (22 * live + 3) + a.id;
  const R = 11 * s;
  const blade = (i: number, front: boolean): void => {
    const an = spin + (i / 3) * TAU;
    const bz = Math.sin(an + 0.35);
    if ((bz > 0) !== front) return;
    const pt = (ang: number, rr: number): [number, number] => [hx + Math.cos(ang) * rr, hy + Math.sin(ang) * rr * 0.42];
    const [ax, ay] = pt(an - 0.25, R * 0.35), [bx, by] = pt(an + 0.1, R * 0.4);
    const [mx, my] = pt(an + 0.35, R * 0.8), [tx, ty] = pt(an + 0.75, R * 1.02);
    const [ix, iy] = pt(an + 0.3, R * 0.62);
    c.fillStyle = front ? '#dde1ec' : '#6e7280';
    c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(mx, my - 1.2, tx, ty); c.quadraticCurveTo(ix, iy, bx, by); c.closePath(); c.fill();
    if (front) { c.strokeStyle = 'rgba(40,36,52,0.8)'; c.lineWidth = 0.4; c.stroke(); c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(mx, my - 1.2, tx, ty); c.stroke(); }
  };
  for (let i = 0; i < 3; i++) blade(i, false);
  if (!low) {
    // spinning blur
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(200,190,240,${0.08 + 0.06 * live})`; c.beginPath(); c.ellipse(hx, hy, R, R * 0.42, 0, 0, TAU); c.fill();
    c.strokeStyle = `rgba(215,205,255,${0.3 * live})`; c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(hx, hy, R * 0.94, R * 0.4, 0, spin * 1.3, spin * 1.3 + 1.6); c.stroke();
    c.beginPath(); c.ellipse(hx, hy, R * 0.94, R * 0.4, 0, spin * 1.3 + Math.PI, spin * 1.3 + Math.PI + 1.6); c.stroke();
    c.restore();
  }
  const behind = syv < 0;
  const barrel = (): void => {
    c.strokeStyle = '#1a1a22'; c.lineWidth = 2.8; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + sxv * 7 * s, hy + syv * 7 * s); c.stroke();
    c.strokeStyle = '#8a8e9c'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(hx, hy - 0.5); c.lineTo(hx + sxv * 7 * s, hy + syv * 7 * s - 0.5); c.stroke();
    c.fillStyle = '#c8ccd8'; c.beginPath(); c.arc(hx + sxv * 7 * s, hy + syv * 7 * s, 0.9, 0, TAU); c.fill();
  };
  if (behind) barrel();
  const hg = c.createLinearGradient(hx - 4, hy - 3, hx + 4, hy + 3); hg.addColorStop(0, '#c0c4d0'); hg.addColorStop(0.5, '#4a4e5a'); hg.addColorStop(1, '#121218');
  c.fillStyle = hg; c.beginPath(); c.ellipse(hx, hy, 4.8 * s + 0.5, 3.5 * s + 0.4, 0, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 0.5; c.stroke();
  c.fillStyle = '#2a2a34'; c.beginPath(); c.ellipse(hx, hy - 2.3 * s, 2.8 * s, 1.2 * s, 0, 0, TAU); c.fill();
  c.fillStyle = '#9aa0ae'; c.beginPath(); c.moveTo(hx - 0.8, hy - 2.8 * s); c.lineTo(hx, hy - 5.4 * s); c.lineTo(hx + 0.8, hy - 2.8 * s); c.fill();
  if (!behind) barrel();
  // violet lens toward the target, blinking out as it expires
  const blink = fold > 0 ? (Math.sin(time * 40) > 0 ? 1 : 0.2) : 0.75 + 0.25 * Math.sin(time * 6 + a.id);
  const lx = hx + sxv * 2.9 * s, ly = hy + syv * 2.3 * s - 0.4;
  c.save(); c.globalCompositeOperation = 'lighter';
  const lg = c.createRadialGradient(lx, ly, 0, lx, ly, 4.4);
  lg.addColorStop(0, `rgba(255,230,255,${blink})`); lg.addColorStop(0.35, `rgba(190,110,255,${0.8 * blink})`); lg.addColorStop(1, 'rgba(120,40,220,0)');
  c.fillStyle = lg; c.beginPath(); c.arc(lx, ly, 4.4, 0, TAU); c.fill();
  c.restore();
  for (let i = 0; i < 3; i++) blade(i, true);
}

AREA_ART.as_sentry = {
  draw(a, d) {
    const { c, cam, z, sx, sy, time, fx } = d;
    const fl = 0.2;
    const s = z * 1.35;
    if (a.t < fl && a.data.hx !== undefined) {
      // tossed in an arc from the hero
      const k = a.t / fl;
      const wx = a.data.hx + (a.x - a.data.hx) * k, wy = a.data.hy + (a.y - a.data.hy) * k;
      const px = cam.sxOf(wx, wy), py = cam.syOf(wx, wy);
      const lift = (Math.sin(k * Math.PI) * 26 + (1 - k) * 22) * z;
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(px, py, 5 * z, 2.4 * z, 0, 0, TAU); c.fill();
      c.save(); c.translate(px, py - lift); c.scale(s, s); c.rotate(k * 9);
      const g = c.createLinearGradient(-3, 0, 3, 0); g.addColorStop(0, '#9aa0ae'); g.addColorStop(1, '#1a1a22');
      c.fillStyle = g; c.fillRect(-3, -3.5, 6, 7);
      c.fillStyle = '#c8ccd8'; c.beginPath(); c.moveTo(3, -3); c.lineTo(6, -4.5); c.lineTo(3, -0.5); c.fill(); c.beginPath(); c.moveTo(-3, 3); c.lineTo(-6, 4.5); c.lineTo(-3, 0.5); c.fill();
      c.restore();
      return;
    }
    const deploy = ease((a.t - fl) / 0.25) * 0.75 + 0.25;
    const fold = clamp01((0.4 - (a.dur - a.t)) / 0.4);
    // shadow + rune circle
    c.fillStyle = 'rgba(0,0,0,0.38)'; c.beginPath(); c.ellipse(sx, sy, 11 * z, 5.2 * z, 0, 0, TAU); c.fill();
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.45 * (1 - fold) * deploy;
    c.strokeStyle = `rgba(${V},0.8)`; c.lineWidth = 1 * z;
    const rr = 15 * z;
    c.beginPath(); c.ellipse(sx, sy, rr, rr * 0.5, 0, 0, TAU); c.stroke();
    for (let i = 0; i < 6; i++) {
      const an = time * 0.6 + (i / 6) * TAU + a.id;
      c.beginPath(); c.moveTo(sx + Math.cos(an) * rr, sy + Math.sin(an) * rr * 0.5); c.lineTo(sx + Math.cos(an) * rr * 0.78, sy + Math.sin(an) * rr * 0.39); c.stroke();
    }
    c.restore();
    c.save(); c.translate(sx, sy); c.scale(s, s);
    c.globalAlpha = 1 - fold * 0.5;
    c.lineCap = 'round';
    pylon(c, a, time, deploy, fold, fx.low);
    c.restore();
  },
  air(a, d) {
    if (a.t < 0.2) return;
    const { c, z, sx, sy, time } = d;
    const aim = a.data.ang ?? 0;
    const sxv = Math.cos(aim) - Math.sin(aim), syv = (Math.cos(aim) + Math.sin(aim)) * 0.5;
    const s = z * 1.35;
    const fold = clamp01((0.4 - (a.dur - a.t)) / 0.4);
    const deploy = ease((a.t - 0.2) / 0.25) * 0.75 + 0.25;
    const hs = deploy * (1 - fold * 0.6);
    // faint lens + blade-ring glints drawn above actors (the pylon itself sits on the floor layer)
    {
      const lx = sx + sxv * 2.9 * hs * s, ly = sy + (-20.5 * hs + syv * 2.3 * hs - 0.4) * s;
      const blink = fold > 0 ? (Math.sin(time * 40) > 0 ? 1 : 0.2) : 0.7 + 0.3 * Math.sin(time * 6 + a.id);
      c.save(); c.globalCompositeOperation = 'lighter';
      const lg = c.createRadialGradient(lx, ly, 0, lx, ly, 6 * z);
      lg.addColorStop(0, `rgba(230,190,255,${0.55 * blink})`); lg.addColorStop(1, 'rgba(140,60,230,0)');
      c.fillStyle = lg; c.beginPath(); c.arc(lx, ly, 6 * z, 0, TAU); c.fill();
      const sp = time * (22 * (1 - fold) + 3) + a.id;
      c.fillStyle = 'rgba(235,230,255,0.55)';
      const hcy = sy - 20.5 * hs * s;
      for (let i = 0; i < 3; i++) { const an = sp + (i / 3) * TAU + 0.75; if (Math.sin(an) < 0.3) continue; c.fillRect(sx + Math.cos(an) * 11 * hs * s - 1.4 * z, hcy + Math.sin(an) * 4.6 * hs * s - 0.3 * z, 2.8 * z, 0.6 * z); }
      c.restore();
    }
    const since = a.t - (a.data.shot ?? -9);
    if (since < 0 || since > 0.07) return;
    const mx = sx + sxv * 6.5 * s, my = sy - 20.5 * s + syv * 6.5 * s;
    const f = 1 - since / 0.07;
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(mx, my, 0, mx, my, 9 * z);
    g.addColorStop(0, `rgba(255,245,255,${f})`); g.addColorStop(0.4, `rgba(190,120,255,${0.7 * f})`); g.addColorStop(1, 'rgba(120,40,220,0)');
    c.fillStyle = g; c.beginPath(); c.arc(mx, my, 9 * z, 0, TAU); c.fill();
    c.fillStyle = `rgba(255,255,255,${f})`; c.fillRect(mx - 7 * z * f, my - 0.4 * z, 14 * z * f, 0.8 * z); c.fillRect(mx - 0.4 * z, my - 5 * z * f, 0.8 * z, 10 * z * f);
    c.restore();
  },
  light: (a) => (a.t < 0.2 ? null : [1.3 + (a.t - (a.data.shot ?? -9) < 0.08 ? 0.6 : 0), '170,110,255']),
};

// ================================================================ buff: smoke evasion
BUFF_ART.as_smoke = (c, sx, sy, z, time, b, fx, h) => {
  const f = Math.min(1, b.t / 0.5, (b.dur - b.t) / 0.35);
  c.save();
  // small puffs curling round the legs (behind the body; the sprite itself dissolves in the rig decor)
  for (let i = 0; i < (fx.low ? 2 : 4); i++) {
    const an = time * (0.9 + i * 0.25) + i * 1.7;
    const w = (20 + 6 * Math.sin(time * 1.3 + i)) * z;
    puff(c, i, sx + Math.cos(an) * 11 * z, sy - (4 + 5 * i) * z + Math.sin(an) * 4 * z, w, w * 0.7, 0.34 * f, i % 2 === 1);
  }
  c.globalAlpha = 1;
  c.restore();
  if (Math.random() < (fx.low ? 0.1 : 0.3) * f) {
    const an = Math.random() * TAU;
    fx.add({ x: h.x + Math.cos(an) * 0.35, y: h.y + Math.sin(an) * 0.35, z: 2 + Math.random() * 16, vz: 14, vx: Math.cos(an) * 0.3, vy: Math.sin(an) * 0.3, color: '#6a6080', kind: 'smoke', size: 1.8, life: 0.8 });
  }
};

// ================================================================ skill icons (64×64, origin at centre)
function iconKatar(c: C2D, x: number, y: number, rot: number, s: number, tier = 1): void {
  c.save(); c.translate(x, y); c.rotate(rot);
  drawKatar(c, tier, '#c8ccd4', '#e0e0e8', (n) => n * s);
  c.restore();
}

SKILL_ICON.as_slash = {
  tint: ['#5a3a7a', '#120818'],
  draw(c, glow) {
    iconKatar(c, -12, 14, -Math.PI * 0.8, 1.35, 1);
    iconKatar(c, 12, 14, Math.PI * 0.8, 1.35, 1);
    glow('#b070ff', 12);
    for (const [ox, rot] of [[-3, -0.5], [3, 0.5]] as [number, number][]) {
      c.save(); c.translate(ox, -4); c.rotate(rot);
      for (let i = -1; i <= 1; i++) {
        c.strokeStyle = 'rgba(200,150,255,0.9)'; c.lineWidth = 3.2;
        c.beginPath(); c.moveTo(-16, i * 5); c.quadraticCurveTo(0, i * 5 - 5, 16, i * 5); c.stroke();
        c.strokeStyle = '#ffffff'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(-14, i * 5); c.quadraticCurveTo(0, i * 5 - 5, 14, i * 5); c.stroke();
      }
      c.restore();
    }
  },
};

SKILL_ICON.as_venom = {
  tint: ['#3a6a2a', '#081006'],
  draw(c, glow) {
    glow('#60ff30', 10);
    iconKatar(c, -6, 18, -Math.PI * 0.85, 1.9, 3);
    c.shadowBlur = 0;
    // venom dripping from the tip
    glow('#60ff30', 8);
    c.fillStyle = '#7aff4a';
    for (const [x, y, r] of [[13, -2, 3.2], [12, 8, 2.4], [14, 16, 1.8], [8, 22, 1.4]] as [number, number, number][]) {
      c.beginPath(); c.moveTo(x, y - r * 1.8); c.quadraticCurveTo(x + r, y, x, y + r); c.quadraticCurveTo(x - r, y, x, y - r * 1.8); c.fill();
    }
    c.fillStyle = 'rgba(122,255,74,0.5)'; c.beginPath(); c.ellipse(4, 26, 14, 3.5, 0, 0, TAU); c.fill();
    c.fillStyle = '#e8ffe0'; c.beginPath(); c.arc(12, -3, 1, 0, TAU); c.fill();
  },
};

SKILL_ICON.as_knives = {
  tint: ['#4a4a62', '#0c0c14'],
  draw(c, glow) {
    for (let i = 0; i < 5; i++) {
      const an = -Math.PI / 2 + (i - 2) * 0.36;
      c.save(); c.translate(-2, 26); c.rotate(an); c.translate(27 + (i % 2) * 5, 0);
      c.strokeStyle = 'rgba(210,210,255,0.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-22, 0); c.lineTo(-11, 0); c.stroke();
      c.scale(1.7, 1.7);
      spinKnife(c, 0);
      c.restore();
    }
    glow('#ffffff', 8);
    c.fillStyle = '#ffffff';
    for (const [x, y] of [[16, -22], [-18, -12]] as [number, number][]) { c.fillRect(x - 5, y - 0.6, 10, 1.2); c.fillRect(x - 0.6, y - 5, 1.2, 10); }
  },
};

SKILL_ICON.as_smoke = {
  tint: ['#5a5068', '#0e0c14'],
  draw(c, glow) {
    // billowing smoke
    for (const [x, y, r, a] of [[-14, 10, 13, 0.55], [12, 12, 12, 0.5], [-4, 18, 14, 0.6], [16, -6, 9, 0.4], [-18, -6, 9, 0.4]] as [number, number, number, number][]) {
      const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      g.addColorStop(0, `rgba(170,160,190,${a})`); g.addColorStop(1, 'rgba(90,80,110,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    // bomb
    const g = c.createRadialGradient(-5, -3, 1, 0, 2, 13);
    g.addColorStop(0, '#9a90a8'); g.addColorStop(0.45, '#3a3444'); g.addColorStop(1, '#0e0c12');
    c.fillStyle = g; c.beginPath(); c.arc(0, 2, 12, 0, TAU); c.fill();
    c.strokeStyle = '#8a60c0'; c.lineWidth = 1.6; c.beginPath(); c.arc(0, 2, 12, -0.4, 1.3); c.stroke();
    c.fillStyle = '#2a2430'; c.fillRect(-3, -12, 6, 4);
    c.strokeStyle = '#a08060'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, -12); c.quadraticCurveTo(6, -18, 4, -24); c.stroke();
    glow('#ffb040', 12);
    c.fillStyle = '#fff0b0'; c.beginPath(); c.arc(4, -24, 3, 0, TAU); c.fill();
    c.strokeStyle = '#ffc060'; c.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) { const an = (i / 6) * TAU; c.beginPath(); c.moveTo(4 + Math.cos(an) * 4, -24 + Math.sin(an) * 4); c.lineTo(4 + Math.cos(an) * 7, -24 + Math.sin(an) * 7); c.stroke(); }
  },
};

SKILL_ICON.as_shadow = {
  tint: ['#4a2a6a', '#0a0412'],
  draw(c, glow) {
    // afterimages of a hooded figure lunging, then the strike
    const fig = (x: number, a: number, col: string): void => {
      c.save(); c.translate(x, 6); c.globalAlpha = a; c.fillStyle = col;
      c.beginPath(); c.moveTo(-3, -22); c.quadraticCurveTo(6, -24, 5, -14); c.lineTo(10, -8); c.lineTo(16, -10); c.lineTo(16, -7); c.lineTo(8, -3); c.lineTo(6, 6); c.lineTo(12, 20); c.lineTo(8, 21); c.lineTo(1, 9); c.lineTo(-6, 20); c.lineTo(-10, 19); c.lineTo(-4, 4); c.lineTo(-8, -8); c.lineTo(-13, -20); c.quadraticCurveTo(-8, -16, -3, -22); c.fill();
      c.restore();
    };
    fig(-20, 0.25, '#8a50e0');
    fig(-11, 0.45, '#a060ff');
    glow('#b070ff', 12);
    fig(0, 1, '#1a0a2a');
    c.shadowBlur = 0;
    c.fillStyle = '#e0b0ff'; c.fillRect(3, -14, 3, 1.5);
    glow('#ffffff', 10);
    c.strokeStyle = '#ffffff'; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(8, -24); c.quadraticCurveTo(20, -6, 26, 18); c.stroke();
    c.strokeStyle = 'rgba(200,140,255,0.8)'; c.lineWidth = 5; c.globalAlpha = 0.6;
    c.beginPath(); c.moveTo(8, -24); c.quadraticCurveTo(20, -6, 26, 18); c.stroke();
    c.globalAlpha = 1;
  },
};

SKILL_ICON.as_sentry = {
  tint: ['#4a3a5a', '#0c0a10'],
  draw(c, glow) {
    c.save(); c.translate(-4, 18); c.scale(1.6, 1.6);
    const fake = { t: 2, dur: 8, id: 3, data: { ang: -0.2, shot: 1.95 } as Record<string, number> };
    pylon(c, fake, 0.35, 1, 0, false);
    c.restore();
    glow('#c080ff', 10);
    c.save(); c.translate(18, -14); c.rotate(-0.55); c.scale(1.6, 1.6);
    c.fillStyle = 'rgba(190,130,255,0.6)'; c.beginPath(); c.moveTo(-10, 0); c.lineTo(2, -2); c.lineTo(2, 2); c.fill();
    c.fillStyle = '#e8e4ff'; c.beginPath(); c.moveTo(0, -1.2); c.lineTo(7, 0); c.lineTo(0, 1.2); c.fill();
    c.restore();
  },
};

