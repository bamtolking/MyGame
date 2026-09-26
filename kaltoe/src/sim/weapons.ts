// 무기 14원형 + 투사체/폭발/장판/광선/고리 갱신
import type { WeaponStats } from '../content/types';
import { rand, randRange } from '../core/rng';
import { segDist2, TAU } from '../core/math';
import type { Blast, Bullet, Enemy, WeaponInst, World } from './types';
import { damageEnemy } from './damage';
import { hurtPlayer } from './player';

const DT = 1 / 60;

interface Eff {
  dmg: number; cd: number; amount: number; area: number; range: number; speed: number; dur: number;
  pierce: number; knock: number; hitCd: number; interval: number;
}

function eff(w: World, wi: WeaponInst): Eff {
  const st = wi.st, d = w.d;
  return {
    dmg: st.damage,
    cd: Math.max(0.05, st.cooldown * d.cdMul),
    amount: Math.max(1, Math.round(st.amount + d.amountAdd)),
    area: st.area * d.areaMul,
    range: st.range,
    speed: st.speed * d.projSpeedMul,
    dur: st.duration * d.durMul,
    pierce: st.pierce,
    knock: st.knockback,
    hitCd: Math.max(0.05, st.hitCooldown),
    interval: Math.max(0, st.interval),
  };
}

// ───────────── 대상 찾기 ─────────────

export function nearestEnemy(w: World, x: number, y: number, maxR: number, exclude?: (e: Enemy) => boolean): Enemy | null {
  let best: Enemy | null = null, bd = Infinity;
  w.grid.query(x, y, maxR, e => {
    if (e.dead || (exclude && exclude(e))) return;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd) { bd = d; best = e; }
  });
  return best;
}

function onScreen(w: World, e: Enemy, pad = 0): boolean {
  const p = w.player;
  return Math.abs(e.x - p.x) < w.viewW / 2 + pad && Math.abs(e.y - p.y) < w.viewH / 2 + pad;
}

export function randomEnemy(w: World, maxR: number, exclude?: Set<number>): Enemy | null {
  const p = w.player;
  const n = w.enemies.length;
  if (!n) return null;
  for (let tries = 0; tries < 14; tries++) {
    const e = w.enemies[Math.floor(rand(w.rng) * n)];
    if (e.dead || (exclude && exclude.has(e.uid))) continue;
    if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > maxR * maxR) continue;
    if (!onScreen(w, e, 20)) continue;
    return e;
  }
  return nearestEnemy(w, p.x, p.y, maxR, exclude ? e => exclude.has(e.uid) : undefined);
}

function pickTarget(w: World, wi: WeaponInst, maxR: number): Enemy | null {
  const p = w.player;
  switch (wi.def.targeting) {
    case 'nearest': {
      // 160u 안의 보스·엘리트를 잡몹보다 우선(잡몹 뒤에 숨은 보스 조준)
      let vip: Enemy | null = null, vd = Infinity;
      w.grid.query(p.x, p.y, 160, en => {
        if (en.dead || !(en.boss || en.elite)) return;
        const d = (en.x - p.x) ** 2 + (en.y - p.y) ** 2;
        if (d < vd) { vd = d; vip = en; }
      });
      return vip ?? nearestEnemy(w, p.x, p.y, maxR);
    }
    case 'random': return randomEnemy(w, maxR);
    case 'strongest': case 'lowest': {
      let best: Enemy | null = null, bv = wi.def.targeting === 'strongest' ? -Infinity : Infinity;
      w.grid.query(p.x, p.y, maxR, e => {
        if (e.dead) return;
        const v = e.hp;
        if (wi.def.targeting === 'strongest' ? v > bv : v < bv) { bv = v; best = e; }
      });
      return best;
    }
    case 'facing': default: return null;
  }
}

function aimAngle(w: World, wi: WeaponInst, maxR: number): number {
  const p = w.player;
  const t = wi.def.targeting === 'facing' ? null : pickTarget(w, wi, maxR);
  if (t) return Math.atan2(t.y - p.y, t.x - p.x);
  return Math.atan2(p.fy, p.fx);
}

// ───────────── 발사 ─────────────

function newBullet(w: World, wi: WeaponInst, kind: Bullet['kind'], x: number, y: number, ang: number, e: Eff): Bullet {
  const b: Bullet = {
    kind, slot: wi.slot, x, y, vx: Math.cos(ang) * e.speed, vy: Math.sin(ang) * e.speed, r: Math.max(3, e.area),
    dmg: e.dmg, pierce: e.pierce, knock: e.knock, life: e.dur, maxLife: e.dur,
    sprite: wi.def.projectile, rot: ang, spin: kind === 'boomerang' ? 14 : 0, hits: [],
    turn: wi.st.turnRate ?? 4, range: e.range, back: false, ox: x, oy: y, hitCd: e.hitCd, dead: false, fx: wi.st, tgt: null,
    hitAt: kind === 'boomerang' ? new Map() : null,
  };
  w.bullets.push(b);
  return b;
}

function fireOne(w: World, wi: WeaponInst, e: Eff) {
  const p = w.player;
  const a = wi.def.archetype;
  let sa = Math.atan2(p.fy, p.fx);   // 연출용 발사 방향(nova는 바라보는 방향)
  if (a === 'shot' || a === 'homing' || a === 'bounce') {
    const ang = aimAngle(w, wi, 420) + randRange(w.rng, -0.06, 0.06);
    newBullet(w, wi, a, p.x, p.y, ang, e);
    sa = ang;
  } else if (a === 'boomerang') {
    const ang = aimAngle(w, wi, e.range + 60) + randRange(w.rng, -0.25, 0.25);
    newBullet(w, wi, 'boomerang', p.x, p.y, ang, e);
    sa = ang;
  } else if (a === 'nova') {
    w.rings.push({ slot: wi.slot, x: p.x, y: p.y, r: 4, maxR: e.range * w.d.areaMul, speed: e.speed, dmg: e.dmg, knock: e.knock, hits: new Set(), color: wi.def.color, dead: false, fx: wi.st, w: Math.max(10, e.area) });
  }
  w.events.push({ t: 'shoot', w: wi.def.id, x: p.x, y: p.y, ang: sa });
}

function fireVolley(w: World, wi: WeaponInst, e: Eff) {
  const p = w.player;
  const def = wi.def;
  switch (def.archetype) {
    case 'spread': {
      const base = aimAngle(w, wi, 360);
      const spr = (wi.st.spreadDeg ?? 40) * Math.PI / 180;
      const n = e.amount;
      for (let i = 0; i < n; i++) {
        const k = n === 1 ? 0 : i / (n - 1) - 0.5;
        newBullet(w, wi, 'shot', p.x, p.y, base + k * spr + randRange(w.rng, -0.03, 0.03), e);
      }
      w.events.push({ t: 'shoot', w: def.id, x: p.x, y: p.y, ang: base });
      return;
    }
    case 'beam': {
      const base = aimAngle(w, wi, 420);
      const n = e.amount;
      for (let i = 0; i < n; i++) {
        w.beams.push({
          slot: wi.slot, x: p.x, y: p.y, ang: base + (i / n) * TAU, len: e.range * w.d.areaMul, w: e.area,
          life: e.dur, maxLife: e.dur, dmg: e.dmg, hitCd: e.hitCd, spin: (wi.st.spinDeg ?? 0) * Math.PI / 180,
          color: def.color, fx: wi.st, dead: false, knock: e.knock,
        });
      }
      w.events.push({ t: 'shoot', w: def.id, x: p.x, y: p.y, ang: base });
      return;
    }
    case 'chain': {
      const used = new Set<number>();
      let sa = Math.atan2(p.fy, p.fx);
      for (let i = 0; i < e.amount; i++) {
        // 서로 다른 대상을 우선하되, 대상이 모자라면 같은 적을 다시 친다(보스전)
        let tgt = randomEnemy(w, e.range, used) ?? randomEnemy(w, e.range);
        if (!tgt) break;
        used.add(tgt.uid);
        const struck = new Set<number>([tgt.uid]);   // 연쇄 안에서만 중복 제외
        const pts: number[] = [p.x, p.y - 20, tgt.x, tgt.y];
        let dmg = e.dmg;
        const a0 = Math.atan2(tgt.y - p.y, tgt.x - p.x);
        if (i === 0) sa = a0;
        damageEnemy(w, tgt, dmg, wi.slot, { fx: wi.st, knock: e.knock, ha: a0 });
        const chains = wi.st.chains ?? 2, cr = (wi.st.chainRange ?? 90) * Math.sqrt(w.d.areaMul), fall = wi.st.chainFalloff ?? 0.8;
        for (let c = 0; c < chains; c++) {
          const from: Enemy = tgt;
          const nx = nearestEnemy(w, from.x, from.y, cr, o => struck.has(o.uid));
          if (!nx) break;
          dmg *= fall;
          struck.add(nx.uid);
          damageEnemy(w, nx, dmg, wi.slot, { fx: wi.st, knock: e.knock * 0.5, ha: Math.atan2(nx.y - from.y, nx.x - from.x) });
          pts.push(nx.x, nx.y);
          tgt = nx;
        }
        w.events.push({ t: 'chain', pts, color: def.color });
      }
      w.events.push({ t: 'shoot', w: def.id, x: p.x, y: p.y, ang: sa });
      return;
    }
    case 'strike': {
      const used = new Set<number>();
      let sa = Math.atan2(p.fy, p.fx);
      for (let i = 0; i < e.amount; i++) {
        const tgt = randomEnemy(w, 520, used) ?? randomEnemy(w, 520);
        let x: number, y: number;
        if (tgt) { used.add(tgt.uid); x = tgt.x; y = tgt.y; }
        else { x = p.x + randRange(w.rng, -w.viewW / 2, w.viewW / 2); y = p.y + randRange(w.rng, -w.viewH / 2, w.viewH / 2); }
        if (i === 0) sa = Math.atan2(y - p.y, x - p.x);
        pushBlast(w, { kind: 'strike', slot: wi.slot, x, y, sx: x, sy: y, delay: (wi.st.delay ?? 0.5), r: e.area, dmg: e.dmg, knock: e.knock, sprite: def.projectile, color: def.color, fx: wi.st });
      }
      w.events.push({ t: 'shoot', w: def.id, x: p.x, y: p.y, ang: sa });
      return;
    }
    case 'lob': {
      const used = new Set<number>();
      let sa = Math.atan2(p.fy, p.fx);
      for (let i = 0; i < e.amount; i++) {
        const tgt = randomEnemy(w, e.range, used) ?? randomEnemy(w, e.range);
        let x: number, y: number;
        if (tgt) { used.add(tgt.uid); x = tgt.x; y = tgt.y; }
        else { const a = rand(w.rng) * TAU, d = randRange(w.rng, 60, e.range); x = p.x + Math.cos(a) * d; y = p.y + Math.sin(a) * d; }
        if (i === 0) sa = Math.atan2(y - p.y, x - p.x);
        pushBlast(w, {
          kind: 'lob', slot: wi.slot, x, y, sx: p.x, sy: p.y, delay: wi.st.delay ?? 0.6, r: e.area, dmg: e.dmg, knock: e.knock,
          puddle: wi.st.puddle ?? 0, puddleDur: e.dur, hitCd: e.hitCd, sprite: def.projectile, color: def.color, fx: wi.st,
        });
      }
      w.events.push({ t: 'shoot', w: def.id, x: p.x, y: p.y, ang: sa });
      return;
    }
    case 'mine': {
      let sa = Math.atan2(p.fy, p.fx);
      for (let i = 0; i < e.amount; i++) {
        const a = rand(w.rng) * TAU, d = randRange(w.rng, 10, 50);
        if (i === 0) sa = a;
        pushBlast(w, {
          kind: 'mine', slot: wi.slot, x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, sx: p.x, sy: p.y, delay: 0.4,
          r: e.area, dmg: e.dmg, knock: e.knock, trigger: (wi.st.trigger ?? 30) * Math.sqrt(w.d.areaMul), life: e.dur,
          sprite: def.projectile, color: def.color, fx: wi.st,
        });
      }
      w.events.push({ t: 'shoot', w: def.id, x: p.x, y: p.y, ang: sa });
      return;
    }
    default:
      // shot/homing/bounce/boomerang/nova: 간격 발사
      wi.burst = e.amount; wi.burstT = 0;
  }
}

function pushBlast(w: World, b: Partial<Blast> & Pick<Blast, 'kind' | 'slot' | 'x' | 'y' | 'r' | 'dmg'>) {
  w.blasts.push({
    sx: b.x, sy: b.y, t: 0, delay: 0.5, knock: 0, puddle: 0, puddleDur: 0, hitCd: 0.5, trigger: 0, life: 0,
    armed: false, sprite: '', color: '#ffffff', hostile: false, dead: false, fx: null, ...b,
  });
}

// ───────────── 무기별 갱신 ─────────────

export function updateWeapons(w: World) {
  const p = w.player;
  const fireMul = w.fireMulT > 0 ? w.fireMul : 1;
  for (const wi of w.weapons) {
    const e = eff(w, wi);
    const a = wi.def.archetype;
    if (a === 'aura') { updateAura(w, wi, e); continue; }
    if (a === 'orbit') { updateOrbit(w, wi, e, fireMul); continue; }
    if (a === 'drone') { updateDrones(w, wi, e, fireMul); continue; }

    wi.cd -= DT * fireMul;
    if (wi.cd <= 0 && wi.burst <= 0) {
      // 대상이 전혀 없으면(화면이 비었으면) 투사체 낭비를 막고 잠깐 대기
      if (a !== 'nova' && a !== 'mine' && !hasAnyEnemyNear(w, 520)) { wi.cd = 0.15; continue; }
      wi.cd = e.cd;
      fireVolley(w, wi, e);
    }
    if (wi.burst > 0) {
      wi.burstT -= DT * fireMul;
      while (wi.burst > 0 && wi.burstT <= 0) {
        fireOne(w, wi, e);
        wi.burst--;
        wi.burstT += e.interval;
        if (e.interval <= 0 && wi.burst > 0) continue;
      }
    }
  }
  void p;
}

function hasAnyEnemyNear(w: World, r: number): boolean {
  let found = false;
  w.grid.query(w.player.x, w.player.y, r, e => { if (!e.dead) { found = true; return true; } });
  return found;
}

function updateAura(w: World, wi: WeaponInst, e: Eff) {
  const p = w.player;
  const r = e.area;
  const tick = Math.max(0.08, e.hitCd * w.d.cdMul);
  w.grid.query(p.x, p.y, r, en => {
    if (en.dead || en.hitCd[wi.slot] > 0) return;
    en.hitCd[wi.slot] = tick;
    damageEnemy(w, en, e.dmg, wi.slot, { fx: wi.st, knock: e.knock });
  });
  wi.angle += DT;
}

function orbitRadius(w: World, wi: WeaponInst) { return wi.st.range * (1 + (w.d.areaMul - 1) * 0.5); }

export function orbitPositions(w: World, wi: WeaponInst): { x: number; y: number }[] {
  const p = w.player;
  const n = Math.max(1, Math.round(wi.st.amount + w.d.amountAdd));
  const R = orbitRadius(w, wi);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = wi.angle + (i / n) * TAU;
    out.push({ x: p.x + Math.cos(a) * R, y: p.y + Math.sin(a) * R });
  }
  return out;
}

function updateOrbit(w: World, wi: WeaponInst, e: Eff, fireMul: number) {
  // 재사용 대기는 켜지는 순간부터 센다: 가동률 = duration / cooldown (duration ≥ cooldown이면 상시)
  const always = e.dur >= e.cd;
  if (!always) {
    wi.cd -= DT * fireMul;
    if (wi.on > 0) wi.on -= DT;
    if (wi.cd <= 0) { wi.on = e.dur; wi.cd = e.cd; w.events.push({ t: 'shoot', w: wi.def.id, x: w.player.x, y: w.player.y, ang: Math.atan2(w.player.fy, w.player.fx) }); }
    if (wi.on <= 0) return;
  } else wi.on = 1;
  wi.angle += (e.speed * Math.PI / 180) * DT;
  const p = w.player;
  const objR = Math.max(6, e.area);
  for (const pos of orbitPositions(w, wi)) {
    w.grid.query(pos.x, pos.y, objR, en => {
      if (en.dead || en.hitCd[wi.slot] > 0) return;
      en.hitCd[wi.slot] = e.hitCd;
      damageEnemy(w, en, e.dmg, wi.slot, { fx: wi.st, knock: e.knock, kx: en.x - p.x, ky: en.y - p.y });
    });
  }
}

function updateDrones(w: World, wi: WeaponInst, e: Eff, fireMul: number) {
  const p = w.player;
  const n = e.amount;
  while (wi.drones.length < n) wi.drones.push({ x: p.x, y: p.y, cd: rand(w.rng) * e.cd });
  if (wi.drones.length > n) wi.drones.length = n;
  wi.angle += DT * 1.2;
  for (let i = 0; i < n; i++) {
    const d = wi.drones[i];
    const a = wi.angle + (i / n) * TAU;
    const tx = p.x + Math.cos(a) * 46, ty = p.y - 18 + Math.sin(a) * 30;
    d.x += (tx - d.x) * Math.min(1, DT * 6);
    d.y += (ty - d.y) * Math.min(1, DT * 6);
    d.cd -= DT * fireMul;
    if (d.cd <= 0) {
      const t = nearestEnemy(w, d.x, d.y, e.range || 360);
      if (!t) { d.cd = 0.2; continue; }
      d.cd = e.cd;
      const ang = Math.atan2(t.y - d.y, t.x - d.x);
      newBullet(w, wi, 'drone', d.x, d.y, ang, e);
      w.events.push({ t: 'shoot', w: wi.def.id, x: d.x, y: d.y, ang });
    }
  }
}

// ───────────── 투사체 ─────────────

export function updateBullets(w: World) {
  const p = w.player;
  for (const b of w.bullets) {
    if (b.dead) continue;
    b.life -= DT;
    if (b.kind === 'boomerang') {
      const dx0 = b.x - b.ox, dy0 = b.y - b.oy;
      if (!b.back && (dx0 * dx0 + dy0 * dy0 > b.range * b.range || b.life < b.maxLife * 0.5)) b.back = true;
      if (b.back) {
        const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
        const sp = Math.hypot(b.vx, b.vy);
        const want = Math.max(sp, 260);
        b.vx += (dx / d * want - b.vx) * Math.min(1, DT * 5);
        b.vy += (dy / d * want - b.vy) * Math.min(1, DT * 5);
        if (d < p.r + 10) { b.dead = true; continue; }
      } else {
        // 바깥으로 갈수록 감속
        b.vx *= 0.985; b.vy *= 0.985;
      }
      if (b.life < -3) { b.dead = true; continue; }
    } else if (b.life <= 0) { b.dead = true; continue; }

    if (b.kind === 'homing') {
      if (!b.tgt || b.tgt.dead || b.hits.includes(b.tgt.uid) || (w.step & 7) === 0) b.tgt = nearestEnemy(w, b.x, b.y, 320, e => b.hits.includes(e.uid));
      if (b.tgt) {
        const want = Math.atan2(b.tgt.y - b.y, b.tgt.x - b.x);
        const cur = Math.atan2(b.vy, b.vx);
        let da = want - cur;
        while (da > Math.PI) da -= TAU;
        while (da < -Math.PI) da += TAU;
        const maxT = b.turn * DT;
        const na = cur + Math.max(-maxT, Math.min(maxT, da));
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
      }
    }
    b.x += b.vx * DT; b.y += b.vy * DT;
    b.rot = b.spin ? b.rot + b.spin * DT : Math.atan2(b.vy, b.vx);
    if (Math.abs(b.x - p.x) > 1400 || Math.abs(b.y - p.y) > 1400) { b.dead = true; continue; }

    w.grid.query(b.x, b.y, b.r, en => {
      if (en.dead) return;
      if (b.kind === 'boomerang') {
        // 재타격 간격은 부메랑마다 따로(같은 무기의 부메랑끼리 서로 막지 않음)
        const next = b.hitAt!.get(en.uid);
        if (next !== undefined && next > w.t) return;
        b.hitAt!.set(en.uid, w.t + b.hitCd);
        damageEnemy(w, en, b.dmg, b.slot, { fx: b.fx, knock: b.knock, kx: b.vx, ky: b.vy });
        return;
      }
      if (b.hits.includes(en.uid)) return;
      b.hits.push(en.uid);
      if (b.hits.length > 40) b.hits.shift();
      damageEnemy(w, en, b.dmg, b.slot, { fx: b.fx, knock: b.knock, kx: b.vx, ky: b.vy });
      b.pierce--;
      if (b.kind === 'bounce' && b.pierce >= 0) {
        const nx = nearestEnemy(w, en.x, en.y, b.range || 160, o => b.hits.includes(o.uid));
        if (nx) {
          const sp = Math.hypot(b.vx, b.vy);
          const a = Math.atan2(nx.y - b.y, nx.x - b.x);
          b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
          b.life = Math.max(b.life, 0.6);
        } else b.dead = true;
      }
      if (b.pierce < 0) { b.dead = true; return true; }
    });
  }
}

// ───────────── 폭발/지뢰/예고 ─────────────

function detonate(w: World, b: Blast) {
  b.dead = true;
  if (b.hostile) {
    const p = w.player;
    if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 < (b.r + p.r) ** 2) hurtPlayer(w, b.dmg, '내리찍기', b.x, b.y);
    w.events.push({ t: 'explode', x: b.x, y: b.y, r: b.r, color: b.color, big: true });
    return;
  }
  w.grid.query(b.x, b.y, b.r, en => {
    if (en.dead) return;
    damageEnemy(w, en, b.dmg, b.slot, { fx: b.fx, knock: b.knock, kx: en.x - b.x, ky: en.y - b.y });
  });
  w.events.push({ t: 'explode', x: b.x, y: b.y, r: b.r, color: b.color, big: b.r > 70 });
  if (b.puddle > 0 && b.puddleDur > 0) {
    w.zones.push({
      x: b.x, y: b.y, r: b.r * 0.9, dps: b.dmg * b.puddle, tick: 0, t: 0, life: b.puddleDur, slot: b.slot,
      hostile: false, color: b.color, dead: false, fx: b.fx, hitCd: b.hitCd,
    });
  }
}

export function updateBlasts(w: World) {
  for (const b of w.blasts) {
    if (b.dead) continue;
    b.t += DT;
    if (b.kind === 'mine') {
      if (!b.armed && b.t >= b.delay) b.armed = true;
      if (b.armed) {
        let hit = false;
        w.grid.query(b.x, b.y, b.trigger, en => { if (!en.dead) { hit = true; return true; } });
        if (hit || b.t >= b.life) detonate(w, b);
      }
    } else if (b.t >= b.delay) detonate(w, b);
  }
}

export function updateZones(w: World) {
  const p = w.player;
  for (const z of w.zones) {
    if (z.dead) continue;
    z.t += DT;
    if (z.t >= z.life) { z.dead = true; continue; }
    z.tick -= DT;
    if (z.tick > 0) continue;
    z.tick = z.hitCd;
    if (z.hostile) {
      if ((p.x - z.x) ** 2 + (p.y - z.y) ** 2 < (z.r + p.r * 0.5) ** 2) hurtPlayer(w, z.dps * z.hitCd, '위험 지대', z.x, z.y);
    } else {
      w.grid.query(z.x, z.y, z.r, en => {
        if (en.dead) return;
        damageEnemy(w, en, z.dps * z.hitCd, z.slot, { fx: z.fx, noCrit: true });
      });
    }
  }
}

export function updateBeams(w: World) {
  const p = w.player;
  for (const b of w.beams) {
    if (b.dead) continue;
    b.life -= DT;
    if (b.life <= 0) { b.dead = true; continue; }
    b.x = p.x; b.y = p.y;
    b.ang += b.spin * DT;
    const ex = b.x + Math.cos(b.ang) * b.len, ey = b.y + Math.sin(b.ang) * b.len;
    const mx = (b.x + ex) / 2, my = (b.y + ey) / 2;
    w.grid.query(mx, my, b.len / 2 + b.w, en => {
      if (en.dead || en.hitCd[b.slot] > 0) return;
      const rr = b.w / 2 + en.r;
      if (segDist2(b.x, b.y, ex, ey, en.x, en.y) > rr * rr) return;
      en.hitCd[b.slot] = b.hitCd;
      damageEnemy(w, en, b.dmg, b.slot, { fx: b.fx, knock: b.knock, kx: Math.cos(b.ang), ky: Math.sin(b.ang) });
    });
  }
}

export function updateRings(w: World) {
  for (const r of w.rings) {
    if (r.dead) continue;
    r.r += r.speed * DT;
    if (r.r >= r.maxR) { r.dead = true; continue; }
    const inner = r.r - r.w;
    w.grid.query(r.x, r.y, r.r + r.w, en => {
      if (en.dead || r.hits.has(en.uid)) return;
      const d = Math.hypot(en.x - r.x, en.y - r.y);
      if (d + en.r < inner) return;
      r.hits.add(en.uid);
      damageEnemy(w, en, r.dmg, r.slot, { fx: r.fx, knock: r.knock, kx: en.x - r.x, ky: en.y - r.y });
    });
  }
}

/** 죽은 개체 정리(스왑 제거 없이 filter — 배열 크기가 작아 충분) */
export function compact(w: World) {
  if (w.step % 2 === 0) {
    w.enemies = w.enemies.filter(e => !e.dead);
    w.bullets = w.bullets.filter(b => !b.dead);
    w.pickups = w.pickups.filter(k => !k.dead);
    let n = 0;
    for (const k of w.pickups) if (k.kind === 'xp') n++;
    w.gemCount = n;
  }
  w.ebullets = w.ebullets.filter(b => !b.dead);
  w.blasts = w.blasts.filter(b => !b.dead);
  w.zones = w.zones.filter(z => !z.dead);
  w.beams = w.beams.filter(b => !b.dead);
  w.rings = w.rings.filter(r => !r.dead);
}

export type { WeaponStats };
