// 적 AI(병사·포탑). 보스는 boss.ts. 순수 로직.
import { BODIES } from '../data/bodies';
import { RULES } from '../data/rules';
import { angleDiff, fireWeapon } from './combat';
import { moveWithCollision } from './tilemap';
import { speedMul, useSkill } from './skills';
import { updateBoss } from './boss';
import type { Entity, Vec } from './types';
import { World } from './world';

const S = RULES.tile;

export function alertEnemy(w: World, e: Entity): void {
  if (e.ai.state === 'alert') return;
  e.ai.state = 'alert'; e.ai.alertedAt = w.time;
  for (const o of w.entities) if (o !== e && o.alive && o.team === 'enemy' && o.ai.state === 'idle' && o.body !== 'turret' && o.body !== 'boss' && Math.hypot(o.x - e.x, o.y - e.y) < 120) { o.ai.state = 'alert'; o.ai.alertedAt = w.time; }
}

export function ensureFlow(w: World): void {
  const p = w.player; const tx = Math.floor(p.x / S), ty = Math.floor(p.y / S);
  w.flowT -= RULES.fixedDt;
  if (!w.flow || w.flowT <= 0 || tx !== w.flowTile.tx || ty !== w.flowTile.ty) {
    w.flow = w.map.flowField(tx, ty, w.staticBlocked()); w.flowTile = { tx, ty }; w.flowT = 0.35;
  }
}

/** 이동 벡터(단위) 적용 + 넉백 속도 처리 */
export function moveEntity(w: World, e: Entity, dirX: number, dirY: number, speed: number, dt: number): void {
  const len = Math.hypot(dirX, dirY); if (len > 1) { dirX /= len; dirY /= len; }
  const dx = dirX * speed * dt + e.vx * dt, dy = dirY * speed * dt + e.vy * dt;
  const r = moveWithCollision(w.map, e.x, e.y, dx, dy, e.radius);
  e.mvx = (r.x - e.x) / Math.max(dt, 1e-6); e.mvy = (r.y - e.y) / Math.max(dt, 1e-6);
  e.x = r.x; e.y = r.y;
  const decay = Math.exp(-9 * dt); e.vx *= decay; e.vy *= decay;
  if (r.hitX) e.vx = 0; if (r.hitY) e.vy = 0;
}

function turnToward(e: Entity, target: number, rate: number, dt: number): void {
  const d = angleDiff(target, e.facing); const step = rate * dt;
  e.facing += Math.abs(d) <= step ? d : Math.sign(d) * step;
}

function leadPoint(e: Entity, p: Entity, projSpeed: number, factor: number): Vec {
  if (projSpeed <= 0) return { x: p.x + p.mvx * factor, y: p.y + p.mvy * factor };
  const t = Math.hypot(p.x - e.x, p.y - e.y) / projSpeed;
  return { x: p.x + p.mvx * t * factor, y: p.y + p.mvy * t * factor };
}

export function updateEnemies(w: World, dt: number): void {
  ensureFlow(w);
  const p = w.player;
  for (const e of w.entities) {
    if (!e.alive || e.team !== 'enemy' || e.controlled) continue;
    if (e.body === 'boss') { updateBoss(w, e, dt, p); continue; }
    if (e.body === 'node') continue;
    if (e.body === 'turret') { updateTurret(w, e, dt, p); continue; }
    updateSoldier(w, e, dt, p);
  }
}

function updateTurret(w: World, e: Entity, dt: number, p: Entity): void {
  if (e.disabled) return;
  const d = BODIES.turret; const wp = d.weapon;
  const dx = p.x - e.x, dy = p.y - e.y; const dd = Math.hypot(dx, dy);
  if (p.hp <= 0 || dd > wp.range || !w.map.lineOfSight(e.x, e.y, p.x, p.y)) { e.ai.state = 'idle'; return; }
  e.ai.state = 'alert';
  const lp = leadPoint(e, p, wp.speed, 0.85);
  const want = Math.atan2(lp.y - e.y, lp.x - e.x);
  turnToward(e, want, d.ai.turnRate, dt);
  if (e.attackCd <= 0 && e.burstLeft <= 0 && Math.abs(angleDiff(want, e.facing)) < 0.2) fireWeapon(w, e, lp);
}

function updateSoldier(w: World, e: Entity, dt: number, p: Entity): void {
  const d = BODIES[e.body]; const ai = d.ai; const wp = d.weapon;
  if (e.disabled) return;
  if (e.stunUntil > w.time) { moveEntity(w, e, 0, 0, 0, dt); return; }
  const dx = p.x - e.x, dy = p.y - e.y; const dd = Math.hypot(dx, dy);
  const los = w.map.lineOfSight(e.x, e.y, p.x, p.y);
  if (e.ai.state === 'idle') {
    const sight = w.zone.calmEnemies ? Math.min(ai.sight, RULES.calmSight) : ai.sight;
    if (p.hp > 0 && ((dd < sight && los) || dd < 80)) alertEnemy(w, e);
    else {
      // 대기: 제자리로 복귀하거나 천천히 두리번
      const hx = e.ai.home.x - e.x, hy = e.ai.home.y - e.y; const hd = Math.hypot(hx, hy);
      if (hd > 24) { const tx = Math.floor(e.x / S), ty = Math.floor(e.y / S); const f = w.map.flowField(Math.floor(e.ai.home.x / S), Math.floor(e.ai.home.y / S)); const n = w.map.nextStep(f, tx, ty, e.ai.home); const gx = n ? n.tx * S + S / 2 : e.ai.home.x, gy = n ? n.ty * S + S / 2 : e.ai.home.y; const l = Math.hypot(gx - e.x, gy - e.y) || 1; e.facing = Math.atan2(gy - e.y, gx - e.x); moveEntity(w, e, (gx - e.x) / l, (gy - e.y) / l, d.speed * 0.6, dt); }
      else { e.facing += Math.sin(w.time * 0.7 + e.id) * 0.4 * dt; moveEntity(w, e, 0, 0, 0, dt); }
      return;
    }
  }
  // 추격 포기: 멀리서 시야를 오래 놓치면 제자리로
  if (!los && dd > RULES.leashDistance) { e.ai.lostT += dt; if (e.ai.lostT > RULES.leashSeconds) { e.ai.state = 'idle'; e.ai.lostT = 0; moveEntity(w, e, 0, 0, 0, dt); return; } }
  else e.ai.lostT = 0;
  e.ai.thinkT -= dt;
  if (e.ai.thinkT <= 0) { e.ai.thinkT = 0.8 + w.rng.next() * 1.4; if (w.rng.next() < 0.4) e.ai.strafeDir *= -1; }
  let mx = 0, my = 0;
  const immobile = e.windup > 0 && (e.body === 'sniper');
  if (!immobile && p.hp > 0) {
    if (!los || dd > ai.preferRange * 1.15) {
      const tx = Math.floor(e.x / S), ty = Math.floor(e.y / S);
      const n = w.flow ? w.map.nextStep(w.flow, tx, ty, p) : null;
      if (n) { const cx = n.tx * S + S / 2, cy = n.ty * S + S / 2; mx = cx - e.x; my = cy - e.y; }
      else { mx = dx; my = dy; }
      const l = Math.hypot(mx, my) || 1; mx /= l; my /= l;
    } else if (dd < ai.tooClose) {
      mx = -dx / dd; my = -dy / dd;
    } else if (ai.strafe) {
      mx = (-dy / dd) * e.ai.strafeDir; my = (dx / dd) * e.ai.strafeDir;
      // 벽에 막히면 방향 전환
      const hb = e.radius * 0.82;
      if (w.map.boxBlocked(e.x + mx * 12, e.y + my * 12, hb)) { e.ai.strafeDir *= -1; mx = -mx; my = -my; }
    } else if (dd > ai.preferRange) {
      mx = dx / dd; my = dy / dd;
    }
  }
  const spd = d.speed * speedMul(w, e);
  moveEntity(w, e, mx, my, spd, dt);
  // 조준·회전
  const lp = leadPoint(e, p, wp.speed, wp.kind === 'lob' ? 0.45 : 0.75);
  const want = Math.atan2(lp.y - e.y, lp.x - e.x);
  const turning = e.windup > 0 || (e.body === 'shield' && e.attackCd > 1 / wp.rate - 0.35);
  if (!turning) turnToward(e, want, ai.turnRate, dt);
  // 사격
  const aligned = Math.abs(angleDiff(want, e.facing)) < (e.body === 'shield' ? 0.45 : 0.3);
  const inRange = dd <= wp.range * (wp.kind === 'lob' ? 1.0 : 0.98) + p.radius;
  if (p.hp > 0 && inRange && aligned && e.attackCd <= 0 && e.windup <= 0 && e.burstLeft <= 0 && (los || wp.overWalls)) {
    if (wp.kind === 'pierce') { fireWeapon(w, e, lp); e.windup = 0.8; e.attackCd = 1 / wp.rate + 0.8; }
    else fireWeapon(w, e, lp);
  }
  // 스킬(AI)
  if (e.skillCd <= 0 && d.skill) {
    if (d.skill.id === 'sprint' && dd > 240 && los) useSkill(w, e, { x: dx / dd, y: dy / dd }, p);
    else if (d.skill.id === 'guard' && e.hp < e.hpMax * 0.6 && dd < 220) useSkill(w, e, null, p);
    else if (d.skill.id === 'repairpulse' && e.hp > e.hpMax * 0.5 && dd < 90) useSkill(w, e, null, p); // 공격적 사용만(저체력 자가회복 없음: 빙의 창 보장)
  }
  // 정비병: 아군 수리
  if (e.body === 'mechanic') {
    e.ai.healCd -= dt;
    if (e.ai.healCd <= 0) {
      const ally = w.entities.find((o) => o.alive && o.team === 'enemy' && o !== e && o.body !== 'boss' && o.body !== 'turret' && o.body !== 'node' && o.hp < o.hpMax * 0.6 && Math.hypot(o.x - e.x, o.y - e.y) < 130);
      if (ally) { ally.hp = Math.min(ally.hpMax, ally.hp + 15); e.ai.healCd = 6; w.emit({ type: 'repair', x: ally.x, y: ally.y, amount: 15, id: ally.id }); w.emit({ type: 'shock', fromX: e.x, fromY: e.y, x: ally.x, y: ally.y, body: 'mechanic' }); }
      else e.ai.healCd = 1;
    }
  }
}

/** 겹침 분리: 적끼리·플레이어와 적. 고정 개체(포탑·보스·노드)는 밀리지 않음 */
export function separateEntities(w: World): void {
  const es = w.entities.filter((e) => e.alive);
  for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
    const a = es[i], b = es[j];
    const rr = (a.radius + b.radius) * 0.9; const dx = b.x - a.x, dy = b.y - a.y; const dd = Math.hypot(dx, dy);
    if (dd >= rr || dd < 1e-3) continue;
    const push = (rr - dd) * 0.5; const nx = dx / dd, ny = dy / dd;
    const fixedA = a.body === 'boss' || a.body === 'turret' || a.body === 'node';
    const fixedB = b.body === 'boss' || b.body === 'turret' || b.body === 'node';
    if (fixedA && fixedB) continue;
    const wa = fixedA ? 0 : fixedB ? 1 : 0.5; const wb = 1 - wa;
    const ax = a.x - nx * push * 2 * wa, ay = a.y - ny * push * 2 * wa;
    const bx = b.x + nx * push * 2 * wb, by = b.y + ny * push * 2 * wb;
    if (!w.map.boxBlocked(ax, ay, a.radius * 0.82)) { a.x = ax; a.y = ay; }
    if (!w.map.boxBlocked(bx, by, b.radius * 0.82)) { b.x = bx; b.y = by; }
  }
}
