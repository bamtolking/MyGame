// necromancer: skill visuals — spinning bone shards and a ghost-lit bone spear, swelling corpses that burst in
// gore and bone shrapnel, robed skeletal mages climbing out of the ground (drawn by their area), orbiting bone
// plates of the bone armor (buff + ring), and a bubbling plague pool with drifting toxic clouds.
import { drawBiped, type Look, type Pose } from '../../render/actors';
import { screenDir } from '../../render/iso';
import { AREA_ART, BUFF_ART, DECOR, EFFECT_ART, FX_EVENT, PROJ_ART, type FxHost } from '../../render/registry';
import type { Area } from '../../sim/types';
import { BONE, BONE_DK, BONE_HI, BONE_LINE, BONE_MID, SOUL_RGB, glowDot } from './look';
import { MAGE } from './shared';

type C2D = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ICE_RGB = '150,225,255', GORE_RGB = '255,70,50', TOX_RGB = '150,255,80';
/** Actor scale used by the renderer for characters (render/renderer ACTOR_SCALE). */
const ACTOR = 1.22;

/** Deterministic 0..1 noise from integers (stable per area / effect, no Math.random flicker). */
function hash(a: number, b: number): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Screen-space angle of a world direction. */
function screenAng(dx: number, dy: number): number { const d = screenDir(Math.atan2(dy, dx)); return Math.atan2(d.dy, d.dx); }
/** True when a thing drawn at (sx,sy) with half-width w and height up (px) is entirely off screen. */
function offscreen(d: { cam: { w: number; h: number }; sx: number; sy: number }, w: number, up: number): boolean {
  return d.sx + w < 0 || d.sx - w > d.cam.w || d.sy + w * 0.5 < 0 || d.sy - up - w * 0.5 > d.cam.h;
}
function lighter(c: C2D): void { c.globalCompositeOperation = 'lighter'; }
function normal(c: C2D): void { c.globalCompositeOperation = 'source-over'; }

/** A jagged bone splinter along +x (length ~16 units), for projectiles and shrapnel. */
function splinter(c: C2D, s: number, col = BONE): void {
  c.fillStyle = col; c.strokeStyle = BONE_LINE; c.lineWidth = 0.55;
  c.beginPath();
  c.moveTo(8 * s, 0); c.lineTo(3 * s, -1.5 * s); c.lineTo(-1 * s, -1.1 * s); c.lineTo(-4.5 * s, -2 * s); c.lineTo(-8 * s, -0.7 * s);
  c.lineTo(-6.2 * s, 0.3 * s); c.lineTo(-8 * s, 1.3 * s); c.lineTo(-3 * s, 1.5 * s); c.lineTo(2.5 * s, 1.3 * s); c.closePath();
  c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.5 * s;
  c.beginPath(); c.moveTo(6 * s, -0.4 * s); c.lineTo(-5 * s, -0.9 * s); c.stroke();
}

// ================================================================ projectiles
PROJ_ART.nc_bolt = {
  light: [1.7, '140,255,190'],
  trail: ['110,220,160', 2.2],
  draw(p, d) {
    const { c, z, sx, sy, ang, time, fx } = d;
    c.save(); c.translate(sx, sy);
    lighter(c);
    glowDot(c, 0, 0, 13 * z, SOUL_RGB, 0.3);
    // ghostly wake behind the shard
    c.rotate(ang);
    const wg = c.createLinearGradient(-32 * z, 0, 5 * z, 0);
    wg.addColorStop(0, `rgba(${SOUL_RGB},0)`); wg.addColorStop(1, `rgba(${SOUL_RGB},0.36)`);
    c.fillStyle = wg; c.beginPath(); c.moveTo(5 * z, -3.6 * z); c.quadraticCurveTo(-14 * z, -5 * z + Math.sin(time * 40 + p.id) * z, -32 * z, 0); c.quadraticCurveTo(-14 * z, 5 * z, 5 * z, 3.6 * z); c.fill();
    normal(c);
    // spinning around its long axis: the width breathes
    const sp = Math.sin(time * 36 + p.id * 1.3);
    c.scale(z * 1.55, z * 1.55 * (0.5 + 0.5 * Math.abs(sp)));
    splinter(c, 1, sp > 0 ? BONE : BONE_MID);
    c.restore();
    if (!fx.low && Math.random() < 0.55) fx.add({ x: p.x, y: p.y, z: 18 + (Math.random() - 0.5) * 6, vz: 6, vx: -p.vx * 0.03 + (Math.random() - 0.5) * 0.5, vy: -p.vy * 0.03 + (Math.random() - 0.5) * 0.5, color: '#a8ffd0', kind: 'dot', size: 1.1, life: 0.35, add: true });
  },
};

PROJ_ART.nc_spear = {
  light: [2.8, '150,255,190'],
  trail: ['110,210,160', 3.6],
  draw(p, d) {
    const { c, z, sx, sy, ang, time, fx } = d;
    const grow = ease(Math.min(1, p.age / 0.06));
    c.save(); c.translate(sx, sy); c.rotate(ang); c.scale(z * grow, z);
    // ghost aura: a long comet of soul light
    lighter(c);
    const ag = c.createLinearGradient(-58, 0, 20, 0);
    ag.addColorStop(0, `rgba(${SOUL_RGB},0)`); ag.addColorStop(0.7, `rgba(${SOUL_RGB},0.16)`); ag.addColorStop(1, `rgba(${SOUL_RGB},0.32)`);
    c.fillStyle = ag; c.beginPath(); c.moveTo(22, 0); c.quadraticCurveTo(0, -8, -58, 0); c.quadraticCurveTo(0, 8, 22, 0); c.fill();
    // spiral wisps coiling around the shaft
    c.lineWidth = 1.1;
    for (const ph of [0, Math.PI]) {
      c.strokeStyle = `rgba(160,255,205,${ph ? 0.22 : 0.42})`;
      c.beginPath();
      for (let i = 0; i <= 14; i++) { const x = 16 - i * 4.2, y = Math.sin(time * 26 + i * 0.9 + ph) * (2.2 + i * 0.25); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      c.stroke();
    }
    normal(c);
    // shaft: a column of fused vertebrae
    c.fillStyle = BONE_LINE; c.fillRect(-30, -2.2, 38, 4.4);
    const sg = c.createLinearGradient(0, -1.8, 0, 1.8);
    sg.addColorStop(0, BONE_HI); sg.addColorStop(0.5, BONE); sg.addColorStop(1, BONE_DK);
    c.fillStyle = sg; c.fillRect(-30, -1.8, 38, 3.6);
    c.strokeStyle = BONE_LINE; c.lineWidth = 0.5;
    for (let x = -27; x < 6; x += 4.6) { c.fillStyle = BONE_MID; c.beginPath(); c.ellipse(x, 0, 1.1, 2.7, 0, 0, TAU); c.fill(); c.stroke(); }
    // splintered butt
    c.fillStyle = BONE; c.beginPath(); c.moveTo(-30, -1.7); c.lineTo(-35, -2.6); c.lineTo(-32.5, -0.4); c.lineTo(-36, 0.8); c.lineTo(-31.5, 1.2); c.lineTo(-33, 2.6); c.lineTo(-30, 1.7); c.closePath(); c.fill(); c.stroke();
    // head: a long leaf-shaped blade of bone with barbs
    const hg = c.createLinearGradient(8, -4, 8, 4);
    hg.addColorStop(0, BONE_HI); hg.addColorStop(0.55, BONE); hg.addColorStop(1, BONE_DK);
    c.fillStyle = hg;
    c.beginPath(); c.moveTo(24, 0); c.quadraticCurveTo(15, -4.2, 8, -3.4); c.lineTo(5, -5.6); c.lineTo(6.5, -1.6); c.lineTo(6.5, 1.6); c.lineTo(5, 5.6); c.lineTo(8, 3.4); c.quadraticCurveTo(15, 4.2, 24, 0); c.closePath(); c.fill();
    c.strokeStyle = BONE_LINE; c.lineWidth = 0.6; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(22, -0.3); c.lineTo(9, -1.6); c.stroke();
    lighter(c);
    glowDot(c, 23, 0, 6, SOUL_RGB, 0.45);
    normal(c);
    c.restore();
    if (!fx.low && Math.random() < 0.8) {
      const l = Math.hypot(p.vx, p.vy) || 1;
      fx.add({ x: p.x - (p.vx / l) * 0.5, y: p.y - (p.vy / l) * 0.5, z: 17 + (Math.random() - 0.5) * 8, vz: 10, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8, color: Math.random() < 0.5 ? '#b8ffd8' : '#eafff4', kind: 'dot', size: 1.3, life: 0.4, add: true });
      if (Math.random() < 0.3) fx.add({ x: p.x, y: p.y, z: 16, vz: 30, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, color: BONE, kind: 'bone', size: 0.9, grav: 200, life: 0.5 });
    }
  },
};

PROJ_ART.nc_mageBolt = {
  light: [1.8, '150,220,255'],
  trail: ['120,190,235', 2],
  draw(p, d) {
    const { c, z, sx, sy, ang, time, fx } = d;
    c.save(); c.translate(sx, sy);
    lighter(c);
    glowDot(c, 0, 0, 9 * z, ICE_RGB, 0.35);
    normal(c);
    c.rotate(ang); c.scale(z * 1.15, z * 1.15);
    // a thin bone needle rimed with frost
    c.fillStyle = '#e8f6ff'; c.strokeStyle = '#2a3a48'; c.lineWidth = 0.5;
    c.beginPath(); c.moveTo(9, 0); c.lineTo(0, -1.6); c.lineTo(-7, -0.9); c.lineTo(-7, 0.9); c.lineTo(0, 1.6); c.closePath(); c.fill(); c.stroke();
    lighter(c);
    c.strokeStyle = 'rgba(170,230,255,0.9)'; c.lineWidth = 0.7;
    for (let i = 0; i < 3; i++) { const x = 4 - i * 4, sp = Math.sin(time * 30 + i) * 0.6; c.beginPath(); c.moveTo(x, -1.3); c.lineTo(x - 1.6, -3 - sp); c.moveTo(x, 1.3); c.lineTo(x - 1.6, 3 + sp); c.stroke(); }
    glowDot(c, 8, 0, 4, '220,245,255', 0.9);
    normal(c);
    c.restore();
    if (!fx.low && Math.random() < 0.45) fx.add({ x: p.x, y: p.y, z: 18, vz: -6, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, color: '#d8f4ff', kind: 'ice', size: 0.9, life: 0.4, add: true });
  },
};

// ================================================================ skeletal mage (drawn by its area)
const MAGE_LOOK: Look = {
  skin: '#ddd4bb', body: '#ddd4bb', legs: '#ddd4bb', head: 'skull', bones: true,
  robe: '#40584f', weapon: 'staff', wTier: 2, wGlow: '#9eeaff', eyes: '#b8fff0', glow: '#9eeaff', height: 0.8, build: 0.9, hunch: 0.16, offhand: null,
  decor: 'nc_mageHood',
};

/** The mage's tattered hood and bone-strung mantle (back: behind the skull; front: the brim over its brow). */
DECOR.nc_mageHood = (c, _L, p, a, layer) => {
  const x = a.hx, y = a.hy, r = a.headR;
  if (layer === 'back') {
    // mantle over the shoulders with a ragged edge
    c.fillStyle = '#2f453d';
    c.beginPath(); c.moveTo(a.shX + 6, a.shY + 1); c.quadraticCurveTo(a.shX, a.shY - 3, a.shX - 7, a.shY + 1);
    for (let i = 0; i <= 5; i++) c.lineTo(a.shX - 7 + i * 2.6, a.shY + 5 + (i % 2) * 2.2);
    c.closePath(); c.fill();
    // hood behind the skull, peaked at the back
    const g = c.createLinearGradient(x + r, y - r * 1.5, x - r * 1.5, y + r);
    g.addColorStop(0, '#56736a'); g.addColorStop(1, '#22352f');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(x + r * 1.05, y - r * 0.2); c.quadraticCurveTo(x + r * 0.9, y - r * 1.5, x - r * 0.3, y - r * 1.45);
    c.lineTo(x - r * 1.7, y - r * 1.1); c.quadraticCurveTo(x - r * 1.5, y + r * 0.6, x - r * 1.0, y + r * 1.6); c.lineTo(x + r * 0.3, y + r * 1.3); c.closePath(); c.fill();
    c.strokeStyle = '#1a2824'; c.lineWidth = 0.5; c.stroke();
    return;
  }
  if (p.back) return;
  // brim over the brow and a few beads of bone on the mantle
  c.strokeStyle = '#56736a'; c.lineWidth = r * 0.42; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - r * 0.6, y - r * 0.95); c.quadraticCurveTo(x + r * 0.5, y - r * 1.25, x + r * 1.05, y - r * 0.45); c.stroke();
  c.fillStyle = BONE_MID;
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(a.shX - 2 + i * 2.4, a.shY + 3.4 + (i % 2) * 0.6, 0.6, 0, TAU); c.fill(); }
};
const MAGE_LOOK_H = 0.8;
const magePose: Pose = { t: 0, walk: 0, moving: false, atk: -1, cast: -1, hit: 0, dead: -1, flip: false, back: false, alpha: 1, frozen: false, chill: false };
const crumbled = new Set<number>();

interface MageState { rise: number; end: number; shot: number }
function mageState(t: number, dur: number, shotAt: number): MageState {
  return { rise: clamp01(t / MAGE.rise), end: clamp01((t - (dur - MAGE.crumble)) / MAGE.crumble), shot: t - shotAt };
}
const areaMage = (a: Area): MageState => mageState(a.t, a.dur, a.data.shot ?? -9);

AREA_ART.nc_mage = {
  light(a) { const s = areaMage(a); return [(1.4 + (s.shot < 0.25 ? 1.2 * (1 - s.shot / 0.25) : 0)) * (1 - s.end), '150,230,255']; },
  // a faint summoning sigil under the mage (its body is the depth-sorted nc_mageBody projectile)
  draw(a, d) {
    const { c, z, sx, sy, time, rx } = d;
    if (offscreen(d, Math.max(rx * 1.6, 16 * z), 0)) return;
    const s = areaMage(a);
    const sig = (1 - s.end) * (0.35 + 0.65 * (1 - ease(Math.min(1, a.t / 1.2)))) + 0.12;
    c.save(); c.translate(sx, sy); c.scale(1, 0.5);
    lighter(c);
    const R = Math.max(rx * 1.6, 16 * z);
    const gg = c.createRadialGradient(0, 0, 0, 0, 0, R);
    gg.addColorStop(0, `rgba(${SOUL_RGB},${0.22 * sig})`); gg.addColorStop(0.7, `rgba(${SOUL_RGB},${0.1 * sig})`); gg.addColorStop(1, `rgba(${SOUL_RGB},0)`);
    c.fillStyle = gg; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
    c.strokeStyle = `rgba(${SOUL_RGB},${0.55 * sig})`; c.lineWidth = 1.1 * z;
    c.beginPath(); c.arc(0, 0, R * 0.8, 0, TAU); c.stroke();
    c.rotate(time * 0.6 + a.id);
    for (let i = 0; i < 6; i++) { const an = (i / 6) * TAU; c.beginPath(); c.moveTo(Math.cos(an) * R * 0.62, Math.sin(an) * R * 0.62); c.lineTo(Math.cos(an + 0.35) * R * 0.8, Math.sin(an + 0.35) * R * 0.8); c.stroke(); }
    normal(c);
    c.restore();
  },
  air(a, d) {
    const { c, z, sx, sy, time } = d;
    const s = areaMage(a);
    if (s.shot < 0 || s.shot > 0.3 || s.end > 0.2) return;
    // the staff flares as it looses a bolt
    const k = s.shot / 0.3;
    const sd = screenDir(a.data.ang ?? 0);
    const hx = sx + sd.dx * 9 * z * ACTOR, hy = sy - 52 * z * ACTOR * MAGE_LOOK_H + sd.dy * 3 * z;
    c.save(); lighter(c);
    glowDot(c, hx, hy, (11 - 4 * k) * z, ICE_RGB, 0.7 * (1 - k));
    c.strokeStyle = `rgba(220,245,255,${0.8 * (1 - k)})`; c.lineWidth = 1 * z;
    for (let i = 0; i < 4; i++) { const an = time * 4 + (i * TAU) / 4; c.beginPath(); c.moveTo(hx + Math.cos(an) * 3 * z, hy + Math.sin(an) * 3 * z); c.lineTo(hx + Math.cos(an) * (8 + 8 * k) * z, hy + Math.sin(an) * (8 + 8 * k) * z); c.stroke(); }
    normal(c); c.restore();
  },
};

/** The skeletal mage itself: climbs out of the floor (clipped at the floor line), sways, casts, crumbles. */
PROJ_ART.nc_mageBody = {
  light: [0, '0,0,0'],  // its area lights it
  trail: ['0,0,0', 1], // stands still: an additive black trail draws nothing
  draw(p, dd) {
    const { c, z, sx, time, fx } = dd;
    const sy = dd.sy + 18 * z; // projectiles are lifted to flight height; the mage stands on the floor
    if (offscreen({ cam: dd.cam, sx, sy }, 60 * z, 110 * z)) return;
    const d = p.data ?? {};
    const s = mageState(d.t ?? p.age, d.dur ?? MAGE.dur, d.shot ?? -9);
    const k = z * ACTOR;
    const sd = screenDir(d.ang ?? 0);
    const pose = magePose;
    pose.t = time + p.id * 0.37; pose.flip = sd.dx < 0; pose.back = sd.dy < -0.55;
    pose.cast = s.shot >= 0 && s.shot < 0.34 ? s.shot / 0.34 : -1;
    const sink = (1 - ease(s.rise)) * 50 + ease(s.end) * 30;
    c.save();
    c.beginPath(); c.rect(sx - 70 * k, sy - 130 * k, 140 * k, 130 * k + 1.5 * z); c.clip();
    c.translate(sx, sy + sink * k);
    c.rotate(Math.sin(time * 1.7 + p.id) * 0.035 + ease(s.end) * (pose.flip ? -0.5 : 0.5));
    c.globalAlpha = 1 - ease(s.end) * 0.85;
    // cold aura around the body
    lighter(c);
    glowDot(c, 0, -26 * k, 24 * k, '150,255,215', 0.2 + 0.06 * Math.sin(time * 3 + p.id));
    normal(c);
    c.scale(pose.flip ? -k : k, k);
    drawBiped(c, MAGE_LOOK, pose);
    c.restore();
    // dirt kicked up while it climbs out; bones spill when it crumbles
    if (s.rise < 1 && !fx.low && Math.random() < 0.5) fx.add({ x: p.x + (Math.random() - 0.5) * 0.6, y: p.y + (Math.random() - 0.5) * 0.6, z: 1, vz: 60 + Math.random() * 40, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, color: Math.random() < 0.5 ? '#4a3e32' : '#6a5a48', kind: 'shard', size: 1.4, grav: 260, life: 0.6 });
    if (s.end > 0.05 && !crumbled.has(p.id)) {
      crumbled.add(p.id);
      if (crumbled.size > 40) crumbled.clear();
      fx.burst(p.x, p.y, fx.low ? 6 : 14, { color: BONE, kind: 'bone', size: 1.6, speed: 2.8, up: 90, grav: 280, life: 1.1, z: 26 });
      fx.burst(p.x, p.y, fx.low ? 3 : 7, { color: '#9eeaff', kind: 'smoke', size: 4, speed: 0.7, up: 30, life: 0.9, add: true, z: 30 });
      fx.stain(p.x, p.y, 'bonepile', 0.45);
    }
  },
};

// ================================================================ bone armor: orbiting plates
let ringDrawnAt = -1;
const N_PLATES = 8;
/** One curved bone plate (a rib-like crescent) at screen (x,y); `face` 0..1 how much it turns toward the viewer. */
function plate(c: C2D, x: number, y: number, z: number, rot: number, face: number, flash: number, bright: boolean): void {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(z * (0.4 + 0.6 * face), z);
  const g = c.createLinearGradient(0, -3, 0, 2);
  g.addColorStop(0, bright ? BONE_HI : BONE); g.addColorStop(0.55, bright ? BONE : BONE_MID); g.addColorStop(1, BONE_DK);
  c.fillStyle = g; c.strokeStyle = BONE_LINE; c.lineWidth = 0.5;
  c.beginPath();
  c.moveTo(-4.4, 0.4); c.quadraticCurveTo(-0.5, -3.6, 4.2, -0.8); c.lineTo(4.6, 0.3);
  c.quadraticCurveTo(0, -1.2, -3.6, 1.8); c.closePath();
  c.fill(); c.stroke();
  c.fillStyle = bright ? BONE : BONE_MID; c.beginPath(); c.arc(-4, 1, 1.15, 0, TAU); c.fill(); c.stroke();
  lighter(c);
  c.strokeStyle = `rgba(${SOUL_RGB},${0.25 + 0.6 * flash})`; c.lineWidth = 0.6;
  c.beginPath(); c.moveTo(-4.4, 0.4); c.quadraticCurveTo(-0.5, -3.6, 4.2, -0.8); c.stroke();
  normal(c);
  c.restore();
}

function drawPlates(c: C2D, sx: number, sy: number, z: number, time: number, remain: number, hitT: number, front: boolean | null, low: boolean): void {
  const n = low ? 5 : N_PLATES;
  const fade = remain < 1.5 ? (Math.sin(time * 24) > 0 ? 0.55 : 1) * clamp01(remain / 1.5 + 0.4) : 1;
  const flash = clamp01((hitT - 0.1) / 0.15);
  const push = 1 + flash * 0.25;
  c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const band = i % 2, dir = band ? -1 : 1;
    const th = time * (band ? 1.6 : 2) * dir + (i * TAU) / n;
    const sn = Math.sin(th);
    if (front !== null && (sn > 0) !== front) continue;
    const R = (19 + band * 3) * push * ACTOR, h = (18 + band * 16 + Math.sin(time * 2.3 + i) * 1.5) * ACTOR;
    const cy = sy - h * z;
    const x = sx + Math.cos(th) * R * z, y = cy + sn * R * 0.4 * z;
    // a ghostly streak along the orbit behind the plate
    if (!low) {
      lighter(c);
      c.globalAlpha = fade;
      c.strokeStyle = `rgba(${SOUL_RGB},${0.1 + 0.15 * flash})`; c.lineWidth = 4.2 * z;
      c.beginPath(); c.ellipse(sx, cy, R * z, R * 0.4 * z, 0, dir > 0 ? th - 0.75 : th, dir > 0 ? th : th + 0.75); c.stroke();
      c.strokeStyle = `rgba(240,236,215,${0.2 + 0.25 * flash})`; c.lineWidth = 1.3 * z;
      c.beginPath(); c.ellipse(sx, cy, R * z, R * 0.4 * z, 0, dir > 0 ? th - 0.45 : th, dir > 0 ? th : th + 0.45); c.stroke();
      normal(c);
    }
    c.globalAlpha = fade * (sn > 0 ? 1 : 0.72);
    plate(c, x, y, z * ACTOR * 1.3, -Math.cos(th) * 0.45 + (band ? 0.25 : -0.2), Math.abs(sn), flash, sn > 0);
  }
  c.globalAlpha = 1;
}

/** The hero's hit timer, captured by the buff draw each frame for the ring's air pass (plate flash). */
let heroHitT = 0;

BUFF_ART.nc_armor = (c, sx, sy, z, time, b, fx, h) => {
  heroHitT = h.hitT;
  // plates behind the hero (the ring area draws the ones in front, over the hero); all of them if the ring is gone
  const ring = ringDrawnAt === time;
  c.save();
  // a faint bone-white ward on the floor
  lighter(c);
  c.strokeStyle = `rgba(230,220,190,${0.18 + 0.08 * Math.sin(time * 3)})`; c.lineWidth = 1.2 * z;
  c.beginPath(); c.ellipse(sx, sy, 20 * z, 9 * z, 0, 0, TAU); c.stroke();
  normal(c);
  drawPlates(c, sx, sy, z, time, b.t, h.hitT, ring ? false : null, fx.low);
  c.restore();
};

AREA_ART.nc_armorRing = {
  draw(_a, d) { ringDrawnAt = d.time; },
  air(a, d) {
    const { c, z, sx, sy, time, fx } = d;
    c.save();
    drawPlates(c, sx, sy, z, time, a.dur - a.t, heroHitT, true, fx.low);
    c.restore();
  },
};

// ================================================================ plague cloud
function plagueFade(a: Area): number {
  return clamp01(a.t / 0.3) * clamp01((a.dur - a.t) / 0.8);
}

AREA_ART.nc_plague = {
  light(a) { return [a.r * 0.8 * plagueFade(a), '130,255,90']; },
  draw(a, d) {
    const { c, z, sx, sy, rx, time } = d;
    if (offscreen(d, rx * 1.2, 0)) return;
    const f = plagueFade(a);
    const grow = 0.45 + 0.55 * ease(Math.min(1, a.t / 0.4));
    const R = rx * grow;
    c.save(); c.translate(sx, sy);
    // toxic pool with a ragged, creeping rim right at the cloud's edge (the reach reads at a glance)
    c.save(); c.scale(1, 0.5);
    const g = c.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
    g.addColorStop(0, `rgba(86,124,30,${0.46 * f})`); g.addColorStop(0.6, `rgba(58,90,22,${0.42 * f})`); g.addColorStop(0.9, `rgba(70,112,24,${0.48 * f})`); g.addColorStop(1, 'rgba(30,48,10,0)');
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i <= 40; i++) {
      const an = (i / 40) * TAU;
      const w = 0.97 + 0.05 * Math.sin(an * 3 + a.id) + 0.03 * Math.sin(an * 7 + time * 1.3 + a.id);
      if (i) c.lineTo(Math.cos(an) * R * w, Math.sin(an) * R * w); else c.moveTo(Math.cos(an) * R * w, Math.sin(an) * R * w);
    }
    c.closePath(); c.fill();
    lighter(c);
    c.lineJoin = 'round';
    c.strokeStyle = `rgba(${TOX_RGB},${0.07 * f})`; c.lineWidth = 7 * z; c.stroke();
    c.strokeStyle = `rgba(190,255,120,${(0.26 + 0.06 * Math.sin(time * 3 + a.id)) * f})`; c.lineWidth = 1.5 * z; c.stroke();
    // a slow toxic swirl on the surface
    c.rotate(time * 0.35 + a.id);
    c.strokeStyle = `rgba(170,255,110,${0.09 * f})`; c.lineWidth = 3 * z;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, 0, R * (0.3 + i * 0.2), i * 2.1, i * 2.1 + 1.6); c.stroke(); }
    normal(c);
    c.restore();
    // bubbles that swell and pop (deterministic per area, cycling)
    const nb = d.fx.low ? 5 : 11;
    for (let i = 0; i < nb; i++) {
      const per = 0.9 + hash(a.id, i) * 0.7;
      const cyc = Math.floor((time + hash(i, a.id) * per) / per);
      const u = ((time + hash(i, a.id) * per) % per) / per;
      const an = hash(a.id + cyc, i * 7) * TAU, rr = Math.sqrt(hash(i * 3, a.id + cyc)) * R * 0.85;
      const bx = Math.cos(an) * rr, by = Math.sin(an) * rr * 0.5;
      const br = (1.2 + hash(cyc, i) * 2.4) * z;
      if (u < 0.8) {
        const r0 = br * ease(u / 0.8);
        c.fillStyle = `rgba(120,190,40,${0.75 * f})`; c.beginPath(); c.ellipse(bx, by, r0, r0 * 0.8, 0, 0, TAU); c.fill();
        c.fillStyle = `rgba(220,255,160,${0.7 * f})`; c.beginPath(); c.arc(bx - r0 * 0.3, by - r0 * 0.35, r0 * 0.28, 0, TAU); c.fill();
      } else {
        const k = (u - 0.8) / 0.2;
        c.strokeStyle = `rgba(190,255,120,${0.7 * (1 - k) * f})`; c.lineWidth = 0.8 * z;
        c.beginPath(); c.ellipse(bx, by, br * (1 + k * 1.5), br * (0.8 + k * 1.2) * 0.6, 0, 0, TAU); c.stroke();
      }
    }
    c.restore();
  },
  air(a, d) {
    const { c, z, sx, sy, rx, time, fx } = d;
    const f = plagueFade(a);
    if (f <= 0.01 || offscreen(d, rx * 1.2, 60 * z)) return;
    const grow = 0.5 + 0.5 * ease(Math.min(1, a.t / 0.5));
    c.save();
    const n = fx.low ? 6 : 11;
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 1) lighter(c);
      for (let i = 0; i < n; i++) {
        const an = hash(a.id, i) * TAU + time * (0.12 + hash(i, 5) * 0.1) * (i % 2 ? 1 : -1);
        const rr = (i % 2 ? 0.55 + 0.33 * hash(i, a.id + 1) : 0.05 + 0.5 * hash(i, a.id + 1)) * rx * grow;
        const px = sx + Math.cos(an) * rr, py = sy + Math.sin(an) * rr * 0.5 - (10 + hash(i, 9) * 26 + Math.sin(time * 1.1 + i) * 4) * z;
        const pr = (0.24 + 0.16 * hash(i, 3)) * rx * (0.8 + 0.2 * Math.sin(time * 0.9 + i)) * (pass ? 0.7 : 1);
        const col = pass ? (i % 2 ? '160,255,90' : '120,230,70') : i % 3 === 0 ? '96,138,42' : i % 3 === 1 ? '72,114,34' : '106,126,58';
        const al = pass ? 0.075 : 0.3;
        const g = c.createRadialGradient(px, py, 0, px, py, pr);
        g.addColorStop(0, `rgba(${col},${al * f})`); g.addColorStop(0.6, `rgba(${col},${al * 0.5 * f})`); g.addColorStop(1, `rgba(${col},0)`);
        c.fillStyle = g; c.beginPath(); c.ellipse(px, py, pr, pr * 0.72, 0, 0, TAU); c.fill();
      }
    }
    normal(c); c.restore();
    // rising spores
    if (Math.random() < (fx.low ? 0.2 : 0.6) * f) {
      const an = Math.random() * TAU, rr = Math.sqrt(Math.random()) * a.r * 0.9;
      fx.add({ x: a.x + Math.cos(an) * rr, y: a.y + Math.sin(an) * rr, z: 2, vz: 12 + Math.random() * 14, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, color: Math.random() < 0.5 ? '#b8ff70' : '#7ad040', kind: 'dot', size: 1.1 + Math.random(), life: 1.3, add: true });
    }
    if (Math.random() < (fx.low ? 0.03 : 0.08) * f) {
      const an = Math.random() * TAU, rr = Math.sqrt(Math.random()) * a.r * 0.85;
      fx.effect('nc_puff', a.x + Math.cos(an) * rr, a.y + Math.sin(an) * rr, 1.8 + Math.random() * 0.6, {
        r: 12 + Math.random() * 6, c: Math.random() < 0.7 ? '70,106,30' : '130,200,60', power: 6,
        data: { vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, rise: 8 + Math.random() * 6, grow: 1.3, a: 0.34, add: false } satisfies Puff,
      });
    }
  },
};

// ================================================================ timed effects
/** Motion of a soft puff (EFFECT_ART.nc_puff): drift (tiles, decelerating), rise (px/s), growth and peak alpha. */
interface Puff { vx: number; vy: number; rise: number; grow: number; a: number; add: boolean }
/**
 * Soft gas / mist puffs (radial gradients) instead of the engine's hard-edged smoke discs: gore mist, soul smoke,
 * plague gas. r = start radius (px at zoom 1), c = 'r,g,b', power = start height (px).
 */
function puffs(h: FxHost, x: number, y: number, n: number, o: { r: number; c: string; a: number; add?: boolean; speed: number; rise: number; grow?: number; z?: number; life: number; spread?: number }): void {
  const m = h.low ? Math.ceil(n / 2) : n;
  for (let i = 0; i < m; i++) {
    const an = Math.random() * TAU, sp = o.speed * (0.35 + Math.random() * 0.65);
    const off = (o.spread ?? 0.2) * Math.random();
    const data: Puff = { vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, rise: o.rise * (0.6 + Math.random() * 0.6), grow: o.grow ?? 1.4, a: o.a * (0.75 + Math.random() * 0.25), add: !!o.add };
    h.fx.effect('nc_puff', x + Math.cos(an) * off, y + Math.sin(an) * off, o.life * (0.75 + Math.random() * 0.5), { r: o.r * (0.8 + Math.random() * 0.4), c: o.c, power: o.z ?? 10, data });
  }
}
EFFECT_ART.nc_puff = {
  air(e, d) {
    const { c, cam, z, k } = d;
    const q = e.data as Puff;
    const trav = (1 - Math.exp(-2.4 * e.t)) / 2.4;
    const x = e.x + q.vx * trav, y = e.y + q.vy * trav;
    const sx = cam.sxOf(x, y), sy = cam.syOf(x, y) - (e.power + q.rise * e.t) * z;
    const R = e.r * z * (0.6 + q.grow * (1 - (1 - k) * (1 - k)));
    if (sx + R < 0 || sx - R > cam.w || sy + R < 0 || sy - R > cam.h) return;
    const a = q.a * Math.min(1, k / 0.12) * (1 - k) * (1 - k * 0.3);
    if (a <= 0.005) return;
    if (q.add) lighter(c);
    const g = c.createRadialGradient(sx, sy - R * 0.15, 0, sx, sy, R);
    g.addColorStop(0, `rgba(${e.c},${a})`); g.addColorStop(0.55, `rgba(${e.c},${a * 0.6})`); g.addColorStop(1, `rgba(${e.c},0)`);
    c.fillStyle = g; c.beginPath(); c.ellipse(sx, sy, R, R * 0.82, 0, 0, TAU); c.fill();
    normal(c);
  },
};

/** Soft flash with four thin rays: r = size (tiles), c = 'r,g,b', power = lift in px. */
EFFECT_ART.nc_flash = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const cy = sy - (e.power || 20) * z;
    const s = (6 + e.r * 22) * z * (0.6 + k * 0.7);
    c.save(); lighter(c);
    glowDot(c, sx, cy, s, e.c, 1 - k);
    c.translate(sx, cy); c.rotate(e.seed);
    c.fillStyle = `rgba(255,255,255,${0.8 * (1 - k)})`;
    for (let i = 0; i < 2; i++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(-s * 1.2, 0); c.lineTo(0, -s * 0.06); c.lineTo(s * 1.2, 0); c.lineTo(0, s * 0.06); c.closePath(); c.fill(); }
    normal(c); c.restore();
  },
  light(e, k) { return e.r >= 0.5 ? [e.r * 2.4 * (1 - k), e.c] : null; },
};

/** Bone spear release: a cone of soul light and two crescents rushing forward (ang = screen heading). */
EFFECT_ART.nc_spearBurst = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    c.save(); c.translate(sx, sy - 26 * z); c.rotate(e.ang); lighter(c);
    const L = (26 + 40 * ease(k)) * z;
    const g = c.createLinearGradient(0, 0, L, 0);
    g.addColorStop(0, `rgba(230,255,240,${0.5 * (1 - k)})`); g.addColorStop(0.4, `rgba(${SOUL_RGB},${0.3 * (1 - k)})`); g.addColorStop(1, `rgba(${SOUL_RGB},0)`);
    c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(L, -L * 0.28); c.quadraticCurveTo(L * 1.1, 0, L, L * 0.28); c.closePath(); c.fill();
    for (let i = 0; i < 2; i++) {
      const kk = clamp01(k * 1.3 - i * 0.2);
      if (kk <= 0 || kk >= 1) continue;
      const x = (10 + 46 * kk) * z;
      c.strokeStyle = `rgba(200,255,225,${0.8 * (1 - kk)})`; c.lineWidth = (2.2 - i * 0.6) * z;
      c.beginPath(); c.ellipse(x, 0, 4 * z, (9 + 8 * kk) * z, 0, -1.2, 1.2); c.stroke();
    }
    normal(c); c.restore();
  },
  light(_e, k) { return [2.6 * (1 - k), SOUL_RGB]; },
};

/** A bright streak through an impaled enemy along the spear's heading. */
EFFECT_ART.nc_pierce = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    c.save(); c.translate(sx, sy - 20 * z); c.rotate(e.ang); lighter(c);
    const a = 1 - k;
    const g = c.createLinearGradient(-22 * z, 0, 34 * z, 0);
    g.addColorStop(0, `rgba(${SOUL_RGB},0)`); g.addColorStop(0.45, `rgba(235,255,245,${0.9 * a})`); g.addColorStop(1, `rgba(${SOUL_RGB},0)`);
    c.fillStyle = g; c.beginPath(); c.ellipse(6 * z, 0, 28 * z, (2.6 - 1.5 * k) * z, 0, 0, TAU); c.fill();
    normal(c); c.restore();
  },
};

/** A corpse swelling with green-red light before it bursts (dur = time until the blast). */
EFFECT_ART.nc_swell = {
  ground(e, d) {
    const { c, z, sx, sy, k } = d;
    c.save(); lighter(c); c.translate(sx, sy); c.scale(1, 0.5);
    const R = (14 + 18 * k) * z;
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, `rgba(${SOUL_RGB},${0.35 + 0.4 * k})`); g.addColorStop(0.6, `rgba(${GORE_RGB},${0.2 + 0.3 * k})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
    normal(c); c.restore();
  },
  air(e, d) {
    const { c, z, sx, sy, k, time } = d;
    const cy = sy - 6 * z;
    const pulse = 0.5 + 0.5 * Math.sin(time * 40);
    const R = (6 + 9 * ease(k) + pulse * 2 * k) * z;
    c.save(); lighter(c);
    const g = c.createRadialGradient(sx, cy, 0, sx, cy, R);
    g.addColorStop(0, `rgba(255,240,220,${0.5 + 0.4 * k})`); g.addColorStop(0.35, `rgba(${GORE_RGB},${0.5 * k + 0.2})`); g.addColorStop(0.75, `rgba(${SOUL_RGB},${0.35})`); g.addColorStop(1, `rgba(${SOUL_RGB},0)`);
    c.fillStyle = g; c.beginPath(); c.ellipse(sx, cy, R * 1.3, R, 0, 0, TAU); c.fill();
    normal(c);
    // throbbing veins
    c.strokeStyle = `rgba(120,10,10,${0.5 + 0.3 * pulse})`; c.lineWidth = 0.8 * z;
    for (let i = 0; i < 5; i++) {
      const an = e.seed + (i / 5) * TAU;
      c.beginPath(); c.moveTo(sx, cy); c.quadraticCurveTo(sx + Math.cos(an + 0.5) * R * 0.6, cy + Math.sin(an + 0.5) * R * 0.45, sx + Math.cos(an) * R * 1.15, cy + Math.sin(an) * R * 0.85); c.stroke();
    }
    c.restore();
  },
  light(_e, k) { return [0.8 + 1.4 * k, '255,120,90']; },
};

/** The corpse bursting: flash, a gore-and-soul fireball, bone shrapnel streaks, a shock ring. */
EFFECT_ART.nc_boom = {
  ground(e, d) {
    const { c, z, sx, sy, k, rx } = d;
    const ek = 1 - Math.pow(1 - k, 2.4);
    c.save(); c.translate(sx, sy); c.scale(1, 0.5); lighter(c);
    const R = rx * (0.3 + 0.85 * ek);
    const g = c.createRadialGradient(0, 0, R * 0.55, 0, 0, R);
    g.addColorStop(0, `rgba(${SOUL_RGB},0)`); g.addColorStop(0.75, `rgba(${SOUL_RGB},${0.35 * (1 - k)})`); g.addColorStop(1, `rgba(${GORE_RGB},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
    c.strokeStyle = `rgba(255,200,180,${0.45 * (1 - k)})`; c.lineWidth = 1.6 * z; c.beginPath(); c.arc(0, 0, R * 0.96, 0, TAU); c.stroke();
    normal(c); c.restore();
  },
  air(e, d) {
    const { c, z, sx, sy, k, rx } = d;
    const ek = 1 - Math.pow(1 - k, 2);
    const cy = sy - (10 + 12 * ek) * z;
    const rr = rx * (0.2 + 0.5 * ek);
    c.save();
    // a dark cloud of gore mist first (not additive), then the soul-fire glow over it
    const mg = c.createRadialGradient(sx, cy + 4 * z, 0, sx, cy + 4 * z, rr * 1.1);
    mg.addColorStop(0, `rgba(90,10,8,${0.55 * (1 - k)})`); mg.addColorStop(0.7, `rgba(50,6,4,${0.35 * (1 - k)})`); mg.addColorStop(1, 'rgba(30,4,2,0)');
    c.fillStyle = mg; c.beginPath(); c.ellipse(sx, cy + 4 * z, rr * 1.1, rr * 0.8, 0, 0, TAU); c.fill();
    lighter(c);
    if (k < 0.14) { const f = 1 - k / 0.14; glowDot(c, sx, cy, rx * 0.42, '255,235,210', 0.75 * f); }
    const g = c.createRadialGradient(sx, cy, 0, sx, cy, rr);
    g.addColorStop(0, `rgba(255,170,140,${0.6 * (1 - k)})`); g.addColorStop(0.35, `rgba(${GORE_RGB},${0.45 * (1 - k)})`); g.addColorStop(0.7, `rgba(${SOUL_RGB},${0.3 * (1 - k)})`); g.addColorStop(1, `rgba(${SOUL_RGB},0)`);
    c.fillStyle = g; c.beginPath(); c.ellipse(sx, cy, rr, rr * 0.78, 0, 0, TAU); c.fill();
    // shrapnel streaks radiating out
    const n = 12;
    for (let i = 0; i < n; i++) {
      const an = e.seed + (i / n) * TAU + hash(i, e.seed | 0) * 0.4;
      const r0 = rr * (0.4 + 1.1 * ek), r1 = r0 + rx * 0.3 * (1 - k);
      c.strokeStyle = i % 3 ? `rgba(240,228,200,${0.75 * (1 - k)})` : `rgba(${SOUL_RGB},${0.7 * (1 - k)})`;
      c.lineWidth = (i % 3 ? 1.3 : 1) * z;
      c.beginPath(); c.moveTo(sx + Math.cos(an) * r0, cy + Math.sin(an) * r0 * 0.7); c.lineTo(sx + Math.cos(an) * r1, cy + Math.sin(an) * r1 * 0.7); c.stroke();
    }
    normal(c); c.restore();
  },
  light(e, k) { return k < 0.6 ? [e.r * 1.3 * (1 - k / 0.6), k < 0.2 ? '255,190,150' : '255,100,70'] : null; },
};

/** A ghostly tendril from the necromancer's hand to the first corpse (x2,y2). */
EFFECT_ART.nc_curse = {
  air(e, d) {
    const { c, cam, z, k, time } = d;
    const x0 = cam.sxOf(e.x, e.y), y0 = cam.syOf(e.x, e.y) - 30 * z;
    const x1 = cam.sxOf(e.x2 ?? e.x, e.y2 ?? e.y), y1 = cam.syOf(e.x2 ?? e.x, e.y2 ?? e.y) - 6 * z;
    const a = 1 - k;
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const reach = ease(Math.min(1, k / 0.35));
    c.save(); lighter(c); c.lineCap = 'round';
    for (const [w, col] of [[5, `rgba(${SOUL_RGB},${0.3 * a})`], [1.6, `rgba(220,255,235,${0.9 * a})`]] as [number, string][]) {
      c.strokeStyle = col; c.lineWidth = w * z;
      c.beginPath();
      for (let i = 0; i <= 16; i++) {
        const u = (i / 16) * reach, wob = Math.sin(u * 14 - time * 30) * 4 * z * Math.sin(u * Math.PI);
        const x = x0 + dx * u + nx * wob, y = y0 + dy * u + ny * wob - Math.sin(u * Math.PI) * 18 * z;
        if (i) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.stroke();
    }
    glowDot(c, x0, y0, 10 * z, SOUL_RGB, 0.8 * a);
    normal(c); c.restore();
  },
};

/** Raising a skeletal mage: a sigil burns into the floor and a column of soul-fire rises. */
EFFECT_ART.nc_raise = {
  ground(e, d) {
    const { c, z, sx, sy, k } = d;
    const R = (18 + 10 * ease(Math.min(1, k / 0.3))) * z;
    const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    c.save(); c.translate(sx, sy); c.scale(1, 0.5); lighter(c);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R * 1.3);
    g.addColorStop(0, `rgba(${SOUL_RGB},${0.3 * a})`); g.addColorStop(1, `rgba(${SOUL_RGB},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R * 1.3, 0, TAU); c.fill();
    c.strokeStyle = `rgba(200,255,225,${0.8 * a})`; c.lineWidth = 1.4 * z;
    c.beginPath(); c.arc(0, 0, R, 0, TAU); c.stroke();
    c.beginPath(); c.arc(0, 0, R * 0.72, 0, TAU); c.stroke();
    // a five-point star inside
    c.lineWidth = 1 * z;
    c.beginPath();
    for (let i = 0; i <= 5; i++) { const an = -Math.PI / 2 + (i * 2 * TAU) / 5 + e.seed * 0.1; const px = Math.cos(an) * R * 0.72, py = Math.sin(an) * R * 0.72; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
    c.stroke();
    normal(c); c.restore();
  },
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const h = (20 + 70 * ease(Math.min(1, k / 0.5))) * z, w = (14 - 8 * k) * z;
    const a = k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6;
    c.save(); lighter(c);
    const g = c.createLinearGradient(sx, sy - h, sx, sy);
    g.addColorStop(0, `rgba(${SOUL_RGB},0)`); g.addColorStop(0.6, `rgba(${SOUL_RGB},${0.22 * a})`); g.addColorStop(1, `rgba(200,255,225,${0.42 * a})`);
    c.fillStyle = g; c.beginPath(); c.moveTo(sx - w, sy); c.quadraticCurveTo(sx - w * 0.6, sy - h * 0.6, sx, sy - h); c.quadraticCurveTo(sx + w * 0.6, sy - h * 0.6, sx + w, sy); c.closePath(); c.fill();
    normal(c); c.restore();
  },
  light(_e, k) { return [2.2 * (1 - k), SOUL_RGB]; },
};

/** Bone armor forming: shards spiral up from the floor into the orbit. */
EFFECT_ART.nc_armorForm = {
  air(e, d) {
    const { c, z, sx, sy, k } = d;
    const n = d.fx.low ? 6 : 10;
    c.save();
    for (let i = 0; i < n; i++) {
      const u = clamp01(k * 1.25 - (i / n) * 0.25);
      if (u <= 0 || u >= 1) continue;
      const th = e.seed + (i / n) * TAU + u * 4.2;
      const R = (38 - 22 * ease(u)) * z * ACTOR * 0.8, hgt = (2 + 34 * ease(u)) * z * ACTOR;
      const x = sx + Math.cos(th) * R, y = sy - hgt + Math.sin(th) * R * 0.42;
      c.globalAlpha = Math.min(1, (1 - u) * 3);
      c.save(); c.translate(x, y); c.rotate(th + Math.PI / 2); c.scale(z * 0.7, z * 0.7);
      splinter(c, 1, Math.sin(th) > 0 ? BONE_HI : BONE_MID);
      c.restore();
    }
    c.globalAlpha = 1;
    lighter(c);
    const a = Math.sin(Math.min(1, k) * Math.PI);
    c.strokeStyle = `rgba(235,228,200,${0.45 * a})`; c.lineWidth = 2 * z;
    c.beginPath(); c.ellipse(sx, sy - 26 * z * ACTOR, (20 - 4 * k) * z * ACTOR, 8 * z * ACTOR, 0, 0, TAU); c.stroke();
    glowDot(c, sx, sy - 28 * z * ACTOR, 26 * z * a, SOUL_RGB, 0.35 * a);
    normal(c); c.restore();
  },
};

/** Thorn shards flying from the hero to a melee attacker (x2,y2). */
EFFECT_ART.nc_shards = {
  air(e, d) {
    const { c, cam, z, k } = d;
    const x0 = cam.sxOf(e.x, e.y), y0 = cam.syOf(e.x, e.y) - 26 * z;
    const x1 = cam.sxOf(e.x2 ?? e.x, e.y2 ?? e.y), y1 = cam.syOf(e.x2 ?? e.x, e.y2 ?? e.y) - 22 * z;
    const ang = Math.atan2(y1 - y0, x1 - x0);
    c.save();
    for (let i = 0; i < 3; i++) {
      const u = clamp01(k * 1.4 - i * 0.15);
      if (u <= 0 || u >= 1) continue;
      const off = (i - 1) * 4 * z;
      const x = x0 + (x1 - x0) * u - Math.sin(ang) * off, y = y0 + (y1 - y0) * u + Math.cos(ang) * off;
      c.save(); c.translate(x, y); c.rotate(ang); c.scale(z * 0.6, z * 0.6); splinter(c, 1); c.restore();
    }
    normal(c); c.restore();
  },
};

/** Plague released on the target: a ring of spreading toxic gas. */
EFFECT_ART.nc_plagueBurst = {
  ground(e, d) {
    const { c, z, sx, sy, k, rx } = d;
    const ek = 1 - Math.pow(1 - k, 2.5);
    c.save(); c.translate(sx, sy); c.scale(1, 0.5); lighter(c);
    const R = rx * (0.2 + 0.9 * ek);
    const g = c.createRadialGradient(0, 0, R * 0.5, 0, 0, R);
    g.addColorStop(0, `rgba(${TOX_RGB},0)`); g.addColorStop(0.8, `rgba(${TOX_RGB},${0.5 * (1 - k)})`); g.addColorStop(1, `rgba(${TOX_RGB},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
    c.strokeStyle = `rgba(210,255,150,${0.6 * (1 - k)})`; c.lineWidth = 2 * z; c.beginPath(); c.arc(0, 0, R * 0.97, 0, TAU); c.stroke();
    normal(c); c.restore();
  },
  light(e, k) { return [e.r * 1.2 * (1 - k), '150,255,90']; },
};

// ================================================================ sim fx events → particles and effects
const dirOf = (e: { x: number; y: number; x2?: number; y2?: number }): { x: number; y: number } => {
  const dx = (e.x2 ?? e.x + 1) - e.x, dy = (e.y2 ?? e.y) - e.y, l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
};

FX_EVENT.nc_boltCast = (e, h) => {
  const dir = dirOf(e);
  const px = e.x + dir.x * 0.45, py = e.y + dir.y * 0.45;
  h.fx.effect('nc_flash', px, py, 0.16, { r: 0.35, c: SOUL_RGB, power: 30 });
  h.fx.burst(px, py, h.low ? 3 : 6, { dir, spread: 0.9, color: '#b8ffd8', kind: 'streak', size: 1, speed: 4, up: 20, life: 0.25, add: true, z: 30 });
};

FX_EVENT.nc_boltHit = (e, h) => {
  const dir = dirOf(e);
  h.fx.burst(e.x, e.y, h.low ? 4 : 8, { dir, spread: 1.3, color: BONE, kind: 'bone', size: 1.1, speed: 4, up: 80, grav: 280, life: 0.6, z: 20 });
  h.fx.burst(e.x, e.y, h.low ? 2 : 4, { color: '#9dffc8', kind: 'smoke', size: 3, speed: 0.6, up: 20, life: 0.5, add: true, z: 20 });
  h.fx.effect('nc_flash', e.x, e.y, 0.14, { r: 0.3, c: SOUL_RGB, power: 20 });
};

FX_EVENT.nc_spearCast = (e, h) => {
  const dir = dirOf(e);
  const px = e.x + dir.x * 0.5, py = e.y + dir.y * 0.5;
  h.fx.effect('nc_spearBurst', px, py, 0.32, { ang: screenAng(dir.x, dir.y) });
  h.fx.effect('nc_flash', px, py, 0.18, { r: 0.4, c: SOUL_RGB, power: 28 });
  h.fx.burst(px, py, h.low ? 5 : 12, { dir, spread: 0.7, color: BONE, kind: 'bone', size: 1.2, speed: 7, up: 50, grav: 200, life: 0.5, z: 26 });
  h.fx.burst(e.x, e.y, h.low ? 3 : 7, { dir: { x: -dir.x, y: -dir.y }, spread: 1.6, color: '#5a5448', kind: 'smoke', size: 4, speed: 1.4, up: 10, life: 0.6, z: 3 });
};

FX_EVENT.nc_spearHit = (e, h) => {
  const dir = dirOf(e);
  h.fx.effect('nc_pierce', e.x, e.y, 0.2, { ang: screenAng(dir.x, dir.y) });
  h.fx.burst(e.x, e.y, h.low ? 4 : 9, { dir, spread: 0.8, color: BONE, kind: 'bone', size: 1.3, speed: 6, up: 70, grav: 280, life: 0.6, z: 22 });
  h.fx.burst(e.x, e.y, h.low ? 2 : 5, { dir, spread: 0.5, color: '#c8ffe0', kind: 'streak', size: 1.1, speed: 8, up: 20, life: 0.25, add: true, z: 22 });
};

FX_EVENT.nc_corpseCast = (e, h) => {
  const dir = dirOf(e);
  const hx = e.x + dir.x * 0.35, hy = e.y + dir.y * 0.35;
  h.fx.effect('nc_curse', hx, hy, 0.32, { x2: e.x2, y2: e.y2 });
  h.fx.effect('nc_flash', hx, hy, 0.2, { r: 0.32, c: SOUL_RGB, power: 30 });
};

FX_EVENT.nc_corpseMark = (e, h) => {
  const dur = Math.max(0.08, e.r ?? 0.1);
  h.fx.effect('nc_swell', e.x, e.y, dur, {});
  h.fx.burst(e.x, e.y, h.low ? 2 : 5, { color: '#9dffc8', kind: 'dot', size: 1.4, speed: 0.5, up: 40, life: dur + 0.2, add: true, z: 6 });
};

FX_EVENT.nc_corpseBoom = (e, h) => {
  const fx = h.fx, low = h.low, r = e.r ?? 2.6;
  fx.effect('nc_boom', e.x, e.y, 0.55, { r });
  fx.effect('shock', e.x, e.y, 0.45, { r: r * 1.05, c: GORE_RGB });
  fx.stain(e.x, e.y, 'blood', 0.95, 0.25);
  fx.stain(e.x, e.y, 'scorch', 0.6, 0.1);
  // gore chunks, bone shrapnel, blood spray, soul smoke, sparks
  fx.burst(e.x, e.y, low ? 6 : 14, { color: '#6a0a08', kind: 'chunk', size: 2.6, speed: 5.5, up: 170, grav: 320, life: 1.4, z: 10, stain: 'blood' });
  fx.burst(e.x, e.y, low ? 8 : 20, { color: BONE, kind: 'bone', size: 1.8, speed: r * 3.2, up: 150, grav: 300, life: 1.1, z: 12 });
  fx.burst(e.x, e.y, low ? 10 : 26, { color: '#8a0808', kind: 'drop', size: 1.7, speed: 6.5, up: 130, grav: 340, life: 0.9, z: 14, stain: 'splat' });
  // a lingering cloud of gore mist with ghostly green soul-smoke curling out of it
  puffs(h, e.x, e.y, 4, { r: 14, c: '74,12,9', a: 0.55, speed: r * 0.45, rise: 10, grow: 1.6, z: 12, life: 1.5, spread: 0.4 });
  puffs(h, e.x, e.y, 3, { r: 11, c: '98,255,156', a: 0.3, add: true, speed: r * 0.35, rise: 26, grow: 1.5, z: 20, life: 1.2, spread: 0.3 });
  if (!low) fx.burst(e.x, e.y, 18, { color: '#ffd0b0', kind: 'streak', size: 1.3, speed: r * 5, up: 120, grav: 200, life: 0.5, add: true, z: 12 });
};

FX_EVENT.nc_mageRise = (e, h) => {
  const fx = h.fx;
  fx.effect('nc_raise', e.x, e.y, 0.9, {});
  fx.stain(e.x, e.y, 'crack', 0.7);
  fx.burst(e.x, e.y, h.low ? 5 : 12, { color: '#4e4236', kind: 'shard', size: 1.8, speed: 2.4, up: 130, grav: 300, life: 0.9, z: 2 });
  fx.burst(e.x, e.y, h.low ? 3 : 8, { color: BONE, kind: 'bone', size: 1.2, speed: 1.8, up: 110, grav: 280, life: 0.8, z: 2 });
  fx.burst(e.x, e.y, h.low ? 4 : 10, { color: '#a8ffd0', kind: 'dot', size: 1.4, speed: 0.8, up: 90, life: 1, add: true, z: 4 });
};

FX_EVENT.nc_mageShot = (e, h) => {
  const dir = dirOf(e);
  h.fx.burst(e.x + dir.x * 0.25, e.y + dir.y * 0.25, h.low ? 2 : 4, { dir, spread: 1, color: '#bfe8ff', kind: 'ice', size: 0.9, speed: 2.5, up: 30, grav: 80, life: 0.3, add: true, z: 58 });
};

FX_EVENT.nc_mageHit = (e, h) => {
  const dir = dirOf(e);
  h.fx.burst(e.x, e.y, h.low ? 3 : 7, { dir, spread: 1.4, color: '#e0f6ff', kind: 'ice', size: 1.3, speed: 3.5, up: 70, grav: 220, life: 0.55, add: true, z: 20 });
  h.fx.burst(e.x, e.y, h.low ? 2 : 4, { dir, spread: 1.2, color: BONE, kind: 'bone', size: 1, speed: 3, up: 60, grav: 260, life: 0.5, z: 20 });
  h.fx.effect('nc_flash', e.x, e.y, 0.14, { r: 0.3, c: ICE_RGB, power: 20 });
};

FX_EVENT.nc_mageGone = (e, h) => {
  h.fx.burst(e.x, e.y, h.low ? 6 : 14, { color: BONE, kind: 'bone', size: 1.6, speed: 2.8, up: 90, grav: 280, life: 1.1, z: 26 });
  h.fx.burst(e.x, e.y, h.low ? 3 : 7, { color: '#9eeaff', kind: 'smoke', size: 4, speed: 0.7, up: 30, life: 0.9, add: true, z: 30 });
  h.fx.stain(e.x, e.y, 'bonepile', 0.45);
};

FX_EVENT.nc_armorCast = (e, h) => {
  const fx = h.fx;
  fx.effect('nc_armorForm', e.x, e.y, 0.6, {});
  fx.effect('dust', e.x, e.y, 0.6, { r: 1.4 });
  fx.effect('shock', e.x, e.y, 0.4, { r: 1.6, c: '235,225,195' });
  fx.burst(e.x, e.y, h.low ? 5 : 12, { color: BONE, kind: 'bone', size: 1.3, speed: 2, up: 140, grav: 200, life: 0.8, z: 4 });
};

FX_EVENT.nc_thorns = (e, h: FxHost) => {
  const dir = dirOf(e);
  h.fx.effect('nc_shards', e.x, e.y, 0.16, { x2: e.x2, y2: e.y2 });
  const tx = e.x2 ?? e.x, ty = e.y2 ?? e.y;
  h.delay(0.1, () => {
    h.fx.burst(tx, ty, h.low ? 3 : 6, { dir, spread: 1.2, color: BONE, kind: 'bone', size: 1.1, speed: 3.5, up: 70, grav: 280, life: 0.5, z: 22 });
    h.fx.burst(tx, ty, h.low ? 2 : 4, { dir, spread: 1, color: '#a00a08', kind: 'drop', size: 1.3, speed: 3, up: 60, grav: 320, life: 0.6, z: 22, stain: 'splat' });
  });
};

FX_EVENT.nc_plagueCast = (e, h) => {
  const fx = h.fx, r = e.r ?? 3.4;
  const tx = e.x2 ?? e.x, ty = e.y2 ?? e.y;
  const dir = dirOf(e);
  fx.effect('nc_flash', e.x + dir.x * 0.45, e.y + dir.y * 0.45, 0.25, { r: 0.5, c: TOX_RGB, power: 42 });
  fx.burst(e.x + dir.x * 0.45, e.y + dir.y * 0.45, h.low ? 3 : 8, { dir, spread: 0.8, color: '#9dff6a', kind: 'smoke', size: 3, speed: 3, up: 10, life: 0.6, add: true, z: 40 });
  fx.effect('nc_plagueBurst', tx, ty, 0.7, { r });
  // the gas rolls out to the edge of the cloud: murky billows with a toxic glow
  puffs(h, tx, ty, 9, { r: 16, c: '62,96,24', a: 0.5, speed: r * 1.8, rise: 6, grow: 1.5, z: 10, life: 1.4, spread: 0.6 });
  puffs(h, tx, ty, 7, { r: 12, c: '150,255,80', a: 0.22, add: true, speed: r * 1.6, rise: 14, grow: 1.6, z: 14, life: 1.1, spread: 0.5 });
  fx.burst(tx, ty, h.low ? 6 : 14, { color: '#b8ff70', kind: 'dot', size: 1.4, speed: r * 1.4, up: 40, life: 0.9, add: true, z: 8, drag: 2 });
  fx.stain(tx, ty, 'slime', r * 0.55, 0.6);
};

/** A sickly green sheen over an enemy choking in the plague (refreshed every tick while it stays inside). */
EFFECT_ART.nc_sick = {
  air(e, d) {
    const { c, z, sx, sy, k, time } = d;
    const a = Math.sin(Math.min(1, k) * Math.PI) * (0.8 + 0.2 * Math.sin(time * 9 + e.seed));
    const cy = sy - 22 * z;
    c.save(); lighter(c);
    const g = c.createRadialGradient(sx, cy, 0, sx, cy, 22 * z);
    g.addColorStop(0, `rgba(${TOX_RGB},${0.26 * a})`); g.addColorStop(0.6, `rgba(90,200,50,${0.14 * a})`); g.addColorStop(1, 'rgba(60,160,30,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(sx, cy, 15 * z, 24 * z, 0, 0, TAU); c.fill();
    normal(c); c.restore();
  },
};

FX_EVENT.nc_plagueTick = (e, h) => {
  h.fx.effect('nc_sick', e.x, e.y, 0.55, {});
  const n = h.low ? 1 : 3;
  for (let i = 0; i < n; i++) h.fx.add({ x: e.x + (Math.random() - 0.5) * 0.5, y: e.y + (Math.random() - 0.5) * 0.5, z: 6 + Math.random() * 24, vz: 16 + Math.random() * 12, color: Math.random() < 0.5 ? '#b8ff70' : '#7ad040', kind: 'dot', size: 1.2 + Math.random() * 0.8, life: 0.8, add: true });
  if (!h.low && Math.random() < 0.4) puffs(h, e.x, e.y, 1, { r: 7, c: '84,130,34', a: 0.4, speed: 0.3, rise: 14, grow: 1.2, z: 20, life: 0.9 });
};

