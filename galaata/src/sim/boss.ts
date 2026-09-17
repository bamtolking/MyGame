// 보스 "감시 코어 관리자" 패턴. 순수 로직.
import { BODIES } from '../data/bodies';
import { RULES } from '../data/rules';
import { angleDiff, applyDamage } from './combat';
import { moveWithCollision } from './tilemap';
import type { BodyId, Entity, Projectile } from './types';
import { World, makeEntity } from './world';

function bossBullet(w: World, b: Entity, dir: number, speed: number, damage: number, color = '#ff5c5c'): void {
  const p: Projectile = {
    id: w.nextId++, kind: 'boss', team: 'enemy', ownerId: b.id, ownerBody: 'boss', x: b.x + Math.cos(dir) * (b.radius + 6), y: b.y + Math.sin(dir) * (b.radius + 6),
    vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed, damage: damage * RULES.enemyDamageMul, ttl: 600 / speed, radius: 6, pierce: false, hitIds: [], splash: 0, overWalls: false,
    knockback: 40, shock: 0, volley: w.volleyCounter++, sx: 0, sy: 0, tx: 0, ty: 0, flight: 0, t: 0, fuse: 0, selfDamage: false, breaksWalls: false, color,
  };
  w.projectiles.push(p);
}

export function summon(w: World, body: BodyId, spawnerId: string, delay = 0.9): void {
  const s = w.device(spawnerId, 'spawner') ?? w.devices.find((d) => d.kind === 'spawner');
  if (!s) return;
  w.spawnQueue.push({ body, x: s.x, y: s.y, t: delay, tag: 'summon' });
  w.emit({ type: 'wave', x: s.x, y: s.y, body, text: `${BODIES[body].name} 소환` });
}

function possessableAlive(w: World): number { return w.entities.filter((e) => e.alive && e.team === 'enemy' && BODIES[e.body].possessable).length; }

export function updateBoss(w: World, b: Entity, dt: number, p: Entity): void {
  const ai = b.ai; const d = BODIES.boss;
  if (ai.phase === 0) {
    ai.phase = 1; ai.state = 'alert';
    summon(w, 'scout', 'v0', 1.2); summon(w, 'scout', 'v1', 1.4);
    w.emit({ type: 'bossWarn', x: b.x, y: b.y, text: '감시 코어 관리자 기동' });
    w.say('코어 잠금: 보스는 빙의 불가. 소환된 경비를 갈아타라.', 4.5, 'warn');
  }
  const hpr = b.hp / b.hpMax;
  if (ai.phase === 1 && hpr <= 0.66) {
    ai.phase = 2; ai.shielded = true; ai.ringT = 3;
    for (const n of w.nodeSpots) makeEntity(w, 'node', 'enemy', n.x, n.y, 0, 'node');
    for (const t of w.turretSpots) { const tu = makeEntity(w, 'turret', 'enemy', t.x, t.y, t.facing, 'bossturret'); tu.attackCd = 1.2; }
    summon(w, 'shield', 'v2', 1.0); summon(w, 'sniper', 'v0', 1.6);
    w.emit({ type: 'bossPhase', x: b.x, y: b.y, text: '보호막 가동' });
    w.say('보호막 가동! 좌우 노드를 부숴야 코어가 다시 열린다. (폭탄·저격·방패 돌파)', 5, 'warn');
  }
  if (ai.phase === 2 && ai.shielded && !w.entities.some((e) => e.alive && e.body === 'node')) {
    ai.shielded = false; w.emit({ type: 'bossPhase', x: b.x, y: b.y, text: '보호막 해제' }); w.say('보호막 해제! 코어를 공격하라.', 3, 'hint');
  }
  if (ai.phase === 2 && hpr <= 0.33) {
    ai.phase = 3; ai.shielded = false; ai.chargeT = 2.5; ai.ringT = 3; ai.laserAge = -1;
    for (const e of w.entities) { if (e.alive && e.body === 'node') { e.alive = false; w.emit({ type: 'die', x: e.x, y: e.y, body: 'node', id: e.id }); } if (e.alive && e.tag === 'bossturret') { e.disabled = true; w.emit({ type: 'turretOff', x: e.x, y: e.y }); } }
    summon(w, 'scout', 'v2', 1.0); summon(w, 'scout', 'v3', 1.2); summon(w, 'mechanic', 'v1', 1.5);
    w.emit({ type: 'bossPhase', x: b.x, y: b.y, text: '과부하 돌진' });
    w.say('과부하! 돌진 예고선을 피하라. 돌진 뒤 코어가 노출된다(피해 2.5배).', 5, 'warn');
  }
  const dx = p.x - b.x, dy = p.y - b.y; const dd = Math.hypot(dx, dy) || 1;
  // 돌진(3단계)
  if (ai.phase === 3) {
    if (ai.chargeDash > 0) {
      ai.chargeDash -= dt;
      const dir = ai.chargeDir!; const step = 520 * dt;
      const r = moveWithCollision(w.map, b.x, b.y, dir.x * step, dir.y * step, b.radius);
      b.x = r.x; b.y = r.y;
      if (r.hitX || r.hitY || ai.chargeDash <= 0) { ai.chargeDash = 0; ai.exposedUntil = w.time + 2.2; ai.chargeT = 4.5; w.emit({ type: 'bossPhase', x: b.x, y: b.y, text: '코어 노출' }); }
      if (p.hp > 0 && Math.hypot(p.x - b.x, p.y - b.y) < b.radius + p.radius && b.contactCd <= 0) {
        applyDamage(w, p, 30 * RULES.enemyDamageMul, { x: b.x, y: b.y, ownerId: b.id, volley: w.volleyCounter++ });
        p.vx += (dx / dd) * 300; p.vy += (dy / dd) * 300; b.contactCd = 0.8;
      }
      return;
    }
    if (ai.chargeTele > 0) {
      ai.chargeTele -= dt;
      if (ai.chargeTele <= 0) { ai.chargeDash = 0.55; b.contactCd = 0; }
      return;
    }
    ai.chargeT -= dt;
    if (ai.chargeT <= 0 && p.hp > 0) { ai.chargeDir = { x: dx / dd, y: dy / dd }; ai.chargeTele = 0.8; w.emit({ type: 'bossWarn', x: b.x, y: b.y, text: 'charge' }); }
  }
  // 이동·회전
  const want = Math.atan2(dy, dx);
  const dturn = angleDiff(want, b.facing); const st = d.ai.turnRate * dt; b.facing += Math.abs(dturn) <= st ? dturn : Math.sign(dturn) * st;
  if (dd > d.ai.preferRange && p.hp > 0 && ai.exposedUntil < w.time) {
    const r = moveWithCollision(w.map, b.x, b.y, (dx / dd) * d.speed * dt, (dy / dd) * d.speed * dt, b.radius); b.x = r.x; b.y = r.y;
  }
  // 접촉 피해
  if (p.hp > 0 && dd < b.radius + p.radius + 2 && b.contactCd <= 0) {
    applyDamage(w, p, 12 * RULES.enemyDamageMul, { x: b.x, y: b.y, ownerId: b.id, volley: w.volleyCounter++ });
    p.vx += (dx / dd) * 240; p.vy += (dy / dd) * 240; b.contactCd = 0.6;
  }
  if (p.hp <= 0) return;
  // 3연발
  ai.patternT -= dt;
  if (ai.patternT <= 0) {
    ai.patternT = ai.phase === 1 ? 2.6 : ai.phase === 2 ? 4.0 : 3.0;
    if (w.map.lineOfSight(b.x, b.y, p.x, p.y)) {
      const lead = Math.atan2(p.y + p.mvy * 0.5 - b.y, p.x + p.mvx * 0.5 - b.x);
      for (const o of [-0.22, 0, 0.22]) bossBullet(w, b, lead + o, 270, d.weapon.damage);
      w.emit({ type: 'shot', body: 'boss', x: b.x, y: b.y, dir: lead });
    }
  }
  // 원형 탄막(2·3단계)
  if (ai.phase >= 2) {
    ai.ringT -= dt;
    if (ai.ringT <= 0) {
      ai.ringT = ai.phase === 2 ? 6.5 : 4.5;
      const n = ai.phase === 2 ? 12 : 16; const off = w.rng.next() * Math.PI * 2;
      for (let i = 0; i < n; i++) bossBullet(w, b, off + (i / n) * Math.PI * 2, 200, 8, '#ff9f5c');
      w.emit({ type: 'shot', body: 'boss', x: b.x, y: b.y, dir: 0, text: 'ring' });
    }
  }
  // 레이저(1·2단계): 1초 예고 후 0.35초 발사
  if (ai.phase <= 2) {
    if (ai.laserAge < 0) {
      ai.laserT -= dt;
      if (ai.laserT <= 0) { ai.laserAge = 0; ai.laserTarget = { x: p.x, y: p.y }; w.emit({ type: 'laser', x: b.x, y: b.y, text: 'warn' }); }
    } else {
      ai.laserAge += dt;
      if (ai.laserAge >= 1.0 && ai.laserAge < 1.35 && ai.laserTarget && !ai.laserHit) {
        const lx = ai.laserTarget.x - b.x, ly = ai.laserTarget.y - b.y; const ll = Math.hypot(lx, ly) || 1; const ux = lx / ll, uy = ly / ll;
        const t = Math.max(0, Math.min(800, (p.x - b.x) * ux + (p.y - b.y) * uy));
        const cx = b.x + ux * t, cy = b.y + uy * t;
        if (Math.hypot(p.x - cx, p.y - cy) < 20 + p.radius) { ai.laserHit = true; applyDamage(w, p, 32 * RULES.enemyDamageMul, { x: b.x, y: b.y, ownerId: b.id, volley: w.volleyCounter++ }); }
        if (ai.laserAge - dt < 1.0) w.emit({ type: 'laser', x: b.x, y: b.y, text: 'fire' });
      }
      if (ai.laserAge >= 1.35) { ai.laserAge = -1; ai.laserT = ai.phase === 1 ? 8 : 9; ai.laserTarget = null; ai.laserHit = false; }
    }
  }
  // 소환 유지: 빙의할 몸이 부족하면 보충
  ai.summonT -= dt;
  if (ai.summonT <= 0) {
    ai.summonT = 14;
    if (possessableAlive(w) < 2) {
      const pool: BodyId[] = ai.phase === 1 ? ['scout', 'scout', 'shield'] : ai.phase === 2 ? ['bomber', 'sniper', 'scout'] : ['scout', 'mechanic', 'shield'];
      const vents = w.devices.filter((x) => x.kind === 'spawner');
      summon(w, w.rng.pick(pool), w.rng.pick(vents).id, 1.0);
    }
  }
}
