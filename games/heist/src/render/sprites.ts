// Procedural 2D sprites: a small time thief, chunky security robots, and the four devices. No external assets.
import { DEVICE, ENEMY, PLAYER } from '../sim/constants';
import type { Enemy, Generator, Laser, Plate, Vault } from '../sim/types';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

export interface ThiefStyle { body: string; scarf: string; skin: string; alpha: number; ghost: boolean; tint?: string }
export const PLAYER_STYLE: ThiefStyle = { body: '#2b2f4a', scarf: '#ff8a3d', skin: '#ffd9b5', alpha: 1, ghost: false };
export const GHOST_STYLES: ThiefStyle[] = [
  { body: '#2a5a78', scarf: '#4fd8ff', skin: '#bfeeff', alpha: 0.55, ghost: true, tint: '#4fd8ff' },
  { body: '#4a3a7a', scarf: '#b58cff', skin: '#e2d2ff', alpha: 0.55, ghost: true, tint: '#b58cff' },
  { body: '#2f6a4a', scarf: '#7dffb0', skin: '#d0ffe4', alpha: 0.55, ghost: true, tint: '#7dffb0' },
];

/** The thief. `walk` = distance walked (animates legs), `facing` radians, `recoil` 0..1, `dash` 0..1, `hit` 0..1. */
export function drawThief(ctx: Ctx, x: number, y: number, facing: number, walk: number, moving: boolean, recoil: number, dash: number, hit: number, style: ThiefStyle, weapon: 'rifle' | 'shotgun', hasCore: boolean, t: number): void {
  const r = PLAYER.radius;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = style.alpha;
  const bob = moving ? Math.sin(walk / 6) * 1.5 : Math.sin(t * 2) * 0.6;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, r * 0.9, r * 0.95, r * 0.4, 0, 0, TAU); ctx.fill();
  if (style.ghost) { // dashed aura marks a time projection
    ctx.strokeStyle = style.tint || '#4fd8ff'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -t * 20; ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  // legs
  const legSwing = moving ? Math.sin(walk / 5) * 5 : 0;
  ctx.fillStyle = style.body;
  ctx.beginPath(); ctx.ellipse(-5, r * 0.55 + legSwing * 0.4, 4, 5, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(5, r * 0.55 - legSwing * 0.4, 4, 5, 0, 0, TAU); ctx.fill();
  // body (squash when dashing)
  ctx.save(); ctx.translate(0, bob); ctx.rotate(facing);
  const sx = 1 + dash * 0.35, sy = 1 - dash * 0.25; ctx.scale(sx, sy);
  ctx.translate(-recoil * 4, 0);
  ctx.fillStyle = hit > 0 ? '#ffffff' : style.body; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  // backpack with the time device (behind, so drawn at -x)
  ctx.fillStyle = '#1a1c2c'; ctx.beginPath(); ctx.roundRect(-r - 3, -6, 7, 12, 2); ctx.fill();
  ctx.fillStyle = style.ghost ? (style.tint || '#4fd8ff') : '#4fd8ff'; ctx.beginPath(); ctx.arc(-r, 0, 2.5 + Math.sin(t * 6) * 0.5, 0, TAU); ctx.fill();
  // face band (mask) + eyes looking forward
  ctx.fillStyle = style.skin; ctx.beginPath(); ctx.ellipse(4, 0, 6, 7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = style.body; ctx.fillRect(1, -7.5, 9, 4);
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(6, -2.5, 1.6, 0, TAU); ctx.arc(6, 2.5, 1.6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(6.6, -3, 0.6, 0, TAU); ctx.arc(6.6, 2, 0.6, 0, TAU); ctx.fill();
  // scarf tail flutters behind
  ctx.strokeStyle = style.scarf; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-4, -r + 4); ctx.quadraticCurveTo(-r - 4, -r + 2 + Math.sin(t * 9) * 2, -r - 9, -r + 6 + Math.sin(t * 7) * 3); ctx.stroke();
  // weapon
  ctx.fillStyle = '#c9ccd6'; ctx.strokeStyle = '#3a3d4a'; ctx.lineWidth = 1;
  if (weapon === 'rifle') { ctx.beginPath(); ctx.roundRect(4, 4, 15, 4, 1.5); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ff8a3d'; ctx.fillRect(16, 4.5, 3, 3); }
  else { ctx.beginPath(); ctx.roundRect(3, 4, 12, 5.5, 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#7a4a2a'; ctx.fillRect(3, 5, 5, 4); }
  ctx.restore();
  // hat
  ctx.fillStyle = style.ghost ? style.body : '#1c1e33'; ctx.beginPath(); ctx.ellipse(0, bob - r * 0.55, r * 0.8, r * 0.36, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = style.scarf; ctx.fillRect(-r * 0.5, bob - r * 0.62, r, 2);
  if (hasCore) { const g = 6 + Math.sin(t * 8) * 1; ctx.fillStyle = 'rgba(255,190,60,0.35)'; ctx.beginPath(); ctx.arc(0, -r - 8, g + 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffcf4d'; ctx.beginPath(); ctx.arc(0, -r - 8, g, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.arc(-2, -r - 10, 2, 0, TAU); ctx.fill(); }
  ctx.restore();
}

export function drawGhostBadge(ctx: Ctx, x: number, y: number, slot: number, holding: boolean, style: ThiefStyle): void {
  ctx.save(); ctx.translate(x, y - PLAYER.radius - 16);
  ctx.fillStyle = style.tint || '#4fd8ff'; ctx.beginPath(); ctx.roundRect(-13, -8, 26, 16, 8); ctx.fill();
  ctx.fillStyle = '#0b1020'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(holding ? `${slot + 1}⏹` : `${slot + 1}⟲`, 0, 0.5);
  ctx.restore();
}

export function drawEnemy(ctx: Ctx, e: Enemy, playerX: number, playerY: number, t: number): void {
  const def = ENEMY[e.kind]; const r = def.radius;
  ctx.save(); ctx.translate(e.x, e.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, r * 0.75, r, r * 0.4, 0, 0, TAU); ctx.fill();
  const flash = e.hitFlash > 0;
  if (e.kind === 'chaser') {
    const alert = e.state === 'chase';
    // wheel
    ctx.fillStyle = '#23252e'; ctx.beginPath(); ctx.ellipse(0, r * 0.5, r * 0.55, r * 0.35, 0, 0, TAU); ctx.fill();
    // round body
    ctx.fillStyle = flash ? '#fff' : '#e0523a'; ctx.beginPath(); ctx.arc(0, -2, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#5a1a12'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffb08a'; ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.4, r * 0.28, 0, TAU); ctx.fill();
    // single big eye looking along facing
    const ex = Math.cos(e.facing) * r * 0.35, ey = Math.sin(e.facing) * r * 0.35 - 2;
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(ex, ey, r * 0.42, 0, TAU); ctx.fill();
    ctx.fillStyle = alert ? '#ffdd33' : '#6cf0ff'; ctx.beginPath(); ctx.arc(ex + Math.cos(e.facing) * 2, ey + Math.sin(e.facing) * 2, r * 0.22, 0, TAU); ctx.fill();
    // antenna
    ctx.strokeStyle = '#5a1a12'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r + 2); ctx.lineTo(3, -r - 7); ctx.stroke(); ctx.fillStyle = alert ? '#ff3b3b' : '#ffb08a'; ctx.beginPath(); ctx.arc(3, -r - 8, 2.5 + (alert ? Math.sin(t * 20) * 0.8 : 0), 0, TAU); ctx.fill();
    if (alert) { ctx.fillStyle = '#ffdd33'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText('!', 0, -r - 14); }
  } else if (e.kind === 'turret') {
    // tripod base
    ctx.strokeStyle = '#3b3e4a'; ctx.lineWidth = 4; for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + Math.PI / 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05 + 3); ctx.stroke(); }
    // hexagonal head
    ctx.fillStyle = flash ? '#fff' : '#8d93a6'; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#2b2e3a'; ctx.lineWidth = 2; ctx.stroke();
    // barrel
    const charging = e.state === 'windup'; const ch = charging ? 1 - e.stateTicks / Math.max(1, Math.round(ENEMY.turret.telegraphSec * 60)) : 0;
    ctx.save(); ctx.rotate(e.facing);
    ctx.fillStyle = '#3b3e4a'; ctx.fillRect(0, -4, r * 1.3, 8);
    ctx.fillStyle = charging ? `rgba(255,${Math.round(120 - ch * 100)},60,1)` : '#ff5c5c'; ctx.beginPath(); ctx.arc(r * 1.3, 0, 4 + ch * 3, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = charging ? '#ffcc33' : '#ff5c5c'; ctx.beginPath(); ctx.arc(0, 0, 4 + (charging ? Math.sin(t * 25) * 1.5 : 0), 0, TAU); ctx.fill();
    if (charging) { // aiming line to the player
      ctx.strokeStyle = `rgba(255,80,80,${0.25 + ch * 0.5})`; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(playerX - e.x, playerY - e.y); ctx.stroke(); ctx.setLineDash([]);
    }
  } else { // heavy (drawn a little larger than its collision circle so it reads as bulky)
    ctx.scale(1.15, 1.15);
    const wind = e.state === 'windup'; const wt = wind ? 1 - e.stateTicks / Math.max(1, Math.round(ENEMY.heavy.windupSec * 60)) : 0;
    if (wind) { // telegraphed swing arc
      ctx.fillStyle = `rgba(255,120,40,${0.15 + wt * 0.3})`; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, ENEMY.heavy.swingRange + PLAYER.radius, e.facing - ENEMY.heavy.swingArcRad / 2, e.facing + ENEMY.heavy.swingArcRad / 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 2; ctx.stroke();
    }
    // treads
    ctx.fillStyle = '#26283a'; ctx.beginPath(); ctx.roundRect(-r, -r * 0.6, r * 2, r * 1.5, 5); ctx.fill();
    // chunky body
    ctx.fillStyle = flash ? '#fff' : '#6f4bd1'; ctx.beginPath(); ctx.roundRect(-r * 0.85, -r, r * 1.7, r * 1.6, 6); ctx.fill(); ctx.strokeStyle = '#2d1c5e'; ctx.lineWidth = 2.5; ctx.stroke();
    // shoulder pads
    ctx.fillStyle = '#9c7cff'; ctx.beginPath(); ctx.roundRect(-r - 4, -r * 0.7, 9, r * 0.9, 3); ctx.fill(); ctx.beginPath(); ctx.roundRect(r - 5, -r * 0.7, 9, r * 0.9, 3); ctx.fill();
    // visor
    ctx.fillStyle = '#1a1030'; ctx.fillRect(-r * 0.55, -r * 0.65, r * 1.1, 7);
    ctx.fillStyle = wind ? '#ff6a3d' : '#ff3b6b'; ctx.fillRect(-r * 0.4, -r * 0.6, r * 0.8, 4);
    // hammer arm rotates to facing; pulls back during windup
    ctx.save(); ctx.rotate(e.facing - (wind ? 0.9 * (1 - wt) : 0.4));
    ctx.fillStyle = '#4a4f66'; ctx.fillRect(r * 0.3, -3, r * 1.2, 6); ctx.fillStyle = '#c9ccd6'; ctx.beginPath(); ctx.roundRect(r * 1.3, -8, 12, 16, 3); ctx.fill(); ctx.strokeStyle = '#2b2e3a'; ctx.stroke();
    ctx.restore();
  }
  // HP bar
  if (e.hp < e.maxHp) { const w = r * 2; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-w / 2, -r - 12, w, 4); ctx.fillStyle = '#7dff8a'; ctx.fillRect(-w / 2, -r - 12, (w * e.hp) / e.maxHp, 4); }
  ctx.restore();
}

export function drawGenerator(ctx: Ctx, g: Generator, t: number): void {
  const r = DEVICE.generatorRadius; ctx.save(); ctx.translate(g.x, g.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, r * 0.8, r * 1.1, r * 0.4, 0, 0, TAU); ctx.fill();
  const alive = g.alive; const flash = g.hitFlash > 0;
  ctx.fillStyle = flash ? '#fff' : alive ? '#f2b632' : '#4a4a52'; ctx.beginPath(); ctx.roundRect(-r, -r * 0.9, r * 2, r * 1.8, 5); ctx.fill(); ctx.strokeStyle = alive ? '#7a5010' : '#222'; ctx.lineWidth = 2.5; ctx.stroke();
  // coils
  ctx.strokeStyle = alive ? '#7a5010' : '#2a2a30'; ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-r + 6, i * 6); ctx.lineTo(r - 6, i * 6); ctx.stroke(); }
  // core light
  const pulse = alive ? 0.6 + Math.sin(t * 5) * 0.4 : 0;
  ctx.fillStyle = alive ? `rgba(255,80,60,${0.5 + pulse * 0.5})` : '#222'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
  if (alive) { ctx.fillStyle = 'rgba(255,220,120,0.9)'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('⚡', 0, -r - 6); }
  else { ctx.fillStyle = '#c9ccd6'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('파괴됨', 0, -r - 6); }
  if (alive && g.hp < g.maxHp) { const w = r * 2; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-w / 2, r + 4, w, 5); ctx.fillStyle = '#ffd54a'; ctx.fillRect(-w / 2, r + 4, (w * g.hp) / g.maxHp, 5); }
  ctx.restore();
}

export function drawLaser(ctx: Ctx, l: Laser, t: number): void {
  const rc = l.rect; const on = l.phase === 'on'; const warn = l.phase === 'warn';
  const cx = rc.x + rc.w / 2, cy = rc.y + rc.h / 2;
  // emitter posts at both ends
  const posts: [number, number][] = l.horizontal ? [[rc.x + 4, cy], [rc.x + rc.w - 4, cy]] : [[cx, rc.y + 4], [cx, rc.y + rc.h - 4]];
  for (const [px, py] of posts) { ctx.fillStyle = '#3b3e4a'; ctx.beginPath(); ctx.arc(px, py, 6, 0, TAU); ctx.fill(); ctx.fillStyle = on ? '#ff4d4d' : warn ? '#ffb347' : '#556'; ctx.beginPath(); ctx.arc(px, py, 3, 0, TAU); ctx.fill(); }
  if (on) {
    const glow = 0.35 + Math.sin(t * 30) * 0.1;
    ctx.fillStyle = `rgba(255,60,60,${glow})`; ctx.fillRect(rc.x, rc.y - 3, rc.w, rc.h + 6);
    ctx.fillStyle = '#ff5a5a'; if (l.horizontal) ctx.fillRect(rc.x, cy - 2, rc.w, 4); else ctx.fillRect(cx - 2, rc.y, 4, rc.h);
    ctx.fillStyle = '#fff0f0'; if (l.horizontal) ctx.fillRect(rc.x, cy - 0.7, rc.w, 1.4); else ctx.fillRect(cx - 0.7, rc.y, 1.4, rc.h);
  } else if (warn) {
    const blink = Math.floor(t * 8) % 2 === 0;
    ctx.strokeStyle = blink ? 'rgba(255,180,70,0.9)' : 'rgba(255,180,70,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); if (l.horizontal) { ctx.moveTo(rc.x, cy); ctx.lineTo(rc.x + rc.w, cy); } else { ctx.moveTo(cx, rc.y); ctx.lineTo(cx, rc.y + rc.h); } ctx.stroke(); ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = 'rgba(120,130,150,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([2, 6]); ctx.beginPath(); if (l.horizontal) { ctx.moveTo(rc.x, cy); ctx.lineTo(rc.x + rc.w, cy); } else { ctx.moveTo(cx, rc.y); ctx.lineTo(cx, rc.y + rc.h); } ctx.stroke(); ctx.setLineDash([]);
  }
}

export function drawPlate(ctx: Ctx, p: Plate, t: number, color: string): void {
  const r = DEVICE.plateRadius; ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = p.pressed ? 'rgba(80,220,255,0.22)' : 'rgba(80,120,200,0.12)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = p.pressed ? color : 'rgba(120,160,255,0.7)'; ctx.lineWidth = p.pressed ? 3 : 2; ctx.setLineDash(p.pressed ? [] : [6, 4]); ctx.lineDashOffset = -t * 10; ctx.beginPath(); ctx.arc(0, 0, r - 2, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = p.pressed ? color : 'rgba(150,180,255,0.5)'; ctx.beginPath(); ctx.arc(0, 0, 7 + (p.pressed ? Math.sin(t * 6) * 1.5 : 0), 0, TAU); ctx.fill();
  ctx.fillStyle = '#eaf2ff'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.label, 0, -r - 9);
  ctx.restore();
}

export function drawVault(ctx: Ctx, v: Vault, locksLeft: number, t: number): void {
  const r = DEVICE.vaultRadius; ctx.save(); ctx.translate(v.x, v.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, r * 0.85, r * 1.1, r * 0.4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#5b6070'; ctx.beginPath(); ctx.roundRect(-r, -r, r * 2, r * 2, 6); ctx.fill(); ctx.strokeStyle = '#23252e'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = v.open ? '#2b2f3a' : '#7c8292'; ctx.beginPath(); ctx.roundRect(-r + 6, -r + 6, r * 2 - 12, r * 2 - 12, 4); ctx.fill();
  if (v.open) {
    // door swung open
    ctx.fillStyle = '#8d93a6'; ctx.beginPath(); ctx.roundRect(-r + 6, -r + 6, 10, r * 2 - 12, 3); ctx.fill();
    if (v.corePresent) { const g = 9 + Math.sin(t * 6) * 1.5; ctx.fillStyle = 'rgba(255,190,60,0.3)'; ctx.beginPath(); ctx.arc(4, 0, g + 8, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffcf4d'; ctx.beginPath(); ctx.arc(4, 0, g, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.arc(1, -3, 3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#9dffb0'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(v.corePresent ? '열림 · 코어' : '비어 있음', 0, -r - 10);
  } else {
    // dial + lock icons
    ctx.strokeStyle = '#23252e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(t) * 8, Math.sin(t) * 8); ctx.stroke();
    ctx.fillStyle = '#ff7b7b'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(locksLeft > 0 ? `잠김 🔒${locksLeft}` : '잠김', 0, -r - 10);
  }
  ctx.restore();
}

export function drawExit(ctx: Ctx, x: number, y: number, ready: boolean, t: number): void {
  const r = DEVICE.exitRadius; ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = ready ? 'rgba(90,255,140,0.18)' : 'rgba(120,200,255,0.08)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = ready ? '#7dffa0' : 'rgba(150,200,255,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.arc(0, 0, r - 2, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = ready ? '#7dffa0' : 'rgba(150,200,255,0.6)'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ready ? '탈출 ▼' : '출구', 0, 0);
  ctx.restore();
}
