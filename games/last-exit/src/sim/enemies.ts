// 적 생성·AI·보스 패턴
import type { RunState, Enemy, EnemyType } from './types';
import { ENEMIES, BOSS, DIFFICULTY, SPAWN_WARN, SPAWN_MIN_DIST, PLAYER } from '../data/balance';
import { emit, nid } from './state';
import { damagePlayer } from './damage';
import { flowField, flowDir, moveCircle, hasLos, dist, norm, tileAt, blocksMove, tileCenter, nearestWalkable, angleDiff, circleBlocked } from './geom';

// 흐름장 캐시 (렌더 무관, 저장 안 함)
const flowCache = new WeakMap<RunState, { key: string; f: Int16Array }>();
export function getFlow(s: RunState): Int16Array {
  const [tx, ty] = tileAt(s.player.x, s.player.y);
  const open = !!s.zoneRt.door?.open;
  const key = `${s.zone}:${tx},${ty}:${open}:${s.zoneRt.collapse?.state || ''}`;
  const c = flowCache.get(s);
  if (c && c.key === key) return c.f;
  const f = flowField(s.zoneRt.rows, s.player.x, s.player.y, open);
  flowCache.set(s, { key, f });
  return f;
}
export function invalidateFlow(s: RunState): void { flowCache.delete(s); }

export function spawnEnemy(s: RunState, type: EnemyType, x: number, y: number, noLoot: boolean): Enemy {
  const def = ENEMIES[type];
  const hp = type === 'boss' ? BOSS.hp[s.difficulty] : Math.round(def.hp * DIFFICULTY[s.difficulty].enemyHpMul);
  const e: Enemy = { id: nid(s), type, x, y, r: def.r, hp, maxHp: hp, state: 'spawn', stateT: 0.3, dirX: 0, dirY: 1, slowT: 0, slowMul: 1, cd: type === 'shooter' ? 0.8 : 0.4, noLoot, hitFlash: 0, stuckT: 0, lastX: x, lastY: y, flash: 0, boss: null, wander: (s.nextId % 7) / 7 };
  if (type === 'boss') { e.boss = { phase: 1, pattern: 'idle', patternT: 0, telegraph: 0, dirA: 0, fired: false, cycle: 0, summons: 0, restT: 1.2, ringOffset: 0 }; s.zoneRt.bossSpawned = true; s.bossBar = { hp, max: hp, phase: 1 }; emit(s, { t: 'bossSpawn' }); }
  s.enemies.push(e);
  return e;
}

/** 생성 예약: 플레이어에서 충분히 먼 생성 지점을 골라 예고 후 등장 */
export function scheduleSpawns(s: RunState, groups: { type: EnemyType; n: number }[], noLoot: boolean, nearX?: number, nearY?: number): void {
  const p = s.player;
  let pts = s.zoneRt.spawnPoints.slice();
  if (pts.length === 0) pts = [{ x: s.zoneRt.startX, y: s.zoneRt.startY }];
  const far = pts.filter(q => dist(q.x, q.y, p.x, p.y) >= SPAWN_MIN_DIST);
  const pool = (far.length ? far : pts).slice();
  if (nearX !== undefined && nearY !== undefined) pool.sort((a, b) => dist(a.x, a.y, nearX, nearY) - dist(b.x, b.y, nearX, nearY));
  else pool.sort((a, b) => dist(b.x, b.y, p.x, p.y) - dist(a.x, a.y, p.x, p.y));
  // 협공: 가장 먼 지점과, 최소 거리를 만족하는 가장 가까운 지점
  const use = pool.length >= 2 ? [pool[0], pool[pool.length - 1]] : pool.slice(0, 1);
  let i = 0;
  const warn = s.difficulty === 'hard' ? SPAWN_WARN * 0.8 : SPAWN_WARN;
  for (const g of groups) for (let k = 0; k < g.n; k++) {
    const q = use[i % use.length]; const ang = (i * 2.4) % (Math.PI * 2); const rad = 6 + (i % 3) * 9;
    let x = q.x + Math.cos(ang) * rad, y = q.y + Math.sin(ang) * rad;
    if (circleBlocked(s.zoneRt.rows, x, y, ENEMIES[g.type].r)) { x = q.x; y = q.y; }
    s.spawns.push({ x, y, type: g.type, t: warn + (i % 2) * 0.15, noLoot });
    emit(s, { t: 'spawnWarn', x, y });
    i++;
  }
}

export function updateSpawns(s: RunState, dt: number): void {
  for (let i = s.spawns.length - 1; i >= 0; i--) {
    const sp = s.spawns[i]; sp.t -= dt;
    if (sp.t <= 0) { spawnEnemy(s, sp.type, sp.x, sp.y, sp.noLoot); s.spawns.splice(i, 1); }
  }
}

function separation(s: RunState, e: Enemy): [number, number] {
  let sx = 0, sy = 0;
  for (const o of s.enemies) {
    if (o === e || o.state === 'dead') continue;
    const dx = e.x - o.x, dy = e.y - o.y; const d = Math.hypot(dx, dy); const min = e.r + o.r + 2;
    if (d < min && d > 0.01) { const f = (min - d) / min; sx += dx / d * f; sy += dy / d * f; }
  }
  return [sx, sy];
}

function moveEnemy(s: RunState, e: Enemy, vx: number, vy: number, dt: number): boolean {
  const [sx, sy] = separation(s, e);
  const nx = vx + sx * 60, ny = vy + sy * 60;
  const [x, y, hit] = moveCircle(s.zoneRt.rows, e.x, e.y, nx * dt, ny * dt, e.r, true);
  e.x = x; e.y = y;
  return hit;
}

export function updateEnemies(s: RunState, dt: number): void {
  const p = s.player; const rows = s.zoneRt.rows;
  const flow = getFlow(s);
  for (const e of s.enemies) {
    if (e.state === 'dead') continue;
    e.hitFlash = Math.max(0, e.hitFlash - dt); e.flash = Math.max(0, e.flash - dt);
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) { e.slowT = 0; e.slowMul = 1; } }
    if (e.cd > 0) e.cd -= dt;
    if (e.state === 'spawn') { e.stateT -= dt; if (e.stateT <= 0) e.state = 'chase'; continue; }
    if (e.type === 'boss') { updateBoss(s, e, dt, flow); continue; }
    const def = ENEMIES[e.type]; const speed = def.speed * e.slowMul;
    const dx = p.x - e.x, dy = p.y - e.y; const d = Math.hypot(dx, dy); const [ux, uy] = norm(dx, dy);
    const los = hasLos(rows, e.x, e.y, p.x, p.y);
    switch (e.type) {
      case 'chaser': case 'runner': {
        if (e.state === 'chase') {
          if (d <= def.reach - 4 && e.cd <= 0 && los) { e.state = 'windup'; e.stateT = def.windup; e.dirX = ux; e.dirY = uy; }
          else { const [fx, fy] = flowDir(rows, flow, e.x, e.y, true); const [mx, my] = d < 60 && los ? [ux, uy] : [fx, fy]; moveEnemy(s, e, mx * speed, my * speed, dt); }
        } else if (e.state === 'windup') {
          e.stateT -= dt; moveEnemy(s, e, 0, 0, dt);
          if (e.stateT <= 0) { if (dist(e.x, e.y, p.x, p.y) <= def.reach + 8) damagePlayer(s, def.dmg, ux, uy, def.name); e.cd = def.cd; e.state = 'recover'; e.stateT = 0.25; }
        } else if (e.state === 'recover') { e.stateT -= dt; if (e.stateT <= 0) e.state = 'chase'; }
        break;
      }
      case 'shooter': {
        const sd = def as typeof ENEMIES.shooter;
        if (e.state === 'chase' || e.state === 'hold') {
          if (los && d <= sd.maxDist && d >= sd.minDist) { e.state = 'hold'; if (e.cd <= 0) { e.state = 'windup'; e.stateT = def.windup; e.dirX = ux; e.dirY = uy; } }
          else if (los && d < sd.minDist) { // 물러나기 (가능하면)
            const bx = -ux * speed * 0.8, by = -uy * speed * 0.8; const hit = moveEnemy(s, e, bx, by, dt); if (hit) { moveEnemy(s, e, -uy * speed * 0.6, ux * speed * 0.6, dt); } e.state = 'chase';
            if (e.cd <= 0) { e.state = 'windup'; e.stateT = def.windup; e.dirX = ux; e.dirY = uy; }
          } else { const [fx, fy] = flowDir(rows, flow, e.x, e.y, true); moveEnemy(s, e, fx * speed, fy * speed, dt); e.state = 'chase'; }
        } else if (e.state === 'windup') {
          e.stateT -= dt; e.dirX = ux; e.dirY = uy; // 예고선은 플레이어를 따라감
          if (e.stateT <= 0) {
            if (hasLos(rows, e.x, e.y, p.x, p.y)) {
              s.projectiles.push({ id: nid(s), owner: 'enemy', src: 'shooter', x: e.x + ux * (e.r + 4), y: e.y + uy * (e.r + 4), vx: ux * sd.projSpeed, vy: uy * sd.projSpeed, dmg: def.dmg, r: sd.projR, life: 2.2, pierce: 0, hitIds: [], kind: 'orb', knock: 0, volley: 0, shock: false });
            }
            e.cd = def.cd; e.state = 'hold';
          }
        }
        break;
      }
      case 'armored': {
        const ad = def as typeof ENEMIES.armored;
        if (e.state === 'chase') {
          if (los && d <= ad.chargeRange && d > 30 && e.cd <= 0) { e.state = 'windup'; e.stateT = def.windup; e.dirX = ux; e.dirY = uy; }
          else { const [fx, fy] = flowDir(rows, flow, e.x, e.y, true); moveEnemy(s, e, fx * speed, fy * speed, dt); }
        } else if (e.state === 'windup') {
          e.stateT -= dt; moveEnemy(s, e, 0, 0, dt);
          if (e.stateT <= 0) { e.state = 'charge'; e.stateT = ad.chargeTime; e.wander = 0; }
        } else if (e.state === 'charge') {
          e.stateT -= dt;
          const hit = moveEnemy(s, e, e.dirX * ad.chargeSpeed * e.slowMul, e.dirY * ad.chargeSpeed * e.slowMul, dt);
          if (e.wander === 0 && dist(e.x, e.y, p.x, p.y) <= e.r + PLAYER.radius + 6) { damagePlayer(s, def.dmg, e.dirX, e.dirY, def.name); e.wander = 1; }
          if (hit || e.stateT <= 0) { e.state = 'recover'; e.stateT = 0.45; e.cd = def.cd; }
        } else if (e.state === 'recover') { e.stateT -= dt; if (e.stateT <= 0) e.state = 'chase'; }
        break;
      }
      case 'bomber': {
        const bd = def as typeof ENEMIES.bomber;
        if (e.state === 'chase') {
          if (d <= bd.fuseDist && los) { e.state = 'fuse'; e.stateT = def.windup; }
          else { const [fx, fy] = flowDir(rows, flow, e.x, e.y, true); const [mx, my] = d < 70 && los ? [ux, uy] : [fx, fy]; moveEnemy(s, e, mx * speed, my * speed, dt); }
        } else if (e.state === 'fuse') {
          e.stateT -= dt; moveEnemy(s, e, ux * speed * 0.25, uy * speed * 0.25, dt);
          if (e.stateT <= 0) {
            emit(s, { t: 'explode', x: e.x, y: e.y, r: def.reach, kind: 'bomber' });
            if (dist(e.x, e.y, p.x, p.y) <= def.reach + PLAYER.radius) damagePlayer(s, def.dmg, ux, uy, def.name);
            // 자폭은 처치로 집계 (전리품 없음)
            e.noLoot = true; e.state = 'dead'; e.hp = 0; s.stats.kills[s.zone]++; s.zoneRt.kills++;
          }
        }
        break;
      }
    }
    // 플레이어와 겹치면 살짝 밀어내기 (피해 없음)
    const dd = dist(e.x, e.y, p.x, p.y); const min = e.r + PLAYER.radius;
    if (dd < min && dd > 0.01) { const push = (min - dd) * 0.5; const [nx, ny] = norm(e.x - p.x, e.y - p.y); const [x2, y2] = moveCircle(rows, e.x, e.y, nx * push, ny * push, e.r, true); e.x = x2; e.y = y2; }
  }
}

// ───────── 보스 ─────────
function bossRest(s: RunState, b: Enemy): void {
  const bs = b.boss!; bs.pattern = 'idle'; bs.patternT = 0; bs.fired = false;
  bs.restT = BOSS.restTime[s.difficulty] * (bs.phase === 2 ? BOSS.phase2RestMul : 1);
}
function bossPick(s: RunState, b: Enemy): void {
  const bs = b.boss!; const order: ('cone' | 'ring' | 'summon')[] = ['cone', 'ring', 'cone', 'summon', 'ring', 'cone'];
  let pat = order[bs.cycle % order.length]; bs.cycle++;
  const alive = s.enemies.filter(e => e !== b && e.state !== 'dead').length;
  if (pat === 'summon' && (bs.summons >= BOSS.summon.max || alive >= BOSS.summon.maxAlive)) pat = 'ring';
  bs.pattern = pat; bs.patternT = 0; bs.fired = false;
  const p = s.player; bs.dirA = Math.atan2(p.y - b.y, p.x - b.x);
  bs.telegraph = pat === 'cone' ? BOSS.cone.telegraph : pat === 'ring' ? BOSS.ring.telegraph : 0.6;
  if (bs.phase === 2) bs.telegraph *= 0.9;
}
function updateBoss(s: RunState, b: Enemy, dt: number, flow: Int16Array): void {
  const bs = b.boss!; const p = s.player; const rows = s.zoneRt.rows;
  if (bs.phase === 1 && b.hp <= b.maxHp * BOSS.phase2At) { bs.phase = 2; emit(s, { t: 'bossPhase' }); }
  if (s.bossBar) { s.bossBar.hp = b.hp; s.bossBar.phase = bs.phase; }
  const speed = ENEMIES.boss.speed * b.slowMul * (bs.phase === 2 ? 1.25 : 1);
  if (bs.pattern === 'idle') {
    bs.restT -= dt;
    const [fx, fy] = flowDir(rows, flow, b.x, b.y, true); const d = dist(b.x, b.y, p.x, p.y);
    if (d > 90) moveEnemy(s, b, fx * speed, fy * speed, dt);
    // 끼임 방지
    if (d > 90 && Math.hypot(b.x - b.lastX, b.y - b.lastY) < 1.5) { b.stuckT += dt; if (b.stuckT > 1.5) { const n = nearestWalkable(rows, b.x, b.y, true, 3); if (n) { const [cx, cy] = tileCenter(n[0], n[1]); if (!circleBlocked(rows, cx, cy, b.r)) { b.x = cx; b.y = cy; } } b.stuckT = 0; } } else b.stuckT = 0;
    b.lastX = b.x; b.lastY = b.y;
    if (bs.restT <= 0) bossPick(s, b);
    return;
  }
  bs.patternT += dt;
  if (bs.pattern === 'cone') {
    if (!bs.fired && bs.patternT >= bs.telegraph) {
      bs.fired = true;
      const a = Math.atan2(p.y - b.y, p.x - b.x); const d = dist(b.x, b.y, p.x, p.y);
      const inCone = (dir: number) => d <= BOSS.cone.radius + PLAYER.radius && Math.abs(angleDiff(dir, a)) <= BOSS.cone.arc / 2 + 0.05;
      const hit = inCone(bs.dirA) || (bs.phase === 2 && inCone(bs.dirA + Math.PI));
      if (hit) damagePlayer(s, BOSS.cone.dmg, Math.cos(bs.dirA), Math.sin(bs.dirA), '금고 파수꾼 강타');
      emit(s, { t: 'explode', x: b.x, y: b.y, r: BOSS.cone.radius, kind: 'boss' });
    }
    if (bs.patternT >= bs.telegraph + 0.35) bossRest(s, b);
  } else if (bs.pattern === 'ring') {
    if (!bs.fired && bs.patternT >= bs.telegraph) {
      bs.fired = true;
      const n = bs.phase === 2 ? BOSS.ring.count2 : BOSS.ring.count; bs.ringOffset += 0.37;
      for (let i = 0; i < n; i++) {
        const a = bs.ringOffset + (i / n) * Math.PI * 2;
        s.projectiles.push({ id: nid(s), owner: 'enemy', src: 'boss', x: b.x + Math.cos(a) * (b.r + 6), y: b.y + Math.sin(a) * (b.r + 6), vx: Math.cos(a) * BOSS.ring.speed, vy: Math.sin(a) * BOSS.ring.speed, dmg: BOSS.ring.dmg, r: BOSS.ring.r, life: 3, pierce: 0, hitIds: [], kind: 'ring', knock: 0, volley: 0, shock: false });
      }
    }
    if (bs.patternT >= bs.telegraph + 0.3) bossRest(s, b);
  } else if (bs.pattern === 'summon') {
    if (!bs.fired && bs.patternT >= bs.telegraph) {
      bs.fired = true; bs.summons++;
      scheduleSpawns(s, [{ type: BOSS.summon.type, n: BOSS.summon.count }], true);
    }
    if (bs.patternT >= bs.telegraph + 0.4) bossRest(s, b);
  }
}
