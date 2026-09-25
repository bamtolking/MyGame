// 적 생성·이동·행동·보스 패턴
import type { BossAbility, EnemyDef } from '../content/types';
import { BALANCE, ENEMY } from '../content';
import { rand, randRange } from '../core/rng';
import { TAU } from '../core/math';
import type { Enemy, World } from './types';
import { hurtPlayer } from './player';
import { killEnemy } from './damage';

export const MAX_ENEMIES = 450;
const DT = 1 / 60;

function num(p: Record<string, number | string> | undefined, k: string, def: number): number {
  const v = p?.[k];
  return typeof v === 'number' ? v : v !== undefined && !isNaN(Number(v)) ? Number(v) : def;
}

/** 현재 구간 체력 배율(보스 제외) */
export function segmentHpMul(w: World, t = w.t): number {
  const tl = w.cfg.stage.timeline;
  if (w.overtime || t >= BALANCE.runSeconds) {
    const last = tl[tl.length - 1];
    const base = last.hpMulEnd ?? last.hpMul;
    const min = Math.max(0, (w.t - BALANCE.runSeconds) / 60);
    return base * Math.pow(1 + BALANCE.overtimeHpGrowth, min);
  }
  for (const g of tl) {
    if (t >= g.from && t < g.to) {
      const k = (t - g.from) / Math.max(1e-6, g.to - g.from);
      return g.hpMul + ((g.hpMulEnd ?? g.hpMul) - g.hpMul) * k;
    }
  }
  const last = tl[tl.length - 1];
  return last.hpMulEnd ?? last.hpMul;
}

/** 적에게 적용할 전체 체력 배율 */
export function hpScale(w: World, boss: boolean, segMul?: number): number {
  const seg = boss ? 1 : (segMul ?? segmentHpMul(w));
  return seg * (w.cfg.stage.hpMul ?? 1) * w.enemyHpMul * (1 + w.d.curse);
}

export function spawnEnemy(w: World, def: EnemyDef, x: number, y: number, scale: number): Enemy {
  const boss = !!def.boss, elite = !!def.elite;
  const hp = Math.max(1, def.hp * scale);
  const e: Enemy = {
    uid: w.nextUid++, def, x, y, r: def.radius * (w.flags.has('bigHead') ? 1.35 : 1),
    vx: 0, vy: 0, hp, maxHp: hp, shield: (def.shield ?? 0) * scale,
    speed: def.speed * w.enemySpeedMul * (1 + w.d.curse * 0.5),
    damage: def.damage * w.enemyDmgMul, xp: def.xp,
    elite, boss, dead: false, flash: 0, contactCd: 0,
    slowT: 0, slowAmt: 0, freezeT: 0, stunT: 0, burnT: 0, burnDps: 0, burnTick: 0, buffT: 0, buffAmt: 0,
    hitCd: new Float32Array(8), t: rand(w.rng) * 2, st: 0, stT: 0, dx: 0, dy: 0, seed: rand(w.fxRng) * TAU,
    abil: (def.abilities ?? []).map(a => a.cooldown * (0.5 + rand(w.rng) * 0.5)),
    enraged: false, spdMul: 1, cdMul: 1, shout: '', shoutT: 0, face: 1, spawnT: 0.25, lastHitSlot: -1,
    chargeSpeed: 320, chargeDur: 0.8, straight: false,
  };
  w.enemies.push(e);
  if (!w.seenEnemies.has(def.id)) {
    w.seenEnemies.add(def.id);
    if (def.intro) w.events.push({ t: 'toast', text: def.intro, kind: boss ? 'boss' : elite ? 'warn' : 'info' });
  }
  if (boss) {
    if (!w.bossAlive) w.bossAlive = e;
    w.events.push({ t: 'bossSpawn', name: def.name, id: def.id });
    if (def.id === w.cfg.stage.finalBoss) w.finalBossSpawned = true;
  } else if (elite) {
    w.events.push({ t: 'elite', name: def.name });
  }
  return e;
}

/** 화면 바로 바깥의 소환 지점(플레이어 이동 방향 쪽 가중) */
export function edgePoint(w: World, margin = 40): { x: number; y: number } {
  const p = w.player;
  const hw = w.viewW / 2 + margin, hh = w.viewH / 2 + margin;
  // 이동 중이면 60% 확률로 진행 방향 쪽 변
  let side: number;
  const r = rand(w.rng);
  if (p.moving && r < 0.5) {
    side = Math.abs(p.fx) > Math.abs(p.fy) ? (p.fx > 0 ? 1 : 3) : (p.fy > 0 ? 2 : 0);
  } else {
    // 변 길이에 비례
    const per = 2 * (hw + hh);
    const q = rand(w.rng) * per;
    side = q < hw ? 0 : q < hw + hh ? 1 : q < 2 * hw + hh ? 2 : 3;
  }
  const u = rand(w.rng) * 2 - 1;
  switch (side) {
    case 0: return { x: p.x + u * hw, y: p.y - hh };
    case 1: return { x: p.x + hw, y: p.y + u * hh };
    case 2: return { x: p.x + u * hw, y: p.y + hh };
    default: return { x: p.x - hw, y: p.y + u * hh };
  }
}

export function aliveCount(w: World): number {
  let n = 0;
  for (const e of w.enemies) if (!e.dead) n++;
  return n;
}

function fireEnemyBullet(w: World, x: number, y: number, ang: number, speed: number, dmg: number, sprite = '•') {
  w.ebullets.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 6, dmg: dmg * w.enemyDmgMul, life: 6, sprite, dead: false });
}

function say(w: World, e: Enemy, text: string | undefined) {
  if (!text) return;
  e.shout = text; e.shoutT = 2.4;
  w.events.push({ t: 'shout', text, x: e.x, y: e.y - e.r });
}

function useAbility(w: World, e: Enemy, a: BossAbility) {
  const p = w.player;
  const P = a.params;
  const toP = Math.atan2(p.y - e.y, p.x - e.x);
  switch (a.kind) {
    case 'summon': {
      const def = ENEMY.get(String(P.enemy));
      if (!def) return;
      const n = num(P, 'count', 4), rad = num(P, 'radius', 60);
      for (let i = 0; i < n; i++) {
        if (aliveCount(w) >= MAX_ENEMIES) break;
        const ang = (i / n) * TAU + rand(w.rng);
        spawnEnemy(w, def, e.x + Math.cos(ang) * rad, e.y + Math.sin(ang) * rad, hpScale(w, !!def.boss));
      }
      break;
    }
    case 'wall': {
      const def = ENEMY.get(String(P.enemy));
      if (!def) return;
      const n = num(P, 'count', 16), rad = num(P, 'radius', 200);
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * TAU;
        spawnEnemy(w, def, p.x + Math.cos(ang) * rad, p.y + Math.sin(ang) * rad, hpScale(w, false));
      }
      w.events.push({ t: 'toast', text: a.shout ?? '긴급 회의 소집!', kind: 'warn' });
      break;
    }
    case 'charge': {
      e.st = 1; e.stT = num(P, 'windup', 0.8);
      e.dx = Math.cos(toP); e.dy = Math.sin(toP);
      e.t = 0;
      e.chargeSpeed = num(P, 'speed', 320);
      e.chargeDur = num(P, 'dur', 0.8);
      break;
    }
    case 'ring': {
      const n = num(P, 'bullets', 16), sp = num(P, 'speed', 140), dmg = num(P, 'damage', 10);
      const off = rand(w.rng) * TAU;
      for (let i = 0; i < n; i++) fireEnemyBullet(w, e.x, e.y, off + (i / n) * TAU, sp, dmg, String(P.sprite ?? '•'));
      w.events.push({ t: 'enemyShot' });
      break;
    }
    case 'aimed': {
      const n = num(P, 'bullets', 5), spr = num(P, 'spreadDeg', 40) * Math.PI / 180, sp = num(P, 'speed', 180), dmg = num(P, 'damage', 10);
      for (let i = 0; i < n; i++) {
        const k = n === 1 ? 0 : i / (n - 1) - 0.5;
        fireEnemyBullet(w, e.x, e.y, toP + k * spr, sp, dmg, String(P.sprite ?? '•'));
      }
      w.events.push({ t: 'enemyShot' });
      break;
    }
    case 'slam': {
      const windup = num(P, 'windup', 1.0);
      w.blasts.push({
        kind: 'slam', slot: -1, x: p.x, y: p.y, sx: p.x, sy: p.y, t: 0, delay: windup, r: num(P, 'radius', 80),
        dmg: num(P, 'damage', 20) * w.enemyDmgMul, knock: 0, puddle: 0, puddleDur: 0, hitCd: 0, trigger: 0, life: 0,
        armed: true, sprite: '', color: '#ff4d4d', hostile: true, dead: false, fx: null,
      });
      break;
    }
    case 'hazard': {
      const n = num(P, 'count', 3), rad = num(P, 'radius', 50);
      for (let i = 0; i < n; i++) {
        const ang = rand(w.rng) * TAU, d = randRange(w.rng, 0, 160);
        w.zones.push({
          x: p.x + Math.cos(ang) * d, y: p.y + Math.sin(ang) * d, r: rad, dps: num(P, 'dps', 12) * w.enemyDmgMul,
          tick: 0, t: 0, life: num(P, 'dur', 5), slot: -1, hostile: true, color: String(P.color ?? '#a05cff'), dead: false, fx: null, hitCd: 0.5,
        });
      }
      break;
    }
    case 'enrage': {
      if (e.enraged) return;
      e.enraged = true;
      e.spdMul = num(P, 'speedMul', 1.3);
      e.cdMul = num(P, 'cdMul', 0.75);
      w.events.push({ t: 'toast', text: `${e.def.name} 격노!`, kind: 'boss' });
      break;
    }
  }
  say(w, e, a.shout);
}

export function updateEnemies(w: World) {
  const p = w.player;
  const frozenAll = p.clockT > 0;
  const hw = w.viewW / 2, hh = w.viewH / 2;
  const farX = hw + 260, farY = hh + 260;

  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i];
    if (e.dead) continue;
    if (e.flash > 0) e.flash -= DT;
    if (e.contactCd > 0) e.contactCd -= DT;
    if (e.spawnT > 0) e.spawnT -= DT;
    if (e.shoutT > 0) e.shoutT -= DT;
    if (e.slowT > 0) { e.slowT -= DT; if (e.slowT <= 0) e.slowAmt = 0; }
    if (e.freezeT > 0) e.freezeT -= DT;
    if (e.stunT > 0) e.stunT -= DT;
    if (e.buffT > 0) e.buffT -= DT;
    for (let k = 0; k < 8; k++) if (e.hitCd[k] > 0) e.hitCd[k] -= DT;
    if (e.burnT > 0) {
      e.burnT -= DT; e.burnTick -= DT;
      if (e.burnTick <= 0) {
        e.burnTick = 0.25;
        e.hp -= e.burnDps * 0.25; e.flash = Math.max(e.flash, 0.04);
        if (e.hp <= 0) { killEnemy(w, e, e.lastHitSlot); continue; }
      }
    }

    const dxp = p.x - e.x, dyp = p.y - e.y;
    const dist = Math.hypot(dxp, dyp) || 1;
    const ux = dxp / dist, uy = dyp / dist;
    let mvx = 0, mvy = 0;

    const stopped = (frozenAll && !e.boss) || e.freezeT > 0 || e.stunT > 0;
    let spd = e.speed * e.spdMul;
    if (e.slowAmt > 0) spd *= 1 - Math.min(0.8, e.slowAmt);
    if (e.buffT > 0) spd *= 1 + e.buffAmt;
    if (frozenAll && e.boss) spd *= 0.5;
    if (e.spawnT > 0) spd *= 0.3;

    if (!stopped) {
      const P = e.def.params;
      e.t += DT;
      // 보스 능력
      const abil = e.def.abilities;
      if (abil && e.st === 0) {
        for (let k = 0; k < abil.length; k++) {
          const a = abil[k];
          if (a.hpBelow !== undefined && e.hp / e.maxHp > a.hpBelow) continue;
          if (a.kind === 'enrage') { if (!e.enraged) useAbility(w, e, a); continue; }
          e.abil[k] -= DT;
          if (e.abil[k] <= 0) {
            e.abil[k] = a.cooldown * e.cdMul;
            useAbility(w, e, a);
            if (e.st !== 0) break;
          }
        }
      }
      if (e.st === 1 && abil) {
        // 보스 돌진 예고
        e.stT -= DT;
        if (e.stT <= 0) { e.st = 2; e.stT = e.chargeDur; }
      } else if (e.st === 2 && abil) {
        mvx = e.dx * e.chargeSpeed; mvy = e.dy * e.chargeSpeed;
        e.stT -= DT;
        if (e.stT <= 0) e.st = 0;
      } else {
        switch (e.straight ? 'straight' : e.def.behavior) {
          case 'chase': mvx = ux * spd; mvy = uy * spd; break;
          case 'zigzag': {
            const amp = num(P, 'wobble', 30), fq = num(P, 'freq', 1.2);
            const lat = Math.cos(e.t * fq * TAU + e.seed) * amp * fq * TAU * 0.5;
            mvx = ux * spd - uy * lat; mvy = uy * spd + ux * lat;
            break;
          }
          case 'dash': {
            const range = num(P, 'dashRange', 180), cd = num(P, 'dashCd', 3);
            if (e.st === 0) {
              mvx = ux * spd; mvy = uy * spd;
              if (dist < range && e.t >= cd) { e.st = 11; e.stT = 0.6; e.dx = ux; e.dy = uy; }
            } else if (e.st === 11) {
              e.stT -= DT;
              if (e.stT <= 0) { e.st = 12; e.stT = num(P, 'dashDur', 0.5); }
            } else if (e.st === 12) {
              const ds = num(P, 'dashSpeed', 300);
              mvx = e.dx * ds; mvy = e.dy * ds;
              e.stT -= DT;
              if (e.stT <= 0) { e.st = 0; e.t = 0; }
            }
            break;
          }
          case 'ranged': {
            const keep = num(P, 'keep', 160);
            if (dist > keep + 20) { mvx = ux * spd; mvy = uy * spd; }
            else if (dist < keep - 20) { mvx = -ux * spd * 0.7; mvy = -uy * spd * 0.7; }
            else { mvx = -uy * spd * 0.5; mvy = ux * spd * 0.5; }
            if (e.t >= num(P, 'shotCd', 2.5) && dist < 520) {
              e.t = 0;
              fireEnemyBullet(w, e.x, e.y, Math.atan2(dyp, dxp), num(P, 'shotSpeed', 150), num(P, 'shotDamage', 6), String(P?.shotSprite ?? '•'));
            }
            break;
          }
          case 'spawner': {
            mvx = ux * spd; mvy = uy * spd;
            if (e.t >= num(P, 'spawnCd', 4)) {
              e.t = 0;
              const def = ENEMY.get(String(P?.spawnId));
              const n = num(P, 'spawnCount', 3);
              if (def) for (let k = 0; k < n && aliveCount(w) < MAX_ENEMIES; k++) {
                const a = rand(w.rng) * TAU;
                const c = spawnEnemy(w, def, e.x + Math.cos(a) * (e.r + 8), e.y + Math.sin(a) * (e.r + 8), hpScale(w, false));
                c.vx = Math.cos(a) * 80; c.vy = Math.sin(a) * 80;
              }
            }
            break;
          }
          case 'exploder': {
            if (e.st === 0) {
              mvx = ux * spd; mvy = uy * spd;
              if (dist < num(P, 'fuseRange', 60)) { e.st = 21; e.stT = num(P, 'fuse', 0.8); }
            } else {
              mvx = ux * spd * 0.3; mvy = uy * spd * 0.3;
              e.stT -= DT;
              if (e.stT <= 0) {
                const br = num(P, 'blastRadius', 60);
                w.events.push({ t: 'explode', x: e.x, y: e.y, r: br, color: '#ff7a1a', big: false });
                if (Math.hypot(p.x - e.x, p.y - e.y) < br + p.r) hurtPlayer(w, num(P, 'blastDamage', 15) * w.enemyDmgMul, e.def.name);
                e.dead = true; // 자폭: 보상 없음
                continue;
              }
            }
            break;
          }
          case 'healer': {
            mvx = ux * spd; mvy = uy * spd;
            if (e.t >= num(P, 'healCd', 3)) {
              e.t = 0;
              const hr = num(P, 'healRadius', 90), pct = num(P, 'healPct', 0.1);
              w.grid.query(e.x, e.y, hr, o => { if (!o.dead && !o.boss) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * pct); });
              w.events.push({ t: 'explode', x: e.x, y: e.y, r: hr, color: '#5dff9a', big: false });
            }
            break;
          }
          case 'buffer': {
            mvx = ux * spd; mvy = uy * spd;
            if (e.t >= num(P, 'buffCd', 3)) {
              e.t = 0;
              const br = num(P, 'buffRadius', 90), amt = num(P, 'buffPct', 0.3), dur = num(P, 'buffDur', 2);
              w.grid.query(e.x, e.y, br, o => { if (!o.dead && o !== e) { o.buffT = dur; o.buffAmt = amt; } });
              w.events.push({ t: 'explode', x: e.x, y: e.y, r: br, color: '#ffd84d', big: false });
            }
            break;
          }
          case 'straight': {
            mvx = e.dx * spd; mvy = e.dy * spd;
            break;
          }
        }
      }
    }
    if (mvx !== 0) e.face = mvx > 0 ? 1 : -1;
    e.x += (mvx + e.vx) * DT;
    e.y += (mvy + e.vy) * DT;
    e.vx *= 0.82; e.vy *= 0.82;

    // 접촉 피해
    const cr = e.r + p.r - 2;
    if (!stopped || e.boss) {
      if (dxp * dxp + dyp * dyp < cr * cr && e.contactCd <= 0) {
        e.contactCd = BALANCE.contactCooldown;
        hurtPlayer(w, e.damage, e.def.name);
      }
    }

    // 너무 멀어지면 진행 방향 앞쪽으로 재배치(일반 적만)
    if (!e.boss && !e.elite) {
      const ax = Math.abs(e.x - p.x), ay = Math.abs(e.y - p.y);
      if (ax > farX || ay > farY) {
        if (e.straight || e.def.behavior === 'straight') { e.dead = true; continue; }
        const q = edgePoint(w, 30);
        e.x = q.x; e.y = q.y;
      }
    }
  }
}

/** 적끼리 겹침 완화 (격자 기반) */
export function separateEnemies(w: World) {
  const g = w.grid;
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i];
    if (e.dead || e.boss) continue;
    let px = 0, py = 0, n = 0;
    g.neighbors(e, o => {
      if (n > 6) return true;
      if (o.dead) return;
      const dx = e.x - o.x, dy = e.y - o.y;
      const rr = (e.r + o.r) * 0.85;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (rr - d) / d * (o.boss ? 0.9 : 0.35);
        px += dx * push; py += dy * push; n++;
      }
    });
    if (n) { e.x += Math.max(-4, Math.min(4, px)); e.y += Math.max(-4, Math.min(4, py)); }
  }
}

export function updateEnemyBullets(w: World) {
  const p = w.player;
  for (const b of w.ebullets) {
    if (b.dead) continue;
    b.x += b.vx * DT; b.y += b.vy * DT;
    b.life -= DT;
    if (b.life <= 0) { b.dead = true; continue; }
    const rr = b.r + p.r - 3;
    if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < rr * rr) {
      b.dead = true;
      hurtPlayer(w, b.dmg, '탄막');
    }
  }
}
