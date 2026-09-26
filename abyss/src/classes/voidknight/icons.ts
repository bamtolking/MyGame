// voidknight: hand-drawn skill icons (64×64, origin at the centre).
import { SKILL_ICON } from '../../render/registry';
import { horn, voidEyes, voidSword } from './look';
import { VK } from './shared';

const TAU = Math.PI * 2;
type C2D = CanvasRenderingContext2D;

function softGlow(c: C2D, x: number, y: number, r: number, rgb: string, a = 1, core = '255,246,255'): void {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${core},${a})`); g.addColorStop(0.3, `rgba(${rgb},${a * 0.65})`); g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}

/** Crescent from a0 to a1 (radius r, thickness th, thickest in the middle), filled with a gradient toward its head. */
function crescent(c: C2D, x: number, y: number, r: number, a0: number, a1: number, th: number, tail: string, head: string): void {
  const g = c.createLinearGradient(x + Math.cos(a0) * r, y + Math.sin(a0) * r, x + Math.cos(a1) * r, y + Math.sin(a1) * r);
  g.addColorStop(0, tail); g.addColorStop(0.6, head); g.addColorStop(1, '#fff6ff');
  c.fillStyle = g;
  c.beginPath();
  const n = 20;
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  for (let i = n; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / n, w = th * Math.sin((i / n) * Math.PI * 0.92 + 0.08); c.lineTo(x + Math.cos(a) * (r - w), y + Math.sin(a) * (r - w)); }
  c.closePath(); c.fill();
}

/** The knight's greatsword laid along the icon: fist at (x,y), blade toward angle `ang` (screen radians). */
function sword(c: C2D, x: number, y: number, ang: number, tier: number, k: number): void {
  c.save(); c.translate(x, y); c.rotate(ang - Math.PI / 2);
  voidSword(c, tier, ['#8e7866', '#a9aeb9', '#6c6c80', '#4b4959', '#3a3149'][tier], k, 0.6);
  c.restore();
}

/** A clawed hand rising from below: wrist at (x,y), reaching up (lean tilts it). */
function risingHand(c: C2D, x: number, y: number, s: number, lean: number, col: string): void {
  c.save(); c.translate(x, y); c.rotate(lean);
  c.fillStyle = col;
  // forearm
  c.beginPath(); c.moveTo(-s * 0.32, s * 0.9); c.quadraticCurveTo(-s * 0.4, 0, -s * 0.34, -s * 0.5); c.lineTo(s * 0.34, -s * 0.5); c.quadraticCurveTo(s * 0.4, 0, s * 0.32, s * 0.9); c.closePath(); c.fill();
  // palm
  c.beginPath(); c.ellipse(0, -s * 0.72, s * 0.46, s * 0.36, 0, 0, TAU); c.fill();
  // hooked talons (tapered, curling inward) and a thumb
  for (let i = 0; i < 4; i++) {
    const bx = (i - 1.5) * s * 0.26, a = (i - 1.5) * 0.3;
    const tipX = bx + Math.sin(a) * s * 0.55 + (i < 2 ? s * 0.28 : -s * 0.28), tipY = -s * (1.95 - Math.abs(i - 1.5) * 0.15);
    horn(c, bx, -s * 0.85, bx + Math.sin(a) * s * 0.75, -s * 1.55, tipX, tipY, s * 0.24, col, false);
  }
  horn(c, -s * 0.38, -s * 0.62, -s * 1.0, -s * 0.8, -s * 0.72, -s * 1.3, s * 0.24, col, false);
  c.restore();
}

// ---- 공허 베기: a blackened greatsword cleaving a violet crescent
SKILL_ICON.vk_slash = {
  tint: ['#3a2452', '#07040c'],
  draw(c, glow) {
    c.save(); c.globalCompositeOperation = 'lighter';
    softGlow(c, 6, -4, 26, VK.vRGB, 0.45);
    c.restore();
    c.save(); glow(VK.violet, 12);
    crescent(c, -2, 4, 25, Math.PI * 1.05, Math.PI * 2.1, 8, 'rgba(90,40,160,0)', VK.violet);
    c.restore();
    c.save(); glow('#8a4ad8', 6);
    sword(c, -15, 17, -Math.PI / 4, 3, 1.25);
    c.restore();
    // a few void motes torn off the cut
    c.fillStyle = VK.violetHi;
    for (const [x, y, r] of [[21, -6, 1.4], [16, 10, 1.1], [24, 4, 0.9], [-20, -12, 1]] as [number, number, number][]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  },
};

// ---- 흡혈 일격: a rising red cut; the stolen life streams up the blade into a burning orb
SKILL_ICON.vk_drain = {
  tint: ['#4a1026', '#0a0206'],
  draw(c, glow) {
    c.save(); glow('#ff3050', 12);
    crescent(c, 2, -2, 24, Math.PI * 0.55, -Math.PI * 0.45, 7, 'rgba(160,10,40,0)', '#ff3a5a');
    c.restore();
    c.save(); glow('#8a4ad8', 5);
    sword(c, -16, 18, -Math.PI / 3.2, 2, 1.15);
    c.restore();
    // life stream spiralling into the orb
    c.save(); c.lineCap = 'round';
    c.strokeStyle = 'rgba(255,60,90,0.85)'; c.lineWidth = 2.4; glow('#ff2040', 8);
    c.beginPath(); c.moveTo(12, 16); c.bezierCurveTo(26, 8, 4, -2, 16, -10); c.stroke();
    c.lineWidth = 1.4; c.beginPath(); c.moveTo(6, 20); c.bezierCurveTo(22, 14, -2, 2, 12, -8); c.stroke();
    c.restore();
    c.save(); c.globalCompositeOperation = 'lighter';
    softGlow(c, 17, -15, 12, VK.bloodRGB, 1, '255,230,235');
    c.restore();
    c.fillStyle = '#c0102c';
    for (const [x, y, r] of [[20, 12, 2], [9, 6, 1.6], [22, 0, 1.3], [-4, 22, 1.8]] as [number, number, number][]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.beginPath(); c.moveTo(x - r, y); c.lineTo(x, y - r * 2.2); c.lineTo(x + r, y); c.fill(); }
  },
};

// ---- 암흑 파동: a black crescent with a violet crest racing right, icy mist and shards behind it
SKILL_ICON.vk_wave = {
  tint: ['#2c2452', '#05040c'],
  draw(c, glow) {
    // mist trails
    c.save(); c.lineCap = 'round';
    for (const [y, w, a] of [[-12, 1.6, 0.5], [-2, 2.4, 0.6], [9, 1.8, 0.5], [17, 1.2, 0.35]] as [number, number, number][]) {
      c.strokeStyle = `rgba(${VK.mistRGB},${a})`; c.lineWidth = w;
      c.beginPath(); c.moveTo(-28, y + 2); c.quadraticCurveTo(-14, y - 2, 0, y); c.stroke();
    }
    c.restore();
    // the crescent: black body, violet rim, white-hot crest
    c.save(); glow(VK.violet, 14);
    c.fillStyle = '#0c0616';
    c.beginPath(); c.arc(-6, 0, 26, -1.2, 1.2); c.arc(-14, 0, 24, 1.05, -1.05, true); c.closePath(); c.fill();
    c.strokeStyle = VK.violet; c.lineWidth = 3; c.beginPath(); c.arc(-6, 0, 26, -1.2, 1.2); c.stroke();
    c.restore();
    c.save(); c.strokeStyle = '#f6eeff'; c.lineWidth = 1.2; c.beginPath(); c.arc(-6, 0, 26, -0.9, 0.9); c.stroke(); c.restore();
    // ice shards flung ahead
    c.save(); glow('#bcd6ff', 6); c.fillStyle = '#e6f0ff';
    for (const [x, y, a, s] of [[24, -10, 0.4, 3.2], [26, 8, -0.3, 2.6], [22, 18, -0.7, 2]] as [number, number, number, number][]) {
      c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.moveTo(0, -s * 1.8); c.lineTo(s * 0.6, 0); c.lineTo(0, s * 1.8); c.lineTo(-s * 0.6, 0); c.closePath(); c.fill(); c.restore();
    }
    c.restore();
  },
};

// ---- 심연의 손아귀: clawed hands rising from a void pool, dragging everything to its heart
SKILL_ICON.vk_grasp = {
  tint: ['#2a1640', '#050208'],
  draw(c, glow) {
    // pool
    c.save(); c.translate(0, 18); c.scale(1, 0.38);
    const g = c.createRadialGradient(0, 0, 2, 0, 0, 28);
    g.addColorStop(0, '#000000'); g.addColorStop(0.7, '#12061e'); g.addColorStop(1, 'rgba(60,20,110,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 28, 0, TAU); c.fill();
    c.restore();
    c.save(); glow(VK.violet, 10); c.strokeStyle = VK.violet; c.lineWidth = 2;
    c.beginPath(); c.ellipse(0, 18, 25, 9.5, 0, 0, TAU); c.stroke();
    // swirl
    c.lineWidth = 1.2; c.strokeStyle = 'rgba(200,160,255,0.8)';
    for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(0, 18, 8 + i * 5, 3 + i * 2, 0, i * 1.7, i * 1.7 + 2.2); c.stroke(); }
    c.restore();
    // hands (outer ones dimmer, the great hand in front)
    c.save(); glow(VK.violet, 8);
    risingHand(c, -15, 16, 9, -0.45, '#1a0f26');
    risingHand(c, 16, 16, 9, 0.5, '#1a0f26');
    risingHand(c, 0, 20, 13, 0.05, '#0c0614');
    c.restore();
  },
};

// ---- 공허의 장막: the horned helm wreathed in dark flame, eyes burning
SKILL_ICON.vk_shroud = {
  tint: ['#341a4c', '#060309'],
  draw(c, glow) {
    // dark flame wisps licking up around the helm: separate S-curved tongues, bases at different heights
    c.save(); glow(VK.violet, 9);
    const wisps: [number, number, number, number, number][] = [[-20, 20, 30, 5, -6], [-11, 14, 40, 5.5, 5], [0, 10, 46, 6, -4], [11, 14, 40, 5.5, -5], [20, 20, 30, 5, 6], [-5, 26, 22, 4, 3], [6, 26, 22, 4, -3]];
    for (const [x, by, h, w, curl] of wisps) {
      const g = c.createLinearGradient(0, by, 0, by - h);
      g.addColorStop(0, 'rgba(120,60,220,0)'); g.addColorStop(0.2, 'rgba(200,160,255,0.9)'); g.addColorStop(0.6, 'rgba(140,70,235,0.75)'); g.addColorStop(1, 'rgba(70,20,140,0)');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(x - w, by);
      c.bezierCurveTo(x - w * 1.3 + curl, by - h * 0.35, x - w * 0.2 - curl, by - h * 0.65, x + curl * 0.6, by - h);
      c.bezierCurveTo(x + w * 0.4 - curl, by - h * 0.6, x + w * 1.2 + curl * 0.5, by - h * 0.35, x + w, by);
      c.closePath(); c.fill();
    }
    c.restore();
    // helm
    const x = 0, y = 6, r = 12;
    horn(c, x - r * 0.45, y - r * 0.8, x - r * 1.9, y - r * 1.1, x - r * 1.7, y - r * 2.3, r * 0.5, '#2e2428', false);
    horn(c, x + r * 0.45, y - r * 0.8, x + r * 1.9, y - r * 1.1, x + r * 1.7, y - r * 2.3, r * 0.5, '#2e2428', false);
    const g = c.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, '#5a5668'); g.addColorStop(0.5, '#2c2a36'); g.addColorStop(1, '#0e0c14');
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y - 1, r, Math.PI, TAU); c.lineTo(x + r, y + r * 0.55); c.quadraticCurveTo(x + r * 0.7, y + r * 1.15, x, y + r * 1.25); c.quadraticCurveTo(x - r * 0.7, y + r * 1.15, x - r, y + r * 0.55); c.closePath(); c.fill();
    c.strokeStyle = '#6a3aa0'; c.lineWidth = 1; c.stroke();
    // visor
    c.fillStyle = '#030204';
    c.beginPath(); c.moveTo(x - r * 0.85, y - 2.5); c.lineTo(x, y + 1.2); c.lineTo(x + r * 0.85, y - 2.5); c.lineTo(x + r * 0.85, y + 0.8); c.lineTo(x, y + 4.2); c.lineTo(x - r * 0.85, y + 0.8); c.closePath(); c.fill();
    c.fillRect(x - 1.2, y + 3, 2.4, r * 0.8);
    voidEyes(c, x - 5.5, y - 0.2, 11, 1.3, 1.3);
  },
};

// ---- 일식: a black sun in a burning violet corona over a darkened horizon
SKILL_ICON.vk_eclipse = {
  tint: ['#2a1644', '#030106'],
  draw(c, glow) {
    c.save(); c.globalCompositeOperation = 'lighter';
    softGlow(c, 0, -2, 30, VK.vRGB, 0.9);
    c.restore();
    // corona rays
    c.save(); glow(VK.violet, 10); c.strokeStyle = VK.violetHi; c.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + 0.1, l = i % 2 ? 22 : 28;
      c.lineWidth = i % 2 ? 1.2 : 2;
      c.beginPath(); c.moveTo(Math.cos(a) * 17, -2 + Math.sin(a) * 17); c.lineTo(Math.cos(a) * l, -2 + Math.sin(a) * l); c.stroke();
    }
    c.restore();
    c.save(); glow('#ffffff', 8); c.strokeStyle = '#fbeeff'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, -2, 15.5, 0, TAU); c.stroke(); c.restore();
    c.fillStyle = '#000000'; c.beginPath(); c.arc(0, -2, 14.5, 0, TAU); c.fill();
    // a faint rim of the hidden sun on one side
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(230,208,255,0.55)'; c.lineWidth = 1.2; c.beginPath(); c.arc(1.5, -3, 13.5, 3.6, 5.2); c.stroke(); c.restore();
    // dark ground and a dome of shadow
    c.fillStyle = '#040108';
    c.beginPath(); c.moveTo(-32, 32); c.lineTo(-32, 22); c.quadraticCurveTo(0, 13, 32, 22); c.lineTo(32, 32); c.closePath(); c.fill();
    c.save(); glow(VK.violet, 8); c.strokeStyle = VK.violet; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(-32, 22); c.quadraticCurveTo(0, 13, 32, 22); c.stroke(); c.restore();
  },
};
