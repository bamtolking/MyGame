// necromancer: hand-drawn skill icons (64×64, origin at the centre) for all six skills.
import { SKILL_ICON } from '../../render/registry';
import { BONE, BONE_DK, BONE_HI, BONE_LINE, BONE_MID, SOUL_RGB, boneStick, glowDot, skull } from './look';

type C2D = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/** A jagged bone shard along +x, length ~2·len. */
function shard(c: C2D, len: number, w: number): void {
  const g = c.createLinearGradient(0, -w, 0, w);
  g.addColorStop(0, BONE_HI); g.addColorStop(0.55, BONE); g.addColorStop(1, BONE_DK);
  c.fillStyle = g; c.strokeStyle = BONE_LINE; c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(len, 0); c.lineTo(len * 0.35, -w); c.lineTo(-len * 0.1, -w * 0.7); c.lineTo(-len * 0.55, -w * 1.2); c.lineTo(-len, -w * 0.4);
  c.lineTo(-len * 0.78, w * 0.2); c.lineTo(-len, w * 0.9); c.lineTo(-len * 0.35, w); c.lineTo(len * 0.3, w * 0.85); c.closePath();
  c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(len * 0.8, -w * 0.15); c.lineTo(-len * 0.6, -w * 0.55); c.stroke();
}

/** A dark humanoid silhouette (target) centred at (x,y). */
function foe(c: C2D, x: number, y: number, s: number, a = 0.9): void {
  c.fillStyle = `rgba(8,10,10,${a})`;
  c.beginPath(); c.ellipse(x, y, 5 * s, 9.5 * s, 0, 0, TAU); c.fill();
  c.beginPath(); c.arc(x, y - 12 * s, 3.8 * s, 0, TAU); c.fill();
}

function ghostTrail(c: C2D, x0: number, y0: number, x1: number, y1: number, w: number): void {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, `rgba(${SOUL_RGB},0)`); g.addColorStop(1, `rgba(${SOUL_RGB},0.8)`);
  const l = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / l * w, ny = (x1 - x0) / l * w;
  c.fillStyle = g;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1 + nx, y1 + ny); c.lineTo(x1 - nx, y1 - ny); c.closePath(); c.fill();
}

// ---- basic: bone bolt — a spinning shard with a ghostly wake
SKILL_ICON.nc_bolt = {
  tint: ['#2c5a48', '#06120d'],
  draw(c, glow) {
    c.globalCompositeOperation = 'lighter';
    ghostTrail(c, -30, 26, 2, -2, 7);
    c.strokeStyle = 'rgba(180,255,215,0.55)'; c.lineWidth = 1.2;
    for (const o of [-8, 8]) { c.beginPath(); c.moveTo(-24 + o, 22 + o * 0.2); c.lineTo(-6 + o * 0.5, 6 + o * 0.6); c.stroke(); }
    glowDot(c, 6, -6, 20, SOUL_RGB, 0.6);
    c.globalCompositeOperation = 'source-over';
    c.save(); c.translate(6, -6); c.rotate(-Math.PI / 4);
    glow('#8effc2', 10);
    shard(c, 17, 4.2);
    c.restore();
    c.shadowBlur = 0;
    // spin marks
    c.strokeStyle = 'rgba(220,255,235,0.85)'; c.lineWidth = 1.4;
    c.beginPath(); c.ellipse(-4, 4, 4, 9, -Math.PI / 4, -1.2, 1.2); c.stroke();
  },
};

// ---- bone spear: skewering a line of foes
SKILL_ICON.nc_spear = {
  tint: ['#3a6a58', '#07130e'],
  draw(c, glow) {
    c.rotate(-0.55);
    for (const x of [-10, 8]) foe(c, x, 6, 1, 0.85);
    c.globalCompositeOperation = 'lighter';
    const ag = c.createLinearGradient(-34, 0, 30, 0);
    ag.addColorStop(0, `rgba(${SOUL_RGB},0)`); ag.addColorStop(0.7, `rgba(${SOUL_RGB},0.5)`); ag.addColorStop(1, `rgba(${SOUL_RGB},0.9)`);
    c.fillStyle = ag; c.beginPath(); c.moveTo(32, 0); c.quadraticCurveTo(0, -10, -34, 0); c.quadraticCurveTo(0, 10, 32, 0); c.fill();
    c.globalCompositeOperation = 'source-over';
    glow('#9dffc8', 8);
    // shaft of vertebrae
    c.fillStyle = BONE_DK; c.fillRect(-32, -2.6, 44, 5.2);
    c.fillStyle = BONE; c.fillRect(-32, -2, 44, 4);
    c.shadowBlur = 0;
    c.strokeStyle = BONE_LINE; c.lineWidth = 0.8;
    for (let x = -28; x < 10; x += 6) { c.fillStyle = BONE_MID; c.beginPath(); c.ellipse(x, 0, 1.6, 3.4, 0, 0, TAU); c.fill(); c.stroke(); }
    // blade
    const hg = c.createLinearGradient(0, -6, 0, 6);
    hg.addColorStop(0, BONE_HI); hg.addColorStop(0.6, BONE); hg.addColorStop(1, BONE_DK);
    c.fillStyle = hg;
    c.beginPath(); c.moveTo(31, 0); c.quadraticCurveTo(21, -6.5, 12, -5); c.lineTo(8, -8.5); c.lineTo(10, -2.4); c.lineTo(10, 2.4); c.lineTo(8, 8.5); c.lineTo(12, 5); c.quadraticCurveTo(21, 6.5, 31, 0); c.closePath(); c.fill();
    c.strokeStyle = BONE_LINE; c.lineWidth = 1; c.stroke();
    c.globalCompositeOperation = 'lighter';
    glowDot(c, 30, 0, 9, SOUL_RGB, 0.9);
    c.globalCompositeOperation = 'source-over';
  },
};

// ---- corpse explosion: a body bursting in gore, bone and green fire
SKILL_ICON.nc_corpse = {
  tint: ['#7a2a1c', '#140404'],
  draw(c, glow) {
    // the corpse, lying
    c.fillStyle = 'rgba(20,10,8,0.95)';
    c.beginPath(); c.ellipse(0, 17, 17, 5, 0, 0, TAU); c.fill();
    c.beginPath(); c.arc(-17, 15, 4.2, 0, TAU); c.fill();
    // blast
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(0, 6, 0, 0, 6, 26);
    g.addColorStop(0, 'rgba(255,245,225,1)'); g.addColorStop(0.25, 'rgba(255,90,60,0.9)'); g.addColorStop(0.6, `rgba(${SOUL_RGB},0.55)`); g.addColorStop(1, `rgba(${SOUL_RGB},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(0, 6, 26, 0, TAU); c.fill();
    c.globalCompositeOperation = 'source-over';
    // shrapnel
    for (let i = 0; i < 9; i++) {
      const an = -Math.PI + (i / 8) * Math.PI + (i % 2 ? 0.12 : -0.08);
      const r0 = 12 + (i % 3) * 2, r1 = r0 + 9 + (i % 2) * 5;
      if (i % 3 === 1) { c.fillStyle = '#7a0a08'; c.beginPath(); c.arc(Math.cos(an) * r1, 6 + Math.sin(an) * r1, 2.2, 0, TAU); c.fill(); }
      else boneStick(c, Math.cos(an) * r0, 6 + Math.sin(an) * r0, Math.cos(an) * r1, 6 + Math.sin(an) * r1, 1.5);
    }
    glow('#ff7050', 8);
    skull(c, 13, -16, 6.5, { eyes: SOUL_RGB, eyeA: 0.9, jaw: 0.5, line: 0.8 });
    c.shadowBlur = 0;
    c.fillStyle = '#8a0808';
    for (const [x, y] of [[-20, -6], [-13, -18], [22, 4], [-24, 8]] as [number, number][]) { c.beginPath(); c.ellipse(x, y, 1.6, 2.4, 0.4, 0, TAU); c.fill(); }
  },
};

// ---- skeletal mage: a robed skeleton raising an icy staff
SKILL_ICON.nc_mage = {
  tint: ['#2a4c5c', '#050d13'],
  draw(c, glow) {
    // rising from a green sigil
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(${SOUL_RGB},0.8)`; c.lineWidth = 1.6;
    c.beginPath(); c.ellipse(0, 22, 22, 6, 0, 0, TAU); c.stroke();
    glowDot(c, 0, 22, 24, SOUL_RGB, 0.45);
    c.globalCompositeOperation = 'source-over';
    // robe
    const rg = c.createLinearGradient(-12, 0, 12, 0);
    rg.addColorStop(0, '#2c3e38'); rg.addColorStop(1, '#0e1614');
    c.fillStyle = rg;
    c.beginPath(); c.moveTo(-8, -6); c.lineTo(8, -6); c.lineTo(15, 24); c.lineTo(-15, 24); c.closePath(); c.fill();
    // hood + skull
    c.fillStyle = '#22322c';
    c.beginPath(); c.moveTo(-11, -4); c.quadraticCurveTo(-13, -26, 0, -27); c.quadraticCurveTo(13, -26, 11, -4); c.closePath(); c.fill();
    skull(c, 0, -13, 7, { eyes: '170,245,255', eyeA: 1, line: 0.8 });
    // ribs peeking out of the robe
    c.strokeStyle = BONE; c.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-5, -1 + i * 4); c.quadraticCurveTo(0, -3 + i * 4, 5, -1 + i * 4); c.stroke(); }
    // staff with an icy orb
    c.strokeStyle = '#4a3a2a'; c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(18, 24); c.lineTo(18, -22); c.stroke();
    boneStick(c, 8, 4, 18, 0, 1.6);
    glow('#9eeaff', 12);
    const og = c.createRadialGradient(17, -25, 0.5, 18, -24, 6);
    og.addColorStop(0, '#ffffff'); og.addColorStop(0.4, '#9eeaff'); og.addColorStop(1, '#1a4a6a');
    c.fillStyle = og; c.beginPath(); c.arc(18, -24, 5.5, 0, TAU); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = 'rgba(200,245,255,0.8)'; c.lineWidth = 1;
    for (let i = 0; i < 4; i++) { const an = i * TAU / 4 + 0.4; c.beginPath(); c.moveTo(18 + Math.cos(an) * 7, -24 + Math.sin(an) * 7); c.lineTo(18 + Math.cos(an) * 11, -24 + Math.sin(an) * 11); c.stroke(); }
  },
};

// ---- bone armor: bone plates orbiting a skull ward
SKILL_ICON.nc_armor = {
  tint: ['#5c5440', '#110f09'],
  draw(c, glow) {
    const plate = (x: number, y: number, rot: number, s: number, front: boolean) => {
      c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
      const g = c.createLinearGradient(0, -5, 0, 5);
      g.addColorStop(0, front ? BONE_HI : BONE_MID); g.addColorStop(1, BONE_DK);
      c.fillStyle = g; c.strokeStyle = BONE_LINE; c.lineWidth = 1;
      c.beginPath(); c.moveTo(-7, -1.5); c.quadraticCurveTo(0, -6, 7, -1.5); c.lineTo(6, 3.5); c.quadraticCurveTo(0, 0.8, -6, 3.5); c.closePath(); c.fill(); c.stroke();
      c.restore();
    };
    // orbit (back half)
    c.strokeStyle = 'rgba(240,230,200,0.35)'; c.lineWidth = 1.4;
    c.beginPath(); c.ellipse(0, 2, 25, 9, -0.25, Math.PI, TAU); c.stroke();
    for (let i = 0; i < 3; i++) { const an = Math.PI + 0.5 + i * 1.05; plate(Math.cos(an) * 25 * Math.cos(-0.25) - Math.sin(an) * 9 * Math.sin(-0.25), 2 + Math.cos(an) * 25 * Math.sin(-0.25) + Math.sin(an) * 9 * Math.cos(-0.25), -0.25 + Math.cos(an) * 0.4, 0.85, false); }
    // ward
    c.globalCompositeOperation = 'lighter';
    glowDot(c, 0, 0, 22, SOUL_RGB, 0.35);
    c.globalCompositeOperation = 'source-over';
    glow('#e8dcc0', 6);
    skull(c, 0, -2, 11, { eyes: SOUL_RGB, eyeA: 0.9, line: 0.9 });
    c.shadowBlur = 0;
    // orbit (front half)
    c.strokeStyle = 'rgba(250,245,225,0.7)'; c.lineWidth = 1.6;
    c.beginPath(); c.ellipse(0, 2, 25, 9, -0.25, 0, Math.PI); c.stroke();
    for (let i = 0; i < 3; i++) { const an = 0.5 + i * 1.05; plate(Math.cos(an) * 25 * Math.cos(-0.25) - Math.sin(an) * 9 * Math.sin(-0.25), 2 + Math.cos(an) * 25 * Math.sin(-0.25) + Math.sin(an) * 9 * Math.cos(-0.25), -0.25 + Math.cos(an) * 0.4, 1.1, true); }
  },
};

// ---- plague: a skull-faced cloud of toxic gas over a bubbling pool
SKILL_ICON.nc_plague = {
  tint: ['#4a6a1a', '#0b1404'],
  draw(c, glow) {
    // pool
    c.fillStyle = 'rgba(70,120,20,0.85)'; c.beginPath(); c.ellipse(0, 22, 26, 7, 0, 0, TAU); c.fill();
    for (const [x, r] of [[-12, 2.6], [4, 3.4], [15, 2]] as [number, number][]) { c.fillStyle = '#9ad840'; c.beginPath(); c.arc(x, 20, r, Math.PI, TAU); c.fill(); c.fillStyle = '#e0ffb0'; c.beginPath(); c.arc(x - r * 0.3, 19 - r * 0.4, r * 0.3, 0, TAU); c.fill(); }
    // billowing cloud
    c.globalCompositeOperation = 'lighter';
    for (const [x, y, r, a] of [[-14, 4, 15, 0.45], [12, 2, 16, 0.45], [0, -10, 18, 0.5], [-4, 12, 14, 0.4], [16, -14, 10, 0.35]] as [number, number, number, number][]) {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(170,255,90,${a})`); g.addColorStop(1, 'rgba(90,180,40,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    // a skull face formed in the gas
    glow('#9dff5a', 10);
    c.globalAlpha = 0.9;
    skull(c, 0, -6, 11, { col: '#c8e6a0', eyes: '150,255,80', eyeA: 0.9, jaw: 0.8, line: 0.8 });
    c.globalAlpha = 1;
    c.shadowBlur = 0;
    // spores
    c.fillStyle = '#d8ffa0';
    for (const [x, y] of [[-22, -12], [22, -4], [-17, -22], [9, -26], [25, 12], [-26, 6]] as [number, number][]) { c.beginPath(); c.arc(x, y, 1.3, 0, TAU); c.fill(); }
  },
};
