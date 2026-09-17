/**
 * Procedural unit sprites (no external assets). Each type has a distinct
 * silhouette; drawn in local space where +x = facing direction.
 */
import type { FactionId, Team } from '../core/types.ts';

export interface SpriteOpts {
  team: Team;
  faction: FactionId;
  facing: number; // body rotation
  turret: number; // turret / weapon rotation (absolute)
  anim: number; // distance travelled (wheel/leg animation)
  t: number; // time seconds (idle animation)
  windup: number; // 0..1 attack charge
  recoil: number; // 0..1 recoil after firing
  moving: boolean;
  ally: boolean; // is on the viewer's team
  flash: number; // hit flash 0..1
  air: boolean;
  quality: number; // 0 low, 1 high
}

export const TEAM_COLORS: Record<Team, { main: string; dark: string; light: string }> = {
  0: { main: '#4f8cff', dark: '#1e40af', light: '#bfdbfe' },
  1: { main: '#ff5d5d', dark: '#991b1b', light: '#fecaca' },
};
const FAC = {
  iron: { body: '#6b7280', dark: '#3b4250', edge: '#9aa3b2', metal: '#cbd5e1' },
  gale: { body: '#d6d0bf', dark: '#8f887a', edge: '#f2ede0', metal: '#fff8e8' },
};

function outline(ctx: CanvasRenderingContext2D, ally: boolean) {
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = ally ? 'rgba(255,255,255,0.85)' : 'rgba(10,10,20,0.95)';
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 2) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function poly(ctx: CanvasRenderingContext2D, pts: number[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

function wheels(ctx: CanvasRenderingContext2D, xs: number[], y: number, r: number, anim: number, color: string) {
  for (const x of xs) {
    for (const sy of [-y, y]) {
      ctx.fillStyle = '#1f2430';
      ctx.beginPath(); ctx.arc(x, sy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      const a = anim / r;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r, sy + Math.sin(a) * r); ctx.lineTo(x - Math.cos(a) * r, sy - Math.sin(a) * r); ctx.stroke();
    }
  }
}

function legs(ctx: CanvasRenderingContext2D, n: number, span: number, len: number, anim: number, color: string) {
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = -span / 2 + (span * i) / Math.max(1, n - 1);
    const ph = anim / 9 + i * 1.7;
    const sw = Math.sin(ph) * 3;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(x, s * 4); ctx.lineTo(x + sw, s * (4 + len)); ctx.stroke();
    }
  }
}

function soldier(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, body: string, team: string, ally: boolean, gun: boolean, bob: number) {
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(x, y + bob, r, 0, Math.PI * 2); ctx.fill();
  outline(ctx, ally); ctx.stroke();
  ctx.fillStyle = team;
  ctx.beginPath(); ctx.arc(x, y + bob, r * 0.5, 0, Math.PI * 2); ctx.fill();
  if (gun) { ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x + r * 0.4, y + bob); ctx.lineTo(x + r * 1.9, y + bob - 0.5); ctx.stroke(); }
}

function shieldHex(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
  ctx.closePath();
}

/** Draws a unit centred at (0,0) in the current transform (already translated). */
export function drawUnitSprite(ctx: CanvasRenderingContext2D, type: string, o: SpriteOpts) {
  const tc = TEAM_COLORS[o.team];
  const fc = FAC[o.faction];
  const body = o.flash > 0 ? '#ffffff' : fc.body;
  const dark = o.flash > 0 ? '#e5e5e5' : fc.dark;
  const team = o.flash > 0 ? '#ffffff' : tc.main;
  ctx.save();
  ctx.rotate(o.facing);
  const rel = o.turret - o.facing; // turret relative to body
  const bob = o.moving ? Math.sin(o.anim / 6) * 0.8 : 0;
  switch (type) {
    // ───────── IRON ─────────
    case 'shieldwalker': {
      legs(ctx, 2, 10, 5, o.anim, '#2a2f3a');
      ctx.fillStyle = body; rect(ctx, -9, -7, 15, 14, 2); ctx.fill(); outline(ctx, o.ally); ctx.stroke();
      ctx.fillStyle = team; rect(ctx, -7, -4, 6, 8, 1); ctx.fill();
      // big frontal shield plate
      ctx.fillStyle = dark; poly(ctx, [6, -12, 12, -9, 12, 9, 6, 12]); ctx.fill(); ctx.strokeStyle = fc.metal; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = tc.light; rect(ctx, 8, -3, 3, 6, 1); ctx.fill();
      break;
    }
    case 'rifles': {
      const ph = o.moving ? o.anim / 5 : 0;
      soldier(ctx, 3, 0, 3.6, body, team, o.ally, true, Math.sin(ph) * 0.6);
      soldier(ctx, -3, -5, 3.4, body, team, o.ally, true, Math.sin(ph + 2) * 0.6);
      soldier(ctx, -3, 5, 3.4, body, team, o.ally, true, Math.sin(ph + 4) * 0.6);
      break;
    }
    case 'sprayer': {
      wheels(ctx, [-6, 5], 7, 3, o.anim, '#555');
      ctx.fillStyle = body; rect(ctx, -11, -6, 20, 12, 3); ctx.fill(); outline(ctx, o.ally); ctx.stroke();
      ctx.fillStyle = team; rect(ctx, -9, -4, 8, 8, 1); ctx.fill();
      // tank + wide nozzle
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(-3, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.rotate(rel);
      ctx.fillStyle = dark; poly(ctx, [6, -3, 13, -6, 13, 6, 6, 3]); ctx.fill(); ctx.strokeStyle = fc.metal; ctx.lineWidth = 1; ctx.stroke();
      if (o.windup > 0) { ctx.fillStyle = `rgba(255,200,80,${0.4 * o.windup})`; poly(ctx, [13, -6, 30, -14, 30, 14, 13, 6]); ctx.fill(); }
      ctx.restore();
      break;
    }
    case 'piercer': {
      // tracked chassis
      ctx.fillStyle = '#23272f'; rect(ctx, -12, -10, 24, 5, 2); ctx.fill(); rect(ctx, -12, 5, 24, 5, 2); ctx.fill();
      ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) { const x = -11 + ((i * 5 + o.anim) % 24); ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x, -5); ctx.moveTo(x, 5); ctx.lineTo(x, 10); ctx.stroke(); }
      ctx.fillStyle = body; rect(ctx, -10, -6, 18, 12, 2); ctx.fill(); outline(ctx, o.ally); ctx.stroke();
      ctx.fillStyle = team; rect(ctx, -8, -4, 5, 8, 1); ctx.fill();
      ctx.save(); ctx.rotate(rel);
      const rc = o.recoil * 4;
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1f2430'; rect(ctx, 3 - rc, -1.6, 20, 3.2, 1); ctx.fill();
      ctx.fillStyle = fc.metal; rect(ctx, 17 - rc, -2.2, 5, 4.4, 1); ctx.fill();
      ctx.restore();
      break;
    }
    case 'flak': {
      wheels(ctx, [-5, 5], 7, 2.6, o.anim, '#555');
      ctx.fillStyle = body; rect(ctx, -9, -6, 18, 12, 3); ctx.fill(); outline(ctx, o.ally); ctx.stroke();
      ctx.fillStyle = team; ctx.beginPath(); ctx.arc(-4, 0, 3, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.rotate(rel);
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(1, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1f2430'; ctx.lineWidth = 2.2; ctx.lineCap = 'butt';
      // twin barrels angled up (drawn shorter to suggest elevation)
      ctx.beginPath(); ctx.moveTo(2, -2.5); ctx.lineTo(13, -4.5); ctx.moveTo(2, 2.5); ctx.lineTo(13, 4.5); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'repair': {
      const hov = Math.sin(o.t * 4) * 1;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 4, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, hov, 8, 6, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, o.ally); ctx.stroke();
      ctx.fillStyle = team; ctx.beginPath(); ctx.arc(-3, hov, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(3, hov - 3); ctx.lineTo(3, hov + 3); ctx.moveTo(0, hov); ctx.lineTo(6, hov); ctx.stroke();
      // arm
      ctx.strokeStyle = dark; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(6, hov); ctx.lineTo(11, hov + Math.sin(o.t * 6) * 2); ctx.stroke();
      break;
    }
    case 'howitzer': {
      wheels(ctx, [-8, 6], 8, 3.5, o.anim, '#666');
      ctx.fillStyle = body; rect(ctx, -13, -6, 22, 12, 2); ctx.fill(); outline(ctx, o.ally); ctx.stroke();
      ctx.fillStyle = team; rect(ctx, -11, -4, 6, 8, 1); ctx.fill();
      ctx.save(); ctx.rotate(rel);
      const rc = o.recoil * 5;
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(-2, 0, 5.5, 0, Math.PI * 2); ctx.fill();
      // big elevated tube (drawn wide, foreshortened)
      ctx.fillStyle = '#1f2430'; rect(ctx, -2 - rc, -2.6, 22, 5.2, 1.5); ctx.fill();
      ctx.fillStyle = fc.metal; rect(ctx, 16 - rc, -3.2, 5, 6.4, 1); ctx.fill();
      if (o.windup > 0) { ctx.fillStyle = `rgba(255,160,60,${0.6 * o.windup})`; ctx.beginPath(); ctx.arc(21 - rc, 0, 3 * o.windup, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      break;
    }
    case 'gunship': {
      // fuselage + stub wings + rotor
      ctx.fillStyle = body; poly(ctx, [-16, -5, -6, -8, 12, -6, 18, 0, 12, 6, -6, 8, -16, 5]); ctx.fill(); outline(ctx, o.ally); ctx.stroke();
      ctx.fillStyle = dark; rect(ctx, -4, -16, 8, 32, 2); ctx.fill();
      ctx.fillStyle = team; rect(ctx, -12, -3, 8, 6, 1); ctx.fill();
      ctx.fillStyle = tc.light; poly(ctx, [12, -3, 17, 0, 12, 3]); ctx.fill();
      // guns
      ctx.strokeStyle = '#1f2430'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(4, -12); ctx.lineTo(12, -12); ctx.moveTo(4, 12); ctx.lineTo(12, 12); ctx.stroke();
      // rotor blur
      ctx.strokeStyle = 'rgba(230,230,240,0.55)'; ctx.lineWidth = 1.5;
      const ra = o.t * 40;
      for (let i = 0; i < 3; i++) { const a = ra + (i * Math.PI * 2) / 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(230,230,240,0.25)'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    // ───────── GALE ─────────
    case 'raiders': {
      const ph = o.moving ? o.anim / 5 : 0;
      for (const [x, y, k] of [[4, 0, 0], [-3, -5, 2], [-3, 5, 4]] as const) {
        const b = Math.sin(ph + k) * 0.7;
        ctx.fillStyle = body; poly(ctx, [x + 5, y + b, x - 3, y - 3.5 + b, x - 1, y + b, x - 3, y + 3.5 + b]); ctx.fill(); outline(ctx, o.ally); ctx.stroke();
        ctx.fillStyle = team; ctx.beginPath(); ctx.arc(x - 0.5, y + b, 1.6, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'glider': {
      soldier(ctx, 0, 0, 4, body, team, o.ally, true, bob);
      // wing above
      ctx.fillStyle = tc.light; poly(ctx, [-2, 0, -8, -9, -4, -9, 1, -2, -4, 9, -8, 9]); ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.stroke();
      break;
    }
    case 'thrower': {
      soldier(ctx, 0, 0, 4.5, body, team, o.ally, false, bob);
      // arm + bomb
      const swing = o.windup > 0 ? -1.2 * o.windup : o.recoil > 0 ? 1.0 * o.recoil : 0;
      ctx.save(); ctx.rotate(rel + swing);
      ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(8, -3); ctx.stroke();
      ctx.fillStyle = '#374151'; ctx.beginPath(); ctx.arc(9, -3.5, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = team; rect(ctx, -6, -6, 3, 12, 1); ctx.fill();
      break;
    }
    case 'infiltrator': {
      ctx.fillStyle = body; poly(ctx, [12, 0, -8, -6, -10, 0, -8, 6]); ctx.fill(); outline(ctx, o.ally); ctx.stroke();
      ctx.fillStyle = team; poly(ctx, [4, 0, -6, -3, -6, 3]); ctx.fill();
      ctx.fillStyle = dark; rect(ctx, -9, -1.5, 5, 3, 1); ctx.fill();
      // fin
      ctx.fillStyle = tc.light; poly(ctx, [-2, 0, -8, -1.5, -8, 1.5]); ctx.fill();
      if (o.moving && o.quality > 0) { ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-10, -3); ctx.lineTo(-18, -3); ctx.moveTo(-10, 3); ctx.lineTo(-18, 3); ctx.stroke(); }
      break;
    }
    case 'interceptor': {
      ctx.fillStyle = body; poly(ctx, [14, 0, -4, -11, -8, -11, -6, -3, -10, 0, -6, 3, -8, 11, -4, 11]); ctx.fill(); outline(ctx, o.ally); ctx.stroke();
      ctx.fillStyle = team; poly(ctx, [8, 0, -2, -4, -2, 4]); ctx.fill();
      ctx.fillStyle = `rgba(120,200,255,${0.6 + Math.sin(o.t * 20) * 0.3})`; ctx.beginPath(); ctx.arc(-9, 0, 2.5, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'shieldskiff': {
      const hov = Math.sin(o.t * 3) * 1;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 5, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, hov, 11, 7, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, o.ally); ctx.stroke();
      ctx.fillStyle = team; rect(ctx, -8, hov - 2, 6, 4, 1); ctx.fill();
      ctx.strokeStyle = `rgba(80,200,255,${0.5 + Math.sin(o.t * 5) * 0.3})`; ctx.lineWidth = 1.5; shieldHex(ctx, 2, hov, 5); ctx.stroke();
      ctx.strokeStyle = 'rgba(80,200,255,0.25)'; shieldHex(ctx, 2, hov, 9); ctx.stroke();
      break;
    }
    case 'bomber': {
      ctx.fillStyle = body; poly(ctx, [10, 0, -2, -16, -8, -16, -6, -4, -10, 0, -6, 4, -8, 16, -2, 16]); ctx.fill(); outline(ctx, o.ally); ctx.stroke();
      ctx.fillStyle = team; poly(ctx, [6, 0, -4, -6, -4, 6]); ctx.fill();
      ctx.fillStyle = dark; rect(ctx, -6, -3, 10, 6, 2); ctx.fill();
      ctx.fillStyle = `rgba(255,180,80,${0.5 + Math.sin(o.t * 18) * 0.3})`; ctx.beginPath(); ctx.arc(-8, -9, 2, 0, Math.PI * 2); ctx.arc(-8, 9, 2, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'railgun': {
      legs(ctx, 2, 14, 6, o.anim, '#4b4740');
      ctx.fillStyle = body; rect(ctx, -12, -7, 22, 14, 3); ctx.fill(); outline(ctx, o.ally); ctx.stroke();
      ctx.fillStyle = team; rect(ctx, -10, -4, 6, 8, 1); ctx.fill();
      ctx.save(); ctx.rotate(rel);
      const rc = o.recoil * 5;
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(2 - rc, -2.5); ctx.lineTo(26 - rc, -2.5); ctx.moveTo(2 - rc, 2.5); ctx.lineTo(26 - rc, 2.5); ctx.stroke();
      if (o.windup > 0) { ctx.strokeStyle = `rgba(140,220,255,${o.windup})`; ctx.lineWidth = 1 + o.windup * 2; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(26, 0); ctx.stroke(); }
      ctx.restore();
      break;
    }
    default: {
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); outline(ctx, o.ally); ctx.stroke();
    }
  }
  ctx.restore();
}

/** Building sprites in local space (centre 0,0). */
export function drawBuilding(ctx: CanvasRenderingContext2D, kind: 'core' | 'outpost', team: Team, r: number, hpFrac: number, alive: boolean, facing: number, t: number, ally: boolean, attackable: boolean) {
  const tc = TEAM_COLORS[team];
  ctx.save();
  if (!alive) {
    ctx.fillStyle = '#2a2f3a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#111';
    for (let i = 0; i < 5; i++) { const a = i * 1.3; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.15, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    return;
  }
  if (kind === 'core') {
    // octagonal fortress
    ctx.fillStyle = '#2f3542'; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (Math.PI / 4) * i + Math.PI / 8; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ally ? '#e5e7eb' : '#111'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = tc.dark; ctx.beginPath(); ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = tc.main; ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.fill();
    // energy pulse
    ctx.strokeStyle = `rgba(255,255,255,${0.25 + 0.2 * Math.sin(t * 3)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.stroke();
    if (!attackable) {
      ctx.strokeStyle = `rgba(120,200,255,${0.5 + 0.2 * Math.sin(t * 2)})`; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(0, 0, r + 8, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
  } else {
    ctx.fillStyle = '#3a4150'; ctx.beginPath(); ctx.roundRect(-r, -r, r * 2, r * 2, 8); ctx.fill();
    ctx.strokeStyle = ally ? '#e5e7eb' : '#111'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = tc.dark; ctx.beginPath(); ctx.roundRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4, 6); ctx.fill();
  }
  // turret
  ctx.save(); ctx.rotate(facing);
  ctx.fillStyle = '#1f2430'; ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1f2430'; ctx.lineWidth = kind === 'core' ? 6 : 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.75, 0); ctx.stroke();
  ctx.restore();
  // hp ring
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = hpFrac > 0.5 ? '#4ade80' : hpFrac > 0.25 ? '#fbbf24' : '#ef4444'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpFrac); ctx.stroke();
  ctx.restore();
}

/** Renders a unit icon into a small canvas (for shop cards / chips). */
const iconCache = new Map<string, HTMLCanvasElement>();
export function unitIcon(type: string, faction: FactionId, team: Team, size = 40): HTMLCanvasElement {
  const key = `${type}|${team}|${size}`;
  let c = iconCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = size * dpr; c.height = size * dpr;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.translate(size / 2, size / 2);
  ctx.scale(size / 44, size / 44);
  drawUnitSprite(ctx, type, { team, faction, facing: -Math.PI / 2, turret: -Math.PI / 2, anim: 0, t: 0, windup: 0, recoil: 0, moving: false, ally: true, flash: 0, air: false, quality: 1 });
  iconCache.set(key, c);
  return c;
}
