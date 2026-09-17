import { DT, ENEMY, PLAYER } from './constants';
import { angleDiff, lineOfSight, moveCircle } from './geom';
import type { AttemptState, Enemy, GameEvent } from './types';

const sec = (s: number): number => Math.round(s / DT);

export function damagePlayer(st: AttemptState, amount: number, cause: string, fromX: number, fromY: number, knock: number): boolean {
  const p = st.player;
  if (!p.alive || p.invuln > 0 || p.dashTicks > 0) return false;
  p.hp -= amount; st.damageTaken += amount; p.invuln = sec(PLAYER.hitInvulnSec); p.hitFlash = 12;
  const dx = p.x - fromX, dy = p.y - fromY; const d = Math.hypot(dx, dy) || 1;
  p.kx += (dx / d) * knock; p.ky += (dy / d) * knock;
  st.events.push({ kind: 'playerHit', cause, x: p.x, y: p.y });
  if (p.hp <= 0) { p.hp = 0; p.alive = false; p.deathCause = cause; st.events.push({ kind: 'playerDied', cause }); }
  return true;
}

/** Enemies only ever react to the current player, or to the origin of a shot that hit them. Ghosts are never targets. */
export function stepEnemies(st: AttemptState): void {
  const p = st.player; const solids = st.map.solids; const bounds = st.map.bounds;
  for (const e of st.enemies) {
    if (!e.alive) continue;
    if (e.hitFlash > 0) e.hitFlash--;
    if (e.contactCd > 0) e.contactCd--;
    if (e.attackCd > 0) e.attackCd--;
    const dx = p.x - e.x, dy = p.y - e.y; const d = Math.hypot(dx, dy);
    const def = ENEMY[e.kind];
    const canSee = p.alive && d <= ('detectRange' in def ? def.detectRange : (def as typeof ENEMY.turret).range) && lineOfSight(e, p, solids);
    if (e.kind === 'turret') stepTurret(st, e, canSee, d, dx, dy);
    else stepWalker(st, e, canSee, d, dx, dy, solids, bounds);
  }
  // Soft separation so guards do not stack on one spot (deterministic, position based, wall-aware). Heavies never budge.
  for (let i = 0; i < st.enemies.length; i++) {
    const a = st.enemies[i]; if (!a.alive || a.kind === 'turret') continue;
    for (let j = i + 1; j < st.enemies.length; j++) {
      const b = st.enemies[j]; if (!b.alive || b.kind === 'turret') continue;
      const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy); const min = ENEMY[a.kind].radius + ENEMY[b.kind].radius;
      if (d <= 0 || d >= min) continue;
      const gap = min - d; const ux = dx / d, uy = dy / d;
      const moveA = a.kind !== 'heavy', moveB = b.kind !== 'heavy'; const share = moveA && moveB ? 0.5 : 1;
      if (moveA) { const np = moveCircle(a, ENEMY[a.kind].radius, -ux * gap * share, -uy * gap * share, solids, bounds); a.x = np.x; a.y = np.y; }
      if (moveB) { const np = moveCircle(b, ENEMY[b.kind].radius, ux * gap * share, uy * gap * share, solids, bounds); b.x = np.x; b.y = np.y; }
    }
  }
}

function stepTurret(st: AttemptState, e: Enemy, canSee: boolean, d: number, dx: number, dy: number): void {
  const def = ENEMY.turret; const p = st.player;
  if (e.state === 'windup') {
    if (canSee) e.facing = Math.atan2(dy, dx);
    e.stateTicks--;
    if (e.stateTicks <= 0) {
      e.state = 'idle'; e.attackCd = sec(def.cooldownSec);
      const a = e.facing; const ox = e.x + Math.cos(a) * (def.radius + 6), oy = e.y + Math.sin(a) * (def.radius + 6);
      st.projectiles.push({ id: st.nextId++, owner: 'enemy', ghost: -1, x: ox, y: oy, px: ox, py: oy, vx: Math.cos(a) * def.shotSpeed, vy: Math.sin(a) * def.shotSpeed, life: sec(def.shotLifeSec), damage: def.shotDamage, radius: def.shotRadius, weapon: 'turret', knockback: 60 });
      st.events.push({ kind: 'shot', owner: 'enemy', ghost: -1, x: ox, y: oy, weapon: 'turret', angle: a });
    }
    return;
  }
  if (canSee) { e.facing = Math.atan2(dy, dx); if (e.attackCd <= 0) { e.state = 'windup'; e.stateTicks = sec(def.telegraphSec); st.events.push({ kind: 'turretWarn', enemyId: e.id }); } }
  else if (p.alive) e.facing += angleDiff(e.facing + 0.004, e.facing);
}

function stepWalker(st: AttemptState, e: Enemy, canSee: boolean, d: number, dx: number, dy: number, solids: readonly import('./geom').Rect[], bounds: import('./geom').Rect): void {
  const p = st.player; const isHeavy = e.kind === 'heavy'; const def = isHeavy ? ENEMY.heavy : ENEMY.chaser;
  // Heavy swing state machine takes precedence.
  if (isHeavy) {
    const hd = ENEMY.heavy;
    if (e.state === 'windup') {
      e.stateTicks--;
      if (e.stateTicks <= 0) {
        e.state = 'cooldown'; e.stateTicks = sec(0.35); e.attackCd = sec(hd.swingCooldownSec);
        const ang = Math.atan2(dy, dx);
        if (p.alive && d <= hd.swingRange + PLAYER.radius && Math.abs(angleDiff(ang, e.facing)) <= hd.swingArcRad / 2) damagePlayer(st, hd.swingDamage, '중장갑 경비의 강타', e.x, e.y, 180);
      }
      return;
    }
    if (e.state === 'cooldown') { e.stateTicks--; if (e.stateTicks <= 0) e.state = canSee ? 'chase' : 'idle'; return; }
    if (canSee && d <= hd.swingRange && e.attackCd <= 0) { e.state = 'windup'; e.stateTicks = sec(hd.windupSec); e.facing = Math.atan2(dy, dx); st.events.push({ kind: 'heavyWindup', enemyId: e.id }); return; }
  }
  if (canSee) { e.state = 'chase'; e.targetX = p.x; e.targetY = p.y; e.lastSeenTicks = 0; }
  else if (e.state === 'chase') { e.lastSeenTicks++; if (e.lastSeenTicks > sec(def.loseSightSec)) { e.state = isHeavy ? 'return' : 'investigate'; } }
  let mx = 0, my = 0;
  const speed = def.speed * DT;
  const toward = (tx: number, ty: number, stopDist: number): boolean => {
    const ddx = tx - e.x, ddy = ty - e.y; const dd = Math.hypot(ddx, ddy);
    if (dd <= stopDist) return true;
    const step = Math.min(speed, dd - stopDist); mx = (ddx / dd) * step; my = (ddy / dd) * step; e.facing = Math.atan2(ddy, ddx); return false;
  };
  if (e.state === 'chase') {
    if (isHeavy) { // post guard: steps toward the player only within its leash, then holds and swings
      const hd = ENEMY.heavy; const ddx = e.targetX - e.hx, ddy = e.targetY - e.hy; const dd = Math.hypot(ddx, ddy); const lim = Math.min(dd, hd.leash);
      const tx = dd > 0 ? e.hx + (ddx / dd) * lim : e.hx, ty = dd > 0 ? e.hy + (ddy / dd) * lim : e.hy;
      toward(tx, ty, ENEMY.heavy.radius + PLAYER.radius - 2); e.facing = Math.atan2(e.targetY - e.y, e.targetX - e.x);
    } else toward(e.targetX, e.targetY, def.radius + PLAYER.radius - 6);
  }
  else if (e.state === 'investigate') { if (toward(e.targetX, e.targetY, 6)) { e.state = 'return'; e.stateTicks = sec(def.investigateWaitSec); } }
  else if (e.state === 'return') { if (e.stateTicks > 0) e.stateTicks--; else if (toward(e.hx, e.hy, 3)) e.state = 'idle'; }
  // knockback from hits
  mx += e.kx * DT; my += e.ky * DT; e.kx *= 0.82; e.ky *= 0.82;
  if (mx !== 0 || my !== 0) { const np = moveCircle(e, def.radius, mx, my, solids, bounds); e.x = np.x; e.y = np.y; }
  // Contact damage (chaser only; heavy uses its swing).
  if (!isHeavy && p.alive && e.contactCd <= 0) {
    const cd = Math.hypot(p.x - e.x, p.y - e.y);
    if (cd <= def.radius + PLAYER.radius + 1) { if (damagePlayer(st, ENEMY.chaser.contactDamage, '추적 경비와 접촉', e.x, e.y, 140)) e.contactCd = sec(ENEMY.chaser.contactCooldownSec); }
  }
}

/** Robots hear gunfire: an idle walker with line of sight to a shot fired within hearRange walks over to check the spot. */
export function noiseAt(st: AttemptState, x: number, y: number): void {
  for (const e of st.enemies) {
    if (!e.alive || e.kind === 'turret') continue;
    if (e.state !== 'idle' && e.state !== 'return') continue;
    const def = ENEMY[e.kind]; if (def.hearRange <= 0 || Math.hypot(e.x - x, e.y - y) > def.hearRange) continue;
    if (!lineOfSight(e, { x, y }, st.map.solids)) continue;
    e.state = 'investigate'; e.targetX = x; e.targetY = y;
  }
}

/** Called when a projectile hits an enemy: applies damage, knockback and the "investigate the shot origin" reaction. */
export function hurtEnemy(st: AttemptState, e: Enemy, damage: number, vx: number, vy: number, knockback: number, originX: number, originY: number, actor: string): GameEvent | null {
  if (!e.alive) return null;
  e.hp -= damage; e.hitFlash = 6;
  const l = Math.hypot(vx, vy) || 1; const resist = e.kind === 'heavy' ? 0.04 : e.kind === 'turret' ? 0 : 1; // heavies barely budge: they are blockers
  e.kx += (vx / l) * knockback * 2 * resist; e.ky += (vy / l) * knockback * 2 * resist;
  st.stats[actor].damage += damage;
  if (e.kind === 'chaser' && e.state !== 'chase' && e.state !== 'windup' && e.state !== 'cooldown') { e.state = 'investigate'; e.targetX = originX; e.targetY = originY; }
  if (e.hp <= 0) {
    e.hp = 0; e.alive = false; e.deathTick = st.tick; st.stats[actor].kills++;
    return { kind: 'enemyDied', enemyKind: e.kind, x: e.x, y: e.y, by: actor };
  }
  return null;
}
