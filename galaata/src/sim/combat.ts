// 무기 발사, 투사체, 피해, 폭발. 순수 로직.
import { BODIES } from '../data/bodies';
import { RULES } from '../data/rules';
import type { Entity, Projectile, ProjectileKind, Team, Vec, WeaponDef } from './types';
import { World, openDoor } from './world';
import { T } from './tilemap';

export const angleDiff = (a: number, b: number): number => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

function makeProjectile(w: World, kind: ProjectileKind, owner: Entity, x: number, y: number, dir: number, wp: WeaponDef, volley: number, damage = wp.damage): Projectile {
  const dmg = owner.team === 'enemy' ? damage * RULES.enemyDamageMul * (w.hard ? RULES.hardDamageMul : 1) : damage;
  const p: Projectile = {
    id: w.nextId++, kind, team: owner.team, ownerId: owner.id, ownerBody: owner.body,
    x, y, vx: Math.cos(dir) * wp.speed, vy: Math.sin(dir) * wp.speed,
    damage: dmg, ttl: wp.speed > 0 ? wp.range / wp.speed : 0, radius: kind === 'pierce' ? 6 : kind === 'pellet' ? 4 : 5,
    pierce: !!wp.pierce, hitIds: [], splash: wp.splash ?? 0, overWalls: !!wp.overWalls, knockback: wp.knockback ?? 0, shock: wp.shock ?? 0,
    volley, sx: x, sy: y, tx: x, ty: y, flight: 0, t: 0, fuse: 0, selfDamage: false, breaksWalls: false, color: wp.color,
  };
  w.projectiles.push(p);
  return p;
}

/** 무기 종류별 발사. aim은 조준점(월드 좌표). 준비 시간이 있는 무기는 windup만 설정. */
export function fireWeapon(w: World, e: Entity, aim: Vec): void {
  const d = BODIES[e.body]; const wp = d.weapon;
  if (wp.kind === 'none') return;
  let dir = Math.atan2(aim.y - e.y, aim.x - e.x);
  if (e.team === 'enemy' && wp.kind !== 'lob' && wp.kind !== 'arc') dir += (w.rng.next() - 0.5) * 2 * RULES.enemySpread;
  e.facing = dir;
  e.attackCd = (1 / wp.rate) * (e.team === 'enemy' ? RULES.enemyFireIntervalMul : 1);
  const volley = w.volleyCounter++;
  const muzzle = e.radius + 4;
  const mx = e.x + Math.cos(dir) * muzzle, my = e.y + Math.sin(dir) * muzzle;
  switch (wp.kind) {
    case 'rapid': {
      const spread = (w.rng.next() - 0.5) * 0.06;
      makeProjectile(w, 'bullet', e, mx, my, dir + spread, wp, volley);
      w.emit({ type: 'shot', body: e.body, x: mx, y: my, dir });
      break;
    }
    case 'burst': {
      makeProjectile(w, 'bullet', e, mx, my, dir, wp, volley);
      e.burstLeft = (wp.burst ?? 1) - 1; e.burstTimer = wp.burstGap ?? 0.08; e.windupTarget = { ...aim }; e.burstVolley = volley;
      w.emit({ type: 'shot', body: e.body, x: mx, y: my, dir });
      break;
    }
    case 'turret': {
      makeProjectile(w, 'turret', e, mx, my, dir, wp, volley);
      e.burstLeft = (wp.burst ?? 1) - 1; e.burstTimer = wp.burstGap ?? 0.12; e.windupTarget = { ...aim }; e.burstVolley = volley;
      w.emit({ type: 'shot', body: e.body, x: mx, y: my, dir });
      break;
    }
    case 'shotgun': {
      const n = wp.pellets ?? 5; const sp = wp.spread ?? 0.4;
      for (let i = 0; i < n; i++) {
        const a = dir + (i / (n - 1) - 0.5) * sp + (w.rng.next() - 0.5) * 0.05;
        const p = makeProjectile(w, 'pellet', e, mx, my, a, wp, volley);
        p.ttl *= 0.85 + w.rng.next() * 0.3;
      }
      w.emit({ type: 'shot', body: e.body, x: mx, y: my, dir });
      break;
    }
    case 'lob': {
      let tx = aim.x, ty = aim.y; const dd = Math.hypot(tx - e.x, ty - e.y);
      if (dd > wp.range) { tx = e.x + ((tx - e.x) / dd) * wp.range; ty = e.y + ((ty - e.y) / dd) * wp.range; }
      const p = makeProjectile(w, 'bomb', e, e.x, e.y, dir, wp, volley);
      p.vx = 0; p.vy = 0; p.tx = tx; p.ty = ty; p.flight = wp.flight ?? 0.75; p.t = 0; p.ttl = 99; p.breaksWalls = true; p.radius = 7;
      w.emit({ type: 'shot', body: e.body, x: e.x, y: e.y, dir });
      break;
    }
    case 'pierce': {
      e.windup = wp.windup ?? 0.35; e.windupTarget = { ...aim }; e.attackCd += e.windup;
      w.emit({ type: 'shot', body: e.body, x: mx, y: my, dir, text: 'windup' });
      break;
    }
    case 'arc': {
      // 즉발 전기 아크: 사거리 내 가장 가까운 시야 확보 적 → 연쇄
      const targets = w.entities.filter((t) => t.alive && t.team !== e.team && !(t.body === 'boss' && t.ai.shielded));
      let first: Entity | null = null; let bd = wp.range;
      for (const t of targets) { const dd = dist(e, t) - t.radius; if (dd < bd && w.map.lineOfSight(e.x, e.y, t.x, t.y)) { bd = dd; first = t; } }
      if (!first) { e.attackCd = 0.12; return; }
      const hit: Entity[] = [first];
      for (let c = 0; c < (wp.chain ?? 0); c++) {
        const last = hit[hit.length - 1]; let nxt: Entity | null = null; let nd = wp.chainRange ?? 80;
        for (const t of targets) { if (hit.includes(t)) continue; const dd = dist(last, t) - t.radius; if (dd < nd) { nd = dd; nxt = t; } }
        if (!nxt) break; hit.push(nxt);
      }
      let from: Vec = { x: mx, y: my };
      for (let i = 0; i < hit.length; i++) {
        const t = hit[i]; const dmg = i === 0 ? wp.damage : Math.max(1, Math.round(wp.damage * 0.65));
        const blocked = i === 0 && isBlockedByShield(w, t, from);
        if (!blocked) { applyDamage(w, t, dmg * (e.team === 'enemy' ? RULES.enemyDamageMul : 1), { x: from.x, y: from.y, ownerId: e.id, volley }); applyShock(w, t, wp.shock ?? 0); }
        else w.emit({ type: 'block', x: t.x, y: t.y, dir: Math.atan2(from.y - t.y, from.x - t.x) });
        w.emit({ type: 'shock', fromX: from.x, fromY: from.y, x: t.x, y: t.y, body: e.body });
        from = { x: t.x, y: t.y };
      }
      w.emit({ type: 'shot', body: e.body, x: mx, y: my, dir });
      break;
    }
  }
}

/** 준비 시간(저격)·점사 진행. 매 스텝 호출 */
export function updateFiring(w: World, e: Entity, dt: number): void {
  if (!e.alive) return;
  if (e.windup > 0) {
    e.windup -= dt;
    if (e.windup <= 0) {
      e.windup = 0;
      const wp = BODIES[e.body].weapon; const aim = e.windupTarget ?? { x: e.x + Math.cos(e.facing) * 100, y: e.y + Math.sin(e.facing) * 100 };
      const dir = Math.atan2(aim.y - e.y, aim.x - e.x); e.facing = dir;
      const mx = e.x + Math.cos(dir) * (e.radius + 6), my = e.y + Math.sin(dir) * (e.radius + 6);
      const aimshot = e.aimshotPending; e.aimshotPending = false;
      const dmg = aimshot ? 75 : wp.damage;
      const p = makeProjectile(w, 'pierce', e, mx, my, dir, { ...wp, speed: 900, range: wp.range || 540 }, w.volleyCounter++, dmg);
      p.pierce = true; if (aimshot) { p.radius = 8; p.color = '#ffffff'; }
      w.emit({ type: 'shot', body: e.body, x: mx, y: my, dir, text: aimshot ? 'aimshot' : 'fire' });
    }
  }
  if (e.burstLeft > 0) {
    e.burstTimer -= dt;
    if (e.burstTimer <= 0) {
      const wp = BODIES[e.body].weapon; const aim = e.windupTarget ?? { x: e.x + Math.cos(e.facing) * 100, y: e.y + Math.sin(e.facing) * 100 };
      // 점사 중 조준 보정: 플레이어는 최신 조준점, 적은 최초 조준점
      const target = e.controlled && w.aimPoint ? w.aimPoint : aim;
      const dir = Math.atan2(target.y - e.y, target.x - e.x); e.facing = dir;
      const mx = e.x + Math.cos(dir) * (e.radius + 4), my = e.y + Math.sin(dir) * (e.radius + 4);
      makeProjectile(w, e.body === 'turret' ? 'turret' : 'bullet', e, mx, my, dir + (w.rng.next() - 0.5) * 0.04, wp, e.burstVolley);
      w.emit({ type: 'shot', body: e.body, x: mx, y: my, dir });
      e.burstLeft--; e.burstTimer = wp.burstGap ?? 0.08;
    }
  }
}

/** 전방 방어: from 위치에서 오는 공격을 막는가 */
export function isBlockedByShield(w: World, target: Entity, from: Vec): boolean {
  const d = BODIES[target.body];
  if (!d.blockArc || !target.alive) return false;
  if (target.stunUntil > w.time) return false;
  const guarding = target.skillUntil > w.time && d.skill?.id === 'guard';
  const arc = guarding ? d.guardArc : d.blockArc;
  const a = Math.atan2(from.y - target.y, from.x - target.x);
  return Math.abs(angleDiff(a, target.facing)) <= arc;
}

export interface DamageSource { x: number; y: number; ownerId: number; volley: number }

/** 피해 적용. 죽은 대상·무적·보호막은 무시. 반환: 실제 적용 여부 */
export function applyDamage(w: World, t: Entity, amount: number, src: DamageSource): boolean {
  if (!t.alive || amount <= 0) return false;
  if (t.body === 'boss' && t.ai.shielded) { w.emit({ type: 'block', x: t.x, y: t.y, dir: Math.atan2(src.y - t.y, src.x - t.x), text: 'shield' }); return false; }
  if (t.controlled) {
    const sameVolley = src.volley === t.lastVolley && w.time - t.lastHitAt < 0.45;
    if (t.invulnUntil > w.time && !sameVolley) return false;
    if (!sameVolley) t.volleyDamage = 0;
    const cap = t.hpMax * RULES.maxDamagePerStepRatio;
    const room = Math.max(0, Math.min(cap - w.stepDamage, t.hpMax * RULES.volleyCapRatio - t.volleyDamage));
    amount = Math.min(amount, room);
    if (amount <= 0) return false;
    w.stepDamage += amount; t.volleyDamage += amount;
    w.damageLog.push({ t: +w.time.toFixed(2), amount: +amount.toFixed(1), from: w.entity(src.ownerId)?.body ?? 'unknown', body: t.body });
    t.invulnUntil = w.time + RULES.hitInvuln; t.lastVolley = src.volley; t.lastHitAt = w.time;
    if (t.stability != null) t.stability = Math.max(0, t.stability - amount * BODIES[t.body].stabilityDamageFactor);
    w.stats.damageTaken += amount;
  }
  if (t.body === 'boss' && t.ai.exposedUntil > w.time) amount *= 2.5;
  t.hp -= amount; t.hitFlash = 0.12;
  w.emit({ type: 'hit', x: t.x, y: t.y, amount: Math.round(amount), dir: Math.atan2(t.y - src.y, t.x - src.x), id: t.id, body: t.body });
  if (t.team === 'enemy' && t.ai.state === 'idle' && t.body !== 'turret' && t.body !== 'node') { t.ai.state = 'alert'; t.ai.alertedAt = w.time; }
  if (t.hp <= 0) { t.hp = 0; if (!t.controlled) killEntity(w, t); }
  return true;
}

export function applyShock(w: World, t: Entity, amount: number): void {
  if (amount <= 0 || !t.alive || t.body === 'boss' || t.body === 'node' || t.body === 'turret') return;
  t.slowUntil = w.time + 0.6;
  if (t.controlled) return; // 플레이어 몸은 기절하지 않음(감속만)
  t.shock = Math.min(RULES.shockMax, t.shock + amount);
  if (t.shock >= RULES.shockMax && t.stunUntil < w.time) {
    t.stunUntil = w.time + RULES.stunDuration; t.shock = 0; t.windup = 0; t.burstLeft = 0;
    w.emit({ type: 'stun', x: t.x, y: t.y, id: t.id, body: t.body });
  }
}

export function killEntity(w: World, e: Entity): void {
  if (!e.alive) return;
  e.alive = false; e.hp = 0; e.deathT = w.time;
  w.emit({ type: 'die', x: e.x, y: e.y, body: e.body, id: e.id });
  if (e.team === 'enemy') w.stats.kills++;
  if (e.body === 'boss') w.emit({ type: 'bossDie', x: e.x, y: e.y });
}

export function explode(w: World, x: number, y: number, radius: number, damage: number, team: Team, ownerId: number, selfDamage: boolean, breaksWalls: boolean, volley: number): void {
  w.emit({ type: 'explode', x, y, amount: radius });
  for (const e of w.entities) {
    if (!e.alive) continue;
    const isOwner = e.id === ownerId;
    if (e.team === team && !(selfDamage && isOwner)) continue;
    const dd = Math.hypot(e.x - x, e.y - y) - e.radius * 0.6;
    if (dd > radius) continue;
    const fall = dd < radius * 0.5 ? 1 : 1 - ((dd - radius * 0.5) / (radius * 0.5)) * 0.4;
    let amt = damage * fall * (team === 'enemy' && !isOwner ? RULES.enemyDamageMul * (w.hard ? RULES.hardDamageMul : 1) : 1);
    if (isOwner) amt *= 0.5;
    applyDamage(w, e, amt, { x, y, ownerId, volley });
    if (dd > 1 && e.body !== 'boss' && e.body !== 'turret' && e.body !== 'node') {
      const a = Math.atan2(e.y - y, e.x - x); const kb = 90 * fall; e.vx += Math.cos(a) * kb; e.vy += Math.sin(a) * kb;
    }
  }
  if (breaksWalls) {
    for (const d of w.devices) {
      if (d.kind !== 'crackedWall' || d.broken) continue;
      const cx = Math.max(d.x - 16, Math.min(x, d.x + 16)), cy = Math.max(d.y - 16, Math.min(y, d.y + 16));
      if (Math.hypot(cx - x, cy - y) <= radius + 6) {
        d.hp -= damage; w.emit({ type: 'hit', x: d.x, y: d.y, amount: Math.round(damage), body: 'node' });
        if (d.hp <= 0) { d.broken = true; w.map.set(d.tx, d.ty, T.FLOOR); w.emit({ type: 'wallBreak', x: d.x, y: d.y }); }
      }
    }
  }
  if (team === 'player') for (const d of w.devices) if (d.kind === 'switch' && !d.on && Math.hypot(d.x - x, d.y - y) <= radius + d.radius) triggerSwitch(w, d.id);
}

export function triggerSwitch(w: World, id: string): void {
  const s = w.device(id, 'switch'); if (!s || s.on) return;
  s.on = true; w.emit({ type: 'switch', x: s.x, y: s.y });
  const door = w.door(s.doorId); if (door) openDoor(w, door);
}

export function updateProjectiles(w: World, dt: number): void {
  const keep: Projectile[] = [];
  for (const p of w.projectiles) {
    let alive = true;
    if (p.kind === 'bomb') {
      if (p.fuse > 0) {
        p.fuse -= dt;
        if (p.fuse <= 0) { explode(w, p.x, p.y, p.splash, p.damage, p.team, p.ownerId, p.selfDamage, p.breaksWalls, p.volley); alive = false; }
      } else {
        p.t += dt; const u = Math.min(1, p.t / p.flight);
        p.x = p.sx + (p.tx - p.sx) * u; p.y = p.sy + (p.ty - p.sy) * u;
        if (u >= 1) { explode(w, p.tx, p.ty, p.splash, p.damage, p.team, p.ownerId, false, p.breaksWalls, p.volley); alive = false; }
      }
      if (alive) keep.push(p); continue;
    }
    const px = p.x, py = p.y;
    p.x += p.vx * dt; p.y += p.vy * dt; p.ttl -= dt;
    if (p.ttl <= 0) { alive = false; }
    else if (!p.overWalls && w.map.solidAtPoint(p.x, p.y, true)) { w.emit({ type: 'hit', x: px, y: py, amount: 0, body: 'node' }); alive = false; }
    if (alive && p.team === 'player') {
      for (const d of w.devices) if (d.kind === 'switch' && !d.on && Math.hypot(d.x - p.x, d.y - p.y) <= d.radius + p.radius) { triggerSwitch(w, d.id); if (!p.pierce) alive = false; }
    }
    if (alive) {
      for (const e of w.entities) {
        if (!e.alive || e.team === p.team || p.hitIds.includes(e.id)) continue;
        if (p.team === 'enemy' && !e.controlled) continue;
        const rr = e.radius + p.radius;
        if (Math.abs(e.x - p.x) > rr || Math.abs(e.y - p.y) > rr) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) > rr) continue;
        // 방패 차단
        if (isBlockedByShield(w, e, { x: px, y: py })) {
          w.emit({ type: 'block', x: p.x, y: p.y, dir: Math.atan2(py - e.y, px - e.x), id: e.id });
          if (e.controlled) e.guardHits++;
          // 막아도 밀치기는 절반 적용(방패끼리 밀어내기)
          if (p.knockback > 0 && e.body !== 'boss' && e.body !== 'turret' && e.body !== 'node') { const a = Math.atan2(p.vy, p.vx); e.vx += Math.cos(a) * p.knockback * 0.5; e.vy += Math.sin(a) * p.knockback * 0.5; }
          alive = false; break;
        }
        const ok = applyDamage(w, e, p.damage, { x: px, y: py, ownerId: p.ownerId, volley: p.volley });
        if (ok && p.knockback > 0 && e.body !== 'boss' && e.body !== 'turret' && e.body !== 'node') { const a = Math.atan2(p.vy, p.vx); e.vx += Math.cos(a) * p.knockback; e.vy += Math.sin(a) * p.knockback; }
        if (ok && p.shock > 0) applyShock(w, e, p.shock);
        p.hitIds.push(e.id);
        if (!p.pierce) { alive = false; break; }
      }
    }
    if (alive) keep.push(p);
  }
  w.projectiles = keep;
}

/**
 * 자동 조준: 사거리 안 적 중 점수가 가장 좋은 대상.
 * 점수 = 거리 + (조이스틱 방향 ±70° 밖이면 +140) + (정면을 보는 방패병이면 +260: 탄이 막힘) → 없으면 스위치 → 없으면 이동/바라보는 방향
 */
export function resolveAim(w: World, e: Entity, moveDir: Vec | null): { point: Vec; targetId: number } {
  const wp = BODIES[e.body].weapon; const range = wp.range * 1.08 + 20;
  const moving = moveDir && Math.hypot(moveDir.x, moveDir.y) > 0.15; const mAng = moving ? Math.atan2(moveDir!.y, moveDir!.x) : e.facing;
  let best: Entity | null = null; let bs = Infinity;
  for (const t of w.entities) {
    if (!t.alive || t.team === e.team) continue;
    if (t.body === 'boss' && t.ai.shielded) continue;
    const dd = Math.hypot(t.x - e.x, t.y - e.y) - t.radius * 0.5;
    if (dd >= range) continue;
    if (!wp.overWalls && !w.map.lineOfSight(e.x, e.y, t.x, t.y)) continue;
    let score = dd;
    const ang = Math.atan2(t.y - e.y, t.x - e.x);
    if (Math.abs(angleDiff(ang, mAng)) > 1.22) score += 140;
    if (!wp.overWalls && isBlockedByShield(w, t, e)) score += 260;
    if (t.ai.state === 'idle' && t.body !== 'turret' && t.body !== 'node' && t.body !== 'boss') score += 120; // 나를 공격 중인 적 우선
    if (score < bs) { bs = score; best = t; }
  }
  if (best) {
    // 이동 예측(직선 탄만): 표적의 최근 이동 속도 × 비행 시간
    if (wp.speed > 0 && wp.kind !== 'lob') { const tt = Math.hypot(best.x - e.x, best.y - e.y) / wp.speed; return { point: { x: best.x + best.mvx * tt * 0.85, y: best.y + best.mvy * tt * 0.85 }, targetId: best.id }; }
    return { point: { x: best.x, y: best.y }, targetId: best.id };
  }
  if (wp.kind !== 'arc') {
    // 장치 보조 조준: 스위치(모든 직선 무기), 금 간 벽(폭발 무기만)
    let bs: { x: number; y: number } | null = null; let sd = wp.range + (wp.splash ?? 0) * 0.8;
    for (const d of w.devices) {
      if (d.kind === 'switch' && !d.on) { const dd = Math.hypot(d.x - e.x, d.y - e.y); if (dd < sd && (wp.overWalls || w.map.lineOfSight(e.x, e.y, d.x, d.y))) { sd = dd; bs = d; } }
      else if (d.kind === 'crackedWall' && !d.broken && wp.overWalls) { const dd = Math.hypot(d.x - e.x, d.y - e.y); if (dd < sd) { sd = dd; bs = d; } }
    }
    if (bs) return { point: { x: bs.x, y: bs.y }, targetId: -1 };
  }
  const dir = moveDir && (Math.abs(moveDir.x) > 0.01 || Math.abs(moveDir.y) > 0.01) ? Math.atan2(moveDir.y, moveDir.x) : e.facing;
  return { point: { x: e.x + Math.cos(dir) * Math.max(80, wp.range * 0.6), y: e.y + Math.sin(dir) * Math.max(80, wp.range * 0.6) }, targetId: 0 };
}
